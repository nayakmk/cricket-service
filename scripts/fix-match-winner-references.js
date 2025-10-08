const { collections } = require('../config/database');

/**
 * Script to fix match winner references
 * Updates all matches to use team IDs instead of team names for winner fields
 * This ensures data integrity when team names change
 */
async function fixMatchWinnerReferences() {
  try {
    console.log('Starting match winner reference fix...');

    // Get all completed matches
    const matchesSnapshot = await collections.matches
      .where('status', '==', 'completed')
      .get();

    console.log(`Found ${matchesSnapshot.size} completed matches to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of matchesSnapshot.docs) {
      const matchData = doc.data();
      console.log(`\nProcessing match: ${matchData.numericId || doc.id}`);

      // Check if winner is already using ID (skip if so)
      if (matchData.winner && matchData.winner.length > 20) {
        // Looks like it's already a document ID
        console.log(`  Winner already uses ID format: ${matchData.winner}`);
        skippedCount++;
        continue;
      }

      // Determine winner team ID based on current winner name
      let winnerId = null;
      let winnerName = matchData.winner;

      if (winnerName && winnerName !== 'Draw') {
        // Find which team has this name
        if (matchData.teams?.team1?.name === winnerName) {
          winnerId = matchData.team1Id || matchData.teams.team1.id;
        } else if (matchData.teams?.team2?.name === winnerName) {
          winnerId = matchData.team2Id || matchData.teams.team2.id;
        }

        if (winnerId) {
          console.log(`  Converting winner "${winnerName}" to ID: ${winnerId}`);

          // Update the match document
          const updateData = {
            winner: winnerId,
            result: {
              winner: winnerId,
              margin: matchData.result?.margin || null
            },
            updatedAt: new Date().toISOString()
          };

          await collections.matches.doc(doc.id).update(updateData);
          updatedCount++;
        } else {
          console.warn(`  Could not find team ID for winner name: ${winnerName}`);
          skippedCount++;
        }
      } else if (winnerName === 'Draw') {
        // Handle draws - keep as is or use null
        console.log(`  Match is a draw, keeping as "${winnerName}"`);
        skippedCount++;
      } else {
        console.warn(`  No winner information found for match`);
        skippedCount++;
      }
    }

    console.log(`\nFix completed:`);
    console.log(`  Updated: ${updatedCount} matches`);
    console.log(`  Skipped: ${skippedCount} matches`);

  } catch (error) {
    console.error('Failed to fix match winner references:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixMatchWinnerReferences();
}

module.exports = { fixMatchWinnerReferences };