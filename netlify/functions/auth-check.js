exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
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
        body: JSON.stringify({
          id: '1',
          username: username,
          role: 'admin',
        }),
      };
    } catch (decodeError) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid session token' }),
      };
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};