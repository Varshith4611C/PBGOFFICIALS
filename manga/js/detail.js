/* ============================================
   PBG Manga — Dedicated Detail Page Controller
   Modeled directly after StreameX /manga/:id
   ============================================ */

(() => {
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
  let sortDescending = false; // Default: Oldest first (Ch 1 -> Ch Max)
  let activeRangeIndex = 0; // 0 = first range, -1 = all
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
      allChapters = chaptersData.chapters.slice().sort((a, b) => parseChapterNumber(a) - parseChapterNumber(b));
      const count = allChapters.length;
      if (detailChaptersVal) detailChaptersVal.textContent = `${count} Chapters`;
      if (detailTotalChaptersCount) detailTotalChaptersCount.textContent = count;

      // Start Reading CTA button (First chapter)
      const firstChapter = allChapters[0];
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
    if (!chapterRangeTabs || chapters.length <= 60) {
      if (chapterRangeTabs) chapterRangeTabs.style.display = 'none';
      rangeChunks = [];
      return;
    }

    chapterRangeTabs.style.display = 'flex';
    const total = chapters.length;
    const chunkSize = 100;

    const nums = chapters.map(parseChapterNumber).filter(n => n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;

    rangeChunks = [];

    if (maxNum > 60) {
      const numBuckets = Math.ceil(maxNum / chunkSize);
      for (let b = 0; b < numBuckets; b++) {
        const startNum = b * chunkSize + 1;
        const endNum = (b + 1) * chunkSize;
        const bucketChapters = chapters.filter(c => {
          const n = parseChapterNumber(c);
          return n >= startNum && n <= endNum;
        });
        if (bucketChapters.length > 0) {
          const displayEnd = (b === numBuckets - 1 && maxNum < endNum) ? maxNum : endNum;
          rangeChunks.push({
            index: rangeChunks.length,
            label: `Ch. ${startNum}-${displayEnd}`,
            chapters: bucketChapters
          });
        }
      }
    } else {
      const numChunks = Math.ceil(total / chunkSize);
      for (let i = 0; i < numChunks; i++) {
        const slice = chapters.slice(i * chunkSize, (i + 1) * chunkSize);
        const start = i * chunkSize + 1;
        const end = Math.min((i + 1) * chunkSize, total);
        rangeChunks.push({
          index: i,
          label: `Ch. ${start}-${end}`,
          chapters: slice
        });
      }
    }

    let html = `<button class="range-tab-btn ${activeRangeIndex === -1 ? 'active' : ''}" data-range="-1">All (${total})</button>`;
    rangeChunks.forEach(chunk => {
      html += `<button class="range-tab-btn ${activeRangeIndex === chunk.index ? 'active' : ''}" data-range="${chunk.index}">${chunk.label}</button>`;
    });

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

    let chaps = [];

    // Filter by search query
    if (filterText) {
      chaps = allChapters.filter(c => 
        (c.title || '').toLowerCase().includes(filterText.toLowerCase()) || 
        (c.chapter || '').toString().includes(filterText)
      );
    } else if (activeRangeIndex !== -1 && rangeChunks.length > 0) {
      const activeChunk = rangeChunks.find(c => c.index === activeRangeIndex) || rangeChunks[0];
      chaps = activeChunk ? [...activeChunk.chapters] : [...allChapters];
    } else {
      chaps = [...allChapters];
    }

    // Apply sorting: allChapters is ascending by default
    if (sortDescending) {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDetailPage);
  } else {
    initDetailPage();
  }
})();
