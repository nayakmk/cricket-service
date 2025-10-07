const { collections } = require('../config/database');

async function updateMatchWinners() {
  try {
    console.log('UPDATING MATCH WINNERS');
    console.log('=====================');

    // Get all completed matches
    const completedMatchesSnapshot = await collections.matches
      .where('status', '==', 'completed')
      .get();

    console.log(`Found ${completedMatchesSnapshot.size} completed matches`);

    let updatedCount = 0;

    for (const doc of completedMatchesSnapshot.docs) {
      const matchData = doc.data();
      console.log(`\nProcessing match: ${matchData.numericId || doc.id}`);

      // Always recalculate scores from innings for completed matches to ensure accuracy
      let team1Score = 0;
      let team2Score = 0;

      try {
        const inningsSnapshot = await collections.matches.doc(doc.id).collection('innings').get();

        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = inningDoc.data();
          
          // Resolve team name from ID if needed
          let battingTeamName = inningData.battingTeam;
          if (inningData.battingTeam && typeof inningData.battingTeam === 'string' && inningData.battingTeam.length > 10) {
            // Looks like a Firestore ID, try to resolve it
            try {
              const teamDoc = await collections.teams.doc(inningData.battingTeam).get();
              if (teamDoc.exists) {
                battingTeamName = teamDoc.data().name;
              }
            } catch (error) {
              console.warn(`Failed to resolve team name for ${inningData.battingTeam}:`, error);
            }
          }
          
          if (battingTeamName === matchData.teams?.team1?.name) {
            team1Score += inningData.totalRuns || 0;
          } else if (battingTeamName === matchData.teams?.team2?.name) {
            team2Score += inningData.totalRuns || 0;
          }
        }

        console.log(`  Calculated scores - Team1 (${matchData.teams?.team1?.name}): ${team1Score}, Team2 (${matchData.teams?.team2?.name}): ${team2Score}`);
      } catch (error) {
        console.warn(`  Failed to calculate scores for match ${doc.id}:`, error);
        continue;
      }

      // Determine winner
      let winner = null;
      let margin = null;

      if (team1Score > team2Score) {
        winner = matchData.teams?.team1?.name;
        margin = `${team1Score - team2Score} runs`;
      } else if (team2Score > team1Score) {
        winner = matchData.teams?.team2?.name;
        margin = `${team2Score - team1Score} runs`;
      } else {
        winner = 'Draw';
        margin = null;
      }

      // Update the match document
      const updateData = {
        winner: winner,
        result: {
          winner: winner,
          margin: margin
        },
        team1Score: team1Score,
        team2Score: team2Score,
        updatedAt: new Date()
      };

      await collections.matches.doc(doc.id).update(updateData);

      console.log(`  Updated winner: ${winner}${margin ? ` by ${margin}` : ''}`);
      updatedCount++;
    }

    console.log(`\nSuccessfully updated ${updatedCount} matches with winner information`);

  } catch (error) {
    console.error('Error updating match winners:', error);
  }
}

updateMatchWinners();