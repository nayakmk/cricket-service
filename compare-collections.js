// Compare matches collections structure
const { db } = require('./config/database-v2');

async function compareCollections() {
  try {
    console.log('🔍 Comparing Matches Collections Structure\n');

    // Get sample documents from both collections
    const [matchesV1Snapshot, matchesV2Snapshot] = await Promise.all([
      db.collection('matches').limit(2).get(),
      db.collection('matches_v2').limit(2).get()
    ]);

    console.log('📊 Collection Counts:');
    console.log(`matches (v1): ${matchesV1Snapshot.size} sample documents`);
    console.log(`matches_v2: ${matchesV2Snapshot.size} sample documents\n`);

    if (!matchesV1Snapshot.empty) {
      console.log('🏏 V1 MATCHES STRUCTURE (matches collection):');
      console.log('='.repeat(50));
      matchesV1Snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\nDocument ${index + 1} - ID: ${doc.id}`);
        console.log('Top-level fields:', Object.keys(data));
        console.log('Sample data:');

        // Show key structure differences
        const structure = {
          id: doc.id,
          hasNestedTeams: !!(data.team1 && typeof data.team1 === 'object'),
          hasSquadData: !!(data.team1Squad || data.team2Squad),
          hasDisplayId: 'displayId' in data,
          hasNumericId: 'numericId' in data,
          status: data.status,
          team1Score: data.team1Score,
          team2Score: data.team2Score,
          tournament: data.tournament || data.tournamentName,
          inningsCount: data.innings ? data.innings.length : 0
        };
        console.log(JSON.stringify(structure, null, 2));
      });
    }

    if (!matchesV2Snapshot.empty) {
      console.log('\n🏏 V2 MATCHES STRUCTURE (matches_v2 collection):');
      console.log('='.repeat(50));
      matchesV2Snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\nDocument ${index + 1} - ID: ${doc.id}`);
        console.log('Top-level fields:', Object.keys(data));
        console.log('Sample data:');

        // Show key structure differences
        const structure = {
          id: doc.id,
          hasNestedTeams: !!(data.team1 && typeof data.team1 === 'object'),
          hasSquadData: !!(data.team1?.squad || data.team2?.squad),
          hasDisplayId: 'displayId' in data,
          hasNumericId: 'numericId' in data,
          status: data.status,
          team1Score: data.team1Score || (data.team1?.score?.runs),
          team2Score: data.team2Score || (data.team2?.score?.runs),
          tournament: data.tournament?.name || data.tournament,
          inningsCount: data.innings ? data.innings.length : 0
        };
        console.log(JSON.stringify(structure, null, 2));
      });
    }

    // Compare structures
    console.log('\n📈 STRUCTURE COMPARISON:');
    console.log('='.repeat(50));

    if (!matchesV1Snapshot.empty && !matchesV2Snapshot.empty) {
      const v1Doc = matchesV1Snapshot.docs[0].data();
      const v2Doc = matchesV2Snapshot.docs[0].data();

      const v1Fields = Object.keys(v1Doc);
      const v2Fields = Object.keys(v2Doc);

      const v1Only = v1Fields.filter(f => !v2Fields.includes(f));
      const v2Only = v2Fields.filter(f => !v1Fields.includes(f));
      const common = v1Fields.filter(f => v2Fields.includes(f));

      console.log('Fields only in V1:', v1Only);
      console.log('Fields only in V2:', v2Only);
      console.log('Common fields:', common);

      console.log('\n🔄 KEY DIFFERENCES:');
      console.log('- V1: Flat structure (team1, team1Squad, team1Score separate)');
      console.log('- V2: Nested structure (team1: {id, name, squad, score})');
      console.log('- V1: May use team1Squad/team2Squad references');
      console.log('- V2: Embeds squad data directly in team objects');
      console.log('- V2: Consistent numericId/displayId system');
      console.log('- V2: Better tournament data structure');
    }

  } catch (err) {
    console.error('Error comparing collections:', err);
  }
}

compareCollections();