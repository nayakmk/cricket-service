const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDocumentIds() {
  console.log('Checking player document IDs...\n');

  const playersSnapshot = await db.collection('players').limit(10).get();
  console.log('Player document IDs vs numeric IDs:');
  playersSnapshot.docs.forEach(doc => {
    const player = doc.data();
    console.log(`  Document ID: ${doc.id}, Numeric ID: ${player.numericId}, Name: ${player.name}`);
  });

  // Check if any document IDs match the innings playerIds
  const sampleInningsPlayerId = '202510050942470000002';
  console.log(`\nChecking if sample innings playerId '${sampleInningsPlayerId}' exists as document ID...`);

  const playerDoc = await db.collection('players').doc(sampleInningsPlayerId).get();
  if (playerDoc.exists) {
    const player = playerDoc.data();
    console.log(`✓ Found player: ${player.name} (numericId: ${player.numericId})`);
  } else {
    console.log('✗ Player document not found');
  }

  process.exit(0);
}

checkDocumentIds().catch(console.error);