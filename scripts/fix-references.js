const { collections, db } = require('../config/database');

/**
 * Fix remaining internal references in match documents that weren't updated during migration
 */
async function fixRemainingReferences() {
  console.log('🔧 Fixing remaining internal references in match documents...\n');

  try {
    // Get all ID mappings from the migrated documents
    const teamsSnapshot = await collections.teams.get();
    const playersSnapshot = await collections.players.get();

    const teamMappings = {};
    const playerMappings = {};

    // Build team ID mappings
    for (const doc of teamsSnapshot.docs) {
      const data = doc.data();
      if (data.originalId) {
        teamMappings[data.originalId] = doc.id;
      }
    }

    // Build player ID mappings
    for (const doc of playersSnapshot.docs) {
      const data = doc.data();
      if (data.originalId) {
        playerMappings[data.originalId] = doc.id;
      }
    }

    console.log(`Found ${Object.keys(teamMappings).length} team mappings`);
    console.log(`Found ${Object.keys(playerMappings).length} player mappings\n`);

    // Update match documents
    const matchesSnapshot = await collections.matches.get();
    console.log('Updating match documents...');

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      let needsUpdate = false;
      const updatedData = { ...matchData };

      // Fix tossWinner if it's a team ID
      if (matchData.tossWinner && teamMappings[matchData.tossWinner]) {
        updatedData.tossWinner = teamMappings[matchData.tossWinner];
        needsUpdate = true;
        console.log(`   Fixed tossWinner in match ${matchDoc.id}: ${matchData.tossWinner} → ${updatedData.tossWinner}`);
      }

      // Fix winner if it's a team ID
      if (matchData.winner && teamMappings[matchData.winner]) {
        updatedData.winner = teamMappings[matchData.winner];
        needsUpdate = true;
        console.log(`   Fixed winner in match ${matchDoc.id}: ${matchData.winner} → ${updatedData.winner}`);
      }

      // Update the document if changes were made
      if (needsUpdate) {
        await collections.matches.doc(matchDoc.id).update(updatedData);
      }
    }

    // Update innings subcollections
    console.log('\nUpdating innings subcollections...');
    for (const matchDoc of matchesSnapshot.docs) {
      const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').get();

      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();
        let needsUpdate = false;
        const updatedData = { ...inningData };

        // Fix battingTeam and bowlingTeam if they reference players
        if (inningData.battingTeam && playerMappings[inningData.battingTeam]) {
          updatedData.battingTeam = playerMappings[inningData.battingTeam];
          needsUpdate = true;
        }
        if (inningData.bowlingTeam && playerMappings[inningData.bowlingTeam]) {
          updatedData.bowlingTeam = playerMappings[inningData.bowlingTeam];
          needsUpdate = true;
        }

        if (needsUpdate) {
          await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).update(updatedData);
          console.log(`   Fixed innings ${inningDoc.id} in match ${matchDoc.id}`);
        }

        // Update batsmen subcollection
        const batsmenSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').get();
        for (const batsmanDoc of batsmenSnapshot.docs) {
          const batsmanData = batsmanDoc.data();
          if (batsmanData.player && playerMappings[batsmanData.player]) {
            await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').doc(batsmanDoc.id).update({
              player: playerMappings[batsmanData.player]
            });
            console.log(`   Fixed batsman ${batsmanDoc.id} player reference`);
          }
        }

        // Update bowling subcollection
        const bowlingSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').get();
        for (const bowlingDoc of bowlingSnapshot.docs) {
          const bowlingData = bowlingDoc.data();
          if (bowlingData.player && playerMappings[bowlingData.player]) {
            await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').doc(bowlingDoc.id).update({
              player: playerMappings[bowlingData.player]
            });
            console.log(`   Fixed bowler ${bowlingDoc.id} player reference`);
          }
        }

        // Update fall of wickets subcollection
        const fowSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('fallOfWickets').get();
        for (const fowDoc of fowSnapshot.docs) {
          const fowData = fowDoc.data();
          if (fowData.playerOut && playerMappings[fowData.playerOut]) {
            await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('fallOfWickets').doc(fowDoc.id).update({
              playerOut: playerMappings[fowData.playerOut]
            });
            console.log(`   Fixed fall of wicket ${fowDoc.id} player reference`);
          }
        }
      }
    }

    console.log('\n✅ All remaining references fixed!');
    console.log('🔍 Verifying the fix...');

    // Verify the fix
    const testMatch = matchesSnapshot.docs[0];
    if (testMatch) {
      const testMatchData = (await collections.matches.doc(testMatch.id).get()).data();
      console.log(`\nSample match ${testMatch.id}:`);
      console.log(`   tossWinner: ${testMatchData.tossWinner}`);
      console.log(`   team1Id: ${testMatchData.team1Id}`);
      console.log(`   team2Id: ${testMatchData.team2Id}`);
      console.log(`   winner: ${testMatchData.winner}`);
    }

  } catch (error) {
    console.error('❌ Error fixing references:', error);
    throw error;
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixRemainingReferences()
    .then(() => {
      console.log('\n🎉 Reference fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Reference fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixRemainingReferences };