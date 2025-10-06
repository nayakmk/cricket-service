const https = require('https');

const BASE_URL = 'http://localhost:8888/api';

async function testMatchResult() {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/matches/202510051435560000003`; // Using the first match ID from our check

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Match result test:');
          console.log(`Status: ${res.statusCode}`);
          console.log(`Winner: ${response.data?.winner}`);
          console.log(`Result: ${JSON.stringify(response.data?.result)}`);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

testMatchResult().then(() => process.exit(0)).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});