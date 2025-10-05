const { collections } = require('./config/database');

async function testAPIData() {
  try {
    const inningsRef = collections.innings;
    const snapshot = await inningsRef.limit(1).get();

    snapshot.forEach(doc => {
      const data = doc.data();

      // Simulate API transformation
      const transformedBowling = data.bowlers?.map(b => ({
        name: b.player?.name || `Player ${b.playerId}`,
        economy: b.economy || 0
      })) || [];

      const transformedFallOfWickets = data.fallOfWickets?.map(fow => ({
        wicket_number: fow.wicket || 0,
        player_out: fow.playerName || fow.player || 'Unknown',
        over: fow.over || 0
      })) || [];

      console.log('Transformed bowling sample:', JSON.stringify(transformedBowling[0], null, 2));
      console.log('Transformed fall of wickets sample:', JSON.stringify(transformedFallOfWickets[0], null, 2));
    });
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

testAPIData();