/* ============================================
   PBG Manga — HD Chapter Reader Controller
   ============================================ */

(() => {
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
  let currentMangaInfo = null;
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
      currentMangaInfo = infoData;
      const title = formatTitle(infoData.title);
      if (readerMangaName) readerMangaName.textContent = title;
      document.title = `${title} — PBG Manga Reader`;
    }

    if (chaptersData && chaptersData.chapters && chaptersData.chapters.length > 0) {
      chaptersList = chaptersData.chapters.slice().sort((a, b) => parseChapterNumber(a) - parseChapterNumber(b));

      // If no chapterId was specified in URL, pick first chapter (Ch 1)
      if (!currentChapterId) {
        currentChapterId = chaptersList[0]?.id;
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
      const hasPrev = currentChapterIndex > 0;
      const hasNext = currentChapterIndex < chaptersList.length - 1;

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

        const KEY = 'pbg_manga_history';
        let history = JSON.parse(localStorage.getItem(KEY) || '[]');
        history = history.filter(item => String(item.id) !== String(mangaId));
        const cover = currentMangaInfo?.coverImage?.large || currentMangaInfo?.coverImage?.medium || '';
        history.unshift({
          id: String(mangaId),
          chapterId: String(chapterId),
          chapterTitle: chapTitle || 'Chapter',
          title: currentMangaInfo ? formatTitle(currentMangaInfo.title) : 'Manga',
          image: cover,
          updatedAt: Date.now()
        });
        if (history.length > 20) history = history.slice(0, 20);
        localStorage.setItem(KEY, JSON.stringify(history));
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
    if (currentChapterIndex < chaptersList.length - 1) {
      loadChapter(chaptersList[currentChapterIndex + 1].id);
    }
  }

  function goToPrevChapter() {
    if (currentChapterIndex > 0) {
      loadChapter(chaptersList[currentChapterIndex - 1].id);
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

  // ── Reading Theme Toggle (Dark Slate, OLED Black, Warm Sepia) ──
  const toggleThemeBtn = document.getElementById('toggleThemeBtn');
  const themes = ['theme-slate', 'theme-oled', 'theme-sepia'];
  const themeLabels = ['Dark', 'OLED', 'Sepia'];
  let currentThemeIdx = parseInt(localStorage.getItem('pbg_manga_theme_idx') || '0');

  function applyTheme(idx) {
    document.body.classList.remove(...themes);
    document.body.classList.add(themes[idx]);
    if (toggleThemeBtn) {
      toggleThemeBtn.innerHTML = `<i class="fas fa-palette"></i> <span class="hide-mobile">${themeLabels[idx]}</span>`;
    }
    localStorage.setItem('pbg_manga_theme_idx', String(idx));
  }

  applyTheme(currentThemeIdx);

  if (toggleThemeBtn) {
    toggleThemeBtn.onclick = () => {
      currentThemeIdx = (currentThemeIdx + 1) % themes.length;
      applyTheme(currentThemeIdx);
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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      if (viewMode === 'single') nextSinglePage();
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      if (viewMode === 'single') prevSinglePage();
    } else if (e.key === ']' || e.key === 'n' || e.key === 'N') {
      goToNextChapter();
    } else if (e.key === '[' || e.key === 'p' || e.key === 'P') {
      goToPrevChapter();
    } else if (e.key === 'f' || e.key === 'F') {
      if (toggleFullscreenBtn) toggleFullscreenBtn.click();
    } else if (e.key === 'm' || e.key === 'M') {
      if (toggleViewModeBtn) toggleViewModeBtn.click();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReader);
  } else {
    initReader();
  }
})();
