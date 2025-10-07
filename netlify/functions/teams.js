const { collections } = require('../../config/database');
const { sequenceManager } = require('../../utils/sequenceManager');

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
  const { httpMethod: method, path: originalPath, body, queryStringParameters } = event;
  
  // Extract path from the event (handle both direct function calls and redirected API calls)
  let path = originalPath;
  if (path && path.includes('/teams')) {
    // Extract everything after /teams
    const teamsIndex = path.indexOf('/teams');
    path = path.substring(teamsIndex + 6); // 6 is length of '/teams'
    if (!path) path = '/';
  }

  console.log('Teams Function - Method:', method, 'Original Path:', originalPath, 'Processed Path:', path);

  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // GET /api/teams - Get all teams with pagination
    if (method === 'GET' && path === '/') {
      // Parse pagination parameters
      const page = parseInt(queryStringParameters?.page) || 1;
      const limit = parseInt(queryStringParameters?.limit) || 5;
      const offset = (page - 1) * limit;

      // Get total count for pagination metadata
      const totalSnapshot = await collections.teams.get();
      const totalCount = totalSnapshot.size;

      // Get paginated teams
      const teamsSnapshot = await collections.teams
        .orderBy('numericId')
        .limit(limit)
        .offset(offset)
        .get();

      const teams = [];
      
      for (const doc of teamsSnapshot.docs) {
        const teamData = {
          id: doc.id,
          numericId: doc.data().numericId,
          displayId: doc.data().numericId || doc.id,
          ...doc.data()
        };
        
        // Fetch captain details if captainId exists
        if (teamData.captainId) {
          try {
            const captainDoc = await collections.players.doc(teamData.captainId).get();
            if (captainDoc.exists) {
              teamData.captain = {
                id: captainDoc.id,
                name: captainDoc.data().name,
                role: captainDoc.data().role
              };
            }
          } catch (error) {
            console.error(`Error fetching captain ${teamData.captainId}:`, error);
            teamData.captain = null;
          }
        } else {
          teamData.captain = null;
        }

        // Fetch player details if playerIds exist
        if (teamData.playerIds && teamData.playerIds.length > 0) {
          try {
            const playerPromises = teamData.playerIds.map(playerId => 
              collections.players.doc(playerId).get()
            );
            const playerDocs = await Promise.all(playerPromises);
            
            teamData.players = playerDocs
              .filter(doc => doc.exists)
              .map(doc => ({
                id: doc.id,
                numericId: doc.data().numericId,
                name: doc.data().name,
                role: doc.data().role,
                battingStyle: doc.data().battingStyle,
                bowlingStyle: doc.data().bowlingStyle,
                matchesPlayed: doc.data().matchesPlayed || 0,
                totalRuns: doc.data().totalRuns || 0,
                totalWickets: doc.data().totalWickets || 0,
                battingAverage: doc.data().battingAverage || 0,
                bowlingAverage: doc.data().bowlingAverage || 0
              }));
            
            teamData.playersCount = teamData.players.length;
          } catch (error) {
            console.error(`Error fetching players for team ${doc.id}:`, error);
            teamData.players = [];
            teamData.playersCount = 0;
          }
        } else {
          teamData.players = [];
          teamData.playersCount = teamData.playersCount || 0;
        }

        // Use pre-computed match history from team document instead of querying matches collection
        teamData.matchHistory = teamData.matchHistory || [];

        // Use pre-computed statistics from team document instead of calculating at runtime
        teamData.statistics = teamData.statistics || {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winPercentage: 0,
          currentStreak: { type: 'none', count: 0 },
          longestWinStreak: 0,
          longestLossStreak: 0,
          recentMatches: [],
          form: []
        };

        // Ensure statistics and bestPlayers are included (with defaults if not set)
        teamData.statistics = teamData.statistics || {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winPercentage: 0
        };
        
        teamData.bestPlayers = teamData.bestPlayers || {
          batsman: null,
          bowler: null,
          allRounder: null,
          wicketKeeper: null
        };
        
        teams.push(teamData);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: teams,
          pagination: {
            page: page,
            limit: limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNext: page * limit < totalCount,
            hasPrev: page > 1
          }
        }),
      };
    }

    // GET /api/teams/:numericId - Get team by numericId
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1); // Remove leading slash
      const teamDoc = await findDocumentByNumericId(collections.teams, numericId);

      if (!teamDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team not found' }),
        };
      }

      const teamData = {
        id: teamDoc.id,
        numericId: teamDoc.data().numericId,
        displayId: teamDoc.data().numericId || teamDoc.id,
        ...teamDoc.data()
      };
      
      // Fetch captain details if captainId exists
      if (teamData.captainId) {
        try {
          const captainDoc = await collections.players.doc(teamData.captainId).get();
          if (captainDoc.exists) {
            teamData.captain = {
              id: captainDoc.id,
              name: captainDoc.data().name,
              role: captainDoc.data().role
            };
          }
        } catch (error) {
          console.error(`Error fetching captain ${teamData.captainId}:`, error);
          teamData.captain = null;
        }
      } else {
        teamData.captain = null;
      }

      // Fetch player details if playerIds exist
      if (teamData.playerIds && teamData.playerIds.length > 0) {
        try {
          const playerPromises = teamData.playerIds.map(playerId => 
            collections.players.doc(playerId).get()
          );
          const playerDocs = await Promise.all(playerPromises);
          
          teamData.players = playerDocs
            .filter(doc => doc.exists)
            .map(doc => ({
              id: doc.id,
              numericId: doc.data().numericId,
              name: doc.data().name,
              role: doc.data().role,
              battingStyle: doc.data().battingStyle,
              bowlingStyle: doc.data().bowlingStyle,
              matchesPlayed: doc.data().matchesPlayed || 0,
              totalRuns: doc.data().totalRuns || 0,
              totalWickets: doc.data().totalWickets || 0,
              battingAverage: doc.data().battingAverage || 0,
              bowlingAverage: doc.data().bowlingAverage || 0
            }));
          
          teamData.playersCount = teamData.players.length;
        } catch (error) {
          console.error(`Error fetching players for team ${teamDoc.id}:`, error);
          teamData.players = [];
          teamData.playersCount = 0;
        }
      } else {
        teamData.players = [];
        teamData.playersCount = teamData.playersCount || 0;
      }

      // Fetch match history for this team
      try {
        // Query all matches and filter in code (more reliable than nested queries)
        const matchesSnapshot = await collections.matches
          .orderBy('scheduledDate', 'desc')
          .get();
        
        teamData.matchHistory = [];
        for (const matchDoc of matchesSnapshot.docs) {
          const matchData = matchDoc.data();
          
          // Check if this team is team1 or team2 (by document ID)
          const isTeam1 = matchData.team1 === teamDoc.id || matchData.team1Id === teamDoc.id;
          const isTeam2 = matchData.team2 === teamDoc.id || matchData.team2Id === teamDoc.id;
          
          if (isTeam1 || isTeam2) {
            // Get opponent info
            let opponent = null;
            if (isTeam1 && matchData.team2Id) {
              // team2Id contains the opponent document ID
              try {
                const opponentDoc = await collections.teams.doc(matchData.team2Id).get();
                if (opponentDoc.exists) {
                  const opponentData = opponentDoc.data();
                  opponent = {
                    id: opponentDoc.id,
                    name: opponentData.name,
                    shortName: opponentData.shortName,
                    numericId: opponentData.numericId
                  };
                }
              } catch (error) {
                console.warn(`Failed to get opponent team ${matchData.team2Id}:`, error);
              }
            } else if (isTeam2 && matchData.team1Id) {
              // team1Id contains the opponent document ID
              try {
                const opponentDoc = await collections.teams.doc(matchData.team1Id).get();
                if (opponentDoc.exists) {
                  const opponentData = opponentDoc.data();
                  opponent = {
                    id: opponentDoc.id,
                    name: opponentData.name,
                    shortName: opponentData.shortName,
                    numericId: opponentData.numericId
                  };
                }
              } catch (error) {
                console.warn(`Failed to get opponent team ${matchData.team1Id}:`, error);
              }
            }
            
            teamData.matchHistory.push({
              id: matchDoc.id,
              numericId: matchData.numericId,
              displayId: matchData.numericId || matchDoc.id,
              title: matchData.title,
              status: matchData.status,
              scheduledDate: matchData.scheduledDate,
              venue: matchData.venue,
              opponent: opponent,
              winner: matchData.winner,
              result: matchData.result,
              team1Score: matchData.team1Score,
              team2Score: matchData.team2Score
            });
          }
        }
        
        // Sort matches by date (most recent first) - already sorted by query
        
        // Calculate team statistics from match history
        const completedMatches = teamData.matchHistory.filter(match => match.status === 'completed');
        const wins = completedMatches.filter(match => match.result?.winner === teamData.name).length;
        const losses = completedMatches.filter(match => match.result?.winner && match.result.winner !== teamData.name).length;
        const draws = completedMatches.filter(match => !match.result?.winner).length;
        
        teamData.statistics = {
          totalMatches: completedMatches.length,
          wins: wins,
          losses: losses,
          draws: draws,
          winPercentage: completedMatches.length > 0 ? (wins / completedMatches.length) * 100 : 0
        };
        
      } catch (error) {
        console.error(`Error fetching match history for team ${teamDoc.id}:`, error);
        teamData.matchHistory = [];
      }

      // Ensure statistics and bestPlayers are included (with defaults if not set)
      teamData.statistics = teamData.statistics || {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winPercentage: 0
      };
      
      teamData.bestPlayers = teamData.bestPlayers || {
        batsman: null,
        bowler: null,
        allRounder: null,
        wicketKeeper: null
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          data: teamData 
        }),
      };
    }

    // POST /api/teams - Create new team
    if (method === 'POST' && path === '/') {
      const teamData = JSON.parse(body);
      
      // Validate required fields
      if (!teamData.name) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team name is required' }),
        };
      }

      // Generate numeric ID for the team
      const numericId = await sequenceManager.getNextId('teams');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('teams');

      const docRef = await collections.teams.doc(documentId).set({
        numericId: numericId,
        name: teamData.name,
        shortName: teamData.shortName || teamData.name.substring(0, 3).toUpperCase(),
        captainId: teamData.captainId || null,
        playerIds: teamData.playerIds || [],
        logo: teamData.logo || null,
        homeGround: teamData.homeGround || null,
        foundedYear: teamData.foundedYear || null,
        // Team statistics
        statistics: {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winPercentage: 0
        },
        // Best players data
        bestPlayers: {
          batsman: null,
          bowler: null,
          allRounder: null,
          wicketKeeper: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const newTeam = await collections.teams.doc(documentId).get();
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ 
          data: {
            id: newTeam.id,
            ...newTeam.data()
          }
        }),
      };
    }

    // PUT /api/teams/:id - Update team
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const teamId = path.substring(1); // Remove leading slash
      const updateData = JSON.parse(body);
      
      // Check if team exists
      const teamDoc = await collections.teams.doc(teamId).get();
      if (!teamDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team not found' }),
        };
      }

      // Update team
      await collections.teams.doc(teamId).update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      // Get updated team
      const updatedTeam = await collections.teams.doc(teamId).get();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          data: {
            id: updatedTeam.id,
            ...updatedTeam.data()
          }
        }),
      };
    }

    // DELETE /api/teams/:id - Delete team
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const teamId = path.substring(1); // Remove leading slash
      
      // Check if team exists
      const teamDoc = await collections.teams.doc(teamId).get();
      if (!teamDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team not found' }),
        };
      }

      // Delete team
      await collections.teams.doc(teamId).delete();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Team deleted successfully',
          teamId: teamId
        }),
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Route not found',
        method: method,
        path: path,
        originalPath: originalPath
      }),
    };

  } catch (error) {
    console.error('Teams API Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      }),
    };
  }
};