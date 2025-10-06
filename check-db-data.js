const { collections } = require('./config/database');

async function checkMatchesData() {
  try {
    console.log('Checking matches data...');

    const matchesSnapshot = await collections.matches.limit(5).get();

    console.log(`Found ${matchesSnapshot.size} matches`);

    for (const doc of matchesSnapshot.docs) {
      const matchData = doc.data();
      console.log(`\nMatch ${doc.id}:`);
      console.log(`- numericId: ${matchData.numericId}`);
      console.log(`- title: ${matchData.title}`);
      console.log(`- status: ${matchData.status}`);
      console.log(`- team1:`, matchData.team1 ? {
        name: matchData.team1.name,
        id: matchData.team1.id,
        numericId: matchData.team1.numericId
      } : matchData.team1Id);
      console.log(`- team2:`, matchData.team2 ? {
        name: matchData.team2.name,
        id: matchData.team2.id,
        numericId: matchData.team2.numericId
      } : matchData.team2Id);
      console.log(`- winner: ${matchData.winner}`);
      console.log(`- result:`, matchData.result);
      console.log(`- scheduledDate: ${matchData.scheduledDate}`);
    }

    // Also check teams
    console.log('\n\nChecking teams data...');
    const teamsSnapshot = await collections.teams.limit(5).get();

    console.log(`Found ${teamsSnapshot.size} teams`);

    for (const doc of teamsSnapshot.docs) {
      const teamData = doc.data();
      console.log(`\nTeam ${doc.id}:`);
      console.log(`- numericId: ${teamData.numericId}`);
      console.log(`- name: ${teamData.name}`);
      console.log(`- shortName: ${teamData.shortName}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkMatchesData();