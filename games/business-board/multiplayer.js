/* ============================================
   PBG Business Board Game — Multiplayer Client
   Real-time Online Multiplayer Engine (Socket.IO)
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
      console.log('[MP] Connected to game server. Socket ID:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      showToast('Disconnected from server', 'error');
    });

    this.socket.on('error-msg', ({ message }) => {
      showToast(message, 'error');
    });

    // ── Room Events ──
    this.socket.on('room-created', ({ roomCode, player, players }) => {
      this.roomCode = roomCode;
      this.playerId = player.id;
      this.isHost = true;
      this.showWaitingRoom(roomCode);
      this.updatePlayersList(players || [player]);
      showToast(`Room created! Code: ${roomCode}`, 'success');
    });

    this.socket.on('room-joined', ({ roomCode, player, players }) => {
      this.roomCode = roomCode;
      this.playerId = player.id;
      this.isHost = false;
      this.showWaitingRoom(roomCode);
      this.updatePlayersList(players);
      showToast(`Joined Room ${roomCode}!`, 'success');
    });

    this.socket.on('players-update', ({ players }) => {
      this.updatePlayersList(players);
    });

    this.socket.on('game-started', ({ players, currentPlayerIndex }) => {
      this.startMultiplayerGame(players, currentPlayerIndex);
    });

    // ── Game Action Synchronization ──
    this.socket.on('remote-action', (action) => {
      if (game && game.isMultiplayer) {
        this.handleRemoteAction(action);
      }
    });

    // ── Chat Messages ──
    this.socket.on('chat-message', (data) => {
      if (game) {
        game.receiveChatMessage(data);
      }
    });

    // ── Voice Chat Status ──
    this.socket.on('voice-status-update', (data) => {
      if (voiceManager) {
        voiceManager.handleRemoteVoiceStatus(data.playerId, data.isSpeaking, data.isMuted);
      }
    });

    this.socket.on('player-left', ({ playerId: leftId }) => {
      if (game && game.isMultiplayer) {
        const player = game.players.find(p => p.id === leftId);
        if (player && !player.isBankrupt) {
          player.isAI = true;
          player.isRemote = false;
          player.name += ' (Bot)';
          game.log(`🤖 <strong>${player.name}</strong> disconnected. Bot substitute activated.`);
          game.updateUI();
          if (game.currentPlayerIndex === leftId) {
            game.processAITurn();
          }
        }
      }
    });
  }

  createRoom(playerName) {
    this.connect();
    if (!this.connected) {
      setTimeout(() => this.socket?.emit('create-room', { playerName }), 400);
      return;
    }
    this.socket.emit('create-room', { playerName });
  }

  joinRoom(roomCode, playerName) {
    this.connect();
    if (!this.connected) {
      setTimeout(() => this.socket?.emit('join-room', { roomCode, playerName }), 400);
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

  sendChat(text, emoji) {
    if (this.socket && this.connected) {
      this.socket.emit('send-chat', { text, emoji });
    }
  }

  sendVoiceStatus(isSpeaking, isMuted) {
    if (this.socket && this.connected) {
      this.socket.emit('voice-signal', { isSpeaking, isMuted });
    }
  }

  showWaitingRoom(roomCode) {
    document.getElementById('lobby-join-section').style.display = 'none';
    document.getElementById('lobby-waiting-section').style.display = 'block';
    document.getElementById('room-code-show').textContent = roomCode;

    const startBtn = document.getElementById('btn-lobby-start');
    startBtn.disabled = !this.isHost;
    startBtn.innerHTML = this.isHost ? '<i class="fas fa-play"></i> Start Game' : 'Waiting for host to start...';
  }

  updatePlayersList(players) {
    const list = document.getElementById('lobby-players');
    if (!list) return;

    list.innerHTML = players.map((p, i) => {
      const preset = PLAYER_TOKENS[i % PLAYER_TOKENS.length];
      return `
        <li>
          <div class="player-dot" style="background: ${preset.color}"></div>
          <span class="player-name">${p.name} ${p.id === this.playerId ? '<strong>(You)</strong>' : ''}</span>
          ${p.isHost ? '<span class="player-badge">HOST</span>' : ''}
        </li>
      `;
    }).join('');

    if (this.isHost) {
      const startBtn = document.getElementById('btn-lobby-start');
      startBtn.disabled = players.length < 2;
      startBtn.innerHTML = players.length < 2
        ? 'Need at least 2 players to start'
        : '<i class="fas fa-play"></i> Start Game';
    }
  }

  startMultiplayerGame(playersData, currentPlayerIndex) {
    game = new Game();
    game.isMultiplayer = true;
    game.myPlayerId = this.playerId;

    // Map all human players (NONE are AI by default!)
    game.players = playersData.map((p, i) => {
      const preset = PLAYER_TOKENS[i % PLAYER_TOKENS.length];
      return {
        ...preset,
        id: i,
        name: p.name,
        isAI: false, // REAL HUMAN PLAYER!
        isRemote: i !== this.playerId,
        cash: STARTING_CASH,
        position: 0,
        isBankrupt: false,
        inJail: false,
        jailTurns: 0
      };
    });

    // Initialize properties
    game.properties = {};
    BOARD_SPACES.forEach(s => {
      if (s.type === 'property' || s.type === 'station' || s.type === 'utility') {
        game.properties[s.id] = {
          owner: null,
          houses: 0,
          mortgaged: false
        };
      }
    });

    game.currentPlayerIndex = currentPlayerIndex || 0;
    game.turnPhase = 'roll';
    game.ai = new AIPlayer('normal'); // Only for disconnected fallbacks

    game.renderBoard();
    game.renderPlayersBar();
    game.updateUI();
    showScreen('game-screen');

    const me = game.players[this.playerId];
    game.log(`🌐 Online Multiplayer Game Started! You are <strong>${me.name}</strong> (${me.emoji}).`);

    if (game.currentPlayerIndex === this.playerId) {
      showToast("It's your turn to roll!", 'success');
    } else {
      const active = game.players[game.currentPlayerIndex];
      showToast(`Waiting for ${active.name}'s turn...`, 'info');
    }
  }

  async handleRemoteAction(action) {
    // If we were the sender of this action, ignore (already processed locally)
    if (action.senderId === this.playerId) return;

    const player = game.players[action.senderId];
    if (!player) return;

    switch (action.type) {
      case 'roll':
        game.lastDice = action.dice;
        await game.animateRemoteRoll(player, action.dice[0], action.dice[1], action.isDoubles);
        break;

      case 'buy':
        game.buyProperty(player, BOARD_SPACES[action.spaceId]);
        game.turnPhase = 'done';
        game.updateUI();
        break;

      case 'passBuy':
        game.log(`❌ <strong>${player.name}</strong> passed on buying ${BOARD_SPACES[action.spaceId]?.name}.`);
        game.turnPhase = 'done';
        game.updateUI();
        break;

      case 'build':
        game.buildHouse(player, action.spaceId);
        break;

      case 'sell':
        game.sellHouse(action.spaceId);
        break;

      case 'mortgage':
        game.mortgageProperty(action.spaceId);
        break;

      case 'unmortgage':
        game.unmortgageProperty(action.spaceId);
        break;

      case 'payBail':
        await game.payBailAndMove(action.diceSum);
        break;

      case 'stayJail':
        game.stayInJail();
        break;

      case 'tradeOffer':
        if (action.toPlayerId === this.playerId) {
          game.showIncomingTradeModal(action);
        }
        break;

      case 'tradeAccepted':
        game.executeTrade(action.fromPlayerId, action.toPlayerId, action.offeredPropIds, action.offeredCash, action.requestedPropIds, action.requestedCash, false);
        break;

      case 'tradeDeclined':
        if (action.fromPlayerId === this.playerId) {
          showToast(`❌ ${player.name} declined your trade offer.`, 'warning');
          game.log(`❌ <strong>${player.name}</strong> declined the trade proposal.`);
        }
        break;

      case 'endTurn':
        game.endTurn(true); // true = remote call
        break;
    }
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
