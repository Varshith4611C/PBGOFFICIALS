/* ============================================
   PBG Manga — Catalog / Browse Page Controller
   ============================================ */

(() => {
  const mangaGrid = document.getElementById('mangaGrid');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const sectionTabs = document.getElementById('sectionTabs');
  const sectionTitle = document.getElementById('sectionTitle');
  const genreBar = document.getElementById('genreBar');
  const heroSection = document.getElementById('heroSection');
  const contentSection = document.getElementById('contentSection');
  const searchSection = document.getElementById('searchSection');
  const searchGrid = document.getElementById('searchGrid');
  const searchQueryText = document.getElementById('searchQueryText');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');

  let currentTab = 'trending';
  let currentPage = 1;
  let currentGenre = 'all';

  // ── Load Catalog Content ──
  async function loadCatalog(tab = currentTab, page = 1) {
    currentTab = tab;
    currentPage = page;
    if (mangaGrid) mangaGrid.innerHTML = createSkeletons(18);

    const titlesMap = {
      trending: 'Trending Manga',
      popular: 'Most Popular Manga',
      'top-rated': 'Top Rated Manga',
      newest: 'New Releases'
    };

    if (sectionTitle) {
      sectionTitle.innerHTML = `<h2><i class="fas fa-fire"></i> ${titlesMap[tab] || 'Manga Catalog'}</h2>`;
    }

    // Update Tab buttons
    if (sectionTabs) {
      sectionTabs.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    }

    // Fetch from backend proxy
    const data = await apiFetch(`/${tab}?page=${page}`);
    if (data && data.results && data.results.length > 0) {
      let items = data.results;

      // Filter by genre if selected
      if (currentGenre !== 'all') {
        items = items.filter(m => m.genres && m.genres.map(g => g.toLowerCase()).includes(currentGenre.toLowerCase()));
      }

      if (items.length > 0) {
        if (mangaGrid) mangaGrid.innerHTML = items.map(createMangaCard).join('');
      } else {
        if (mangaGrid) mangaGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted);"><h3>No manga found for genre "${currentGenre}"</h3></div>`;
      }

      // Update Pagination state
      if (pageIndicator) pageIndicator.textContent = `Page ${currentPage}`;
      if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
      if (nextPageBtn) nextPageBtn.disabled = !data.hasNextPage;
    } else {
      if (mangaGrid) mangaGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted);"><h3>Unable to load catalog</h3><p>Please check your connection and retry.</p></div>';
    }
  }

  // Tab switching
  if (sectionTabs) {
    sectionTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (btn && btn.dataset.tab) {
        loadCatalog(btn.dataset.tab, 1);
      }
    });
  }

  // Genre filtering
  if (genreBar) {
    genreBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.genre-chip');
      if (chip && chip.dataset.genre) {
        genreBar.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentGenre = chip.dataset.genre;
        loadCatalog(currentTab, 1);
      }
    });
  }

  // Pagination clicks
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        loadCatalog(currentTab, currentPage - 1);
        window.scrollTo({ top: contentSection ? contentSection.offsetTop - 80 : 0, behavior: 'smooth' });
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      loadCatalog(currentTab, currentPage + 1);
      window.scrollTo({ top: contentSection ? contentSection.offsetTop - 80 : 0, behavior: 'smooth' });
    });
  }

  // Full Search on Enter (Desktop & Mobile)
  const triggerFullSearch = async (query) => {
    if (!query) return;

    if (searchResults) searchResults.classList.remove('active');
    const mobileSearchResults = document.getElementById('mobileSearchResults');
    if (mobileSearchResults) mobileSearchResults.classList.remove('active');
    const mobileSearchDrawer = document.getElementById('mobileSearchDrawer');
    if (mobileSearchDrawer) mobileSearchDrawer.classList.remove('active');

    if (heroSection) heroSection.style.display = 'none';
    if (contentSection) contentSection.style.display = 'none';
    if (searchSection) searchSection.style.display = 'block';
    if (searchQueryText) searchQueryText.textContent = query;
    if (searchGrid) searchGrid.innerHTML = createSkeletons(12);

    const data = await apiFetch(`/search?q=${encodeURIComponent(query)}&page=1`);
    if (data && data.results && data.results.length > 0) {
      searchGrid.innerHTML = data.results.map(createMangaCard).join('');
    } else {
      searchGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted);">
          <h3>No results found for "${query}"</h3>
          <p>Try checking spelling or search a different keyword.</p>
        </div>
      `;
    }
  };

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerFullSearch(searchInput.value.trim());
    });
  }

  const mobileSearchInput = document.getElementById('mobileSearchInput');
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerFullSearch(mobileSearchInput.value.trim());
    });
  }

  // Clear Search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchSection) searchSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
      if (contentSection) contentSection.style.display = 'block';
      if (searchInput) searchInput.value = '';
    });
  }

  // ── Continue Reading Shelf ──
  function initContinueReading() {
    const section = document.getElementById('continueReadingSection');
    const grid = document.getElementById('continueReadingGrid');
    if (!section || !grid) return;
    try {
      const history = JSON.parse(localStorage.getItem('pbg_manga_history') || '[]');
      if (!history || history.length === 0) {
        section.style.display = 'none';
        return;
      }
      section.style.display = 'block';
      grid.innerHTML = history.slice(0, 6).map(item => `
        <a href="/manga/read.html?id=${item.id}&chapterId=${encodeURIComponent(item.chapterId)}" class="manga-card" title="${item.title}">
          <div class="card-cover-wrap">
            <img src="${item.image || ''}" alt="${item.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 420%22><rect fill=%22%231e293b%22 width=%22300%22 height=%22420%22/><text fill=%22%2364748b%22 x=%22150%22 y=%22210%22 text-anchor=%22middle%22 font-size=%2216%22>No Cover</text></svg>'" />
            <span class="card-badge-rating" style="background: rgba(16,185,129,0.9); font-weight:700;"><i class="fas fa-book-open"></i> ${item.chapterTitle || 'Resume'}</span>
            <div class="card-overlay-btn">
              <div class="read-circle-btn"><i class="fas fa-play"></i></div>
            </div>
          </div>
          <div class="card-body">
            <div class="card-title">${item.title}</div>
            <div class="card-meta" style="color: var(--accent-emerald);">
              <span>${item.chapterTitle || 'Continue'}</span>
            </div>
          </div>
        </a>
      `).join('');
    } catch (e) {
      console.error('Error rendering continue reading:', e);
    }
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initContinueReading();
      loadCatalog('trending', 1);
    });
  } else {
    initContinueReading();
    loadCatalog('trending', 1);
  }
})();
