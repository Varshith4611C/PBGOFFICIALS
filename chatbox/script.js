/* ============================================
   PBG ChatBox — Client-Side Logic
   ============================================ */

(() => {
  'use strict';

  // ── DOM Elements ──
  const usernameModal = document.getElementById('usernameModal');
  const usernameForm = document.getElementById('usernameForm');
  const usernameInput = document.getElementById('usernameInput');
  const modalError = document.getElementById('modalError');
  const joinBtn = document.getElementById('joinBtn');
  const chatApp = document.getElementById('chatApp');
  const chatLayout = document.getElementById('chatLayout');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const messagesList = document.getElementById('messagesList');
  const messagesContainer = document.getElementById('messagesContainer');
  const roomList = document.getElementById('roomList');
  const userList = document.getElementById('userList');
  const typingIndicator = document.getElementById('typingIndicator');
  const typingText = document.getElementById('typingText');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const emojiGrid = document.getElementById('emojiGrid');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarRooms = document.getElementById('sidebarRooms');
  const sidebarUsers = document.getElementById('sidebarUsers');
  const usersToggle = document.getElementById('usersToggle');
  const onlineCount = document.getElementById('onlineCount');
  const onlineCountBadge = document.getElementById('onlineCountBadge');
  const topbarRoomIcon = document.getElementById('topbarRoomIcon');
  const topbarRoomName = document.getElementById('topbarRoomName');
  const topbarRoomDesc = document.getElementById('topbarRoomDesc');
  const topbarAvatar = document.getElementById('topbarAvatar');
  const topbarUsername = document.getElementById('topbarUsername');
  const messagesStartIcon = document.getElementById('messagesStartIcon');
  const messagesStartTitle = document.getElementById('messagesStartTitle');
  const messagesStartDesc = document.getElementById('messagesStartDesc');

  // Reply
  const replyBar = document.getElementById('replyBar');
  const replyBarUser = document.getElementById('replyBarUser');
  const replyBarPreview = document.getElementById('replyBarPreview');
  const replyBarClose = document.getElementById('replyBarClose');

  // Music Video Stage & Deck Elements
  const musicStage = document.getElementById('musicStage');
  const musicStageBadge = document.getElementById('musicStageBadge');
  const musicStageTitle = document.getElementById('musicStageTitle');
  const musicStageArtist = document.getElementById('musicStageArtist');
  const musicStageTogglePlay = document.getElementById('musicStageTogglePlay');
  const musicStageSkipBtn = document.getElementById('musicStageSkipBtn');
  const musicStageResyncBtn = document.getElementById('musicStageResyncBtn');
  const musicStageSearchToggle = document.getElementById('musicStageSearchToggle');
  const musicStageLibToggle = document.getElementById('musicStageLibToggle');
  const musicStageQueueToggle = document.getElementById('musicStageQueueToggle');
  const musicStageQueueBadge = document.getElementById('musicStageQueueBadge');
  const musicStageTheaterBtn = document.getElementById('musicStageTheaterBtn');
  const musicStageSearchDrawer = document.getElementById('musicStageSearchDrawer');
  const musicStageSearchInput = document.getElementById('musicStageSearchInput');
  const musicStageSearchBtn = document.getElementById('musicStageSearchBtn');
  const musicStageSearchClose = document.getElementById('musicStageSearchClose');
  const musicStageSearchResults = document.getElementById('musicStageSearchResults');
  const musicStageQueueDrawer = document.getElementById('musicStageQueueDrawer');
  const musicStageQueueClose = document.getElementById('musicStageQueueClose');
  const musicStageQueueList = document.getElementById('musicStageQueueList');
  const musicStageQueueCount = document.getElementById('musicStageQueueCount');
  const musicStagePills = document.getElementById('musicStagePills');
  const musicVideoTrackOverlay = document.getElementById('musicVideoTrackOverlay');
  const musicVideoOverlayTitle = document.getElementById('musicVideoOverlayTitle');
  const musicVideoOverlaySub = document.getElementById('musicVideoOverlaySub');
  const musicVideoStatus = document.getElementById('musicVideoStatus');
  const musicStageVinyl = document.getElementById('musicStageVinyl');
  const musicMobilePlayOverlay = document.getElementById('musicMobilePlayOverlay');
  const musicMobilePlayBtn = document.getElementById('musicMobilePlayBtn');
  const mpoTitle = document.getElementById('mpoTitle');
  const mpoSub = document.getElementById('mpoSub');
  const musicStageDirectYtBtn = document.getElementById('musicStageDirectYtBtn');
  const musicRestrictedFallback = document.getElementById('musicRestrictedFallback');
  const mrfTitle = document.getElementById('mrfTitle');
  const mrfDesc = document.getElementById('mrfDesc');
  const mrfSwitchAlternateBtn = document.getElementById('mrfSwitchAlternateBtn');
  const mrfDirectLink = document.getElementById('mrfDirectLink');

  // Music Audio Deck Elements (Compact Deck)
  const musicAudioDeck = document.getElementById('musicAudioDeck');
  const musicVinyl = document.getElementById('musicVinyl');
  const musicEq = document.getElementById('musicEq');
  const musicModeTag = document.getElementById('musicModeTag');
  const musicTrackTitle = document.getElementById('musicTrackTitle');
  const musicTrackMeta = document.getElementById('musicTrackMeta');
  const musicToggleBtn = document.getElementById('musicToggleBtn');
  const musicSkipBtn = document.getElementById('musicSkipBtn');
  const musicLibraryToggle = document.getElementById('musicLibraryToggle');
  const musicQueueToggle = document.getElementById('musicQueueToggle');
  const musicQueueBadge = document.getElementById('musicQueueBadge');
  const musicAddToggle = document.getElementById('musicAddToggle');
  const musicStationsPills = document.getElementById('musicStationsPills');
  const musicDropdownPanel = document.getElementById('musicDropdownPanel');
  const musicAddForm = document.getElementById('musicAddForm');
  const musicUrlInput = document.getElementById('musicUrlInput');
  const musicAddBtn = document.getElementById('musicAddBtn');
  const musicQueueView = document.getElementById('musicQueueView');
  const musicQueueCount = document.getElementById('musicQueueCount');
  const musicQueueList = document.getElementById('musicQueueList');
  const musicQuickResults = document.getElementById('musicQuickResults');
  const realRadioAudio = document.getElementById('realRadioAudio');
  const bgAudioAnchor = document.getElementById('bgAudioAnchor');
  const musicIframe = document.getElementById('musicIframe');
  const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

  // Music Library Elements
  const musicLibraryModal = document.getElementById('musicLibraryModal');
  const musicLibraryClose = document.getElementById('musicLibraryClose');
  const openAddSongBtn = document.getElementById('openAddSongBtn');
  const addSongPanel = document.getElementById('addSongPanel');
  const closeAddSongBtn = document.getElementById('closeAddSongBtn');
  const addSongTitle = document.getElementById('addSongTitle');
  const addSongArtist = document.getElementById('addSongArtist');
  const addSongCategory = document.getElementById('addSongCategory');
  const addSongUrl = document.getElementById('addSongUrl');
  const addSongError = document.getElementById('addSongError');
  const submitAddSongBtn = document.getElementById('submitAddSongBtn');
  const musicLibSearchInput = document.getElementById('musicLibSearchInput');
  const musicLibSearchBtn = document.getElementById('musicLibSearchBtn');
  const musicLibContent = document.getElementById('musicLibContent');
  const libTabs = document.querySelectorAll('.lib-tab');

  // Anime Cinema Elements
  const cinemaStage = document.getElementById('cinemaStage');
  const cinemaAnimeTitle = document.getElementById('cinemaAnimeTitle');
  const cinemaAnimeEp = document.getElementById('cinemaAnimeEp');
  const cinemaTogglePlay = document.getElementById('cinemaTogglePlay');
  const cinemaResyncBtn = document.getElementById('cinemaResyncBtn');
  const cinemaPrevEp = document.getElementById('cinemaPrevEp');
  const cinemaNextEp = document.getElementById('cinemaNextEp');
  const cinemaSearchToggle = document.getElementById('cinemaSearchToggle');
  const cinemaStopBtn = document.getElementById('cinemaStopBtn');
  const cinemaSearchDrawer = document.getElementById('cinemaSearchDrawer');
  const animeSearchInput = document.getElementById('animeSearchInput');
  const cinemaSearchClose = document.getElementById('cinemaSearchClose');
  const animeResults = document.getElementById('animeResults');
  const cinemaPlayerWrap = document.getElementById('cinemaPlayerWrap');
  const animeVideo = document.getElementById('animeVideo');
  const cinemaEmptyState = document.getElementById('cinemaEmptyState');
  const cinemaQuickBrowseBtn = document.getElementById('cinemaQuickBrowseBtn');
  const cinemaPauseOverlay = document.getElementById('cinemaPauseOverlay');
  const pauseOverlayTitle = document.getElementById('pauseOverlayTitle');
  const pauseOverlayDesc = document.getElementById('pauseOverlayDesc');
  const pauseOverlayResumeBtn = document.getElementById('pauseOverlayResumeBtn');
  const cinemaServerBtn = document.getElementById('cinemaServerBtn');
  const cinemaServerMenu = document.getElementById('cinemaServerMenu');
  const cinemaServerLabel = document.getElementById('cinemaServerLabel');
  const cinemaTrendingHeader = document.getElementById('cinemaTrendingHeader');
  const cinemaQuickPills = document.getElementById('cinemaQuickPills');
  let currentAnimeServers = [];

  // Gaming Stage Elements (WebRTC Screen Sharing)
  const gamingStage = document.getElementById('gamingStage');
  const gamingBadge = document.getElementById('gamingBadge');
  const gamingStreamerTitle = document.getElementById('gamingStreamerTitle');
  const gamingStreamerSub = document.getElementById('gamingStreamerSub');
  const gamingLivePill = document.getElementById('gamingLivePill');
  const gamingStartShareBtn = document.getElementById('gamingStartShareBtn');
  const gamingStopShareBtn = document.getElementById('gamingStopShareBtn');
  const gamingAudioToggle = document.getElementById('gamingAudioToggle');
  const gamingPipBtn = document.getElementById('gamingPipBtn');
  const gamingFullscreenBtn = document.getElementById('gamingFullscreenBtn');
  const gamingTheaterBtn = document.getElementById('gamingTheaterBtn');
  const gamingPlayerWrap = document.getElementById('gamingPlayerWrap');
  const gamingStandby = document.getElementById('gamingStandby');
  const gamingStandbyStartBtn = document.getElementById('gamingStandbyStartBtn');
  const gamingVideoContainer = document.getElementById('gamingVideoContainer');
  const gamingVideo = document.getElementById('gamingVideo');
  const gamingGlow = document.getElementById('gamingGlow');
  const gamingVideoOverlay = document.getElementById('gamingVideoOverlay');
  const gamingOverlayAvatar = document.getElementById('gamingOverlayAvatar');
  const gamingOverlayTitle = document.getElementById('gamingOverlayTitle');
  const gamingOverlaySub = document.getElementById('gamingOverlaySub');
  const gamingCameraBtn = document.getElementById('gamingCameraBtn');
  const gamingStandbyCamBtn = document.getElementById('gamingStandbyCamBtn');
  const gamingHttpsBanner = document.getElementById('gamingHttpsBanner');
  const gamingHttpsLink = document.getElementById('gamingHttpsLink');
  const gamingMobileUnmuteOverlay = document.getElementById('gamingMobileUnmuteOverlay');
  const gamingMobileUnmuteBtn = document.getElementById('gamingMobileUnmuteBtn');

  // ── State ──
  let socket = null;
  let currentUser = null;
  let currentRoom = 'general';
  let rooms = [];
  let roomCounts = {};
  let typingUsers = new Map();
  let typingTimeout = null;
  let isTyping = false;
  let lastMessageUser = null;
  let lastMessageTime = 0;
  let replyingTo = null;
  let currentAnimeInfo = null;
  let currentMusicState = null;
  let currentAnimeState = null;
  let currentlyPlayingStreamUrl = '';
  let currentLoadedDirectStream = null;
  let currentEmbedSrc = '';
  let activeLibraryCategory = 'all';
  let hlsInstance = null;
  let isRemoteAnimeSync = false;
  let lastSeekEmit = 0;

  // Gaming Screen Sharing WebRTC State
  let currentGamingState = null;
  let localScreenStream = null;
  let isSharingScreen = false;
  const streamerPeerConnections = new Map(); // viewerSocketId -> RTCPeerConnection
  let viewerPeerConnection = null;
  let viewerRemoteStream = null;
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // ── Safe LocalStorage ──
  function getStoredUsername() {
    try {
      return localStorage.getItem('pbg-chatbox-username');
    } catch (e) {
      return null;
    }
  }

  function setStoredUsername(name) {
    try {
      localStorage.setItem('pbg-chatbox-username', name);
    } catch (e) {
      console.warn('LocalStorage unavailable:', e);
    }
  }

  // ── Emoji List ──
  const EMOJIS = [
    '😀','😁','😂','🤣','😃','😄','😅','😆',
    '😉','😊','😋','😎','😍','🥰','😘','😗',
    '🤩','🥳','😏','😒','😞','😔','😟','😕',
    '😤','😠','😡','🤬','😈','👿','💀','☠️',
    '💩','🤡','👹','👻','👽','🤖','😺','😸',
    '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏',
    '✌️','🤞','🤟','🤘','🤙','👍','👎','✊',
    '👊','🤛','🤜','👏','🙌','👐','🤲','🤝',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍',
    '💯','💢','💥','💫','💦','💨','🕳️','💣',
    '🔥','⭐','🌟','✨','💎','🏆','🎮','🎯',
    '🎵','🎶','🎸','🎹','🥁','🎤','🎧','📺',
  ];

  // ── Utility Functions ──
  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  function getAvatarColor(name) {
    const colors = ['#22d3ee','#a78bfa','#f472b6','#34d399','#fbbf24','#fb7185','#60a5fa','#818cf8','#2dd4bf','#fb923c'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  }

  function formatMediaTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function isNearBottom() {
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 120;
  }

  function scrollToBottom(smooth = true) {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  // ── Username Modal ──
  function initModal() {
    const savedUser = getStoredUsername();
    if (savedUser && savedUser.trim().length >= 2) {
      currentUser = savedUser.trim();
      usernameModal.style.display = 'none';
      chatApp.style.display = 'flex';
      connectSocket();
      return;
    }

    function validateInput() {
      const val = usernameInput.value.trim();
      if (!val) {
        joinBtn.disabled = false;
        modalError.style.display = 'none';
        return true;
      }
      if (val.length < 2) {
        modalError.textContent = 'Username must be at least 2 characters.';
        modalError.style.display = 'block';
        return false;
      }
      modalError.style.display = 'none';
      return true;
    }

    usernameInput.addEventListener('input', validateInput);

    usernameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleJoin();
    });

    joinBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleJoin();
    });

    if (window.innerWidth > 768) {
      setTimeout(() => usernameInput.focus(), 150);
    }
  }

  function handleJoin() {
    let val = usernameInput.value.trim();
    val = val.replace(/\s+/g, ' ');

    if (!val || val.length < 2) {
      modalError.textContent = 'Please enter at least 2 characters.';
      modalError.style.display = 'block';
      usernameInput.focus();
      return;
    }

    if (val.length > 25) val = val.slice(0, 25);

    currentUser = val;
    setStoredUsername(val);
    usernameModal.style.display = 'none';
    chatApp.style.display = 'flex';
    connectSocket();
  }

  // ══════════════════════════════════════
  //  SOCKET CONNECTION
  // ══════════════════════════════════════
  function connectSocket() {
    socket = io();
    const color = getAvatarColor(currentUser);
    topbarAvatar.textContent = getInitials(currentUser);
    topbarAvatar.style.background = color;
    topbarUsername.textContent = currentUser;
    socket.emit('user-join', { username: currentUser, room: currentRoom });

    socket.on('room-list', (roomData) => { rooms = roomData; renderRoomList(); });
    socket.on('message-history', (messages) => {
      messagesList.innerHTML = '';
      lastMessageUser = null;
      lastMessageTime = 0;
      messages.forEach(msg => renderMessage(msg, false));
      scrollToBottom(false);
    });
    socket.on('new-message', (msg) => {
      const wasNearBottom = isNearBottom();
      renderMessage(msg, true);
      if (wasNearBottom) scrollToBottom();
      else scrollBottomBtn.style.display = 'flex';
    });
    socket.on('user-list', (users) => renderUserList(users));
    socket.on('room-counts', (counts) => { roomCounts = counts; updateRoomCounts(); });
    socket.on('user-typing', ({ username, isTyping: typing }) => {
      if (typing) typingUsers.set(username, Date.now());
      else typingUsers.delete(username);
      updateTypingIndicator();
    });

    // Music & Anime state listeners
    socket.on('music-state', (state) => {
      currentMusicState = state;
      updateMusicUI(state);
    });

    socket.on('music-error', ({ message }) => {
      if (addSongError && addSongPanel && addSongPanel.style.display !== 'none') {
        showAddSongError(message);
      } else {
        alert(message);
      }
    });

    socket.on('anime-state', (state) => {
      currentAnimeState = state;
      updateAnimeUI(state);
    });

    // Real-Time Synchronized Anime Playback Actions (Play / Pause / Seek)
    socket.on('anime-action', ({ action, currentTime, username }) => {
      handleRemoteAnimeAction(action, currentTime, username);
    });

    // Gaming room state & WebRTC signaling listeners
    socket.on('gaming-state', (state) => {
      currentGamingState = state;
      updateGamingUI(state);
      updateGamingBadge();
    });

    socket.on('gaming-signal', ({ from, fromUser, signal }) => {
      handleGamingSignal(from, fromUser, signal);
    });

    // Message reactions update
    socket.on('message-reaction-updated', ({ messageId, reactions }) => {
      const container = document.getElementById(`msg-reactions-${messageId}`);
      if (container) {
        container.innerHTML = renderReactionsHtml(reactions, messageId);
      }
    });

    initMessageInput();
    initEmojiPicker();
    initSidebars();
    initScrollDetection();
    initReply();
    initMusicDeck();
    initMusicStage();
    initMusicLibrary();
    initCinemaStage();
    initGamingStage();
    initVisualizer();
    updateRoomView();
  }

  // ══════════════════════════════════════
  //  ROOM LIST & SWITCHING
  // ══════════════════════════════════════
  function renderRoomList() {
    roomList.innerHTML = '';
    rooms.forEach(room => {
      const li = document.createElement('li');
      li.className = `room-item${room.id === currentRoom ? ' active' : ''}`;
      li.dataset.roomId = room.id;
      let badge = '';
      if (room.id === 'music') {
        badge = '<span class="room-feature-badge badge-listen">🎵 Video & Song</span>';
      } else if (room.id === 'anime-manga') {
        badge = '<span class="room-feature-badge badge-watch">📺 Watch</span>';
      } else if (room.id === 'gaming') {
        if (currentGamingState && currentGamingState.isLive) {
          badge = '<span class="room-feature-badge badge-live-stream"><span class="glp-dot"></span> LIVE</span>';
        } else {
          badge = '<span class="room-feature-badge badge-gaming">🖥️ Screen Share</span>';
        }
      }
      li.innerHTML = `
        <span class="room-icon">${room.icon}</span>
        <div class="room-info">
          <div class="room-name">${escapeHtml(room.name)} ${badge}</div>
          <div class="room-count"><span data-room-count="${room.id}">${roomCounts[room.id] || 0}</span> online</div>
        </div>
      `;
      li.addEventListener('click', () => switchRoom(room.id));
      roomList.appendChild(li);
    });
  }

  function updateRoomCounts() {
    rooms.forEach(room => {
      const el = document.querySelector(`[data-room-count="${room.id}"]`);
      if (el) el.textContent = roomCounts[room.id] || 0;
    });
  }

  function switchRoom(roomId) {
    if (roomId === currentRoom) return;

    // If switching away from gaming while streaming or viewing
    if (currentRoom === 'gaming' && roomId !== 'gaming') {
      if (isSharingScreen) {
        stopScreenShare();
      } else if (viewerPeerConnection) {
        if (currentGamingState && currentGamingState.streamerId) {
          socket.emit('gaming-signal', {
            to: currentGamingState.streamerId,
            signal: { type: 'viewer-leave' }
          });
        }
        cleanupViewerConnection();
      }
    }

    currentRoom = roomId;
    lastMessageUser = null;
    lastMessageTime = 0;
    typingUsers.clear();
    updateTypingIndicator();
    cancelReply();

    document.querySelectorAll('.room-item').forEach(el => {
      el.classList.toggle('active', el.dataset.roomId === roomId);
    });

    const room = rooms.find(r => r.id === roomId);
    if (room) {
      topbarRoomIcon.textContent = room.icon;
      topbarRoomName.textContent = room.name;
      topbarRoomDesc.textContent = room.description;
      messagesStartIcon.textContent = room.icon;
      messagesStartTitle.textContent = `Welcome to #${room.name}`;
      messagesStartDesc.textContent = room.description;
    }

    // Auto-close mobile sidebars
    sidebarRooms.classList.remove('open');
    sidebarUsers.classList.remove('open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('open');

    socket.emit('switch-room', roomId);
    updateRoomView();

    // If switching to music room via user tap, unlock audio & video immediately
    if (roomId === 'music') {
      setTimeout(() => {
        if (typeof userGesturePlayAudioAndVideo === 'function') {
          userGesturePlayAudioAndVideo();
        }
      }, 50);
    }
  }

  function updateRoomView() {
    if (currentRoom === 'music') {
      if (musicStage) musicStage.style.display = 'flex';
      chatLayout.classList.add('music-active');
      if (musicAudioDeck) musicAudioDeck.style.display = 'none';
      if (currentMusicState) updateMusicUI(currentMusicState);
    } else {
      if (musicStage) musicStage.style.display = 'none';
      chatLayout.classList.remove('music-active');
      chatLayout.classList.remove('music-theater');
      if (musicStageSearchDrawer) musicStageSearchDrawer.style.display = 'none';
      if (musicStageQueueDrawer) musicStageQueueDrawer.style.display = 'none';
      if (musicAudioDeck) musicAudioDeck.style.display = 'none';
      if (musicDropdownPanel) musicDropdownPanel.style.display = 'none';
      if (musicLibraryModal) musicLibraryModal.style.display = 'none';
      stopAllAudio();
    }

    if (currentRoom === 'anime-manga') {
      cinemaStage.style.display = 'flex';
      chatLayout.classList.add('cinema-active');
      if (currentAnimeState) {
        updateAnimeUI(currentAnimeState);
      } else {
        renderQuickPills();
      }
    } else {
      cinemaStage.style.display = 'none';
      chatLayout.classList.remove('cinema-active');
      cinemaSearchDrawer.style.display = 'none';
      if (cinemaServerMenu) cinemaServerMenu.style.display = 'none';
      if (animeVideo) animeVideo.pause();
      const iframe = cinemaPlayerWrap ? cinemaPlayerWrap.querySelector('iframe.cinema-iframe') : null;
      if (iframe) iframe.src = 'about:blank';
    }

    if (currentRoom === 'gaming') {
      if (gamingStage) gamingStage.style.display = 'flex';
      chatLayout.classList.add('gaming-active');
      if (currentGamingState) {
        updateGamingUI(currentGamingState);
      }
      // If live and we are not the streamer and not connected yet, request stream
      if (currentGamingState && currentGamingState.isLive && currentGamingState.streamerId !== socket?.id) {
        if (!viewerPeerConnection) {
          socket.emit('gaming-signal', {
            to: currentGamingState.streamerId,
            signal: { type: 'viewer-join' }
          });
        }
      }
    } else {
      if (gamingStage) gamingStage.style.display = 'none';
      chatLayout.classList.remove('gaming-active');
      chatLayout.classList.remove('gaming-theater');
    }

    setTimeout(() => scrollToBottom(false), 50);
  }

  // ══════════════════════════════════════
  //  USER LIST
  // ══════════════════════════════════════
  function renderUserList(users) {
    userList.innerHTML = '';
    onlineCount.textContent = users.length;
    onlineCountBadge.textContent = users.length;
    users.forEach(user => {
      const li = document.createElement('li');
      li.className = 'user-list-item';
      li.innerHTML = `
        <div class="user-avatar" style="background: ${user.color}">${user.initials}</div>
        <span class="user-list-name">${escapeHtml(user.username)}</span>
      `;
      userList.appendChild(li);
    });
  }

  // ══════════════════════════════════════
  //  MESSAGES + REPLIES
  // ══════════════════════════════════════
  function renderMessage(msg, animated) {
    if (msg.type === 'system') {
      const div = document.createElement('div');
      div.className = 'message message-system';
      div.innerHTML = `<span class="message-system-text"><i class="fas fa-arrow-right"></i> ${escapeHtml(msg.text)}</span>`;
      if (animated) div.style.animation = 'msgSlideIn 0.3s ease';
      messagesList.appendChild(div);
      lastMessageUser = null;
      lastMessageTime = 0;
      return;
    }

    const isSelf = msg.socketId === socket.id;
    const timeDiff = msg.timestamp - lastMessageTime;
    const isCompact = lastMessageUser === msg.username && timeDiff < 300000 && !msg.replyTo;

    const div = document.createElement('div');
    div.dataset.msgId = msg.id;

    let replyHtml = '';
    if (msg.replyTo) {
      replyHtml = `
        <div class="message-reply-preview" data-reply-target="${msg.replyTo.id}">
          <span class="reply-preview-user" style="color: ${msg.replyTo.color}">${escapeHtml(msg.replyTo.username)}</span>
          <span class="reply-preview-text">${escapeHtml(msg.replyTo.text)}</span>
        </div>
      `;
    }

    const reactionsHtml = renderReactionsHtml(msg.reactions, msg.id);

    const actionsHtml = `
      <div class="message-actions">
        <div class="msg-reaction-bar">
          <button class="msg-reaction-btn" data-msg-id="${msg.id}" data-emoji="👍" title="Like">👍</button>
          <button class="msg-reaction-btn" data-msg-id="${msg.id}" data-emoji="❤️" title="Love">❤️</button>
          <button class="msg-reaction-btn" data-msg-id="${msg.id}" data-emoji="🔥" title="Fire">🔥</button>
          <button class="msg-reaction-btn" data-msg-id="${msg.id}" data-emoji="😂" title="Laugh">😂</button>
          <button class="msg-reaction-btn" data-msg-id="${msg.id}" data-emoji="🎌" title="Anime">🎌</button>
        </div>
        <button class="msg-action-btn msg-reply-btn" data-msg-id="${msg.id}" data-msg-user="${escapeHtml(msg.username)}" data-msg-text="${escapeHtml(msg.text)}" data-msg-color="${msg.color}" title="Reply">
          <i class="fas fa-reply"></i>
        </button>
      </div>
    `;

    if (isCompact) {
      div.className = `message message-compact${isSelf ? ' message-self' : ''}`;
      div.style.position = 'relative';
      div.innerHTML = `
        ${actionsHtml}
        <span class="message-compact-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div class="message-body">
          <div class="message-text">${formatMessageText(msg.text)}</div>
          <div class="message-reactions" id="msg-reactions-${msg.id}">${reactionsHtml}</div>
        </div>
      `;
    } else {
      div.className = `message${isSelf ? ' message-self' : ''}`;
      div.innerHTML = `
        ${actionsHtml}
        <div class="message-avatar" style="background: ${msg.color}">${msg.initials}</div>
        <div class="message-body">
          ${replyHtml}
          <div class="message-header">
            <span class="message-username" style="color: ${msg.color}">${escapeHtml(msg.username)}</span>
            <span class="message-time">${formatTime(msg.timestamp)}</span>
          </div>
          <div class="message-text">${formatMessageText(msg.text)}</div>
          <div class="message-reactions" id="msg-reactions-${msg.id}">${reactionsHtml}</div>
        </div>
      `;
    }

    if (!animated) div.style.animation = 'none';
    messagesList.appendChild(div);
    lastMessageUser = msg.username;
    lastMessageTime = msg.timestamp;
  }

  function renderReactionsHtml(reactions, msgId) {
    if (window.ChatReactions) {
      return window.ChatReactions.renderReactionsHtml(reactions, msgId, currentUser, escapeHtml);
    }
    if (!reactions || typeof reactions !== 'object') return '';
    return Object.entries(reactions).map(([emoji, users]) => {
      if (!Array.isArray(users) || users.length === 0) return '';
      const hasMe = currentUser && users.includes(currentUser);
      return `
        <button class="msg-reaction-pill${hasMe ? ' active' : ''}" data-msg-id="${msgId}" data-emoji="${emoji}" title="${escapeHtml(users.join(', '))}">
          <span class="mrp-emoji">${emoji}</span>
          <span class="mrp-count">${users.length}</span>
        </button>
      `;
    }).join('');
  }

  function formatMessageText(text) {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/`(.*?)`/g, '<code style="background:rgba(52,211,153,0.1);padding:2px 6px;border-radius:4px;font-size:0.85em;">$1</code>');
    escaped = escaped.replace(/(https?:\/\/[^\s<"'>]+)/g, (match) => {
      try {
        const u = new URL(match.replace(/&amp;/g, '&'));
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          const safeHref = escapeHtml(u.href);
          return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color:var(--emerald-400);text-decoration:underline;">${match}</a>`;
        }
      } catch {}
      return match;
    });
    return escaped;
  }

  // ── Reply System ──
  function initReply() {
    messagesList.addEventListener('click', (e) => {
      if (window.ChatReactions && window.ChatReactions.handleReactionClick(e.target, socket)) {
        return;
      }
      const reactionBtn = e.target.closest('.msg-reaction-btn, .msg-reaction-pill');
      if (reactionBtn) {
        const msgId = reactionBtn.dataset.msgId;
        const emoji = reactionBtn.dataset.emoji;
        if (msgId && emoji && socket) {
          socket.emit('message-react', { messageId, emoji });
        }
        return;
      }

      const replyBtn = e.target.closest('.msg-reply-btn');
      if (replyBtn) {
        setReply({
          id: replyBtn.dataset.msgId,
          username: replyBtn.dataset.msgUser,
          text: replyBtn.dataset.msgText,
          color: replyBtn.dataset.msgColor,
        });
        return;
      }
      const replyPreview = e.target.closest('.message-reply-preview');
      if (replyPreview) {
        const targetId = replyPreview.dataset.replyTarget;
        const targetEl = document.querySelector(`[data-msg-id="${targetId}"]`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.style.background = 'rgba(52,211,153,0.08)';
          setTimeout(() => { targetEl.style.background = ''; }, 1500);
        }
      }
    });

    replyBarClose.addEventListener('click', cancelReply);
  }

  function setReply(msgData) {
    replyingTo = msgData;
    replyBarUser.textContent = msgData.username;
    replyBarPreview.textContent = msgData.text;
    replyBar.style.display = 'flex';
    messageInput.focus();
  }

  function cancelReply() {
    replyingTo = null;
    replyBar.style.display = 'none';
  }

  // ── Message Input ──
  function initMessageInput() {
    messageInput.addEventListener('input', () => {
      sendBtn.disabled = !messageInput.value.trim();
      if (!isTyping && messageInput.value.trim()) {
        isTyping = true;
        socket.emit('typing', true);
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => { isTyping = false; socket.emit('typing', false); }, 2000);
    });
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      if (e.key === 'Escape') cancelReply();
    });
    sendBtn.addEventListener('click', sendMessage);
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    socket.emit('send-message', { text, replyTo: replyingTo || null });
    messageInput.value = '';
    sendBtn.disabled = true;
    isTyping = false;
    socket.emit('typing', false);
    clearTimeout(typingTimeout);
    cancelReply();
    messageInput.focus();
  }

  // ── Typing Indicator ──
  function updateTypingIndicator() {
    const now = Date.now();
    typingUsers.forEach((ts, user) => { if (now - ts > 5000) typingUsers.delete(user); });
    const names = [...typingUsers.keys()];
    if (names.length === 0) { typingIndicator.style.display = 'none'; return; }
    typingIndicator.style.display = 'flex';
    if (names.length === 1) typingText.textContent = `${names[0]} is typing...`;
    else if (names.length === 2) typingText.textContent = `${names[0]} and ${names[1]} are typing...`;
    else typingText.textContent = `${names.length} people are typing...`;
  }

  // ── Emoji Picker ──
  function initEmojiPicker() {
    EMOJIS.forEach(emoji => {
      const span = document.createElement('span');
      span.className = 'emoji-item';
      span.textContent = emoji;
      span.addEventListener('click', () => {
        messageInput.value += emoji;
        messageInput.focus();
        sendBtn.disabled = !messageInput.value.trim();
        emojiPicker.style.display = 'none';
      });
      emojiGrid.appendChild(span);
    });
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
      if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) emojiPicker.style.display = 'none';
    });
  }

  // ── Sidebars (Touch & Desktop Friendly) ──
  function initSidebars() {
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    sidebarToggle.addEventListener('click', () => {
      const isOpen = sidebarRooms.classList.toggle('open');
      sidebarUsers.classList.remove('open');
      backdrop.classList.toggle('open', isOpen);
    });

    usersToggle.addEventListener('click', () => {
      const isOpen = sidebarUsers.classList.toggle('open');
      sidebarRooms.classList.remove('open');
      backdrop.classList.toggle('open', isOpen);
    });

    backdrop.addEventListener('click', () => {
      sidebarRooms.classList.remove('open');
      sidebarUsers.classList.remove('open');
      backdrop.classList.remove('open');
    });
  }

  // ── Scroll Detection ──
  function initScrollDetection() {
    messagesContainer.addEventListener('scroll', () => {
      scrollBottomBtn.style.display = isNearBottom() ? 'none' : 'flex';
    });
    scrollBottomBtn.addEventListener('click', () => { scrollToBottom(); scrollBottomBtn.style.display = 'none'; });
  }

  // ════════════════════════════════════════════════════════════════
  //  AUDIO ENGINE CONTROLLER (HTML5 Web Radios & YouTube Audio)
  // ════════════════════════════════════════════════════════════════

  function postToYouTube(command, args = []) {
    if (musicIframe && musicIframe.contentWindow) {
      try {
        musicIframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: command,
          args: args
        }), '*');
      } catch (err) {
        console.warn('YouTube postMessage error:', err);
      }
    }
  }

  function showMobilePlayOverlay(customTitle, customSub) {
    if (!musicMobilePlayOverlay) return;
    if (mpoTitle && customTitle) mpoTitle.textContent = customTitle;
    if (mpoSub && customSub) mpoSub.textContent = customSub;
    musicMobilePlayOverlay.style.display = 'flex';
  }

  function hideMobilePlayOverlay() {
    if (musicMobilePlayOverlay) {
      musicMobilePlayOverlay.style.display = 'none';
    }
  }

  function userGesturePlayAudioAndVideo() {
    hideMobilePlayOverlay();

    if (currentMusicState && currentMusicState.currentTrack) {
      if (currentMusicState.currentTrack.type === 'stream' && currentMusicState.currentTrack.streamUrl) {
        if (currentlyPlayingStreamUrl !== currentMusicState.currentTrack.streamUrl) {
          currentlyPlayingStreamUrl = currentMusicState.currentTrack.streamUrl;
          realRadioAudio.src = currentMusicState.currentTrack.streamUrl;
        }
        realRadioAudio.play().then(() => {
          hideMobilePlayOverlay();
        }).catch(e => console.error('Gesture play stream error:', e));
        postToYouTube('playVideo');
      } else if (currentMusicState.currentTrack.type === 'youtube') {
        if (bgAudioAnchor) {
          if (!bgAudioAnchor.src.startsWith('data:audio')) bgAudioAnchor.src = SILENT_AUDIO_URI;
          bgAudioAnchor.play().catch(() => {});
        }
        postToYouTube('playVideo');
        postToYouTube('unMute');
      }
    }
  }

  let isAutoSwitchingRestrictedVideo = false;

  function showRestrictedFallback(track) {
    if (!musicRestrictedFallback) return;
    if (mrfTitle) mrfTitle.textContent = 'Video Embedding Restricted';
    if (mrfDesc) {
      mrfDesc.textContent = `"${track?.title || 'This video'}" is restricted from third-party players by its copyright owner.`;
    }
    if (mrfDirectLink && track?.videoId) {
      mrfDirectLink.href = `https://www.youtube.com/watch?v=${track.videoId}`;
    }
    musicRestrictedFallback.style.display = 'flex';
  }

  function hideRestrictedFallback() {
    if (musicRestrictedFallback) {
      musicRestrictedFallback.style.display = 'none';
    }
  }

  async function handleYouTubeEmbedError(errCode) {
    console.warn('YouTube embed error received:', errCode);
    if (!currentMusicState || !currentMusicState.currentTrack) return;
    const track = currentMusicState.currentTrack;

    if (errCode === 150 || errCode === 101 || errCode === 100 || errCode === 153) {
      showRestrictedFallback(track);

      // Attempt automatic fallback to alternative embeddable version
      if (!isAutoSwitchingRestrictedVideo && track.type === 'youtube' && track.title) {
        isAutoSwitchingRestrictedVideo = true;
        try {
          const query = `${track.title} anime theme audio`;
          const results = await fetchYouTubeSearch(query);
          const alt = results.find(r => r.videoId && r.videoId !== track.videoId);
          if (alt) {
            console.log('Auto-switching to alternative playable video:', alt.videoId);
            setTimeout(() => {
              isAutoSwitchingRestrictedVideo = false;
              socket.emit('music-add', {
                videoId: alt.videoId,
                title: track.title,
                artist: track.artist,
              });
            }, 1000);
            return;
          }
        } catch (e) {
          console.warn('Auto fallback search error:', e);
        }
        isAutoSwitchingRestrictedVideo = false;
      }
    }
  }

  function stopAllAudio() {
    hideMobilePlayOverlay();
    hideRestrictedFallback();
    currentlyPlayingStreamUrl = '';
    if (realRadioAudio) {
      realRadioAudio.pause();
      realRadioAudio.src = '';
    }
    if (bgAudioAnchor) {
      bgAudioAnchor.pause();
      bgAudioAnchor.src = '';
    }
    postToYouTube('pauseVideo');
    if (musicIframe && musicIframe.src) {
      musicIframe.src = '';
    }
  }

  function initMusicDeck() {
    musicToggleBtn.addEventListener('click', () => {
      if (currentMusicState && currentMusicState.currentTrack) {
        // If room is playing but mobile audio was blocked, tap plays locally without pausing room
        if (currentMusicState.isPlaying && currentMusicState.currentTrack.type === 'stream' && realRadioAudio.paused) {
          userGesturePlayAudioAndVideo();
          return;
        }
        if (currentMusicState.isPlaying && currentMusicState.currentTrack.type === 'youtube' && musicMobilePlayOverlay && musicMobilePlayOverlay.style.display !== 'none') {
          userGesturePlayAudioAndVideo();
          return;
        }

        if (currentMusicState.currentTrack.type === 'stream' && currentMusicState.currentTrack.streamUrl) {
          if (!currentMusicState.isPlaying) {
            if (currentlyPlayingStreamUrl !== currentMusicState.currentTrack.streamUrl) {
              currentlyPlayingStreamUrl = currentMusicState.currentTrack.streamUrl;
              realRadioAudio.src = currentMusicState.currentTrack.streamUrl;
            }
            realRadioAudio.play().then(() => hideMobilePlayOverlay()).catch(e => console.error('Audio play error:', e));
            postToYouTube('playVideo');
          } else {
            realRadioAudio.pause();
            postToYouTube('pauseVideo');
          }
        } else if (currentMusicState.currentTrack.type === 'youtube') {
          if (!currentMusicState.isPlaying) {
            if (bgAudioAnchor) {
              if (!bgAudioAnchor.src.startsWith('data:audio')) bgAudioAnchor.src = SILENT_AUDIO_URI;
              bgAudioAnchor.play().catch(() => {});
            }
            postToYouTube('playVideo');
            hideMobilePlayOverlay();
          } else {
            if (bgAudioAnchor) bgAudioAnchor.pause();
            postToYouTube('pauseVideo');
          }
        }
      }
      socket.emit('music-toggle');
    });

    musicSkipBtn.addEventListener('click', () => socket.emit('music-skip'));

    musicLibraryToggle.addEventListener('click', () => {
      musicLibraryModal.style.display = 'flex';
      renderLibraryContent();
      setTimeout(() => musicLibSearchInput.focus(), 150);
    });

    musicAddToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = musicDropdownPanel.style.display === 'block';
      if (!isVisible) {
        musicDropdownPanel.style.display = 'block';
        musicAddForm.style.display = 'flex';
        musicQueueView.style.display = 'none';
        musicUrlInput.focus();
      } else if (musicAddForm.style.display === 'flex') {
        musicDropdownPanel.style.display = 'none';
      } else {
        musicAddForm.style.display = 'flex';
        musicQueueView.style.display = 'none';
        musicUrlInput.focus();
      }
    });

    musicQueueToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = musicDropdownPanel.style.display === 'block';
      if (!isVisible) {
        musicDropdownPanel.style.display = 'block';
        musicAddForm.style.display = 'none';
        musicQueueView.style.display = 'block';
      } else if (musicQueueView.style.display === 'block') {
        musicDropdownPanel.style.display = 'none';
      } else {
        musicAddForm.style.display = 'none';
        musicQueueView.style.display = 'block';
      }
    });

    musicAddBtn.addEventListener('click', handleAddMusic);
    musicUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddMusic(); });

    let musicSearchDebounce = null;
    musicUrlInput.addEventListener('input', () => {
      const raw = musicUrlInput.value.trim();
      clearTimeout(musicSearchDebounce);

      if (!raw || extractYouTubeId(raw)) {
        if (musicQuickResults) {
          musicQuickResults.style.display = 'none';
          musicQuickResults.innerHTML = '';
        }
        return;
      }

      musicSearchDebounce = setTimeout(async () => {
        if (!musicQuickResults) return;
        musicQuickResults.style.display = 'flex';
        musicQuickResults.innerHTML = '<div style="padding: 8px; font-size: 0.72rem; color: var(--text-muted); text-align: center;"><i class="fas fa-spinner fa-spin"></i> Searching YouTube...</div>';

        const results = await fetchYouTubeSearch(raw);
        if (results.length === 0) {
          musicQuickResults.innerHTML = '<div style="padding: 8px; font-size: 0.72rem; color: var(--text-muted); text-align: center;">No YouTube results found</div>';
          return;
        }

        musicQuickResults.innerHTML = '';
        results.slice(0, 5).forEach(item => {
          const row = document.createElement('div');
          row.className = 'music-quick-item';
          row.innerHTML = `
            <img class="music-quick-thumb" src="${escapeHtml(item.thumbnail)}" alt="thumb" />
            <div class="music-quick-info">
              <div class="music-quick-title">${escapeHtml(item.title)}</div>
              <div class="music-quick-channel">${escapeHtml(item.artist)} • ${escapeHtml(item.duration || 'Track')}</div>
            </div>
            <div class="music-quick-actions">
              <button class="music-quick-play" title="Play Now"><i class="fas fa-play"></i> Play</button>
              <button class="music-quick-q" title="Add to Queue"><i class="fas fa-plus"></i></button>
            </div>
          `;

          row.querySelector('.music-quick-play').addEventListener('click', (e) => {
            e.stopPropagation();
            stopAllAudio();
            socket.emit('music-add', {
              videoId: item.videoId,
              title: item.title,
              artist: item.artist,
              playNow: true,
            });
            musicUrlInput.value = '';
            musicQuickResults.style.display = 'none';
            musicDropdownPanel.style.display = 'none';
          });

          row.querySelector('.music-quick-q').addEventListener('click', (e) => {
            e.stopPropagation();
            socket.emit('music-add', {
              videoId: item.videoId,
              title: item.title,
              artist: item.artist,
              playNow: false,
            });
            const qBtn = row.querySelector('.music-quick-q');
            qBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
              musicUrlInput.value = '';
              musicQuickResults.style.display = 'none';
              musicDropdownPanel.style.display = 'none';
            }, 500);
          });

          musicQuickResults.appendChild(row);
        });
      }, 350);
    });

    document.addEventListener('click', (e) => {
      if (!musicDropdownPanel.contains(e.target) && e.target !== musicAddToggle && e.target !== musicQueueToggle) {
        musicDropdownPanel.style.display = 'none';
      }
    });
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const str = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
    const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    return match ? match[1] : null;
  }

  async function fetchYouTubeSearch(query) {
    if (!query) return [];
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return data.results || [];
    } catch (e) {
      console.warn('YouTube search request error:', e);
      return [];
    }
  }

  async function handleAddMusic() {
    const raw = musicUrlInput.value.trim();
    if (!raw) return;

    const videoId = extractYouTubeId(raw);
    if (videoId) {
      stopAllAudio();
      socket.emit('music-add', {
        videoId,
        title: `YouTube Track (${videoId})`,
        artist: currentUser?.username || 'Custom Audio',
        playNow: true,
      });
      musicUrlInput.value = '';
      if (musicQuickResults) musicQuickResults.style.display = 'none';
      musicDropdownPanel.style.display = 'none';
      return;
    }

    // Direct YouTube Search from Input
    if (musicAddBtn) musicAddBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const results = await fetchYouTubeSearch(raw);
    if (musicAddBtn) musicAddBtn.innerHTML = '<i class="fab fa-youtube"></i> Search';

    if (results.length > 0) {
      const top = results[0];
      stopAllAudio();
      socket.emit('music-add', {
        videoId: top.videoId,
        title: top.title,
        artist: top.artist,
        playNow: true,
      });
      musicUrlInput.value = '';
      if (musicQuickResults) musicQuickResults.style.display = 'none';
      musicDropdownPanel.style.display = 'none';
    } else {
      musicUrlInput.style.borderColor = 'var(--rose-400)';
      setTimeout(() => { musicUrlInput.style.borderColor = ''; }, 1500);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  MUSIC VIDEO STAGE CONTROLLER (Watch & Listen in Real-Time)
  // ════════════════════════════════════════════════════════════════
  function initMusicStage() {
    if (!musicStage) return;

    // Mobile Overlay Tap Event Listeners
    if (musicMobilePlayOverlay) {
      musicMobilePlayOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        userGesturePlayAudioAndVideo();
      });
    }
    if (musicMobilePlayBtn) {
      musicMobilePlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userGesturePlayAudioAndVideo();
      });
    }

    // Toggle Play / Pause for Room
    if (musicStageTogglePlay) {
      musicStageTogglePlay.addEventListener('click', () => {
        if (currentMusicState && currentMusicState.currentTrack) {
          // If room is playing but mobile audio was blocked, tap plays locally without pausing room
          if (currentMusicState.isPlaying && currentMusicState.currentTrack.type === 'stream' && realRadioAudio.paused) {
            userGesturePlayAudioAndVideo();
            return;
          }
          if (currentMusicState.isPlaying && currentMusicState.currentTrack.type === 'youtube' && musicMobilePlayOverlay && musicMobilePlayOverlay.style.display !== 'none') {
            userGesturePlayAudioAndVideo();
            return;
          }

          if (currentMusicState.currentTrack.type === 'stream' && currentMusicState.currentTrack.streamUrl) {
            if (!currentMusicState.isPlaying) {
              if (currentlyPlayingStreamUrl !== currentMusicState.currentTrack.streamUrl) {
                currentlyPlayingStreamUrl = currentMusicState.currentTrack.streamUrl;
                realRadioAudio.src = currentMusicState.currentTrack.streamUrl;
              }
              realRadioAudio.play().then(() => hideMobilePlayOverlay()).catch(e => console.error('Audio play error:', e));
              postToYouTube('playVideo');
            } else {
              realRadioAudio.pause();
              postToYouTube('pauseVideo');
            }
          } else if (currentMusicState.currentTrack.type === 'youtube') {
            if (!currentMusicState.isPlaying) {
              if (bgAudioAnchor) {
                if (!bgAudioAnchor.src.startsWith('data:audio')) bgAudioAnchor.src = SILENT_AUDIO_URI;
                bgAudioAnchor.play().catch(() => {});
              }
              postToYouTube('playVideo');
              hideMobilePlayOverlay();
            } else {
              if (bgAudioAnchor) bgAudioAnchor.pause();
              postToYouTube('pauseVideo');
            }
          }
        }
        socket.emit('music-toggle');
      });
    }

    // Skip Track / Station
    if (musicStageSkipBtn) {
      musicStageSkipBtn.addEventListener('click', () => socket.emit('music-skip'));
    }

    // 1-Click Stream & Video Resync with Room
    if (musicStageResyncBtn) {
      musicStageResyncBtn.addEventListener('click', () => {
        if (currentMusicState && currentMusicState.currentTrack) {
          if (currentMusicState.currentTrack.type === 'stream') {
            if (currentMusicState.isPlaying) {
              realRadioAudio.src = currentMusicState.currentTrack.streamUrl;
              realRadioAudio.play().then(() => hideMobilePlayOverlay()).catch(() => {});
              postToYouTube('playVideo');
            }
          } else if (currentMusicState.currentTrack.type === 'youtube') {
            let startSeconds = 0;
            if (currentMusicState.isPlaying && currentMusicState.startedAt) {
              startSeconds = Math.floor((Date.now() - currentMusicState.startedAt) / 1000);
              if (startSeconds < 0) startSeconds = 0;
            } else if (!currentMusicState.isPlaying) {
              startSeconds = Math.floor(currentMusicState.pausedAt || 0);
            }
            postToYouTube('seekTo', [startSeconds, true]);
            if (currentMusicState.isPlaying) {
              postToYouTube('playVideo');
              postToYouTube('unMute');
            }
            hideMobilePlayOverlay();
          }
          musicStageResyncBtn.style.color = 'var(--purple-400)';
          setTimeout(() => { musicStageResyncBtn.style.color = ''; }, 1000);
        }
      });
    }

    // Theater Mode Toggle
    if (musicStageTheaterBtn) {
      musicStageTheaterBtn.addEventListener('click', () => {
        const isTheater = chatLayout.classList.toggle('music-theater');
        musicStageTheaterBtn.innerHTML = isTheater ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
      });
    }

    // Open Library Modal
    if (musicStageLibToggle) {
      musicStageLibToggle.addEventListener('click', () => {
        musicLibraryModal.style.display = 'flex';
        renderLibraryContent();
        setTimeout(() => musicLibSearchInput.focus(), 150);
      });
    }

    // Toggle Queue Drawer
    if (musicStageQueueToggle) {
      musicStageQueueToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVis = musicStageQueueDrawer.style.display === 'block';
        musicStageQueueDrawer.style.display = isVis ? 'none' : 'block';
        if (musicStageSearchDrawer) musicStageSearchDrawer.style.display = 'none';
      });
    }

    if (musicStageQueueClose) {
      musicStageQueueClose.addEventListener('click', () => {
        musicStageQueueDrawer.style.display = 'none';
      });
    }

    // Toggle Search Drawer
    if (musicStageSearchToggle) {
      musicStageSearchToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVis = musicStageSearchDrawer.style.display === 'block';
        musicStageSearchDrawer.style.display = isVis ? 'none' : 'block';
        if (musicStageQueueDrawer) musicStageQueueDrawer.style.display = 'none';
        if (!isVis && musicStageSearchInput) {
          setTimeout(() => musicStageSearchInput.focus(), 100);
        }
      });
    }

    if (musicStageSearchClose) {
      musicStageSearchClose.addEventListener('click', () => {
        musicStageSearchDrawer.style.display = 'none';
      });
    }

    // Search & Add Music in Stage Drawer
    async function handleStageSearch() {
      const raw = (musicStageSearchInput.value || '').trim();
      if (!raw) return;

      const videoId = extractYouTubeId(raw);
      if (videoId) {
        stopAllAudio();
        socket.emit('music-add', {
          videoId,
          title: `YouTube Video (${videoId})`,
          artist: currentUser?.username || 'Custom Music',
          playNow: true,
        });
        musicStageSearchInput.value = '';
        musicStageSearchDrawer.style.display = 'none';
        return;
      }

      if (musicStageSearchBtn) musicStageSearchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      if (musicStageSearchResults) {
        musicStageSearchResults.style.display = 'flex';
        musicStageSearchResults.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.78rem;"><i class="fas fa-spinner fa-spin"></i> Searching YouTube...</div>';
      }

      const results = await fetchYouTubeSearch(raw);
      if (musicStageSearchBtn) musicStageSearchBtn.innerHTML = '<i class="fas fa-search"></i> Search';

      if (!results || results.length === 0) {
        if (musicStageSearchResults) {
          musicStageSearchResults.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.78rem;">No YouTube videos found. Try another search.</div>';
        }
        return;
      }

      if (musicStageSearchResults) {
        musicStageSearchResults.innerHTML = '';
        results.slice(0, 6).forEach(item => {
          const row = document.createElement('div');
          row.className = 'music-quick-item';
          row.innerHTML = `
            <img class="music-quick-thumb" src="${escapeHtml(item.thumbnail)}" alt="thumb" />
            <div class="music-quick-info">
              <div class="music-quick-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
              <div class="music-quick-artist">${escapeHtml(item.artist)}${item.duration ? ` • ${escapeHtml(item.duration)}` : ''}</div>
            </div>
            <div class="music-quick-actions">
              <button class="music-quick-play" title="Play Video Now"><i class="fas fa-play"></i> <span>Play</span></button>
              <button class="music-quick-q" title="Add to Queue"><i class="fas fa-plus"></i></button>
            </div>
          `;

          row.querySelector('.music-quick-play').addEventListener('click', (e) => {
            e.stopPropagation();
            hideMobilePlayOverlay();
            if (bgAudioAnchor) {
              if (!bgAudioAnchor.src.startsWith('data:audio')) bgAudioAnchor.src = SILENT_AUDIO_URI;
              bgAudioAnchor.play().catch(() => {});
            }
            stopAllAudio();
            socket.emit('music-add', {
              videoId: item.videoId,
              title: item.title,
              artist: item.artist,
              playNow: true,
            });
            musicStageSearchInput.value = '';
            musicStageSearchResults.style.display = 'none';
            musicStageSearchDrawer.style.display = 'none';
          });

          row.querySelector('.music-quick-q').addEventListener('click', (e) => {
            e.stopPropagation();
            socket.emit('music-add', {
              videoId: item.videoId,
              title: item.title,
              artist: item.artist,
              playNow: false,
            });
            const qBtn = row.querySelector('.music-quick-q');
            qBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
              musicStageSearchInput.value = '';
              musicStageSearchResults.style.display = 'none';
              musicStageSearchDrawer.style.display = 'none';
            }, 600);
          });

          musicStageSearchResults.appendChild(row);
        });
      }
    }

    if (musicStageSearchBtn) {
      musicStageSearchBtn.addEventListener('click', handleStageSearch);
    }
    if (musicStageSearchInput) {
      musicStageSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleStageSearch();
      });
    }

    // Dismiss stage drawers on outer click
    document.addEventListener('click', (e) => {
      if (musicStageSearchDrawer && !musicStageSearchDrawer.contains(e.target) && e.target !== musicStageSearchToggle && !musicStageSearchToggle?.contains(e.target)) {
        musicStageSearchDrawer.style.display = 'none';
      }
      if (musicStageQueueDrawer && !musicStageQueueDrawer.contains(e.target) && e.target !== musicStageQueueToggle && !musicStageQueueToggle?.contains(e.target)) {
        musicStageQueueDrawer.style.display = 'none';
      }
    });

    // Fallback actions for restricted embeds
    if (mrfSwitchAlternateBtn) {
      mrfSwitchAlternateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideRestrictedFallback();
        if (currentMusicState && currentMusicState.currentTrack) {
          handleYouTubeEmbedError(150);
        }
      });
    }

    // Listen for YouTube iframe player errors (error 150 / 101 / 100 / 153: copyright/embed restrictions)
    window.addEventListener('message', (e) => {
      try {
        let data = e.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (data && (data.event === 'onError' || data.info === 150 || data.info === 101 || data.info === 100 || data.info === 153)) {
          const errCode = data.info || 150;
          handleYouTubeEmbedError(errCode);
        }
      } catch (_) {}
    });

    // Global mobile touch unlock: one tap anywhere in the music room starts audio/video if blocked
    const handleMobileTouchUnlock = () => {
      if (currentRoom === 'music' && currentMusicState && currentMusicState.isPlaying) {
        if (currentMusicState.currentTrack?.type === 'stream' && realRadioAudio.paused) {
          realRadioAudio.play().then(() => hideMobilePlayOverlay()).catch(() => {});
        }
        postToYouTube('playVideo');
      }
    };
    window.addEventListener('touchend', handleMobileTouchUnlock, { passive: true });
  }

  // ── Web Audio API Visualizer Waves Engine ──
  function initVisualizer() {
    if (window.ChatVisualizer) {
      window.ChatVisualizer.init({
        getAudioEl: () => realRadioAudio,
        isPlayingFn: () => currentMusicState && currentMusicState.isPlaying && (currentRoom === 'music')
      });
    }
  }

  function updateMusicUI(state) {
    if (!state) return;

    // Render Station Pills in both Music Stage and compact deck
    if (state.stations && state.stations.length > 0) {
      if (musicStagePills) {
        musicStagePills.innerHTML = '';
        state.stations.forEach(station => {
          const btn = document.createElement('button');
          const isActive = state.currentTrack?.id === station.id;
          btn.className = `station-pill${isActive ? ' active' : ''}`;
          btn.textContent = `${station.icon || '📻'} ${station.tag || station.title}`;
          btn.title = station.title;
          btn.addEventListener('click', () => {
            currentlyPlayingStreamUrl = station.streamUrl;
            realRadioAudio.src = station.streamUrl;
            realRadioAudio.play().catch(e => console.error('Station play error:', e));
            socket.emit('music-play-station', station.id);
          });
          musicStagePills.appendChild(btn);
        });
      }

      if (musicStationsPills) {
        musicStationsPills.innerHTML = '';
        state.stations.forEach(station => {
          const btn = document.createElement('button');
          const isActive = state.currentTrack?.id === station.id;
          btn.className = `station-pill${isActive ? ' active' : ''}`;
          btn.textContent = `${station.icon || '📻'} ${station.tag || station.title}`;
          btn.title = station.title;
          btn.addEventListener('click', () => {
            currentlyPlayingStreamUrl = station.streamUrl;
            realRadioAudio.src = station.streamUrl;
            realRadioAudio.play().catch(e => console.error('Station play error:', e));
            socket.emit('music-play-station', station.id);
          });
          musicStationsPills.appendChild(btn);
        });
      }
    }

    if (state.currentTrack) {
      // Music Stage Header Titles & Badge
      if (musicStageTitle) musicStageTitle.textContent = state.currentTrack.title;
      if (musicStageArtist) musicStageArtist.textContent = `${state.currentTrack.artist || 'PBG Music'} • Added by ${state.currentTrack.addedBy}`;
      if (musicStageBadge) {
        musicStageBadge.innerHTML = state.currentTrack.type === 'stream'
          ? '<span class="live-dot"></span> LIVE 24/7 RADIO VIDEO'
          : '<i class="fas fa-play"></i> NOW PLAYING';
      }

      // Stage Play / Pause Button
      if (musicStageTogglePlay) {
        musicStageTogglePlay.innerHTML = state.isPlaying
          ? '<i class="fas fa-pause"></i> <span class="music-stage-btn-text">Pause</span>'
          : '<i class="fas fa-play"></i> <span class="music-stage-btn-text">Play</span>';
      }

      // Video Overlay Banner
      if (musicVideoOverlayTitle) musicVideoOverlayTitle.textContent = state.currentTrack.title;
      if (musicVideoOverlaySub) musicVideoOverlaySub.textContent = state.currentTrack.artist || 'PBG Music';
      if (musicVideoStatus) {
        musicVideoStatus.textContent = state.currentTrack.type === 'stream' ? 'LIVE 24/7 RADIO & VIDEO' : 'YOUTUBE MUSIC VIDEO';
      }

      // Compact Deck Fallback Elements
      if (musicTrackTitle) musicTrackTitle.textContent = state.currentTrack.title;
      if (musicModeTag) {
        musicModeTag.textContent = state.currentTrack.type === 'stream' ? 'LIVE 24/7 RADIO' : 'YOUTUBE VIDEO';
      }
      if (musicTrackMeta) {
        musicTrackMeta.textContent = `${state.currentTrack.artist || 'PBG Audio'} • Added by ${state.currentTrack.addedBy}`;
      }
      if (musicToggleBtn) {
        musicToggleBtn.innerHTML = state.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
      }
      if (musicVinyl) musicVinyl.classList.toggle('playing', state.isPlaying);
      if (musicEq) musicEq.classList.toggle('playing', state.isPlaying);
      if (musicStageVinyl) musicStageVinyl.style.animationPlayState = state.isPlaying ? 'running' : 'paused';

      // ── HYBRID SYNCHRONIZED VIDEO & AUDIO PLAYBACK ENGINE ──
      hideRestrictedFallback();

      if (musicStageDirectYtBtn) {
        const vidId = state.currentTrack?.videoId;
        musicStageDirectYtBtn.href = vidId ? `https://www.youtube.com/watch?v=${vidId}` : 'https://www.youtube.com';
      }
      if (mrfDirectLink && state.currentTrack?.videoId) {
        mrfDirectLink.href = `https://www.youtube.com/watch?v=${state.currentTrack.videoId}`;
      }

      // YouTube strictly rejects numeric IP origins (e.g. 10.225.170.209) causing Error 150 ("This video is unavailable").
      // Omitting &origin on numeric IP / localhost LAN setups allows seamless third-party embedding.
      const isNumericIP = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname) || window.location.hostname === 'localhost' || window.location.hostname.endsWith('.local');
      const originParam = (!isNumericIP && window.location.origin && window.location.origin.startsWith('https://')) ? `&origin=${encodeURIComponent(window.location.origin)}` : '';

      if (state.currentTrack.type === 'stream' && state.currentTrack.streamUrl) {
        if (bgAudioAnchor && !bgAudioAnchor.paused) bgAudioAnchor.pause();

        // 1. Direct High-Bitrate Live Radio Audio
        if (currentlyPlayingStreamUrl !== state.currentTrack.streamUrl) {
          currentlyPlayingStreamUrl = state.currentTrack.streamUrl;
          realRadioAudio.src = state.currentTrack.streamUrl;
        }

        if (state.isPlaying && currentRoom === 'music') {
          if (realRadioAudio.paused) {
            realRadioAudio.play().then(() => {
              hideMobilePlayOverlay();
            }).catch(e => {
              console.log('Mobile stream autoplay blocked, prompt tap to play:', e.message);
              showMobilePlayOverlay('Tap to Play Radio & Video', 'Tap to start synchronized live audio & video stream');
            });
          } else {
            hideMobilePlayOverlay();
          }
        } else {
          hideMobilePlayOverlay();
          if (!realRadioAudio.paused) {
            realRadioAudio.pause();
          }
        }

        // 2. Synchronized Thematic Live/Aesthetic Video for Radio
        const radioVideoId = state.currentTrack.videoId || 'lTRiuFIWV54';

        // Video is muted for radio streams so it provides synchronized visuals without audio clashing with radio stream.
        // youtube-nocookie.com avoids cross-site cookie restrictions on mobile devices.
        const targetSrc = `https://www.youtube-nocookie.com/embed/${radioVideoId}?autoplay=${state.isPlaying ? 1 : 0}&enablejsapi=1${originParam}&playsinline=1&controls=1&mute=1&loop=1&playlist=${radioVideoId}&rel=0&iv_load_policy=3`;

        if (!musicIframe.src || !musicIframe.src.includes(radioVideoId)) {
          musicIframe.src = targetSrc;
        } else {
          if (!state.isPlaying) {
            postToYouTube('pauseVideo');
          } else {
            postToYouTube('playVideo');
          }
        }

      } else if (state.currentTrack.type === 'youtube' && state.currentTrack.videoId) {
        currentlyPlayingStreamUrl = '';
        if (!realRadioAudio.paused) realRadioAudio.pause();

        // Maintain Native Audio Anchor for Mobile MediaSession
        if (bgAudioAnchor) {
          if (!bgAudioAnchor.src.startsWith('data:audio')) {
            bgAudioAnchor.src = SILENT_AUDIO_URI;
          }
          if (state.isPlaying && currentRoom === 'music') {
            if (bgAudioAnchor.paused) bgAudioAnchor.play().catch(() => {});
          } else {
            if (!bgAudioAnchor.paused) bgAudioAnchor.pause();
          }
        }

        let startSeconds = 0;
        if (state.isPlaying && state.startedAt) {
          startSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
          if (startSeconds < 0) startSeconds = 0;
        } else if (!state.isPlaying) {
          startSeconds = Math.floor(state.pausedAt || 0);
        }

        // Full synchronized video and native sound for YouTube tracks using youtube-nocookie
        const startParam = startSeconds > 0 ? `&start=${startSeconds}` : '';
        const targetSrc = `https://www.youtube-nocookie.com/embed/${state.currentTrack.videoId}?autoplay=${state.isPlaying ? 1 : 0}${startParam}&enablejsapi=1${originParam}&playsinline=1&controls=1&rel=0&iv_load_policy=3`;

        if (!musicIframe.src || !musicIframe.src.includes(state.currentTrack.videoId)) {
          musicIframe.src = targetSrc;
        } else {
          if (!state.isPlaying) {
            postToYouTube('pauseVideo');
            if (musicIframe.src.includes('autoplay=1')) {
              musicIframe.src = targetSrc;
            }
          } else {
            postToYouTube('playVideo');
            if (musicIframe.src.includes('autoplay=0')) {
              musicIframe.src = targetSrc;
            }
          }
        }

        // Check if on a mobile touch screen device and native audio hasn't started
        const isMobilePhone = window.innerWidth <= 768 && ('ontouchstart' in window);
        if (state.isPlaying && isMobilePhone && currentRoom === 'music' && bgAudioAnchor && bgAudioAnchor.paused) {
          showMobilePlayOverlay('Tap to Play Video & Sound', 'Tap to start synchronized YouTube music video with audio');
        } else if (!state.isPlaying) {
          hideMobilePlayOverlay();
        }
      }

      // Update Native MediaSession
      updateMediaSession(state.currentTrack, state.isPlaying);
    }

    // Queue badge & list in Stage Drawer and Deck
    const qCount = (state.queue && state.queue.length) || 0;
    if (musicStageQueueBadge) {
      musicStageQueueBadge.style.display = qCount > 0 ? 'inline-flex' : 'none';
      musicStageQueueBadge.textContent = qCount;
    }
    if (musicStageQueueCount) {
      musicStageQueueCount.textContent = qCount;
    }
    if (musicQueueBadge) {
      musicQueueBadge.style.display = qCount > 0 ? 'flex' : 'none';
      musicQueueBadge.textContent = qCount;
    }
    if (musicQueueCount) {
      musicQueueCount.textContent = `${qCount} track${qCount > 1 ? 's' : ''}`;
    }

    // Populate Stage Queue Drawer list
    if (musicStageQueueList) {
      musicStageQueueList.innerHTML = '';
      if (qCount > 0) {
        state.queue.forEach((track, i) => {
          const li = document.createElement('li');
          li.className = 'music-queue-item';
          li.innerHTML = `
            <span class="q-num">${i + 1}</span>
            <span class="q-title">${escapeHtml(track.title)}</span>
            <button class="q-remove" title="Remove"><i class="fas fa-xmark"></i></button>
          `;
          li.querySelector('.q-remove').addEventListener('click', () => {
            socket.emit('music-remove', i);
          });
          musicStageQueueList.appendChild(li);
        });
      } else {
        musicStageQueueList.innerHTML = '<li style="padding:10px;color:var(--text-muted);font-size:0.75rem;text-align:center;">Queue is empty</li>';
      }
    }

    // Populate Deck Queue list
    if (musicQueueList) {
      musicQueueList.innerHTML = '';
      if (qCount > 0) {
        state.queue.forEach((track, i) => {
          const li = document.createElement('li');
          li.className = 'music-queue-item';
          li.innerHTML = `
            <span class="q-num">${i + 1}</span>
            <span class="q-title">${escapeHtml(track.title)}</span>
            <button class="q-remove" title="Remove"><i class="fas fa-xmark"></i></button>
          `;
          li.querySelector('.q-remove').addEventListener('click', () => {
            socket.emit('music-remove', i);
          });
          musicQueueList.appendChild(li);
        });
      } else {
        musicQueueList.innerHTML = '<li style="padding:8px;color:var(--text-muted);font-size:0.75rem;text-align:center;">Queue is empty</li>';
      }
    }

    // Refresh library view if open
    if (musicLibraryModal && musicLibraryModal.style.display === 'flex') {
      renderLibraryContent();
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  MUSIC LIBRARY MODAL & CATEGORIES
  // ════════════════════════════════════════════════════════════════
  function initMusicLibrary() {
    musicLibraryClose.addEventListener('click', () => {
      musicLibraryModal.style.display = 'none';
    });

    musicLibraryModal.addEventListener('click', (e) => {
      if (e.target === musicLibraryModal) musicLibraryModal.style.display = 'none';
    });

    // Toggle Add Song Drawer in Library
    if (openAddSongBtn && addSongPanel) {
      openAddSongBtn.addEventListener('click', () => {
        const isVisible = addSongPanel.style.display === 'block';
        addSongPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
          if (addSongError) addSongError.style.display = 'none';
          if (addSongTitle) addSongTitle.focus();
        }
      });
    }

    if (closeAddSongBtn && addSongPanel) {
      closeAddSongBtn.addEventListener('click', () => {
        addSongPanel.style.display = 'none';
      });
    }

    if (submitAddSongBtn) {
      submitAddSongBtn.addEventListener('click', handleStoreLibrarySong);
    }

    libTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        libTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeLibraryCategory = tab.dataset.category;
        renderLibraryContent();
      });
    });

    if (musicLibSearchBtn) {
      musicLibSearchBtn.addEventListener('click', () => {
        activeLibraryCategory = 'youtube';
        libTabs.forEach(t => {
          if (t.dataset.category === 'youtube') t.classList.add('active');
          else t.classList.remove('active');
        });
        renderLibraryContent();
      });
    }

    let libSearchDebounce = null;
    musicLibSearchInput.addEventListener('input', () => {
      clearTimeout(libSearchDebounce);
      libSearchDebounce = setTimeout(() => {
        renderLibraryContent();
      }, activeLibraryCategory === 'youtube' ? 350 : 50);
    });

    musicLibSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (activeLibraryCategory !== 'youtube') {
          activeLibraryCategory = 'youtube';
          libTabs.forEach(t => {
            if (t.dataset.category === 'youtube') t.classList.add('active');
            else t.classList.remove('active');
          });
        }
        renderLibraryContent();
      }
    });
  }

  function handleStoreLibrarySong() {
    const rawUrl = addSongUrl.value.trim();
    if (!rawUrl) {
      showAddSongError('Please enter a YouTube video URL or ID.');
      addSongUrl.focus();
      return;
    }
    const videoId = extractYouTubeId(rawUrl);
    if (!videoId) {
      showAddSongError('Invalid YouTube URL. Use formats like youtube.com/watch?v=... or youtu.be/...');
      addSongUrl.focus();
      return;
    }

    const title = addSongTitle.value.trim() || `YouTube Track (${videoId})`;
    const artist = addSongArtist.value.trim() || (currentUser?.username || 'Community');
    const category = addSongCategory.value || 'Community Custom';

    socket.emit('music-add-library', {
      title,
      artist,
      category,
      youtubeUrl: rawUrl,
    });

    addSongTitle.value = '';
    addSongArtist.value = '';
    addSongUrl.value = '';
    if (addSongError) addSongError.style.display = 'none';
    if (addSongPanel) addSongPanel.style.display = 'none';

    // Auto-switch tab to custom to see the stored track immediately
    activeLibraryCategory = 'custom';
    libTabs.forEach(t => {
      if (t.dataset.category === 'custom') t.classList.add('active');
      else t.classList.remove('active');
    });
    renderLibraryContent();
  }

  function showAddSongError(msg) {
    if (addSongError) {
      addSongError.textContent = msg;
      addSongError.style.display = 'block';
    }
  }

  let currentYTRequestId = 0;
  async function renderYouTubeSearchTab(query) {
    const reqId = ++currentYTRequestId;
    const searchTerm = query || 'trending anime opening songs';
    musicLibContent.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 0.88rem;">
        <i class="fas fa-spinner fa-spin fa-2x" style="color: #ef4444; margin-bottom: 12px;"></i><br/>
        Searching YouTube for "<strong>${escapeHtml(searchTerm)}</strong>"...
      </div>
    `;

    const results = await fetchYouTubeSearch(searchTerm);
    if (reqId !== currentYTRequestId) return;

    if (results.length === 0) {
      musicLibContent.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 0.88rem;">
          <i class="fab fa-youtube fa-2x" style="color: #ef4444; margin-bottom: 10px;"></i><br/>
          No YouTube results found for "<strong>${escapeHtml(searchTerm)}</strong>". Try another search query above!
        </div>
      `;
      return;
    }

    musicLibContent.innerHTML = '';
    results.forEach(item => {
      const card = document.createElement('div');
      card.className = 'music-yt-card';
      card.innerHTML = `
        <div class="music-yt-thumb-wrap">
          <img class="music-yt-thumb" src="${escapeHtml(item.thumbnail)}" alt="thumb" loading="lazy" />
          ${item.duration ? `<span class="music-yt-duration">${escapeHtml(item.duration)}</span>` : ''}
        </div>
        <div class="music-yt-info">
          <div class="music-yt-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          <div class="music-yt-channel">${escapeHtml(item.artist)}${item.views ? ` • ${escapeHtml(item.views)}` : ''}</div>
          <div class="music-yt-actions">
            <button class="music-yt-play-btn" title="Play Now"><i class="fas fa-play"></i> Play</button>
            <button class="music-yt-queue-btn" title="Add to Queue"><i class="fas fa-plus"></i> Queue</button>
            <button class="music-yt-save-btn" title="Save to Community Library"><i class="fas fa-bookmark"></i> Save</button>
          </div>
        </div>
      `;

      card.querySelector('.music-yt-play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        hideMobilePlayOverlay();
        if (bgAudioAnchor) {
          if (!bgAudioAnchor.src.startsWith('data:audio')) bgAudioAnchor.src = SILENT_AUDIO_URI;
          bgAudioAnchor.play().catch(() => {});
        }
        stopAllAudio();
        socket.emit('music-add', {
          videoId: item.videoId,
          title: item.title,
          artist: item.artist,
          playNow: true,
        });
        musicLibraryModal.style.display = 'none';
      });

      card.querySelector('.music-yt-queue-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        socket.emit('music-add', {
          videoId: item.videoId,
          title: item.title,
          artist: item.artist,
          playNow: false,
        });
        const btn = card.querySelector('.music-yt-queue-btn');
        btn.innerHTML = '<i class="fas fa-check"></i> Queued';
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-plus"></i> Queue'; }, 1500);
      });

      card.querySelector('.music-yt-save-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        socket.emit('music-add-library', {
          title: item.title,
          artist: item.artist,
          category: 'Anime Hits',
          youtubeUrl: item.videoId,
        });
        const btn = card.querySelector('.music-yt-save-btn');
        btn.innerHTML = '<i class="fas fa-check"></i> Saved';
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-bookmark"></i> Save'; }, 1500);
      });

      musicLibContent.appendChild(card);
    });
  }

  function renderLibraryContent() {
    if (!currentMusicState) return;
    const query = musicLibSearchInput.value.trim().toLowerCase();

    // If on the dedicated YouTube Search tab, delegate to renderYouTubeSearchTab
    if (activeLibraryCategory === 'youtube') {
      renderYouTubeSearchTab(query);
      return;
    }
    const stations = currentMusicState.stations || [];
    const library = currentMusicState.library || [];

    musicLibContent.innerHTML = '';
    const items = [];

    // Radio stations
    if (activeLibraryCategory === 'all' || activeLibraryCategory === 'radio') {
      stations.forEach(s => {
        if (!query || s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query) || s.tag.toLowerCase().includes(query)) {
          items.push({ ...s, itemType: 'station' });
        }
      });
    }

    // Library tracks
    if (activeLibraryCategory !== 'radio') {
      library.forEach(t => {
        const isCustom = t.custom || (t.id && t.id.startsWith('custom-'));
        const catMatch = activeLibraryCategory === 'all' ||
          (activeLibraryCategory === 'custom' && isCustom) ||
          (activeLibraryCategory === 'anime' && (t.category.includes('Anime') || t.category === 'Anime Hits')) ||
          (activeLibraryCategory === 'lofi' && (t.category.includes('Lo-Fi') || t.category.includes('Lofi'))) ||
          (activeLibraryCategory === 'gaming' && (t.category.includes('Gaming') || t.category.includes('Synth')));

        if (catMatch && (!query || t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query) || t.category.toLowerCase().includes(query) || (t.addedBy && t.addedBy.toLowerCase().includes(query)))) {
          items.push({ ...t, itemType: 'library' });
        }
      });
    }

    if (items.length === 0) {
      musicLibContent.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.85rem;">No music found in this category. Click <strong>+ Add Song</strong> to store your first track!</div>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'music-lib-card';
      const isPlayingThis = (item.itemType === 'station' && currentMusicState.currentTrack?.id === item.id) ||
                            (item.itemType === 'library' && currentMusicState.currentTrack?.id === item.id);

      const icon = item.itemType === 'station' ? (item.icon || '📻') : (item.custom ? '✨' : '🎵');
      const tag = item.itemType === 'station' ? `24/7 Radio • ${item.tag}` : item.category;
      const byUser = item.addedBy ? ` • Added by ${escapeHtml(item.addedBy)}` : '';

      card.innerHTML = `
        <div class="music-lib-card-icon">${icon}</div>
        <div class="music-lib-card-info">
          <div class="music-lib-card-title">${escapeHtml(item.title)}</div>
          <div class="music-lib-card-meta">
            <span class="music-lib-card-tag">${escapeHtml(tag)}</span>
            <span>${escapeHtml(item.artist)}${byUser}</span>
          </div>
        </div>
        <div class="music-lib-card-actions">
          ${item.custom ? `<button class="music-lib-card-del" title="Remove from Library"><i class="fas fa-trash-can"></i></button>` : ''}
          <div class="music-lib-card-play">
            <i class="fas ${isPlayingThis ? 'fa-volume-high' : 'fa-play'}"></i>
          </div>
        </div>
      `;

      // Delete custom song
      if (item.custom) {
        const delBtn = card.querySelector('.music-lib-card-del');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Remove "${item.title}" from the community library?`)) {
              socket.emit('music-remove-library', { id: item.id });
            }
          });
        }
      }

      card.addEventListener('click', () => {
        if (item.itemType === 'station') {
          currentlyPlayingStreamUrl = item.streamUrl;
          realRadioAudio.src = item.streamUrl;
          realRadioAudio.play().catch(e => console.error('Card play error:', e));
          socket.emit('music-play-station', item.id);
        } else {
          stopAllAudio();
          socket.emit('music-play-library', item.id);
        }
        musicLibraryModal.style.display = 'none';
      });

      musicLibContent.appendChild(card);
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  CINEMA STAGE (Anime Watch Together Cinema Player)
  // ════════════════════════════════════════════════════════════════
  let animeSearchTimeout = null;

  const POPULAR_ANIME_FALLBACKS = [
    { id: 151807, title: 'Solo Leveling', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-3CDvjB6e1a4Y.png', format: 'TV', episodes: 12, year: 2024 },
    { id: 101922, title: 'Demon Slayer: Kimetsu no Yaiba', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTDYwgvr.jpg', format: 'TV', episodes: 26, year: 2019 },
    { id: 113415, title: 'Jujutsu Kaisen', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg', format: 'TV', episodes: 24, year: 2020 },
    { id: 21, title: 'One Piece', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg', format: 'TV', episodes: 1100, year: 1999 },
    { id: 20, title: 'Naruto', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20-dE6UHbFFg1A5.jpg', format: 'TV', episodes: 220, year: 2002 },
    { id: 16498, title: 'Attack on Titan', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg', format: 'TV', episodes: 25, year: 2013 },
  ];

  function renderQuickPills() {
    if (!cinemaQuickPills) return;
    cinemaQuickPills.innerHTML = '';
    POPULAR_ANIME_FALLBACKS.forEach(anime => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cinema-pill-btn';
      btn.innerHTML = `<i class="fas fa-play" style="font-size:0.65rem; color:var(--pink-400)"></i> ${escapeHtml(anime.title)}`;
      btn.addEventListener('click', () => selectAnime(anime));
      cinemaQuickPills.appendChild(btn);
    });
  }

  function initCinemaStage() {
    renderQuickPills();

    cinemaSearchToggle.addEventListener('click', () => {
      openCinemaSearch();
    });

    cinemaSearchClose.addEventListener('click', () => {
      cinemaSearchDrawer.style.display = 'none';
    });

    cinemaQuickBrowseBtn.addEventListener('click', () => {
      openCinemaSearch();
    });

    // Server Switcher Toggle
    if (cinemaServerBtn && cinemaServerMenu) {
      cinemaServerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = cinemaServerMenu.style.display === 'flex';
        cinemaServerMenu.style.display = isVisible ? 'none' : 'flex';
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#cinemaServerWrap')) {
          cinemaServerMenu.style.display = 'none';
        }
      });
    }

    // Native Video Player Event Listeners (Broadcast play/pause/seek to room)
    if (animeVideo) {
      animeVideo.addEventListener('pause', () => {
        if (isRemoteAnimeSync) return;
        socket.emit('anime-action', { action: 'pause', currentTime: animeVideo.currentTime });
      });

      animeVideo.addEventListener('play', () => {
        if (isRemoteAnimeSync) return;
        socket.emit('anime-action', { action: 'play', currentTime: animeVideo.currentTime });
      });

      animeVideo.addEventListener('seeked', () => {
        if (isRemoteAnimeSync) return;
        const now = Date.now();
        if (now - lastSeekEmit > 800) {
          lastSeekEmit = now;
          socket.emit('anime-action', { action: 'seek', currentTime: animeVideo.currentTime });
        }
      });
    }

    // 1-Click Stream Resync with Room
    cinemaResyncBtn.addEventListener('click', () => {
      if (currentAnimeState && currentAnimeState.currentAnime) {
        const directStream = currentAnimeState.currentAnime.directStreamUrl || currentAnimeState.currentAnime.directStream;
        const isNativeStream = directStream && (directStream.includes('.m3u8') || directStream.includes('.mp4'));

        if (isNativeStream && animeVideo) {
          if (typeof currentAnimeState.currentTime === 'number') {
            animeVideo.currentTime = currentAnimeState.currentTime;
          }
          if (currentAnimeState.isPlaying) {
            animeVideo.play().catch(() => {});
          }
        } else if (currentAnimeState.currentAnime.embedUrl) {
          const url = currentAnimeState.currentAnime.embedUrl;
          const iframe = cinemaPlayerWrap.querySelector('iframe.cinema-iframe');
          if (iframe) iframe.remove();
          setTimeout(() => { injectCinemaIframe(url); }, 100);
        }
        cinemaResyncBtn.style.color = 'var(--emerald-400)';
        setTimeout(() => { cinemaResyncBtn.style.color = ''; }, 1000);
      }
    });

    // Watch Party Play/Pause toggle
    cinemaTogglePlay.addEventListener('click', () => {
      socket.emit('anime-toggle-play');
    });

    pauseOverlayResumeBtn.addEventListener('click', () => {
      socket.emit('anime-toggle-play');
    });

    animeSearchInput.addEventListener('input', () => {
      clearTimeout(animeSearchTimeout);
      const q = animeSearchInput.value.trim();
      if (q.length === 0) {
        loadTrendingAnimeInDrawer();
        return;
      }
      if (q.length < 2) return;
      if (cinemaTrendingHeader) cinemaTrendingHeader.style.display = 'none';
      animeSearchTimeout = setTimeout(() => searchAnime(q), 300);
    });

    cinemaPrevEp.addEventListener('click', () => changeAnimeEpisode(-1));
    cinemaNextEp.addEventListener('click', () => changeAnimeEpisode(1));
    cinemaStopBtn.addEventListener('click', () => socket.emit('anime-clear'));
  }

  async function openCinemaSearch() {
    const isVisible = cinemaSearchDrawer.style.display === 'block';
    if (isVisible) {
      cinemaSearchDrawer.style.display = 'none';
      return;
    }
    cinemaSearchDrawer.style.display = 'block';
    animeSearchInput.focus();
    if (!animeSearchInput.value.trim()) {
      await loadTrendingAnimeInDrawer();
    }
  }

  async function loadTrendingAnimeInDrawer() {
    if (cinemaTrendingHeader) cinemaTrendingHeader.style.display = 'flex';
    animeResults.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.8rem;"><i class="fas fa-spinner fa-spin"></i> Loading trending anime...</div>';
    animeResults.style.display = 'block';
    try {
      const res = await fetch('/api/anime/trending?perPage=12');
      if (!res.ok) throw new Error('Trending fetch failed');
      const data = await res.json();
      renderAnimeSearchResults(data.results || [], true);
    } catch (err) {
      renderAnimeSearchResults(POPULAR_ANIME_FALLBACKS, true);
    }
  }

  function renderAnimeSearchResults(items, isTrending = false) {
    if (!items || items.length === 0) {
      animeResults.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No anime found</div>';
      animeResults.style.display = 'block';
      return;
    }
    animeResults.innerHTML = '';
    const seen = new Set();
    items.forEach(item => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      const div = document.createElement('div');
      div.className = 'anime-result-item';
      div.innerHTML = `
        <img class="anime-result-thumb" src="${item.image || item.coverImage || ''}" alt="" onerror="this.style.display='none'" />
        <div class="anime-result-info">
          <div class="anime-result-title">${escapeHtml(item.title)}</div>
          <div class="anime-result-meta">${item.format || 'TV'}${item.year ? ' · ' + item.year : ''}${item.episodes ? ' · ' + item.episodes + ' eps' : ''}${isTrending ? ' · 🔥 Trending' : ''}</div>
        </div>
      `;
      div.addEventListener('click', () => selectAnime(item));
      animeResults.appendChild(div);
    });
    animeResults.style.display = 'block';
  }

  function injectCinemaIframe(src) {
    if (!src) return;
    cinemaEmptyState.style.display = 'none';
    if (animeVideo) {
      animeVideo.style.display = 'none';
      animeVideo.pause();
      animeVideo.src = '';
    }

    let iframe = cinemaPlayerWrap.querySelector('iframe.cinema-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'animeIframe';
      iframe.className = 'cinema-iframe';
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('webkitallowfullscreen', 'true');
      iframe.setAttribute('mozallowfullscreen', 'true');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('referrerpolicy', 'origin');
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
      iframe.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;border:none;background:#000;z-index:5;';
      cinemaPlayerWrap.insertBefore(iframe, cinemaPauseOverlay);
    }

    if (iframe.src !== src) {
      iframe.src = src;
    }
  }

  function removeCinemaIframe() {
    const iframe = cinemaPlayerWrap.querySelector('iframe.cinema-iframe');
    if (iframe) iframe.remove();
  }

  function handleRemoteAnimeAction(action, currentTime, username) {
    isRemoteAnimeSync = true;
    if (action === 'pause') {
      if (animeVideo && animeVideo.style.display !== 'none') {
        animeVideo.pause();
        if (typeof currentTime === 'number') animeVideo.currentTime = currentTime;
      }
      cinemaPauseOverlay.style.display = 'flex';
      pauseOverlayTitle.textContent = 'Watch Party Paused';
      pauseOverlayDesc.textContent = `${username} paused the watch party for the room.`;
      cinemaTogglePlay.innerHTML = '<i class="fas fa-play"></i> <span class="cinema-btn-text">Resume</span>';
    } else if (action === 'play') {
      if (animeVideo && animeVideo.style.display !== 'none') {
        if (typeof currentTime === 'number' && Math.abs(animeVideo.currentTime - currentTime) > 2) {
          animeVideo.currentTime = currentTime;
        }
        animeVideo.play().catch(() => {});
      }
      cinemaPauseOverlay.style.display = 'none';
      cinemaTogglePlay.innerHTML = '<i class="fas fa-pause"></i> <span class="cinema-btn-text">Pause</span>';
    } else if (action === 'seek') {
      if (animeVideo && animeVideo.style.display !== 'none' && typeof currentTime === 'number') {
        animeVideo.currentTime = currentTime;
      }
    }
    setTimeout(() => { isRemoteAnimeSync = false; }, 400);
  }

  async function searchAnime(query) {
    try {
      const res = await fetch(`/api/anime/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      renderAnimeSearchResults(data.results || [], false);
    } catch (err) {
      console.error('Anime search error:', err);
      const filtered = POPULAR_ANIME_FALLBACKS.filter(a => a.title.toLowerCase().includes(query.toLowerCase()));
      renderAnimeSearchResults(filtered, false);
    }
  }

  async function loadAnimeServers(episodeId) {
    try {
      const res = await fetch(`/api/anime/watch/${episodeId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.servers && Array.isArray(data.servers)) {
        currentAnimeServers = data.servers;
        renderServerMenu(data.servers, data.currentServer);
      }
    } catch (e) {
      console.warn('Servers load error:', e);
    }
  }

  function renderServerMenu(servers, activeId) {
    if (!cinemaServerMenu) return;
    cinemaServerMenu.innerHTML = '';
    const currentActiveId = currentAnimeState?.currentAnime?.server || activeId || servers[0]?.id;
    servers.forEach(server => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `cinema-server-item${server.id === currentActiveId ? ' active' : ''}`;
      item.innerHTML = `<i class="fas fa-play" style="font-size:0.65rem;"></i> ${escapeHtml(server.name)}`;
      item.addEventListener('click', () => {
        cinemaServerMenu.style.display = 'none';
        if (cinemaServerLabel) cinemaServerLabel.textContent = server.name;
        socket.emit('anime-switch-server', {
          serverId: server.id,
          serverName: server.name,
          embedUrl: server.url,
        });
      });
      cinemaServerMenu.appendChild(item);
    });
  }

  async function selectAnime(item) {
    cinemaSearchDrawer.style.display = 'none';
    animeResults.style.display = 'none';
    animeSearchInput.value = '';
    try {
      const animeId = String(item.id).replace(/-episode-\d+.*$/, '');
      let episodeNumber = item.episodeNumber || 1;
      let animeTitle = item.title || 'PBG Anime';
      let animeImage = item.image || item.coverImage || '';

      // 1. Fetch anime info to get metadata and total episodes
      try {
        const infoRes = await fetch(`/api/anime/info/${animeId}`);
        if (infoRes.ok) {
          const info = await infoRes.json();
          currentAnimeInfo = info;
          if (info.title) animeTitle = info.title;
          if (info.coverImage) animeImage = info.coverImage;
          if (info.totalEpisodes && typeof info.totalEpisodes === 'number') {
            currentAnimeInfo.episodes = [];
            for (let i = 1; i <= info.totalEpisodes; i++) {
              currentAnimeInfo.episodes.push({ id: `${animeId}-episode-${i}`, number: i });
            }
          }
        }
      } catch (e) {
        console.warn('Anime info lookup warning:', e);
      }

      // 2. Fetch the watch stream for episode 1
      const episodeId = `${animeId}-episode-${episodeNumber}`;
      const watchRes = await fetch(`/api/anime/watch/${episodeId}`);
      if (!watchRes.ok) throw new Error('Watch fetch failed for ' + episodeId);
      const watchData = await watchRes.json();

      if (watchData.servers && Array.isArray(watchData.servers)) {
        currentAnimeServers = watchData.servers;
        currentAnimeServers._forEp = episodeId;
        renderServerMenu(watchData.servers, watchData.currentServer);
      }

      socket.emit('anime-watch', {
        animeId: animeId,
        title: animeTitle || watchData.title,
        image: animeImage || '',
        episodeId: episodeId,
        episodeNumber: episodeNumber,
        embedUrl: watchData.embedUrl || watchData.iframeSrc || '',
        directStreamUrl: null,
      });

      cinemaPrevEp.disabled = episodeNumber <= 1;
      cinemaNextEp.disabled = false;
    } catch (err) {
      console.error('Anime select error:', err);
    }
  }

  async function changeAnimeEpisode(delta) {
    const currentEpNum = parseInt(cinemaAnimeEp.textContent.replace(/\D/g, '')) || 1;
    const newEpNum = Math.max(1, currentEpNum + delta);
    const animeId = currentAnimeState?.currentAnime?.animeId || '151807';
    let nextEpisodeId = `${animeId}-episode-${newEpNum}`;

    if (currentAnimeInfo && currentAnimeInfo.episodes && currentAnimeInfo.episodes.length > 0) {
      const found = currentAnimeInfo.episodes.find(e => e.number === newEpNum);
      if (found) nextEpisodeId = found.id;
    }

    try {
      const watchRes = await fetch(`/api/anime/watch/${nextEpisodeId}`);
      if (!watchRes.ok) return;
      const watchData = await watchRes.json();

      if (watchData.servers && Array.isArray(watchData.servers)) {
        currentAnimeServers = watchData.servers;
        currentAnimeServers._forEp = nextEpisodeId;
        renderServerMenu(watchData.servers, watchData.currentServer);
      }

      socket.emit('anime-episode', {
        episodeId: nextEpisodeId,
        episodeNumber: newEpNum,
        embedUrl: watchData.embedUrl || watchData.iframeSrc || '',
        directStreamUrl: null,
      });
    } catch (err) {
      console.error('Episode change error:', err);
    }
  }

  function updateAnimeUI(state) {
    if (state && state.isActive && state.currentAnime) {
      cinemaAnimeTitle.textContent = state.currentAnime.title;
      cinemaAnimeEp.textContent = `EP ${state.currentAnime.episodeNumber}`;
      cinemaEmptyState.style.display = 'none';
      cinemaStopBtn.style.display = 'flex';
      cinemaTogglePlay.style.display = 'flex';
      cinemaPrevEp.disabled = state.currentAnime.episodeNumber <= 1;
      cinemaNextEp.disabled = false;

      // Update server label
      if (cinemaServerLabel && state.currentAnime.server && currentAnimeServers.length) {
        const found = currentAnimeServers.find(s => s.id === state.currentAnime.server);
        if (found) cinemaServerLabel.textContent = found.name;
      }

      const directStream = state.currentAnime.directStreamUrl || state.currentAnime.directStream;
      const isNativeStream = directStream && (directStream.includes('.m3u8') || directStream.includes('.mp4'));

      if (isNativeStream) {
        // True 100% Native HLS Video Stream
        removeCinemaIframe();
        if (animeVideo) {
          animeVideo.style.display = 'block';

          if (currentLoadedDirectStream !== directStream) {
            currentLoadedDirectStream = directStream;
            if (hlsInstance) {
              hlsInstance.destroy();
              hlsInstance = null;
            }
            if (window.Hls && Hls.isSupported()) {
              hlsInstance = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
              });
              hlsInstance.loadSource(directStream);
              hlsInstance.attachMedia(animeVideo);
              hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                if (state.isPlaying !== false) {
                  animeVideo.play().catch(() => {});
                }
              });
            } else if (animeVideo.canPlayType('application/vnd.apple.mpegurl')) {
              animeVideo.src = directStream;
              if (state.isPlaying !== false) {
                animeVideo.play().catch(() => {});
              }
            }
          }

          if (state.isPlaying === false) {
            isRemoteAnimeSync = true;
            animeVideo.pause();
            setTimeout(() => { isRemoteAnimeSync = false; }, 300);
            cinemaPauseOverlay.style.display = 'flex';
            cinemaTogglePlay.innerHTML = '<i class="fas fa-play"></i> <span class="cinema-btn-text">Resume</span>';
          } else {
            isRemoteAnimeSync = true;
            animeVideo.play().catch(() => {});
            setTimeout(() => { isRemoteAnimeSync = false; }, 300);
            cinemaPauseOverlay.style.display = 'none';
            cinemaTogglePlay.innerHTML = '<i class="fas fa-pause"></i> <span class="cinema-btn-text">Pause</span>';
          }
        }
      } else if (state.currentAnime.embedUrl) {
        // Embedded Cinema Player
        if (animeVideo) {
          animeVideo.style.display = 'none';
          animeVideo.pause();
          animeVideo.src = '';
        }
        if (hlsInstance) {
          hlsInstance.destroy();
          hlsInstance = null;
        }
        currentLoadedDirectStream = null;
        injectCinemaIframe(state.currentAnime.embedUrl);

        if (state.isPlaying === false) {
          cinemaPauseOverlay.style.display = 'flex';
          cinemaTogglePlay.innerHTML = '<i class="fas fa-play"></i> <span class="cinema-btn-text">Resume</span>';
        } else {
          cinemaPauseOverlay.style.display = 'none';
          cinemaTogglePlay.innerHTML = '<i class="fas fa-pause"></i> <span class="cinema-btn-text">Pause</span>';
        }
      }

      // Fetch servers list for this episode if not loaded or changed
      const epId = state.currentAnime.episodeId || `${state.currentAnime.animeId}-episode-${state.currentAnime.episodeNumber}`;
      if (!currentAnimeServers.length || currentAnimeServers._forEp !== epId) {
        currentAnimeServers._forEp = epId;
        loadAnimeServers(epId);
      }

      if (!currentAnimeInfo || currentAnimeInfo.id !== state.currentAnime.animeId) {
        fetch(`/api/anime/info/${state.currentAnime.animeId}`)
          .then(r => r.json())
          .then(info => {
            currentAnimeInfo = info;
            cinemaPrevEp.disabled = state.currentAnime.episodeNumber <= 1;
            if (info.totalEpisodes) {
              cinemaNextEp.disabled = state.currentAnime.episodeNumber >= info.totalEpisodes;
            }
          })
          .catch(() => {});
      }
    } else {
      cinemaAnimeTitle.textContent = 'PBG Anime Cinema';
      cinemaAnimeEp.textContent = 'Select an anime';
      cinemaEmptyState.style.display = 'block';
      renderQuickPills();
      removeCinemaIframe();
      if (animeVideo) {
        animeVideo.style.display = 'none';
        animeVideo.pause();
        animeVideo.src = '';
      }
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      currentLoadedDirectStream = null;
      cinemaPauseOverlay.style.display = 'none';
      cinemaStopBtn.style.display = 'none';
      cinemaTogglePlay.style.display = 'none';
      cinemaPrevEp.disabled = true;
      cinemaNextEp.disabled = true;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  GAMING ROOM — Real-Time WebRTC Screen Sharing & Gameplay Stream
  // ════════════════════════════════════════════════════════════════

  function initGamingStage() {
    if (!gamingStage) return;

    if (gamingStartShareBtn) {
      gamingStartShareBtn.addEventListener('click', startScreenShare);
    }
    if (gamingStandbyStartBtn) {
      gamingStandbyStartBtn.addEventListener('click', startScreenShare);
    }
    if (gamingCameraBtn) {
      gamingCameraBtn.addEventListener('click', startCameraStream);
    }
    if (gamingStandbyCamBtn) {
      gamingStandbyCamBtn.addEventListener('click', startCameraStream);
    }
    if (gamingStopShareBtn) {
      gamingStopShareBtn.addEventListener('click', stopScreenShare);
    }
    if (gamingAudioToggle) {
      gamingAudioToggle.addEventListener('click', toggleGamingAudio);
    }
    if (gamingPipBtn) {
      gamingPipBtn.addEventListener('click', toggleGamingPip);
    }
    if (gamingFullscreenBtn) {
      gamingFullscreenBtn.addEventListener('click', toggleGamingFullscreen);
    }
    if (gamingTheaterBtn) {
      gamingTheaterBtn.addEventListener('click', toggleGamingTheater);
    }
    if (gamingHttpsLink) {
      const httpsPort = location.port ? '3443' : '';
      const portPart = httpsPort ? `:${httpsPort}` : '';
      gamingHttpsLink.href = `https://${location.hostname}${portPart}${location.pathname}${location.search}`;
    }
    if (gamingMobileUnmuteBtn) {
      gamingMobileUnmuteBtn.addEventListener('click', () => {
        if (gamingVideo) {
          gamingVideo.muted = false;
          updateGamingAudioIcon();
          if (gamingMobileUnmuteOverlay) gamingMobileUnmuteOverlay.style.display = 'none';
        }
      });
    }
    if (gamingVideo) {
      gamingVideo.addEventListener('click', () => {
        if (gamingVideo.muted && viewerRemoteStream) {
          gamingVideo.muted = false;
          updateGamingAudioIcon();
          if (gamingMobileUnmuteOverlay) gamingMobileUnmuteOverlay.style.display = 'none';
        }
      });
    }

    checkHttpsBanner();
  }

  function checkHttpsBanner() {
    if (!gamingHttpsBanner) return;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!window.isSecureContext && location.protocol === 'http:' && isMobile) {
      gamingHttpsBanner.style.display = 'flex';
    } else {
      gamingHttpsBanner.style.display = 'none';
    }
  }

  async function startScreenShare() {
    // 1. Check for insecure context on mobile (HTTP over LAN IP)
    if (!window.isSecureContext && location.protocol === 'http:') {
      const httpsPort = location.port ? '3443' : '';
      const portPart = httpsPort ? `:${httpsPort}` : '';
      const httpsUrl = `https://${location.hostname}${portPart}${location.pathname}${location.search}`;
      if (confirm('Mobile browsers (Chrome & Safari) require a secure connection (HTTPS) for screen sharing and camera streaming.\n\nWould you like to switch to HTTPS mode now?')) {
        window.location.href = httpsUrl;
        return;
      }
    }

    if (currentGamingState && currentGamingState.isLive && currentGamingState.streamerId !== socket?.id) {
      alert(`${currentGamingState.streamerName || 'Another player'} is currently streaming live. Please wait for them to finish or ask in chat!`);
      return;
    }

    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    let stream = null;

    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        if (isMobile) {
          // Mobile Android Chrome only supports basic video constraints (audio and displaySurface: monitor fail)
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
          });
        } else {
          // Desktop Chrome / Edge / Firefox
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                cursor: 'always',
                displaySurface: 'monitor',
                frameRate: { ideal: 30, max: 60 }
              },
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              }
            });
          } catch (deskErr) {
            console.warn('[Gaming] Desktop high-spec constraints failed, retrying simple:', deskErr);
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          }
        }
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          console.log('[Gaming] Screen sharing was cancelled.');
          return;
        }
        console.warn('[Gaming] Initial getDisplayMedia failed, trying fallback video: true', err);
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch (fallbackErr) {
          if (fallbackErr.name === 'NotAllowedError') return;
          console.warn('[Gaming] Fallback getDisplayMedia failed:', fallbackErr);
        }
      }
    }

    // If getDisplayMedia is not available (mobile browsers on Android & iOS restrict web-based screen capture by OS policy):
    if (!stream) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const useCam = confirm('Full screen sharing is restricted by mobile browsers (Android & iOS) due to system security.\n\nWould you like to stream your Mobile Camera / Desk Cam live to the room instead?\n\n(Tip: To share full screen or PC gameplay, open this room on a PC or Laptop)');
        if (useCam) {
          return startCameraStream();
        }
      } else {
        alert('Media devices are not available in this browser. If you are on mobile, please make sure you are accessing via HTTPS (https://' + location.hostname + ':3443)');
      }
      return;
    }

    initStreamerBroadcast(stream, `${currentUser?.username || 'Player'}'s Screen`);
  }

  async function startCameraStream() {
    if (!window.isSecureContext && location.protocol === 'http:') {
      const httpsPort = location.port ? '3443' : '';
      const portPart = httpsPort ? `:${httpsPort}` : '';
      const httpsUrl = `https://${location.hostname}${portPart}${location.pathname}${location.search}`;
      if (confirm('Mobile camera streaming requires HTTPS.\n\nSwitch to HTTPS mode now?')) {
        window.location.href = httpsUrl;
        return;
      }
    }

    if (currentGamingState && currentGamingState.isLive && currentGamingState.streamerId !== socket?.id) {
      alert(`${currentGamingState.streamerName || 'Another player'} is currently streaming live. Please wait for them to finish!`);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera access is not supported by your browser or requires HTTPS (https://' + location.hostname + ':3443).');
      return;
    }

    try {
      // Use back camera by default for streaming handheld game/desk/screen
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });
      initStreamerBroadcast(stream, `📷 ${currentUser?.username || 'Player'}'s Game Cam`);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.log('[Gaming] Camera access cancelled.');
        return;
      }
      try {
        // Fallback without audio constraint in case microphone was blocked
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        initStreamerBroadcast(stream, `📷 ${currentUser?.username || 'Player'}'s Game Cam`);
      } catch (err2) {
        try {
          // Final fallback to any available camera (front or rear)
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          initStreamerBroadcast(stream, `📷 ${currentUser?.username || 'Player'}'s Cam`);
        } catch (err3) {
          alert('Could not start camera stream: ' + (err3.message || err3.name) + '\n\nNote: If using Chrome on mobile with self-signed HTTPS, check that camera permissions are allowed in site settings.');
        }
      }
    }
  }

  function initStreamerBroadcast(stream, title) {
    localScreenStream = stream;
    isSharingScreen = true;

    if (gamingVideo) {
      gamingVideo.srcObject = stream;
      gamingVideo.muted = true; // Streamer video muted locally to prevent echo
      gamingVideo.setAttribute('playsinline', 'true');
      gamingVideo.setAttribute('webkit-playsinline', 'true');
      gamingVideo.play().catch(e => console.warn('[Gaming] Streamer video play:', e));
    }

    // If user clicks the native browser floating "Stop sharing" button or track ends
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        stopScreenShare();
      };
    }

    socket.emit('gaming-start-share', { title });

    updateGamingUI({
      isLive: true,
      streamerId: socket.id,
      streamerName: currentUser?.username || 'You',
      streamerColor: currentUser?.color || '#10b981',
      title: title || `${currentUser?.username || 'You'}'s Stream`,
      startedAt: Date.now()
    });
    updateGamingBadge();
  }

  function stopScreenShare() {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      localScreenStream = null;
    }

    streamerPeerConnections.forEach(pc => pc.close());
    streamerPeerConnections.clear();
    isSharingScreen = false;

    if (gamingVideo && !viewerRemoteStream) {
      gamingVideo.srcObject = null;
    }

    if (socket) {
      socket.emit('gaming-stop-share');
    }

    updateGamingUI({
      isLive: false,
      streamerId: null
    });
    updateGamingBadge();
  }

  function cleanupViewerConnection() {
    if (viewerPeerConnection) {
      viewerPeerConnection.close();
      viewerPeerConnection = null;
    }
    viewerRemoteStream = null;
    if (gamingVideo && !isSharingScreen) {
      gamingVideo.srcObject = null;
    }
    if (gamingMobileUnmuteOverlay) {
      gamingMobileUnmuteOverlay.style.display = 'none';
    }
  }

  function updateGamingUI(state) {
    checkHttpsBanner();

    if (!state || !state.isLive) {
      // Standby Mode
      if (gamingStandby) gamingStandby.style.display = 'flex';
      if (gamingVideoContainer) gamingVideoContainer.style.display = 'none';
      if (gamingLivePill) gamingLivePill.style.display = 'none';
      if (gamingStartShareBtn) gamingStartShareBtn.style.display = 'inline-flex';
      if (gamingCameraBtn) gamingCameraBtn.style.display = 'inline-flex';
      if (gamingStopShareBtn) gamingStopShareBtn.style.display = 'none';
      if (gamingAudioToggle) gamingAudioToggle.style.display = 'none';
      if (gamingPipBtn) gamingPipBtn.style.display = 'none';
      if (gamingFullscreenBtn) gamingFullscreenBtn.style.display = 'none';
      if (gamingMobileUnmuteOverlay) gamingMobileUnmuteOverlay.style.display = 'none';
      if (gamingStreamerTitle) gamingStreamerTitle.textContent = 'Gaming Live Stage';
      if (gamingStreamerSub) gamingStreamerSub.textContent = 'Share your screen, console, or camera with the community';
      cleanupViewerConnection();
      return;
    }

    // Active Stream Mode
    if (gamingStandby) gamingStandby.style.display = 'none';
    if (gamingVideoContainer) gamingVideoContainer.style.display = 'block';
    if (gamingLivePill) gamingLivePill.style.display = 'inline-flex';
    if (gamingPipBtn) gamingPipBtn.style.display = 'inline-flex';
    if (gamingFullscreenBtn) gamingFullscreenBtn.style.display = 'inline-flex';

    const isMe = socket && socket.id === state.streamerId;
    if (isMe) {
      // We are the broadcaster
      if (gamingStartShareBtn) gamingStartShareBtn.style.display = 'none';
      if (gamingCameraBtn) gamingCameraBtn.style.display = 'none';
      if (gamingStopShareBtn) gamingStopShareBtn.style.display = 'inline-flex';
      if (gamingAudioToggle) gamingAudioToggle.style.display = 'none';
      if (gamingMobileUnmuteOverlay) gamingMobileUnmuteOverlay.style.display = 'none';
      if (gamingStreamerTitle) gamingStreamerTitle.textContent = state.title || 'Your Live Stream';
      if (gamingStreamerSub) gamingStreamerSub.textContent = 'Broadcasting live to everyone in #gaming';
      if (gamingOverlayAvatar) {
        gamingOverlayAvatar.textContent = '🎮';
        gamingOverlayAvatar.style.background = 'var(--emerald-500)';
      }
      if (gamingOverlayTitle) gamingOverlayTitle.textContent = state.title || 'Your Screen (Live)';
      if (gamingOverlaySub) gamingOverlaySub.textContent = 'Broadcasting via WebRTC P2P';
    } else {
      // We are a viewer
      if (gamingStartShareBtn) gamingStartShareBtn.style.display = 'none';
      if (gamingCameraBtn) gamingCameraBtn.style.display = 'none';
      if (gamingStopShareBtn) gamingStopShareBtn.style.display = 'none';
      if (gamingAudioToggle) gamingAudioToggle.style.display = 'inline-flex';
      if (gamingStreamerTitle) gamingStreamerTitle.textContent = `${state.streamerName}'s Live Stream`;
      if (gamingStreamerSub) gamingStreamerSub.textContent = `Streaming screen & audio live in #gaming`;
      if (gamingOverlayAvatar) {
        gamingOverlayAvatar.textContent = getInitials(state.streamerName);
        if (state.streamerColor) gamingOverlayAvatar.style.background = state.streamerColor;
      }
      if (gamingOverlayTitle) gamingOverlayTitle.textContent = state.title || `${state.streamerName}'s Screen`;
      if (gamingOverlaySub) gamingOverlaySub.textContent = `WebRTC Live Stream by ${state.streamerName}`;

      // If viewer is in gaming room, request stream connection from streamer
      if (currentRoom === 'gaming' && socket && state.streamerId && !viewerPeerConnection) {
        socket.emit('gaming-signal', {
          to: state.streamerId,
          signal: { type: 'viewer-join' }
        });
      }
    }
  }

  function updateGamingBadge() {
    const gamingItem = document.querySelector('.room-item[data-room-id="gaming"]');
    if (!gamingItem) return;
    const nameEl = gamingItem.querySelector('.room-name');
    if (!nameEl) return;
    const existingBadge = nameEl.querySelector('.room-feature-badge');
    if (existingBadge) existingBadge.remove();

    if (currentGamingState && currentGamingState.isLive) {
      nameEl.insertAdjacentHTML('beforeend', ' <span class="room-feature-badge badge-live-stream"><span class="glp-dot"></span> LIVE</span>');
    } else {
      nameEl.insertAdjacentHTML('beforeend', ' <span class="room-feature-badge badge-gaming">🖥️ Screen Share</span>');
    }
  }

  async function handleGamingSignal(from, fromUser, signal) {
    if (!signal) return;

    // ── Streamer handles signals from viewers ──
    if (isSharingScreen && localScreenStream) {
      if (signal.type === 'viewer-join') {
        console.log(`[Gaming WebRTC] Viewer joined: ${fromUser || from}`);
        if (streamerPeerConnections.has(from)) {
          streamerPeerConnections.get(from).close();
        }

        const pc = new RTCPeerConnection(rtcConfig);
        streamerPeerConnections.set(from, pc);

        // Add local screen and audio tracks
        localScreenStream.getTracks().forEach(track => {
          pc.addTrack(track, localScreenStream);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit('gaming-signal', {
              to: from,
              signal: { type: 'ice-candidate', candidate: event.candidate }
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
            pc.close();
            streamerPeerConnections.delete(from);
          }
        };

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('gaming-signal', {
            to: from,
            signal: { type: 'offer', sdp: offer }
          });
        } catch (err) {
          console.error('[Gaming WebRTC] Error creating offer for viewer:', err);
        }
      } else if (signal.type === 'answer') {
        const pc = streamerPeerConnections.get(from);
        if (pc && signal.sdp) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } catch (err) {
            console.error('[Gaming WebRTC] Error setting remote description (answer):', err);
          }
        }
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        const pc = streamerPeerConnections.get(from);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.warn('[Gaming WebRTC] Streamer addIceCandidate error:', err);
          }
        }
      } else if (signal.type === 'viewer-leave') {
        const pc = streamerPeerConnections.get(from);
        if (pc) {
          pc.close();
          streamerPeerConnections.delete(from);
        }
      }
      return;
    }

    // ── Viewer handles signals from streamer ──
    if (signal.type === 'offer' && signal.sdp) {
      console.log('[Gaming WebRTC] Received offer from streamer:', from);
      if (viewerPeerConnection) {
        viewerPeerConnection.close();
      }

      viewerPeerConnection = new RTCPeerConnection(rtcConfig);

      viewerPeerConnection.ontrack = (event) => {
        console.log('[Gaming WebRTC] Received remote stream track:', event.track.kind);
        viewerRemoteStream = event.streams[0];
        if (gamingVideo) {
          gamingVideo.srcObject = viewerRemoteStream;
          gamingVideo.setAttribute('playsinline', 'true');
          gamingVideo.setAttribute('webkit-playsinline', 'true');

          const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
          if (isMobile) {
            // Mute video first on mobile so browser autoplay never blocks
            gamingVideo.muted = true;
            updateGamingAudioIcon();
            if (gamingMobileUnmuteOverlay) gamingMobileUnmuteOverlay.style.display = 'block';
            gamingVideo.play().catch(e => console.warn('[Gaming WebRTC] Mobile autoplay error:', e));
          } else {
            gamingVideo.muted = false;
            gamingVideo.play().catch(err => {
              console.warn('[Gaming WebRTC] Autoplay with sound blocked, trying muted:', err);
              gamingVideo.muted = true;
              updateGamingAudioIcon();
              if (gamingMobileUnmuteOverlay) gamingMobileUnmuteOverlay.style.display = 'block';
              gamingVideo.play().catch(e => console.error('[Gaming WebRTC] Play failed:', e));
            });
            updateGamingAudioIcon();
          }
        }
      };

      viewerPeerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('gaming-signal', {
            to: from,
            signal: { type: 'ice-candidate', candidate: event.candidate }
          });
        }
      };

      try {
        await viewerPeerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await viewerPeerConnection.createAnswer();
        await viewerPeerConnection.setLocalDescription(answer);
        socket.emit('gaming-signal', {
          to: from,
          signal: { type: 'answer', sdp: answer }
        });
      } catch (err) {
        console.error('[Gaming WebRTC] Error responding to streamer offer:', err);
      }
    } else if (signal.type === 'ice-candidate' && signal.candidate) {
      if (viewerPeerConnection) {
        try {
          await viewerPeerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.warn('[Gaming WebRTC] Viewer addIceCandidate error:', err);
        }
      }
    }
  }

  function toggleGamingAudio() {
    if (!gamingVideo) return;
    gamingVideo.muted = !gamingVideo.muted;
    updateGamingAudioIcon();
  }

  function updateGamingAudioIcon() {
    if (!gamingAudioToggle) return;
    if (gamingVideo && gamingVideo.muted) {
      gamingAudioToggle.innerHTML = '<i class="fas fa-volume-xmark" style="color: var(--pink-400);"></i>';
      gamingAudioToggle.title = 'Unmute Stream Sound';
    } else {
      gamingAudioToggle.innerHTML = '<i class="fas fa-volume-high" style="color: var(--emerald-400);"></i>';
      gamingAudioToggle.title = 'Mute Stream Sound';
    }
  }

  async function toggleGamingPip() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (gamingVideo && document.pictureInPictureEnabled) {
        await gamingVideo.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[Gaming] Picture-in-picture error:', err);
    }
  }

  function toggleGamingFullscreen() {
    if (!gamingPlayerWrap) return;
    if (!document.fullscreenElement) {
      if (gamingPlayerWrap.requestFullscreen) {
        gamingPlayerWrap.requestFullscreen();
      } else if (gamingPlayerWrap.webkitRequestFullscreen) {
        gamingPlayerWrap.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function toggleGamingTheater() {
    chatLayout.classList.toggle('gaming-theater');
    const isTheater = chatLayout.classList.contains('gaming-theater');
    if (gamingTheaterBtn) {
      gamingTheaterBtn.innerHTML = isTheater ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
      gamingTheaterBtn.title = isTheater ? 'Exit Theater Mode' : 'Toggle Theater Mode';
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  NATIVE MEDIA SESSION API (Lock Screen & Background Audio)
  // ════════════════════════════════════════════════════════════════
  function updateMediaSession(track, isPlaying) {
    if (!('mediaSession' in navigator) || !track) return;

    try {
      let artworkSrc = '/assets/images/logo.jpg';
      if (track.type === 'youtube' && track.videoId) {
        artworkSrc = `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`;
      } else if (track.thumbnail) {
        artworkSrc = track.thumbnail;
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'PBG Music',
        artist: track.artist || (track.type === 'stream' ? '24/7 Live Radio' : 'PBG Audio'),
        album: 'PBG Officials — Live Radio & Chat',
        artwork: [
          { src: artworkSrc, sizes: '512x512', type: 'image/jpeg' },
          { src: artworkSrc, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkSrc, sizes: '128x128', type: 'image/jpeg' },
          { src: '/assets/images/logo.jpg', sizes: '96x96', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        if (currentMusicState && !currentMusicState.isPlaying) {
          if (currentMusicState.currentTrack?.type === 'stream' && currentMusicState.currentTrack?.streamUrl) {
            if (currentlyPlayingStreamUrl !== currentMusicState.currentTrack.streamUrl) {
              currentlyPlayingStreamUrl = currentMusicState.currentTrack.streamUrl;
              realRadioAudio.src = currentMusicState.currentTrack.streamUrl;
            }
            realRadioAudio.play().catch(() => {});
          } else if (currentMusicState.currentTrack?.type === 'youtube') {
            if (bgAudioAnchor) {
              if (!bgAudioAnchor.src.startsWith('data:audio')) bgAudioAnchor.src = SILENT_AUDIO_URI;
              bgAudioAnchor.play().catch(() => {});
            }
            postToYouTube('playVideo');
          }
          socket.emit('music-toggle');
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (currentMusicState && currentMusicState.isPlaying) {
          if (realRadioAudio) realRadioAudio.pause();
          if (bgAudioAnchor) bgAudioAnchor.pause();
          postToYouTube('pauseVideo');
          socket.emit('music-toggle');
        }
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        socket.emit('music-skip');
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        socket.emit('music-skip');
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        stopAllAudio();
        socket.emit('music-toggle');
      });
    } catch (err) {
      console.warn('MediaSession setup warning:', err.message);
    }
  }

  // ── PWA Service Worker Registration ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/chatbox/sw.js').then((reg) => {
        reg.update();
      }).catch(() => {});
    });
  }

  // ── Init ──
  initModal();
})();
