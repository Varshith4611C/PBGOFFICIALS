/* ============================================
   PBG ChatBox — Client-Side Logic
   ============================================ */

(() => {
  'use strict';

  // ── DOM Elements ──
  const usernameModal = document.getElementById('usernameModal');
  const usernameInput = document.getElementById('usernameInput');
  const joinBtn = document.getElementById('joinBtn');
  const chatApp = document.getElementById('chatApp');
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
    return name.slice(0, 2).toUpperCase();
  }

  function getAvatarColor(name) {
    const colors = [
      '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24',
      '#fb7185', '#60a5fa', '#818cf8', '#2dd4bf', '#fb923c',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function isNearBottom() {
    const threshold = 120;
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < threshold;
  }

  function scrollToBottom(smooth = true) {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }

  // ── Username Modal ──
  function initModal() {
    const savedUser = localStorage.getItem('pbg-chatbox-username');
    if (savedUser) {
      currentUser = savedUser;
      usernameModal.style.display = 'none';
      chatApp.style.display = 'flex';
      connectSocket();
      return;
    }

    usernameInput.addEventListener('input', () => {
      const val = usernameInput.value.trim();
      const valid = val.length >= 2 && val.length <= 20 && /^[a-zA-Z0-9_]+$/.test(val);
      joinBtn.disabled = !valid;
    });

    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !joinBtn.disabled) {
        handleJoin();
      }
    });

    joinBtn.addEventListener('click', handleJoin);
    usernameInput.focus();
  }

  function handleJoin() {
    const val = usernameInput.value.trim();
    if (val.length < 2) return;
    currentUser = val;
    localStorage.setItem('pbg-chatbox-username', val);
    usernameModal.style.display = 'none';
    chatApp.style.display = 'flex';
    connectSocket();
  }

  // ── Socket Connection ──
  function connectSocket() {
    socket = io();

    // Set topbar user info
    const color = getAvatarColor(currentUser);
    topbarAvatar.textContent = getInitials(currentUser);
    topbarAvatar.style.background = color;
    topbarUsername.textContent = currentUser;

    // Emit join
    socket.emit('user-join', { username: currentUser, room: currentRoom });

    // ── Socket Events ──
    socket.on('room-list', (roomData) => {
      rooms = roomData;
      renderRoomList();
    });

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
      if (wasNearBottom) {
        scrollToBottom();
      } else {
        scrollBottomBtn.style.display = 'flex';
      }
    });

    socket.on('user-list', (users) => {
      renderUserList(users);
    });

    socket.on('room-counts', (counts) => {
      roomCounts = counts;
      updateRoomCounts();
    });

    socket.on('user-typing', ({ username, isTyping: typing }) => {
      if (typing) {
        typingUsers.set(username, Date.now());
      } else {
        typingUsers.delete(username);
      }
      updateTypingIndicator();
    });

    // Init UI
    initMessageInput();
    initEmojiPicker();
    initSidebars();
    initScrollDetection();
  }

  // ── Render Room List ──
  function renderRoomList() {
    roomList.innerHTML = '';
    rooms.forEach(room => {
      const li = document.createElement('li');
      li.className = `room-item${room.id === currentRoom ? ' active' : ''}`;
      li.dataset.roomId = room.id;
      li.innerHTML = `
        <span class="room-icon">${room.icon}</span>
        <div class="room-info">
          <div class="room-name">${escapeHtml(room.name)}</div>
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

    // Update active state
    document.querySelectorAll('.room-item').forEach(el => {
      el.classList.toggle('active', el.dataset.roomId === roomId);
    });

    // Update topbar
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      topbarRoomIcon.textContent = room.icon;
      topbarRoomName.textContent = room.name;
      topbarRoomDesc.textContent = room.description;
      messagesStartIcon.textContent = room.icon;
      messagesStartTitle.textContent = `Welcome to #${room.name}`;
      messagesStartDesc.textContent = room.description;
    }

    // Close mobile sidebar
    sidebarRooms.classList.remove('open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('open');

    socket.emit('switch-room', roomId);
  }

  // ── Render User List ──
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

  // ── Render Message ──
  function renderMessage(msg, animated) {
    if (msg.type === 'system') {
      const div = document.createElement('div');
      div.className = 'message message-system';
      div.innerHTML = `
        <span class="message-system-text">
          <i class="fas fa-arrow-right"></i> ${escapeHtml(msg.text)}
        </span>
      `;
      if (animated) div.style.animation = 'msgSlideIn 0.3s ease';
      messagesList.appendChild(div);
      lastMessageUser = null;
      lastMessageTime = 0;
      return;
    }

    const isSelf = msg.socketId === socket.id;
    const timeDiff = msg.timestamp - lastMessageTime;
    const isCompact = lastMessageUser === msg.username && timeDiff < 300000; // 5 min

    const div = document.createElement('div');

    if (isCompact) {
      div.className = `message message-compact${isSelf ? ' message-self' : ''}`;
      div.style.position = 'relative';
      div.innerHTML = `
        <span class="message-compact-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div class="message-body">
          <div class="message-text">${formatMessageText(msg.text)}</div>
        </div>
      `;
    } else {
      div.className = `message${isSelf ? ' message-self' : ''}`;
      div.innerHTML = `
        <div class="message-avatar" style="background: ${msg.color}">${msg.initials}</div>
        <div class="message-body">
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
    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code: `text`
    escaped = escaped.replace(/`(.*?)`/g, '<code style="background: rgba(52,211,153,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.85em;">$1</code>');
    // Links
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color: var(--emerald-400); text-decoration: underline;">$1</a>');
    return escaped;
  }

  // ── Message Input ──
  function initMessageInput() {
    messageInput.addEventListener('input', () => {
      sendBtn.disabled = !messageInput.value.trim();

      // Typing indicator
      if (!isTyping && messageInput.value.trim()) {
        isTyping = true;
        socket.emit('typing', true);
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        socket.emit('typing', false);
      }, 2000);
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);
    messageInput.focus();
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    socket.emit('send-message', text);
    messageInput.value = '';
    sendBtn.disabled = true;

    // Stop typing
    isTyping = false;
    socket.emit('typing', false);
    clearTimeout(typingTimeout);

    messageInput.focus();
  }

  // ── Typing Indicator ──
  function updateTypingIndicator() {
    // Clean stale entries (older than 5s)
    const now = Date.now();
    typingUsers.forEach((ts, user) => {
      if (now - ts > 5000) typingUsers.delete(user);
    });

    const names = [...typingUsers.keys()];
    if (names.length === 0) {
      typingIndicator.style.display = 'none';
      return;
    }

    typingIndicator.style.display = 'flex';
    if (names.length === 1) {
      typingText.textContent = `${names[0]} is typing...`;
    } else if (names.length === 2) {
      typingText.textContent = `${names[0]} and ${names[1]} are typing...`;
    } else {
      typingText.textContent = `${names.length} people are typing...`;
    }
  }

  // ── Emoji Picker ──
  function initEmojiPicker() {
    // Populate grid
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
      if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.style.display = 'none';
      }
    });
  }

  // ── Sidebars (mobile) ──
  function initSidebars() {
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    sidebarToggle.addEventListener('click', () => {
      sidebarRooms.classList.toggle('open');
      sidebarUsers.classList.remove('open');
      backdrop.classList.toggle('open', sidebarRooms.classList.contains('open'));
    });

    usersToggle.addEventListener('click', () => {
      sidebarUsers.classList.toggle('open');
      sidebarRooms.classList.remove('open');
      backdrop.classList.toggle('open', sidebarUsers.classList.contains('open'));
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
      if (isNearBottom()) {
        scrollBottomBtn.style.display = 'none';
      } else {
        scrollBottomBtn.style.display = 'flex';
      }
    });

    scrollBottomBtn.addEventListener('click', () => {
      scrollToBottom();
      scrollBottomBtn.style.display = 'none';
    });
  }

  // ── Init ──
  initModal();
})();
