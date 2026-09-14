const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  // 1. Audit Manga Home
  console.log('--- AUDITING MANGA HOME ---');
  await page.goto('http://localhost:3000/manga/', { waitUntil: 'networkidle0' });
  const homeMetrics = await page.evaluate(() => {
    const wideEls = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 2 || el.scrollWidth > window.innerWidth + 2) {
        wideEls.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          rectRight: Math.round(rect.right),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        });
      }
    });

    return {
      windowInnerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      wideEls: wideEls.slice(0, 10)
    };
  });
  console.log('Home Metrics:', JSON.stringify(homeMetrics, null, 2));
  await page.screenshot({ path: 'scratch/manga_mobile_home_top.png' });
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'scratch/manga_mobile_home_scrolled.png' });

  // 2. Audit Manga Detail
  console.log('--- AUDITING MANGA DETAIL ---');
  // Get first manga link or test with id
  const firstMangaHref = await page.evaluate(() => {
    const link = document.querySelector('a[href*="detail.html"]');
    return link ? link.href : 'http://localhost:3000/manga/detail.html?id=30001';
  });
  console.log('Visiting detail:', firstMangaHref);
  await page.goto(firstMangaHref, { waitUntil: 'networkidle0' });
  const detailMetrics = await page.evaluate(() => {
    const wideEls = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 2 || el.scrollWidth > window.innerWidth + 2) {
        wideEls.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          rectRight: Math.round(rect.right),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        });
      }
    });

    return {
      windowInnerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      wideEls: wideEls.slice(0, 10)
    };
  });
  console.log('Detail Metrics:', JSON.stringify(detailMetrics, null, 2));
  await page.screenshot({ path: 'scratch/manga_mobile_detail_top.png' });
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'scratch/manga_mobile_detail_scrolled.png' });

  // 3. Audit Reader if chapter available
  const readerLink = await page.evaluate(() => {
    const link = document.querySelector('a[href*="read.html"]');
    return link ? link.href : null;
  });
  if (readerLink) {
    console.log('Visiting reader:', readerLink);
    await page.goto(readerLink, { waitUntil: 'networkidle0' });
    const readerMetrics = await page.evaluate(() => ({
      windowInnerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth
    }));
    console.log('Reader Metrics:', readerMetrics);
    await page.screenshot({ path: 'scratch/manga_mobile_reader.png' });
  }

  await browser.close();
  console.log('Audit completed');
})();
