const https = require('https');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
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
      headers: {
        'User-Agent': 'Node.js',
        ...headers
      }
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
  console.log('=== EXTERNAL FUNCTION CALLED ===');
  console.log('Full event object:', JSON.stringify(event, null, 2));
  console.log('Event path:', event.path);
  console.log('Event rawPath:', event.rawPath);
  console.log('Event rawQueryString:', event.rawQueryString);
  console.log('Event headers:', JSON.stringify(event.headers, null, 2));

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Use rawPath if available (original request path), otherwise fall back to path
    const originalPath = event.rawPath || event.path;
    const path = originalPath.replace('/api/external', '').replace(/\/$/, '');
    console.log('Original path:', originalPath);
    console.log('Parsed path after replacement:', path);
    const method = event.httpMethod;

    // GET /api/external/live-scores - Get live cricket scores from external API
    if (method === 'GET' && path === '/live-scores') {
      const RAPIDAPI_BASE_URL = 'https://cricket-api-free-data.p.rapidapi.com';
      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

      console.log('🔄 RAPIDAPI_KEY available:', !!RAPIDAPI_KEY);

      try {
        console.log('🔄 Fetching external live scores from RapidAPI...');
        const response = await makeHttpsRequest(`${RAPIDAPI_BASE_URL}/cricket-livescores`, {
          'X-RapidAPI-Key': RAPIDAPI_KEY
        });

        console.log('📊 External Live Scores Response Status:', response.status);
        console.log('📊 External Live Scores Response Data:', JSON.stringify(response.data).substring(0, 500));

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        console.log('📊 External Live Scores Raw API Response:', data);

        // Format the data similar to how the UI service does it
        const formattedMatches = formatLiveScoresData(data);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: formattedMatches,
            totalMatches: formattedMatches.length,
            source: 'external-api'
          })
        };

      } catch (externalError) {
        console.error('❌ External live scores API failed:', externalError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Failed to fetch external live scores',
            error: externalError.message
          })
        };
      }
    }

    // GET /api/external/schedules - Get cricket schedules from external API
    if (method === 'GET' && path === '/schedules') {
      const RAPIDAPI_BASE_URL = 'https://cricket-api-free-data.p.rapidapi.com';
      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
      const RAPIDAPI_HOST = 'cricket-api-free-data.p.rapidapi.com';

      console.log('🔄 RAPIDAPI_KEY available:', !!RAPIDAPI_KEY);

      try {
        console.log('🔄 Fetching cricket schedule from RapidAPI...');
        const response = await makeHttpsRequest(`${RAPIDAPI_BASE_URL}/cricket-schedule`, {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST
        });

        console.log('📅 External Schedules Response Status:', response.status);
        console.log('📅 External Schedules Response Data:', JSON.stringify(response.data).substring(0, 500));

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        console.log('📅 External Schedules Raw API Response:', data);

        // Format the schedule data
        const formattedSchedules = formatSchedulesData(data);

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
        console.error('❌ External schedules API failed:', externalError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Failed to fetch external schedules',
            error: externalError.message
          })
        };
      }
    }

    // GET /api/external/news - Get cricket news from external API
    if (method === 'GET' && path === '/news') {
      const API_KEY = process.env.NEWS_API_KEY;
      const NEWS_API_BASE_URL = 'https://newsdata.io/api/1';

      console.log('📰 NEWS_API_KEY available:', !!API_KEY);

      try {
        console.log('📰 Fetching cricket news from Newsdata.io...');
        const response = await makeHttpsRequest(`${NEWS_API_BASE_URL}/latest?apikey=${API_KEY}&q=Cricket,News,English,India&category=sports&language=en&country=in&size=10`);

        console.log('📰 External News Response Status:', response.status);
        console.log('📰 External News Response Data:', JSON.stringify(response.data).substring(0, 500));

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        console.log('📰 External News Raw API Response:', data);

        // Format the news data
        const formattedNews = formatNewsData(data);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: formattedNews,
            totalArticles: formattedNews.length,
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
            message: 'Failed to fetch external news',
            error: externalError.message
          })
        };
      }
    }

    console.log('No matching endpoint found for path:', path);
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'External API endpoint not found. Available endpoints: /live-scores, /schedules, /news',
        path: path
      })
    };

  } catch (error) {
    console.error('Function error:', error);
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
 * Format live scores data from external API response
 * @param {Object} data - Raw API response from RapidAPI
 * @returns {Array} Formatted matches array
 */
function formatLiveScoresData(data) {
  console.log('🔄 Formatting external live scores data...');

  // Handle the specific API structure: { status: "success", response: [...] }
  let allMatches = [];

  if (data && data.status === 'success' && data.response && Array.isArray(data.response)) {
    // Extract all matches from all series
    data.response.forEach(series => {
      if (series.matchList && Array.isArray(series.matchList)) {
        series.matchList.forEach(match => {
          allMatches.push({
            ...match,
            seriesName: series.seriesName || match.seriesName
          });
        });
      }
    });
  } else {
    console.warn('⚠️ Unexpected external API response structure:', data);
    return [];
  }

  console.log(`📊 Found ${allMatches.length} external live matches to format`);

  return allMatches.map((match, index) => {
    console.log(`  External Match ${index + 1}:`, match.matchTitle);

    return {
      matchId: match.matchId || `match_${index}`,
      seriesId: match.seriesId,
      seriesName: match.seriesName || 'Unknown Series',
      matchTitle: match.matchTitle || 'Unknown Match',
      matchTime: match.matchTime,
      matchDate: match.matchDate,
      venue: match.venue || 'Unknown Venue',
      status: match.status || 'Unknown',
      team1: {
        name: match.team1?.name || 'Team 1',
        shortName: match.team1?.shortName || 'T1',
        logo: match.team1?.logo
      },
      team2: {
        name: match.team2?.name || 'Team 2',
        shortName: match.team2?.shortName || 'T2',
        logo: match.team2?.logo
      },
      score: match.score || null,
      result: match.result || null
    };
  });
}

/**
 * Format schedules data from external API response
 * @param {Object} data - Raw API response from RapidAPI
 * @returns {Array} Formatted schedules array
 */
function formatSchedulesData(data) {
  console.log('📅 Formatting external schedules data...');

  let allMatches = [];

  if (data && data.status === 'success' && data.response && Array.isArray(data.response)) {
    // Extract all matches from all series
    data.response.forEach(series => {
      if (series.matchList && Array.isArray(series.matchList)) {
        series.matchList.forEach(match => {
          allMatches.push({
            ...match,
            seriesName: series.seriesName || match.seriesName
          });
        });
      }
    });
  } else {
    console.warn('⚠️ Unexpected external API response structure:', data);
    return [];
  }

  console.log(`📅 Found ${allMatches.length} external scheduled matches to format`);

  return allMatches.map((match, index) => {
    console.log(`  External Schedule Match ${index + 1}:`, match.matchTitle);

    // Determine match status based on date/time
    let status = 'Upcoming';
    if (match.matchDate && match.matchTime) {
      try {
        const matchDateTime = new Date(`${match.matchDate} ${match.matchTime}`);
        const now = new Date();
        if (matchDateTime < now) {
          status = 'Completed';
        }
      } catch (e) {
        // If date parsing fails, keep as Upcoming
        console.log(`⚠️ Could not parse date/time for match ${match.matchTitle}: ${match.matchDate} ${match.matchTime}`);
      }
    }

    return {
      matchId: match.matchId || `match_${index}`,
      seriesId: match.seriesId,
      seriesName: match.seriesName || 'Unknown Series',
      matchTitle: match.matchTitle || 'Unknown Match',
      matchTime: match.matchTime,
      matchDate: match.matchDate,
      venue: match.venue || 'Unknown Venue',
      status: status,
      team1: {
        name: match.team1?.name || 'Team 1',
        shortName: match.team1?.shortName || 'T1',
        logo: match.team1?.logo
      },
      team2: {
        name: match.team2?.name || 'Team 2',
        shortName: match.team2?.shortName || 'T2',
        logo: match.team2?.logo
      }
    };
  });
}

/**
 * Format news data from external API response
 * @param {Object} data - Raw API response from Newsdata.io
 * @returns {Array} Formatted news articles array
 */
function formatNewsData(data) {
  console.log('📰 Formatting external news data...');

  if (!data || !data.results || !Array.isArray(data.results)) {
    console.warn('⚠️ Unexpected news API response structure:', data);
    return [];
  }

  console.log(`📰 Found ${data.results.length} external news articles to format`);

  return data.results.map((article, index) => ({
    id: article.article_id || `news_${index}`,
    title: article.title || 'Untitled',
    description: article.description || '',
    content: article.content || article.description || '',
    url: article.link || '',
    image_url: article.image_url || null,
    source: {
      name: article.source_id || 'Unknown Source',
      url: article.source_url || ''
    },
    publishedAt: article.pubDate || article.publishedAt,
    tags: article.category || [],
    language: article.language || 'en'
  }));
}