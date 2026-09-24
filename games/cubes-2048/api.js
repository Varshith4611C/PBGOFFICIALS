/* ============================================
   PBG Cubes 2048 — Multiplayer Server API
   Real-time Online Multiplayer Engine (Socket.IO)
   ============================================ */

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CUBE-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// roomCode → { roomCode, isPrivate, host, players: Map<socketId, player>, freeCubesSeed, createdAt }
const activeRooms = new Map();

function initCubesSocket(io) {
  const nsp = io.of('/game-cubes');

  nsp.on('connection', (socket) => {
    let currentRoomCode = null;
    let myPlayerInfo = null;

    // Helper: leave current room
    function leaveCurrentRoom() {
      if (!currentRoomCode) return;
      const room = activeRooms.get(currentRoomCode);
      if (room) {
        room.players.delete(socket.id);
        socket.leave(currentRoomCode);
        nsp.to(currentRoomCode).emit('player-left', {
          socketId: socket.id,
          playerName: myPlayerInfo ? myPlayerInfo.name : 'A player',
          remainingCount: room.players.size,
        });

        // If host leaves, assign new host or delete empty room
        if (room.players.size === 0) {
          activeRooms.delete(currentRoomCode);
        } else if (room.host === socket.id) {
          const nextHost = room.players.keys().next().value;
          room.host = nextHost;
          nsp.to(currentRoomCode).emit('host-changed', { hostId: nextHost });
        }
      }
      currentRoomCode = null;
      myPlayerInfo = null;
    }

    // ── Quick Match (Find or Create Public Room) ──
    socket.on('quick-match', ({ playerName }) => {
      leaveCurrentRoom();

      // Find an open public room with < 8 players
      let targetRoom = null;
      for (const [code, r] of activeRooms.entries()) {
        if (!r.isPrivate && r.players.size < 8) {
          targetRoom = r;
          break;
        }
      }

      const safeName = (playerName || 'Player').slice(0, 16).trim();
      const hue = Math.floor(Math.random() * 360);

      if (!targetRoom) {
        // Create new public room
        const roomCode = generateRoomCode();
        targetRoom = {
          roomCode,
          isPrivate: false,
          host: socket.id,
          players: new Map(),
          createdAt: Date.now(),
        };
        activeRooms.set(roomCode, targetRoom);
      }

      currentRoomCode = targetRoom.roomCode;
      myPlayerInfo = {
        socketId: socket.id,
        name: safeName,
        hue,
        isHost: targetRoom.host === socket.id,
        score: 2,
        alive: true,
      };

      targetRoom.players.set(socket.id, myPlayerInfo);
      socket.join(currentRoomCode);

      const existingPlayers = Array.from(targetRoom.players.values()).filter(p => p.socketId !== socket.id);

      socket.emit('joined-room', {
        roomCode: currentRoomCode,
        player: myPlayerInfo,
        existingPlayers,
        isHost: myPlayerInfo.isHost,
      });

      // Broadcast new player to room
      socket.to(currentRoomCode).emit('player-joined', { player: myPlayerInfo });
    });

    // ── Create Private Room ──
    socket.on('create-room', ({ playerName }) => {
      leaveCurrentRoom();

      const roomCode = generateRoomCode();
      const safeName = (playerName || 'Player').slice(0, 16).trim();
      const hue = Math.floor(Math.random() * 360);

      const room = {
        roomCode,
        isPrivate: true,
        host: socket.id,
        players: new Map(),
        createdAt: Date.now(),
      };

      myPlayerInfo = {
        socketId: socket.id,
        name: safeName,
        hue,
        isHost: true,
        score: 2,
        alive: true,
      };

      room.players.set(socket.id, myPlayerInfo);
      activeRooms.set(roomCode, room);

      currentRoomCode = roomCode;
      socket.join(roomCode);

      socket.emit('room-created', {
        roomCode,
        player: myPlayerInfo,
        isHost: true,
      });
    });

    // ── Join Private Room ──
    socket.on('join-room', ({ roomCode, playerName }) => {
      leaveCurrentRoom();

      const formattedCode = (roomCode || '').toUpperCase().trim();
      const room = activeRooms.get(formattedCode);

      if (!room) {
        socket.emit('error-msg', { message: `Room "${formattedCode}" not found. Check the code and try again!` });
        return;
      }

      if (room.players.size >= 12) {
        socket.emit('error-msg', { message: `Room "${formattedCode}" is full! Maximum 12 players.` });
        return;
      }

      const safeName = (playerName || 'Player').slice(0, 16).trim();
      const hue = Math.floor(Math.random() * 360);

      currentRoomCode = formattedCode;
      myPlayerInfo = {
        socketId: socket.id,
        name: safeName,
        hue,
        isHost: room.host === socket.id,
        score: 2,
        alive: true,
      };

      room.players.set(socket.id, myPlayerInfo);
      socket.join(currentRoomCode);

      const existingPlayers = Array.from(room.players.values()).filter(p => p.socketId !== socket.id);

      socket.emit('joined-room', {
        roomCode: currentRoomCode,
        player: myPlayerInfo,
        existingPlayers,
        isHost: myPlayerInfo.isHost,
      });

      socket.to(currentRoomCode).emit('player-joined', { player: myPlayerInfo });
    });

    // ── Continuous State Sync (20-30Hz) ──
    socket.on('player-update', (state) => {
      if (!currentRoomCode) return;
      if (myPlayerInfo) {
        myPlayerInfo.score = state.score || myPlayerInfo.score;
        myPlayerInfo.alive = state.alive !== undefined ? state.alive : true;
      }
      // Relay player movement and cubes to other peers in room
      socket.to(currentRoomCode).emit('peer-update', {
        socketId: socket.id,
        x: state.x,
        y: state.y,
        angle: state.angle,
        speed: state.speed,
        boosting: state.boosting,
        segments: state.segments,
        score: state.score,
        name: myPlayerInfo ? myPlayerInfo.name : state.name,
        hue: myPlayerInfo ? myPlayerInfo.hue : state.hue,
      });
    });

    // ── Cube Eaten Sync ──
    socket.on('cube-consumed', ({ cubeId }) => {
      if (!currentRoomCode) return;
      socket.to(currentRoomCode).emit('cube-removed', { cubeId, eaterId: socket.id });
    });

    // ── Player Consumed Other Player ──
    socket.on('player-eliminated', ({ victimSocketId, points }) => {
      if (!currentRoomCode) return;
      nsp.to(currentRoomCode).emit('player-death', {
        killerId: socket.id,
        killerName: myPlayerInfo ? myPlayerInfo.name : 'A player',
        victimId: victimSocketId,
        points,
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      leaveCurrentRoom();
    });
  });
}

module.exports = { initCubesSocket };
