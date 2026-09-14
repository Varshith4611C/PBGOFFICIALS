async function probeHianime() {
  const testPaths = [
    '/home',
    '/anime/home',
    '/anime/trending',
    '/anime/popular',
    '/anime/top-airing',
    '/anime/most-popular',
    '/anime/most-favorite',
    '/anime/schedule',
    '/anime/schedule?date=2024-09-14',
    '/anime/search?q=solo',
    '/anime/info?id=one-piece-100',
    '/anime/episodes/one-piece-100',
    '/anime/servers?episodeId=one-piece-100$episode$1$sub',
    '/anime/episode-srcs?id=one-piece-100$episode$1$sub&server=hd-1'
  ];

  for (const p of testPaths) {
    try {
      const url = `https://streamex.hn/api/hianime${p}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://streamex.hn/anime'
        }
      });
      console.log(`Path: /api/hianime${p} -> Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Success! Keys:`, Object.keys(data));
        if (data.data) console.log(`  data keys:`, Object.keys(data.data));
      }
    } catch (e) {
      console.log(`Path: /api/hianime${p} -> Error:`, e.message);
    }
  }
}

probeHianime();
