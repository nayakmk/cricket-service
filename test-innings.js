const { handler } = require('./netlify/functions/matches-v2');

async function testAPI() {
  console.log('Testing matches API with includeDismissals=true...');

  const event = {
    httpMethod: 'GET',
    path: '/api/v2/matches',
    queryStringParameters: {
      limit: '1',
      includeDismissals: 'true'
    }
  };

  try {
    const response = await handler(event, {});
    console.log('Response status:', response.statusCode);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      if (data.success && data.data && data.data.length > 0) {
        const match = data.data[0];
        console.log('Match ID:', match.id);
        console.log('Team1 has innings:', !!match.team1?.innings);
        console.log('Team2 has innings:', !!match.team2?.innings);

        if (match.team1?.innings) {
          console.log('Team1 innings length:', match.team1.innings.length);
          if (match.team1.innings.length > 0) {
            console.log('Sample Team1 innings player:', JSON.stringify(match.team1.innings[0], null, 2));
          }
        }

        if (match.team2?.innings) {
          console.log('Team2 innings length:', match.team2.innings.length);
          if (match.team2.innings.length > 0) {
            console.log('Sample Team2 innings player:', JSON.stringify(match.team2.innings[0], null, 2));
          }
        }
      } else {
        console.log('No matches found or API error:', data.message);
      }
    } else {
      console.log('Error response:', response.statusCode, response.body);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAPI().catch(console.error);