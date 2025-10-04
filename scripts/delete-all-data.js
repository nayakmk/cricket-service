const { collections, db } = require('../config/database');

class DataDeleter {
  constructor() {
    this.collections = [
      'matches',
      'teams',
      'players',
      'teamLineups',
      'innings',
      'balls',
      'users',
      'sequences'
    ];
  }

  async deleteAllData() {
    console.log('Starting data deletion process...');

    for (const collectionName of this.collections) {
      try {
        await this.deleteCollection(collectionName);
        console.log(`✓ Deleted all documents from ${collectionName} collection`);
      } catch (error) {
        console.error(`✗ Error deleting ${collectionName} collection:`, error);
      }
    }

    console.log('Data deletion process completed.');
  }

  async deleteCollection(collectionName) {
    const collectionRef = collections[collectionName];
    const batchSize = 500; // Firestore batch limit

    while (true) {
      const snapshot = await collectionRef.limit(batchSize).get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`  Deleted ${snapshot.docs.length} documents from ${collectionName}`);

      if (snapshot.docs.length < batchSize) {
        break;
      }
    }
  }
}

// Run the deletion if this script is executed directly
if (require.main === module) {
  const deleter = new DataDeleter();
  deleter.deleteAllData()
    .then(() => {
      console.log('All data deleted successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error during data deletion:', error);
      process.exit(1);
    });
}

module.exports = DataDeleter;