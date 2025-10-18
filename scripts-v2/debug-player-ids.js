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
const { V2_COLLECTIONS } = require('../config/database-v2');

async function debugPlayerIds() {
  console.log('Checking player numericIds in database...');

  const playersSnapshot = await db.collection(V2_COLLECTIONS.PLAYERS).limit(10).get();

  playersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`${data.name}: numericId=${data.numericId}, displayId=${data.displayId}`);
  });

  // Test lookup by numericId
  const testNumericId = '2000000000000000001';
  console.log(`\nTesting lookup for numericId: ${testNumericId}`);

  const playerQuery = await db.collection(V2_COLLECTIONS.PLAYERS)
    .where('numericId', '==', testNumericId)
    .limit(1)
    .get();

  if (!playerQuery.empty) {
    const doc = playerQuery.docs[0];
    console.log('Found player:', doc.data().name);
  } else {
    console.log('Player not found!');
  }
}

debugPlayerIds().catch(console.error);