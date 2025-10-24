// Find available matches and compare with match 53
const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function findMatches() {
  console.log('🔍 FINDING AVAILABLE MATCHES\n');

  try {
    // Get all matches
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).limit(10).get();

    console.log(`Found ${matchesSnapshot.size} matches:`);

    const matches = [];
    matchesSnapshot.forEach(doc => {
      const data = doc.data();
      matches.push({
        id: doc.id,
        displayId: data.displayId,
        title: data.title,
        status: data.status,
        createdAt: data.createdAt
      });
    });

    console.log('Available matches:');
    matches.forEach(match => {
      console.log(`  ID: ${match.id}, DisplayId: ${match.displayId}, Title: ${match.title}, Status: ${match.status}`);
    });

    // Find match 53
    const match53 = matches.find(m => m.displayId === 53);
    if (match53) {
      console.log('\n✅ Found match 53, will compare with the first available match');
      return matches[0]; // Return first match for comparison
    }

  } catch (error) {
    console.error('Error finding matches:', error);
  }
}

async function compareWithFirstMatch() {
  const firstMatch = await findMatches();
  if (!firstMatch) return;

  console.log(`\n🔍 COMPARING MATCH ${firstMatch.displayId} vs MATCH 53\n`);

  try {
    // Get the first match
    const firstMatchSnapshot = await db.collection(V2_COLLECTIONS.MATCHES)
      .where('displayId', '==', firstMatch.displayId)
      .limit(1)
      .get();

    // Get match 53
    const match53Snapshot = await db.collection(V2_COLLECTIONS.MATCHES)
      .where('displayId', '==', 53)
      .limit(1)
      .get();

    if (firstMatchSnapshot.empty || match53Snapshot.empty) {
      console.log('❌ One or both matches not found');
      return;
    }

    const firstMatchData = firstMatchSnapshot.docs[0].data();
    const match53Data = match53Snapshot.docs[0].data();

    console.log(`📋 MATCH ${firstMatch.displayId} STRUCTURE (EXISTING):`);
    console.log('All fields:', Object.keys(firstMatchData).sort());
    console.log('\n📋 MATCH 53 STRUCTURE (UPDATED):');
    console.log('All fields:', Object.keys(match53Data).sort());

    console.log('\n🔍 FIELD COMPARISON:');

    const firstMatchFields = Object.keys(firstMatchData).sort();
    const match53Fields = Object.keys(match53Data).sort();

    const missingIn53 = firstMatchFields.filter(f => !match53Fields.includes(f));
    const extraIn53 = match53Fields.filter(f => !firstMatchFields.includes(f));

    console.log('Fields missing in match 53:', missingIn53);
    console.log('Extra fields in match 53:', extraIn53);

    console.log('\n🔍 SQUAD-RELATED FIELDS IN MATCH 53:');
    const squadFields = ['squads', 'squad', 'squadId', 'totalOvers'];
    squadFields.forEach(field => {
      if (field in match53Data) {
        console.log(`❌ Match 53 has ${field}:`, JSON.stringify(match53Data[field], null, 2));
      }
    });

    console.log('\n🔄 KEY STRUCTURAL FIELDS:');
    const keyFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId'];

    keyFields.forEach(field => {
      console.log(`\n${field}:`);
      console.log(`  Match ${firstMatch.displayId}: ${field in firstMatchData}`);
      console.log(`  Match 53: ${field in match53Data}`);
      if (match53Data[field] !== undefined && match53Data[field] !== null) {
        console.log(`    Match 53 value: ${JSON.stringify(match53Data[field])}`);
      }
    });

  } catch (error) {
    console.error('Error comparing matches:', error);
  }
}

compareWithFirstMatch().catch(console.error);