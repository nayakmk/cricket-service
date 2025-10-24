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

async function clearCollections() {
  console.log('Clearing existing collections...');

  const collections = [
    'teams_v2',
    'players_v2',
    'matches_v2',
    'match_squads_v2',
    'innings_v2',
    'player_match_stats_v2',
    'tournament_teams_v2',
    'tournaments_v2'
  ];

  for (const collectionName of collections) {
    try {
      console.log(`Clearing ${collectionName}...`);
      const collectionRef = db.collection(collectionName);
      const snapshot = await collectionRef.get();

      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleared ${snapshot.docs.length} documents from ${collectionName}`);
      } else {
        console.log(`${collectionName} is already empty`);
      }
    } catch (error) {
      console.log(`Error clearing ${collectionName}:`, error.message);
    }
  }

  console.log('Collection clearing completed');
}

// Run if called directly
if (require.main === module) {
  clearCollections()
    .then(() => {
      console.log('All collections cleared successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to clear collections:', error);
      process.exit(1);
    });
}

module.exports = { clearCollections };