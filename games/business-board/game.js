/* ============================================
   PBG Business Board Game — Core Game Engine
   Classic Indian Business Board (40 spaces)
   Full Single Player (vs AI) & Real Multiplayer
   ============================================ */

let game = null;

// ══════════════════════════════════════════
// UI HELPER FUNCTIONS
// ══════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = html;
  overlay.classList.remove('hidden');
}

function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ══════════════════════════════════════════
// INITIALIZATION & EVENT LISTENERS
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  showScreen('landing-screen');

  // Audio Toggle Handlers (Landing & In-game)
  const sfxBtns = [document.getElementById('btn-toggle-sfx'), document.getElementById('btn-ingame-sfx')];
  const musicBtns = [document.getElementById('btn-toggle-music'), document.getElementById('btn-ingame-music')];

  const updateAudioButtons = () => {
    sfxBtns.forEach(btn => {
      if (btn) {
        btn.classList.toggle('active', sound.sfxEnabled);
        btn.innerHTML = `<i class="fas fa-volume-${sound.sfxEnabled ? 'high' : 'xmark'}"></i> <span>SFX ${sound.sfxEnabled ? 'ON' : 'OFF'}</span>`;
      }
    });

    musicBtns.forEach(btn => {
      if (btn) {
        btn.classList.toggle('active', sound.musicPlaying);
        btn.innerHTML = `<i class="fas fa-music"></i> <span>Music ${sound.musicPlaying ? 'ON' : 'OFF'}</span>`;
      }
    });
  };

  sfxBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      sound.toggleSfx();
      sound.playClick();
      updateAudioButtons();
      showToast(`Sound Effects: ${sound.sfxEnabled ? 'ON' : 'OFF'}`, 'info');
    });
  });

  musicBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      sound.toggleMusic();
      sound.playClick();
      updateAudioButtons();
      showToast(`Background Music: ${sound.musicPlaying ? 'ON' : 'OFF'}`, 'info');
    });
  });

  // Voice Chat Button Handler
  const voiceBtn = document.getElementById('btn-ingame-voice');
  voiceBtn?.addEventListener('click', async () => {
    sound.playClick();
    const isLive = await voiceManager.toggleMic();
    voiceBtn.classList.toggle('active', isLive);
    voiceBtn.innerHTML = `<i class="fas fa-microphone${isLive ? '' : '-slash'}"></i> <span>Voice ${isLive ? 'ON' : 'OFF'}</span>`;
  });

  updateAudioButtons();

  // Mode Selection
  document.getElementById('btn-singleplayer')?.addEventListener('click', () => { sound.playClick(); showScreen('setup-screen'); });
  document.getElementById('btn-multiplayer')?.addEventListener('click', () => { sound.playClick(); showScreen('lobby-screen'); });
  document.getElementById('btn-setup-back')?.addEventListener('click', () => { sound.playClick(); showScreen('landing-screen'); });
  document.getElementById('btn-lobby-back')?.addEventListener('click', () => { sound.playClick(); showScreen('landing-screen'); });

  // Start Single Player Game
  document.getElementById('btn-start-game')?.addEventListener('click', () => {
    sound.playClick();
    const playerName = document.getElementById('player-name').value.trim() || 'Guddu';
    const aiCount = parseInt(document.getElementById('ai-count').value, 10) || 3;
    const aiDifficulty = document.getElementById('ai-difficulty').value || 'normal';
    startSinglePlayerGame(playerName, aiCount, aiDifficulty);
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (!game || game.gameOver) return;
    if (e.code === 'Space' && game.turnPhase === 'roll' && game.isMyTurn) {
      e.preventDefault();
      game.rollDice();
    } else if (e.code === 'Enter' && game.turnPhase === 'done' && game.isMyTurn) {
      e.preventDefault();
      game.endTurn();
    }
  });

  window.addEventListener('resize', () => {
    if (game && !game.gameOver) {
      game.renderTokens();
    }
  });
});

function startSinglePlayerGame(name, aiCount, difficulty) {
  game = new Game();
  game.isMultiplayer = false;
  game.myPlayerId = 0;

  const playerList = [{ ...PLAYER_TOKENS[0], name, isAI: false, isRemote: false }];

  for (let i = 0; i < aiCount; i++) {
    const preset = PLAYER_TOKENS[(i + 1) % PLAYER_TOKENS.length];
    playerList.push({
      ...preset,
      id: i + 1,
      name: `${preset.name} (Bot)`,
      isAI: true,
      isRemote: false
    });
  }

  game.init(playerList, difficulty);
  showScreen('game-screen');
}

// ══════════════════════════════════════════
// GAME CLASS — CORE STATE MACHINE
// ══════════════════════════════════════════
class Game {
  constructor() {
    this.players = [];
    this.properties = {};
    this.currentPlayerIndex = 0;
    this.turnPhase = 'roll'; // 'roll', 'rolling', 'action', 'done'
    this.lastDice = [1, 1];
    this.doublesCount = 0;
    this.gameOver = false;
    this.isMultiplayer = false;
    this.myPlayerId = 0;
    this.ai = null;
    this.logEntries = [];
    this.turnNumber = 1;
    this._cardResolve = null;
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  get activePlayers() {
    return this.players.filter(p => !p.isBankrupt);
  }

  get isMyTurn() {
    if (!this.isMultiplayer) {
      return !this.currentPlayer.isAI;
    }
    return this.currentPlayerIndex === this.myPlayerId;
  }

  init(playerConfigs, aiDifficulty) {
    this.players = playerConfigs.map((p, i) => ({
      ...p,
      id: i,
      cash: STARTING_CASH,
      position: 0,
      isBankrupt: false,
      inJail: false,
      jailTurns: 0
    }));

    // Initialize 40 properties
    this.properties = {};
    BOARD_SPACES.forEach(space => {
      if (space.type === 'property' || space.type === 'station' || space.type === 'utility') {
        this.properties[space.id] = {
          owner: null,
          houses: 0,
          mortgaged: false
        };
      }
    });

    this.ai = new AIPlayer(aiDifficulty);
    this.turnNumber = 1;
    this.turnPhase = 'roll';
    this.currentPlayerIndex = 0;
    this.doublesCount = 0;

    this.renderBoard();
    this.renderPlayersBar();
    this.updateUI();

    this.log(`🎮 Game started with ${this.players.length} players. Good luck!`);
    if (this.currentPlayer.isAI) {
      this.processAITurn();
    }
  }

  // ══════════════════════════════════════════
  // BOARD RENDERING — 11×11 CSS GRID
  // ══════════════════════════════════════════
  renderBoard() {
    const board = document.getElementById('board');
    if (!board) return;
    board.innerHTML = '';

    // 1. Render all 40 spaces
    BOARD_SPACES.forEach(space => {
      const pos = GRID_POSITIONS[space.id];
      const side = SPACE_SIDES[space.id];

      const spaceEl = document.createElement('div');
      spaceEl.className = `space ${space.type === 'corner' ? 'corner' : ''} ${space.type !== 'property' ? 'special-space' : ''}`;
      spaceEl.id = `space-${space.id}`;
      spaceEl.style.gridRow = pos.row;
      spaceEl.style.gridColumn = pos.col;
      spaceEl.dataset.side = side;
      spaceEl.dataset.spaceId = space.id;
      spaceEl.addEventListener('click', () => this.showSpaceInfo(space.id));

      // Property Color Header Bar
      if (space.group && COLOR_GROUPS[space.group]) {
        spaceEl.style.setProperty('--space-color', COLOR_GROUPS[space.group].color);
        spaceEl.innerHTML += `<div class="space-color-bar"></div>`;
      }

      // Houses / Hotel container
      if (space.type === 'property') {
        spaceEl.innerHTML += `<div class="space-buildings" id="buildings-${space.id}"></div>`;
      }

      // Space text content
      let priceLabel = '';
      if (space.price) priceLabel = `<span class="space-price">${CURRENCY} ${space.price}</span>`;
      else if (space.amount) priceLabel = `<span class="space-price">PAY ${CURRENCY} ${space.amount}</span>`;

      spaceEl.innerHTML += `
        <div class="space-content">
          <span class="space-icon">${space.icon}</span>
          <span class="space-name">${space.name}</span>
          ${priceLabel}
        </div>
      `;

      board.appendChild(spaceEl);
    });

    // 2. Render Board Center matching the image
    const center = document.createElement('div');
    center.className = 'board-center';
    center.id = 'board-center';
    center.innerHTML = `
      <!-- Top "VS" Badge -->
      <div class="center-vs-badge">VS</div>

      <!-- Top-Left Deck: Community Chest -->
      <div class="deck-card deck-community" onclick="showToast('Community Chest deck', 'info')">
        <span>📦</span> COMMUNITY CHEST
      </div>

      <!-- Center Handshake Graphic -->
      <div class="center-handshake">🤝</div>

      <!-- Bottom-Right Deck: Chance -->
      <div class="deck-card deck-chance" onclick="showToast('Chance deck', 'info')">
        <span>📣</span> CHANCE
      </div>

      <!-- Dice & Actions Area -->
      <div class="center-interactive-area">
        <div class="dice-container">
          <div class="die" id="die-1">1</div>
          <div class="die" id="die-2">1</div>
        </div>
        <div class="center-turn-status" id="center-status">Roll the dice to begin</div>
        <button class="btn-center-roll" id="btn-roll" onclick="game.rollDice()">🎲 ROLL DICE</button>
        <button class="btn-center-end" id="btn-end" onclick="game.endTurn()">END TURN ➡️</button>
      </div>
    `;

    board.appendChild(center);
  }

  // ══════════════════════════════════════════
  // PLAYERS STATUS BAR RENDERING
  // ══════════════════════════════════════════
  renderPlayersBar() {
    const bar = document.getElementById('players-panel');
    if (!bar) return;
    bar.innerHTML = '';

    this.players.forEach(p => {
      const card = document.createElement('div');
      card.className = `player-status-card ${p.isBankrupt ? 'bankrupt' : ''}`;
      card.id = `player-status-${p.id}`;
      card.style.setProperty('--card-player-color', p.color);
      card.innerHTML = `
        <div class="player-avatar-wrap">
          <img src="${p.avatar}" class="player-avatar-img" alt="${p.name}" />
          <div class="player-pin-badge" style="background:${p.color}" title="${p.name}'s token">
            <i class="fa-solid ${p.tokenIcon || 'fa-chess-pawn'}" style="font-size:7px; color:white;"></i>
          </div>
        </div>
        <div class="player-status-info">
          <div class="player-name-label">
            ${p.name} <span style="font-size:0.75rem">${p.tokenSymbol || '♟'}</span> ${this.isMultiplayer && p.id === this.myPlayerId ? '<strong>(You)</strong>' : ''}
          </div>
          <div class="player-cash-pill">
            <span class="money-icon">💵</span>
            <span id="cash-val-${p.id}">${CURRENCY} ${p.cash}</span>
          </div>
        </div>
      `;
      bar.appendChild(card);
    });
  }

  // ══════════════════════════════════════════
  // UI UPDATE — STATE SYNC
  // ══════════════════════════════════════════
  updateUI() {
    const player = this.currentPlayer;
    if (!player) return;

    const statusEl = document.getElementById('center-status');
    const rollBtn = document.getElementById('btn-roll');
    const endBtn = document.getElementById('btn-end');

    if (statusEl) {
      if (player.inJail) {
        statusEl.textContent = `${player.name} is in Jail (Turn ${player.jailTurns + 1}/${MAX_JAIL_TURNS})`;
      } else if (this.isMyTurn) {
        statusEl.textContent = this.turnPhase === 'roll' ? 'Your turn — Roll the dice!' : 'Your move is complete — End turn.';
      } else {
        statusEl.textContent = `Waiting for ${player.name}'s move...`;
      }
    }

    if (rollBtn) {
      rollBtn.disabled = this.turnPhase !== 'roll' || !this.isMyTurn;
      rollBtn.style.display = this.turnPhase === 'roll' ? 'block' : 'none';
      rollBtn.textContent = this.isMyTurn ? '🎲 ROLL DICE' : `⏳ WAITING FOR ${player.name.toUpperCase()}`;
    }

    if (endBtn) {
      endBtn.classList.toggle('visible', this.turnPhase === 'done' && this.isMyTurn);
    }

    // Top action bar buttons (Build, Sell, Mortgage, Trade) only enabled on my turn
    ['btn-bar-build', 'btn-bar-sell', 'btn-bar-mortgage', 'btn-bar-trade'].forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.style.opacity = (this.isMyTurn && !player.isBankrupt) ? '1' : '0.6';
      }
    });

    // Update active player highlight
    this.players.forEach(p => {
      const card = document.getElementById(`player-status-${p.id}`);
      if (card) {
        card.classList.toggle('active-turn', p.id === this.currentPlayerIndex);
        card.classList.toggle('bankrupt', p.isBankrupt);
      }
      const cashEl = document.getElementById(`cash-val-${p.id}`);
      if (cashEl) cashEl.textContent = `${CURRENCY} ${p.cash}`;
    });

    // Update board space owners & buildings
    BOARD_SPACES.forEach(space => {
      const prop = this.properties[space.id];
      if (!prop) return;
      const spaceEl = document.getElementById(`space-${space.id}`);
      if (!spaceEl) return;

      // Owner Pin Badge with token icon
      let ownerPin = spaceEl.querySelector('.space-owner-pin');
      if (prop.owner !== null) {
        const owner = this.players[prop.owner];
        if (!ownerPin) {
          ownerPin = document.createElement('div');
          ownerPin.className = 'space-owner-pin';
          spaceEl.appendChild(ownerPin);
        }
        ownerPin.style.background = owner.color;
        ownerPin.innerHTML = `<i class="fa-solid ${owner.tokenIcon || 'fa-chess-pawn'}" style="font-size:5px; color:white;"></i>`;
        ownerPin.title = `Owned by ${owner.name} (${owner.tokenSymbol || '♟'})${prop.mortgaged ? ' (Mortgaged)' : ''}`;
      } else if (ownerPin) {
        ownerPin.remove();
      }

      // Buildings
      if (space.type === 'property') {
        const bldEl = document.getElementById(`buildings-${space.id}`);
        if (bldEl) {
          bldEl.innerHTML = '';
          if (prop.houses === 5) {
            bldEl.innerHTML = `<div class="building-hotel" title="Hotel"></div>`;
          } else {
            for (let h = 0; h < prop.houses; h++) {
              bldEl.innerHTML += `<div class="building-house" title="House"></div>`;
            }
          }
        }
      }
    });

    // Render Pawns
    this.renderTokens();
  }

  // ══════════════════════════════════════════
  // TOKEN RENDERING ON BOARD (CHESS PAWNS & ICONS)
  // ══════════════════════════════════════════
  renderTokens() {
    document.querySelectorAll('.player-token').forEach(t => t.remove());

    const posGroups = {};
    this.activePlayers.forEach(p => {
      if (!posGroups[p.position]) posGroups[p.position] = [];
      posGroups[p.position].push(p);
    });

    const boardEl = document.getElementById('board');
    if (!boardEl) return;
    const boardRect = boardEl.getBoundingClientRect();

    Object.entries(posGroups).forEach(([posStr, playersAtPos]) => {
      const spaceEl = document.getElementById(`space-${posStr}`);
      if (!spaceEl) return;
      const rect = spaceEl.getBoundingClientRect();

      playersAtPos.forEach((p, idx) => {
        const token = document.createElement('div');
        token.className = `player-token ${p.id === this.currentPlayerIndex ? 'active-token' : ''}`;
        token.style.background = p.color;
        token.style.setProperty('--token-color', p.color);
        // Render sleek Chess Pawn / Token Icon instead of numbers
        token.innerHTML = `<i class="fa-solid ${p.tokenIcon || 'fa-chess-pawn'}"></i>`;
        token.title = `${p.name} (${p.tokenSymbol || '♟'})`;

        const count = playersAtPos.length;
        let offsetX = 0;
        let offsetY = 0;

        if (count === 2) {
          offsetX = idx === 0 ? -6 : 6;
        } else if (count >= 3) {
          offsetX = (idx % 2 === 0 ? -7 : 7);
          offsetY = (idx < 2 ? -7 : 7);
        }

        const left = rect.left - boardRect.left + (rect.width / 2) - 9 + offsetX;
        const top = rect.top - boardRect.top + (rect.height / 2) - 9 + offsetY;

        token.style.left = `${left}px`;
        token.style.top = `${top}px`;

        boardEl.appendChild(token);
      });
    });
  }

  // ══════════════════════════════════════════
  // DICE ROLLING & ANIMATION
  // ══════════════════════════════════════════
  async rollDice() {
    if (this.turnPhase !== 'roll' || this.gameOver || !this.isMyTurn) return;
    const player = this.currentPlayer;
    this.turnPhase = 'rolling';

    const die1 = document.getElementById('die-1');
    const die2 = document.getElementById('die-2');
    die1.classList.add('rolling');
    die2.classList.add('rolling');
    sound.playDiceRoll();

    for (let f = 0; f < 10; f++) {
      die1.textContent = Math.ceil(Math.random() * 6);
      die2.textContent = Math.ceil(Math.random() * 6);
      await delay(60);
    }

    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    this.lastDice = [d1, d2];
    die1.textContent = d1;
    die2.textContent = d2;
    die1.classList.remove('rolling');
    die2.classList.remove('rolling');

    const isDoubles = d1 === d2;
    const total = d1 + d2;
    this.log(`🎲 <strong>${player.name}</strong> rolled <strong>${d1} + ${d2} = ${total}</strong>${isDoubles ? ' (Doubles! 🎉)' : ''}`);

    // If online multiplayer, broadcast roll to peers
    if (this.isMultiplayer && mpClient) {
      mpClient.sendAction({
        type: 'roll',
        dice: [d1, d2],
        isDoubles,
        total
      });
    }

    // Jail check
    if (player.inJail) {
      await this.handleJailRoll(player, d1, d2, isDoubles);
      return;
    }

    // Three doubles = Go to Jail
    if (isDoubles) {
      this.doublesCount++;
      if (this.doublesCount >= 3) {
        this.log(`🚔 <strong>${player.name}</strong> rolled doubles 3 times in a row — Go directly to Jail!`);
        this.sendToJail(player);
        this.turnPhase = 'done';
        this.updateUI();
        if (player.isAI) await this.aiEndTurn();
        return;
      }
    } else {
      this.doublesCount = 0;
    }

    // Move player
    await this.movePlayer(player, total);

    // If doubles and not in jail, player rolls again
    if (isDoubles && !player.inJail && !this.gameOver) {
      this.log(`🎯 <strong>${player.name}</strong> gets another roll for doubles!`);
      this.turnPhase = 'roll';
      this.updateUI();
      if (player.isAI) await this.processAITurn();
    }
  }

  // ── Remote player roll animation ──
  async animateRemoteRoll(player, d1, d2, isDoubles) {
    this.turnPhase = 'rolling';

    const die1 = document.getElementById('die-1');
    const die2 = document.getElementById('die-2');
    die1.classList.add('rolling');
    die2.classList.add('rolling');
    sound.playDiceRoll();

    for (let f = 0; f < 8; f++) {
      die1.textContent = Math.ceil(Math.random() * 6);
      die2.textContent = Math.ceil(Math.random() * 6);
      await delay(50);
    }

    die1.textContent = d1;
    die2.textContent = d2;
    die1.classList.remove('rolling');
    die2.classList.remove('rolling');

    const total = d1 + d2;
    this.log(`🎲 <strong>${player.name}</strong> rolled <strong>${d1} + ${d2} = ${total}</strong>${isDoubles ? ' (Doubles!)' : ''}`);

    if (player.inJail) {
      if (isDoubles) {
        player.inJail = false;
        player.jailTurns = 0;
        this.log(`🔓 <strong>${player.name}</strong> rolled doubles and escaped Jail!`);
        await this.movePlayer(player, total, false);
      } else {
        player.jailTurns++;
        this.log(`🔒 <strong>${player.name}</strong> remains in Jail.`);
      }
      return;
    }

    await this.movePlayer(player, total, false);
  }

  // ══════════════════════════════════════════
  // MOVEMENT ALONG 40 SPACES
  // ══════════════════════════════════════════
  async movePlayer(player, steps, isLocalTurn = true) {
    const oldPos = player.position;
    const newPos = (oldPos + steps) % 40;

    // Play hop step sound
    sound.playTokenStep();

    // Check if passed GO
    if (newPos < oldPos && newPos !== 0) {
      player.cash += GO_SALARY;
      sound.playPassGo();
      this.log(`💵 <strong>${player.name}</strong> passed GO and collected ${CURRENCY} ${GO_SALARY}!`);
      this.showCashFloat(player, GO_SALARY);
    }

    player.position = newPos;
    this.updateUI();
    await delay(350);

    // Land on destination space
    await this.landOnSpace(player, newPos, isLocalTurn);
  }

  async moveToPosition(player, targetPos, collectGo = true, isLocalTurn = true) {
    const oldPos = player.position;

    if (collectGo && targetPos < oldPos && targetPos !== JAIL_POSITION) {
      player.cash += GO_SALARY;
      this.log(`💵 <strong>${player.name}</strong> passed GO and collected ${CURRENCY} ${GO_SALARY}!`);
      this.showCashFloat(player, GO_SALARY);
    }

    player.position = targetPos;
    this.updateUI();
    await delay(350);
    await this.landOnSpace(player, targetPos, isLocalTurn);
  }

  // ══════════════════════════════════════════
  // LAND ON SPACE HANDLER
  // ══════════════════════════════════════════
  async landOnSpace(player, spaceId, isLocalTurn = true) {
    const space = BOARD_SPACES[spaceId];
    this.log(`📍 <strong>${player.name}</strong> landed on <strong>${space.name}</strong>`);

    switch (space.type) {
      case 'property': await this.handleProperty(player, space, isLocalTurn); break;
      case 'station':  await this.handleStation(player, space, isLocalTurn); break;
      case 'utility':  await this.handleUtility(player, space, isLocalTurn); break;
      case 'chance':   await this.handleChance(player, isLocalTurn); break;
      case 'community':await this.handleCommunity(player, isLocalTurn); break;
      case 'tax':      await this.handleTax(player, space); break;
      case 'corner':   await this.handleCorner(player, space); break;
    }
  }

  // ── Property Space ──
  async handleProperty(player, space, isLocalTurn = true) {
    const prop = this.properties[space.id];

    if (prop.owner === null) {
      if (player.isAI) {
        const wantBuy = this.ai.shouldBuy(player, space, this);
        if (wantBuy) {
          this.buyProperty(player, space);
        } else {
          this.log(`❌ <strong>${player.name}</strong> chose not to buy ${space.name}.`);
        }
        this.turnPhase = 'done';
        this.updateUI();
        await this.aiBuildPhase(player);
        await this.aiEndTurn();
      } else if (this.isMyTurn && isLocalTurn) {
        // Show interactive buy modal for local human
        this.showBuyModal(player, space);
      } else {
        // Remote human player: wait for their decision over socket
        this.turnPhase = 'action';
        this.updateUI();
      }
    } else if (prop.owner !== player.id) {
      if (prop.mortgaged) {
        this.log(`ℹ️ ${space.name} is mortgaged — no rent collected.`);
      } else {
        const rent = this.calculatePropertyRent(space, prop);
        this.payRent(player, this.players[prop.owner], rent, space.name);
      }
      this.turnPhase = 'done';
      this.updateUI();
      if (player.isAI) await this.aiEndTurn();
    } else {
      this.log(`🏠 <strong>${player.name}</strong> visits their own property ${space.name}.`);
      this.turnPhase = 'done';
      this.updateUI();
      if (player.isAI) {
        await this.aiBuildPhase(player);
        await this.aiEndTurn();
      }
    }
  }

  // ── Station Space ──
  async handleStation(player, space, isLocalTurn = true) {
    const prop = this.properties[space.id];

    if (prop.owner === null) {
      if (player.isAI) {
        const wantBuy = this.ai.shouldBuy(player, space, this);
        if (wantBuy) this.buyProperty(player, space);
        else this.log(`❌ <strong>${player.name}</strong> passed on ${space.name}.`);
        this.turnPhase = 'done';
        this.updateUI();
        await this.aiEndTurn();
      } else if (this.isMyTurn && isLocalTurn) {
        this.showBuyModal(player, space);
      } else {
        this.turnPhase = 'action';
        this.updateUI();
      }
    } else if (prop.owner !== player.id) {
      if (!prop.mortgaged) {
        const stationsOwned = this.countStationsOwned(prop.owner);
        const rent = STATION_RENT[stationsOwned];
        this.payRent(player, this.players[prop.owner], rent, space.name);
      }
      this.turnPhase = 'done';
      this.updateUI();
      if (player.isAI) await this.aiEndTurn();
    } else {
      this.turnPhase = 'done';
      this.updateUI();
      if (player.isAI) await this.aiEndTurn();
    }
  }

  // ── Utility Space ──
  async handleUtility(player, space, isLocalTurn = true) {
    const prop = this.properties[space.id];

    if (prop.owner === null) {
      if (player.isAI) {
        const wantBuy = this.ai.shouldBuy(player, space, this);
        if (wantBuy) this.buyProperty(player, space);
        else this.log(`❌ <strong>${player.name}</strong> passed on ${space.name}.`);
        this.turnPhase = 'done';
        this.updateUI();
        await this.aiEndTurn();
      } else if (this.isMyTurn && isLocalTurn) {
        this.showBuyModal(player, space);
      } else {
        this.turnPhase = 'action';
        this.updateUI();
      }
    } else if (prop.owner !== player.id) {
      if (!prop.mortgaged) {
        const utilsOwned = this.countUtilitiesOwned(prop.owner);
        const diceSum = this.lastDice[0] + this.lastDice[1];
        const mult = utilsOwned >= 2 ? 10 : 4;
        const rent = diceSum * mult;
        this.log(`⚡ Utility rent: ${diceSum} (dice) × ${mult} = ${CURRENCY} ${rent}`);
        this.payRent(player, this.players[prop.owner], rent, space.name);
      }
      this.turnPhase = 'done';
      this.updateUI();
      if (player.isAI) await this.aiEndTurn();
    } else {
      this.turnPhase = 'done';
      this.updateUI();
      if (player.isAI) await this.aiEndTurn();
    }
  }

  // ── Chance Space ──
  async handleChance(player, isLocalTurn = true) {
    const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
    if (this.isMyTurn || !this.isMultiplayer) {
      await this.showCardModal(card, 'chance');
    }
    await this.executeCardAction(player, card);
  }

  // ── Community Chest Space ──
  async handleCommunity(player, isLocalTurn = true) {
    const card = COMMUNITY_CHEST_CARDS[Math.floor(Math.random() * COMMUNITY_CHEST_CARDS.length)];
    if (this.isMyTurn || !this.isMultiplayer) {
      await this.showCardModal(card, 'community');
    }
    await this.executeCardAction(player, card);
  }

  // ── Card Action Execution ──
  async executeCardAction(player, card) {
    switch (card.action) {
      case 'collect':
        player.cash += card.amount;
        this.showCashFloat(player, card.amount);
        this.log(`💰 <strong>${player.name}</strong> collected ${CURRENCY} ${card.amount}`);
        break;

      case 'pay':
        player.cash -= card.amount;
        this.showCashFloat(player, -card.amount);
        this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${card.amount}`);
        break;

      case 'goto':
        await this.moveToPosition(player, card.target, true);
        return;

      case 'jail':
        this.sendToJail(player);
        break;

      case 'moveBack':
        player.position = (player.position - card.spaces + 40) % 40;
        this.updateUI();
        await delay(300);
        await this.landOnSpace(player, player.position);
        return;

      case 'payAll':
        const opponents = this.activePlayers.filter(p => p.id !== player.id);
        const totalPay = card.amount * opponents.length;
        player.cash -= totalPay;
        opponents.forEach(p => {
          p.cash += card.amount;
          this.showCashFloat(p, card.amount);
        });
        this.showCashFloat(player, -totalPay);
        this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${card.amount} to each player`);
        break;

      case 'collectFromAll':
        const payers = this.activePlayers.filter(p => p.id !== player.id);
        const totalGain = card.amount * payers.length;
        payers.forEach(p => {
          p.cash -= card.amount;
          this.showCashFloat(p, -card.amount);
        });
        player.cash += totalGain;
        this.showCashFloat(player, totalGain);
        this.log(`🎂 <strong>${player.name}</strong> collected ${CURRENCY} ${card.amount} from each player`);
        break;

      case 'nearestStation':
        const stations = [5, 15, 25, 35];
        const nextStation = stations.find(s => s > player.position) ?? stations[0];
        await this.moveToPosition(player, nextStation, true);
        return;

      case 'repairs':
        let repairTotal = 0;
        Object.entries(this.properties).forEach(([id, prop]) => {
          if (prop.owner === player.id) {
            if (prop.houses === 5) repairTotal += card.hotelRate;
            else repairTotal += prop.houses * card.houseRate;
          }
        });
        player.cash -= repairTotal;
        this.showCashFloat(player, -repairTotal);
        this.log(`🔧 <strong>${player.name}</strong> paid ${CURRENCY} ${repairTotal} in property repairs`);
        break;
    }

    this.checkBankruptcy(player);
    this.turnPhase = 'done';
    this.updateUI();
    if (player.isAI) await this.aiEndTurn();
  }

  // ── Tax Space ──
  async handleTax(player, space) {
    player.cash -= space.amount;
    this.showCashFloat(player, -space.amount);
    this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${space.amount} for ${space.name}`);
    this.checkBankruptcy(player);
    this.turnPhase = 'done';
    this.updateUI();
    if (player.isAI) await this.aiEndTurn();
  }

  // ── Corner Space ──
  async handleCorner(player, space) {
    if (space.id === GOTO_JAIL_POSITION) {
      this.log(`🚔 <strong>${player.name}</strong> stepped on GO TO JAIL!`);
      this.sendToJail(player);
    } else if (space.id === 0) {
      player.cash += GO_SALARY;
      this.showCashFloat(player, GO_SALARY);
      this.log(`💵 <strong>${player.name}</strong> landed directly on GO — Collected ${CURRENCY} ${GO_SALARY}`);
    }
    this.turnPhase = 'done';
    this.updateUI();
    if (player.isAI) await this.aiEndTurn();
  }

  // ══════════════════════════════════════════
  // JAIL MANAGEMENT
  // ══════════════════════════════════════════
  sendToJail(player) {
    sound.playJail();
    player.position = JAIL_POSITION;
    player.inJail = true;
    player.jailTurns = 0;
    this.doublesCount = 0;
    this.updateUI();
  }

  async handleJailRoll(player, d1, d2, isDoubles) {
    if (isDoubles) {
      player.inJail = false;
      player.jailTurns = 0;
      this.doublesCount = 0;
      sound.playPassGo();
      this.log(`🔓 <strong>${player.name}</strong> rolled doubles and escaped Jail!`);
      await this.movePlayer(player, d1 + d2);
    } else {
      player.jailTurns++;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        if (player.isAI || player.cash < JAIL_BAIL) {
          player.cash -= JAIL_BAIL;
          player.inJail = false;
          player.jailTurns = 0;
          sound.playCash();
          this.showCashFloat(player, -JAIL_BAIL);
          this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${JAIL_BAIL} bail after 3 turns in jail.`);
          await this.movePlayer(player, d1 + d2);
        } else if (this.isMyTurn) {
          this.showJailModal(player, d1 + d2, true);
        }
      } else {
        this.log(`🔒 <strong>${player.name}</strong> remains in Jail. (Turn ${player.jailTurns}/${MAX_JAIL_TURNS})`);
        if (player.isAI) {
          if (this.ai.shouldPayBail(player, this)) {
            player.cash -= JAIL_BAIL;
            player.inJail = false;
            player.jailTurns = 0;
            sound.playCash();
            this.showCashFloat(player, -JAIL_BAIL);
            this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${JAIL_BAIL} bail.`);
            await this.movePlayer(player, d1 + d2);
            return;
          }
          this.turnPhase = 'done';
          this.updateUI();
          await this.aiEndTurn();
        } else if (this.isMyTurn) {
          this.showJailModal(player, d1 + d2, false);
        } else {
          this.turnPhase = 'done';
          this.updateUI();
        }
      }
    }
  }

  showJailModal(player, diceSum, forced) {
    sound.playCardDraw();
    const canPay = player.cash >= JAIL_BAIL;
    showModal(`
      <div class="card-draw-popup" style="--card-border-color: #ef4444;">
        <div class="card-draw-icon">🔒</div>
        <div class="card-draw-type">In Jail!</div>
        <div class="card-draw-text">
          ${forced ? `You must pay ${CURRENCY} ${JAIL_BAIL} bail after 3 turns.` : `Pay ${CURRENCY} ${JAIL_BAIL} bail to move immediately, or wait for next turn.`}
        </div>
        <div class="deed-actions">
          <button class="btn btn-primary btn-small" ${!canPay ? 'disabled' : ''} onclick="game.payBailAndMove(${diceSum})">
            💰 Pay ${CURRENCY} ${JAIL_BAIL} Bail
          </button>
          ${!forced ? `<button class="btn btn-secondary btn-small" onclick="game.stayInJail()">Wait</button>` : ''}
        </div>
      </div>
    `);
  }

  async payBailAndMove(diceSum) {
    hideModal();
    sound.playCash();
    const player = this.currentPlayer;
    player.cash -= JAIL_BAIL;
    player.inJail = false;
    player.jailTurns = 0;
    this.showCashFloat(player, -JAIL_BAIL);
    this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${JAIL_BAIL} bail.`);

    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({ type: 'payBail', diceSum });
    }

    await this.movePlayer(player, diceSum);
  }

  stayInJail() {
    hideModal();
    sound.playClick();
    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({ type: 'stayJail' });
    }
    this.turnPhase = 'done';
    this.updateUI();
  }

  // ══════════════════════════════════════════
  // BUYING PROPERTIES & TITLE DEED MODAL
  // ══════════════════════════════════════════
  buyProperty(player, space) {
    if (player.cash < space.price) return;
    player.cash -= space.price;
    this.properties[space.id].owner = player.id;
    sound.playCash();
    this.showCashFloat(player, -space.price);
    this.log(`🏠 <strong>${player.name}</strong> bought <strong>${space.name}</strong> for ${CURRENCY} ${space.price}!`);
    this.updateUI();
  }

  showBuyModal(player, space) {
    sound.playCardDraw();
    const groupColor = space.group ? COLOR_GROUPS[space.group]?.color : '#1e40af';
    const groupName = space.group ? COLOR_GROUPS[space.group]?.name : (space.type === 'station' ? 'Railway' : 'Utility');
    const canAfford = player.cash >= space.price;

    let rentTableHtml = '';
    let footerInfoHtml = '';

    if (space.rent) {
      const group = COLOR_GROUPS[space.group];
      rentTableHtml = `
        <div class="deed-rent-table">
          <div class="deed-rent-row current-level"><span>Rent (Site Only)</span><span>${CURRENCY} ${space.rent[0]}</span></div>
          <div class="deed-rent-row"><span>With 1 House</span><span>${CURRENCY} ${space.rent[1]}</span></div>
          <div class="deed-rent-row"><span>With 2 Houses</span><span>${CURRENCY} ${space.rent[2]}</span></div>
          <div class="deed-rent-row"><span>With 3 Houses</span><span>${CURRENCY} ${space.rent[3]}</span></div>
          <div class="deed-rent-row"><span>With 4 Houses</span><span>${CURRENCY} ${space.rent[4]}</span></div>
          <div class="deed-rent-row"><span>With HOTEL</span><span>${CURRENCY} ${space.rent[5]}</span></div>
        </div>
      `;
      footerInfoHtml = `
        <div class="deed-footer-info">
          <div>Houses cost: <strong>${CURRENCY} ${group.buildCost}</strong> each</div>
          <div>Hotels cost: <strong>${CURRENCY} ${group.buildCost}</strong> plus 4 houses</div>
          <div>Mortgage Value: <strong>${CURRENCY} ${space.price / 2}</strong></div>
        </div>
      `;
    } else if (space.type === 'station') {
      rentTableHtml = `
        <div class="deed-rent-table">
          <div class="deed-rent-row current-level"><span>Rent with 1 Station</span><span>${CURRENCY} 25</span></div>
          <div class="deed-rent-row"><span>If 2 Stations owned</span><span>${CURRENCY} 50</span></div>
          <div class="deed-rent-row"><span>If 3 Stations owned</span><span>${CURRENCY} 100</span></div>
          <div class="deed-rent-row"><span>If 4 Stations owned</span><span>${CURRENCY} 200</span></div>
        </div>
      `;
      footerInfoHtml = `
        <div class="deed-footer-info">
          <div>Mortgage Value: <strong>${CURRENCY} ${space.price / 2}</strong></div>
        </div>
      `;
    } else if (space.type === 'utility') {
      rentTableHtml = `
        <div class="deed-rent-table">
          <div class="deed-rent-row current-level"><span>If 1 Utility owned</span><span>4× Dice Total</span></div>
          <div class="deed-rent-row"><span>If both Utilities owned</span><span>10× Dice Total</span></div>
        </div>
      `;
      footerInfoHtml = `
        <div class="deed-footer-info">
          <div>Mortgage Value: <strong>${CURRENCY} ${space.price / 2}</strong></div>
        </div>
      `;
    }

    showModal(`
      <div class="title-deed-card">
        <div class="deed-header" style="--deed-color: ${groupColor};">
          <div class="deed-header-sub">TITLE DEED • ${groupName}</div>
          <div class="deed-header-title">${space.name}</div>
        </div>
        <div class="deed-body">
          ${rentTableHtml}
          ${footerInfoHtml}
          <div style="font-size:0.75rem; color:#64748b; margin-bottom:10px;">
            Your Cash: <strong style="color:#16a34a">${CURRENCY} ${player.cash}</strong>
          </div>
          <div class="deed-actions">
            <button class="btn btn-primary btn-small" ${!canAfford ? 'disabled' : ''} onclick="game.handleBuyChoice(true)">
              🏠 BUY ${CURRENCY} ${space.price}
            </button>
            <button class="btn btn-secondary btn-small" onclick="game.handleBuyChoice(false)">
              PASS
            </button>
          </div>
        </div>
      </div>
    `);
  }

  handleBuyChoice(buy) {
    hideModal();
    sound.playClick();
    const player = this.currentPlayer;
    const space = BOARD_SPACES[player.position];

    if (buy) {
      this.buyProperty(player, space);
      if (this.isMultiplayer && mpClient) {
        mpClient.sendAction({ type: 'buy', spaceId: space.id });
      }
    } else {
      this.log(`❌ <strong>${player.name}</strong> passed on buying ${space.name}.`);
      if (this.isMultiplayer && mpClient) {
        mpClient.sendAction({ type: 'passBuy', spaceId: space.id });
      }
    }

    this.turnPhase = 'done';
    this.updateUI();
  }

  // ══════════════════════════════════════════
  // RENT & UTILITY CALCULATION
  // ══════════════════════════════════════════
  calculatePropertyRent(space, prop) {
    if (prop.houses > 0) {
      return space.rent[prop.houses];
    }
    const group = COLOR_GROUPS[space.group];
    if (group) {
      const allOwned = group.properties.every(id => this.properties[id]?.owner === prop.owner);
      if (allOwned) return space.rent[0] * 2;
    }
    return space.rent[0];
  }

  countStationsOwned(ownerId) {
    return [5, 15, 25, 35].filter(id => this.properties[id]?.owner === ownerId).length;
  }

  countUtilitiesOwned(ownerId) {
    return [12, 28].filter(id => this.properties[id]?.owner === ownerId).length;
  }

  payRent(payer, owner, amount, propertyName) {
    if (payer.id === owner.id || amount <= 0) return;
    payer.cash -= amount;
    owner.cash += amount;
    sound.playRent();
    this.showCashFloat(payer, -amount);
    this.showCashFloat(owner, amount);
    this.log(`💰 <strong>${payer.name}</strong> paid <strong>${CURRENCY} ${amount}</strong> rent to <strong>${owner.name}</strong> for ${propertyName}!`);
    this.checkBankruptcy(payer);
    this.updateUI();
  }

  // ══════════════════════════════════════════
  // BUILDING SYSTEM — HOUSES & HOTELS
  // ══════════════════════════════════════════
  canBuildOnProperty(player, spaceId) {
    const space = BOARD_SPACES[spaceId];
    if (!space || space.type !== 'property') return false;

    const prop = this.properties[spaceId];
    if (prop.owner !== player.id || prop.mortgaged) return false;
    if (prop.houses >= MAX_UPGRADES) return false;

    const group = COLOR_GROUPS[space.group];
    if (!group) return false;

    // Must own entire color group
    const allOwned = group.properties.every(id => {
      const p = this.properties[id];
      return p && p.owner === player.id && !p.mortgaged;
    });
    if (!allOwned) return false;

    if (player.cash < group.buildCost) return false;

    // Even-building rule: cannot build if this property already has more houses than any other in group
    const minHouses = Math.min(...group.properties.map(id => this.properties[id].houses));
    if (prop.houses > minHouses) return false;

    return true;
  }

  buildHouse(player, spaceId) {
    if (!this.canBuildOnProperty(player, spaceId)) return;
    const space = BOARD_SPACES[spaceId];
    const group = COLOR_GROUPS[space.group];
    const prop = this.properties[spaceId];

    player.cash -= group.buildCost;
    prop.houses++;
    sound.playBuild();
    this.showCashFloat(player, -group.buildCost);

    const bldgLabel = prop.houses === 5 ? 'a HOTEL 🏨' : `House ${prop.houses} 🏠`;
    this.log(`🏗️ <strong>${player.name}</strong> built ${bldgLabel} on <strong>${space.name}</strong> for ${CURRENCY} ${group.buildCost}!`);

    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({ type: 'build', spaceId });
    }

    this.updateUI();
  }

  openBuildMenu() {
    sound.playClick();
    const player = this.currentPlayer;
    if (!this.isMyTurn) {
      showToast('You can only build during your turn!', 'warning');
      return;
    }

    const buildable = [];
    for (const [groupKey, group] of Object.entries(COLOR_GROUPS)) {
      const allOwned = group.properties.every(id => this.properties[id]?.owner === player.id && !this.properties[id]?.mortgaged);
      if (!allOwned) continue;

      group.properties.forEach(id => {
        if (this.canBuildOnProperty(player, id)) {
          buildable.push({ id, space: BOARD_SPACES[id], group });
        }
      });
    }

    if (buildable.length === 0) {
      showToast('No buildable properties. (Need complete color group & cash)', 'warning');
      return;
    }

    const itemsHtml = buildable.map(b => {
      const prop = this.properties[b.id];
      const nextLevel = prop.houses + 1;
      const label = nextLevel === 5 ? 'HOTEL 🏨' : `House ${nextLevel} 🏠`;
      return `
        <div class="deed-rent-row" style="padding:8px 6px; cursor:pointer; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:6px;"
             onclick="game.buildHouse(game.currentPlayer, ${b.id}); game.openBuildMenu();">
          <span>
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${b.group.color};margin-right:6px"></span>
            <strong>${b.space.name}</strong> → ${label}
          </span>
          <span style="color:#16a34a; font-weight:800">${CURRENCY} ${b.group.buildCost}</span>
        </div>
      `;
    }).join('');

    showModal(`
      <div class="title-deed-card" style="max-width:360px;">
        <div class="deed-header" style="--deed-color: #16a34a;">
          <div class="deed-header-sub">REAL ESTATE UPGRADE</div>
          <div class="deed-header-title">Build Houses &amp; Hotels</div>
        </div>
        <div class="deed-body">
          <div style="font-size:0.75rem; color:#64748b; margin-bottom:10px;">
            Your Cash: <strong style="color:#16a34a">${CURRENCY} ${player.cash}</strong>
          </div>
          <div style="max-height:220px; overflow-y:auto; margin-bottom:12px;">
            ${itemsHtml}
          </div>
          <div class="deed-actions">
            <button class="btn btn-secondary btn-small" onclick="hideModal()">DONE</button>
          </div>
        </div>
      </div>
    `);
  }

  // ══════════════════════════════════════════
  // SELL & MORTGAGE SYSTEM
  // ══════════════════════════════════════════
  openSellMenu() {
    sound.playClick();
    const player = this.currentPlayer;
    if (!this.isMyTurn) {
      showToast('You can only sell during your turn!', 'warning');
      return;
    }

    const sellable = [];
    Object.entries(this.properties).forEach(([id, prop]) => {
      if (prop.owner === player.id && prop.houses > 0) {
        const space = BOARD_SPACES[id];
        const group = COLOR_GROUPS[space.group];
        sellable.push({ id: parseInt(id), space, group, prop });
      }
    });

    if (sellable.length === 0) {
      showToast('No houses/hotels to sell!', 'warning');
      return;
    }

    const itemsHtml = sellable.map(s => {
      const refund = Math.floor(s.group.buildCost / 2);
      const label = s.prop.houses === 5 ? 'Sell Hotel' : `Sell House ${s.prop.houses}`;
      return `
        <div class="deed-rent-row" style="padding:8px 6px; cursor:pointer; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:6px;"
             onclick="game.sellHouse(${s.id}); game.openSellMenu();">
          <span>
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.group.color};margin-right:6px"></span>
            <strong>${s.space.name}</strong> (${label})
          </span>
          <span style="color:#16a34a; font-weight:800">+${CURRENCY} ${refund}</span>
        </div>
      `;
    }).join('');

    showModal(`
      <div class="title-deed-card" style="max-width:360px;">
        <div class="deed-header" style="--deed-color: #ea580c;">
          <div class="deed-header-sub">SELL BUILDINGS (50% REFUND)</div>
          <div class="deed-header-title">Sell Houses / Hotel</div>
        </div>
        <div class="deed-body">
          <div style="max-height:220px; overflow-y:auto; margin-bottom:12px;">
            ${itemsHtml}
          </div>
          <div class="deed-actions">
            <button class="btn btn-secondary btn-small" onclick="hideModal()">DONE</button>
          </div>
        </div>
      </div>
    `);
  }

  sellHouse(spaceId) {
    const space = BOARD_SPACES[spaceId];
    const group = COLOR_GROUPS[space.group];
    const prop = this.properties[spaceId];
    if (!prop || prop.houses <= 0) return;

    const refund = Math.floor(group.buildCost / 2);
    prop.houses--;
    this.currentPlayer.cash += refund;
    sound.playCash();
    this.showCashFloat(this.currentPlayer, refund);
    this.log(`🏠 <strong>${this.currentPlayer.name}</strong> sold a building on ${space.name} for +${CURRENCY} ${refund}`);

    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({ type: 'sell', spaceId });
    }

    this.updateUI();
  }

  openMortgageMenu() {
    sound.playClick();
    const player = this.currentPlayer;
    if (!this.isMyTurn) {
      showToast('You can only mortgage during your turn!', 'warning');
      return;
    }

    const owned = [];
    Object.entries(this.properties).forEach(([id, prop]) => {
      if (prop.owner === player.id) {
        owned.push({ id: parseInt(id), space: BOARD_SPACES[id], prop });
      }
    });

    if (owned.length === 0) {
      showToast('You do not own any properties to mortgage!', 'warning');
      return;
    }

    const itemsHtml = owned.map(o => {
      const mortgageVal = Math.floor(o.space.price / 2);
      const unmortgageVal = Math.floor(mortgageVal * 1.1);

      if (o.prop.mortgaged) {
        return `
          <div class="deed-rent-row" style="padding:8px 6px; cursor:pointer; background:#fee2e2; border:1px solid #fca5a5; border-radius:6px; margin-bottom:6px;"
               onclick="game.unmortgageProperty(${o.id}); game.openMortgageMenu();">
            <span><strong>${o.space.name}</strong> (MORTGAGED)</span>
            <span style="color:#dc2626; font-weight:800">Unmortgage -${CURRENCY} ${unmortgageVal}</span>
          </div>
        `;
      } else {
        const canMortgage = o.prop.houses === 0;
        return `
          <div class="deed-rent-row" style="padding:8px 6px; cursor:${canMortgage ? 'pointer' : 'not-allowed'}; opacity:${canMortgage ? 1 : 0.5}; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:6px;"
               ${canMortgage ? `onclick="game.mortgageProperty(${o.id}); game.openMortgageMenu();"` : ''}>
            <span><strong>${o.space.name}</strong> ${!canMortgage ? '(Sell houses first)' : ''}</span>
            <span style="color:#16a34a; font-weight:800">+${CURRENCY} ${mortgageVal}</span>
          </div>
        `;
      }
    }).join('');

    showModal(`
      <div class="title-deed-card" style="max-width:360px;">
        <div class="deed-header" style="--deed-color: #0284c7;">
          <div class="deed-header-sub">BANK MORTGAGE</div>
          <div class="deed-header-title">Mortgage / Unmortgage</div>
        </div>
        <div class="deed-body">
          <div style="font-size:0.75rem; color:#64748b; margin-bottom:10px;">
            Cash: <strong style="color:#16a34a">${CURRENCY} ${player.cash}</strong> (Unmortgage = Mortgage + 10% interest)
          </div>
          <div style="max-height:220px; overflow-y:auto; margin-bottom:12px;">
            ${itemsHtml}
          </div>
          <div class="deed-actions">
            <button class="btn btn-secondary btn-small" onclick="hideModal()">DONE</button>
          </div>
        </div>
      </div>
    `);
  }

  mortgageProperty(spaceId) {
    const space = BOARD_SPACES[spaceId];
    const prop = this.properties[spaceId];
    if (!prop || prop.mortgaged || prop.houses > 0) return;

    const val = Math.floor(space.price / 2);
    prop.mortgaged = true;
    this.currentPlayer.cash += val;
    sound.playCash();
    this.showCashFloat(this.currentPlayer, val);
    this.log(`🏦 <strong>${this.currentPlayer.name}</strong> mortgaged ${space.name} for +${CURRENCY} ${val}`);

    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({ type: 'mortgage', spaceId });
    }

    this.updateUI();
  }

  unmortgageProperty(spaceId) {
    const space = BOARD_SPACES[spaceId];
    const prop = this.properties[spaceId];
    if (!prop || !prop.mortgaged) return;

    const cost = Math.floor((space.price / 2) * 1.1);
    if (this.currentPlayer.cash < cost) {
      showToast('Not enough cash to unmortgage!', 'error');
      return;
    }

    this.currentPlayer.cash -= cost;
    prop.mortgaged = false;
    sound.playCash();
    this.showCashFloat(this.currentPlayer, -cost);
    this.log(`🏦 <strong>${this.currentPlayer.name}</strong> unmortgaged ${space.name} for -${CURRENCY} ${cost}`);

    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({ type: 'unmortgage', spaceId });
    }

    this.updateUI();
  }

  // ══════════════════════════════════════════
  // TRADING SYSTEM
  // ══════════════════════════════════════════
  openTradeMenu(selectedPartnerId = null) {
    sound.playClick();
    const player = this.currentPlayer;
    if (!this.isMyTurn) {
      showToast('You can only trade during your turn!', 'warning');
      return;
    }

    const opponents = this.players.filter(p => p.id !== player.id && !p.isBankrupt);
    if (opponents.length === 0) {
      showToast('No opponents available to trade with!', 'warning');
      return;
    }

    const partnerId = selectedPartnerId !== null ? selectedPartnerId : (this._tradeOffer?.partnerId ?? opponents[0].id);
    const partner = this.players[partnerId] || opponents[0];

    // Initialize or retain trade offer state
    if (!this._tradeOffer || this._tradeOffer.partnerId !== partner.id) {
      this._tradeOffer = {
        partnerId: partner.id,
        myProps: new Set(),
        myCash: 0,
        partnerProps: new Set(),
        partnerCash: 0
      };
    }

    // Properties owned by me (cannot trade properties with houses)
    const myOwnedProps = Object.entries(this.properties)
      .filter(([id, prop]) => prop.owner === player.id && prop.houses === 0)
      .map(([id]) => parseInt(id));

    // Properties owned by partner (cannot trade properties with houses)
    const partnerOwnedProps = Object.entries(this.properties)
      .filter(([id, prop]) => prop.owner === partner.id && prop.houses === 0)
      .map(([id]) => parseInt(id));

    // Partner options dropdown
    const partnerOptionsHtml = opponents.map(o => `
      <option value="${o.id}" ${o.id === partner.id ? 'selected' : ''}>
        ${o.name} (${o.tokenSymbol || '♟'}) — ${CURRENCY} ${o.cash}
      </option>
    `).join('');

    // My properties list items
    const myPropsHtml = myOwnedProps.length === 0 ? '<div style="font-size:0.75rem; color:#94a3b8; padding:8px 0;">No tradable properties</div>' :
      myOwnedProps.map(id => {
        const space = BOARD_SPACES[id];
        const groupColor = space.group ? COLOR_GROUPS[space.group]?.color : '#1e40af';
        const isSelected = this._tradeOffer.myProps.has(id);
        const prop = this.properties[id];
        return `
          <div class="trade-prop-item ${isSelected ? 'selected' : ''}" onclick="game.toggleTradeProp(${id}, 'my')">
            <span style="display:flex; align-items:center; gap:6px;">
              <span style="width:8px; height:8px; border-radius:2px; background:${groupColor};"></span>
              <strong>${space.name}</strong> ${prop.mortgaged ? '(Mortgaged)' : ''}
            </span>
            <span>${isSelected ? '✅' : '➕'}</span>
          </div>
        `;
      }).join('');

    // Partner properties list items
    const partnerPropsHtml = partnerOwnedProps.length === 0 ? '<div style="font-size:0.75rem; color:#94a3b8; padding:8px 0;">No tradable properties</div>' :
      partnerOwnedProps.map(id => {
        const space = BOARD_SPACES[id];
        const groupColor = space.group ? COLOR_GROUPS[space.group]?.color : '#1e40af';
        const isSelected = this._tradeOffer.partnerProps.has(id);
        const prop = this.properties[id];
        return `
          <div class="trade-prop-item ${isSelected ? 'selected' : ''}" onclick="game.toggleTradeProp(${id}, 'partner')">
            <span style="display:flex; align-items:center; gap:6px;">
              <span style="width:8px; height:8px; border-radius:2px; background:${groupColor};"></span>
              <strong>${space.name}</strong> ${prop.mortgaged ? '(Mortgaged)' : ''}
            </span>
            <span>${isSelected ? '✅' : '➕'}</span>
          </div>
        `;
      }).join('');

    showModal(`
      <div class="title-deed-card" style="max-width:440px;">
        <div class="deed-header" style="--deed-color: #f59e0b;">
          <div class="deed-header-sub">BUSINESS NEGOTIATOR</div>
          <div class="deed-header-title">Trade Properties &amp; Cash</div>
        </div>
        <div class="deed-body">
          
          <div style="margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <label style="font-size:0.8rem; font-weight:800; color:#334155;">Trade With:</label>
            <select id="trade-partner-select" style="padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; font-weight:700; font-family:'Space Grotesk', sans-serif;"
                    onchange="game.onTradePartnerChange(parseInt(this.value, 10))">
              ${partnerOptionsHtml}
            </select>
          </div>

          <div class="trade-columns">
            
            <!-- Left: You Offer -->
            <div class="trade-col">
              <div class="trade-col-title">
                <span>🟢 You Offer</span>
                <span style="font-size:0.7rem; color:#16a34a; font-weight:700">Max: ${CURRENCY} ${player.cash}</span>
              </div>
              <div class="trade-cash-input-wrap">
                <label>Cash Offer (₹):</label>
                <input type="number" id="trade-my-cash" min="0" max="${player.cash}" value="${this._tradeOffer.myCash}"
                       oninput="game.updateTradeCash('my', this.value)" placeholder="0" />
              </div>
              <div style="font-size:0.72rem; font-weight:700; color:#64748b;">Properties:</div>
              <div class="trade-prop-list">
                ${myPropsHtml}
              </div>
            </div>

            <!-- Right: You Request -->
            <div class="trade-col">
              <div class="trade-col-title">
                <span>🔵 You Request</span>
                <span style="font-size:0.7rem; color:#0284c7; font-weight:700">Max: ${CURRENCY} ${partner.cash}</span>
              </div>
              <div class="trade-cash-input-wrap">
                <label>Cash Request (₹):</label>
                <input type="number" id="trade-partner-cash" min="0" max="${partner.cash}" value="${this._tradeOffer.partnerCash}"
                       oninput="game.updateTradeCash('partner', this.value)" placeholder="0" />
              </div>
              <div style="font-size:0.72rem; font-weight:700; color:#64748b;">Properties:</div>
              <div class="trade-prop-list">
                ${partnerPropsHtml}
              </div>
            </div>

          </div>

          <div class="deed-actions" style="margin-top:14px;">
            <button class="btn btn-primary btn-small" onclick="game.submitTradeProposal()">
              🤝 PROPOSE TRADE
            </button>
            <button class="btn btn-secondary btn-small" onclick="hideModal()">
              CANCEL
            </button>
          </div>

        </div>
      </div>
    `);
  }

  onTradePartnerChange(partnerId) {
    this.openTradeMenu(partnerId);
  }

  toggleTradeProp(propId, side) {
    sound.playClick();
    if (side === 'my') {
      if (this._tradeOffer.myProps.has(propId)) this._tradeOffer.myProps.delete(propId);
      else this._tradeOffer.myProps.add(propId);
    } else {
      if (this._tradeOffer.partnerProps.has(propId)) this._tradeOffer.partnerProps.delete(propId);
      else this._tradeOffer.partnerProps.add(propId);
    }
    this.openTradeMenu(this._tradeOffer.partnerId);
  }

  updateTradeCash(side, val) {
    const amount = Math.max(0, parseInt(val, 10) || 0);
    if (side === 'my') this._tradeOffer.myCash = amount;
    else this._tradeOffer.partnerCash = amount;
  }

  async submitTradeProposal() {
    sound.playClick();
    const player = this.currentPlayer;
    const partner = this.players[this._tradeOffer.partnerId];
    if (!partner) return;

    const offeredProps = Array.from(this._tradeOffer.myProps);
    const requestedProps = Array.from(this._tradeOffer.partnerProps);
    const offeredCash = this._tradeOffer.myCash;
    const requestedCash = this._tradeOffer.partnerCash;

    if (offeredProps.length === 0 && requestedProps.length === 0 && offeredCash === 0 && requestedCash === 0) {
      showToast('Please select properties or cash to trade!', 'warning');
      return;
    }

    if (offeredCash > player.cash) {
      showToast('You do not have enough cash for this offer!', 'error');
      return;
    }

    if (requestedCash > partner.cash) {
      showToast(`${partner.name} does not have that much cash!`, 'error');
      return;
    }

    hideModal();

    // Multiplayer trade proposal
    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({
        type: 'tradeOffer',
        fromPlayerId: player.id,
        toPlayerId: partner.id,
        offeredPropIds: offeredProps,
        offeredCash,
        requestedPropIds: requestedProps,
        requestedCash
      });
      showToast(`Trade proposal sent to ${partner.name}!`, 'info');
      this.log(`🤝 <strong>${player.name}</strong> sent a trade proposal to <strong>${partner.name}</strong>.`);
      return;
    }

    // Single Player AI evaluation
    if (partner.isAI) {
      showToast(`Evaluating trade with ${partner.name}...`, 'info');
      await delay(600);

      const accepted = this.ai.evaluateTradeOffer(
        player,
        partner,
        offeredProps,
        offeredCash,
        requestedProps,
        requestedCash,
        this
      );

      if (accepted) {
        this.executeTrade(player.id, partner.id, offeredProps, offeredCash, requestedProps, requestedCash, true);
        showToast(`🎉 ${partner.name} ACCEPTED your trade deal!`, 'success');
      } else {
        this.log(`❌ <strong>${partner.name}</strong> evaluated and declined the trade proposal.`);
        showToast(`❌ ${partner.name} declined the trade offer.`, 'warning');
      }
    }
  }

  showIncomingTradeModal(tradeData) {
    sound.playCardDraw();
    const fromPlayer = this.players[tradeData.fromPlayerId];
    if (!fromPlayer) return;

    const offeredPropsNames = tradeData.offeredPropIds.map(id => BOARD_SPACES[id]?.name).filter(Boolean);
    const requestedPropsNames = tradeData.requestedPropIds.map(id => BOARD_SPACES[id]?.name).filter(Boolean);

    const giveStr = [
      ...offeredPropsNames.map(n => `🏠 ${n}`),
      tradeData.offeredCash > 0 ? `💰 ${CURRENCY} ${tradeData.offeredCash}` : null
    ].filter(Boolean).join(', ') || 'Nothing';

    const getStr = [
      ...requestedPropsNames.map(n => `🏠 ${n}`),
      tradeData.requestedCash > 0 ? `💰 ${CURRENCY} ${tradeData.requestedCash}` : null
    ].filter(Boolean).join(', ') || 'Nothing';

    const tradeJson = JSON.stringify(tradeData).replace(/"/g, '&quot;');

    showModal(`
      <div class="card-draw-popup" style="--card-border-color: #f59e0b; max-width:380px;">
        <div class="card-draw-icon">🤝</div>
        <div class="card-draw-type">Incoming Trade Proposal!</div>
        <div class="card-draw-text" style="text-align:left; font-size:0.85rem;">
          <div style="margin-bottom:8px;"><strong>${fromPlayer.name}</strong> offers:</div>
          <div style="background:#f1f5f9; padding:6px 10px; border-radius:6px; color:#16a34a; font-weight:700; margin-bottom:8px;">
            ${giveStr}
          </div>
          <div style="margin-bottom:8px;">In exchange for your:</div>
          <div style="background:#f1f5f9; padding:6px 10px; border-radius:6px; color:#0284c7; font-weight:700; margin-bottom:12px;">
            ${getStr}
          </div>
        </div>
        <div class="deed-actions">
          <button class="btn btn-primary btn-small" onclick='game.acceptIncomingTrade(${tradeJson})'>
            🤝 ACCEPT DEAL
          </button>
          <button class="btn btn-secondary btn-small" onclick='game.declineIncomingTrade(${tradeJson})'>
            ❌ DECLINE
          </button>
        </div>
      </div>
    `);
  }

  acceptIncomingTrade(tradeData) {
    hideModal();
    sound.playCash();
    this.executeTrade(tradeData.fromPlayerId, tradeData.toPlayerId, tradeData.offeredPropIds, tradeData.offeredCash, tradeData.requestedPropIds, tradeData.requestedCash, true);

    if (this.isMultiplayer && mpClient) {
      mpClient.sendAction({
        type: 'tradeAccepted',
        ...tradeData
      });
    }
  }

  declineIncomingTrade(tradeData) {
    hideModal();
    sound.playClick();
    if (this.isMultiplayer && mpClient) {
      mpClient.sendAction({
        type: 'tradeDeclined',
        ...tradeData
      });
    }
  }

  executeTrade(fromPlayerId, toPlayerId, offeredPropIds, offeredCash, requestedPropIds, requestedCash, isLocal = true) {
    const p1 = this.players[fromPlayerId];
    const p2 = this.players[toPlayerId];
    if (!p1 || !p2) return;

    // Exchange cash
    p1.cash = p1.cash - offeredCash + requestedCash;
    p2.cash = p2.cash - requestedCash + offeredCash;

    // Exchange properties
    offeredPropIds.forEach(id => {
      if (this.properties[id]) this.properties[id].owner = toPlayerId;
    });

    requestedPropIds.forEach(id => {
      if (this.properties[id]) this.properties[id].owner = fromPlayerId;
    });

    sound.playCash();

    if (offeredCash > 0) this.showCashFloat(p1, -offeredCash);
    if (requestedCash > 0) this.showCashFloat(p2, -requestedCash);

    this.log(`🤝 <strong>Trade Complete!</strong> <strong>${p1.name}</strong> and <strong>${p2.name}</strong> finalized a property trade!`);
    this.updateUI();
  }

  openMenuModal() {
    sound.playClick();
    showModal(`
      <div class="title-deed-card" style="max-width:320px;">
        <div class="deed-header" style="--deed-color: #0284c7;">
          <div class="deed-header-title">Game Options</div>
        </div>
        <div class="deed-body">
          <div style="display:flex; flex-direction:column; gap:8px; margin: 12px 0;">
            <button class="btn btn-secondary" onclick="hideModal()"><i class="fas fa-play"></i> Resume Game</button>
            <button class="btn btn-secondary" onclick="game.forfeitPlayer()"><i class="fas fa-flag"></i> Forfeit / Bankrupt</button>
            <button class="btn btn-secondary" onclick="location.reload()"><i class="fas fa-home"></i> Quit to Main Menu</button>
          </div>
        </div>
      </div>
    `);
  }

  forfeitPlayer() {
    hideModal();
    const player = this.currentPlayer;
    if (confirm(`Are you sure you want to forfeit, ${player.name}?`)) {
      player.cash = -1;
      this.checkBankruptcy(player);
      this.endTurn();
    }
  }

  // ══════════════════════════════════════════
  // AI TURN PROCESSOR (SINGLE PLAYER ONLY)
  // ══════════════════════════════════════════
  async processAITurn() {
    if (this.isMultiplayer && !this.currentPlayer.isAI) return; // Never run for human players!
    await delay(700);
    if (this.gameOver || this.currentPlayer.isBankrupt) return;
    await this.rollDice();
  }

  async aiBuildPhase(player) {
    if (!player.isAI) return;
    let builtAny = true;
    let limit = 0;

    while (builtAny && limit < 15) {
      builtAny = false;
      limit++;

      for (const [groupKey, group] of Object.entries(COLOR_GROUPS)) {
        const allOwned = group.properties.every(id => {
          const p = this.properties[id];
          return p && p.owner === player.id && !p.mortgaged;
        });
        if (!allOwned) continue;

        for (const id of group.properties) {
          if (this.canBuildOnProperty(player, id) && this.ai.shouldBuild(player, BOARD_SPACES[id], this)) {
            this.buildHouse(player, id);
            builtAny = true;
            await delay(150);
          }
        }
      }
    }
  }

  async aiEndTurn() {
    await delay(500);
    if (!this.gameOver) this.endTurn();
  }

  // ══════════════════════════════════════════
  // TURN MANAGEMENT
  // ══════════════════════════════════════════
  endTurn(fromRemote = false) {
    if (this.gameOver) return;
    this.doublesCount = 0;

    let next = (this.currentPlayerIndex + 1) % this.players.length;
    let tries = 0;
    while (this.players[next].isBankrupt && tries < this.players.length) {
      next = (next + 1) % this.players.length;
      tries++;
    }

    if (next <= this.currentPlayerIndex) {
      this.turnNumber++;
    }

    // Broadcast endTurn if local multiplayer turn
    if (this.isMultiplayer && mpClient && !fromRemote && this.isMyTurn) {
      mpClient.sendAction({
        type: 'endTurn',
        nextPlayerIndex: next
      });
    }

    this.currentPlayerIndex = next;
    this.turnPhase = 'roll';
    this.updateUI();

    if (this.currentPlayer.isAI) {
      this.processAITurn();
    } else if (this.isMultiplayer) {
      if (this.isMyTurn) {
        sound.playPassGo();
        showToast("It's your turn!", 'success');
      } else {
        showToast(`Waiting for ${this.currentPlayer.name}'s turn...`, 'info');
      }
    }
  }

  // ══════════════════════════════════════════
  // BANKRUPTCY & VICTORY
  // ══════════════════════════════════════════
  checkBankruptcy(player) {
    if (player.cash < 0) {
      player.isBankrupt = true;
      player.cash = 0;
      sound.playBankrupt();
      this.log(`💀 <strong>${player.name}</strong> went bankrupt and is eliminated!`);

      // Release all properties
      Object.entries(this.properties).forEach(([id, prop]) => {
        if (prop.owner === player.id) {
          prop.owner = null;
          prop.houses = 0;
          prop.mortgaged = false;
        }
      });

      if (this.activePlayers.length <= 1) {
        this.declareWinner();
      }
    }
  }

  declareWinner() {
    this.gameOver = true;
    sound.playVictory();
    const winner = this.activePlayers[0] || this.players[0];

    let netWorth = winner.cash;
    let propCount = 0;

    Object.entries(this.properties).forEach(([id, prop]) => {
      if (prop.owner === winner.id) {
        propCount++;
        const space = BOARD_SPACES[id];
        netWorth += space.price;
        if (space.group) {
          const group = COLOR_GROUPS[space.group];
          netWorth += prop.houses * (group?.buildCost || 0);
        }
      }
    });

    showScreen('gameover-screen');
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-name').style.color = winner.color;
    document.getElementById('winner-cash').textContent = `${CURRENCY} ${winner.cash}`;
    document.getElementById('winner-networth').textContent = `${CURRENCY} ${netWorth}`;
    document.getElementById('winner-properties').textContent = propCount;
    document.getElementById('winner-turns').textContent = this.turnNumber;
  }

  // ══════════════════════════════════════════
  // CARD REVEAL MODAL
  // ══════════════════════════════════════════
  showCardModal(card, type) {
    sound.playCardDraw();
    return new Promise(resolve => {
      const isChance = type === 'chance';
      showModal(`
        <div class="card-draw-popup" style="--card-border-color: ${isChance ? '#f97316' : '#3b82f6'};">
          <div class="card-draw-icon">${isChance ? '📣' : '📦'}</div>
          <div class="card-draw-type">${isChance ? 'CHANCE' : 'COMMUNITY CHEST'}</div>
          <div class="card-draw-text">${card.text}</div>
          <button class="btn btn-primary btn-small" onclick="game.closeCardModal()">CONTINUE</button>
        </div>
      `);
      this._cardResolve = resolve;
    });
  }

  closeCardModal() {
    hideModal();
    if (this._cardResolve) {
      this._cardResolve();
      this._cardResolve = null;
    }
  }

  // ══════════════════════════════════════════
  // SPACE INFO INSPECTION
  // ══════════════════════════════════════════
  showSpaceInfo(spaceId) {
    const space = BOARD_SPACES[spaceId];
    const prop = this.properties[spaceId];

    if (!prop && space.type !== 'property' && space.type !== 'station' && space.type !== 'utility') {
      showModal(`
        <div class="title-deed-card" style="max-width:300px;">
          <div class="deed-header" style="--deed-color: #475569;">
            <div class="deed-header-title">${space.name}</div>
          </div>
          <div class="deed-body">
            <div style="font-size:2rem; margin:8px 0;">${space.icon}</div>
            <p style="font-size:0.85rem; color:#475569; margin-bottom:14px;">${space.description || ''}</p>
            <div class="deed-actions">
              <button class="btn btn-secondary btn-small" onclick="hideModal()">CLOSE</button>
            </div>
          </div>
        </div>
      `);
      return;
    }

    if (!prop) return;

    const groupColor = space.group ? COLOR_GROUPS[space.group]?.color : '#1e40af';
    const groupName = space.group ? COLOR_GROUPS[space.group]?.name : (space.type === 'station' ? 'Railway' : 'Utility');
    const owner = prop.owner !== null ? this.players[prop.owner] : null;

    let rentTableHtml = '';
    let footerInfoHtml = '';

    if (space.rent) {
      const group = COLOR_GROUPS[space.group];
      rentTableHtml = `
        <div class="deed-rent-table">
          <div class="deed-rent-row ${prop.houses === 0 ? 'current-level' : ''}"><span>Rent (Site Only)</span><span>${CURRENCY} ${space.rent[0]}</span></div>
          <div class="deed-rent-row ${prop.houses === 1 ? 'current-level' : ''}"><span>With 1 House</span><span>${CURRENCY} ${space.rent[1]}</span></div>
          <div class="deed-rent-row ${prop.houses === 2 ? 'current-level' : ''}"><span>With 2 Houses</span><span>${CURRENCY} ${space.rent[2]}</span></div>
          <div class="deed-rent-row ${prop.houses === 3 ? 'current-level' : ''}"><span>With 3 Houses</span><span>${CURRENCY} ${space.rent[3]}</span></div>
          <div class="deed-rent-row ${prop.houses === 4 ? 'current-level' : ''}"><span>With 4 Houses</span><span>${CURRENCY} ${space.rent[4]}</span></div>
          <div class="deed-rent-row ${prop.houses === 5 ? 'current-level' : ''}"><span>With HOTEL</span><span>${CURRENCY} ${space.rent[5]}</span></div>
        </div>
      `;
      footerInfoHtml = `
        <div class="deed-footer-info">
          <div>Houses cost: <strong>${CURRENCY} ${group.buildCost}</strong> each</div>
          <div>Hotels cost: <strong>${CURRENCY} ${group.buildCost}</strong> plus 4 houses</div>
          <div>Mortgage Value: <strong>${CURRENCY} ${space.price / 2}</strong></div>
        </div>
      `;
    }

    showModal(`
      <div class="title-deed-card">
        <div class="deed-header" style="--deed-color: ${groupColor};">
          <div class="deed-header-sub">TITLE DEED • ${groupName}</div>
          <div class="deed-header-title">${space.name}</div>
        </div>
        <div class="deed-body">
          <div style="font-size:0.8rem; margin-bottom:8px;">
            Owner: ${owner ? `<strong style="color:${owner.color}">${owner.name}</strong>` : '<span style="color:#94a3b8">Unowned</span>'}
            ${prop.mortgaged ? ' <span style="color:#dc2626;font-weight:700">(Mortgaged)</span>' : ''}
          </div>
          ${rentTableHtml}
          ${footerInfoHtml}
          <div class="deed-actions">
            <button class="btn btn-secondary btn-small" onclick="hideModal()">CLOSE</button>
          </div>
        </div>
      </div>
    `);
  }

  // ══════════════════════════════════════════
  // CASH FLOAT ANIMATION & LOGGING
  // ══════════════════════════════════════════
  showCashFloat(player, amount) {
    const card = document.getElementById(`player-status-${player.id}`);
    if (!card) return;

    const el = document.createElement('div');
    el.className = `cash-float ${amount > 0 ? 'gain' : 'loss'}`;
    el.textContent = `${amount > 0 ? '+' : ''}${CURRENCY} ${Math.abs(amount)}`;
    el.style.right = '12px';
    el.style.top = '2px';
    card.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  log(msg) {
    this.logEntries.unshift(msg);
    if (this.logEntries.length > 60) this.logEntries.pop();

    const container = document.getElementById('game-log-entries');
    if (container) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = msg;
      container.prepend(entry);
      while (container.children.length > 40) {
        container.removeChild(container.lastChild);
      }
    }
  }

  clearLog() {
    this.logEntries = [];
    const container = document.getElementById('game-log-entries');
    if (container) container.innerHTML = '';
  }

  // ══════════════════════════════════════════
  // IN-GAME CHAT & REACTIONS SYSTEM
  // ══════════════════════════════════════════
  switchSideTab(tabName) {
    sound.playClick();
    const logTab = document.getElementById('tab-btn-log');
    const chatTab = document.getElementById('tab-btn-chat');
    const logPanel = document.getElementById('panel-log');
    const chatPanel = document.getElementById('panel-chat');

    if (tabName === 'chat') {
      logTab?.classList.remove('active');
      chatTab?.classList.add('active');
      if (logPanel) logPanel.style.display = 'none';
      if (chatPanel) chatPanel.style.display = 'flex';

      // Clear unread badge
      this.unreadChatCount = 0;
      const badge = document.getElementById('chat-unread-badge');
      if (badge) badge.style.display = 'none';

      // Auto focus chat input
      document.getElementById('chat-input')?.focus();
    } else {
      chatTab?.classList.remove('active');
      logTab?.classList.add('active');
      if (chatPanel) chatPanel.style.display = 'none';
      if (logPanel) logPanel.style.display = 'flex';
    }
  }

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    sound.playClick();

    if (this.isMultiplayer && mpClient) {
      mpClient.sendChat(text, null);
    } else {
      // Local single player chat
      const me = this.players[this.myPlayerId ?? 0];
      this.receiveChatMessage({
        playerId: me.id,
        playerName: me.name,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      // AI Bot occasionally replies with witty commentary
      this.triggerBotChatReply(text);
    }
  }

  sendQuickEmote(emoji) {
    sound.playClick();
    this.spawnFloatingEmote(emoji, this.myPlayerId ?? 0);

    if (this.isMultiplayer && mpClient) {
      mpClient.sendChat(null, emoji);
    } else {
      const me = this.players[this.myPlayerId ?? 0];
      this.receiveChatMessage({
        playerId: me.id,
        playerName: me.name,
        emoji,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  }

  receiveChatMessage(data) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const sender = this.players[data.playerId] || { name: data.playerName || 'Player', color: '#22d3ee' };
    const isMe = data.playerId === (this.myPlayerId ?? 0);

    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg-item ${isMe ? 'is-me' : ''}`;

    if (data.emoji) {
      msgEl.innerHTML = `
        <div class="chat-msg-header">
          <span class="chat-msg-sender" style="color: ${sender.color}">${sender.name} ${sender.tokenSymbol || ''}</span>
          <span class="chat-msg-time">${data.time}</span>
        </div>
        <div class="chat-msg-bubble" style="font-size: 1.5rem; text-align: center; padding: 4px;">
          ${data.emoji}
        </div>
      `;
      this.spawnFloatingEmote(data.emoji, data.playerId);
    } else {
      msgEl.innerHTML = `
        <div class="chat-msg-header">
          <span class="chat-msg-sender" style="color: ${sender.color}">${sender.name} ${sender.tokenSymbol || ''}</span>
          <span class="chat-msg-time">${data.time}</span>
        </div>
        <div class="chat-msg-bubble">
          ${this.escapeHtml(data.text)}
        </div>
      `;
    }

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;

    // If chat tab is not active, increment unread badge
    const chatPanel = document.getElementById('panel-chat');
    if (chatPanel && chatPanel.style.display === 'none') {
      this.unreadChatCount = (this.unreadChatCount || 0) + 1;
      const badge = document.getElementById('chat-unread-badge');
      if (badge) {
        badge.textContent = this.unreadChatCount;
        badge.style.display = 'inline-block';
      }
    }
  }

  spawnFloatingEmote(emoji, playerId) {
    const targetCard = document.getElementById(`player-status-${playerId}`) || document.getElementById('center-interactive-area');
    if (!targetCard) return;

    const rect = targetCard.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'floating-emote';
    el.textContent = emoji;
    el.style.left = `${rect.left + (rect.width / 2) - 16}px`;
    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  triggerBotChatReply(userMsg) {
    const aiPlayers = this.players.filter(p => p.isAI && !p.isBankrupt);
    if (aiPlayers.length === 0) return;
    const bot = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];

    const botQuotes = [
      "Let's see who builds the first hotel! 🏨",
      "May the best tycoon win! 🎲",
      "Watch out for my properties! 💼",
      "Good luck! The dice never lie. 😉",
      "I'm saving up for Mumbai and Delhi! 🏙️",
      "Need a trade? Hit the TRADE button! 🤝",
      "That was a bold move!"
    ];

    setTimeout(() => {
      if (this.gameOver) return;
      this.receiveChatMessage({
        playerId: bot.id,
        playerName: bot.name,
        text: botQuotes[Math.floor(Math.random() * botQuotes.length)],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }, 1200 + Math.random() * 800);
  }

  escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
