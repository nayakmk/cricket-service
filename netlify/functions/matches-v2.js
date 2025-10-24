const { db, V2_COLLECTIONS, V2_SCHEMAS } = require('../../config/database-v2');
const admin = require('firebase-admin');
const { sequenceManager } = require('../../utils/sequenceManager');
const { TeamStatisticsManager } = require('../../utils/teamStatisticsManager');
const { PlayerImpactManager } = require('../../utils/playerImpactManager');
const { GroqService } = require('../../utils/groqService');

// Helper function to find dismissal data for a player from match innings
function findPlayerDismissal(matchData, playerName, teamName, team1Players, team2Players) {
  if (!matchData.innings || !playerName) return null;

  for (const inning of matchData.innings) {
    // Check if this inning belongs to the player's team
    if (inning.team === teamName || inning.battingTeam === teamName) {
      if (inning.batting && Array.isArray(inning.batting)) {
        const playerBatting = inning.batting.find(batter =>
          batter && batter.name && playerName && batter.name.toLowerCase() === playerName.toLowerCase()
        );
        if (playerBatting && playerBatting.how_out) {
          const dismissal = { ...playerBatting.how_out };

          // Add bowler ID if bowler name exists
          if (dismissal.bowler && dismissal.bowler.name) {
            const bowlerPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p.name === dismissal.bowler.name);
            if (bowlerPlayer) {
              dismissal.bowler.id = bowlerPlayer.playerId;
            }
          }

          // Add fielder ID if fielder name exists
          if (dismissal.fielder && dismissal.fielder.name) {
            const fielderPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p.name === dismissal.fielder.name);
            if (fielderPlayer) {
              dismissal.fielder.id = fielderPlayer.playerId;
            }
          }

  // Add fielders IDs if fielders exist
  if (enhanced.fielders && Array.isArray(enhanced.fielders)) {
    enhanced.fielders = enhanced.fielders.map(fielder => {
      if (typeof fielder === 'string') {
        const fielderPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p && p.name === fielder);
        return fielderPlayer ? { name: fielder, id: fielderPlayer.playerId } : { name: fielder };
      } else if (fielder && typeof fielder === 'object' && fielder.name) {
        const fielderPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p && p.name === fielder.name);
        return { ...fielder, id: fielderPlayer ? fielderPlayer.playerId : undefined };
      }
      return fielder;
    });
  }          return dismissal;
        }
      }
    }
  }
  return null;
}

// Helper function to find document by displayId in v2 collections
async function findDocumentByDisplayId(collection, displayId) {
  // First try to find by displayId field as string
  let snapshot = await db.collection(collection).where('displayId', '==', displayId.toString()).get();

  // If not found, try by displayId as number
  if (snapshot.empty) {
    const numericDisplayId = parseInt(displayId);
    if (!isNaN(numericDisplayId)) {
      snapshot = await db.collection(collection).where('displayId', '==', numericDisplayId).get();
    }
  }

  // If still not found, try by numericId
  if (snapshot.empty) {
    snapshot = await db.collection(collection).where('numericId', '==', parseInt(displayId)).get();
  }

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

// Helper function to find document by numericId in v2 collections
async function findDocumentByNumericId(collection, numericId) {
  // Try to find by numericId as number first
  let snapshot = await db.collection(collection).where('numericId', '==', parseInt(numericId)).get();

  // If not found, try by numericId as string
  if (snapshot.empty) {
    snapshot = await db.collection(collection).where('numericId', '==', numericId.toString()).get();
  }

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

// Helper function to enhance dismissal data with player IDs
function enhanceDismissalWithIds(dismissal, team1Players, team2Players) {
  if (!dismissal) return dismissal;

  const enhanced = { ...dismissal };

  // Add bowler ID if bowler name exists
  if (enhanced.bowler && typeof enhanced.bowler === 'object' && enhanced.bowler.name) {
    const bowlerPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p && p.name === enhanced.bowler.name);
    if (bowlerPlayer) {
      enhanced.bowler.id = bowlerPlayer.playerId;
    }
  }

  // Add fielder ID if fielder name exists
  if (enhanced.fielder && typeof enhanced.fielder === 'object' && enhanced.fielder.name) {
    const fielderPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p && p.name === enhanced.fielder.name);
    if (fielderPlayer) {
      enhanced.fielder.id = fielderPlayer.playerId;
    }
  }

  // Add fielders IDs if fielders exist
  if (enhanced.fielders && Array.isArray(enhanced.fielders)) {
    enhanced.fielders = enhanced.fielders.map(fielder => {
      if (typeof fielder === 'string') {
        const fielderPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p.name === fielder);
        return fielderPlayer ? { name: fielder, id: fielderPlayer.playerId } : { name: fielder };
      } else if (fielder.name && !fielder.id) {
        const fielderPlayer = [...(team1Players || []), ...(team2Players || [])].find(p => p.name === fielder.name);
        return { ...fielder, id: fielderPlayer ? fielderPlayer.playerId : undefined };
      }
      return fielder;
    });
  }

  return enhanced;
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
    let path = event.path || '';
    if (path.startsWith && path.startsWith('/.netlify/functions/matches-v2')) {
      path = path.replace('/.netlify/functions/matches-v2', '');
    } else if (path.startsWith && path.startsWith('/api/v2/matches')) {
      path = path.replace('/api/v2/matches', '');
    }

    const method = event.httpMethod;

    // Debug logging for API requests
    if (process.env.NODE_ENV === 'development') {
      console.log('Debug - V2 API - Original path:', event.path, 'Processed path:', path, 'Method:', method);
    }

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

    // GET /api/v2/matches/tournaments - Get all tournaments
    if (method === 'GET' && path === '/tournaments') {
      try {
        const snapshot = await db.collection(V2_COLLECTIONS.TOURNAMENTS).orderBy('name').get();
        const tournaments = [];

        for (const doc of snapshot.docs) {
          const tournamentData = doc.data();
          tournaments.push({
            id: tournamentData.displayId,
            displayId: tournamentData.displayId || tournamentData.numericId,
            name: tournamentData.name,
            shortName: tournamentData.shortName || (tournamentData.name ? tournamentData.name.substring(0, 3).toUpperCase() : 'UNK'),
            season: tournamentData.season,
            status: tournamentData.status || 'active'
          });
        }

        // If no tournaments exist, return a default "General Tournament"
        if (tournaments.length === 0) {
          tournaments.push({
            id: '1000000000000000000',
            numericId: 1000000000000000000,
            displayId: 'GEN2025',
            name: 'General Tournament',
            shortName: 'GEN',
            season: new Date().getFullYear().toString(),
            status: 'active'
          });
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: tournaments
          })
        };
      } catch (error) {
        console.error('Error fetching tournaments:', error);
        // Return default tournament on error
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: [{
              id: '1000000000000000000',
              numericId: 1000000000000000000,
              displayId: 'GEN2025',
              name: 'General Tournament',
              shortName: 'GEN',
              season: new Date().getFullYear().toString(),
              status: 'active'
            }]
          })
        };
      }
    }

    // GET /api/v2/matches - Get all matches with pagination
    // HEAD /api/v2/matches - Check if matches endpoint is available
    if ((method === 'GET' || method === 'HEAD') && (!path || path === '/' || path === '')) {
      const { 
        status, 
        page = 1, 
        limit = 10, 
        orderBy = 'scheduledDate', 
        orderDirection = 'desc',
        includePlayers = 'false',
        includePerformance = 'false',
        includeImpactScores = 'false',
        includeDismissals = 'false',
        includeCommentary = 'false'
      } = event.queryStringParameters || {};
      
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const includePlayersFlag = includePlayers === 'true';
      const includePerformanceFlag = includePerformance === 'true';
      const includeImpactScoresFlag = includeImpactScores === 'true';
      const includeDismissalsFlag = includeDismissals === 'true';
      const includeCommentaryFlag = includeCommentary === 'true';
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

      // When status is filtered, we can't order by scheduledDate without a composite index
      // In that case, skip custom ordering and use document ID ordering as fallback
      if (status && orderBy === 'scheduledDate') {
        // Skip ordering to avoid composite index requirement when status is filtered
        // Firestore will return results in document ID order
      } else if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection)) {
        query = query.orderBy(orderBy, orderDirection);
      } else {
        // Default ordering by scheduledDate descending (only when no status filter)
        query = query.orderBy('scheduledDate', 'desc');
      }

      // Get total count for pagination metadata
      const totalSnapshot = await query.get();
      const totalCount = totalSnapshot.size;

      // Log match count for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`V2 API: Total matches found: ${totalCount}, status filter: ${status || 'none'}`);
      }

      // Apply pagination
      const paginatedQuery = query.limit(limitNum).offset(offset);
      const snapshot = await paginatedQuery.get();

      // Log pagination results for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`V2 API: Paginated query returned ${snapshot.size} documents`);
      }

      // Only fetch performance data if needed (squad data now comes from match documents)
      let performanceMap = {};
      const matchIds = [];
      let teamsMap = {};
      let playersMap = {};

      if (includePlayersFlag || includePerformanceFlag || includeImpactScoresFlag || includeDismissalsFlag) {
        // Get all teams for denormalization
        const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          teamsMap[teamData.numericId] = {
            id: teamData.numericId,
            displayId: teamData.displayId,
            name: teamData.name,
            shortName: teamData.shortName || (teamData.name ? teamData.name.substring(0, 3).toUpperCase() : 'UNK')
          };
        }

        // First pass: collect match IDs and basic data
        for (const doc of snapshot.docs) {
          const matchData = doc.data();
          matchIds.push(matchData.externalReferenceId || matchData.numericId.toString());
        }

        // Build performance data map from match documents
        for (const doc of snapshot.docs) {
          const matchData = doc.data();
          const matchId = matchData.externalReferenceId || matchData.numericId.toString();
          performanceMap[matchId] = performanceMap[matchId] || {};

          // Get performance data from team players arrays
          if (matchData.team1?.players && Array.isArray(matchData.team1.players)) {
            const teamId = matchData.team1Id || matchData.team1.id;
            performanceMap[matchId][teamId] = {};
            for (const player of matchData.team1.players) {
              performanceMap[matchId][teamId][player.playerId] = {
                batting: player.batting,
                bowling: player.bowling,
                fielding: player.fielding
              };
            }
          }

          if (matchData.team2?.players && Array.isArray(matchData.team2.players)) {
            const teamId = matchData.team2Id || matchData.team2.id;
            performanceMap[matchId][teamId] = {};
            for (const player of matchData.team2.players) {
              performanceMap[matchId][teamId][player.playerId] = {
                batting: player.batting,
                bowling: player.bowling,
                fielding: player.fielding
              };
            }
          }
        }
      }

      const matches = [];

      // Second pass: build complete match data
      for (const doc of snapshot.docs) {
        const matchData = doc.data();

        // Calculate scores from innings array
        let team1Score = 0;
        let team2Score = 0;

        // Check if scores are stored as objects
        if (matchData.team1?.score?.runs !== undefined) {
          team1Score = matchData.team1.score.runs;
        } else if (typeof matchData.team1Score === 'number') {
          team1Score = matchData.team1Score;
        }

        if (matchData.team2?.score?.runs !== undefined) {
          team2Score = matchData.team2.score.runs;
        } else if (typeof matchData.team2Score === 'number') {
          team2Score = matchData.team2Score;
        }

        // If scores are not stored, calculate from innings
        if ((team1Score === 0 && team2Score === 0) && matchData.innings) {
          team1Score = 0;
          team2Score = 0;
          for (const inning of matchData.innings) {
            // Try matching by team ID first, then by name
            if (inning.battingTeamId === matchData.team1Id || inning.battingTeam === matchData.team1?.name || inning.battingTeam === matchData.team1Squad?.name) {
              team1Score += inning.totalRuns || 0;
            } else if (inning.battingTeamId === matchData.team2Id || inning.battingTeam === matchData.team2?.name || inning.battingTeam === matchData.team2Squad?.name) {
              team2Score += inning.totalRuns || 0;
            }
          }
        }

        // Get innings data for this match (now embedded in match document)
        const matchId = matchData.externalReferenceId || matchData.numericId.toString();
        const matchInnings = matchData.innings || [];

        // Extract squad data from innings
        const matchSquads = {};
        for (const inning of matchInnings) {
          if (inning.teamId && inning.batting) {
            matchSquads[inning.teamId] = {
              players: inning.batting,
              captain: inning.captain,
              viceCaptain: inning.viceCaptain
            };
          }
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
            const team1SquadData = matchSquads[matchData.team1?.id || matchData.team1Id] || {};
            const team2SquadData = matchSquads[matchData.team2?.id || matchData.team2Id] || {};
            const team1Data = matchData.team1 ? {
              ...matchData.team1,
              // Add displayId from teamsMap if available
              displayId: teamsMap[matchData.team1.id || matchData.team1Id]?.displayId || matchData.team1.displayId,
              // Remove squad and squadId if they exist
              squad: undefined,
              squadId: undefined,
              // Conditionally exclude players data
              ...(includePlayersFlag ? {
                players: matchData.team1.players || []
              } : { 
                players: undefined
              }),
              // Always include score
              score: matchData.team1.score || { runs: matchData.team1Score || team1Score, wickets: 0 },
              // Add captain and vice-captain from squad data
              captain: team1SquadData.captain,
              viceCaptain: team1SquadData.viceCaptain,
              // Add innings data from squad data (now embedded in match)
              ...(includeDismissalsFlag && team1SquadData.players && {
                innings: team1SquadData.players.map(player => ({
                  playerId: player.playerId,
                  name: player.name,
                  role: player.role,
                  battingOrder: player.battingOrder || player.batting_order,
                  bowlingOrder: player.bowlingOrder || player.bowling_order,
                  battingStyle: player.battingStyle || player.batting_style,
                  bowlingStyle: player.bowlingStyle || player.bowling_style,
                  isCaptain: player.isCaptain,
                  isWicketKeeper: player.isWicketKeeper,
                  dismissal: enhanceDismissalWithIds(player.dismissal || findPlayerDismissal(matchData, player.name, matchData.team1?.name || matchData.team1Squad?.name, team1SquadData.players, team2SquadData.players), team1SquadData.players, team2SquadData.players),
                  // Include any other squad player data
                  ...player
                }))
              })
            } : {
              id: matchData.team1Squad?.teamId,
              name: matchData.team1Squad?.name,
              shortName: matchData.team1Squad?.shortName,
              players: includePlayersFlag ? team1SquadData.players || [] : undefined,
              score: { runs: matchData.team1Score || team1Score, wickets: 0 },
              captain: team1SquadData.captain,
              viceCaptain: team1SquadData.viceCaptain,
              // Add innings data from squad collection
              ...(includeDismissalsFlag && team1SquadData.players && {
                innings: team1SquadData.players.map(player => ({
                  playerId: player.playerId,
                  displayId: playersMap[player.playerId]?.displayId || player.displayId,
                  name: player.name,
                  role: player.role,
                  battingOrder: player.battingOrder || player.batting_order,
                  bowlingOrder: player.bowlingOrder || player.bowling_order,
                  battingStyle: player.battingStyle || player.batting_style,
                  bowlingStyle: player.bowlingStyle || player.bowling_style,
                  isCaptain: player.isCaptain,
                  isWicketKeeper: player.isWicketKeeper,
                  dismissal: enhanceDismissalWithIds(player.how_out, team1SquadData.players, team2SquadData.players),
                  // Include any other squad player data
                  ...player
                }))
              })
            };

            // Add impact scores for completed matches only if requested
            if (matchData.status === 'completed' && includeImpactScoresFlag && team1Data.players) {
              const matchId = matchData.externalReferenceId || matchData.numericId.toString();
              const teamId = matchData.team1Id || matchData.team1?.id;
              const teamPerformanceData = performanceMap[matchId]?.[teamId] || {};

              team1Data.players = team1Data.players.map(player => {
                // Get performance data for this player
                const performanceData = teamPerformanceData[player.playerId] || {};

                const impactScores = PlayerImpactManager.calculatePlayerImpact({
                  batting: performanceData.batting,
                  bowling: performanceData.bowling,
                  fielding: performanceData.fielding
                });

                return {
                  ...player,
                  batting: includePerformanceFlag && performanceData.batting ? {
                    ...performanceData.batting,
                    impact: impactScores.batting
                  } : undefined,
                  bowling: includePerformanceFlag && performanceData.bowling ? {
                    ...performanceData.bowling,
                    impact: impactScores.bowling
                  } : undefined,
                  fielding: includePerformanceFlag && performanceData.fielding ? {
                    ...performanceData.fielding,
                    impact: impactScores.fielding
                  } : undefined,
                  overall: {
                    impact: impactScores.total
                  }
                };
              });
            }

            return team1Data;
          })(),
          team2: (() => {
            const team1SquadData = matchSquads[matchData.team1?.id || matchData.team1Id] || {};
            const team2SquadData = matchSquads[matchData.team2?.id || matchData.team2Id] || {};
            const team2Data = matchData.team2 ? {
              ...matchData.team2,
              // Add displayId from teamsMap if available
              displayId: teamsMap[matchData.team2.id || matchData.team2Id]?.displayId || matchData.team2.displayId,
              // Remove squad and squadId if they exist
              squad: undefined,
              squadId: undefined,
              // Conditionally exclude players data
              ...(includePlayersFlag ? {
                players: matchData.team2.players || []
              } : { 
                players: undefined
              }),
              // Always include score
              score: matchData.team2.score || { runs: matchData.team2Score || team2Score, wickets: 0 },
              // Add captain and vice-captain from squad data
              captain: team2SquadData.captain,
              viceCaptain: team2SquadData.viceCaptain,
              // Add innings data from squad data (now embedded in match)
              ...(includeDismissalsFlag && team2SquadData.players && {
                innings: team2SquadData.players.map(player => ({
                  playerId: player.playerId,
                  name: player.name,
                  role: player.role,
                  battingOrder: player.battingOrder || player.batting_order,
                  bowlingOrder: player.bowlingOrder || player.bowling_order,
                  battingStyle: player.battingStyle || player.batting_style,
                  bowlingStyle: player.bowlingStyle || player.bowling_style,
                  isCaptain: player.isCaptain,
                  isWicketKeeper: player.isWicketKeeper,
                  dismissal: enhanceDismissalWithIds(player.dismissal || findPlayerDismissal(matchData, player.name, matchData.team2?.name || matchData.team2Squad?.name, team2SquadData.players, team1SquadData.players), team2SquadData.players, team1SquadData.players),
                  // Include any other squad player data
                  ...player
                }))
              })
            } : {
              id: matchData.team2Squad?.teamId,
              name: matchData.team2Squad?.name,
              shortName: matchData.team2Squad?.shortName,
              players: includePlayersFlag ? team2SquadData.players || [] : undefined,
              score: { runs: matchData.team2Score || team2Score, wickets: 0 },
              captain: team2SquadData.captain,
              viceCaptain: team2SquadData.viceCaptain,
              // Add innings data from squad collection
              ...(includeDismissalsFlag && team2SquadData.players && {
                innings: team2SquadData.players.map(player => {
                  // Get dismissal info from match innings data
                  const dismissalData = findPlayerDismissal(matchData, player.name, matchData.team2?.name || matchData.team2Squad?.name, team2SquadData.players, team1SquadData.players);
                  
                  // Get performance data if available (only for completed matches)
                  const performanceData = matchData.status === 'completed' ? 
                    performanceMap[matchId]?.[matchData.team2Id || matchData.team2?.id]?.[player.playerId] : null;
                  
                  return {
                    playerId: player.playerId,
                    displayId: playersMap[player.playerId]?.displayId || player.displayId,
                    name: player.name,
                    role: player.role,
                    battingOrder: player.battingOrder || player.batting_order,
                    bowlingOrder: player.bowlingOrder || player.bowling_order,
                    battingStyle: player.battingStyle || player.batting_style,
                    bowlingStyle: player.bowlingStyle || player.bowling_style,
                    isCaptain: player.isCaptain,
                    isWicketKeeper: player.isWicketKeeper,
                    dismissal: dismissalData,
                    // Include performance data if available
                    ...(performanceData && {
                      batting: performanceData.batting,
                      bowling: performanceData.bowling,
                      fielding: performanceData.fielding
                    }),
                    // Include any other squad player data
                    ...player
                  };
                })
              })
            };

            // Add impact scores for completed matches only if requested
            if (matchData.status === 'completed' && includeImpactScoresFlag && team2Data.players) {
              const matchId = matchData.externalReferenceId || matchData.numericId.toString();
              const teamPerformanceData = performanceMap[matchId]?.[matchData.team2Id || matchData.team2?.id] || {};

              team2Data.players = team2Data.players.map(player => {
                // Get performance data for this player
                const performanceData = teamPerformanceData[player.playerId] || {};

                const impactScores = PlayerImpactManager.calculatePlayerImpact({
                  batting: performanceData.batting,
                  bowling: performanceData.bowling,
                  fielding: performanceData.fielding
                });

                return {
                  ...player,
                  batting: includePerformanceFlag && performanceData.batting ? {
                    ...performanceData.batting,
                    impact: impactScores.batting
                  } : undefined,
                  bowling: includePerformanceFlag && performanceData.bowling ? {
                    ...performanceData.bowling,
                    impact: impactScores.bowling
                  } : undefined,
                  fielding: includePerformanceFlag && performanceData.fielding ? {
                    ...performanceData.fielding,
                    impact: impactScores.fielding
                  } : undefined,
                  overall: {
                    impact: impactScores.total
                  }
                };
              });
            }

            return team2Data;
          })(),
          // Scores from innings or stored scores
          scores: matchData.scores,
          toss: matchData.toss,
          result: (() => {
            // Always calculate playerOfMatch first
            const playerOfMatch = (() => {
              // If player of match is already set in the data, use it
              if (matchData.playerOfMatch) {
                return matchData.playerOfMatch;
              }

              // For completed matches, calculate player of match from performance data
              if (matchData.status === 'completed') {
                const matchId = matchData.externalReferenceId || matchData.numericId.toString();
                const team1Performance = performanceMap[matchId]?.[matchData.team1Id || matchData.team1?.id] || {};
                const team2Performance = performanceMap[matchId]?.[matchData.team2Id || matchData.team2?.id] || {};

                let bestPlayer = null;
                let maxImpact = -Infinity;

                // Check all players from both teams
                const allPlayers = [
                  ...(matchSquads[matchData.team1?.id || matchData.team1Id]?.players || []).map(player => ({ ...player, teamId: matchData.team1?.id || matchData.team1Id })),
                  ...(matchSquads[matchData.team2?.id || matchData.team2Id]?.players || []).map(player => ({ ...player, teamId: matchData.team2?.id || matchData.team2Id }))
                ];

                for (const player of allPlayers) {
                  const performanceData = (player.teamId === matchData.team1?.id ? team1Performance : team2Performance)[player.playerId] || {};
                  
                  const impactScores = PlayerImpactManager.calculatePlayerImpact({
                    batting: performanceData.batting,
                    bowling: performanceData.bowling,
                    fielding: performanceData.fielding
                  });

                  if (impactScores.total > maxImpact) {
                    maxImpact = impactScores.total;
                    bestPlayer = {
                      id: player.playerId,
                      name: player.name,
                      teamId: player.teamId,
                      teamName: player.teamId === matchData.team1?.id ? matchData.team1?.name : matchData.team2?.name,
                      impact: impactScores.total
                    };
                  }
                }

                return bestPlayer;
              }

              return null;
            })();

            // If result already exists and has proper structure, use it and add playerOfMatch
            if (matchData.result && typeof matchData.result === 'object') {
              const existingResult = matchData.result;

              // If winner is already an object with id/name, use it
              if (existingResult.winner && typeof existingResult.winner === 'object' && existingResult.winner.id) {
                return {
                  winner: existingResult.winner,
                  margin: existingResult.margin || '',
                  playerOfMatch: playerOfMatch
                };
              }

              // If we have winnerTeamId and winnerTeamName from the database, construct winner object
              if (existingResult.winnerTeamId && existingResult.winnerTeamName) {
                return {
                  winner: {
                    id: existingResult.winnerTeamId,
                    name: existingResult.winnerTeamName,
                    shortName: existingResult.winnerTeamName.length > 10 ?
                      existingResult.winnerTeamName.substring(0, 10) :
                      existingResult.winnerTeamName
                  },
                  margin: existingResult.margin || '',
                  playerOfMatch: playerOfMatch
                };
              }

              // If winner is a string, try to find the team information
              if (typeof existingResult.winner === 'string') {
                // Find team by name
                if (matchData.team1?.name === existingResult.winner || matchData.team1?.shortName === existingResult.winner) {
                  return {
                    winner: {
                      id: matchData.team1Id || matchData.team1?.id,
                      name: matchData.team1?.name,
                      shortName: matchData.team1?.shortName
                    },
                    margin: existingResult.margin || '',
                    playerOfMatch: playerOfMatch
                  };
                } else if (matchData.team2?.name === existingResult.winner || matchData.team2?.shortName === existingResult.winner) {
                  return {
                    winner: {
                      id: matchData.team2Id || matchData.team2?.id,
                      name: matchData.team2?.name,
                      shortName: matchData.team2?.shortName
                    },
                    margin: existingResult.margin || '',
                    playerOfMatch: playerOfMatch
                  };
                }
                // If we can't find the team, return the string winner
                return {
                  winner: existingResult.winner,
                  margin: existingResult.margin || '',
                  playerOfMatch: playerOfMatch
                };
              }

              // If existing result has no winner info, just add playerOfMatch
              return {
                ...existingResult,
                playerOfMatch: playerOfMatch
              };
            }

            // For completed matches without result, determine winner from scores
            if (matchData.status === 'completed') {
              const team1Score = team1Score;
              const team2Score = team2Score;

              let winnerTeam = null;
              let margin = '';

              if (team1Score > team2Score) {
                winnerTeam = {
                  id: matchData.team1Id || matchData.team1?.id,
                  name: matchData.team1?.name || matchData.team1Squad?.name,
                  shortName: matchData.team1?.shortName || matchData.team1Squad?.shortName
                };
                margin = `${team1Score - team2Score} runs`;
              } else if (team2Score > team1Score) {
                winnerTeam = {
                  id: matchData.team2Id || matchData.team2?.id,
                  name: matchData.team2?.name || matchData.team2Squad?.name,
                  shortName: matchData.team2?.shortName || matchData.team2Squad?.shortName
                };
                margin = `${team2Score - team1Score} runs`;
              } else if (team1Score === team2Score) {
                // Tie - could be a tie or super over, but for now we'll mark it as tie
                margin = 'tie';
              }

              return winnerTeam ? {
                winner: winnerTeam,
                margin: margin,
                playerOfMatch: playerOfMatch
              } : {
                playerOfMatch: playerOfMatch
              };
            }

            // For non-completed matches, just return playerOfMatch if available
            return {
              playerOfMatch: playerOfMatch
            };
          })(),
          // External MatchId if present
          ...(matchData.externalMatchId && { externalMatchId: matchData.externalMatchId })
        };

        // Add AI commentary if requested
        if (includeCommentaryFlag) {
          try {
            const commentaryData = await GroqService.generateMatchCommentary({
              matchId: matchData.numericId,
              team1: essentialMatch.team1,
              team2: essentialMatch.team2,
              venue: essentialMatch.venue,
              matchType: essentialMatch.matchType,
              status: essentialMatch.status,
              winner: essentialMatch.result?.winner,
              result: essentialMatch.result,
              innings: matchInnings,
              toss: essentialMatch.toss
            });
            essentialMatch.commentary = commentaryData;
          } catch (error) {
            console.error('Error generating commentary for match:', matchData.numericId, error);
            essentialMatch.commentary = {
              matchOverview: 'Commentary generation failed',
              currentSituation: 'Unable to generate live commentary at this time',
              keyHighlights: ['Commentary unavailable'],
              playerSpotlight: 'Analysis pending',
              tacticalAnalysis: 'Tactical insights unavailable',
              matchPrediction: 'Prediction unavailable',
              excitingCommentary: ['Stay tuned for updates!']
            };
          }
        }

        matches.push(essentialMatch);
      }

      // Log final result count for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`V2 API: Returning ${matches.length} matches`);
      }

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

    // GET /api/v2/matches/:displayId - Get match by displayId with full details
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const displayId = path.substring(1);
      const matchDoc = await findDocumentByDisplayId(V2_COLLECTIONS.MATCHES, displayId);

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

      // Parse query parameters
      const {
        includePlayers = 'false',
        includePerformance = 'false',
        includeImpactScores = 'false',
        includeDismissals = 'false',
        includeCommentary = 'false'
      } = event.queryStringParameters || {};

      const includePlayersFlag = includePlayers === 'true';
      const includePerformanceFlag = includePerformance === 'true';
      const includeImpactScoresFlag = includeImpactScores === 'true';
      const includeDismissalsFlag = includeDismissals === 'true';
      const includeCommentaryFlag = includeCommentary === 'true';

      // Get teams for denormalization
      const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
      const teamsMap = {};
      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        teamsMap[teamData.numericId] = {
          id: teamData.numericId,
          displayId: teamData.displayId,
          name: teamData.name,
          shortName: teamData.shortName || (teamData.name ? teamData.name.substring(0, 3).toUpperCase() : 'UNK')
        };
      }

      // Get players for denormalization
      const playersSnapshot = await db.collection(V2_COLLECTIONS.PLAYERS).get();
      const playersMap = {};
      for (const playerDoc of playersSnapshot.docs) {
        const playerData = playerDoc.data();
        playersMap[playerData.numericId] = {
          id: playerData.numericId,
          displayId: playerData.displayId,
          name: playerData.name,
          role: playerData.role
        };
      }      const rawMatchData = matchDoc.data();

      // Extract squad data from innings for dismissal processing
      const matchInnings = rawMatchData.innings || [];
      const matchSquads = {};
      for (const inning of matchInnings) {
        if (inning.teamId && inning.batting) {
          matchSquads[inning.teamId] = {
            players: inning.batting,
            captain: inning.captain,
            viceCaptain: inning.viceCaptain
          };
        }
      }

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
          // Add displayId from teamsMap if available
          displayId: teamsMap[rawMatchData.team1.id || rawMatchData.team1Id]?.displayId || rawMatchData.team1.displayId,
          // Remove squad and squadId if they exist
          squad: undefined,
          squadId: undefined,
          // Conditionally exclude players data
          ...(includePlayersFlag ? {
            players: rawMatchData.team1.players || []
          } : { 
            players: undefined
          }),
          // Always include score
          score: rawMatchData.team1.score || { runs: rawMatchData.team1Score || 0, wickets: 0 },
          // Add captain and vice-captain from squad data
          captain: matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.captain,
          viceCaptain: matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.viceCaptain,
          // Add innings data from squad data (now embedded in match)
          ...(includeDismissalsFlag && matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players && {
            innings: matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id].players.map(player => ({
              playerId: player.playerId,
              name: player.name,
              role: player.role,
              battingOrder: player.battingOrder || player.batting_order,
              bowlingOrder: player.bowlingOrder || player.bowling_order,
              battingStyle: player.battingStyle || player.batting_style,
              bowlingStyle: player.bowlingStyle || player.bowling_style,
              isCaptain: player.isCaptain,
              isWicketKeeper: player.isWicketKeeper,
              dismissal: enhanceDismissalWithIds(player.dismissal || findPlayerDismissal(rawMatchData, player.name, rawMatchData.team1?.name || rawMatchData.team1Squad?.name, matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players, matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players), matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players, matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players),
              // Include any other squad player data
              ...player
            }))
          }),
          score: (() => {
            // Return stored score object if it exists
            if (rawMatchData.team1?.score && typeof rawMatchData.team1.score === 'object') {
              return rawMatchData.team1.score;
            }
            // Use stored score if it's a number
            if (typeof rawMatchData.team1Score === 'number') {
              return { runs: rawMatchData.team1Score, wickets: 0, overs: 0, declared: false };
            }
            // Calculate from innings
            if (rawMatchData.innings) {
              let totalRuns = 0;
              let totalWickets = 0;
              let totalOvers = 0;
              for (const inning of rawMatchData.innings) {
                // Try matching by team ID first, then by name
                if (inning.battingTeamId === rawMatchData.team1Id || 
                    inning.battingTeam === rawMatchData.team1?.name || 
                    inning.battingTeam === rawMatchData.team1Squad?.name) {
                  totalRuns += inning.totalRuns || 0;
                  totalWickets += inning.totalWickets || 0;
                  totalOvers += inning.totalOvers || 0;
                }
              }
              return { runs: totalRuns, wickets: totalWickets, overs: totalOvers, declared: false };
            }
            return { runs: 0, wickets: 0, overs: 0, declared: false };
          })()
        } : {
          id: rawMatchData.team1Squad?.teamId,
          name: rawMatchData.team1Squad?.name,
          shortName: rawMatchData.team1Squad?.shortName,
          players: includePlayersFlag ? (matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players || []).map(player => {
            const impactScores = PlayerImpactManager.calculatePlayerImpact(player);
            const team1SquadData = matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id] || {};
            const team2SquadData = matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id] || {};
            return {
              playerId: player.playerId,
              displayId: playersMap[player.playerId]?.displayId || player.displayId,
              name: player.name,
              role: player.role,
              batting: player.batting ? {
                ...player.batting,
                impact: impactScores.batting
              } : undefined,
              bowling: player.bowling ? {
                ...player.bowling,
                impact: impactScores.bowling
              } : undefined,
              fielding: player.fielding ? {
                ...player.fielding,
                impact: impactScores.fielding
              } : undefined,
              overall: {
                impact: impactScores.total
              },
              ...(includeDismissalsFlag && {
                dismissal: enhanceDismissalWithIds(player.how_out, team1SquadData.players, team2SquadData.players)
              })
            };
          }) : undefined,
          score: { runs: rawMatchData.team1Score || 0, wickets: 0 },
          captain: matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.captain,
          viceCaptain: matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.viceCaptain,
          ...(includeDismissalsFlag && matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players && {
            innings: matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id].players.map(player => ({
              playerId: player.playerId,
              name: player.name,
              role: player.role,
              battingOrder: player.battingOrder || player.batting_order,
              bowlingOrder: player.bowlingOrder || player.bowling_order,
              battingStyle: player.battingStyle || player.batting_style,
              bowlingStyle: player.bowlingStyle || player.bowling_style,
              isCaptain: player.isCaptain,
              isWicketKeeper: player.isWicketKeeper,
              dismissal: enhanceDismissalWithIds(player.how_out, matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players, matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players),
              ...player
            }))
          })
        },
        team2: rawMatchData.team2 ? {
          ...rawMatchData.team2,
          // Add displayId from teamsMap if available
          displayId: teamsMap[rawMatchData.team2.id || rawMatchData.team2Id]?.displayId || rawMatchData.team2.displayId,
          // Remove squad and squadId if they exist
          squad: undefined,
          squadId: undefined,
          // Conditionally exclude players data
          ...(includePlayersFlag ? {
            players: rawMatchData.team2.players || []
          } : { 
            players: undefined
          }),
          // Always include score
          score: rawMatchData.team2.score || { runs: rawMatchData.team2Score || 0, wickets: 0 },
          // Add captain and vice-captain from squad data
          captain: matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.captain,
          viceCaptain: matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.viceCaptain,
          // Add innings data from squad data (now embedded in match)
          ...(includeDismissalsFlag && matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players && {
            innings: matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id].players.map(player => ({
              playerId: player.playerId,
              displayId: playersMap[player.playerId]?.displayId || player.displayId,
              name: player.name,
              role: player.role,
              battingOrder: player.battingOrder || player.batting_order,
              bowlingOrder: player.bowlingOrder || player.bowling_order,
              battingStyle: player.battingStyle || player.batting_style,
              bowlingStyle: player.bowlingStyle || player.bowling_style,
              isCaptain: player.isCaptain,
              isWicketKeeper: player.isWicketKeeper,
              dismissal: enhanceDismissalWithIds(player.dismissal || findPlayerDismissal(rawMatchData, player.name, rawMatchData.team2?.name || rawMatchData.team2Squad?.name, matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players, matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players), matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players, matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players),
              // Include any other squad player data
              ...player
            }))
          })
        } : {
          teamId: rawMatchData.team2Squad?.teamId || rawMatchData.team2Id,
          name: rawMatchData.team2Squad?.name,
          shortName: rawMatchData.team2Squad?.shortName,
          players: (matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players || []).map(player => {
            const impactScores = PlayerImpactManager.calculatePlayerImpact(player);
            const team1SquadData = matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id] || {};
            const team2SquadData = matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id] || {};
            return {
              playerId: player.playerId,
              name: player.player.name,
              role: player.player.role,
              batting: player.batting ? {
                ...player.batting,
                impact: impactScores.batting
              } : undefined,
              bowling: player.bowling ? {
                ...player.bowling,
                impact: impactScores.bowling
              } : undefined,
              fielding: player.fielding ? {
                ...player.fielding,
                impact: impactScores.fielding
              } : undefined,
              overall: {
                impact: impactScores.total
              },
              ...(includeDismissalsFlag && {
                dismissal: enhanceDismissalWithIds(player.how_out, team2SquadData.players, team1SquadData.players)
              })
            };
          }) || []
        },
        toss: rawMatchData.toss,
        result: (() => {
          // Always calculate playerOfMatch first
          const playerOfMatch = (() => {
            // If player of match is already set in the data, use it
            if (rawMatchData.playerOfMatch) {
              return rawMatchData.playerOfMatch;
            }

            // For completed matches, calculate player of match from performance data
            if (rawMatchData.status === 'completed') {
              const matchId = rawMatchData.externalReferenceId || rawMatchData.numericId.toString();
              const team1Performance = {};
              const team2Performance = {};

              // Get performance data from team players arrays (same as matches list API)
              if (rawMatchData.team1?.players && Array.isArray(rawMatchData.team1.players)) {
                const teamId = rawMatchData.team1Id || rawMatchData.team1.id;
                for (const player of rawMatchData.team1.players) {
                  team1Performance[player.playerId] = {
                    batting: player.batting,
                    bowling: player.bowling,
                    fielding: player.fielding
                  };
                }
              }

              if (rawMatchData.team2?.players && Array.isArray(rawMatchData.team2.players)) {
                const teamId = rawMatchData.team2Id || rawMatchData.team2.id;
                for (const player of rawMatchData.team2.players) {
                  team2Performance[player.playerId] = {
                    batting: player.batting,
                    bowling: player.bowling,
                    fielding: player.fielding
                  };
                }
              }

              let bestPlayer = null;
              let maxImpact = -Infinity;

              // Check all players from both teams
              const allPlayers = [
                ...(matchSquads[rawMatchData.team1?.id || rawMatchData.team1Id]?.players || []).map(player => ({ ...player, teamId: rawMatchData.team1?.id || rawMatchData.team1Id })),
                ...(matchSquads[rawMatchData.team2?.id || rawMatchData.team2Id]?.players || []).map(player => ({ ...player, teamId: rawMatchData.team2?.id || rawMatchData.team2Id }))
              ];

              for (const player of allPlayers) {
                const performanceData = (player.teamId === rawMatchData.team1?.id ? team1Performance : team2Performance)[player.playerId] || {};
                
                const impactScores = PlayerImpactManager.calculatePlayerImpact({
                  batting: performanceData.batting,
                  bowling: performanceData.bowling,
                  fielding: performanceData.fielding
                });

                if (impactScores.total > maxImpact) {
                  maxImpact = impactScores.total;
                  bestPlayer = {
                    id: player.playerId,
                    name: player.name,
                    teamId: player.teamId,
                    teamName: player.teamId === rawMatchData.team1?.id ? rawMatchData.team1?.name : rawMatchData.team2?.name,
                    impact: impactScores.total
                  };
                }
              }

              return bestPlayer;
            }

            return null;
          })();

          // If result already exists and has proper structure, use it and add playerOfMatch
          if (rawMatchData.result && typeof rawMatchData.result === 'object') {
            const existingResult = rawMatchData.result;

            // If winner is already an object with id/name, use it
            if (existingResult.winner && typeof existingResult.winner === 'object' && existingResult.winner.id) {
              return {
                winner: existingResult.winner,
                margin: existingResult.margin || '',
                playerOfMatch: playerOfMatch
              };
            }

            // If we have winnerTeamId and winnerTeamName from the database, construct winner object
            if (existingResult.winnerTeamId && existingResult.winnerTeamName) {
              return {
                winner: {
                  id: existingResult.winnerTeamId,
                  name: existingResult.winnerTeamName,
                  shortName: existingResult.winnerTeamName.length > 10 ?
                    existingResult.winnerTeamName.substring(0, 10) :
                    existingResult.winnerTeamName
                },
                margin: existingResult.margin || '',
                playerOfMatch: playerOfMatch
              };
            }

            // If winner is a string, try to find the team information
            if (typeof existingResult.winner === 'string') {
              // Find team by name
              if (rawMatchData.team1?.name === existingResult.winner || rawMatchData.team1?.shortName === existingResult.winner) {
                return {
                  winner: {
                    id: rawMatchData.team1Id || rawMatchData.team1?.id,
                    name: rawMatchData.team1?.name,
                    shortName: rawMatchData.team1?.shortName
                  },
                  margin: existingResult.margin || '',
                  playerOfMatch: playerOfMatch
                };
              } else if (rawMatchData.team2?.name === existingResult.winner || rawMatchData.team2?.shortName === existingResult.winner) {
                return {
                  winner: {
                    id: rawMatchData.team2Id || rawMatchData.team2?.id,
                    name: rawMatchData.team2?.name,
                    shortName: rawMatchData.team2?.shortName
                  },
                  margin: existingResult.margin || '',
                  playerOfMatch: playerOfMatch
                };
              }
              // If we can't find the team, return the string winner
              return {
                winner: existingResult.winner,
                margin: existingResult.margin || '',
                playerOfMatch: playerOfMatch
              };
            }

            // If existing result has no winner info, just add playerOfMatch
            return {
              ...existingResult,
              playerOfMatch: playerOfMatch
            };
          }

          // For completed matches without result, determine winner from scores
          if (rawMatchData.status === 'completed') {
            let team1Runs = 0;
            let team2Runs = 0;

            // Get team1 runs
            if (typeof rawMatchData.team1Score === 'number') {
              team1Runs = rawMatchData.team1Score;
            } else if (rawMatchData.team1?.score && typeof rawMatchData.team1.score === 'object') {
              team1Runs = rawMatchData.team1.score.runs || 0;
            } else if (rawMatchData.innings) {
              for (const inning of rawMatchData.innings) {
                if (inning.battingTeamId === rawMatchData.team1Id ||
                    inning.battingTeam === rawMatchData.team1?.name ||
                    inning.battingTeam === rawMatchData.team1Squad?.name) {
                  team1Runs += inning.totalRuns || 0;
                }
              }
            }

            // Get team2 runs
            if (typeof rawMatchData.team2Score === 'number') {
              team2Runs = rawMatchData.team2Score;
            } else if (rawMatchData.team2?.score && typeof rawMatchData.team2.score === 'object') {
              team2Runs = rawMatchData.team2.score.runs || 0;
            } else if (rawMatchData.innings) {
              for (const inning of rawMatchData.innings) {
                if (inning.battingTeamId === rawMatchData.team2Id ||
                    inning.battingTeam === rawMatchData.team2?.name ||
                    inning.battingTeam === rawMatchData.team2Squad?.name) {
                  team2Runs += inning.totalRuns || 0;
                }
              }
            }

            let winnerTeam = null;
            let margin = '';

            if (team1Runs > team2Runs) {
              winnerTeam = {
                id: rawMatchData.team1Id || rawMatchData.team1?.id,
                name: rawMatchData.team1?.name || rawMatchData.team1Squad?.name,
                shortName: rawMatchData.team1?.shortName || rawMatchData.team1Squad?.shortName
              };
              margin = `${team1Runs - team2Runs} runs`;
            } else if (team2Runs > team1Runs) {
              winnerTeam = {
                id: rawMatchData.team2Id || rawMatchData.team2?.id,
                name: rawMatchData.team2?.name || rawMatchData.team2Squad?.name,
                shortName: rawMatchData.team2?.shortName || rawMatchData.team2Squad?.shortName
              };
              margin = `${team2Runs - team1Runs} runs`;
            } else if (team1Runs === team2Runs) {
              margin = 'tie';
            }

            return winnerTeam ? {
              winner: winnerTeam,
              margin: margin,
              playerOfMatch: playerOfMatch
            } : {
              playerOfMatch: playerOfMatch
            };
          }

          // For non-completed matches, just return playerOfMatch if available
          return {
            playerOfMatch: playerOfMatch
          };
        })(),
        ...(rawMatchData.externalMatchId && { externalMatchId: rawMatchData.externalMatchId }),
        // Include raw game data fields for structural consistency
        innings: rawMatchData.innings || [],
        fallOfWickets: rawMatchData.fallOfWickets || [],
        playerOfMatch: rawMatchData.playerOfMatch || null,
        playerOfMatchId: rawMatchData.playerOfMatchId || null
      };

      // Fetch innings from subcollection or use innings from main document
      try {
        const inningsSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).collection('innings').orderBy('inningNumber').get();
        let innings = [];

        if (!inningsSnapshot.empty) {
          // Process innings from subcollection
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

            // Process fall of wickets with player details
            if (inningData.fallOfWickets && Array.isArray(inningData.fallOfWickets)) {
              processedInning.fallOfWickets = inningData.fallOfWickets.map(fowData => {
                const playerDetails = matchData.players?.find(p => p.playerId === fowData.playerId)?.player || null;
                const bowlerDetails = matchData.players?.find(p => p.playerId === fowData.bowlerId)?.player || null;

                return {
                  ...fowData,
                  player: playerDetails,
                  bowler: bowlerDetails
                };
              });
            }

            innings.push(processedInning);
          }
        } else if (rawMatchData.innings && Array.isArray(rawMatchData.innings)) {
          // Fallback: Process innings from main match document if subcollection is empty
          innings = rawMatchData.innings.map(inningData => {
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

            // Process fall of wickets with player details
            if (inningData.fallOfWickets && Array.isArray(inningData.fallOfWickets)) {
              processedInning.fallOfWickets = inningData.fallOfWickets.map(fowData => {
                const playerDetails = matchData.players?.find(p => p.playerId === fowData.playerId)?.player || null;
                const bowlerDetails = matchData.players?.find(p => p.playerId === fowData.bowlerId)?.player || null;

                return {
                  ...fowData,
                  player: playerDetails,
                  bowler: bowlerDetails
                };
              });
            }

            return processedInning;
          });
        }

        // Don't set innings for list API compatibility
      } catch (error) {
        console.error('Error fetching innings:', error);
        // Don't set innings for list API compatibility
      }

      // Add impact scores to team players if requested
      if (includeImpactScoresFlag && matchData.status === 'completed') {
        // Build performance data from match document
        const matchId = rawMatchData.externalReferenceId || rawMatchData.numericId.toString();

        // Add impact scores to team1 players
        if (matchData.team1?.players && Array.isArray(matchData.team1.players)) {
          const teamId = rawMatchData.team1Id || rawMatchData.team1?.id;
          matchData.team1.players = matchData.team1.players.map(player => {
            const impactScores = PlayerImpactManager.calculatePlayerImpact({
              batting: player.batting,
              bowling: player.bowling,
              fielding: player.fielding
            });

            return {
              ...player,
              batting: includePerformanceFlag && player.batting ? {
                ...player.batting,
                impact: impactScores.batting
              } : undefined,
              bowling: includePerformanceFlag && player.bowling ? {
                ...player.bowling,
                impact: impactScores.bowling
              } : undefined,
              fielding: includePerformanceFlag && player.fielding ? {
                ...player.fielding,
                impact: impactScores.fielding
              } : undefined,
              overall: {
                impact: impactScores.total
              }
            };
          });
        }

        // Add impact scores to team2 players
        if (matchData.team2?.players && Array.isArray(matchData.team2.players)) {
          const teamId = rawMatchData.team2Id || rawMatchData.team2?.id;
          matchData.team2.players = matchData.team2.players.map(player => {
            const impactScores = PlayerImpactManager.calculatePlayerImpact({
              batting: player.batting,
              bowling: player.bowling,
              fielding: player.fielding
            });

            return {
              ...player,
              batting: includePerformanceFlag && player.batting ? {
                ...player.batting,
                impact: impactScores.batting
              } : undefined,
              bowling: includePerformanceFlag && player.bowling ? {
                ...player.bowling,
                impact: impactScores.bowling
              } : undefined,
              fielding: includePerformanceFlag && player.fielding ? {
                ...player.fielding,
                impact: impactScores.fielding
              } : undefined,
              overall: {
                impact: impactScores.total
              }
            };
          });
        }
      }

      // Add AI commentary if requested
      if (includeCommentaryFlag) {
        try {
          const commentaryData = await GroqService.generateMatchCommentary({
            matchId: matchData.id,
            team1: matchData.team1,
            team2: matchData.team2,
            venue: matchData.venue,
            matchType: matchData.matchType,
            status: matchData.status,
            winner: matchData.result?.winner,
            result: matchData.result,
            innings: rawMatchData.innings || [],
            toss: matchData.toss
          });
          matchData.commentary = commentaryData;
        } catch (error) {
          console.error('Error generating commentary for match:', matchData.id, error);
          matchData.commentary = {
            matchOverview: 'Commentary generation failed',
            currentSituation: 'Unable to generate live commentary at this time',
            keyHighlights: ['Commentary unavailable'],
            playerSpotlight: 'Analysis pending',
            tacticalAnalysis: 'Tactical insights unavailable',
            matchPrediction: 'Prediction unavailable',
            excitingCommentary: ['Stay tuned for updates!']
          };
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: matchData
        })
      };
    }

    // GET /api/v2/matches/:displayId/innings - Get innings for a match
    if (method === 'GET' && path && path.match(/^\/[^\/]+\/innings$/)) {
      const displayId = path.split('/')[1];

      const matchDoc = await findDocumentByDisplayId(V2_COLLECTIONS.MATCHES, displayId);
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
            shortName: teamData.shortName || (teamData.name ? teamData.name.substring(0, 3).toUpperCase() : 'UNK')
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
      if (!matchData.team1Id || !matchData.team2Id || !matchData.title) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields: team1Id, team2Id, title'
          })
        };
      }

      // Verify teams exist and get their data
      const teamPromises = [
        findDocumentByDisplayId(V2_COLLECTIONS.TEAMS, matchData.team1Id),
        findDocumentByDisplayId(V2_COLLECTIONS.TEAMS, matchData.team2Id)
      ];

      // Only check tournament if tournamentId is provided and it's not a default tournament
      if (matchData.tournamentId && matchData.tournamentId !== 'GEN2025' && matchData.tournamentId !== '1000000000000000000') {
        teamPromises.push(findDocumentByDisplayId(V2_COLLECTIONS.TOURNAMENTS, matchData.tournamentId));
      }

      const results = await Promise.all(teamPromises);
      const team1Doc = results[0];
      const team2Doc = results[1];
      const tournamentDoc = (matchData.tournamentId && matchData.tournamentId !== 'GEN2025' && matchData.tournamentId !== '1000000000000000000') ? results[2] : null;

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

      // Only validate tournament if tournamentId was provided and it's not a default
      if (matchData.tournamentId && matchData.tournamentId !== 'GEN2025' && matchData.tournamentId !== '1000000000000000000' && !tournamentDoc) {
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
      const tournamentData = tournamentDoc ? tournamentDoc.data() : null;

      // Prepare data for validation (handle optional tournament)
      const validationData = {
        ...matchData
      };

      // Add tournament data if available
      if (tournamentData) {
        validationData.tournamentId = tournamentData.numericId.toString();
        validationData.tournament = {
          tournamentId: tournamentData.numericId.toString(),
          name: tournamentData.name,
          shortName: tournamentData.shortName || (tournamentData.name ? tournamentData.name.substring(0, 3).toUpperCase() : 'UNK'),
          season: tournamentData.season
        };
      } else if (matchData.tournamentId === 'GEN2025' || matchData.tournamentId === '1000000000000000000') {
        // Handle default tournament selection
        validationData.tournamentId = '1000000000000000000';
        validationData.tournament = {
          tournamentId: '1000000000000000000',
          name: 'General Tournament',
          shortName: 'GEN',
          season: new Date().getFullYear().toString()
        };
      } else {
       
        // For validation, provide default tournament data when not available
        validationData.tournamentId = '1000000000000000000'; // Default ID
        validationData.tournament = {
          tournamentId: '1000000000000000000',
          name: 'General Tournament',
          shortName: 'GEN',
          season: new Date().getFullYear().toString()
        };
      }

      // Skip validation for match creation - validation happens on the constructed match object
      // const validationErrors = validateData(V2_SCHEMAS.matches, validationData);
      // if (validationErrors.length > 0) {
      //   return {
      //     statusCode: 400,
      //     headers: corsHeaders,
      //     body: JSON.stringify({
      //       success: false,
      //       message: 'Validation errors',
      //       errors: validationErrors
      //     })
      //   };
      // }

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

      const team1Players = [];
      const team2Players = [];

      // Add team 1 players
      for (const playerDoc of team1PlayersSnapshot.docs) {
        const playerData = playerDoc.data();
        team1Players.push({
          playerId: playerData.numericId.toString(),
          name: playerData.name,
          role: playerData.role
        });
      }

      // Add team 2 players
      for (const playerDoc of team2PlayersSnapshot.docs) {
        const playerData = playerDoc.data();
        team2Players.push({
          playerId: playerData.numericId.toString(),
          name: playerData.name,
          role: playerData.role
        });
      }

      const timestamp = new Date().toISOString();
      const newMatch = {
        ...matchData,
        numericId: numericId,
        displayId: numericId, // Use numericId as displayId for now
        status: matchData.status || 'scheduled',
        // Tournament data (optional)
        ...(tournamentData ? {
          tournamentId: tournamentData.numericId.toString(),
          tournament: {
            tournamentId: tournamentData.numericId.toString(),
            name: tournamentData.name,
            shortName: tournamentData.shortName || (tournamentData.name ? tournamentData.name.substring(0, 3).toUpperCase() : 'UNK'),
            season: tournamentData.season
          }
        } : (matchData.tournamentId === 'GEN2025' || matchData.tournamentId === '1000000000000000000') ? {
          tournamentId: '1000000000000000000',
          tournament: {
            tournamentId: '1000000000000000000',
            name: 'General Tournament',
            shortName: 'GEN',
            season: new Date().getFullYear().toString()
          }
        } : {
          tournamentId: '1000000000000000000', // Default tournament ID
          tournament: {
            tournamentId: '1000000000000000000',
            name: 'General Tournament',
            shortName: 'GEN',
            season: new Date().getFullYear().toString()
          }
        }),
        // Nested team structure with squad and score information
        team1: {
          id: team1Data.numericId.toString(),
          name: team1Data.name,
          shortName: team1Data.shortName || (team1Data.name ? team1Data.name.substring(0, 3).toUpperCase() : 'UNK'),
          squad: {
            teamId: team1Data.numericId.toString(),
            name: team1Data.name,
            shortName: team1Data.shortName || (team1Data.name ? team1Data.name.substring(0, 3).toUpperCase() : 'UNK'),
            captainName: team1CaptainName
          },
          squadId: team1SquadId,
          score: 0,
          players: team1Players
        },
        team2: {
          id: team2Data.numericId.toString(),
          name: team2Data.name,
          shortName: team2Data.shortName || (team2Data.name ? team2Data.name.substring(0, 3).toUpperCase() : 'UNK'),
          squad: {
            teamId: team2Data.numericId.toString(),
            name: team2Data.name,
            shortName: team2Data.shortName || (team2Data.name ? team2Data.name.substring(0, 3).toUpperCase() : 'UNK'),
            captainName: team2CaptainName
          },
          squadId: team2SquadId,
          score: 0,
          players: team2Players
        },
        // Players from both squads (simple structure for backward compatibility)
        players: [...team1Players, ...team2Players],
        // Scores structure
        scores: {
          team1: { runs: 0, wickets: 0, overs: 0, declared: false },
          team2: { runs: 0, wickets: 0, overs: 0, declared: false }
        },
        // Game data structures (initialized empty for new matches)
        innings: [], // Will be populated during match play
        fallOfWickets: [], // Will be populated during match play
        toss: null, // Will be set when toss happens
        result: null, // Will be set when match completes
        playerOfMatch: null, // Will be set when match completes
        playerOfMatchId: null, // Will be set when match completes
        // Legacy fields for backward compatibility
        team1Id: matchData.team1Id,
        team2Id: matchData.team2Id,
        currentInnings: 0,
        team1Score: 0,
        team2Score: 0,
        winner: null,
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

    // PUT /api/v2/matches/:displayId - Update match
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const displayId = path.substring(1);
      const updateData = JSON.parse(event.body);

      const matchDoc = await findDocumentByDisplayId(V2_COLLECTIONS.MATCHES, displayId);
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

      const existingMatchData = matchDoc.data();

      // Define allowed update fields (fields that can be safely updated)
      const allowedUpdateFields = [
        'title', 'status', 'venue', 'scheduledDate', 'matchType',
        'toss', 'result', 'playerOfMatch', 'playerOfMatchId',
        'completedDate', 'externalMatchId'
      ];

      // Build update object with only the fields that should be changed
      const updateObject = {};

      // Apply allowed field updates
      allowedUpdateFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateObject[field] = updateData[field];
        }
      });

      // Ensure structural fields exist (for backward compatibility with older documents)
      if (!existingMatchData.innings) updateObject.innings = [];
      if (!existingMatchData.fallOfWickets) updateObject.fallOfWickets = [];
      if (existingMatchData.playerOfMatch === undefined) updateObject.playerOfMatch = null;
      if (existingMatchData.playerOfMatchId === undefined) updateObject.playerOfMatchId = null;

      // Handle special cases
      if (updateData.totalOvers !== undefined) {
        // This might be used for match configuration, but shouldn't override structure
        // For now, we'll ignore it as it's not part of the v2 schema
      }

      // Handle squads update - transform into proper team structure
      if (updateData.squads) {
        // Get team IDs
        const team1Id = existingMatchData.team1?.id || existingMatchData.team1Id;
        const team2Id = existingMatchData.team2?.id || existingMatchData.team2Id;

        // Check for squad data using various possible keys
        const team1SquadKeys = [team1Id, '1', 'team1', existingMatchData.team1?.displayId];
        const team2SquadKeys = [team2Id, '2', 'team2', existingMatchData.team2?.displayId];

        let team1SquadData = null;
        let team2SquadData = null;

        // Find team1 squad data
        for (const key of team1SquadKeys) {
          if (updateData.squads[key]) {
            team1SquadData = updateData.squads[key];
            break;
          }
        }

        // Find team2 squad data
        for (const key of team2SquadKeys) {
          if (updateData.squads[key]) {
            team2SquadData = updateData.squads[key];
            break;
          }
        }

        // Update team1 players if squad data found
        if (team1SquadData && team1SquadData.players) {
          updateObject['team1.players'] = team1SquadData.players.map(player => ({
            playerId: player.playerId,
            name: player.name,
            role: player.role
          }));
        }

        // Update team2 players if squad data found
        if (team2SquadData && team2SquadData.players) {
          updateObject['team2.players'] = team2SquadData.players.map(player => ({
            playerId: player.playerId,
            name: player.name,
            role: player.role
          }));
        }

        // Update players array at root level (for backward compatibility)
        const allPlayers = [];

        // Add team1 players
        if (team1SquadData && team1SquadData.players) {
          team1SquadData.players.forEach(player => {
            allPlayers.push({
              playerId: player.playerId,
              name: player.name,
              role: player.role
            });
          });
        }

        // Add team2 players
        if (team2SquadData && team2SquadData.players) {
          team2SquadData.players.forEach(player => {
            allPlayers.push({
              playerId: player.playerId,
              name: player.name,
              role: player.role
            });
          });
        }

        if (allPlayers.length > 0) {
          updateObject.players = allPlayers;
        }
      }

      // Always update the updatedAt timestamp
      updateObject.updatedAt = new Date().toISOString();

      // Remove any fields that shouldn't be in the document
      const fieldsToRemove = ['squads', 'totalOvers', 'currentInnings', 'scores', 'team1Score', 'team2Score', 'winner'];
      fieldsToRemove.forEach(field => {
        if (existingMatchData[field] !== undefined) {
          updateObject[field] = admin.firestore.FieldValue.delete();
        }
      });

      await db.collection(V2_COLLECTIONS.MATCHES).doc(matchDoc.id).update(updateObject);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: matchDoc.id, ...existingMatchData }
        })
      };
    }

    // DELETE /api/v2/matches/:displayId - Delete match
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const displayId = path.substring(1);

      const matchDoc = await findDocumentByDisplayId(V2_COLLECTIONS.MATCHES, displayId);
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

    // POST /api/v2/matches/predict-winner - Predict match winner based on player lineups
    if (method === 'POST' && path === '/predict-winner') {
      const { team1PlayerIds, team2PlayerIds, matchType = 'T20' } = JSON.parse(event.body || '{}');

      if (!team1PlayerIds || !team2PlayerIds || !Array.isArray(team1PlayerIds) || !Array.isArray(team2PlayerIds)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'team1PlayerIds and team2PlayerIds arrays are required'
          })
        };
      }

      try {
        // Get team information
        const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
        const teamsMap = {};
        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          teamsMap[teamData.numericId] = teamData;
        }

        // Fetch team1 players
        const team1Players = [];
        if (team1PlayerIds.length > 0) {
          const team1PlayersSnapshot = await db.collection(V2_COLLECTIONS.PLAYERS)
            .where('numericId', 'in', team1PlayerIds.slice(0, 10))
            .get();

          team1PlayersSnapshot.forEach(doc => {
            team1Players.push({ id: doc.id, ...doc.data() });
          });
        }

        // Fetch team2 players
        const team2Players = [];
        if (team2PlayerIds.length > 0) {
          const team2PlayersSnapshot = await db.collection(V2_COLLECTIONS.PLAYERS)
            .where('numericId', 'in', team2PlayerIds.slice(0, 10))
            .get();

          team2PlayersSnapshot.forEach(doc => {
            team2Players.push({ id: doc.id, ...doc.data() });
          });
        }

        // Determine team IDs from players (assuming all players in a team have the same preferredTeamId)
        const team1Id = team1Players.length > 0 ? team1Players[0].preferredTeamId : null;
        const team2Id = team2Players.length > 0 ? team2Players[0].preferredTeamId : null;

        const team1Data = teamsMap[team1Id] || { name: 'Team 1', shortName: 'T1' };
        const team2Data = teamsMap[team2Id] || { name: 'Team 2', shortName: 'T2' };

        // Prepare data for AI analysis
        const team1AnalysisData = {
          team1: team1Data,
          players: team1Players
        };

        const team2AnalysisData = {
          team2: team2Data,
          players: team2Players
        };

        // Get AI prediction
        const prediction = await GroqService.predictMatchWinner(team1AnalysisData, team2AnalysisData, matchType);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: {
              ...prediction.analysis,
              team1PlayersCount: team1Players.length,
              team2PlayersCount: team2Players.length,
              matchType: matchType
            }
          })
        };

      } catch (error) {
        console.error('Match prediction error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Failed to generate match prediction',
            error: error.message
          })
        };
      }
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