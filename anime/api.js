const axios = require('axios');
const express = require('express');
const router = express.Router();

const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

// ── In-memory TTL Cache (10 minutes for fast instant responses) ──
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  cache.set(key, { time: Date.now(), data });
}

// ── AniList GraphQL Client with Timeout & Axios Fallback ──
async function fetchAniList(query, variables = {}) {
  const cacheKey = JSON.stringify({ query, variables });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AniList GraphQL error ${res.status}: ${errText}`);
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(`AniList query error: ${json.errors[0].message}`);
    }

    setCached(cacheKey, json.data);
    return json.data;
  } catch (err) {
    clearTimeout(timeoutId);
    // Fallback to axios if fetch fails
    try {
      const aRes = await axios.post(
        ANILIST_GRAPHQL,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          timeout: 9000,
        }
      );
      if (aRes.data?.data) {
        setCached(cacheKey, aRes.data.data);
        return aRes.data.data;
      }
    } catch (axiosErr) {
      console.warn('Axios fallback also failed:', axiosErr.message);
    }
    throw err;
  }
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

// ============================================
// STREAME-X ANILIST GRAPHQL ENDPOINTS
// ============================================

// ── 1. Trending Anime (Featured Carousel & Trending Section) ──
router.get('/trending', async (req, res) => {
  try {
    const { page = 1, perPage = 15 } = req.query;
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: TRENDING_DESC) {
            id
            title { english romaji native }
            bannerImage
            coverImage { extraLarge large }
            averageScore
            format
            startDate { year }
            description
            genres
            status
            episodes
            nextAiringEpisode { episode timeUntilAiring airingAt }
          }
        }
      }
    `;

    const data = await fetchAniList(query, {
      page: parseInt(page) || 1,
      perPage: parseInt(perPage) || 15,
    });

    const results = (data.Page?.media || []).map(m => ({
      id: m.id,
      title: m.title.english || m.title.romaji || m.title.native,
      englishTitle: m.title.english,
      romajiTitle: m.title.romaji,
      bannerImage: m.bannerImage,
      coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      scorePercentage: m.averageScore,
      format: m.format || 'TV',
      year: m.startDate?.year || null,
      description: m.description ? m.description.replace(/<[^>]*>/g, '') : '',
      genres: m.genres || [],
      status: m.status || 'FINISHED',
      episodes: m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null),
      nextAiringEpisode: m.nextAiringEpisode,
    }));

    res.json({ results });
  } catch (err) {
    console.error('Trending fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch trending anime' });
  }
});

// ── 2. Popular Anime (Most Popular Carousel) ──
router.get('/popular', async (req, res) => {
  try {
    const { page = 1, perPage = 15 } = req.query;
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC) {
            id
            title { english romaji native }
            bannerImage
            coverImage { extraLarge large }
            averageScore
            format
            startDate { year }
            description
            genres
            status
            episodes
          }
        }
      }
    `;

    const data = await fetchAniList(query, {
      page: parseInt(page) || 1,
      perPage: parseInt(perPage) || 15,
    });

    const results = (data.Page?.media || []).map(m => ({
      id: m.id,
      title: m.title.english || m.title.romaji || m.title.native,
      englishTitle: m.title.english,
      romajiTitle: m.title.romaji,
      bannerImage: m.bannerImage,
      coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      format: m.format || 'TV',
      year: m.startDate?.year || null,
      description: m.description ? m.description.replace(/<[^>]*>/g, '') : '',
      genres: m.genres || [],
      status: m.status || 'FINISHED',
      episodes: m.episodes || null,
    }));

    res.json({ results });
  } catch (err) {
    console.error('Popular fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch popular anime' });
  }
});

// ── 3. Top Airing Anime ──
router.get('/top-airing', async (req, res) => {
  try {
    const { page = 1, perPage = 15 } = req.query;
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
            id
            title { english romaji native }
            bannerImage
            coverImage { extraLarge large }
            averageScore
            format
            startDate { year }
            description
            genres
            status
            episodes
            nextAiringEpisode { episode timeUntilAiring airingAt }
          }
        }
      }
    `;

    const data = await fetchAniList(query, {
      page: parseInt(page) || 1,
      perPage: parseInt(perPage) || 15,
    });

    const results = (data.Page?.media || []).map(m => ({
      id: m.id,
      title: m.title.english || m.title.romaji || m.title.native,
      englishTitle: m.title.english,
      romajiTitle: m.title.romaji,
      bannerImage: m.bannerImage,
      coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      format: m.format || 'TV',
      year: m.startDate?.year || null,
      description: m.description ? m.description.replace(/<[^>]*>/g, '') : '',
      genres: m.genres || [],
      status: m.status || 'RELEASING',
      episodes: m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null),
      nextAiringEpisode: m.nextAiringEpisode,
    }));

    res.json({ results });
  } catch (err) {
    console.error('Top airing fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch top airing anime' });
  }
});

// ── 4. Airing Schedule (StreameX 7-day schedule Mon-Sun) ──
router.get('/schedule', async (req, res) => {
  try {
    let startTimestamp, endTimestamp;

    if (req.query.start && req.query.end) {
      startTimestamp = parseInt(req.query.start);
      endTimestamp = parseInt(req.query.end);
    } else {
      // Default: If dayOffset provided (-3 to +3 from today)
      const dayOffset = parseInt(req.query.dayOffset || '0');
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
      targetDate.setHours(0, 0, 0, 0);
      startTimestamp = Math.floor(targetDate.getTime() / 1000);
      endTimestamp = startTimestamp + 86400;
    }

    const query = `
      query ($start: Int, $end: Int) {
        Page(page: 1, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            id
            episode
            airingAt
            timeUntilAiring
            media {
              id
              title { english romaji native }
              coverImage { large }
              bannerImage
              averageScore
              format
              genres
            }
          }
        }
      }
    `;

    const data = await fetchAniList(query, {
      start: startTimestamp,
      end: endTimestamp,
    });

    const schedules = (data.Page?.airingSchedules || []).map(s => ({
      id: s.id,
      episode: s.episode,
      airingAt: s.airingAt,
      timeUntilAiring: s.timeUntilAiring,
      isAired: s.timeUntilAiring <= 0,
      media: {
        id: s.media.id,
        title: s.media.title.english || s.media.title.romaji || s.media.title.native,
        coverImage: s.media.coverImage?.large,
        bannerImage: s.media.bannerImage,
        averageScore: s.media.averageScore ? (s.media.averageScore / 10).toFixed(1) : null,
        format: s.media.format || 'TV',
        genres: s.media.genres || [],
      },
    }));

    res.json({
      startTimestamp,
      endTimestamp,
      schedules,
    });
  } catch (err) {
    console.error('Schedule fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch airing schedule' });
  }
});

// ── 5. Ranked Top 10 (Side-by-side: Top 10 Airing + Top 10 Most Popular) ──
router.get('/top-10', async (req, res) => {
  try {
    const query = `
      query {
        topAiring: Page(page: 1, perPage: 10) {
          media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
            id
            title { english romaji native }
            coverImage { large }
            bannerImage
            averageScore
            format
            genres
            episodes
            nextAiringEpisode { episode }
          }
        }
        mostPopular: Page(page: 1, perPage: 10) {
          media(type: ANIME, sort: POPULARITY_DESC) {
            id
            title { english romaji native }
            coverImage { large }
            bannerImage
            averageScore
            format
            genres
            episodes
          }
        }
      }
    `;

    const data = await fetchAniList(query);

    const mapItem = (m, rank) => ({
      rank,
      id: m.id,
      title: m.title.english || m.title.romaji || m.title.native,
      coverImage: m.coverImage?.large,
      bannerImage: m.bannerImage,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      format: m.format || 'TV',
      genres: m.genres || [],
      episodes: m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null),
    });

    const topAiring = (data.topAiring?.media || []).map((m, idx) => mapItem(m, idx + 1));
    const mostPopular = (data.mostPopular?.media || []).map((m, idx) => mapItem(m, idx + 1));

    res.json({
      topAiring,
      mostPopular,
    });
  } catch (err) {
    console.error('Top-10 fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch top 10 rankings' });
  }
});

// ── 6. Anime Information by AniList ID (Metadata, relations, recommendations) ──
router.get('/info/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = /^\d+$/.test(id);

    if (isNum) {
      const anilistId = parseInt(id);
      const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { english romaji native }
            bannerImage
            coverImage { extraLarge large }
            averageScore
            format
            status
            episodes
            duration
            season
            seasonYear
            startDate { year month day }
            description
            genres
            studios(isMain: true) {
              nodes { name }
            }
            nextAiringEpisode { episode timeUntilAiring airingAt }
            relations {
              edges {
                relationType
                node {
                  id
                  title { english romaji }
                  format
                  type
                  coverImage { large }
                }
              }
            }
            recommendations(page: 1, perPage: 10) {
              nodes {
                mediaRecommendation {
                  id
                  title { english romaji }
                  coverImage { large }
                  averageScore
                  format
                }
              }
            }
          }
        }
      `;

      const data = await fetchAniList(query, { id: anilistId });
      const m = data.Media;

      if (!m) return res.status(404).json({ error: 'Anime not found' });

      // Determine total episodes
      let totalEpisodes = m.episodes || 1;
      if (!m.episodes && m.nextAiringEpisode) {
        totalEpisodes = Math.max(1, m.nextAiringEpisode.episode - 1);
      } else if (!m.episodes) {
        // Fallback for long-running shows if unspecified
        totalEpisodes = 1100;
      }

      const studioName = m.studios?.nodes?.[0]?.name || 'Unknown';
      const recommendations = (m.recommendations?.nodes || [])
        .map(n => n.mediaRecommendation)
        .filter(Boolean)
        .map(rec => ({
          id: rec.id,
          title: rec.title.english || rec.title.romaji,
          coverImage: rec.coverImage?.large,
          averageScore: rec.averageScore ? (rec.averageScore / 10).toFixed(1) : null,
          format: rec.format || 'TV',
        }));

      return res.json({
        id: m.id,
        anilistId: m.id,
        title: m.title.english || m.title.romaji || m.title.native,
        englishTitle: m.title.english,
        romajiTitle: m.title.romaji,
        nativeTitle: m.title.native,
        bannerImage: m.bannerImage,
        coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
        averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
        format: m.format || 'TV',
        status: m.status || 'FINISHED',
        episodes: m.episodes || totalEpisodes,
        totalEpisodes,
        duration: m.duration ? `${m.duration} min` : null,
        season: m.season ? `${m.season} ${m.seasonYear || ''}`.trim() : (m.startDate?.year ? `${m.startDate.year}` : null),
        releaseDate: m.startDate?.year ? `${m.startDate.year}-${String(m.startDate.month || 1).padStart(2, '0')}-${String(m.startDate.day || 1).padStart(2, '0')}` : null,
        description: m.description ? m.description.replace(/<[^>]*>/g, '') : '',
        genres: m.genres || [],
        studio: studioName,
        nextAiringEpisode: m.nextAiringEpisode,
        relations: (m.relations?.edges || [])
          .filter(e => e.node?.type === 'ANIME')
          .map(e => ({
            relationType: e.relationType,
            id: e.node.id,
            title: e.node.title.english || e.node.title.romaji,
            format: e.node.format,
            coverImage: e.node.coverImage?.large,
          })),
        recommendations,
      });
    }

    // Non-numeric ID: Search AniList by title/slug as fallback
    try {
      const searchQuery = `
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            id
          }
        }
      `;
      const searchData = await fetchAniList(searchQuery, { search: id.replace(/-/g, ' ') });
      if (searchData?.Media?.id) {
        return res.redirect(307, `/api/anime/info/${searchData.Media.id}`);
      }
    } catch (_) {}

    return res.status(404).json({ error: 'Anime not found. Please use a valid AniList ID.' });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: 'Failed to fetch anime info' });
  }
});

// ── 7. Search Anime (Instant Search & Autocomplete) ──
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, perPage = 20 } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ error: 'Query parameter "q" is required' });

    const query = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { english romaji native }
            coverImage { extraLarge large }
            bannerImage
            averageScore
            format
            status
            episodes
            startDate { year }
            genres
            description
          }
        }
      }
    `;

    const data = await fetchAniList(query, {
      search: q.trim(),
      page: parseInt(page) || 1,
      perPage: parseInt(perPage) || 20,
    });

    const results = (data.Page?.media || []).map(m => ({
      id: m.id,
      title: m.title.english || m.title.romaji || m.title.native,
      englishTitle: m.title.english,
      romajiTitle: m.title.romaji,
      coverImage: m.coverImage?.extraLarge || m.coverImage?.large,
      bannerImage: m.bannerImage,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      format: m.format || 'TV',
      status: m.status || 'FINISHED',
      year: m.startDate?.year || null,
      episodes: m.episodes || null,
      genres: m.genres || [],
      description: m.description ? m.description.replace(/<[^>]*>/g, '').slice(0, 160) + '...' : '',
    }));

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Failed to search anime' });
  }
});

// ── 8. StreameX Video Servers Provider ──
router.get('/watch-servers/:id/:episode', async (req, res) => {
  try {
    const { id, episode = 1 } = req.params;
    const season = req.query.season || 1;
    const epNum = parseInt(episode) || 1;

    // Build the high-speed streaming servers with verified mobile compatibility
    const servers = [
      {
        id: 'main-sub',
        name: 'HD-1 (Sub)',
        flag: 'https://flagcdn.com/w20/us.png',
        url: `https://vidnest.fun/anime/${id}/${epNum}/sub`,
        recommended: true,
        type: 'sub',
      },
      {
        id: 'main-dub',
        name: 'HD-1 (Dub)',
        flag: 'https://flagcdn.com/w20/us.png',
        url: `https://vidnest.fun/anime/${id}/${epNum}/dub`,
        recommended: false,
        type: 'dub',
      },
      {
        id: 'core-sub',
        name: 'Core (Sub)',
        flag: 'https://flagcdn.com/w20/gb.png',
        url: `https://tryembed.us.cc/embed/anime/${id}/${epNum}/sub?skin=transparent`,
        recommended: false,
        type: 'sub',
      },
      {
        id: 'core-dub',
        name: 'Core (Dub)',
        flag: 'https://flagcdn.com/w20/gb.png',
        url: `https://tryembed.us.cc/embed/anime/${id}/${epNum}/dub?skin=transparent`,
        recommended: false,
        type: 'dub',
      },
      {
        id: 'pahe-sub',
        name: 'AnimePahe (Sub)',
        flag: 'https://flagcdn.com/w20/us.png',
        url: `https://vidnest.fun/animepahe/${id}/${epNum}/sub`,
        recommended: false,
        type: 'sub',
      },
      {
        id: 'pahe-dub',
        name: 'AnimePahe (Dub)',
        flag: 'https://flagcdn.com/w20/us.png',
        url: `https://vidnest.fun/animepahe/${id}/${epNum}/dub`,
        recommended: false,
        type: 'dub',
      },
      {
        id: 'megaplay-sub',
        name: 'MegaPlay (Mirror)',
        flag: 'https://flagcdn.com/w20/us.png',
        url: `https://megaplay.buzz/stream/ani/${id}/${epNum}/sub`,
        recommended: false,
        type: 'mirror',
      },
      {
        id: '2embed',
        name: '2Embed (Mirror)',
        flag: 'https://flagcdn.com/w20/us.png',
        url: `https://www.2embed.cc/embed/${id}`,
        recommended: false,
        type: 'mirror',
      },
    ];

    res.json({
      id,
      episode: epNum,
      season: parseInt(season),
      servers,
    });
  } catch (err) {
    console.error('Watch servers error:', err.message);
    res.status(500).json({ error: 'Failed to generate watch servers' });
  }
});

// ── 9. Watch by Episode ID (ChatBox Cinema Compatibility) ──
// The chatbox calls /api/anime/watch/:episodeId where episodeId is like "anime-id-episode-3"
// Returns embedUrl + directStreamUrl for the cinema player
router.get('/watch/:episodeId', async (req, res) => {
  try {
    const { episodeId } = req.params;

    // Parse episodeId: could be "12345" (AniList numeric ID) or "some-anime-episode-3"
    let animeId, epNum;

    const epMatch = episodeId.match(/^(.+?)-episode-(\d+)$/);
    if (epMatch) {
      animeId = epMatch[1];
      epNum = parseInt(epMatch[2]) || 1;
    } else if (/^\d+$/.test(episodeId)) {
      // Numeric ID — treat as animeId episode 1
      animeId = episodeId;
      epNum = 1;
    } else {
      animeId = episodeId;
      epNum = 1;
    }

    // Build embed URLs using verified providers with multi-server failover
    const servers = [
      {
        id: 'main-sub',
        name: 'HD-1 (Sub)',
        url: `https://vidnest.fun/anime/${animeId}/${epNum}/sub`,
        recommended: true,
        type: 'sub',
      },
      {
        id: 'main-dub',
        name: 'HD-1 (Dub)',
        url: `https://vidnest.fun/anime/${animeId}/${epNum}/dub`,
        recommended: false,
        type: 'dub',
      },
      {
        id: 'core-sub',
        name: 'Core (Sub)',
        url: `https://tryembed.us.cc/embed/anime/${animeId}/${epNum}/sub?skin=transparent`,
        recommended: false,
        type: 'sub',
      },
      {
        id: 'core-dub',
        name: 'Core (Dub)',
        url: `https://tryembed.us.cc/embed/anime/${animeId}/${epNum}/dub?skin=transparent`,
        recommended: false,
        type: 'dub',
      },
      {
        id: 'pahe-sub',
        name: 'AnimePahe (Sub)',
        url: `https://vidnest.fun/animepahe/${animeId}/${epNum}/sub`,
        recommended: false,
        type: 'sub',
      },
      {
        id: '2embed',
        name: '2Embed (Mirror)',
        url: `https://www.2embed.cc/embed/${animeId}`,
        recommended: false,
        type: 'mirror',
      },
    ];

    const activeServer = servers.find(s => s.id === req.query.server) || servers[0];
    const embedUrl = activeServer.url;

    res.json({
      animeId,
      episodeId,
      episodeNumber: epNum,
      embedUrl,
      iframeSrc: embedUrl,
      directStreamUrl: null, // HTML embed requires iframe, not native <video> HLS
      servers,
      currentServer: activeServer.id,
      title: animeId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    });
  } catch (err) {
    console.error('Watch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch watch data' });
  }
});

module.exports = router;
