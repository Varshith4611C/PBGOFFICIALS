/* ============================================
   PBG Anime — Common Utilities & Navbar Search
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

      if (!isWatchPage && typeof showFullSearchResults === 'function') {
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
