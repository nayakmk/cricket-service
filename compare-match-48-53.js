// Compare match 48 and 53 at collection level to identify structural differences
const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function compareMatches() {
  console.log('🔍 COMPARING MATCH 48 vs MATCH 53 AT COLLECTION LEVEL\n');

  try {
    // Get match 48 (existing match)
    const match48Snapshot = await db.collection(V2_COLLECTIONS.MATCHES)
      .where('displayId', '==', 48)
      .limit(1)
      .get();

    // Get match 53 (updated match)
    const match53Snapshot = await db.collection(V2_COLLECTIONS.MATCHES)
      .where('displayId', '==', 53)
      .limit(1)
      .get();

    if (match48Snapshot.empty) {
      console.log('❌ Match 48 not found');
      return;
    }

    if (match53Snapshot.empty) {
      console.log('❌ Match 53 not found');
      return;
    }

    const match48Data = match48Snapshot.docs[0].data();
    const match53Data = match53Snapshot.docs[0].data();

    console.log('📋 MATCH 48 STRUCTURE (EXISTING):');
    console.log('All fields:', Object.keys(match48Data).sort());
    console.log('\n📋 MATCH 53 STRUCTURE (UPDATED):');
    console.log('All fields:', Object.keys(match53Data).sort());

    console.log('\n🔍 FIELD COMPARISON:');

    const match48Fields = Object.keys(match48Data).sort();
    const match53Fields = Object.keys(match53Data).sort();

    const missingIn53 = match48Fields.filter(f => !match53Fields.includes(f));
    const extraIn53 = match53Fields.filter(f => !match48Fields.includes(f));

    console.log('Fields missing in match 53:', missingIn53);
    console.log('Extra fields in match 53:', extraIn53);

    console.log('\n🔄 KEY FIELD VALUES COMPARISON:');

    // Compare key structural fields
    const keyFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId', 'team1', 'team2'];

    keyFields.forEach(field => {
      console.log(`\n${field}:`);
      console.log(`  Match 48: ${field in match48Data} (${typeof match48Data[field]})`);
      if (match48Data[field] !== undefined) {
        console.log(`    Value: ${JSON.stringify(match48Data[field], null, 2)}`);
      }
      console.log(`  Match 53: ${field in match53Data} (${typeof match53Data[field]})`);
      if (match53Data[field] !== undefined) {
        console.log(`    Value: ${JSON.stringify(match53Data[field], null, 2)}`);
      }
    });

    console.log('\n🏏 TEAM STRUCTURE COMPARISON:');

    console.log('Match 48 team1 fields:', Object.keys(match48Data.team1 || {}).sort());
    console.log('Match 53 team1 fields:', Object.keys(match53Data.team1 || {}).sort());
    console.log('Match 48 team2 fields:', Object.keys(match48Data.team2 || {}).sort());
    console.log('Match 53 team2 fields:', Object.keys(match53Data.team2 || {}).sort());

    // Check if team structures have players arrays
    console.log('\nTeam players arrays:');
    console.log('Match 48 team1.players:', !!(match48Data.team1 && match48Data.team1.players));
    console.log('Match 53 team1.players:', !!(match53Data.team1 && match53Data.team1.players));
    console.log('Match 48 team2.players:', !!(match48Data.team2 && match48Data.team2.players));
    console.log('Match 53 team2.players:', !!(match53Data.team2 && match53Data.team2.players));

    // Check for any squad-related fields that shouldn't be there
    console.log('\n🔍 SQUAD-RELATED FIELDS CHECK:');
    const squadFields = ['squads', 'squad', 'squadId'];
    squadFields.forEach(field => {
      if (field in match53Data) {
        console.log(`❌ Match 53 has ${field}:`, JSON.stringify(match53Data[field], null, 2));
      }
    });

  } catch (error) {
    console.error('Error comparing matches:', error);
  }
}

compareMatches().catch(console.error);