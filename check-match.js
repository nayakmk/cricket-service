const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

const db = admin.firestore();

async function checkMatch() {
  try {
    const matchesRef = db.collection('matches_v2').where('status', '==', 'completed').limit(1);
    const snapshot = await matchesRef.get();

    if (!snapshot.empty) {
      const match = snapshot.docs[0].data();
      console.log('Match ID:', snapshot.docs[0].id);
      console.log('Match title:', match.title);
      console.log('Match team1:', JSON.stringify(match.team1, null, 2));
      console.log('Match team2:', JSON.stringify(match.team2, null, 2));

      if (match.team1?.players && match.team1.players.length > 0) {
        console.log('Sample team1 player:', JSON.stringify(match.team1.players[0], null, 2));
      }

      if (match.team2?.players && match.team2.players.length > 0) {
        console.log('Sample team2 player:', JSON.stringify(match.team2.players[0], null, 2));
      }
    } else {
      console.log('No matches found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkMatch();