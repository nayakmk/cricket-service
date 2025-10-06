const { collections } = require('../config/database');

/**
 * Script to populate team match squads based on innings data
 * Creates a subcollection 'matchSquads' under each team with players who participated
 */
async function populateTeamMatchSquads() {
  try {
    console.log('Starting team match squads population...');

    // Get all completed matches
    const matchesSnapshot = await collections.matches.where('status', '==', 'completed').get();
    console.log(`Processing ${matchesSnapshot.size} completed matches`);

    const teamSquads = new Map(); // teamId -> matchId -> playerIds

    // Process each match
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();

      // Handle both old and new team data formats
      const team1 = matchData.team1 || matchData.teams?.team1;
      const team2 = matchData.team2 || matchData.teams?.team2;

      if (!team1?.id || !team2?.id) {
        console.warn(`Match ${matchId} missing team data, skipping`);
        continue;
      }

      // Initialize team entries if not exists
      if (!teamSquads.has(team1.id)) {
        teamSquads.set(team1.id, new Map());
      }
      if (!teamSquads.has(team2.id)) {
        teamSquads.set(team2.id, new Map());
      }

      // Get innings data for this match
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      // Extract player IDs for each team
      const team1Players = new Set();
      const team2Players = new Set();

      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();

        // Check which team was batting
        const isTeam1Batting = inningData.battingTeam === team1.name;
        const isTeam2Batting = inningData.battingTeam === team2.name;

        if (isTeam1Batting || isTeam2Batting) {
          const targetSet = isTeam1Batting ? team1Players : team2Players;

          // Add batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            inningData.batsmen.forEach(batsman => {
              if (batsman.playerId) {
                targetSet.add(batsman.playerId);
              }
            });
          }

          // Add bowlers (if available)
          if (inningData.bowling && Array.isArray(inningData.bowling)) {
            inningData.bowling.forEach(bowler => {
              if (bowler.playerId) {
                targetSet.add(bowler.playerId);
              }
            });
          }
        }
      }

      // Store the squads
      if (team1Players.size > 0) {
        teamSquads.get(team1.id).set(matchId, Array.from(team1Players));
      }
      if (team2Players.size > 0) {
        teamSquads.get(team2.id).set(matchId, Array.from(team2Players));
      }

      console.log(`Processed match ${matchId}: ${team1.name} (${team1Players.size} players), ${team2.name} (${team2Players.size} players)`);
    }

    // Now save the squads to Firestore
    let totalSquadsSaved = 0;
    for (const [teamId, matchMap] of teamSquads) {
      for (const [matchId, playerIds] of matchMap) {
        // Create subcollection document
        await collections.teams.doc(teamId).collection('matchSquads').doc(matchId).set({
          matchId: matchId,
          playerIds: playerIds,
          squadSize: playerIds.length,
          createdAt: new Date().toISOString()
        });
        totalSquadsSaved++;
      }
    }

    console.log(`Successfully saved ${totalSquadsSaved} match squads across ${teamSquads.size} teams`);
    console.log('Team match squads population completed successfully!');

  } catch (error) {
    console.error('Failed to populate team match squads:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  populateTeamMatchSquads();
}

module.exports = { populateTeamMatchSquads };