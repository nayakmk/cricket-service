// Test PUT handler with a fresh match created after our fixes
const handler = require('./netlify/functions/matches-v2.js').handler;

async function testFreshPUT() {
  console.log('🧪 TESTING PUT HANDLER WITH FRESH MATCH\n');

  // Create a fresh test match (should have proper structure)
  console.log('1️⃣ Creating fresh test match...');
  const createEvent = {
    httpMethod: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "Fresh PUT Test Match",
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
  console.log('✅ Fresh match created with displayId:', createdMatch.displayId);

  // Check initial structure
  console.log('\n2️⃣ Checking initial structure...');
  const initialGetEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`
  };
  const initialGetResult = await handler(initialGetEvent, {});
  const initialMatch = JSON.parse(initialGetResult.body).data;

  console.log('Initial team1.players:', !!(initialMatch.team1 && initialMatch.team1.players));
  console.log('Initial team2.players:', !!(initialMatch.team2 && initialMatch.team2.players));

  // Update with squad data
  console.log('\n3️⃣ Updating with squad data...');
  const updateEvent = {
    httpMethod: 'PUT',
    path: `/${createdMatch.displayId}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      totalOvers: 20,
      squads: {
        "1": {
          teamId: "1",
          players: [
            { playerId: "test-player-1", name: "Test Player 1", role: "batsman" },
            { playerId: "test-player-2", name: "Test Player 2", role: "bowler" }
          ]
        },
        "2": {
          teamId: "2",
          players: [
            { playerId: "test-player-3", name: "Test Player 3", role: "batsman" },
            { playerId: "test-player-4", name: "Test Player 4", role: "all-rounder" }
          ]
        }
      }
    })
  };

  const updateResult = await handler(updateEvent, {});
  if (updateResult.statusCode !== 200) {
    console.error('❌ PUT failed');
    return;
  }
  console.log('✅ Match updated successfully');

  // Check final structure
  console.log('\n4️⃣ Checking final structure...');
  const finalGetEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`
  };
  const finalGetResult = await handler(finalGetEvent, {});
  const finalMatch = JSON.parse(finalGetResult.body).data;

  console.log('Final team1.players:', !!(finalMatch.team1 && finalMatch.team1.players));
  console.log('Final team2.players:', !!(finalMatch.team2 && finalMatch.team2.players));

  if (finalMatch.team1.players) {
    console.log('Team 1 players count:', finalMatch.team1.players.length);
    console.log('Team 1 players:', finalMatch.team1.players);
  }

  if (finalMatch.team2.players) {
    console.log('Team 2 players count:', finalMatch.team2.players.length);
    console.log('Team 2 players:', finalMatch.team2.players);
  }

  console.log('Root players array exists:', !!finalMatch.players);
  if (finalMatch.players) {
    console.log('Root players count:', finalMatch.players.length);
  }

  // Clean up
  console.log('\n🧹 Cleaning up...');
  const deleteEvent = {
    httpMethod: 'DELETE',
    path: `/${createdMatch.displayId}`
  };
  await handler(deleteEvent, {});

  console.log('✅ Test completed');
}

testFreshPUT().catch(console.error);