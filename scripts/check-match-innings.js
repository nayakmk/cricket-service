const { collections } = require('../config/database');

async function checkMatchInnings() {
  try {
    console.log('CHECKING MATCH INNINGS DATA');
    console.log('===========================');

    // Get all completed matches
    const completedMatchesSnapshot = await collections.matches
      .where('status', '==', 'completed')
      .limit(3)
      .get();

    console.log(`Found ${completedMatchesSnapshot.size} completed matches`);

    for (const doc of completedMatchesSnapshot.docs) {
      const matchData = doc.data();
      console.log(`\nMatch: ${matchData.numericId || doc.id}`);
      console.log(`Team1: ${matchData.team1?.name}, Team2: ${matchData.team2?.name}`);
      console.log(`Stored scores - Team1: ${matchData.team1Score || 0}, Team2: ${matchData.team2Score || 0}`);

      // Check innings data
      try {
        const inningsSnapshot = await collections.matches.doc(doc.id).collection('innings').get();
        console.log(`Innings count: ${inningsSnapshot.size}`);

        let calculatedTeam1Score = 0;
        let calculatedTeam2Score = 0;

        inningsSnapshot.docs.forEach((inningDoc, index) => {
          const inningData = inningDoc.data();
          console.log(`  Inning ${index + 1}: ${inningData.battingTeam} - ${inningData.totalRuns || 0} runs`);

          if (inningData.battingTeam === matchData.team1?.name) {
            calculatedTeam1Score += inningData.totalRuns || 0;
          } else if (inningData.battingTeam === matchData.team2?.name) {
            calculatedTeam2Score += inningData.totalRuns || 0;
          }
        });

        console.log(`Calculated scores - Team1: ${calculatedTeam1Score}, Team2: ${calculatedTeam2Score}`);

        // Determine winner based on calculated scores
        let winner = null;
        let margin = null;

        if (calculatedTeam1Score > calculatedTeam2Score) {
          winner = matchData.team1?.name;
          margin = `${calculatedTeam1Score - calculatedTeam2Score} runs`;
        } else if (calculatedTeam2Score > calculatedTeam1Score) {
          winner = matchData.team2?.name;
          margin = `${calculatedTeam2Score - calculatedTeam1Score} runs`;
        } else {
          winner = 'Draw';
          margin = null;
        }

        console.log(`Should be winner: ${winner}${margin ? ` by ${margin}` : ''}`);

      } catch (error) {
        console.warn(`Failed to get innings for match ${doc.id}:`, error);
      }
    }

  } catch (error) {
    console.error('Error checking match innings:', error);
  }
}

checkMatchInnings();