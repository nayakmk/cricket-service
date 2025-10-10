const { collections } = require('../config/database');

/**
 * Player Impact Manager
 * Handles calculation of player impact scores and Man of the Match determination
 */
class PlayerImpactManager {

  /**
   * Calculate Man of the Match for a completed match
   * @param {string} matchId - The match document ID
   * @param {Object} playersMap - Map of player names to document IDs
   * @returns {Object|null} Man of the Match data or null if calculation fails
   */
  static async calculateManOfTheMatch(matchId, playersMap) {
    try {
      console.log(`Calculating Man of the Match for match ${matchId}`);

      // Get innings data for the match
      const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

      if (inningsSnapshot.empty) {
        console.warn(`No innings data found for match ${matchId}`);
        return null;
      }

      // Collect all player performances
      const playerPerformances = new Map();

      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();

        // Process batsmen
        if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
          for (const batsman of inningData.batsmen) {
            if (batsman.player && batsman.runs !== undefined) {
              const playerId = typeof batsman.player === 'object' ? batsman.player.id : batsman.player;

              if (!playerPerformances.has(playerId)) {
                playerPerformances.set(playerId, {
                  player: batsman.player,
                  batting: { runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0 },
                  bowling: { wickets: 0, runs: 0, overs: 0 },
                  fielding: { catches: 0, runOuts: 0, stumpings: 0 }
                });
              }

              const perf = playerPerformances.get(playerId);
              perf.batting.runs += batsman.runs || 0;
              perf.batting.balls += batsman.balls || 0;
              perf.batting.fours += batsman.fours || 0;
              perf.batting.sixes += batsman.sixes || 0;

              // Track not out batsmen
              if (batsman.status && batsman.status.toLowerCase().includes('not out')) {
                perf.batting.notOuts += 1;
              }
            }
          }
        }

        // Process bowlers
        if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
          for (const bowler of inningData.bowlers) {
            if (bowler.player) {
              const playerId = typeof bowler.player === 'object' ? bowler.player.id : bowler.player;

              if (!playerPerformances.has(playerId)) {
                playerPerformances.set(playerId, {
                  player: bowler.player,
                  batting: { runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0 },
                  bowling: { wickets: 0, runs: 0, overs: 0 },
                  fielding: { catches: 0, runOuts: 0, stumpings: 0 }
                });
              }

              const perf = playerPerformances.get(playerId);
              perf.bowling.wickets += bowler.wickets || 0;
              perf.bowling.runs += bowler.runs || 0;
              perf.bowling.overs += parseFloat(bowler.overs) || 0;
            }
          }
        }

        // Process fielding (catches, run-outs from batsmen dismissals)
        if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
          for (const batsman of inningData.batsmen) {
            if (batsman.howOut && batsman.howOut.fieldersIds && Array.isArray(batsman.howOut.fieldersIds)) {
              // Process all fielders involved in the dismissal
              for (const fielderName of batsman.howOut.fieldersIds) {
                if (fielderName && typeof fielderName === 'string') {
                  // fielderName is a name, need to find the document ID
                  let fielderDocId = null;

                  // Look up document ID from playersMap (name -> document ID)
                  for (const [name, docId] of playersMap) {
                    if (name === fielderName) {
                      fielderDocId = docId;
                      break;
                    }
                  }

                  if (!fielderDocId) continue; // Skip if can't find player

                  if (!playerPerformances.has(fielderDocId)) {
                    playerPerformances.set(fielderDocId, {
                      player: { id: fielderDocId, name: fielderName },
                      batting: { runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0 },
                      bowling: { wickets: 0, runs: 0, overs: 0 },
                      fielding: { catches: 0, runOuts: 0, stumpings: 0 }
                    });
                  }

                  const perf = playerPerformances.get(fielderDocId);

                  // Determine fielding action based on howOut type or batsman status
                  const dismissalType = batsman.howOut.type || batsman.status || '';
                  if (dismissalType.includes('caught')) {
                    perf.fielding.catches += 1;
                  } else if (dismissalType.includes('run out')) {
                    perf.fielding.runOuts += 1;
                  } else if (dismissalType.includes('stumped')) {
                    perf.fielding.stumpings += 1;
                  }
                }
              }
            }
          }
        }
      }

      // Calculate impact scores for each player
      let maxImpact = -Infinity;
      let manOfTheMatch = null;

      for (const [playerId, perf] of playerPerformances) {
        // Use the common calculatePlayerImpact method
        const netImpact = this.calculatePlayerImpact(perf);

        if (netImpact > maxImpact) {
          maxImpact = netImpact;

          // Calculate additional display values
          const battingRuns = perf.batting.runs;
          const battingBalls = perf.batting.balls;
          const strikeRate = battingBalls > 0 ? (battingRuns / battingBalls) * 100 : 0;
          const bowlingOvers = perf.bowling.overs;
          const economy = bowlingOvers > 0 ? perf.bowling.runs / bowlingOvers : 0;

          manOfTheMatch = {
            player: perf.player,
            netImpact: netImpact,
            batting: {
              runs: battingRuns,
              balls: battingBalls,
              fours: perf.batting.fours,
              sixes: perf.batting.sixes,
              notOuts: perf.batting.notOuts || 0,
              strikeRate: strikeRate.toFixed(2)
            },
            bowling: {
              wickets: perf.bowling.wickets,
              runs: perf.bowling.runs,
              overs: bowlingOvers.toFixed(1),
              economy: economy.toFixed(2)
            },
            fielding: {
              catches: perf.fielding ? perf.fielding.catches : 0,
              runOuts: perf.fielding ? perf.fielding.runOuts : 0,
              stumpings: perf.fielding ? perf.fielding.stumpings : 0
            }
          };
        }
      }

      console.log(`Man of the Match calculated: ${manOfTheMatch?.player?.name || 'None'} with impact ${manOfTheMatch?.netImpact || 0}`);
      return manOfTheMatch;

    } catch (error) {
      console.error(`Error calculating Man of the Match for match ${matchId}:`, error);
      return null;
    }
  }

  /**
   * Calculate impact score for a single player performance
   * @param {Object} performance - Player performance data
   * @returns {number} Impact score
   */
  static calculatePlayerImpact(performance) {
    // Calculate batting impact
    const battingRuns = performance.batting?.runs || 0;
    const battingBalls = performance.batting?.balls || 0;
    const strikeRate = battingBalls > 0 ? (battingRuns / battingBalls) * 100 : 0;
    const boundaries = (performance.batting?.fours || 0) + ((performance.batting?.sixes || 0) * 2);
    const notOutBonus = (performance.batting?.notOuts || 0) * 10;

    const battingImpact = battingRuns + (strikeRate - 100) * 0.1 + boundaries + notOutBonus;

    // Calculate bowling impact
    const bowlingWickets = performance.bowling?.wickets || 0;
    const bowlingOvers = performance.bowling?.overs || 0;
    const economy = bowlingOvers > 0 ? (performance.bowling?.runs || 0) / bowlingOvers : 0;

    let bowlingImpact = (bowlingWickets * 25) - (economy - 6) * 2;
    if (bowlingOvers >= 3) bowlingImpact += Math.floor(bowlingOvers) * 2;

    // Calculate fielding impact
    let fieldingImpact = 0;
    if (performance.fielding) {
      fieldingImpact += (performance.fielding.catches || 0) * 15;
      fieldingImpact += (performance.fielding.runOuts || 0) * 10;
      fieldingImpact += (performance.fielding.stumpings || 0) * 12;
      if ((performance.fielding.catches + performance.fielding.runOuts + performance.fielding.stumpings) > 1) {
        fieldingImpact += 5;
      }
    }

    const totalImpact = battingImpact + bowlingImpact + fieldingImpact;

    return {
      batting: parseFloat(battingImpact.toFixed(2)),
      bowling: parseFloat(bowlingImpact.toFixed(2)),
      fielding: parseFloat(fieldingImpact.toFixed(2)),
      total: parseFloat(totalImpact.toFixed(2))
    };
  }
}

module.exports = { PlayerImpactManager };