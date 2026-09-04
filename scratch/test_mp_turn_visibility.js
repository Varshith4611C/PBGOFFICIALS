const { io } = require('socket.io-client');
const assert = require('assert');

async function run() {
  console.log('--- Starting Multiplayer Turn Visibility & Security Test ---');

  const s1 = io('http://localhost:3000/game-business', { reconnection: false });
  const s2 = io('http://localhost:3000/game-business', { reconnection: false });

  await new Promise((res) => {
    let connected = 0;
    const check = () => { if (++connected === 2) res(); };
    s1.on('connect', check);
    s2.on('connect', check);
  });

  console.log('Both sockets connected.');

  let roomCode = '';
  let s1PlayerId = null;
  let s2PlayerId = null;

  // S1 creates room
  await new Promise((res) => {
    s1.emit('create-room', { playerName: 'HostPlayer' });
    s1.on('room-created', (data) => {
      roomCode = data.roomCode;
      s1PlayerId = data.player.id;
      console.log('Room created:', roomCode, 'Host id:', s1PlayerId);
      res();
    });
  });

  // S2 joins room
  await new Promise((res) => {
    s2.emit('join-room', { roomCode, playerName: 'GuestPlayer' });
    s2.on('room-joined', (data) => {
      s2PlayerId = data.player.id;
      console.log('Guest joined:', roomCode, 'Guest id:', s2PlayerId);
      res();
    });
  });

  // Start game
  const p1GameStarted = new Promise((res) => {
    s1.on('game-started', (data) => {
      console.log('S1 game-started received:', data);
      res(data);
    });
  });

  const p2GameStarted = new Promise((res) => {
    s2.on('game-started', (data) => {
      console.log('S2 game-started received:', data);
      res(data);
    });
  });

  s1.emit('start-game');

  const [s1Start, s2Start] = await Promise.all([p1GameStarted, p2GameStarted]);

  assert.strictEqual(s1Start.myPlayerId, 0, 'S1 must have myPlayerId 0');
  assert.strictEqual(s2Start.myPlayerId, 1, 'S2 must have myPlayerId 1');
  assert.strictEqual(s1Start.currentPlayerIndex, 0, 'Game must start on player 0');

  console.log('✅ TEST 1 PASSED: Sockets have distinct, authoritative player IDs (0 and 1).');

  // Test turn 0: Host is active (0), Guest is observing (1)
  const hostIsMyTurn = (s1Start.currentPlayerIndex === s1Start.myPlayerId);
  const guestIsMyTurn = (s1Start.currentPlayerIndex === s2Start.myPlayerId);

  assert.strictEqual(hostIsMyTurn, true, 'Host must be active player on turn 0');
  assert.strictEqual(guestIsMyTurn, false, 'Guest must NOT be active player on turn 0');
  console.log('✅ TEST 2 PASSED: isMyTurn flag is strictly TRUE for Host and FALSE for Guest.');

  // Check unauthorized roll attempt: Guest emits roll when currentPlayerIndex === 0
  let guestRollEmitted = false;
  s1.on('remote-action', (action) => {
    if (action.type === 'roll' && action.senderId === 1) {
      guestRollEmitted = true;
    }
  });

  console.log('Guest attempting unauthorized roll...');
  s2.emit('game-action', { type: 'roll', dice: [6, 6], total: 12, isDoubles: true });

  await new Promise(r => setTimeout(r, 600));

  assert.strictEqual(guestRollEmitted, false, 'Server MUST reject unauthorized roll from Guest on Turn 0');
  console.log('✅ TEST 3 PASSED: Server successfully rejected unauthorized roll from non-turn player.');

  // Host rolls legitimately
  const rollPromise = new Promise((res) => {
    s2.on('remote-action', (action) => {
      if (action.type === 'roll') {
        assert.strictEqual(action.senderId, 0);
        res(action);
      }
    });
  });

  s1.emit('game-action', { type: 'roll', dice: [3, 4], total: 7, isDoubles: false });
  const rollAction = await rollPromise;
  console.log('✅ TEST 4 PASSED: Host roll broadcasted to Guest:', rollAction);

  // Host ends turn, switching to player 1
  const endTurnPromise = new Promise((res) => {
    s2.on('remote-action', (action) => {
      if (action.type === 'endTurn') {
        assert.strictEqual(action.nextPlayerIndex, 1);
        res(action);
      }
    });
  });

  s1.emit('game-action', { type: 'endTurn', nextPlayerIndex: 1 });
  const endAction = await endTurnPromise;
  console.log('✅ TEST 5 PASSED: Turn ended, nextPlayerIndex = 1');

  // Now current turn is 1 (Guest)
  const currentTurn = endAction.nextPlayerIndex;
  const hostIsMyTurnNow = (currentTurn === s1Start.myPlayerId);
  const guestIsMyTurnNow = (currentTurn === s2Start.myPlayerId);

  assert.strictEqual(hostIsMyTurnNow, false, 'Host must NOT be active on turn 1');
  assert.strictEqual(guestIsMyTurnNow, true, 'Guest MUST be active on turn 1');
  console.log('✅ TEST 6 PASSED: On Turn 1, isMyTurn is FALSE for Host and TRUE for Guest.');

  // Host attempting unauthorized roll on turn 1
  let hostRollOnTurn1 = false;
  s2.on('remote-action', (action) => {
    if (action.type === 'roll' && action.senderId === 0) {
      hostRollOnTurn1 = true;
    }
  });

  console.log('Host attempting unauthorized roll on turn 1...');
  s1.emit('game-action', { type: 'roll', dice: [5, 5], total: 10, isDoubles: true });
  await new Promise(r => setTimeout(r, 600));

  // Note: Host is host, but current active human is player 1. Host cannot act for player 1 unless player 1 left.
  assert.strictEqual(hostRollOnTurn1, false, 'Server MUST reject unauthorized roll from Host on Turn 1');
  console.log('✅ TEST 7 PASSED: Server rejected unauthorized roll from Host on Guest turn.');

  // Guest rolls legitimately on turn 1
  const guestRollPromise = new Promise((res) => {
    s1.on('remote-action', (action) => {
      if (action.type === 'roll') {
        assert.strictEqual(action.senderId, 1);
        res(action);
      }
    });
  });

  s2.emit('game-action', { type: 'roll', dice: [2, 3], total: 5, isDoubles: false });
  const gRoll = await guestRollPromise;
  console.log('✅ TEST 8 PASSED: Guest roll broadcasted to Host:', gRoll);

  s1.disconnect();
  s2.disconnect();

  console.log('\n🎉 ALL MULTIPLAYER TURN SECURITY & SYNCHRONIZATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
