/**
 * PBG Games Portal — Dynamic Filtering, Search & Modal Engine
 */

const GAMES_DATA = [
  {
    id: 'business-board',
    title: 'PBG Business Board',
    category: ['board', 'multiplayer', 'strategy'],
    status: 'live',
    rating: '4.9',
    plays: '2.4k',
    url: '/games/business-board/',
    icon: '🎲',
    accentColor: '#22d3ee',
    shortDesc: 'The iconic 40-space Indian Business mobile board game! Trade Mumbai, Delhi & Kolkata, build houses and hotels, roll doubles, and bankrupt opponents online or against smart AI.',
    tags: ['40 Indian Spaces', 'Houses & Hotels', 'Single & Multiplayer', 'Web Audio SFX', 'Lo-Fi Music'],
    playerCount: '2 – 4 Players',
    duration: '15 – 35 Mins',
    rulesSummary: [
      'Roll 2 dice to travel across 40 classic spaces including Indian cities, stations, utilities, and chance decks.',
      'Buy unowned properties and collect rent when opponents land on your spaces.',
      'Monopolize full color groups to build green houses and red hotels to increase rent exponentially.',
      'Enjoy custom Web Audio sound effects, dice tumble rattle, and lo-fi business lounge background music.',
      'Play solo against strategic AI or create a real-time room and invite real friends using a 6-letter room code!'
    ]
  },
  {
    id: 'chess-arena',
    title: 'PBG Chess Arena',
    category: ['strategy', 'multiplayer'],
    status: 'soon',
    rating: '4.8',
    plays: 'Beta Soon',
    url: '#',
    icon: '♟️',
    accentColor: '#a78bfa',
    shortDesc: 'Real-time chess duels with global Elo rankings, daily tactics puzzles, bullet/blitz/rapid time controls, and integrated Stockfish analysis.',
    tags: ['Ranked Elo', 'Blitz & Rapid', 'Puzzle Rush', 'Stockfish AI'],
    playerCount: '2 Players',
    duration: '3 – 10 Mins',
    rulesSummary: [
      'Standard FIDE Chess rules with real-time clock timers and premove support.',
      'Play casually with friends or battle ranked opponents to climb the PBG Leaderboards.'
    ]
  },
  {
    id: 'ludo-royale',
    title: 'PBG Ludo Royale',
    category: ['board', 'casual', 'multiplayer'],
    status: 'soon',
    rating: '4.7',
    plays: 'In Dev',
    url: '#',
    icon: '🎯',
    accentColor: '#fbbf24',
    shortDesc: 'The classic 4-player Ludo board game elevated with fast-roll rules, vibrant 3D tokens, voice chat reactions, and private room codes.',
    tags: ['2-4 Players', 'Quick Roll Mode', 'Custom Tokens', 'Voice Emotes'],
    playerCount: '2 – 4 Players',
    duration: '10 – 20 Mins',
    rulesSummary: [
      'Roll a 6 to release your tokens from the base and race around the cross board to home triangle.',
      'Capture opponent tokens to send them back to base and earn bonus rolls.'
    ]
  },
  {
    id: 'anime-trivia',
    title: 'Anime Trivia Showdown',
    category: ['arcade', 'multiplayer'],
    status: 'soon',
    rating: '4.9',
    plays: 'Coming Soon',
    url: '#',
    icon: '⚡',
    accentColor: '#f472b6',
    shortDesc: 'Fast-paced live buzzer trivia showdown with questions synced from the PBG Anime & Manga universe! Test who is the true anime connoisseur.',
    tags: ['Live Buzzers', 'PBG Anime Sync', 'Seasonal Quizzes', 'Streak Bonuses'],
    playerCount: '2 – 8 Players',
    duration: '5 – 15 Mins',
    rulesSummary: [
      'Compete in rounds of multiple-choice and fast-buzzer anime, manga, and gaming trivia.',
      'Earn points based on answer speed and consecutive streak multipliers.'
    ]
  },
  {
    id: 'card-tycoon',
    title: 'PBG Card Tycoon',
    category: ['card', 'strategy'],
    status: 'soon',
    rating: '4.6',
    plays: 'In Dev',
    url: '#',
    icon: '🃏',
    accentColor: '#34d399',
    shortDesc: 'Tactical deckbuilding and corporate card battles. Draft resources, trigger synergistic combos, and out-maneuver rival executives.',
    tags: ['Deck Building', 'Synergy Combos', 'PvP Duels', 'Card Collection'],
    playerCount: '2 Players',
    duration: '10 – 25 Mins',
    rulesSummary: [
      'Build your corporation deck with tech, finance, and media cards.',
      'Deploy tactical maneuvers and hostile takeovers to deplete your opponent’s market value.'
    ]
  }
];

document.addEventListener('DOMContentLoaded', () => {
  const gamesGrid = document.getElementById('games-grid');
  const searchInput = document.getElementById('game-search-input');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const modalBackdrop = document.getElementById('game-modal-backdrop');
  const modalContent = document.getElementById('modal-game-details');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let currentCategory = 'all';
  let currentSearchQuery = '';

  // Render Games
  function renderGames() {
    const filtered = GAMES_DATA.filter(game => {
      const matchesCategory = currentCategory === 'all' || game.category.includes(currentCategory);
      const matchesSearch = currentSearchQuery === '' ||
        game.title.toLowerCase().includes(currentSearchQuery) ||
        game.shortDesc.toLowerCase().includes(currentSearchQuery) ||
        game.tags.some(t => t.toLowerCase().includes(currentSearchQuery));
      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      gamesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: rgba(15, 23, 42, 0.6); border: 1px dashed var(--glass-border); border-radius: 16px;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 1.3rem; margin-bottom: 8px; color: white;">No games found</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">Try adjusting your search or switching filter categories.</p>
        </div>
      `;
      return;
    }

    gamesGrid.innerHTML = filtered.map(game => {
      const isLive = game.status === 'live';
      return `
        <div class="game-card" data-id="${game.id}">
          <div class="game-card-thumb">
            <div class="thumb-illustration">
              ${game.icon}
            </div>
            <div class="thumb-gradient"></div>
            ${isLive ? '<span class="game-badge-live"><i class="fas fa-play"></i> LIVE NOW</span>' : '<span class="game-badge-soon"><i class="fas fa-clock"></i> COMING SOON</span>'}
            <span class="game-rating-tag"><i class="fas fa-star"></i> ${game.rating}</span>
          </div>

          <div class="game-card-body">
            <h3 class="game-card-title">${game.title}</h3>
            <p class="game-card-desc">${game.shortDesc}</p>
            
            <div class="game-card-tags">
              ${game.tags.map(t => `<span class="game-tag">${t}</span>`).join('')}
            </div>

            <div class="game-card-actions">
              ${isLive ? `
                <a href="${game.url}" class="btn-card-play">
                  <i class="fas fa-play"></i> PLAY NOW
                </a>
              ` : `
                <span class="btn-card-disabled">
                  <i class="fas fa-lock"></i> COMING SOON
                </span>
              `}
              <button class="btn-card-details" onclick="openGameModal('${game.id}')" title="Game Overview & Rules">
                <i class="fas fa-circle-info"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderGames();
    });
  });

  // Search Input
  searchInput?.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    renderGames();
  });

  // Modal Open
  window.openGameModal = function(gameId) {
    const game = GAMES_DATA.find(g => g.id === gameId);
    if (!game) return;

    modalContent.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
        <div style="width:54px; height:54px; border-radius:14px; background:rgba(34,211,238,0.15); border:1px solid ${game.accentColor}; display:flex; align-items:center; justify-content:center; font-size:1.8rem;">
          ${game.icon}
        </div>
        <div>
          <h2 style="font-family:'Outfit', sans-serif; font-size:1.5rem; font-weight:800; color:white;">${game.title}</h2>
          <div style="display:flex; gap:10px; font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
            <span><i class="fas fa-users" style="color:var(--cyan-400)"></i> ${game.playerCount}</span>
            <span><i class="fas fa-stopwatch" style="color:var(--amber-400)"></i> ${game.duration}</span>
            <span><i class="fas fa-star" style="color:#eab308"></i> ${game.rating} (${game.plays})</span>
          </div>
        </div>
      </div>

      <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.6; margin-bottom:18px;">
        ${game.shortDesc}
      </p>

      <h4 style="font-family:'Outfit',sans-serif; font-size:1rem; font-weight:700; color:var(--cyan-400); margin-bottom:10px;">
        <i class="fas fa-scroll"></i> Key Rules &amp; Features:
      </h4>
      <ul style="padding-left:20px; margin-bottom:24px; color:var(--text-secondary); font-size:0.85rem; line-height:1.6;">
        ${game.rulesSummary.map(r => `<li style="margin-bottom:6px;">${r}</li>`).join('')}
      </ul>

      <div style="display:flex; gap:12px;">
        ${game.status === 'live' ? `
          <a href="${game.url}" class="btn-play-primary" style="flex:1; justify-content:center; padding:12px;">
            <i class="fas fa-play"></i> LAUNCH GAME NOW
          </a>
        ` : `
          <button class="btn-card-disabled" style="flex:1; justify-content:center; padding:12px;">
            <i class="fas fa-bell"></i> NOTIFY ON RELEASE
          </button>
        `}
        <button class="btn-hero-secondary" onclick="closeGameModal()" style="padding:12px 20px;">
          Close
        </button>
      </div>
    `;

    modalBackdrop.classList.add('active');
  };

  window.closeGameModal = function() {
    modalBackdrop.classList.remove('active');
  };

  modalCloseBtn?.addEventListener('click', closeGameModal);
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeGameModal();
  });

  // Initial Render
  renderGames();
});
