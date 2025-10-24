const admin = require('firebase-admin');
const { V2_COLLECTIONS } = require('../config/database-v2');

async function checkData() {
  try {
    // Check a specific team that should have players
    const teamDoc = await admin.firestore().collection(V2_COLLECTIONS.TEAMS)
      .where('numericId', '==', '1000000000000000002')
      .limit(1)
      .get();

    if (!teamDoc.empty) {
      const team = teamDoc.docs[0].data();
      console.log('Team:', team.name, 'Players:', team.players ? team.players.length : 0);

      // Check players for this team
      const playersSnapshot = await admin.firestore().collection(V2_COLLECTIONS.PLAYERS)
        .where('preferredTeamId', '==', '1000000000000000002')
        .get();

      console.log(`Players in DB for this team: ${playersSnapshot.size}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();