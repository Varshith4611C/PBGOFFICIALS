/* ============================================
   PBG Manga — Common Utilities & Shared Components
   ============================================ */

const API_BASE = '/api/manga';

// ── API Fetch Utility with Error Handling ──
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

// ── Debounce Helper ──
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Proxy image helper ──
function getProxiedImg(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/')) return url;
  return `/api/manga/img?url=${encodeURIComponent(url)}`;
}

// ── Create Skeleton Cards ──
function createSkeletons(count = 12) {
  return Array(count).fill('').map(() => `
    <div class="manga-card">
      <div class="skeleton skeleton-card"></div>
      <div class="card-body">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text-sm"></div>
      </div>
    </div>
  `).join('');
}

// ── Format Title Helper ──
function formatTitle(titleObj) {
  if (!titleObj) return 'Untitled Manga';
  if (typeof titleObj === 'string') return titleObj;
  return titleObj.english || titleObj.romaji || titleObj.native || 'Untitled Manga';
}

// ── Parse Chapter Number Helper ──
function parseChapterNumber(c) {
  if (!c) return 0;
  if (c.chapter !== undefined && c.chapter !== null && c.chapter !== '') {
    const val = parseFloat(c.chapter);
    if (!isNaN(val)) return val;
  }
  const match = (c.title || '').match(/chapter\s+([\d.]+)/i) || (c.id || '').match(/chapter-([\d.]+)/i);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val)) return val;
  }
  return 0;
}

// ── Create Manga Card HTML (Links to Dedicated Detail Page) ──
function createMangaCard(item) {
  const id = item.id;
  const title = formatTitle(item.title);
  const cover = item.coverImage?.large || item.coverImage?.medium || item.coverImage?.extraLarge || '';
  const score = item.averageScore ? `${item.averageScore}%` : null;
  const status = item.status || 'RELEASING';
  const format = item.format || 'MANGA';
  const genres = (item.genres || []).slice(0, 2).map(g => `<span>${g}</span>`).join('');

  return `
    <a href="/manga/detail.html?id=${id}" class="manga-card" data-id="${id}" title="${title}">
      <div class="card-cover-wrap">
        <img src="${cover}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 420%22><rect fill=%22%231e293b%22 width=%22300%22 height=%22420%22/><text fill=%22%2364748b%22 x=%22150%22 y=%22210%22 text-anchor=%22middle%22 font-size=%2216%22>No Cover</text></svg>'" />
        ${score ? `<span class="card-badge-rating"><i class="fas fa-star"></i> ${score}</span>` : ''}
        <span class="card-badge-status ${status === 'COMPLETED' ? 'status-completed' : 'status-releasing'}">${status}</span>
        <div class="card-overlay-btn">
          <div class="read-circle-btn"><i class="fas fa-book-open"></i></div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${title}</div>
        <div class="card-meta">
          <span>${format}</span>
          <div class="card-genres">${genres}</div>
        </div>
      </div>
    </a>
  `;
}

// ── Shared Navbar Search Autocomplete (Desktop & Mobile) ──
function initNavbarSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const mobileSearchBtn = document.getElementById('mobileSearchBtn');
  const mobileSearchDrawer = document.getElementById('mobileSearchDrawer');
  const mobileSearchClose = document.getElementById('mobileSearchClose');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchResults = document.getElementById('mobileSearchResults');

  // Mobile Drawer Toggle
  if (mobileSearchBtn && mobileSearchDrawer) {
    mobileSearchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileSearchDrawer.classList.toggle('active');
      if (mobileSearchDrawer.classList.contains('active')) {
        setTimeout(() => mobileSearchInput?.focus(), 150);
      }
    });
  }

  if (mobileSearchClose && mobileSearchDrawer) {
    mobileSearchClose.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileSearchDrawer.classList.remove('active');
      if (mobileSearchResults) {
        mobileSearchResults.classList.remove('active');
        mobileSearchResults.innerHTML = '';
      }
    });
  }

  const createAutocompleteHandler = (resultsContainer) => debounce(async (query) => {
    if (!query || query.length < 2) {
      resultsContainer.classList.remove('active');
      resultsContainer.innerHTML = '';
      return;
    }

    resultsContainer.innerHTML = '<div class="search-result-item"><p style="color:var(--text-muted);padding:8px;"><i class="fas fa-spinner fa-spin"></i> Searching...</p></div>';
    resultsContainer.classList.add('active');

    const data = await apiFetch(`/search?q=${encodeURIComponent(query)}&page=1`);
    if (data && data.results && data.results.length > 0) {
      const items = data.results.slice(0, 6);
      resultsContainer.innerHTML = items.map(m => {
        const title = formatTitle(m.title);
        const cover = m.coverImage?.medium || m.coverImage?.large || '';
        const format = m.format || 'MANGA';
        const year = m.startDate?.year || '';
        return `
          <a href="/manga/detail.html?id=${m.id}" class="search-result-item" data-id="${m.id}">
            <img src="${cover}" alt="${title}" onerror="this.style.display='none'" />
            <div class="search-result-info">
              <h4>${title}</h4>
              <p>${format} ${year ? '• ' + year : ''} ${m.averageScore ? '• ⭐ ' + m.averageScore + '%' : ''}</p>
            </div>
          </a>
        `;
      }).join('');
    } else {
      resultsContainer.innerHTML = '<div class="search-result-item"><p style="color:var(--text-muted);padding:8px;">No manga found</p></div>';
    }
  }, 350);

  if (searchInput && searchResults) {
    const handleDesktop = createAutocompleteHandler(searchResults);
    searchInput.addEventListener('input', (e) => handleDesktop(e.target.value.trim()));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-search')) {
        searchResults.classList.remove('active');
      }
    });
  }

  if (mobileSearchInput && mobileSearchResults) {
    const handleMobile = createAutocompleteHandler(mobileSearchResults);
    mobileSearchInput.addEventListener('input', (e) => handleMobile(e.target.value.trim()));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.mobile-search-drawer') && !e.target.closest('#mobileSearchBtn')) {
        mobileSearchResults.classList.remove('active');
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavbarSearch);
} else {
  initNavbarSearch();
}
