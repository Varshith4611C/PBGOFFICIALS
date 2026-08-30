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
  let path;
  try {
    const url = new URL(href, BASE_URL);
    path = url.pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    path = href.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');
  }
  // Strip common prefixes (anime/, category/) so IDs are bare slugs
  path = path.replace(/^(anime|category)\//, '');
  return path;
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

// ── Helper: Extract direct HLS stream for synchronized watch party ──
async function resolveDirectStream(embedUrl) {
  try {
    const res = await client.get(embedUrl, {
      headers: { 'Referer': BASE_URL, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 6000,
    });
    
    let streamId = null;
    const mMatch = res.data.match(/megaplay\.buzz\/stream\/[^\/]+\/(\d+)/i);
    if (mMatch) {
      streamId = mMatch[1];
    } else {
      const epMatch = embedUrl.match(/ep=(\d+)/);
      if (epMatch) streamId = epMatch[1];
    }

    if (streamId) {
      const srcRes = await axios.get(`https://megaplay.buzz/stream/getSources?id=${streamId}`, {
        headers: {
          'Referer': `https://megaplay.buzz/stream/s-2/${streamId}/sub?autostart=true`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 6000,
      });
      if (srcRes.data && srcRes.data.sources && srcRes.data.sources.file) {
        return {
          directStream: srcRes.data.sources.file,
          subtitles: srcRes.data.tracks || [],
          intro: srcRes.data.intro || null,
          outro: srcRes.data.outro || null,
        };
      }
    }
  } catch (err) {
    // Non-fatal, fallback to embedUrl
  }
  return null;
}

// ── Stream Proxy (Proxies HLS master.m3u8, sub-playlists, and video segments) ──
router.get('/stream-proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter');

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://megaplay.buzz/',
      'Origin': 'https://megaplay.buzz',
    };

    const isM3U8 = targetUrl.includes('.m3u8') || req.headers.accept?.includes('application/vnd.apple.mpegurl');

    if (isM3U8) {
      const response = await axios.get(targetUrl, {
        headers,
        responseType: 'text',
        timeout: 12000,
      });

      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const content = response.data;

      const lines = content.split(/\r?\n/);
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (line.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (match, uri) => {
            const resolved = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
            return `URI="/api/anime/stream-proxy?url=${encodeURIComponent(resolved)}"`;
          });
        }

        if (!trimmed.startsWith('#')) {
          const resolved = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
          return `/api/anime/stream-proxy?url=${encodeURIComponent(resolved)}`;
        }

        return line;
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(rewritten);
    } else {
      // Binary stream segments (.ts, .jpg, etc)
      const response = await axios.get(targetUrl, {
        headers,
        responseType: 'stream',
        timeout: 15000,
      });

      res.setHeader('Content-Type', response.headers['content-type'] || 'video/MP2T');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return response.data.pipe(res);
    }
  } catch (err) {
    console.error('Stream proxy error:', err.message);
    res.status(502).send('Proxy streaming failed');
  }
});

// ── Watch episode (iframe + direct HLS stream + servers + prev/next) ──
router.get('/watch/:episodeId', async (req, res) => {
  try {
    const { episodeId } = req.params;
    const url = `${BASE_URL}/${episodeId}/`;

    const { data } = await client.get(url);
    const $ = cheerio.load(data);

    // Extract iframe player URL
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

    // Extract prev / next episode links
    let prevEp = '';
    let nextEp = '';

    $('.pagenav a, .pagination a, .wp-pagenavi a, .ep-nav a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      const rel = $(el).attr('rel') || '';

      if (text.includes('prev') || rel.includes('prev')) {
        prevEp = cleanPath(href);
      }
      if (text.includes('next') || rel.includes('next')) {
        nextEp = cleanPath(href);
      }
    });

    const navPrev = $('.nav-previous a, .post-navigation .nav-previous a').attr('href');
    const navNext = $('.nav-next a, .post-navigation .nav-next a').attr('href');
    if (navPrev && !prevEp) prevEp = cleanPath(navPrev);
    if (navNext && !nextEp) nextEp = cleanPath(navNext);

    const animeImage = $('meta[property="og:image"]').attr('content') || '';

    // Clean iframe src
    const cleanIframeSrc = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc;
    const embedUrl = servers.length > 0 ? servers[0].url : cleanIframeSrc;

    // Extract direct HLS stream for true 100% sync
    let directStreamUrl = null;
    let subtitles = [];
    try {
      const epMatch = (servers[0]?.url || cleanIframeSrc).match(/ep=(\d+)/);
      if (epMatch) {
        const epNumId = epMatch[1];
        const srcRes = await axios.get(`https://megaplay.buzz/stream/getSources?id=${epNumId}`, {
          headers: {
            'Referer': `https://megaplay.buzz/stream/s-2/${epNumId}/sub?autostart=true`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
          },
          timeout: 4000
        });
        if (srcRes.data && srcRes.data.sources) {
          const rawFile = srcRes.data.sources.file || (Array.isArray(srcRes.data.sources) ? srcRes.data.sources[0]?.file : null);
          if (rawFile) {
            directStreamUrl = `/api/anime/stream-proxy?url=${encodeURIComponent(rawFile)}`;
          }
          if (srcRes.data.tracks) {
            subtitles = srcRes.data.tracks;
          }
        }
      }
    } catch (e) {
      console.warn('Direct stream extract note:', e.message);
    }

    // Extract anime ID from episode ID
    const animeId = episodeId.replace(/-episode-\d+.*$/, '');

    res.json({
      episodeId,
      animeId,
      title: animeTitle,
      image: animeImage ? `/api/anime/img?url=${encodeURIComponent(animeImage)}` : '',
      embedUrl,
      directStreamUrl,
      subtitles,
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

// ── Get anime info + exact episode list ──
router.get('/info/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let title = id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let image = '';
    let subOrDub = id.includes('-dub') ? 'dub' : 'sub';
    const epMap = new Map();

    // 1. Try to fetch the anime detail page (contains exact episode links)
    const detailUrls = [`${BASE_URL}/anime/${id}/`, `${BASE_URL}/category/${id}/`];
    let pageHtml = '';

    for (const url of detailUrls) {
      try {
        const response = await client.get(url);
        if (response.data) {
          pageHtml = response.data;
          break;
        }
      } catch {}
    }

    if (pageHtml) {
      const $ = cheerio.load(pageHtml);
      const pageTitle = $('h1.entry-title, h1').first().text().trim();
      if (pageTitle) title = pageTitle;

      const ogImage = $('meta[property="og:image"]').attr('content') || '';
      if (ogImage) image = `/api/anime/img?url=${encodeURIComponent(ogImage)}`;

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/([a-zA-Z0-9_-]+-episode-(\d+))\/?$/i);
        if (m) {
          const epId = m[1];
          const epNum = parseInt(m[2]);
          if (!epMap.has(epNum)) {
            epMap.set(epNum, { id: epId, number: epNum });
          }
        }
      });
    }

    // 2. Fallback if detail page didn't have episode links (probe episode 1)
    if (epMap.size === 0) {
      try {
        const ep1Slug = `${id}-episode-1`;
        const ep1Res = await client.get(`${BASE_URL}/${ep1Slug}/`);
        const $1 = cheerio.load(ep1Res.data);
        const ep1Title = $1('h1.entry-title, h1').first().text().trim();
        if (ep1Title) title = ep1Title.replace(/\s*Episode\s*\d+\s*$/i, '').trim();
        const ep1Img = $1('meta[property="og:image"]').attr('content') || '';
        if (ep1Img) image = `/api/anime/img?url=${encodeURIComponent(ep1Img)}`;
        epMap.set(1, { id: ep1Slug, number: 1 });
      } catch {}
    }

    // Default at least 1 episode if still empty
    if (epMap.size === 0) {
      epMap.set(1, { id: `${id}-episode-1`, number: 1 });
    }

    const episodes = Array.from(epMap.values()).sort((a, b) => a.number - b.number);

    res.json({
      id,
      title,
      image,
      subOrDub,
      episodes,
      totalEpisodes: episodes.length,
    });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: 'Failed to fetch anime info' });
  }
});

module.exports = router;
