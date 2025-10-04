const { collections } = require('../../config/database');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  const { httpMethod: method, path: originalPath, body } = event;
  
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
    // GET /api/teams - Get all teams
    if (method === 'GET' && path === '/') {
      const teamsSnapshot = await collections.teams.get();
      const teams = [];
      
      for (const doc of teamsSnapshot.docs) {
        const teamData = { id: doc.id, ...doc.data() };
        
        // Fetch captain details if captainId exists
        if (teamData.captainId) {
          try {
            const captainDoc = await collections.players.doc(teamData.captainId).get();
            if (captainDoc.exists) {
              teamData.captain = {
                id: captainDoc.id,
                ...captainDoc.data()
              };
            }
          } catch (error) {
            console.error(`Error fetching captain ${teamData.captainId}:`, error);
            teamData.captain = null;
          }
        } else {
          teamData.captain = null;
        }
        
        teams.push(teamData);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ data: teams }),
      };
    }

    // GET /api/teams/:id - Get team by ID
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const teamId = path.substring(1); // Remove leading slash
      const teamDoc = await collections.teams.doc(teamId).get();
      
      if (!teamDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team not found' }),
        };
      }

      const teamData = { id: teamDoc.id, ...teamDoc.data() };
      
      // Fetch captain details if captainId exists
      if (teamData.captainId) {
        try {
          const captainDoc = await collections.players.doc(teamData.captainId).get();
          if (captainDoc.exists) {
            teamData.captain = {
              id: captainDoc.id,
              ...captainDoc.data()
            };
          }
        } catch (error) {
          console.error(`Error fetching captain ${teamData.captainId}:`, error);
          teamData.captain = null;
        }
      } else {
        teamData.captain = null;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ data: teamData }),
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

      const docRef = await collections.teams.add({
        name: teamData.name,
        captainId: teamData.captainId || null,
        logo: teamData.logo || null,
        homeGround: teamData.homeGround || null,
        foundedYear: teamData.foundedYear || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const newTeam = await docRef.get();
      
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