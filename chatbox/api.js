/* ============================================
   PBG ChatBox — Socket.IO Server
   ============================================ */

const axios = require('axios');

// Curated Music Stations (Music Room) — Audio-first streams
const MUSIC_STATIONS = [
  { id: 'lofi', title: 'Lofi Girl — Beats to Relax & Study to', artist: 'Lofi Hip Hop Live', videoId: 'jfKfPfyJRdk', tag: 'Lofi' },
  { id: 'anime', title: 'Anime OST Hits & Relaxing Piano Chill', artist: 'Anime Melodies', videoId: 'e24gBf52d0U', tag: 'Anime' },
  { id: 'synthwave', title: 'Synthwave Radio — Chill 80s Retro Beats', artist: 'Lofi Synth Vibes', videoId: '4xDzrJKXOOY', tag: 'Synthwave' },
  { id: 'chillhop', title: 'Chillhop Cafe — Jazzy & Cozy Instrumentals', artist: 'Chillhop Music', videoId: '5yx6BWlEVcY', tag: 'Chillhop' },
  { id: 'gaming', title: 'Gaming Music Mix — NCS & EDM Energy', artist: 'PBG Gaming Beats', videoId: 'yJg-Y5byMMw', tag: 'Gaming' },
];

// Pre-defined chat rooms
const ROOMS = [
  { id: 'general',       name: 'General',        icon: '💬', description: 'Hang out, share links, and talk about anything',       features: [] },
  { id: 'anime-manga',   name: 'Anime & Manga',  icon: '🎌', description: 'Watch anime together in cinema mode & live chat',     features: ['watch-together'] },
  { id: 'gaming',        name: 'Gaming',          icon: '🎮', description: 'LFG, discuss games, share clips, and tournaments',     features: [] },
  { id: 'music',         name: 'Music',           icon: '🎵', description: 'Listen to music together with live audio deck & chat', features: ['listen-together'] },
  { id: 'off-topic',     name: 'Off-Topic',       icon: '🌀', description: 'Memes, random chats, and whatever\'s on your mind',    features: [] },
];

// In-memory message store (last 50 per room)
const MAX_MESSAGES = 50;
const messageStore = {};
ROOMS.forEach(r => { messageStore[r.id] = []; });

// Track connected users: socketId → { username, avatar, color, room }
const connectedUsers = new Map();

// ── Music Room State ──
const musicState = {
  currentTrack: {
    videoId: MUSIC_STATIONS[0].videoId,
    title: MUSIC_STATIONS[0].title,
    artist: MUSIC_STATIONS[0].artist,
    addedBy: 'PBG Radio',
    tag: MUSIC_STATIONS[0].tag,
  },
  stations: MUSIC_STATIONS,
  queue: [],            // array of { videoId, title, artist, addedBy }
  isPlaying: true,
  startedAt: Date.now(),// timestamp when play started
  pausedAt: 0,          // seconds elapsed when paused
};

// ── Anime Room State ──
const animeState = {
  currentAnime: null,   // { animeId, title, image, episodeId, episodeNumber, embedUrl }
  isActive: false,
  startedBy: null,      // username who started the session
};

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

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
      io.to(targetRoom).emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `${username} joined the chat`,
        timestamp: Date.now(),
        room: targetRoom,
      });

      // Send room-specific state to the new joiner
      if (targetRoom === 'music') {
        socket.emit('music-state', musicState);
      } else if (targetRoom === 'anime-manga') {
        socket.emit('anime-state', animeState);
      }
    });

    // ── Switch Room ──
    socket.on('switch-room', (newRoom) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const oldRoom = user.room;
      socket.leave(oldRoom);

      // System message in old room
      io.to(oldRoom).emit('new-message', {
        id: makeId('sys'),
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
        id: makeId('sys'),
        type: 'system',
        text: `${user.username} joined the room`,
        timestamp: Date.now(),
        room: newRoom,
      });
      io.to(newRoom).emit('user-list', getUsersInRoom(newRoom));

      // Broadcast updated room counts
      io.emit('room-counts', getRoomCounts());

      // Send room-specific state
      if (newRoom === 'music') {
        socket.emit('music-state', musicState);
      } else if (newRoom === 'anime-manga') {
        socket.emit('anime-state', animeState);
      }
    });

    // ── Send Message (with optional reply) ──
    socket.on('send-message', ({ text, replyTo }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || !text || typeof text !== 'string') return;

      const sanitized = text.trim().slice(0, 1000);
      if (!sanitized) return;

      const msg = {
        id: makeId('msg'),
        type: 'user',
        username: user.username,
        initials: getInitials(user.username),
        color: user.color,
        text: sanitized,
        timestamp: Date.now(),
        room: user.room,
        socketId: socket.id,
      };

      // Attach reply reference if provided
      if (replyTo && replyTo.id && replyTo.username && replyTo.text) {
        msg.replyTo = {
          id: replyTo.id,
          username: replyTo.username,
          text: replyTo.text.slice(0, 100),
          color: replyTo.color || '#94a3b8',
        };
      }

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

    // ═══════════════════════════════════════
    //  MUSIC ROOM — Listen Together (Music-Only)
    // ═══════════════════════════════════════

    // Play a preset music station
    socket.on('music-play-station', (stationId) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music') return;

      const station = MUSIC_STATIONS.find(s => s.id === stationId);
      if (!station) return;

      musicState.currentTrack = {
        videoId: station.videoId,
        title: station.title,
        artist: station.artist,
        addedBy: user.username,
        tag: station.tag,
      };
      musicState.isPlaying = true;
      musicState.startedAt = Date.now();
      musicState.pausedAt = 0;

      io.to('music').emit('music-state', musicState);

      io.to('music').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `🎵 ${user.username} tuned into station: ${station.title}`,
        timestamp: Date.now(),
        room: 'music',
      });
    });

    // Add a custom music track
    socket.on('music-add', ({ videoId, title, artist }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music') return;
      if (!videoId || typeof videoId !== 'string') return;

      const track = {
        videoId: videoId.trim(),
        title: (title || 'Music Track').slice(0, 200),
        artist: (artist || 'Audio').slice(0, 100),
        addedBy: user.username,
      };

      if (!musicState.currentTrack) {
        musicState.currentTrack = track;
        musicState.isPlaying = true;
        musicState.startedAt = Date.now();
        musicState.pausedAt = 0;
        io.to('music').emit('music-state', musicState);

        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `🎵 ${user.username} started playing music: ${track.title}`,
          timestamp: Date.now(),
          room: 'music',
        });
      } else {
        musicState.queue.push(track);
        io.to('music').emit('music-state', musicState);

        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `🎵 ${user.username} queued music: ${track.title}`,
          timestamp: Date.now(),
          room: 'music',
        });
      }
    });

    // Play / Pause toggle
    socket.on('music-toggle', () => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music' || !musicState.currentTrack) return;

      if (musicState.isPlaying) {
        musicState.pausedAt = (Date.now() - musicState.startedAt) / 1000;
        musicState.isPlaying = false;
      } else {
        musicState.startedAt = Date.now() - (musicState.pausedAt * 1000);
        musicState.isPlaying = true;
      }
      io.to('music').emit('music-state', musicState);
    });

    // Skip track
    socket.on('music-skip', () => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music') return;

      if (musicState.queue.length > 0) {
        musicState.currentTrack = musicState.queue.shift();
        musicState.isPlaying = true;
        musicState.startedAt = Date.now();
        musicState.pausedAt = 0;

        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `🎵 Now playing: ${musicState.currentTrack.title}`,
          timestamp: Date.now(),
          room: 'music',
        });
      } else {
        // Loop or switch to next preset station
        const currentIdx = MUSIC_STATIONS.findIndex(s => s.videoId === musicState.currentTrack?.videoId);
        const nextStation = MUSIC_STATIONS[(currentIdx + 1) % MUSIC_STATIONS.length];
        musicState.currentTrack = {
          videoId: nextStation.videoId,
          title: nextStation.title,
          artist: nextStation.artist,
          addedBy: 'PBG Radio',
          tag: nextStation.tag,
        };
        musicState.isPlaying = true;
        musicState.startedAt = Date.now();
        musicState.pausedAt = 0;
      }
      io.to('music').emit('music-state', musicState);
    });

    // Remove from queue
    socket.on('music-remove', (index) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music') return;
      if (typeof index === 'number' && index >= 0 && index < musicState.queue.length) {
        musicState.queue.splice(index, 1);
        io.to('music').emit('music-state', musicState);
      }
    });

    // ═══════════════════════════════════════
    //  ANIME ROOM — Watch Together
    // ═══════════════════════════════════════

    // Start watching an anime episode
    socket.on('anime-watch', ({ animeId, title, image, episodeId, episodeNumber, embedUrl }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'anime-manga') return;

      animeState.currentAnime = {
        animeId: animeId || '',
        title: (title || 'Unknown').slice(0, 200),
        image: image || '',
        episodeId: episodeId || '',
        episodeNumber: episodeNumber || 1,
        embedUrl: embedUrl || '',
      };
      animeState.isActive = true;
      animeState.startedBy = user.username;

      io.to('anime-manga').emit('anime-state', animeState);

      io.to('anime-manga').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `🎌 ${user.username} started watch party: ${animeState.currentAnime.title} — Episode ${episodeNumber}`,
        timestamp: Date.now(),
        room: 'anime-manga',
      });
    });

    // Change episode
    socket.on('anime-episode', ({ episodeId, episodeNumber, embedUrl }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'anime-manga' || !animeState.isActive) return;

      animeState.currentAnime.episodeId = episodeId || '';
      animeState.currentAnime.episodeNumber = episodeNumber || 1;
      animeState.currentAnime.embedUrl = embedUrl || '';

      io.to('anime-manga').emit('anime-state', animeState);

      io.to('anime-manga').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `🎌 ${user.username} switched to Episode ${episodeNumber}`,
        timestamp: Date.now(),
        room: 'anime-manga',
      });
    });

    // Stop watch party
    socket.on('anime-clear', () => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'anime-manga') return;

      animeState.currentAnime = null;
      animeState.isActive = false;
      animeState.startedBy = null;

      io.to('anime-manga').emit('anime-state', animeState);

      io.to('anime-manga').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `🎌 ${user.username} ended the anime watch party`,
        timestamp: Date.now(),
        room: 'anime-manga',
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        io.to(user.room).emit('new-message', {
          id: makeId('sys'),
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
