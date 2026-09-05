const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outputDir = path.join(__dirname, 'verify_results');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const gameUrl = 'http://localhost:3000/games/business-board/index.html';
  console.log(`Navigating to ${gameUrl}...`);
  await page.goto(gameUrl, { waitUntil: 'networkidle0' });

  // Start singleplayer game
  await page.click('#btn-singleplayer');
  await new Promise(r => setTimeout(r, 400));
  await page.click('#btn-start-game');
  await new Promise(r => setTimeout(r, 600));

  console.log('Game started. Checking initial state...');
  const initialRollVisible = await page.$eval('#btn-roll-3d', el => getComputedStyle(el).display !== 'none');
  const initialEndFloating = await page.$eval('#turn-end-floating-bar', el => getComputedStyle(el).display);
  const initialDockEnd = await page.$eval('#dock-btn-end', el => getComputedStyle(el).display);
  console.log(`Initial: Roll btn visible: ${initialRollVisible}, Floating end display: ${initialEndFloating}, Dock end display: ${initialDockEnd}`);

  // Now simulate turn done phase
  console.log('Transitioning to turnPhase = "done"...');
  await page.evaluate(() => {
    window.game.turnPhase = 'done';
    window.game.updateUI();
  });
  await new Promise(r => setTimeout(r, 800));

  // Verify all 3 end options are visible!
  const status = await page.evaluate(() => {
    const end3d = document.getElementById('btn-end-3d');
    const floatBar = document.getElementById('turn-end-floating-bar');
    const floatBtn = document.getElementById('btn-floating-end-turn');
    const dockEnd = document.getElementById('dock-btn-end');
    const rig = document.getElementById('board-camera-rig');

    const floatRect = floatBtn.getBoundingClientRect();
    const dockRect = dockEnd.getBoundingClientRect();

    return {
      end3dDisplay: getComputedStyle(end3d).display,
      floatBarDisplay: getComputedStyle(floatBar).display,
      floatBtnText: floatBtn.innerText.trim(),
      floatBtnInViewport: floatRect.top >= 0 && floatRect.bottom <= window.innerHeight,
      floatBtnRect: { x: floatRect.x, y: floatRect.y, w: floatRect.width, h: floatRect.height },
      dockEndDisplay: getComputedStyle(dockEnd).display,
      dockEndRect: { x: dockRect.x, y: dockRect.y, w: dockRect.width, h: dockRect.height },
      camPanX: rig.style.getPropertyValue('--cam-pan-x'),
      camPanY: rig.style.getPropertyValue('--cam-pan-y')
    };
  });

  console.log('Status after turnPhase = "done":', JSON.stringify(status, null, 2));

  // Take screenshot of mobile with end options visible!
  const screenshotMobilePath = path.join(outputDir, 'mobile_end_option_showing.png');
  await page.screenshot({ path: screenshotMobilePath });
  console.log(`Captured mobile screenshot at ${screenshotMobilePath}`);

  // Open Menu to verify End Current Turn & Forfeit options in menu
  await page.evaluate(() => {
    window.game.openMenuModal();
  });
  await new Promise(r => setTimeout(r, 400));

  const menuStatus = await page.evaluate(() => {
    const modal = document.getElementById('modal-overlay');
    return {
      modalVisible: !modal.classList.contains('hidden'),
      hasEndTurnBtn: !!modal.innerText.includes('END CURRENT TURN'),
      hasForfeitBtn: !!modal.innerText.includes('Forfeit / End Game')
    };
  });
  console.log('Menu modal status:', JSON.stringify(menuStatus, null, 2));

  const screenshotMenuPath = path.join(outputDir, 'menu_modal_end_options.png');
  await page.screenshot({ path: screenshotMenuPath });
  console.log(`Captured menu screenshot at ${screenshotMenuPath}`);

  // Close modal and click End Turn via floating button!
  await page.evaluate(() => hideModal());
  await new Promise(r => setTimeout(r, 300));

  console.log('Clicking floating end turn button...');
  await page.click('#btn-floating-end-turn');
  await new Promise(r => setTimeout(r, 700));

  const afterEndStatus = await page.evaluate(() => {
    return {
      currentPlayerIndex: window.game.currentPlayerIndex,
      currentPlayerName: window.game.currentPlayer.name,
      isMyTurn: window.game.isMyTurn,
      turnPhase: window.game.turnPhase,
      floatingDisplay: getComputedStyle(document.getElementById('turn-end-floating-bar')).display,
      dockEndDisplay: getComputedStyle(document.getElementById('dock-btn-end')).display
    };
  });
  console.log('Status after clicking end turn:', JSON.stringify(afterEndStatus, null, 2));

  await browser.close();
  console.log('Verification script completed successfully!');
})();
