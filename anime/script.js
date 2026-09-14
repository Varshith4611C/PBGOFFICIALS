/* ============================================
   PBG Anime — StreameX Frontend Controller
   Universal Logic for Home & Theatre Watch Page
   ============================================ */

const API_BASE = '/api/anime';

// ── Utility: API Fetch with error handling ──
async function apiFetch(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API Fetch Error:', err);
    return null;
  }
}

// ── Utility: Debounce ──
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Utility: Format timestamp to local 12-hour time (e.g. "08:30 PM") ──
function formatAirTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Utility: Format countdown (e.g. "in 3h 24m") ──
function formatCountdown(seconds) {
  if (seconds <= 0) return 'Aired';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

// ── Detect page mode ──
const isWatchPage = window.location.pathname.includes('watch');

// ============================================
// GLOBAL SEARCH & NAVBAR AUTOCOMPLETE (Desktop & Mobile)
// ============================================
function setupSearchHandler(inputEl, resultsEl) {
  if (!inputEl || !resultsEl) return;

  const handleLiveSearch = debounce(async (query) => {
    const q = query.trim();
    if (q.length < 2) {
      resultsEl.classList.remove('active');
      resultsEl.innerHTML = '';
      return;
    }

    const data = await apiFetch(`/search?q=${encodeURIComponent(q)}&perPage=6`);
    if (!data || !data.results || data.results.length === 0) {
      resultsEl.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No anime found for "${q}"
        </div>
      `;
      resultsEl.classList.add('active');
      return;
    }

    resultsEl.innerHTML = data.results.map(anime => `
      <a href="/anime/watch.html?id=${anime.id}&ep=1" class="search-result-item">
        <img src="${anime.coverImage || '/assets/images/logo.jpg'}" alt="${anime.title}" class="search-result-thumb" onerror="this.src='/assets/images/logo.jpg'" />
        <div class="search-result-info">
          <div class="search-result-title">${anime.title}</div>
          <div class="search-result-meta">
            <span>${anime.format || 'TV'}</span>
            ${anime.year ? `<span>• ${anime.year}</span>` : ''}
            ${anime.averageScore ? `<span style="color: #facc15;"><i class="fas fa-star" style="font-size: 0.7rem;"></i> ${anime.averageScore}</span>` : ''}
          </div>
        </div>
      </a>
    `).join('');

    resultsEl.classList.add('active');
  }, 250);

  inputEl.addEventListener('input', (e) => handleLiveSearch(e.target.value));

  // Search Enter key support for full results view
  inputEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const q = inputEl.value.trim();
      if (!q) return;
      resultsEl.classList.remove('active');

      if (!isWatchPage) {
        showFullSearchResults(q);
      } else {
        window.location.href = `/anime/?q=${encodeURIComponent(q)}`;
      }
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !resultsEl.contains(e.target)) {
      resultsEl.classList.remove('active');
    }
  });
}

const desktopSearchInput = document.getElementById('searchInput');
const desktopSearchResults = document.getElementById('searchResults');
setupSearchHandler(desktopSearchInput, desktopSearchResults);

const mobileSearchInput = document.getElementById('mobileSearchInput');
const mobileSearchResults = document.getElementById('mobileSearchResults');
setupSearchHandler(mobileSearchInput, mobileSearchResults);

// Mobile search drawer toggle
const mobileSearchBtn = document.getElementById('mobileSearchBtn');
const mobileSearchDrawer = document.getElementById('mobileSearchDrawer');
const mobileSearchClose = document.getElementById('mobileSearchClose');

if (mobileSearchBtn && mobileSearchDrawer) {
  mobileSearchBtn.addEventListener('click', () => {
    mobileSearchDrawer.classList.toggle('active');
    if (mobileSearchDrawer.classList.contains('active') && mobileSearchInput) {
      setTimeout(() => mobileSearchInput.focus(), 150);
    }
  });
}

if (mobileSearchClose && mobileSearchDrawer) {
  mobileSearchClose.addEventListener('click', () => {
    mobileSearchDrawer.classList.remove('active');
    if (mobileSearchResults) mobileSearchResults.classList.remove('active');
  });
}

// ── Popup & Redirect defense is handled by adguard.js ──

// ============================================
// HOMEPAGE LOGIC
// ============================================
if (!isWatchPage) {
  const homeSections = document.getElementById('homeSections');
  const searchSection = document.getElementById('searchSection');
  const searchQueryText = document.getElementById('searchQueryText');
  const searchGrid = document.getElementById('searchGrid');
  const closeSearchBtn = document.getElementById('closeSearchBtn');

  // Hero Carousel Elements
  const heroSlidesContainer = document.getElementById('heroSlidesContainer');
  const heroPrevBtn = document.getElementById('heroPrevBtn');
  const heroNextBtn = document.getElementById('heroNextBtn');
  const heroIndicators = document.getElementById('heroIndicators');
  let heroSlides = [];
  let currentHeroIndex = 0;
  let heroTimer = null;

  // Airing Schedule Elements
  const scheduleTabs = document.getElementById('scheduleTabs');
  const scheduleGrid = document.getElementById('scheduleGrid');

  // Trending & Popular Carousels
  const trendingCarousel = document.getElementById('trendingCarousel');
  const trendingPrevBtn = document.getElementById('trendingPrevBtn');
  const trendingNextBtn = document.getElementById('trendingNextBtn');

  const popularCarousel = document.getElementById('popularCarousel');
  const popularPrevBtn = document.getElementById('popularPrevBtn');
  const popularNextBtn = document.getElementById('popularNextBtn');

  // Top 10 Lists
  const topAiringList = document.getElementById('topAiringList');
  const mostPopularList = document.getElementById('mostPopularList');

  // ── Full Search Results Function ──
  async function showFullSearchResults(q) {
    if (!searchSection || !homeSections) return;
    homeSections.style.display = 'none';
    searchSection.style.display = 'block';
    searchQueryText.textContent = q;
    searchGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-secondary);">
        <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--accent-purple); margin-bottom: 10px;"></i>
        <p>Searching anime library...</p>
      </div>
    `;

    const data = await apiFetch(`/search?q=${encodeURIComponent(q)}&perPage=24`);
    if (!data || !data.results || data.results.length === 0) {
      searchGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
          No results found for "${q}". Try another search term.
        </div>
      `;
      return;
    }

    searchGrid.innerHTML = data.results.map(anime => `
      <a href="/anime/watch.html?id=${anime.id}&ep=1" class="schedule-card" title="${anime.title}">
        <img src="${anime.coverImage || '/assets/images/logo.jpg'}" alt="${anime.title}" class="schedule-card-thumb" onerror="this.src='/assets/images/logo.jpg'" />
        <div class="schedule-card-info">
          <div class="schedule-card-header">
            <span class="schedule-time">${anime.year || 'Anime'}</span>
            ${anime.averageScore ? `<span class="schedule-status aired">★ ${anime.averageScore}</span>` : ''}
          </div>
          <div class="schedule-card-title">${anime.title}</div>
          <div class="schedule-card-footer">
            <span class="ep-badge">${anime.format || 'TV'}</span>
            <span>${anime.genres ? anime.genres.slice(0, 2).join(', ') : ''}</span>
          </div>
        </div>
      </a>
    `).join('');
  }

  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      searchSection.style.display = 'none';
      homeSections.style.display = 'block';
      if (searchInput) searchInput.value = '';
    });
  }

  // ── 1. Init Featured Hero Carousel ──
  async function initHeroCarousel() {
    if (!heroSlidesContainer) return;
    const data = await apiFetch('/trending?perPage=8');
    if (!data || !data.results || data.results.length === 0) return;

    // Filter anime with nice banner images or good cover
    const items = data.results.filter(a => a.bannerImage || a.coverImage).slice(0, 6);
    if (items.length === 0) return;

    heroSlidesContainer.innerHTML = items.map((anime, idx) => {
      const banner = anime.bannerImage || anime.coverImage;
      const score = anime.averageScore || '8.0';
      const year = anime.year || '2026';
      const format = anime.format || 'TV';
      const epCount = anime.episodes ? `${anime.episodes} Episodes` : 'Releasing';
      const synopsis = anime.description || 'Watch now on PBG Anime in high definition with multi-server options.';

      return `
        <div class="hero-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
          <img src="${banner}" alt="${anime.title}" class="hero-backdrop" onerror="this.src='${anime.coverImage}'" />
          <div class="hero-overlay"></div>
          <div class="hero-content">
            <div class="hero-badges-row">
              <span class="badge-pill score-pill"><i class="fas fa-star"></i> ${score}</span>
              <span class="badge-pill">${format}</span>
              <span class="badge-pill">${year}</span>
              <span class="badge-pill">${epCount}</span>
              ${anime.status === 'RELEASING' ? '<span class="badge-pill releasing-pill">Airing Now</span>' : ''}
            </div>
            <h1 class="hero-title">${anime.title}</h1>
            <p class="hero-synopsis">${synopsis}</p>
            <div class="hero-actions">
              <a href="/anime/watch.html?id=${anime.id}&ep=1" class="btn-watch-now">
                <i class="fas fa-play"></i> Watch Now
              </a>
              <a href="/anime/watch.html?id=${anime.id}&ep=1" class="btn-secondary-pill">
                <i class="fas fa-info-circle"></i> Details
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Indicators
    if (heroIndicators) {
      heroIndicators.innerHTML = items.map((_, idx) => `
        <div class="indicator-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>
      `).join('');

      heroIndicators.querySelectorAll('.indicator-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          goToHeroSlide(parseInt(dot.dataset.index));
        });
      });
    }

    heroSlides = heroSlidesContainer.querySelectorAll('.hero-slide');
    startHeroTimer();

    if (heroPrevBtn) {
      heroPrevBtn.addEventListener('click', () => {
        goToHeroSlide((currentHeroIndex - 1 + heroSlides.length) % heroSlides.length);
      });
    }

    if (heroNextBtn) {
      heroNextBtn.addEventListener('click', () => {
        goToHeroSlide((currentHeroIndex + 1) % heroSlides.length);
      });
    }

    // Touch swipe support for mobile
    if (heroSlidesContainer) {
      let touchStartX = 0;
      let touchEndX = 0;
      heroSlidesContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      heroSlidesContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 40) {
          if (diff < 0) {
            goToHeroSlide((currentHeroIndex + 1) % heroSlides.length);
          } else {
            goToHeroSlide((currentHeroIndex - 1 + heroSlides.length) % heroSlides.length);
          }
        }
      }, { passive: true });
    }
  }

  function goToHeroSlide(index) {
    if (!heroSlides || heroSlides.length === 0) return;
    heroSlides[currentHeroIndex].classList.remove('active');
    const dots = heroIndicators ? heroIndicators.querySelectorAll('.indicator-dot') : [];
    if (dots[currentHeroIndex]) dots[currentHeroIndex].classList.remove('active');

    currentHeroIndex = index;
    heroSlides[currentHeroIndex].classList.add('active');
    if (dots[currentHeroIndex]) dots[currentHeroIndex].classList.add('active');

    startHeroTimer();
  }

  function startHeroTimer() {
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => {
      if (heroSlides.length > 0) {
        goToHeroSlide((currentHeroIndex + 1) % heroSlides.length);
      }
    }, 6000);
  }

  // ── 2. Init StreameX 7-Day Airing Schedule ──
  async function initAiringSchedule() {
    if (!scheduleTabs || !scheduleGrid) return;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const currentDayIdx = now.getDay();

    // Create 7 days centered or from Mon to Sun
    // Let's create from 3 days ago to 3 days ahead, or today at center
    const dayPills = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const dayName = days[d.getDay()];
      const isToday = offset === 0;
      dayPills.push({
        offset,
        dayName,
        dateStr: `${d.getMonth() + 1}/${d.getDate()}`,
        isToday,
      });
    }

    scheduleTabs.innerHTML = dayPills.map(p => `
      <button class="schedule-day-pill ${p.isToday ? 'active' : ''}" data-offset="${p.offset}">
        <span>${p.dayName}</span>
        <span style="font-size: 0.72rem; color: var(--text-muted);">${p.dateStr}</span>
        ${p.isToday ? '<span class="today-tag">Today</span>' : ''}
      </button>
    `).join('');

    // Load initial schedule for Today (offset 0)
    await loadScheduleForOffset(0);

    // Tab click listeners
    scheduleTabs.querySelectorAll('.schedule-day-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        scheduleTabs.querySelectorAll('.schedule-day-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadScheduleForOffset(parseInt(btn.dataset.offset));
      });
    });
  }

  async function loadScheduleForOffset(offset) {
    scheduleGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-secondary);">
        <i class="fas fa-spinner fa-spin" style="color: var(--accent-purple);"></i> Loading schedule...
      </div>
    `;

    const data = await apiFetch(`/schedule?dayOffset=${offset}`);
    if (!data || !data.schedules || data.schedules.length === 0) {
      scheduleGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
          No anime scheduled for broadcast on this date.
        </div>
      `;
      return;
    }

    const isMobile = window.innerWidth <= 768;
    const initialLimit = isMobile ? 6 : data.schedules.length;
    let isExpanded = false;

    function renderScheduleItems(showAll) {
      const itemsToRender = (showAll || !isMobile) ? data.schedules : data.schedules.slice(0, initialLimit);
      const cardsHtml = itemsToRender.map(item => {
        const timeStr = formatAirTime(item.airingAt);
        const statusClass = item.isAired ? 'aired' : 'countdown';
        const statusText = item.isAired ? 'Aired' : formatCountdown(item.timeUntilAiring);

        return `
          <a href="/anime/watch.html?id=${item.media.id}&ep=${item.episode}" class="schedule-card" title="${item.media.title}">
            <img src="${item.media.coverImage || '/assets/images/logo.jpg'}" alt="${item.media.title}" class="schedule-card-thumb" onerror="this.src='/assets/images/logo.jpg'" />
            <div class="schedule-card-info">
              <div class="schedule-card-header">
                <span class="schedule-time"><i class="far fa-clock" style="font-size: 0.72rem; margin-right: 4px;"></i>${timeStr}</span>
                <span class="schedule-status ${statusClass}">${statusText}</span>
              </div>
              <div class="schedule-card-title">${item.media.title}</div>
              <div class="schedule-card-footer">
                <span class="ep-badge">EP ${item.episode}</span>
                <span>${item.media.format || 'TV'}</span>
                ${item.media.averageScore ? `<span style="color: #facc15; margin-left: auto;">★ ${item.media.averageScore}</span>` : ''}
              </div>
            </div>
          </a>
        `;
      }).join('');

      let toggleBtnHtml = '';
      if (isMobile && data.schedules.length > initialLimit) {
        toggleBtnHtml = `
          <button class="schedule-toggle-btn" id="scheduleToggleBtn" type="button">
            ${showAll
            ? '<span>Show Less</span> <i class="fas fa-chevron-up"></i>'
            : `<span>Show ${data.schedules.length - initialLimit} More Shows</span> <i class="fas fa-chevron-down"></i>`}
          </button>
        `;
      }

      scheduleGrid.innerHTML = cardsHtml + toggleBtnHtml;

      const toggleBtn = document.getElementById('scheduleToggleBtn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          isExpanded = !isExpanded;
          renderScheduleItems(isExpanded);
        });
      }
    }

    renderScheduleItems(false);
  }

  // ── 3. Init Trending & Popular Carousels ──
  function renderPosterCards(container, items) {
    if (!container) return;
    container.innerHTML = items.map(anime => `
      <a href="/anime/watch.html?id=${anime.id}&ep=1" class="anime-poster-card" title="${anime.title}">
        <div class="poster-media">
          <img src="${anime.coverImage || '/assets/images/logo.jpg'}" alt="${anime.title}" loading="lazy" onerror="this.src='/assets/images/logo.jpg'" />
          ${anime.averageScore ? `<span class="card-top-pill score"><i class="fas fa-star" style="font-size: 0.65rem;"></i> ${anime.averageScore}</span>` : ''}
          <span class="card-top-pill format">${anime.format || 'TV'}</span>
          <div class="poster-overlay">
            <div class="play-circle"><i class="fas fa-play"></i></div>
          </div>
        </div>
        <div class="poster-title">${anime.title}</div>
        <div class="poster-sub">
          <span>${anime.year || 'Anime'}</span>
          ${anime.episodes ? `<span>${anime.episodes} eps</span>` : '<span>Airing</span>'}
        </div>
      </a>
    `).join('');
  }

  async function initCarousels() {
    // Trending
    if (trendingCarousel) {
      const data = await apiFetch('/trending?perPage=15');
      if (data && data.results) {
        renderPosterCards(trendingCarousel, data.results);
      }
    }

    // Popular
    if (popularCarousel) {
      const data = await apiFetch('/popular?perPage=15');
      if (data && data.results) {
        renderPosterCards(popularCarousel, data.results);
      }
    }

    // Arrow button horizontal scrolling
    if (trendingPrevBtn && trendingCarousel) {
      trendingPrevBtn.addEventListener('click', () => trendingCarousel.scrollBy({ left: -450, behavior: 'smooth' }));
    }
    if (trendingNextBtn && trendingCarousel) {
      trendingNextBtn.addEventListener('click', () => trendingCarousel.scrollBy({ left: 450, behavior: 'smooth' }));
    }

    if (popularPrevBtn && popularCarousel) {
      popularPrevBtn.addEventListener('click', () => popularCarousel.scrollBy({ left: -450, behavior: 'smooth' }));
    }
    if (popularNextBtn && popularCarousel) {
      popularNextBtn.addEventListener('click', () => popularCarousel.scrollBy({ left: 450, behavior: 'smooth' }));
    }
  }

  // ── 4. Init Ranked Top 10 Lists ──
  async function initTop10() {
    if (!topAiringList || !mostPopularList) return;
    const data = await apiFetch('/top-10');
    if (!data) return;

    const renderRankedList = (container, list) => {
      container.innerHTML = list.map(item => {
        const rankStr = String(item.rank).padStart(2, '0');
        const topClass = item.rank <= 3 ? `top${item.rank}` : '';
        const genres = item.genres ? item.genres.slice(0, 2).join(' • ') : '';

        return `
          <a href="/anime/watch.html?id=${item.id}&ep=1" class="ranked-item" title="${item.title}">
            <div class="rank-number ${topClass}">${rankStr}</div>
            <img src="${item.coverImage || '/assets/images/logo.jpg'}" alt="${item.title}" class="ranked-thumb" onerror="this.src='/assets/images/logo.jpg'" />
            <div class="ranked-info">
              <div class="ranked-title">${item.title}</div>
              <div class="ranked-meta">
                <span>${item.format || 'TV'}</span>
                ${item.episodes ? `<span>• ${item.episodes} eps</span>` : ''}
                ${item.averageScore ? `<span class="ranked-score">★ ${item.averageScore}</span>` : ''}
              </div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${genres}</div>
            </div>
          </a>
        `;
      }).join('');
    };

    if (data.topAiring) renderRankedList(topAiringList, data.topAiring);
    if (data.mostPopular) renderRankedList(mostPopularList, data.mostPopular);

    // Mobile Switcher Tabs
    const rankedTabsMobile = document.getElementById('rankedTabsMobile');
    if (rankedTabsMobile) {
      rankedTabsMobile.querySelectorAll('.ranked-tab-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          rankedTabsMobile.querySelectorAll('.ranked-tab-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const targetColId = btn.dataset.col;
          document.querySelectorAll('.ranked-column').forEach(col => col.classList.remove('active-col'));
          const targetCol = document.getElementById(targetColId);
          if (targetCol) targetCol.classList.add('active-col');
        });
      });
    }
  }

  // Run homepage loaders
  initHeroCarousel();
  initAiringSchedule();
  initCarousels();
  initTop10();

  // If URL has ?q= query from another page, trigger search automatically
  const urlParams = new URLSearchParams(window.location.search);
  const qParam = urlParams.get('q');
  if (qParam) {
    if (searchInput) searchInput.value = qParam;
    showFullSearchResults(qParam);
  }
}

// ============================================
// WATCH PAGE LOGIC (StreameX Theatre Player)
// ============================================
if (isWatchPage) {
  const urlParams = new URLSearchParams(window.location.search);
  let currentAnimeId = urlParams.get('id') || '21'; // Default: One Piece (AniList ID 21)
  let currentEpisode = parseInt(urlParams.get('ep') || urlParams.get('e') || '1');
  let currentSeason = parseInt(urlParams.get('s') || '1');
  let currentServer = urlParams.get('server') || 'main-sub';

  // DOM Elements
  const watchAnimeHeader = document.getElementById('watchAnimeHeader');
  const watchEpisodeHeader = document.getElementById('watchEpisodeHeader');
  const nowPlayingBadge = document.getElementById('nowPlayingBadge');
  const playerIframe = document.getElementById('playerIframe');
  const playerLoading = document.getElementById('playerLoading');
  const serversGridList = document.getElementById('serversGridList');
  const prevEpBtn = document.getElementById('prevEpBtn');
  const nextEpBtn = document.getElementById('nextEpBtn');

  // Sidebar Elements
  const metadataPoster = document.getElementById('metadataPoster');
  const metadataTitle = document.getElementById('metadataTitle');
  const metadataDesc = document.getElementById('metadataDesc');
  const metadataGenres = document.getElementById('metadataGenres');
  const sidebarScoreBadge = document.getElementById('sidebarScoreBadge');
  const sidebarStatusVal = document.getElementById('sidebarStatusVal');
  const sidebarStudioVal = document.getElementById('sidebarStudioVal');
  const sidebarAiredVal = document.getElementById('sidebarAiredVal');

  const recommendationsCarousel = document.getElementById('recommendationsCarousel');
  const relPrevBtn = document.getElementById('relPrevBtn');
  const relNextBtn = document.getElementById('relNextBtn');

  const sidebarEpCount = document.getElementById('sidebarEpCount');
  const seasonSelector = document.getElementById('seasonSelector');
  const epFilterInput = document.getElementById('epFilterInput');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const episodesGridContainer = document.getElementById('episodesGridContainer');
  const episodesListContainer = document.getElementById('episodesListContainer');

  let animeDetails = null;
  let totalEpisodesCount = 1;
  let serverList = [];

  // ── Load Anime Info & Episode Count ──
  async function loadAnimeInfo() {
    const data = await apiFetch(`/info/${currentAnimeId}`);
    if (!data) return;
    animeDetails = data;

    // Set page titles
    document.title = `Watch ${data.title} Episode ${currentEpisode} — PBG Anime`;
    if (watchAnimeHeader) watchAnimeHeader.textContent = data.title;
    if (watchEpisodeHeader) watchEpisodeHeader.textContent = `Episode ${currentEpisode}`;
    if (nowPlayingBadge) {
      nowPlayingBadge.innerHTML = `<i class="fas fa-circle-play" style="color: var(--accent-purple);"></i> <span>Now Playing • Episode ${currentEpisode}</span>`;
    }

    // Set Sidebar Info
    if (metadataTitle) metadataTitle.textContent = data.title;
    if (metadataPoster) {
      metadataPoster.src = data.coverImage || data.bannerImage || '/assets/images/logo.jpg';
      metadataPoster.style.display = 'block';
    }
    if (sidebarScoreBadge) {
      sidebarScoreBadge.textContent = data.averageScore ? `★ ${data.averageScore}` : '★ 8.0';
    }
    if (sidebarStatusVal) {
      sidebarStatusVal.textContent = data.status || 'Ongoing';
    }
    if (sidebarStudioVal) {
      sidebarStudioVal.textContent = data.studio || 'Unknown Studio';
    }
    if (sidebarAiredVal) {
      sidebarAiredVal.textContent = data.releaseDate || data.season || '1999-10-20';
    }
    if (metadataDesc) {
      metadataDesc.textContent = data.description || 'No synopsis available.';
    }
    if (metadataGenres && data.genres) {
      metadataGenres.innerHTML = data.genres.map(g => `<span class="genre-tag">${g}</span>`).join('');
    }

    // Set Recommendations Carousel
    if (recommendationsCarousel && data.recommendations && data.recommendations.length > 0) {
      recommendationsCarousel.innerHTML = data.recommendations.map(r => `
        <a href="/anime/watch.html?id=${r.id}&ep=1" class="anime-poster-card" style="flex: 0 0 140px;" title="${r.title}">
          <div class="poster-media">
            <img src="${r.coverImage || '/assets/images/logo.jpg'}" alt="${r.title}" loading="lazy" onerror="this.src='/assets/images/logo.jpg'" />
            ${r.averageScore ? `<span class="card-top-pill score">★ ${r.averageScore}</span>` : ''}
            <div class="poster-overlay"><div class="play-circle" style="width: 36px; height: 36px; font-size: 0.9rem;"><i class="fas fa-play"></i></div></div>
          </div>
          <div class="poster-title" style="font-size: 0.82rem;">${r.title}</div>
        </a>
      `).join('');
    }

    if (relPrevBtn && recommendationsCarousel) {
      relPrevBtn.onclick = () => recommendationsCarousel.scrollBy({ left: -360, behavior: 'smooth' });
    }
    if (relNextBtn && recommendationsCarousel) {
      relNextBtn.onclick = () => recommendationsCarousel.scrollBy({ left: 360, behavior: 'smooth' });
    }

    // Setup episodes & seasons
    totalEpisodesCount = Math.max(1, data.totalEpisodes || data.episodes || 1);
    if (sidebarEpCount) sidebarEpCount.textContent = `${totalEpisodesCount} Eps`;

    setupSeasonsAndEpisodes();
  }

  // ── Setup Seasons & Episode Buttons ──
  function setupSeasonsAndEpisodes() {
    if (!seasonSelector) return;

    // If series is long (e.g. > 100 episodes), break into batches of 100
    if (totalEpisodesCount > 100) {
      const batchCount = Math.ceil(totalEpisodesCount / 100);
      seasonSelector.innerHTML = Array.from({ length: batchCount }, (_, idx) => {
        const start = idx * 100 + 1;
        const end = Math.min((idx + 1) * 100, totalEpisodesCount);
        return `<option value="${idx + 1}">Episodes ${start} - ${end}</option>`;
      }).join('');

      // Auto-select the batch that contains currentEpisode
      const activeBatch = Math.floor((currentEpisode - 1) / 100) + 1;
      seasonSelector.value = String(activeBatch);

      seasonSelector.onchange = () => {
        const batch = parseInt(seasonSelector.value);
        renderEpisodeButtons((batch - 1) * 100 + 1, Math.min(batch * 100, totalEpisodesCount));
      };

      const start = (activeBatch - 1) * 100 + 1;
      const end = Math.min(activeBatch * 100, totalEpisodesCount);
      renderEpisodeButtons(start, end);
    } else {
      seasonSelector.innerHTML = `<option value="1">Season 1 (${totalEpisodesCount} Eps)</option>`;
      renderEpisodeButtons(1, totalEpisodesCount);
    }
  }

  function renderEpisodeButtons(startEp, endEp, filterQuery = '') {
    if (!episodesGridContainer || !episodesListContainer) return;

    const eps = [];
    for (let i = startEp; i <= endEp; i++) {
      if (filterQuery) {
        if (!String(i).includes(filterQuery)) continue;
      }
      eps.push(i);
    }

    // Render Grid View
    episodesGridContainer.innerHTML = eps.map(num => `
      <button class="ep-grid-btn ${num === currentEpisode ? 'active' : ''}" data-ep="${num}">
        ${num}
      </button>
    `).join('');

    // Render List View
    episodesListContainer.innerHTML = eps.map(num => `
      <button class="ep-list-btn ${num === currentEpisode ? 'active' : ''}" data-ep="${num}">
        <span>Episode ${num}</span>
        ${num === currentEpisode ? '<span class="today-tag" style="background: var(--accent-purple); color: #fff;">Playing</span>' : ''}
      </button>
    `).join('');

    // Attach click listeners to episode buttons
    const attachListeners = (container) => {
      container.querySelectorAll('button[data-ep]').forEach(btn => {
        btn.addEventListener('click', () => {
          const ep = parseInt(btn.dataset.ep);
          switchEpisode(ep);
        });
      });
    };

    attachListeners(episodesGridContainer);
    attachListeners(episodesListContainer);
  }

  // ── Episode Filter / Search ──
  if (epFilterInput) {
    epFilterInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      const batch = parseInt(seasonSelector?.value || '1');
      const start = totalEpisodesCount > 100 ? (batch - 1) * 100 + 1 : 1;
      const end = totalEpisodesCount > 100 ? Math.min(batch * 100, totalEpisodesCount) : totalEpisodesCount;
      renderEpisodeButtons(start, end, q);
    });

    epFilterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const ep = parseInt(epFilterInput.value.trim());
        if (ep >= 1 && ep <= totalEpisodesCount) {
          switchEpisode(ep);
          epFilterInput.value = '';
        }
      }
    });
  }

  // ── View Mode Toggle: Grid vs List ──
  if (viewGridBtn && viewListBtn) {
    viewGridBtn.addEventListener('click', () => {
      viewGridBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      episodesGridContainer.style.display = 'grid';
      episodesListContainer.style.display = 'none';
    });

    viewListBtn.addEventListener('click', () => {
      viewListBtn.classList.add('active');
      viewGridBtn.classList.remove('active');
      episodesGridContainer.style.display = 'none';
      episodesListContainer.style.display = 'flex';
    });
  }

  let loadSafetyTimer = null;
  let troubleTimer = null;

  // ── Load Streaming Servers & Play Stream ──
  async function loadServersAndStream() {
    if (playerLoading) {
      playerLoading.style.display = 'flex';
      playerLoading.style.opacity = '1';
    }

    const data = await apiFetch(`/watch-servers/${currentAnimeId}/${currentEpisode}?season=${currentSeason}`);
    if (!data || !data.servers || !data.servers.length) {
      if (playerLoading) {
        playerLoading.innerHTML = `
          <p style="color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> Failed to load streaming servers.</p>
          <button class="server-btn-pill" onclick="location.reload()" style="margin-top: 10px;">Retry</button>
        `;
      }
      return;
    }

    serverList = data.servers;

    // Render StreameX 2x4 server cards
    if (serversGridList) {
      serversGridList.innerHTML = serverList.map(s => {
        const isActive = s.id === currentServer;
        return `
          <div class="streamex-server-card ${isActive ? 'active' : ''}" data-server-id="${s.id}" data-url="${s.url}">
            <div class="server-card-left">
              <img src="${s.flag}" alt="${s.name}" class="server-flag-icon" />
              <span>${s.name}</span>
            </div>
            <div class="server-status-dot"></div>
          </div>
        `;
      }).join('');

      serversGridList.querySelectorAll('.streamex-server-card').forEach(card => {
        card.addEventListener('click', () => {
          serversGridList.querySelectorAll('.streamex-server-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          currentServer = card.dataset.serverId;
          playServerUrl(card.dataset.url);
          updateUrlState();
        });
      });
    }

    // Play default or selected server
    let activeServerObj = serverList.find(s => s.id === currentServer);
    if (!activeServerObj) {
      activeServerObj = serverList[0];
      currentServer = activeServerObj.id;
    }

    if (activeServerObj) {
      if (serversGridList) {
        serversGridList.querySelectorAll('.streamex-server-card').forEach(c => {
          c.classList.toggle('active', c.dataset.serverId === currentServer);
        });
      }
      playServerUrl(activeServerObj.url);
    }

    // Update Prev & Next Buttons
    if (prevEpBtn) {
      prevEpBtn.disabled = currentEpisode <= 1;
      prevEpBtn.onclick = () => { if (currentEpisode > 1) switchEpisode(currentEpisode - 1); };
    }
    if (nextEpBtn) {
      nextEpBtn.disabled = currentEpisode >= totalEpisodesCount;
      nextEpBtn.onclick = () => { if (currentEpisode < totalEpisodesCount) switchEpisode(currentEpisode + 1); };
    }

    // Wire quick switch next server button
    const quickSwitchBtn = document.getElementById('quickSwitchServerBtn');
    if (quickSwitchBtn) {
      quickSwitchBtn.onclick = (e) => {
        e.stopPropagation();
        switchToNextServer();
      };
    }
  }

  function switchToNextServer() {
    if (!serverList || serverList.length <= 1) return;
    const currIdx = serverList.findIndex(s => s.id === currentServer);
    const nextIdx = (currIdx + 1) % serverList.length;
    const nextServer = serverList[nextIdx];
    if (!nextServer) return;

    currentServer = nextServer.id;
    if (serversGridList) {
      serversGridList.querySelectorAll('.streamex-server-card').forEach(c => {
        c.classList.toggle('active', c.dataset.serverId === currentServer);
      });
    }
    playServerUrl(nextServer.url);
    updateUrlState();
  }

  function playServerUrl(url) {
    if (!playerIframe) return;

    if (loadSafetyTimer) clearTimeout(loadSafetyTimer);
    if (troubleTimer) clearTimeout(troubleTimer);

    const loadingTrouble = document.getElementById('playerLoadingTrouble');
    if (loadingTrouble) loadingTrouble.style.display = 'none';

    if (playerLoading) {
      playerLoading.style.display = 'flex';
      playerLoading.style.opacity = '1';
    }

    playerIframe.onload = () => {
      // Smoothly hide loading overlay once iframe fires load
      setTimeout(() => {
        if (playerLoading) {
          playerLoading.style.opacity = '0';
          setTimeout(() => {
            playerLoading.style.display = 'none';
          }, 250);
        }
      }, 400);
    };

    // If server takes longer than 4.5s on mobile, offer quick 1-tap failover
    troubleTimer = setTimeout(() => {
      if (playerLoading && playerLoading.style.display !== 'none') {
        const trouble = document.getElementById('playerLoadingTrouble');
        if (trouble) trouble.style.display = 'block';
      }
    }, 4500);

    // Timeout safety to guarantee loading overlay never hangs indefinitely
    loadSafetyTimer = setTimeout(() => {
      if (playerLoading) {
        playerLoading.style.opacity = '0';
        setTimeout(() => {
          playerLoading.style.display = 'none';
        }, 250);
      }
    }, 7000);

    playerIframe.src = url;
  }

  function switchEpisode(ep) {
    if (ep === currentEpisode) return;
    currentEpisode = ep;

    if (watchEpisodeHeader) watchEpisodeHeader.textContent = `Episode ${currentEpisode}`;
    if (nowPlayingBadge) {
      nowPlayingBadge.innerHTML = `<i class="fas fa-circle-play" style="color: var(--accent-purple);"></i> <span>Now Playing • Episode ${currentEpisode}</span>`;
    }
    document.title = `Watch ${animeDetails?.title || 'Anime'} Episode ${currentEpisode} — PBG Anime`;

    // Highlight active episode in grid and list
    document.querySelectorAll('.ep-grid-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.ep) === currentEpisode);
    });
    document.querySelectorAll('.ep-list-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.ep) === currentEpisode);
    });

    updateUrlState();
    loadServersAndStream();
  }

  function updateUrlState() {
    const newUrl = `/anime/watch.html?id=${currentAnimeId}&ep=${currentEpisode}&server=${currentServer}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }

  // Run watch page loaders
  loadAnimeInfo().then(() => {
    loadServersAndStream();
  });
}
