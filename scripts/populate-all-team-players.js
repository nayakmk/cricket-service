const { collections } = require('../config/database');

/**
 * Script to extract all players from match innings data and populate complete player lists for teams
 */
async function populateAllTeamPlayersFromMatches() {
  try {
    console.log('Starting comprehensive team players population from match data...');

    // Get all completed matches
    const matchesSnapshot = await collections.matches.where('status', '==', 'completed').get();
    console.log(`Processing ${matchesSnapshot.size} completed matches`);

    // Create a map of teamDocId -> Set of playerIds
    const teamPlayersMap = new Map();

    // First, create a mapping of numericId to documentId for teams
    const teamsSnapshot = await collections.teams.get();
    const numericIdToDocId = new Map();
    teamsSnapshot.forEach(teamDoc => {
      const data = teamDoc.data();
      if (data.numericId) {
        numericIdToDocId.set(data.numericId, teamDoc.id);
      }
    });

    // Process each match
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();

      // Extract numeric team IDs from nested teams structure
      const team1NumericId = matchData.teams?.team1?.id;
      const team2NumericId = matchData.teams?.team2?.id;

      if (!team1NumericId || !team2NumericId) {
        console.warn(`Match ${matchId} missing team data, skipping`);
        continue;
      }

      // Convert numeric IDs to document IDs
      const team1DocId = numericIdToDocId.get(team1NumericId);
      const team2DocId = numericIdToDocId.get(team2NumericId);

      if (!team1DocId || !team2DocId) {
        console.warn(`Match ${matchId}: Could not find document IDs for teams ${team1NumericId}, ${team2NumericId}, skipping`);
        continue;
      }

      // Initialize team entries if not exists
      if (!teamPlayersMap.has(team1DocId)) {
        teamPlayersMap.set(team1DocId, new Set());
      }
      if (!teamPlayersMap.has(team2DocId)) {
        teamPlayersMap.set(team2DocId, new Set());
      }

      // Get innings data for this match
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      // Extract player IDs from innings
      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();

        // Get team names for comparison
        const team1Name = matchData.teams.team1.name;
        const team2Name = matchData.teams.team2.name;

        // Add players from this inning to the appropriate team
        if (inningData.battingTeam === team1Name) {
          // Add batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            inningData.batsmen.forEach(batsman => {
              if (batsman.playerId) {
                teamPlayersMap.get(team1DocId).add(batsman.playerId);
              }
            });
          }
          // Add bowlers
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team1DocId).add(bowler.playerId);
              }
            });
          }
        }

        // Also add bowlers to the bowling team
        if (inningData.bowlingTeam === team1Name) {
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team1DocId).add(bowler.playerId);
              }
            });
          }
        }

        if (inningData.battingTeam === team2Name) {
          // Add batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            inningData.batsmen.forEach(batsman => {
              if (batsman.playerId) {
                teamPlayersMap.get(team2DocId).add(batsman.playerId);
              }
            });
          }
          // Add bowlers
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team2DocId).add(bowler.playerId);
              }
            });
          }
        }

        if (inningData.bowlingTeam === team2Name) {
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team2DocId).add(bowler.playerId);
              }
            });
          }
        }
      }
    }

    // Now update each team with the complete player list
    console.log('\nUpdating teams with complete player lists...');

    for (const [teamDocId, playerIdsSet] of teamPlayersMap.entries()) {
      const playerDocIdsArray = Array.from(playerIdsSet);
      console.log(`Team ${teamDocId}: ${playerDocIdsArray.length} players`);

      // Convert document IDs to numeric IDs and collect player details
      const playerIdsArray = [];
      const playersDetails = [];
      for (const playerDocId of playerDocIdsArray) {
        try {
          const playerDoc = await collections.players.doc(playerDocId).get();
          if (playerDoc.exists) {
            const playerData = playerDoc.data();
            if (playerData.numericId) {
              playerIdsArray.push(playerData.numericId);
              playersDetails.push({
                numericId: playerData.numericId,
                name: playerData.name,
                role: playerData.role || 'Player'
              });
            }
          }
        } catch (error) {
          console.warn(`Error getting numeric ID for player ${playerDocId}:`, error.message);
        }
      }

      // Get the team document directly by ID
      const teamDoc = await collections.teams.doc(teamDocId).get();
      if (teamDoc.exists) {

        // Update the team document
        await collections.teams.doc(teamDocId).update({
          playerIds: playerIdsArray,
          playersCount: playerIdsArray.length,
          players: playersDetails,
          updatedAt: new Date().toISOString()
        });

        console.log(`Updated team ${teamDoc.data().name}: ${playerIdsArray.length} players`);
      }
    }

    console.log('Team players population completed!');

  } catch (error) {
    console.error('Error populating team players:', error);
  }
}

populateAllTeamPlayersFromMatches();