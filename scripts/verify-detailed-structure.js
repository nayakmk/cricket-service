const { collections } = require('../config/database');

async function checkDetailedStructure() {
  console.log('Checking detailed innings structure...');

  // Check first match
  const matches = await collections.matches.get();
  const firstMatch = matches.docs[0];
  console.log(`\nChecking match: ${firstMatch.id}`);

  // Check innings
  const innings = await collections.matches.doc(firstMatch.id).collection('innings').get();
  console.log(`Found ${innings.size} innings`);

  for (const inningDoc of innings.docs.slice(0, 1)) { // Check first inning
    console.log(`\nInning: ${inningDoc.id} (numericId: ${inningDoc.data().numericId})`);

    // Check batsmen
    const batsmen = await collections.matches.doc(firstMatch.id).collection('innings').doc(inningDoc.id).collection('batsmen').get();
    console.log(`Batsmen (${batsmen.size}):`);
    batsmen.docs.slice(0, 3).forEach(doc => {
      console.log(`  ID: ${doc.id}, playerId: ${doc.data().playerId}, runs: ${doc.data().runs}`);
    });

    // Check bowling
    const bowling = await collections.matches.doc(firstMatch.id).collection('innings').doc(inningDoc.id).collection('bowling').get();
    console.log(`Bowling (${bowling.size}):`);
    bowling.docs.slice(0, 3).forEach(doc => {
      console.log(`  ID: ${doc.id}, playerId: ${doc.data().playerId}, wickets: ${doc.data().wickets}`);
    });

    // Check fall of wickets
    const fow = await collections.matches.doc(firstMatch.id).collection('innings').doc(inningDoc.id).collection('fallOfWickets').get();
    console.log(`Fall of Wickets (${fow.size}):`);
    fow.docs.slice(0, 3).forEach(doc => {
      console.log(`  ID: ${doc.id}, wicketNumber: ${doc.data().wicketNumber}, playerOutId: ${doc.data().playerOutId}`);
    });
  }
}

checkDetailedStructure().catch(console.error);