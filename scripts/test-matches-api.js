const { handler } = require('../netlify/functions/matches.js');

async function testMatchesAPI() {
  try {
    const event = {
      httpMethod: 'GET',
      path: '/.netlify/functions/matches',
      queryStringParameters: {}
    };

    const result = await handler(event, {});
    console.log('Status:', result.statusCode);

    const data = JSON.parse(result.body);
    if (data.success && data.data && data.data.length > 0) {
      console.log('First match data:');
      console.log(JSON.stringify(data.data[0], null, 2));
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testMatchesAPI();