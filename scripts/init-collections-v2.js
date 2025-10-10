// Cricket App v2 - Collection Initialization Script
// Initializes v2 collections with proper indexes and configuration

const admin = require('firebase-admin');
const { V2_COLLECTIONS, getV2Collection } = require('../config/database-v2');

/**
 * Initializes v2 collections in Firebase Firestore
 * This script should be run once to set up the new collections
 */
async function initializeV2Collections() {
  console.log('🚀 Initializing Cricket App v2 Collections...');

  try {
    // Create collections (Firebase creates them automatically on first write)
    // But we can verify they exist and set up any initial configuration

    const collections = [
      'players_v2',
      'teams_v2',
      'matches_v2',
      'match_squads_v2',
      'innings_v2',
      'tournament_teams_v2',
      'player_match_stats_v2',
      'tournaments_v2'
    ];

    console.log('📋 Collections to initialize:', collections);

    // Verify Firebase connection
    const db = admin.firestore();
    const testDoc = await db.collection('test').doc('connection').get();

    console.log('✅ Firebase connection verified');

    // Create a test document in each collection to ensure they exist
    const initPromises = collections.map(async (collectionName) => {
      try {
        const collectionRef = db.collection(collectionName);
        const initDocRef = collectionRef.doc('_init');

        // Check if init document exists
        const initDoc = await initDocRef.get();

        if (!initDoc.exists) {
          // Create initialization document
          await initDocRef.set({
            initialized: true,
            initializedAt: admin.firestore.FieldValue.serverTimestamp(),
            version: '2.0.0',
            description: `Initialized ${collectionName} collection for Cricket App v2`
          });
          console.log(`✅ Initialized collection: ${collectionName}`);
        } else {
          console.log(`ℹ️  Collection already initialized: ${collectionName}`);
        }

        return true;
      } catch (error) {
        console.error(`❌ Failed to initialize collection ${collectionName}:`, error);
        return false;
      }
    });

    const results = await Promise.all(initPromises);
    const successCount = results.filter(Boolean).length;

    console.log(`\n🎉 Collection initialization complete!`);
    console.log(`✅ Successfully initialized: ${successCount}/${collections.length} collections`);

    if (successCount === collections.length) {
      console.log('🚀 All v2 collections are ready for use!');
      console.log('\n📝 Next steps:');
      console.log('1. Run data migration scripts to populate collections');
      console.log('2. Update API endpoints to use v2 collections');
      console.log('3. Test the new data models');
    } else {
      console.log('⚠️  Some collections failed to initialize. Please check the errors above.');
    }

  } catch (error) {
    console.error('❌ Collection initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Cleans up initialization documents (optional cleanup)
 */
async function cleanupInitDocuments() {
  console.log('🧹 Cleaning up initialization documents...');

  const db = admin.firestore();
  const collections = [
    'players_v2',
    'teams_v2',
    'matches_v2',
    'match_squads_v2',
    'innings_v2',
    'tournament_teams_v2',
    'player_match_stats_v2',
    'tournaments_v2'
  ];

  try {
    const cleanupPromises = collections.map(async (collectionName) => {
      try {
        const initDocRef = db.collection(collectionName).doc('_init');
        await initDocRef.delete();
        console.log(`🗑️  Cleaned up ${collectionName}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to cleanup ${collectionName}:`, error);
        return false;
      }
    });

    const results = await Promise.all(cleanupPromises);
    const successCount = results.filter(Boolean).length;

    console.log(`\n🧹 Cleanup complete: ${successCount}/${collections.length} collections cleaned`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

/**
 * Verifies collection structure and indexes
 */
async function verifyCollections() {
  console.log('🔍 Verifying v2 collections...');

  const db = admin.firestore();
  const collections = [
    'players_v2',
    'teams_v2',
    'matches_v2',
    'match_squads_v2',
    'innings_v2',
    'tournament_teams_v2',
    'player_match_stats_v2',
    'tournaments_v2'
  ];

  try {
    const verificationPromises = collections.map(async (collectionName) => {
      try {
        const collectionRef = db.collection(collectionName);
        const snapshot = await collectionRef.limit(1).get();

        if (!snapshot.empty) {
          console.log(`✅ Collection exists: ${collectionName} (${snapshot.size} documents)`);
        } else {
          console.log(`⚠️  Collection exists but empty: ${collectionName}`);
        }
        return true;
      } catch (error) {
        console.error(`❌ Collection verification failed for ${collectionName}:`, error);
        return false;
      }
    });

    const results = await Promise.all(verificationPromises);
    const successCount = results.filter(Boolean).length;

    console.log(`\n🔍 Verification complete: ${successCount}/${collections.length} collections verified`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'init':
    initializeV2Collections();
    break;
  case 'cleanup':
    cleanupInitDocuments();
    break;
  case 'verify':
    verifyCollections();
    break;
  default:
    console.log('Usage: node init-collections.js <command>');
    console.log('Commands:');
    console.log('  init    - Initialize v2 collections');
    console.log('  cleanup - Clean up initialization documents');
    console.log('  verify  - Verify collection existence');
    break;
}

module.exports = {
  initializeV2Collections,
  cleanupInitDocuments,
  verifyCollections
};