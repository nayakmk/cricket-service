const { collections, db } = require('../config/database');

async function verifyData() {
  console.log('Verifying data integrity...');

  try {
    // Check sequences
    const sequences = await collections.sequences.get();
    console.log('\nSequences:');
    sequences.forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}: currentValue = ${data.currentValue}`);
    });

    // Check a few samples from each collection
    const collectionsToCheck = ['teams', 'players', 'matches', 'innings'];

    for (const coll of collectionsToCheck) {
      const snapshot = await collections[coll].limit(3).get();
      console.log(`\n${coll.toUpperCase()} samples:`);
      snapshot.forEach(doc => {
        const data = doc.data();
        const name = data.name || data.title || 'N/A';
        console.log(`  ID: ${doc.id}, numericId: ${data.numericId}, name/title: ${name}`);
      });
    }

    console.log('\nData verification completed successfully!');
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

verifyData();