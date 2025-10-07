const { collections } = require('../config/database');

/**
 * Script to populate team player relationships
 * This will aggregate all unique players from match squads and set playerIds and playersCount
 */
async function populateTeamPlayers() {
  try {
    console.log('Starting team players population...');

    // Get all teams
    const teamsSnapshot = await collections.teams.get();

    console.log(`Found ${teamsSnapshot.size} teams to process`);

    // Process each team
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      console.log(`Processing team: ${teamData.name} (${teamDoc.id})`);

      try {
        // Get all match squads for this team
        const matchSquadsSnapshot = await collections.teams.doc(teamDoc.id).collection('matchSquads').get();

        // Collect all unique player IDs
        const uniquePlayerIds = new Set();

        for (const squadDoc of matchSquadsSnapshot.docs) {
          const squadData = squadDoc.data();
          if (squadData.playerIds && Array.isArray(squadData.playerIds)) {
            squadData.playerIds.forEach(playerId => uniquePlayerIds.add(playerId));
          }
        }

        const playerIdsArray = Array.from(uniquePlayerIds);
        const playersCount = playerIdsArray.length;

        // Update the team document with player information
        await collections.teams.doc(teamDoc.id).update({
          playerIds: playerIdsArray,
          playersCount: playersCount,
          updatedAt: new Date().toISOString()
        });

        console.log(`Updated team ${teamData.name}: ${playersCount} players, IDs: ${playerIdsArray.slice(0, 3).join(', ')}${playerIdsArray.length > 3 ? '...' : ''}`);

      } catch (error) {
        console.error(`Error processing team ${teamData.name}:`, error);
      }
    }

    console.log('Team players population completed successfully!');

  } catch (error) {
    console.error('Failed to populate team players:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  populateTeamPlayers();
}

module.exports = { populateTeamPlayers };