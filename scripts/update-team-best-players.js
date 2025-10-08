const { collections } = require('../config/database');
const { PlayerImpactManager } = require('../utils/playerImpactManager');

/**
 * Add player performance data to the impact scores map
 */
async function addPlayerPerformance(playerImpactScores, playerDocId, type, data) {
  if (!playerImpactScores.has(playerDocId)) {
    playerImpactScores.set(playerDocId, []);
  }
  playerImpactScores.get(playerDocId).push({ type, data });
}

/**
 * Script to calculate and update best players for each team based on impact scores
 */
async function updateTeamBestPlayers() {
  try {
    console.log('Starting team best players update based on impact scores...');

    // Get all teams
    const teamsSnapshot = await collections.teams.get();
    console.log(`Processing ${teamsSnapshot.size} teams`);

    for (const teamDoc of teamsSnapshot.docs) {
      const teamId = teamDoc.id;
      const teamData = teamDoc.data();

      console.log(`Processing team: ${teamData.name}`);

      // Get team players
      const playerIds = teamData.playerIds || [];
      if (playerIds.length === 0) {
        console.log(`No players found for team ${teamData.name}, skipping`);
        continue;
      }

      // Get all completed matches for this team
      const matchesSnapshot = await collections.matches
        .where('status', '==', 'completed')
        .where('teams.team1.id', '==', teamData.numericId)
        .get();

      const matchesSnapshot2 = await collections.matches
        .where('status', '==', 'completed')
        .where('teams.team2.id', '==', teamData.numericId)
        .get();

      const teamMatches = [...matchesSnapshot.docs, ...matchesSnapshot2.docs];

      if (teamMatches.length === 0) {
        console.log(`No completed matches found for team ${teamData.name}`);
        continue;
      }

      console.log(`Found ${teamMatches.length} matches for team ${teamData.name}`);

      // Calculate impact scores for each player in this team's matches
      const playerImpactScores = new Map();

      for (const matchDoc of teamMatches) {
        const matchId = matchDoc.id;

        // Get innings for this match
        const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

        // Process each inning to collect player performances
        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = inningDoc.data();

          // Process batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            for (const batsman of inningData.batsmen) {
              if (batsman.playerId) {
                await addPlayerPerformance(playerImpactScores, batsman.playerId, 'batting', {
                  runs: batsman.runs || 0,
                  balls: batsman.balls || 0,
                  fours: batsman.fours || 0,
                  sixes: batsman.sixes || 0,
                  notOuts: batsman.status && batsman.status.toLowerCase().includes('not out') ? 1 : 0
                });
              }
            }
          }

          // Process bowlers
          if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
            for (const bowler of inningData.bowlers) {
              if (bowler.playerId) {
                await addPlayerPerformance(playerImpactScores, bowler.playerId, 'bowling', {
                  wickets: bowler.wickets || 0,
                  runs: bowler.runs || 0,
                  overs: parseFloat(bowler.overs) || 0
                });
              }
            }
          }
        }
      }

      // Calculate average impact scores
      const finalPlayerScores = new Map();
      for (const [playerDocId, performances] of playerImpactScores) {
        if (performances.length > 0) {
          // Aggregate all performances for this player
          const totalPerf = {
            batting: { runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0 },
            bowling: { wickets: 0, runs: 0, overs: 0 },
            fielding: { catches: 0, runOuts: 0, stumpings: 0 }
          };

          for (const perf of performances) {
            if (perf.type === 'batting') {
              totalPerf.batting.runs += perf.data.runs;
              totalPerf.batting.balls += perf.data.balls;
              totalPerf.batting.fours += perf.data.fours;
              totalPerf.batting.sixes += perf.data.sixes;
              totalPerf.batting.notOuts += perf.data.notOuts;
            } else if (perf.type === 'bowling') {
              totalPerf.bowling.wickets += perf.data.wickets;
              totalPerf.bowling.runs += perf.data.runs;
              totalPerf.bowling.overs += perf.data.overs;
            }
          }

          const averageImpact = PlayerImpactManager.calculatePlayerImpact(totalPerf);
          finalPlayerScores.set(playerDocId, {
            performance: totalPerf,
            averageImpact: averageImpact,
            matchesPlayed: performances.length
          });
        }
      }

      // Determine best players by role
      const bestPlayers = {
        batsman: null,
        bowler: null,
        allRounder: null,
        wicketKeeper: null
      };

      // Group players by role and find the best in each category
      const playersByRole = {
        batsman: [],
        bowler: [],
        allRounder: [],
        wicketKeeper: []
      };

      for (const [playerDocId, playerStats] of finalPlayerScores) {
        try {
          // Get player details
          const playerDoc = await collections.players.doc(playerDocId).get();
          if (!playerDoc.exists) continue;

          const playerData = playerDoc.data();
          const role = getPlayerRole(playerData.role);

          if (role) {
            playersByRole[role].push({
              docId: playerDocId,
              numericId: playerData.numericId,
              name: playerData.name,
              impactScore: playerStats.averageImpact,
              matchesPlayed: playerStats.matchesPlayed
            });
          }
        } catch (error) {
          console.warn(`Error getting player details for ${playerDocId}:`, error.message);
        }
      }

      // Find best player in each role based on impact score
      for (const role of ['batsman', 'bowler', 'allRounder', 'wicketKeeper']) {
        const rolePlayers = playersByRole[role];
        if (rolePlayers.length > 0) {
          // Sort by impact score (descending)
          rolePlayers.sort((a, b) => b.impactScore - a.impactScore);
          bestPlayers[role] = {
            id: rolePlayers[0].docId,
            name: rolePlayers[0].name,
            numericId: rolePlayers[0].numericId,
            impactScore: rolePlayers[0].impactScore,
            matchesPlayed: rolePlayers[0].matchesPlayed
          };
        }
      }

      // Update the team document
      await collections.teams.doc(teamId).update({
        bestPlayers: bestPlayers,
        updatedAt: new Date().toISOString()
      });

      console.log(`Updated best players for ${teamData.name}:`, {
        batsman: bestPlayers.batsman?.name || 'None',
        bowler: bestPlayers.bowler?.name || 'None',
        allRounder: bestPlayers.allRounder?.name || 'None',
        wicketKeeper: bestPlayers.wicketKeeper?.name || 'None'
      });

    }

    console.log('Team best players update completed!');

  } catch (error) {
    console.error('Error updating team best players:', error);
  }
}

/**
 * Map player role to best player category
 */
function getPlayerRole(role) {
  if (!role) return null;

  const roleLower = role.toLowerCase();
  if (roleLower.includes('batsman') || roleLower.includes('batter')) {
    return 'batsman';
  } else if (roleLower.includes('bowler')) {
    return 'bowler';
  } else if (roleLower.includes('all-rounder') || roleLower.includes('allrounder')) {
    return 'allRounder';
  } else if (roleLower.includes('wicket') && roleLower.includes('keeper')) {
    return 'wicketKeeper';
  }

  return null;
}

updateTeamBestPlayers();