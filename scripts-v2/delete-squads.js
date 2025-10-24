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

async function deleteExistingSquads() {
  console.log('Deleting existing match squads...');

  const squadsRef = db.collection('match_squads_v2');
  const snapshot = await squadsRef.get();

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    batch.delete(doc.ref);
    count++;
  });

  await batch.commit();
  console.log(`Deleted ${count} squads`);
}

deleteExistingSquads().catch(console.error);