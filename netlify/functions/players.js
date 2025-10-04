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
  if (path && path.includes('/players')) {
    // Extract everything after /players
    const playersIndex = path.indexOf('/players');
    path = path.substring(playersIndex + 8); // 8 is length of '/players'
    if (!path) path = '/';
  }

  console.log('Players Function - Method:', method, 'Original Path:', originalPath, 'Processed Path:', path);

  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // GET /api/players - Get all players
    if (method === 'GET' && path === '/') {
      const playersSnapshot = await collections.players.get();
      const players = [];
      
      playersSnapshot.forEach(doc => {
        players.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ data: players }),
      };
    }

    // GET /api/players/:id - Get player by ID
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const playerId = path.substring(1); // Remove leading slash
      const playerDoc = await collections.players.doc(playerId).get();
      
      if (!playerDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          data: {
            id: playerDoc.id,
            ...playerDoc.data()
          }
        }),
      };
    }

    // POST /api/players - Create new player
    if (method === 'POST' && path === '/') {
      const playerData = JSON.parse(body);
      
      // Validate required fields
      if (!playerData.name) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player name is required' }),
        };
      }

      const docRef = await collections.players.add({
        name: playerData.name,
        age: playerData.age || null,
        role: playerData.role || 'all-rounder',
        battingStyle: playerData.battingStyle || null,
        bowlingStyle: playerData.bowlingStyle || null,
        nationality: playerData.nationality || null,
        avatar: playerData.avatar || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const newPlayer = await docRef.get();
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ 
          data: {
            id: newPlayer.id,
            ...newPlayer.data()
          }
        }),
      };
    }

    // PUT /api/players/:id - Update player
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const playerId = path.substring(1); // Remove leading slash
      const updateData = JSON.parse(body);
      
      // Check if player exists
      const playerDoc = await collections.players.doc(playerId).get();
      if (!playerDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player not found' }),
        };
      }

      // Update player
      await collections.players.doc(playerId).update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      // Get updated player
      const updatedPlayer = await collections.players.doc(playerId).get();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          data: {
            id: updatedPlayer.id,
            ...updatedPlayer.data()
          }
        }),
      };
    }

    // DELETE /api/players/:id - Delete player (soft delete)
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const playerId = path.substring(1); // Remove leading slash
      
      // Check if player exists
      const playerDoc = await collections.players.doc(playerId).get();
      if (!playerDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player not found' }),
        };
      }

      // Soft delete player
      await collections.players.doc(playerId).update({
        isActive: false,
        updatedAt: new Date().toISOString()
      });
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Player deactivated successfully',
          playerId: playerId
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
    console.error('Players API Error:', error);
    
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