/**
 * Update Players with Preferred Team ID
 *
 * Sets the preferredTeamId for players based on their team associations
 */

const admin = require('firebase-admin');
const { V2_COLLECTIONS } = require('../config/database-v2');

class PlayersPreferredTeamUpdater {
  constructor() {
    this.db = admin.firestore();
    this.batchSize = 10;
  }

  async updatePlayersPreferredTeam() {
    console.log('🚀 Starting Players Preferred Team Update...');

    try {
      // Get all players
      const playersSnapshot = await this.db.collection(V2_COLLECTIONS.PLAYERS).get();
      const players = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        ref: doc.ref,
        ...doc.data()
      }));

      console.log(`Found ${players.length} players to update`);

      let updatedCount = 0;
      let errorCount = 0;

      for (const player of players) {
        try {
          // If player already has preferredTeamId, skip
          if (player.preferredTeamId) {
            continue;
          }

          // Find the player's preferred team from match squads
          const preferredTeamId = await this.findPlayerPreferredTeam(player.numericId);

          if (preferredTeamId) {
            await player.ref.update({
              preferredTeamId: preferredTeamId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Updated ${player.name} with preferredTeamId: ${preferredTeamId}`);
            updatedCount++;
          } else {
            console.log(`⚠️  No preferred team found for ${player.name}`);
          }

        } catch (error) {
          console.error(`❌ Failed to update player ${player.name}:`, error);
          errorCount++;
        }
      }

      console.log(`\n🎉 Players Preferred Team Update Summary:`);
      console.log(`Updated: ${updatedCount}/${players.length} players`);
      console.log(`Errors: ${errorCount}`);

      if (errorCount === 0) {
        console.log('\n✅ All players updated successfully!');
      }

    } catch (error) {
      console.error('Update failed:', error);
      throw error;
    }
  }

  async findPlayerPreferredTeam(playerId) {
    // Get the player document to check recentTeams
    const playerQuery = await this.db.collection(V2_COLLECTIONS.PLAYERS)
      .where('numericId', '==', playerId)
      .limit(1)
      .get();

    if (playerQuery.empty) {
      return null;
    }

    const playerData = playerQuery.docs[0].data();
    const recentTeams = playerData.recentTeams || [];

    if (recentTeams.length === 0) {
      return null;
    }

    // Find the team with the most matches played
    const sortedTeams = recentTeams.sort((a, b) => b.matchesPlayed - a.matchesPlayed);
    return sortedTeams[0].teamId;
  }
}

// Main execution function
async function updatePlayersPreferredTeam() {
  const updater = new PlayersPreferredTeamUpdater();

  try {
    await updater.updatePlayersPreferredTeam();
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { PlayersPreferredTeamUpdater, updatePlayersPreferredTeam };

// Run if called directly
if (require.main === module) {
  updatePlayersPreferredTeam();
}