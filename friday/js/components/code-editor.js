/**
 * frAIday — Production Real Code Editor & Diff Studio
 * Multi-Tab Code Editor, Visual Diff Viewer & Antigravity Inline Code Lenses
 * Reads and writes real files to /api/workspace/file
 */

import { highlightCode } from '../utils/syntax-highlighter.js';

export class CodeEditorComponent {
  constructor(container, onTriggerLens, onFileSaved) {
    this.container = container;
    this.onTriggerLens = onTriggerLens;
    this.onFileSaved = onFileSaved;
    this.openTabs = []; // Array of { path, content, isDirty, diff }
    this.currentFile = null;
    this.currentContent = '';
    this.currentDiff = null;
    this.viewMode = 'code'; // 'code' or 'diff'
    this.isDirty = false;
  }

  clear() {
    this.openTabs = [];
    this.currentFile = null;
    this.currentContent = '';
    this.currentDiff = null;
    this.isDirty = false;
    this.render();
  }

  async loadFile(filepath, diffContent = null, forceReload = false) {
    if (!filepath) {
      this.clear();
      return;
    }

    // Check if already open
    const existing = this.openTabs.find(t => t.path === filepath);
    if (existing && !forceReload) {
      if (diffContent !== null) existing.diff = diffContent;
      this.switchToFile(filepath);
      return;
    }

    let fileContent = '';
    try {
      const resp = await fetch(`/api/workspace/file?path=${encodeURIComponent(filepath)}&t=${Date.now()}`);
      if (resp.ok) {
        const data = await resp.json();
        fileContent = data.content || '';
      }
    } catch (e) {
      console.error('Failed to load file:', e);
    }

    if (existing) {
      existing.content = fileContent;
      existing.isDirty = false;
      if (diffContent !== null) existing.diff = diffContent;
    } else {
      this.openTabs.push({
        path: filepath,
        content: fileContent,
        isDirty: false,
        diff: diffContent
      });
    }

    this.currentFile = filepath;
    this.currentContent = fileContent;
    this.currentDiff = diffContent !== null ? diffContent : (existing ? existing.diff : null);
    this.isDirty = false;
    this.render();
  }

  async reloadAllOpenTabs() {
    for (const tab of this.openTabs) {
      try {
        const resp = await fetch(`/api/workspace/file?path=${encodeURIComponent(tab.path)}&t=${Date.now()}`);
        if (resp.ok) {
          const data = await resp.json();
          tab.content = data.content || '';
          tab.isDirty = false;
          tab.diff = null;
        }
      } catch (e) {
        console.error('Failed to reload tab:', tab.path, e);
      }
    }
    if (this.currentFile) {
      const cur = this.openTabs.find(t => t.path === this.currentFile);
      if (cur) {
        this.currentContent = cur.content;
        this.currentDiff = null;
        this.isDirty = false;
      }
    }
    this.render();
  }

  switchToFile(filepath) {
    const tab = this.openTabs.find(t => t.path === filepath);
    if (!tab) return;

    // Save current textarea content to current tab before switching
    this.syncCurrentTextarea();

    this.currentFile = tab.path;
    this.currentContent = tab.content;
    this.currentDiff = tab.diff;
    this.isDirty = tab.isDirty;
    this.render();
  }

  closeTab(filepath) {
    const idx = this.openTabs.findIndex(t => t.path === filepath);
    if (idx === -1) return;

    this.openTabs.splice(idx, 1);

    if (this.currentFile === filepath) {
      if (this.openTabs.length > 0) {
        const nextTab = this.openTabs[Math.max(0, idx - 1)];
        this.currentFile = nextTab.path;
        this.currentContent = nextTab.content;
        this.currentDiff = nextTab.diff;
        this.isDirty = nextTab.isDirty;
      } else {
        this.currentFile = null;
        this.currentContent = '';
        this.currentDiff = null;
        this.isDirty = false;
      }
    }

    this.render();
  }

  syncCurrentTextarea() {
    if (!this.currentFile) return;
    const textarea = this.container.querySelector('#editor-textarea');
    if (textarea) {
      this.currentContent = textarea.value;
      const curTab = this.openTabs.find(t => t.path === this.currentFile);
      if (curTab) {
        curTab.content = textarea.value;
        curTab.isDirty = this.isDirty;
      }
    }
  }

  setContent(content, diff = null) {
    this.currentContent = content;
    this.currentDiff = diff;
    this.isDirty = false;
    const curTab = this.openTabs.find(t => t.path === this.currentFile);
    if (curTab) {
      curTab.content = content;
      curTab.diff = diff;
      curTab.isDirty = false;
    }
    this.render();
  }

  async saveCurrentFile() {
    if (!this.currentFile) return;
    this.syncCurrentTextarea();

    try {
      const resp = await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: this.currentFile,
          content: this.currentContent
        })
      });
      if (resp.ok) {
        this.isDirty = false;
        const curTab = this.openTabs.find(t => t.path === this.currentFile);
        if (curTab) curTab.isDirty = false;

        const saveBtn = this.container.querySelector('#btn-save-code');
        if (saveBtn) {
          saveBtn.innerText = '✅ Saved';
          setTimeout(() => { if (saveBtn) saveBtn.innerText = '💾 Save'; }, 1800);
        }
        if (this.onFileSaved) this.onFileSaved(this.currentFile);
      }
    } catch (e) {
      alert('Failed to save file: ' + e.message);
    }
  }

  render() {
    if (!this.container) return;

    if (!this.currentFile && this.openTabs.length === 0) {
      this.container.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-muted);">
          <span style="font-size:36px;">📄</span>
          <span style="font-size:13px;font-weight:600;">No file open</span>
          <span style="font-size:11.5px;color:#64748b;">Select a file from the workspace explorer or tell the agent to create one.</span>
        </div>
      `;
      return;
    }

    const lineCount = this.currentContent.split('\n').length;
    const gutterLines = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => `<div class="gutter-line">${i + 1}</div>`).join('');

    // Tabs bar HTML
    const tabsHtml = `
      <div class="editor-tabs-bar">
        ${this.openTabs.map(t => `
          <div class="editor-tab ${t.path === this.currentFile ? 'active' : ''}" data-path="${t.path}">
            <span>📄 ${t.path}</span>
            ${t.isDirty ? '<span style="color:#f59e0b;font-size:10px;">●</span>' : ''}
            <span class="editor-tab-close" data-close="${t.path}" title="Close Tab">×</span>
          </div>
        `).join('')}
      </div>
    `;

    this.container.innerHTML = `
      <div class="editor-wrapper">
        ${tabsHtml}

        <div class="editor-toolbar">
          <div class="editor-filename">
            <span>📄</span>
            <span>${this.currentFile || ''}</span>
            ${this.isDirty ? '<span style="color:#f59e0b;font-size:10px;">● Unsaved</span>' : ''}
          </div>
          <div class="editor-actions">
            <div class="editor-view-toggle">
              <button class="editor-toggle-btn ${this.viewMode === 'code' ? 'active' : ''}" data-mode="code">Source Code</button>
              <button class="editor-toggle-btn ${this.viewMode === 'diff' ? 'active' : ''}" data-mode="diff">Visual Diff</button>
            </div>
            <button id="btn-save-code" class="btn btn-primary btn-sm">💾 Save</button>
            <button id="btn-copy-code" class="btn btn-secondary btn-sm">📋 Copy</button>
          </div>
        </div>

        <!-- Antigravity Inline Code Lenses Sub-toolbar -->
        <div class="editor-lenses-bar">
          <span class="lenses-label">✨ Lenses:</span>
          <button class="lens-action-btn" data-action="refactor">✨ Refactor</button>
          <button class="lens-action-btn test" data-action="test">🧪 Generate Tests</button>
          <button class="lens-action-btn explain" data-action="explain">🔍 Explain Code</button>
          <button class="lens-action-btn" data-action="audit" style="color:#fbbf24;border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.1);">🛡️ Security Audit</button>
        </div>

        <div class="editor-viewport">
          ${this.viewMode === 'diff' ? this.renderDiffView() : `
            <div class="editor-gutter" id="editor-gutter-lines">
              ${gutterLines}
            </div>
            <div class="editor-content" id="editor-code-body">
              <textarea id="editor-textarea" spellcheck="false" wrap="off">${escapeHtml(this.currentContent)}</textarea>
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderDiffView() {
    if (this.currentDiff) {
      const lines = this.currentDiff.split('\n');
      const diffRows = lines.map((l, idx) => {
        let cls = 'context';
        let marker = ' ';
        if (l.startsWith('+') && !l.startsWith('+++')) {
          cls = 'added';
          marker = '+';
        } else if (l.startsWith('-') && !l.startsWith('---')) {
          cls = 'removed';
          marker = '-';
        }
        return `
          <div class="diff-line ${cls}">
            <span class="diff-line-number">${idx + 1}</span>
            <span class="diff-line-marker">${marker}</span>
            <span class="diff-line-text">${escapeHtml(l)}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="diff-viewer-wrapper" style="overflow-y:auto;flex:1;">
          ${diffRows}
        </div>
      `;
    }

    // If no explicit diff is set, compare against clean disk or show info
    return `
      <div class="diff-viewer-wrapper" style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;gap:12px;padding:30px;">
        <span style="font-size:32px;">🔍</span>
        <div style="font-size:13px;font-weight:600;color:#f8fafc;">No Active Diff for ${this.currentFile}</div>
        <div style="font-size:11.5px;max-width:400px;text-align:center;line-height:1.5;">
          When frAIday autonomously synthesizes or patches code, visual additions and removals will be highlighted here in real time.
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Tab switching & closing
    this.container.querySelectorAll('.editor-tab').forEach(tabEl => {
      tabEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('editor-tab-close')) return;
        const p = tabEl.getAttribute('data-path');
        this.switchToFile(p);
      });
    });

    this.container.querySelectorAll('.editor-tab-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = closeBtn.getAttribute('data-close');
        this.closeTab(p);
      });
    });

    // View toggle (code / diff)
    this.container.querySelectorAll('.editor-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.syncCurrentTextarea();
        this.viewMode = btn.getAttribute('data-mode');
        this.render();
      });
    });

    const saveBtn = this.container.querySelector('#btn-save-code');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveCurrentFile());
    }

    const textarea = this.container.querySelector('#editor-textarea');
    const gutter = this.container.querySelector('#editor-gutter-lines');

    if (textarea && gutter) {
      // Synchronize vertical scrolling with line numbers
      textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
      });

      // Forward wheel scrolling on the line numbers gutter to the textarea
      gutter.addEventListener('wheel', (e) => {
        textarea.scrollTop += e.deltaY;
        e.preventDefault();
      }, { passive: false });

      // Dynamically update gutter line numbers on input
      const updateGutter = () => {
        this.currentContent = textarea.value;
        this.isDirty = true;
        const curTab = this.openTabs.find(t => t.path === this.currentFile);
        if (curTab) {
          curTab.content = textarea.value;
          curTab.isDirty = true;
        }
        const lineCount = (textarea.value.match(/\n/g) || []).length + 1;
        gutter.innerHTML = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => `<div class="gutter-line">${i + 1}</div>`).join('');
        gutter.scrollTop = textarea.scrollTop;
      };

      textarea.addEventListener('input', updateGutter);

      // Support Tab key indentation & Ctrl+S / Ctrl+W
      textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          this.saveCurrentFile();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
          e.preventDefault();
          if (this.currentFile) this.closeTab(this.currentFile);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
          updateGutter();
        }
      });
    }

    const copyBtn = this.container.querySelector('#btn-copy-code');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const textToCopy = textarea ? textarea.value : this.currentContent;
        navigator.clipboard.writeText(textToCopy);
        copyBtn.innerText = '✅ Copied!';
        setTimeout(() => { copyBtn.innerText = '📋 Copy'; }, 2000);
      });
    }

    this.container.querySelectorAll('.lens-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (this.onTriggerLens) {
          const currentVal = textarea ? textarea.value : this.currentContent;
          this.onTriggerLens(action, this.currentFile, currentVal);
        }
      });
    });
  }

  detectLanguage(filepath) {
    if (!filepath) return 'javascript';
    if (filepath.endsWith('.html')) return 'html';
    if (filepath.endsWith('.css')) return 'css';
    if (filepath.endsWith('.sql')) return 'sql';
    if (filepath.endsWith('.json')) return 'json';
    if (filepath.endsWith('.py')) return 'python';
    return 'javascript';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
