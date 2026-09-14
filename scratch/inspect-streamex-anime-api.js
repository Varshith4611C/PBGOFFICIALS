async function probe() {
  const endpoints = [
    '/api/anime/trending',
    '/api/anime/popular',
    '/api/anime/top-rated',
    '/api/anime/top-airing',
    '/api/anime/schedule',
    '/api/anime/search?query=solo',
    '/api/anime/search?q=solo',
    '/api/anime/info/21',
    '/api/anime/info/solo-leveling',
    '/api/anime/episodes/21',
    '/api/anime/servers?id=21&ep=1',
    '/api/anime/sources?id=21&ep=1&server=main-sub'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`https://streamex.hn${ep}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://streamex.hn/anime'
        }
      });
      console.log(`Endpoint: ${ep} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          console.log(`  Keys:`, Object.keys(json).slice(0, 8));
          if (json.results) console.log(`  Results count:`, json.results.length);
          if (Array.isArray(json)) console.log(`  Array length:`, json.length);
        } catch (_) {
          console.log(`  Text length:`, text.length);
        }
      }
    } catch (err) {
      console.log(`Endpoint: ${ep} -> Error:`, err.message);
    }
  }
}

probe();
