const puppeteer = require('puppeteer');
const path = require('path');

async function testModals() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const viewports = [
    { name: 'desktop_1280', width: 1280, height: 720 },
    { name: 'mobile_390', width: 390, height: 844, isMobile: true, hasTouch: true }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport(vp);

    await page.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle2' });
    await page.click('#btn-singleplayer');
    await new Promise(r => setTimeout(r, 200));
    await page.click('#btn-start-game');
    await page.waitForSelector('#game-screen.active');
    await new Promise(r => setTimeout(r, 500));

    // Open Trade Menu
    await page.click('#dock-btn-trade');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(__dirname, 'screenshots', `modal_trade_${vp.name}.png`) });

    // Close modal
    await page.keyboard.press('Escape');
    await page.evaluate(() => typeof hideModal === 'function' && hideModal());
    await new Promise(r => setTimeout(r, 200));

    // Open Portfolio Menu
    await page.click('#dock-btn-portfolio');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(__dirname, 'screenshots', `modal_portfolio_${vp.name}.png`) });
    await page.evaluate(() => typeof hideModal === 'function' && hideModal());
    await new Promise(r => setTimeout(r, 200));

    // Open Menu Modal
    await page.click('#dock-btn-menu');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(__dirname, 'screenshots', `modal_menu_${vp.name}.png`) });
    await page.evaluate(() => typeof hideModal === 'function' && hideModal());
    await new Promise(r => setTimeout(r, 200));

    // Open Rules
    await page.click('#btn-info');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(__dirname, 'screenshots', `modal_rules_${vp.name}.png`) });

    await page.close();
  }

  await browser.close();
  console.log('Modal screenshots captured!');
}

testModals().catch(console.error);
