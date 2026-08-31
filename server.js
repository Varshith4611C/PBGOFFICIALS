const express = require('express');
const path = require('path');
const axios = require('axios');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initChatSocket } = require('./chatbox/api');
const { initGameSocket } = require('./games/business-board/api');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

// ── SEO & Security headers ──
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  next();
});

// ── Serve all static files (HTML, CSS, JS, images) from the project root ──
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],          // allows visiting /about → about.html
  index: 'index.html',           // default file for "/"
  dotfiles: 'allow',             // serve .well-known directory
}));

// ── Serve assets folder explicitly ──
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Serve .well-known directory explicitly ──
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

// ── Load .env file if present ──
const fs = require('fs');
if (fs.existsSync(path.join(__dirname, '.env'))) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    });
  } catch (e) {
    console.warn('Could not read .env file:', e.message);
  }
}

// ── Body Parser ──
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Anime API routes ──
const animeApi = require('./anime/api');
app.use('/api/anime', animeApi);

// ── PBG AI Endpoint (NVIDIA NIM Integration) ──
const DEFAULT_AI_MODEL = 'meta/llama-3.2-11b-vision-instruct';

app.post('/api/ai/chat', async (req, res) => {
  let { messages, model = DEFAULT_AI_MODEL, apiKey: clientKey } = req.body || {};

  const apiKey = (clientKey && typeof clientKey === 'string' && clientKey.trim())
    ? clientKey.trim()
    : (process.env.NVIDIA_API_KEY || '').trim();

  if (!apiKey) {
    return res.status(401).json({
      error: 'NVIDIA API Key not found. Please click the Settings ⚙️ icon in PBG AI to add your NVIDIA API key.'
    });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  const systemPrompt = {
    role: 'system',
    content: `You are PBG AI, the official cybernetic intelligent AI assistant for PBG Officials (https://pbgofficials.dev).
You are smart, helpful, witty, friendly, and tech-savvy.
PBG Officials is a multi-platform digital entertainment hub featuring:
- PBG Anime: Free HD anime streaming, latest trending episodes, sub & dub player (/anime/).
- PBG Manga: Fast, clean manga reading platform.
- PBG TV: Live IPTV streaming entertainment.
- PBG ChatBox: Real-time community chat rooms, synchronized 24/7 live music radio stations, anime cinema watch parties (/chatbox/).
- PBG Games & Tech: High-speed gaming experiences and digital creations.

Guidelines:
- Answer questions about PBG Officials platforms, features, and site navigation.
- Recommend anime, discuss characters, manga, music, gaming, tech, and code.
- Write clean code, explain concepts, and format responses cleanly with Markdown (bold, bullet points, syntax-highlighted code blocks).
- Be engaging, conversational, and concise.`
  };

  const formattedMessages = [systemPrompt, ...messages.filter(m => m && m.role !== 'system')];

  // Helper function to call NVIDIA NIM
  const callNvidia = async (selectedModel) => {
    return await axios.post(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        model: selectedModel,
        messages: formattedMessages,
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 1024,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 45000,
      }
    );
  };

  try {
    let response;
    let usedModel = model || DEFAULT_AI_MODEL;

    try {
      response = await callNvidia(usedModel);
    } catch (modelErr) {
      // If requested model was sunset/deprecated (410) or not found (404), fallback to active default model
      if ((modelErr.response?.status === 410 || modelErr.response?.status === 404) && usedModel !== DEFAULT_AI_MODEL) {
        console.warn(`Model ${usedModel} returned ${modelErr.response?.status}, falling back to ${DEFAULT_AI_MODEL}`);
        usedModel = DEFAULT_AI_MODEL;
        response = await callNvidia(usedModel);
      } else {
        throw modelErr;
      }
    }

    const reply = response.data?.choices?.[0]?.message?.content || 'No response generated.';
    res.json({
      reply,
      model: usedModel,
      usage: response.data?.usage
    });
  } catch (err) {
    console.error('NVIDIA AI API error:', err.response?.data || err.message);
    const errorDetail = err.response?.data?.message || err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to communicate with NVIDIA AI.';
    res.status(err.response?.status || 500).json({ error: errorDetail });
  }
});

// ── Music Live Radio Proxy Endpoint ──
const http = require('http');
const https = require('https');
app.get('/api/music/radio-proxy', (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl) return res.status(400).send('Missing stream URL');

  try {
    const client = streamUrl.startsWith('https') ? https : http;
    const proxyReq = client.get(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Icy-MetaData': '0',
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).send('Proxy error: ' + err.message);
      }
    });

    req.on('close', () => {
      proxyReq.destroy();
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send('Proxy failure: ' + err.message);
    }
  }
});

// ── YouTube Music Direct Search Endpoint ──
const ytSearchCache = new Map();
const YT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

app.get('/api/music/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json({ results: [] });

  const cacheKey = query.toLowerCase();
  const cached = ytSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < YT_CACHE_TTL) {
    return res.json({ results: cached.results });
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const searchRes = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000
    });

    const html = searchRes.data;
    let results = [];

    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        if (contents && Array.isArray(contents)) {
          for (const section of contents) {
            const items = section.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const vr = item.videoRenderer;
              if (vr && vr.videoId) {
                const thumbs = vr.thumbnail?.thumbnails || [];
                const bestThumb = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;
                results.push({
                  videoId: vr.videoId,
                  title: vr.title?.runs?.[0]?.text || vr.headline?.simpleText || 'YouTube Video',
                  artist: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || 'YouTube Creator',
                  thumbnail: bestThumb,
                  duration: vr.lengthText?.simpleText || '',
                  views: vr.shortViewCountText?.simpleText || '',
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('ytInitialData parse error:', e.message);
      }
    }

    if (results.length === 0) {
      const videoMatches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
      const seen = new Set();
      for (const vm of videoMatches) {
        const id = vm[1];
        if (!seen.has(id)) {
          seen.add(id);
          results.push({
            videoId: id,
            title: `YouTube Track (${id})`,
            artist: 'YouTube Audio',
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: '',
            views: '',
          });
        }
        if (results.length >= 12) break;
      }
    }

    const finalResults = results.slice(0, 20);
    ytSearchCache.set(cacheKey, { timestamp: Date.now(), results: finalResults });
    res.json({ results: finalResults });
  } catch (err) {
    console.error('YouTube search error:', err.message);
    res.status(500).json({ error: 'Search failed', results: [] });
  }
});

// ── Serve anime frontend ──
app.use('/anime', express.static(path.join(__dirname, 'anime'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── Serve chatbox frontend ──
app.use('/chatbox', express.static(path.join(__dirname, 'chatbox'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── Serve games frontend ──
app.use('/games', express.static(path.join(__dirname, 'games'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── Initialize Socket.IO for ChatBox ──
initChatSocket(io);

// ── Initialize Socket.IO for Business Board Game ──
initGameSocket(io);

// ── Fallback: send index.html for any unmatched route (SPA-friendly) ──
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──
httpServer.listen(PORT, () => {
  console.log(`\n  ⚡ PBG Officials server running at:\n`);
  console.log(`     Local:   http://localhost:${PORT}`);
  console.log(`     Network: http://0.0.0.0:${PORT}\n`);
});
