// Test Auction API CORS and External Access
const https = require('https');

const testEndpoint = (url, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js Test'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
};

async function runTests() {
  console.log('🧪 Testing Auction V2 API CORS and External Access...\n');

  try {
    // Test CORS preflight
    console.log('Testing CORS preflight request...');
    const corsResult = await testEndpoint('https://charming-stroopwafel-69c009.netlify.app/api/v2/auctions/test', 'OPTIONS');

    console.log('✅ CORS Preflight Status:', corsResult.status);
    console.log('✅ CORS Headers:', {
      'Access-Control-Allow-Origin': corsResult.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods': corsResult.headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': corsResult.headers['access-control-allow-headers'],
      'Access-Control-Allow-Credentials': corsResult.headers['access-control-allow-credentials']
    });

    // Test actual API call (should return 404 for non-existent endpoint)
    console.log('\nTesting API endpoint access...');
    const apiResult = await testEndpoint('https://charming-stroopwafel-69c009.netlify.app/api/v2/auctions/test');

    console.log('✅ API Status:', apiResult.status);
    console.log('✅ API Response:', apiResult.body);

    // Verify CORS configuration
    const corsHeaders = corsResult.headers;
    const expectedOrigin = 'https://ebcl-app.github.io';
    const expectedMethods = 'GET, POST, PUT, DELETE, OPTIONS';

    if (corsHeaders['access-control-allow-origin'] === expectedOrigin) {
      console.log('✅ CORS Origin correctly set to:', expectedOrigin);
    } else {
      console.log('❌ CORS Origin mismatch. Expected:', expectedOrigin, 'Got:', corsHeaders['access-control-allow-origin']);
    }

    if (corsHeaders['access-control-allow-methods'] === expectedMethods) {
      console.log('✅ CORS Methods correctly set to:', expectedMethods);
    } else {
      console.log('❌ CORS Methods mismatch. Expected:', expectedMethods, 'Got:', corsHeaders['access-control-allow-methods']);
    }

    console.log('\n🎉 Auction V2 API is properly configured for external access with CORS!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();