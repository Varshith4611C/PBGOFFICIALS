async function inspectChunk() {
  const res = await fetch('https://streamex.hn/_next/static/chunks/6e8d23a97323716b.js');
  const t = await res.text();
  console.log('Chunk length:', t.length);

  // Find all api fetch urls
  const urls = t.match(/\/api\/[a-zA-Z0-9_\-\/?=&]+/g) || [];
  console.log('Unique API URLs in anime chunk:', [...new Set(urls)]);

  // Look for any http/https external api endpoints (like consumet, anilist, tmdb, etc.)
  const externals = t.match(/https?:\/\/[a-zA-Z0-9.\-_:\/]+/g) || [];
  const uniqueExt = [...new Set(externals)].filter(u => !u.includes('w3.org') && !u.includes('streamex.hn'));
  console.log('External URLs:', uniqueExt.slice(0, 10));

  // Search for queries, words like schedule, trending, popular
  const matches = t.match(/fetch\([^\)]+\)/g) || [];
  console.log('Fetch calls:', matches.slice(0, 10));
}

inspectChunk();
