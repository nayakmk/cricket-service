const { collections } = require('../config/database');

/**
 * Add sample fall of wickets data to innings that don't have it
 */
async function addSampleFallOfWickets() {
  console.log('Adding sample fall of wickets data...');

  try {
    const matchesSnapshot = await collections.matches.get();
    console.log(`Found ${matchesSnapshot.size} matches to process`);

    let processedCount = 0;
    let updatedCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      console.log(`Processing match ${matchId}...`);

      try {
        const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

        for (const inningDoc of inningsSnapshot.docs) {
          const inningId = inningDoc.id;
          const inningData = inningDoc.data();

          // Check if fall of wickets already exists and has data
          if (inningData.fallOfWickets && Array.isArray(inningData.fallOfWickets) && inningData.fallOfWickets.length > 0) {
            console.log(`  Inning ${inningId} already has fall of wickets data`);
            continue;
          }

          // Add sample fall of wickets data
          const sampleFallOfWickets = [
            {
              wicketNumber: 1,
              batsmanName: 'Sample Player 1',
              score: 15,
              overs: '3.2'
            },
            {
              wicketNumber: 2,
              batsmanName: 'Sample Player 2',
              score: 32,
              overs: '7.1'
            },
            {
              wicketNumber: 3,
              batsmanName: 'Sample Player 3',
              score: 45,
              overs: '9.4'
            }
          ];

          // Update the innings document with sample fall of wickets
          await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
            fallOfWickets: sampleFallOfWickets
          });

          updatedCount++;
          console.log(`  Added sample fall of wickets for inning ${inningId}`);
        }

        processedCount++;
      } catch (error) {
        console.error(`Error processing match ${matchId}:`, error);
      }
    }

    console.log(`Sample data addition completed. Processed ${processedCount} matches, updated ${updatedCount} innings.`);

  } catch (error) {
    console.error('Sample data addition failed:', error);
  }
}

// Run the script
addSampleFallOfWickets().then(() => {
  console.log('Sample fall of wickets addition script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Sample fall of wickets addition script failed:', error);
  process.exit(1);
});