/**
 * CLEANUP DUPLICATE MATCHES
 *
 * Deletes matches that don't have externalReferenceId (created by migrate-to-v2-collections.js)
 * Keeps only matches created by migrate-from-json-source.js that have players populated
 */

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

async function cleanupDuplicateMatches() {
  console.log('🧹 Starting cleanup of duplicate matches...');

  const matchesRef = db.collection('matches_v2');
  const snapshot = await matchesRef.get();

  const matchesToDelete = [];
  const matchesToKeep = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasExternalRef = data.externalReferenceId !== undefined;
    const hasPlayers = (data.team1?.players?.length > 0) || (data.team2?.players?.length > 0);

    if (hasExternalRef && hasPlayers) {
      matchesToKeep.push({ id: doc.id, title: data.title });
    } else {
      matchesToDelete.push({ id: doc.id, title: data.title, numericId: data.numericId });
    }
  }

  console.log(`Found ${matchesToKeep.length} matches to keep (with players)`);
  console.log(`Found ${matchesToDelete.length} matches to delete (duplicates without players)`);

  // Delete duplicates
  const batchSize = 10;
  let deletedCount = 0;

  for (let i = 0; i < matchesToDelete.length; i += batchSize) {
    const batch = db.batch();
    const batchItems = matchesToDelete.slice(i, i + batchSize);

    for (const match of batchItems) {
      const docRef = matchesRef.doc(match.id);
      batch.delete(docRef);
      console.log(`🗑️  Deleting match: ${match.title} (ID: ${match.id})`);
    }

    await batch.commit();
    deletedCount += batchItems.length;
    console.log(`Deleted ${deletedCount}/${matchesToDelete.length} duplicate matches`);
  }

  console.log('✅ Cleanup completed!');
  console.log(`Kept ${matchesToKeep.length} matches with players`);
  console.log(`Deleted ${matchesToDelete.length} duplicate matches without players`);
}

cleanupDuplicateMatches().catch(console.error);