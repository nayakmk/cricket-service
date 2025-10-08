const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
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

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check for session cookie
    const cookies = event.headers.cookie || '';
    const sessionCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('admin_session='));

    if (!sessionCookie) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Not authenticated' }),
      };
    }

    // Simple session validation (in production, validate against database/session store)
    const sessionToken = sessionCookie.split('=')[1];
    if (!sessionToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid session' }),
      };
    }

    // Decode session token (basic implementation)
    try {
      const decoded = Buffer.from(sessionToken, 'base64').toString();
      const [username] = decoded.split(':');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: '1',
          username: username,
          role: 'admin',
        }),
      };
    } catch (decodeError) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid session token' }),
      };
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};