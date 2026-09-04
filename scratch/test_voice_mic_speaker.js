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
  console.log('--- Connecting to active Chrome instance via CDP ---');
  const cdpPage = await getCdpPage();
  const ws = new WebSocket(cdpPage.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  console.log('Reloading browser to fresh state...');
  await evalInBrowser(ws, 'window.location.reload()');
  await new Promise(r => setTimeout(r, 1500));

  // 1. Test Lobby Voice Bar
  console.log('\n--- 1. Testing Multiplayer Lobby Voice Bar ---');
  await evalInBrowser(ws, `(() => {
    document.getElementById('btn-multiplayer').click();
    const nameInput = document.getElementById('mp-player-name');
    nameInput.value = 'HostWithVoice';
    document.getElementById('btn-lobby-join').click(); // Create room
  })()`);

  await new Promise(r => setTimeout(r, 1200));

  const lobbyVoiceState = await evalInBrowser(ws, `(() => {
    const bar = document.getElementById('lobby-voice-bar');
    const micBtn = document.getElementById('btn-lobby-mic');
    const speakerBtn = document.getElementById('btn-lobby-speaker');
    return {
      barVisible: !!bar && window.getComputedStyle(bar).display !== 'none',
      micText: micBtn ? micBtn.innerText.trim() : null,
      micActive: micBtn ? micBtn.classList.contains('active') : false,
      speakerText: speakerBtn ? speakerBtn.innerText.trim() : null,
      speakerActive: speakerBtn ? speakerBtn.classList.contains('active') : false,
      roomCode: document.getElementById('room-code-show')?.textContent?.trim()
    };
  })()`);

  console.log('Lobby Voice Bar state:', lobbyVoiceState);
  assert.strictEqual(lobbyVoiceState.barVisible, true, 'Lobby voice bar must be visible in waiting room');
  assert.ok(lobbyVoiceState.micText.includes('Mic'), 'Lobby mic button must be present');
  assert.ok(lobbyVoiceState.speakerText.includes('Speaker'), 'Lobby speaker button must be present');
  assert.strictEqual(lobbyVoiceState.speakerActive, true, 'Speaker should default to active (ON)');

  // Test toggling in lobby
  console.log('Testing speaker toggle in lobby...');
  await evalInBrowser(ws, 'voiceManager.toggleSpeaker()');
  const speakerToggledState = await evalInBrowser(ws, `(() => {
    const speakerBtn = document.getElementById('btn-lobby-speaker');
    return {
      isDeafened: voiceManager.isDeafened,
      speakerText: speakerBtn.innerText.trim(),
      speakerActive: speakerBtn.classList.contains('active')
    };
  })()`);
  console.log('Speaker after toggle in lobby:', speakerToggledState);
  assert.strictEqual(speakerToggledState.isDeafened, true, 'Speaker should now be deafened');
  assert.strictEqual(speakerToggledState.speakerActive, false, 'Speaker button should be inactive');

  // Toggle speaker back ON
  await evalInBrowser(ws, 'voiceManager.toggleSpeaker()');

  await captureScreenshot(ws, 'mp_lobby_voice_bar.png');

  // 2. Connect Guest via socket.io to start multiplayer game
  console.log('\n--- 2. Starting Multiplayer Game with Guest ---');
  const guestSocket = io('http://localhost:3000/game-business', { transports: ['websocket'] });
  await new Promise(r => guestSocket.on('connect', r));

  const roomJoinedPromise = new Promise(r => guestSocket.on('room-joined', r));
  guestSocket.emit('join-room', { roomCode: lobbyVoiceState.roomCode, playerName: 'GuestVoice' });
  await roomJoinedPromise;

  await new Promise(r => setTimeout(r, 800));

  // Host clicks Start Game
  await evalInBrowser(ws, `document.getElementById('btn-lobby-start').click()`);
  await new Promise(r => setTimeout(r, 1500));

  // 3. Test In-Game Top HUD Mic & Speaker Buttons
  console.log('\n--- 3. Testing In-Game Top HUD Mic & Speaker Controls ---');
  const topControlsState = await evalInBrowser(ws, `(() => {
    const topMic = document.getElementById('btn-top-mic');
    const topSpeaker = document.getElementById('btn-top-speaker');
    const player0Card = document.getElementById('hud-player-card-0');
    const player0VoiceTag = document.getElementById('voice-tag-0');
    const player1Card = document.getElementById('hud-player-card-1');
    const player1VoiceTag = document.getElementById('voice-tag-1');
    return {
      topMicPresent: !!topMic,
      topMicClasses: topMic ? topMic.className : '',
      topMicTitle: topMic ? topMic.title : '',
      topSpeakerPresent: !!topSpeaker,
      topSpeakerClasses: topSpeaker ? topSpeaker.className : '',
      topSpeakerTitle: topSpeaker ? topSpeaker.title : '',
      player0CardPresent: !!player0Card,
      player0VoiceTagPresent: !!player0VoiceTag,
      player1CardPresent: !!player1Card,
      player1VoiceTagPresent: !!player1VoiceTag
    };
  })()`);

  console.log('Top HUD Controls state:', topControlsState);
  assert.strictEqual(topControlsState.topMicPresent, true, 'Top mic button must exist in HUD');
  assert.strictEqual(topControlsState.topSpeakerPresent, true, 'Top speaker button must exist in HUD');
  assert.ok(topControlsState.topMicClasses.includes('muted'), 'Mic button must start with .muted class');
  assert.ok(topControlsState.topSpeakerClasses.includes('active'), 'Speaker button must start with .active class');
  assert.strictEqual(topControlsState.player0VoiceTagPresent, true, 'Player 0 voice tag must exist on card');
  assert.strictEqual(topControlsState.player1VoiceTagPresent, true, 'Player 1 voice tag must exist on card');

  // 4. Test Microphone Activation & Speaking Indicator
  console.log('\n--- 4. Testing Microphone Activation & Speaking Glow ---');
  // Enable virtual mic simulation to test live audio indicator
  await evalInBrowser(ws, `voiceManager.enableVirtualMic()`);
  await new Promise(r => setTimeout(r, 500));

  const micActiveState = await evalInBrowser(ws, `(() => {
    const topMic = document.getElementById('btn-top-mic');
    const card0 = document.getElementById('hud-player-card-0');
    const tag0 = document.getElementById('voice-tag-0');
    return {
      isMuted: voiceManager.isMuted,
      isSpeaking: voiceManager.isSpeaking,
      micClasses: topMic.className,
      card0Speaking: card0.classList.contains('speaking'),
      tag0Speaking: tag0.classList.contains('speaking'),
      tag0Html: tag0.innerHTML
    };
  })()`);

  console.log('State after activating mic:', micActiveState);
  assert.strictEqual(micActiveState.isMuted, false, 'Mic must be unmuted');
  assert.ok(micActiveState.micClasses.includes('active'), 'Top mic button must have .active class');
  assert.strictEqual(micActiveState.card0Speaking, true, 'Host player card must have .speaking glow class');
  assert.strictEqual(micActiveState.tag0Speaking, true, 'Host voice tag must have .speaking class');

  await captureScreenshot(ws, 'ingame_mic_active_speaking_glow.png');

  // 5. Test Speaker Deafen in game
  console.log('\n--- 5. Testing In-Game Speaker Deafen ---');
  await evalInBrowser(ws, `voiceManager.toggleSpeaker()`);
  const speakerDeafenedState = await evalInBrowser(ws, `(() => {
    const topSpeaker = document.getElementById('btn-top-speaker');
    return {
      isDeafened: voiceManager.isDeafened,
      speakerClasses: topSpeaker.className,
      speakerTitle: topSpeaker.title
    };
  })()`);
  console.log('Speaker after toggle in game:', speakerDeafenedState);
  assert.strictEqual(speakerDeafenedState.isDeafened, true, 'Voice manager must be deafened');
  assert.ok(speakerDeafenedState.speakerClasses.includes('deafened'), 'Top speaker button must have .deafened class');

  // Toggle speaker back ON
  await evalInBrowser(ws, `voiceManager.toggleSpeaker()`);
  const speakerRestored = await evalInBrowser(ws, `(() => {
    const topSpeaker = document.getElementById('btn-top-speaker');
    return {
      isDeafened: voiceManager.isDeafened,
      speakerClasses: topSpeaker.className
    };
  })()`);
  assert.strictEqual(speakerRestored.isDeafened, false, 'Speaker must be un-deafened');
  assert.ok(speakerRestored.speakerClasses.includes('active'), 'Top speaker must have .active class');

  // 6. Test Remote Peer Voice Status Reception
  console.log('\n--- 6. Testing Remote Peer Voice Status Reception ---');
  guestSocket.emit('voice-signal', {
    isSpeaking: true,
    isMuted: false
  });

  await new Promise(r => setTimeout(r, 600));

  const guestVoiceVisual = await evalInBrowser(ws, `(() => {
    const card1 = document.getElementById('hud-player-card-1');
    const tag1 = document.getElementById('voice-tag-1');
    return {
      card1Speaking: card1.classList.contains('speaking'),
      tag1Speaking: tag1.classList.contains('speaking')
    };
  })()`);

  console.log('Guest card visual after receiving remote voice status:', guestVoiceVisual);
  assert.strictEqual(guestVoiceVisual.card1Speaking, true, 'Guest card MUST have .speaking glow when Guest speaks!');
  assert.strictEqual(guestVoiceVisual.tag1Speaking, true, 'Guest voice tag MUST have .speaking class when Guest speaks!');

  await captureScreenshot(ws, 'ingame_remote_player_speaking_glow.png');

  // Guest stops speaking
  guestSocket.emit('voice-signal', {
    isSpeaking: false,
    isMuted: true
  });
  await new Promise(r => setTimeout(r, 500));

  const guestVoiceQuiet = await evalInBrowser(ws, `(() => {
    const card1 = document.getElementById('hud-player-card-1');
    const tag1 = document.getElementById('voice-tag-1');
    return {
      card1Speaking: card1.classList.contains('speaking'),
      tag1Speaking: tag1.classList.contains('speaking')
    };
  })()`);
  assert.strictEqual(guestVoiceQuiet.card1Speaking, false, 'Guest card must stop speaking glow when quiet');

  guestSocket.disconnect();
  ws.close();

  console.log('\n🎉 ALL MIC & SPEAKER TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Mic & Speaker Test Failed:', err);
  process.exit(1);
});
