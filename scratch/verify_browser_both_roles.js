const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { io } = require('c:/Users/varsh/Desktop/PBGOFFICIALS/node_modules/socket.io-client');
const assert = require('assert');

function getCdpPage() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const pages = JSON.parse(data);
          const gamePage = pages.find(p => p.url.includes('business-board'));
          if (!gamePage) reject(new Error('No game page found in CDP'));
          else resolve(gamePage);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sendCdp(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (msg) => {
      const res = JSON.parse(msg);
      if (res.id === id) {
        ws.off('message', handler);
        resolve(res.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInBrowser(ws, expr) {
  const res = await sendCdp(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
  return res.result?.value;
}

async function captureScreenshot(ws, filename) {
  const res = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
  if (res && res.data) {
    const filePath = path.join('C:\\Users\\varsh\\.gemini\\antigravity-ide\\brain\\417d19ba-9082-42d3-adf1-80ceadbb2d5d', filename);
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function run() {
  console.log('--- Connecting to active browser via CDP ---');
  const cdpPage = await getCdpPage();
  const ws = new WebSocket(cdpPage.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  // Reload the browser page fresh
  console.log('Reloading browser to initial state...');
  await evalInBrowser(ws, `window.location.reload()`);
  await new Promise(r => setTimeout(r, 1500));

  // ══════════════════════════════════════════════════
  // SCENARIO 1: Browser is GUEST (Player 1)
  // This directly verifies the user's report:
  // "in multiplayer roll button is available to both players irrespective of their turns"
  // When browser is Guest, turn 0 is HOST's turn, so Browser MUST NOT have roll button!
  // ══════════════════════════════════════════════════
  console.log('\n--- SCENARIO 1: Browser joins as GUEST (Player 1) ---');

  // Socket creates room as Host
  const hostSocket = io('http://localhost:3000/game-business', { transports: ['websocket'] });
  await new Promise(r => hostSocket.on('connect', r));

  const roomCodePromise = new Promise(resolve => {
    hostSocket.on('room-created', data => resolve(data.roomCode));
  });
  hostSocket.emit('create-room', { playerName: 'HostNode' });
  const roomCode = await roomCodePromise;
  console.log(`Socket created room: ${roomCode}`);

  // Browser clicks Multiplayer, enters name, enters roomCode, clicks Join
  await evalInBrowser(ws, `(() => {
    document.getElementById('btn-multiplayer').click();
    const nameInput = document.getElementById('mp-player-name');
    nameInput.value = 'BrowserGuest';
    const codeInput = document.getElementById('room-code-input');
    codeInput.value = '${roomCode}';
    document.getElementById('btn-lobby-join').click();
  })()`);

  // Wait for browser to be in waiting room
  await new Promise(r => setTimeout(r, 1000));
  console.log('Browser joined room as Guest.');

  // Host starts game
  const hostGameStarted = new Promise(resolve => {
    hostSocket.on('game-started', resolve);
  });
  hostSocket.emit('start-game');
  await hostGameStarted;
  console.log('Game started by Host.');

  await new Promise(r => setTimeout(r, 1200));

  // Check Browser state on Turn 1 (Host's turn, Player 0 active)
  const guestState1 = await evalInBrowser(ws, `(() => {
    const rollBtn = document.getElementById('btn-roll-3d');
    const endBtn = document.getElementById('btn-end-3d');
    const waitBadge = document.getElementById('turn-wait-badge');
    return {
      isMultiplayer: window.game.isMultiplayer,
      myPlayerId: window.game.myPlayerId,
      currentPlayerIndex: window.game.currentPlayerIndex,
      isMyTurn: window.game.isMyTurn,
      activePlayerName: window.game.currentPlayer.name,
      rollDisplay: window.getComputedStyle(rollBtn).display,
      rollDisabled: rollBtn.disabled,
      endDisplay: window.getComputedStyle(endBtn).display,
      waitDisplay: window.getComputedStyle(waitBadge).display,
      waitText: waitBadge.innerText
    };
  })()`);

  console.log('Guest (Browser) State on Turn 0 (Host turn):', guestState1);

  assert.strictEqual(guestState1.myPlayerId, 1, 'Browser must be Player 1 (Guest)');
  assert.strictEqual(guestState1.currentPlayerIndex, 0, 'Current turn must be 0 (Host)');
  assert.strictEqual(guestState1.isMyTurn, false, 'isMyTurn must be FALSE on Guest');
  assert.strictEqual(guestState1.rollDisplay, 'none', 'Roll button MUST be display: none for Guest!');
  assert.strictEqual(guestState1.rollDisabled, true, 'Roll button must be disabled for Guest');
  assert.strictEqual(guestState1.endDisplay, 'none', 'End Turn button must be hidden for Guest');
  assert.strictEqual(guestState1.waitDisplay, 'flex', 'Wait badge MUST be display: flex for Guest!');

  console.log('🎯 VERIFIED: When it is NOT Guest turn, roll button is 100% HIDDEN and wait badge is displayed!');
  await captureScreenshot(ws, 'guest_waiting_badge_visible.png');

  // Now Host rolls and ends turn
  console.log('Host takes turn and ends turn...');
  hostSocket.emit('game-action', { type: 'roll', dice: [4, 3], total: 7, isDoubles: false });
  await new Promise(r => setTimeout(r, 2000));

  hostSocket.emit('game-action', { type: 'endTurn', nextPlayerIndex: 1 });
  await new Promise(r => setTimeout(r, 800));

  // Check Browser state on Turn 1 (Guest's turn, Player 1 active)
  const guestState2 = await evalInBrowser(ws, `(() => {
    const rollBtn = document.getElementById('btn-roll-3d');
    const endBtn = document.getElementById('btn-end-3d');
    const waitBadge = document.getElementById('turn-wait-badge');
    return {
      myPlayerId: window.game.myPlayerId,
      currentPlayerIndex: window.game.currentPlayerIndex,
      isMyTurn: window.game.isMyTurn,
      rollDisplay: window.getComputedStyle(rollBtn).display,
      rollDisabled: rollBtn.disabled,
      rollText: rollBtn.textContent,
      waitDisplay: window.getComputedStyle(waitBadge).display
    };
  })()`);

  console.log('Guest (Browser) State on Turn 1 (Guest turn):', guestState2);

  assert.strictEqual(guestState2.currentPlayerIndex, 1, 'Current turn must be 1');
  assert.strictEqual(guestState2.isMyTurn, true, 'isMyTurn must be TRUE on Guest turn');
  assert.strictEqual(guestState2.rollDisplay, 'flex', 'Roll button MUST be display: flex on Guest turn!');
  assert.strictEqual(guestState2.rollDisabled, false, 'Roll button must be enabled on Guest turn');
  assert.strictEqual(guestState2.waitDisplay, 'none', 'Wait badge MUST be display: none on Guest turn');

  console.log('🎯 VERIFIED: On Guest turn, roll button becomes VISIBLE and wait badge is hidden!');
  await captureScreenshot(ws, 'guest_roll_button_visible.png');

  // Browser rolls dice
  console.log('Browser clicks roll button on its turn...');
  await evalInBrowser(ws, `document.getElementById('btn-roll-3d').click()`);
  await new Promise(r => setTimeout(r, 2500));

  // If buy modal appears, pass
  await evalInBrowser(ws, `(() => {
    const passBtn = document.querySelector('.btn-buy-pass');
    if (passBtn) passBtn.click();
  })()`);
  await new Promise(r => setTimeout(r, 500));

  // Browser clicks End Turn
  const guestEndVisible = await evalInBrowser(ws, `window.getComputedStyle(document.getElementById('btn-end-3d')).display`);
  console.log('Guest End Turn button display:', guestEndVisible);
  assert.strictEqual(guestEndVisible, 'flex', 'End turn button must be visible when turn phase is done');

  await evalInBrowser(ws, `document.getElementById('btn-end-3d').click()`);
  await new Promise(r => setTimeout(r, 800));

  // Check that turn transitioned back to Player 0 and roll button on browser disappears again!
  const guestState3 = await evalInBrowser(ws, `(() => {
    const rollBtn = document.getElementById('btn-roll-3d');
    const waitBadge = document.getElementById('turn-wait-badge');
    return {
      currentPlayerIndex: window.game.currentPlayerIndex,
      isMyTurn: window.game.isMyTurn,
      rollDisplay: window.getComputedStyle(rollBtn).display,
      waitDisplay: window.getComputedStyle(waitBadge).display,
      waitText: waitBadge.innerText
    };
  })()`);

  console.log('Guest (Browser) State on Turn 2 (Host turn again):', guestState3);

  assert.strictEqual(guestState3.currentPlayerIndex, 0, 'Current turn must be back to 0');
  assert.strictEqual(guestState3.isMyTurn, false, 'isMyTurn must be FALSE');
  assert.strictEqual(guestState3.rollDisplay, 'none', 'Roll button MUST disappear again!');
  assert.strictEqual(guestState3.waitDisplay, 'flex', 'Wait badge MUST reappear!');

  console.log('🎯 VERIFIED: Roll button properly disappears as soon as turn ends!');
  await captureScreenshot(ws, 'guest_waiting_badge_reappeared.png');

  hostSocket.disconnect();
  ws.close();

  console.log('\n🎉 ALL REAL BROWSER CHECKS CONFIRMED 100%! ROLL BUTTON IS NEVER AVAILABLE TO NON-TURN PLAYERS.');
}

run().catch(err => {
  console.error('❌ CDP Verification failed:', err);
  process.exit(1);
});
