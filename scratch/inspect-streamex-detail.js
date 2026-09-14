const fs = require('fs');

async function check() {
  const res = await fetch('https://streamex.hn/manga/149544', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const text = await res.text();
  console.log('Status:', res.status);
  const scripts = [...text.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  console.log('Scripts:', scripts);
  
  // Find chunks related to manga page
  for (const s of scripts) {
    if (s.includes('page') || s.includes('manga') || s.includes('app')) {
      const sRes = await fetch(s.startsWith('http') ? s : 'https://streamex.hn' + s);
      const sText = await sRes.text();
      if (sText.includes('chapters') || sText.includes('chapterId') || sText.includes('Read Chapter') || sText.includes('Description')) {
        console.log('Found relevant chunk:', s);
        // Look for layout structure
        const matches = sText.match(/.{0,100}(?:chapters|bannerImage|coverImage).{0,100}/g);
        if (matches) console.log('Sample matches:', matches.slice(0, 5));
      }
    }
  }
}

check().catch(console.error);
