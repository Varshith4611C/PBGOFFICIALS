/* ============================================
   PBG Business Board Game — Multiplayer Client
   Socket.IO client for online multiplayer
   ============================================ */

class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this.connected = false;
  }

  connect() {
    if (this.socket) return;

    this.socket = io('/game-business', {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[MP] Connected to game server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      showToast('Disconnected from server', 'error');
    });

    this.socket.on('error-msg', ({ message }) => {
      showToast(message, 'error');
    });

    // Room events
    this.socket.on('room-created', ({ roomCode, player }) => {
      this.roomCode = roomCode;
      this.playerId = player.id;
      this.isHost = true;
      this.showWaitingRoom(roomCode);
    });

    this.socket.on('room-joined', ({ roomCode, player, players }) => {
      this.roomCode = roomCode;
      this.playerId = player.id;
      this.isHost = false;
      this.showWaitingRoom(roomCode);
      this.updatePlayersList(players);
    });

    this.socket.on('players-update', ({ players }) => {
      this.updatePlayersList(players);
    });

    this.socket.on('game-started', ({ players, currentPlayerIndex }) => {
      this.startMultiplayerGame(players, currentPlayerIndex);
    });

    // Game events
    this.socket.on('game-action', (action) => {
      if (game && game.isMultiplayer) {
        this.handleRemoteAction(action);
      }
    });

    this.socket.on('state-update', (state) => {
      if (game && game.isMultiplayer && !this.isHost) {
        // Sync state from host if needed
      }
    });

    this.socket.on('player-left', ({ playerId: leftId }) => {
      showToast(`Player ${leftId + 1} disconnected`, 'warning');
      if (game && game.isMultiplayer) {
        const player = game.players.find(p => p.id === leftId);
        if (player && !player.isBankrupt) {
          player.isAI = true;
          player.name += ' (AI)';
          game.log(`🤖 ${player.name} disconnected. AI takes over.`);
          game.updateUI();
        }
      }
    });
  }

  createRoom(playerName) {
    if (!this.connected) {
      showToast('Connecting to server...', 'info');
      this.connect();
      setTimeout(() => this.socket?.emit('create-room', { playerName }), 500);
      return;
    }
    this.socket.emit('create-room', { playerName });
  }

  joinRoom(roomCode, playerName) {
    if (!this.connected) {
      showToast('Connecting to server...', 'info');
      this.connect();
      setTimeout(() => this.socket?.emit('join-room', { roomCode, playerName }), 500);
      return;
    }
    this.socket.emit('join-room', { roomCode, playerName });
  }

  leaveRoom() {
    if (this.socket) {
      this.socket.emit('leave-room');
    }
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
  }

  startGame() {
    if (!this.isHost) return;
    this.socket.emit('start-game');
  }

  sendAction(action) {
    if (this.socket && this.connected) {
      this.socket.emit('game-action', action);
    }
  }

  showWaitingRoom(roomCode) {
    document.getElementById('lobby-join-section').style.display = 'none';
    document.getElementById('lobby-waiting-section').style.display = 'block';
    document.getElementById('room-code-show').textContent = roomCode;

    const startBtn = document.getElementById('btn-lobby-start');
    startBtn.disabled = !this.isHost;
    startBtn.innerHTML = this.isHost ? '<i class="fas fa-play"></i> Start Game' : 'Waiting for host...';
  }

  updatePlayersList(players) {
    const list = document.getElementById('lobby-players');
    if (!list) return;
    list.innerHTML = players.map((p, i) => `
      <li>
        <div class="player-dot" style="background: ${PLAYER_TOKENS[i % PLAYER_TOKENS.length]?.color || '#64748b'}"></div>
        <span class="player-name">${p.name}</span>
        ${p.isHost ? '<span class="player-badge">HOST</span>' : ''}
      </li>
    `).join('');

    if (this.isHost) {
      document.getElementById('btn-lobby-start').disabled = players.length < 2;
    }
  }

  startMultiplayerGame(players, currentPlayerIndex) {
    game = new Game();
    game.isMultiplayer = true;
    game.players = players.map((p, i) => ({
      ...p,
      ...PLAYER_TOKENS[i % PLAYER_TOKENS.length],
      name: p.name,
      isAI: i !== this.playerId,
      cash: STARTING_CASH,
      position: 0,
      isBankrupt: false,
      inJail: false,
      jailTurns: 0
    }));

    game.players[this.playerId].isAI = false;

    // Initialize properties
    game.properties = {};
    BOARD_SPACES.forEach(s => {
      if (s.type === 'property' || s.type === 'station' || s.type === 'utility') {
        game.properties[s.id] = { owner: null, houses: 0, mortgaged: false };
      }
    });

    game.currentPlayerIndex = currentPlayerIndex;
    game.turnPhase = 'roll';
    game.ai = new AIPlayer('normal');

    game.renderBoard();
    game.renderPlayersBar();
    game.updateUI();
    showScreen('game-screen');
    game.log(`🌐 Multiplayer game started! ${game.players.length} players in room.`);
  }

  handleRemoteAction(action) {
    switch (action.type) {
      case 'roll':
        game.lastDice = action.dice;
        break;
      case 'buy':
        game.buyProperty(game.players[action.playerId], BOARD_SPACES[action.spaceId]);
        break;
      case 'build':
        game.buildHouse(game.players[action.playerId], action.spaceId);
        break;
      case 'endTurn':
        game.endTurn();
        break;
    }
    game.updateUI();
  }
}

let mpClient = null;

document.addEventListener('DOMContentLoaded', () => {
  const joinBtn = document.getElementById('btn-lobby-join');
  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      if (!mpClient) {
        mpClient = new MultiplayerClient();
        mpClient.connect();
      }

      const name = document.getElementById('mp-player-name').value.trim() || 'Guddu';
      const code = document.getElementById('room-code-input').value.trim().toUpperCase();

      setTimeout(() => {
        if (code) {
          mpClient.joinRoom(code, name);
        } else {
          mpClient.createRoom(name);
        }
      }, 300);
    });
  }

  const leaveBtn = document.getElementById('btn-lobby-leave');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      if (mpClient) mpClient.leaveRoom();
      document.getElementById('lobby-join-section').style.display = 'block';
      document.getElementById('lobby-waiting-section').style.display = 'none';
      showScreen('landing-screen');
    });
  }

  const startBtn = document.getElementById('btn-lobby-start');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (mpClient && mpClient.isHost) {
        mpClient.startGame();
      }
    });
  }
});
