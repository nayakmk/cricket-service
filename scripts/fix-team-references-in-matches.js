const { collections } = require('../config/database');

/**
 * Fix team references in matches to use numericIds instead of Firestore document IDs
 */
async function fixTeamReferencesInMatches() {
  console.log('🔧 Fixing team references in matches to use numericIds...\n');

  try {
    // Get all teams with their numericIds
    const teamsSnapshot = await collections.teams.get();
    const teamIdMap = {};

    // Build mapping from Firestore document ID to numericId
    for (const doc of teamsSnapshot.docs) {
      const data = doc.data();
      teamIdMap[doc.id] = data.numericId;
    }

    console.log(`Found ${Object.keys(teamIdMap).length} teams with numericIds\n`);

    // Update match documents
    const matchesSnapshot = await collections.matches.get();
    console.log(`Processing ${matchesSnapshot.size} matches...\n`);

    let updatedCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      let needsUpdate = false;
      const updatedData = { ...matchData };

      // Fix teams.team1.id if it exists
      if (matchData.teams?.team1?.id && teamIdMap[matchData.teams.team1.id]) {
        updatedData.teams.team1.id = teamIdMap[matchData.teams.team1.id];
        needsUpdate = true;
        console.log(`   Fixed team1.id in match ${matchDoc.id}: ${matchData.teams.team1.id} → ${updatedData.teams.team1.id}`);
      }

      // Fix teams.team2.id if it exists
      if (matchData.teams?.team2?.id && teamIdMap[matchData.teams.team2.id]) {
        updatedData.teams.team2.id = teamIdMap[matchData.teams.team2.id];
        needsUpdate = true;
        console.log(`   Fixed team2.id in match ${matchDoc.id}: ${matchData.teams.team2.id} → ${updatedData.teams.team2.id}`);
      }

      // Fix team1Id if it's a document ID
      if (matchData.team1Id && teamIdMap[matchData.team1Id]) {
        updatedData.team1Id = teamIdMap[matchData.team1Id];
        needsUpdate = true;
        console.log(`   Fixed team1Id in match ${matchDoc.id}: ${matchData.team1Id} → ${updatedData.team1Id}`);
      }

      // Fix team2Id if it's a document ID
      if (matchData.team2Id && teamIdMap[matchData.team2Id]) {
        updatedData.team2Id = teamIdMap[matchData.team2Id];
        needsUpdate = true;
        console.log(`   Fixed team2Id in match ${matchDoc.id}: ${matchData.team2Id} → ${updatedData.team2Id}`);
      }

      // Fix winner_id if it's a document ID
      if (matchData.winner_id && teamIdMap[matchData.winner_id]) {
        updatedData.winner_id = teamIdMap[matchData.winner_id];
        needsUpdate = true;
        console.log(`   Fixed winner_id in match ${matchDoc.id}: ${matchData.winner_id} → ${updatedData.winner_id}`);
      }

      // Update the document if changes were made
      if (needsUpdate) {
        updatedData.updatedAt = new Date().toISOString();
        await collections.matches.doc(matchDoc.id).update(updatedData);
        updatedCount++;
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} matches to use numericIds for team references`);

  } catch (error) {
    console.error('❌ Error fixing team references:', error);
  }
}

// Run the script
fixTeamReferencesInMatches();