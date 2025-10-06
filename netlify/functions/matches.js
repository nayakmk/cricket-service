const { collections } = require('../../config/database');
const { sequenceManager } = require('../../utils/sequenceManager');
const { TeamStatisticsManager } = require('../../utils/teamStatisticsManager');

// Helper function to find document by numericId
async function findDocumentByNumericId(collection, numericId) {
  const snapshot = await collection.where('numericId', '==', parseInt(numericId, 10)).get();

  if (snapshot.empty) {
    return null;
  }

  // Return the first matching document (should only be one)
  const doc = snapshot.docs[0];

  // Return an object that mimics a Firestore document
  return {
    id: doc.id,
    ref: doc.ref,
    exists: true,
    data: () => ({ ...doc.data(), id: doc.id })
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://ebcl-app.github.io',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
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
    if (path.startsWith('/.netlify/functions/matches')) {
      path = path.replace('/.netlify/functions/matches', '');
    } else if (path.startsWith('/api/matches')) {
      path = path.replace('/api/matches', '');
    }
    
    const method = event.httpMethod;
    
    console.log('Debug - Original path:', event.path, 'Processed path:', path, 'Method:', method);

    // GET /api/matches - Get all matches with pagination
    if (method === 'GET' && (!path || path === '/' || path === '')) {
      const { status, page = 1, limit = 5 } = event.queryStringParameters || {};
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      let query = collections.matches.orderBy('scheduledDate', 'desc');

      if (status) {
        query = query.where('status', '==', status);
      }

      // Get total count for pagination metadata
      const totalSnapshot = await query.get();
      const totalCount = totalSnapshot.size;

      // Apply pagination
      const paginatedQuery = query.limit(limitNum).offset(offset);
      const snapshot = await paginatedQuery.get();
      const matches = [];

      // Build matches list using embedded team details
      for (const doc of snapshot.docs) {
        const matchData = doc.data();

        // Calculate scores from innings data
        let team1Score = matchData.team1Score || 0;
        let team2Score = matchData.team2Score || 0;

        // If no stored scores, try to calculate from innings
        if (team1Score === 0 && team2Score === 0) {
          try {
            const inningsSnapshot = await collections.matches.doc(doc.id).collection('innings').get();
            for (const inningDoc of inningsSnapshot.docs) {
              const inningData = inningDoc.data();
              if (inningData.battingTeam === matchData.team1?.name) {
                team1Score += inningData.totalRuns || 0;
              } else if (inningData.battingTeam === matchData.team2?.name) {
                team2Score += inningData.totalRuns || 0;
              }
            }
          } catch (error) {
            console.warn(`Failed to calculate scores for match ${doc.id}:`, error);
          }
        }

        const essentialMatch = {
          id: doc.id,
          numericId: matchData.numericId,
          displayId: matchData.numericId || doc.id, // Use numericId for display, fallback to UUID
          title: matchData.title, // Include the title field
          status: matchData.status,
          matchType: matchData.matchType || matchData.title, // Fallback to title if matchType not set
          venue: matchData.venue,
          scheduledDate: matchData.scheduledDate,
          createdAt: matchData.createdAt,
          updatedAt: matchData.updatedAt,
          // Handle both old (matchData.teams) and new (matchData.team1/team2) formats
          team1: matchData.team1 || matchData.teams?.team1 || null,
          team2: matchData.team2 || matchData.teams?.team2 || null,
          // Include toss information
          toss: matchData.toss || null,
          // Include calculated score info
          currentInnings: matchData.currentInnings,
          team1Score: team1Score,
          team2Score: team2Score,
          winner: matchData.winner,
          result: matchData.result
        };

        matches.push(essentialMatch);
      }

      console.log(`Returning ${matches.length} matches`);
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
          }
        })
      };
    }

    // GET /api/matches/:numericId - Get match by numericId
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1);
      const matchDoc = await findDocumentByNumericId(collections.matches, numericId);

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

      const matchData = {
        id: matchDoc.id,
        numericId: matchDoc.data().numericId,
        displayId: matchDoc.data().numericId || matchDoc.id,
        ...matchDoc.data()
      };

      // Handle both old (matchData.teams) and new (matchData.team1/team2) formats
      matchData.team1 = matchData.team1 || matchData.teams?.team1 || null;
      matchData.team2 = matchData.team2 || matchData.teams?.team2 || null;

      // Fetch detailed innings with all player stats
      try {
        const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').orderBy('inningNumber').get();
        const innings = [];

        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = { id: inningDoc.id, ...inningDoc.data() };

          // Process batsmen details from array
          const batsmen = [];
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            for (const batsmanData of inningData.batsmen) {
              // Get player details by document ID
              const playerDoc = await collections.players.doc(batsmanData.playerId).get();
              const playerData = playerDoc.exists ? { id: playerDoc.id, ...playerDoc.data() } : null;
              batsmen.push({
                ...batsmanData,
                player: playerData ? {
                  id: playerData.id,
                  name: playerData.name,
                  numericId: playerData.numericId
                } : null
              });
            }
          }

          // Process bowling details from array
          const bowling = [];
          if (inningData.bowling && Array.isArray(inningData.bowling)) {
            for (const bowlerData of inningData.bowling) {
              // Get player details by document ID
              const playerDoc = await collections.players.doc(bowlerData.playerId).get();
              const playerData = playerDoc.exists ? { id: playerDoc.id, ...playerDoc.data() } : null;
              bowling.push({
                ...bowlerData,
                player: playerData ? {
                  id: playerData.id,
                  name: playerData.name,
                  numericId: playerData.numericId
                } : null
              });
            }
          }

          // Process fall of wickets details from array
          const fallOfWickets = [];
          if (inningData.fallOfWickets && Array.isArray(inningData.fallOfWickets)) {
            for (const fowData of inningData.fallOfWickets) {
              // Get player details by numeric ID if playerOutId exists
              let playerName = fowData.batsmanName || fowData.player_out || 'Unknown';
              if (fowData.playerOutId) {
                try {
                  // Find player by numericId
                  const playerQuery = await collections.players.where('numericId', '==', fowData.playerOutId).limit(1).get();
                  if (!playerQuery.empty) {
                    const playerDoc = playerQuery.docs[0];
                    const playerData = playerDoc.data();
                    playerName = playerData.name || playerName;
                  }
                } catch (error) {
                  console.warn(`Failed to resolve player name for fall of wickets playerOutId ${fowData.playerOutId}:`, error);
                }
              }

              fallOfWickets.push({
                wicketNumber: fowData.wicketNumber || fowData.wicket_number || 0,
                batsmanName: playerName,
                score: fowData.score || 0,
                overs: fowData.overs || fowData.over || 0
              });
            }
          }

          innings.push({
            ...inningData,
            batsmen: batsmen,
            bowling: bowling,
            fallOfWickets: fallOfWickets
          });
        }

        matchData.innings = innings;
      } catch (error) {
        console.error('Error fetching innings:', error);
        matchData.innings = [];
      }

      // Fetch detailed team lineups with full player details
      try {
        const teamIds = [matchData.team1Id, matchData.team2Id].filter(id => id && id.trim() !== '');
        if (teamIds.length > 0) {
          const lineupsSnapshot = await collections.teamLineups
            .where('teamId', 'in', teamIds)
            .get();

          const lineups = {};
          for (const lineupDoc of lineupsSnapshot.docs) {
            const lineupData = lineupDoc.data();

            // Get detailed player information for the lineup
            const playersDetails = [];
            if (lineupData.players && Array.isArray(lineupData.players)) {
              for (const playerId of lineupData.players) {
                const playerDoc = await collections.players.doc(playerId).get();
                if (playerDoc.exists) {
                  const playerData = playerDoc.data();
                  playersDetails.push({
                    id: playerDoc.id,
                    name: playerData.name,
                    numericId: playerData.numericId,
                    email: playerData.email,
                    role: playerData.role || 'Player'
                  });
                }
              }
            }

            // Get captain details
            let captainDetails = null;
            if (lineupData.captain) {
              const captainDoc = await collections.players.doc(lineupData.captain).get();
              if (captainDoc.exists) {
                const captainData = captainDoc.data();
                captainDetails = {
                  id: captainDoc.id,
                  name: captainData.name,
                  numericId: captainData.numericId
                };
              }
            }

            // Get wicket keeper details
            let wicketKeeperDetails = null;
            if (lineupData.wicketKeeper) {
              const wkDoc = await collections.players.doc(lineupData.wicketKeeper).get();
              if (wkDoc.exists) {
                const wkData = wkDoc.data();
                wicketKeeperDetails = {
                  id: wkDoc.id,
                  name: wkData.name,
                  numericId: wkData.numericId
                };
              }
            }

            lineups[lineupData.teamId] = {
              id: lineupDoc.id,
              teamId: lineupData.teamId,
              players: playersDetails,
              playersCount: playersDetails.length,
              captain: lineupData.captain,
              captainDetails: captainDetails,
              wicketKeeper: lineupData.wicketKeeper,
              wicketKeeperDetails: wicketKeeperDetails
            };
          }

          matchData.lineups = lineups;
        } else {
          matchData.lineups = {};
        }
      } catch (error) {
        console.error('Error fetching lineups:', error);
        matchData.lineups = {};
      }

      // Calculate best batsman and best bowler from innings data
      try {
        let bestBatsman = null;
        let bestBowler = null;

        if (matchData.innings && Array.isArray(matchData.innings)) {
          // Find best batsman (highest runs)
          let maxRuns = 0;
          for (const inning of matchData.innings) {
            if (inning.batsmen && Array.isArray(inning.batsmen)) {
              for (const batsman of inning.batsmen) {
                if (batsman.runs > maxRuns) {
                  maxRuns = batsman.runs;
                  bestBatsman = {
                    player: batsman.player,
                    runs: batsman.runs,
                    balls: batsman.balls || 0,
                    fours: batsman.fours || 0,
                    sixes: batsman.sixes || 0,
                    strikeRate: batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(2) : '0.00'
                  };
                }
              }
            }
          }

          // Find best bowler (most wickets, then least runs)
          let maxWickets = 0;
          let minRunsForMaxWickets = Infinity;
          for (const inning of matchData.innings) {
            if (inning.bowlers && Array.isArray(inning.bowlers)) {
              for (const bowler of inning.bowlers) {
                const wickets = bowler.wickets || 0;
                const runs = bowler.runs || 0;

                if (wickets > maxWickets || (wickets === maxWickets && runs < minRunsForMaxWickets)) {
                  maxWickets = wickets;
                  minRunsForMaxWickets = runs;
                  bestBowler = {
                    player: bowler.player,
                    wickets: wickets,
                    runs: runs,
                    overs: bowler.overs || 0,
                    economy: bowler.overs > 0 ? (runs / bowler.overs).toFixed(2) : '0.00'
                  };
                }
              }
            }
          }
        }

        matchData.bestBatsman = bestBatsman;
        matchData.bestBowler = bestBowler;
      } catch (error) {
        console.error('Error calculating best batsman/bowler:', error);
        matchData.bestBatsman = null;
        matchData.bestBowler = null;
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

    // GET /api/matches/:numericId/innings - Get innings for a match
    if (method === 'GET' && path && path.match(/^\/[^\/]+\/innings$/)) {
      const numericId = path.split('/')[1];

      // Verify match exists
      const matchDoc = await findDocumentByNumericId(collections.matches, numericId);
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
        const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').orderBy('inningNumber').get();
        const innings = [];

        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = { id: inningDoc.id, ...inningDoc.data() };
          innings.push(inningData);
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

    // GET /api/matches/:numericId/innings/:inningId - Get specific inning details
    if (method === 'GET' && path && path.match(/^\/[^\/]+\/innings\/[^\/]+$/)) {
      const pathParts = path.split('/');
      const numericId = pathParts[1];
      const inningId = pathParts[3];
      
      // Verify match exists
      const matchDoc = await findDocumentByNumericId(collections.matches, numericId);
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
        const inningDoc = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningId).get();
        
        if (!inningDoc.exists) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Inning not found'
            })
          };
        }

        const inningData = { id: inningDoc.id, ...inningDoc.data() };

        // Process batsmen details from array
        const batsmen = [];
        if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
          for (const batsmanData of inningData.batsmen) {
            // Get player details by document ID
            const playerQuery = await collections.players.doc(batsmanData.playerId).get();
            const playerData = playerQuery.exists ? { id: playerQuery.id, ...playerQuery.data() } : null;
            batsmen.push({
              ...batsmanData,
              player: playerData ? {
                id: playerData.id,
                name: playerData.name,
                numericId: playerData.numericId
              } : null
            });
          }
        }

        // Process bowling details from array
        const bowling = [];
        if (inningData.bowlers && Array.isArray(inningData.bowlers)) {
          for (const bowlerData of inningData.bowlers) {
            // Get player details by document ID
            const playerQuery = await collections.players.doc(bowlerData.playerId).get();
            const playerData = playerQuery.exists ? { id: playerQuery.id, ...playerQuery.data() } : null;
            bowling.push({
              ...bowlerData,
              player: playerData ? {
                id: playerData.id,
                name: playerData.name,
                numericId: playerData.numericId
              } : null
            });
          }
        }

        // Process fall of wickets details from array
        const fallOfWickets = [];
        if (inningData.fallOfWickets && Array.isArray(inningData.fallOfWickets)) {
          for (const fowData of inningData.fallOfWickets) {
            fallOfWickets.push(fowData);
          }
        }

        const detailedInningData = {
          ...inningData,
          batsmen: batsmen,
          bowling: bowling,
          fallOfWickets: fallOfWickets
        };        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: detailedInningData
          })
        };
      } catch (error) {
        console.error('Error fetching inning details:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Failed to fetch inning details'
          })
        };
      }
    }

    // POST /api/matches - Create new match
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

      // Verify teams exist and get their details
      const [team1Doc, team2Doc] = await Promise.all([
        collections.teams.doc(matchData.team1Id).get(),
        collections.teams.doc(matchData.team2Id).get()
      ]);

      if (!team1Doc.exists || !team2Doc.exists) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'One or both teams not found'
          })
        };
      }

      const team1Data = team1Doc.data();
      const team2Data = team2Doc.data();

      // Get full team instances with players
      const team1Instance = {
        id: matchData.team1Id,
        numericId: team1Data.numericId,
        name: team1Data.name,
        shortName: team1Data.shortName || team1Data.name.substring(0, 3).toUpperCase(),
        captain: team1Data.captainId ? {
          id: team1Data.captainId,
          name: team1Data.captain?.name || 'Unknown'
        } : null,
        players: team1Data.players || [],
        statistics: team1Data.statistics || {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winPercentage: 0
        }
      };

      const team2Instance = {
        id: matchData.team2Id,
        numericId: team2Data.numericId,
        name: team2Data.name,
        shortName: team2Data.shortName || team2Data.name.substring(0, 3).toUpperCase(),
        captain: team2Data.captainId ? {
          id: team2Data.captainId,
          name: team2Data.captain?.name || 'Unknown'
        } : null,
        players: team2Data.players || [],
        statistics: team2Data.statistics || {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winPercentage: 0
        }
      };

      // Generate numeric ID for the match
      const numericId = await sequenceManager.getNextId('matches');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('matches');

      // Add timestamps and numeric ID
      const timestamp = new Date().toISOString();
      const newMatch = {
        ...matchData,
        numericId: numericId,
        status: matchData.status || 'scheduled',
        createdAt: timestamp,
        updatedAt: timestamp,
        // Store full team instances instead of just basic info
        team1: team1Instance,
        team2: team2Instance,
        // Initialize scoring fields
        currentInnings: 0,
        team1Score: 0,
        team2Score: 0,
        winner: null,
        result: null,
        innings: []
      };

      const docRef = await collections.matches.doc(documentId).set(newMatch);
      const createdMatch = { id: documentId, ...newMatch };

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: createdMatch
        })
      };
    }

    // PUT /api/matches/:numericId - Update match
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1);
      const updateData = JSON.parse(event.body);

      // Check if match exists
      const matchDoc = await findDocumentByNumericId(collections.matches, numericId);
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

      // Update with timestamp
      const updatedMatch = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await collections.matches.doc(matchDoc.id).update(updatedMatch);
      const updatedDoc = await collections.matches.doc(matchDoc.id).get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };

      // If match status changed to completed, update team statistics
      if (updateData.status === 'completed' && matchDoc.data().status !== 'completed') {
        try {
          await TeamStatisticsManager.updateTeamStatistics(matchDoc.id, result);
        } catch (error) {
          console.error(`Failed to update team statistics for completed match ${matchDoc.id}:`, error);
          // Don't fail the request, just log the error
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: result
        })
      };
    }

    // DELETE /api/matches/:numericId - Delete match
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1);

      // Check if match exists
      const matchDoc = await findDocumentByNumericId(collections.matches, numericId);
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

      // Delete related innings and balls if needed
      try {
        const inningsSnapshot = await collections.innings.where('matchId', '==', matchId).get();
        const deletePromises = [];
        
        inningsSnapshot.forEach(doc => {
          deletePromises.push(collections.innings.doc(doc.id).delete());
        });

        // Delete balls related to this match (if any)
        const ballsSnapshot = await collections.balls.where('matchId', '==', matchId).get();
        ballsSnapshot.forEach(doc => {
          deletePromises.push(collections.balls.doc(doc.id).delete());
        });

        await Promise.all(deletePromises);
      } catch (cleanupError) {
        console.warn('Error cleaning up related data:', cleanupError);
      }

      // Delete the match
      await collections.matches.doc(matchDoc.id).delete();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Match deleted successfully'
        })
      };
    }

    // POST /api/matches/:numericId/innings - Create new inning for a match
    if (method === 'POST' && path.match(/^\/[^\/]+\/innings$/)) {
      const numericId = path.split('/')[1];
      const inningData = JSON.parse(event.body);

      // Validate required fields
      if (!inningData.inningNumber || !inningData.battingTeam || !inningData.bowlingTeam) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields: inningNumber, battingTeam, bowlingTeam'
          })
        };
      }

      // Verify match exists
      const matchDoc = await findDocumentByNumericId(collections.matches, numericId);
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

      // Use inningNumber as document ID for consistency
      const documentId = inningData.inningNumber.toString();

      const newInning = {
        ...inningData,
        matchId,
        status: 'completed', // Since we're saving completed inning data
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store inning as subcollection of the match
      await collections.matches.doc(matchId).collection('innings').doc(documentId).set(newInning);

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: documentId, ...newInning },
          message: 'Inning created successfully'
        })
      };
    }

    // POST /api/matches/:matchId/innings/:inningId/batsmen - Add batsman to inning
    if (method === 'POST' && path.match(/^\/[^\/]+\/innings\/[^\/]+\/batsmen$/)) {
      const parts = path.split('/');
      const matchId = parts[1];
      const inningId = parts[3];
      const batsmanData = JSON.parse(event.body);

      // Validate required fields
      if (!batsmanData.playerId || batsmanData.runs === undefined) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields: playerId, runs'
          })
        };
      }

      // Verify match and inning exist
      const matchDoc = await collections.matches.doc(matchId).get();
      if (!matchDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      // Get current inning data
      const inningData = inningDoc.data();
      const batsmen = inningData.batsmen || [];

      // Check if batsman already exists, update if so, otherwise add
      const existingIndex = batsmen.findIndex(b => b.playerId === batsmanData.playerId);
      if (existingIndex >= 0) {
        batsmen[existingIndex] = {
          ...batsmen[existingIndex],
          ...batsmanData,
          updatedAt: new Date().toISOString()
        };
      } else {
        batsmen.push({
          ...batsmanData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Update the inning document with the modified batsmen array
      await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
        batsmen: batsmen,
        updatedAt: new Date().toISOString()
      });

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: batsmanData,
          message: 'Batsman added successfully'
        })
      };
    }

    // POST /api/matches/:matchId/innings/:inningId/bowling - Add bowler to inning
    if (method === 'POST' && path.match(/^\/[^\/]+\/innings\/[^\/]+\/bowling$/)) {
      const parts = path.split('/');
      const matchId = parts[1];
      const inningId = parts[3];
      const bowlingData = JSON.parse(event.body);

      // Validate required fields
      if (!bowlingData.playerId || bowlingData.overs === undefined) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields: playerId, overs'
          })
        };
      }

      // Verify match and inning exist
      const matchDoc = await collections.matches.doc(matchId).get();
      if (!matchDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      // Get current inning data
      const inningData = inningDoc.data();
      const bowlers = inningData.bowlers || [];

      // Check if bowler already exists, update if so, otherwise add
      const existingIndex = bowlers.findIndex(b => b.playerId === bowlingData.playerId);
      if (existingIndex >= 0) {
        bowlers[existingIndex] = {
          ...bowlers[existingIndex],
          ...bowlingData,
          updatedAt: new Date().toISOString()
        };
      } else {
        bowlers.push({
          ...bowlingData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Update the inning document with the modified bowlers array
      await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
        bowlers: bowlers,
        updatedAt: new Date().toISOString()
      });

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: bowlingData,
          message: 'Bowler added successfully'
        })
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Route not found',
        debug: {
          originalPath: event.path,
          processedPath: path,
          method: method,
          queryParams: event.queryStringParameters
        }
      })
    };

  } catch (error) {
    console.error('Error in matches function:', error);
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