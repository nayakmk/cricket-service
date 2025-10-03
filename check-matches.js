const { collections } = require('./config/database');

async function checkMatchStatuses() {
  try {
    const matchesSnapshot = await collections.matches.get();
    console.log('Total matches:', matchesSnapshot.size);

    matchesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Match ${doc.id}: status='${data.status}', team1Id='${data.team1Id}', team2Id='${data.team2Id}'`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkMatchStatuses();