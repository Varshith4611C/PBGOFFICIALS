const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

async function run() {
  console.log('--- Launching 2 Browser Instances (Host & Guest) for UI verification ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pageHost = await browser.newPage();
  const pageGuest = await browser.newPage();

  await pageHost.setViewport({ width: 1280, height: 720 });
  await pageGuest.setViewport({ width: 1280, height: 720 });

  // 1. Navigate to business-board
  await pageHost.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle2' });
  await pageGuest.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle2' });

  // 2. Click "Multiplayer" on Host
  await pageHost.click('#btn-multiplayer');
  await pageHost.waitForSelector('#mp-player-name', { visible: true });
  await pageHost.$eval('#mp-player-name', el => el.value = '');
  await pageHost.type('#mp-player-name', 'Alice (Host)');
  // Empty room-code-input means CREATE room
  await pageHost.click('#btn-lobby-join');

  // Wait for room code
  await pageHost.waitForSelector('#room-code-show', { visible: true });
  await pageHost.waitForFunction(() => {
    const code = document.getElementById('room-code-show')?.textContent?.trim();
    return code && code !== '----';
  }, { timeout: 8000 });

  const roomCode = await pageHost.$eval('#room-code-show', el => el.textContent.trim());
  console.log('Host created room:', roomCode);

  // 3. Guest joins room
  await pageGuest.click('#btn-multiplayer');
  await pageGuest.waitForSelector('#mp-player-name', { visible: true });
  await pageGuest.$eval('#mp-player-name', el => el.value = '');
  await pageGuest.type('#mp-player-name', 'Bob (Guest)');
  await pageGuest.type('#room-code-input', roomCode);
  await pageGuest.click('#btn-lobby-join');

  // Wait for both to be in lobby
  await pageHost.waitForFunction(() => {
    const list = document.querySelectorAll('#lobby-players li');
    return list.length >= 2;
  }, { timeout: 8000 });
  console.log('Both players in lobby.');

  // 4. Host starts game
  await pageHost.click('#btn-lobby-start');

  // Wait for game-screen on both
  await pageHost.waitForSelector('#game-screen:not([style*="display: none"])', { timeout: 8000 });
  await pageGuest.waitForSelector('#game-screen:not([style*="display: none"])', { timeout: 8000 });
  console.log('Game screens active on both browsers.');

  await new Promise(r => setTimeout(r, 1000));

  // 5. Inspect Turn 1 (Host's turn) UI elements on both clients
  const hostTurn1UI = await pageHost.evaluate(() => {
    const rollBtn = document.getElementById('btn-roll-3d');
    const endBtn = document.getElementById('btn-end-3d');
    const waitBadge = document.getElementById('turn-wait-badge');
    return {
      isMyTurn: window.game.isMyTurn,
      myPlayerId: window.game.myPlayerId,
      currentPlayerIndex: window.game.currentPlayerIndex,
      rollDisplay: window.getComputedStyle(rollBtn).display,
      rollDisabled: rollBtn.disabled,
      endDisplay: window.getComputedStyle(endBtn).display,
      waitDisplay: window.getComputedStyle(waitBadge).display,
      waitText: waitBadge.innerText
    };
  });

  const guestTurn1UI = await pageGuest.evaluate(() => {
    const rollBtn = document.getElementById('btn-roll-3d');
    const endBtn = document.getElementById('btn-end-3d');
    const waitBadge = document.getElementById('turn-wait-badge');
    return {
      isMyTurn: window.game.isMyTurn,
      myPlayerId: window.game.myPlayerId,
      currentPlayerIndex: window.game.currentPlayerIndex,
      rollDisplay: window.getComputedStyle(rollBtn).display,
      rollDisabled: rollBtn.disabled,
      endDisplay: window.getComputedStyle(endBtn).display,
      waitDisplay: window.getComputedStyle(waitBadge).display,
      waitText: waitBadge.innerText
    };
  });

  console.log('--- TURN 1 EVALUATION ---');
  console.log('Host UI State:', hostTurn1UI);
  console.log('Guest UI State:', guestTurn1UI);

  assert.strictEqual(hostTurn1UI.isMyTurn, true, 'Host must be active player on Turn 1');
  assert.strictEqual(hostTurn1UI.rollDisplay, 'flex', 'Host MUST see roll button displayed as flex');
  assert.strictEqual(hostTurn1UI.rollDisabled, false, 'Host roll button MUST be enabled');
  assert.strictEqual(hostTurn1UI.waitDisplay, 'none', 'Host wait badge MUST be hidden');

  assert.strictEqual(guestTurn1UI.isMyTurn, false, 'Guest must NOT be active on Turn 1');
  assert.strictEqual(guestTurn1UI.rollDisplay, 'none', 'Guest roll button MUST be completely hidden (display: none)');
  assert.strictEqual(guestTurn1UI.endDisplay, 'none', 'Guest end turn button MUST be hidden');
  assert.strictEqual(guestTurn1UI.waitDisplay, 'flex', 'Guest wait badge MUST be visible (display: flex)');
  console.log('Guest badge text:', guestTurn1UI.waitText);

  console.log('✅ TURN 1 UI VERIFIED: Roll button is ONLY on Host screen! Guest sees clean waiting badge.');

  const artifactDir = 'C:\\Users\\varsh\\.gemini\\antigravity-ide\\brain\\417d19ba-9082-42d3-adf1-80ceadbb2d5d';
  await pageHost.screenshot({ path: path.join(artifactDir, 'mp_turn1_host.png') });
  await pageGuest.screenshot({ path: path.join(artifactDir, 'mp_turn1_guest.png') });

  // 6. Host rolls dice
  console.log('Host clicking roll button...');
  await pageHost.click('#btn-roll-3d');

  // Wait for Host move and action/done phase
  await pageHost.waitForFunction(() => {
    return window.game.turnPhase === 'action' || window.game.turnPhase === 'done';
  }, { timeout: 10000 });

  // If buy modal appeared on Host, pass on it
  const buyModalVisible = await pageHost.evaluate(() => {
    const modal = document.getElementById('modal-overlay');
    return modal && !modal.classList.contains('hidden');
  });

  if (buyModalVisible) {
    console.log('Host closing buy modal by passing...');
    await pageHost.evaluate(() => {
      const passBtn = document.querySelector('.btn-buy-pass');
      if (passBtn) passBtn.click();
      else if (window.hideModal) window.hideModal();
    });
  }

  // Host should now have turnPhase === 'done' or 'roll' (if doubles)
  await pageHost.waitForFunction(() => {
    return window.game.turnPhase === 'done' || window.game.turnPhase === 'roll';
  }, { timeout: 8000 });

  // If Host is done, click End Turn
  const isDone = await pageHost.evaluate(() => window.game.turnPhase === 'done');
  if (isDone) {
    console.log('Host clicking End Turn...');
    await pageHost.click('#btn-end-3d');
  }

  // 7. Wait for Turn 2 (Guest's turn)
  await pageHost.waitForFunction(() => window.game.currentPlayerIndex === 1, { timeout: 8000 });
  await pageGuest.waitForFunction(() => window.game.currentPlayerIndex === 1, { timeout: 8000 });
  console.log('Both browsers synchronized to Turn 2 (Guest turn).');

  await new Promise(r => setTimeout(r, 600));

  // 8. Inspect Turn 2 UI on both clients
  const hostTurn2UI = await pageHost.evaluate(() => {
    const rollBtn = document.getElementById('btn-roll-3d');
    const waitBadge = document.getElementById('turn-wait-badge');
    return {
      isMyTurn: window.game.isMyTurn,
      currentPlayerIndex: window.game.currentPlayerIndex,
      rollDisplay: window.getComputedStyle(rollBtn).display,
      waitDisplay: window.getComputedStyle(waitBadge).display,
      waitText: waitBadge.innerText
    };
  });

  const guestTurn2UI = await pageGuest.evaluate(() => {
    const rollBtn = document.getElementById('btn-roll-3d');
    const waitBadge = document.getElementById('turn-wait-badge');
    return {
      isMyTurn: window.game.isMyTurn,
      currentPlayerIndex: window.game.currentPlayerIndex,
      rollDisplay: window.getComputedStyle(rollBtn).display,
      rollDisabled: rollBtn.disabled,
      waitDisplay: window.getComputedStyle(waitBadge).display
    };
  });

  console.log('--- TURN 2 EVALUATION ---');
  console.log('Host UI State on Turn 2:', hostTurn2UI);
  console.log('Guest UI State on Turn 2:', guestTurn2UI);

  assert.strictEqual(hostTurn2UI.isMyTurn, false, 'Host must NOT be active on Turn 2');
  assert.strictEqual(hostTurn2UI.rollDisplay, 'none', 'Host roll button MUST now be completely hidden (display: none)');
  assert.strictEqual(hostTurn2UI.waitDisplay, 'flex', 'Host wait badge MUST now be visible');

  assert.strictEqual(guestTurn2UI.isMyTurn, true, 'Guest MUST now be active on Turn 2');
  assert.strictEqual(guestTurn2UI.rollDisplay, 'flex', 'Guest roll button MUST now be visible (display: flex)');
  assert.strictEqual(guestTurn2UI.rollDisabled, false, 'Guest roll button MUST be enabled');
  assert.strictEqual(guestTurn2UI.waitDisplay, 'none', 'Guest wait badge MUST now be hidden');

  console.log('✅ TURN 2 UI VERIFIED: Roll button shifted to Guest! Host roll button is completely hidden.');

  await pageHost.screenshot({ path: path.join(artifactDir, 'mp_turn2_host.png') });
  await pageGuest.screenshot({ path: path.join(artifactDir, 'mp_turn2_guest.png') });

  await browser.close();
  console.log('\n🎉 ALL REAL-BROWSER UI TESTS PASSED! ROLL BUTTON IS STRICTLY RESTRICTED TO ACTIVE TURN PLAYER.');
}

run().catch(err => {
  console.error('❌ Browser test failed:', err);
  process.exit(1);
});
