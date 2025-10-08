const { collections, db } = require('../config/database');

function calculatePlayerStats(matchHistory) {
  let totalRuns = 0;
  let totalBalls = 0;
  let totalDismissals = 0;
  let totalWickets = 0;
  let totalBowlingRuns = 0;
  let totalOvers = 0;
  let totalCatches = 0;
  let totalRunOuts = 0;
  let totalStumpings = 0;
  let totalFours = 0;
  let totalSixes = 0;
  let matchesPlayed = matchHistory ? matchHistory.length : 0;

  if (matchHistory) {
    matchHistory.forEach(match => {
      // Process batting contributions
      if (match.contributions) {
        match.contributions.forEach(contribution => {
          if (contribution.type === 'batting') {
            totalRuns += contribution.runs || 0;
            totalBalls += contribution.balls || 0;
            totalFours += contribution.fours || 0;
            totalSixes += contribution.sixes || 0;
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
          } else if (contribution.type === 'fielding') {
            const action = contribution.action || '';
            const count = contribution.count || 0;

            if (action === 'catch') {
              totalCatches += count;
            } else if (action === 'run out') {
              totalRunOuts += count;
            } else if (action === 'stumping') {
              totalStumpings += count;
            }
          }
        });
      }

      // Process fielding stats from batting dismissals in match data
      if (match.innings) {
        match.innings.forEach(innings => {
          if (innings.batting) {
            innings.batting.forEach(batsman => {
              if (batsman.how_out && batsman.how_out.type) {
                const dismissalType = batsman.how_out.type;
                const fielder = batsman.how_out.fielder;

                if (dismissalType === 'caught' && fielder) {
                  // This catch will be credited when processing the fielder's contributions
                  // But we can count it here if needed for validation
                } else if (dismissalType === 'run out' && fielder) {
                  totalRunOuts += 1;
                } else if (dismissalType === 'stumped' && fielder) {
                  totalStumpings += 1;
                }
              }
            });
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
    totalOvers,
    totalCatches,
    totalRunOuts,
    totalStumpings,
    totalFours,
    totalSixes,
  };
}

async function updatePlayerStats() {
  console.log('🔄 Updating player stats from match history...\n');

  try {
    const playersSnapshot = await collections.players.get();
    let totalPlayers = 0;
    let updatedPlayers = 0;

    for (const playerDoc of playersSnapshot.docs) {
      totalPlayers++;
      const player = playerDoc.data();
      const playerId = playerDoc.id;

      console.log(`📊 Updating Player: ${player.name} (ID: ${playerId})`);

      // Skip if no match history
      if (!player.matchHistory || player.matchHistory.length === 0) {
        console.log(`   ⚠️  No match history found - skipping`);
        continue;
      }

      // Calculate correct stats from match history
      const correctStats = calculatePlayerStats(player.matchHistory);

      // Update the player document with correct stats
      await collections.players.doc(playerId).update({
        matchesPlayed: correctStats.matchesPlayed,
        totalRuns: correctStats.totalRuns,
        battingAverage: Math.round(correctStats.battingAverage * 100) / 100, // Round to 2 decimal places
        battingStrikeRate: Math.round(correctStats.battingStrikeRate * 100) / 100,
        totalWickets: correctStats.totalWickets,
        bowlingAverage: Math.round(correctStats.bowlingAverage * 100) / 100,
        bowlingEconomy: Math.round(correctStats.bowlingEconomy * 100) / 100,
        totalOvers: Math.round(correctStats.totalOvers * 100) / 100, // Round to 2 decimal places
        totalCatches: correctStats.totalCatches,
        totalRunOuts: correctStats.totalRunOuts,
        totalStumpings: correctStats.totalStumpings,
        totalFours: correctStats.totalFours,
        totalSixes: correctStats.totalSixes,
      });

      updatedPlayers++;
      console.log(`   ✅ Updated stats:`, correctStats);
    }

    console.log(`\n📋 UPDATE SUMMARY:`);
    console.log(`   Total Players Processed: ${totalPlayers}`);
    console.log(`   Players Updated: ${updatedPlayers}`);

    if (updatedPlayers > 0) {
      console.log(`\n🎉 SUCCESS: Player stats have been updated with correct calculations from match history!`);
      console.log(`   Run the verification script again to confirm all stats are now accurate.`);
    } else {
      console.log(`\nℹ️  No updates were needed.`);
    }

  } catch (error) {
    console.error('❌ Error during player stats update:', error);
  }
}

module.exports = updatePlayerStats;

// Run if called directly
if (require.main === module) {
  updatePlayerStats();
}