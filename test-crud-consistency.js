// Final verification: Test all CRUD operations for structural consistency
const handler = require('./netlify/functions/matches-v2.js').handler;

async function testCRUDOperations() {
  console.log('🧪 TESTING CRUD OPERATIONS FOR STRUCTURAL CONSISTENCY\n');

  // Test 1: Create a new match
  console.log('1️⃣  Testing POST (Create Match)...');
  const createEvent = {
    httpMethod: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "CRUD Test Match",
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
    console.error('❌ POST failed:', createResult.statusCode);
    return;
  }

  const createdMatch = JSON.parse(createResult.body).data;
  console.log('✅ Match created with displayId:', createdMatch.displayId);

  // Test 2: Read the created match
  console.log('\n2️⃣  Testing GET (Read Match)...');
  const getEvent = {
    httpMethod: 'GET',
    path: `/${createdMatch.displayId}`
  };

  const getResult = await handler(getEvent, {});
  if (getResult.statusCode !== 200) {
    console.error('❌ GET failed:', getResult.statusCode);
    return;
  }

  const retrievedMatch = JSON.parse(getResult.body).data;
  console.log('✅ Match retrieved successfully');

  // Test 3: Update the match
  console.log('\n3️⃣  Testing PUT (Update Match)...');
  const updateEvent = {
    httpMethod: 'PUT',
    path: `/${createdMatch.displayId}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: "in_progress",
      venue: "Updated Stadium"
    })
  };

  const updateResult = await handler(updateEvent, {});
  if (updateResult.statusCode !== 200) {
    console.error('❌ PUT failed:', updateResult.statusCode);
    return;
  }

  console.log('✅ Match updated successfully');

  // Test 4: List matches
  console.log('\n4️⃣  Testing GET (List Matches)...');
  const listEvent = {
    httpMethod: 'GET',
    path: '/'
  };

  const listResult = await handler(listEvent, {});
  if (listResult.statusCode !== 200) {
    console.error('❌ LIST failed:', listResult.statusCode);
    return;
  }

  const matchesList = JSON.parse(listResult.body).data;
  console.log(`✅ Retrieved ${matchesList.length} matches`);

  // Test 5: Delete the test match
  console.log('\n5️⃣  Testing DELETE...');
  const deleteEvent = {
    httpMethod: 'DELETE',
    path: `/${createdMatch.displayId}`
  };

  const deleteResult = await handler(deleteEvent, {});
  if (deleteResult.statusCode !== 200) {
    console.error('❌ DELETE failed:', deleteResult.statusCode);
    return;
  }

  console.log('✅ Match deleted successfully');

  // Verify structural consistency
  console.log('\n🔍 STRUCTURAL CONSISTENCY CHECK:');
  const requiredFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId'];
  const hasAllFields = requiredFields.every(field => field in retrievedMatch);

  console.log('Required game data fields present:', hasAllFields);
  console.log('Team structures include players:', !!(retrievedMatch.team1.players && retrievedMatch.team2.players));
  console.log('Innings initialized as array:', Array.isArray(retrievedMatch.innings));
  console.log('Fall of wickets initialized as array:', Array.isArray(retrievedMatch.fallOfWickets));

  if (hasAllFields) {
    console.log('\n🎉 ALL CRUD OPERATIONS WORKING AND STRUCTURALLY CONSISTENT!');
  } else {
    console.log('\n⚠️  SOME STRUCTURAL ISSUES REMAIN');
  }
}

testCRUDOperations().catch(console.error);