const { collections } = require('../config/database');

/**
 * Team Statistics Manager
 * Handles calculation and updating of team statistics and best players
 */
class TeamStatisticsManager {
  /**
   * Update team statistics after a match is completed
   * @param {string} matchId - The match ID
   * @param {Object} matchData - The match data
   */
  static async updateTeamStatistics(matchId, matchData) {
    try {
      console.log(`Updating team statistics for match ${matchId}`);

      // Handle both old format (matchData.teams) and new format (matchData.team1/team2)
      const team1 = matchData.team1 || matchData.teams?.team1;
      const team2 = matchData.team2 || matchData.teams?.team2;
      const { winner, result } = matchData;

      // Update team1 statistics
      if (team1 && team1.id) {
        await this.updateSingleTeamStatistics(team1.id, winner, team1.name);
      }

      // Update team2 statistics
      if (team2 && team2.id) {
        await this.updateSingleTeamStatistics(team2.id, winner, team2.name);
      }

      // Update best players for both teams
      await this.updateBestPlayers(matchId, matchData);

      console.log(`Team statistics updated for match ${matchId}`);
    } catch (error) {
      console.error(`Error updating team statistics for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Update statistics for a single team
   * @param {string} teamId - The team ID
   * @param {string} winner - The winner name
   * @param {string} teamName - The team name
   */
  static async updateSingleTeamStatistics(teamId, winner, teamName) {
    try {
      const teamDoc = await collections.teams.doc(teamId).get();
      if (!teamDoc.exists) {
        console.warn(`Team ${teamId} not found for statistics update`);
        return;
      }

      const teamData = teamDoc.data();
      const currentStats = teamData.statistics || {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winPercentage: 0
      };

      // Update match count
      currentStats.totalMatches += 1;

      // Update win/loss/draw based on result
      if (winner === teamName) {
        currentStats.wins += 1;
      } else if (winner && winner !== 'Draw') {
        currentStats.losses += 1;
      } else {
        currentStats.draws += 1;
      }

      // Calculate win percentage
      currentStats.winPercentage = currentStats.totalMatches > 0
        ? (currentStats.wins / currentStats.totalMatches) * 100
        : 0;

      // Update the team document
      await collections.teams.doc(teamId).update({
        statistics: currentStats,
        updatedAt: new Date().toISOString()
      });

      console.log(`Updated statistics for team ${teamName}:`, currentStats);
    } catch (error) {
      console.error(`Error updating statistics for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Update best players data for teams based on match performance
   * @param {string} matchId - The match ID
   * @param {Object} matchData - The match data
   */
  static async updateBestPlayers(matchId, matchData) {
    try {
      // Get innings data for the match
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      const playerStats = {
        batting: new Map(), // playerId -> {runs, balls, average}
        bowling: new Map(), // playerId -> {wickets, runs, economy}
        fielding: new Map() // playerId -> {catches, runouts}
      };

      // Process each inning
      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();

        // Process batsmen
        if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
          for (const batsman of inningData.batsmen) {
            if (!batsman.playerId) continue;

            const stats = playerStats.batting.get(batsman.playerId) || {
              totalRuns: 0,
              totalBalls: 0,
              innings: 0,
              average: 0
            };

            stats.totalRuns += batsman.runs || 0;
            stats.totalBalls += batsman.balls || 0;
            stats.innings += 1;
            stats.average = stats.innings > 0 ? stats.totalRuns / stats.innings : 0;

            playerStats.batting.set(batsman.playerId, stats);
          }
        }

        // Process bowlers
        if (inningData.bowling && Array.isArray(inningData.bowling)) {
          for (const bowler of inningData.bowling) {
            if (!bowler.playerId) continue;

            const stats = playerStats.bowling.get(bowler.playerId) || {
              totalWickets: 0,
              totalRuns: 0,
              totalOvers: 0,
              economy: 0
            };

            stats.totalWickets += bowler.wickets || 0;
            stats.totalRuns += bowler.runs || 0;
            stats.totalOvers += bowler.overs || 0;
            stats.economy = stats.totalOvers > 0 ? stats.totalRuns / stats.totalOvers : 0;

            playerStats.bowling.set(bowler.playerId, stats);
          }
        }
      }

      // Update best players for team1
      const team1 = matchData.team1 || matchData.teams?.team1;
      const team2 = matchData.team2 || matchData.teams?.team2;
      
      if (team1 && team1.id) {
        await this.updateTeamBestPlayers(team1.id, playerStats);
      }

      // Update best players for team2
      if (team2 && team2.id) {
        await this.updateTeamBestPlayers(team2.id, playerStats);
      }

    } catch (error) {
      console.error(`Error updating best players for match ${matchId}:`, error);
    }
  }

  /**
   * Update best players for a specific team
   * @param {string} teamId - The team ID
   * @param {Object} playerStats - Player statistics from the match
   */
  static async updateTeamBestPlayers(teamId, playerStats) {
    try {
      const teamDoc = await collections.teams.doc(teamId).get();
      if (!teamDoc.exists) return;

      const teamData = teamDoc.data();
      const currentBestPlayers = teamData.bestPlayers || {
        batsman: null,
        bowler: null,
        allRounder: null,
        wicketKeeper: null
      };

      // Get team players
      const teamPlayerIds = teamData.playerIds || [];

      // Find best batsman
      let bestBatsman = currentBestPlayers.batsman;
      for (const [playerId, stats] of playerStats.batting) {
        if (teamPlayerIds.includes(playerId)) {
          if (!bestBatsman || stats.average > bestBatsman.average) {
            const playerDoc = await collections.players.doc(playerId).get();
            if (playerDoc.exists) {
              bestBatsman = {
                id: playerId,
                name: playerDoc.data().name,
                average: stats.average,
                totalRuns: stats.totalRuns
              };
            }
          }
        }
      }

      // Find best bowler
      let bestBowler = currentBestPlayers.bowler;
      for (const [playerId, stats] of playerStats.bowling) {
        if (teamPlayerIds.includes(playerId)) {
          if (!bestBowler || stats.totalWickets > bestBowler.wickets) {
            const playerDoc = await collections.players.doc(playerId).get();
            if (playerDoc.exists) {
              bestBowler = {
                id: playerId,
                name: playerDoc.data().name,
                wickets: stats.totalWickets,
                economy: stats.economy
              };
            }
          }
        }
      }

      // Update best players in team document
      const updatedBestPlayers = {
        ...currentBestPlayers,
        batsman: bestBatsman,
        bowler: bestBowler
      };

      await collections.teams.doc(teamId).update({
        bestPlayers: updatedBestPlayers,
        updatedAt: new Date().toISOString()
      });

      console.log(`Updated best players for team ${teamData.name}`);
    } catch (error) {
      console.error(`Error updating best players for team ${teamId}:`, error);
    }
  }

  /**
   * Recalculate all team statistics from scratch
   * Useful for data migration or fixing corrupted stats
   */
  static async recalculateAllTeamStatistics() {
    try {
      console.log('Starting full team statistics recalculation...');

      // Reset all team statistics
      const teamsSnapshot = await collections.teams.get();
      const resetPromises = teamsSnapshot.docs.map(doc => {
        return collections.teams.doc(doc.id).update({
          statistics: {
            totalMatches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winPercentage: 0
          },
          bestPlayers: {
            batsman: null,
            bowler: null,
            allRounder: null,
            wicketKeeper: null
          },
          updatedAt: new Date().toISOString()
        });
      });

      await Promise.all(resetPromises);
      console.log('Reset all team statistics');

      // Recalculate from all completed matches
      const matchesSnapshot = await collections.matches.where('status', '==', 'completed').get();

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        await this.updateTeamStatistics(matchDoc.id, matchData);
      }

      console.log(`Recalculated statistics for ${matchesSnapshot.size} completed matches`);
    } catch (error) {
      console.error('Error recalculating team statistics:', error);
      throw error;
    }
  }
}

module.exports = { TeamStatisticsManager };