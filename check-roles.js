const { db, collections } = require('./config/database');

async function checkPlayers() {
  try {
    const playersRef = collections.players;
    const snapshot = await playersRef.limit(5).get();

    console.log('Sample players with role information:');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Player: ${data.name}`);
      console.log(`  isCaptain: ${data.isCaptain}`);
      console.log(`  isWicketKeeper: ${data.isWicketKeeper}`);
      console.log(`  battingStyle: ${data.battingStyle}`);
      console.log('');
    });

    // Also check for dismissal information in innings
    console.log('Checking dismissal information in innings...');
    const inningsRef = collections.innings;
    const inningsSnapshot = await inningsRef.limit(2).get();

    inningsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Inning ${data.inningNumber} - ${data.battingTeam} vs ${data.bowlingTeam}`);
      if (data.batsmen && data.batsmen.length > 0) {
        console.log('  Batsmen with dismissal info:');
        data.batsmen.slice(0, 2).forEach(batsman => {
          console.log(`    ${batsman.player.name}: ${batsman.dismissal}`);
        });
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkPlayers();