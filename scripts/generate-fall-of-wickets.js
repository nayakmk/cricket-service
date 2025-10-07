const { collections } = require('../config/database');

/**
 * Generate fall of wickets data from existing batting data
 */
async function generateFallOfWickets() {
  console.log('Generating fall of wickets data from batting data...');

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

          // Generate fall of wickets from batting data
          const fallOfWickets = [];
          let totalScore = 0;
          let wicketNumber = 1;

          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            // Sort batsmen by their dismissal order (we'll use a simple approach)
            // In a real scenario, we'd need proper dismissal order, but for now we'll use the order they appear
            const dismissedBatsmen = inningData.batsmen.filter(batsman => batsman.status !== 'not out');

            for (const batsman of dismissedBatsmen) {
              // Find the player name
              let playerName = batsman.player?.name || 'Unknown';

              // For wicket number, score, and overs, we'll use estimated values
              // In a real implementation, this would need proper calculation
              const estimatedScore = totalScore + (batsman.runs || 0);
              const estimatedOvers = Math.floor((wicketNumber * 2) / 6) + ((wicketNumber * 2) % 6) / 10; // Rough estimate

              fallOfWickets.push({
                wicketNumber: wicketNumber,
                batsmanName: playerName,
                score: estimatedScore,
                overs: estimatedOvers.toFixed(1),
                playerOutId: batsman.player?.id || null
              });

              wicketNumber++;
              totalScore = estimatedScore;
            }
          }

          if (fallOfWickets.length > 0) {
            // Update the innings document with generated fall of wickets
            await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
              fallOfWickets: fallOfWickets
            });

            updatedCount++;
            console.log(`  Generated ${fallOfWickets.length} fall of wickets for inning ${inningId}`);
          } else {
            console.log(`  No dismissed batsmen found for inning ${inningId}`);
          }
        }

        processedCount++;
      } catch (error) {
        console.error(`Error processing match ${matchId}:`, error);
      }
    }

    console.log(`Generation completed. Processed ${processedCount} matches, updated ${updatedCount} innings.`);

  } catch (error) {
    console.error('Generation failed:', error);
  }
}

// Run the generation
generateFallOfWickets().then(() => {
  console.log('Fall of wickets generation script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Fall of wickets generation script failed:', error);
  process.exit(1);
});