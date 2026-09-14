const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto('http://localhost:3000/anime/', { waitUntil: 'networkidle2' });

  const summary = await page.evaluate(() => {
    return {
      windowInnerWidth: window.innerWidth,
      docClientWidth: document.documentElement.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      trendingCarouselScrollWidth: document.getElementById('trendingCarousel')?.scrollWidth,
      trendingCarouselClientWidth: document.getElementById('trendingCarousel')?.clientWidth,
      trendingCarouselBoundingRight: document.getElementById('trendingCarousel')?.getBoundingClientRect().right,
      scheduleTabsBoundingRight: document.getElementById('scheduleTabs')?.getBoundingClientRect().right,
      mobileBottomNavBoundingRight: document.getElementById('mobileBottomNav')?.getBoundingClientRect().right,
      navbarBoundingRight: document.querySelector('.navbar')?.getBoundingClientRect().right
    };
  });

  console.log("PAGE METRICS:", summary);

  // Find direct elements that make document.body.scrollWidth huge
  const wideElements = await page.evaluate(() => {
    const res = [];
    document.querySelectorAll('body *').forEach(el => {
      if (el.offsetWidth > 390) {
        res.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          offsetWidth: el.offsetWidth,
          scrollWidth: el.scrollWidth,
          parent: el.parentElement ? el.parentElement.tagName + '.' + el.parentElement.className : null
        });
      }
    });
    return res;
  });

  console.log("WIDE ELEMENTS (> 390px):", wideElements);

  await browser.close();
})();
