/* ============================================
   PBG Anime — Theatre Watch Page Controller
   StreameX Player, Multi-Servers, Episode Grid/List & Seasons
   ============================================ */

(() => {
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

  // ── Helper: Save Watch Progress in LocalStorage ──
  function saveWatchProgress(animeId, episode, title, coverImage) {
    try {
      const KEY = 'pbg_anime_history';
      let history = JSON.parse(localStorage.getItem(KEY) || '[]');
      history = history.filter(item => String(item.id) !== String(animeId));
      history.unshift({
        id: String(animeId),
        episode: Number(episode) || 1,
        title: title || 'Anime',
        image: coverImage || '/assets/images/logo.jpg',
        updatedAt: Date.now()
      });
      if (history.length > 20) history = history.slice(0, 20);
      localStorage.setItem(KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Error saving anime history:', e);
    }
  }

  // ── Load Anime Info & Episode Count ──
  async function loadAnimeInfo() {
    const data = await apiFetch(`/info/${currentAnimeId}`);
    if (!data) return;
    animeDetails = data;

    // Save initial watch progress
    saveWatchProgress(currentAnimeId, currentEpisode, data.title, data.coverImage || data.bannerImage);

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

    if (totalEpisodesCount > 100) {
      const batchCount = Math.ceil(totalEpisodesCount / 100);
      seasonSelector.innerHTML = Array.from({ length: batchCount }, (_, idx) => {
        const start = idx * 100 + 1;
        const end = Math.min((idx + 1) * 100, totalEpisodesCount);
        return `<option value="${idx + 1}">Episodes ${start} - ${end}</option>`;
      }).join('');

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

    // Render StreameX 2x4 server cards with speed/type badges
    if (serversGridList) {
      serversGridList.innerHTML = serverList.map((s, idx) => {
        const isActive = s.id === currentServer;
        const badgeLabel = idx === 0 ? '⚡ Ultra HD' : (s.type === 'dub' ? '🎙️ Dub' : (s.type === 'mirror' ? '🪞 Mirror' : '🚀 Fast'));
        return `
          <div class="streamex-server-card ${isActive ? 'active' : ''}" data-server-id="${s.id}" data-url="${s.url}">
            <div class="server-card-left">
              <img src="${s.flag}" alt="${s.name}" class="server-flag-icon" />
              <span>${s.name}</span>
            </div>
            <div class="server-card-right" style="display:flex; align-items:center; gap:6px;">
              <span class="server-speed-tag" style="font-size:0.62rem; color:var(--accent-purple); background:rgba(168,85,247,0.12); padding:1px 5px; border-radius:4px; font-weight:600;">${badgeLabel}</span>
              <div class="server-status-dot"></div>
            </div>
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
      setTimeout(() => {
        if (playerLoading) {
          playerLoading.style.opacity = '0';
          setTimeout(() => {
            playerLoading.style.display = 'none';
          }, 250);
        }
      }, 400);
    };

    troubleTimer = setTimeout(() => {
      if (playerLoading && playerLoading.style.display !== 'none') {
        const trouble = document.getElementById('playerLoadingTrouble');
        if (trouble) trouble.style.display = 'block';
      }
    }, 4500);

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

    if (animeDetails) {
      saveWatchProgress(currentAnimeId, ep, animeDetails.title, animeDetails.coverImage || animeDetails.bannerImage);
    }

    if (watchEpisodeHeader) watchEpisodeHeader.textContent = `Episode ${currentEpisode}`;
    if (nowPlayingBadge) {
      nowPlayingBadge.innerHTML = `<i class="fas fa-circle-play" style="color: var(--accent-purple);"></i> <span>Now Playing • Episode ${currentEpisode}</span>`;
    }
    document.title = `Watch ${animeDetails?.title || 'Anime'} Episode ${currentEpisode} — PBG Anime`;

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

  // ── Cinema / Theatre Mode Controller ──
  const cinemaToggleBtn = document.getElementById('cinemaToggleBtn');
  if (cinemaToggleBtn) {
    cinemaToggleBtn.addEventListener('click', () => {
      const isCinema = document.body.classList.toggle('cinema-mode-active');
      cinemaToggleBtn.classList.toggle('active', isCinema);
      cinemaToggleBtn.innerHTML = isCinema
        ? '<i class="fas fa-compress"></i> <span>Exit Cinema</span>'
        : '<i class="fas fa-film"></i> <span>Cinema Mode</span>';
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('cinema-mode-active')) {
        document.body.classList.remove('cinema-mode-active');
        cinemaToggleBtn.classList.remove('active');
        cinemaToggleBtn.innerHTML = '<i class="fas fa-film"></i> <span>Cinema Mode</span>';
      }
    });
  }

  // Run watch page loaders
  loadAnimeInfo().then(() => {
    loadServersAndStream();
  });
})();
