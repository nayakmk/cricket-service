const { TeamStatisticsManager } = require('../utils/teamStatisticsManager');

/**
 * Script to populate comprehensive team statistics for all teams
 * This will calculate and store detailed statistics including recent matches,
 * win/loss streaks, and performance metrics directly in team documents
 */
async function populateComprehensiveTeamStats() {
  try {
    console.log('Starting comprehensive team statistics population...');

    // Get all teams
    const { collections } = require('../config/database');
    const teamsSnapshot = await collections.teams.get();

    console.log(`Found ${teamsSnapshot.size} teams to process`);

    // Process each team
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      console.log(`Processing team: ${teamData.name} (${teamDoc.id})`);

      try {
        // Initialize comprehensive statistics structure
        const comprehensiveStats = {
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

        // Get all matches for this team
        const matchesSnapshot = await collections.matches
          .orderBy('scheduledDate', 'desc')
          .get();

        const teamMatches = [];

        // Find all matches involving this team
        for (const matchDoc of matchesSnapshot.docs) {
          const matchData = matchDoc.data();

          // Check if this team is involved in the match
          // Handle both old format (matchData.teams) and new format (matchData.team1/team2)
          const team1Id = matchData.teams?.team1?.id || matchData.team1?.id || matchData.team1Id;
          const team2Id = matchData.teams?.team2?.id || matchData.team2?.id || matchData.team2Id;

          const isTeam1 = team1Id === teamDoc.id || team1Id === teamData.numericId;
          const isTeam2 = team2Id === teamDoc.id || team2Id === teamData.numericId;

          if (isTeam1 || isTeam2) {
            teamMatches.push({
              id: matchDoc.id,
              data: matchData,
              isTeam1,
              isTeam2
            });
          }
        }

        // Sort matches by date (most recent first)
        teamMatches.sort((a, b) => new Date(b.data.scheduledDate) - new Date(a.data.scheduledDate));

        // Process each match to build comprehensive statistics
        for (const matchInfo of teamMatches) {
          const matchData = matchInfo.data;
          const { winner, result } = matchData;

          // Only process completed matches for statistics
          if (matchData.status !== 'completed') continue;

          comprehensiveStats.totalMatches += 1;

          // Determine result for this team
          let matchResult;
          if (winner === teamData.name) {
            comprehensiveStats.wins += 1;
            matchResult = 'W';
          } else if (winner && winner !== 'Draw') {
            comprehensiveStats.losses += 1;
            matchResult = 'L';
          } else {
            comprehensiveStats.draws += 1;
            matchResult = 'D';
          }

          // Update current streak
          if (matchResult === 'W') {
            if (comprehensiveStats.currentStreak.type === 'win') {
              comprehensiveStats.currentStreak.count += 1;
            } else {
              comprehensiveStats.currentStreak = { type: 'win', count: 1 };
            }
            comprehensiveStats.longestWinStreak = Math.max(comprehensiveStats.longestWinStreak, comprehensiveStats.currentStreak.count);
          } else if (matchResult === 'L') {
            if (comprehensiveStats.currentStreak.type === 'loss') {
              comprehensiveStats.currentStreak.count += 1;
            } else {
              comprehensiveStats.currentStreak = { type: 'loss', count: 1 };
            }
            comprehensiveStats.longestLossStreak = Math.max(comprehensiveStats.longestLossStreak, comprehensiveStats.currentStreak.count);
          } else {
            comprehensiveStats.currentStreak = { type: 'draw', count: 1 };
          }

          // Add to recent matches (keep last 10)
          const opponentName = matchInfo.isTeam1
            ? (matchData.teams?.team2?.name || matchData.team2?.name)
            : (matchData.teams?.team1?.name || matchData.team1?.name);
          const recentMatch = {
            matchId: matchData.numericId || matchDoc.id,
            date: matchData.scheduledDate,
            opponent: opponentName,
            result: matchResult,
            winner: winner,
            venue: matchData.venue,
            status: matchData.status
          };

          comprehensiveStats.recentMatches.push(recentMatch);

          // Update form (last 5 matches)
          comprehensiveStats.form.push(matchResult);
        }

        // Keep only last 10 recent matches and last 5 form matches
        comprehensiveStats.recentMatches = comprehensiveStats.recentMatches.slice(-10);
        comprehensiveStats.form = comprehensiveStats.form.slice(-5);

        // Calculate win percentage
        comprehensiveStats.winPercentage = comprehensiveStats.totalMatches > 0
          ? (comprehensiveStats.wins / comprehensiveStats.totalMatches) * 100
          : 0;

        // Update the team document with comprehensive statistics
        await collections.teams.doc(teamDoc.id).update({
          statistics: comprehensiveStats,
          updatedAt: new Date().toISOString()
        });

        console.log(`Updated comprehensive statistics for ${teamData.name}:`, comprehensiveStats);

      } catch (error) {
        console.error(`Error processing team ${teamData.name}:`, error);
      }
    }

    console.log('Comprehensive team statistics population completed successfully!');

  } catch (error) {
    console.error('Failed to populate comprehensive team statistics:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  populateComprehensiveTeamStats();
}

module.exports = { populateComprehensiveTeamStats };