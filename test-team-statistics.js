const https = require('https');

const BASE_URL = 'http://localhost:8888/api';

async function testTeamStatistics() {
  return new Promise((resolve, reject) => {
    // Test with a team that should have matches
    const url = `${BASE_URL}/teams/202510051034270000022`; // Using one of the team IDs from population summary

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Team statistics test:');
          console.log(`Status: ${res.statusCode}`);
          if (response.data) {
            console.log(`Team: ${response.data.name}`);
            console.log(`Statistics:`, response.data.statistics);
            if (response.data.statistics) {
              console.log(`- Total Matches: ${response.data.statistics.totalMatches}`);
              console.log(`- Wins: ${response.data.statistics.wins}`);
              console.log(`- Losses: ${response.data.statistics.losses}`);
              console.log(`- Draws: ${response.data.statistics.draws}`);
              console.log(`- Win %: ${response.data.statistics.winPercentage?.toFixed(1)}%`);
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

testTeamStatistics().then(() => process.exit(0)).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});