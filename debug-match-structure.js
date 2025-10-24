// Debug: Check the actual structure of a newly created match
const handler = require('./netlify/functions/matches-v2.js').handler;

async function debugMatchStructure() {
  console.log('🔍 DEBUGGING MATCH STRUCTURE\n');

  // Create a test match
  const createEvent = {
    httpMethod: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "Debug Match",
      matchType: "T20",
      venue: "Debug Stadium",
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

  // Retrieve it
  const getEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`
  };

  const getResult = await handler(getEvent, {});
  const retrievedMatch = JSON.parse(getResult.body).data;

  console.log('\n📋 ACTUAL MATCH STRUCTURE:');
  console.log('All fields:', Object.keys(retrievedMatch).sort());

  console.log('\n🔍 KEY FIELDS CHECK:');
  const keyFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId'];
  keyFields.forEach(field => {
    console.log(`${field}: ${field in retrievedMatch} (${typeof retrievedMatch[field]})`);
    if (retrievedMatch[field] !== undefined) {
      console.log(`  Value: ${JSON.stringify(retrievedMatch[field])}`);
    }
  });

  console.log('\n🏏 TEAM STRUCTURE:');
  console.log('team1 fields:', Object.keys(retrievedMatch.team1 || {}).sort());
  console.log('team2 fields:', Object.keys(retrievedMatch.team2 || {}).sort());

  console.log('team1 has players:', !!(retrievedMatch.team1 && retrievedMatch.team1.players));
  console.log('team2 has players:', !!(retrievedMatch.team2 && retrievedMatch.team2.players));

  // Clean up
  const deleteEvent = {
    httpMethod: 'DELETE',
    path: `/${createdMatch.displayId}`
  };
  await handler(deleteEvent, {});
  console.log('\n🧹 Test match cleaned up');
}

debugMatchStructure().catch(console.error);