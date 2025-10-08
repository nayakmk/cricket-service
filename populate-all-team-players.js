const { collections } = require('./config/database');

/**
 * Script to extract all players from match innings data and populate complete player lists for teams
 */
async function populateAllTeamPlayersFromMatches() {
  try {
    console.log('Starting comprehensive team players population from match data...');

    // Get all completed matches
    const matchesSnapshot = await collections.matches.where('status', '==', 'completed').get();
    console.log(`Processing ${matchesSnapshot.size} completed matches`);

    // Create a map of teamId -> Set of playerIds
    const teamPlayersMap = new Map();

    // Process each match
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();

      // Handle both old and new team data formats
      const team1Id = matchData.team1?.id || matchData.team1;
      const team2Id = matchData.team2?.id || matchData.team2;

      if (!team1Id || !team2Id) {
        console.warn(`Match ${matchId} missing team data, skipping`);
        continue;
      }

      // Initialize team entries if not exists
      if (!teamPlayersMap.has(team1Id)) {
        teamPlayersMap.set(team1Id, new Set());
      }
      if (!teamPlayersMap.has(team2Id)) {
        teamPlayersMap.set(team2Id, new Set());
      }

      // Get innings data for this match
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      // Extract player IDs from innings
      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();

        // Add batting team players
        if (inningData.battingTeam === team1Id) {
          // Add batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            inningData.batsmen.forEach(batsman => {
              if (batsman.playerId) {
                teamPlayersMap.get(team1Id).add(batsman.playerId);
              }
            });
          }
          // Add bowlers
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team1Id).add(bowler.playerId);
              }
            });
          }
        }

        // Add bowling team players
        if (inningData.bowlingTeam === team1Id) {
          // Add batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            inningData.batsmen.forEach(batsman => {
              if (batsman.playerId) {
                teamPlayersMap.get(team1Id).add(batsman.playerId);
              }
            });
          }
          // Add bowlers
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team1Id).add(bowler.playerId);
              }
            });
          }
        }

        // Same for team2
        if (inningData.battingTeam === team2Id) {
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            inningData.batsmen.forEach(batsman => {
              if (batsman.playerId) {
                teamPlayersMap.get(team2Id).add(batsman.playerId);
              }
            });
          }
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team2Id).add(bowler.playerId);
              }
            });
          }
        }

        if (inningData.bowlingTeam === team2Id) {
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            inningData.batsmen.forEach(batsman => {
              if (batsman.playerId) {
                teamPlayersMap.get(team2Id).add(batsman.playerId);
              }
            });
          }
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            inningData.bowlers.forEach(bowler => {
              if (bowler.playerId) {
                teamPlayersMap.get(team2Id).add(bowler.playerId);
              }
            });
          }
        }
      }
    }

    // Now update each team with the complete player list
    console.log('\nUpdating teams with complete player lists...');

    for (const [teamId, playerIdsSet] of teamPlayersMap.entries()) {
      const playerIdsArray = Array.from(playerIdsSet);
      console.log(`Team ${teamId}: ${playerIdsArray.length} players`);

      // Find the team document
      const teamQuery = await collections.teams.where('numericId', '==', parseInt(teamId, 10)).get();
      if (!teamQuery.empty) {
        const teamDoc = teamQuery.docs[0];

        // Create detailed player info
        const playersDetails = [];
        for (const playerId of playerIdsArray) {
          try {
            const playerQuery = await collections.players.where('numericId', '==', parseInt(playerId, 10)).get();
            if (!playerQuery.empty) {
              const playerDoc = playerQuery.docs[0];
              const playerData = playerDoc.data();
              playersDetails.push({
                numericId: playerData.numericId,
                name: playerData.name,
                role: playerData.role || 'Player'
              });
            } else {
              console.warn(`Could not find player with numericId ${playerId}`);
            }
          } catch (error) {
            console.warn(`Error finding player ${playerId}:`, error.message);
          }
        }

        // Update the team document
        await collections.teams.doc(teamDoc.id).update({
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