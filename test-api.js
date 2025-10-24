// Test script
const handler = require('./netlify/functions/matches-v2.js').handler;

// Test with includePlayers=true and includeImpactScores=true
const testEvent = {
  httpMethod: 'GET',
  path: '/',
  queryStringParameters: {
    page: '1',
    limit: '1',
    includePlayers: 'true',
    includeImpactScores: 'true'
  },
  headers: {},
  body: null
};

console.log('Testing API...');
handler(testEvent, {}).then(result => {
  const data = JSON.parse(result.body);
  const match = data.data[0];
  console.log('Match status:', match.status);
  console.log('Team1 has squad:', !!match.team1.squad);
  console.log('Team1 squad has players:', !!(match.team1.squad && match.team1.squad.players && match.team1.squad.players.length > 0));
  if (match.team1.squad && match.team1.squad.players && match.team1.squad.players.length > 0) {
    const firstPlayer = match.team1.squad.players[0];
    console.log('First player has finalImpactScore:', firstPlayer.finalImpactScore !== undefined);
    console.log('First player impact score:', firstPlayer.finalImpactScore);
  }
  console.log('Player of match:', match.playerOfMatch);
}).catch(err => {
  console.error('Test failed:', err.message);
});