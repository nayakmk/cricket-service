const { db } = require('../config/database');

async function clearCollections() {
  try {
    console.log('Clearing existing V2 collections...');

    // Clear matches_v2
    const matchesSnapshot = await db.collection('matches_v2').get();
    const matchBatch = db.batch();
    matchesSnapshot.docs.forEach(doc => {
      matchBatch.delete(doc.ref);
    });
    await matchBatch.commit();
    console.log(`Cleared ${matchesSnapshot.docs.length} matches`);

    // Clear teams_v2
    const teamsSnapshot = await db.collection('teams_v2').get();
    const teamBatch = db.batch();
    teamsSnapshot.docs.forEach(doc => {
      teamBatch.delete(doc.ref);
    });
    await teamBatch.commit();
    console.log(`Cleared ${teamsSnapshot.docs.length} teams`);

    // Clear players_v2
    const playersSnapshot = await db.collection('players_v2').get();
    const playerBatch = db.batch();
    playersSnapshot.docs.forEach(doc => {
      playerBatch.delete(doc.ref);
    });
    await playerBatch.commit();
    console.log(`Cleared ${playersSnapshot.docs.length} players`);

    console.log('Collections cleared successfully');
  } catch (error) {
    console.error('Error clearing collections:', error);
  }

  process.exit(0);
}

clearCollections();