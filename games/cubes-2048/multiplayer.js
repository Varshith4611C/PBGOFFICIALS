/* ============================================
   PBG Cubes 2048 — Multiplayer Client Engine
   Real-time Online Multiplayer (Socket.IO + WebRTC)
   ============================================ */

class CubesMultiplayerClient {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.connected = false;
    this.roomCode = null;
    this.isHost = false;
    this.playerId = null;
    this.lastBroadcast = 0;
    this.broadcastInterval = 40; // 25Hz broadcast rate
    this.remotePlayers = new Map(); // socketId -> remoteEntity

    this.initSocket();
  }

  initSocket() {
    if (typeof io === 'undefined') {
      console.warn('[MP] Socket.IO client library not loaded yet.');
      return;
    }

    try {
      this.socket = io('/game-cubes', {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 8000,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.playerId = this.socket.id;
        console.log('[MP] Connected to Cubes 2048 online server. Socket ID:', this.socket.id);
        this.updateNetworkBadge(true);
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.warn('[MP] Disconnected from server.');
        this.updateNetworkBadge(false);
      });

      this.socket.on('connect_error', (err) => {
        console.warn('[MP] Connection error:', err);
        this.updateNetworkBadge(false);
      });

      this.socket.on('error-msg', ({ message }) => {
        this.showToast(message, 'error');
      });

      // ── Room Events ──
      this.socket.on('room-created', ({ roomCode, player, isHost }) => {
        this.roomCode = roomCode;
        this.isHost = isHost;
        this.playerId = player.socketId;
        this.onRoomJoined(roomCode, isHost);
        this.showToast(`Private room created: ${roomCode}`, 'success');
      });

      this.socket.on('joined-room', ({ roomCode, player, existingPlayers, isHost }) => {
        this.roomCode = roomCode;
        this.isHost = isHost;
        this.playerId = player.socketId;

        // Register existing players
        if (existingPlayers && existingPlayers.length) {
          for (const ep of existingPlayers) {
            this.registerRemotePlayer(ep);
          }
        }

        this.onRoomJoined(roomCode, isHost);
        this.showToast(`Joined online room: ${roomCode}`, 'success');
      });

      this.socket.on('player-joined', ({ player }) => {
        this.registerRemotePlayer(player);
        this.showToast(`🌐 ${player.name} joined the arena!`, 'info');
      });

      this.socket.on('player-left', ({ socketId, playerName }) => {
        this.removeRemotePlayer(socketId);
        this.showToast(`🚪 ${playerName} left the arena`, 'info');
      });

      // ── Real-time Peer Update ──
      this.socket.on('peer-update', (data) => {
        this.handlePeerUpdate(data);
      });

      // ── Free Cube Consumed By Other Player ──
      this.socket.on('cube-removed', ({ cubeId }) => {
        if (this.game && this.game.freeCubes) {
          const c = this.game.freeCubes.find(fc => fc.id === cubeId);
          if (c) c.alive = false;
        }
      });

      // ── Elimination Broadcast ──
      this.socket.on('player-death', ({ killerId, killerName, victimId, points }) => {
        if (victimId === this.playerId) {
          // Local player was eliminated by killer
          if (this.game && this.game.player && this.game.player.alive) {
            this.game.player.alive = false;
            this.game.gameOver(`Consumed by ${killerName}!`);
          }
        } else {
          this.removeRemotePlayer(victimId);
          this.showToast(`💥 ${killerName} dominated ${points} cubes!`, 'warning');
        }
      });

    } catch (e) {
      console.error('[MP] Socket init error:', e);
      this.updateNetworkBadge(false);
    }
  }

  updateNetworkBadge(connected) {
    const badge = document.getElementById('mp-status-indicator');
    if (badge) {
      if (connected) {
        badge.innerHTML = '<span class="status-dot green"></span> Online Server Ready';
        badge.className = 'mp-status-pill online';
      } else {
        badge.innerHTML = '<span class="status-dot amber"></span> Connecting to Server...';
        badge.className = 'mp-status-pill connecting';
      }
    }
  }

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `game-toast ${type}`;
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  quickMatch(playerName) {
    if (!this.socket || !this.connected) {
      this.initSocket();
      setTimeout(() => {
        if (this.socket && this.connected) {
          this.socket.emit('quick-match', { playerName });
        } else {
          this.showToast('Connecting to online server, please wait...', 'error');
        }
      }, 500);
      return;
    }
    this.socket.emit('quick-match', { playerName });
  }

  createRoom(playerName) {
    if (!this.socket || !this.connected) {
      this.showToast('Online server not connected yet.', 'error');
      return;
    }
    this.socket.emit('create-room', { playerName });
  }

  joinRoom(roomCode, playerName) {
    if (!this.socket || !this.connected) {
      this.showToast('Online server not connected yet.', 'error');
      return;
    }
    if (!roomCode || roomCode.trim().length < 4) {
      this.showToast('Please enter a valid room code.', 'error');
      return;
    }
    this.socket.emit('join-room', { roomCode: roomCode.trim().toUpperCase(), playerName });
  }

  onRoomJoined(roomCode, isHost) {
    // Hide start overlay
    const startOverlay = document.getElementById('start-overlay');
    if (startOverlay) startOverlay.classList.add('hidden');

    // Update room badge in HUD
    const roomBadge = document.getElementById('mp-room-badge');
    const roomCodeEl = document.getElementById('mp-room-code-val');
    if (roomBadge && roomCodeEl) {
      roomCodeEl.textContent = roomCode;
      roomBadge.classList.remove('hidden');
    }

    // Start game in multiplayer mode
    const nameInput = document.getElementById('player-name');
    const name = nameInput ? nameInput.value.trim().slice(0, 16) || 'Player' : 'Player';
    this.game.startMultiplayerGame(name, roomCode, isHost);
  }

  registerRemotePlayer(info) {
    if (!info || !info.socketId || info.socketId === this.playerId) return;
    if (this.remotePlayers.has(info.socketId)) return;

    // Create a remote player snake in the game
    const remote = this.game.createRemoteEntity(info.socketId, info.name || 'Online Player', info.hue || 180);
    this.remotePlayers.set(info.socketId, remote);
  }

  removeRemotePlayer(socketId) {
    const remote = this.remotePlayers.get(socketId);
    if (remote) {
      remote.alive = false;
      this.remotePlayers.delete(socketId);
      // Remove from entities
      this.game.entities = this.game.entities.filter(e => e !== remote);
    }
  }

  handlePeerUpdate(data) {
    let remote = this.remotePlayers.get(data.socketId);
    if (!remote) {
      remote = this.game.createRemoteEntity(data.socketId, data.name, data.hue);
      this.remotePlayers.set(data.socketId, remote);
    }

    remote.alive = true;
    remote.targetX = data.x;
    remote.targetY = data.y;
    remote.targetAngle = data.angle;
    remote.speed = data.speed || BASE_SPEED;
    remote.boosting = !!data.boosting;
    remote.name = data.name || remote.name;
    remote.hue = data.hue !== undefined ? data.hue : remote.hue;

    // Synchronize segments
    if (data.segments && Array.isArray(data.segments)) {
      remote.remoteSegments = data.segments;
    }
  }

  // ── Broadcast Local Player State ──
  broadcastState(now) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    if (now - this.lastBroadcast < this.broadcastInterval) return;
    this.lastBroadcast = now;

    const p = this.game.player;
    if (!p || !p.alive || !p.segments.length) return;

    const head = p.segments[0];
    const segs = p.segments.map(s => ({ value: s.value, x: Math.round(s.x), y: Math.round(s.y) }));

    this.socket.emit('player-update', {
      x: Math.round(head.x),
      y: Math.round(head.y),
      angle: Number(p.angle.toFixed(3)),
      speed: Math.round(p.speed),
      boosting: p.boosting,
      segments: segs,
      score: this.game.entityScore(p),
      name: p.name,
      hue: p.hue,
    });
  }

  broadcastCubeConsumed(cubeId) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    this.socket.emit('cube-consumed', { cubeId });
  }

  broadcastKill(victimSocketId, points) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    this.socket.emit('player-eliminated', { victimSocketId, points });
  }

  leave() {
    if (this.socket && this.connected) {
      this.socket.emit('leave-room');
    }
    this.roomCode = null;
    this.remotePlayers.clear();
    const roomBadge = document.getElementById('mp-room-badge');
    if (roomBadge) roomBadge.classList.add('hidden');
  }
}
