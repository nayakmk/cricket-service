// Debug PUT handler
const handler = require('./netlify/functions/matches-v2.js').handler;

async function debugPUT() {
  // Create test match
  const createEvent = {
    httpMethod: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Debug Match',
      matchType: 'T20',
      venue: 'Test',
      scheduledDate: new Date().toISOString(),
      team1Id: '1',
      team2Id: '2',
      tournamentId: 'GEN2025',
      status: 'scheduled'
    })
  };

  const createResult = await handler(createEvent, {});
  const createdMatch = JSON.parse(createResult.body).data;
  console.log('Created match team1.id:', createdMatch.team1.id);
  console.log('Created match team2.id:', createdMatch.team2.id);
  console.log('Created match team1Id:', createdMatch.team1Id);
  console.log('Created match team2Id:', createdMatch.team2Id);

  // Update with squad
  const updateEvent = {
    httpMethod: 'PUT',
    path: `/${createdMatch.displayId}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      squads: {
        '1': {
          teamId: '1',
          players: [
            { playerId: 'test1', name: 'Player 1', role: 'batsman' }
          ]
        },
        '2': {
          teamId: '2',
          players: [
            { playerId: 'test2', name: 'Player 2', role: 'batsman' }
          ]
        }
      }
    })
  };

  console.log('Update data squads keys:', Object.keys(updateEvent.body ? JSON.parse(updateEvent.body).squads : {}));

  const updateResult = await handler(updateEvent, {});
  console.log('Update status:', updateResult.statusCode);

  if (updateResult.statusCode !== 200) {
    console.log('Update error:', updateResult.body);
    return;
  }

  // Get updated match
  const getEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`,
    queryStringParameters: { includePlayers: 'true' } // Include players in response
  };

  const getResult = await handler(getEvent, {});
  const retrievedMatch = JSON.parse(getResult.body).data;
  console.log('Updated team1:', JSON.stringify(retrievedMatch.team1, null, 2));
  console.log('Updated team2:', JSON.stringify(retrievedMatch.team2, null, 2));
}

debugPUT().catch(console.error);