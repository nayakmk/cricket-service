// Check what's actually stored in the database for match 53
const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function checkDatabase() {
  console.log('🔍 CHECKING DATABASE CONTENT FOR MATCH 53\n');

  try {
    const match53Snapshot = await db.collection(V2_COLLECTIONS.MATCHES)
      .where('displayId', '==', 53)
      .limit(1)
      .get();

    if (match53Snapshot.empty) {
      console.log('❌ Match 53 not found');
      return;
    }

    const matchData = match53Snapshot.docs[0].data();

    console.log('📋 RAW DATABASE CONTENT:');
    console.log('All fields:', Object.keys(matchData).sort());

    console.log('\n🔍 KEY FIELDS IN DATABASE:');
    const keyFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId'];
    keyFields.forEach(field => {
      console.log(`${field}: ${field in matchData}`);
      if (matchData[field] !== undefined) {
        console.log(`  Type: ${typeof matchData[field]}, Value:`, matchData[field]);
      }
    });

    console.log('\n🏏 TEAM DATA IN DATABASE:');
    console.log('team1 fields:', Object.keys(matchData.team1 || {}).sort());
    console.log('team2 fields:', Object.keys(matchData.team2 || {}).sort());

    if (matchData.team1 && matchData.team1.players) {
      console.log('team1.players count:', matchData.team1.players.length);
    }
    if (matchData.team2 && matchData.team2.players) {
      console.log('team2.players count:', matchData.team2.players.length);
    }

  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabase().catch(console.error);