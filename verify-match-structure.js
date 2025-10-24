const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize Firebase Admin SDK (same as database-v2.js)
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

async function checkMatchStructure() {
  const matchesRef = db.collection('matches_v2');
  const snapshot = await matchesRef.limit(1).get();

  if (!snapshot.empty) {
    const match = snapshot.docs[0].data();
    console.log('Match ID:', snapshot.docs[0].id);
    console.log('Match structure:');
    console.log(JSON.stringify({
      team1: {
        name: match.team1?.name,
        innings: match.team1?.innings ? 'EXISTS' : 'MISSING',
        inningsCount: match.team1?.innings?.length || 0
      },
      team2: {
        name: match.team2?.name,
        innings: match.team2?.innings ? 'EXISTS' : 'MISSING',
        inningsCount: match.team2?.innings?.length || 0
      },
      separateInnings: match.innings ? 'EXISTS (SHOULD BE REMOVED)' : 'NOT EXISTS'
    }, null, 2));

    if (match.team1?.innings && match.team1.innings.length > 0) {
      console.log('\nTeam1 innings sample:');
      console.log(JSON.stringify(match.team1.innings[0], null, 2));
    } else {
      console.log('\nTeam1 innings is empty or undefined');
    }

    if (match.team2?.innings && match.team2.innings.length > 0) {
      console.log('\nTeam2 innings sample:');
      console.log(JSON.stringify(match.team2.innings[0], null, 2));
    } else {
      console.log('\nTeam2 innings is empty or undefined');
    }
  } else {
    console.log('No matches found');
  }

  process.exit(0);
}

checkMatchStructure().catch(console.error);