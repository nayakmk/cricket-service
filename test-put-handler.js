// Test the fixed PUT handler with squad data
const handler = require('./netlify/functions/matches-v2.js').handler;

async function testPUTHandler() {
  console.log('🧪 TESTING FIXED PUT HANDLER WITH SQUAD DATA\n');

  // Create a test match
  console.log('1️⃣ Creating test match...');
  const createEvent = {
    httpMethod: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "PUT Test Match",
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
  if (createResult.statusCode !== 201) {
    console.error('❌ Failed to create test match');
    return;
  }

  const createdMatch = JSON.parse(createResult.body).data;
  console.log('✅ Test match created with displayId:', createdMatch.displayId);

  // Update with squad data (similar to the problematic request)
  console.log('\n2️⃣ Updating match with squad data...');
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
            { playerId: "DvXj1xu69dNcTr1OyLys", name: "Abinash Subudhi", role: "batsman" },
            { playerId: "2gHjBfHAzrxjYndrWxKp", name: "Amit Jain", role: "batsman" }
          ]
        },
        "2": {
          teamId: "2",
          players: [
            { playerId: "G1hCyyltz5Td9SmIW4dA", name: "Archana Sinha", role: "batsman" },
            { playerId: "5OEu3eiWWrqCAinlwkJX", name: "Ashutosh Sahoo", role: "batsman" }
          ]
        }
      }
    })
  };

  const updateResult = await handler(updateEvent, {});
  if (updateResult.statusCode !== 200) {
    console.error('❌ PUT failed:', updateResult.statusCode);
    console.error('Response:', updateResult.body);
    return;
  }

  console.log('✅ Match updated successfully');

  // Retrieve and verify the updated match
  console.log('\n3️⃣ Retrieving updated match to verify structure...');
  const getEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`,
    queryStringParameters: { includePlayers: 'true' }
  };

  const getResult = await handler(getEvent, {});
  if (getResult.statusCode !== 200) {
    console.error('❌ GET failed:', getResult.statusCode);
    return;
  }

  const retrievedMatch = JSON.parse(getResult.body).data;

  console.log('\n🔍 STRUCTURE VERIFICATION:');
  console.log('Required fields present:');
  const requiredFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId'];
  requiredFields.forEach(field => {
    console.log(`  ${field}: ${field in retrievedMatch} (${typeof retrievedMatch[field]})`);
  });

  console.log('\nTeam structures:');
  console.log('  team1 has players:', !!(retrievedMatch.team1 && retrievedMatch.team1.players));
  console.log('  team2 has players:', !!(retrievedMatch.team2 && retrievedMatch.team2.players));
  console.log('  root players array exists:', !!retrievedMatch.players);

  console.log('\n❌ Fields that should NOT be present:');
  const badFields = ['squads', 'totalOvers', 'currentInnings', 'scores', 'team1Score', 'team2Score', 'winner'];
  badFields.forEach(field => {
    if (field in retrievedMatch) {
      console.log(`  ${field}: PRESENT ❌`);
    } else {
      console.log(`  ${field}: absent ✅`);
    }
  });

  // Check if squad data was properly transformed
  if (retrievedMatch.team1.players && retrievedMatch.team1.players.length > 0) {
    console.log('\n✅ Squad data properly transformed:');
    console.log('  Team 1 players:', retrievedMatch.team1.players.length);
    console.log('  Team 2 players:', retrievedMatch.team2.players.length);
  }

  // Clean up
  console.log('\n🧹 Cleaning up test match...');
  const deleteEvent = {
    httpMethod: 'DELETE',
    path: `/${createdMatch.displayId}`
  };
  await handler(deleteEvent, {});

  console.log('✅ Test completed successfully');
}

testPUTHandler().catch(console.error);