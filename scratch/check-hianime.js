async function checkHianime() {
  const res = await fetch('https://streamex.hn/_next/static/7auCi-YVQ53tPofouVXNt/_buildManifest.js');
  const text = await res.text();
  const chunks = [...text.matchAll(/"static\/chunks\/[^"]+"/g)].map(m => m[0].replace(/"/g, ''));
  console.log('Total chunks in manifest:', chunks.length);

  for (const c of chunks) {
    try {
      const cRes = await fetch(`https://streamex.hn/_next/${c}`);
      const cText = await cRes.text();
      if (cText.includes('hianime') || cText.includes('/api/anime') || cText.includes('watch/anime')) {
        console.log(`\nChunk: ${c}`);
        const apis = cText.match(/\/api\/[a-zA-Z0-9_\-\/?=&]+/g) || [];
        console.log('APIs found:', [...new Set(apis)]);
        // Sample snippets
        const hianimeMatches = cText.match(/.{0,50}hianime.{0,50}/g) || [];
        console.log('Sample matches:', hianimeMatches.slice(0, 5));
      }
    } catch (e) {
      console.log('Error fetching chunk:', c);
    }
  }
}

checkHianime();
