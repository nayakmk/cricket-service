const https = require('https');

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://ebcl-app.github.io',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Make an HTTPS GET request
 * @param {string} url - The URL to request
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} Response data
 */
function makeHttpsRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/news', '');
    const method = event.httpMethod;

    // GET /api/news - Get cricket news from external API
    if (method === 'GET' && (!path || path === '/')) {
      const NEWS_API_BASE_URL = 'https://newsdata.io/api/1/latest';
      const API_KEY = process.env.NEWS_API_KEY;

      // Get limit from query parameters, default to 10
      const queryParams = event.queryStringParameters || {};
      const limit = parseInt(queryParams.limit) || 10;

      try {
        console.log('🔄 Fetching cricket news from newsdata.io...');

        const params = new URLSearchParams({
          apikey: API_KEY,
          q: 'Cricket,News,English,India',
          category: 'sports',
          language: 'en',
          country: 'in',
          size: limit.toString()
        });

        const response = await makeHttpsRequest(`${NEWS_API_BASE_URL}?${params}`);

        console.log('📰 News API Response Status:', response.status);

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;

        if (data.status !== 'success') {
          throw new Error(data.message || 'News API request failed');
        }

        console.log('📰 News API Raw Response:', data);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: data.results || [],
            totalResults: data.totalResults || 0,
            source: 'external-api'
          })
        };

      } catch (externalError) {
        console.error('❌ External news API failed:', externalError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Failed to fetch cricket news',
            error: externalError.message
          })
        };
      }
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      })
    };

  } catch (error) {
    console.error('News API Error:', error);
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