const { db, V2_COLLECTIONS, V2_SCHEMAS } = require('../../config/database-v2');
const { sequenceManager } = require('../../utils/sequenceManager');
const { TeamStatisticsManager } = require('../../utils/teamStatisticsManager');
const { PlayerImpactManager } = require('../../utils/playerImpactManager');

// Helper function to find document by numericId in v2 collections
async function findDocumentByNumericId(collection, numericId) {
  const snapshot = await db.collection(collection).where('numericId', '==', parseInt(numericId, 10)).get();

  if (snapshot.empty) {
    return null;
  }

  // Return the first matching document
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ref: doc.ref,
    exists: true,
    data: () => ({ ...doc.data(), id: doc.id })
  };
}

// Helper function to validate data against v2 schemas
function validateData(schema, data) {
  // Basic validation - can be enhanced with more comprehensive validation
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    if (rules.required && (data[field] === undefined || data[field] === null)) {
      errors.push(`${field} is required`);
    }

    if (data[field] !== undefined && data[field] !== null) {
      if (rules.type && typeof data[field] !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }

      if (rules.minLength && data[field].length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && data[field].length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }

      if (rules.enum && !rules.enum.includes(data[field])) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }
  }

  return errors;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://ebcl-app.github.io',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Handle both direct function calls and API route calls
    let path = event.path;
    if (path.startsWith('/.netlify/functions/matches-v2')) {
      path = path.replace('/.netlify/functions/matches-v2', '');
    } else if (path.startsWith('/api/v2/matches')) {
      path = path.replace('/api/v2/matches', '');
    } else if (path.startsWith('/api/v2/matches')) {
      path = path.replace('/api/v2/matches', '');
    }

    const method = event.httpMethod;

    console.log('Debug - V2 API - Original path:', event.path, 'Processed path:', path, 'Method:', method);

    // GET /api/v2/matches/health - Health check endpoint
    if (method === 'GET' && path === '/health') {
      try {
        // Test database connection
        const testQuery = await db.collection(V2_COLLECTIONS.MATCHES).limit(1).get();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            status: 'healthy',
            message: 'Cricket API v2 is up and running',
            timestamp: new Date().toISOString(),
            database: {
              connected: true,
              collections: {
                matches: V2_COLLECTIONS.MATCHES,
                teams: V2_COLLECTIONS.TEAMS,
                players: V2_COLLECTIONS.PLAYERS
              }
            }
          })
        };
      } catch (error) {
        console.error('Health check failed:', error);
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            status: 'unhealthy',
            message: 'Cricket API v2 is experiencing issues',
            timestamp: new Date().toISOString(),
            error: error.message
          })
        };
      }
    }

    // GET /api/v2/matches - Get all matches with pagination
    // HEAD /api/v2/matches - Check if matches endpoint is available
    if ((method === 'GET' || method === 'HEAD') && (!path || path === '/' || path === '')) {
      const { status, page = 1, limit = 10, orderBy = 'scheduledDate', orderDirection = 'desc' } = event.queryStringParameters || {};
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      let query = db.collection(V2_COLLECTIONS.MATCHES);

      // If no status filter is provided, get all matches
      // If status filter is provided, apply it
      if (status) {
        query = query.where('status', '==', status);
      }

      // Apply ordering - default to scheduledDate descending for chronological order
      const validOrderFields = ['scheduledDate', 'createdAt', 'updatedAt', 'displayId'];
      const validDirections = ['asc', 'desc'];

      if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection)) {
        query = query.orderBy(orderBy, orderDirection);
      } else {
        // Default ordering by scheduledDate descending
        query = query.orderBy('scheduledDate', 'desc');
      }

      // Get total count for pagination metadata
      const totalSnapshot = await query.get();
      const totalCount = totalSnapshot.size;

      console.log(`V2 API: Total matches found: ${totalCount}, status filter: ${status || 'none'}`);

      // Apply pagination
      const paginatedQuery = query.limit(limitNum).offset(offset);
      const snapshot = await paginatedQuery.get();

      console.log(`V2 API: Paginated query returned ${snapshot.size} documents`);

      // Get all teams for denormalization
      const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
      const teamsMap = {};
      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        teamsMap[teamData.numericId] = {
          id: teamData.numericId,
          name: teamData.name,
          shortName: teamData.shortName || teamData.name.substring(0, 3).toUpperCase()
        };
      }

      const matches = [];

      for (const doc of snapshot.docs) {
        const matchData = doc.data();

        // Calculate scores from innings subcollection
        let team1Score = 0;
        let team2Score = 0;

        try {
          const inningsSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).doc(doc.id).collection('innings').get();
          for (const inningDoc of inningsSnapshot.docs) {
            const inningData = inningDoc.data();
            if (inningData.battingTeamId === matchData.team1Id) {
              team1Score += inningData.totalRuns || 0;
            } else if (inningData.battingTeamId === matchData.team2Id) {
              team2Score += inningData.totalRuns || 0;
            }
          }
        } catch (error) {
          console.warn(`Failed to calculate scores for match ${doc.id}:`, error);
        }

        const essentialMatch = {
          id: matchData.numericId,
          numericId: matchData.numericId,
          displayId: matchData.displayId || matchData.numericId,
          title: matchData.title,
          status: matchData.status,
          matchType: matchData.matchType,
          venue: matchData.venue,
          scheduledDate: matchData.scheduledDate?.toDate ? matchData.scheduledDate.toDate().toISOString() : matchData.scheduledDate,
          tournament: matchData.tournament,
          createdAt: matchData.createdAt,
          updatedAt: matchData.updatedAt,
          // Nested team structure with squad and score information
          team1: (() => {
            const team1Data = matchData.team1 || {
              id: matchData.team1Squad?.teamId,
              name: matchData.team1Squad?.name,
              shortName: matchData.team1Squad?.shortName,
              squad: matchData.team1Squad ? {
                ...matchData.team1Squad,
                players: matchData.team1Squad.players?.map(player => ({
                  ...player,
                  impactScore: PlayerImpactManager.calculatePlayerImpact(player)
                })) || []
              } : null,
              squadId: matchData.team1SquadId,
              score: matchData.team1Score || team1Score
            };

            // Always process players array if it exists
            if (team1Data.players) {
              team1Data.players = team1Data.players.map(player => ({
                ...player,
                impactScore: PlayerImpactManager.calculatePlayerImpact(player)
              }));
            }

            return team1Data;
          })(),
          team2: (() => {
            const team2Data = matchData.team2 || {
              id: matchData.team2Squad?.teamId,
              name: matchData.team2Squad?.name,
              shortName: matchData.team2Squad?.shortName,
              squad: matchData.team2Squad ? {
                ...matchData.team2Squad,
                players: matchData.team2Squad.players?.map(player => ({
                  ...player,
                  impactScore: PlayerImpactManager.calculatePlayerImpact(player)
                })) || []
              } : null,
              squadId: matchData.team2SquadId,
              score: matchData.team2Score || team2Score
            };

            // Always process players array if it exists
            if (team2Data.players) {
              team2Data.players = team2Data.players.map(player => ({
                ...player,
                impactScore: PlayerImpactManager.calculatePlayerImpact(player)
              }));
            }

            return team2Data;
          })(),
          // Scores from innings or stored scores
          scores: matchData.scores,
          toss: matchData.toss,
          result: matchData.result,
          playerOfMatch: matchData.playerOfMatch,
          // External MatchId if present
          ...(matchData.externalMatchId && { externalMatchId: matchData.externalMatchId })
        };

        matches.push(essentialMatch);
      }

      console.log(`V2 API: Returning ${matches.length} matches`);

      // Get total counts for all statuses
      const [liveSnapshot, scheduledSnapshot, completedSnapshot] = await Promise.all([
        db.collection(V2_COLLECTIONS.MATCHES).where('status', '==', 'live').get(),
        db.collection(V2_COLLECTIONS.MATCHES).where('status', '==', 'scheduled').get(),
        db.collection(V2_COLLECTIONS.MATCHES).where('status', '==', 'completed').get()
      ]);

      const totalCounts = {
        live: liveSnapshot.size,
        scheduled: scheduledSnapshot.size,
        completed: completedSnapshot.size,
        all: liveSnapshot.size + scheduledSnapshot.size + completedSnapshot.size
      };

      // For HEAD requests, return only headers without body
      if (method === 'HEAD') {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: ''
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: matches,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            hasNext: pageNum * limitNum < totalCount,
            hasPrev: pageNum > 1
          },
          totalCounts: totalCounts
        })
      };
    }

    // GET /api/v2/matches/:numericId - Get match by numericId with full details
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1);
      const matchDoc = await findDocumentByNumericId(V2_COLLECTIONS.MATCHES, numericId);

      if (!matchDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      // Get teams for denormalization
      const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
      const teamsMap = {};
      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        teamsMap[teamData.numericId] = {
          id: teamData.numericId,
          name: teamData.name,
          shortName: teamData.shortName || teamData.name.substring(0, 3).toUpperCase()
        };
      }

      // Get players for denormalization
      const playersSnapshot = await db.collection(V2_COLLECTIONS.PLAYERS).get();
      const playersMap = {};
      for (const playerDoc of playersSnapshot.docs) {
        const playerData = playerDoc.data();
        playersMap[playerData.numericId] = {
          id: playerData.numericId,
          name: playerData.name,
          role: playerData.role
        };
      }

      const rawMatchData = matchDoc.data();

      const matchData = {
        id: rawMatchData.numericId,
        numericId: rawMatchData.numericId,
        displayId: rawMatchData.displayId || rawMatchData.numericId,
        title: rawMatchData.title,
        status: rawMatchData.status,
        matchType: rawMatchData.matchType,
        venue: rawMatchData.venue,
        scheduledDate: rawMatchData.scheduledDate?.toDate ? rawMatchData.scheduledDate.toDate().toISOString() : rawMatchData.scheduledDate,
        tournament: rawMatchData.tournament,
        createdAt: rawMatchData.createdAt,
        updatedAt: rawMatchData.updatedAt,
        // Nested team structure with squad and score information
        team1: rawMatchData.team1 ? {
          ...rawMatchData.team1,
          players: rawMatchData.team1.players?.map(player => ({
            ...player,
            impactScore: PlayerImpactManager.calculatePlayerImpact(player)
          })) || []
        } : {
          id: rawMatchData.team1Squad?.teamId,
          name: rawMatchData.team1Squad?.name,
          shortName: rawMatchData.team1Squad?.shortName,
          squad: rawMatchData.team1Squad,
          squadId: rawMatchData.team1SquadId,
          score: rawMatchData.team1Score || 0
        },
        team2: rawMatchData.team2 ? {
          ...rawMatchData.team2,
          players: rawMatchData.team2.players?.map(player => ({
            ...player,
            impactScore: PlayerImpactManager.calculatePlayerImpact(player)
          })) || []
        } : {
          id: rawMatchData.team2Squad?.teamId,
          name: rawMatchData.team2Squad?.name,
          shortName: rawMatchData.team2Squad?.shortName,
          squad: rawMatchData.team2Squad,
          squadId: rawMatchData.team2SquadId,
          score: rawMatchData.team2Score || 0
        },
        toss: rawMatchData.toss,
        result: rawMatchData.result,
        playerOfMatch: rawMatchData.playerOfMatch,
        ...(rawMatchData.externalMatchId && { externalMatchId: rawMatchData.externalMatchId })
      };

      // Fetch innings from subcollection
      try {
        const inningsSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).collection('innings').orderBy('inningNumber').get();
        const innings = [];

        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = inningDoc.data();

          const processedInning = {
            ...inningData,
            // Use squad data for team references
            battingTeam: matchData.team1Squad && inningData.battingTeamId === matchData.team1SquadId ? {
              id: matchData.team1Squad.teamId,
              name: matchData.team1Squad.name,
              shortName: matchData.team1Squad.shortName
            } : matchData.team2Squad && inningData.battingTeamId === matchData.team2SquadId ? {
              id: matchData.team2Squad.teamId,
              name: matchData.team2Squad.name,
              shortName: matchData.team2Squad.shortName
            } : null,
            bowlingTeam: matchData.team1Squad && inningData.bowlingTeamId === matchData.team1SquadId ? {
              id: matchData.team1Squad.teamId,
              name: matchData.team1Squad.name,
              shortName: matchData.team1Squad.shortName
            } : matchData.team2Squad && inningData.bowlingTeamId === matchData.team2SquadId ? {
              id: matchData.team2Squad.teamId,
              name: matchData.team2Squad.name,
              shortName: matchData.team2Squad.shortName
            } : null
          };

          // Process batsmen with player details from match players array
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            processedInning.batsmen = inningData.batsmen.map(batsmanData => {
              const playerDetails = matchData.players?.find(p => p.playerId === batsmanData.playerId)?.player || null;

              // Calculate impact score for batsman
              const battingPerformance = {
                batting: {
                  runs: batsmanData.runs || 0,
                  balls: batsmanData.balls || 0,
                  fours: batsmanData.fours || 0,
                  sixes: batsmanData.sixes || 0,
                  notOuts: batsmanData.status && batsmanData.status.toLowerCase().includes('not out') ? 1 : 0
                },
                bowling: { wickets: 0, runs: 0, overs: 0 },
                fielding: { catches: 0, runOuts: 0, stumpings: 0 }
              };
              const impactScores = PlayerImpactManager.calculatePlayerImpact(battingPerformance);

              return {
                ...batsmanData,
                player: playerDetails,
                impactScore: impactScores
              };
            });
          }

          // Process bowlers with player details from match players array
          if (inningData.bowling && Array.isArray(inningData.bowling)) {
            processedInning.bowling = inningData.bowling.map(bowlerData => {
              const playerDetails = matchData.players?.find(p => p.playerId === bowlerData.playerId)?.player || null;

              // Calculate impact score for bowler
              const bowlingPerformance = {
                batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
                bowling: {
                  wickets: bowlerData.wickets || 0,
                  runs: bowlerData.runs || 0,
                  overs: parseFloat(bowlerData.overs || 0)
                },
                fielding: { catches: 0, runOuts: 0, stumpings: 0 }
              };
              const impactScores = PlayerImpactManager.calculatePlayerImpact(bowlingPerformance);

              return {
                ...bowlerData,
                player: playerDetails,
                impactScore: impactScores
              };
            });
          }

          innings.push(processedInning);
        }

        matchData.innings = innings;
      } catch (error) {
        console.error('Error fetching innings:', error);
        matchData.innings = [];
      }

      // Fetch player stats from subcollection first (needed for squad impact scores)
      const playerStatsMap = {};
      try {
        const playerStatsSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).collection('playerStats').get();

        for (const statDoc of playerStatsSnapshot.docs) {
          const statData = statDoc.data();
          playerStatsMap[statData.playerId] = statData;
        }
      } catch (error) {
        console.error('Error fetching player stats:', error);
      }

      // Fetch squads from subcollection
      try {
        const squadsSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).collection('squads').get();
        const squads = {};

        for (const squadDoc of squadsSnapshot.docs) {
          const squadData = squadDoc.data();
          const teamId = squadData.teamId;

          // Get player details for squad with impact scores
          const playersDetails = [];
          if (squadData.players && Array.isArray(squadData.players)) {
            for (const playerId of squadData.players) {
              const playerDetails = playersMap[playerId];
              if (playerDetails) {
                // Get player stats and calculate impact score
                const playerStats = playerStatsMap[playerId] || {
                  batting: { runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0 },
                  bowling: { wickets: 0, runs: 0, overs: 0 },
                  fielding: { catches: 0, runOuts: 0, stumpings: 0 }
                };
                const impactScores = PlayerImpactManager.calculatePlayerImpact(playerStats);

                playersDetails.push({
                  ...playerDetails,
                  impactScore: impactScores
                });
              }
            }
          }

          squads[teamId] = {
            teamId: teamId,
            players: playersDetails,
            captain: squadData.captain ? playersMap[squadData.captain] : null,
            wicketKeeper: squadData.wicketKeeper ? playersMap[squadData.wicketKeeper] : null
          };
        }

        matchData.squads = squads;
      } catch (error) {
        console.error('Error fetching squads:', error);
        matchData.squads = {};
      }

      // Add playerStats to response (with impact scores)
      const playerStats = [];
      for (const [playerId, statData] of Object.entries(playerStatsMap)) {
        const playerDetails = playersMap[playerId] || null;
        const impactScores = PlayerImpactManager.calculatePlayerImpact(statData);

        playerStats.push({
          ...statData,
          player: playerDetails,
          impactScore: impactScores
        });
      }
      matchData.playerStats = playerStats;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: matchData
        })
      };
    }

    // GET /api/v2/matches/:numericId/innings - Get innings for a match
    if (method === 'GET' && path && path.match(/^\/[^\/]+\/innings$/)) {
      const numericId = path.split('/')[1];

      const matchDoc = await findDocumentByNumericId(V2_COLLECTIONS.MATCHES, numericId);
      if (!matchDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      try {
        const inningsSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).collection('innings').orderBy('inningNumber').get();
        const innings = [];

        // Get teams and players for denormalization
        const [teamsSnapshot, playersSnapshot] = await Promise.all([
          db.collection(V2_COLLECTIONS.TEAMS).get(),
          db.collection(V2_COLLECTIONS.PLAYERS).get()
        ]);

        const teamsMap = {};
        const playersMap = {};

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          teamsMap[teamData.numericId] = {
            id: teamData.numericId,
            name: teamData.name,
            shortName: teamData.shortName || teamData.name.substring(0, 3).toUpperCase()
          };
        }

        for (const playerDoc of playersSnapshot.docs) {
          const playerData = playerDoc.data();
          playersMap[playerData.numericId] = {
            id: playerData.numericId,
            name: playerData.name,
            role: playerData.role
          };
        }

        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = inningDoc.data();

          const processedInning = {
            ...inningData,
            battingTeam: teamsMap[inningData.battingTeamId] || null,
            bowlingTeam: teamsMap[inningData.bowlingTeamId] || null
          };

          // Process batsmen
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            processedInning.batsmen = inningData.batsmen.map(batsmanData => {
              // Calculate impact score for batsman
              const battingPerformance = {
                batting: {
                  runs: batsmanData.runs || 0,
                  balls: batsmanData.balls || 0,
                  fours: batsmanData.fours || 0,
                  sixes: batsmanData.sixes || 0,
                  notOuts: batsmanData.status && batsmanData.status.toLowerCase().includes('not out') ? 1 : 0
                },
                bowling: { wickets: 0, runs: 0, overs: 0 },
                fielding: { catches: 0, runOuts: 0, stumpings: 0 }
              };
              const impactScores = PlayerImpactManager.calculatePlayerImpact(battingPerformance);

              return {
                ...batsmanData,
                player: playersMap[batsmanData.playerId] || null,
                impactScore: impactScores
              };
            });
          }

          // Process bowlers
          if (inningData.bowling && Array.isArray(inningData.bowling)) {
            processedInning.bowling = inningData.bowling.map(bowlerData => {
              // Calculate impact score for bowler
              const bowlingPerformance = {
                batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
                bowling: {
                  wickets: bowlerData.wickets || 0,
                  runs: bowlerData.runs || 0,
                  overs: parseFloat(bowlerData.overs || 0)
                },
                fielding: { catches: 0, runOuts: 0, stumpings: 0 }
              };
              const impactScores = PlayerImpactManager.calculatePlayerImpact(bowlingPerformance);

              return {
                ...bowlerData,
                player: playersMap[bowlerData.playerId] || null,
                impactScore: impactScores
              };
            });
          }

          innings.push(processedInning);
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: innings
          })
        };
      } catch (error) {
        console.error('Error fetching innings:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Error fetching innings data',
            error: error.message
          })
        };
      }
    }

    // POST /api/v2/matches - Create new match
    if (method === 'POST' && (!path || path === '/')) {
      const matchData = JSON.parse(event.body);

      // Validate required fields
      if (!matchData.team1Id || !matchData.team2Id || !matchData.title || !matchData.tournamentId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields: team1Id, team2Id, title, tournamentId'
          })
        };
      }

      // Verify teams and tournament exist and get their data
      const [team1Doc, team2Doc, tournamentDoc] = await Promise.all([
        findDocumentByNumericId(V2_COLLECTIONS.TEAMS, matchData.team1Id),
        findDocumentByNumericId(V2_COLLECTIONS.TEAMS, matchData.team2Id),
        findDocumentByNumericId(V2_COLLECTIONS.TOURNAMENTS, matchData.tournamentId)
      ]);

      if (!team1Doc || !team2Doc) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'One or both teams not found'
          })
        };
      }

      if (!tournamentDoc) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Tournament not found'
          })
        };
      }

      const team1Data = team1Doc.data();
      const team2Data = team2Doc.data();
      const tournamentData = tournamentDoc.data();

      // Validate against schema (after we have all the data)
      const validationErrors = validateData(V2_SCHEMAS.matches, {
        ...matchData,
        tournamentId: tournamentData.numericId.toString(),
        tournament: {
          tournamentId: tournamentData.numericId.toString(),
          name: tournamentData.name,
          shortName: tournamentData.shortName || tournamentData.name.substring(0, 3).toUpperCase(),
          season: tournamentData.season
        }
      });
      if (validationErrors.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Validation errors',
            errors: validationErrors
          })
        };
      }

      // Generate IDs
      const numericId = await sequenceManager.getNextId('matches');
      const documentId = await sequenceManager.generateDocumentId('matches');

      // For now, use team IDs as squad IDs (until proper squad management is implemented)
      const team1SquadId = team1Data.numericId.toString();
      const team2SquadId = team2Data.numericId.toString();

      // Get captain names by fetching captain details from players collection
      let team1CaptainName = 'TBD';
      let team2CaptainName = 'TBD';

      if (team1Data.captainId) {
        try {
          const captainDoc = await db.collection(V2_COLLECTIONS.PLAYERS).doc(team1Data.captainId).get();
          if (captainDoc.exists) {
            team1CaptainName = captainDoc.data().name;
          }
        } catch (error) {
          console.error(`Error fetching team1 captain ${team1Data.captainId}:`, error);
        }
      }

      if (team2Data.captainId) {
        try {
          const captainDoc = await db.collection(V2_COLLECTIONS.PLAYERS).doc(team2Data.captainId).get();
          if (captainDoc.exists) {
            team2CaptainName = captainDoc.data().name;
          }
        } catch (error) {
          console.error(`Error fetching team2 captain ${team2Data.captainId}:`, error);
        }
      }

      // Get players from both teams
      const [team1PlayersSnapshot, team2PlayersSnapshot] = await Promise.all([
        db.collection(V2_COLLECTIONS.PLAYERS).where('preferredTeamId', '==', team1Data.numericId.toString()).get(),
        db.collection(V2_COLLECTIONS.PLAYERS).where('preferredTeamId', '==', team2Data.numericId.toString()).get()
      ]);

      const players = [];

      // Add team 1 players
      for (const playerDoc of team1PlayersSnapshot.docs) {
        const playerData = playerDoc.data();
        players.push({
          playerId: playerData.numericId.toString(),
          player: {
            playerId: playerData.numericId.toString(),
            name: playerData.name,
            role: playerData.role,
            teamName: team1Data.name
          },
          teamId: team1Data.numericId.toString(),
          batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
          bowling: { wickets: 0, runs: 0, overs: 0 },
          fielding: { catches: 0, runOuts: 0 }
        });
      }

      // Add team 2 players
      for (const playerDoc of team2PlayersSnapshot.docs) {
        const playerData = playerDoc.data();
        players.push({
          playerId: playerData.numericId.toString(),
          player: {
            playerId: playerData.numericId.toString(),
            name: playerData.name,
            role: playerData.role,
            teamName: team2Data.name
          },
          teamId: team2Data.numericId.toString(),
          batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
          bowling: { wickets: 0, runs: 0, overs: 0 },
          fielding: { catches: 0, runOuts: 0 }
        });
      }

      const timestamp = new Date().toISOString();
      const newMatch = {
        ...matchData,
        numericId: numericId,
        displayId: numericId, // Use numericId as displayId for now
        status: matchData.status || 'scheduled',
        // Tournament data
        tournamentId: tournamentData.numericId.toString(),
        tournament: {
          tournamentId: tournamentData.numericId.toString(),
          name: tournamentData.name,
          shortName: tournamentData.shortName || tournamentData.name.substring(0, 3).toUpperCase(),
          season: tournamentData.season
        },
        // Nested team structure with squad and score information
        team1: {
          id: team1Data.numericId.toString(),
          name: team1Data.name,
          shortName: team1Data.shortName || team1Data.name.substring(0, 3).toUpperCase(),
          squad: {
            teamId: team1Data.numericId.toString(),
            name: team1Data.name,
            shortName: team1Data.shortName || team1Data.name.substring(0, 3).toUpperCase(),
            captainName: team1CaptainName
          },
          squadId: team1SquadId,
          score: 0
        },
        team2: {
          id: team2Data.numericId.toString(),
          name: team2Data.name,
          shortName: team2Data.shortName || team2Data.name.substring(0, 3).toUpperCase(),
          squad: {
            teamId: team2Data.numericId.toString(),
            name: team2Data.name,
            shortName: team2Data.shortName || team2Data.name.substring(0, 3).toUpperCase(),
            captainName: team2CaptainName
          },
          squadId: team2SquadId,
          score: 0
        },
        // Players from both squads
        players: players,
        // Scores structure
        scores: {
          team1: { runs: 0, wickets: 0, overs: 0, declared: false },
          team2: { runs: 0, wickets: 0, overs: 0, declared: false }
        },
        // Legacy fields for backward compatibility
        team1Id: matchData.team1Id,
        team2Id: matchData.team2Id,
        currentInnings: 0,
        team1Score: 0,
        team2Score: 0,
        winner: null,
        result: null,
        // External MatchId if provided
        ...(matchData.externalMatchId && { externalMatchId: matchData.externalMatchId }),
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await db.collection(V2_COLLECTIONS.MATCHES).doc(documentId).set(newMatch);

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: documentId, ...newMatch }
        })
      };
    }

    // PUT /api/v2/matches/:numericId - Update match
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1);
      const updateData = JSON.parse(event.body);

      const matchDoc = await findDocumentByNumericId(V2_COLLECTIONS.MATCHES, numericId);
      if (!matchDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      const updatedMatch = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).update(updatedMatch);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: matchDoc.id, ...updatedMatch }
        })
      };
    }

    // DELETE /api/v2/matches/:numericId - Delete match
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1);

      const matchDoc = await findDocumentByNumericId(V2_COLLECTIONS.MATCHES, numericId);
      if (!matchDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      // Delete the match document (subcollections will be automatically deleted)
      await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).delete();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Match deleted successfully'
        })
      };
    }

    // Method or path not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Endpoint not found'
      })
    };

  } catch (error) {
    console.error('V2 API Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};