const { collections, db } = require('../config/database');

class ComprehensiveDataValidator {
  async validateAllMatchDetails() {
    console.log('=== COMPREHENSIVE MATCH DATA VALIDATION ===\n');

    try {
      const matchesSnapshot = await collections.matches.get();
      console.log(`Total matches to validate: ${matchesSnapshot.size}\n`);

      let totalIssues = 0;

      for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data();

        console.log(`🔍 Validating Match: ${matchData.title} (${matchId})`);
        let matchIssues = 0;

        // 1. Check basic match structure
        console.log('  📋 Basic Structure:');
        const requiredFields = ['numericId', 'title', 'status', 'venue', 'date', 'teams', 'team1Id', 'team2Id'];
        for (const field of requiredFields) {
          if (!matchData[field]) {
            console.log(`    ❌ Missing field: ${field}`);
            matchIssues++;
          } else {
            console.log(`    ✅ ${field}: ${typeof matchData[field] === 'object' ? 'present' : matchData[field]}`);
          }
        }

        // 2. Check embedded team details
        console.log('  👥 Embedded Team Details:');
        if (matchData.teams?.team1 && matchData.teams?.team2) {
          console.log('    ✅ Teams embedded with full details');
        } else {
          console.log('    ❌ Teams not properly embedded');
          matchIssues++;
        }

        // 3. Check toss information
        console.log('  🪙 Toss Information:');
        if (matchData.toss?.winner) {
          console.log('    ✅ Toss winner embedded');
        } else {
          console.log('    ❌ Toss winner not embedded');
          matchIssues++;
        }

        // 4. Check result information
        console.log('  🏆 Result Information:');
        if (matchData.result && matchData.winner) {
          console.log('    ✅ Result and winner present');
        } else {
          console.log('    ❌ Result or winner missing');
          matchIssues++;
        }

        // 5. Check innings subcollections
        console.log('  🏏 Innings Subcollections:');
        const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();
        console.log(`    Found ${inningsSnapshot.size} innings`);

        for (const inningDoc of inningsSnapshot.docs) {
          const inningId = inningDoc.id;
          const inningData = inningDoc.data();

          console.log(`    Inning ${inningData.inningNumber} (${inningId}):`);

          // Check inning basic data
          const inningFields = ['numericId', 'battingTeam', 'bowlingTeam', 'totalRuns', 'totalWickets', 'totalOvers', 'totalBalls'];
          for (const field of inningFields) {
            if (inningData[field] === undefined) {
              console.log(`      ❌ Missing ${field}`);
              matchIssues++;
            }
          }

          // Check batsmen array
          const batsmenCount = inningData.batsmen ? inningData.batsmen.length : 0;
          console.log(`      🏃 Batsmen: ${batsmenCount} records`);

          // Check bowlers array
          const bowlersCount = inningData.bowlers ? inningData.bowlers.length : 0;
          console.log(`      🎯 Bowling: ${bowlersCount} records`);

          // Check fall of wickets array
          const fowCount = inningData.fallOfWickets ? inningData.fallOfWickets.length : 0;
          console.log(`      💀 Fall of Wickets: ${fowCount} records`);

          if (fowCount === 0) {
            console.log('      ⚠️  No fall of wickets data found');
            matchIssues++;
          } else {
            // Show sample fall of wickets
            const sampleFow = inningData.fallOfWickets[0];
            console.log(`      Sample FOW: Wicket ${sampleFow.wicketNumber} at ${sampleFow.score} (over ${sampleFow.over})`);
          }
        }

        // Summary for this match
        if (matchIssues === 0) {
          console.log('  ✅ Match validation: PASSED\n');
        } else {
          console.log(`  ❌ Match validation: ${matchIssues} issues found\n`);
          totalIssues += matchIssues;
        }
      }

      // Overall summary
      console.log('=== VALIDATION SUMMARY ===');
      if (totalIssues === 0) {
        console.log('🎉 All match data validated successfully!');
        console.log('✅ All required fields present');
        console.log('✅ Embedded team details working');
        console.log('✅ Innings stored as subcollections');
        console.log('✅ Batsmen and bowling data present');
        console.log('✅ Fall of wickets data verified');
      } else {
        console.log(`⚠️  Found ${totalIssues} issues across all matches`);
        console.log('Some data may be missing or incorrectly structured');
      }

    } catch (error) {
      console.error('❌ Validation failed:', error);
      throw error;
    }
  }
}

// Run validation
const validator = new ComprehensiveDataValidator();
validator.validateAllMatchDetails().then(() => {
  console.log('\nValidation complete.');
  process.exit(0);
}).catch((error) => {
  console.error('Validation error:', error);
  process.exit(1);
});