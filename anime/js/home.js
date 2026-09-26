/* ============================================
   PBG Anime — Homepage Controller
   Hero Carousel, Airing Schedule, Trending & Continue Watching
   ============================================ */

(() => {
  const homeSections = document.getElementById('homeSections');
  const searchSection = document.getElementById('searchSection');
  const searchQueryText = document.getElementById('searchQueryText');
  const searchGrid = document.getElementById('searchGrid');
  const closeSearchBtn = document.getElementById('closeSearchBtn');
  const searchInput = document.getElementById('searchInput');

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

  // Expose to window for common navbar search
  window.showFullSearchResults = showFullSearchResults;

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

    await loadScheduleForOffset(0);

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
    if (trendingCarousel) {
      const data = await apiFetch('/trending?perPage=15');
      if (data && data.results) {
        renderPosterCards(trendingCarousel, data.results);
      }
    }

    if (popularCarousel) {
      const data = await apiFetch('/popular?perPage=15');
      if (data && data.results) {
        renderPosterCards(popularCarousel, data.results);
      }
    }

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

  // ── 5. Init Continue Watching Shelf ──
  function initContinueWatching() {
    const section = document.getElementById('continueWatchingSection');
    const carousel = document.getElementById('continueWatchingCarousel');
    const prevBtn = document.getElementById('continuePrevBtn');
    const nextBtn = document.getElementById('continueNextBtn');
    if (!section || !carousel) return;

    try {
      const history = JSON.parse(localStorage.getItem('pbg_anime_history') || '[]');
      if (!history || history.length === 0) {
        section.style.display = 'none';
        return;
      }
      section.style.display = 'block';
      carousel.innerHTML = history.map(item => `
        <a href="/anime/watch.html?id=${item.id}&ep=${item.episode || 1}" class="anime-poster-card" title="${item.title}">
          <div class="poster-media">
            <img src="${item.image || '/assets/images/logo.jpg'}" alt="${item.title}" loading="lazy" onerror="this.src='/assets/images/logo.jpg'" />
            <span class="card-top-pill" style="background: rgba(168,85,247,0.9); font-weight: 700;">EP ${item.episode}</span>
            <div class="poster-overlay"><div class="play-circle"><i class="fas fa-play"></i></div></div>
          </div>
          <div class="poster-title">${item.title}</div>
          <div class="poster-subtitle" style="color: var(--accent-purple);">Continue Ep ${item.episode}</div>
        </a>
      `).join('');

      if (prevBtn) prevBtn.onclick = () => carousel.scrollBy({ left: -450, behavior: 'smooth' });
      if (nextBtn) nextBtn.onclick = () => carousel.scrollBy({ left: 450, behavior: 'smooth' });
    } catch (e) {
      console.error('Error rendering continue watching:', e);
    }
  }

  // Run homepage loaders
  initHeroCarousel();
  initContinueWatching();
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
})();
