/* ============================================
   PBG Manga — Backend API & Proxy Router
   Powered by StreameX Manga Architecture
   ============================================ */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const STREAMEX_BASE = 'https://streamex.hn';

// ── HTTP Client with realistic headers ──
const client = axios.create({
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `${STREAMEX_BASE}/manga`,
  }
});

// ── Simple In-Memory Cache with TTL ──
const cache = new Map();
const TTL = {
  CATALOG: 10 * 60 * 1000,   // 10 minutes for trending/popular/top-rated/newest
  SEARCH: 5 * 60 * 1000,     // 5 minutes for search queries
  INFO: 30 * 60 * 1000,      // 30 minutes for manga info
  CHAPTERS: 15 * 60 * 1000,  // 15 minutes for chapters list
  PAGES: 60 * 60 * 1000,     // 1 hour for chapter pages
};

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs) {
  // Prune cache if it grows beyond 500 items
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expires) cache.delete(k);
    }
  }
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ── Image Proxy (bypasses CORS & hotlink blocking) ──
router.get('/img', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    // First try fetching directly with permissive Referer
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://readdetectiveconan.com/',
        },
        timeout: 10000,
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(response.data);
    } catch (directErr) {
      // Fallback: proxy via StreameX manga-image proxy
      const fallbackUrl = `${STREAMEX_BASE}/api/manga-image?url=${encodeURIComponent(url)}`;
      const fbResponse = await axios.get(fallbackUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `${STREAMEX_BASE}/manga`,
        },
        timeout: 10000,
      });

      const contentType = fbResponse.headers['content-type'] || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(fbResponse.data);
    }
  } catch (err) {
    console.error('Manga image proxy error:', err.message);
    res.status(404).send('Image could not be retrieved');
  }
});

// ── Trending Manga ──
router.get('/trending', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const cacheKey = `trending_page_${page}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/trending?page=${page}`);
    setCache(cacheKey, response.data, TTL.CATALOG);
    res.json(response.data);
  } catch (err) {
    console.error('Trending manga error:', err.message);
    res.status(500).json({ error: 'Failed to fetch trending manga', results: [] });
  }
});

// ── Most Popular Manga ──
router.get('/popular', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const cacheKey = `popular_page_${page}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/popular?page=${page}`);
    setCache(cacheKey, response.data, TTL.CATALOG);
    res.json(response.data);
  } catch (err) {
    console.error('Popular manga error:', err.message);
    res.status(500).json({ error: 'Failed to fetch popular manga', results: [] });
  }
});

// ── Top Rated Manga ──
router.get('/top-rated', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const cacheKey = `top_rated_page_${page}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/top-rated?page=${page}`);
    setCache(cacheKey, response.data, TTL.CATALOG);
    res.json(response.data);
  } catch (err) {
    console.error('Top-rated manga error:', err.message);
    res.status(500).json({ error: 'Failed to fetch top rated manga', results: [] });
  }
});

// ── Newest Releases ──
router.get('/newest', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const cacheKey = `newest_page_${page}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/newest?page=${page}`);
    setCache(cacheKey, response.data, TTL.CATALOG);
    res.json(response.data);
  } catch (err) {
    console.error('Newest manga error:', err.message);
    res.status(500).json({ error: 'Failed to fetch newest manga', results: [] });
  }
});

// ── Search Manga ──
router.get('/search', async (req, res) => {
  const query = (req.query.q || req.query.query || '').trim();
  const page = parseInt(req.query.page, 10) || 1;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required', results: [] });
  }

  const cacheKey = `search_${query.toLowerCase()}_page_${page}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/search`, {
      params: { query, page }
    });
    setCache(cacheKey, response.data, TTL.SEARCH);
    res.json(response.data);
  } catch (err) {
    console.error('Search manga error:', err.message);
    res.status(500).json({ error: 'Failed to search manga', results: [] });
  }
});

// ── Manga Info / Metadata ──
router.get('/info/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Manga ID is required' });

  const cacheKey = `info_${id}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/info/${encodeURIComponent(id)}`);
    setCache(cacheKey, response.data, TTL.INFO);
    res.json(response.data);
  } catch (err) {
    console.error(`Manga info error (${id}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch manga info' });
  }
});

// ── Manga Chapters List ──
router.get('/chapters/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Manga ID is required' });

  const cacheKey = `chapters_${id}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/chapters`, {
      params: { id }
    });
    setCache(cacheKey, response.data, TTL.CHAPTERS);
    res.json(response.data);
  } catch (err) {
    console.error(`Manga chapters error (${id}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch manga chapters', chapters: [] });
  }
});

// ── Manga Chapter Pages ──
router.get('/pages', async (req, res) => {
  const chapterId = (req.query.chapterId || '').trim();
  if (!chapterId) return res.status(400).json({ error: 'chapterId query parameter is required' });

  const cacheKey = `pages_${chapterId}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await client.get(`${STREAMEX_BASE}/api/manga/pages`, {
      params: { chapterId }
    });
    setCache(cacheKey, response.data, TTL.PAGES);
    res.json(response.data);
  } catch (err) {
    console.error(`Manga pages error (${chapterId}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch chapter pages', pages: [] });
  }
});

module.exports = router;
