/**
 * frAIday — Autonomous Knowledge Base & External Discovery Engine
 */

export class KnowledgeBase {
  constructor(container, onSelectKI) {
    this.container = container;
    this.onSelectKI = onSelectKI;
    this.items = [];
  }

  setItems(items) {
    this.items = items || [];
    this.render();
  }

  addItem(item) {
    this.items.unshift(item);
    this.render();
  }

  render() {
    if (!this.container) return;

    if (this.items.length === 0) {
      this.container.innerHTML = `
        <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">
          No external knowledge discovered yet.<br/>Agent will search web & documentation during execution.
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;padding:8px 12px;">
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:700;">
          Discovered External Docs & Standards (${this.items.length})
        </div>
        ${this.items.map((item, idx) => `
          <div class="ki-card" data-idx="${idx}">
            <div class="ki-header">
              <span class="ki-title">${item.title}</span>
              <span class="ki-relevance">${item.relevance} Match</span>
            </div>
            <div class="ki-snippet">${item.snippet}</div>
            <div class="ki-source">
              <span>🌐</span>
              <span style="text-decoration:underline;">${item.source}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.container.querySelectorAll('.ki-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.getAttribute('data-idx'));
        if (this.onSelectKI) this.onSelectKI(this.items[idx]);
      });
    });
  }
}
