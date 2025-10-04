const { collections } = require('../config/database');

async function migrateInningsDocumentIds() {
  console.log('Starting innings document ID migration...');

  try {
    const matchesSnapshot = await collections.matches.get();
    console.log(`Found ${matchesSnapshot.docs.length} matches to process`);

    let totalInningsMigrated = 0;
    let totalInningsDeleted = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      console.log(`\nProcessing match ${matchId}`);

      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      if (inningsSnapshot.empty) {
        console.log(`  No innings found for match ${matchId}`);
        continue;
      }

      console.log(`  Found ${inningsSnapshot.docs.length} innings`);

      // Process each inning
      for (const inningDoc of inningsSnapshot.docs) {
        const oldInningId = inningDoc.id;
        const inningData = inningDoc.data();
        const inningNumber = inningData.inningNumber;

        // Create new document ID: matchId-inningNumber (e.g., "202510040918320000004-1")
        const newInningId = `${matchId}-${inningNumber}`;

        console.log(`    Migrating inning ${oldInningId} -> ${newInningId}`);

        // Create new document with the formatted ID
        const newInningData = { ...inningData };
        delete newInningData.id; // Remove any id field that might exist
        newInningData._migrated = true;
        newInningData._originalId = oldInningId;

        await collections.matches.doc(matchId).collection('innings').doc(newInningId).set(newInningData);

        totalInningsMigrated++;

        // Delete the old document
        await collections.matches.doc(matchId).collection('innings').doc(oldInningId).delete();
        totalInningsDeleted++;

        console.log(`      ✅ Migrated and deleted old document`);
      }
    }

    console.log(`\nMigration completed!`);
    console.log(`Total innings migrated: ${totalInningsMigrated}`);
    console.log(`Total old documents deleted: ${totalInningsDeleted}`);

    if (totalInningsMigrated !== totalInningsDeleted) {
      console.log('⚠️  Warning: Migration count mismatch!');
    } else {
      console.log('✅ Migration successful - all documents migrated');
    }

  } catch (error) {
    console.error('Error during innings migration:', error);
  }
}

migrateInningsDocumentIds();