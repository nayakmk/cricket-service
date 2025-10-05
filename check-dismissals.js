const { collections } = require('./config/database');

async function checkDismissals() {
  try {
    const inningsRef = collections.innings;
    const snapshot = await inningsRef.limit(1).get();

    console.log('Checking innings data...');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Inning ${data.inningNumber}: ${data.battingTeam} vs ${data.bowlingTeam}`);
      if (data.batsmen && data.batsmen.length > 0) {
        data.batsmen.slice(0, 3).forEach((batsman, i) => {
          console.log(`  Batsman ${i+1}: ${batsman.player.name} - ${batsman.dismissal || 'no dismissal field'}`);
        });
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkDismissals();