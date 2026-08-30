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

// ── Music Live Radio Proxy Endpoint ──
const http = require('http');
const https = require('https');
app.get('/api/music/radio-proxy', (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl) return res.status(400).send('Missing stream URL');

  try {
    const client = streamUrl.startsWith('https') ? https : http;
    const proxyReq = client.get(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Icy-MetaData': '0',
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).send('Proxy error: ' + err.message);
      }
    });

    req.on('close', () => {
      proxyReq.destroy();
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send('Proxy failure: ' + err.message);
    }
  }
});

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
