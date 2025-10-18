const { db, V2_COLLECTIONS } = require('./config/database-v2');

/**
 * Migration script to move squad data into matches collection as innings data
 * and delete the squad collection
 */
async function migrateSquadsToMatches() {
  console.log('Starting squad to matches migration...');

  try {
    // Get all matches
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).get();
    console.log(`Found ${matchesSnapshot.docs.length} matches to process`);

    // Get all squad data
    const squadsSnapshot = await db.collection(V2_COLLECTIONS.MATCH_SQUADS).get();
    console.log(`Found ${squadsSnapshot.docs.length} squad documents`);

    // Build squads map
    const squadsMap = {};
    for (const squadDoc of squadsSnapshot.docs) {
      const squadData = squadDoc.data();
      const matchId = squadData.matchId || squadData.match?.matchId;
      const teamId = squadData.team?.teamId || squadData.teamId;

      if (matchId && teamId) {
        if (!squadsMap[matchId]) {
          squadsMap[matchId] = {};
        }
        squadsMap[matchId][teamId] = {
          players: squadData.players || [],
          captain: squadData.captain,
          viceCaptain: squadData.viceCaptain
        };
      }
    }

    console.log(`Built squads map with ${Object.keys(squadsMap).length} matches`);

    // Process each match
    let updatedCount = 0;
    let skippedCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const matchId = matchData.externalReferenceId || matchData.numericId.toString();

      console.log(`Processing match ${matchId} (${matchData.title || 'No title'})`);

      // Get squad data for this match
      const matchSquads = squadsMap[matchId];
      if (!matchSquads) {
        console.log(`  No squad data found for match ${matchId}, skipping`);
        skippedCount++;
        continue;
      }

      // Build innings data for both teams
      const inningsData = [];

      // Helper function to find dismissal data for a player
      const findPlayerDismissal = (playerName, teamName) => {
        if (!matchData.innings) return null;

        for (const inning of matchData.innings) {
          // Check if this inning belongs to the player's team
          if (inning.team === teamName || inning.battingTeam === teamName) {
            if (inning.batting && Array.isArray(inning.batting)) {
              const playerBatting = inning.batting.find(batter =>
                batter.name && batter.name.toLowerCase() === playerName.toLowerCase()
              );
              if (playerBatting && playerBatting.how_out) {
                return playerBatting.how_out;
              }
            }
          }
        }
        return null;
      };

      // Helper function to clean undefined values from objects
      const cleanObject = (obj) => {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              cleaned[key] = cleanObject(value);
            } else if (Array.isArray(value)) {
              cleaned[key] = value.map(item =>
                typeof item === 'object' && item !== null ? cleanObject(item) : item
              );
            } else {
              cleaned[key] = value;
            }
          }
        }
        return cleaned;
      };

      // Process team1
      const team1Id = matchData.team1Id || matchData.team1?.id;
      if (team1Id && matchSquads[team1Id]) {
        const team1Squad = matchSquads[team1Id];
        const team1Name = matchData.team1?.name || matchData.team1Squad?.name;

        const team1Innings = cleanObject({
          teamId: team1Id,
          teamName: team1Name,
          captain: team1Squad.captain,
          viceCaptain: team1Squad.viceCaptain,
          batting: team1Squad.players.map(player => cleanObject({
            playerId: player.playerId,
            name: player.name,
            role: player.role,
            battingOrder: player.battingOrder || player.batting_order,
            bowlingOrder: player.bowlingOrder || player.bowling_order,
            battingStyle: player.battingStyle || player.batting_style,
            bowlingStyle: player.bowlingStyle || player.bowling_style,
            isCaptain: player.isCaptain,
            isWicketKeeper: player.isWicketKeeper,
            dismissal: findPlayerDismissal(player.name, team1Name),
            // Include any other player data
            ...player
          }))
        });
        inningsData.push(team1Innings);
      }

      // Process team2
      const team2Id = matchData.team2Id || matchData.team2?.id;
      if (team2Id && matchSquads[team2Id]) {
        const team2Squad = matchSquads[team2Id];
        const team2Name = matchData.team2?.name || matchData.team2Squad?.name;

        const team2Innings = cleanObject({
          teamId: team2Id,
          teamName: team2Name,
          captain: team2Squad.captain,
          viceCaptain: team2Squad.viceCaptain,
          batting: team2Squad.players.map(player => cleanObject({
            playerId: player.playerId,
            name: player.name,
            role: player.role,
            battingOrder: player.battingOrder || player.batting_order,
            bowlingOrder: player.bowlingOrder || player.bowling_order,
            battingStyle: player.battingStyle || player.batting_style,
            bowlingStyle: player.bowlingStyle || player.bowling_style,
            isCaptain: player.isCaptain,
            isWicketKeeper: player.isWicketKeeper,
            dismissal: findPlayerDismissal(player.name, team2Name),
            // Include any other player data
            ...player
          }))
        });
        inningsData.push(team2Innings);
      }

      if (inningsData.length === 0) {
        console.log(`  No innings data to add for match ${matchId}, skipping`);
        skippedCount++;
        continue;
      }

      // Update the match document with innings data
      await matchDoc.ref.update({
        innings: inningsData,
        updatedAt: new Date()
      });

      console.log(`  Updated match ${matchId} with ${inningsData.length} innings`);
      updatedCount++;
    }

    console.log(`\nMigration completed:`);
    console.log(`- Updated ${updatedCount} matches`);
    console.log(`- Skipped ${skippedCount} matches`);

    // Confirm before deleting squad collection
    console.log(`\nReady to delete MATCH_SQUADS collection containing ${squadsSnapshot.docs.length} documents.`);
    console.log(`⚠️  WARNING: This action cannot be undone!`);
    console.log(`Type 'DELETE_SQUADS_CONFIRMED' to proceed with deletion:`);

    // For safety, require manual confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('', async (answer) => {
      if (answer === 'DELETE_SQUADS_CONFIRMED') {
        console.log('Deleting MATCH_SQUADS collection...');

        // Delete all squad documents
        const deletePromises = squadsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);

        console.log(`✅ Deleted ${squadsSnapshot.docs.length} squad documents`);
        console.log('✅ MATCH_SQUADS collection deletion completed');
      } else {
        console.log('❌ Squad collection deletion cancelled');
      }

      rl.close();
      console.log('Migration script completed');
      process.exit(0);
    });

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateSquadsToMatches();