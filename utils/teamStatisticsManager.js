const { collections } = require('../config/database');

/**
 * Team Statistics Manager
 * Handles calculation and updating of team statistics and best players
 */
class TeamStatisticsManager {
  /**
   * Get team document ID from numeric ID
   * @param {number} numericId - The numeric ID of the team
   * @returns {string|null} The document ID or null if not found
   */
  static async getTeamDocumentId(numericId) {
    try {
      const teamQuery = await collections.teams.where('numericId', '==', numericId).limit(1).get();
      if (!teamQuery.empty) {
        return teamQuery.docs[0].id;
      }
      return null;
    } catch (error) {
      console.error(`Error getting document ID for team numericId ${numericId}:`, error);
      return null;
    }
  }

  /**
   * Update team statistics after a match is completed
   * @param {string} matchId - The match ID
   * @param {Object} matchData - The match data
   */
  static async updateTeamStatistics(matchId, matchData) {
    try {
      console.log(`Updating team statistics for match ${matchId}`);

      // Extract team information from our match data structure
      const team1 = {
        id: matchData.team1Id,
        name: matchData.teams?.team1?.name || 'Unknown Team 1'
      };
      const team2 = {
        id: matchData.team2Id,
        name: matchData.teams?.team2?.name || 'Unknown Team 2'
      };

      // Get document IDs from numeric IDs
      const team1DocId = team1.id ? await TeamStatisticsManager.getTeamDocumentId(team1.id) : null;
      const team2DocId = team2.id ? await TeamStatisticsManager.getTeamDocumentId(team2.id) : null;

      if (!team1DocId || !team2DocId) {
        console.warn(`Could not find document IDs for teams in match ${matchId}: team1=${team1DocId}, team2=${team2DocId}`);
        return;
      }

      const winner = matchData.result?.winner;

      // Update team1 statistics
      if (team1DocId) {
        await this.updateSingleTeamStatistics(team1DocId, winner, team1.name, matchData);
      }

      // Update team2 statistics
      if (team2DocId) {
        await this.updateSingleTeamStatistics(team2DocId, winner, team2.name, matchData);
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
      // teamId is now numericId, need to find the document
      const teamQuery = await collections.teams.where('numericId', '==', teamId).limit(1).get();
      if (teamQuery.empty) {
        console.warn(`Team with numericId ${teamId} not found for statistics update`);
        return;
      }
      const teamDoc = teamQuery.docs[0];
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
      const opponentName = teamName === matchData.teams?.team1?.name
        ? matchData.teams?.team2?.name || 'Unknown Team'
        : matchData.teams?.team1?.name || 'Unknown Team';

      const recentMatch = {
        matchId: matchData.id || matchData.numericId,
        date: matchData.scheduledDate || matchData.date,
        opponent: opponentName,
        result: result,
        winner: winner || 'Unknown',
        venue: matchData.venue || 'Unknown Venue',
        status: matchData.status || 'completed'
      };

      currentStats.recentMatches.unshift(recentMatch);
      currentStats.recentMatches = currentStats.recentMatches.slice(0, 10);

      // Update form (last 5 matches)
      currentStats.form.unshift(result);
      currentStats.form = currentStats.form.slice(0, 5);

      // Update the team document
      await teamDoc.ref.update({
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
      const team1DocId = matchData.team1Id ? await TeamStatisticsManager.getTeamDocumentId(matchData.team1Id) : null;
      const team2DocId = matchData.team2Id ? await TeamStatisticsManager.getTeamDocumentId(matchData.team2Id) : null;
      
      if (team1DocId) {
        await this.updateTeamBestPlayers(team1DocId, playerStats);
      }

      // Update best players for team2
      if (team2DocId) {
        await this.updateTeamBestPlayers(team2DocId, playerStats);
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

      // Get document IDs from numeric IDs
      const team1DocId = matchData.team1Id ? await TeamStatisticsManager.getTeamDocumentId(matchData.team1Id) : null;
      const team2DocId = matchData.team2Id ? await TeamStatisticsManager.getTeamDocumentId(matchData.team2Id) : null;

      if (!team1DocId || !team2DocId) {
        console.warn(`Could not find document IDs for teams in match ${matchId}`);
        return;
      }

      // Update team1 match history
      await this.updateSingleTeamMatchHistory(team1DocId, matchId, matchData, false);

      // Update team2 match history
      await this.updateSingleTeamMatchHistory(team2DocId, matchId, matchData, true);

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

      // Now calculate best players across all matches for each team
      console.log('Calculating best players across all matches...');
      await this.calculateAllBestPlayers();

      console.log('Full team statistics recalculation completed');
    } catch (error) {
      console.error('Error recalculating team statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate best players across all matches for all teams
   * This aggregates statistics from all completed matches to find the best performers
   */
  static async calculateAllBestPlayers() {
    try {
      console.log('Calculating best players from all match data...');

      // Get all teams
      const teamsSnapshot = await collections.teams.get();
      const teams = [];
      teamsSnapshot.forEach(doc => {
        teams.push({ id: doc.id, ...doc.data() });
      });

      // Get all completed matches
      const matchesSnapshot = await collections.matches.where('status', '==', 'completed').get();

      // Aggregate player statistics across all matches
      const teamPlayerStats = new Map(); // teamId -> { batting: Map, bowling: Map }

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();

        // Get innings data for this match
        const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').get();

        // Process each inning
        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = inningDoc.data();

          // Determine which team this inning belongs to
          let teamId = null;
          if (inningData.battingTeamId) {
            teamId = inningData.battingTeamId;
          } else {
            // Try to determine from team names or other data
            continue; // Skip if we can't determine the team
          }

          if (!teamPlayerStats.has(teamId)) {
            teamPlayerStats.set(teamId, {
              batting: new Map(), // playerId -> {totalRuns, totalBalls, innings, average}
              bowling: new Map()  // playerId -> {totalWickets, totalRuns, totalOvers, economy}
            });
          }

          const stats = teamPlayerStats.get(teamId);

          // Process batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            for (const batsman of inningData.batsmen) {
              if (!batsman.playerId) continue;

              const battingStats = stats.batting.get(batsman.playerId) || {
                totalRuns: 0,
                totalBalls: 0,
                innings: 0,
                average: 0
              };

              battingStats.totalRuns += batsman.runs || 0;
              battingStats.totalBalls += batsman.balls || 0;
              battingStats.innings += 1;
              battingStats.average = battingStats.innings > 0 ? battingStats.totalRuns / battingStats.innings : 0;

              stats.batting.set(batsman.playerId, battingStats);
            }
          }

          // Process bowlers
          if (inningData.bowling && Array.isArray(inningData.bowling)) {
            for (const bowler of inningData.bowling) {
              if (!bowler.playerId) continue;

              const bowlingStats = stats.bowling.get(bowler.playerId) || {
                totalWickets: 0,
                totalRuns: 0,
                totalOvers: 0,
                economy: 0
              };

              bowlingStats.totalWickets += bowler.wickets || 0;
              bowlingStats.totalRuns += bowler.runs || 0;
              bowlingStats.totalOvers += bowler.overs || 0;
              bowlingStats.economy = bowlingStats.totalOvers > 0 ? bowlingStats.totalRuns / bowlingStats.totalOvers : 0;

              stats.bowling.set(bowler.playerId, bowlingStats);
            }
          }
        }
      }

      // Now update best players for each team
      for (const team of teams) {
        await this.updateTeamBestPlayersFromAggregatedData(team, teamPlayerStats.get(team.id));
      }

      console.log('Best players calculation completed for all teams');
    } catch (error) {
      console.error('Error calculating best players:', error);
      throw error;
    }
  }

  /**
   * Update best players for a team using aggregated statistics
   * @param {Object} team - Team data
   * @param {Object} playerStats - Aggregated player statistics for the team
   */
  static async updateTeamBestPlayersFromAggregatedData(team, playerStats) {
    if (!playerStats) return;

    try {
      const currentBestPlayers = {
        batsman: null,
        bowler: null,
        allRounder: null,
        wicketKeeper: null
      };

      // Find best batsman
      for (const [playerId, stats] of playerStats.batting) {
        if (!currentBestPlayers.batsman || stats.average > currentBestPlayers.batsman.average) {
          try {
            const playerDoc = await collections.players.doc(playerId).get();
            if (playerDoc.exists) {
              currentBestPlayers.batsman = {
                id: playerId,
                name: playerDoc.data().name,
                average: stats.average,
                totalRuns: stats.totalRuns
              };
            }
          } catch (error) {
            console.warn(`Failed to get player ${playerId} for best batsman:`, error);
          }
        }
      }

      // Find best bowler
      for (const [playerId, stats] of playerStats.bowling) {
        if (!currentBestPlayers.bowler || stats.totalWickets > currentBestPlayers.bowler.wickets) {
          try {
            const playerDoc = await collections.players.doc(playerId).get();
            if (playerDoc.exists) {
              currentBestPlayers.bowler = {
                id: playerId,
                name: playerDoc.data().name,
                wickets: stats.totalWickets,
                economy: stats.economy
              };
            }
          } catch (error) {
            console.warn(`Failed to get player ${playerId} for best bowler:`, error);
          }
        }
      }

      // Update best players in team document
      await collections.teams.doc(team.id).update({
        bestPlayers: currentBestPlayers,
        updatedAt: new Date().toISOString()
      });

      console.log(`Updated best players for team ${team.name}`);
    } catch (error) {
      console.error(`Error updating best players for team ${team.name}:`, error);
    }
  }
}

module.exports = { TeamStatisticsManager };