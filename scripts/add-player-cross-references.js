const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addPlayerCrossReferences() {
  console.log('Starting to add cross-references to player collection...');

  // Get all players
  const playersSnapshot = await db.collection('players').get();
  const players = new Map();

  playersSnapshot.forEach(doc => {
    const player = { id: doc.id, ...doc.data() };
    players.set(doc.id, player); // Use document ID as key instead of numericId
  });

  console.log(`Found ${players.size} players`);

  // Initialize match history for each player
  const playerMatchHistory = new Map();

  // Get all matches
  const matchesSnapshot = await db.collection('matches').get();
  console.log(`Processing ${matchesSnapshot.size} matches...`);

  for (const matchDoc of matchesSnapshot.docs) {
    const match = { id: matchDoc.id, ...matchDoc.data() };
    console.log(`Processing match ${match.id}`);

    // Get innings for this match
    const inningsSnapshot = await db.collection('matches').doc(match.id).collection('innings').get();

    for (const inningDoc of inningsSnapshot.docs) {
      const inning = { id: inningDoc.id, ...inningDoc.data() };

      // Process batsmen data
      if (inning.batsmen && Array.isArray(inning.batsmen)) {
        for (const batsman of inning.batsmen) {
          if (batsman.playerId) {
            const player = players.get(batsman.playerId); // Use document ID lookup
            if (player) {
              if (!playerMatchHistory.has(batsman.playerId)) {
                playerMatchHistory.set(batsman.playerId, {
                  playerId: batsman.playerId,
                  playerName: player.name,
                  matches: []
                });
              }

              const history = playerMatchHistory.get(batsman.playerId);
              let matchEntry = history.matches.find(m => m.matchId === match.id);

              if (!matchEntry) {
                matchEntry = {
                  matchId: match.id,
                  matchDate: match.scheduledDate || match.date,
                  team1: match.teams?.team1 ? { name: match.teams.team1.name, shortName: match.teams.team1.shortName || match.teams.team1.name.substring(0, 3).toUpperCase() } : (match.team1?.name ? { name: match.team1.name, shortName: match.team1.shortName || match.team1.name.substring(0, 3).toUpperCase() } : { name: 'Team 1', shortName: 'T1' }),
                  team2: match.teams?.team2 ? { name: match.teams.team2.name, shortName: match.teams.team2.shortName || match.teams.team2.name.substring(0, 3).toUpperCase() } : (match.team2?.name ? { name: match.team2.name, shortName: match.team2.shortName || match.team2.name.substring(0, 3).toUpperCase() } : { name: 'Team 2', shortName: 'T2' }),
                  venue: match.venue,
                  result: match.result,
                  contributions: []
                };
                history.matches.push(matchEntry);
              }

              matchEntry.contributions.push({
                type: 'batting',
                inningNumber: inning.inningNumber,
                runs: batsman.runs || 0,
                balls: batsman.balls || 0,
                fours: batsman.fours || 0,
                sixes: batsman.sixes || 0,
                dismissal: batsman.statusParsed || batsman.status || 'not out',
                strikeRate: batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(2) : 0,
                howOut: batsman.howOut || null
              });
            }
          }
        }
      }

      // Process bowlers data
      if (inning.bowlers && Array.isArray(inning.bowlers)) {
        for (const bowler of inning.bowlers) {
          if (bowler.playerId) {
            const player = players.get(bowler.playerId); // Use document ID lookup
            if (player) {
              if (!playerMatchHistory.has(bowler.playerId)) {
                playerMatchHistory.set(bowler.playerId, {
                  playerId: bowler.playerId,
                  playerName: player.name,
                  matches: []
                });
              }

              const history = playerMatchHistory.get(bowler.playerId);
              let matchEntry = history.matches.find(m => m.matchId === match.id);

              if (!matchEntry) {
                matchEntry = {
                  matchId: match.id,
                  matchDate: match.scheduledDate || match.date,
                  team1: match.teams?.team1 ? { name: match.teams.team1.name, shortName: match.teams.team1.shortName || match.teams.team1.name.substring(0, 3).toUpperCase() } : (match.team1?.name ? { name: match.team1.name, shortName: match.team1.shortName || match.team1.name.substring(0, 3).toUpperCase() } : { name: 'Team 1', shortName: 'T1' }),
                  team2: match.teams?.team2 ? { name: match.teams.team2.name, shortName: match.teams.team2.shortName || match.teams.team2.name.substring(0, 3).toUpperCase() } : (match.team2?.name ? { name: match.team2.name, shortName: match.team2.shortName || match.team2.name.substring(0, 3).toUpperCase() } : { name: 'Team 2', shortName: 'T2' }),
                  venue: match.venue,
                  result: match.result,
                  contributions: []
                };
                history.matches.push(matchEntry);
              }

              matchEntry.contributions.push({
                type: 'bowling',
                inningNumber: inning.inningNumber,
                overs: bowler.overs || 0,
                maidens: bowler.maidens || 0,
                runs: bowler.runs || 0,
                wickets: bowler.wickets || 0,
                economy: bowler.overs > 0 ? (bowler.runs / parseFloat(bowler.overs)).toFixed(2) : 0
              });
            }
          }
        }
      }

      // Check for catches (fielding) in batsmen data
      if (inning.batsmen && Array.isArray(inning.batsmen)) {
        for (const batsman of inning.batsmen) {
          if (batsman.status && batsman.status.includes('c ')) {
            // Extract catcher name from status like "c Player Name b Bowler"
            const catchMatch = batsman.status.match(/c ([^b]+)/);
            if (catchMatch) {
              const catcherName = catchMatch[1].trim();
              // Find player by name (this is approximate)
              for (const [playerId, player] of players) {
                const playerNameBase = player.name.replace(/\s*\([^)]*\)\s*/g, '').trim();
                if (catcherName.includes(playerNameBase) || playerNameBase.includes(catcherName)) {
                  if (!playerMatchHistory.has(playerId)) {
                    playerMatchHistory.set(playerId, {
                      playerId: playerId,
                      playerName: player.name,
                      matches: []
                    });
                  }

                  const history = playerMatchHistory.get(playerId);
                  let matchEntry = history.matches.find(m => m.matchId === match.id);

                  if (!matchEntry) {
                    matchEntry = {
                      matchId: match.id,
                      matchDate: match.scheduledDate || match.date,
                      team1: match.teams?.team1 ? { name: match.teams.team1.name, shortName: match.teams.team1.shortName || match.teams.team1.name.substring(0, 3).toUpperCase() } : (match.team1?.name ? { name: match.team1.name, shortName: match.team1.shortName || match.team1.name.substring(0, 3).toUpperCase() } : { name: 'Team 1', shortName: 'T1' }),
                      team2: match.teams?.team2 ? { name: match.teams.team2.name, shortName: match.teams.team2.shortName || match.teams.team2.name.substring(0, 3).toUpperCase() } : (match.team2?.name ? { name: match.team2.name, shortName: match.team2.shortName || match.team2.name.substring(0, 3).toUpperCase() } : { name: 'Team 2', shortName: 'T2' }),
                      venue: match.venue,
                      result: match.result,
                      contributions: []
                    };
                    history.matches.push(matchEntry);
                  }

                  // Check if catch already recorded
                  const existingCatch = matchEntry.contributions.find(c =>
                    c.type === 'fielding' && c.action === 'catch'
                  );

                  if (!existingCatch) {
                    matchEntry.contributions.push({
                      type: 'fielding',
                      inningNumber: inning.inningNumber,
                      action: 'catch',
                      count: 1
                    });
                  } else {
                    existingCatch.count++;
                  }
                  break; // Found the player, no need to check others
                }
              }
            }
          }
        }
      }
    }
  }

  // Update player documents with match history
  console.log(`Updating ${playerMatchHistory.size} players with match history...`);

  for (const [playerId, history] of playerMatchHistory) {
    const playerDoc = players.get(playerId);
    if (playerDoc) {
      // Calculate comprehensive statistics and milestones
      const stats = calculatePlayerStatistics(history.matches);

      const updateData = {
        matchHistory: history.matches,
        summaryStats: stats.summary,
        battingStats: stats.batting,
        bowlingStats: stats.bowling,
        fieldingStats: stats.fielding,
        milestones: stats.milestones,
        careerBests: stats.careerBests
      };

      await db.collection('players').doc(playerDoc.id).update(updateData);
      console.log(`Updated player ${playerDoc.name} with ${stats.summary.totalMatches} matches`);
    }
  }

  console.log('Cross-reference update completed!');
  process.exit(0);
}

function calculatePlayerStatistics(matches) {
  const stats = {
    summary: {
      totalMatches: matches.length,
      totalRuns: 0,
      totalWickets: 0,
      totalCatches: 0,
      totalInnings: 0,
      totalBattingInnings: 0,
      totalBowlingInnings: 0
    },
    batting: {
      totalRuns: 0,
      totalBalls: 0,
      totalFours: 0,
      totalSixes: 0,
      highestScore: 0,
      notOuts: 0,
      ducks: 0,
      fifties: 0,
      centuries: 0,
      average: 0,
      strikeRate: 0,
      totalInnings: 0
    },
    bowling: {
      totalOvers: 0,
      totalMaidens: 0,
      totalRuns: 0,
      totalWickets: 0,
      bestFigures: { wickets: 0, runs: 0 },
      hatTricks: 0,
      fiveWicketHauls: 0,
      tenWicketHauls: 0,
      average: 0,
      economy: 0,
      strikeRate: 0,
      totalInnings: 0
    },
    fielding: {
      catches: 0,
      runOuts: 0,
      stumpings: 0
    },
    milestones: {
      batting: [],
      bowling: [],
      fielding: []
    },
    careerBests: {
      batting: { score: 0, balls: 0, fours: 0, sixes: 0, matchId: null, date: null },
      bowling: { wickets: 0, runs: 0, overs: 0, matchId: null, date: null }
    }
  };

  // Process each match
  for (const match of matches) {
    let battingInnings = 0;
    let bowlingInnings = 0;

    for (const contribution of match.contributions) {
      if (contribution.type === 'batting') {
        battingInnings++;
        stats.batting.totalInnings++;
        stats.batting.totalRuns += contribution.runs || 0;
        stats.batting.totalBalls += contribution.balls || 0;
        stats.batting.totalFours += contribution.fours || 0;
        stats.batting.totalSixes += contribution.sixes || 0;

        // Track highest score
        if (contribution.runs > stats.batting.highestScore) {
          stats.batting.highestScore = contribution.runs;
          stats.careerBests.batting = {
            score: contribution.runs,
            balls: contribution.balls,
            fours: contribution.fours,
            sixes: contribution.sixes,
            matchId: match.matchId,
            date: match.matchDate
          };
        }

        // Check for not out
        if (contribution.dismissal && contribution.dismissal.toLowerCase().includes('not out')) {
          stats.batting.notOuts++;
        }

        // Check for ducks (0 runs and not not out)
        if (contribution.runs === 0 && (!contribution.dismissal || !contribution.dismissal.toLowerCase().includes('not out'))) {
          stats.batting.ducks++;
        }

        // Check for fifties and centuries
        if (contribution.runs >= 100) {
          stats.batting.centuries++;
          stats.milestones.batting.push({
            type: 'century',
            score: contribution.runs,
            matchId: match.matchId,
            date: match.matchDate,
            teams: `${match.team1} vs ${match.team2}`
          });
        } else if (contribution.runs >= 50) {
          stats.batting.fifties++;
          stats.milestones.batting.push({
            type: 'fifty',
            score: contribution.runs,
            matchId: match.matchId,
            date: match.matchDate,
            teams: `${match.team1} vs ${match.team2}`
          });
        }

      } else if (contribution.type === 'bowling') {
        bowlingInnings++;
        stats.bowling.totalInnings++;
        stats.bowling.totalOvers += parseFloat(contribution.overs) || 0;
        stats.bowling.totalMaidens += contribution.maidens || 0;
        stats.bowling.totalRuns += contribution.runs || 0;
        stats.bowling.totalWickets += contribution.wickets || 0;

        // Track best bowling figures
        const currentFigures = { wickets: contribution.wickets || 0, runs: contribution.runs || 0 };
        if (isBetterBowlingFigure(currentFigures, stats.bowling.bestFigures)) {
          stats.bowling.bestFigures = currentFigures;
          stats.careerBests.bowling = {
            wickets: contribution.wickets,
            runs: contribution.runs,
            overs: contribution.overs,
            matchId: match.matchId,
            date: match.matchDate
          };
        }

        // Check for hat-trick (3 wickets in an innings)
        if (contribution.wickets >= 3) {
          stats.bowling.hatTricks++;
          stats.milestones.bowling.push({
            type: 'hat-trick',
            wickets: contribution.wickets,
            runs: contribution.runs,
            overs: contribution.overs,
            matchId: match.matchId,
            date: match.matchDate,
            teams: `${match.team1} vs ${match.team2}`
          });
        }

        // Check for five-wicket hauls
        if (contribution.wickets >= 5) {
          stats.bowling.fiveWicketHauls++;
          stats.milestones.bowling.push({
            type: 'five-wicket-haul',
            wickets: contribution.wickets,
            runs: contribution.runs,
            overs: contribution.overs,
            matchId: match.matchId,
            date: match.matchDate,
            teams: `${match.team1} vs ${match.team2}`
          });
        }

        // Check for ten-wicket match (accumulate wickets across innings)
        // This would need to be calculated per match, but for now we'll track per innings

      } else if (contribution.type === 'fielding') {
        if (contribution.action === 'catch') {
          stats.fielding.catches += contribution.count || 0;
          if (contribution.count >= 3) {
            stats.milestones.fielding.push({
              type: 'three-catches',
              catches: contribution.count,
              matchId: match.matchId,
              date: match.matchDate,
              teams: `${match.team1} vs ${match.team2}`
            });
          }
        }
      }
    }

    // Update innings counts
    if (battingInnings > 0) stats.summary.totalBattingInnings++;
    if (bowlingInnings > 0) stats.summary.totalBowlingInnings++;
  }

  // Calculate averages and rates
  // Batting average
  const completedBattingInnings = stats.batting.totalInnings - stats.batting.notOuts;
  stats.batting.average = completedBattingInnings > 0 ? (stats.batting.totalRuns / completedBattingInnings).toFixed(2) : 0;

  // Batting strike rate
  stats.batting.strikeRate = stats.batting.totalBalls > 0 ? ((stats.batting.totalRuns / stats.batting.totalBalls) * 100).toFixed(2) : 0;

  // Bowling average
  stats.bowling.average = stats.bowling.totalWickets > 0 ? (stats.bowling.totalRuns / stats.bowling.totalWickets).toFixed(2) : 0;

  // Bowling economy
  stats.bowling.economy = stats.bowling.totalOvers > 0 ? (stats.bowling.totalRuns / stats.bowling.totalOvers).toFixed(2) : 0;

  // Bowling strike rate (balls per wicket)
  const totalBowlingBalls = stats.bowling.totalOvers * 6;
  stats.bowling.strikeRate = stats.bowling.totalWickets > 0 ? (totalBowlingBalls / stats.bowling.totalWickets).toFixed(1) : 0;

  // Update summary stats
  stats.summary.totalRuns = stats.batting.totalRuns;
  stats.summary.totalWickets = stats.bowling.totalWickets;
  stats.summary.totalCatches = stats.fielding.catches;
  stats.summary.totalInnings = stats.batting.totalInnings + stats.bowling.totalInnings;

  return stats;
}

function isBetterBowlingFigure(fig1, fig2) {
  // Better figure has more wickets, or same wickets with fewer runs
  if (fig1.wickets > fig2.wickets) return true;
  if (fig1.wickets < fig2.wickets) return false;
  return fig1.runs < fig2.runs;
}

addPlayerCrossReferences().catch(console.error);