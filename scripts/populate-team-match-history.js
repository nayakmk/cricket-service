const { collections } = require('../config/database');

/**
 * Script to populate team match history
 * This will store important match data directly in team documents to avoid runtime queries
 */
async function populateTeamMatchHistory() {
  try {
    console.log('Starting team match history population...');

    // Get all teams
    const teamsSnapshot = await collections.teams.get();
    console.log(`Found ${teamsSnapshot.size} teams to process`);

    // Get all matches
    const matchesSnapshot = await collections.matches
      .orderBy('scheduledDate', 'desc')
      .get();

    console.log(`Found ${matchesSnapshot.size} matches to process`);

    // Create a map of team IDs to their match history
    const teamMatchHistory = new Map();

    // Process each match
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();

      // Handle both old format (matchData.teams) and new format (matchData.team1/team2)
      const team1Id = matchData.teams?.team1?.id || matchData.team1?.id || matchData.team1Id;
      const team2Id = matchData.teams?.team2?.id || matchData.team2?.id || matchData.team2Id;

      const team1Name = matchData.teams?.team1?.name || matchData.team1?.name;
      const team2Name = matchData.teams?.team2?.name || matchData.team2?.name;

      // Process team1
      if (team1Id) {
        if (!teamMatchHistory.has(team1Id)) {
          teamMatchHistory.set(team1Id, []);
        }

        // Get opponent info for team1
        let opponent = null;
        if (team2Name) {
          opponent = { name: team2Name, shortName: team2Name.substring(0, 3).toUpperCase() };
        } else if (matchData.team2Id) {
          // Try to get opponent team by ID
          try {
            const opponentDoc = await collections.teams.where('numericId', '==', matchData.team2Id).limit(1).get();
            if (!opponentDoc.empty) {
              const opponentData = opponentDoc.docs[0].data();
              opponent = {
                name: opponentData.name,
                shortName: opponentData.shortName
              };
            }
          } catch (error) {
            console.warn(`Failed to get opponent for team2Id ${matchData.team2Id}:`, error);
          }
        }

        const matchHistoryEntry = {
          id: matchDoc.id,
          numericId: matchData.numericId,
          displayId: matchData.numericId || matchDoc.id,
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

        teamMatchHistory.get(team1Id).push(matchHistoryEntry);
      }

      // Process team2
      if (team2Id) {
        if (!teamMatchHistory.has(team2Id)) {
          teamMatchHistory.set(team2Id, []);
        }

        // Get opponent info for team2
        let opponent = null;
        if (team1Name) {
          opponent = { name: team1Name, shortName: team1Name.substring(0, 3).toUpperCase() };
        } else if (matchData.team1Id) {
          // Try to get opponent team by ID
          try {
            const opponentDoc = await collections.teams.where('numericId', '==', matchData.team1Id).limit(1).get();
            if (!opponentDoc.empty) {
              const opponentData = opponentDoc.docs[0].data();
              opponent = {
                name: opponentData.name,
                shortName: opponentData.shortName
              };
            }
          } catch (error) {
            console.warn(`Failed to get opponent for team1Id ${matchData.team1Id}:`, error);
          }
        }

        const matchHistoryEntry = {
          id: matchDoc.id,
          numericId: matchData.numericId,
          displayId: matchData.numericId || matchDoc.id,
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

        teamMatchHistory.get(team2Id).push(matchHistoryEntry);
      }
    }

    // Update each team with their match history
    for (const teamDoc of teamsSnapshot.docs) {
      const teamId = teamDoc.id;
      const teamData = teamDoc.data();

      const matchHistory = teamMatchHistory.get(teamId) || [];

      // Sort matches by date (most recent first)
      matchHistory.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

      // Update the team document
      await collections.teams.doc(teamId).update({
        matchHistory: matchHistory,
        updatedAt: new Date().toISOString()
      });

      console.log(`Updated team ${teamData.name}: ${matchHistory.length} matches in history`);
    }

    console.log('Team match history population completed successfully!');

  } catch (error) {
    console.error('Failed to populate team match history:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  populateTeamMatchHistory();
}

module.exports = { populateTeamMatchHistory };