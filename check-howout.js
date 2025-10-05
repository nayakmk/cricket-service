const { collections } = require('./config/database');

async function checkHowOut() {
  try {
    const inningsRef = collections.innings;
    const snapshot = await inningsRef.limit(2).get();

    console.log('Checking howOut objects in innings...');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nInning ${data.inningNumber}: ${data.battingTeam} vs ${data.bowlingTeam}`);

      if (data.batsmen && data.batsmen.length > 0) {
        data.batsmen.forEach((batsman, i) => {
          if (batsman.howOut) {
            console.log(`  Batsman ${i+1}: ${batsman.player.name}`);
            console.log(`    howOut:`, JSON.stringify(batsman.howOut, null, 2));
          }
        });
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkHowOut();