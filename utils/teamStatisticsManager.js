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
        await this.updateSingleTeamStatistics(team1.id, winner, team1.name, matchData);
      }

      // Update team2 statistics
      if (team2 && team2.id) {
        await this.updateSingleTeamStatistics(team2.id, winner, team2.name, matchData);
      }

      // Update best players for both teams
      await this.updateBestPlayers(matchId, matchData);

      // Update match history for both teams
      await this.updateTeamMatchHistory(matchId, matchData);

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
   * @param {Object} matchData - The complete match data
   */
  static async updateSingleTeamStatistics(teamId, winner, teamName, matchData) {
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
        winPercentage: 0,
        currentStreak: { type: 'none', count: 0 },
        longestWinStreak: 0,
        longestLossStreak: 0,
        recentMatches: [],
        form: [] // Last 5 matches: W, L, D
      };

      // Update match count
      currentStats.totalMatches += 1;

      // Determine result for this team
      let result;
      if (winner === teamName) {
        currentStats.wins += 1;
        result = 'W';
      } else if (winner && winner !== 'Draw') {
        currentStats.losses += 1;
        result = 'L';
      } else {
        currentStats.draws += 1;
        result = 'D';
      }

      // Calculate win percentage
      currentStats.winPercentage = currentStats.totalMatches > 0
        ? (currentStats.wins / currentStats.totalMatches) * 100
        : 0;

      // Update current streak
      if (result === 'W') {
        if (currentStats.currentStreak.type === 'win') {
          currentStats.currentStreak.count += 1;
        } else {
          currentStats.currentStreak = { type: 'win', count: 1 };
        }
        currentStats.longestWinStreak = Math.max(currentStats.longestWinStreak, currentStats.currentStreak.count);
      } else if (result === 'L') {
        if (currentStats.currentStreak.type === 'loss') {
          currentStats.currentStreak.count += 1;
        } else {
          currentStats.currentStreak = { type: 'loss', count: 1 };
        }
        currentStats.longestLossStreak = Math.max(currentStats.longestLossStreak, currentStats.currentStreak.count);
      } else {
        currentStats.currentStreak = { type: 'draw', count: 1 };
      }

      // Add to recent matches (keep last 10)
      const recentMatch = {
        matchId: matchData.id || matchData.numericId,
        date: matchData.scheduledDate || matchData.date,
        opponent: teamName === matchData.team1?.name ? matchData.team2?.name : matchData.team1?.name,
        result: result,
        winner: winner,
        venue: matchData.venue,
        status: matchData.status
      };

      currentStats.recentMatches.unshift(recentMatch);
      currentStats.recentMatches = currentStats.recentMatches.slice(0, 10);

      // Update form (last 5 matches)
      currentStats.form.unshift(result);
      currentStats.form = currentStats.form.slice(0, 5);

      // Update the team document
      await collections.teams.doc(teamId).update({
        statistics: currentStats,
        updatedAt: new Date().toISOString()
      });

      console.log(`Updated comprehensive statistics for team ${teamName}:`, currentStats);
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
   * Update match history for teams when a match is completed
   * @param {string} matchId - The match ID
   * @param {Object} matchData - The match data
   */
  static async updateTeamMatchHistory(matchId, matchData) {
    try {
      console.log(`Updating match history for match ${matchId}`);

      // Handle both old format (matchData.teams) and new format (matchData.team1/team2)
      const team1 = matchData.team1 || matchData.teams?.team1;
      const team2 = matchData.team2 || matchData.teams?.team2;

      // Update team1 match history
      if (team1 && team1.id) {
        await this.updateSingleTeamMatchHistory(team1.id, matchId, matchData, false);
      }

      // Update team2 match history
      if (team2 && team2.id) {
        await this.updateSingleTeamMatchHistory(team2.id, matchId, matchData, true);
      }

      console.log(`Match history updated for match ${matchId}`);
    } catch (error) {
      console.error(`Error updating match history for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Update match history for a single team
   * @param {string} teamId - The team ID
   * @param {string} matchId - The match ID
   * @param {Object} matchData - The match data
   * @param {boolean} isTeam2 - Whether this is team2 in the match
   */
  static async updateSingleTeamMatchHistory(teamId, matchId, matchData, isTeam2) {
    try {
      const teamDoc = await collections.teams.doc(teamId).get();
      if (!teamDoc.exists) {
        console.warn(`Team ${teamId} not found for match history update`);
        return;
      }

      const teamData = teamDoc.data();
      const currentMatchHistory = teamData.matchHistory || [];

      // Get opponent info
      const opponentTeam = isTeam2 ? matchData.team1 || matchData.teams?.team1 : matchData.team2 || matchData.teams?.team2;
      let opponent = null;

      if (opponentTeam?.name) {
        opponent = {
          name: opponentTeam.name,
          shortName: opponentTeam.name.substring(0, 3).toUpperCase()
        };
      } else {
        // Try to get opponent by ID
        const opponentId = isTeam2 ? matchData.team1Id : matchData.team2Id;
        if (opponentId) {
          try {
            const opponentDoc = await collections.teams.where('numericId', '==', opponentId).limit(1).get();
            if (!opponentDoc.empty) {
              const opponentData = opponentDoc.docs[0].data();
              opponent = {
                name: opponentData.name,
                shortName: opponentData.shortName
              };
            }
          } catch (error) {
            console.warn(`Failed to get opponent for team ${opponentId}:`, error);
          }
        }
      }

      // Create match history entry
      const matchHistoryEntry = {
        id: matchId,
        numericId: matchData.numericId,
        displayId: matchData.numericId || matchId,
        title: matchData.title,
        status: matchData.status,
        scheduledDate: matchData.scheduledDate,
        venue: matchData.venue,
        opponent: opponent,
        winner: matchData.winner,
        result: matchData.result,
        team1Score: matchData.team1Score,
        team2Score: matchData.team2Score
      };

      // Add to match history (avoid duplicates)
      const existingIndex = currentMatchHistory.findIndex(match => match.id === matchId);
      if (existingIndex >= 0) {
        currentMatchHistory[existingIndex] = matchHistoryEntry;
      } else {
        currentMatchHistory.unshift(matchHistoryEntry); // Add to beginning
      }

      // Keep only last 20 matches and sort by date (most recent first)
      currentMatchHistory.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
      const updatedMatchHistory = currentMatchHistory.slice(0, 20);

      // Update the team document
      await collections.teams.doc(teamId).update({
        matchHistory: updatedMatchHistory,
        updatedAt: new Date().toISOString()
      });

      console.log(`Updated match history for team ${teamData.name}: ${updatedMatchHistory.length} matches`);
    } catch (error) {
      console.error(`Error updating match history for team ${teamId}:`, error);
      throw error;
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
            winPercentage: 0,
            currentStreak: { type: 'none', count: 0 },
            longestWinStreak: 0,
            longestLossStreak: 0,
            recentMatches: [],
            form: []
          },
          matchHistory: [],
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