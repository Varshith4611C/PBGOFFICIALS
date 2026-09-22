const https = require('https');

async function testAniList() {
  console.log('Testing AniList GraphQL...');
  
  const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { english romaji native }
          coverImage { extraLarge large }
          episodes
        }
      }
    }
  `;
  const variables = { search: 'naruto', page: 1, perPage: 5 };

  // Test 1: Native global fetch
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ query, variables }),
    });
    console.log('Test 1 (fetch) Status:', res.status);
    if (!res.ok) {
      console.log('Test 1 error text:', await res.text());
    } else {
      const json = await res.json();
      console.log('Test 1 success, count:', json.data?.Page?.media?.length);
    }
  } catch (err) {
    console.error('Test 1 failed:', err.message, err.cause);
  }

  // Test 2: axios
  const axios = require('axios');
  try {
    const aRes = await axios.post('https://graphql.anilist.co', { query, variables }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      timeout: 10000,
    });
    console.log('Test 2 (axios) Status:', aRes.status, 'count:', aRes.data?.data?.Page?.media?.length);
  } catch (err) {
    console.error('Test 2 failed:', err.message);
  }
}

testAniList();
