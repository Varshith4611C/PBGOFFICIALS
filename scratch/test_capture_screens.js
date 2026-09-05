const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function captureAll() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outDir = path.join(__dirname, 'screenshots_after');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const viewports = [
    { name: 'mobile_360', width: 360, height: 740, isMobile: true, hasTouch: true },
    { name: 'mobile_390', width: 390, height: 844, isMobile: true, hasTouch: true },
    { name: 'tablet_768', width: 768, height: 1024, isMobile: false },
    { name: 'desktop_1280', width: 1280, height: 720, isMobile: false },
    { name: 'desktop_1920', width: 1920, height: 1080, isMobile: false }
  ];

  for (const vp of viewports) {
    console.log(`Capturing viewport: ${vp.name}...`);
    const page = await browser.newPage();
    await page.setViewport(vp);

    await page.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(outDir, `bb_landing_${vp.name}.png`) });

    // Single Player Setup
    await page.click('#btn-singleplayer');
    await new Promise(r => setTimeout(r, 250));
    await page.screenshot({ path: path.join(outDir, `bb_setup_${vp.name}.png`) });

    // Start Game
    await page.click('#btn-start-game');
    await page.waitForSelector('#game-screen.active', { timeout: 6000 });
    await new Promise(r => setTimeout(r, 600));

    // Verify dice and roll button visibility coordinates
    const rollBtnBox = await page.evaluate(() => {
      const rollBtn = document.getElementById('btn-roll-3d');
      const dice = document.querySelector('.dice-container-3d');
      const board = document.getElementById('board');
      const rectR = rollBtn ? rollBtn.getBoundingClientRect() : null;
      const rectD = dice ? dice.getBoundingClientRect() : null;
      const rectB = board ? board.getBoundingClientRect() : null;
      return {
        rollBtn: rectR ? { left: rectR.left, right: rectR.right, top: rectR.top, bottom: rectR.bottom, width: rectR.width, visible: rectR.left >= 0 && rectR.right <= window.innerWidth } : null,
        dice: rectD ? { left: rectD.left, right: rectD.right, visible: rectD.left >= 0 && rectD.right <= window.innerWidth } : null,
        winW: window.innerWidth,
        winH: window.innerHeight,
        boardW: rectB ? rectB.width : null,
        boardH: rectB ? rectB.height : null
      };
    });
    console.log(`  [${vp.name}] Roll Btn Box:`, rollBtnBox);

    // 1. Initial 3D follow view
    await page.screenshot({ path: path.join(outDir, `bb_game_3d_${vp.name}.png`) });

    // 2. If mobile, test toggling the quick chat widget
    if (vp.isMobile) {
      await page.click('#quick-chat-toggle-pill');
      await new Promise(r => setTimeout(r, 300));
      await page.screenshot({ path: path.join(outDir, `bb_game_chat_open_${vp.name}.png`) });
      // Collapse it back
      await page.click('#quick-chat-toggle-pill');
      await new Promise(r => setTimeout(r, 200));
    }

    // 3. Full Board view
    await page.click('#btn-camera-toggle');
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(outDir, `bb_game_full_${vp.name}.png`) });

    // 4. Test Trade Modal
    await page.click('#dock-btn-trade');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(outDir, `bb_trade_modal_${vp.name}.png`) });
    await page.evaluate(() => typeof hideModal === 'function' && hideModal());
    await new Promise(r => setTimeout(r, 200));

    // 5. Test Portfolio Modal
    await page.click('#dock-btn-portfolio');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(outDir, `bb_portfolio_modal_${vp.name}.png`) });
    await page.evaluate(() => typeof hideModal === 'function' && hideModal());
    await new Promise(r => setTimeout(r, 200));

    await page.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

captureAll().catch(console.error);
