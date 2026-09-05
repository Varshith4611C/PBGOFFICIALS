const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const errors = [];
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
    errors.push(err.message);
  });

  await page.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle0' });

  // Start singleplayer game
  await page.click('#btn-singleplayer');
  await new Promise(r => setTimeout(r, 400));
  await page.click('#btn-start-game');
  await new Promise(r => setTimeout(r, 800));

  console.log('Game started.');

  // Land on space 1 (Guwahati - city/property)
  await page.evaluate(async () => {
    const player = window.game.currentPlayer;
    player.position = 1;
    window.game.updateCameraPosition(1);
    // Non-blocking trigger of landing
    window.game.landOnSpace(player, 1, true);
  });

  console.log('Waiting for Buy Modal...');
  await page.waitForSelector('.btn-buy-confirm', { visible: true, timeout: 5000 });
  console.log('Buy Modal appeared!');

  // Capture Buy Modal screenshot
  await page.screenshot({ path: 'scratch/verify_results/01_buying_city_modal.png' });

  // Click BUY FOR ₹60
  console.log('Clicking BUY button...');
  await page.click('.btn-buy-confirm');
  await new Promise(r => setTimeout(r, 800));

  // Inspect state
  const state = await page.evaluate(() => {
    const end3d = document.getElementById('btn-end-3d');
    const floatBar = document.getElementById('turn-end-floating-bar');
    const floatBtn = document.getElementById('btn-floating-end-turn');
    const dockEnd = document.getElementById('dock-btn-end');

    const floatRect = floatBtn.getBoundingClientRect();
    const dockRect = dockEnd.getBoundingClientRect();

    return {
      turnPhase: window.game.turnPhase,
      isMyTurn: window.game.isMyTurn,
      owner: window.game.properties[1].owner,
      cash: window.game.currentPlayer.cash,
      end3d: {
        display: getComputedStyle(end3d).display,
        visibleClass: end3d.classList.contains('visible')
      },
      floatBar: {
        display: getComputedStyle(floatBar).display,
        btnText: floatBtn.innerText.trim(),
        visibleInViewport: floatRect.top >= 0 && floatRect.bottom <= window.innerHeight
      },
      dockEnd: {
        display: getComputedStyle(dockEnd).display,
        visibleInViewport: dockRect.top >= 0 && dockRect.bottom <= window.innerHeight
      }
    };
  });

  console.log('State after buying city:', JSON.stringify(state, null, 2));

  // Capture screenshot showing End Turn options after buying city
  await page.screenshot({ path: 'scratch/verify_results/02_after_buying_city_end_visible.png' });

  // Test clicking floating End Turn button
  console.log('Clicking End Turn button...');
  await page.click('#btn-floating-end-turn');
  await new Promise(r => setTimeout(r, 800));

  const afterEnd = await page.evaluate(() => {
    return {
      nextPlayer: window.game.currentPlayer.name,
      isMyTurn: window.game.isMyTurn,
      turnPhase: window.game.turnPhase
    };
  });

  console.log('State after ending turn:', JSON.stringify(afterEnd, null, 2));

  await browser.close();

  if (errors.length > 0) {
    console.error('TEST FAILED WITH PAGE ERRORS:', errors);
    process.exit(1);
  }

  if (state.turnPhase !== 'done' || state.end3d.display !== 'flex' || state.floatBar.display !== 'flex' || state.dockEnd.display !== 'flex') {
    console.error('TEST FAILED: End turn options not showing!');
    process.exit(1);
  }

  console.log('ALL TESTS PASSED! End turn options are 100% visible after buying city!');
})();
