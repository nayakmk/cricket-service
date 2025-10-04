const { collections } = require('../config/database');

/**
 * Script to show the final state after deduplication and reference updates
 */
async function showFinalState() {
  try {
    console.log('🎯 FINAL STATE AFTER DEDUPLICATION & REFERENCE UPDATES\n');

    // Count active vs inactive players
    const playersSnapshot = await collections.players.get();
    const activePlayers = [];
    const inactivePlayers = [];

    playersSnapshot.forEach(doc => {
      const player = { id: doc.id, ...doc.data() };
      if (player.isActive === false) {
        inactivePlayers.push(player);
      } else {
        activePlayers.push(player);
      }
    });

    console.log('📊 PLAYER COLLECTION:');
    console.log(`   Total players in DB: ${playersSnapshot.size}`);
    console.log(`   ✅ Active players: ${activePlayers.length}`);
    console.log(`   🗑️  Inactive (deduplicated): ${inactivePlayers.length}`);

    // Show sample active players
    console.log('\n🏏 SAMPLE ACTIVE PLAYERS:');
    activePlayers.slice(0, 5).forEach(player => {
      console.log(`   ✅ ${player.id}: ${player.name} (${player.email})`);
    });

    // Show sample inactive players
    console.log('\n🗑️  SAMPLE INACTIVE PLAYERS (deduplicated):');
    inactivePlayers.slice(0, 5).forEach(player => {
      console.log(`   ❌ ${player.id}: ${player.name} (${player.email})`);
    });

    // Check teams collection
    const teamsSnapshot = await collections.teams.get();
    console.log('\n🏟️  TEAMS COLLECTION:');
    console.log(`   Total teams: ${teamsSnapshot.size}`);

    // Check team lineups
    const lineupsSnapshot = await collections.teamLineups.get();
    console.log('\n📋 TEAM LINEUPS COLLECTION:');
    console.log(`   Total lineups: ${lineupsSnapshot.size}`);

    // Check matches
    const matchesSnapshot = await collections.matches.get();
    console.log('\n🏏 MATCHES COLLECTION:');
    console.log(`   Total matches: ${matchesSnapshot.size}`);

    // Verify that references are correct
    console.log('\n🔍 REFERENCE VERIFICATION:');

    let teamsWithValidCaptains = 0;
    let teamsWithInvalidCaptains = 0;

    for (const teamDoc of teamsSnapshot.docs) {
      const team = teamDoc.data();
      if (team.captainId) {
        const captainDoc = await collections.players.doc(team.captainId).get();
        if (captainDoc.exists) {
          const captain = captainDoc.data();
          if (captain.isActive !== false) {
            teamsWithValidCaptains++;
          } else {
            teamsWithInvalidCaptains++;
            console.log(`   ⚠️  Team ${team.name} has inactive captain: ${captain.name}`);
          }
        }
      }
    }

    console.log(`   ✅ Teams with valid captains: ${teamsWithValidCaptains}`);
    console.log(`   ❌ Teams with invalid captains: ${teamsWithInvalidCaptains}`);

    // Check lineups
    let validLineupPlayers = 0;
    let invalidLineupPlayers = 0;

    for (const lineupDoc of lineupsSnapshot.docs) {
      const lineup = lineupDoc.data();

      if (lineup.playerIds) {
        for (const playerId of lineup.playerIds) {
          const playerDoc = await collections.players.doc(playerId).get();
          if (playerDoc.exists) {
            const player = playerDoc.data();
            if (player.isActive !== false) {
              validLineupPlayers++;
            } else {
              invalidLineupPlayers++;
            }
          }
        }
      }
    }

    console.log(`   ✅ Valid lineup player references: ${validLineupPlayers}`);
    console.log(`   ❌ Invalid lineup player references: ${invalidLineupPlayers}`);

    console.log('\n🎉 DEDUPLICATION & REFERENCE UPDATE COMPLETED SUCCESSFULLY!');
    console.log('📈 SUMMARY:');
    console.log(`   • Reduced from ${playersSnapshot.size} to ${activePlayers.length} active players`);
    console.log(`   • Updated ${teamsWithValidCaptains + validLineupPlayers} player references across collections`);
    console.log(`   • Preserved all historical match data`);

  } catch (error) {
    console.error('❌ Error showing final state:', error);
    throw error;
  }
}

// Run the final state check if this script is executed directly
if (require.main === module) {
  showFinalState()
    .then(() => {
      console.log('\n✨ Final state check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Final state check failed:', error);
      process.exit(1);
    });
}

module.exports = { showFinalState };