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

  // Music Elements
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
  const realRadioAudio = document.getElementById('realRadioAudio');
  const musicIframe = document.getElementById('musicIframe');

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

    initMessageInput();
    initEmojiPicker();
    initSidebars();
    initScrollDetection();
    initReply();
    initMusicDeck();
    initMusicLibrary();
    initCinemaStage();
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
        badge = '<span class="room-feature-badge badge-listen">📻 Radio</span>';
      } else if (room.id === 'anime-manga') {
        badge = '<span class="room-feature-badge badge-watch">📺 Watch</span>';
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
  }

  function updateRoomView() {
    if (currentRoom === 'music') {
      musicAudioDeck.style.display = 'block';
      if (currentMusicState) updateMusicUI(currentMusicState);
    } else {
      musicAudioDeck.style.display = 'none';
      musicDropdownPanel.style.display = 'none';
      musicLibraryModal.style.display = 'none';
      stopAllAudio();
    }

    if (currentRoom === 'anime-manga') {
      cinemaStage.style.display = 'flex';
      chatLayout.classList.add('cinema-active');
      if (currentAnimeState) updateAnimeUI(currentAnimeState);
    } else {
      cinemaStage.style.display = 'none';
      chatLayout.classList.remove('cinema-active');
      cinemaSearchDrawer.style.display = 'none';
      if (animeVideo) animeVideo.pause();
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

    const actionsHtml = `
      <div class="message-actions">
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
        </div>
      `;
    }

    if (!animated) div.style.animation = 'none';
    messagesList.appendChild(div);
    lastMessageUser = msg.username;
    lastMessageTime = msg.timestamp;
  }

  function formatMessageText(text) {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/`(.*?)`/g, '<code style="background:rgba(52,211,153,0.1);padding:2px 6px;border-radius:4px;font-size:0.85em;">$1</code>');
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--emerald-400);text-decoration:underline;">$1</a>');
    return escaped;
  }

  // ── Reply System ──
  function initReply() {
    messagesList.addEventListener('click', (e) => {
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

  function stopAllAudio() {
    if (realRadioAudio) {
      realRadioAudio.pause();
    }
    postToYouTube('pauseVideo');
    if (musicIframe && musicIframe.src) {
      musicIframe.src = '';
    }
  }

  function initMusicDeck() {
    musicToggleBtn.addEventListener('click', () => {
      if (currentMusicState && currentMusicState.currentTrack) {
        if (currentMusicState.currentTrack.type === 'stream' && currentMusicState.currentTrack.streamUrl) {
          if (!currentMusicState.isPlaying) {
            if (currentlyPlayingStreamUrl !== currentMusicState.currentTrack.streamUrl) {
              currentlyPlayingStreamUrl = currentMusicState.currentTrack.streamUrl;
              realRadioAudio.src = currentMusicState.currentTrack.streamUrl;
            }
            realRadioAudio.play().catch(e => console.error('Audio play error:', e));
          } else {
            realRadioAudio.pause();
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

    document.addEventListener('click', (e) => {
      if (!musicDropdownPanel.contains(e.target) && e.target !== musicAddToggle && e.target !== musicQueueToggle) {
        musicDropdownPanel.style.display = 'none';
      }
    });
  }

  function stopAllAudio() {
    currentlyPlayingStreamUrl = '';
    if (realRadioAudio) {
      realRadioAudio.pause();
      realRadioAudio.src = '';
    }
    postToYouTube('pauseVideo');
    if (musicIframe) musicIframe.src = '';
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const str = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
    const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    return match ? match[1] : null;
  }

  function handleAddMusic() {
    const raw = musicUrlInput.value.trim();
    if (!raw) return;
    const videoId = extractYouTubeId(raw);
    if (!videoId) {
      musicUrlInput.style.borderColor = 'var(--rose-400)';
      setTimeout(() => { musicUrlInput.style.borderColor = ''; }, 1500);
      return;
    }
    socket.emit('music-add', {
      videoId,
      title: `YouTube Song (${videoId})`,
      artist: 'Custom Audio',
    });
    musicUrlInput.value = '';
    musicDropdownPanel.style.display = 'none';
  }

  function updateMusicUI(state) {
    if (!state) return;

    // Render Station Pills
    if (state.stations && state.stations.length > 0) {
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

    if (state.currentTrack) {
      musicTrackTitle.textContent = state.currentTrack.title;
      if (musicModeTag) {
        musicModeTag.textContent = state.currentTrack.type === 'stream' ? 'LIVE 24/7 RADIO' : 'YOUTUBE AUDIO';
      }
      if (musicTrackMeta) {
        musicTrackMeta.textContent = `${state.currentTrack.artist || 'PBG Audio'} • Added by ${state.currentTrack.addedBy}`;
      }

      // Vinyl & EQ visual state
      if (state.isPlaying) {
        musicVinyl.classList.add('playing');
        musicEq.classList.add('playing');
        musicToggleBtn.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
        musicVinyl.classList.remove('playing');
        musicEq.classList.remove('playing');
        musicToggleBtn.innerHTML = '<i class="fas fa-play"></i>';
      }

      // ── HYBRID AUDIO PLAYBACK ENGINE ──
      if (state.currentTrack.type === 'stream' && state.currentTrack.streamUrl) {
        postToYouTube('pauseVideo');
        if (musicIframe.src) musicIframe.src = '';

        if (currentlyPlayingStreamUrl !== state.currentTrack.streamUrl) {
          currentlyPlayingStreamUrl = state.currentTrack.streamUrl;
          realRadioAudio.src = state.currentTrack.streamUrl;
        }

        if (state.isPlaying && currentRoom === 'music') {
          if (realRadioAudio.paused) {
            realRadioAudio.play().catch(e => {
              console.log('Stream autoplay waiting for user interaction:', e.message);
            });
          }
        } else {
          if (!realRadioAudio.paused) {
            realRadioAudio.pause();
          }
        }

      } else if (state.currentTrack.type === 'youtube' && state.currentTrack.videoId) {
        currentlyPlayingStreamUrl = '';
        if (!realRadioAudio.paused) realRadioAudio.pause();

        let startSeconds = 0;
        if (state.isPlaying && state.startedAt) {
          startSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
          if (startSeconds < 0) startSeconds = 0;
        } else if (!state.isPlaying) {
          startSeconds = Math.floor(state.pausedAt || 0);
        }

        const targetSrc = `https://www.youtube.com/embed/${state.currentTrack.videoId}?autoplay=${state.isPlaying ? 1 : 0}&start=${startSeconds}&enablejsapi=1&origin=${window.location.origin}`;

        if (!musicIframe.src.includes(state.currentTrack.videoId)) {
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
      }
    }

    // Queue badge & list
    const qCount = (state.queue && state.queue.length) || 0;
    if (qCount > 0) {
      musicQueueBadge.style.display = 'flex';
      musicQueueBadge.textContent = qCount;
      musicQueueCount.textContent = `${qCount} track${qCount > 1 ? 's' : ''}`;
      musicQueueList.innerHTML = '';
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
      musicQueueBadge.style.display = 'none';
      musicQueueCount.textContent = '0 tracks';
      musicQueueList.innerHTML = '<li style="padding:8px;color:var(--text-muted);font-size:0.75rem;text-align:center;">Queue is empty</li>';
    }

    // Refresh library view if open
    if (musicLibraryModal.style.display === 'flex') {
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

    musicLibSearchInput.addEventListener('input', renderLibraryContent);
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

  function renderLibraryContent() {
    if (!currentMusicState) return;
    const query = musicLibSearchInput.value.trim().toLowerCase();
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
  //  CINEMA STAGE (100% Real-Time Synchronized HTML5 Video Player)
  // ════════════════════════════════════════════════════════════════
  let animeSearchTimeout = null;

  function initCinemaStage() {
    cinemaSearchToggle.addEventListener('click', () => {
      const isVisible = cinemaSearchDrawer.style.display === 'block';
      cinemaSearchDrawer.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) animeSearchInput.focus();
    });

    cinemaSearchClose.addEventListener('click', () => {
      cinemaSearchDrawer.style.display = 'none';
    });

    cinemaQuickBrowseBtn.addEventListener('click', () => {
      cinemaSearchDrawer.style.display = 'block';
      animeSearchInput.focus();
    });

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
        if (directStream && animeVideo) {
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
      if (q.length < 2) { animeResults.style.display = 'none'; return; }
      animeSearchTimeout = setTimeout(() => searchAnime(q), 350);
    });

    cinemaPrevEp.addEventListener('click', () => changeAnimeEpisode(-1));
    cinemaNextEp.addEventListener('click', () => changeAnimeEpisode(1));
    cinemaStopBtn.addEventListener('click', () => socket.emit('anime-clear'));
  }

  function injectCinemaIframe(src) {
    if (!src) return;
    cinemaEmptyState.style.display = 'none';
    if (animeVideo) {
      animeVideo.style.display = 'none';
      animeVideo.pause();
    }

    let iframe = cinemaPlayerWrap.querySelector('iframe.cinema-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'animeIframe';
      iframe.className = 'cinema-iframe';
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('marginwidth', '0');
      iframe.setAttribute('marginheight', '0');
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      iframe.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;border:none;background:#000;';
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
      if (!data.results || data.results.length === 0) {
        animeResults.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No anime found matching your query</div>';
        animeResults.style.display = 'block';
        return;
      }
      animeResults.innerHTML = '';
      const seen = new Set();
      data.results.forEach(item => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        const div = document.createElement('div');
        div.className = 'anime-result-item';
        div.innerHTML = `
          <img class="anime-result-thumb" src="${item.image || ''}" alt="" onerror="this.style.display='none'" />
          <div class="anime-result-info">
            <div class="anime-result-title">${escapeHtml(item.title)}</div>
            <div class="anime-result-meta">${item.subOrDub === 'dub' ? 'DUB' : 'SUB'}</div>
          </div>
        `;
        div.addEventListener('click', () => selectAnime(item));
        animeResults.appendChild(div);
      });
      animeResults.style.display = 'block';
    } catch (err) {
      console.error('Anime search error:', err);
    }
  }

  async function selectAnime(item) {
    cinemaSearchDrawer.style.display = 'none';
    animeResults.style.display = 'none';
    animeSearchInput.value = '';
    try {
      const animeId = item.id.replace(/-episode-\d+.*$/, '');
      let episodeId = item.episodeId || (item.id.includes('-episode-') ? item.id : `${animeId}-episode-1`);
      let episodeNumber = item.episodeNumber || 1;
      let animeTitle = item.title || 'PBG Anime';
      let animeImage = item.image || '';

      // 1. Fetch exact episode metadata first to get guaranteed valid episode ID
      try {
        const infoRes = await fetch(`/api/anime/info/${animeId}`);
        if (infoRes.ok) {
          const info = await infoRes.json();
          currentAnimeInfo = info;
          if (info.title) animeTitle = info.title;
          if (info.image) animeImage = info.image;
          if (info.episodes && info.episodes.length > 0) {
            const firstEp = info.episodes.find(e => e.number === 1) || info.episodes[0];
            if (firstEp) {
              episodeId = firstEp.id;
              episodeNumber = firstEp.number;
            }
          }
        }
      } catch (e) {
        console.warn('Anime info lookup warning:', e);
      }

      // 2. Fetch the watch stream with the accurate episode ID
      const watchRes = await fetch(`/api/anime/watch/${episodeId}`);
      if (!watchRes.ok) throw new Error('Watch fetch failed for ' + episodeId);
      const watchData = await watchRes.json();

      socket.emit('anime-watch', {
        animeId: animeId,
        title: animeTitle || watchData.title,
        image: animeImage || watchData.image,
        episodeId: episodeId,
        episodeNumber: episodeNumber,
        embedUrl: watchData.embedUrl || watchData.iframeSrc || '',
        directStreamUrl: watchData.directStreamUrl || '',
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
    const animeId = currentAnimeState?.currentAnime?.animeId || 'anime';
    let nextEpisodeId = `${animeId}-episode-${newEpNum}`;

    if (currentAnimeInfo && currentAnimeInfo.episodes && currentAnimeInfo.episodes.length > 0) {
      const found = currentAnimeInfo.episodes.find(e => e.number === newEpNum);
      if (found) nextEpisodeId = found.id;
    }

    try {
      const watchRes = await fetch(`/api/anime/watch/${nextEpisodeId}`);
      if (!watchRes.ok) return;
      const watchData = await watchRes.json();
      socket.emit('anime-episode', {
        episodeId: nextEpisodeId,
        episodeNumber: newEpNum,
        embedUrl: watchData.embedUrl || watchData.iframeSrc || '',
        directStreamUrl: watchData.directStreamUrl || '',
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

      const directStream = state.currentAnime.directStreamUrl || state.currentAnime.directStream;

      if (directStream) {
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
        // Fallback Iframe Player
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

      if (!currentAnimeInfo || currentAnimeInfo.id !== state.currentAnime.animeId) {
        fetch(`/api/anime/info/${state.currentAnime.animeId}`)
          .then(r => r.json())
          .then(info => {
            currentAnimeInfo = info;
            cinemaPrevEp.disabled = state.currentAnime.episodeNumber <= 1;
            cinemaNextEp.disabled = state.currentAnime.episodeNumber >= info.totalEpisodes;
          })
          .catch(() => {});
      }
    } else {
      cinemaAnimeTitle.textContent = 'PBG Anime Cinema';
      cinemaAnimeEp.textContent = 'Select an anime';
      cinemaEmptyState.style.display = 'block';
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

  // ── Init ──
  initModal();
})();
