/* ============================================
   PBG Anime — Frontend Logic
   ============================================ */

const API_BASE = '/api/anime';

// ── Utility: Fetch with error handling ──
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

// ── Utility: Create skeleton cards ──
function createSkeletons(count = 12) {
  return Array(count).fill('').map(() => `
    <div class="anime-card">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text-sm"></div>
    </div>
  `).join('');
}

// ── Utility: Create anime card HTML ──
function createAnimeCard(item) {
  const title = item.title || item.id || 'Unknown';
  const image = item.image || '';
  const id = item.id || '';
  const episodeNum = item.episodeNumber || item.episode || '';
  const subOrDub = (item.subOrDub || '').toLowerCase();

  // Always start from episode 1, pass maxEp so we know total episodes
  const maxEp = episodeNum || '';
  const href = `/anime/watch.html?id=${encodeURIComponent(id)}${maxEp ? '&maxEp=' + maxEp : ''}`;

  return `
    <a href="${href}" class="anime-card" title="${title}">
      <div class="card-image">
        <img src="${image}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 400%22><rect fill=%22%231e293b%22 width=%22300%22 height=%22400%22/><text fill=%22%2364748b%22 x=%22150%22 y=%22200%22 text-anchor=%22middle%22 font-size=%2216%22>No Image</text></svg>'" />
        ${subOrDub ? `<span class="card-badge ${subOrDub === 'dub' ? 'badge-dub' : 'badge-sub'}">${subOrDub}</span>` : ''}
        ${episodeNum ? `<span class="badge-ep">EP ${episodeNum}</span>` : ''}
        <div class="card-overlay">
          <div class="play-btn"><i class="fas fa-play"></i></div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${title}</div>
        ${episodeNum ? `<div class="card-meta">Episode ${episodeNum}</div>` : ''}
      </div>
    </a>
  `;
}

// ── Detect which page we're on ──
const isWatchPage = window.location.pathname.includes('watch');

// ============================================
// HOME PAGE LOGIC
// ============================================
if (!isWatchPage) {
  const animeGrid = document.getElementById('animeGrid');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const sectionTabs = document.getElementById('sectionTabs');
  const sectionHeader = document.getElementById('sectionHeader');
  const contentSection = document.getElementById('contentSection');
  const searchSection = document.getElementById('searchSection');
  const searchGrid = document.getElementById('searchGrid');
  const searchQuery = document.getElementById('searchQuery');
  const heroSection = document.getElementById('heroSection');

  let currentTab = 'recent';

  // ── Load content based on tab ──
  async function loadContent(tab) {
    currentTab = tab;
    animeGrid.innerHTML = createSkeletons(18);
    contentSection.style.display = 'block';
    searchSection.style.display = 'none';
    heroSection.style.display = 'block';

    // Update tab UI
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    let data;
    if (tab === 'recent') {
      sectionHeader.innerHTML = '<h2><i class="fas fa-clock"></i> Recent Episodes</h2>';
      data = await apiFetch('/recent');
    } else if (tab === 'top-airing') {
      sectionHeader.innerHTML = '<h2><i class="fas fa-fire"></i> Top Airing</h2>';
      data = await apiFetch('/top-airing');
    }

    if (data && data.results && data.results.length > 0) {
      animeGrid.innerHTML = data.results.map(createAnimeCard).join('');
    } else {
      animeGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Couldn't load content</h3>
          <p>The server might be temporarily unavailable. Try refreshing the page.</p>
        </div>
      `;
    }
  }

  // ── Tab switching ──
  sectionTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn && btn.dataset.tab) {
      loadContent(btn.dataset.tab);
    }
  });

  // ── Search (dropdown) ──
  const handleSearch = debounce(async (query) => {
    if (query.length < 2) {
      searchResults.classList.remove('active');
      return;
    }

    searchResults.innerHTML = '<div class="search-result-item"><p style="color:var(--text-muted);">Searching...</p></div>';
    searchResults.classList.add('active');

    const data = await apiFetch(`/search?q=${encodeURIComponent(query)}`);

    if (data && data.results && data.results.length > 0) {
      searchResults.innerHTML = data.results.slice(0, 8).map(item => `
        <a href="/anime/watch.html?id=${encodeURIComponent(item.id)}" class="search-result-item">
          <img src="${item.image || ''}" alt="${item.title}" onerror="this.style.display='none'" />
          <div class="search-result-info">
            <h4>${item.title}</h4>
            <p>${item.releaseDate ? 'Released: ' + item.releaseDate : ''}</p>
          </div>
        </a>
      `).join('');
    } else {
      searchResults.innerHTML = '<div class="search-result-item"><p style="color:var(--text-muted);">No results found</p></div>';
    }
  }, 400);

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()));

  // Full search on Enter
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (!query) return;

      searchResults.classList.remove('active');
      heroSection.style.display = 'none';
      contentSection.style.display = 'none';
      searchSection.style.display = 'block';
      searchQuery.textContent = query;
      searchGrid.innerHTML = createSkeletons(12);

      const data = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
      if (data && data.results && data.results.length > 0) {
        searchGrid.innerHTML = data.results.map(createAnimeCard).join('');
      } else {
        searchGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="fas fa-search"></i>
            <h3>No results for "${query}"</h3>
            <p>Try a different search term.</p>
          </div>
        `;
      }
    }
  });

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search')) {
      searchResults.classList.remove('active');
    }
  });

  // ── Initial load ──
  loadContent('recent');
}

// ============================================
// WATCH PAGE LOGIC
// ============================================
if (isWatchPage) {
  const playerWrapper = document.getElementById('playerWrapper');
  const playerLoading = document.getElementById('playerLoading');
  const prevEpBtn = document.getElementById('prevEpBtn');
  const nextEpBtn = document.getElementById('nextEpBtn');
  const serverSelector = document.getElementById('serverSelector');
  const episodeTitle = document.getElementById('episodeTitle');
  const animeTitle = document.getElementById('animeTitle');
  const animeType = document.getElementById('animeType');
  const episodesGrid = document.getElementById('episodesGrid');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  const params = new URLSearchParams(window.location.search);
  let animeId = params.get('id') || '';
  let episodeId = params.get('episodeId') || '';
  let episodes = [];
  let currentEpIndex = -1;
  let currentServers = [];
  let prevEpisodeId = '';
  let nextEpisodeId = '';

  // ── Load anime info + episodes ──
  async function loadAnimeInfo() {
    if (!animeId) {
      // Try to extract anime ID from episodeId
      if (episodeId) {
        animeId = episodeId.replace(/-episode-\d+.*$/, '');
      } else {
        return;
      }
    }

    // Get maxEp from URL params (passed from card click)
    const maxEp = params.get('maxEp') || '';
    const infoUrl = `/info/${encodeURIComponent(animeId)}${maxEp ? '?maxEp=' + maxEp : ''}`;

    const info = await apiFetch(infoUrl);
    if (!info) {
      // Even if info fails, try to play the episode directly
      if (episodeId) loadPlayer(episodeId);
      return;
    }

    document.title = `${info.title || animeId} — PBG Anime`;
    animeTitle.textContent = info.title || animeId;
    animeType.textContent = info.subOrDub || 'Sub';

    episodes = info.episodes || [];

    // Always start from episode 1 if no specific episodeId was requested
    if (!episodeId && episodes.length > 0) {
      episodeId = episodes[0].id;
    }

    // Render episode buttons
    renderEpisodes();

    // Load the player
    if (episodeId) {
      loadPlayer(episodeId);
    }
  }

  // ── Render episode buttons with range pagination ──
  const EP_PAGE_SIZE = 100;
  let currentEpPage = 0;

  function renderEpisodes() {
    const section = document.getElementById('episodesSection');
    const totalCountEl = document.getElementById('epTotalCount');
    const filterInput = document.getElementById('epFilterInput');
    const rangeContainer = document.getElementById('epRangeContainer');

    if (episodes.length === 0) {
      episodesGrid.innerHTML = '<p style="color:var(--text-muted);padding:12px;">No episodes found.</p>';
      if (totalCountEl) totalCountEl.textContent = '';
      return;
    }

    if (totalCountEl) {
      totalCountEl.textContent = `${episodes.length} Eps`;
    }

    // Find which page the current episode is on
    const activeIdx = episodes.findIndex(ep => ep.id === episodeId);
    if (activeIdx !== -1) {
      currentEpIndex = activeIdx;
      currentEpPage = Math.floor(activeIdx / EP_PAGE_SIZE);
    }

    // Build range navigation if more than one page
    const totalPages = Math.ceil(episodes.length / EP_PAGE_SIZE);

    function updateRangeControls() {
      const rangeSelect = document.getElementById('rangeSelect');
      const rangePrevBtn = document.getElementById('rangePrevBtn');
      const rangeNextBtn = document.getElementById('rangeNextBtn');
      if (rangeSelect) rangeSelect.value = currentEpPage;
      if (rangePrevBtn) rangePrevBtn.disabled = currentEpPage <= 0;
      if (rangeNextBtn) rangeNextBtn.disabled = currentEpPage >= totalPages - 1;
    }

    if (rangeContainer) {
      if (totalPages > 1) {
        rangeContainer.innerHTML = `
          <div class="ep-range-bar">
            <button class="range-arrow-btn" id="rangePrevBtn" title="Previous 100 Episodes" ${currentEpPage === 0 ? 'disabled' : ''}>
              <i class="fas fa-chevron-left"></i>
            </button>
            <div class="range-select-wrapper">
              <select id="rangeSelect" class="range-select">
                ${Array.from({ length: totalPages }, (_, i) => {
                  const start = i * EP_PAGE_SIZE + 1;
                  const end = Math.min((i + 1) * EP_PAGE_SIZE, episodes.length);
                  const isSelected = i === currentEpPage ? 'selected' : '';
                  const padStart = String(start).padStart(3, '0');
                  const padEnd = String(end).padStart(3, '0');
                  return `<option value="${i}" ${isSelected}>${padStart}-${padEnd}</option>`;
                }).join('')}
              </select>
              <i class="fas fa-chevron-down range-select-icon"></i>
            </div>
            <button class="range-arrow-btn" id="rangeNextBtn" title="Next 100 Episodes" ${currentEpPage >= totalPages - 1 ? 'disabled' : ''}>
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        `;

        const rangeSelect = rangeContainer.querySelector('#rangeSelect');
        const rangePrevBtn = rangeContainer.querySelector('#rangePrevBtn');
        const rangeNextBtn = rangeContainer.querySelector('#rangeNextBtn');

        if (rangeSelect) {
          rangeSelect.onchange = (e) => {
            currentEpPage = parseInt(e.target.value);
            updateRangeControls();
            renderEpisodePage();
          };
        }

        if (rangePrevBtn) {
          rangePrevBtn.onclick = () => {
            if (currentEpPage > 0) {
              currentEpPage--;
              updateRangeControls();
              renderEpisodePage();
            }
          };
        }

        if (rangeNextBtn) {
          rangeNextBtn.onclick = () => {
            if (currentEpPage < totalPages - 1) {
              currentEpPage++;
              updateRangeControls();
              renderEpisodePage();
            }
          };
        }
      } else {
        rangeContainer.innerHTML = '';
      }
    }

    // Setup filter input (instant jump to episode)
    if (filterInput) {
      filterInput.oninput = (e) => {
        const val = parseInt(e.target.value);
        if (isNaN(val) || val < 1 || val > episodes.length) return;

        const targetIdx = val - 1;
        const targetPage = Math.floor(targetIdx / EP_PAGE_SIZE);

        if (targetPage !== currentEpPage) {
          currentEpPage = targetPage;
          updateRangeControls();
          renderEpisodePage();
        }

        const targetBtn = episodesGrid.querySelector(`.ep-btn[data-index="${targetIdx}"]`);
        if (targetBtn) {
          targetBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          targetBtn.style.animation = 'none';
          targetBtn.offsetHeight; /* trigger reflow */
          targetBtn.style.outline = '2px solid var(--accent-cyan)';
          setTimeout(() => { if (targetBtn) targetBtn.style.outline = ''; }, 2000);
        }
      };
    }

    // Render current page
    renderEpisodePage();

    // Episode button clicks (event delegation)
    episodesGrid.onclick = (e) => {
      const btn = e.target.closest('.ep-btn');
      if (!btn) return;

      episodeId = btn.dataset.epId;
      currentEpIndex = parseInt(btn.dataset.index);

      document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const url = new URL(window.location);
      url.searchParams.set('episodeId', episodeId);
      window.history.pushState({}, '', url);

      loadPlayer(episodeId);
      updateNavButtons();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  // ── Render a single page of episodes ──
  function renderEpisodePage() {
    const start = currentEpPage * EP_PAGE_SIZE;
    const end = Math.min(start + EP_PAGE_SIZE, episodes.length);
    const pageEpisodes = episodes.slice(start, end);

    episodesGrid.innerHTML = pageEpisodes.map((ep, i) => {
      const globalIdx = start + i;
      const epNum = ep.number || globalIdx + 1;
      const isActive = ep.id === episodeId;
      if (isActive) currentEpIndex = globalIdx;
      return `<button class="ep-btn ${isActive ? 'active' : ''}" data-ep-id="${ep.id}" data-index="${globalIdx}">${epNum}</button>`;
    }).join('');

    // Smooth scroll active episode into view
    setTimeout(() => {
      const activeBtn = episodesGrid.querySelector('.ep-btn.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 50);

    updateNavButtons();
  }

  // ── Update prev/next buttons ──
  function updateNavButtons() {
    // Use API-provided prev/next first, then fall back to episode list
    const hasPrev = prevEpisodeId || currentEpIndex > 0;
    const hasNext = nextEpisodeId || currentEpIndex < episodes.length - 1;
    prevEpBtn.disabled = !hasPrev;
    nextEpBtn.disabled = !hasNext;
  }

  // ── Prev/Next navigation ──
  prevEpBtn.addEventListener('click', () => {
    if (prevEpisodeId) {
      episodeId = prevEpisodeId;
      navigateToEpisode();
    } else if (currentEpIndex > 0) {
      currentEpIndex--;
      episodeId = episodes[currentEpIndex].id;
      navigateToEpisode();
    }
  });

  nextEpBtn.addEventListener('click', () => {
    if (nextEpisodeId) {
      episodeId = nextEpisodeId;
      navigateToEpisode();
    } else if (currentEpIndex < episodes.length - 1) {
      currentEpIndex++;
      episodeId = episodes[currentEpIndex].id;
      navigateToEpisode();
    }
  });

  function navigateToEpisode() {
    // Check if new episode is on a different range page
    if (episodes.length > 0) {
      const totalPages = Math.ceil(episodes.length / EP_PAGE_SIZE);
      const epIdx = episodes.findIndex(e => e.id === episodeId);
      if (epIdx !== -1) {
        currentEpIndex = epIdx;
        const neededPage = Math.floor(epIdx / EP_PAGE_SIZE);
        if (neededPage !== currentEpPage) {
          currentEpPage = neededPage;
          const rangeSelect = document.getElementById('rangeSelect');
          const rangePrevBtn = document.getElementById('rangePrevBtn');
          const rangeNextBtn = document.getElementById('rangeNextBtn');
          if (rangeSelect) rangeSelect.value = currentEpPage;
          if (rangePrevBtn) rangePrevBtn.disabled = currentEpPage <= 0;
          if (rangeNextBtn) rangeNextBtn.disabled = currentEpPage >= totalPages - 1;
          renderEpisodePage();
        }
      }
    }

    document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.ep-btn[data-ep-id="${episodeId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Update anime ID from episode ID
    animeId = episodeId.replace(/-episode-\d+.*$/, '');

    const url = new URL(window.location);
    url.searchParams.set('episodeId', episodeId);
    url.searchParams.set('id', animeId);
    window.history.pushState({}, '', url);

    loadPlayer(episodeId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Load player with iframe ──
  async function loadPlayer(epId) {
    // Show loading, remove existing iframe
    playerLoading.style.display = 'flex';
    playerLoading.innerHTML = '<div class="spinner"></div><p>Loading player...</p>';
    const existingIframe = playerWrapper.querySelector('iframe');
    if (existingIframe) existingIframe.remove();

    // Fetch watch data (contains iframe URL + servers + prev/next)
    const watchData = await apiFetch(`/watch/${encodeURIComponent(epId)}`);

    if (!watchData) {
      playerLoading.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--accent-pink);"></i>
        <p>Failed to load episode. Try refreshing.</p>
      `;
      return;
    }

    // Store prev/next episode IDs from the API
    prevEpisodeId = watchData.prevEpisode || '';
    nextEpisodeId = watchData.nextEpisode || '';
    updateNavButtons();

    // Update title from API
    const pageTitle = watchData.title || episodeId.replace(/-/g, ' ');
    episodeTitle.innerHTML = `<span class="ep-number">${pageTitle}</span>`;
    if (watchData.animeId) animeId = watchData.animeId;
    if (watchData.title) animeTitle.textContent = watchData.title;
    document.title = `${pageTitle} — PBG Anime`;

    // Update episode index in the episode list if available
    const epIdx = episodes.findIndex(e => e.id === epId);
    if (epIdx !== -1) currentEpIndex = epIdx;

    // Populate server selector
    currentServers = watchData.servers || [];
    if (currentServers.length > 0) {
      serverSelector.innerHTML = currentServers.map((s, i) =>
        `<option value="${s.url}" ${s.active ? 'selected' : ''}>${s.name}</option>`
      ).join('');
    } else {
      serverSelector.innerHTML = '<option>Default</option>';
    }

    // Get embed URL — prefer the active server, fallback to iframeSrc
    const embedUrl = watchData.embedUrl || watchData.iframeSrc;

    if (embedUrl) {
      injectIframe(embedUrl);
    } else {
      playerLoading.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--accent-pink);"></i>
        <p>No video source found. Try a different server.</p>
      `;
    }
  }

  // ── Inject iframe into player ──
  function injectIframe(src) {
    const existingIframe = playerWrapper.querySelector('iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('marginwidth', '0');
    iframe.setAttribute('marginheight', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
    iframe.style.cssText = 'width:100%;height:100%;border:none;';

    iframe.onload = () => {
      playerLoading.style.display = 'none';
    };

    playerWrapper.appendChild(iframe);

    // Fallback: hide loading after 5s (cross-origin onload may not fire)
    setTimeout(() => {
      playerLoading.style.display = 'none';
    }, 5000);
  }

  // ── Server change ──
  serverSelector.addEventListener('change', (e) => {
    const selectedUrl = e.target.value;
    if (selectedUrl && selectedUrl.startsWith('http')) {
      playerLoading.style.display = 'flex';
      playerLoading.innerHTML = '<div class="spinner"></div><p>Switching server...</p>';
      injectIframe(selectedUrl);
    }
  });

  // ── Search on watch page ──
  const handleSearch = debounce(async (query) => {
    if (query.length < 2) {
      searchResults.classList.remove('active');
      return;
    }

    searchResults.innerHTML = '<div class="search-result-item"><p style="color:var(--text-muted);">Searching...</p></div>';
    searchResults.classList.add('active');

    const data = await apiFetch(`/search?q=${encodeURIComponent(query)}`);

    if (data && data.results && data.results.length > 0) {
      searchResults.innerHTML = data.results.slice(0, 8).map(item => `
        <a href="/anime/watch.html?id=${encodeURIComponent(item.id)}" class="search-result-item">
          <img src="${item.image || ''}" alt="${item.title}" onerror="this.style.display='none'" />
          <div class="search-result-info">
            <h4>${item.title}</h4>
            <p>${item.releaseDate ? 'Released: ' + item.releaseDate : ''}</p>
          </div>
        </a>
      `).join('');
    } else {
      searchResults.innerHTML = '<div class="search-result-item"><p style="color:var(--text-muted);">No results found</p></div>';
    }
  }, 400);

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search')) {
      searchResults.classList.remove('active');
    }
  });

  // ── Initialize ──
  loadAnimeInfo();
}
