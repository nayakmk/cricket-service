// Compare existing vs newly created match document structures
const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function compareMatchStructures() {
  try {
    console.log('=== COMPARING MATCH DOCUMENT STRUCTURES ===\n');

    // Get an existing match (one that was migrated)
    const existingSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).limit(1).get();
    if (existingSnapshot.empty) {
      console.log('No existing matches found');
      return;
    }

    const existingDoc = existingSnapshot.docs[0];
    const existingData = existingDoc.data();

    console.log('📄 EXISTING MATCH DOCUMENT:');
    console.log('Document ID:', existingDoc.id);
    console.log('Fields:', Object.keys(existingData).sort());
    console.log('Data:', JSON.stringify(existingData, null, 2));

    // Now get the newly created match (displayId: 50)
    const newMatchDoc = await db.collection(V2_COLLECTIONS.MATCHES)
      .where('displayId', '==', 50)
      .limit(1)
      .get();

    if (!newMatchDoc.empty) {
      const newDoc = newMatchDoc.docs[0];
      const newData = newDoc.data();

      console.log('\n🆕 NEWLY CREATED MATCH DOCUMENT:');
      console.log('Document ID:', newDoc.id);
      console.log('Fields:', Object.keys(newData).sort());
      console.log('Data:', JSON.stringify(newData, null, 2));

      // Compare structures
      console.log('\n🔍 STRUCTURE COMPARISON:');

      const existingFields = Object.keys(existingData).sort();
      const newFields = Object.keys(newData).sort();

      console.log('Existing fields count:', existingFields.length);
      console.log('New fields count:', newFields.length);

      const missingInNew = existingFields.filter(f => !newFields.includes(f));
      const extraInNew = newFields.filter(f => !existingFields.includes(f));

      if (missingInNew.length > 0) {
        console.log('❌ Fields missing in new document:', missingInNew);
      }

      if (extraInNew.length > 0) {
        console.log('➕ Extra fields in new document:', extraInNew);
      }

      if (missingInNew.length === 0 && extraInNew.length === 0) {
        console.log('✅ Field structure is consistent!');
      }

      // Compare key field types
      console.log('\n📊 FIELD TYPE COMPARISON:');
      const keyFields = ['numericId', 'displayId', 'status', 'team1', 'team2', 'tournament'];

      for (const field of keyFields) {
        const existingType = typeof existingData[field];
        const newType = typeof newData[field];

        if (existingType === newType) {
          console.log(`✅ ${field}: ${existingType}`);
        } else {
          console.log(`❌ ${field}: existing=${existingType}, new=${newType}`);
        }
      }

      // Deep comparison of nested structures
      console.log('\n🏗️  NESTED STRUCTURE COMPARISON:');

      // Compare team1 structure
      if (existingData.team1 && newData.team1) {
        console.log('Team1 fields - Existing:', Object.keys(existingData.team1).sort());
        console.log('Team1 fields - New:', Object.keys(newData.team1).sort());

        if (JSON.stringify(Object.keys(existingData.team1).sort()) === JSON.stringify(Object.keys(newData.team1).sort())) {
          console.log('✅ Team1 structure consistent');
        } else {
          console.log('❌ Team1 structure differs');
        }
      }

      // Compare team2 structure
      if (existingData.team2 && newData.team2) {
        console.log('Team2 fields - Existing:', Object.keys(existingData.team2).sort());
        console.log('Team2 fields - New:', Object.keys(newData.team2).sort());

        if (JSON.stringify(Object.keys(existingData.team2).sort()) === JSON.stringify(Object.keys(newData.team2).sort())) {
          console.log('✅ Team2 structure consistent');
        } else {
          console.log('❌ Team2 structure differs');
        }
      }

    } else {
      console.log('Newly created match not found - it may have been deleted during testing');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

compareMatchStructures();