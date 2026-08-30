const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initChatSocket } = require('./chatbox/api');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

// ── SEO & Security headers ──
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Serve all static files (HTML, CSS, JS, images) from the project root ──
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],          // allows visiting /about → about.html
  index: 'index.html',           // default file for "/"
  dotfiles: 'allow',             // serve .well-known directory
}));

// ── Serve assets folder explicitly ──
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Serve .well-known directory explicitly ──
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

// ── Anime API routes ──
const animeApi = require('./anime/api');
app.use('/api/anime', animeApi);

// ── Serve anime frontend ──
app.use('/anime', express.static(path.join(__dirname, 'anime'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── Serve chatbox frontend ──
app.use('/chatbox', express.static(path.join(__dirname, 'chatbox'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── Initialize Socket.IO for ChatBox ──
initChatSocket(io);

// ── Fallback: send index.html for any unmatched route (SPA-friendly) ──
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──
httpServer.listen(PORT, () => {
  console.log(`\n  ⚡ PBG Officials server running at:\n`);
  console.log(`     Local:   http://localhost:${PORT}`);
  console.log(`     Network: http://0.0.0.0:${PORT}\n`);
});
