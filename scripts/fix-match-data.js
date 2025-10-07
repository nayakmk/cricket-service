const { collections, db } = require('../config/database');

async function fixMatchData() {
  try {
    console.log('Starting to fix match data...');

    const snapshot = await collections.matches.get();

    for (const doc of snapshot.docs) {
      const matchData = doc.data();
      const matchRef = doc.ref;

      // Get the winner team name
      let winnerName = null;
      if (matchData.result && typeof matchData.result === 'string') {
        // Try to determine winner from result margin
        const resultText = matchData.result.toLowerCase();
        if (resultText.includes('runs') || resultText.includes('wickets')) {
          // If it's a margin result, the winner is the team that batted first (team1)
          winnerName = matchData.teams?.team1?.name || null;
        } else if (resultText.includes('no result') || resultText.includes('abandoned')) {
          winnerName = null; // No winner
        }
      }

      // If we still don't have a winner, try to extract from embedded result
      if (!winnerName && matchData.result && typeof matchData.result === 'object' && matchData.result.winner) {
        if (typeof matchData.result.winner === 'string') {
          winnerName = matchData.result.winner;
        } else if (matchData.result.winner.name) {
          winnerName = matchData.result.winner.name;
        }
      }

      // Get match type from tournament name
      let matchType = 'Box Cricket';

      // Update the document
      await matchRef.update({
        winner: winnerName,
        matchType: matchType
      });

      console.log(`Updated match ${doc.id}: winner=${winnerName}, matchType=${matchType}`);
    }

    console.log('Match data fix completed!');
  } catch (error) {
    console.error('Error fixing match data:', error);
  }
  process.exit(0);
}

fixMatchData();