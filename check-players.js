const { collections } = require('./config/database');

async function checkPlayers() {
  try {
    const playersRef = collections.players;
    const snapshot = await playersRef.get();

    console.log('Current players:');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}, Name: ${data.name}, NumericId: ${data.numericId}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkPlayers();