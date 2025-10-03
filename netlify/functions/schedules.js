const https = require('https');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    const path = event.path.replace('/.netlify/functions/schedules', '');
    const method = event.httpMethod;

    // GET /api/schedules - Get cricket schedule from external API
    if (method === 'GET' && (!path || path === '/')) {
      const RAPIDAPI_BASE_URL = 'https://cricket-api-free-data.p.rapidapi.com';
      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
      const RAPIDAPI_HOST = 'cricket-api-free-data.p.rapidapi.com';

      try {
        console.log('🔄 Fetching cricket schedule from RapidAPI...');

        const response = await makeHttpsRequest(`${RAPIDAPI_BASE_URL}/cricket-schedule`, {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST
        });

        console.log('📅 Schedule API Response Status:', response.status);

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        console.log('📅 Schedule API Raw Response:', data);

        // Format the schedule data
        const formattedSchedules = formatScheduleData(data);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: formattedSchedules,
            totalMatches: formattedSchedules.length,
            source: 'external-api'
          })
        };

      } catch (externalError) {
        console.error('❌ External schedule API failed:', externalError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Failed to fetch cricket schedule',
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
    console.error('Schedules API Error:', error);
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

/**
 * Format schedule data from external API response
 * @param {Object} data - Raw API response from RapidAPI
 * @returns {Array} Formatted schedules array
 */
function formatScheduleData(data) {
  console.log('🔄 Formatting external schedule data...');

  // Handle the specific API structure
  let allSchedules = [];

  if (data && data.status === 'success' && data.response && Array.isArray(data.response)) {
    // Extract all matches from all series
    data.response.forEach(series => {
      if (series.matchList && Array.isArray(series.matchList)) {
        series.matchList.forEach(match => {
          allSchedules.push({
            ...match,
            seriesName: series.seriesName || match.seriesName
          });
        });
      }
    });
  } else {
    console.warn('⚠️ Unexpected external schedule API response structure:', data);
    return [];
  }

  console.log(`📊 Found ${allSchedules.length} external schedule matches to format`);

  return allSchedules.map((match, index) => {
    console.log(`  External Schedule Match ${index + 1}:`, match.matchTitle);

    return {
      matchId: match.matchId || `schedule_${index}`,
      seriesId: match.seriesId,
      seriesName: match.seriesName || 'Unknown Series',
      matchTitle: match.matchTitle || 'Unknown Match',
      matchFormat: match.matchFormat?.trim() || 'T20',
      matchVenue: match.matchVenue || 'Unknown Venue',
      matchDate: match.matchDate || new Date().toLocaleDateString(),
      matchTime: match.matchTime?.trim() || 'TBD',
      matchStatus: match.matchStatus || 'Upcoming',
      teamOne: {
        name: match.teamOne?.name || 'Team 1'
      },
      teamTwo: {
        name: match.teamTwo?.name || 'Team 2'
      }
    };
  });
}