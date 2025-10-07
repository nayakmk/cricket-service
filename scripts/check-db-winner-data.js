const { collections } = require('../config/database');

async function checkDatabaseWinnerData() {
  try {
    console.log('CHECKING DATABASE WINNER DATA');
    console.log('==============================');

    // Get all completed matches
    const completedMatchesSnapshot = await collections.matches
      .where('status', '==', 'completed')
      .limit(5)
      .get();

    console.log(`Found ${completedMatchesSnapshot.size} completed matches`);

    for (const doc of completedMatchesSnapshot.docs) {
      const matchData = doc.data();
      console.log(`\nMatch: ${matchData.numericId || doc.id}`);
      console.log(`Title: ${matchData.title}`);
      console.log(`Winner field:`, matchData.winner);
      console.log(`Result field:`, matchData.result);
      console.log(`Status: ${matchData.status}`);

      // Check if winner is a team ID reference
      if (matchData.winner) {
        try {
          const winnerTeamDoc = await collections.teams.doc(matchData.winner).get();
          if (winnerTeamDoc.exists) {
            console.log(`Winner team name: ${winnerTeamDoc.data().name}`);
          }
        } catch (error) {
          console.log(`Error getting winner team: ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('Error checking database winner data:', error);
  }
}

checkDatabaseWinnerData();