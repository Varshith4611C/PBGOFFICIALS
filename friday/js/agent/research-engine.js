/**
 * frAIday — Autonomous Pre-Execution Research Engine
 * 
 * Performs autonomous research before architecture and code synthesis:
 * 1. Formulates targeted technical search queries based on user intent.
 * 2. Queries live web documentation (DuckDuckGo, Wikipedia, MDN) via /api/search.
 * 3. Consults local Knowledge Items (KIs).
 * 4. Produces a structured Research Brief for the Architect.
 */

export class ResearchEngine {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '';
    this.llmCaller = options.llmCaller;
    this.knowledgeBase = options.knowledgeBase;
  }

  async conductResearch(goal, toolCard = null) {
    const brief = {
      goal,
      queries: [],
      sources: [],
      technicalNotes: [],
      designTokens: [],
      timestamp: Date.now()
    };

    // 1. Generate targeted technical search queries via LLM
    let queries = [goal];
    if (this.llmCaller) {
      try {
        const queryPrompt = `Generate 2 specific, technical search queries to research the best architecture, Web APIs, and design practices for building:
"${goal}"

Return ONLY a JSON array of strings, e.g. ["query 1", "query 2"]. Zero conversational text.`;
        const raw = await this.llmCaller(queryPrompt, 'Output only a JSON array of search strings.', 200);
        const match = raw.match(/\[\s*".*?"\s*\]/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            queries = parsed.slice(0, 3);
          }
        }
      } catch (_) {}
    }

    brief.queries = queries;

    // 2. Execute live search queries against /api/search
    for (const q of queries) {
      if (toolCard) {
        const payload = toolCard.querySelector('.tool-payload');
        if (payload) payload.innerText = `Searching web for "${q}"...`;
      }

      try {
        const resp = await fetch(`${this.apiBase}/api/search?q=${encodeURIComponent(q)}`);
        if (resp.ok) {
          const data = await resp.json();
          const results = data.results || [];
          results.slice(0, 2).forEach(res => {
            if (res.snippet && !brief.sources.some(s => s.url === res.url)) {
              brief.sources.push({
                query: q,
                title: res.title || q,
                url: res.url || '',
                snippet: res.snippet
              });
            }
          });
        }
      } catch (err) {
        console.warn(`Search error for "${q}":`, err.message);
      }
    }

    // 3. Query local Knowledge Base
    if (this.knowledgeBase && typeof this.knowledgeBase.findRelevantItems === 'function') {
      const localKis = this.knowledgeBase.findRelevantItems(goal);
      if (localKis && localKis.length > 0) {
        localKis.forEach(ki => {
          brief.sources.push({
            query: 'local_knowledge_base',
            title: `[KI] ${ki.title}`,
            url: ki.source || 'repository',
            snippet: ki.snippet || ''
          });
        });
      }
    }

    // 4. Synthesize Technical Specifications & Architecture Gotchas
    if (this.llmCaller && brief.sources.length > 0) {
      try {
        const synthPrompt = `Based on the following research findings, summarize key technical specs, Web APIs, and design guidelines for building: "${goal}".

RESEARCH SOURCES:
${brief.sources.map(s => `• ${s.title}: ${s.snippet}`).join('\n')}

Format as 3 concise bullet points:
1. Core Web APIs / Technologies to use
2. Layout & Styling guidelines (high visual polish)
3. Traps or gotchas to avoid`;

        const synthRaw = await this.llmCaller(synthPrompt, 'You are an autonomous software research analyst. Output 3 concise technical points.', 400);
        brief.technicalNotes = synthRaw.split('\n').filter(l => l.trim().length > 0);
      } catch (_) {}
    }

    return brief;
  }
}
