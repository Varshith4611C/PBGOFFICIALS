/* ============================================
   PBG ChatBox — Socket.IO Server
   ============================================ */

// Pre-defined chat rooms
const ROOMS = [
  { id: 'general',       name: 'General',        icon: '💬', description: 'Hang out and talk about anything' },
  { id: 'anime-manga',   name: 'Anime & Manga',  icon: '🎌', description: 'Discuss your favorite anime and manga' },
  { id: 'gaming',        name: 'Gaming',          icon: '🎮', description: 'Gaming talk, LFG, and tournaments' },
  { id: 'music',         name: 'Music',           icon: '🎵', description: 'Share and discover music' },
  { id: 'off-topic',     name: 'Off-Topic',       icon: '🌀', description: 'Random chats and fun stuff' },
];

// In-memory message store (last 50 per room)
const MAX_MESSAGES = 50;
const messageStore = {};
ROOMS.forEach(r => { messageStore[r.id] = []; });

// Track connected users: socketId → { username, avatar, color, room }
const connectedUsers = new Map();

// Avatar color palette
const AVATAR_COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24',
  '#fb7185', '#60a5fa', '#818cf8', '#2dd4bf', '#fb923c',
];

function getAvatarColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(username) {
  return username.slice(0, 2).toUpperCase();
}

function getUsersInRoom(roomId) {
  const users = [];
  connectedUsers.forEach((user, id) => {
    if (user.room === roomId) {
      users.push({ id, username: user.username, initials: getInitials(user.username), color: user.color });
    }
  });
  return users;
}

function getRoomCounts() {
  const counts = {};
  ROOMS.forEach(r => { counts[r.id] = 0; });
  connectedUsers.forEach(user => {
    if (counts[user.room] !== undefined) counts[user.room]++;
  });
  return counts;
}

/**
 * Initialize Socket.IO event handling
 * @param {import('socket.io').Server} io
 */
function initChatSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[ChatBox] Connected: ${socket.id}`);

    // ── Join ──
    socket.on('user-join', ({ username, room }) => {
      const color = getAvatarColor(username);
      connectedUsers.set(socket.id, { username, color, room: room || 'general' });

      const targetRoom = room || 'general';
      socket.join(targetRoom);

      // Send room list
      socket.emit('room-list', ROOMS);

      // Send cached message history for this room
      socket.emit('message-history', messageStore[targetRoom] || []);

      // Send online users in this room
      io.to(targetRoom).emit('user-list', getUsersInRoom(targetRoom));

      // Broadcast room counts to everyone
      io.emit('room-counts', getRoomCounts());

      // System message
      const sysMsg = {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'system',
        text: `${username} joined the chat`,
        timestamp: Date.now(),
        room: targetRoom,
      };
      io.to(targetRoom).emit('new-message', sysMsg);
    });

    // ── Switch Room ──
    socket.on('switch-room', (newRoom) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const oldRoom = user.room;
      socket.leave(oldRoom);

      // System message in old room
      io.to(oldRoom).emit('new-message', {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'system',
        text: `${user.username} left the room`,
        timestamp: Date.now(),
        room: oldRoom,
      });
      io.to(oldRoom).emit('user-list', getUsersInRoom(oldRoom));

      // Join new room
      user.room = newRoom;
      socket.join(newRoom);

      // Send message history for new room
      socket.emit('message-history', messageStore[newRoom] || []);

      // System message in new room
      io.to(newRoom).emit('new-message', {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'system',
        text: `${user.username} joined the room`,
        timestamp: Date.now(),
        room: newRoom,
      });
      io.to(newRoom).emit('user-list', getUsersInRoom(newRoom));

      // Broadcast updated room counts
      io.emit('room-counts', getRoomCounts());
    });

    // ── Send Message ──
    socket.on('send-message', (text) => {
      const user = connectedUsers.get(socket.id);
      if (!user || !text || typeof text !== 'string') return;

      const sanitized = text.trim().slice(0, 1000); // max 1000 chars
      if (!sanitized) return;

      const msg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'user',
        username: user.username,
        initials: getInitials(user.username),
        color: user.color,
        text: sanitized,
        timestamp: Date.now(),
        room: user.room,
        socketId: socket.id,
      };

      // Store message
      if (!messageStore[user.room]) messageStore[user.room] = [];
      messageStore[user.room].push(msg);
      if (messageStore[user.room].length > MAX_MESSAGES) {
        messageStore[user.room].shift();
      }

      // Broadcast to room
      io.to(user.room).emit('new-message', msg);
    });

    // ── Typing Indicator ──
    socket.on('typing', (isTyping) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      socket.to(user.room).emit('user-typing', { username: user.username, isTyping });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        // System message
        io.to(user.room).emit('new-message', {
          id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'system',
          text: `${user.username} left the chat`,
          timestamp: Date.now(),
          room: user.room,
        });

        connectedUsers.delete(socket.id);

        io.to(user.room).emit('user-list', getUsersInRoom(user.room));
        io.emit('room-counts', getRoomCounts());
      }
      console.log(`[ChatBox] Disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initChatSocket, ROOMS };
