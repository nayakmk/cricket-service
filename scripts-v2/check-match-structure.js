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

async function checkMatchStructure() {
  // Get one match
  const matchesSnapshot = await db.collection('matches_v2').limit(1).get();
  if (matchesSnapshot.empty) {
    console.log('No matches found');
    return;
  }

  const matchDoc = matchesSnapshot.docs[0];
  const match = { id: matchDoc.id, ...matchDoc.data() };

  console.log('Match structure:');
  console.log(JSON.stringify(match, null, 2));
}

checkMatchStructure().catch(console.error);