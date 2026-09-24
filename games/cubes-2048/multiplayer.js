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
    this.remoteBots = new Map(); // botId -> remoteBotEntity

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
        this.remoteBots.clear();
        this.onRoomJoined(roomCode, isHost);
        this.showToast(`Private room created: ${roomCode}`, 'success');
      });

      this.socket.on('joined-room', ({ roomCode, player, existingPlayers, existingBots, isHost }) => {
        this.roomCode = roomCode;
        this.isHost = isHost;
        this.playerId = player.socketId;
        this.remotePlayers.clear();
        this.remoteBots.clear();

        // 1. FIRST start game arena so game is running and player is spawned
        this.onRoomJoined(roomCode, isHost);

        // 2. THEN register all existing players so they stay in this.game.entities
        if (existingPlayers && existingPlayers.length) {
          for (const ep of existingPlayers) {
            this.registerRemotePlayer(ep);
          }
        }

        // 3. If guest, sync existing bots spawned by host
        if (!isHost && existingBots && existingBots.length) {
          this.syncRemoteBots(existingBots);
        }

        this.showToast(`Joined online room: ${roomCode}`, 'success');
      });

      this.socket.on('player-joined', ({ player }) => {
        this.registerRemotePlayer(player);
        this.showToast(`🌐 ${player.name} joined the arena!`, 'info');
        // Immediately broadcast our state so the new player gets our coordinates right away
        this.broadcastState(performance.now(), true);
      });

      this.socket.on('player-left', ({ socketId, playerName }) => {
        this.removeRemotePlayer(socketId);
        this.showToast(`🚪 ${playerName} left the arena`, 'info');
      });

      // ── Host Migration ──
      this.socket.on('host-changed', ({ hostId }) => {
        if (hostId === this.playerId) {
          this.isHost = true;
          if (this.game) {
            this.game.isHost = true;
            // Promote remote bots to locally simulated bots
            if (this.game.entities) {
              for (const e of this.game.entities) {
                if (e.isMultiplayerBot) {
                  e.isRemoteBot = false;
                }
              }
            }
          }
          this.showToast('👑 You are now the arena host!', 'info');
        }
      });

      // ── Real-time Peer Update ──
      this.socket.on('peer-update', (data) => {
        this.handlePeerUpdate(data);
      });

      // ── Host Bots State Sync (for guests) ──
      this.socket.on('bots-update', ({ bots }) => {
        if (!this.isHost && bots) {
          this.syncRemoteBots(bots);
        }
      });

      // ── Bot Removed ──
      this.socket.on('bot-removed', ({ botId }) => {
        this.removeRemoteBot(botId);
      });

      // ── Free Cube Consumed By Other Player ──
      this.socket.on('cube-removed', ({ cubeId }) => {
        if (this.game && this.game.freeCubes) {
          const c = this.game.freeCubes.find(fc => fc.id === cubeId);
          if (c) c.alive = false;
        }
      });

      // ── Elimination Broadcast ──
      this.socket.on('player-death', ({ killerName, victimName, victimId, isBot, points }) => {
        if (victimId === this.playerId) {
          // Local player was eliminated
          if (this.game && this.game.player && this.game.player.alive) {
            this.game.player.alive = false;
            this.game.gameOver(isBot ? `Defeated by bot ${killerName}!` : `Consumed by ${killerName}!`);
          }
        } else {
          this.removeRemotePlayer(victimId);
          const vName = victimName || 'A player';
          if (isBot) {
            this.showToast(`💥 ${vName} was eliminated by ${killerName}!`, 'warning');
          } else {
            this.showToast(`💥 ${killerName} eliminated ${vName}!`, 'warning');
          }
        }
      });

      // ── Tail Cut Event ──
      this.socket.on('player-was-cut', ({ cutIndex, cutterName }) => {
        if (!this.game || !this.game.player || !this.game.player.alive) return;
        const p = this.game.player;
        if (p.segments && cutIndex < p.segments.length) {
          const cut = p.segments.splice(cutIndex);
          if (cut.length > 0) {
            this.game.spawnParticles(cut[0].x, cut[0].y, '#f87171', 14);
            if (this.game.sound) this.game.sound.divide();
            this.showToast(`✂️ Tail cut by ${cutterName}! (-${cut.length} cubes)`, 'warning');
            p.currentAnim = null;
            this.game.organizeAndMergeInstant(p);
            this.broadcastState(performance.now(), true);
          }
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

    let remote = this.remotePlayers.get(info.socketId);
    if (!remote || !this.game.entities.includes(remote)) {
      remote = this.game.createRemoteEntity(
        info.socketId,
        info.name || 'Online Player',
        info.hue || 180,
        info.x,
        info.y,
        info.segments
      );
      this.remotePlayers.set(info.socketId, remote);
    }

    remote.alive = true;
    if (info.x !== undefined && info.y !== undefined) {
      remote.targetX = info.x;
      remote.targetY = info.y;
      remote.targetAngle = info.angle || 0;
      if (remote.segments && remote.segments[0]) {
        remote.segments[0].x = info.x;
        remote.segments[0].y = info.y;
      }
    }
    if (info.segments && Array.isArray(info.segments)) {
      remote.remoteSegments = info.segments;
    }
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
    if (!data || !data.socketId || data.socketId === this.playerId) return;

    let remote = this.remotePlayers.get(data.socketId);
    if (!remote || !this.game.entities.includes(remote)) {
      remote = this.game.createRemoteEntity(
        data.socketId,
        data.name,
        data.hue,
        data.x,
        data.y,
        data.segments
      );
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

  // ── Broadcast Local Player State & Host Bots ──
  broadcastState(now, force = false) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    if (!force && (now - this.lastBroadcast < this.broadcastInterval)) return;
    this.lastBroadcast = now;

    const p = this.game.player;
    if (p && p.alive && p.segments.length) {
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

    // If host, also broadcast multiplayer bots states to all guests
    if (this.isHost && this.game && this.game.entities) {
      const botStates = [];
      for (const e of this.game.entities) {
        if (e.isMultiplayerBot && e.alive && e.segments && e.segments.length) {
          botStates.push({
            botId: e.botId,
            name: e.name,
            hue: e.hue,
            x: Math.round(e.segments[0].x),
            y: Math.round(e.segments[0].y),
            angle: Number(e.angle.toFixed(3)),
            speed: Math.round(e.speed),
            boosting: e.boosting,
            segments: e.segments.map(s => ({ value: s.value, x: Math.round(s.x), y: Math.round(s.y) })),
            score: this.game.entityScore(e),
          });
        }
      }
      this.socket.emit('bots-update', { bots: botStates });
    }
  }

  // ── Sync Remote Bots (for guests) ──
  syncRemoteBots(bots) {
    if (!bots || !Array.isArray(bots) || this.isHost) return;

    const activeBotIds = new Set();
    for (const b of bots) {
      if (!b || !b.botId) continue;
      activeBotIds.add(b.botId);

      let botEnt = this.remoteBots.get(b.botId);
      if (!botEnt || !this.game.entities.includes(botEnt)) {
        botEnt = this.game.createRemoteBotEntity(
          b.botId,
          b.name,
          b.hue,
          b.x,
          b.y,
          b.segments
        );
        this.remoteBots.set(b.botId, botEnt);
      }

      botEnt.alive = true;
      botEnt.targetX = b.x;
      botEnt.targetY = b.y;
      botEnt.targetAngle = b.angle;
      botEnt.speed = b.speed || BASE_SPEED;
      botEnt.boosting = !!b.boosting;
      botEnt.name = b.name || botEnt.name;
      botEnt.hue = b.hue !== undefined ? b.hue : botEnt.hue;

      if (b.segments && Array.isArray(b.segments)) {
        botEnt.remoteSegments = b.segments;
      }
    }

    // Remove any bots not in the incoming active list
    for (const [id] of this.remoteBots.entries()) {
      if (!activeBotIds.has(id)) {
        this.removeRemoteBot(id);
      }
    }
  }

  removeRemoteBot(botId) {
    const b = this.remoteBots.get(botId);
    if (b) {
      b.alive = false;
      this.remoteBots.delete(botId);
      if (this.game) {
        this.game.entities = this.game.entities.filter(e => e !== b);
      }
    }
  }

  broadcastBotKilled(botId, botName, killerName) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    this.socket.emit('bot-killed', {
      botId,
      botName,
      killerName: killerName || (this.game && this.game.player ? this.game.player.name : 'Player'),
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

  broadcastDiedToBot(botName) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    this.socket.emit('player-death-event', {
      killerName: botName,
      isBot: true,
      victimSocketId: this.playerId,
    });
  }

  broadcastDiedToPlayer(killerSocketId, killerName) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    this.socket.emit('player-death-event', {
      killerName: killerName,
      isBot: false,
      victimSocketId: this.playerId,
    });
  }

  broadcastPlayerCut(victimSocketId, cutIndex) {
    if (!this.socket || !this.connected || !this.roomCode) return;
    this.socket.emit('player-cut', {
      victimSocketId,
      cutIndex,
    });
  }

  leave() {
    if (this.socket && this.connected) {
      this.socket.emit('leave-room');
    }
    this.roomCode = null;
    this.remotePlayers.clear();
    this.remoteBots.clear();
    const roomBadge = document.getElementById('mp-room-badge');
    if (roomBadge) roomBadge.classList.add('hidden');
  }
}
