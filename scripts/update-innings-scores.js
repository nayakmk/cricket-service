const { collections } = require('../config/database');

async function updateInningsScoreFormat() {
  console.log('Starting innings score format update...');

  try {
    // Get all matches
    const matchesSnapshot = await collections.matches.get();
    console.log(`Found ${matchesSnapshot.size} matches to process`);

    let totalInningsUpdated = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      console.log(`Processing match: ${matchId}`);

      // Get all innings for this match
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      for (const inningDoc of inningsSnapshot.docs) {
        const inningId = inningDoc.id;
        const inningData = inningDoc.data();

        // Check if totalRuns needs to be parsed
        if (typeof inningData.totalRuns === 'string' && inningData.totalRuns.includes('/')) {
          const [runsStr, wicketsStr] = inningData.totalRuns.split('/');

          // Parse runs and wickets
          const runs = parseInt(runsStr, 10) || 0;
          const wickets = parseInt(wicketsStr, 10) || 0;

          // Update the document
          await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
            totalRuns: runs,
            totalWickets: wickets
          });

          console.log(`  Updated inning ${inningId}: ${inningData.totalRuns} -> runs: ${runs}, wickets: ${wickets}`);
          totalInningsUpdated++;
        } else if (inningData.totalWickets === 0 && typeof inningData.totalRuns === 'string') {
          // Handle case where totalRuns might be just a number string
          const runs = parseInt(inningData.totalRuns, 10) || 0;
          if (!isNaN(runs) && runs !== parseInt(inningData.totalRuns, 10)) {
            await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
              totalRuns: runs
            });
            console.log(`  Updated inning ${inningId}: totalRuns string to number: ${runs}`);
            totalInningsUpdated++;
          }
        }
      }
    }

    console.log(`\n✅ Successfully updated ${totalInningsUpdated} innings documents`);
    console.log('Score format update completed!');

  } catch (error) {
    console.error('Error updating innings score format:', error);
    throw error;
  }
}

// Run the update
updateInningsScoreFormat()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });