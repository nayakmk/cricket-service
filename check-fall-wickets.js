const { collections } = require('./config/database');

async function checkFallOfWickets() {
  try {
    const inningsRef = collections.innings;
    const snapshot = await inningsRef.limit(1).get();

    console.log('Checking fall_of_wickets in innings...');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nInning ${data.inningNumber}: ${data.battingTeam} vs ${data.bowlingTeam}`);

      if (data.fallOfWickets && data.fallOfWickets.length > 0) {
        console.log('Fall of wickets:');
        data.fallOfWickets.forEach((fow, i) => {
          console.log(`  ${i+1}. Wicket ${fow.wicket}: ${fow.playerName || fow.player} (${fow.score}) at ${fow.over}`);
          if (fow.playerId) {
            console.log(`     PlayerId: ${fow.playerId}`);
          }
        });
      } else {
        console.log('No fall of wickets data');
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkFallOfWickets();