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
    const { matchData } = JSON.parse(event.body);

    if (!matchData) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Match data is required' }),
      };
    }

    // Analyze match using GROQ service
    const analysis = await GroqService.analyzeMatch(matchData);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: analysis,
      }),
    };
  } catch (error) {
    console.error('Error in match analysis function:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to analyze match',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};