const { collections } = require('../config/database');

/**
 * Fix winner references in matches to use numericIds consistently
 */
async function fixWinnerReferencesInMatches() {
  console.log('🔧 Fixing winner references in matches to use numericIds...\n');

  try {
    // Get all teams with their numericIds and names
    const teamsSnapshot = await collections.teams.get();
    const teamNameToIdMap = {};
    const teamIdToNameMap = {};

    // Build mappings
    for (const doc of teamsSnapshot.docs) {
      const data = doc.data();
      teamNameToIdMap[data.name] = data.numericId;
      teamIdToNameMap[data.numericId] = data.name;
    }

    console.log(`Found ${Object.keys(teamNameToIdMap).length} teams\n`);

    // Update match documents
    const matchesSnapshot = await collections.matches.get();
    console.log(`Processing ${matchesSnapshot.size} matches...\n`);

    let updatedCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      let needsUpdate = false;
      const updatedData = { ...matchData };

      // If winner is a team name, convert it to numericId
      if (matchData.winner && typeof matchData.winner === 'string' && teamNameToIdMap[matchData.winner]) {
        updatedData.winner = teamNameToIdMap[matchData.winner];
        needsUpdate = true;
        console.log(`   Fixed winner in match ${matchDoc.id}: "${matchData.winner}" → ${updatedData.winner}`);
      }

      // If result.winner is a team name, convert it to numericId
      if (matchData.result?.winner && typeof matchData.result.winner === 'string' && teamNameToIdMap[matchData.result.winner]) {
        updatedData.result = {
          ...matchData.result,
          winner: teamNameToIdMap[matchData.result.winner]
        };
        needsUpdate = true;
        console.log(`   Fixed result.winner in match ${matchDoc.id}: "${matchData.result.winner}" → ${updatedData.result.winner}`);
      }

      // If winner_id exists but winner doesn't, set winner to winner_id
      if (matchData.winner_id && !matchData.winner) {
        updatedData.winner = matchData.winner_id;
        needsUpdate = true;
        console.log(`   Set winner from winner_id in match ${matchDoc.id}: ${matchData.winner_id}`);
      }

      // If toss.winner is a team name, convert it to numericId
      if (matchData.toss?.winner && typeof matchData.toss.winner === 'string' && teamNameToIdMap[matchData.toss.winner]) {
        updatedData.toss = {
          ...matchData.toss,
          winner: teamNameToIdMap[matchData.toss.winner]
        };
        needsUpdate = true;
        console.log(`   Fixed toss.winner in match ${matchDoc.id}: "${matchData.toss.winner}" → ${updatedData.toss.winner}`);
      }

      // Update the document if changes were made
      if (needsUpdate) {
        updatedData.updatedAt = new Date().toISOString();
        await collections.matches.doc(matchDoc.id).update(updatedData);
        updatedCount++;
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} matches to use numericIds for winner references`);

  } catch (error) {
    console.error('❌ Error fixing winner references:', error);
  }
}

// Run the script
fixWinnerReferencesInMatches();