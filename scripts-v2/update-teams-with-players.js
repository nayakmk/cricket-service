/**
 * Update Teams with Playe      for (const match of matches) {
        console.log(`Checking match: matchId=${JSON.stringify(match.matchId)}, id=${match.id}`);

        // Skip matches with undefined or null matchId
        if (match.matchId === undefined || match.matchId === null || match.matchId === '') {
          console.log(`⚠️  Skipping match with invalid matchId (doc ID: ${match.id})`);
          continue;
        }

        console.log(`Processing match: ${match.matchId}`);

        // Get match squads for this match
        const squadsSnapshot = await this.db.collection(V2_COLLECTIONS.MATCH_SQUADS)
          .where('matchId', '==', match.matchId)
          .get();
 * Populates the teams.players array with player data for v2 collections
 */

const admin = require('firebase-admin');
const { V2_COLLECTIONS, V2_SCHEMAS } = require('../config/database-v2');

class TeamPlayersUpdater {
  constructor() {
    this.db = admin.firestore();
    this.batchSize = 10;
  }

  async updateTeamsWithPlayers() {
    console.log('🚀 Starting Team Players Update...');

    try {
      // Get all match squads directly to build team-player relationships
      const squadsSnapshot = await this.db.collection(V2_COLLECTIONS.MATCH_SQUADS).get();
      const squads = squadsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`Found ${squads.length} match squads to process`);

      // Build team-player mapping from squad data
      const teamPlayersMap = new Map();

      for (const squad of squads) {
        const teamId = squad.team?.teamId;
        if (!teamId) {
          console.log(`⚠️  Skipping squad ${squad.id} - no teamId found`);
          continue;
        }

        if (!teamPlayersMap.has(teamId)) {
          teamPlayersMap.set(teamId, new Map());
        }

        // Add all players from this squad to the team
        for (const player of squad.players || []) {
          teamPlayersMap.get(teamId).set(player.playerId, {
            playerId: player.playerId,
            name: player.name,
            role: player.role,
            battingStyle: player.battingStyle,
            avatar: player.avatar || null
          });
        }
      }

      console.log(`Built team-player mapping for ${teamPlayersMap.size} teams`);

      // Now update each team with their players
      const teamsSnapshot = await this.db.collection(V2_COLLECTIONS.TEAMS).get();
      const teams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ref: doc.ref,
        ...doc.data()
      }));

      console.log(`Found ${teams.length} teams to update`);

      let updatedCount = 0;
      let errorCount = 0;

      for (const team of teams) {
        try {
          console.log(`Updating team: ${team.name} (${team.numericId})`);

          const teamPlayerMap = teamPlayersMap.get(team.numericId);
          const teamPlayers = teamPlayerMap ? Array.from(teamPlayerMap.values()) : [];

          console.log(`Found ${teamPlayers.length} players in matches for team ${team.name} (${team.numericId})`);

          if (teamPlayers.length === 0) {
            console.log(`⚠️  No players found for team ${team.name}, skipping update`);
            continue;
          }

          // Get stats for each player
          const playersWithStats = [];
          for (const player of teamPlayers) {
            const playerStats = await this.getPlayerStatsForTeam(player.playerId, team.numericId);

            playersWithStats.push({
              playerId: player.playerId,
              player: player,
              matchesPlayed: playerStats.matchesPlayed,
              totalRuns: playerStats.totalRuns,
              totalWickets: playerStats.totalWickets,
              lastPlayed: playerStats.lastPlayed || admin.firestore.Timestamp.now(),
              isCaptain: player.playerId === team.captainId,
              isViceCaptain: player.playerId === team.viceCaptainId
            });
          }

          // Sort players by name
          playersWithStats.sort((a, b) => a.player.name.localeCompare(b.player.name));

          // Update team with players
          await team.ref.update({
            players: playersWithStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ Updated ${team.name} with ${playersWithStats.length} players`);
          updatedCount++;

        } catch (error) {
          console.error(`❌ Failed to update team ${team.name}:`, error);
          errorCount++;
        }
      }

      console.log(`\n🎉 Team Players Update Summary:`);
      console.log(`Updated: ${updatedCount}/${teams.length} teams`);
      console.log(`Errors: ${errorCount}`);

      if (errorCount === 0) {
        console.log('\n✅ All teams updated successfully!');
      }

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  async getPlayerStatsForTeam(playerId, teamId) {
    // Get matches where this player participated for this team
    const matchSquadsSnapshot = await this.db.collection(V2_COLLECTIONS.MATCH_SQUADS)
      .where('teamId', '==', teamId)
      .get();

    let matchesPlayed = 0;
    let totalRuns = 0;
    let totalWickets = 0;
    let lastPlayed = null;

    for (const squadDoc of matchSquadsSnapshot.docs) {
      const squadData = squadDoc.data();

      // Check if player is in this squad
      const playerInSquad = squadData.players?.find(p => p.playerId === playerId);
      if (playerInSquad) {
        matchesPlayed++;

        // Add batting stats
        if (playerInSquad.batting) {
          totalRuns += playerInSquad.batting.runs || 0;
        }

        // Add bowling stats
        if (playerInSquad.bowling) {
          totalWickets += playerInSquad.bowling.wickets || 0;
        }

        // Track last played date
        if (squadData.createdAt && (!lastPlayed || squadData.createdAt > lastPlayed)) {
          lastPlayed = squadData.createdAt;
        }
      }
    }

    return {
      matchesPlayed,
      totalRuns,
      totalWickets,
      lastPlayed
    };
  }
}

// Main execution function
async function updateTeamsWithPlayers() {
  const updater = new TeamPlayersUpdater();

  try {
    await updater.updateTeamsWithPlayers();
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { TeamPlayersUpdater, updateTeamsWithPlayers };

// Run if called directly
if (require.main === module) {
  updateTeamsWithPlayers();
}