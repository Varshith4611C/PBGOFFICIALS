const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const axios = require('axios');
const http = require('http');
const { createServer } = http;
const { Server } = require('socket.io');

// ── Load .env file at startup before other modules ──
if (fs.existsSync(path.join(__dirname, '.env'))) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    });
  } catch (e) {
    console.warn('Could not read .env file:', e.message);
  }
}

const { initChatSocket } = require('./chatbox/api');
const { initGameSocket } = require('./games/business-board/api');
const { initCubesSocket } = require('./games/cubes-2048/api');
const fridayApi = require('./friday/api');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Initialize HTTPS server if certificates exist (enables mobile screen sharing & camera)
let httpsServer = null;
const keyPath = path.join(__dirname, 'certs', 'key.pem');
const certPath = path.join(__dirname, 'certs', 'cert.pem');
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);
    httpsServer = https.createServer({ key, cert }, app);
    io.attach(httpsServer);
  } catch (err) {
    console.warn('[HTTPS] Could not initialize HTTPS server:', err.message);
  }
}

// ── SEO & Security headers ──
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=()');
  next();
});

// ── Strict Barrier: Block direct access to sensitive files and backend internals ──
const SENSITIVE_PATTERNS = [
  /^\/certs(\/|$)/i,
  /^\/routes(\/|$)/i,
  /^\/\.env/i,
  /^\/package(-lock)?\.json$/i,
  /^\/server\.js$/i,
  /^\/wrangler\.jsonc?$/i,
  /^\/mail\/worker(\/|$)/i,
  /^\/games\/bussiness-game(\/|$)/i,
  /\.(pem|key|cert|sql|env|bak)$/i
];

app.use((req, res, next) => {
  const p = req.path;
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(p)) {
      return res.status(403).send('Access denied');
    }
  }
  next();
});

// ── Body Parser ──
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Modular API Routes (Mounted before static serving) ──
app.use('/api/contact', require('./routes/contact'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/music', require('./routes/music'));
app.use('/api/anime', require('./anime/api'));
app.use('/api/manga', require('./manga/api'));

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

// ── Serve games frontend ──
app.use('/games', express.static(path.join(__dirname, 'games'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── PBG Friday (frAIday AI Workspace) ──
app.use('/api/friday', fridayApi);
app.use('/friday/workspace', express.static(path.join(__dirname, 'friday', 'workspace')));
app.use('/friday', express.static(path.join(__dirname, 'friday'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── Serve manga route rewrites (StreameX-compatible paths) ──
app.get('/manga/read/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'manga', 'read.html'));
});

app.get('/manga/:id', (req, res, next) => {
  // If it's a file with an extension like .css, .js, .html, let static handler serve it
  if (req.params.id.includes('.')) return next();
  res.sendFile(path.join(__dirname, 'manga', 'detail.html'));
});

// ── Serve manga frontend ──
app.use('/manga', express.static(path.join(__dirname, 'manga'), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── Serve static assets from project root (index.html, style.css, script.js, icons) ──
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index: 'index.html',
  dotfiles: 'ignore',
}));

// ── Serve assets folder explicitly ──
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Serve .well-known directory explicitly ──
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

// ── Initialize Socket.IO for ChatBox ──
initChatSocket(io);

// ── Initialize Socket.IO for Business Board Game ──
initGameSocket(io);

// ── Initialize Socket.IO for Cubes 2048 ──
initCubesSocket(io);


// ── Fallback: send index.html for any unmatched route (SPA-friendly) ──
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──
const os = require('os');
const mdns = require('multicast-dns')();

// Get local network IP
function getNetworkIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '0.0.0.0';
}

const networkIP = getNetworkIP();

// Handle mDNS errors gracefully
mdns.on('error', (err) => {
  console.warn('[mDNS Error]:', err && err.message ? err.message : err);
});

// Respond to mDNS queries for "pbg.local"
mdns.on('query', (query) => {
  const dominated = query.questions.filter(q =>
    q.name === 'pbg.local' && q.type === 'A'
  );
  if (dominated.length > 0) {
    mdns.respond({
      answers: [{
        name: 'pbg.local',
        type: 'A',
        ttl: 300,
        data: networkIP
      }]
    });
  }
});

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
});

httpServer.listen(PORT, () => {
  console.log(`\n  ⚡ PBG Officials server running at:\n`);
  console.log(`     HTTP Local:   http://localhost:${PORT}`);
  console.log(`     HTTP Network: http://${networkIP}:${PORT}`);
  console.log(`     mDNS:         http://pbg.local:${PORT}  ← use this!`);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`\n  🔒 Secure Context HTTPS (Required for Mobile Screen Share & Camera):\n`);
    console.log(`     HTTPS Local:   https://localhost:${HTTPS_PORT}`);
    console.log(`     HTTPS Network: https://${networkIP}:${HTTPS_PORT}\n`);
  });
}

