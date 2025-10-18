require('dotenv').config();

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

async function cleanup() {
  console.log('Cleaning up duplicate players and squads...');

  // Delete all players_v2
  const playersSnapshot = await db.collection('players_v2').get();
  console.log(`Found ${playersSnapshot.size} players to delete`);

  const deletePromises = [];
  playersSnapshot.forEach(doc => {
    deletePromises.push(doc.ref.delete());
  });

  // Delete all match_squads
  const squadsSnapshot = await db.collection('match_squads').get();
  console.log(`Found ${squadsSnapshot.size} squads to delete`);

  squadsSnapshot.forEach(doc => {
    deletePromises.push(doc.ref.delete());
  });

  // Delete in batches to avoid limits
  const batchSize = 500;
  for (let i = 0; i < deletePromises.length; i += batchSize) {
    const batch = deletePromises.slice(i, i + batchSize);
    await Promise.all(batch);
    console.log(`Deleted ${Math.min(i + batchSize, deletePromises.length)}/${deletePromises.length} documents`);
  }

  console.log('Cleanup completed!');
}

cleanup().catch(console.error);