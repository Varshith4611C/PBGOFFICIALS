/**
 * frAIday — Production Real Interactive Terminal Component
 * Connected to backend /api/terminal/exec subprocess runner
 */

export class TerminalComponent {
  constructor(container, onCommandExecuted) {
    this.container = container;
    this.onCommandExecuted = onCommandExecuted;
    this.history = [];
    this.historyIdx = -1;
  }

  init() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="terminal-wrapper">
        <div class="terminal-header">
          <div class="terminal-dots">
            <span class="t-dot red"></span>
            <span class="t-dot yellow"></span>
            <span class="t-dot green"></span>
          </div>
          <span>bash — frAIday-workspace [cwd: ./workspace]</span>
          <div style="display:flex;gap:6px;">
            <button id="btn-clear-term" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:11px;">Clear</button>
          </div>
        </div>

        <div class="terminal-body" id="term-body">
          <div class="terminal-line"><span class="terminal-prompt">fraiday@runtime:~$</span> <span class="terminal-success">Connected to backend workspace shell. Type any command below.</span></div>
        </div>

        <div style="display:flex;align-items:center;background:#060a10;padding:6px 12px;border-top:1px solid rgba(255,255,255,0.06);">
          <span class="terminal-prompt">fraiday@runtime:~$</span>
          <input type="text" id="term-user-input" spellcheck="false" placeholder="Enter shell command (e.g. dir, python --version)..." style="flex:1;background:transparent;border:none;color:#38bdf8;font-family:var(--font-mono);font-size:12px;outline:none;" />
        </div>
      </div>
    `;

    const clearBtn = this.container.querySelector('#btn-clear-term');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const body = this.container.querySelector('#term-body');
        if (body) body.innerHTML = '';
      });
    }

    const input = this.container.querySelector('#term-user-input');
    if (input) {
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const cmd = input.value.trim();
          if (cmd) {
            this.history.push(cmd);
            this.historyIdx = this.history.length;
            input.value = '';
            await this.runCommand(cmd);
          }
        } else if (e.key === 'ArrowUp') {
          if (this.historyIdx > 0) {
            this.historyIdx--;
            input.value = this.history[this.historyIdx];
          }
        } else if (e.key === 'ArrowDown') {
          if (this.historyIdx < this.history.length - 1) {
            this.historyIdx++;
            input.value = this.history[this.historyIdx];
          } else {
            this.historyIdx = this.history.length;
            input.value = '';
          }
        }
      });
    }
  }

  async runCommand(cmd) {
    this.appendCommand(cmd);
    try {
      const resp = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await resp.json();
      if (data.stdout) this.appendOutput(data.stdout, 'normal');
      if (data.stderr) this.appendOutput(data.stderr, data.exit_code === 0 ? 'warn' : 'error');
      if (data.exit_code === 0 && !data.stdout && !data.stderr) {
        this.appendOutput('✔ Process exited with code 0', 'success');
      }
      if (this.onCommandExecuted) this.onCommandExecuted(cmd, data);
      return data;
    } catch (e) {
      this.appendOutput('Execution error: ' + e.message, 'error');
      return { stdout: '', stderr: e.message, exit_code: 1 };
    }
  }

  appendCommand(cmd) {
    const body = this.container.querySelector('#term-body');
    if (!body) return;
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `<span class="terminal-prompt">fraiday@runtime:~$</span> <span>${cmd}</span>`;
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
  }

  appendOutput(text, type = 'normal') {
    const body = this.container.querySelector('#term-body');
    if (!body) return;
    const line = document.createElement('div');
    line.className = `terminal-line ${type === 'success' ? 'terminal-success' : type === 'error' ? 'terminal-error' : type === 'warn' ? 'terminal-warn' : ''}`;
    line.innerText = text;
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
  }

  clear() {
    const body = this.container.querySelector('#term-body');
    if (body) body.innerHTML = '';
  }
}
