/* ============================================
   PBG Business Board Game — AI Opponent Logic
   Strategic decisions for Indian Business Board
   ============================================ */

class AIPlayer {
  constructor(difficulty = 'normal') {
    this.config = AI_DIFFICULTY[difficulty] || AI_DIFFICULTY.normal;
    this.difficulty = difficulty;
  }

  /** Simulate thinking delay */
  async think(minMs = 600, maxMs = 1200) {
    const ms = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Decide whether to buy a property / station / utility */
  shouldBuy(player, space, gameState) {
    if (player.cash < space.price) return false;

    const cashAfterBuy = player.cash - space.price;

    // Stations & Utilities
    if (space.type === 'station' || space.type === 'utility') {
      if (this.difficulty === 'hard') return cashAfterBuy >= 50;
      if (this.difficulty === 'normal') return cashAfterBuy >= 100 && Math.random() < 0.85;
      return Math.random() < 0.5 && cashAfterBuy >= 100;
    }

    // Standard Properties
    const groupSpaces = COLOR_GROUPS[space.group]?.properties || [];
    const ownedInGroup = groupSpaces.filter(id => {
      const prop = gameState.properties[id];
      return prop && prop.owner === player.id;
    }).length;

    // Hard AI: Complete group or keep reasonable buffer
    if (this.difficulty === 'hard') {
      if (ownedInGroup >= groupSpaces.length - 1) return true; // Monopoly opportunity
      if (cashAfterBuy >= 100) return true;
      return cashAfterBuy >= 50 && space.price <= 150;
    }

    // Normal AI
    if (this.difficulty === 'normal') {
      if (ownedInGroup >= groupSpaces.length - 1) return true;
      if (cashAfterBuy >= 150) return Math.random() < 0.9;
      if (cashAfterBuy >= 50) return Math.random() < 0.6;
      return false;
    }

    // Easy AI
    return Math.random() < this.config.buyThreshold && cashAfterBuy >= 50;
  }

  /** Decide whether to build a house/hotel on a property */
  shouldBuild(player, space, gameState) {
    const group = COLOR_GROUPS[space.group];
    if (!group) return false;
    if (player.cash < group.buildCost) return false;

    const cashAfterBuild = player.cash - group.buildCost;

    if (this.difficulty === 'hard') {
      return cashAfterBuild >= 100; // Aggressive building
    }
    if (this.difficulty === 'normal') {
      return cashAfterBuild >= 150 && Math.random() < 0.8;
    }
    return Math.random() < this.config.buildThreshold && cashAfterBuild >= 200;
  }

  /** Decide whether to pay jail bail or wait/roll */
  shouldPayBail(player, gameState) {
    if (player.cash < JAIL_BAIL) return false;
    if (player.jailTurns >= MAX_JAIL_TURNS - 1) return true; // forced

    if (this.difficulty === 'hard') {
      // Early game: pay bail to buy unowned properties
      const unownedCount = Object.values(gameState.properties).filter(p => p.owner === null).length;
      return unownedCount > 10 || player.cash > 400;
    }
    if (this.difficulty === 'normal') {
      return player.cash > 300 && player.jailTurns >= 1;
    }
    return Math.random() < 0.3;
  }
}
