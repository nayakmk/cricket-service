const { db } = require('../config/database');

/**
 * Populates team documents with match history data
 * Each team document gets a 'matches' array containing match references
 * with resolved winner names for display
 */
async function populateTeamMatchHistory() {
  console.log('Starting team match history population...');

  try {
    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = [];
    teamsSnapshot.forEach(doc => {
      teams.push({ id: doc.id, ...doc.data() });
    });

    console.log(`Found ${teams.length} teams`);

    // Get all matches
    const matchesSnapshot = await db.collection('matches').get();
    const matches = [];
    matchesSnapshot.forEach(doc => {
      matches.push({ id: doc.id, ...doc.data() });
    });

    console.log(`Found ${matches.length} matches`);

    // Create a map of team IDs to team names for winner resolution
    const teamIdToName = {};
    teams.forEach(team => {
      teamIdToName[team.id] = team.name;
    });

    // Process each team
    for (const team of teams) {
      console.log(`Processing team: ${team.name} (ID: ${team.id})`);

      // Find all matches where this team participated
      const teamMatches = matches.filter(match =>
        match.team1Id === team.numericId || match.team2Id === team.numericId
      );

      console.log(`Found ${teamMatches.length} matches for ${team.name}`);

      // Create match history entries with resolved winner names
      const matchHistory = teamMatches.map(match => {
        const isTeam1 = match.team1Id === team.id;
        const opponentId = isTeam1 ? match.team2Id : match.team1Id;
        const opponentName = teamIdToName[opponentId] || 'Unknown Team';

        // Resolve winner name from result.winner
        let winnerName = 'Unknown';
        let winnerNumericId = null;
        if (match.result && match.result.winner) {
          winnerName = match.result.winner;
          // Find the winner team numericId by name
          const winnerTeam = teams.find(t => t.name === winnerName);
          winnerNumericId = winnerTeam ? winnerTeam.numericId : null;
        } else if (match.result === 'Draw' || match.result === 'Abandoned') {
          winnerName = match.result;
        }

        return {
          match_id: match.numericId, // Use numericId instead of document ID
          date: match.scheduledDate,
          venue: match.venue,
          opponent: opponentName,
          team_score: isTeam1 ? match.team1Score : match.team2Score,
          opponent_score: isTeam1 ? match.team2Score : match.team1Score,
          result: match.result,
          winner: winnerName,
          winner_id: winnerNumericId, // Use numericId instead of document ID
          is_winner: winnerNumericId === team.numericId,
          is_draw: match.result === 'Draw',
          is_abandoned: match.result === 'Abandoned'
        };
      });

      // Sort matches by date (most recent first)
      matchHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Update team document with match history
      const teamRef = db.collection('teams').doc(team.id);
      await teamRef.update({
        matches: matchHistory,
        match_count: matchHistory.length,
        last_updated: new Date().toISOString()
      });

      console.log(`Updated ${team.name} with ${matchHistory.length} matches`);
    }

    console.log('Team match history population completed successfully');

    // Generate summary
    const summary = {
      total_teams: teams.length,
      total_matches: matches.length,
      processed_at: new Date().toISOString()
    };

    console.log('Summary:', summary);
    return summary;

  } catch (error) {
    console.error('Error populating team match history:', error);
    throw error;
  }
}

module.exports = { populateTeamMatchHistory };
