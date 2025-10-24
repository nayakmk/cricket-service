const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
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

async function verifyV2Data() {
  console.log('Verifying v2 data structure...\n');

  try {
    // Check teams_v2 collection
    const teamsSnapshot = await db.collection('teams_v2').get();
    console.log(`✅ teams_v2: ${teamsSnapshot.size} documents`);

    // Check players_v2 collection
    const playersSnapshot = await db.collection('players_v2').get();
    console.log(`✅ players_v2: ${playersSnapshot.size} documents`);

    // Check matches_v2 collection
    const matchesSnapshot = await db.collection('matches_v2').get();
    console.log(`✅ matches_v2: ${matchesSnapshot.size} documents`);

    // Check subcollections for each match
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      console.log(`\n📊 Match ${matchId}:`);

      // Check squads subcollection
      const squadsSnapshot = await db.collection('matches_v2').doc(matchId).collection('squads').get();
      console.log(`  └─ squads: ${squadsSnapshot.size} documents`);

      // Check innings subcollection
      const inningsSnapshot = await db.collection('matches_v2').doc(matchId).collection('innings').get();
      console.log(`  └─ innings: ${inningsSnapshot.size} documents`);

      // Check playerStats subcollection
      const playerStatsSnapshot = await db.collection('matches_v2').doc(matchId).collection('playerStats').get();
      console.log(`  └─ playerStats: ${playerStatsSnapshot.size} documents`);
    }

    console.log('\n🎉 V2 data structure verification completed!');

  } catch (error) {
    console.error('❌ Error verifying data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  verifyV2Data()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyV2Data };