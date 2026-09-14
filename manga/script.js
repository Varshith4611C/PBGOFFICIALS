/* ============================================
   PBG Manga — Frontend Controller
   Catalog, StreameX-Modeled Details & Reader Engine
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

// ── Detect page type ──
const pathname = window.location.pathname;
const isReaderPage = pathname.includes('read');
const isDetailPage = pathname.includes('detail') || (!isReaderPage && /^\/manga\/\d+/.test(pathname));
const isCatalogPage = !isReaderPage && !isDetailPage;

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

initNavbarSearch();

// ============================================
// DEDICATED MANGA DETAIL PAGE LOGIC (detail.html)
// Modeled directly after StreameX /manga/:id
// ============================================
if (isDetailPage) {
  const detailLoading = document.getElementById('detailLoading');
  const detailWrapper = document.getElementById('detailWrapper');
  const detailBackdropImg = document.getElementById('detailBackdropImg');
  const detailCoverImg = document.getElementById('detailCoverImg');
  const detailStartReadBtn = document.getElementById('detailStartReadBtn');
  const detailBookmarkBtn = document.getElementById('detailBookmarkBtn');
  const detailTitle = document.getElementById('detailTitle');
  const detailAltTitle = document.getElementById('detailAltTitle');
  const detailScoreVal = document.getElementById('detailScoreVal');
  const detailChaptersVal = document.getElementById('detailChaptersVal');
  const detailStatusVal = document.getElementById('detailStatusVal');
  const detailYearVal = document.getElementById('detailYearVal');
  const detailFormatVal = document.getElementById('detailFormatVal');
  const detailGenresWrap = document.getElementById('detailGenresWrap');
  const detailSynopsisText = document.getElementById('detailSynopsisText');
  const detailTotalChaptersCount = document.getElementById('detailTotalChaptersCount');
  const detailChapterSearchInput = document.getElementById('detailChapterSearchInput');
  const detailChapterSortBtn = document.getElementById('detailChapterSortBtn');
  const chapterRangeTabs = document.getElementById('chapterRangeTabs');
  const detailChaptersGrid = document.getElementById('detailChaptersGrid');
  const detailCharactersSection = document.getElementById('detailCharactersSection');
  const detailCharactersList = document.getElementById('detailCharactersList');
  const detailSimilarSection = document.getElementById('detailSimilarSection');
  const detailSimilarGrid = document.getElementById('detailSimilarGrid');

  // Extract ID from query param (?id=...) or path (/manga/30013)
  const urlParams = new URLSearchParams(window.location.search);
  let mangaId = urlParams.get('id');
  if (!mangaId) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      mangaId = lastPart;
    }
  }

  let allChapters = [];
  let sortDescending = true;
  let activeRangeIndex = 0; // 0 = all, or range chunk index
  let rangeChunks = [];

  async function initDetailPage() {
    if (!mangaId) {
      if (detailLoading) detailLoading.innerHTML = '<p style="color:var(--accent-pink);">No Manga ID provided.</p>';
      return;
    }

    // Fetch Details & Chapters in parallel
    const [infoData, chaptersData] = await Promise.all([
      apiFetch(`/info/${mangaId}`),
      apiFetch(`/chapters/${mangaId}`)
    ]);

    if (!infoData) {
      if (detailLoading) detailLoading.innerHTML = '<p style="color:var(--accent-pink);">Failed to load manga details.</p>';
      return;
    }

    // Hide loader, show content
    if (detailLoading) detailLoading.style.display = 'none';
    if (detailWrapper) detailWrapper.style.display = 'block';

    const title = formatTitle(infoData.title);
    document.title = `${title} — PBG Manga`;

    // Populate Hero & Metadata
    const cover = infoData.coverImage?.extraLarge || infoData.coverImage?.large || '';
    const banner = infoData.bannerImage || cover;

    if (detailBackdropImg) detailBackdropImg.style.backgroundImage = `url('${banner}')`;
    if (detailCoverImg) detailCoverImg.src = cover;
    if (detailTitle) detailTitle.textContent = title;
    if (detailAltTitle) detailAltTitle.textContent = infoData.title?.native || infoData.title?.romaji || '';

    if (detailScoreVal) {
      const scoreNum = infoData.averageScore ? (infoData.averageScore / 10).toFixed(1) : '8.0';
      detailScoreVal.textContent = scoreNum;
    }
    if (detailStatusVal) {
      const statusText = infoData.status === 'RELEASING' ? 'Ongoing' : (infoData.status === 'FINISHED' ? 'Completed' : (infoData.status || 'Ongoing'));
      detailStatusVal.textContent = statusText;
    }
    if (detailYearVal) detailYearVal.textContent = infoData.startDate?.year || '2022';
    if (detailFormatVal) detailFormatVal.textContent = infoData.format || 'MANGA';

    // Genres
    if (detailGenresWrap && infoData.genres) {
      detailGenresWrap.innerHTML = infoData.genres.map(g => `<span class="genre-pill-chip">${g}</span>`).join('');
    }

    // Synopsis
    if (detailSynopsisText) {
      detailSynopsisText.innerHTML = infoData.description || 'No synopsis available for this manga.';
    }

    // Bookmarks handling
    initBookmarkButton(mangaId, title, cover);

    // Chapters Handling
    if (chaptersData && chaptersData.chapters && chaptersData.chapters.length > 0) {
      allChapters = chaptersData.chapters;
      const count = allChapters.length;
      if (detailChaptersVal) detailChaptersVal.textContent = `${count} Chapters`;
      if (detailTotalChaptersCount) detailTotalChaptersCount.textContent = count;

      // Start Reading CTA button (First chapter)
      const firstChapter = allChapters[allChapters.length - 1] || allChapters[0];
      if (detailStartReadBtn && firstChapter) {
        detailStartReadBtn.href = `/manga/read.html?id=${mangaId}&chapterId=${encodeURIComponent(firstChapter.id)}`;
        detailStartReadBtn.innerHTML = `
          <svg class="play-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Start Reading</span>
        `;
      }

      setupChapterRanges(allChapters);
      renderDetailChapters();
    } else {
      if (detailChaptersGrid) {
        detailChaptersGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--text-muted);">No readable chapters available for this series.</div>';
      }
      if (detailChaptersVal) detailChaptersVal.textContent = '0 Chapters';
      if (detailTotalChaptersCount) detailTotalChaptersCount.textContent = '0';
    }

    // Characters Showcase
    if (infoData.characters && (infoData.characters.edges || infoData.characters.nodes)) {
      const chars = infoData.characters.edges || infoData.characters.nodes;
      if (chars.length > 0 && detailCharactersSection && detailCharactersList) {
        detailCharactersSection.style.display = 'block';
        detailCharactersList.innerHTML = chars.map(c => {
          const node = c.node || c;
          const role = c.role || 'CHARACTER';
          const name = node.name?.full || node.name?.userPreferred || 'Character';
          const avatar = node.image?.large || node.image?.medium || '';
          return `
            <div class="character-card">
              <div class="character-avatar">
                <img src="${avatar}" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231e293b%22 width=%22100%22 height=%22100%22/></svg>'" />
              </div>
              <div class="character-name" title="${name}">${name}</div>
              <div class="character-role">${role}</div>
            </div>
          `;
        }).join('');
      }
    }

    // Similar Manga Recommendations
    if (infoData.recommendations && infoData.recommendations.nodes && infoData.recommendations.nodes.length > 0) {
      const recs = infoData.recommendations.nodes
        .map(n => n.mediaRecommendation)
        .filter(Boolean)
        .slice(0, 10);

      if (recs.length > 0 && detailSimilarSection && detailSimilarGrid) {
        detailSimilarSection.style.display = 'block';
        detailSimilarGrid.innerHTML = recs.map(createMangaCard).join('');
      }
    }
  }

  // Setup chapter range pagination tabs (for long-running series like One Piece)
  function setupChapterRanges(chapters) {
    if (!chapterRangeTabs || chapters.length <= 60) return;

    chapterRangeTabs.style.display = 'flex';
    const total = chapters.length;
    const chunkSize = 100;
    const numChunks = Math.ceil(total / chunkSize);

    let html = `<button class="range-tab-btn ${activeRangeIndex === -1 ? 'active' : ''}" data-range="-1">All (${total})</button>`;

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize + 1;
      const end = Math.min((i + 1) * chunkSize, total);
      html += `<button class="range-tab-btn ${activeRangeIndex === i ? 'active' : ''}" data-range="${i}">Ch. ${start}-${end}</button>`;
    }

    chapterRangeTabs.innerHTML = html;

    chapterRangeTabs.querySelectorAll('.range-tab-btn').forEach(btn => {
      btn.onclick = () => {
        chapterRangeTabs.querySelectorAll('.range-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeRangeIndex = parseInt(btn.dataset.range, 10);
        renderDetailChapters(detailChapterSearchInput ? detailChapterSearchInput.value.trim() : '');
      };
    });
  }

  function renderDetailChapters(filterText = '') {
    if (!detailChaptersGrid) return;

    let chaps = [...allChapters];

    // Filter by search query
    if (filterText) {
      chaps = chaps.filter(c => 
        (c.title || '').toLowerCase().includes(filterText.toLowerCase()) || 
        (c.chapter || '').toString().includes(filterText)
      );
    } else if (activeRangeIndex !== -1 && allChapters.length > 60) {
      // Apply chapter range chunk
      const chunkSize = 100;
      // Note: chapters are in natural order (newest or oldest)
      // Usually chapters in API are descending (Ch 1100 to Ch 1)
      const startIdx = activeRangeIndex * chunkSize;
      const endIdx = startIdx + chunkSize;
      chaps = chaps.slice(startIdx, endIdx);
    }

    // Apply sorting
    if (!sortDescending) {
      chaps.reverse();
    }

    if (chaps.length === 0) {
      detailChaptersGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--text-muted);">No matching chapters found.</div>';
      return;
    }

    detailChaptersGrid.innerHTML = chaps.map(c => `
      <a href="/manga/read.html?id=${mangaId}&chapterId=${encodeURIComponent(c.id)}" class="detail-chapter-pill" title="${c.title || 'Chapter ' + c.chapter}">
        ${c.title || 'Chapter ' + (c.chapter || '')}
      </a>
    `).join('');
  }

  // Chapter filter input
  if (detailChapterSearchInput) {
    detailChapterSearchInput.addEventListener('input', (e) => {
      renderDetailChapters(e.target.value.trim());
    });
  }

  // Chapter sort toggle
  if (detailChapterSortBtn) {
    detailChapterSortBtn.addEventListener('click', () => {
      sortDescending = !sortDescending;
      detailChapterSortBtn.innerHTML = sortDescending 
        ? '<i class="fas fa-sort-amount-down"></i> <span>Newest</span>' 
        : '<i class="fas fa-sort-amount-up"></i> <span>Oldest</span>';
      renderDetailChapters(detailChapterSearchInput ? detailChapterSearchInput.value.trim() : '');
    });
  }

  // Bookmarks helper
  function initBookmarkButton(id, title, cover) {
    if (!detailBookmarkBtn) return;
    const key = `pbg_manga_bookmarks`;
    let bookmarks = [];
    try {
      bookmarks = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (_) {}

    const isBookmarked = bookmarks.some(b => b.id == id);
    updateBookmarkUI(isBookmarked);

    detailBookmarkBtn.onclick = () => {
      try {
        let list = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = list.findIndex(b => b.id == id);
        if (idx !== -1) {
          list.splice(idx, 1);
          updateBookmarkUI(false);
        } else {
          list.push({ id, title, cover, addedAt: Date.now() });
          updateBookmarkUI(true);
        }
        localStorage.setItem(key, JSON.stringify(list));
      } catch (e) {
        console.error('Bookmark error:', e);
      }
    };

    function updateBookmarkUI(active) {
      if (active) {
        detailBookmarkBtn.classList.add('active');
        detailBookmarkBtn.innerHTML = '<i class="fas fa-bookmark"></i> <span>Bookmarked</span>';
      } else {
        detailBookmarkBtn.classList.remove('active');
        detailBookmarkBtn.innerHTML = '<i class="far fa-bookmark"></i> <span>Bookmark</span>';
      }
    }
  }

  initDetailPage();
}

// ============================================
// CATALOG / BROWSE PAGE LOGIC (index.html)
// ============================================
if (isCatalogPage) {
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

  // Modal Elements (Preserved & Adjusted)
  const mangaModal = document.getElementById('mangaModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBannerImg = document.getElementById('modalBannerImg');
  const modalCoverImg = document.getElementById('modalCoverImg');
  const modalTitle = document.getElementById('modalTitle');
  const modalAltTitle = document.getElementById('modalAltTitle');
  const modalScore = document.getElementById('modalScore');
  const modalStatus = document.getElementById('modalStatus');
  const modalFormat = document.getElementById('modalFormat');
  const modalYear = document.getElementById('modalYear');
  const modalSynopsis = document.getElementById('modalSynopsis');
  const modalReadFirstBtn = document.getElementById('modalReadFirstBtn');
  const modalChapterCount = document.getElementById('modalChapterCount');
  const modalChaptersGrid = document.getElementById('modalChaptersGrid');
  const chapterFilterInput = document.getElementById('chapterFilterInput');
  const chapterSortBtn = document.getElementById('chapterSortBtn');

  let currentTab = 'trending';
  let currentPage = 1;
  let currentGenre = 'all';
  let activeChaptersList = [];
  let sortDescending = true;
  let activeMangaId = null;

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

  // Initial catalog load
  loadCatalog('trending', 1);
}

// ============================================
// MANGA READER LOGIC (read.html)
// ============================================
if (isReaderPage) {
  const readerViewport = document.getElementById('readerViewport');
  const pagesContainer = document.getElementById('pagesContainer');
  const readerLoading = document.getElementById('readerLoading');
  const readerProgressBar = document.getElementById('readerProgressBar');
  const readerMangaName = document.getElementById('readerMangaName');
  const readerChapterName = document.getElementById('readerChapterName');
  const readerChapterSelect = document.getElementById('readerChapterSelect');
  const prevChapterBtn = document.getElementById('prevChapterBtn');
  const nextChapterBtn = document.getElementById('nextChapterBtn');
  const toggleViewModeBtn = document.getElementById('toggleViewModeBtn');
  const toggleWidthBtn = document.getElementById('toggleWidthBtn');
  const toggleFullscreenBtn = document.getElementById('toggleFullscreenBtn');
  const chapterEndCard = document.getElementById('chapterEndCard');
  const endNextBtn = document.getElementById('endNextBtn');
  const endPrevBtn = document.getElementById('endPrevBtn');
  const endCardTitle = document.getElementById('endCardTitle');
  const readerBackLink = document.getElementById('readerBackLink');

  // URL parameters
  const params = new URLSearchParams(window.location.search);
  const mangaId = params.get('id') || '';
  let currentChapterId = params.get('chapterId') || '';

  let chaptersList = [];
  let currentChapterIndex = -1;
  let currentPageList = [];
  let currentSinglePageIndex = 0;
  let viewMode = 'webtoon'; // 'webtoon' (vertical scroll) | 'single' (one page flip)
  let widthModeIndex = 0;
  const widthModes = ['width-standard', 'width-wide', 'width-full'];
  const widthLabels = ['Standard', 'Wide', 'Full'];

  // ── Load Reader Setup ──
  async function initReader() {
    if (!mangaId) {
      alert('No Manga ID provided!');
      window.location.href = '/manga/';
      return;
    }

    if (readerBackLink) {
      readerBackLink.href = `/manga/detail.html?id=${mangaId}`;
    }

    // Load Manga Details & Chapters List
    const [infoData, chaptersData] = await Promise.all([
      apiFetch(`/info/${mangaId}`),
      apiFetch(`/chapters/${mangaId}`)
    ]);

    if (infoData) {
      const title = formatTitle(infoData.title);
      if (readerMangaName) readerMangaName.textContent = title;
      document.title = `${title} — PBG Manga Reader`;
    }

    if (chaptersData && chaptersData.chapters && chaptersData.chapters.length > 0) {
      chaptersList = chaptersData.chapters;

      // If no chapterId was specified in URL, pick first or last read
      if (!currentChapterId) {
        currentChapterId = chaptersList[chaptersList.length - 1]?.id || chaptersList[0]?.id;
      }

      populateChapterSelect();
      loadChapter(currentChapterId);
    } else {
      if (readerLoading) {
        readerLoading.innerHTML = '<p style="color:var(--accent-pink);">No chapters found for this manga.</p>';
      }
    }
  }

  // ── Populate Chapter Dropdown ──
  function populateChapterSelect() {
    if (!readerChapterSelect) return;
    readerChapterSelect.innerHTML = chaptersList.map((c, idx) => `
      <option value="${c.id}" ${c.id === currentChapterId ? 'selected' : ''}>
        ${c.title || 'Chapter ' + (c.chapter || idx + 1)}
      </option>
    `).join('');
  }

  // ── Update Prev/Next Chapter Buttons ──
  function updateChapterNavButtons() {
    currentChapterIndex = chaptersList.findIndex(c => c.id === currentChapterId);
    if (currentChapterIndex !== -1) {
      const hasNext = currentChapterIndex > 0;
      const hasPrev = currentChapterIndex < chaptersList.length - 1;

      if (nextChapterBtn) nextChapterBtn.disabled = !hasNext;
      if (prevChapterBtn) prevChapterBtn.disabled = !hasPrev;
      if (endNextBtn) endNextBtn.style.display = hasNext ? 'inline-flex' : 'none';
      if (endPrevBtn) endPrevBtn.style.display = hasPrev ? 'inline-flex' : 'none';
    }
  }

  // ── Load Specific Chapter Pages ──
  async function loadChapter(chapterId) {
    currentChapterId = chapterId;
    updateChapterNavButtons();
    if (readerChapterSelect) readerChapterSelect.value = chapterId;

    const chapObj = chaptersList.find(c => c.id === chapterId);
    const chapTitle = chapObj ? (chapObj.title || `Chapter ${chapObj.chapter}`) : 'Chapter';
    if (readerChapterName) readerChapterName.textContent = chapTitle;
    if (endCardTitle) endCardTitle.textContent = `Completed ${chapTitle}`;

    // Update browser URL query
    const url = new URL(window.location);
    url.searchParams.set('chapterId', chapterId);
    window.history.pushState({}, '', url);

    // Show loading
    if (readerLoading) readerLoading.style.display = 'flex';
    if (pagesContainer) pagesContainer.innerHTML = '';
    if (chapterEndCard) chapterEndCard.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Fetch pages
    const pagesData = await apiFetch(`/pages?chapterId=${encodeURIComponent(chapterId)}`);
    if (readerLoading) readerLoading.style.display = 'none';

    if (pagesData && Array.isArray(pagesData) && pagesData.length > 0) {
      currentPageList = pagesData;
      currentSinglePageIndex = 0;
      renderPages();

      // Remember reading progress in localStorage
      try {
        localStorage.setItem(`pbg_manga_progress_${mangaId}`, JSON.stringify({
          chapterId,
          timestamp: Date.now()
        }));
      } catch (_) {}
    } else {
      if (pagesContainer) {
        pagesContainer.innerHTML = `
          <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
            <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:12px; color:var(--accent-pink);"></i>
            <h3>Chapter pages are currently unavailable</h3>
            <p>Please try a different chapter from the dropdown above.</p>
          </div>
        `;
      }
    }
  }

  // ── Render Pages Based on Current View Mode ──
  function renderPages() {
    if (!pagesContainer) return;
    pagesContainer.innerHTML = '';

    if (viewMode === 'webtoon') {
      currentPageList.forEach((page, idx) => {
        const pageWrap = document.createElement('div');
        pageWrap.className = 'manga-page-wrap';
        pageWrap.dataset.page = idx + 1;

        const img = document.createElement('img');
        const originalUrl = page.img || page;
        img.src = getProxiedImg(originalUrl);
        img.alt = `Page ${idx + 1}`;
        img.loading = idx < 3 ? 'eager' : 'lazy';

        img.onerror = () => {
          if (img.src.includes('/api/manga/img')) {
            img.src = originalUrl;
          }
        };

        pageWrap.appendChild(img);
        pagesContainer.appendChild(pageWrap);
      });

      if (chapterEndCard) chapterEndCard.style.display = 'block';
    } else {
      renderSinglePage();
    }
  }

  function renderSinglePage() {
    if (!pagesContainer) return;
    const page = currentPageList[currentSinglePageIndex];
    if (!page) return;

    const originalUrl = page.img || page;
    const totalPages = currentPageList.length;

    pagesContainer.innerHTML = `
      <div class="single-page-mode-wrap">
        <div class="single-page-img-wrap" id="singlePageClickWrap">
          <img src="${getProxiedImg(originalUrl)}" alt="Page ${currentSinglePageIndex + 1}" />
        </div>
        <div class="single-page-counter-bar">
          <button class="reader-nav-btn" id="singlePrevBtn" ${currentSinglePageIndex === 0 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Prev Page
          </button>
          <span>Page ${currentSinglePageIndex + 1} / ${totalPages}</span>
          <button class="reader-nav-btn" id="singleNextBtn" ${currentSinglePageIndex >= totalPages - 1 ? 'disabled' : ''}>
            Next Page <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    `;

    const imgWrap = document.getElementById('singlePageClickWrap');
    if (imgWrap) {
      imgWrap.onclick = (e) => {
        const rect = imgWrap.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX > rect.width / 2) {
          nextSinglePage();
        } else {
          prevSinglePage();
        }
      };
    }

    const singlePrev = document.getElementById('singlePrevBtn');
    const singleNext = document.getElementById('singleNextBtn');
    if (singlePrev) singlePrev.onclick = prevSinglePage;
    if (singleNext) singleNext.onclick = nextSinglePage;

    if (chapterEndCard) {
      chapterEndCard.style.display = currentSinglePageIndex === totalPages - 1 ? 'block' : 'none';
    }

    updateScrollProgress();
  }

  function nextSinglePage() {
    if (currentSinglePageIndex < currentPageList.length - 1) {
      currentSinglePageIndex++;
      renderSinglePage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      goToNextChapter();
    }
  }

  function prevSinglePage() {
    if (currentSinglePageIndex > 0) {
      currentSinglePageIndex--;
      renderSinglePage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ── Navigation between chapters ──
  function goToNextChapter() {
    if (currentChapterIndex > 0) {
      loadChapter(chaptersList[currentChapterIndex - 1].id);
    }
  }

  function goToPrevChapter() {
    if (currentChapterIndex < chaptersList.length - 1) {
      loadChapter(chaptersList[currentChapterIndex + 1].id);
    }
  }

  if (nextChapterBtn) nextChapterBtn.onclick = goToNextChapter;
  if (prevChapterBtn) prevChapterBtn.onclick = goToPrevChapter;
  if (endNextBtn) endNextBtn.onclick = goToNextChapter;
  if (endPrevBtn) endPrevBtn.onclick = goToPrevChapter;

  if (readerChapterSelect) {
    readerChapterSelect.onchange = (e) => {
      if (e.target.value) loadChapter(e.target.value);
    };
  }

  // ── Mode Toggle (Webtoon vs Single-Page) ──
  if (toggleViewModeBtn) {
    toggleViewModeBtn.onclick = () => {
      viewMode = viewMode === 'webtoon' ? 'single' : 'webtoon';
      toggleViewModeBtn.innerHTML = viewMode === 'webtoon' ? '<i class="fas fa-scroll"></i> <span class="hide-mobile">Webtoon</span>' : '<i class="fas fa-file-image"></i> <span class="hide-mobile">Single</span>';
      renderPages();
    };
  }

  // ── Width Toggle ──
  if (toggleWidthBtn && readerViewport) {
    toggleWidthBtn.onclick = () => {
      readerViewport.classList.remove(...widthModes);
      widthModeIndex = (widthModeIndex + 1) % widthModes.length;
      readerViewport.classList.add(widthModes[widthModeIndex]);
      toggleWidthBtn.innerHTML = `<i class="fas fa-arrows-alt-h"></i> <span class="hide-mobile">${widthLabels[widthModeIndex]}</span>`;
    };
  }

  // ── Fullscreen Toggle ──
  if (toggleFullscreenBtn) {
    toggleFullscreenBtn.onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        toggleFullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
      } else {
        document.exitFullscreen().catch(() => {});
        toggleFullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
      }
    };
  }

  // ── Scroll Progress Bar ──
  function updateScrollProgress() {
    if (!readerProgressBar) return;
    if (viewMode === 'webtoon') {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0;
      readerProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    } else {
      const total = currentPageList.length;
      const progress = total > 0 ? ((currentSinglePageIndex + 1) / total) * 100 : 0;
      readerProgressBar.style.width = `${progress}%`;
    }
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      if (viewMode === 'single') nextSinglePage();
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      if (viewMode === 'single') prevSinglePage();
    } else if (e.key === 'f' || e.key === 'F') {
      if (toggleFullscreenBtn) toggleFullscreenBtn.click();
    } else if (e.key === 'm' || e.key === 'M') {
      if (toggleViewModeBtn) toggleViewModeBtn.click();
    }
  });

  initReader();
}
