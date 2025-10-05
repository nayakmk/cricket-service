const { collections } = require('../config/database');

async function cleanupDuplicateInnings() {
  try {
    console.log('Starting cleanup of duplicate innings...');

    // Get all matches
    const matchesSnapshot = await collections.matches.get();
    console.log(`Found ${matchesSnapshot.size} matches to process`);

    let totalCleaned = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      console.log(`\nProcessing match: ${matchId}`);

      // Get all innings for this match
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      if (inningsSnapshot.empty) {
        console.log('  No innings found, skipping');
        continue;
      }

      console.log(`  Found ${inningsSnapshot.size} innings`);

      // Separate UUID-like IDs (20 chars) from proper IDs (21 chars)
      const uuidInnings = [];
      const properInnings = [];

      inningsSnapshot.docs.forEach(inningDoc => {
        if (inningDoc.id.length === 20) {
          uuidInnings.push(inningDoc);
        } else if (inningDoc.id.length === 21) {
          properInnings.push(inningDoc);
        }
      });

      console.log(`  UUID innings: ${uuidInnings.length}, Proper innings: ${properInnings.length}`);

      // If we have both types, delete the UUID ones
      if (uuidInnings.length > 0 && properInnings.length > 0) {
        console.log('  Deleting UUID innings...');
        for (const inningDoc of uuidInnings) {
          await collections.matches.doc(matchId).collection('innings').doc(inningDoc.id).delete();
          console.log(`    Deleted inning: ${inningDoc.id}`);
          totalCleaned++;
        }
      } else if (uuidInnings.length > 0 && properInnings.length === 0) {
        console.log('  Only UUID innings found - these should be converted to proper format');
        // For now, just log - we might need to convert these later
      }
    }

    console.log(`\nCleanup completed! Deleted ${totalCleaned} duplicate UUID innings.`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
cleanupDuplicateInnings();