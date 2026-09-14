/* ============================================
   PBG Manga — Backend API & Proxy Router
   Powered by AniList GraphQL (Direct)
   ============================================ */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

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
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expires) cache.delete(k);
    }
  }
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ── AniList GraphQL Query Helper ──
async function queryAniList(query, variables = {}) {
  const response = await axios.post(ANILIST_GRAPHQL, { query, variables }, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 15000,
  });
  return response.data?.data;
}

// ── Common Manga GraphQL Fragment ──
const MANGA_FIELDS = `
  id
  title { romaji english native }
  coverImage { medium large extraLarge }
  bannerImage
  description
  chapters
  volumes
  status
  genres
  averageScore
  popularity
  format
  startDate { year month day }
`;

const MANGA_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $search: String, $genre: String, $status: MediaStatus, $format: MediaFormat) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage }
    media(type: MANGA, sort: $sort, search: $search, genre: $genre, status: $status, format: $format, isAdult: false) {
      ${MANGA_FIELDS}
    }
  }
}`;

const INFO_QUERY = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    ${MANGA_FIELDS}
    synonyms
    countryOfOrigin
    source
    updatedAt
    siteUrl
    tags { name rank }
    staff(perPage: 5) { edges { role node { name { full } } } }
    recommendations(perPage: 10, sort: RATING_DESC) {
      edges {
        node {
          mediaRecommendation {
            ${MANGA_FIELDS}
          }
        }
      }
    }
  }
}`;

// ── Helper to format AniList page response ──
function formatCatalogResponse(data, page) {
  const pageInfo = data?.Page?.pageInfo || {};
  const results = data?.Page?.media || [];
  return {
    results,
    page: page,
    total_pages: pageInfo.lastPage || 1,
    total_results: pageInfo.total || results.length,
  };
}

// ── Image Proxy (bypasses CORS & hotlink blocking) ──
router.get('/img', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://anilist.co/',
      },
      timeout: 10000,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(response.data);
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
    const data = await queryAniList(MANGA_QUERY, {
      page,
      perPage: 20,
      sort: ['TRENDING_DESC', 'POPULARITY_DESC'],
    });
    const result = formatCatalogResponse(data, page);
    setCache(cacheKey, result, TTL.CATALOG);
    res.json(result);
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
    const data = await queryAniList(MANGA_QUERY, {
      page,
      perPage: 20,
      sort: ['POPULARITY_DESC'],
    });
    const result = formatCatalogResponse(data, page);
    setCache(cacheKey, result, TTL.CATALOG);
    res.json(result);
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
    const data = await queryAniList(MANGA_QUERY, {
      page,
      perPage: 20,
      sort: ['SCORE_DESC'],
    });
    const result = formatCatalogResponse(data, page);
    setCache(cacheKey, result, TTL.CATALOG);
    res.json(result);
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
    const data = await queryAniList(MANGA_QUERY, {
      page,
      perPage: 20,
      sort: ['START_DATE_DESC'],
      status: 'RELEASING',
    });
    const result = formatCatalogResponse(data, page);
    setCache(cacheKey, result, TTL.CATALOG);
    res.json(result);
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
    const data = await queryAniList(MANGA_QUERY, {
      page,
      perPage: 20,
      sort: ['SEARCH_MATCH'],
      search: query,
    });
    const result = formatCatalogResponse(data, page);
    setCache(cacheKey, result, TTL.SEARCH);
    res.json(result);
  } catch (err) {
    console.error('Search manga error:', err.message);
    res.status(500).json({ error: 'Failed to search manga', results: [] });
  }
});

// ── Manga Info / Metadata ──
router.get('/info/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Manga ID is required' });

  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid manga ID' });

  const cacheKey = `info_${numericId}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await queryAniList(INFO_QUERY, { id: numericId });
    const manga = data?.Media;
    if (!manga) return res.status(404).json({ error: 'Manga not found' });

    // Extract recommendations
    const recommendations = (manga.recommendations?.edges || [])
      .map(e => e.node?.mediaRecommendation)
      .filter(Boolean);

    const result = {
      ...manga,
      recommendations,
    };

    setCache(cacheKey, result, TTL.INFO);
    res.json(result);
  } catch (err) {
    console.error(`Manga info error (${id}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch manga info' });
  }
});

// ── Manga Chapters List (via MangaDex API) ──
router.get('/chapters/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Manga ID is required' });

  const cacheKey = `chapters_${id}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    // First, search MangaDex by AniList ID via external links
    const searchRes = await axios.get('https://api.mangadex.org/manga', {
      params: {
        'ids[]': undefined,
        'limit': 1,
        'includes[]': ['cover_art'],
        // Search by AniList link
      },
      headers: { 'User-Agent': 'PBGOfficials/1.0' },
      timeout: 10000,
    });

    // Alternative: search by title from AniList
    const aniData = await queryAniList(`query($id:Int){Media(id:$id,type:MANGA){title{romaji english}}}`, { id: parseInt(id) });
    const title = aniData?.Media?.title?.english || aniData?.Media?.title?.romaji || '';

    if (!title) {
      return res.json({ chapters: [], message: 'Could not resolve manga title' });
    }

    const mdSearch = await axios.get('https://api.mangadex.org/manga', {
      params: {
        title: title,
        limit: 5,
        'includes[]': ['cover_art'],
        'availableTranslatedLanguage[]': ['en'],
      },
      headers: { 'User-Agent': 'PBGOfficials/1.0' },
      timeout: 10000,
    });

    const mangaList = mdSearch.data?.data || [];
    if (mangaList.length === 0) {
      return res.json({ chapters: [], message: 'Manga not found on MangaDex' });
    }

    const mangaDexId = mangaList[0].id;

    // Fetch chapters
    const chapRes = await axios.get(`https://api.mangadex.org/manga/${mangaDexId}/feed`, {
      params: {
        'translatedLanguage[]': ['en'],
        order: { chapter: 'asc' },
        limit: 500,
        'includes[]': ['scanlation_group'],
      },
      headers: { 'User-Agent': 'PBGOfficials/1.0' },
      timeout: 15000,
    });

    const rawChapters = chapRes.data?.data || [];

    // Deduplicate by chapter number (keep first/best)
    const seen = new Map();
    for (const ch of rawChapters) {
      const num = ch.attributes?.chapter || '0';
      if (!seen.has(num)) {
        const group = ch.relationships?.find(r => r.type === 'scanlation_group');
        seen.set(num, {
          id: ch.id,
          chapter: num,
          title: ch.attributes?.title || `Chapter ${num}`,
          volume: ch.attributes?.volume || null,
          publishAt: ch.attributes?.publishAt || null,
          scanlationGroup: group?.attributes?.name || 'Unknown',
        });
      }
    }

    const chapters = Array.from(seen.values()).sort((a, b) => {
      return parseFloat(a.chapter || 0) - parseFloat(b.chapter || 0);
    });

    const result = { chapters, mangaDexId, total: chapters.length };
    setCache(cacheKey, result, TTL.CHAPTERS);
    res.json(result);
  } catch (err) {
    console.error(`Manga chapters error (${id}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch manga chapters', chapters: [] });
  }
});

// ── Manga Chapter Pages (via MangaDex API) ──
router.get('/pages', async (req, res) => {
  const chapterId = (req.query.chapterId || '').trim();
  if (!chapterId) return res.status(400).json({ error: 'chapterId query parameter is required' });

  const cacheKey = `pages_${chapterId}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await axios.get(`https://api.mangadex.org/at-home/server/${chapterId}`, {
      headers: { 'User-Agent': 'PBGOfficials/1.0' },
      timeout: 10000,
    });

    const baseUrl = response.data?.baseUrl;
    const chapter = response.data?.chapter;

    if (!baseUrl || !chapter) {
      return res.status(404).json({ error: 'Chapter pages not found', pages: [] });
    }

    const hash = chapter.hash;
    // Prefer data-saver for faster loading
    const pageFiles = chapter.dataSaver || chapter.data || [];
    const pages = pageFiles.map(file => ({
      url: `${baseUrl}/data-saver/${hash}/${file}`,
      urlHQ: chapter.data ? `${baseUrl}/data/${hash}/${chapter.data[pageFiles.indexOf(file)] || file}` : null,
    }));

    const result = { pages, total: pages.length };
    setCache(cacheKey, result, TTL.PAGES);
    res.json(result);
  } catch (err) {
    console.error(`Manga pages error (${chapterId}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch chapter pages', pages: [] });
  }
});

module.exports = router;
