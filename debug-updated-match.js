// Debug: Check what the updated match looks like in the database
const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function debugUpdatedMatch() {
  console.log('🔍 DEBUGGING UPDATED MATCH IN DATABASE\n');

  // Find the most recently created match (should be our test match)
  const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (matchesSnapshot.empty) {
    console.log('❌ No matches found');
    return;
  }

  const matchDoc = matchesSnapshot.docs[0];
  const matchData = matchDoc.data();

  console.log('Match ID:', matchDoc.id);
  console.log('Display ID:', matchData.displayId);
  console.log('Title:', matchData.title);

  console.log('\n📋 ALL FIELDS:');
  console.log(Object.keys(matchData).sort());

  console.log('\n🔍 KEY STRUCTURAL FIELDS:');
  const keyFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId', 'players'];
  keyFields.forEach(field => {
    console.log(`${field}: ${field in matchData}`);
    if (matchData[field] !== undefined) {
      console.log(`  Value: ${JSON.stringify(matchData[field], null, 2)}`);
    }
  });

  console.log('\n🏏 TEAM STRUCTURES:');
  console.log('team1 fields:', Object.keys(matchData.team1 || {}).sort());
  console.log('team2 fields:', Object.keys(matchData.team2 || {}).sort());

  if (matchData.team1 && matchData.team1.players) {
    console.log('team1.players:', matchData.team1.players.length, 'players');
    console.log('Sample team1 player:', JSON.stringify(matchData.team1.players[0], null, 2));
  }

  if (matchData.team2 && matchData.team2.players) {
    console.log('team2.players:', matchData.team2.players.length, 'players');
    console.log('Sample team2 player:', JSON.stringify(matchData.team2.players[0], null, 2));
  }

  if (matchData.players) {
    console.log('root players array:', matchData.players.length, 'players');
    console.log('Sample root player:', JSON.stringify(matchData.players[0], null, 2));
  }

  console.log('\n❌ CHECKING FOR BAD FIELDS:');
  const badFields = ['squads', 'totalOvers', 'currentInnings', 'scores', 'team1Score', 'team2Score', 'winner'];
  badFields.forEach(field => {
    if (field in matchData) {
      console.log(`❌ ${field} is present:`, matchData[field]);
    } else {
      console.log(`✅ ${field} is absent`);
    }
  });
}

debugUpdatedMatch().catch(console.error);