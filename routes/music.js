const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const router = express.Router();

// ── SSRF Disallowed Host Protection Helper ──
function isDisallowedHost(hostname) {
  const lower = (hostname || '').toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '0.0.0.0' || lower === '::1') return true;
  // Match private IPv4: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x (AWS/Cloud metadata)
  if (/^(10\.|192\.168\.|169\.254\.|127\.)/.test(lower)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal')) return true;
  return false;
}

// ── Music Live Radio Proxy Endpoint (SSRF Protected) ──
router.get('/radio-proxy', (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl) return res.status(400).send('Missing stream URL');

  let parsedUrl;
  try {
    parsedUrl = new URL(streamUrl);
  } catch {
    return res.status(400).send('Invalid stream URL');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).send('Invalid protocol. Only HTTP and HTTPS are allowed.');
  }

  if (isDisallowedHost(parsedUrl.hostname)) {
    return res.status(403).send('Forbidden stream target');
  }

  try {
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const proxyReq = client.get(parsedUrl.href, {
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

// Periodically clean up expired search results every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of ytSearchCache.entries()) {
    if (now - item.timestamp > YT_CACHE_TTL) ytSearchCache.delete(key);
  }
}, 10 * 60 * 1000).unref();

router.get('/search', async (req, res) => {
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

module.exports = router;
