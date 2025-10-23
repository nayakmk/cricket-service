// Check database collections
const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function checkCollections() {
  try {
    console.log('V2 Collections:', V2_COLLECTIONS);

    // Check what collections exist
    const collections = await db.listCollections();
    console.log('All collections:');
    collections.forEach(col => {
      console.log('-', col.id);
    });

    // Check matches_v2 collection
    console.log('\nChecking matches_v2 collection:');
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).limit(3).get();
    console.log(`Found ${matchesSnapshot.size} matches in matches_v2`);

    if (!matchesSnapshot.empty) {
      matchesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Match ${doc.id}:`, {
          numericId: data.numericId,
          displayId: data.displayId,
          status: data.status,
          team1: data.team1?.name,
          team2: data.team2?.name
        });
      });
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkCollections();