const https = require('https');
require('dotenv').config();

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://ebcl-app.github.io',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
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

/**
 * Format live scores data from external API
 */
function formatLiveScoresData(data) {
  if (!data || !data.response || !Array.isArray(data.response)) return [];

  // Flatten all matches from all series
  const allMatches = [];
  data.response.forEach(series => {
    if (series.matchList && Array.isArray(series.matchList)) {
      series.matchList.forEach(match => {
        allMatches.push({
          ...match,
          seriesName: series.seriesName
        });
      });
    }
  });

  return allMatches.map(match => {
    // Extract team names from matchTitle (format: "Team1 vs Team2")
    const titleParts = match.matchTitle ? match.matchTitle.split(' vs ') : ['', ''];
    const team1Name = titleParts[0] || match.teamOne?.name || 'Unknown';
    const team2Name = titleParts[1] || match.teamTwo?.name || 'Unknown';

    return {
      id: match.matchId,
      title: match.matchTitle || `${team1Name} vs ${team2Name}`,
      status: match.currentStatus || match.matchStatus || 'unknown',
      team1: {
        name: team1Name,
        score: match.teamOne?.score || '',
        status: match.teamOne?.status || ''
      },
      team2: {
        name: team2Name,
        score: match.teamTwo?.score || '',
        status: match.teamTwo?.status || ''
      },
      venue: match.matchVenue,
      result: match.matchStatus,
      matchType: match.matchFormat || 'ODI',
      seriesName: match.seriesName,
      scheduledDate: match.matchDate,
      source: 'external'
    };
  });
}

/**
 * Format schedules data from external API
 */
function formatSchedulesData(data) {
  if (!data || !data.response || !data.response.schedules || !Array.isArray(data.response.schedules)) return [];

  return data.response.schedules.map(match => ({
    id: match.id || match.matchId,
    title: match.title || `${match.team1} vs ${match.team2}`,
    status: 'scheduled',
    team1: {
      name: match.team1
    },
    team2: {
      name: match.team2
    },
    venue: match.venue,
    matchType: match.matchType || 'T20',
    scheduledDate: match.date,
    source: 'external'
  }));
}

/**
 * Format news data from external API
 */
function formatNewsData(data) {
  if (!data || !data.results || !Array.isArray(data.results)) return [];

  return data.results.map(article => ({
    id: article.article_id || article.id,
    title: article.title,
    description: article.description || article.content,
    content: article.content,
    url: article.link || article.url,
    imageUrl: article.image_url,
    source: article.source_name || article.source,
    publishedAt: article.pubDate || article.publishedAt,
    category: 'cricket',
    tags: ['cricket', 'sports']
  }));
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
    // Handle both direct function calls and redirected API calls
    let path = event.path;
    if (path.startsWith('/.netlify/functions/news-v2')) {
      path = path.replace('/.netlify/functions/news-v2', '');
    } else if (path.startsWith('/api/v2/news')) {
      path = path.replace('/api/v2/news', '') || '/';
    }
    
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // GET /api/v2/news - Get cricket news from external API
    if (method === 'GET' && (!path || path === '/' || path === '')) {
      const NEWS_API_KEY = process.env.NEWS_API_KEY;
      const NEWS_API_BASE_URL = 'https://newsdata.io/api/1/latest';
      const limit = Math.min(parseInt(queryParams.limit) || 10, 10); // Max 10 per Newsdata.io API limits
      const nextPage = queryParams.nextPage; // Cursor for pagination

      if (!NEWS_API_KEY) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'News API key not configured'
          })
        };
      }

      try {
        console.log('📰 Fetching cricket news from newsdata.io...');

        const params = new URLSearchParams({
          apikey: NEWS_API_KEY,
          q: 'Cricket,News,English,India',
          language: 'en',
          category: 'sports',
          country: 'in',
          size: limit.toString()
        });

        // Add pagination parameter (cursor-based)
        if (nextPage) {
          params.append('page', nextPage);
        }

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

        const formattedNews = formatNewsData(data);

        // Prepare pagination metadata
        const pagination = {
          limit: limit,
          totalResults: data.totalResults || 0,
          hasNextPage: !!data.nextPage,
          nextPage: data.nextPage || null,
          maxLimit: 10 // Newsdata.io API limit
        };

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: formattedNews,
            pagination: pagination,
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

    // GET /api/v2/news/scores - Get live cricket scores from external API
    if (method === 'GET' && path === '/scores') {
      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
      const RAPIDAPI_BASE_URL = 'https://cricket-api-free-data.p.rapidapi.com';
      const limit = parseInt(queryParams.limit) || 10;
      const offset = parseInt(queryParams.offset) || 0;

      if (!RAPIDAPI_KEY) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'RapidAPI key not configured'
          })
        };
      }

      try {
        console.log('📊 Fetching live cricket scores from RapidAPI...');
        const response = await makeHttpsRequest(`${RAPIDAPI_BASE_URL}/cricket-livescores`, {
          'X-RapidAPI-Key': RAPIDAPI_KEY
        });

        console.log('📊 Live Scores API Response Status:', response.status);

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        console.log('📊 Live Scores API Raw Response:', data);

        const formattedScores = formatLiveScoresData(data);

        // Apply pagination to formatted data
        const paginatedScores = formattedScores.slice(offset, offset + limit);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: paginatedScores,
            pagination: {
              limit: limit,
              offset: offset,
              totalResults: formattedScores.length,
              hasNextPage: offset + limit < formattedScores.length
            },
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
            message: 'Failed to fetch live cricket scores',
            error: externalError.message
          })
        };
      }
    }

    // GET /api/v2/news/schedules - Get cricket schedules from external API
    if (method === 'GET' && path === '/schedules') {
      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
      const RAPIDAPI_BASE_URL = 'https://cricket-api-free-data.p.rapidapi.com';
      const RAPIDAPI_HOST = 'cricket-api-free-data.p.rapidapi.com';
      const limit = parseInt(queryParams.limit) || 10;
      const offset = parseInt(queryParams.offset) || 0;

      if (!RAPIDAPI_KEY) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'RapidAPI key not configured'
          })
        };
      }

      try {
        console.log('📅 Fetching cricket schedules from RapidAPI...');
        const response = await makeHttpsRequest(`${RAPIDAPI_BASE_URL}/cricket-schedule`, {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST
        });

        console.log('📅 Schedules API Response Status:', response.status);

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        console.log('📅 Schedules API Raw Response:', data);

        const formattedSchedules = formatSchedulesData(data);

        // Apply pagination to formatted data
        const paginatedSchedules = formattedSchedules.slice(offset, offset + limit);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            data: paginatedSchedules,
            pagination: {
              limit: limit,
              offset: offset,
              totalResults: formattedSchedules.length,
              hasNextPage: offset + limit < formattedSchedules.length
            },
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
            message: 'Failed to fetch cricket schedules',
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
    console.error('News V2 API Error:', error);
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