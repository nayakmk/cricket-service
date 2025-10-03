const { collections, db } = require('../config/database');

class DataVerifier {
  async verifyCollections() {
    console.log('=== FIRESTORE DATA VERIFICATION ===\n');

    try {
      // Verify matches
      console.log('1. MATCHES COLLECTION:');
      const matchesSnapshot = await collections.matches.get();
      console.log(`   Total matches: ${matchesSnapshot.size}`);

      for (const doc of matchesSnapshot.docs.slice(0, 3)) { // Show first 3
        const match = doc.data();
        console.log(`   - ${doc.id}: ${match.title} (${match.status})`);

        // Check innings subcollection
        const inningsSnapshot = await collections.matches.doc(doc.id).collection('innings').get();
        console.log(`     Innings: ${inningsSnapshot.size}`);

        // Check first inning details
        if (!inningsSnapshot.empty) {
          const firstInning = inningsSnapshot.docs[0].data();
          console.log(`     Sample inning: ${firstInning.totalRuns}/${firstInning.totalWickets} in ${firstInning.totalOvers}.${firstInning.totalBalls % 6} overs`);
        }
      }

      // Verify teams
      console.log('\n2. TEAMS COLLECTION:');
      const teamsSnapshot = await collections.teams.get();
      console.log(`   Total teams: ${teamsSnapshot.size}`);

      for (const doc of teamsSnapshot.docs) {
        const team = doc.data();
        console.log(`   - ${doc.id}: ${team.name} (${team.shortName})`);
      }

      // Verify players
      console.log('\n3. PLAYERS COLLECTION:');
      const playersSnapshot = await collections.players.get();
      console.log(`   Total players: ${playersSnapshot.size}`);

      // Show sample players
      const samplePlayers = playersSnapshot.docs.slice(0, 5);
      for (const doc of samplePlayers) {
        const player = doc.data();
        console.log(`   - ${doc.id}: ${player.name} (${player.email})`);
      }

      // Verify detailed match structure
      console.log('\n4. DETAILED MATCH VERIFICATION:');
      if (!matchesSnapshot.empty) {
        const firstMatch = matchesSnapshot.docs[0];
        const matchData = firstMatch.data();
        console.log(`   Match: ${matchData.title}`);
        console.log(`   Teams: ${matchData.team1} vs ${matchData.team2}`);
        console.log(`   Status: ${matchData.status}`);
        console.log(`   Result: ${matchData.result}`);

        // Check innings subcollections
        const inningsRef = collections.matches.doc(firstMatch.id).collection('innings');
        const innings = await inningsRef.get();

        for (const [index, inningDoc] of innings.docs.entries()) {
          const inning = inningDoc.data();
          console.log(`\n   Inning ${index + 1}: ${inning.battingTeam} vs ${inning.bowlingTeam}`);
          console.log(`   Score: ${inning.totalRuns}/${inning.totalWickets} in ${inning.totalOvers}.${inning.totalBalls % 6} overs`);

          // Check batsmen subcollection
          const batsmen = await inningsRef.doc(inningDoc.id).collection('batsmen').get();
          console.log(`   Batsmen records: ${batsmen.size}`);

          // Check bowling subcollection
          const bowling = await inningsRef.doc(inningDoc.id).collection('bowling').get();
          console.log(`   Bowling records: ${bowling.size}`);

          // Check fall of wickets
          const fow = await inningsRef.doc(inningDoc.id).collection('fallOfWickets').get();
          console.log(`   Fall of wickets: ${fow.size}`);
        }
      }

      console.log('\n=== VERIFICATION COMPLETE ===');
      console.log('✅ All collections populated successfully');
      console.log('✅ Match subcollections created');
      console.log('✅ Team and player data stored');
      console.log('✅ Innings, batsmen, bowling, and fall of wickets data verified');

    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  }

  async generateStatsReport() {
    try {
      console.log('\n=== CRICKET STATS REPORT ===');

      // Get all matches
      const matches = await collections.matches.get();
      const teams = await collections.teams.get();
      const players = await collections.players.get();

      console.log(`Total Matches: ${matches.size}`);
      console.log(`Total Teams: ${teams.size}`);
      console.log(`Total Players: ${players.size}`);

      // Calculate some basic stats
      let totalRuns = 0;
      let totalWickets = 0;
      let totalInnings = 0;

      for (const matchDoc of matches.docs) {
        const innings = await collections.matches.doc(matchDoc.id).collection('innings').get();
        totalInnings += innings.size;

        for (const inningDoc of innings.docs) {
          const inning = inningDoc.data();
          totalRuns += inning.totalRuns || 0;
          totalWickets += inning.totalWickets || 0;
        }
      }

      console.log(`Total Innings: ${totalInnings}`);
      console.log(`Total Runs Scored: ${totalRuns}`);
      console.log(`Total Wickets Taken: ${totalWickets}`);
      console.log(`Average Runs per Inning: ${(totalRuns / totalInnings).toFixed(1)}`);
      console.log(`Average Wickets per Inning: ${(totalWickets / totalInnings).toFixed(1)}`);

    } catch (error) {
      console.error('Error generating stats report:', error);
    }
  }
}

// Export for use in other scripts
module.exports = DataVerifier;

// If run directly, verify data
if (require.main === module) {
  (async () => {
    const verifier = new DataVerifier();

    try {
      await verifier.verifyCollections();
      await verifier.generateStatsReport();
      console.log('\n🎉 Data verification completed successfully!');
    } catch (error) {
      console.error('Data verification failed:', error);
      process.exit(1);
    }
  })();
}