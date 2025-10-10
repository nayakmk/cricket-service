const { db, V2_COLLECTIONS, V2_SCHEMAS } = require('../../config/database-v2');
const { sequenceManager } = require('../../utils/sequenceManager');

// Helper function to find document by displayId in v2 collections
async function findDocumentByDisplayId(collection, displayId) {
  const snapshot = await db.collection(collection).where('displayId', '==', parseInt(displayId, 10)).get();

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
  let path = originalPath;
  if (path && path.includes('/players-v2')) {
    // Extract everything after /players-v2
    const playersIndex = path.indexOf('/players-v2');
    path = path.substring(playersIndex + 11); // 11 is length of '/players-v2'
    if (!path) path = '/';
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
    if ((method === 'GET' || method === 'HEAD') && path === '/') {
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
      if (isActive !== undefined) {
        query = query.where('isActive', '==', isActive === 'true');
      }

      // Get total count for pagination metadata
      const totalSnapshot = await query.get();
      const totalCount = totalSnapshot.size;

      // Apply ordering
      const validOrderFields = ['displayId', 'name', 'createdAt', 'updatedAt'];
      const validDirections = ['asc', 'desc'];

      if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection)) {
        query = query.orderBy(orderBy, orderDirection);
      } else {
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

      // Get recent matches for this player
      try {
        const statsSnapshot = await db.collection(V2_COLLECTIONS.MATCHES)
          .where('playerStats', 'array-contains', { playerId: playerDoc.id })
          .limit(5)
          .get();

        const recentMatches = [];
        for (const matchDoc of statsSnapshot.docs) {
          const matchData = matchDoc.data();
          recentMatches.push({
            matchId: matchDoc.id,
            displayId: matchData.displayId,
            tournamentName: matchData.tournamentName,
            venue: matchData.venue,
            matchDate: matchData.matchDate,
            status: matchData.status
          });
        }

        playerData.recentMatches = recentMatches;
      } catch (error) {
        console.error('Error fetching recent matches:', error);
        playerData.recentMatches = [];
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