const { handler } = require('../netlify/functions/matches-v2.js');

async function testMatchesV2API() {
  try {
    // Test getting all matches
    console.log('Testing GET /api/v2/matches');
    const listEvent = {
      httpMethod: 'GET',
      path: '/api/v2/matches',
      queryStringParameters: { limit: '5' }
    };

    const listResult = await handler(listEvent, {});
    console.log('List Status:', listResult.statusCode);

    let actualDisplayId = '22'; // fallback

    if (listResult.statusCode === 200) {
      const listData = JSON.parse(listResult.body);
      console.log('Matches found:', listData.data ? listData.data.length : 0);
      if (listData.data && listData.data.length > 0) {
        console.log('First match ID:', listData.data[0].id || listData.data[0].numericId);
        console.log('First match displayId:', listData.data[0].displayId);
        console.log('First match numericId:', listData.data[0].numericId);
        actualDisplayId = listData.data[0].displayId;
      }
    }

    // Test getting individual match
    console.log('\nTesting GET /api/v2/matches/' + actualDisplayId);
    const detailEvent = {
      httpMethod: 'GET',
      path: '/api/v2/matches/' + actualDisplayId,
      queryStringParameters: {}
    };

    const detailResult = await handler(detailEvent, {});
    console.log('Detail Status:', detailResult.statusCode);

    if (detailResult.statusCode === 200) {
      const detailData = JSON.parse(detailResult.body);
      console.log('Match found:', detailData.success);
      if (detailData.success) {
        console.log('Match title:', detailData.data.title);
      }
    } else {
      console.log('Error response:', detailResult.body);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testMatchesV2API();