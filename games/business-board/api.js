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

const gameRooms = new Map(); // roomCode → { players, gameState, host, started }

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
        host: socket.id,
        started: false,
        currentPlayerIndex: 0
      });

      currentRoom = roomCode;
      playerId = 0;
      socket.join(roomCode);

      socket.emit('room-created', { roomCode, player, players: [player] });
      gameNsp.to(roomCode).emit('players-update', { players: [player] });
    });

    // ── Join Room ──
    socket.on('join-room', ({ roomCode, playerName }) => {
      roomCode = (roomCode || '').toUpperCase().trim();
      const room = gameRooms.get(roomCode);

      if (!room) {
        socket.emit('error-msg', { message: `Room "${roomCode}" not found! Check code and try again.` });
        return;
      }
      if (room.started) {
        socket.emit('error-msg', { message: 'Game in this room is already in progress!' });
        return;
      }
      if (room.players.length >= 4) {
        socket.emit('error-msg', { message: 'Room is full! (Maximum 4 players)' });
        return;
      }

      // Re-use existing player entry if socket already registered
      const existing = room.players.find(p => p.socketId === socket.id);
      if (existing) {
        if (playerName) existing.name = playerName;
        currentRoom = roomCode;
        playerId = existing.id;
        socket.emit('room-joined', { roomCode, player: existing, players: room.players });
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

    // ── Start Game (Host only) ──
    socket.on('start-game', () => {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      if (!room || room.host !== socket.id) return;
      if (room.players.length < 2) {
        socket.emit('error-msg', { message: 'Need at least 2 players in room to start multiplayer!' });
        return;
      }

      room.started = true;
      room.currentPlayerIndex = 0;

      const playersPayload = room.players.map((p, i) => ({
        id: i,
        socketId: p.socketId,
        name: p.name,
        isHost: p.isHost
      }));

      // Deliver targeted myPlayerId to each connected peer
      room.players.forEach(p => {
        gameNsp.to(p.socketId).emit('game-started', {
          players: playersPayload,
          currentPlayerIndex: 0,
          myPlayerId: p.id
        });
      });
    });

    // ── Broadcast Game Action to all peers in room ──
    socket.on('game-action', (action) => {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      if (!room || !room.started) return;

      // Authoritative Turn Validation: only active player (or host if active player is disconnected/AI) can roll or end turn
      if (action.type === 'roll' || action.type === 'endTurn') {
        const currentActive = room.players[room.currentPlayerIndex];
        const isCurrentActive = currentActive && currentActive.socketId === socket.id;
        const isHost = room.host === socket.id;
        const isAI = currentActive && (currentActive.isAI || currentActive.disconnected);

        if (!isCurrentActive && !(isHost && isAI)) {
          console.warn(`[MP] Blocked unauthorized ${action.type} from player ${playerId} (Active: ${room.currentPlayerIndex})`);
          return;
        }
      }

      if (action.type === 'endTurn' && action.nextPlayerIndex !== undefined) {
        room.currentPlayerIndex = action.nextPlayerIndex;
      }

      // Broadcast to ALL sockets in the room
      gameNsp.to(currentRoom).emit('remote-action', {
        ...action,
        senderId: playerId
      });
    });

    // ── In-Game Text Chat & Reactions ──
    socket.on('send-chat', ({ text, emoji, time }) => {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      const sender = room?.players.find(p => p.socketId === socket.id);
      gameNsp.to(currentRoom).emit('chat-message', {
        playerId,
        playerName: sender?.name || `Player ${playerId + 1}`,
        text,
        emoji,
        time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // ── WebRTC Voice Chat Signaling (SDP Offer/Answer & ICE Candidates) ──
    socket.on('voice-signal', (data) => {
      if (!currentRoom) return;
      const room = gameRooms.get(currentRoom);
      if (!room) return;

      const payload = {
        ...data,
        fromSocketId: socket.id,
        fromPlayerId: playerId
      };

      if (data.targetSocketId) {
        gameNsp.to(data.targetSocketId).emit('voice-signal', payload);
      } else if (data.targetPlayerId !== undefined) {
        const targetPlayer = room.players.find(p => p.id === data.targetPlayerId);
        if (targetPlayer) {
          gameNsp.to(targetPlayer.socketId).emit('voice-signal', payload);
        }
      } else {
        // Broadcast to other peers in room
        socket.to(currentRoom).emit('voice-signal', payload);
      }
    });

    socket.on('voice-status-update', (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('voice-status-update', {
        ...data,
        playerId
      });
    });

    // ── Disconnect & Leave ──
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
        // Transfer host if host left
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
