// Check tournaments in database
const { db, V2_COLLECTIONS } = require('../config/database-v2');

async function checkTournaments() {
  console.log('Checking tournaments in database...');

  try {
    const snapshot = await db.collection(V2_COLLECTIONS.TOURNAMENTS).limit(10).get();
    console.log('Found', snapshot.size, 'tournaments:');

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('- ID:', doc.id, 'displayId:', data.displayId, 'name:', data.name);
    });

    // Also check for GEN2025 specifically
    console.log('\nChecking for GEN2025...');
    const gen2025Snapshot = await db.collection(V2_COLLECTIONS.TOURNAMENTS)
      .where('displayId', '==', 'GEN2025')
      .get();

    if (gen2025Snapshot.empty) {
      console.log('❌ Tournament GEN2025 not found');
    } else {
      console.log('✅ Tournament GEN2025 found:', gen2025Snapshot.docs[0].data());
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkTournaments();