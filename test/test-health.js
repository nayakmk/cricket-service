// Test auction health endpoint
const https = require('https');

const testEndpoint = (url, method = 'GET') => {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: body.substring(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

async function testHealth() {
  console.log('Testing auction health endpoint...');

  try {
    const result = await testEndpoint('https://charming-stroopwafel-69c009.netlify.app/api/v2/auctions/health');

    console.log('Status:', result.status);
    console.log('CORS Origin:', result.headers['access-control-allow-origin']);
    console.log('CORS Methods:', result.headers['access-control-allow-methods']);

    if (result.status === 200 && result.headers['access-control-allow-origin']) {
      console.log('✅ Auction API redirect is working!');
      console.log('✅ CORS is properly configured');
    } else {
      console.log('❌ Auction API redirect not working');
    }

    console.log('Response:', typeof result.body === 'object' ? JSON.stringify(result.body, null, 2) : result.body);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testHealth();