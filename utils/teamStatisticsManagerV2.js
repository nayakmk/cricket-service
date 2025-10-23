const { db, V2_COLLECTIONS } = require('../config/database-v2');

/**
 * Team Statistics Manager for v2 Collections
 * Handles calculation and updating of team statistics and best players for v2 collections
 */
class TeamStatisticsManagerV2 {
  /**
   * Get team document ID from numeric ID
   * @param {number} numericId - The numeric ID of the team
   * @returns {string|null} The document ID or null if not found
   */
  static async getTeamDocumentId(numericId) {
    try {
      const teamQuery = await db.collection(V2_COLLECTIONS.TEAMS)
        .where('numericId', '==', numericId)
        .limit(1)
        .get();
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
      console.log(`Updating v2 team statistics for match ${matchId}`);

      // Extract team information from v2 match data structure
      // team1Id and team2Id are document IDs in v2
      const team1DocId = matchData.team1Id;
      const team2DocId = matchData.team2Id;
      const team1Name = matchData.team1?.name || 'Unknown Team 1';
      const team2Name = matchData.team2?.name || 'Unknown Team 2';

      if (!team1DocId || !team2DocId) {
        console.warn(`Could not find document IDs for teams in match ${matchId}: team1=${team1DocId}, team2=${team2DocId}`);
        return;
      }

      // Determine winner
      let winnerDocId = null;
      if (matchData.result && matchData.result.winner) {
        if (typeof matchData.result.winner === 'string') {
          // Try to match by name
          if (matchData.result.winner === team1Name) {
            winnerDocId = team1DocId;
          } else if (matchData.result.winner === team2Name) {
            winnerDocId = team2DocId;
          }
        }
      }

      // Update statistics for both teams
      await TeamStatisticsManagerV2.updateSingleTeamStatistics(team1DocId, matchId, matchData, winnerDocId === team1DocId);
      await TeamStatisticsManagerV2.updateSingleTeamStatistics(team2DocId, matchId, matchData, winnerDocId === team2DocId);

    } catch (error) {
      console.error(`Error updating team statistics for match ${matchId}:`, error);
    }
  }

  /**
   * Update statistics for a single team
   */
  static async updateSingleTeamStatistics(teamDocId, matchId, matchData, isWinner) {
    try {
      const teamRef = db.collection(V2_COLLECTIONS.TEAMS).doc(teamDocId);
      const teamDoc = await teamRef.get();

      if (!teamDoc.exists) {
        console.warn(`Team document ${teamDocId} not found`);
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
        form: []
      };

      // Update basic stats
      currentStats.totalMatches += 1;

      if (isWinner) {
        currentStats.wins += 1;
        // Update win streak
        if (currentStats.currentStreak.type === 'win') {
          currentStats.currentStreak.count += 1;
        } else {
          currentStats.currentStreak = { type: 'win', count: 1 };
        }
        currentStats.longestWinStreak = Math.max(currentStats.longestWinStreak, currentStats.currentStreak.count);
      } else {
        currentStats.losses += 1;
        // Update loss streak
        if (currentStats.currentStreak.type === 'loss') {
          currentStats.currentStreak.count += 1;
        } else {
          currentStats.currentStreak = { type: 'loss', count: 1 };
        }
        currentStats.longestLossStreak = Math.max(currentStats.longestLossStreak, currentStats.currentStreak.count);
      }

      currentStats.winPercentage = currentStats.totalMatches > 0 ?
        (currentStats.wins / currentStats.totalMatches) * 100 : 0;

      // Update recent matches (keep last 10)
      const matchResult = {
        matchId: matchId,
        result: isWinner ? 'win' : 'loss',
        date: matchData.scheduledDate || new Date(),
        opponent: teamData.name === matchData.team1?.name ? matchData.team2?.name : matchData.team1?.name
      };

      currentStats.recentMatches.unshift(matchResult);
      currentStats.recentMatches = currentStats.recentMatches.slice(0, 10);

      // Update form (last 5 matches)
      currentStats.form = currentStats.recentMatches.slice(0, 5).map(m => m.result);

      // Update match history
      const matchHistory = teamData.matchHistory || [];
      matchHistory.push({
        matchId: matchId,
        result: isWinner ? 'win' : 'loss',
        date: matchData.scheduledDate || new Date(),
        opponent: matchResult.opponent
        // Removed score field since it's not available in current data structure
      });

      // Keep only last 50 matches in history
      const trimmedHistory = matchHistory.slice(-50);

      // Update the team document
      await teamRef.update({
        statistics: currentStats,
        matchHistory: trimmedHistory,
        updatedAt: new Date()
      });

    } catch (error) {
      console.error(`Error updating statistics for team ${teamDocId}:`, error);
    }
  }

  /**
   * Recalculate all team statistics from scratch
   * Useful for data migration or fixing corrupted stats
   */
  static async recalculateAllTeamStatistics() {
    try {
      console.log('Starting full v2 team statistics recalculation...');

      // Reset all team statistics
      const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
      const resetPromises = teamsSnapshot.docs.map(doc => {
        return db.collection(V2_COLLECTIONS.TEAMS).doc(doc.id).update({
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
          updatedAt: new Date()
        });
      });

      await Promise.all(resetPromises);
      console.log('Reset all v2 team statistics');

      // Recalculate from all completed matches
      const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES)
        .where('status', '==', 'completed')
        .get();

      console.log(`Processing ${matchesSnapshot.size} completed matches...`);

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        await this.updateTeamStatistics(matchDoc.id, matchData);
      }

      console.log(`Recalculated statistics for ${matchesSnapshot.size} completed matches`);

      // Calculate best players across all matches for each team
      console.log('Calculating best players across all matches...');
      await this.calculateAllBestPlayers();

      console.log('Full v2 team statistics recalculation completed');
    } catch (error) {
      console.error('Error recalculating v2 team statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate best players across all matches for all teams
   */
  static async calculateAllBestPlayers() {
    try {
      console.log('Calculating best players from all v2 match data...');

      // Get all teams
      const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();

      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        console.log(`Calculating best players for team: ${teamData.name}`);

        // Get all matches for this team
        const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES)
          .where('status', '==', 'completed')
          .get();

        const teamMatches = [];
        for (const matchDoc of matchesSnapshot.docs) {
          const matchData = matchDoc.data();
          // Check if this team is in the match
          if ((matchData.team1Id === teamData.numericId) ||
              (matchData.team2Id === teamData.numericId) ||
              (matchData.team1?.id === teamData.numericId) ||
              (matchData.team2?.id === teamData.numericId)) {
            teamMatches.push({ id: matchDoc.id, ...matchData });
          }
        }

        // Calculate best players from team matches
        const bestPlayers = {
          batsman: null,
          bowler: null,
          allRounder: null,
          wicketKeeper: null
        };

        // Simple logic: find players with best performance in their roles
        // This is a simplified version - you might want to enhance this
        for (const match of teamMatches) {
          // Check team1 players
          if (match.team1 && match.team1.players) {
            for (const player of match.team1.players) {
              // This would need more sophisticated logic based on your performance metrics
              // For now, just initialize the structure
            }
          }
          // Check team2 players
          if (match.team2 && match.team2.players) {
            for (const player of match.team2.players) {
              // This would need more sophisticated logic based on your performance metrics
              // For now, just initialize the structure
            }
          }
        }

        // Update team with best players
        await db.collection(V2_COLLECTIONS.TEAMS).doc(teamDoc.id).update({
          bestPlayers: bestPlayers,
          updatedAt: new Date()
        });
      }

      console.log('Best players calculation completed');
    } catch (error) {
      console.error('Error calculating best players:', error);
    }
  }
}

module.exports = { TeamStatisticsManagerV2 };