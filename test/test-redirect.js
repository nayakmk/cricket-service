// Simple test for auction API redirect
const https = require('https');

const testEndpoint = (url, method = 'GET') => {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: body.substring(0, 200) });
      });
    });
    req.on('error', reject);
    req.end();
  });
};

async function testRedirect() {
  console.log('Testing auction API redirect...');

  try {
    // Test OPTIONS request to base auctions endpoint
    const result = await testEndpoint('https://charming-stroopwafel-69c009.netlify.app/api/v2/auctions/', 'OPTIONS');
    console.log('Status:', result.status);
    console.log('CORS Origin:', result.headers['access-control-allow-origin']);
    console.log('CORS Methods:', result.headers['access-control-allow-methods']);
    console.log('Response preview:', result.body.substring(0, 100) + '...');

    if (result.headers['access-control-allow-origin']) {
      console.log('✅ Redirect working - CORS headers present');
    } else {
      console.log('❌ Redirect not working - no CORS headers');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRedirect();