const admin = require('firebase-admin');
require('dotenv').config();

if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

async function checkCollections() {
  const [teams, players, matches] = await Promise.all([
    db.collection('teams_v2').get(),
    db.collection('players_v2').get(),
    db.collection('matches_v2').get()
  ]);

  console.log('Current v2 data:');
  console.log('- teams_v2:', teams.size);
  console.log('- players_v2:', players.size);
  console.log('- matches_v2:', matches.size);
}

checkCollections().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});