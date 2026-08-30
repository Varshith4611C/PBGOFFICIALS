/* ============================================
   PBG ChatBox — Socket.IO Server
   ============================================ */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ── Custom Songs Persistence ──
const CUSTOM_SONGS_FILE = path.join(__dirname, 'custom_songs.json');

function loadCustomSongs() {
  try {
    if (fs.existsSync(CUSTOM_SONGS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_SONGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load custom songs:', e.message);
  }
  return [];
}

function saveCustomSongs(songs) {
  try {
    fs.writeFileSync(CUSTOM_SONGS_FILE, JSON.stringify(songs, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save custom songs:', e.message);
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const str = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

// ── Real 24/7 Live Web Radio Stations (Direct HTML5 Audio Streams — 100% Reliable & Real-Time Synced) ──
const RADIO_STATIONS = [
  { 
    id: 'lofi-radio', 
    title: 'Lofi Chillout Radio — 24/7 Ambient Beats', 
    artist: 'SomaFM Groove Salad', 
    tag: 'Lofi', 
    type: 'stream',
    streamUrl: '/api/music/radio-proxy?url=' + encodeURIComponent('https://ice1.somafm.com/groovesalad-128-mp3'),
    icon: '🎧'
  },
  { 
    id: 'anime-radio', 
    title: 'Anime & J-Melody Vocal Chill Radio', 
    artist: 'SomaFM Lush Chill', 
    tag: 'Anime', 
    type: 'stream',
    streamUrl: '/api/music/radio-proxy?url=' + encodeURIComponent('https://ice1.somafm.com/lush-128-mp3'),
    icon: '🎌'
  },
  { 
    id: 'synthwave-radio', 
    title: 'Synthwave & Vaporwave 80s Retro Radio', 
    artist: 'SomaFM Vaporwaves', 
    tag: 'Synthwave', 
    type: 'stream',
    streamUrl: '/api/music/radio-proxy?url=' + encodeURIComponent('https://ice1.somafm.com/vaporwaves-128-mp3'),
    icon: '🌆'
  },
  { 
    id: 'gaming-radio', 
    title: 'DEF CON Gaming & Cyberpunk Radio', 
    artist: 'SomaFM DEF CON', 
    tag: 'Gaming', 
    type: 'stream',
    streamUrl: '/api/music/radio-proxy?url=' + encodeURIComponent('https://ice1.somafm.com/defcon-128-mp3'),
    icon: '🎮'
  },
  { 
    id: 'chillhop-radio', 
    title: 'Vintage Cafe, Lounge & Jazzy Beats', 
    artist: 'SomaFM Secret Agent', 
    tag: 'Chillhop', 
    type: 'stream',
    streamUrl: '/api/music/radio-proxy?url=' + encodeURIComponent('https://ice1.somafm.com/secretagent-128-mp3'),
    icon: '☕'
  },
  { 
    id: 'edm-radio', 
    title: 'Beat Blender Club & High Energy EDM', 
    artist: 'SomaFM Beat Blender', 
    tag: 'EDM', 
    type: 'stream',
    streamUrl: '/api/music/radio-proxy?url=' + encodeURIComponent('https://ice1.somafm.com/beatblender-128-mp3'),
    icon: '⚡'
  },
  { 
    id: 'relax-radio', 
    title: 'Deep Focus & Atmospheric Soundscapes', 
    artist: 'SomaFM Drone Zone', 
    tag: 'Ambient', 
    type: 'stream',
    streamUrl: '/api/music/radio-proxy?url=' + encodeURIComponent('https://ice1.somafm.com/dronezone-128-mp3'),
    icon: '🌌'
  },
];

// ── Curated Library Tracks (Verified 200 OK Embeddable Hits) ──
const MUSIC_LIBRARY = [
  // Anime Hits
  { id: 'lib-idol', title: 'Idol (Oshi no Ko OP)', artist: 'YOASOBI', category: 'Anime Hits', videoId: 'ZRtdQ81jPUQ', type: 'youtube' },
  { id: 'lib-kickback', title: 'KICK BACK (Chainsaw Man OP)', artist: 'Kenshi Yonezu', category: 'Anime Hits', videoId: 'M2cckDmNLMI', type: 'youtube' },
  { id: 'lib-peacesign', title: 'Peace Sign (My Hero Academia OP)', artist: 'Kenshi Yonezu', category: 'Anime Hits', videoId: '9aJVr5tTTWk', type: 'youtube' },
  { id: 'lib-crybaby', title: 'Cry Baby (Tokyo Revengers OP)', artist: 'Official HIGE DANdism', category: 'Anime Hits', videoId: 'O1bhZgkC4Gw', type: 'youtube' },
  { id: 'lib-shinzou', title: 'Shinzou wo Sasageyo! (Attack on Titan OP 2)', artist: 'Linked Horizon', category: 'Anime Hits', videoId: 'CID-sYQNCew', type: 'youtube' },
  { id: 'lib-sparkle', title: 'Sparkle (Your Name / Kimi no Na wa OST)', artist: 'RADWIMPS', category: 'Anime Hits', videoId: 'a2GujJZfXpg', type: 'youtube' },
  { id: 'lib-yoru', title: 'Yoru ni Kakeru (Racing into the Night)', artist: 'YOASOBI', category: 'Anime Hits', videoId: 'x8VYWazR5mE', type: 'youtube' },
  { id: 'lib-silhouette', title: 'Silhouette (Naruto Shippuden OP 16)', artist: 'KANA-BOON', category: 'Anime Hits', videoId: 'dlFA0Zq1k2A', type: 'youtube' },
  { id: 'lib-unravel', title: 'Unravel (Tokyo Ghoul OP)', artist: 'TK from Ling Tosite Sigure', category: 'Anime Hits', videoId: '7aMOurgDB-o', type: 'youtube' },
  
  // Lofi & Chill
  { id: 'lib-lofi-1', title: 'Lofi Hip Hop Radio — Beats to Relax/Study', artist: 'Lofi Girl', category: 'Lo-Fi Chill', videoId: '5qap5aO4i9A', type: 'youtube' },
  { id: 'lib-lofi-2', title: 'Cozy Coffee Shop & Jazzy Piano Lofi', artist: 'Cafe Chill Music', category: 'Lo-Fi Chill', videoId: 'lTRiuFIWV54', type: 'youtube' },
  { id: 'lib-lofi-3', title: 'Midnight Chill Beats for Study & Sleep', artist: 'Dreamy Lofi', category: 'Lo-Fi Chill', videoId: 'rUxyKA_-grg', type: 'youtube' },
  { id: 'lib-lofi-4', title: 'ChilledCow / Lofi Cafe Chill Beats', artist: 'Lofi Records', category: 'Lo-Fi Chill', videoId: 'DWcJFNfaw9c', type: 'youtube' },
  
  // Gaming & Synthwave
  { id: 'lib-synth-1', title: 'Overdrive — Synthwave / Retrowave Beats', artist: 'Lazerhawk', category: 'Gaming & Synth', videoId: '4xDzrJKXOOY', type: 'youtube' },
];

let customSongs = loadCustomSongs();

// Pre-defined chat rooms
const ROOMS = [
  { id: 'general',       name: 'General',        icon: '💬', description: 'Hang out, share links, and talk about anything',       features: [] },
  { id: 'anime-manga',   name: 'Anime & Manga',  icon: '🎌', description: 'Watch anime together in cinema mode & live chat',     features: ['watch-together'] },
  { id: 'gaming',        name: 'Gaming',          icon: '🎮', description: 'LFG, discuss games, share clips, and tournaments',     features: [] },
  { id: 'music',         name: 'Music',           icon: '🎵', description: '24/7 Live Radio Stations, Music Library & Shared Beats', features: ['listen-together'] },
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
    id: RADIO_STATIONS[0].id,
    title: RADIO_STATIONS[0].title,
    artist: RADIO_STATIONS[0].artist,
    tag: RADIO_STATIONS[0].tag,
    type: RADIO_STATIONS[0].type,
    streamUrl: RADIO_STATIONS[0].streamUrl,
    addedBy: 'PBG Radio 24/7',
  },
  stations: RADIO_STATIONS,
  library: [...customSongs, ...MUSIC_LIBRARY],
  queue: [],
  isPlaying: true,
  startedAt: Date.now(),
  pausedAt: 0,
};

// ── Anime Room State ──
const animeState = {
  currentAnime: null,   // { animeId, title, image, episodeId, episodeNumber, embedUrl }
  isActive: false,
  isPlaying: true,      // synchronized watch party play/pause state
  startedBy: null,      // username who started the session
  startedAt: 0,
  pausedAt: 0,
  updatedAt: 0,
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
  if (!username) return '??';
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
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

    // ═══════════════════════════════════════════════════════════════
    //  MUSIC ROOM — 24/7 Live Radio Stations & Synchronized Audio
    // ═══════════════════════════════════════════════════════════════

    // Play a live radio station
    socket.on('music-play-station', (stationId) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music') return;

      const station = RADIO_STATIONS.find(s => s.id === stationId);
      if (!station) return;

      musicState.currentTrack = {
        id: station.id,
        title: station.title,
        artist: station.artist,
        tag: station.tag,
        type: 'stream',
        streamUrl: station.streamUrl,
        addedBy: user.username,
      };
      musicState.isPlaying = true;
      musicState.startedAt = Date.now();
      musicState.pausedAt = 0;

      io.to('music').emit('music-state', musicState);

      io.to('music').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `📻 ${user.username} tuned the room to: ${station.title}`,
        timestamp: Date.now(),
        room: 'music',
      });
    });

    // Play a library track (YouTube or Stream)
    socket.on('music-play-library', (trackId) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music') return;

      const track = (musicState.library || []).find(t => t.id === trackId);
      if (!track) return;

      musicState.currentTrack = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        tag: track.category,
        type: 'youtube',
        videoId: track.videoId,
        addedBy: user.username,
      };
      musicState.isPlaying = true;
      musicState.startedAt = Date.now();
      musicState.pausedAt = 0;

      io.to('music').emit('music-state', musicState);

      io.to('music').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `🎵 ${user.username} selected from library: ${track.title}`,
        timestamp: Date.now(),
        room: 'music',
      });
    });

    // Add a custom music track via URL to queue/play
    socket.on('music-add', ({ videoId, url, title, artist }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'music') return;

      const vid = videoId ? videoId.trim() : extractYouTubeId(url);
      if (!vid) {
        return socket.emit('music-error', { message: 'Invalid YouTube URL or video ID.' });
      }

      const track = {
        id: `custom-${Date.now()}`,
        videoId: vid,
        title: (title || 'Shared Music Track').slice(0, 200),
        artist: (artist || 'Custom Audio').slice(0, 100),
        type: 'youtube',
        addedBy: user.username,
      };

      if (!musicState.currentTrack || !musicState.isPlaying) {
        musicState.currentTrack = track;
        musicState.isPlaying = true;
        musicState.startedAt = Date.now();
        musicState.pausedAt = 0;
        io.to('music').emit('music-state', musicState);

        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `🎵 ${user.username} started playing: ${track.title}`,
          timestamp: Date.now(),
          room: 'music',
        });
      } else {
        musicState.queue.push(track);
        io.to('music').emit('music-state', musicState);

        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `🎵 ${user.username} queued: ${track.title}`,
          timestamp: Date.now(),
          room: 'music',
        });
      }
    });

    // Add and permanently store a custom song in the Music Library
    socket.on('music-add-library', ({ title, artist, category, youtubeUrl }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const videoId = extractYouTubeId(youtubeUrl);
      if (!videoId) {
        return socket.emit('music-error', { message: 'Please provide a valid YouTube URL (e.g. youtube.com/watch?v=... or youtu.be/...)' });
      }

      const cleanTitle = (title || 'Community Track').trim().slice(0, 150);
      const cleanArtist = (artist || user.username || 'Community').trim().slice(0, 80);
      const cleanCategory = (category || 'Community Custom').trim();

      const newSong = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        artist: cleanArtist,
        category: cleanCategory,
        videoId: videoId,
        type: 'youtube',
        addedBy: user.username,
        createdAt: Date.now(),
        custom: true,
      };

      customSongs.unshift(newSong);
      saveCustomSongs(customSongs);
      musicState.library = [...customSongs, ...MUSIC_LIBRARY];

      io.emit('music-state', musicState);

      io.to('music').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `✨ ${user.username} stored a new song in the Library: "${cleanTitle}" by ${cleanArtist}`,
        timestamp: Date.now(),
        room: 'music',
      });
    });

    // Remove a custom song from the Music Library
    socket.on('music-remove-library', ({ id }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || !id) return;

      const index = customSongs.findIndex(s => s.id === id);
      if (index !== -1) {
        const removed = customSongs.splice(index, 1)[0];
        saveCustomSongs(customSongs);
        musicState.library = [...customSongs, ...MUSIC_LIBRARY];
        io.emit('music-state', musicState);

        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `🗑️ ${user.username} removed "${removed.title}" from the Library`,
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
        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `⏸️ ${user.username} paused the music`,
          timestamp: Date.now(),
          room: 'music',
        });
      } else {
        musicState.startedAt = Date.now() - (musicState.pausedAt * 1000);
        musicState.isPlaying = true;
        io.to('music').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `▶️ ${user.username} resumed the music`,
          timestamp: Date.now(),
          room: 'music',
        });
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
        // Cycle to next station
        const currentIdx = RADIO_STATIONS.findIndex(s => s.id === musicState.currentTrack?.id);
        const nextStation = RADIO_STATIONS[(currentIdx + 1) % RADIO_STATIONS.length];
        musicState.currentTrack = {
          id: nextStation.id,
          title: nextStation.title,
          artist: nextStation.artist,
          tag: nextStation.tag,
          type: 'stream',
          streamUrl: nextStation.streamUrl,
          addedBy: 'PBG Radio 24/7',
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

    // ═══════════════════════════════════════════════════════════════
    //  ANIME ROOM — Watch Together Synchronized State & Playback Actions
    // ═══════════════════════════════════════════════════════════════

    function formatMediaTime(sec) {
      if (!sec || isNaN(sec)) return '0:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Start watching an anime episode
    socket.on('anime-watch', ({ animeId, title, image, episodeId, episodeNumber, directStream, directStreamUrl, subtitles, embedUrl }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'anime-manga') return;

      animeState.currentAnime = {
        animeId: animeId || '',
        title: (title || 'Unknown Anime').slice(0, 200),
        image: image || '',
        episodeId: episodeId || '',
        episodeNumber: episodeNumber || 1,
        directStream: directStreamUrl || directStream || null,
        directStreamUrl: directStreamUrl || directStream || null,
        subtitles: subtitles || [],
        embedUrl: embedUrl || '',
      };
      animeState.isActive = true;
      animeState.isPlaying = true;
      animeState.currentTime = 0;
      animeState.startedBy = user.username;
      animeState.startedAt = Date.now();
      animeState.pausedAt = 0;
      animeState.updatedAt = Date.now();

      io.to('anime-manga').emit('anime-state', animeState);

      io.to('anime-manga').emit('new-message', {
        id: makeId('sys'),
        type: 'system',
        text: `🎌 ${user.username} started watch party: ${animeState.currentAnime.title} — Episode ${episodeNumber}`,
        timestamp: Date.now(),
        room: 'anime-manga',
      });
    });

    // Real-Time Synchronized Video Playback Action (Play / Pause / Seek / Time-Sync)
    socket.on('anime-action', ({ action, currentTime }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'anime-manga' || !animeState.isActive) return;

      const time = Math.max(0, parseFloat(currentTime) || 0);
      animeState.currentTime = time;
      animeState.updatedAt = Date.now();

      if (action === 'pause') {
        animeState.isPlaying = false;
        animeState.pausedAt = time;
        io.to('anime-manga').emit('anime-action', { action: 'pause', currentTime: time, username: user.username });
        io.to('anime-manga').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `⏸️ ${user.username} paused the video at ${formatMediaTime(time)}`,
          timestamp: Date.now(),
          room: 'anime-manga',
        });
      } else if (action === 'play') {
        animeState.isPlaying = true;
        animeState.startedAt = Date.now() - (time * 1000);
        io.to('anime-manga').emit('anime-action', { action: 'play', currentTime: time, username: user.username });
        io.to('anime-manga').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `▶️ ${user.username} resumed the video at ${formatMediaTime(time)}`,
          timestamp: Date.now(),
          room: 'anime-manga',
        });
      } else if (action === 'seek') {
        if (animeState.isPlaying) {
          animeState.startedAt = Date.now() - (time * 1000);
        } else {
          animeState.pausedAt = time;
        }
        io.to('anime-manga').emit('anime-action', { action: 'seek', currentTime: time, username: user.username });
        io.to('anime-manga').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `⏩ ${user.username} jumped to ${formatMediaTime(time)}`,
          timestamp: Date.now(),
          room: 'anime-manga',
        });
      }
    });

    // Toggle Anime Watch Party Play/Pause (Header button fallback)
    socket.on('anime-toggle-play', () => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'anime-manga' || !animeState.isActive) return;

      if (animeState.isPlaying) {
        animeState.pausedAt = animeState.currentTime || 0;
        animeState.isPlaying = false;
        io.to('anime-manga').emit('anime-action', { action: 'pause', currentTime: animeState.pausedAt, username: user.username });
        io.to('anime-manga').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `⏸️ ${user.username} paused the anime watch party`,
          timestamp: Date.now(),
          room: 'anime-manga',
        });
      } else {
        animeState.startedAt = Date.now() - (animeState.pausedAt * 1000);
        animeState.isPlaying = true;
        io.to('anime-manga').emit('anime-action', { action: 'play', currentTime: animeState.pausedAt, username: user.username });
        io.to('anime-manga').emit('new-message', {
          id: makeId('sys'),
          type: 'system',
          text: `▶️ ${user.username} resumed the anime watch party`,
          timestamp: Date.now(),
          room: 'anime-manga',
        });
      }
      animeState.updatedAt = Date.now();
      io.to('anime-manga').emit('anime-state', animeState);
    });

    // Change episode
    socket.on('anime-episode', ({ episodeId, episodeNumber, directStream, directStreamUrl, subtitles, embedUrl }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || user.room !== 'anime-manga' || !animeState.isActive) return;

      animeState.currentAnime.episodeId = episodeId || '';
      animeState.currentAnime.episodeNumber = episodeNumber || 1;
      animeState.currentAnime.directStream = directStreamUrl || directStream || null;
      animeState.currentAnime.directStreamUrl = directStreamUrl || directStream || null;
      animeState.currentAnime.subtitles = subtitles || [];
      animeState.currentAnime.embedUrl = embedUrl || '';
      animeState.isPlaying = true;
      animeState.currentTime = 0;
      animeState.startedAt = Date.now();
      animeState.pausedAt = 0;
      animeState.updatedAt = Date.now();

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
      animeState.isPlaying = true;
      animeState.startedBy = null;
      animeState.startedAt = 0;
      animeState.pausedAt = 0;
      animeState.updatedAt = Date.now();

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
