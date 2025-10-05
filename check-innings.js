const { collections } = require('./config/database');

async function checkInnings() {
  try {
    const inningsRef = collections.innings;
    const snapshot = await inningsRef.limit(1).get();

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Inning:', data.inningNumber, data.battingTeam, 'vs', data.bowlingTeam);
      if (data.batsmen && data.batsmen.length > 0) {
        data.batsmen.forEach((b, i) => {
          console.log(`  Batsman ${i+1}: ${b.player.name} - dismissal: '${b.dismissal}'`);
        });
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkInnings();