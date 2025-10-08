const { GroqService } = require('../../utils/groqService');

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { playerData } = JSON.parse(event.body);

    if (!playerData) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Player data is required' }),
      };
    }

    // Analyze player using GROQ service
    const analysis = await GroqService.analyzePlayer(playerData);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: analysis,
      }),
    };
  } catch (error) {
    console.error('Error in player analysis function:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to analyze player',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};