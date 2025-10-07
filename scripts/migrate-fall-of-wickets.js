const { collections } = require('../config/database');

/**
 * Migrate fall of wickets data from subcollections to arrays in innings documents
 */
async function migrateFallOfWickets() {
  console.log('Starting fall of wickets migration...');

  try {
    const matchesSnapshot = await collections.matches.get();
    console.log(`Found ${matchesSnapshot.size} matches to process`);

    let processedCount = 0;
    let migratedCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      console.log(`Processing match ${matchId}...`);

      try {
        const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

        for (const inningDoc of inningsSnapshot.docs) {
          const inningId = inningDoc.id;
          const inningData = inningDoc.data();

          // Check if fall of wickets is already in array format
          if (inningData.fallOfWickets && Array.isArray(inningData.fallOfWickets) && inningData.fallOfWickets.length > 0) {
            console.log(`  Inning ${inningId} already has fall of wickets in array format`);
            continue;
          }

          // Check if there's a fall of wickets subcollection
          const fowSnapshot = await collections.matches.doc(matchId).collection('innings').doc(inningId).collection('fallOfWickets').orderBy('wicketNumber').get();

          if (!fowSnapshot.empty) {
            console.log(`  Migrating ${fowSnapshot.size} fall of wickets for inning ${inningId}`);

            const fallOfWickets = [];
            for (const fowDoc of fowSnapshot.docs) {
              const fowData = fowDoc.data();
              fallOfWickets.push({
                wicketNumber: fowData.wicketNumber || 0,
                batsmanName: fowData.batsmanName || 'Unknown',
                score: fowData.score || 0,
                overs: fowData.overs || fowData.over || 0,
                playerOutId: fowData.playerOutId
              });
            }

            // Update the innings document with the array
            await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
              fallOfWickets: fallOfWickets
            });

            // Optionally delete the subcollection (uncomment if you want to clean up)
            // for (const fowDoc of fowSnapshot.docs) {
            //   await collections.matches.doc(matchId).collection('innings').doc(inningId).collection('fallOfWickets').doc(fowDoc.id).delete();
            // }

            migratedCount++;
            console.log(`  Successfully migrated fall of wickets for inning ${inningId}`);
          }
        }

        processedCount++;
      } catch (error) {
        console.error(`Error processing match ${matchId}:`, error);
      }
    }

    console.log(`Migration completed. Processed ${processedCount} matches, migrated ${migratedCount} innings.`);

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateFallOfWickets().then(() => {
  console.log('Migration script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});