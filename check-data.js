const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function checkData() {
  try {
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).limit(1).get();
    const matchDoc = matchesSnapshot.docs[0];
    const matchData = matchDoc.data();

    console.log('Match document:');
    console.log('team1Id:', matchData.team1Id);
    console.log('team1.id:', matchData.team1?.id);
    console.log('team1.numericId:', matchData.team1?.numericId);

    console.log('team2Id:', matchData.team2Id);
    console.log('team2.id:', matchData.team2?.id);
    console.log('team2.numericId:', matchData.team2?.numericId);

    // Check squads
    const squadsSnapshot = await db.collection(V2_COLLECTIONS.MATCH_SQUADS).limit(2).get();
    console.log('\nSquad documents:');
    squadsSnapshot.docs.forEach((doc, index) => {
      const squadData = doc.data();
      console.log(`Squad ${index + 1}:`);
      console.log('  matchId:', squadData.matchId);
      console.log('  teamId:', squadData.teamId);
      console.log('  team.name:', squadData.team?.name);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();