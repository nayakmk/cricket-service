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
  if (path && path.includes('/teams-v2')) {
    // Extract everything after /teams-v2
    const teamsIndex = path.indexOf('/teams-v2');
    path = path.substring(teamsIndex + 9); // 9 is length of '/teams-v2'
    if (!path) path = '/';
  }

  console.log('Teams V2 Function - Method:', method, 'Original Path:', originalPath, 'Processed Path:', path);

  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // GET /api/v2/teams - Get all teams with pagination
    if ((method === 'GET' || method === 'HEAD') && path === '/') {
      // Parse pagination parameters
      const page = parseInt(queryStringParameters?.page) || 1;
      const limit = parseInt(queryStringParameters?.limit) || 1000;
      const offset = (page - 1) * limit;
      const orderBy = queryStringParameters?.orderBy || 'displayId';
      const orderDirection = queryStringParameters?.orderDirection || 'asc';

      // Get total count for pagination metadata
      const totalSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
      const totalCount = totalSnapshot.size;

      // Apply ordering
      const validOrderFields = ['displayId', 'name', 'createdAt', 'updatedAt'];
      const validDirections = ['asc', 'desc'];

      let query = db.collection(V2_COLLECTIONS.TEAMS);
      if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection)) {
        query = query.orderBy(orderBy, orderDirection);
      } else {
        // Default ordering by displayId ascending
        query = query.orderBy('displayId', 'asc');
      }

      // Get paginated teams
      const teamsSnapshot = await query
        .limit(limit)
        .offset(offset)
        .get();

      const teams = [];

      for (const doc of teamsSnapshot.docs) {
        const teamData = {
          id: doc.data().displayId,
          displayId: doc.data().displayId,
          ...doc.data()
        };

        // Fetch captain details if captainId exists
        if (teamData.captainId) {
          try {
            const captainDoc = await db.collection(V2_COLLECTIONS.PLAYERS).doc(teamData.captainId).get();
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

        // Fetch vice captain details if viceCaptainId exists
        if (teamData.viceCaptainId) {
          try {
            const viceCaptainDoc = await db.collection(V2_COLLECTIONS.PLAYERS).doc(teamData.viceCaptainId).get();
            if (viceCaptainDoc.exists) {
              teamData.viceCaptain = {
                id: viceCaptainDoc.id,
                name: viceCaptainDoc.data().name,
                role: viceCaptainDoc.data().role
              };
            }
          } catch (error) {
            console.error(`Error fetching vice captain ${teamData.viceCaptainId}:`, error);
            teamData.viceCaptain = null;
          }
        } else {
          teamData.viceCaptain = null;
        }

        teams.push(teamData);
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
          data: teams,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }),
      };
    }

    // GET /api/v2/teams/{id} - Get specific team by displayId
    if (method === 'GET' && path.match(/^\/\d+$/)) {
      const displayId = path.substring(1);
      const teamDoc = await findDocumentByDisplayId(V2_COLLECTIONS.TEAMS, displayId);

      if (!teamDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Team not found'
          }),
        };
      }

      const teamData = {
        id: teamDoc.data().displayId,
        displayId: teamDoc.data().displayId,
        ...teamDoc.data()
      };

      // Fetch captain details
      if (teamData.captainId) {
        try {
          const captainDoc = await db.collection(V2_COLLECTIONS.PLAYERS).doc(teamData.captainId).get();
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
      }

      // Fetch vice captain details
      if (teamData.viceCaptainId) {
        try {
          const viceCaptainDoc = await db.collection(V2_COLLECTIONS.PLAYERS).doc(teamData.viceCaptainId).get();
          if (viceCaptainDoc.exists) {
            teamData.viceCaptain = {
              id: viceCaptainDoc.id,
              name: viceCaptainDoc.data().name,
              role: viceCaptainDoc.data().role
            };
          }
        } catch (error) {
          console.error(`Error fetching vice captain ${teamData.viceCaptainId}:`, error);
          teamData.viceCaptain = null;
        }
      }

      // Get recent matches for this team
      try {
        const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES)
          .where('team1Id', '==', teamDoc.id)
          .get();

        const matchesSnapshot2 = await db.collection(V2_COLLECTIONS.MATCHES)
          .where('team2Id', '==', teamDoc.id)
          .get();

        const recentMatches = [];

        // Combine both queries
        const allMatches = [...matchesSnapshot.docs, ...matchesSnapshot2.docs];

        // Sort by date and take most recent 5
        allMatches.sort((a, b) => {
          const dateA = a.data().matchDate?.toDate?.() || new Date(a.data().matchDate);
          const dateB = b.data().matchDate?.toDate?.() || new Date(b.data().matchDate);
          return dateB - dateA;
        });

        for (const matchDoc of allMatches.slice(0, 5)) {
          const matchData = matchDoc.data();
          recentMatches.push({
            matchId: matchDoc.id,
            displayId: matchData.displayId,
            tournamentName: matchData.tournamentName,
            venue: matchData.venue,
            matchDate: matchData.matchDate,
            status: matchData.status,
            result: matchData.result
          });
        }

        teamData.recentMatches = recentMatches;
      } catch (error) {
        console.error('Error fetching recent matches:', error);
        teamData.recentMatches = [];
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: teamData
        }),
      };
    }

    // POST /api/v2/teams - Create new team
    if (method === 'POST' && path === '/') {
      const teamData = JSON.parse(body);

      // Validate required fields
      const validationErrors = validateData(V2_SCHEMAS.teams, teamData);
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

      const newTeam = {
        ...teamData,
        displayId,
        isActive: teamData.isActive !== undefined ? teamData.isActive : true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const docRef = await db.collection(V2_COLLECTIONS.TEAMS).add(newTeam);

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            id: displayId,
            ...newTeam,
            id: docRef.id
          },
          message: 'Team created successfully'
        }),
      };
    }

    // PUT /api/v2/teams/{id} - Update team
    if (method === 'PUT' && path.match(/^\/\d+$/)) {
      const displayId = path.substring(1);
      const updateData = JSON.parse(body);

      const teamDoc = await findDocumentByDisplayId(V2_COLLECTIONS.TEAMS, displayId);

      if (!teamDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Team not found'
          }),
        };
      }

      // Validate update data
      const validationErrors = validateData(V2_SCHEMAS.teams, { ...teamDoc.data(), ...updateData });
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

      const updatedTeam = {
        ...updateData,
        updatedAt: admin.firestore.Timestamp.now()
      };

      await teamDoc.ref.update(updatedTeam);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            id: displayId,
            ...teamDoc.data(),
            ...updatedTeam
          },
          message: 'Team updated successfully'
        }),
      };
    }

    // DELETE /api/v2/teams/{id} - Delete team
    if (method === 'DELETE' && path.match(/^\/\d+$/)) {
      const displayId = path.substring(1);
      const teamDoc = await findDocumentByDisplayId(V2_COLLECTIONS.TEAMS, displayId);

      if (!teamDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Team not found'
          }),
        };
      }

      await teamDoc.ref.delete();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Team deleted successfully'
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
    console.error('Teams V2 API Error:', error);
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