const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';

async function testV2APIs() {
  console.log('Testing V2 APIs...\n');

  try {
    // Test teams-v2 API
    console.log('Testing teams-v2 API...');
    const teamsResponse = await fetch(`${BASE_URL}/api/v2/teams/`);
    if (teamsResponse.ok) {
      const teamsData = await teamsResponse.json();
      console.log('✅ Teams V2 API working - found', teamsData.data?.length || 0, 'teams');
    } else {
      console.log('❌ Teams V2 API failed:', teamsResponse.status, teamsResponse.statusText);
    }

    // Test players-v2 API
    console.log('Testing players-v2 API...');
    const playersResponse = await fetch(`${BASE_URL}/api/v2/players/`);
    if (playersResponse.ok) {
      const playersData = await playersResponse.json();
      console.log('✅ Players V2 API working - found', playersData.data?.length || 0, 'players');
    } else {
      console.log('❌ Players V2 API failed:', playersResponse.status, playersResponse.statusText);
    }

    // Test matches-v2 API
    console.log('Testing matches-v2 API...');
    const matchesResponse = await fetch(`${BASE_URL}/api/v2/matches/`);
    if (matchesResponse.ok) {
      const matchesData = await matchesResponse.json();
      console.log('✅ Matches V2 API working - found', matchesData.data?.length || 0, 'matches');
    } else {
      console.log('❌ Matches V2 API failed:', matchesResponse.status, matchesResponse.statusText);
    }

    console.log('\n🎉 V2 API testing completed!');

  } catch (error) {
    console.error('❌ Error testing V2 APIs:', error.message);
    console.log('\nNote: Make sure Netlify dev server is running with: npm run dev');
  }
}

// Run the test
testV2APIs();