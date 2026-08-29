const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

// ── GoGoAnime base URL (update if domain changes) ──
const BASE_URL = 'https://gogoanime.or.at';

// ── HTTP client ──
const client = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
});

// ── Helper: Clean URL path to get ID ──
function cleanPath(href) {
  try {
    const url = new URL(href, BASE_URL);
    return url.pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    return href.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');
  }
}

// ── Helper: Parse homepage articles ──
function parseArticles($) {
  const results = [];
  $('article').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a').first();
    const href = link.attr('href') || '';
    const titleEl = $el.find('h2');
    const title = titleEl.text().trim();
    const image = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';

    // Extract episode number and sub/dub
    const epMatch = $el.text().match(/Ep\s+(\d+)/i);
    const episodeNumber = epMatch ? parseInt(epMatch[1]) : null;
    const isDub = $el.text().includes('Dub');
    const subOrDub = isDub ? 'dub' : 'sub';

    // Clean path: removes domain, leading/trailing slashes
    const urlPath = cleanPath(href);
    const episodeId = urlPath;

    // Extract anime ID by removing -episode-XXX
    const animeId = urlPath.replace(/-episode-\d+.*$/, '');

    if (urlPath && title) {
      results.push({
        id: animeId,
        episodeId,
        title: title.replace(/\s*Episode\s*\d+\s*$/i, '').trim(),
        image,
        episodeNumber,
        subOrDub,
        url: href,
      });
    }
  });
  return results;
}

// ── Image proxy (bypass hotlink protection) ──
router.get('/img', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url');

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL,
      },
      timeout: 10000,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 1 day
    res.send(response.data);
  } catch {
    res.status(404).send('Image not found');
  }
});

// ── Recent episodes (homepage) ──
router.get('/recent', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const url = page > 1 ? `${BASE_URL}/page/${page}/` : BASE_URL;
    const { data } = await client.get(url);
    const $ = cheerio.load(data);
    const results = parseArticles($);

    // Proxy the images
    results.forEach(r => {
      if (r.image) r.image = `/api/anime/img?url=${encodeURIComponent(r.image)}`;
    });

    res.json({ currentPage: parseInt(page), results });
  } catch (err) {
    console.error('Recent error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recent episodes' });
  }
});

// ── Search anime ──
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

    const { data } = await client.get(BASE_URL, {
      params: { s: q, paged: page },
    });

    const $ = cheerio.load(data);
    const results = parseArticles($);

    // Proxy images
    results.forEach(r => {
      if (r.image) r.image = `/api/anime/img?url=${encodeURIComponent(r.image)}`;
    });

    // Deduplicate by anime ID
    const seen = new Set();
    const deduped = results.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    res.json({ currentPage: parseInt(page), results: deduped });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Failed to search anime' });
  }
});

// ── Get episode iframe / servers ──
router.get('/watch/:episodeId', async (req, res) => {
  try {
    const episodeId = req.params.episodeId;
    const watchUrl = `${BASE_URL}/${episodeId}/`;
    const { data } = await client.get(watchUrl);
    const $ = cheerio.load(data);

    // Extract iframe src from the player
    const iframeSrc = $('#pembed iframe').attr('src')
      || $('#embed_holder iframe').attr('src')
      || $('.megavid iframe').attr('src')
      || $('iframe').first().attr('src')
      || '';

    // Extract servers from the mirror dropdown (base64 encoded)
    const servers = [];
    $('select.mirror option').each((_, el) => {
      const val = $(el).attr('value') || '';
      const name = $(el).text().trim();
      if (val && name && name !== 'Select Video Server') {
        try {
          const decoded = Buffer.from(val, 'base64').toString('utf-8');
          const $decoded = cheerio.load(decoded);
          const serverUrl = $decoded('iframe').attr('src') || '';
          if (serverUrl) {
            servers.push({
              name,
              url: serverUrl.startsWith('//') ? 'https:' + serverUrl : serverUrl,
            });
          }
        } catch (e) {
          if (val.startsWith('http') || val.startsWith('//')) {
            servers.push({
              name,
              url: val.startsWith('//') ? 'https:' + val : val,
            });
          }
        }
      }
    });

    // Get anime title
    const animeTitle = $('h1.entry-title, h1').first().text().trim();

    // Get prev/next from WordPress nav links
    let prevEp = '';
    let nextEp = '';

    // Try multiple selectors for prev/next
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';
      const text = $(el).text().toLowerCase().trim();

      if ((rel === 'prev' || text.includes('prev')) && href.includes('-episode-')) {
        prevEp = cleanPath(href);
      }
      if ((rel === 'next' || text.includes('next')) && href.includes('-episode-')) {
        nextEp = cleanPath(href);
      }
    });

    // Also try nav-links (WordPress pagination)
    const navPrev = $('.nav-previous a, .post-navigation .nav-previous a').attr('href');
    const navNext = $('.nav-next a, .post-navigation .nav-next a').attr('href');
    if (navPrev && !prevEp) prevEp = cleanPath(navPrev);
    if (navNext && !nextEp) nextEp = cleanPath(navNext);

    // Get anime image from the page
    const animeImage = $('meta[property="og:image"]').attr('content') || '';

    // Clean iframe src
    const cleanIframeSrc = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc;
    const embedUrl = servers.length > 0 ? servers[0].url : cleanIframeSrc;

    // Extract anime ID from episode ID
    const animeId = episodeId.replace(/-episode-\d+.*$/, '');

    res.json({
      episodeId,
      animeId,
      title: animeTitle,
      image: animeImage ? `/api/anime/img?url=${encodeURIComponent(animeImage)}` : '',
      embedUrl,
      iframeSrc: cleanIframeSrc,
      servers,
      prevEpisode: prevEp,
      nextEpisode: nextEp,
    });
  } catch (err) {
    console.error('Watch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch episode sources' });
  }
});

// ── Helper: Check if an episode URL exists ──
async function episodeExists(slug) {
  try {
    const { status } = await client.get(`${BASE_URL}/${slug}/`, { 
      maxRedirects: 0,
      validateStatus: s => s < 400,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Helper: Find max episode via binary search ──
async function findMaxEpisode(animeId, knownMax) {
  // Start from knownMax and verify it exists
  let low = 1;
  let high = knownMax;
  
  // First verify our known max actually exists
  const knownExists = await episodeExists(`${animeId}-episode-${knownMax}`);
  if (!knownExists) {
    // Binary search downward to find actual max
    high = knownMax;
    low = 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const exists = await episodeExists(`${animeId}-episode-${mid}`);
      if (exists) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }
  
  return knownMax;
}

// ── Get anime info + generate full episode list ──
router.get('/info/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const maxEpParam = parseInt(req.query.maxEp) || 0;

    // Try to get anime title & image from episode 1 page
    let title = id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let image = '';
    let subOrDub = id.includes('-dub') ? 'dub' : 'sub';

    try {
      const ep1Slug = `${id}-episode-1`;
      const { data } = await client.get(`${BASE_URL}/${ep1Slug}/`);
      const $ = cheerio.load(data);
      
      const pageTitle = $('h1.entry-title, h1').first().text().trim();
      if (pageTitle) {
        // Clean "Episode 1" from title
        title = pageTitle.replace(/\s*Episode\s*\d+\s*$/i, '').trim();
      }
      
      const ogImage = $('meta[property="og:image"]').attr('content') || '';
      if (ogImage) image = `/api/anime/img?url=${encodeURIComponent(ogImage)}`;
    } catch {
      // Episode 1 page failed, use defaults
    }

    // Determine max episode count
    let totalEpisodes = maxEpParam || 1;
    
    if (maxEpParam > 1) {
      // Verify the max episode exists (quick check)
      totalEpisodes = await findMaxEpisode(id, maxEpParam);
    } else if (maxEpParam === 0) {
      // No max provided — probe to find it
      // Check common high values: 12, 24, 50, 100, 200, 500, 1000
      const probes = [1200, 1000, 500, 200, 100, 50, 24, 12];
      let found = 1;
      for (const probe of probes) {
        if (await episodeExists(`${id}-episode-${probe}`)) {
          found = probe;
          break;
        }
      }
      // Now binary search between found and next probe up
      if (found > 1) {
        const upperIdx = probes.indexOf(found);
        const upper = upperIdx > 0 ? probes[upperIdx - 1] : found * 2;
        // Binary search between found and upper
        let low = found, high = upper;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (await episodeExists(`${id}-episode-${mid}`)) {
            low = mid;
          } else {
            high = mid - 1;
          }
        }
        totalEpisodes = low;
      }
    }

    // Generate episode list from 1 to totalEpisodes
    const episodes = [];
    for (let i = 1; i <= totalEpisodes; i++) {
      episodes.push({
        id: `${id}-episode-${i}`,
        number: i,
      });
    }

    res.json({
      id,
      title,
      image,
      subOrDub,
      episodes,
      totalEpisodes,
    });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: 'Failed to fetch anime info' });
  }
});

module.exports = router;
