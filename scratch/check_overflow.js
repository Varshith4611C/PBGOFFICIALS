const puppeteer = require('puppeteer');

async function checkOverflow() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/games/',
    'http://localhost:3000/games/business-board/index.html'
  ];

  const widths = [360, 390, 768, 1280, 1920];

  for (const url of urls) {
    console.log(`\nChecking URL: ${url}`);
    const page = await browser.newPage();
    for (const w of widths) {
      await page.setViewport({ width: w, height: 800 });
      await page.goto(url, { waitUntil: 'networkidle2' });
      const overflow = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const bodyW = document.body.scrollWidth;
        // Check elements exceeding window width
        const badElements = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 2) {
            badElements.push({
              tag: el.tagName,
              id: el.id,
              className: el.className,
              right: rect.right,
              width: rect.width
            });
          }
        });
        return { docW, winW, bodyW, hasOverflow: docW > winW + 1, badElements: badElements.slice(0, 5) };
      });
      console.log(`  Width ${w}px: hasOverflow=${overflow.hasOverflow}, docW=${overflow.docW}`);
      if (overflow.hasOverflow) {
        console.log(`    Bad elements:`, overflow.badElements);
      }
    }
    await page.close();
  }

  await browser.close();
}

checkOverflow().catch(console.error);
