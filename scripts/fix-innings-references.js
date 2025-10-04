const { collections } = require('../config/database');

async function fixInningsReferences() {
  console.log('Starting to fix innings references...');

  try {
    // Get all matches
    const matchesSnapshot = await collections.matches.get();
    console.log(`Found ${matchesSnapshot.docs.length} matches to process`);

    // Create mapping from old UUIDs to new formatted IDs
    const oldToNewMap = {};
    const teamsSnapshot = await collections.teams.get();
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      if (teamData.originalId) {
        oldToNewMap[teamData.originalId] = teamDoc.id;
      }
    }
    console.log('Created old-to-new ID mapping for teams');

    let totalInningsFixed = 0;

    // Process each match
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();

      console.log(`\nProcessing match ${matchId}`);

      // Get innings subcollection
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      if (inningsSnapshot.empty) {
        console.log(`  No innings found for match ${matchId}`);
        continue;
      }

      console.log(`  Found ${inningsSnapshot.docs.length} innings`);

      // Process each inning
      for (const inningDoc of inningsSnapshot.docs) {
        const inningId = inningDoc.id;
        const inningData = inningDoc.data();

        console.log(`    Processing inning ${inningId}`);

        // Prepare updates
        const updates = {};

        // Set matchId if not set
        if (!inningData.matchId) {
          updates.matchId = matchId;
        }

        // Update battingTeam if it's an old UUID
        if (inningData.battingTeam && oldToNewMap[inningData.battingTeam]) {
          updates.battingTeam = oldToNewMap[inningData.battingTeam];
          console.log(`      Updated battingTeam: ${inningData.battingTeam} -> ${updates.battingTeam}`);
        }

        // Update bowlingTeam if it's an old UUID
        if (inningData.bowlingTeam && oldToNewMap[inningData.bowlingTeam]) {
          updates.bowlingTeam = oldToNewMap[inningData.bowlingTeam];
          console.log(`      Updated bowlingTeam: ${inningData.bowlingTeam} -> ${updates.bowlingTeam}`);
        }

        // Update teamId if it's an old UUID (usually the batting team)
        if (inningData.teamId && oldToNewMap[inningData.teamId]) {
          updates.teamId = oldToNewMap[inningData.teamId];
          console.log(`      Updated teamId: ${inningData.teamId} -> ${updates.teamId}`);
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await collections.matches.doc(matchId).collection('innings').doc(inningId).update(updates);
          totalInningsFixed++;
          console.log(`      Applied ${Object.keys(updates).length} updates`);
        } else {
          console.log(`      No updates needed`);
        }
      }
    }

    console.log(`\nCompleted! Fixed ${totalInningsFixed} innings documents`);

  } catch (error) {
    console.error('Error fixing innings references:', error);
  }
}

fixInningsReferences();