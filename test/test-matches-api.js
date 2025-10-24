// Test matches API
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/api/v2/matches?page=1&limit=4&includePlayers=true&includeImpactScores=true&includeDismissals=true',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();