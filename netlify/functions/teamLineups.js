const { collections } = require('../../config/database');
const { sequenceManager } = require('../../utils/sequenceManager');

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://ebcl-app.github.io',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  const { httpMethod: method, path: originalPath, body } = event;
  
  // Extract path from the event (handle both direct function calls and redirected API calls)
  let path = originalPath;
  if (path && path.includes('/teamLineups')) {
    // Extract everything after /teamLineups
    const lineupsIndex = path.indexOf('/teamLineups');
    path = path.substring(lineupsIndex + 12); // 12 is length of '/teamLineups'
    if (!path) path = '/';
  }

  console.log('TeamLineups Function - Method:', method, 'Original Path:', originalPath, 'Processed Path:', path);

  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {

    // GET /api/teamLineups - Get all team lineups
    if (method === 'GET' && path === '/') {
      const snapshot = await collections.teamLineups.orderBy('createdAt', 'desc').get();

      const lineups = [];
      for (const doc of snapshot.docs) {
        const lineupData = {
          id: doc.id,
          numericId: doc.data().numericId,
          displayId: doc.data().numericId || doc.id,
          ...doc.data()
        };
        
        // Fetch team details
        if (lineupData.teamId) {
          try {
            const teamDoc = await collections.teams.doc(lineupData.teamId).get();
            if (teamDoc.exists) {
              lineupData.team = {
                id: teamDoc.id,
                ...teamDoc.data()
              };
            }
          } catch (error) {
            console.error(`Error fetching team ${lineupData.teamId}:`, error);
            lineupData.team = null;
          }
        }
        
        // Fetch all player details
        if (lineupData.playerIds && Array.isArray(lineupData.playerIds)) {
          const playersWithDetails = [];
          for (const playerId of lineupData.playerIds) {
            try {
              const playerDoc = await collections.players.doc(playerId).get();
              if (playerDoc.exists) {
                playersWithDetails.push({
                  id: playerDoc.id,
                  ...playerDoc.data()
                });
              }
            } catch (error) {
              console.error(`Error fetching player ${playerId}:`, error);
            }
          }
          lineupData.playersDetails = playersWithDetails;
        }
        
        // Fetch playing XI details
        if (lineupData.playingXI && Array.isArray(lineupData.playingXI)) {
          const playingXIDetails = [];
          for (const playerId of lineupData.playingXI) {
            try {
              const playerDoc = await collections.players.doc(playerId).get();
              if (playerDoc.exists) {
                playingXIDetails.push({
                  id: playerDoc.id,
                  ...playerDoc.data()
                });
              }
            } catch (error) {
              console.error(`Error fetching playing XI player ${playerId}:`, error);
            }
          }
          lineupData.playingXIDetails = playingXIDetails;
        }
        
        // Fetch captain details
        if (lineupData.captain) {
          try {
            const captainDoc = await collections.players.doc(lineupData.captain).get();
            if (captainDoc.exists) {
              lineupData.captainDetails = {
                id: captainDoc.id,
                ...captainDoc.data()
              };
            }
          } catch (error) {
            console.error(`Error fetching captain ${lineupData.captain}:`, error);
            lineupData.captainDetails = null;
          }
        }
        
        // Fetch wicketkeeper details
        if (lineupData.wicketKeeper) {
          try {
            const wicketkeeperDoc = await collections.players.doc(lineupData.wicketKeeper).get();
            if (wicketkeeperDoc.exists) {
              lineupData.wicketkeeperDetails = {
                id: wicketkeeperDoc.id,
                ...wicketkeeperDoc.data()
              };
            }
          } catch (error) {
            console.error(`Error fetching wicketkeeper ${lineupData.wicketKeeper}:`, error);
            lineupData.wicketkeeperDetails = null;
          }
        }
        
        lineups.push(lineupData);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: lineups
        })
      };
    }

    // GET /api/teamLineups/:id - Get team lineup by ID
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const lineupId = path.substring(1);
      const numericId = parseInt(lineupId);

      if (isNaN(numericId)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Invalid lineup ID format. Expected numeric ID.'
          })
        };
      }

      // Find document by numericId
      const lineupQuery = await collections.teamLineups.where('numericId', '==', numericId).get();

      if (lineupQuery.empty) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Team lineup not found'
          })
        };
      }

      const lineupDoc = lineupQuery.docs[0];
      const lineupData = {
        id: lineupDoc.id,
        numericId: lineupDoc.data().numericId,
        displayId: lineupDoc.data().numericId || lineupDoc.id,
        ...lineupDoc.data()
      };
      
      // Fetch team details
      if (lineupData.teamId) {
        try {
          const teamDoc = await collections.teams.doc(lineupData.teamId).get();
          if (teamDoc.exists) {
            lineupData.team = {
              id: teamDoc.id,
              ...teamDoc.data()
            };
          }
        } catch (error) {
          console.error(`Error fetching team ${lineupData.teamId}:`, error);
          lineupData.team = null;
        }
      }
      
      // Fetch all player details
      if (lineupData.playerIds && Array.isArray(lineupData.playerIds)) {
        const playersWithDetails = [];
        for (const playerId of lineupData.playerIds) {
          try {
            const playerDoc = await collections.players.doc(playerId).get();
            if (playerDoc.exists) {
              playersWithDetails.push({
                id: playerDoc.id,
                ...playerDoc.data()
              });
            }
          } catch (error) {
            console.error(`Error fetching player ${playerId}:`, error);
          }
        }
        lineupData.playersDetails = playersWithDetails;
      }
      
      // Fetch playing XI details
      if (lineupData.playingXI && Array.isArray(lineupData.playingXI)) {
        const playingXIDetails = [];
        for (const playerId of lineupData.playingXI) {
          try {
            const playerDoc = await collections.players.doc(playerId).get();
            if (playerDoc.exists) {
              playingXIDetails.push({
                id: playerDoc.id,
                ...playerDoc.data()
              });
            }
          } catch (error) {
            console.error(`Error fetching playing XI player ${playerId}:`, error);
          }
        }
        lineupData.playingXIDetails = playingXIDetails;
      }
      
      // Fetch captain details
      if (lineupData.captain) {
        try {
          const captainDoc = await collections.players.doc(lineupData.captain).get();
          if (captainDoc.exists) {
            lineupData.captainDetails = {
              id: captainDoc.id,
              ...captainDoc.data()
            };
          }
        } catch (error) {
          console.error(`Error fetching captain ${lineupData.captain}:`, error);
          lineupData.captainDetails = null;
        }
      }
      
      // Fetch wicketkeeper details
      if (lineupData.wicketKeeper) {
        try {
          const wicketkeeperDoc = await collections.players.doc(lineupData.wicketKeeper).get();
          if (wicketkeeperDoc.exists) {
            lineupData.wicketkeeperDetails = {
              id: wicketkeeperDoc.id,
              ...wicketkeeperDoc.data()
            };
          }
        } catch (error) {
          console.error(`Error fetching wicketkeeper ${lineupData.wicketkeeperId}:`, error);
          lineupData.wicketkeeperDetails = null;
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: lineupData
        })
      };
    }

    // POST /api/teamLineups - Create new team lineup
    if (method === 'POST' && (!path || path === '/')) {
      const lineupData = JSON.parse(event.body);

      // Validate required fields
      if (!lineupData.teamId || !lineupData.teamName || !lineupData.playerIds) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields: teamId, teamName, playerIds'
          })
        };
      }

      // Generate numeric ID for the team lineup
      const numericId = await sequenceManager.getNextId('teamLineups');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('teamLineups');

      // Add timestamps and numeric ID
      const timestamp = new Date().toISOString();
      const lineup = {
        ...lineupData,
        numericId: numericId,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await collections.teamLineups.doc(documentId).set(lineup);
      const createdLineup = { id: documentId, ...lineup };

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: createdLineup
        })
      };
    }

    // PUT /api/teamLineups/:id - Update team lineup
    if (method === 'PUT' && path.match(/^\/[^\/]+$/)) {
      const lineupId = path.substring(1);
      const numericId = parseInt(lineupId);

      if (isNaN(numericId)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Invalid lineup ID format. Expected numeric ID.'
          })
        };
      }

      const updateData = JSON.parse(event.body);

      // Find document by numericId
      const lineupQuery = await collections.teamLineups.where('numericId', '==', numericId).get();
      if (lineupQuery.empty) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Team lineup not found'
          })
        };
      }

      const lineupDoc = lineupQuery.docs[0];
      const documentId = lineupDoc.id;

      // Update with timestamp
      const updatedData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await collections.teamLineups.doc(documentId).update(updatedData);
      const updatedDoc = await collections.teamLineups.doc(documentId).get();
      const updatedLineup = { id: updatedDoc.id, ...updatedDoc.data() };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: updatedLineup
        })
      };
    }

    // DELETE /api/teamLineups/:id - Delete team lineup
    if (method === 'DELETE' && path.match(/^\/[^\/]+$/)) {
      const lineupId = path.substring(1);
      const numericId = parseInt(lineupId);

      if (isNaN(numericId)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Invalid lineup ID format. Expected numeric ID.'
          })
        };
      }

      // Find document by numericId
      const lineupQuery = await collections.teamLineups.where('numericId', '==', numericId).get();
      if (lineupQuery.empty) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Team lineup not found'
          })
        };
      }

      const lineupDoc = lineupQuery.docs[0];
      const documentId = lineupDoc.id;

      await collections.teamLineups.doc(documentId).delete();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Team lineup deleted successfully'
        })
      };
    }

    // GET /api/teamLineups/team/:teamId - Get lineups by team ID
    if (method === 'GET' && path.match(/^\/team\/[^\/]+$/)) {
      const teamId = path.substring(6); // Remove '/team/'
      const snapshot = await collections.teamLineups
        .where('teamId', '==', teamId)
        .orderBy('createdAt', 'desc')
        .get();

      const lineups = [];
      snapshot.forEach(doc => {
        lineups.push({ id: doc.id, ...doc.data() });
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: lineups
        })
      };
    }

    // GET /api/teamLineups/match/:matchId - Get lineups by match ID
    if (method === 'GET' && path.match(/^\/match\/[^\/]+$/)) {
      const matchId = path.substring(7); // Remove '/match/'
      console.log('Getting lineups for matchId:', matchId);

      try {
        const snapshot = await collections.teamLineups
          .where('matchId', '==', matchId)
          .get();

        const lineups = [];
        snapshot.forEach(doc => {
          lineups.push({ id: doc.id, ...doc.data() });
        });

        // Sort by createdAt in descending order (most recent first)
        lineups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Found lineups:', lineups.length);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: lineups
          })
        };
      } catch (error) {
        console.error('Error querying lineups by matchId:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Error querying team lineups',
            error: error.message
          })
        };
      }
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Route not found'
      })
    };

  } catch (error) {
    console.error('Team Lineups API Error:', error);
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