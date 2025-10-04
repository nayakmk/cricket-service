const { collections } = require('../config/database');

async function checkStructure() {
  console.log('Checking data structure...');

  // Check matches
  const matches = await collections.matches.get();
  console.log(`\nMatches: ${matches.size}`);

  for (const matchDoc of matches.docs.slice(0, 1)) { // Check first match
    console.log(`\nMatch ${matchDoc.id}:`);
    const matchData = matchDoc.data();
    console.log(`  Title: ${matchData.title}`);
    console.log(`  NumericId: ${matchData.numericId}`);

    // Check innings subcollection
    const innings = await collections.matches.doc(matchDoc.id).collection('innings').get();
    console.log(`  Innings: ${innings.size}`);

    for (const inningDoc of innings.docs) {
      console.log(`    Inning ${inningDoc.id} (numericId: ${inningDoc.data().numericId}):`);

      // Check batsmen subcollection
      const batsmen = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').get();
      console.log(`      Batsmen: ${batsmen.size}`);

      // Check bowling subcollection
      const bowling = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').get();
      console.log(`      Bowling: ${bowling.size}`);
    }
  }

  // Check top-level innings collection (should be empty now)
  const topLevelInnings = await collections.innings.get();
  console.log(`\nTop-level innings collection: ${topLevelInnings.size} (should be 0)`);

  // Check other collections
  const teams = await collections.teams.get();
  const players = await collections.players.get();
  console.log(`Teams: ${teams.size}`);
  console.log(`Players: ${players.size}`);
}

checkStructure().catch(console.error);