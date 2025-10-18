/**
 * CLEANUP DUPLICATE ENTRIES IN V2 COLLECTIONS
 *
 * Removes duplicate entries from v2 collections based on numericId
 * Keeps the first occurrence of each numericId
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

async function cleanupDuplicates(collectionName, idField = 'numericId') {
  console.log(`🧹 Starting cleanup of duplicates in ${collectionName}...`);

  const collectionRef = db.collection(collectionName);
  const snapshot = await collectionRef.get();

  console.log(`Found ${snapshot.size} documents in ${collectionName}`);

  // Group documents by numericId
  const itemsById = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = data[idField];

    if (!itemsById.has(id)) {
      itemsById.set(id, []);
    }
    itemsById.get(id).push({
      id: doc.id,
      name: data.name || data.title || `Document ${doc.id}`,
      numericId: id
    });
  }

  // Find duplicates
  const duplicatesToDelete = [];
  for (const [id, items] of itemsById) {
    if (items.length > 1) {
      console.log(`Found ${items.length} duplicates for ${idField} ${id}:`);
      items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} (ID: ${item.id})`);
      });

      // Keep the first one, delete the rest
      const toKeep = items[0];
      const toDelete = items.slice(1);

      console.log(`  Keeping: ${toKeep.name} (ID: ${toKeep.id})`);
      console.log(`  Deleting ${toDelete.length} duplicates`);

      duplicatesToDelete.push(...toDelete);
    }
  }

  if (duplicatesToDelete.length === 0) {
    console.log(`✅ No duplicates found in ${collectionName}`);
    return 0;
  }

  console.log(`\n🗑️  Deleting ${duplicatesToDelete.length} duplicate documents from ${collectionName}...`);

  // Delete duplicates in batches
  const batchSize = 10;
  let deletedCount = 0;

  for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
    const batch = db.batch();
    const batchItems = duplicatesToDelete.slice(i, i + batchSize);

    for (const item of batchItems) {
      batch.delete(collectionRef.doc(item.id));
    }

    await batch.commit();
    deletedCount += batchItems.length;
    console.log(`  Deleted batch of ${batchItems.length} duplicates (${deletedCount}/${duplicatesToDelete.length})`);
  }

  console.log(`\n✅ Cleanup completed for ${collectionName}! Deleted ${deletedCount} duplicates`);
  return deletedCount;
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive cleanup of v2 collections...\n');

    const matchesDeleted = await cleanupDuplicates('matches_v2');
    const teamsDeleted = await cleanupDuplicates('teams_v2');
    const playersDeleted = await cleanupDuplicates('players_v2');

    const totalDeleted = matchesDeleted + teamsDeleted + playersDeleted;

    console.log('\n🎉 Cleanup Summary:');
    console.log(`  Matches: ${matchesDeleted} duplicates removed`);
    console.log(`  Teams: ${teamsDeleted} duplicates removed`);
    console.log(`  Players: ${playersDeleted} duplicates removed`);
    console.log(`  Total: ${totalDeleted} duplicates removed`);

    if (totalDeleted > 0) {
      console.log('\n⚠️  IMPORTANT: After cleanup, you may need to:');
      console.log('  1. Re-run career stats updates');
      console.log('  2. Re-run team statistics updates');
      console.log('  3. Clear any cached data in the frontend');
    }

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
main();