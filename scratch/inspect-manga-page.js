async function check() {
  const res = await fetch('https://streamex.hn/_next/static/chunks/770ea94542fe1ae9.js');
  const t = await res.text();
  
  // Look for chapter rendering
  const matches = t.match(/chapters[\s\S]{0,400}/g);
  if (matches) {
    console.log('Matches length:', matches.length);
    for (let i = 0; i < Math.min(matches.length, 4); i++) {
      console.log('--- Match', i, '---');
      console.log(matches[i].slice(0, 300));
    }
  }
}

check().catch(console.error);
