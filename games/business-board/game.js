/* ============================================
   PBG Business Board Game — Core Game Engine
   3D Dynamic Follow Camera & Full Board Views
   Full Single Player (vs AI) & Real Multiplayer
   ============================================ */

let game = null;

// ══════════════════════════════════════════
// UI HELPER FUNCTIONS
// ══════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    if (id === 'game-screen') {
      target.style.display = 'block';
    } else {
      target.style.display = 'flex';
    }
  }
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
  // Initialize game engine on load so board and HUD are always ready
  startSinglePlayerGame('VARSHITHGAMING', 3, 'normal');
  showScreen('landing-screen');

  // Audio Toggle Handlers (Landing)
  const sfxBtn = document.getElementById('btn-toggle-sfx');
  const musicBtn = document.getElementById('btn-toggle-music');

  const updateAudioButtons = () => {
    if (sfxBtn) {
      sfxBtn.classList.toggle('active', sound.sfxEnabled);
      sfxBtn.innerHTML = `<i class="fas fa-volume-${sound.sfxEnabled ? 'high' : 'xmark'}"></i> <span>SFX ${sound.sfxEnabled ? 'ON' : 'OFF'}</span>`;
    }
    if (musicBtn) {
      musicBtn.classList.toggle('active', sound.musicPlaying);
      musicBtn.innerHTML = `<i class="fas fa-music"></i> <span>Music ${sound.musicPlaying ? 'ON' : 'OFF'}</span>`;
    }
  };

  sfxBtn?.addEventListener('click', () => {
    sound.toggleSfx();
    sound.playClick();
    updateAudioButtons();
    showToast(`Sound Effects: ${sound.sfxEnabled ? 'ON' : 'OFF'}`, 'info');
  });

  musicBtn?.addEventListener('click', () => {
    sound.toggleMusic();
    sound.playClick();
    updateAudioButtons();
    showToast(`Background Music: ${sound.musicPlaying ? 'ON' : 'OFF'}`, 'info');
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
    const playerName = document.getElementById('player-name').value.trim() || 'VARSHITHGAMING';
    const aiCount = parseInt(document.getElementById('ai-count').value, 10) || 3;
    const aiDifficulty = document.getElementById('ai-difficulty').value || 'normal';
    startSinglePlayerGame(playerName, aiCount, aiDifficulty);
    showScreen('game-screen');
  });

  // Fullscreen change listener
  document.addEventListener('fullscreenchange', () => {
    const isFs = !!document.fullscreenElement;
    const fsIcon = document.getElementById('fullscreen-icon');
    if (fsIcon) fsIcon.className = `fas fa-${isFs ? 'compress' : 'expand'}`;
  });

  // Window resize & orientation change
  window.addEventListener('resize', () => {
    if (game && !game.gameOver) {
      game.renderTokens();
      game.updateCameraPosition(game.currentPlayer?.position || 0);
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
}

// ══════════════════════════════════════════
// GAME CLASS — CORE STATE MACHINE & 3D CAMERA
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
    this.cameraMode = 'follow'; // 'follow' (3D Zoomed Follow-Pawn) or 'full' (Full Board Overview)
    this._cardResolve = null;
    this._tradeOffer = null;
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
    this.cameraMode = 'follow';

    this.renderBoard();
    this.renderPlayersBar();
    this.updateUI();
    this.setCameraMode('follow');

    this.log(`🎮 Game started with ${this.players.length} players. Good luck!`);
    if (this.currentPlayer.isAI) {
      this.processAITurn();
    }
  }

  // ══════════════════════════════════════════
  // 3D CAMERA SYSTEM (FOLLOW PAWN / FULL BOARD)
  // ══════════════════════════════════════════
  toggleCameraView() {
    sound.playClick();
    const nextMode = this.cameraMode === 'follow' ? 'full' : 'follow';
    this.setCameraMode(nextMode);
    showToast(nextMode === 'follow' ? '🎥 Camera: 3D Follow Pawn View' : '🔲 Camera: Full Board Overview', 'info');
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    const rig = document.getElementById('board-camera-rig');
    const badge = document.getElementById('camera-mode-badge');
    const icon = document.getElementById('camera-icon');

    if (rig) {
      rig.classList.toggle('camera-follow', mode === 'follow');
      rig.classList.toggle('camera-full', mode === 'full');
    }

    if (badge) badge.textContent = mode === 'follow' ? '3D' : 'FULL';
    if (icon) icon.className = mode === 'follow' ? 'fas fa-video' : 'fas fa-table-cells';

    this.updateCameraPosition(this.currentPlayer?.position || 0);
  }

  updateCameraPosition(target) {
    const rig = document.getElementById('board-camera-rig');
    if (!rig) return;

    if (this.cameraMode === 'full') {
      rig.style.setProperty('--cam-pan-x', '0px');
      rig.style.setProperty('--cam-pan-y', '0px');
      return;
    }

    // Center view: focus directly on the dice and roll button in the board center
    if (target === 'center') {
      rig.style.setProperty('--cam-pan-x', '0px');
      rig.style.setProperty('--cam-pan-y', '0px');
      return;
    }

    // Space normalized coordinate math
    const spaceId = typeof target === 'number' ? target : 0;
    const pos = GRID_POSITIONS[spaceId] || { row: 11, col: 11 };
    
    let xFr = pos.col === 1 ? 0.675 : (pos.col === 11 ? 11.025 : (pos.col - 0.15));
    let yFr = pos.row === 1 ? 0.675 : (pos.row === 11 ? 11.025 : (pos.row - 0.15));

    let normX = (xFr / 11.7 - 0.5) * 2;
    let normY = (yFr / 11.7 - 0.5) * 2;

    const boardEl = document.getElementById('board');
    const size = boardEl && boardEl.offsetWidth > 0 ? boardEl.offsetWidth : 380;

    const panX = -normX * (size * 0.38);
    const panY = -normY * (size * 0.38);

    rig.style.setProperty('--cam-pan-x', `${Math.round(panX)}px`);
    rig.style.setProperty('--cam-pan-y', `${Math.round(panY)}px`);
  }

  toggleFullscreen() {
    sound.playClick();
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  // ══════════════════════════════════════════
  // BOARD RENDERING (MATCHING THE REFERENCE IMAGES)
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

      // Player pawns container inside each space
      spaceEl.innerHTML += `<div class="space-tokens" id="tokens-${space.id}"></div>`;

      // Space text content
      let priceLabel = '';
      if (space.price) priceLabel = `<span class="space-price">${CURRENCY} ${space.price}</span>`;
      else if (space.amount) priceLabel = `<span class="space-price">PAY ${CURRENCY} ${space.amount}</span>`;

      // Special icons matching image
      let iconDisplay = space.icon;
      if (space.type === 'station') iconDisplay = '🚅';
      else if (space.type === 'community') iconDisplay = '📦';
      else if (space.type === 'chance') iconDisplay = '🍀';
      else if (space.id === 10) iconDisplay = '🔒';
      else if (space.id === 20) iconDisplay = '🅿️';
      else if (space.id === 30) iconDisplay = '👨‍⚖️';

      spaceEl.innerHTML += `
        <div class="space-content">
          <span class="space-icon">${iconDisplay}</span>
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
      <!-- Antique World Map Watermark -->
      <div class="center-world-map"></div>

      <!-- Top Deck: 4-Leaf Clover Deck (Chance) -->
      <div class="deck-clover-card" onclick="showToast('Chance / Lucky Clover Deck', 'info')">
        <span class="deck-clover-icon">🍀</span>
      </div>

      <!-- Center 3D Dice Stage -->
      <div class="center-dice-stage">
        <div class="dice-container-3d">
          <div class="die-3d" id="die-1">1</div>
          <div class="die-3d" id="die-2">1</div>
        </div>
        <button class="btn-center-roll-3d" id="btn-roll-3d" onclick="game.rollDice()">🎲 ROLL DICE</button>
        <button class="btn-center-end-3d" id="btn-end-3d" onclick="game.endTurn()">END TURN ➡️</button>
      </div>

      <!-- Bottom Deck: Golden Treasure Chest (Community Chest) -->
      <div class="deck-chest-card" onclick="showToast('Community Treasure Chest Deck', 'info')">
        <span class="deck-chest-icon">📦</span>
      </div>
    `;

    board.appendChild(center);
  }

  // ══════════════════════════════════════════
  // PLAYERS TOP HUD BAR RENDERING
  // ══════════════════════════════════════════
  renderPlayersBar() {
    const bar = document.getElementById('players-panel');
    if (!bar) return;
    bar.innerHTML = '';

    this.players.forEach(p => {
      const card = document.createElement('div');
      card.className = `hud-player-card ${p.isBankrupt ? 'bankrupt' : ''}`;
      card.id = `hud-player-card-${p.id}`;
      card.style.setProperty('--card-color', p.color);

      const initial = p.name.charAt(0).toUpperCase();

      card.innerHTML = `
        <div class="hud-card-header" title="${p.name}">
          ${p.name}
        </div>
        <div class="hud-card-body">
          <div class="hud-avatar-frame" style="background:${p.color}">
            ${initial}
          </div>
          <div class="hud-pawn-preview" style="color:${p.color}">
            <i class="fa-solid ${p.tokenIcon || 'fa-chess-pawn'}"></i>
          </div>
        </div>
        <div class="hud-card-cash">
          <span class="dollar-symbol">${CURRENCY}</span>
          <span id="cash-val-${p.id}">${p.cash}</span>
        </div>
      `;
      bar.appendChild(card);
    });
  }

  // ══════════════════════════════════════════
  // UI UPDATE & STATE SYNC
  // ══════════════════════════════════════════
  updateUI() {
    const player = this.currentPlayer;
    if (!player) return;

    const rollBtn = document.getElementById('btn-roll-3d');
    const endBtn = document.getElementById('btn-end-3d');

    if (rollBtn) {
      rollBtn.disabled = this.turnPhase !== 'roll' || !this.isMyTurn;
      rollBtn.style.display = this.turnPhase === 'roll' ? 'block' : 'none';
      rollBtn.textContent = this.isMyTurn ? '🎲 ROLL DICE' : `⏳ ${player.name.toUpperCase()}`;
    }

    if (endBtn) {
      endBtn.classList.toggle('visible', this.turnPhase === 'done' && this.isMyTurn);
    }

    // Update active player highlight on Top HUD
    this.players.forEach(p => {
      const card = document.getElementById(`hud-player-card-${p.id}`);
      if (card) {
        card.classList.toggle('active-turn', p.id === this.currentPlayerIndex);
        card.classList.toggle('bankrupt', p.isBankrupt);
      }
      const cashEl = document.getElementById(`cash-val-${p.id}`);
      if (cashEl) cashEl.textContent = `${p.cash}`;
    });

    // Update board space owners & buildings
    BOARD_SPACES.forEach(space => {
      const prop = this.properties[space.id];
      if (!prop) return;
      const spaceEl = document.getElementById(`space-${space.id}`);
      if (!spaceEl) return;

      // Owner Pin Badge with token color
      let ownerPin = spaceEl.querySelector('.space-owner-pin');
      if (prop.owner !== null) {
        const owner = this.players[prop.owner];
        if (!ownerPin) {
          ownerPin = document.createElement('div');
          ownerPin.className = 'space-owner-pin';
          spaceEl.appendChild(ownerPin);
        }
        ownerPin.style.background = owner.color;
        ownerPin.title = `Owned by ${owner.name}`;
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

    // Render 3D Pawns
    this.renderTokens();

    // When it's roll phase and player's turn, center camera on dice and roll button
    if (this.turnPhase === 'roll' && this.isMyTurn) {
      this.updateCameraPosition('center');
    } else {
      this.updateCameraPosition(player.position);
    }
  }

  // ══════════════════════════════════════════
  // TOKEN RENDERING (DIRECT IN-SPACE ATTACHMENT)
  // ══════════════════════════════════════════
  renderTokens() {
    BOARD_SPACES.forEach(space => {
      const cont = document.getElementById(`tokens-${space.id}`);
      if (cont) cont.innerHTML = '';
    });

    const posGroups = {};
    this.activePlayers.forEach(p => {
      if (!posGroups[p.position]) posGroups[p.position] = [];
      posGroups[p.position].push(p);
    });

    Object.entries(posGroups).forEach(([posStr, playersAtPos]) => {
      const cont = document.getElementById(`tokens-${posStr}`);
      if (!cont) return;

      playersAtPos.forEach(p => {
        const token = document.createElement('div');
        token.className = `player-token ${p.id === this.currentPlayerIndex ? 'active-token' : ''}`;
        token.style.color = p.color;
        token.innerHTML = `<i class="fa-solid ${p.tokenIcon || 'fa-chess-pawn'}"></i>`;
        token.title = `${p.name}`;
        cont.appendChild(token);
      });
    });
  }

  // ══════════════════════════════════════════
  // DICE ROLLING & 3D ANIMATION
  // ══════════════════════════════════════════
  async rollDice() {
    const player = this.currentPlayer;
    if (this.turnPhase !== 'roll' || this.gameOver || (!this.isMyTurn && !player.isAI)) return;
    this.turnPhase = 'rolling';

    // Focus camera directly on dice while rolling
    this.updateCameraPosition('center');

    const die1 = document.getElementById('die-1');
    const die2 = document.getElementById('die-2');
    die1?.classList.add('rolling');
    die2?.classList.add('rolling');
    sound.playDiceRoll();

    for (let f = 0; f < 10; f++) {
      if (die1) die1.textContent = Math.ceil(Math.random() * 6);
      if (die2) die2.textContent = Math.ceil(Math.random() * 6);
      await delay(60);
    }

    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    this.lastDice = [d1, d2];
    if (die1) { die1.textContent = d1; die1.classList.remove('rolling'); }
    if (die2) { die2.textContent = d2; die2.classList.remove('rolling'); }

    const isDoubles = d1 === d2;
    const total = d1 + d2;
    this.log(`🎲 <strong>${player.name}</strong> rolled <strong>${d1} + ${d2} = ${total}</strong>${isDoubles ? ' (Doubles! 🎉)' : ''}`);

    if (this.isMultiplayer && mpClient) {
      mpClient.sendAction({ type: 'roll', dice: [d1, d2], isDoubles, total });
    }

    await delay(350); // Pause to see the rolled result

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

    // Camera now transitions smoothly to follow the active pawn hopping across the board
    await this.stepMovePlayer(player, total);

    // If doubles and not in jail, player rolls again
    if (isDoubles && !player.inJail && !this.gameOver) {
      this.log(`🎯 <strong>${player.name}</strong> gets another roll for doubles!`);
      this.turnPhase = 'roll';
      this.updateUI();
      if (player.isAI) await this.processAITurn();
    }
  }

  // ══════════════════════════════════════════
  // STEP-BY-STEP PAWN MOVEMENT WITH CAMERA FOLLOW
  // ══════════════════════════════════════════
  async stepMovePlayer(player, steps, isLocalTurn = true) {
    for (let s = 1; s <= steps; s++) {
      player.position = (player.position + 1) % 40;
      sound.playTokenStep();

      // Collect GO salary if passed
      if (player.position === 0) {
        player.cash += GO_SALARY;
        sound.playPassGo();
        this.log(`💵 <strong>${player.name}</strong> passed GO and collected ${CURRENCY} ${GO_SALARY}!`);
        this.showCashFloat(player, GO_SALARY);
      }

      this.renderTokens();
      this.updateCameraPosition(player.position);
      await delay(220);
    }

    this.updateUI();
    await delay(250);
    await this.landOnSpace(player, player.position, isLocalTurn);
  }

  async moveToPosition(player, targetPos, collectGo = true, isLocalTurn = true) {
    const oldPos = player.position;

    if (collectGo && targetPos < oldPos && targetPos !== JAIL_POSITION) {
      player.cash += GO_SALARY;
      this.log(`💵 <strong>${player.name}</strong> passed GO and collected ${CURRENCY} ${GO_SALARY}!`);
      this.showCashFloat(player, GO_SALARY);
    }

    player.position = targetPos;
    this.renderTokens();
    this.updateCameraPosition(targetPos);
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
        this.showBuyModal(player, space);
      } else {
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

  // ── Interactive Buy Modal (Exact Replica of Reference Image 2) ──
  showBuyModal(player, space) {
    sound.playCardDraw();
    this.turnPhase = 'action';

    const canAfford = player.cash >= space.price;
    const isStation = space.type === 'station';
    const isUtility = space.type === 'utility';

    let rentHtml = '';
    if (isStation) {
      rentHtml = `
        <div class="buy-card-rent-table">
          <div><strong>RENT</strong></div>
          <div>With 1 station: ₹25</div>
          <div>With 2 stations: ₹50</div>
          <div>With 3 stations: ₹100</div>
          <div>With 4 stations: ₹200</div>
          <div style="margin-top:2px; font-size:0.62rem; color:#64748b;">Mortgage value ₹${space.price / 2}</div>
        </div>
      `;
    } else if (isUtility) {
      rentHtml = `
        <div class="buy-card-rent-table">
          <div><strong>RENT</strong></div>
          <div>1 Utility: 4× Dice</div>
          <div>2 Utilities: 10× Dice</div>
          <div style="margin-top:2px; font-size:0.62rem; color:#64748b;">Mortgage value ₹${space.price / 2}</div>
        </div>
      `;
    } else if (space.rent) {
      rentHtml = `
        <div class="buy-card-rent-table">
          <div><strong>RENT</strong></div>
          <div>Site only: ₹${space.rent[0]}</div>
          <div>With 1 House: ₹${space.rent[1]}</div>
          <div>With 2 Houses: ₹${space.rent[2]}</div>
          <div>With Hotel: ₹${space.rent[5]}</div>
          <div style="margin-top:2px; font-size:0.62rem; color:#64748b;">Mortgage value ₹${space.price / 2}</div>
        </div>
      `;
    }

    const modalHtml = `
      <div class="buy-modal-popup" id="buy-modal-popup">
        <div class="buy-modal-header">
          FOR SALE - ${CURRENCY} ${space.price}
        </div>
        <div class="buy-modal-body">
          <div class="buy-card-preview">
            <div class="buy-card-title">${space.name}</div>
            <div style="font-size:1.4rem; margin:2px 0;">${space.icon}</div>
            ${rentHtml}
          </div>
          <div class="buy-modal-actions">
            <button class="btn-buy-confirm" ${!canAfford ? 'disabled' : ''} onclick="game.confirmBuyProperty(${space.id})">
              <i class="fas fa-plus"></i> BUY FOR ${CURRENCY} ${space.price}
            </button>
            <button class="btn-buy-pass" onclick="game.passBuyProperty(${space.id})">
              <i class="fas fa-gavel"></i> PASS / AUCTION
            </button>
          </div>
        </div>
      </div>
    `;

    showModal(modalHtml);
  }

  confirmBuyProperty(spaceId) {
    hideModal();
    const space = BOARD_SPACES[spaceId];
    this.buyProperty(this.currentPlayer, space);
    this.turnPhase = 'done';
    this.updateUI();
  }

  passBuyProperty(spaceId) {
    hideModal();
    this.log(`❌ <strong>${this.currentPlayer.name}</strong> passed on buying ${BOARD_SPACES[spaceId].name}.`);
    this.turnPhase = 'done';
    this.updateUI();
  }

  buyProperty(player, space) {
    if (player.cash < space.price) return;
    player.cash -= space.price;
    this.properties[space.id].owner = player.id;
    sound.playCash();
    this.showCashFloat(player, -space.price);
    this.log(`🏰 <strong>${player.name}</strong> bought <strong>${space.name}</strong> for ${CURRENCY} ${space.price}!`);

    if (this.isMultiplayer && mpClient && this.isMyTurn) {
      mpClient.sendAction({ type: 'buy', spaceId: space.id });
    }

    this.updateUI();
  }

  // ── Rent Calculation ──
  calculatePropertyRent(space, prop) {
    if (prop.houses > 0) return space.rent[prop.houses];
    const group = COLOR_GROUPS[space.group];
    const isMonopoly = group.properties.every(id => this.properties[id]?.owner === prop.owner && !this.properties[id]?.mortgaged);
    return isMonopoly ? space.rent[0] * 2 : space.rent[0];
  }

  countStationsOwned(playerId) {
    const stations = [5, 15, 25, 35];
    return stations.filter(id => this.properties[id]?.owner === playerId && !this.properties[id]?.mortgaged).length;
  }

  countUtilitiesOwned(playerId) {
    const utils = [12, 28];
    return utils.filter(id => this.properties[id]?.owner === playerId && !this.properties[id]?.mortgaged).length;
  }

  payRent(payer, receiver, amount, spaceName) {
    payer.cash -= amount;
    receiver.cash += amount;
    sound.playCash();
    this.showCashFloat(payer, -amount);
    this.showCashFloat(receiver, amount);
    this.log(`💸 <strong>${payer.name}</strong> paid ${CURRENCY} ${amount} rent to <strong>${receiver.name}</strong> for ${spaceName}!`);
    this.checkBankruptcy(payer);
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
      await this.stepMovePlayer(player, d1 + d2);
    } else {
      player.jailTurns++;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        player.cash -= JAIL_BAIL;
        player.inJail = false;
        player.jailTurns = 0;
        sound.playCash();
        this.showCashFloat(player, -JAIL_BAIL);
        this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${JAIL_BAIL} bail after 3 turns in jail.`);
        await this.stepMovePlayer(player, d1 + d2);
      } else {
        this.log(`🔒 <strong>${player.name}</strong> remains in Jail. (Turn ${player.jailTurns}/${MAX_JAIL_TURNS})`);
        this.turnPhase = 'done';
        this.updateUI();
        if (player.isAI) await this.aiEndTurn();
      }
    }
  }

  // ══════════════════════════════════════════
  // BUILD & UPGRADE SYSTEM
  // ══════════════════════════════════════════
  canBuildOnProperty(player, spaceId) {
    const space = BOARD_SPACES[spaceId];
    if (space.type !== 'property') return false;
    const group = COLOR_GROUPS[space.group];
    const prop = this.properties[spaceId];

    if (prop.owner !== player.id || prop.mortgaged) return false;
    if (prop.houses >= 5) return false;
    if (player.cash < group.buildCost) return false;

    // Must own all properties in the color group
    const allOwned = group.properties.every(id => this.properties[id]?.owner === player.id && !this.properties[id]?.mortgaged);
    if (!allOwned) return false;

    // Uniform building rule
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
            Cash: <strong style="color:#16a34a">${CURRENCY} ${player.cash}</strong>
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
  // PORTFOLIO / DEED BROWSER
  // ══════════════════════════════════════════
  openPortfolioMenu() {
    sound.playClick();
    const player = this.currentPlayer;
    const owned = [];

    Object.entries(this.properties).forEach(([id, prop]) => {
      if (prop.owner === player.id) {
        owned.push({ id: parseInt(id), space: BOARD_SPACES[id], prop });
      }
    });

    if (owned.length === 0) {
      showToast(`${player.name} does not own any properties yet!`, 'info');
      return;
    }

    const itemsHtml = owned.map(o => {
      const space = o.space;
      const groupColor = space.group ? COLOR_GROUPS[space.group]?.color : '#1e40af';
      const statusLabel = o.prop.mortgaged ? ' (Mortgaged)' : (o.prop.houses === 5 ? ' (Hotel 🏨)' : (o.prop.houses > 0 ? ` (${o.prop.houses} Houses 🏠)` : ''));

      return `
        <div class="deed-rent-row" style="padding:8px 6px; cursor:pointer; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:6px;"
             onclick="game.showSpaceInfo(${o.id})">
          <span>
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${groupColor};margin-right:6px"></span>
            <strong>${space.name}</strong>${statusLabel}
          </span>
          <span style="font-weight:800; color:#0284c7;">${CURRENCY} ${space.price}</span>
        </div>
      `;
    }).join('');

    showModal(`
      <div class="title-deed-card" style="max-width:360px;">
        <div class="deed-header" style="--deed-color: #0284c7;">
          <div class="deed-header-sub">PROPERTY PORTFOLIO</div>
          <div class="deed-header-title">${player.name}'s Deeds (${owned.length})</div>
        </div>
        <div class="deed-body">
          <div style="max-height:240px; overflow-y:auto; margin-bottom:12px;">
            ${itemsHtml}
          </div>
          <div class="deed-actions">
            <button class="btn btn-secondary btn-small" onclick="hideModal()">CLOSE</button>
          </div>
        </div>
      </div>
    `);
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

    if (!this._tradeOffer || this._tradeOffer.partnerId !== partner.id) {
      this._tradeOffer = {
        partnerId: partner.id,
        myProps: new Set(),
        myCash: 0,
        partnerProps: new Set(),
        partnerCash: 0
      };
    }

    const myOwnedProps = Object.entries(this.properties)
      .filter(([id, prop]) => prop.owner === player.id && prop.houses === 0)
      .map(([id]) => parseInt(id));

    const partnerOwnedProps = Object.entries(this.properties)
      .filter(([id, prop]) => prop.owner === partner.id && prop.houses === 0)
      .map(([id]) => parseInt(id));

    const partnerOptionsHtml = opponents.map(o => `
      <option value="${o.id}" ${o.id === partner.id ? 'selected' : ''}>
        ${o.name} — ${CURRENCY} ${o.cash}
      </option>
    `).join('');

    const myPropsHtml = myOwnedProps.length === 0 ? '<div style="font-size:0.75rem; color:#94a3b8; padding:6px 0;">No tradable properties</div>' :
      myOwnedProps.map(id => {
        const space = BOARD_SPACES[id];
        const groupColor = space.group ? COLOR_GROUPS[space.group]?.color : '#1e40af';
        const isSelected = this._tradeOffer.myProps.has(id);
        return `
          <div style="display:flex; justify-content:space-between; padding:5px 6px; background:${isSelected ? '#e0f2fe' : 'white'}; border:1px solid ${isSelected ? '#0284c7' : '#cbd5e1'}; border-radius:5px; font-size:0.75rem; cursor:pointer; margin-bottom:3px;"
               onclick="game.toggleTradeProp(${id}, 'my')">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${groupColor};margin-right:4px;"></span>${space.name}</span>
            <span>${isSelected ? '✅' : '➕'}</span>
          </div>
        `;
      }).join('');

    const partnerPropsHtml = partnerOwnedProps.length === 0 ? '<div style="font-size:0.75rem; color:#94a3b8; padding:6px 0;">No tradable properties</div>' :
      partnerOwnedProps.map(id => {
        const space = BOARD_SPACES[id];
        const groupColor = space.group ? COLOR_GROUPS[space.group]?.color : '#1e40af';
        const isSelected = this._tradeOffer.partnerProps.has(id);
        return `
          <div style="display:flex; justify-content:space-between; padding:5px 6px; background:${isSelected ? '#e0f2fe' : 'white'}; border:1px solid ${isSelected ? '#0284c7' : '#cbd5e1'}; border-radius:5px; font-size:0.75rem; cursor:pointer; margin-bottom:3px;"
               onclick="game.toggleTradeProp(${id}, 'partner')">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${groupColor};margin-right:4px;"></span>${space.name}</span>
            <span>${isSelected ? '✅' : '➕'}</span>
          </div>
        `;
      }).join('');

    showModal(`
      <div class="title-deed-card" style="max-width:400px;">
        <div class="deed-header" style="--deed-color: #f59e0b;">
          <div class="deed-header-sub">BUSINESS NEGOTIATOR</div>
          <div class="deed-header-title">Trade Properties &amp; Cash</div>
        </div>
        <div class="deed-body">
          <div style="margin-bottom:10px; display:flex; align-items:center; justify-content:space-between;">
            <label style="font-size:0.75rem; font-weight:800;">Trade With:</label>
            <select style="padding:4px 8px; border-radius:6px; font-family:'Space Grotesk',sans-serif; font-weight:700;"
                    onchange="game.openTradeMenu(parseInt(this.value, 10))">
              ${partnerOptionsHtml}
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:left;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px;">
              <div style="font-size:0.72rem; font-weight:800; color:#16a34a; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:4px;">🟢 You Offer</div>
              <input type="number" min="0" max="${player.cash}" value="${this._tradeOffer.myCash}" placeholder="₹ Cash"
                     style="width:100%; padding:4px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.75rem; margin-bottom:4px;"
                     oninput="game.updateTradeCash('my', this.value)" />
              <div style="max-height:120px; overflow-y:auto;">${myPropsHtml}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px;">
              <div style="font-size:0.72rem; font-weight:800; color:#0284c7; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:4px;">🔵 You Request</div>
              <input type="number" min="0" max="${partner.cash}" value="${this._tradeOffer.partnerCash}" placeholder="₹ Cash"
                     style="width:100%; padding:4px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.75rem; margin-bottom:4px;"
                     oninput="game.updateTradeCash('partner', this.value)" />
              <div style="max-height:120px; overflow-y:auto;">${partnerPropsHtml}</div>
            </div>
          </div>
          <div class="deed-actions" style="margin-top:12px;">
            <button class="btn btn-primary btn-small" onclick="game.submitTradeProposal()">🤝 PROPOSE</button>
            <button class="btn btn-secondary btn-small" onclick="hideModal()">CANCEL</button>
          </div>
        </div>
      </div>
    `);
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

    if (this._tradeOffer.myProps.size === 0 && this._tradeOffer.myCash === 0 &&
        this._tradeOffer.partnerProps.size === 0 && this._tradeOffer.partnerCash === 0) {
      showToast('Select at least one property or cash to trade!', 'warning');
      return;
    }

    hideModal();

    if (partner.isAI) {
      showToast(`Proposing trade to ${partner.name}...`, 'info');
      await delay(1000);
      const accepted = this.ai.evaluateTradeOffer(partner, player, Array.from(this._tradeOffer.myProps), this._tradeOffer.myCash, Array.from(this._tradeOffer.partnerProps), this._tradeOffer.partnerCash, this);
      if (accepted) {
        this.executeTrade(player.id, partner.id, Array.from(this._tradeOffer.myProps), this._tradeOffer.myCash, Array.from(this._tradeOffer.partnerProps), this._tradeOffer.partnerCash);
        showToast(`Trade Accepted by ${partner.name}! 🎉`, 'success');
      } else {
        showToast(`${partner.name} declined your trade proposal.`, 'warning');
        this.log(`❌ <strong>${partner.name}</strong> declined trade proposal from <strong>${player.name}</strong>.`);
      }
    }
  }

  executeTrade(fromPlayerId, toPlayerId, offeredPropIds, offeredCash, requestedPropIds, requestedCash) {
    const p1 = this.players[fromPlayerId];
    const p2 = this.players[toPlayerId];
    if (!p1 || !p2) return;

    p1.cash = p1.cash - offeredCash + requestedCash;
    p2.cash = p2.cash - requestedCash + offeredCash;

    offeredPropIds.forEach(id => {
      if (this.properties[id]) this.properties[id].owner = toPlayerId;
    });

    requestedPropIds.forEach(id => {
      if (this.properties[id]) this.properties[id].owner = fromPlayerId;
    });

    sound.playCash();
    this.log(`🤝 <strong>Trade Complete!</strong> <strong>${p1.name}</strong> and <strong>${p2.name}</strong> finalized a property trade!`);
    this.updateUI();
  }

  // ══════════════════════════════════════════
  // GAME MENU & RULES
  // ══════════════════════════════════════════
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
            <button class="btn btn-secondary" onclick="game.toggleCameraView(); hideModal();"><i class="fas fa-video"></i> Toggle 3D Camera</button>
            <button class="btn btn-secondary" onclick="game.toggleFullscreen(); hideModal();"><i class="fas fa-expand"></i> Fullscreen</button>
            <button class="btn btn-secondary" onclick="location.reload()"><i class="fas fa-home"></i> Quit to Main Menu</button>
          </div>
        </div>
      </div>
    `);
  }

  showGameRules() {
    sound.playClick();
    showModal(`
      <div class="title-deed-card" style="max-width:340px;">
        <div class="deed-header" style="--deed-color: #f59e0b;">
          <div class="deed-header-sub">QUICK GUIDE &amp; CONTROLS</div>
          <div class="deed-header-title">Business Board Rules</div>
        </div>
        <div class="deed-body" style="text-align:left; font-size:0.75rem; color:#334155; line-height:1.4;">
          <ul style="padding-left:16px; margin-bottom:12px;">
            <li>Pass <strong>GO</strong> to collect <strong>₹200</strong> salary.</li>
            <li>Tap <strong>Camera 🎥</strong> button at top right to switch between <strong>3D Follow View</strong> and <strong>Full Board</strong>.</li>
            <li>Own all properties of a color group to build <strong>Houses</strong> &amp; <strong>Hotels</strong>.</li>
            <li>Use the bottom action dock to <strong>Trade, Build, Sell, Mortgage</strong> and inspect your <strong>Portfolio</strong>!</li>
          </ul>
          <div class="deed-actions">
            <button class="btn btn-secondary btn-small" onclick="hideModal()">GOT IT</button>
          </div>
        </div>
      </div>
    `);
  }

  // ══════════════════════════════════════════
  // AI TURN PROCESSOR
  // ══════════════════════════════════════════
  async processAITurn() {
    if (this.isMultiplayer && !this.currentPlayer.isAI) return;
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
    } else if (this.isMultiplayer && this.isMyTurn) {
      sound.playPassGo();
      showToast("It's your turn!", 'success');
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
        <div class="card-draw-popup" style="--card-border-color: ${isChance ? '#84cc16' : '#3b82f6'};">
          <div class="card-draw-icon">${isChance ? '🍀' : '📦'}</div>
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
    const card = document.getElementById(`hud-player-card-${player.id}`);
    if (!card) return;

    const el = document.createElement('div');
    el.className = `cash-float ${amount > 0 ? 'gain' : 'loss'}`;
    el.textContent = `${amount > 0 ? '+' : ''}${CURRENCY} ${Math.abs(amount)}`;
    el.style.right = '4px';
    el.style.bottom = '-4px';
    card.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  log(msg) {
    this.logEntries.unshift(msg);
    if (this.logEntries.length > 50) this.logEntries.pop();
  }

  // ══════════════════════════════════════════
  // QUICK CHAT & REACTIONS
  // ══════════════════════════════════════════
  sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    sound.playClick();
    showToast(`You: ${text}`, 'info');

    if (this.isMultiplayer && mpClient) {
      mpClient.sendChat(text, null);
    }
  }

  sendQuickEmote(emoji) {
    sound.playClick();
    this.spawnFloatingEmote(emoji, this.myPlayerId ?? 0);

    if (this.isMultiplayer && mpClient) {
      mpClient.sendChat(null, emoji);
    }
  }

  spawnFloatingEmote(emoji, playerId) {
    const targetCard = document.getElementById(`hud-player-card-${playerId}`) || document.body;
    const rect = targetCard.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'floating-emote';
    el.textContent = emoji;
    el.style.left = `${rect.left + (rect.width / 2) - 16}px`;
    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}
