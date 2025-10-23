const { db, V2_COLLECTIONS } = require('../config/database-v2');

async function checkV2TeamStats() {
  try {
    console.log('🔍 Checking v2 team statistics...\n');

    const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).limit(3).get();

    if (teamsSnapshot.empty) {
      console.log('❌ No teams found in v2 collections');
      return;
    }

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      console.log(`Team: ${teamData.name} (${teamData.displayId})`);
      console.log(`  Has statistics: ${!!teamData.statistics}`);
      console.log(`  Has matchHistory: ${!!teamData.matchHistory}`);
      console.log(`  Has bestPlayers: ${!!teamData.bestPlayers}`);

      if (teamData.statistics) {
        console.log(`  Statistics keys: ${Object.keys(teamData.statistics).join(', ')}`);
        if (teamData.statistics.totalMatches !== undefined) {
          console.log(`  Total matches: ${teamData.statistics.totalMatches}`);
          console.log(`  Wins: ${teamData.statistics.wins || 0}`);
          console.log(`  Losses: ${teamData.statistics.losses || 0}`);
        }
      }

      if (teamData.matchHistory) {
        console.log(`  Match history length: ${teamData.matchHistory.length}`);
      }

      console.log('');
    }

  } catch (error) {
    console.error('Error checking v2 team stats:', error);
  }
}

checkV2TeamStats();