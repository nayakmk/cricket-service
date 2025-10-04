const https = require('https');

function testMatchesAPI() {
  const options = {
    hostname: 'cricket-scoring-app.netlify.app',
    path: '/.netlify/functions/matches',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('API Response Status:', res.statusCode);
        if (response.success && response.data && response.data.length > 0) {
          console.log('First match data:');
          console.log(JSON.stringify(response.data[0], null, 2));
        } else {
          console.log('Response:', response);
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.end();
}

testMatchesAPI();