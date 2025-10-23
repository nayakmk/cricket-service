// Debug PUT handler - check team IDs and squad transformation
const handler = require('./netlify/functions/matches-v2.js').handler;

async function debugPUTHandler() {
  console.log('🔍 DEBUGGING PUT HANDLER\n');

  // Create a test match
  const createEvent = {
    httpMethod: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "Debug PUT Match",
      matchType: "T20",
      venue: "Test Stadium",
      scheduledDate: new Date().toISOString(),
      team1Id: "1",
      team2Id: "2",
      tournamentId: "GEN2025",
      status: "scheduled"
    })
  };

  const createResult = await handler(createEvent, {});
  const createdMatch = JSON.parse(createResult.body).data;
  console.log('Created match displayId:', createdMatch.displayId);

  // Get the match to see its structure
  const getEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`
  };
  const getResult = await handler(getEvent, {});
  const matchData = JSON.parse(getResult.body).data;

  console.log('\n📋 MATCH TEAM INFO:');
  console.log('team1Id:', matchData.team1Id);
  console.log('team2Id:', matchData.team2Id);
  console.log('team1.id:', matchData.team1?.id);
  console.log('team2.id:', matchData.team2?.id);

  // Try updating with correct team IDs
  console.log('\n🔄 UPDATING WITH CORRECT TEAM IDs...');
  const updateEvent = {
    httpMethod: 'PUT',
    path: `/${createdMatch.displayId}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      squads: {
        [matchData.team1Id || matchData.team1?.id]: {
          teamId: matchData.team1Id || matchData.team1?.id,
          players: [
            { playerId: "debug-player-1", name: "Debug Player 1", role: "batsman" }
          ]
        },
        [matchData.team2Id || matchData.team2?.id]: {
          teamId: matchData.team2Id || matchData.team2?.id,
          players: [
            { playerId: "debug-player-2", name: "Debug Player 2", role: "bowler" }
          ]
        }
      }
    })
  };

  const updateResult = await handler(updateEvent, {});
  console.log('Update status:', updateResult.statusCode);

  // Check final result
  const finalGetEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`,
    queryStringParameters: {
      includePlayers: 'true'
    }
  };
  const finalGetResult = await handler(finalGetEvent, {});
  const finalMatch = JSON.parse(finalGetResult.body).data;

  console.log('\n✅ FINAL RESULT:');
  console.log('team1.players exists:', !!(finalMatch.team1 && finalMatch.team1.players));
  console.log('team2.players exists:', !!(finalMatch.team2 && finalMatch.team2.players));

  if (finalMatch.team1.players) {
    console.log('team1.players:', finalMatch.team1.players);
  }
  if (finalMatch.team2.players) {
    console.log('team2.players:', finalMatch.team2.players);
  }

  // Clean up
  const deleteEvent = {
    httpMethod: 'DELETE',
    path: `/${createdMatch.displayId}`
  };
  await handler(deleteEvent, {});
}

debugPUTHandler().catch(console.error);