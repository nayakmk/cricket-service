const { collections } = require('./config/database');

// Test the match filtering logic directly
async function testMatchFiltering() {
  try {
    console.log('Testing match filtering logic...');

    // Get a team to test with
    const teamsSnapshot = await collections.teams.limit(1).get();
    if (teamsSnapshot.empty) {
      console.log('No teams found');
      return;
    }

    const teamDoc = teamsSnapshot.docs[0];
    const teamData = { ...teamDoc.data(), id: teamDoc.id };
    console.log(`Testing with team: ${teamData.name} (ID: ${teamDoc.id})`);

    // Get all matches
    const matchesSnapshot = await collections.matches.get();
    console.log(`Found ${matchesSnapshot.size} matches`);

    let matchCount = 0;
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();

      // Test the new filtering logic
      const isTeam1 = matchData.team1 === teamDoc.id || matchData.team1Id === teamDoc.id;
      const isTeam2 = matchData.team2 === teamDoc.id || matchData.team2Id === teamDoc.id;

      if (isTeam1 || isTeam2) {
        matchCount++;
        console.log(`Match ${matchDoc.id}: ${matchData.title}`);
        console.log(`  - Status: ${matchData.status}`);
        console.log(`  - Team1: ${matchData.team1}`);
        console.log(`  - Team2: ${matchData.team2}`);
        console.log(`  - Result:`, matchData.result);

        // Test opponent resolution
        let opponent = null;
        if (isTeam1 && matchData.team2Id) {
          try {
            const opponentDoc = await collections.teams.doc(matchData.team2Id).get();
            if (opponentDoc.exists) {
              const opponentData = opponentDoc.data();
              opponent = {
                id: opponentDoc.id,
                name: opponentData.name,
                shortName: opponentData.shortName,
                numericId: opponentData.numericId
              };
            }
          } catch (error) {
            console.warn(`Failed to get opponent team ${matchData.team2Id}:`, error);
          }
        } else if (isTeam2 && matchData.team1Id) {
          try {
            const opponentDoc = await collections.teams.doc(matchData.team1Id).get();
            if (opponentDoc.exists) {
              const opponentData = opponentDoc.data();
              opponent = {
                id: opponentDoc.id,
                name: opponentData.name,
                shortName: opponentData.shortName,
                numericId: opponentData.numericId
              };
            }
          } catch (error) {
            console.warn(`Failed to get opponent team ${matchData.team1Id}:`, error);
          }
        }

        console.log(`  - Opponent: ${opponent?.name || 'Unknown'}`);
      }
    }

    console.log(`\nTotal matches found for team ${teamData.name}: ${matchCount}`);

    // Calculate statistics
    const completedMatches = [];
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const isTeam1 = matchData.team1 === teamDoc.id || matchData.team1Id === teamDoc.id;
      const isTeam2 = matchData.team2 === teamDoc.id || matchData.team2Id === teamDoc.id;

      if ((isTeam1 || isTeam2) && matchData.status === 'completed') {
        completedMatches.push(matchData);
      }
    }

    const wins = completedMatches.filter(match => match.result?.winner === teamData.name).length;
    const losses = completedMatches.filter(match => match.result?.winner && match.result.winner !== teamData.name).length;
    const draws = completedMatches.filter(match => !match.result?.winner).length;

    console.log(`\nStatistics for ${teamData.name}:`);
    console.log(`- Total completed matches: ${completedMatches.length}`);
    console.log(`- Wins: ${wins}`);
    console.log(`- Losses: ${losses}`);
    console.log(`- Draws: ${draws}`);
    console.log(`- Win percentage: ${completedMatches.length > 0 ? (wins / completedMatches.length) * 100 : 0}%`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testMatchFiltering();