const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  
  // 1. Visit Home
  await page.goto('http://localhost:3000/anime/', { waitUntil: 'networkidle0' });
  
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rankedTabsVisible: !!document.getElementById('rankedTabsMobile'),
    scheduleToggleVisible: !!document.getElementById('scheduleToggleBtn')
  }));
  console.log('Metrics:', metrics);

  await page.screenshot({ path: 'scratch/mobile_v2_top.png' });
  
  // Scroll to Airing Schedule
  await page.evaluate(() => document.getElementById('scheduleSection').scrollIntoView());
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'scratch/mobile_v2_schedule_collapsed.png' });

  // Click Show More
  const toggleBtn = await page.$('#scheduleToggleBtn');
  if (toggleBtn) {
    await toggleBtn.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: 'scratch/mobile_v2_schedule_expanded.png' });
  }

  // Scroll to Ranked section
  await page.evaluate(() => document.getElementById('rankedSection').scrollIntoView());
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'scratch/mobile_v2_ranked_airing.png' });

  // Click 'Most Popular' tab pill
  const popularPill = await page.$('.ranked-tab-pill[data-col="mostPopularCol"]');
  if (popularPill) {
    await popularPill.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: 'scratch/mobile_v2_ranked_popular.png' });
  }

  // 2. Visit Watch Page
  await page.goto('http://localhost:3000/anime/watch.html?id=21&ep=1', { waitUntil: 'networkidle0' });
  const watchMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  console.log('Watch Metrics:', watchMetrics);
  await page.screenshot({ path: 'scratch/mobile_v2_watch_top.png' });

  await page.evaluate(() => window.scrollBy(0, 700));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'scratch/mobile_v2_watch_scrolled.png' });

  await browser.close();
  console.log('Mobile verification script completed successfully');
})();
