const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase with environment variables
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
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

async function checkAllRounders() {
  console.log('🔍 Checking for all-rounders (players with both batting and bowling in same match)...\n');

  const matchesRef = db.collection('matches_v2');
  const matchSnapshot = await matchesRef.limit(3).get();

  let matchCount = 0;
  matchSnapshot.forEach(doc => {
    matchCount++;
    const match = doc.data();
    console.log(`Match ${matchCount}: ${match.title}`);

    // Check for all-rounders in both teams
    const allRounders = [];

    [...match.team1.players, ...match.team2.players].forEach(player => {
      const hasBatting = player.batting && (player.batting.runs > 0 || player.batting.balls > 0);
      const hasBowling = player.bowling && (player.bowling.wickets > 0 || player.bowling.runs > 0 || player.bowling.overs > 0);

      if (hasBatting && hasBowling) {
        const teamName = match.team1.players.find(p => p.name === player.name) ? match.team1.name : match.team2.name;
        allRounders.push({
          name: player.name,
          team: teamName,
          batting: player.batting,
          bowling: player.bowling
        });
      }
    });

    if (allRounders.length > 0) {
      console.log(`  🎯 All-rounders found: ${allRounders.length}`);
      allRounders.forEach(ar => {
        console.log(`    - ${ar.name} (${ar.team}): Bat ${ar.batting.runs}r/${ar.batting.balls}b, Bowl ${ar.bowling.wickets}w/${ar.bowling.overs}o`);
      });
    } else {
      console.log(`  ❌ No all-rounders in this match`);
    }

    console.log('');
  });

  console.log('✅ All-rounder check complete!');
  process.exit(0);
}

checkAllRounders().catch(console.error);