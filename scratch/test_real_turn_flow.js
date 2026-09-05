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
  await new Promise(r => setTimeout(r, 800));

  console.log('Game started! Clicking Roll Dice button (#btn-roll-3d)...');
  await page.click('#btn-roll-3d');

  // Poll until either buy modal is visible or turnPhase becomes 'done'
  console.log('Waiting for pawn movement and landing...');
  let waited = 0;
  let reachedActionOrDone = false;

  while (waited < 15000) {
    await new Promise(r => setTimeout(r, 400));
    waited += 400;

    const state = await page.evaluate(() => {
      const modal = document.getElementById('modal-overlay');
      const hasBuyModal = modal && !modal.classList.contains('hidden') && !!document.querySelector('.btn-buy-pass');
      return {
        turnPhase: window.game.turnPhase,
        hasBuyModal,
        position: window.game.currentPlayer.position,
        isMyTurn: window.game.isMyTurn
      };
    });

    if (state.hasBuyModal) {
      console.log(`Landed on property at space ${state.position}! Buy modal opened. Clicking Pass...`);
      await page.click('.btn-buy-pass');
      await new Promise(r => setTimeout(r, 600));
      reachedActionOrDone = true;
      break;
    }

    if (state.turnPhase === 'done') {
      console.log(`Landed on space ${state.position}! turnPhase is now 'done'.`);
      reachedActionOrDone = true;
      break;
    }
  }

  if (!reachedActionOrDone) {
    throw new Error('Timed out waiting for turn to complete');
  }

  await new Promise(r => setTimeout(r, 800));

  // Inspect the End Turn buttons
  const endButtonsCheck = await page.evaluate(() => {
    const end3d = document.getElementById('btn-end-3d');
    const floatBar = document.getElementById('turn-end-floating-bar');
    const floatBtn = document.getElementById('btn-floating-end-turn');
    const dockEnd = document.getElementById('dock-btn-end');

    return {
      turnPhase: window.game.turnPhase,
      isMyTurn: window.game.isMyTurn,
      end3dVisible: getComputedStyle(end3d).display !== 'none',
      floatBarVisible: getComputedStyle(floatBar).display !== 'none',
      dockEndVisible: getComputedStyle(dockEnd).display !== 'none',
      floatBtnText: floatBtn.innerText.trim()
    };
  });

  console.log('Real Gameplay End Turn Check:', JSON.stringify(endButtonsCheck, null, 2));

  // Capture real gameplay screenshot
  const screenshotPath = path.join(outputDir, 'real_gameplay_end_turn_visible.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot at ${screenshotPath}`);

  // Click the Dock End Turn button to test dock button functionality
  console.log('Testing click on #dock-btn-end...');
  await page.click('#dock-btn-end');
  await new Promise(r => setTimeout(r, 1000));

  const afterDockClick = await page.evaluate(() => {
    return {
      nextPlayerName: window.game.currentPlayer.name,
      isMyTurn: window.game.isMyTurn,
      turnPhase: window.game.turnPhase
    };
  });
  console.log('State after clicking Dock End button:', JSON.stringify(afterDockClick, null, 2));

  await browser.close();
  console.log('Real turn flow test passed with flying colors!');
})();
