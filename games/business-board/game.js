/* ============================================
   PBG Business Board Game — Core Game Engine
   Classic Indian Business Board (40 spaces)
   Full building, mortgage, sell, and AI system
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

  // Mode Selection
  document.getElementById('btn-singleplayer')?.addEventListener('click', () => showScreen('setup-screen'));
  document.getElementById('btn-multiplayer')?.addEventListener('click', () => showScreen('lobby-screen'));
  document.getElementById('btn-setup-back')?.addEventListener('click', () => showScreen('landing-screen'));
  document.getElementById('btn-lobby-back')?.addEventListener('click', () => showScreen('landing-screen'));

  // Start Single Player Game
  document.getElementById('btn-start-game')?.addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value.trim() || 'Guddu';
    const aiCount = parseInt(document.getElementById('ai-count').value, 10) || 3;
    const aiDifficulty = document.getElementById('ai-difficulty').value || 'normal';
    startSinglePlayerGame(playerName, aiCount, aiDifficulty);
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (!game || game.gameOver) return;
    if (e.code === 'Space' && game.turnPhase === 'roll' && !game.currentPlayer.isAI) {
      e.preventDefault();
      game.rollDice();
    } else if (e.code === 'Enter' && game.turnPhase === 'done' && !game.currentPlayer.isAI) {
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
  const playerList = [{ ...PLAYER_TOKENS[0], name, isAI: false }];

  for (let i = 0; i < aiCount; i++) {
    const preset = PLAYER_TOKENS[(i + 1) % PLAYER_TOKENS.length];
    playerList.push({
      ...preset,
      id: i + 1,
      name: `${preset.name} (AI)`,
      isAI: true
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

    // Initialize all 40 properties
    this.properties = {};
    BOARD_SPACES.forEach(space => {
      if (space.type === 'property' || space.type === 'station' || space.type === 'utility') {
        this.properties[space.id] = {
          owner: null,
          houses: 0, // 0 = site only, 1-4 = houses, 5 = hotel
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
          <div class="player-pin-badge" style="background:${p.color}">📍</div>
        </div>
        <div class="player-status-info">
          <div class="player-name-label">${p.name}</div>
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

    // Center Status
    const statusEl = document.getElementById('center-status');
    const rollBtn = document.getElementById('btn-roll');
    const endBtn = document.getElementById('btn-end');

    if (statusEl) {
      if (player.inJail) {
        statusEl.textContent = `${player.name} is in Jail (Turn ${player.jailTurns + 1}/${MAX_JAIL_TURNS})`;
      } else if (this.turnPhase === 'roll') {
        statusEl.textContent = `${player.name}'s turn — Roll dice!`;
      } else if (this.turnPhase === 'done') {
        statusEl.textContent = `${player.name}'s turn is complete.`;
      } else {
        statusEl.textContent = `${player.name} is making moves...`;
      }
    }

    if (rollBtn) {
      rollBtn.disabled = this.turnPhase !== 'roll' || player.isAI;
      rollBtn.style.display = this.turnPhase === 'roll' ? 'block' : 'none';
    }

    if (endBtn) {
      endBtn.classList.toggle('visible', this.turnPhase === 'done' && !player.isAI);
    }

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

      // Owner Pin
      let ownerPin = spaceEl.querySelector('.space-owner-pin');
      if (prop.owner !== null) {
        const owner = this.players[prop.owner];
        if (!ownerPin) {
          ownerPin = document.createElement('div');
          ownerPin.className = 'space-owner-pin';
          spaceEl.appendChild(ownerPin);
        }
        ownerPin.style.background = owner.color;
        ownerPin.title = `Owned by ${owner.name}${prop.mortgaged ? ' (Mortgaged)' : ''}`;
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
  // TOKEN RENDERING ON BOARD
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
        token.textContent = p.id + 1;

        const count = playersAtPos.length;
        let offsetX = 0;
        let offsetY = 0;

        if (count === 2) {
          offsetX = idx === 0 ? -6 : 6;
        } else if (count >= 3) {
          offsetX = (idx % 2 === 0 ? -7 : 7);
          offsetY = (idx < 2 ? -7 : 7);
        }

        const left = rect.left - boardRect.left + (rect.width / 2) - 8 + offsetX;
        const top = rect.top - boardRect.top + (rect.height / 2) - 8 + offsetY;

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
    if (this.turnPhase !== 'roll' || this.gameOver) return;
    const player = this.currentPlayer;
    this.turnPhase = 'rolling';

    const die1 = document.getElementById('die-1');
    const die2 = document.getElementById('die-2');
    die1.classList.add('rolling');
    die2.classList.add('rolling');

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

  // ══════════════════════════════════════════
  // MOVEMENT ALONG 40 SPACES
  // ══════════════════════════════════════════
  async movePlayer(player, steps) {
    const oldPos = player.position;
    const newPos = (oldPos + steps) % 40;

    // Check if passed GO
    if (newPos < oldPos && newPos !== 0) {
      player.cash += GO_SALARY;
      this.log(`💵 <strong>${player.name}</strong> passed GO and collected ${CURRENCY} ${GO_SALARY}!`);
      this.showCashFloat(player, GO_SALARY);
    }

    player.position = newPos;
    this.updateUI();
    await delay(350);

    // Land on destination space
    await this.landOnSpace(player, newPos);
  }

  async moveToPosition(player, targetPos, collectGo = true) {
    const oldPos = player.position;

    if (collectGo && targetPos < oldPos && targetPos !== JAIL_POSITION) {
      player.cash += GO_SALARY;
      this.log(`💵 <strong>${player.name}</strong> passed GO and collected ${CURRENCY} ${GO_SALARY}!`);
      this.showCashFloat(player, GO_SALARY);
    }

    player.position = targetPos;
    this.updateUI();
    await delay(350);
    await this.landOnSpace(player, targetPos);
  }

  // ══════════════════════════════════════════
  // LAND ON SPACE HANDLER
  // ══════════════════════════════════════════
  async landOnSpace(player, spaceId) {
    const space = BOARD_SPACES[spaceId];
    this.log(`📍 <strong>${player.name}</strong> landed on <strong>${space.name}</strong>`);

    switch (space.type) {
      case 'property': await this.handleProperty(player, space); break;
      case 'station':  await this.handleStation(player, space); break;
      case 'utility':  await this.handleUtility(player, space); break;
      case 'chance':   await this.handleChance(player); break;
      case 'community':await this.handleCommunity(player); break;
      case 'tax':      await this.handleTax(player, space); break;
      case 'corner':   await this.handleCorner(player, space); break;
    }
  }

  // ── Property Space ──
  async handleProperty(player, space) {
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
        if (player.isAI) {
          await this.aiBuildPhase(player);
          await this.aiEndTurn();
        }
      } else {
        this.showBuyModal(player, space);
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
  async handleStation(player, space) {
    const prop = this.properties[space.id];

    if (prop.owner === null) {
      if (player.isAI) {
        const wantBuy = this.ai.shouldBuy(player, space, this);
        if (wantBuy) this.buyProperty(player, space);
        else this.log(`❌ <strong>${player.name}</strong> passed on ${space.name}.`);
        this.turnPhase = 'done';
        this.updateUI();
        if (player.isAI) await this.aiEndTurn();
      } else {
        this.showBuyModal(player, space);
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
  async handleUtility(player, space) {
    const prop = this.properties[space.id];

    if (prop.owner === null) {
      if (player.isAI) {
        const wantBuy = this.ai.shouldBuy(player, space, this);
        if (wantBuy) this.buyProperty(player, space);
        else this.log(`❌ <strong>${player.name}</strong> passed on ${space.name}.`);
        this.turnPhase = 'done';
        this.updateUI();
        if (player.isAI) await this.aiEndTurn();
      } else {
        this.showBuyModal(player, space);
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
  async handleChance(player) {
    const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
    await this.showCardModal(card, 'chance');
    await this.executeCardAction(player, card);
  }

  // ── Community Chest Space ──
  async handleCommunity(player) {
    const card = COMMUNITY_CHEST_CARDS[Math.floor(Math.random() * COMMUNITY_CHEST_CARDS.length)];
    await this.showCardModal(card, 'community');
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
      this.log(`🔓 <strong>${player.name}</strong> rolled doubles and escaped Jail!`);
      await this.movePlayer(player, d1 + d2);
    } else {
      player.jailTurns++;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        if (player.isAI || player.cash < JAIL_BAIL) {
          player.cash -= JAIL_BAIL;
          player.inJail = false;
          player.jailTurns = 0;
          this.showCashFloat(player, -JAIL_BAIL);
          this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${JAIL_BAIL} bail after 3 turns in jail.`);
          await this.movePlayer(player, d1 + d2);
        } else {
          this.showJailModal(player, d1 + d2, true);
        }
      } else {
        this.log(`🔒 <strong>${player.name}</strong> remains in Jail. (Turn ${player.jailTurns}/${MAX_JAIL_TURNS})`);
        if (player.isAI) {
          if (this.ai.shouldPayBail(player, this)) {
            player.cash -= JAIL_BAIL;
            player.inJail = false;
            player.jailTurns = 0;
            this.showCashFloat(player, -JAIL_BAIL);
            this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${JAIL_BAIL} bail.`);
            await this.movePlayer(player, d1 + d2);
            return;
          }
          this.turnPhase = 'done';
          this.updateUI();
          await this.aiEndTurn();
        } else {
          this.showJailModal(player, d1 + d2, false);
        }
      }
    }
  }

  showJailModal(player, diceSum, forced) {
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
    const player = this.currentPlayer;
    player.cash -= JAIL_BAIL;
    player.inJail = false;
    player.jailTurns = 0;
    this.showCashFloat(player, -JAIL_BAIL);
    this.log(`💸 <strong>${player.name}</strong> paid ${CURRENCY} ${JAIL_BAIL} bail.`);
    await this.movePlayer(player, diceSum);
  }

  stayInJail() {
    hideModal();
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
    this.showCashFloat(player, -space.price);
    this.log(`🏠 <strong>${player.name}</strong> bought <strong>${space.name}</strong> for ${CURRENCY} ${space.price}!`);
    this.updateUI();
  }

  showBuyModal(player, space) {
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
    const player = this.currentPlayer;
    const space = BOARD_SPACES[player.position];

    if (buy) {
      this.buyProperty(player, space);
    } else {
      this.log(`❌ <strong>${player.name}</strong> passed on buying ${space.name}.`);
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
      if (allOwned) return space.rent[0] * 2; // Monopoly doubles site rent
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
    this.showCashFloat(player, -group.buildCost);

    const bldgLabel = prop.houses === 5 ? 'a HOTEL 🏨' : `House ${prop.houses} 🏠`;
    this.log(`🏗️ <strong>${player.name}</strong> built ${bldgLabel} on <strong>${space.name}</strong> for ${CURRENCY} ${group.buildCost}!`);
    this.updateUI();
  }

  openBuildMenu() {
    const player = this.currentPlayer;
    if (player.isAI) return;

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
    const player = this.currentPlayer;
    if (player.isAI) return;

    // Find properties with houses
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
    this.showCashFloat(this.currentPlayer, refund);
    this.log(`🏠 <strong>${this.currentPlayer.name}</strong> sold a building on ${space.name} for +${CURRENCY} ${refund}`);
    this.updateUI();
  }

  openMortgageMenu() {
    const player = this.currentPlayer;
    if (player.isAI) return;

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
    this.showCashFloat(this.currentPlayer, val);
    this.log(`🏦 <strong>${this.currentPlayer.name}</strong> mortgaged ${space.name} for +${CURRENCY} ${val}`);
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
    this.showCashFloat(this.currentPlayer, -cost);
    this.log(`🏦 <strong>${this.currentPlayer.name}</strong> unmortgaged ${space.name} for -${CURRENCY} ${cost}`);
    this.updateUI();
  }

  openMenuModal() {
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
  // AI TURN PROCESSOR
  // ══════════════════════════════════════════
  async processAITurn() {
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
  endTurn() {
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

    this.currentPlayerIndex = next;
    this.turnPhase = 'roll';
    this.updateUI();

    if (this.currentPlayer.isAI) {
      this.processAITurn();
    }
  }

  // ══════════════════════════════════════════
  // BANKRUPTCY & VICTORY
  // ══════════════════════════════════════════
  checkBankruptcy(player) {
    if (player.cash < 0) {
      player.isBankrupt = true;
      player.cash = 0;
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
}
