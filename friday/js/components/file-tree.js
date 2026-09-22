/**
 * frAIday — Production Real Workspace File Explorer
 * Directly connects to backend /api/workspace/files
 */

export class FileTreeComponent {
  constructor(container, onSelectFile, onFileCreated) {
    this.container = container;
    this.onSelectFile = onSelectFile;
    this.onFileCreated = onFileCreated;
    this.files = [];
    this.activeFile = null;
  }

  async refresh() {
    try {
      const resp = await fetch('/api/workspace/files');
      const data = await resp.json();
      this.files = data.files || [];
      if (this.files.length > 0 && !this.activeFile) {
        this.activeFile = this.files[0].path;
      }
      this.render();
      return this.files;
    } catch (e) {
      console.error('Failed to list workspace files:', e);
      return [];
    }
  }

  setActiveFile(path) {
    this.activeFile = path;
    this.render();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="file-tree-container">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border-subtle);">
          <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Files (${this.files.length})</span>
          <div style="display:flex;gap:4px;">
            <button id="btn-create-file" class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;" title="Create New File">+ File</button>
            <button id="btn-refresh-files" class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;" title="Refresh File Tree">↻</button>
          </div>
        </div>

        <div class="file-tree-search">
          <input type="text" class="file-search-input" placeholder="Filter files (e.g. index.html, style.css)..." />
        </div>

        <ul class="file-tree-list">
          ${this.files.length === 0 ? `
            <div style="padding:20px 14px;text-align:center;color:var(--text-muted);font-size:11.5px;">
              Workspace is empty.<br/>Tell the agent what to build or create a new file.
            </div>
          ` : this.files.map(f => {
            const isActive = f.path === this.activeFile ? 'active' : '';
            const icon = this.getFileIcon(f.path);
            const sizeFormatted = this.formatSize(f.size);
            const parts = f.path.split('/');
            const fileName = parts.pop();
            const dirPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
            return `
              <li class="tree-item ${isActive}" data-path="${f.path}">
                <span class="tree-item-label" title="${f.path}">
                  <span style="font-size:13px;flex-shrink:0;">${icon}</span>
                  <span style="font-family:var(--font-mono);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    <span style="color:#64748b;font-size:10px;">${dirPrefix}</span><span style="color:#f1f5f9;font-weight:600;">${fileName}</span>
                  </span>
                </span>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                  <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${sizeFormatted}</span>
                  <button class="btn-del-file" data-path="${f.path}" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:11px;" title="Delete file">×</button>
                </div>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Select File
    this.container.querySelectorAll('.tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-del-file')) return;
        const path = item.getAttribute('data-path');
        this.activeFile = path;
        this.render();
        if (this.onSelectFile) this.onSelectFile(path);
      });
    });

    // Delete File
    this.container.querySelectorAll('.btn-del-file').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = btn.getAttribute('data-path');
        if (confirm(`Delete file "${path}" from workspace?`)) {
          await fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
          await this.refresh();
        }
      });
    });

    // Create New File
    const createBtn = this.container.querySelector('#btn-create-file');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const path = prompt('Enter relative filename (e.g. index.html, app.js, style.css):');
        if (path && path.trim()) {
          const cleanPath = path.trim();
          await fetch('/api/workspace/file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe({ path: cleanPath, content: '' })
          });
          await this.refresh();
          this.activeFile = cleanPath;
          if (this.onSelectFile) this.onSelectFile(cleanPath);
        }
      });
    }

    // Refresh button
    const refreshBtn = this.container.querySelector('#btn-refresh-files');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    // Filter
    const searchInput = this.container.querySelector('.file-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        this.container.querySelectorAll('.tree-item').forEach(item => {
          const path = item.getAttribute('data-path').toLowerCase();
          item.style.display = path.includes(query) ? 'flex' : 'none';
        });
      });
    }
  }

  getFileIcon(path) {
    if (path.includes('test')) return '🧪';
    if (path.endsWith('.html')) return '🌐';
    if (path.endsWith('.css')) return '🎨';
    if (path.includes('store') || path.includes('state')) return '📦';
    if (path.includes('engine')) return '⚙️';
    if (path.includes('component')) return '🧩';
    if (path.endsWith('.js') || path.endsWith('.mjs')) return '⚡';
    if (path.endsWith('.json')) return '📋';
    if (path.endsWith('.md')) return '📄';
    return '📄';
  }

  formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }
}

function jsonStringifySafe(obj) {
  return JSON.stringify(obj);
}
