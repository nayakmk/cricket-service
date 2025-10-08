const { collections, db } = require('../config/database');

function calculatePlayerStats(matchHistory) {
  let totalRuns = 0;
  let totalBalls = 0;
  let totalDismissals = 0;
  let totalWickets = 0;
  let totalBowlingRuns = 0;
  let totalOvers = 0;
  let matchesPlayed = matchHistory ? matchHistory.length : 0;

  if (matchHistory) {
    matchHistory.forEach(match => {
      if (match.contributions) {
        match.contributions.forEach(contribution => {
          if (contribution.type === 'batting') {
            totalRuns += contribution.runs || 0;
            totalBalls += contribution.balls || 0;
            // Count dismissals (not counting 'not out')
            if (contribution.dismissal && contribution.dismissal !== 'not out') {
              totalDismissals += 1;
            }
          } else if (contribution.type === 'bowling') {
            totalWickets += contribution.wickets || 0;
            totalBowlingRuns += contribution.runs || 0;
            // Handle overs as string (e.g., "4.2")
            if (contribution.overs) {
              const oversValue = parseFloat(contribution.overs) || 0;
              totalOvers += oversValue;
            }
          }
        });
      }
    });
  }

  // Calculate averages and rates
  const battingAverage = totalDismissals > 0 ? totalRuns / totalDismissals : (totalRuns > 0 ? totalRuns : 0);
  const battingStrikeRate = totalBalls > 0 ? (totalRuns / totalBalls) * 100 : 0;
  const bowlingAverage = totalWickets > 0 ? totalBowlingRuns / totalWickets : 0;
  const bowlingEconomy = totalOvers > 0 ? totalBowlingRuns / totalOvers : 0;

  return {
    matchesPlayed,
    totalRuns,
    battingAverage,
    battingStrikeRate,
    totalWickets,
    bowlingAverage,
    bowlingEconomy,
    totalOvers: Math.round(totalOvers * 100) / 100, // Round to 2 decimal places
  };
}

async function verifyPlayerStats() {
  console.log('🔍 Verifying player stats against match history...\n');

  try {
    const playersSnapshot = await collections.players.get();
    let totalPlayers = 0;
    let playersWithDiscrepancies = 0;
    let playersWithMatchHistory = 0;

    for (const playerDoc of playersSnapshot.docs) {
      totalPlayers++;
      const player = playerDoc.data();
      const playerId = playerDoc.id;

      console.log(`\n📊 Checking Player: ${player.name} (ID: ${playerId})`);

      // Skip if no match history
      if (!player.matchHistory || player.matchHistory.length === 0) {
        console.log(`   ⚠️  No match history found`);
        continue;
      }

      playersWithMatchHistory++;

      // Calculate stats from match history
      const calculatedStats = calculatePlayerStats(player.matchHistory);

      // Compare with stored stats
      const storedStats = {
        matchesPlayed: player.matchesPlayed || 0,
        totalRuns: player.totalRuns || 0,
        battingAverage: player.battingAverage || 0,
        battingStrikeRate: player.battingStrikeRate || 0,
        totalWickets: player.totalWickets || 0,
        bowlingAverage: player.bowlingAverage || 0,
        bowlingEconomy: player.bowlingEconomy || 0,
        totalOvers: player.totalOvers || 0,
      };

      console.log(`   📈 Match History: ${player.matchHistory.length} matches`);
      console.log(`   🧮 Calculated Stats:`, calculatedStats);
      console.log(`   💾 Stored Stats:`, storedStats);

      // Check for discrepancies
      let hasDiscrepancy = false;
      const discrepancies = [];

      Object.keys(calculatedStats).forEach(key => {
        const calculated = calculatedStats[key];
        const stored = storedStats[key];

        // Allow small floating point differences for averages
        const tolerance = (key.includes('Average') || key.includes('Rate') || key.includes('Economy')) ? 0.01 : 0;

        if (Math.abs(calculated - stored) > tolerance) {
          hasDiscrepancy = true;
          discrepancies.push(`${key}: calculated=${calculated}, stored=${stored}`);
        }
      });

      if (hasDiscrepancy) {
        playersWithDiscrepancies++;
        console.log(`   ❌ DISCREPANCIES FOUND:`);
        discrepancies.forEach(discrepancy => console.log(`      - ${discrepancy}`));
      } else {
        console.log(`   ✅ Stats match perfectly!`);
      }
    }

    // Summary
    console.log(`\n📋 VERIFICATION SUMMARY:`);
    console.log(`   Total Players: ${totalPlayers}`);
    console.log(`   Players with Match History: ${playersWithMatchHistory}`);
    console.log(`   Players with Stat Discrepancies: ${playersWithDiscrepancies}`);

    if (playersWithDiscrepancies === 0) {
      console.log(`\n🎉 SUCCESS: All player stats are up-to-date with match history!`);
    } else {
      console.log(`\n⚠️  WARNING: ${playersWithDiscrepancies} players have outdated stats that need updating.`);
      console.log(`   Consider running a stats recalculation script.`);
    }

  } catch (error) {
    console.error('❌ Error during player stats verification:', error);
  }
}

verifyPlayerStats();