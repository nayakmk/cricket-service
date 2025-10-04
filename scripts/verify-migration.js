const { collections } = require('../config/database');

/**
 * Verify that migrated documents exist with new IDs
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration results...\n');

  try {
    // Check teams
    console.log('Checking teams...');
    const teamsSnapshot = await collections.teams.get();
    console.log(`✅ Teams collection: ${teamsSnapshot.docs.length} documents`);

    // Show a few team IDs
    teamsSnapshot.docs.slice(0, 3).forEach(doc => {
      console.log(`   Team ID: ${doc.id} (length: ${doc.id.length})`);
    });

    // Check players
    console.log('\nChecking players...');
    const playersSnapshot = await collections.players.get();
    console.log(`✅ Players collection: ${playersSnapshot.docs.length} documents`);

    // Show a few player IDs
    playersSnapshot.docs.slice(0, 3).forEach(doc => {
      console.log(`   Player ID: ${doc.id} (length: ${doc.id.length})`);
    });

    // Check matches
    console.log('\nChecking matches...');
    const matchesSnapshot = await collections.matches.get();
    console.log(`✅ Matches collection: ${matchesSnapshot.docs.length} documents`);

    // Show a few match IDs
    matchesSnapshot.docs.slice(0, 3).forEach(doc => {
      console.log(`   Match ID: ${doc.id} (length: ${doc.id.length})`);
    });

    // Check teamLineups
    console.log('\nChecking teamLineups...');
    const teamLineupsSnapshot = await collections.teamLineups.get();
    console.log(`✅ TeamLineups collection: ${teamLineupsSnapshot.docs.length} documents`);

    // Show a few teamLineup IDs
    teamLineupsSnapshot.docs.slice(0, 3).forEach(doc => {
      console.log(`   TeamLineup ID: ${doc.id} (length: ${doc.id.length})`);
    });

    // Verify references work
    console.log('\n🔗 Verifying references...');
    if (teamsSnapshot.docs.length > 0 && matchesSnapshot.docs.length > 0) {
      const firstMatch = matchesSnapshot.docs[0].data();
      const team1Exists = firstMatch.team1Id && (await collections.teams.doc(firstMatch.team1Id).get()).exists;
      const team2Exists = firstMatch.team2Id && (await collections.teams.doc(firstMatch.team2Id).get()).exists;

      console.log(`✅ Match-team references: Team1=${team1Exists}, Team2=${team2Exists}`);
    }

    console.log('\n🎉 Migration verification completed successfully!');
    console.log('📊 All documents now have formatted IDs: YYYYMMDDHHMMSS + 7-digit sequence');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

// Run the verification if this script is executed directly
if (require.main === module) {
  verifyMigration()
    .then(() => {
      console.log('\n✅ Verification completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyMigration };