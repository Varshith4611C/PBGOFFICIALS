/**
 * frAIday — 1-to-1 Antigravity Autonomous Agentic Software Engineer
 * 
 * Exact Antigravity Mechanisms:
 * 1. Autonomous ReAct Tool-Calling Loop with Groq (openai/gpt-oss-120b) & Cerebras
 * 2. 8 Native Antigravity Tools:
 *    - run_command(CommandLine, Cwd)
 *    - write_to_file(TargetFile, CodeContent)
 *    - replace_file_content(TargetFile, TargetContent, ReplacementContent)
 *    - view_file(AbsolutePath, StartLine, EndLine)
 *    - list_dir(DirectoryPath)
 *    - grep_search(Query, SearchPath)
 *    - browser_subagent(Task)
 *    - search_web(query)
 * 3. Planning Mode & Artifacts:
 *    - implementation_plan.md with Human Approval Gate (Approve & Proceed / Revise Goal)
 *    - walkthrough.md with validation certification & embedded screenshots
 * 4. Autonomous Self-Healing:
 *    - Terminal stderr, tracebacks, and runtime errors are fed back into the agent loop.
 *    - The agent inspects errors with view_file/grep_search, patches code with replace_file_content,
 *      and verifies fixes with run_command and browser_subagent on its own!
 */

export const ANTIGRAVITY_TOOLS = [
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Execute a shell command on the host terminal in the workspace directory (e.g. pip install -r requirements.txt, npm install, python scripts, pytest). Returns stdout, stderr, and exit_code.",
      parameters: {
        type: "object",
        properties: {
          CommandLine: { type: "string", description: "The exact shell command line string to execute." },
          Cwd: { type: "string", description: "Optional relative subfolder within workspace to run in." }
        },
        required: ["CommandLine"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_to_file",
      description: "Create a NEW file that does not yet exist in the workspace, or generate implementation_plan.md / walkthrough.md. WARNING: NEVER use write_to_file to edit or update an existing code file; you MUST use replace_file_content instead.",
      parameters: {
        type: "object",
        properties: {
          TargetFile: { type: "string", description: "The target file path (relative to workspace)." },
          CodeContent: { type: "string", description: "The complete file contents to write." },
          Overwrite: { type: "boolean", description: "True to overwrite if file exists." },
          Description: { type: "string", description: "Brief description of what this change accomplishes." }
        },
        required: ["TargetFile", "CodeContent"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "replace_file_content",
      description: "Perform precise, targeted edits to an EXISTING file by replacing an exact TargetContent block with ReplacementContent. ALWAYS use this tool instead of write_to_file when updating, editing, or fixing existing files.",
      parameters: {
        type: "object",
        properties: {
          TargetFile: { type: "string", description: "The target file to modify." },
          TargetContent: { type: "string", description: "The exact substring or block of code to replace. Must match the existing file content exactly." },
          ReplacementContent: { type: "string", description: "The new content to replace TargetContent with." },
          StartLine: { type: "integer", description: "Optional starting line number." },
          EndLine: { type: "integer", description: "Optional ending line number." },
          AllowMultiple: { type: "boolean", description: "True to replace all occurrences." }
        },
        required: ["TargetFile", "TargetContent", "ReplacementContent"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "view_file",
      description: "View the contents of a file in the local workspace, optionally sliced with 1-indexed line numbers.",
      parameters: {
        type: "object",
        properties: {
          AbsolutePath: { type: "string", description: "Path to file in workspace." },
          StartLine: { type: "integer", description: "1-indexed starting line to view." },
          EndLine: { type: "integer", description: "1-indexed ending line to view." }
        },
        required: ["AbsolutePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List directory contents (files and subdirectories with sizes) in workspace.",
      parameters: {
        type: "object",
        properties: {
          DirectoryPath: { type: "string", description: "Relative directory path, empty for workspace root." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "grep_search",
      description: "Search for regex patterns or text matches across workspace files.",
      parameters: {
        type: "object",
        properties: {
          Query: { type: "string", description: "Text or regex query to search for." },
          SearchPath: { type: "string", description: "Directory to search in." },
          CaseInsensitive: { type: "boolean", description: "Case insensitive search." },
          IsRegex: { type: "boolean", description: "Treat query as regular expression." }
        },
        required: ["Query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_subagent",
      description: "Launch a headless browser subagent to render the workspace application entrypoint (index.html), capture screenshot, DOM tree, and inspect console errors for visual verification.",
      parameters: {
        type: "object",
        properties: {
          Task: { type: "string", description: "What to verify in the browser (e.g. check UI render, layout, buttons, console errors)." },
          TaskName: { type: "string", description: "Short title for the browser task." },
          TaskSummary: { type: "string", description: "Brief 1-2 sentence summary." }
        },
        required: ["Task"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for technical documentation, library APIs, and latest specifications.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Web search query." }
        },
        required: ["query"]
      }
    }
  }
];

export const ANTIGRAVITY_SYSTEM_PROMPT = `<identity>
You are frAIday, a powerful autonomous AI software engineer and coding assistant modeled exactly on Google DeepMind Antigravity.
You are pair programming with the user to solve their software development objectives from end-to-end.
You have direct, autonomous access to the workspace shell terminal, filesystem, web research, and headless browser inspection.
You do everything autonomously without expecting the user to install packages, run commands, or fix bugs for you.
</identity>

<planning_mode>
You operate strictly through the 4-Phase Antigravity Lifecycle:

PHASE 1: UPFRONT RESEARCH & MANDATORY PLANNING GATE (Before user clicks proceed):
- If the project requires external libraries, frameworks, or CDN scripts (e.g. Three.js, OrbitControls, Chart.js, Lucide, Tone.js), you MUST execute search_web to research and verify the exact, robust CDN script URLs and constructor API signatures BEFORE writing implementation_plan.md.
- For Three.js: ALWAYS use standard UMD CDN script tags:
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  This ensures THREE and THREE.OrbitControls are globally available to browser scripts without module specifier errors.
- Create implementation_plan.md using write_to_file detailing:
  # [Goal Description]
  Clear description of objective, architecture, and tech stack.
  ## User Review Required
  Design decisions, verified CDN libraries, or assumptions.
  ## Open Questions
  Points for user consideration.
  ## Proposed Changes
  ### [Component Name]
  #### [NEW] [filename](file:///workspace/path/to/file)
  #### [MODIFY] [filename](file:///workspace/path/to/file)
  ## Verification Plan
  ### Automated Tests
  Commands to run.
  ### Manual Verification
  Headless Chrome visual audit via browser_subagent.
- Once implementation_plan.md is written, execution will pause for the user to review and click "Approve & Proceed".
- DO NOT create code files (HTML, CSS, JS) or walkthrough.md before plan approval!

PHASE 2: EXECUTION & AUTONOMOUS CODE SYNTHESIS:
- After the plan is approved, write new code files using write_to_file.
- CRITICAL SURGICAL EDITING DIRECTIVE:
  * For EXISTING files, ALWAYS use replace_file_content to make targeted edits to specific lines or blocks.
  * You are STRICTLY FORBIDDEN from overwriting entire existing code files with write_to_file to make fixes or edits! Rewriting entire files causes code loss, breaks syntax, and introduces regressions.
  * ONLY use write_to_file when creating a brand new file that does not yet exist, or for implementation_plan.md / walkthrough.md.
- CRITICAL ANTI-REPETITION & MEMORY DIRECTIVE:
  * You already have the contents of files you viewed or created in your context history.
  * NEVER call view_file on a file you just viewed, just created, or just patched.
  * NEVER run the same shell command multiple times in a row unless you have modified code in between to fix the error.
- CRITICAL TEST RESULTS & ERROR SELF-CORRECTION DIRECTIVE:
  * When a command or test exits with code != 0 or returns stderr, the full error is provided in your tool response.
  * Carefully examine the traceback or compiler message to identify the offending file and line.
  * Apply a surgical fix using replace_file_content, and re-run the test to verify the exit code is 0.
- For web applications, create clean, modern index.html, style.css, and app.js.
- CRITICAL BROWSER FRONTEND vs NODE.JS EXECUTION RULE:
  Browser client scripts (e.g. app.js with document, window, localStorage, addEventListener, Canvas/WebGL) RUN ONLY IN THE WEB BROWSER.
  NEVER attempt to execute client-side browser files with Node.js in the terminal (e.g. DO NOT run node app.js). Node.js has no DOM window or document globals.
  ONLY use run_command for backend Python/Node servers, package managers (pip install, npm install), or CLI test runners.

PHASE 3: TESTING & HEADLESS BROWSER VISUAL AUDIT:
- Call browser_subagent to launch headless Chrome, render the live preview at http://localhost:3000/friday/workspace/index.html, take a screenshot, and verify that the page renders cleanly with 0 console errors.
- If errors or exceptions occur, diagnose them immediately with view_file or search_web, patch with replace_file_content, and re-audit with browser_subagent.

PHASE 4: WALKTHROUGH DOCUMENTATION (Definition of Done - Strictly Created at Last):
- walkthrough.md is the final completion certificate. It MUST ONLY be created at Phase 4, AFTER Phase 2 code is created AND Phase 3 browser_subagent visual verification has certified 0 errors!
- NEVER create walkthrough.md during Phase 1, Phase 2, or during error diagnostics!
- walkthrough.md must document:
  # Walkthrough - [Goal Title]
  ## Changes Made
  - List of files created/modified
  ## Verification Results
  - Headless Chrome visual audit findings, DOM element count, and clean error check
  ## Live Preview
  - Instructions to view http://localhost:3000/friday/workspace/index.html
</planning_mode>

<communication_style>
- Format responses in GitHub-style markdown.
- Create clickable links for files: [filename](file:///workspace/path/to/file).
- Use alerts: > [!NOTE], > [!IMPORTANT], > [!WARNING], > [!TIP].
- Keep conversational text focused; prioritize real tool calls over commentary.
</communication_style>`;

export class AgentEngine {
  constructor(options = {}) {
    this.monologueEl = options.monologueEl;
    this.streamContainer = options.streamContainer;
    this.statusPillEl = options.statusPillEl;
    this.terminal = options.terminal;
    this.safetyPolicy = options.safetyPolicy;
    this.dagCanvas = options.dagCanvas;
    this.knowledgeBase = options.knowledgeBase;
    this.fileTree = options.fileTree;
    this.codeEditor = options.codeEditor;
    this.onArtifactReady = options.onArtifactReady;
    this.onArtifactPlanReady = options.onArtifactPlanReady;
    this.onPlanPendingApproval = options.onPlanPendingApproval;
    this.onUserMessage = options.onUserMessage;
    this.onAgentResponse = options.onAgentResponse;
    this.onExecutionStart = options.onExecutionStart;
    this.onExecutionEnd = options.onExecutionEnd;
    this.onStatusChange = options.onStatusChange;
    this.onSystemAlert = options.onSystemAlert;
    this.onVerificationScreenshotReady = options.onVerificationScreenshotReady;

    this.isHealing = false;
    this.lastHealTime = 0;
    this.lastHealedError = '';

    this.state = 'idle';
    this.isPaused = false;
    this.isAborted = false;
    this.abortController = null;
    this.planApproved = false;
    this.currentGoal = '';
    this.planApprovalResolver = null;
    this.conversationHistory = [];
    this.timelineEvents = [];
    this._saveSessionTimer = null;
    this.recentToolCalls = [];
    this.fileModifiedSinceView = new Set();
    this.activeRuntimeErrors = new Map();

    this.apiBase = options.apiBase || (typeof window !== 'undefined' ? '' : '');

    const storage = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} };
    this.provider = storage.getItem('fraiday_provider') || 'groq';
    this.apiKey = storage.getItem('fraiday_api_key') || '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,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,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,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,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,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,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,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,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,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';
    this.model = storage.getItem('fraiday_model') || 'openai/gpt-oss-120b';

    this.turnCount = 0;
  }

  setLlmConfig(provider, apiKey, model) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fraiday_provider', provider);
      localStorage.setItem('fraiday_api_key', apiKey);
      localStorage.setItem('fraiday_model', model);
    }
  }

  saveSession() {
    try {
      const monologueBody = this.monologueEl ? (this.monologueEl.querySelector('.monologue-text') || this.monologueEl) : null;
      const sessionData = {
        currentGoal: this.currentGoal || '',
        state: this.state || 'idle',
        turnCount: this.turnCount || 0,
        planApproved: Boolean(this.planApproved),
        conversationHistory: this.conversationHistory || [],
        timelineEvents: this.timelineEvents || [],
        monologueHtml: monologueBody ? monologueBody.innerHTML : '',
        knowledgeItems: this.knowledgeBase?.items || [],
        dagStage: this.dagCanvas?.activeNodeId || null,
        dagNodes: this.dagCanvas?.nodes || null,
        savedAt: new Date().toISOString()
      };

      const serialized = JSON.stringify(sessionData);

      // 1. Browser local storage (instant cache for page refresh)
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('fraiday_session_v1', serialized);
        } catch (quotaErr) {
          console.warn('localStorage quota reached, relying on backend disk session:', quotaErr);
        }
      }

      // 2. Guaranteed on-disk persistence via backend /api/friday/session (persists across server restart & shutdown)
      if (typeof fetch !== 'undefined') {
        fetch(`${this.apiBase}/api/friday/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: serialized
        }).catch(err => {
          console.warn('Backend session disk write note:', err);
        });
      }
    } catch (err) {
      console.warn('Failed to save session:', err);
    }
  }

  debouncedSaveSession() {
    if (this._saveSessionTimer) clearTimeout(this._saveSessionTimer);
    this._saveSessionTimer = setTimeout(() => {
      this.saveSession();
    }, 150);
  }

  async clearSession() {
    if (this._saveSessionTimer) clearTimeout(this._saveSessionTimer);
    this.timelineEvents = [];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('fraiday_session_v1');
      } catch (_) {}
    }
    if (typeof fetch !== 'undefined') {
      try {
        await fetch(`${this.apiBase}/api/friday/session`, { method: 'DELETE' });
      } catch (_) {}
    }
  }

  recordTimelineEvent(event) {
    if (!this.timelineEvents) this.timelineEvents = [];
    if (!event.timestamp) {
      event.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    this.timelineEvents.push(event);
    this.debouncedSaveSession();
  }

  abort(reason = 'Execution manually stopped by user.') {
    this.isAborted = true;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (_) {}
    }
    if (this.planApprovalResolver) {
      const resolve = this.planApprovalResolver;
      this.planApprovalResolver = null;
      this.isPaused = false;
      resolve({ approved: false, aborted: true });
    }
    this.setState('idle');
    this.terminal?.appendOutput(`⏹ ${reason}`, 'warn');
    if (this.monologueEl) {
      const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
      if (body) {
        body.innerHTML = `<span style="color:#f87171;font-weight:600;">⏹ ${escapeHtml(reason)}</span><br/><span style="font-size:11px;color:#94a3b8;">Click Resume Objective or type a new instruction below.</span>`;
      }
    }
    if (this.onExecutionEnd) {
      this.onExecutionEnd({ aborted: true, reason });
    }
    this.saveSession();
  }

  reset() {
    this.isAborted = true;
    if (this.abortController) {
      try { this.abortController.abort(); } catch (_) {}
    }
    this.setState('idle');
    this.currentGoal = '';
    this.isPaused = false;
    this.planApproved = false;
    this.conversationHistory = [];
    this.timelineEvents = [];
    this.recentToolCalls = [];
    this.fileModifiedSinceView = new Set();
    this.planApprovalResolver = null;
    this.turnCount = 0;
    this.clearSession();

    if (this.monologueEl) {
      const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
      if (body) {
        body.innerHTML = '<span style="color:var(--text-muted);font-style:italic;">Workspace reset. Ready for your next technical objective.</span>';
      }
    }
    if (this.streamContainer) {
      if (this.streamContainer.id === 'chat-timeline') {
        this.streamContainer.querySelectorAll('.tool-card, .chat-msg-row').forEach(el => el.remove());
      } else {
        this.streamContainer.innerHTML = '';
      }
    }
    const streamCount = typeof document !== 'undefined' ? document.getElementById('tool-stream-count') : null;
    if (streamCount) streamCount.innerText = '0 calls';
    if (this.dagCanvas) {
      this.dagCanvas.clear();
    }
    if (this.onExecutionEnd) {
      this.onExecutionEnd({ reset: true });
    }
  }

  setState(newState, detail = '') {
    this.state = newState;
    if (this.statusPillEl) {
      this.statusPillEl.className = `execution-status-pill status-${newState}`;
      const label = this.statusPillEl.querySelector('.status-label');
      if (label) {
        const labels = {
          idle: 'System Idle',
          planning: 'Antigravity Planning Mode',
          researching: 'Researching Tech Specs',
          executing: 'Synthesizing Source Files',
          waiting: 'Planning Gate: Awaiting Approval',
          validating: 'Headless Browser Visual Audit',
          testing: 'Executing Terminal Test Harness',
          healing: 'Autonomous Self-Healing Loop',
          completed: 'Mission Accomplished',
          error: detail ? `Halted: ${detail}` : 'Execution Halted'
        };
        label.innerText = labels[newState] || (detail ? `${newState.toUpperCase()}: ${detail}` : newState.toUpperCase());
        this.statusPillEl.title = detail ? `Status: ${detail}` : (labels[newState] || newState);
      }
    }

    if (this.dagCanvas && typeof this.dagCanvas.setActiveStage === 'function') {
      const stageMap = {
        idle: 'goal_intake',
        planning: 'architecture_plan',
        researching: 'research',
        waiting: 'planning_gate',
        executing: 'code_synthesis',
        validating: 'verification',
        testing: 'verification',
        healing: 'self_healing',
        completed: 'delivery'
      };
      if (newState === 'completed') {
        this.dagCanvas.markComplete();
      } else if (stageMap[newState]) {
        this.dagCanvas.setActiveStage(stageMap[newState], detail || null);
      }
    }
  }

  async streamThought(text) {
    if (!this.monologueEl || !text) return;
    const body = this.monologueEl.querySelector('.monologue-text');
    if (!body) return;

    // Convert markdown thoughts to clean HTML
    const formatted = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .trim();

    if (!formatted) return;

    const words = formatted.split(' ');
    let current = '';
    for (let word of words) {
      current += word + ' ';
      body.innerHTML = current;
      await new Promise(r => setTimeout(r, 12));
    }
    this.debouncedSaveSession();
  }

  addAntigravityToolCard(toolName, toolArgs, existingId = null, skipRecord = false) {
    if (!this.streamContainer || typeof document === 'undefined') return null;
    const cardId = existingId || ('tool_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
    const card = document.createElement('div');
    card.className = 'tool-card running';
    card._toolName = toolName;
    card._toolArgs = toolArgs;
    card._cardId = cardId;
    card.setAttribute('data-card-id', cardId);

    const icons = {
      run_command: '💻',
      write_to_file: '📝',
      replace_file_content: '✂️',
      view_file: '🔍',
      list_dir: '📁',
      grep_search: '🔎',
      browser_subagent: '🌐',
      search_web: '🌍'
    };

    let intentHtml = '';
    if (toolName === 'search_web') {
      const q = toolArgs.query || toolArgs.Query || '';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#38bdf8;">🔍 Searched:</span>
          <span class="intent-value" style="color:#f8fafc;font-weight:600;">"${escapeHtml(q)}"</span>
        </div>
      `;
    } else if (toolName === 'view_file') {
      const file = toolArgs.AbsolutePath || toolArgs.TargetFile || '';
      const lineRange = toolArgs.StartLine ? ` (lines ${toolArgs.StartLine}-${toolArgs.EndLine || 'end'})` : '';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#38bdf8;">👁️ Viewing File:</span>
          <span class="intent-value" style="color:#f8fafc;font-weight:600;">${escapeHtml(file)}</span>
          <span style="color:#94a3b8;font-size:10.5px;">${escapeHtml(lineRange)}</span>
        </div>
      `;
    } else if (toolName === 'write_to_file') {
      const file = toolArgs.TargetFile || '';
      const desc = toolArgs.Description || '';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#10b981;">📝 Writing File:</span>
          <span class="intent-value" style="color:#f8fafc;font-weight:600;">${escapeHtml(file)}</span>
        </div>
        ${desc ? `<div class="intent-desc">${escapeHtml(desc)}</div>` : ''}
      `;
    } else if (toolName === 'replace_file_content') {
      const file = toolArgs.TargetFile || '';
      const instruction = toolArgs.Instruction || '';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#a855f7;">✂️ Patching File:</span>
          <span class="intent-value" style="color:#f8fafc;font-weight:600;">${escapeHtml(file)}</span>
        </div>
        ${instruction ? `<div class="intent-desc">${escapeHtml(instruction)}</div>` : ''}
      `;
    } else if (toolName === 'run_command') {
      const cmd = toolArgs.CommandLine || '';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#f59e0b;">💻 Command:</span>
          <code class="intent-value" style="color:#f8fafc;font-weight:600;">${escapeHtml(cmd)}</code>
        </div>
      `;
    } else if (toolName === 'list_dir') {
      const dir = toolArgs.DirectoryPath || './workspace/';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#38bdf8;">📁 Listing Directory:</span>
          <span class="intent-value" style="color:#f8fafc;font-weight:600;">${escapeHtml(dir)}</span>
        </div>
      `;
    } else if (toolName === 'grep_search') {
      const q = toolArgs.Query || '';
      const path = toolArgs.SearchPath || './workspace/';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#38bdf8;">🔎 Grep Search:</span>
          <span class="intent-value" style="color:#f8fafc;font-weight:600;">"${escapeHtml(q)}"</span>
          <span style="color:#94a3b8;font-size:10.5px;">in ${escapeHtml(path)}</span>
        </div>
      `;
    } else if (toolName === 'browser_subagent') {
      const task = toolArgs.Task || 'Inspect Live Preview';
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#38bdf8;">🌐 Browser Audit:</span>
          <span class="intent-value" style="color:#f8fafc;font-weight:600;">${escapeHtml(task)}</span>
        </div>
      `;
    } else {
      intentHtml = `
        <div class="intent-row">
          <span class="intent-label" style="color:#94a3b8;">Args:</span>
          <span class="intent-value">${escapeHtml(JSON.stringify(toolArgs).slice(0, 100))}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="tool-header">
        <div class="tool-title">
          <span>${icons[toolName] || '⚙️'}</span>
          <span>${toolName}</span>
        </div>
        <span class="tool-badge running">running</span>
      </div>
      <div class="tool-intent-box">
        ${intentHtml}
      </div>
      <div class="tool-result-box" style="display:none;"></div>
    `;

    this.streamContainer.appendChild(card);

    const cockpitScroll = typeof document !== 'undefined' ? document.getElementById('cockpit-scroll-area') : null;
    if (cockpitScroll) {
      cockpitScroll.scrollTop = cockpitScroll.scrollHeight;
    }

    const streamCount = typeof document !== 'undefined' ? document.getElementById('tool-stream-count') : null;
    if (streamCount) {
      const current = parseInt(streamCount.innerText) || 0;
      streamCount.innerText = `${current + 1} calls`;
    }

    if (!skipRecord) {
      this.recordTimelineEvent({
        type: 'tool_card',
        id: cardId,
        toolName,
        toolArgs,
        status: 'running',
        extraText: null,
        toolResult: null,
        screenshotUrl: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    return card;
  }

  updateToolCard(card, status, extraText = null, toolResult = null, skipRecord = false) {
    if (!card) return;
    card.className = `tool-card ${status}`;
    const badge = card.querySelector('.tool-badge');
    if (badge) {
      badge.className = `tool-badge ${status}`;
      badge.innerText = status;
    }

    const toolName = card._toolName;
    const toolArgs = card._toolArgs || {};
    const resultBox = card.querySelector('.tool-result-box');

    if (resultBox) {
      resultBox.style.display = 'block';

      if (status === 'error') {
        const errText = toolResult?.error || extraText || 'Tool execution encountered an error.';
        resultBox.innerHTML = `
          <div style="color:#f43f5e;font-weight:600;display:flex;align-items:center;gap:4px;">
            <span>✕</span> <span>${escapeHtml(errText)}</span>
          </div>
        `;
      } else {
        let resHtml = '';

        if (toolName === 'search_web') {
          const results = toolResult?.results || [];
          if (Array.isArray(results) && results.length > 0) {
            const topResults = results.slice(0, 3);
            resHtml = `
              <div style="font-weight:600;color:#10b981;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
                <span>✔</span> <span>Found ${results.length} web source(s) for "${escapeHtml(toolArgs.query || toolArgs.Query || '')}":</span>
              </div>
              ${topResults.map(r => `
                <div style="margin-top:4px;padding:4px 6px;background:rgba(255,255,255,0.03);border-radius:4px;border-left:2px solid #38bdf8;">
                  <div style="color:#38bdf8;font-weight:600;font-size:11px;">${escapeHtml(r.title || 'Search Result')}</div>
                  <div style="color:#cbd5e1;font-size:10.5px;line-height:1.4;margin-top:2px;">${escapeHtml(r.snippet || r.url || '')}</div>
                </div>
              `).join('')}
            `;
          } else {
            resHtml = `
              <div style="color:#10b981;display:flex;align-items:center;gap:4px;">
                <span>✔</span> <span>Search completed for "${escapeHtml(toolArgs.query || toolArgs.Query || '')}" (no external references returned).</span>
              </div>
            `;
          }
        } else if (toolName === 'view_file') {
          const path = toolResult?.FilePath || toolArgs.AbsolutePath || toolArgs.TargetFile || '';
          const totalLines = toolResult?.TotalLines || (toolResult?.content ? toolResult.content.split('\n').length : 0);
          const snippet = toolResult?.content ? toolResult.content.slice(0, 450) + (toolResult.content.length > 450 ? '\n... [truncated]' : '') : '';
          resHtml = `
            <div style="font-weight:600;color:#10b981;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
              <span>✔</span> <span>Read ${totalLines} line(s) from <code>${escapeHtml(path)}</code>:</span>
            </div>
            ${snippet ? `
              <pre style="font-family:var(--font-mono);font-size:10px;color:#cbd5e1;max-height:100px;overflow-y:auto;background:rgba(0,0,0,0.35);padding:6px 8px;border-radius:4px;margin:0;white-space:pre-wrap;">${escapeHtml(snippet)}</pre>
            ` : '<div style="color:#94a3b8;font-style:italic;">(File is empty)</div>'}
          `;
        } else if (toolName === 'write_to_file') {
          const file = toolResult?.TargetFile || toolArgs.TargetFile || '';
          const bytes = toolResult?.sizeBytes || (toolArgs.CodeContent ? toolArgs.CodeContent.length : 0);
          const formattedSize = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
          resHtml = `
            <div style="color:#10b981;font-weight:600;display:flex;align-items:center;gap:4px;">
              <span>✔</span> <span>Successfully saved <code>${escapeHtml(file)}</code> (${formattedSize})</span>
            </div>
          `;
        } else if (toolName === 'replace_file_content') {
          const file = toolResult?.TargetFile || toolArgs.TargetFile || '';
          resHtml = `
            <div style="color:#10b981;font-weight:600;display:flex;align-items:center;gap:4px;">
              <span>✔</span> <span>Successfully patched <code>${escapeHtml(file)}</code></span>
            </div>
          `;
        } else if (toolName === 'run_command') {
          const exitCode = toolResult?.exit_code !== undefined ? toolResult.exit_code : 0;
          const isSuccess = exitCode === 0;
          const stdout = (toolResult?.stdout || '').trim();
          const stderr = (toolResult?.stderr || '').trim();
          resHtml = `
            <div style="color:${isSuccess ? '#10b981' : '#f43f5e'};font-weight:600;display:flex;align-items:center;gap:4px;">
              <span>${isSuccess ? '✔' : '✕'}</span> <span>Process exited with code ${exitCode}</span>
            </div>
            ${stdout ? `
              <pre style="font-family:var(--font-mono);font-size:10.5px;color:#cbd5e1;max-height:80px;overflow-y:auto;background:rgba(0,0,0,0.35);padding:4px 6px;border-radius:4px;margin:4px 0 0 0;white-space:pre-wrap;">${escapeHtml(stdout.slice(0, 350))}</pre>
            ` : ''}
            ${stderr ? `
              <pre style="font-family:var(--font-mono);font-size:10.5px;color:#f87171;max-height:80px;overflow-y:auto;background:rgba(244,63,94,0.1);padding:4px 6px;border-radius:4px;margin:4px 0 0 0;white-space:pre-wrap;">${escapeHtml(stderr.slice(0, 350))}</pre>
            ` : ''}
          `;
        } else if (toolName === 'list_dir') {
          const entries = toolResult?.entries || [];
          const count = toolResult?.count || entries.length;
          const names = entries.map(e => e.name + (e.type === 'directory' ? '/' : '')).slice(0, 10).join(', ');
          resHtml = `
            <div style="font-weight:600;color:#10b981;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
              <span>✔</span> <span>Found ${count} item(s):</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:10.5px;color:#cbd5e1;">${escapeHtml(names)}${count > 10 ? '...' : ''}</div>
          `;
        } else if (toolName === 'grep_search') {
          const matches = toolResult?.matches || [];
          const count = toolResult?.matches_count || matches.length;
          resHtml = `
            <div style="font-weight:600;color:#10b981;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
              <span>✔</span> <span>Found ${count} match(es):</span>
            </div>
            ${matches.slice(0, 4).map(m => `
              <div style="font-family:var(--font-mono);font-size:10.5px;color:#cbd5e1;"><span style="color:#94a3b8;">${escapeHtml(m.file)}:${m.line_number}:</span> ${escapeHtml(m.line)}</div>
            `).join('')}
          `;
        } else if (toolName === 'browser_subagent') {
          resHtml = `
            <div style="color:#10b981;font-weight:600;display:flex;align-items:center;gap:4px;">
              <span>✔</span> <span>Headless Chrome certified: <strong>${escapeHtml(toolResult?.title || 'OK')}</strong> (${toolResult?.dom_elements_count || 0} DOM elements)</span>
            </div>
            ${toolResult?.console_errors && toolResult.console_errors.length ? `
              <div style="color:#f43f5e;font-size:10.5px;margin-top:2px;">Errors: ${escapeHtml(toolResult.console_errors.join(', '))}</div>
            ` : ''}
          `;
        } else {
          resHtml = `<div style="color:#10b981;">✔ ${escapeHtml(extraText || 'Execution completed.')}</div>`;
        }

        resultBox.innerHTML = resHtml;
      }
    }

    if (toolResult && toolResult.screenshot_url) {
      const existing = card.querySelector('.tool-screenshot-preview');
      if (!existing) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'tool-screenshot-preview';
        previewDiv.style.marginTop = '8px';
        previewDiv.style.borderRadius = '6px';
        previewDiv.style.overflow = 'hidden';
        previewDiv.style.border = '1px solid rgba(56,189,248,0.3)';
        previewDiv.style.background = '#000';
        previewDiv.innerHTML = `
          <div style="padding:4px 8px;background:rgba(56,189,248,0.12);font-size:10.5px;color:#38bdf8;display:flex;justify-content:space-between;align-items:center;">
            <span>📸 Headless Chrome Render Snapshot</span>
            <a href="${toolResult.screenshot_url}" target="_blank" style="color:#38bdf8;text-decoration:underline;">Full View ↗</a>
          </div>
          <img src="${toolResult.screenshot_url}" style="width:100%;max-height:160px;object-fit:contain;display:block;background:#050811;" alt="Verified Live Render" />
        `;
        card.appendChild(previewDiv);
      }
    }

    const cockpitScroll = typeof document !== 'undefined' ? document.getElementById('cockpit-scroll-area') : null;
    if (cockpitScroll) {
      cockpitScroll.scrollTop = cockpitScroll.scrollHeight;
    }

    if (!skipRecord && card && card._cardId) {
      const ev = (this.timelineEvents || []).find(e => e.id === card._cardId);
      if (ev) {
        ev.status = status;
        if (extraText) ev.extraText = extraText;
        if (toolResult) ev.toolResult = toolResult;
        if (toolResult && toolResult.screenshot_url) {
          ev.screenshotUrl = toolResult.screenshot_url;
        }
      }
      this.debouncedSaveSession();
    }
  }

  formatToolResultSummary(toolName, result) {
    if (!result) return 'Completed.';
    if (toolName === 'run_command') {
      const exitCode = result.exit_code !== undefined ? result.exit_code : 0;
      const stdout = (result.stdout || '').trim();
      const stderr = (result.stderr || '').trim();
      if (exitCode === 0) {
        return `Exit code 0\n${stdout ? stdout.slice(0, 150) : 'Done.'}`;
      } else {
        return `Exit code ${exitCode}\n${stderr ? stderr.slice(0, 150) : stdout.slice(0, 150)}`;
      }
    } else if (toolName === 'write_to_file') {
      return `Created ${result.TargetFile} (${result.sizeBytes || 0} bytes)`;
    } else if (toolName === 'replace_file_content') {
      return `Patched ${result.TargetFile} cleanly`;
    } else if (toolName === 'view_file') {
      return `Read ${result.TotalLines || 0} lines from ${result.FilePath || ''}`;
    } else if (toolName === 'search_web') {
      return `Found ${(result.results || []).length} search results for "${result.query || ''}"`;
    } else if (toolName === 'browser_subagent') {
      return `Browser audit: ${result.title || 'OK'} (${result.dom_elements_count || 0} elements, errors: ${result.console_errors?.length || 0})`;
    } else if (toolName === 'list_dir') {
      return `Found ${result.entries?.length || 0} items`;
    } else if (toolName === 'grep_search') {
      return `Found ${result.matches_count || 0} matches`;
    }
    return 'Execution completed.';
  }

  distillToolContent(content) {
    if (typeof content !== 'string') return content;
    let text = content;

    // 1. Strip ANSI escape color codes
    text = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    // 2. Strip curl / wget download progress meter spam (saves hundreds of wasted tokens)
    if (text.includes('% Total') || text.includes('% Received') || text.includes('Dload  Upload')) {
      text = text.replace(/% Total[\s\S]*?Dload\s+Upload[^\n]*\n([\s0-9:.-]+\n)*/gi, '[Download transfer completed] ');
    }

    // 3. Strip git / terminal progress spinners & carriage returns
    text = text.replace(/\r[^\n]*/g, '');

    // 4. Collapse repetitive empty lines or delimiter rules
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/([=-]){10,}/g, '$1$1$1$1$1');

    // 5. Intelligent truncation: preserve head (600 chars) and tail (600 chars) for error tracebacks and return codes
    const MAX_TOOL_LEN = 1300;
    if (text.length > MAX_TOOL_LEN) {
      const head = text.slice(0, 600);
      const tail = text.slice(-600);
      text = `${head}\n... [${text.length - 1200} chars compressed for token efficiency] ...\n${tail}`;
    }
    return text;
  }

  sanitizeMessageContent(m) {
    if (m.role === 'tool' && typeof m.content === 'string') {
      return {
        ...m,
        content: this.distillToolContent(m.content)
      };
    }
    return m;
  }

  compactMessages(messages) {
    // Keep 10 recent messages with distilled noise-free content for deep context and high code capacity
    const MAX_RECENT = 10;
    if (messages.length <= MAX_RECENT) {
      return messages.map(m => this.sanitizeMessageContent(m));
    }

    const systemMsg = messages.find(m => m.role === 'system');
    const firstUserMsg = messages.find(m => m.role === 'user');
    const recentMessages = messages.slice(-MAX_RECENT);

    // Extract action manifest from earlier messages to preserve awareness of viewed files, modified files, and commands
    const earlierMessages = messages.slice(0, -MAX_RECENT);
    const viewedFiles = new Set();
    const modifiedFiles = new Set();
    const executedCommands = [];

    for (const m of earlierMessages) {
      if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
        for (const call of m.tool_calls) {
          const fn = call.function?.name;
          let args = {};
          try {
            args = typeof call.function?.arguments === 'string' ? JSON.parse(call.function.arguments) : (call.function?.arguments || {});
          } catch (_) {}

          if (fn === 'view_file' && (args.AbsolutePath || args.TargetFile)) {
            viewedFiles.add(args.AbsolutePath || args.TargetFile);
          } else if ((fn === 'write_to_file' || fn === 'replace_file_content') && args.TargetFile) {
            modifiedFiles.add(args.TargetFile);
          } else if (fn === 'run_command' && args.CommandLine) {
            if (!executedCommands.includes(args.CommandLine)) {
              executedCommands.push(args.CommandLine);
            }
          }
        }
      }
    }

    const sanitizedRecent = recentMessages.map(m => this.sanitizeMessageContent(m));

    let summaryText = `[System Context: ${earlierMessages.length} earlier steps executed in workspace.`;
    if (viewedFiles.size > 0) {
      summaryText += ` Previously viewed files: ${Array.from(viewedFiles).slice(0, 8).join(', ')}.`;
    }
    if (modifiedFiles.size > 0) {
      summaryText += ` Modified files: ${Array.from(modifiedFiles).slice(0, 8).join(', ')}.`;
    }
    if (executedCommands.length > 0) {
      summaryText += ` Executed commands: ${executedCommands.slice(0, 6).join('; ')}.`;
    }
    summaryText += ` Continue progressing toward project completion using replace_file_content for edits.]`;

    const summaryMsg = [{
      role: 'user',
      content: summaryText
    }];

    const result = [];
    if (systemMsg) result.push(systemMsg);
    if (firstUserMsg && !recentMessages.includes(firstUserMsg)) result.push(firstUserMsg);
    result.push(...summaryMsg);
    result.push(...sanitizedRecent);
    return result;
  }

  async callLlmRaw(messages, tools = ANTIGRAVITY_TOOLS) {
    if (this.isAborted) {
      return { message: { role: 'assistant', content: 'Execution stopped.' }, tool_calls: [] };
    }

    const compacted = this.compactMessages(messages);
    if (this.provider === 'groq') {
      const keysCount = (this.apiKey || '').split(/[,;\s]+/).filter(Boolean).length;
      if (keysCount < 5) {
        const fullPool = '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,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,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,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,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,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,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,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,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,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';
        this.apiKey = fullPool;
      }
    }

    // Solution 1: Dynamic Max-Tokens Allocation (Up to 4,096 Tokens)
    let dynamicMaxTokens = 4096;
    if (this.provider === 'groq' && this.model && this.model.includes('120b')) {
      const msgTokens = Math.ceil(JSON.stringify(compacted).length / 3.8);
      const toolsTokens = tools && tools.length > 0 ? 900 : 0;
      const totalPromptEst = msgTokens + toolsTokens;
      dynamicMaxTokens = Math.min(4096, Math.max(2000, 7700 - totalPromptEst));
    }

    const payload = {
      provider: this.provider,
      api_key: this.apiKey,
      model: this.model,
      messages: compacted,
      tools: tools,
      tool_choice: "auto",
      max_tokens: dynamicMaxTokens,
      temperature: 0.15
    };

    for (let attempt = 1; attempt <= 6; attempt++) {
      if (this.isAborted) {
        return { message: { role: 'assistant', content: 'Execution stopped.' }, tool_calls: [] };
      }

      try {
        const resp = await fetch(`${this.apiBase}/api/friday/llm/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: this.abortController?.signal
        });

        if (resp.status === 429) {
          const errData = await resp.json().catch(() => ({}));
          const retryAfterSec = errData.retry_after || (attempt * 2.5);
          const waitMs = Math.min(Math.round(retryAfterSec * 1000) + 500, 15000);
          console.warn(`[frAIday Gateway] Rate limit hit (HTTP 429), backing off ${waitMs}ms (attempt ${attempt}/6)...`);
          this.terminal?.appendOutput(`⏳ Rate limit backoff (${waitMs/1000}s)...`, 'info');
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          const errMsg = err.error || '';
          if (resp.status === 413 || /too large|tpm|8000|413|request size/i.test(errMsg)) {
            console.warn(`[frAIday Gateway] TPM / Request size exceeded (HTTP 413). Compacting context and retrying...`);
            this.terminal?.appendOutput(`⚡ Auto-compressing history to preserve code generation capacity (attempt ${attempt}/6)...`, 'info');
            // NEVER choke completion tokens below 1800, or code tools get cut off and throw JSON errors!
            // Prune older conversational turns instead:
            if (payload.messages && payload.messages.length > 3) {
              const sys = payload.messages.filter(m => m.role === 'system');
              const recent = payload.messages.slice(-4);
              payload.messages = [...sys, ...recent];
            }
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw new Error(errMsg || `LLM Gateway Error (HTTP ${resp.status})`);
        }

        return await resp.json();
      } catch (err) {
        if (err.name === 'AbortError' || this.isAborted) {
          return { message: { role: 'assistant', content: 'Execution stopped by user.' }, tool_calls: [] };
        }
        console.warn(`[frAIday Gateway] Network error on attempt ${attempt}/6: ${err.message}. Retrying...`);
        this.terminal?.appendOutput(`⏳ Gateway reconnecting (${err.message || 'network wait'})...`, 'info');
        if (attempt === 6) throw err;
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
    throw new Error('LLM rate limit reached after 6 backoff retries. Please wait a moment.');
  }

  async executeToolCall(toolName, toolArgs, toolCard) {
    if (this.isAborted) {
      return { error: 'Aborted by user', exit_code: 1 };
    }

    // 1. Tool Deduplication & Anti-Loop Interception
    if (toolName === 'view_file') {
      const targetPath = (toolArgs.AbsolutePath || toolArgs.TargetFile || '').replace(/\\/g, '/');
      const lastView = [...this.recentToolCalls].reverse().find(c => c.name === 'view_file' && ((c.args.AbsolutePath || c.args.TargetFile || '').replace(/\\/g, '/') === targetPath));
      if (lastView && !this.fileModifiedSinceView.has(targetPath)) {
        const warningMsg = `File "${targetPath}" was already viewed earlier and has NOT been modified since. Its contents are already present in your conversation history. Do NOT call view_file repeatedly. Please proceed to make your changes using replace_file_content or take the next required action.`;
        this.terminal?.appendOutput(`ℹ️ [Deduplication] ${warningMsg}`, 'info');
        return {
          FilePath: targetPath,
          warning: warningMsg,
          already_in_context: true,
          content: lastView.result?.content || ''
        };
      }
    } else if (toolName === 'run_command') {
      const cmd = (toolArgs.CommandLine || '').trim();
      const lastRun = [...this.recentToolCalls].reverse().find(c => c.name === 'run_command' && (c.args.CommandLine || '').trim() === cmd);
      if (lastRun && this.fileModifiedSinceView.size === 0) {
        const lastCode = lastRun.result?.exit_code ?? 0;
        const warningMsg = `Identical command "${cmd}" was just executed with exit code ${lastCode} without any intervening code modifications. Do NOT re-run identical commands in a loop. Use replace_file_content to patch code errors before re-testing.`;
        this.terminal?.appendOutput(`⚠️ [Anti-Loop] ${warningMsg}`, 'warn');
        return {
          CommandLine: cmd,
          warning: warningMsg,
          exit_code: lastCode,
          stdout: lastRun.result?.stdout || '',
          stderr: (lastRun.result?.stderr || '') + `\n[Anti-Loop Notice]: ${warningMsg}`
        };
      }
    }

    // Dynamic status updates
    if (toolName === 'run_command') {
      this.terminal?.appendCommand(toolArgs.CommandLine);
      this.setState('testing');
    } else if (toolName === 'write_to_file' || toolName === 'replace_file_content') {
      this.setState('executing');
    } else if (toolName === 'browser_subagent') {
      this.setState('validating');
    } else if (toolName === 'search_web' || toolName === 'list_dir' || toolName === 'view_file') {
      this.setState('researching');
    }

    const resp = await fetch(`${this.apiBase}/api/friday/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: toolName,
        arguments: toolArgs
      }),
      signal: this.abortController?.signal
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const result = await resp.json();

    // Mirror actions to IDE components & record modifications
    if (toolName === 'run_command') {
      if (result.stdout) this.terminal?.appendOutput(result.stdout, 'info');
      if (result.stderr) this.terminal?.appendOutput(result.stderr, result.exit_code === 0 ? 'warn' : 'error');
      
      // Proactive hint if agent accidentally ran client-side browser script with Node
      if (result.stderr && (result.stderr.includes('document is not defined') || result.stderr.includes('document is not def') || result.stderr.includes('window is not defined'))) {
        this.terminal?.appendOutput(`ℹ️ [Tip] Browser client code detected. DOM scripts run in the web browser, not in Node.js. Use browser_subagent to test in headless Chrome.`, 'warn');
      }

      if (result.exit_code === 0) {
        this.terminal?.appendOutput(`✔ Exited with code 0`, 'success');
      } else {
        this.terminal?.appendOutput(`✕ Command exited with code ${result.exit_code}`, 'error');
      }
    } else if (toolName === 'write_to_file' || toolName === 'replace_file_content') {
      const modFile = (toolArgs.TargetFile || '').replace(/\\/g, '/');
      if (modFile) {
        this.fileModifiedSinceView.add(modFile);
      }
      await this.fileTree?.refresh();

      // Build real visual diff string for the code editor
      let diffStr = null;
      if (toolName === 'replace_file_content' && toolArgs.TargetContent && toolArgs.ReplacementContent) {
        const removed = toolArgs.TargetContent.split('\n').map(l => '-' + l).join('\n');
        const added = toolArgs.ReplacementContent.split('\n').map(l => '+' + l).join('\n');
        diffStr = `--- ${modFile} (original)\n+++ ${modFile} (modified)\n${removed}\n${added}`;
      } else if (toolName === 'write_to_file' && toolArgs.CodeContent) {
        diffStr = `+++ ${modFile} (new file)\n` + toolArgs.CodeContent.split('\n').map(l => '+' + l).join('\n');
      }

      if (this.codeEditor && toolArgs.TargetFile && !toolArgs.TargetFile.endsWith('.png')) {
        // Force reload so it ALWAYS fetches the new content from disk and displays the active diff!
        this.codeEditor.loadFile(toolArgs.TargetFile, diffStr, true);
      }
      if (toolArgs.TargetFile && !toolArgs.TargetFile.endsWith('.md')) {
        this.activeRuntimeErrors.clear();
        if (typeof window !== 'undefined' && window.fraidayApp) {
          window.fraidayApp.reloadPreview();
        }
      }
    } else if (toolName === 'browser_subagent') {
      const errs = result.console_errors || [];
      if (errs.length > 0) {
        errs.forEach(err => this.activeRuntimeErrors.set(err, { message: err }));
        this.terminal?.appendOutput(`✕ Headless Chrome verification detected ${errs.length} runtime error(s):\n  • ` + errs.join('\n  • '), 'error');
      } else {
        this.activeRuntimeErrors.clear();
      }
      if (result.screenshot_url) {
        if (errs.length === 0) {
          this.terminal?.appendOutput(`✔ Headless Chrome certified clean live render: "${result.title}" (${result.dom_elements_count || 0} DOM elements, 0 console errors)`, 'success');
        }
        if (typeof window !== 'undefined' && window.fraidayApp) {
          window.fraidayApp.reloadPreview();
        }
        if (this.onVerificationScreenshotReady) {
          this.onVerificationScreenshotReady(result);
        }
      }
    }

    // Record tool call history for anti-loop deduplication
    this.recentToolCalls.push({ name: toolName, args: toolArgs, result });
    if (this.recentToolCalls.length > 20) {
      this.recentToolCalls.shift();
    }

    return result;
  }

  checkWalkthroughCreated() {
    const lastUserIndex = this.conversationHistory.map(m => m.role).lastIndexOf('user');
    const relevant = lastUserIndex >= 0 ? this.conversationHistory.slice(lastUserIndex) : this.conversationHistory;
    return relevant.some(m => 
      m.role === 'tool' && (m.content || '').toLowerCase().includes('walkthrough.md')
    );
  }

  checkCodeCreated() {
    return this.conversationHistory.some(m =>
      m.role === 'tool' && (
        (m.content || '').includes('.html') ||
        (m.content || '').includes('.js') ||
        (m.content || '').includes('.css') ||
        (m.content || '').includes('.py')
      )
    );
  }

  waitForPlanApproval() {
    return new Promise(resolve => {
      this.planApprovalResolver = resolve;
    });
  }

  /**
   * Seamlessly resume active objective after a pause, stop, or rate-limit reconfiguration
   */
  async resumeGoal() {
    if (!this.currentGoal) return;
    this.isAborted = false;
    this.abortController = new AbortController();
    this.setState('executing', 'Resuming...');

    if (this.onExecutionStart) {
      this.onExecutionStart();
    }

    this.streamThought(`Resuming active objective "${this.currentGoal}" with updated AI configuration...`);
    await this.runExecutionLoop();
  }

  /**
   * The Full 1-to-1 Antigravity ReAct Autonomous Engine
   * Enforces Planning Gate, Conversational Memory, Continuous Execution, and Walkthrough Certification
   */
  async executeGoal(goal) {
    if (!goal || !goal.trim()) return;
    this.currentGoal = goal.trim();
    this.isAborted = false;
    this.abortController = new AbortController();
    this.turnCount = 0;
    this.recentToolCalls = []; // Reset deduplication cache for the new user prompt
    this.fileModifiedSinceView = new Set();

    this.setState('planning');
    if (this.dagCanvas && typeof this.dagCanvas.setActiveStage === 'function') {
      this.dagCanvas.setActiveStage('goal_intake', `Objective: "${this.currentGoal}"`);
    }

    // Multi-turn conversational memory: preserve history across user messages
    if (!this.conversationHistory || this.conversationHistory.length === 0) {
      this.conversationHistory = [
        { role: 'system', content: ANTIGRAVITY_SYSTEM_PROMPT }
      ];
    }
    this.conversationHistory.push({
      role: 'user',
      content: `<USER_REQUEST>\n${this.currentGoal}\n</USER_REQUEST>`
    });

    if (this.onExecutionStart) {
      this.onExecutionStart();
    }
    if (this.onUserMessage) {
      this.onUserMessage(this.currentGoal);
    }
    this.recordTimelineEvent({
      type: 'user_message',
      text: this.currentGoal,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.saveSession();

    this.streamThought(`Analyzing objective: "${this.currentGoal}"\nInitiating Antigravity Autonomous Lifecycle Engine...`);
    await this.runExecutionLoop();
  }

  async runExecutionLoop() {

    const maxTurns = 100; // Unlimited, continuous execution until definition of done

    while (this.turnCount < maxTurns) {
      if (this.isAborted) break;
      this.turnCount++;

      let respData = null;
      try {
        respData = await this.callLlmRaw(this.conversationHistory, ANTIGRAVITY_TOOLS);
      } catch (err) {
        if (this.isAborted) break;
        console.error('LLM Gateway Invocation Error:', err);
        const errMsg = err.message || 'LLM Gateway Error';
        this.terminal?.appendOutput(`❌ LLM Gateway Error: ${errMsg}`, 'error');
        this.setState('error', errMsg.includes('429') ? 'Rate Limited' : 'Gateway Error');

        if (this.monologueEl) {
          const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
          if (body) {
            body.innerHTML = `<span style="color:#f87171;font-weight:600;">🛑 Execution Halted: ${escapeHtml(errMsg)}</span><br/><span style="font-size:11px;color:#94a3b8;">Switch provider/model in Settings ⚙️ or click Retry below.</span>`;
          }
        }

        if (this.onExecutionEnd) {
          this.onExecutionEnd({
            error: errMsg,
            reason: errMsg,
            advice: errMsg.includes('429')
              ? 'API rate limit or daily token limit reached. Switch provider (e.g. Cerebras, NVIDIA NIM, OpenAI) or choose another model preset in Settings ⚙️.'
              : 'The AI model gateway could not complete the request. Verify your API key or network connection in Settings ⚙️.'
          });
        }
        return;
      }

      if (this.isAborted) break;

      const assistantMsg = respData.message || { role: 'assistant', content: respData.content || '' };
      const toolCalls = assistantMsg.tool_calls || [];
      const content = assistantMsg.content || '';

      if (content) {
        await this.streamThought(content);
      }

      this.conversationHistory.push(assistantMsg);

      // If the agent emitted no tool calls, check completion criteria
      if (!toolCalls || toolCalls.length === 0) {
        if (!this.planApproved) {
          this.conversationHistory.push({
            role: 'user',
            content: 'You must start by creating implementation_plan.md using write_to_file so the user can review and approve it. Call write_to_file now.'
          });
          continue;
        }

        // CRITICAL CHECK: Did the most recent command or test fail?
        const lastToolMsg = [...this.conversationHistory].reverse().find(m => m.role === 'tool');
        if (lastToolMsg && lastToolMsg.name === 'run_command') {
          try {
            const parsed = JSON.parse(lastToolMsg.content);
            if (parsed.exit_code !== 0 || (parsed.stderr && !parsed.stdout)) {
              this.conversationHistory.push({
                role: 'user',
                content: `The test/shell command exited with code ${parsed.exit_code}.\nError Output:\n${(parsed.stderr || parsed.stdout || '').slice(-1200)}\n\nPlease diagnose this failure: inspect the code if needed, apply a surgical fix using replace_file_content (do NOT overwrite entire files), and re-run the command to verify the fix.`
              });
              continue;
            }
          } catch (_) {}
        }

        const hasCode = this.checkCodeCreated();
        if (!hasCode) {
          this.conversationHistory.push({
            role: 'user',
            content: 'Plan approved. Now proceed immediately to create the source code files: use write_to_file to write new index.html, style.css, and app.js.'
          });
          continue;
        }

        // Check if any tool actions have been performed since the user's latest request
        const lastUserIdx = this.conversationHistory.map(m => m.role).lastIndexOf('user');
        const actionsSinceUserPrompt = this.conversationHistory.slice(lastUserIdx + 1).filter(m => m.role === 'tool');

        if (hasCode && actionsSinceUserPrompt.length === 0) {
          this.conversationHistory.push({
            role: 'user',
            content: `Please take action to address the user's request: "${this.currentGoal}". Use view_file to inspect the code, identify the issue, and apply a targeted fix using replace_file_content.`
          });
          continue;
        }

        const hasWalkthrough = this.checkWalkthroughCreated();
        if (!hasWalkthrough) {
          this.conversationHistory.push({
            role: 'user',
            content: 'Changes have been made. Now update or create walkthrough.md using write_to_file to document your work and verification results before completing.'
          });
          continue;
        }

        // STRICT VERIFICATION CHECK: Disallow completion if application has active runtime errors
        if (this.activeRuntimeErrors && this.activeRuntimeErrors.size > 0) {
          const errList = Array.from(this.activeRuntimeErrors.keys()).join('; ');
          this.terminal?.appendOutput(`⚠️ Cannot declare completion: Active runtime errors remaining in preview: ${errList}. Continuing execution to resolve defects...`, 'warn');
          this.conversationHistory.push({
            role: 'user',
            content: `[VERIFICATION FAILURE]: The application has active runtime errors: [${errList}]. You MUST diagnose the issue, use replace_file_content to fix it, and verify that browser_subagent reports 0 errors before completing.`
          });
          continue;
        }

        // Both code, headless browser audit, and walkthrough.md are complete!
        this.setState('completed');
        this.terminal?.appendOutput(`═══════════════════════════════════════════════════════════════`, 'success');
        this.terminal?.appendOutput(`🎉 DEFINITION OF DONE: frAIday Completed Objective`, 'success');
        this.terminal?.appendOutput(`   • Live Preview: http://localhost:3000/friday/workspace/index.html`, 'success');
        this.terminal?.appendOutput(`   • Verification: Headless Chrome & Terminal Certified`, 'success');
        this.terminal?.appendOutput(`   • Artifact: walkthrough.md Generated`, 'success');
        this.terminal?.appendOutput(`═══════════════════════════════════════════════════════════════`, 'success');

        const respText = content || 'Mission Accomplished! All files created, verified in headless Chrome, and documented in walkthrough.md.';
        this.recordTimelineEvent({
          type: 'agent_message',
          markdown: respText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (this.onAgentResponse) {
          this.onAgentResponse(respText);
        }
        if (this.onExecutionEnd) {
          this.onExecutionEnd({ success: true });
        }
        this.saveSession();
        if (typeof window !== 'undefined' && window.fraidayApp) {
          window.fraidayApp.reloadPreview();
          window.fraidayApp.switchTab('preview');
        }
        break;
      }

      // Execute each tool call emitted by the LLM
      for (const call of toolCalls) {
        if (this.isAborted) break;

        const toolName = call.function?.name;
        let toolArgs = {};
        try {
          toolArgs = typeof call.function?.arguments === 'string' 
            ? JSON.parse(call.function.arguments) 
            : (call.function?.arguments || {});
        } catch (e) {
          toolArgs = {};
        }

        const toolCard = this.addAntigravityToolCard(toolName, toolArgs);

        // STRICT PLANNING GATE: Disallow writing code files before plan is approved
        const isPlanFile = (toolArgs.TargetFile || '').toLowerCase().includes('implementation_plan.md');
        const isWalkthroughFile = (toolArgs.TargetFile || '').toLowerCase().includes('walkthrough.md');

        if (toolName === 'write_to_file' && !isPlanFile && !this.planApproved) {
          const blockedResult = {
            error: "PLANNING GATE ACTIVE: You MUST create implementation_plan.md first and await user approval before writing application code files. Call write_to_file with TargetFile='implementation_plan.md'."
          };
          this.updateToolCard(toolCard, 'error', 'Planning Gate: Blocked until plan is approved');
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify(blockedResult)
          });
          continue;
        }

        // STRICT WALKTHROUGH GATE: Disallow writing walkthrough.md until code exists, browser audit has run, and ZERO errors remain
        if (toolName === 'write_to_file' && isWalkthroughFile) {
          const hasCode = this.checkCodeCreated();
          const hasBrowserAudit = this.conversationHistory.some(m => m.name === 'browser_subagent' || (m.role === 'tool' && (m.content || '').includes('browser_subagent')));
          const hasActiveErrors = this.activeRuntimeErrors && this.activeRuntimeErrors.size > 0;

          if (!hasCode || !hasBrowserAudit || hasActiveErrors) {
            let reason = "";
            if (!hasCode) {
              reason = "Application code files (index.html, style.css, app.js) have not been created yet.";
            } else if (!hasBrowserAudit) {
              reason = "Headless Chrome verification (browser_subagent) has not been performed yet. You must audit the live render before generating walkthrough.md.";
            } else if (hasActiveErrors) {
              const errList = Array.from(this.activeRuntimeErrors.keys()).join('; ');
              reason = `The application has active runtime errors that MUST be fixed: [${errList}]. Use view_file to inspect, replace_file_content to patch code, and browser_subagent to verify clean execution with 0 errors before generating walkthrough.md.`;
            }
            const blockedResult = {
              error: `LIFECYCLE ENFORCEMENT BLOCKED walkthrough.md: ${reason}`
            };
            this.updateToolCard(toolCard, 'error', `Blocked: ${reason}`);
            this.conversationHistory.push({
              role: 'tool',
              tool_call_id: call.id,
              name: toolName,
              content: JSON.stringify(blockedResult)
            });
            continue;
          }
        }

        let toolResult = null;
        try {
          toolResult = await this.executeToolCall(toolName, toolArgs, toolCard);
          this.updateToolCard(toolCard, 'success', this.formatToolResultSummary(toolName, toolResult), toolResult);
        } catch (err) {
          if (this.isAborted) break;
          toolResult = { error: err.message, exit_code: 1 };
          this.updateToolCard(toolCard, 'error', `Tool Error: ${err.message}`);
        }

        // Feed tool response back into conversation history
        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        });

        // Special: implementation_plan.md triggers Antigravity Planning Gate
        if (toolName === 'write_to_file' && isPlanFile) {
          if (this.onArtifactPlanReady) {
            this.onArtifactPlanReady(toolArgs.CodeContent);
          }
          if (this.onPlanPendingApproval) {
            this.recordTimelineEvent({
              type: 'plan_approval',
              planMarkdown: toolArgs.CodeContent,
              approved: false,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            this.onPlanPendingApproval(toolArgs.CodeContent);
          }
          this.saveSession();
          if (typeof document !== 'undefined') {
            const banner = document.getElementById('plan-approval-banner');
            const badge = document.getElementById('artifacts-badge');
            if (banner) banner.style.display = 'block';
            if (badge) badge.style.display = 'inline-block';
          }

          this.terminal?.appendOutput(`📋 Antigravity Planning Gate: implementation_plan.md created. Awaiting human authorization...`, 'warn');
          this.setState('waiting', 'Awaiting Plan Approval');
          this.isPaused = true;
          if (this.monologueEl) {
            const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
            if (body) {
              body.innerHTML = `<span style="color:#fbbf24;font-weight:600;">📋 Execution Paused: Planning Gate Active</span><br/><span style="font-size:11.5px;color:#94a3b8;">Review the proposed implementation plan in the <strong>Plan & Artifacts</strong> tab. Click "Approve & Proceed" to begin code synthesis.</span>`;
            }
          }

          // PAUSE EXECUTION: Wait for human click on "Approve & Proceed" or "Revise Goal"
          const approval = await this.waitForPlanApproval();
          if (this.isAborted) break;

          if (!approval.approved) {
            this.planApproved = false;
            this.setState('planning', 'Revising Plan');
            if (this.monologueEl) {
              const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
              if (body) {
                body.innerHTML = `<span style="color:#fbbf24;font-weight:600;">Plan revisions requested: "${escapeHtml(approval.feedback || 'Revise plan')}". Re-architecting...</span>`;
              }
            }
            this.conversationHistory.push({
              role: 'user',
              content: `[Human Feedback on Plan]: ${approval.feedback || 'Please revise the implementation plan.'}. Update implementation_plan.md with write_to_file.`
            });
            break; // Let model re-generate revised plan
          } else {
            this.planApproved = true;
            this.setState('executing', 'Synthesizing Code');
            if (this.monologueEl) {
              const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
              if (body) {
                body.innerHTML = `<span style="color:#34d399;font-weight:600;">✔ Plan approved! Proceeding to synthesize source files...</span>`;
              }
            }
            this.conversationHistory.push({
              role: 'user',
              content: `The implementation plan has been approved by the user! Proceed immediately to synthesize the real source code files (index.html, style.css, app.js), verify with browser_subagent, and write walkthrough.md.`
            });
            break; // Proceed to next turn with approval confirmed
          }
        }

        // Special: walkthrough.md triggers Walkthrough Artifact View
        if (toolName === 'write_to_file' && (toolArgs.TargetFile || '').toLowerCase().includes('walkthrough.md')) {
          if (this.onArtifactReady) {
            this.onArtifactReady('walkthrough.md');
          }
        }
      }

      // Smooth pacing between autonomous turns to prevent Groq token-bucket rate limit spikes
      if (toolCalls && toolCalls.length > 0 && !this.isAborted) {
        await new Promise(r => setTimeout(r, 2200));
      }
    }

    if (this.isAborted && this.onExecutionEnd) {
      this.onExecutionEnd({ aborted: true, reason: 'Execution manually stopped by user.' });
    } else if (this.turnCount >= maxTurns && !this.checkWalkthroughCreated()) {
      const turnMsg = `Maximum autonomous turn limit reached (${maxTurns} steps).`;
      this.setState('error', 'Turn Limit Reached');
      this.terminal?.appendOutput(`⚠️ ${turnMsg}`, 'warn');
      if (this.monologueEl) {
        const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
        if (body) {
          body.innerHTML = `<span style="color:#fbbf24;font-weight:600;">⚠️ ${turnMsg}</span><br/><span style="font-size:11px;color:#94a3b8;">Current workspace files are preserved. Click Resume or enter a prompt below.</span>`;
        }
      }
      if (this.onExecutionEnd) {
        this.onExecutionEnd({
          error: turnMsg,
          reason: turnMsg,
          advice: 'Autonomous execution paused after 100 turns to prevent runaway loops. All created code is saved in your workspace.'
        });
      }
    }
  }

  approvePlan() {
    this.planApproved = true;
    this.isPaused = false;

    if (typeof document !== 'undefined') {
      const banner = document.getElementById('plan-approval-banner');
      const badge = document.getElementById('artifacts-badge');
      if (banner) banner.style.display = 'none';
      if (badge) badge.style.display = 'none';
    }

    this.terminal?.appendOutput(`✔ Planning Gate: User approved implementation plan. Resuming execution...`, 'success');
    this.setState('executing', 'Synthesizing Code');
    if (this.monologueEl) {
      const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
      if (body) {
        body.innerHTML = `<span style="color:#34d399;font-weight:600;">✔ Plan approved! Resuming execution...</span>`;
      }
    }

    if (this.planApprovalResolver) {
      const resolve = this.planApprovalResolver;
      this.planApprovalResolver = null;
      resolve({ approved: true });
    }
    const lastPlan = [...(this.timelineEvents || [])].reverse().find(e => e.type === 'plan_approval');
    if (lastPlan) lastPlan.approved = true;
    this.saveSession();
  }

  rejectPlan(feedback = '') {
    this.planApproved = false;
    this.isPaused = false;

    if (typeof document !== 'undefined') {
      const banner = document.getElementById('plan-approval-banner');
      const badge = document.getElementById('artifacts-badge');
      if (banner) banner.style.display = 'none';
      if (badge) badge.style.display = 'none';
    }

    this.terminal?.appendOutput(`✕ Planning Gate: User requested plan revisions: ${feedback || 'Please revise objective.'}`, 'warn');
    this.setState('planning', 'Revising Plan');
    if (this.monologueEl) {
      const body = this.monologueEl.querySelector('.monologue-text') || this.monologueEl;
      if (body) {
        body.innerHTML = `<span style="color:#fbbf24;font-weight:600;">Plan revisions requested: "${escapeHtml(feedback || 'Revise plan')}". Re-architecting...</span>`;
      }
    }

    if (this.planApprovalResolver) {
      const resolve = this.planApprovalResolver;
      this.planApprovalResolver = null;
      resolve({ approved: false, feedback });
    }
    const lastPlan = [...(this.timelineEvents || [])].reverse().find(e => e.type === 'plan_approval');
    if (lastPlan) {
      lastPlan.approved = false;
      lastPlan.rejected = true;
      lastPlan.feedback = feedback;
    }
    this.saveSession();
  }

  async handleRuntimeError(errorData) {
    if (!errorData || !errorData.message) return;
    const now = Date.now();
    const msg = errorData.message.trim();

    // 0. Ignore opaque/CORS script errors, unknown errors, or line 0 errors that cannot be remediated
    if (msg.toLowerCase().includes('script error') || msg.toLowerCase().includes('unknown runtime error') || errorData.lineno === 0) {
      return;
    }

    // Always track active runtime errors so verification gates block false completions!
    this.activeRuntimeErrors.set(msg, errorData);

    // 0b. Do NOT trigger self-healing if agent is actively executing, planning, or waiting for user
    if (this.state === 'executing' || this.state === 'planning' || this.state === 'waiting' || this.state === 'healing') {
      console.warn('[frAIday Healing] Agent currently active (' + this.state + '). Error recorded in activeRuntimeErrors:', msg);
      return;
    }

    // 1. Debounce and concurrency guard: do not trigger multiple overlapping healing sessions
    if (this.isHealing) {
      console.warn('[frAIday Healing] Already diagnosing/healing. Skipping duplicate event:', msg);
      return;
    }
    if (now - this.lastHealTime < 20000) {
      console.warn('[frAIday Healing] Cooldown active. Skipping repeated trigger:', msg);
      return;
    }
    if (msg === this.lastHealedError && (now - this.lastHealTime < 60000)) {
      console.warn('[frAIday Healing] Same defect already addressed recently. Skipping:', msg);
      return;
    }

    this.isHealing = true;
    this.lastHealTime = now;
    this.lastHealedError = msg;

    this.terminal?.appendOutput(`⚡ Autonomous Error Interceptor: Captured runtime exception: ${msg} (${errorData.filename ? errorData.filename + ':' + errorData.lineno : 'preview'}). Initiating self-healing...`, 'warn');
    this.setState('healing');

    // 2. Emit dedicated System Diagnostic alert to chat stream (NEVER emit onUserMessage!)
    if (this.onSystemAlert) {
      this.onSystemAlert({
        type: 'runtime_error',
        message: msg,
        filename: errorData.filename,
        lineno: errorData.lineno,
        colno: errorData.colno
      });
    }

    // 3. Trigger autonomous healing loop without fake user message bubbles
    try {
      await this.executeSelfHealing(errorData);
    } catch (err) {
      console.error('Self-healing error:', err);
      this.terminal?.appendOutput(`✕ Autonomous self-healing error: ${err.message}`, 'error');
    } finally {
      this.isHealing = false;
      this.setState('idle');
    }
  }

  async executeSelfHealing(errorData) {
    if (this.isAborted) return;
    this.abortController = new AbortController();

    const diagnosticDirective = `[AUTONOMOUS PREVIEW RUNTIME ERROR INTERCEPTOR]
A runtime exception occurred in the live preview iframe:
Message: ${errorData.message}
File: ${errorData.filename || 'unknown'}:${errorData.lineno || 0}

INSTRUCTIONS:
1. Diagnose the exact cause using view_file or grep_search.
2. If this is an external library or API compatibility issue (e.g. Three.js / OrbitControls / CDN specifier), use search_web to find the exact, working CDN URLs or syntax.
3. Patch the code using replace_file_content or write_to_file.
4. Verify your fix using browser_subagent.
5. DO NOT generate walkthrough.md until the fix is verified clean.`;

    if (!this.conversationHistory || this.conversationHistory.length === 0) {
      this.conversationHistory = [
        { role: 'system', content: ANTIGRAVITY_SYSTEM_PROMPT }
      ];
    }
    this.conversationHistory.push({
      role: 'user',
      content: diagnosticDirective
    });

    this.streamThought(`Autonomous Error Interceptor: Diagnosing "${errorData.message}"...`);

    let turns = 0;
    const maxHealingTurns = 4;

    while (turns < maxHealingTurns) {
      if (this.isAborted) break;
      turns++;

      let respData = null;
      try {
        respData = await this.callLlmRaw(this.conversationHistory, ANTIGRAVITY_TOOLS);
      } catch (err) {
        console.error('Self-healing LLM error:', err);
        break;
      }

      if (this.isAborted) break;

      const assistantMsg = respData.message || { role: 'assistant', content: respData.content || '' };
      const toolCalls = assistantMsg.tool_calls || [];
      const content = assistantMsg.content || '';

      if (content) {
        await this.streamThought(content);
      }
      this.conversationHistory.push(assistantMsg);

      if (!toolCalls || toolCalls.length === 0) {
        this.terminal?.appendOutput(`✔ Autonomous self-healing turn completed.`, 'success');
        break;
      }

      let hasVerified = false;
      for (const call of toolCalls) {
        if (this.isAborted) break;
        const toolName = call.function?.name;
        let toolArgs = {};
        try {
          toolArgs = typeof call.function?.arguments === 'string'
            ? JSON.parse(call.function.arguments)
            : (call.function?.arguments || {});
        } catch (_) {
          toolArgs = {};
        }

        const toolCard = this.addAntigravityToolCard(toolName, toolArgs);

        // Disallow writing walkthrough.md during healing
        if (toolName === 'write_to_file' && (toolArgs.TargetFile || '').toLowerCase().includes('walkthrough.md')) {
          const blockedResult = { error: "Do not create walkthrough.md during error healing. Diagnose, patch, and verify with browser_subagent first." };
          this.updateToolCard(toolCard, 'error', 'Blocked during error healing');
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify(blockedResult)
          });
          continue;
        }

        let toolResult = null;
        try {
          toolResult = await this.executeToolCall(toolName, toolArgs, toolCard);
          this.updateToolCard(toolCard, 'success', this.formatToolResultSummary(toolName, toolResult), toolResult);
          if (toolName === 'browser_subagent' && (!toolResult.console_errors || toolResult.console_errors.length === 0)) {
            hasVerified = true;
          }
        } catch (err) {
          toolResult = { error: err.message, exit_code: 1 };
          this.updateToolCard(toolCard, 'error', `Error: ${err.message}`);
        }

        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        });
      }

      if (hasVerified) {
        this.terminal?.appendOutput(`✔ Defect successfully healed and certified in headless Chrome!`, 'success');
        if (typeof window !== 'undefined' && window.fraidayApp) {
          window.fraidayApp.reloadPreview();
        }
        break;
      }
    }
  }

  // Compatibility helpers
  async writeFile(path, content) {
    return await this.executeToolCall('write_to_file', { TargetFile: path, CodeContent: content }, null);
  }

  async patchFile(path, target, replacement) {
    return await this.executeToolCall('replace_file_content', { TargetFile: path, TargetContent: target, ReplacementContent: replacement }, null);
  }

  buildLangGraph() {
    return {
      invoke: async (args) => this.executeGoal(args.goal),
      resume: async () => this.approvePlan(),
      isPaused: this.isPaused
    };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
