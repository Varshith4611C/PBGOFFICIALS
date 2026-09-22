const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const animeApi = require('../anime/api');
const { initChatSocket } = require('../chatbox/api');
const ioClient = require('socket.io-client');

const app = express();
app.use(express.json());
app.use('/api/anime', animeApi);

const httpServer = createServer(app);
const io = new Server(httpServer);
initChatSocket(io);

const PORT = 3899;

httpServer.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`);
  let allPassed = true;

  try {
    // 1. Test /api/anime/search
    console.log('Testing /api/anime/search...');
    const searchRes = await fetch(`http://localhost:${PORT}/api/anime/search?q=demon+slayer`);
    const searchJson = await searchRes.json();
    console.log('  Search status:', searchRes.status, 'Results:', searchJson.results?.length);
    if (!searchJson.results || searchJson.results.length === 0) {
      console.error('  FAIL: search returned 0 results');
      allPassed = false;
    } else {
      console.log('  SUCCESS: First anime:', searchJson.results[0].title);
    }

    // 2. Test /api/anime/trending
    console.log('Testing /api/anime/trending...');
    const trendRes = await fetch(`http://localhost:${PORT}/api/anime/trending?perPage=5`);
    const trendJson = await trendRes.json();
    console.log('  Trending status:', trendRes.status, 'Results:', trendJson.results?.length);
    if (!trendJson.results || trendJson.results.length === 0) {
      console.error('  FAIL: trending returned 0 results');
      allPassed = false;
    } else {
      console.log('  SUCCESS: Top trending:', trendJson.results[0].title);
    }

    // 3. Test /api/anime/watch/151807-episode-1
    console.log('Testing /api/anime/watch/151807-episode-1...');
    const watchRes = await fetch(`http://localhost:${PORT}/api/anime/watch/151807-episode-1`);
    const watchJson = await watchRes.json();
    console.log('  Watch status:', watchRes.status);
    console.log('  embedUrl:', watchJson.embedUrl);
    console.log('  directStreamUrl:', watchJson.directStreamUrl);
    console.log('  servers count:', watchJson.servers?.length);
    if (!watchJson.embedUrl || watchJson.directStreamUrl !== null || !watchJson.servers?.length) {
      console.error('  FAIL: watch data invalid');
      allPassed = false;
    } else {
      console.log('  SUCCESS: Watch returned valid embed and server list');
    }

    // 4. Test Socket.IO connection to anime-manga room
    console.log('Testing Socket.IO join to anime-manga...');
    await new Promise((resolve) => {
      const socket = ioClient(`http://localhost:${PORT}`);
      socket.on('connect', () => {
        console.log('  Socket connected');
        socket.emit('user-join', { username: 'TestWatcher', room: 'anime-manga' });
      });

      socket.on('anime-state', (state) => {
        console.log('  Received anime-state on join:');
        console.log('    isActive:', state.isActive);
        console.log('    currentAnime title:', state.currentAnime?.title);
        console.log('    episodeNumber:', state.currentAnime?.episodeNumber);
        console.log('    embedUrl:', state.currentAnime?.embedUrl);
        if (state.isActive && state.currentAnime && state.currentAnime.embedUrl) {
          console.log('  SUCCESS: Default active featured anime stream received!');
        } else {
          console.error('  FAIL: anime-state was not active or missing stream');
          allPassed = false;
        }
        socket.disconnect();
        resolve();
      });

      setTimeout(() => {
        socket.disconnect();
        resolve();
      }, 5000);
    });

  } catch (err) {
    console.error('Test execution error:', err);
    allPassed = false;
  } finally {
    httpServer.close();
    console.log('\n--- OVERALL TEST RESULT ---');
    if (allPassed) {
      console.log('ALL TESTS PASSED SUCCESSFULLY! ✅');
      process.exit(0);
    } else {
      console.error('SOME TESTS FAILED ❌');
      process.exit(1);
    }
  }
});
