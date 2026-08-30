const express = require('express');
const path = require('path');
const axios = require('axios');
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

// ── YouTube Music Direct Search Endpoint ──
const ytSearchCache = new Map();
const YT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

app.get('/api/music/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json({ results: [] });

  const cacheKey = query.toLowerCase();
  const cached = ytSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < YT_CACHE_TTL) {
    return res.json({ results: cached.results });
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const searchRes = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000
    });

    const html = searchRes.data;
    let results = [];

    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        if (contents && Array.isArray(contents)) {
          for (const section of contents) {
            const items = section.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const vr = item.videoRenderer;
              if (vr && vr.videoId) {
                const thumbs = vr.thumbnail?.thumbnails || [];
                const bestThumb = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;
                results.push({
                  videoId: vr.videoId,
                  title: vr.title?.runs?.[0]?.text || vr.headline?.simpleText || 'YouTube Video',
                  artist: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || 'YouTube Creator',
                  thumbnail: bestThumb,
                  duration: vr.lengthText?.simpleText || '',
                  views: vr.shortViewCountText?.simpleText || '',
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('ytInitialData parse error:', e.message);
      }
    }

    if (results.length === 0) {
      const videoMatches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
      const seen = new Set();
      for (const vm of videoMatches) {
        const id = vm[1];
        if (!seen.has(id)) {
          seen.add(id);
          results.push({
            videoId: id,
            title: `YouTube Track (${id})`,
            artist: 'YouTube Audio',
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: '',
            views: '',
          });
        }
        if (results.length >= 12) break;
      }
    }

    const finalResults = results.slice(0, 20);
    ytSearchCache.set(cacheKey, { timestamp: Date.now(), results: finalResults });
    res.json({ results: finalResults });
  } catch (err) {
    console.error('YouTube search error:', err.message);
    res.status(500).json({ error: 'Search failed', results: [] });
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
