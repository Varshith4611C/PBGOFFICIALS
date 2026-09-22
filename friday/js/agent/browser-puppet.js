/**
 * frAIday — Headless Browser Puppet Subagent
 * 
 * Orchestrates real headless browser execution (Chrome / Edge):
 * 1. Renders the live workspace application in a real browser engine.
 * 2. Captures visual screenshots for multimodal verification.
 * 3. Dumps and evaluates the live computed DOM tree.
 * 4. Intercepts runtime exceptions and console errors.
 */

export class BrowserPuppet {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '';
    this.llmCaller = options.llmCaller;
  }

  async inspectPage(url = null, toolCard = null) {
    if (toolCard) {
      const payload = toolCard.querySelector('.tool-payload');
      if (payload) payload.innerText = 'Spawning headless Chrome/Edge instance to audit live render...';
    }

    try {
      const resp = await fetch(`${this.apiBase}/api/browser/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!resp.ok) {
        throw new Error(`Browser inspect failed with HTTP ${resp.status}`);
      }

      const report = await resp.json();

      const evaluation = {
        success: report.success,
        browser: report.browser || 'headless-browser',
        title: report.title || 'Workspace App',
        has_screenshot: report.has_screenshot || false,
        screenshot_url: report.screenshot_url || null,
        dom_length: report.dom_length || 0,
        dom_snippet: report.dom_snippet || '',
        issues: [],
        healthy: true
      };

      if (!report.success) {
        evaluation.issues.push(report.error || 'Browser failed to launch');
        evaluation.healthy = false;
        return evaluation;
      }

      // Automated Headless DOM Health Checks
      const dom = report.dom_snippet || '';
      if (dom.length < 100) {
        evaluation.issues.push('Rendered DOM is nearly empty (< 100 characters).');
        evaluation.healthy = false;
      }

      // Check for unhandled exceptions in DOM
      if (dom.includes('Cannot read properties of') || dom.includes('Uncaught TypeError') || dom.includes('ReferenceError')) {
        evaluation.issues.push('Unhandled JavaScript runtime exception detected in rendered page.');
        evaluation.healthy = false;
      }

      if (report.stderr && (report.stderr.includes('ERR_') || report.stderr.includes('Failed to load resource'))) {
        evaluation.issues.push(`Network resource error: ${report.stderr.slice(0, 150)}`);
      }

      return evaluation;
    } catch (err) {
      console.warn('Browser puppet execution error:', err.message);
      return {
        success: false,
        healthy: false,
        issues: [`Browser puppet error: ${err.message}`]
      };
    }
  }
}
