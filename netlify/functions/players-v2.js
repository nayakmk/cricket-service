const { db, V2_COLLECTIONS, V2_SCHEMAS } = require('../../config/database-v2');
const admin = require('firebase-admin');
const { sequenceManager } = require('../../utils/sequenceManager');
const { PlayerImpactManager } = require('../../utils/playerImpactManager');

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

// Helper function to validate data against v2 schemas
function validateData(schema, data) {
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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  const { httpMethod: method, path: originalPath, body, queryStringParameters } = event;

  // Extract path from the event (handle both direct function calls and redirected API calls)
  let path = event.path;
  if (path.startsWith('/.netlify/functions/players-v2')) {
    path = path.replace('/.netlify/functions/players-v2', '');
  } else if (path.startsWith('/api/v2/players')) {
    path = path.replace('/api/v2/players', '');
  }

  console.log('Players V2 Function - Method:', method, 'Original Path:', originalPath, 'Processed Path:', path);

  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // GET /api/v2/players - Get all players with pagination and filtering
    if ((method === 'GET' || method === 'HEAD') && (!path || path === '/' || path === '')) {
      // Parse pagination and filter parameters
      const page = parseInt(queryStringParameters?.page) || 1;
      const limit = parseInt(queryStringParameters?.limit) || 1000;
      const offset = (page - 1) * limit;
      const role = queryStringParameters?.role;
      const teamId = queryStringParameters?.teamId;
      const isActive = queryStringParameters?.isActive;
      const orderBy = queryStringParameters?.orderBy || 'displayId';
      const orderDirection = queryStringParameters?.orderDirection || 'asc';

      let query = db.collection(V2_COLLECTIONS.PLAYERS);

      // Apply filters
      if (role) {
        query = query.where('role', '==', role);
      }
      if (teamId) {
        // Instead of querying players collection, get players from team document
        // This avoids the composite index requirement and uses the denormalized team.players array
        try {
          const teamDoc = await db.collection(V2_COLLECTIONS.TEAMS).doc(teamId).get();
          if (!teamDoc.exists) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({
                success: false,
                message: `Team with ID ${teamId} not found`
              }),
            };
          }

          const teamData = teamDoc.data();
          let teamPlayers = teamData.players || [];

          // Apply additional filters to team players
          if (role) {
            teamPlayers = teamPlayers.filter(player => player.player.role === role);
          }
          if (isActive !== undefined) {
            teamPlayers = teamPlayers.filter(player => player.player.isActive === (isActive === 'true'));
          }

          // Sort players
          const validOrderFields = ['displayId', 'name'];
          const validDirections = ['asc', 'desc'];

          if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection)) {
            teamPlayers.sort((a, b) => {
              let aVal, bVal;
              if (orderBy === 'displayId') {
                aVal = a.player.displayId || 0;
                bVal = b.player.displayId || 0;
              } else {
                aVal = a.player.name || '';
                bVal = b.player.name || '';
              }

              if (orderDirection === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
              } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
              }
            });
          }

          // Apply pagination
          const totalCount = teamPlayers.length;
          const startIndex = offset;
          const endIndex = startIndex + limit;
          const paginatedPlayers = teamPlayers.slice(startIndex, endIndex);

          // Format players for response
          const players = paginatedPlayers.map(player => ({
            id: player.player.displayId,
            displayId: player.player.displayId,
            playerId: player.player.playerId,
            name: player.player.name,
            role: player.player.role,
            battingStyle: player.player.battingStyle,
            avatar: player.player.avatar,
            isActive: true, // Team players are assumed active
            preferredTeamId: teamId,
            preferredTeam: {
              id: teamData.displayId,
              name: teamData.name,
              shortName: teamData.shortName
            },
            matchesPlayed: player.matchesPlayed,
            totalRuns: player.totalRuns,
            totalWickets: player.totalWickets,
            lastPlayed: player.lastPlayed,
            isCaptain: player.isCaptain,
            isViceCaptain: player.isViceCaptain
          }));

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
              data: players,
              pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
              }
            }),
          };
        } catch (error) {
          console.error('Error fetching team players:', error);
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Internal server error'
            }),
          };
        }
      }
      if (isActive !== undefined) {
        query = query.where('isActive', '==', isActive === 'true');
      }

      // Get total count for pagination metadata
      const totalSnapshot = await query.get();
      const totalCount = totalSnapshot.size;

      // Apply ordering
      const validOrderFields = ['displayId', 'name', 'createdAt', 'updatedAt', 'isActive', 'role'];
      const validDirections = ['asc', 'desc'];

      if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection)) {
        query = query.orderBy(orderBy, orderDirection);
      } else {
        // Return error for invalid orderBy field
        if (!validOrderFields.includes(orderBy)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: `Invalid orderBy field: ${orderBy}. Valid fields are: ${validOrderFields.join(', ')}`
            }),
          };
        }
        // Default ordering by displayId ascending
        query = query.orderBy('displayId', 'asc');
      }

      // Get paginated players
      const playersSnapshot = await query
        .limit(limit)
        .offset(offset)
        .get();

      const players = [];

      for (const doc of playersSnapshot.docs) {
        const playerData = {
          id: doc.data().displayId,
          displayId: doc.data().displayId,
          ...doc.data()
        };

        // Fetch preferred team details if preferredTeamId exists
        if (playerData.preferredTeamId) {
          try {
            const teamDoc = await db.collection(V2_COLLECTIONS.TEAMS).doc(playerData.preferredTeamId).get();
            if (teamDoc.exists) {
              playerData.preferredTeam = {
                id: teamDoc.data().displayId,
                name: teamDoc.data().name,
                shortName: teamDoc.data().shortName
              };
            }
          } catch (error) {
            console.error(`Error fetching preferred team ${playerData.preferredTeamId}:`, error);
            playerData.preferredTeam = null;
          }
        } else {
          playerData.preferredTeam = null;
        }

        // Calculate impact for recent matches
        if (playerData.recentMatches && Array.isArray(playerData.recentMatches)) {
          playerData.recentMatches = playerData.recentMatches.map(match => {
            const performance = {
              batting: match.batting || { runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0 },
              bowling: match.bowling || { wickets: 0, runs: 0, overs: 0 },
              fielding: match.fielding || { catches: 0, runOuts: 0, stumpings: 0 }
            };

            const impactScores = PlayerImpactManager.calculatePlayerImpact(performance);

            return {
              ...match,
              impact: {
                batting: impactScores.batting,
                bowling: impactScores.bowling,
                fielding: impactScores.fielding,
                total: impactScores.total
              }
            };
          });
        }

        // Calculate impact for career stats
        if (playerData.careerStats) {
          const battingMatches = playerData.careerStats.batting?.matchesPlayed || 1;
          const bowlingMatches = playerData.careerStats.bowling?.matchesPlayed || 1;

          // Calculate average performance per match for impact calculation
          const careerPerformance = {
            batting: {
              runs: (playerData.careerStats.batting?.runs || 0) / battingMatches,
              balls: playerData.careerStats.batting?.strikeRate ?
                ((playerData.careerStats.batting.runs || 0) / battingMatches) / (playerData.careerStats.batting.strikeRate / 100) : 0,
              fours: 0, // Not tracked in career stats
              sixes: 0, // Not tracked in career stats
              notOuts: (playerData.careerStats.batting?.notOuts || 0) / battingMatches
            },
            bowling: {
              wickets: (playerData.careerStats.bowling?.wickets || 0) / bowlingMatches,
              runs: playerData.careerStats.bowling?.economyRate ?
                playerData.careerStats.bowling.economyRate * 4 : 0, // Estimate runs per 4 overs (typical over count)
              overs: 4 // Assume average 4 overs per match for impact calculation
            },
            fielding: {
              catches: (playerData.careerStats.fielding?.catches || 0) / Math.max(battingMatches, bowlingMatches),
              runOuts: (playerData.careerStats.fielding?.runOuts || 0) / Math.max(battingMatches, bowlingMatches),
              stumpings: (playerData.careerStats.fielding?.stumpings || 0) / Math.max(battingMatches, bowlingMatches)
            }
          };

          const careerImpactScores = PlayerImpactManager.calculatePlayerImpact(careerPerformance);
          playerData.careerStats.impact = {
            batting: careerImpactScores.batting,
            bowling: careerImpactScores.bowling,
            fielding: careerImpactScores.fielding,
            total: careerImpactScores.total
          };
        }

        players.push(playerData);
      }

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
          data: players,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }),
      };
    }

    // GET /api/v2/players/{id} - Get specific player by displayId
    if (method === 'GET' && path.match(/^\/\d+$/)) {
      const displayId = path.substring(1);
      const playerDoc = await findDocumentByDisplayId(V2_COLLECTIONS.PLAYERS, displayId);

      if (!playerDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Player not found'
          }),
        };
      }

      const playerData = {
        id: playerDoc.data().displayId,
        displayId: playerDoc.data().displayId,
        ...playerDoc.data()
      };

      // Fetch preferred team details
      if (playerData.preferredTeamId) {
        try {
          const teamDoc = await db.collection(V2_COLLECTIONS.TEAMS).doc(playerData.preferredTeamId).get();
          if (teamDoc.exists) {
            playerData.preferredTeam = {
              id: teamDoc.data().displayId,
              name: teamDoc.data().name,
              shortName: teamDoc.data().shortName
            };
          }
        } catch (error) {
          console.error(`Error fetching preferred team ${playerData.preferredTeamId}:`, error);
          playerData.preferredTeam = null;
        }
      }

      // Get recent matches for this player (already stored in player document)
      const recentMatches = playerData.recentMatches || [];

      // Calculate impact for recent matches
      playerData.recentMatches = recentMatches.map(match => {
        const performance = {
          batting: match.batting || { runs: 0, balls: 0, fours: 0, sixes: 0, notOuts: 0 },
          bowling: match.bowling || { wickets: 0, runs: 0, overs: 0 },
          fielding: match.fielding || { catches: 0, runOuts: 0, stumpings: 0 }
        };

        const impactScores = PlayerImpactManager.calculatePlayerImpact(performance);

        return {
          ...match,
          impact: {
            batting: impactScores.batting,
            bowling: impactScores.bowling,
            fielding: impactScores.fielding,
            total: impactScores.total
          }
        };
      });

      // Calculate impact for career stats
      if (playerData.careerStats) {
        const battingMatches = playerData.careerStats.batting?.matchesPlayed || 1;
        const bowlingMatches = playerData.careerStats.bowling?.matchesPlayed || 1;

        // Calculate average performance per match for impact calculation
        const careerPerformance = {
          batting: {
            runs: (playerData.careerStats.batting?.runs || 0) / battingMatches,
            balls: playerData.careerStats.batting?.strikeRate ?
              ((playerData.careerStats.batting.runs || 0) / battingMatches) / (playerData.careerStats.batting.strikeRate / 100) : 0,
            fours: 0, // Not tracked in career stats
            sixes: 0, // Not tracked in career stats
            notOuts: (playerData.careerStats.batting?.notOuts || 0) / battingMatches
          },
          bowling: {
            wickets: (playerData.careerStats.bowling?.wickets || 0) / bowlingMatches,
            runs: playerData.careerStats.bowling?.economyRate ?
              playerData.careerStats.bowling.economyRate * 4 : 0, // Estimate runs per 4 overs (typical over count)
            overs: 4 // Assume average 4 overs per match for impact calculation
          },
          fielding: {
            catches: (playerData.careerStats.fielding?.catches || 0) / Math.max(battingMatches, bowlingMatches),
            runOuts: (playerData.careerStats.fielding?.runOuts || 0) / Math.max(battingMatches, bowlingMatches),
            stumpings: (playerData.careerStats.fielding?.stumpings || 0) / Math.max(battingMatches, bowlingMatches)
          }
        };

        const careerImpactScores = PlayerImpactManager.calculatePlayerImpact(careerPerformance);
        playerData.careerStats.impact = {
          batting: careerImpactScores.batting,
          bowling: careerImpactScores.bowling,
          fielding: careerImpactScores.fielding,
          total: careerImpactScores.total
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: playerData
        }),
      };
    }

    // GET /api/v2/players/{id}/matches - Get detailed match performance for a player
    if (method === 'GET' && path.match(/^\/\d+\/matches$/)) {
      const displayId = path.split('/')[1]; // Extract player displayId from /:displayId/matches
      console.log('Getting matches for player displayId:', displayId);

      const playerDoc = await findDocumentByDisplayId(V2_COLLECTIONS.PLAYERS, displayId);

      if (!playerDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Player not found'
          }),
        };
      }

      const player = { id: playerDoc.id, ...playerDoc.data() };

      // Get all match squads that include this player
      const matchSquadsSnapshot = await db.collection(V2_COLLECTIONS.MATCH_SQUADS)
        .where('players', 'array-contains', { playerId: playerDoc.id })
        .get();

      const playerMatches = [];
      let summary = {
        totalMatches: 0,
        totalRuns: 0,
        totalWickets: 0,
        totalCatches: 0,
        totalRunOuts: 0
      };

      for (const squadDoc of matchSquadsSnapshot.docs) {
        const squadData = squadDoc.data();
        const matchDoc = await db.collection(V2_COLLECTIONS.MATCHES).doc(squadData.matchId).get();

        if (!matchDoc.exists) continue;

        const matchData = matchDoc.data();

        // Find player's performance in this squad
        const playerInSquad = squadData.players.find(p => p.playerId === playerDoc.id);
        if (!playerInSquad) continue;

        // Get match result
        let result = 'Unknown';
        if (matchData.result) {
          if (matchData.result.winnerTeamId === squadData.teamId) {
            result = 'Won';
          } else {
            result = 'Lost';
          }
        }

        // Calculate contributions from player stats
        const contributions = [];
        if (playerInSquad.batting) {
          contributions.push({
            type: 'batting',
            runs: playerInSquad.batting.runs || 0,
            balls: playerInSquad.batting.balls || 0,
            fours: playerInSquad.batting.fours || 0,
            sixes: playerInSquad.batting.sixes || 0
          });
          summary.totalRuns += playerInSquad.batting.runs || 0;
        }

        if (playerInSquad.bowling) {
          contributions.push({
            type: 'bowling',
            wickets: playerInSquad.bowling.wickets || 0,
            runs: playerInSquad.bowling.runs || 0,
            overs: playerInSquad.bowling.overs || 0
          });
          summary.totalWickets += playerInSquad.bowling.wickets || 0;
        }

        if (playerInSquad.fielding) {
          if (playerInSquad.fielding.catches > 0) {
            contributions.push({
              type: 'fielding',
              action: 'catch',
              count: playerInSquad.fielding.catches
            });
            summary.totalCatches += playerInSquad.fielding.catches;
          }
          if (playerInSquad.fielding.runOuts > 0) {
            contributions.push({
              type: 'fielding',
              action: 'runOut',
              count: playerInSquad.fielding.runOuts
            });
            summary.totalRunOuts += playerInSquad.fielding.runOuts;
          }
        }

        playerMatches.push({
          matchId: matchData.displayId,
          matchDate: matchData.matchDate,
          tournamentName: matchData.tournamentName,
          venue: matchData.venue,
          team1: matchData.team1,
          team2: matchData.team2,
          result: result,
          contributions: contributions
        });
      }

      summary.totalMatches = playerMatches.length;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            player: {
              id: player.displayId,
              name: player.name,
              role: player.role
            },
            matches: playerMatches,
            summary: summary
          }
        }),
      };
    }

    // POST /api/v2/players - Create new player
    if (method === 'POST' && path === '/') {
      const playerData = JSON.parse(body);

      // Validate required fields
      const validationErrors = validateData(V2_SCHEMAS.players, playerData);
      if (validationErrors.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Validation failed',
            errors: validationErrors
          }),
        };
      }

      // Generate displayId
      const displayId = Math.floor(Math.random() * 999999) + 1;

      // Generate email if not provided
      const email = playerData.email || `${playerData.name.toLowerCase().replace(/\s+/g, '.')}@example.com`;

      const newPlayer = {
        ...playerData,
        email,
        displayId,
        isActive: playerData.isActive !== undefined ? playerData.isActive : true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const docRef = await db.collection(V2_COLLECTIONS.PLAYERS).add(newPlayer);

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            id: displayId,
            ...newPlayer,
            id: docRef.id
          },
          message: 'Player created successfully'
        }),
      };
    }

    // PUT /api/v2/players/{id} - Update player
    if (method === 'PUT' && path.match(/^\/\d+$/)) {
      const displayId = path.substring(1);
      const updateData = JSON.parse(body);

      const playerDoc = await findDocumentByDisplayId(V2_COLLECTIONS.PLAYERS, displayId);

      if (!playerDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Player not found'
          }),
        };
      }

      // Validate update data
      const validationErrors = validateData(V2_SCHEMAS.players, { ...playerDoc.data(), ...updateData });
      if (validationErrors.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Validation failed',
            errors: validationErrors
          }),
        };
      }

      const updatedPlayer = {
        ...updateData,
        updatedAt: admin.firestore.Timestamp.now()
      };

      await playerDoc.ref.update(updatedPlayer);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            id: displayId,
            ...playerDoc.data(),
            ...updatedPlayer
          },
          message: 'Player updated successfully'
        }),
      };
    }

    // DELETE /api/v2/players/{id} - Delete player
    if (method === 'DELETE' && path.match(/^\/\d+$/)) {
      const displayId = path.substring(1);
      const playerDoc = await findDocumentByDisplayId(V2_COLLECTIONS.PLAYERS, displayId);

      if (!playerDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Player not found'
          }),
        };
      }

      await playerDoc.ref.delete();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Player deleted successfully'
        }),
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      }),
    };

  } catch (error) {
    console.error('Players V2 API Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      }),
    };
  }
};