const { collections } = require('../config/database');
const { dataMappingsCache } = require('../utils/dataMappingsCache');

/**
 * Update innings data to use numericIds and denormalized data
 */
async function updateInningsData() {
  console.log('🔧 Updating innings data to use numericIds...\n');

  try {
    // Load mappings
    await dataMappingsCache.loadMappings();

    // Create reverse mappings (document ID -> numericId)
    const teamDocToNumeric = new Map();
    const playerDocToNumeric = new Map();

    // Build reverse mappings
    const teamsSnapshot = await collections.teams.get();
    for (const doc of teamsSnapshot.docs) {
      const data = doc.data();
      teamDocToNumeric.set(doc.id, data.numericId);
    }

    const playersSnapshot = await collections.players.get();
    for (const doc of playersSnapshot.docs) {
      const data = doc.data();
      playerDocToNumeric.set(doc.id, data.numericId);
    }

    console.log(`Built mappings: ${teamDocToNumeric.size} teams, ${playerDocToNumeric.size} players\n`);

    // Process all matches
    const matchesSnapshot = await collections.matches.get();
    console.log(`Processing ${matchesSnapshot.size} matches...\n`);

    let totalInningsUpdated = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const inningsRef = collections.matches.doc(matchDoc.id).collection('innings');
      const inningsSnapshot = await inningsRef.get();

      if (inningsSnapshot.empty) continue;

      console.log(`Processing match ${matchDoc.id} (${inningsSnapshot.size} innings)...`);

      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();
        let needsUpdate = false;
        const updatedData = { ...inningData };

        // Update battingTeam and bowlingTeam to use numericIds
        if (inningData.battingTeam && typeof inningData.battingTeam === 'string') {
          // Find team by name
          const teamEntry = Array.from(dataMappingsCache.teams.entries()).find(([_, team]) => team.name === inningData.battingTeam);
          if (teamEntry) {
            updatedData.battingTeam = teamEntry[0]; // numericId
            needsUpdate = true;
          }
        }

        if (inningData.bowlingTeam && typeof inningData.bowlingTeam === 'string') {
          // Find team by name
          const teamEntry = Array.from(dataMappingsCache.teams.entries()).find(([_, team]) => team.name === inningData.bowlingTeam);
          if (teamEntry) {
            updatedData.bowlingTeam = teamEntry[0]; // numericId
            needsUpdate = true;
          }
        }

        // Update batsmen data
        if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
          updatedData.batsmen = inningData.batsmen.map(batsman => {
            const updatedBatsman = { ...batsman };
            let batsmanNeedsUpdate = false;

            // Update playerId from document ID to numericId
            if (batsman.playerId && playerDocToNumeric.has(batsman.playerId)) {
              updatedBatsman.playerId = playerDocToNumeric.get(batsman.playerId);
              batsmanNeedsUpdate = true;
            }

            // Update player object
            if (batsman.player && batsman.player.id && playerDocToNumeric.has(batsman.player.id)) {
              const playerDetails = dataMappingsCache.getPlayer(playerDocToNumeric.get(batsman.player.id));
              if (playerDetails) {
                // Remove undefined values
                const cleanPlayerDetails = Object.fromEntries(
                  Object.entries(playerDetails).filter(([_, value]) => value !== undefined)
                );
                updatedBatsman.player = cleanPlayerDetails;
                batsmanNeedsUpdate = true;
              }
            }

            // Update fielder IDs in howOut
            if (batsman.howOut) {
              const updatedHowOut = { ...batsman.howOut };

              if (updatedHowOut.fielderId && playerDocToNumeric.has(updatedHowOut.fielderId)) {
                updatedHowOut.fielderId = playerDocToNumeric.get(updatedHowOut.fielderId);
                batsmanNeedsUpdate = true;
              }

              if (updatedHowOut.fieldersIds && Array.isArray(updatedHowOut.fieldersIds)) {
                updatedHowOut.fieldersIds = updatedHowOut.fieldersIds.map(id =>
                  playerDocToNumeric.has(id) ? playerDocToNumeric.get(id) : id
                );
                batsmanNeedsUpdate = true;
              }

              if (batsmanNeedsUpdate) {
                updatedBatsman.howOut = updatedHowOut;
              }
            }

            return batsmanNeedsUpdate ? updatedBatsman : batsman;
          });

          if (updatedData.batsmen.some((b, i) => b !== inningData.batsmen[i])) {
            needsUpdate = true;
          }
        }

        // Update bowlers data
        if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
          updatedData.bowlers = inningData.bowlers.map(bowler => {
            const updatedBowler = { ...bowler };
            let bowlerNeedsUpdate = false;

            // Update playerId from document ID to numericId
            if (bowler.playerId && playerDocToNumeric.has(bowler.playerId)) {
              updatedBowler.playerId = playerDocToNumeric.get(bowler.playerId);
              bowlerNeedsUpdate = true;
            }

            // Update player object
            if (bowler.player && bowler.player.id && playerDocToNumeric.has(bowler.player.id)) {
              const playerDetails = dataMappingsCache.getPlayer(playerDocToNumeric.get(bowler.player.id));
              if (playerDetails) {
                // Remove undefined values
                const cleanPlayerDetails = Object.fromEntries(
                  Object.entries(playerDetails).filter(([_, value]) => value !== undefined)
                );
                updatedBowler.player = cleanPlayerDetails;
                bowlerNeedsUpdate = true;
              }
            }

            return bowlerNeedsUpdate ? updatedBowler : bowler;
          });

          if (updatedData.bowlers.some((b, i) => b !== inningData.bowlers[i])) {
            needsUpdate = true;
          }
        }

        // Update the document if changes were made
        if (needsUpdate) {
          await inningsRef.doc(inningDoc.id).update(updatedData);
          totalInningsUpdated++;
          console.log(`   Updated inning ${inningDoc.id}`);
        }
      }
    }

    console.log(`\n✅ Successfully updated ${totalInningsUpdated} innings to use numericIds`);

  } catch (error) {
    console.error('❌ Error updating innings data:', error);
  }
}

// Run the script
updateInningsData();