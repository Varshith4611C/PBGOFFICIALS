const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/anime/', { waitUntil: 'networkidle0' });
  
  // Click Show More
  await page.evaluate(() => {
    const btn = document.getElementById('scheduleToggleBtn');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  
  const text = await page.evaluate(() => document.getElementById('scheduleToggleBtn').innerText);
  console.log('Toggle btn text after click:', text);

  // Take screenshot
  await page.evaluate(() => {
    const el = document.getElementById('scheduleToggleBtn');
    const y = el.getBoundingClientRect().top + window.pageYOffset - 400;
    window.scrollTo({ top: y });
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'scratch/mobile_v2_schedule_expanded_fixed.png' });
  await browser.close();
})();
