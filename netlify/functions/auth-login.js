const adminCredentials = {
  username: 'admin',
  password: 'cricket123' // In production, use proper password hashing
};

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    // Simple credential check (in production, use proper authentication)
    if (username === adminCredentials.username && password === adminCredentials.password) {
      // Create a simple session token (in production, use JWT or proper session management)
      const sessionToken = Buffer.from(`${username}:${Date.now()}`).toString('base64');

      return {
        statusCode: 200,
        headers: {
          'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/; Max-Age=86400`, // 24 hours
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: '1',
          username: username,
          role: 'admin',
        }),
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};