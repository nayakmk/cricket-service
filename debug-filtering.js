const { collections } = require('./config/database');

// Debug the exact values
async function debugMatchFiltering() {
  try {
    console.log('Debugging match filtering...');

    // Get a team
    const teamsSnapshot = await collections.teams.limit(1).get();
    const teamDoc = teamsSnapshot.docs[0];
    const teamData = { ...teamDoc.data(), id: teamDoc.id };
    console.log(`Team: ${teamData.name}`);
    console.log(`Team ID: "${teamDoc.id}"`);
    console.log(`Team numericId: ${teamData.numericId}`);

    // Get first match
    const matchesSnapshot = await collections.matches.limit(1).get();
    const matchDoc = matchesSnapshot.docs[0];
    const matchData = matchDoc.data();
    console.log(`\nMatch: ${matchData.title}`);
    console.log(`Match team1: "${matchData.team1}" (type: ${typeof matchData.team1})`);
    console.log(`Match team2: "${matchData.team2}" (type: ${typeof matchData.team2})`);
    console.log(`Match team1Id: ${matchData.team1Id} (type: ${typeof matchData.team1Id})`);
    console.log(`Match team2Id: ${matchData.team2Id} (type: ${typeof matchData.team2Id})`);

    // Test comparisons
    console.log(`\nComparisons:`);
    console.log(`team1 === teamDoc.id: ${matchData.team1 === teamDoc.id}`);
    console.log(`team2 === teamDoc.id: ${matchData.team2 === teamDoc.id}`);
    console.log(`team1Id === numericId: ${matchData.team1Id === teamData.numericId}`);
    console.log(`team2Id === numericId: ${matchData.team2Id === teamData.numericId}`);

    // Check if team1 is in any match
    console.log(`\nChecking if team appears in any match...`);
    const allMatches = await collections.matches.get();
    for (const mDoc of allMatches.docs) {
      const mData = mDoc.data();
      if (mData.team1 === teamDoc.id || mData.team2 === teamDoc.id) {
        console.log(`Found match: ${mData.title} - team1: "${mData.team1}", team2: "${mData.team2}"`);
        break;
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debugMatchFiltering();