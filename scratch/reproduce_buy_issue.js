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

  await page.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle0' });

  // Start singleplayer
  await page.click('#btn-singleplayer');
  await new Promise(r => setTimeout(r, 400));
  await page.click('#btn-start-game');
  await new Promise(r => setTimeout(r, 800));

  console.log('Game started.');

  // Set position to 1 (Guwahati) and trigger landing asynchronously
  await page.evaluate(() => {
    const player = window.game.currentPlayer;
    player.position = 1;
    window.game.updateCameraPosition(1);
    window.game.landOnSpace(player, 1, true); // Do NOT await here so evaluate returns!
  });

  await new Promise(r => setTimeout(r, 500));

  // Check if buy modal is open
  const modalOpen = await page.evaluate(() => {
    const modal = document.getElementById('modal-overlay');
    return modal && !modal.classList.contains('hidden') && modal.innerHTML.includes('BUY FOR');
  });
  console.log('Buy modal open:', modalOpen);

  // Click BUY button
  console.log('Clicking BUY button...');
  await page.click('.btn-buy-confirm');
  await new Promise(r => setTimeout(r, 1000));

  // Inspect state after buying
  const afterBuyState = await page.evaluate(() => {
    const end3d = document.getElementById('btn-end-3d');
    const floatBar = document.getElementById('turn-end-floating-bar');
    const floatBtn = document.getElementById('btn-floating-end-turn');
    const dockEnd = document.getElementById('dock-btn-end');
    const modal = document.getElementById('modal-overlay');
    const rollBtn = document.getElementById('btn-roll-3d');
    const waitBadge = document.getElementById('turn-wait-badge');

    return {
      turnPhase: window.game.turnPhase,
      isMyTurn: window.game.isMyTurn,
      currentPlayer: window.game.currentPlayer.name,
      currentPlayerIndex: window.game.currentPlayerIndex,
      modalHidden: modal ? modal.classList.contains('hidden') : null,
      modalContentPreview: modal ? modal.innerHTML.substring(0, 100) : null,
      rollBtn: {
        display: rollBtn ? getComputedStyle(rollBtn).display : null,
        disabled: rollBtn ? rollBtn.disabled : null
      },
      waitBadge: {
        display: waitBadge ? getComputedStyle(waitBadge).display : null,
        html: waitBadge ? waitBadge.innerHTML : null
      },
      end3d: {
        display: end3d ? getComputedStyle(end3d).display : null,
        visibleClass: end3d ? end3d.classList.contains('visible') : false,
        rect: end3d ? end3d.getBoundingClientRect() : null
      },
      floatBar: {
        display: floatBar ? getComputedStyle(floatBar).display : null,
        rect: floatBar ? floatBar.getBoundingClientRect() : null
      },
      dockEnd: {
        display: dockEnd ? getComputedStyle(dockEnd).display : null,
        rect: dockEnd ? dockEnd.getBoundingClientRect() : null
      }
    };
  });

  console.log('State after buying city:', JSON.stringify(afterBuyState, null, 2));

  await page.screenshot({ path: 'scratch/verify_results/after_buying_city.png' });
  console.log('Screenshot saved to scratch/verify_results/after_buying_city.png');

  await browser.close();
})();
