const express = require('express');
const animeApi = require('../anime/api');

const app = express();
app.use(express.json());
app.use('/api/anime', animeApi);

const server = app.listen(3001, async () => {
  console.log('Test server running on 3001');
  try {
    const res = await fetch('http://localhost:3001/api/anime/search?q=naruto');
    console.log('Search status:', res.status);
    const json = await res.json();
    console.log('Search results count:', json.results?.length);
    if (json.results && json.results.length > 0) {
      console.log('Sample result:', json.results[0]);
    } else {
      console.log('Full response:', json);
    }
  } catch (err) {
    console.error('Request error:', err);
  } finally {
    server.close();
  }
});
