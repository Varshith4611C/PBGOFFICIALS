const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/anime/', { waitUntil: 'networkidle0' });
  
  // Click Most Popular tab via JS
  await page.evaluate(() => {
    const btn = document.querySelector('.ranked-tab-pill[data-col="mostPopularCol"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  
  const state = await page.evaluate(() => {
    return {
      topAiringDisplay: getComputedStyle(document.getElementById('topAiringCol')).display,
      mostPopularDisplay: getComputedStyle(document.getElementById('mostPopularCol')).display,
      activePillText: document.querySelector('.ranked-tab-pill.active').innerText
    };
  });
  console.log('Ranked Tab State after click:', state);

  // Take screenshot with scroll offset so tabs are clearly visible
  await page.evaluate(() => {
    const el = document.getElementById('rankedSection');
    const y = el.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top: y });
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'scratch/mobile_v2_ranked_popular_fixed.png' });
  await browser.close();
})();
