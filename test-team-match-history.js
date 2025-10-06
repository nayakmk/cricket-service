const https = require('https');

const BASE_URL = 'http://localhost:8888/api';

async function testTeamMatchHistory() {
  return new Promise((resolve, reject) => {
    // Test with a team that should have matches
    const url = `${BASE_URL}/teams/202510051034270000022`; // Using one of the team IDs from population summary

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Team match history test:');
          console.log(`Status: ${res.statusCode}`);
          if (response.data) {
            console.log(`Team: ${response.data.name}`);
            console.log(`Match History Count: ${response.data.matchHistory?.length || 0}`);
            if (response.data.matchHistory && response.data.matchHistory.length > 0) {
              console.log('First match:');
              console.log(`- Opponent: ${response.data.matchHistory[0].opponent?.name}`);
              console.log(`- Status: ${response.data.matchHistory[0].status}`);
              console.log(`- Result: ${JSON.stringify(response.data.matchHistory[0].result)}`);
            }
          }
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

testTeamMatchHistory().then(() => process.exit(0)).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});