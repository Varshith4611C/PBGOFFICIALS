/* ============================================
   PBG Manga — Backend API & Proxy Router
   Powered by AniList GraphQL & Smart Chapter Engine
   ============================================ */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

// ── In-Memory Cache with TTL ──
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

// ── AniList GraphQL Client ──
async function queryAniList(query, variables = {}) {
  const response = await axios.post(ANILIST_GRAPHQL, { query, variables }, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    timeout: 15000,
  });
  return response.data?.data;
}

const MANGA_FIELDS = `
  id
  title { romaji english native }
  coverImage { extraLarge large medium }
  bannerImage
  description
  genres
  averageScore
  status
  format
  chapters
  volumes
  startDate { year month day }
`;

const CATALOG_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $search: String, $status: MediaStatus) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage }
    media(type: MANGA, sort: $sort, search: $search, status: $status, isAdult: false) {
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
    characters(perPage: 12, sort: ROLE) {
      edges {
        role
        node {
          name { full userPreferred }
          image { large medium }
        }
      }
    }
    recommendations(perPage: 12, sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          ${MANGA_FIELDS}
        }
      }
    }
  }
}`;

function formatCatalogResponse(data, page) {
  const pageInfo = data?.Page?.pageInfo || {};
  const results = data?.Page?.media || [];
  return {
    results,
    page: parseInt(page, 10) || 1,
    hasNextPage: Boolean(pageInfo.hasNextPage),
    total_pages: pageInfo.lastPage || 1,
    total_results: pageInfo.total || results.length,
  };
}

function cleanSlug(str) {
  return (str || '').toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ── Smart Chapter Resolvers ──
async function resolveMangaPillChapters(titles) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const q = t.slice(0, 50).trim();
      const searchUrl = `https://mangapill.com/search?q=${encodeURIComponent(q)}`;
      const res = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        timeout: 9000
      });

      const regex = /href="(\/manga\/(\d+)\/([^"]+))"/g;
      const matches = [];
      let m;
      while ((m = regex.exec(res.data)) !== null) {
        if (!matches.some(x => x.id === m[2])) {
          matches.push({ link: m[1], id: m[2], slug: m[3] });
        }
      }

      if (matches.length > 0) {
        const cleanT = cleanSlug(t);
        let best = matches.find(x => x.slug === cleanT);
        if (!best) {
          const starts = matches.filter(x => x.slug.startsWith(cleanT) && !x.slug.includes('novel') && !x.slug.includes('art-book'));
          if (starts.length > 0) {
            starts.sort((a, b) => a.slug.length - b.slug.length);
            best = starts[0];
          }
        }
        if (!best) {
          const nonNovel = matches.filter(x => !x.slug.includes('novel') && !x.slug.includes('art-book'));
          best = nonNovel[0] || matches[0];
        }

        const pageUrl = `https://mangapill.com${best.link}`;
        const pageRes = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          timeout: 9000
        });

        const chRegex = /href="(\/chapters\/([^"]+))"[^>]*>([\s\S]*?)<\/a>/g;
        const chapters = [];
        let ch;
        while ((ch = chRegex.exec(pageRes.data)) !== null) {
          const rawTitle = ch[3].replace(/<[^>]*>/g, '').trim();
          const numMatch = rawTitle.match(/Chapter\s+([\d.]+)/i) || ch[2].match(/chapter-([\d.]+)/i);
          chapters.push({
            id: ch[2],
            title: rawTitle,
            chapter: numMatch ? numMatch[1] : ''
          });
        }

        if (chapters.length > 0) {
          return {
            chapters,
            total: chapters.length,
            provider: 'mangapill',
            providerId: `${best.id}/${best.slug}`
          };
        }
      }
    } catch (err) {
      console.warn(`MangaPill search warning for "${t}":`, err.message);
    }
  }
  return null;
}

async function resolveMangaDexChapters(titles) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const sRes = await axios.get('https://api.mangadex.org/manga', {
        params: {
          title: t,
          limit: 5,
          'availableTranslatedLanguage[]': ['en']
        },
        headers: { 'User-Agent': 'PBGOfficials/1.0' },
        timeout: 9000
      });

      const mangaList = sRes.data?.data || [];
      if (mangaList.length === 0) continue;

      const mangaDexId = mangaList[0].id;
      const feedRes = await axios.get(`https://api.mangadex.org/manga/${mangaDexId}/feed`, {
        params: {
          'translatedLanguage[]': ['en'],
          order: { chapter: 'desc' },
          limit: 500
        },
        headers: { 'User-Agent': 'PBGOfficials/1.0' },
        timeout: 12000
      });

      const rawChapters = feedRes.data?.data || [];
      const seen = new Map();
      for (const ch of rawChapters) {
        const num = ch.attributes?.chapter || '0';
        if (!seen.has(num)) {
          seen.set(num, {
            id: ch.id,
            chapter: num,
            title: ch.attributes?.title || `Chapter ${num}`
          });
        }
      }

      const chapters = Array.from(seen.values());
      if (chapters.length > 0) {
        return {
          chapters,
          total: chapters.length,
          provider: 'mangadex',
          providerId: mangaDexId
        };
      }
    } catch (err) {
      console.warn(`MangaDex search warning for "${t}":`, err.message);
    }
  }
  return null;
}

// ── SSRF Protection Helper ──
function isDisallowedHost(hostname) {
  const lower = (hostname || '').toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '0.0.0.0' || lower === '::1') return true;
  if (/^(10\.|192\.168\.|169\.254\.|127\.)/.test(lower)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal')) return true;
  return false;
}

// ── Image Proxy (bypasses hotlink protection & CORS, SSRF protected) ──
router.get('/img', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).send('Invalid url parameter');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).send('Invalid protocol. Only HTTP and HTTPS are allowed.');
    }

    if (isDisallowedHost(parsedUrl.hostname)) {
      return res.status(403).send('Forbidden image target');
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    if (url.includes('readdetectiveconan') || url.includes('mangapill')) {
      headers['Referer'] = 'https://mangapill.com/';
    } else if (url.includes('mangadex')) {
      headers['Referer'] = 'https://mangadex.org/';
    } else if (url.includes('anilist')) {
      headers['Referer'] = 'https://anilist.co/';
    }

    const response = await axios.get(parsedUrl.href, {
      responseType: 'arraybuffer',
      headers,
      timeout: 15000,
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
    const data = await queryAniList(CATALOG_QUERY, {
      page,
      perPage: 18,
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
    const data = await queryAniList(CATALOG_QUERY, {
      page,
      perPage: 18,
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
    const data = await queryAniList(CATALOG_QUERY, {
      page,
      perPage: 18,
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
    const data = await queryAniList(CATALOG_QUERY, {
      page,
      perPage: 18,
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
    const data = await queryAniList(CATALOG_QUERY, {
      page,
      perPage: 18,
      search: query,
      sort: ['SEARCH_MATCH', 'POPULARITY_DESC'],
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
  const cacheKey = `info_${id}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    let manga = null;
    if (!isNaN(numericId)) {
      const data = await queryAniList(INFO_QUERY, { id: numericId });
      manga = data?.Media;
    } else {
      const data = await queryAniList(`query($s:String){Media(search:$s,type:MANGA){${MANGA_FIELDS}}}`, { s: id });
      manga = data?.Media;
    }

    if (!manga) return res.status(404).json({ error: 'Manga not found' });

    setCache(cacheKey, manga, TTL.INFO);
    res.json(manga);
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
    let titles = [];
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      const infoCached = getCache(`info_${id}`);
      if (infoCached) {
        titles = [
          infoCached.title?.english,
          infoCached.title?.romaji,
          ...(infoCached.synonyms || [])
        ].filter(Boolean);
      } else {
        const data = await queryAniList(`query($id:Int){Media(id:$id,type:MANGA){title{english romaji} synonyms}}`, { id: numericId });
        const m = data?.Media;
        if (m) {
          titles = [
            m.title?.english,
            m.title?.romaji,
            ...(m.synonyms || [])
          ].filter(Boolean);
        }
      }
    } else {
      titles = [id];
    }

    if (titles.length === 0) {
      return res.json({ chapters: [], total: 0 });
    }

    // Try MangaPill first (instant, high coverage)
    let result = await resolveMangaPillChapters(titles);

    // Fallback to MangaDex if not found on MangaPill
    if (!result || result.chapters.length === 0) {
      result = await resolveMangaDexChapters(titles);
    }

    if (!result) {
      result = { chapters: [], total: 0 };
    }

    setCache(cacheKey, result, TTL.CHAPTERS);
    res.json(result);
  } catch (err) {
    console.error(`Manga chapters error (${id}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch manga chapters', chapters: [] });
  }
});

// ── Manga Chapter Pages ──
router.get('/pages', async (req, res) => {
  const chapterId = (req.query.chapterId || '').trim();
  if (!chapterId) return res.status(400).json({ error: 'chapterId query parameter is required', pages: [] });

  const cacheKey = `pages_${chapterId}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Check if MangaPill chapter ID
    if (chapterId.includes('-') && (chapterId.includes('/') || chapterId.includes('chapter'))) {
      const chapUrl = `https://mangapill.com/chapters/${chapterId}`;
      const response = await axios.get(chapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        timeout: 12000
      });

      const allImgRegex = /data-src="([^"]+)"/g;
      let match;
      const pages = [];
      let pageNum = 1;
      while ((match = allImgRegex.exec(response.data)) !== null) {
        const imgUrl = match[1];
        if (imgUrl.includes('/mangap/') || imgUrl.includes('readdetectiveconan') || imgUrl.includes('cdn')) {
          pages.push({
            img: imgUrl,
            page: pageNum++
          });
        }
      }

      if (pages.length > 0) {
        setCache(cacheKey, pages, TTL.PAGES);
        return res.json(pages);
      }
    }

    // Fallback: MangaDex Chapter Pages
    const mdRes = await axios.get(`https://api.mangadex.org/at-home/server/${chapterId}`, {
      headers: { 'User-Agent': 'PBGOfficials/1.0' },
      timeout: 10000
    });

    const baseUrl = mdRes.data?.baseUrl;
    const chapter = mdRes.data?.chapter;
    if (baseUrl && chapter) {
      const hash = chapter.hash;
      const pageFiles = chapter.dataSaver || chapter.data || [];
      const pages = pageFiles.map((file, i) => ({
        img: `${baseUrl}/data-saver/${hash}/${file}`,
        page: i + 1
      }));
      setCache(cacheKey, pages, TTL.PAGES);
      return res.json(pages);
    }

    res.status(404).json({ error: 'Chapter pages not found', pages: [] });
  } catch (err) {
    console.error(`Manga pages error (${chapterId}):`, err.message);
    res.status(500).json({ error: 'Failed to fetch chapter pages', pages: [] });
  }
});

module.exports = router;
