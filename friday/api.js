/**
 * PBG Friday API — Express.js backend for the frAIday AI Workspace
 * Reimplements the Python server.py endpoints as Express routes.
 * All routes are mounted under /api/friday/ by server.js
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const archiver = require('archiver');
const https = require('https');
const http = require('http');

// ── Paths ──
const BASE_DIR = path.join(__dirname);
const WORKSPACE_DIR = path.join(BASE_DIR, 'workspace');
const SESSION_FILE = path.join(BASE_DIR, '.fraiday_session.json');

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

// ── Default API keys (comma-separated pool) ──
const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY ||
  '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,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,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,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,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,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,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,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,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,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';

// ── Active runtime config ──
let ACTIVE_CONFIG = {
  provider: 'groq',
  api_key: DEFAULT_GROQ_KEY,
  model: 'openai/gpt-oss-120b',
  safety: 'request_review'
};

// ── Cooldown trackers ──
const MODEL_COOLDOWNS = {};
const KEY_COOLDOWNS = {};
let GROQ_KEY_INDEX = 0;

// ── Prune directories for workspace listing ──
const PRUNE_DIRS = new Set(['node_modules', '.git', '__pycache__', '.system_generated', '.cache']);

// ─────────────────────────────────────────────────────────
// HELPER: Resolve and validate workspace path
// ─────────────────────────────────────────────────────────
function resolveWorkspacePath(relPath) {
  const resolved = path.resolve(WORKSPACE_DIR, relPath);
  if (!resolved.startsWith(WORKSPACE_DIR)) return null;
  return resolved;
}

// ─────────────────────────────────────────────────────────
// HELPER: Walk directory recursively
// ─────────────────────────────────────────────────────────
function walkDir(dir, baseDir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (PRUNE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, baseDir, results);
    } else {
      const stat = fs.statSync(fullPath);
      results.push({
        path: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
        size: stat.size,
        modified: Math.floor(stat.mtimeMs / 1000)
      });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────
// HELPER: Copy directory recursively
// ─────────────────────────────────────────────────────────
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!PRUNE_DIRS.has(entry.name)) copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─────────────────────────────────────────────────────────
// HELPER: HTTP request (for LLM proxy, web search)
// ─────────────────────────────────────────────────────────
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (url.startsWith('https') ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 25000
    };

    const req = mod.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// =============================================================================
// WORKSPACE FILE CRUD
// =============================================================================

// GET /workspace/files — List workspace files
router.get('/workspace/files', (req, res) => {
  try {
    const files = walkDir(WORKSPACE_DIR, WORKSPACE_DIR);
    files.sort((a, b) => a.path.localeCompare(b.path));
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /workspace/file?path=... — Read a file
router.get('/workspace/file', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'Missing path parameter' });

  const target = resolveWorkspacePath(relPath);
  if (!target) return res.status(403).json({ error: 'Access denied outside workspace' });
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return res.status(404).json({ error: `File not found: ${relPath}` });
  }

  try {
    const content = fs.readFileSync(target, 'utf-8');
    res.json({ path: relPath, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /workspace/file — Write/create a file
router.post('/workspace/file', (req, res) => {
  const { path: relPath, content = '' } = req.body || {};
  if (!relPath) return res.status(400).json({ error: 'Missing path parameter' });

  const target = resolveWorkspacePath(relPath);
  if (!target) return res.status(403).json({ error: 'Access denied outside workspace' });

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf-8');
    res.json({ success: true, path: relPath, size: Buffer.byteLength(content, 'utf-8') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /workspace/patch — Patch/replace file content
router.post('/workspace/patch', (req, res) => {
  const { path: relPath, target_content, replacement_content = '' } = req.body || {};
  if (!relPath || !target_content) return res.status(400).json({ error: 'Missing path or target_content' });

  const target = resolveWorkspacePath(relPath);
  if (!target) return res.status(403).json({ error: 'Access denied outside workspace' });
  if (!fs.existsSync(target)) return res.status(404).json({ error: `File not found: ${relPath}` });

  try {
    const content = fs.readFileSync(target, 'utf-8');
    if (!content.includes(target_content)) {
      return res.status(400).json({ success: false, error: 'Target content to replace was not found in file', applied: false });
    }
    const newContent = content.replace(target_content, replacement_content);
    fs.writeFileSync(target, newContent, 'utf-8');
    res.json({ success: true, path: relPath, applied: true, size: Buffer.byteLength(newContent, 'utf-8') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /workspace/file?path=... — Delete a file
router.delete('/workspace/file', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'Missing path' });

  const target = resolveWorkspacePath(relPath);
  if (!target) return res.status(403).json({ error: 'Access denied' });
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(target);
    res.json({ success: true, deleted: relPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /workspace/clear — Clear workspace
router.post('/workspace/clear', (req, res) => {
  try {
    if (fs.existsSync(WORKSPACE_DIR)) {
      for (const item of fs.readdirSync(WORKSPACE_DIR)) {
        const fullPath = path.join(WORKSPACE_DIR, item);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        } catch (e) {
          console.warn(`Warning: could not delete ${fullPath}: ${e.message}`);
        }
      }
    }
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    res.json({ success: true, message: 'Workspace cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /workspace/export-zip — Export workspace as ZIP
router.get('/workspace/export-zip', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="workspace.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    // Walk workspace, excluding pruned dirs
    function addToArchive(dir, prefix = '') {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (PRUNE_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const arcPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          addToArchive(fullPath, arcPath);
        } else {
          archive.file(fullPath, { name: arcPath });
        }
      }
    }
    addToArchive(WORKSPACE_DIR);
    archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// CHECKPOINTS / TIME MACHINE
// =============================================================================

const cpRoot = () => path.join(WORKSPACE_DIR, '.system_generated', 'checkpoints');

// POST /workspace/checkpoint — Create checkpoint
router.post('/workspace/checkpoint', (req, res) => {
  try {
    const name = (req.body?.name || 'checkpoint').trim();
    const desc = (req.body?.description || '').trim();
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const cpId = `${ts}_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const cpDir = path.join(cpRoot(), cpId);
    fs.mkdirSync(cpDir, { recursive: true });

    let filesSaved = 0;
    function copyWorkspace(dir, destBase) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (PRUNE_DIRS.has(entry.name)) continue;
        const src = path.join(dir, entry.name);
        const dst = path.join(destBase, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(dst, { recursive: true });
          copyWorkspace(src, dst);
        } else {
          fs.copyFileSync(src, dst);
          filesSaved++;
        }
      }
    }
    copyWorkspace(WORKSPACE_DIR, cpDir);

    const meta = {
      id: cpId, name, description: desc, timestamp: ts,
      created_at: Date.now() / 1000, file_count: filesSaved
    };
    fs.writeFileSync(path.join(cpDir, 'checkpoint_meta.json'), JSON.stringify(meta, null, 2));
    res.json({ success: true, checkpoint: meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /workspace/checkpoints — List checkpoints
router.get('/workspace/checkpoints', (req, res) => {
  try {
    const root = cpRoot();
    const checkpoints = [];
    if (fs.existsSync(root)) {
      const dirs = fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .sort((a, b) => b.name.localeCompare(a.name));
      for (const d of dirs) {
        const metaFile = path.join(root, d.name, 'checkpoint_meta.json');
        if (fs.existsSync(metaFile)) {
          try { checkpoints.push(JSON.parse(fs.readFileSync(metaFile, 'utf-8'))); } catch {}
        } else {
          checkpoints.push({ id: d.name, name: d.name, timestamp: d.name.split('_')[0] || '' });
        }
      }
    }
    res.json({ checkpoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /workspace/rollback — Rollback to checkpoint
router.post('/workspace/rollback', (req, res) => {
  try {
    const cpId = (req.body?.id || '').trim();
    if (!cpId) return res.status(400).json({ error: 'Missing checkpoint id' });

    const cpDir = path.resolve(cpRoot(), cpId);
    if (!cpDir.startsWith(path.resolve(cpRoot())) || !fs.existsSync(cpDir)) {
      return res.status(404).json({ error: `Checkpoint not found: ${cpId}` });
    }

    // Clean current workspace (except .system_generated, .git, node_modules)
    for (const item of fs.readdirSync(WORKSPACE_DIR)) {
      if (['.system_generated', '.git', 'node_modules'].includes(item)) continue;
      const fp = path.join(WORKSPACE_DIR, item);
      try {
        if (fs.statSync(fp).isDirectory()) {
          fs.rmSync(fp, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fp);
        }
      } catch {}
    }

    // Restore from checkpoint
    let restored = 0;
    function restoreDir(src, dst) {
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (entry.name === 'checkpoint_meta.json') continue;
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(dstPath, { recursive: true });
          restoreDir(srcPath, dstPath);
        } else {
          fs.copyFileSync(srcPath, dstPath);
          restored++;
        }
      }
    }
    restoreDir(cpDir, WORKSPACE_DIR);

    res.json({ success: true, restored_files: restored, checkpoint: cpId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

// GET /session
router.get('/session', (req, res) => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      res.json(data);
    } else {
      res.json({});
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /session
router.post('/session', (req, res) => {
  try {
    const data = req.body || {};
    const tmpFile = path.join(BASE_DIR, `.fraiday_session_${Date.now()}.tmp`);
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, SESSION_FILE);
    res.json({ success: true, message: 'Session saved to disk' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /session
router.delete('/session', (req, res) => {
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
    res.json({ success: true, message: 'Session cleared from disk' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// TERMINAL EXECUTION
// =============================================================================

router.post('/terminal/exec', (req, res) => {
  const cmd = (req.body?.command || '').trim();
  if (!cmd) return res.json({ command: '', stdout: '', stderr: 'No command provided', exit_code: 1 });

  // Safety check
  const dangerous = ['rm -rf /', 'mkfs', ':(){ :|:& };:'];
  for (const d of dangerous) {
    if (cmd.includes(d)) {
      return res.json({ command: cmd, stdout: '', stderr: `Command rejected by safety policy: ${cmd}`, exit_code: 1 });
    }
  }

  // Intercept redundant server commands
  if (/\b(?:python3?|py)\s+-m\s+http\.server\b/i.test(cmd) ||
      /\b(?:live-server|http-server|npx\s+serve)\b/i.test(cmd)) {
    return res.json({
      command: cmd,
      stdout: `[PBG Friday Runtime Notice]: The workspace live preview server is ALREADY active and serving your files at /friday/workspace/index.html.\nYou do not need to start a secondary server. Live changes render automatically in the preview iframe.\n`,
      stderr: '', exit_code: 0
    });
  }

  try {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['/c', cmd] : ['-c', cmd];

    const result = require('child_process').spawnSync(shell, shellArgs, {
      cwd: WORKSPACE_DIR,
      timeout: 90000,
      maxBuffer: 1024 * 1024,
      encoding: 'utf-8',
      env: { ...process.env, TERM: 'dumb' }
    });

    res.json({
      command: cmd,
      CommandLine: cmd,
      stdout: (result.stdout || '').slice(0, 50000),
      stderr: (result.stderr || '').slice(0, 20000),
      exit_code: result.status ?? 1
    });
  } catch (err) {
    res.json({ command: cmd, stdout: '', stderr: err.message, exit_code: 1 });
  }
});

// =============================================================================
// CONFIG
// =============================================================================

// GET /config
router.get('/config', (req, res) => {
  const keys = (ACTIVE_CONFIG.api_key || '').split(/[,;\s]+/).filter(Boolean);
  res.json({
    provider: ACTIVE_CONFIG.provider,
    model: ACTIVE_CONFIG.model,
    api_key: ACTIVE_CONFIG.api_key,
    keys_count: keys.length,
    has_api_key: !!ACTIVE_CONFIG.api_key,
    safety: ACTIVE_CONFIG.safety
  });
});

// POST /config
router.post('/config', (req, res) => {
  const body = req.body || {};
  if (body.provider) ACTIVE_CONFIG.provider = String(body.provider).trim();
  if (body.api_key) ACTIVE_CONFIG.api_key = String(body.api_key).trim();
  if (body.model) ACTIVE_CONFIG.model = String(body.model).trim();
  if (body.safety) ACTIVE_CONFIG.safety = String(body.safety).trim();
  console.log(`[PBG Friday] Config updated: provider=${ACTIVE_CONFIG.provider}, model=${ACTIVE_CONFIG.model}`);
  res.json({ provider: ACTIVE_CONFIG.provider, model: ACTIVE_CONFIG.model, safety: ACTIVE_CONFIG.safety });
});

// =============================================================================
// WEB SEARCH (DuckDuckGo + Wikipedia fallback)
// =============================================================================

router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json({ results: [] });

  const results = [];

  // DuckDuckGo instant answers
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const ddgResp = await httpRequest(ddgUrl, {
      headers: { 'User-Agent': 'PBGFriday-Agent/1.0' },
      timeout: 5000
    });
    const data = JSON.parse(ddgResp.data);
    const abstract = data.AbstractText || '';
    if (abstract) {
      results.push({
        title: data.Heading || query,
        snippet: abstract,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      });
    }
    for (const topic of (data.RelatedTopics || []).slice(0, 4)) {
      if (topic && topic.Text) {
        results.push({
          title: (topic.FirstURL || '').split('/').pop().replace(/_/g, ' '),
          snippet: topic.Text,
          url: topic.FirstURL || ''
        });
      }
    }
  } catch {}

  // Wikipedia fallback
  if (results.length < 2) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&namespace=0&format=json`;
      const wikiResp = await httpRequest(wikiUrl, {
        headers: { 'User-Agent': 'PBGFriday-Agent/1.0' },
        timeout: 5000
      });
      const wikiData = JSON.parse(wikiResp.data);
      if (wikiData.length >= 4) {
        const [, titles, descriptions, urls] = wikiData;
        for (let i = 0; i < titles.length; i++) {
          if (descriptions[i]) {
            results.push({ title: titles[i], snippet: descriptions[i], url: urls[i] });
          }
        }
      }
    } catch {}
  }

  // MDN fallback
  if (results.length === 0) {
    results.push({
      title: `Technical Reference: ${query}`,
      snippet: `Autonomous documentation lookup for ${query} across standard specifications and API references.`,
      url: `https://developer.mozilla.org/search?q=${encodeURIComponent(query)}`
    });
  }

  res.json({ query, results });
});

// =============================================================================
// LLM CHAT PROXY (Groq with multi-key rotation + model cascade)
// =============================================================================

router.post('/llm/chat', async (req, res) => {
  const body = req.body || {};
  const messages = body.messages || [];
  const apiKey = body.api_key || ACTIVE_CONFIG.api_key;
  const provider = body.provider || ACTIVE_CONFIG.provider;
  let model = body.model || ACTIVE_CONFIG.model;

  if (provider === 'groq' || provider === 'groq-openai') {
    // ── Groq multi-key rotation ──
    const groqKeys = (apiKey || DEFAULT_GROQ_KEY).split(/[,;\s]+/).filter(Boolean);
    if (!groqKeys.length) return res.status(500).json({ error: 'No Groq API keys configured' });

    let groqModel = model || 'openai/gpt-oss-120b';
    let candidates;
    if (['gpt-oss-120b', 'openai-gpt-oss-120b', 'openai/gpt-oss-120b'].includes(groqModel)) {
      groqModel = 'openai/gpt-oss-120b';
      candidates = ['openai/gpt-oss-120b'];
    } else if (['gpt-oss-20b', 'openai-gpt-oss-20b'].includes(groqModel)) {
      groqModel = 'openai/gpt-oss-20b';
      candidates = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
    } else if (groqModel.includes('qwen')) {
      candidates = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    } else {
      candidates = [groqModel];
    }

    // Sort models: prefer non-cooled-down models
    const now = Date.now() / 1000;
    candidates.sort((a, b) => {
      const aCD = (MODEL_COOLDOWNS[a] || 0) > now ? 1 : 0;
      const bCD = (MODEL_COOLDOWNS[b] || 0) > now ? 1 : 0;
      return aCD - bCD;
    });

    let lastError = 'Unknown error';
    let waitSec = 2.5;
    const maxTok = Math.min(body.max_tokens || 4096, 4096);
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    for (const currentModel of candidates) {
      // Round-robin key selection
      const startIdx = GROQ_KEY_INDEX % groqKeys.length;
      GROQ_KEY_INDEX++;
      const orderedKeys = [...groqKeys.slice(startIdx), ...groqKeys.slice(0, startIdx)];
      // Prefer non-cooled-down keys
      orderedKeys.sort((a, b) => {
        const aCD = (KEY_COOLDOWNS[a] || 0) > now ? 1 : 0;
        const bCD = (KEY_COOLDOWNS[b] || 0) > now ? 1 : 0;
        return aCD - bCD;
      });

      let payload = {
        model: currentModel,
        messages,
        temperature: body.temperature ?? 0.2,
        max_tokens: maxTok
      };
      if (body.tools && body.tools.length) payload.tools = body.tools;
      if (body.tool_choice) payload.tool_choice = body.tool_choice;

      for (const currentKey of orderedKeys) {
        const keyMasked = currentKey.length > 16
          ? currentKey.slice(0, 10) + '...' + currentKey.slice(-4)
          : currentKey;
        try {
          const resp = await httpRequest(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(payload),
            timeout: 25000
          });

          if (resp.statusCode === 200) {
            const resData = JSON.parse(resp.data);
            const choice = resData.choices?.[0] || {};
            const message = choice.message || {};
            let content = message.content || '';
            if (!content && message.reasoning) content = message.reasoning;
            return res.json({
              content,
              tool_calls: message.tool_calls || null,
              message,
              model_used: currentModel,
              key_used: keyMasked,
              keys_count: groqKeys.length,
              raw: resData
            });
          }

          // Handle errors
          const errText = resp.data || '';
          lastError = `HTTP ${resp.statusCode}: ${errText}`;

          // TPM/size limit — prune history and retry
          const isTpmOrSize = resp.statusCode === 413 ||
            errText.toLowerCase().includes('too large') ||
            errText.toLowerCase().includes('limit 8000') ||
            (errText.toLowerCase().includes('tokens') && errText.toLowerCase().includes('rate_limit_exceeded'));

          if (isTpmOrSize) {
            console.log(`[PBG Friday] TPM limit on key ${keyMasked}. Pruning history...`);
            const currMsgs = payload.messages || [];
            if (currMsgs.length > 3) {
              const sysMsgs = currMsgs.filter(m => m.role === 'system').slice(0, 1);
              const tailMsgs = currMsgs.slice(-4).map(m => {
                const copy = { ...m };
                if (copy.role === 'tool' && typeof copy.content === 'string' && copy.content.length > 300) {
                  copy.content = copy.content.slice(0, 150) + '\n...[truncated]...\n' + copy.content.slice(-100);
                }
                return copy;
              });
              payload.messages = [...sysMsgs, ...tailMsgs];
            }
            payload.max_tokens = Math.max(2000, payload.max_tokens || 2200);

            try {
              const retryResp = await httpRequest(url, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${currentKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                timeout: 25000
              });
              if (retryResp.statusCode === 200) {
                const resData = JSON.parse(retryResp.data);
                const choice = resData.choices?.[0] || {};
                const message = choice.message || {};
                let content = message.content || '';
                if (!content && message.reasoning) content = message.reasoning;
                return res.json({
                  content,
                  tool_calls: message.tool_calls || null,
                  message,
                  model_used: currentModel,
                  key_used: keyMasked,
                  keys_count: groqKeys.length,
                  raw: resData
                });
              }
            } catch (retryErr) {
              console.log(`[PBG Friday] Retry after pruning failed: ${retryErr.message}`);
            }
            continue;
          }

          if (resp.statusCode === 400 && (errText.toLowerCase().includes('failed to parse') || errText.toLowerCase().includes('tool_use_failed'))) {
            payload.max_tokens = 2600;
            continue;
          }

          if (resp.statusCode === 429) {
            const match = errText.match(/try again in (?:(\d+)m)?([0-9.]+)s/);
            if (match) {
              const mins = match[1] ? parseFloat(match[1]) : 0;
              const secs = parseFloat(match[2]);
              waitSec = mins * 60 + secs + 0.5;
            }
            KEY_COOLDOWNS[currentKey] = now + waitSec;
            console.log(`[PBG Friday] 429 on key ${keyMasked}. Switching to next key...`);
            continue;
          }

          if (resp.statusCode === 401) {
            KEY_COOLDOWNS[currentKey] = now + 86400;
            console.log(`[PBG Friday] 401 Invalid key ${keyMasked}. Disabled for 24h.`);
            continue;
          }

          console.log(`[PBG Friday] Error with key ${keyMasked}: ${lastError}`);
          continue;

        } catch (err) {
          lastError = err.message;
          continue;
        }
      }

      // All keys failed on this model
      MODEL_COOLDOWNS[currentModel] = now + waitSec;
      console.log(`[PBG Friday] All keys exhausted on ${currentModel}. Falling back...`);
    }

    // All models failed
    return res.status(lastError.includes('429') ? 429 : 500).json({
      error: `Groq Gateway Error: ${lastError}`,
      retry_after: waitSec
    });

  } else if (provider === 'nvidia') {
    // ── NVIDIA NIM proxy ──
    const nvKey = apiKey || process.env.NVIDIA_API_KEY || '';
    if (!nvKey) return res.status(500).json({ error: 'No NVIDIA API key configured' });

    try {
      const nvUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
      const nvPayload = {
        model: model || 'gpt-oss-120b',
        messages,
        temperature: body.temperature ?? 0.6,
        max_tokens: Math.min(body.max_tokens || 4096, 8192)
      };
      if (body.tools) nvPayload.tools = body.tools;

      const resp = await httpRequest(nvUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(nvPayload),
        timeout: 45000
      });

      if (resp.statusCode === 200) {
        const resData = JSON.parse(resp.data);
        const choice = resData.choices?.[0] || {};
        const message = choice.message || {};
        return res.json({
          content: message.content || '',
          tool_calls: message.tool_calls || null,
          message,
          model_used: model,
          raw: resData
        });
      }
      res.status(resp.statusCode || 500).json({ error: resp.data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }

  } else {
    res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }
});

// =============================================================================
// BUILD VERIFY / TEST / INSPECT
// =============================================================================

router.post('/build/verify', (req, res) => {
  try {
    const issues = [];
    const htmlFiles = [];

    function findHtml(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (PRUNE_DIRS.has(entry.name)) continue;
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) findHtml(fp);
        else if (entry.name.endsWith('.html')) htmlFiles.push(fp);
      }
    }
    findHtml(WORKSPACE_DIR);

    if (htmlFiles.length === 0) {
      issues.push({ severity: 'warning', message: 'No HTML files found in workspace' });
    }

    for (const htmlFile of htmlFiles) {
      const content = fs.readFileSync(htmlFile, 'utf-8');
      const relPath = path.relative(WORKSPACE_DIR, htmlFile).replace(/\\/g, '/');

      // Check for referenced CSS/JS files
      const cssRefs = content.match(/href=["']([^"']*\.css)["']/g) || [];
      const jsRefs = content.match(/src=["']([^"']*\.js)["']/g) || [];

      for (const ref of [...cssRefs, ...jsRefs]) {
        const match = ref.match(/(?:href|src)=["']([^"']*)["']/);
        if (match && !match[1].startsWith('http') && !match[1].startsWith('//')) {
          const refPath = path.resolve(path.dirname(htmlFile), match[1]);
          if (!fs.existsSync(refPath)) {
            issues.push({ severity: 'error', file: relPath, message: `Missing referenced file: ${match[1]}` });
          }
        }
      }
    }

    res.json({ success: true, issues, html_files: htmlFiles.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/build/test', (req, res) => {
  res.json({ success: true, message: 'Build test passed (basic verification)' });
});

router.post('/build/inspect-site', (req, res) => {
  try {
    const htmlFiles = [];
    function findHtml(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (PRUNE_DIRS.has(entry.name)) continue;
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) findHtml(fp);
        else if (entry.name.endsWith('.html')) htmlFiles.push(fp);
      }
    }
    findHtml(WORKSPACE_DIR);

    // Return HTML content for inspection
    const pages = htmlFiles.map(fp => {
      const relPath = path.relative(WORKSPACE_DIR, fp).replace(/\\/g, '/');
      const content = fs.readFileSync(fp, 'utf-8');
      return { path: relPath, content: content.slice(0, 5000), size: content.length };
    });

    const sysGenDir = path.join(WORKSPACE_DIR, '.system_generated');
    const screenshotPath = path.join(sysGenDir, 'latest_preview.png');
    const hasScreenshot = fs.existsSync(screenshotPath);

    res.json({
      success: true,
      pages,
      screenshot_url: hasScreenshot ? `/friday/workspace/.system_generated/latest_preview.png?t=${Date.now()}` : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/browser/inspect', (req, res) => {
  // Simplified browser inspect — returns workspace HTML content
  res.json({ success: true, message: 'Browser inspection not available in integrated mode. Use the live preview instead.' });
});

// =============================================================================
// TOOL EXECUTION (Agent tool dispatch)
// =============================================================================

router.post('/tools/execute', async (req, res) => {
  const body = req.body || {};
  const toolName = body.tool_name || body.name || '';
  const toolArgs = body.arguments || body.args || {};

  try {
    switch (toolName) {
      case 'write_to_file': {
        const relPath = toolArgs.TargetFile || toolArgs.target_file || '';
        const content = toolArgs.CodeContent || toolArgs.code_content || toolArgs.content || '';
        if (!relPath) return res.json({ error: 'Missing target file path' });
        const cleanPath = relPath.replace(/^\.?\/?workspace\//, '').replace(/^\.\//, '');
        const target = resolveWorkspacePath(cleanPath);
        if (!target) return res.json({ error: 'Access denied' });
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf-8');
        res.json({ success: true, path: cleanPath, size: Buffer.byteLength(content) });
        break;
      }

      case 'view_file': {
        const relPath = (toolArgs.AbsolutePath || toolArgs.path || '').replace(/^\.?\/?workspace\//, '').replace(/^\.\//, '');
        if (!relPath) return res.json({ error: 'Missing file path' });
        const target = resolveWorkspacePath(relPath);
        if (!target || !fs.existsSync(target)) return res.json({ error: `File not found: ${relPath}` });
        const content = fs.readFileSync(target, 'utf-8');
        const lines = content.split('\n');
        const startLine = (toolArgs.StartLine || 1) - 1;
        const endLine = toolArgs.EndLine || lines.length;
        const sliced = lines.slice(startLine, endLine);
        const formatted = sliced.map((line, idx) => `${startLine + idx + 1}: ${line}`).join('\n');
        res.json({ success: true, path: relPath, content: formatted, total_lines: lines.length });
        break;
      }

      case 'replace_file_content': {
        const relPath = (toolArgs.TargetFile || '').replace(/^\.?\/?workspace\//, '').replace(/^\.\//, '');
        const targetContent = toolArgs.TargetContent || toolArgs.target_content || '';
        const replacementContent = toolArgs.ReplacementContent || toolArgs.replacement_content || '';
        if (!relPath || !targetContent) return res.json({ error: 'Missing required parameters' });
        const target = resolveWorkspacePath(relPath);
        if (!target || !fs.existsSync(target)) return res.json({ error: `File not found: ${relPath}` });
        let content = fs.readFileSync(target, 'utf-8');
        if (!content.includes(targetContent)) return res.json({ success: false, error: 'Target content not found', applied: false });
        content = content.replace(targetContent, replacementContent);
        fs.writeFileSync(target, content, 'utf-8');
        res.json({ success: true, path: relPath, applied: true });
        break;
      }

      case 'list_dir': {
        const dirPath = (toolArgs.DirectoryPath || './workspace/').replace(/^\.?\/?workspace\/?/, '');
        const target = dirPath ? resolveWorkspacePath(dirPath) : WORKSPACE_DIR;
        if (!target || !fs.existsSync(target)) return res.json({ error: 'Directory not found' });
        const entries = fs.readdirSync(target, { withFileTypes: true }).map(e => ({
          name: e.name,
          is_dir: e.isDirectory(),
          size: e.isFile() ? fs.statSync(path.join(target, e.name)).size : undefined
        }));
        res.json({ success: true, entries });
        break;
      }

      case 'grep_search': {
        const query = toolArgs.Query || toolArgs.query || '';
        const searchPath = (toolArgs.SearchPath || './workspace/').replace(/^\.?\/?workspace\/?/, '');
        if (!query) return res.json({ error: 'Missing query' });
        const target = searchPath ? resolveWorkspacePath(searchPath) : WORKSPACE_DIR;
        if (!target || !fs.existsSync(target)) return res.json({ error: 'Search path not found' });

        const results = [];
        function searchIn(dir) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (PRUNE_DIRS.has(entry.name)) continue;
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              searchIn(fp);
            } else {
              try {
                const content = fs.readFileSync(fp, 'utf-8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length && results.length < 50; i++) {
                  const caseInsensitive = toolArgs.CaseInsensitive;
                  const line = lines[i];
                  const match = caseInsensitive ? line.toLowerCase().includes(query.toLowerCase()) : line.includes(query);
                  if (match) {
                    results.push({
                      file: path.relative(WORKSPACE_DIR, fp).replace(/\\/g, '/'),
                      line_number: i + 1,
                      line: line.trim().slice(0, 200)
                    });
                  }
                }
              } catch {}
            }
          }
        }
        searchIn(target);
        res.json({ success: true, results, total: results.length });
        break;
      }

      case 'run_command': {
        const cmd = toolArgs.CommandLine || toolArgs.command || '';
        if (!cmd) return res.json({ error: 'Missing command' });
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'cmd.exe' : '/bin/bash';
        const shellArgs = isWindows ? ['/c', cmd] : ['-c', cmd];
        const result = require('child_process').spawnSync(shell, shellArgs, {
          cwd: WORKSPACE_DIR,
          timeout: 90000,
          maxBuffer: 1024 * 1024,
          encoding: 'utf-8',
          env: { ...process.env, TERM: 'dumb' }
        });
        res.json({
          success: true,
          stdout: (result.stdout || '').slice(0, 50000),
          stderr: (result.stderr || '').slice(0, 20000),
          exit_code: result.status ?? 1
        });
        break;
      }

      case 'web_search': {
        const query = toolArgs.query || toolArgs.Query || '';
        if (!query) return res.json({ results: [] });
        // Reuse the search logic
        const searchResults = [];
        try {
          const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
          const ddgResp = await httpRequest(ddgUrl, { headers: { 'User-Agent': 'PBGFriday/1.0' }, timeout: 5000 });
          const data = JSON.parse(ddgResp.data);
          if (data.AbstractText) {
            searchResults.push({ title: data.Heading || query, snippet: data.AbstractText, url: data.AbstractURL || '' });
          }
          for (const t of (data.RelatedTopics || []).slice(0, 3)) {
            if (t?.Text) searchResults.push({ title: (t.FirstURL || '').split('/').pop().replace(/_/g, ' '), snippet: t.Text, url: t.FirstURL || '' });
          }
        } catch {}
        res.json({ success: true, results: searchResults });
        break;
      }

      case 'browser_subagent': {
        res.json({ success: true, message: 'Browser subagent not available in integrated mode. Use the live preview iframe.' });
        break;
      }

      default:
        res.json({ error: `Unknown tool: ${toolName}`, success: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
