// Test script for match prediction API
const handler = require('./netlify/functions/matches-v2.js').handler;

// Test the predict-winner endpoint with real player IDs
const testEvent = {
  httpMethod: 'POST',
  path: '/predict-winner',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    team1PlayerIds: ['2000000000000000021', '2000000000000000020', '2000000000000000008', '2000000000000000007', '2000000000000000004'], // Real player IDs
    team2PlayerIds: ['2000000000000000023', '2000000000000000029', '2000000000000000006', '2000000000000000028', '2000000000000000033'], // Real player IDs
    matchType: 'T20'
  })
};

console.log('Testing match prediction API...');
handler(testEvent, {}).then(result => {
  console.log('Status Code:', result.statusCode);
  const data = JSON.parse(result.body);
  if (data.success) {
    console.log('Prediction successful!');
    console.log('Team 1 Players Count:', data.data.team1PlayersCount);
    console.log('Team 2 Players Count:', data.data.team2PlayersCount);
    console.log('Match Type:', data.data.matchType);
    console.log('Prediction data keys:', Object.keys(data.data));
  } else {
    console.log('Prediction failed:', data.message);
    if (data.error) {
      console.log('Error details:', data.error);
    }
  }
}).catch(err => {
  console.error('Test failed:', err.message);
  console.error('Stack:', err.stack);
});