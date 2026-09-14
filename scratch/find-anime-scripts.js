async function findAnimeScripts() {
  const res = await fetch('https://streamex.hn/anime', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  console.log('Scripts count:', scripts.length);

  for (const s of scripts) {
    const url = s.startsWith('http') ? s : 'https://streamex.hn' + s;
    const sRes = await fetch(url);
    const text = await sRes.text();
    if (text.includes('/api/') || text.includes('schedule') || text.includes('trending') || text.includes('airing')) {
      const apis = text.match(/\/api\/[a-zA-Z0-9_\-\/?=&]+/g) || [];
      const relevant = [...new Set(apis)].filter(a => a.includes('anime') || a.includes('media') || a.includes('search') || a.includes('stream') || a.includes('video') || a.includes('watch'));
      if (relevant.length > 0) {
        console.log(`\nScript: ${s}`);
        console.log('Relevant APIs:', relevant);
      }
    }
  }
}

findAnimeScripts();
