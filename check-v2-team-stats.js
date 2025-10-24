const { db, V2_COLLECTIONS } = require('./config/database-v2');

/**
 * Script to check if v2 team collections have statistics populated
 */
async function checkV2TeamStats() {
  try {
    console.log('Checking v2 team statistics...');

    const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();

    console.log(`Found ${teamsSnapshot.size} teams in v2 collection`);

    let teamsWithStats = 0;
    let teamsWithMatchHistory = 0;
    let teamsWithBestPlayers = 0;

    for (const doc of teamsSnapshot.docs) {
      const teamData = doc.data();
      const teamName = teamData.name || `Team ${teamData.numericId}`;

      console.log(`\nTeam: ${teamName} (ID: ${doc.id})`);

      // Check statistics
      const hasStats = teamData.statistics && Object.keys(teamData.statistics).length > 0;
      console.log(`  Statistics: ${hasStats ? '✅' : '❌'}`);
      if (hasStats) {
        teamsWithStats++;
        console.log(`    Total Matches: ${teamData.statistics.totalMatches || 0}`);
        console.log(`    Wins: ${teamData.statistics.wins || 0}`);
        console.log(`    Losses: ${teamData.statistics.losses || 0}`);
        console.log(`    Win Percentage: ${teamData.statistics.winPercentage?.toFixed(1) || 0}%`);
      }

      // Check match history
      const hasMatchHistory = teamData.matchHistory && teamData.matchHistory.length > 0;
      console.log(`  Match History: ${hasMatchHistory ? '✅' : '❌'}`);
      if (hasMatchHistory) {
        teamsWithMatchHistory++;
        console.log(`    Match History Count: ${teamData.matchHistory.length}`);
      }

      // Check best players
      const hasBestPlayers = teamData.bestPlayers && Object.keys(teamData.bestPlayers).length > 0;
      console.log(`  Best Players: ${hasBestPlayers ? '✅' : '❌'}`);
      if (hasBestPlayers) {
        teamsWithBestPlayers++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total Teams: ${teamsSnapshot.size}`);
    console.log(`Teams with Statistics: ${teamsWithStats} (${((teamsWithStats/teamsSnapshot.size)*100).toFixed(1)}%)`);
    console.log(`Teams with Match History: ${teamsWithMatchHistory} (${((teamsWithMatchHistory/teamsSnapshot.size)*100).toFixed(1)}%)`);
    console.log(`Teams with Best Players: ${teamsWithBestPlayers} (${((teamsWithBestPlayers/teamsSnapshot.size)*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('Error checking v2 team stats:', error);
  }
}

// Run the check if this script is executed directly
if (require.main === module) {
  checkV2TeamStats();
}

module.exports = { checkV2TeamStats };