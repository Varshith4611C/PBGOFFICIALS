/* ============================================
   PBG Business Board Game — Multiplayer API
   Server-side Socket.IO handler for game rooms
   ============================================ */

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PBG-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const gameRooms = new Map(); // roomCode → { players, gameState, host }

function initGameSocket(io) {
  const gameNsp = io.of('/game-business');

  gameNsp.on('connection', (socket) => {
    let currentRoom = null;
    let playerId = null;

    // ── Create Room ──
    socket.on('create-room', ({ playerName }) => {
      const roomCode = generateRoomCode();
      const player = {
        id: 0,
        socketId: socket.id,
        name: playerName || 'Player 1',
        isHost: true,
        ready: true
      };

      gameRooms.set(roomCode, {
        players: [player],
        gameState: null,
        host: socket.id,
        started: false
      });

      currentRoom = roomCode;
      playerId = 0;
      socket.join(roomCode);

      socket.emit('room-created', { roomCode, player });
      gameNsp.to(roomCode).emit('players-update', { players: gameRooms.get(roomCode).players });
    });

    // ── Join Room ──
    socket.on('join-room', ({ roomCode, playerName }) => {
      roomCode = (roomCode || '').toUpperCase().trim();
      const room = gameRooms.get(roomCode);

      if (!room) {
        socket.emit('error-msg', { message: 'Room not found! Check the code and try again.' });
        return;
      }
      if (room.started) {
        socket.emit('error-msg', { message: 'Game already in progress!' });
        return;
      }
      if (room.players.length >= 4) {
        socket.emit('error-msg', { message: 'Room is full! (max 4 players)' });
        return;
      }

      const newId = room.players.length;
      const player = {
        id: newId,
        socketId: socket.id,
        name: playerName || `Player ${newId + 1}`,
        isHost: false,
        ready: true
      };

      room.players.push(player);
      currentRoom = roomCode;
      playerId = newId;
      socket.join(roomCode);

      socket.emit('room-joined', { roomCode, player, players: room.players });
      gameNsp.to(roomCode).emit('players-update', { players: room.players });
    });

    // ── Start Game (host only) ──
    socket.on('start-game', () => {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      if (!room || room.host !== socket.id) return;
      if (room.players.length < 2) {
        socket.emit('error-msg', { message: 'Need at least 2 players to start!' });
        return;
      }

      room.started = true;
      // Initialize game state on server
      room.gameState = {
        currentPlayerIndex: 0,
        properties: {},
        players: room.players.map((p, i) => ({
          id: i, name: p.name, cash: 1500, position: 0,
          inJail: false, jailTurns: 0, isBankrupt: false
        }))
      };

      gameNsp.to(currentRoom).emit('game-started', {
        players: room.gameState.players,
        currentPlayerIndex: 0
      });
    });

    // ── Game Actions ──
    socket.on('game-action', (action) => {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      if (!room || !room.started) return;

      // Validate it's this player's turn
      if (room.gameState.currentPlayerIndex !== playerId) {
        socket.emit('error-msg', { message: 'Not your turn!' });
        return;
      }

      // Broadcast action to all players in room
      gameNsp.to(currentRoom).emit('game-action', {
        ...action,
        playerId: playerId
      });
    });

    // ── Sync State ──
    socket.on('sync-state', (state) => {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      if (!room || room.host !== socket.id) return;
      room.gameState = state;
      socket.to(currentRoom).emit('state-update', state);
    });

    // ── Leave / Disconnect ──
    socket.on('leave-room', () => handleLeave());
    socket.on('disconnect', () => handleLeave());

    function handleLeave() {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      if (!room) return;

      room.players = room.players.filter(p => p.socketId !== socket.id);
      socket.leave(currentRoom);

      if (room.players.length === 0) {
        gameRooms.delete(currentRoom);
      } else {
        // Transfer host if needed
        if (room.host === socket.id) {
          room.host = room.players[0].socketId;
          room.players[0].isHost = true;
        }
        gameNsp.to(currentRoom).emit('players-update', { players: room.players });
        gameNsp.to(currentRoom).emit('player-left', { playerId });
      }

      currentRoom = null;
      playerId = null;
    }
  });
}

module.exports = { initGameSocket };
