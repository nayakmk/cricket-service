const http = require('http');

const BASE_URL = 'http://localhost:8888/api';

async function testTeamAPI() {
  return new Promise((resolve, reject) => {
    // Test with team ID 16 as mentioned by user
    const url = `${BASE_URL}/teams/16`;

    console.log('Testing API endpoint:', url);

    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          console.log(`Status: ${res.statusCode}`);
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            console.log('Team data:');
            console.log(`- Name: ${response.data?.name}`);
            console.log(`- Statistics:`, response.data?.statistics);
            console.log(`- Match History Count: ${response.data?.matchHistory?.length || 0}`);
            if (response.data?.matchHistory && response.data.matchHistory.length > 0) {
              console.log('First match:');
              console.log(`  - Title: ${response.data.matchHistory[0].title}`);
              console.log(`  - Status: ${response.data.matchHistory[0].status}`);
              console.log(`  - Opponent: ${response.data.matchHistory[0].opponent?.name || 'Unknown'}`);
              console.log(`  - Result: ${JSON.stringify(response.data.matchHistory[0].result)}`);
            }
            resolve(response);
          } else {
            console.log('Error response:', data);
            resolve(null);
          }
        } catch (error) {
          console.error('Parse error:', error);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('Request failed:', error.message);
      reject(error);
    });
  });
}

testTeamAPI().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});