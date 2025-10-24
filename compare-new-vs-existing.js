// Create a new match and compare its structure with existing matches
const handler = require('./netlify/functions/matches-v2.js').handler;

// Create a new match
const createMatch = async () => {
  const testEvent = {
    httpMethod: 'POST',
    path: '/',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: "Structure Test Match",
      matchType: "T20",
      venue: "Test Stadium",
      scheduledDate: new Date().toISOString(),
      team1Id: "1",
      team2Id: "2",
      tournamentId: "GEN2025",
      status: "scheduled"
    })
  };

  const result = await handler(testEvent, {});
  if (result.statusCode === 201) {
    const data = JSON.parse(result.body);
    console.log('✅ New match created with displayId:', data.data.displayId);
    return data.data.displayId;
  } else {
    console.error('❌ Failed to create match:', result.statusCode);
    return null;
  }
};

// Compare structures
const compareStructures = async (newDisplayId) => {
  const { db, V2_COLLECTIONS } = require('./config/database-v2');

  // Get existing match
  const existingSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).limit(1).get();
  const existingDoc = existingSnapshot.docs[0];
  const existingData = existingDoc.data();

  // Get new match
  const newMatchSnapshot = await db.collection(V2_COLLECTIONS.MATCHES)
    .where('displayId', '==', newDisplayId)
    .limit(1)
    .get();

  if (newMatchSnapshot.empty) {
    console.log('❌ New match not found');
    return;
  }

  const newDoc = newMatchSnapshot.docs[0];
  const newData = newDoc.data();

  console.log('\n🔍 STRUCTURE COMPARISON:');
  console.log('=====================================');

  const existingFields = Object.keys(existingData).sort();
  const newFields = Object.keys(newData).sort();

  console.log(`Existing match fields (${existingFields.length}):`, existingFields);
  console.log(`New match fields (${newFields.length}):`, newFields);

  const missingInNew = existingFields.filter(f => !newFields.includes(f));
  const extraInNew = newFields.filter(f => !existingFields.includes(f));

  console.log('\n📊 FIELD ANALYSIS:');
  console.log('Fields missing in new match:', missingInNew);
  console.log('Extra fields in new match:', extraInNew);

  console.log('\n🔄 KEY DIFFERENCES:');

  // Check nested structures
  console.log('Existing match has innings:', !!existingData.innings, 'length:', existingData.innings?.length || 0);
  console.log('New match has innings:', !!newData.innings, 'length:', newData.innings?.length || 0);

  console.log('Existing match has fallOfWickets:', !!existingData.fallOfWickets);
  console.log('New match has fallOfWickets:', !!newData.fallOfWickets);

  console.log('Existing match has detailed players array:', !!existingData.players, 'length:', existingData.players?.length || 0);
  console.log('New match has players array:', !!newData.players, 'length:', newData.players?.length || 0);

  console.log('Existing match has toss:', !!existingData.toss);
  console.log('New match has toss:', !!newData.toss);

  console.log('Existing match has result:', !!existingData.result);
  console.log('New match has result:', !!newData.result);

  // Check team structures
  console.log('\n🏏 TEAM STRUCTURE COMPARISON:');
  console.log('Existing team1 structure:', Object.keys(existingData.team1 || {}).sort());
  console.log('New team1 structure:', Object.keys(newData.team1 || {}).sort());

  if (missingInNew.length === 0 && extraInNew.length === 0) {
    console.log('\n✅ STRUCTURES ARE CONSISTENT');
  } else {
    console.log('\n⚠️  STRUCTURES HAVE DIFFERENCES');
    console.log('The new CRUD API creates basic match structures, while existing matches have detailed game data.');
  }
};

// Main execution
const runComparison = async () => {
  console.log('🚀 Creating new match for structure comparison...\n');

  const newDisplayId = await createMatch();
  if (newDisplayId) {
    await compareStructures(newDisplayId);
  }
};

runComparison().catch(console.error);