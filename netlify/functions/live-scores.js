const { collections } = require('../../config/database');
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
    const path = event.path.replace('/.netlify/functions/live-scores', '').replace(/\/$/, '');
    const method = event.httpMethod;

    // GET /api/live-scores/external - Get live cricket scores from external API
    if (method === 'GET' && path === '/external') {
      const RAPIDAPI_BASE_URL = 'https://cricket-api-free-data.p.rapidapi.com';
      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'e27809ce4cmsha82996c2e07a674p16c2f2jsne2eda76f3b89';

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

    // GET /api/live-scores - Get all live matches
    if (method === 'GET' && (!path || path === '/')) {
      const matchesSnapshot = await collections.matches
        .where('status', 'in', ['live', 'in_progress'])
        .get();

      const liveMatches = [];
      for (const matchDoc of matchesSnapshot.docs) {
        const match = { id: matchDoc.id, ...matchDoc.data() };

        // Get current innings
        const inningsSnapshot = await collections.innings
          .where('matchId', '==', match.id)
          .where('status', '==', 'in_progress')
          .get();

        if (!inningsSnapshot.empty) {
          const currentInning = inningsSnapshot.docs[0];
          match.currentInning = { id: currentInning.id, ...currentInning.data() };

          // Calculate current score
          const ballsSnapshot = await collections.balls
            .where('inningId', '==', currentInning.id)
            .get();

          let totalRuns = 0;
          let totalWickets = 0;
          let totalBalls = 0;

          ballsSnapshot.forEach(ballDoc => {
            const ball = ballDoc.data();
            totalRuns += ball.runs || 0;
            if (ball.wicket) totalWickets += 1;
            totalBalls += 1;
          });

          match.currentScore = {
            runs: totalRuns,
            wickets: totalWickets,
            overs: `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`,
            runRate: totalBalls > 0 ? (totalRuns / (totalBalls / 6)).toFixed(2) : '0.00'
          };
        }

        liveMatches.push(match);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: liveMatches
        })
      };
    }

    // GET /api/live-scores/:matchId - Get live score for specific match
    if (method === 'GET' && path.match(/^\/[^\/]+$/)) {
      const matchId = path.substring(1);

      const matchDoc = await collections.matches.doc(matchId).get();
      if (!matchDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      const match = { id: matchDoc.id, ...matchDoc.data() };

      // Get all innings for this match
      const inningsSnapshot = await collections.innings
        .where('matchId', '==', matchId)
        .orderBy('createdAt', 'asc')
        .get();

      match.innings = [];
      for (const inningDoc of inningsSnapshot.docs) {
        const inning = { id: inningDoc.id, ...inningDoc.data() };

        // Get balls for this inning
        const ballsSnapshot = await collections.balls
          .where('inningId', '==', inning.id)
          .orderBy('timestamp', 'asc')
          .get();

        inning.balls = [];
        ballsSnapshot.forEach(ballDoc => {
          inning.balls.push({ id: ballDoc.id, ...ballDoc.data() });
        });

        match.innings.push(inning);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: match
        })
      };
    }

    // GET /api/live-scores/:matchId/scorecard - Get detailed scorecard
    if (method === 'GET' && path.match(/^\/[^\/]+\/scorecard$/)) {
      const matchId = path.split('/')[1];

      const matchDoc = await collections.matches.doc(matchId).get();
      if (!matchDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          })
        };
      }

      const match = { id: matchDoc.id, ...matchDoc.data() };

      // Get teams
      const team1Doc = await collections.teams.doc(match.team1Id).get();
      const team2Doc = await collections.teams.doc(match.team2Id).get();

      match.team1 = team1Doc.exists ? { id: team1Doc.id, ...team1Doc.data() } : null;
      match.team2 = team2Doc.exists ? { id: team2Doc.id, ...team2Doc.data() } : null;

      // Get innings with detailed scorecard
      const inningsSnapshot = await collections.innings
        .where('matchId', '==', matchId)
        .orderBy('createdAt', 'asc')
        .get();

      match.scorecard = [];
      for (const inningDoc of inningsSnapshot.docs) {
        const inning = { id: inningDoc.id, ...inningDoc.data() };

        // Get batting team
        const battingTeamDoc = await collections.teams.doc(inning.battingTeamId).get();
        inning.battingTeam = battingTeamDoc.exists ? { id: battingTeamDoc.id, ...battingTeamDoc.data() } : null;

        // Get bowling team
        const bowlingTeamDoc = await collections.teams.doc(inning.bowlingTeamId).get();
        inning.bowlingTeam = bowlingTeamDoc.exists ? { id: bowlingTeamDoc.id, ...bowlingTeamDoc.data() } : null;

        // Calculate batsman statistics
        const ballsSnapshot = await collections.balls
          .where('inningId', '==', inning.id)
          .get();

        const batsmanStats = {};
        const bowlerStats = {};

        ballsSnapshot.forEach(ballDoc => {
          const ball = ballDoc.data();

          // Batsman stats
          if (ball.batsmanId) {
            if (!batsmanStats[ball.batsmanId]) {
              batsmanStats[ball.batsmanId] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
            }
            batsmanStats[ball.batsmanId].runs += ball.runs || 0;
            batsmanStats[ball.batsmanId].balls += 1;
            if (ball.runs === 4) batsmanStats[ball.batsmanId].fours += 1;
            if (ball.runs === 6) batsmanStats[ball.batsmanId].sixes += 1;
          }

          // Bowler stats
          if (ball.bowlerId) {
            if (!bowlerStats[ball.bowlerId]) {
              bowlerStats[ball.bowlerId] = { overs: 0, runs: 0, wickets: 0, maidens: 0 };
            }
            bowlerStats[ball.bowlerId].runs += ball.runs || 0;
            if (ball.wicket) bowlerStats[ball.bowlerId].wickets += 1;
          }

          // Mark batsman as out
          if (ball.wicket && ball.batsmanId) {
            batsmanStats[ball.batsmanId].out = true;
          }
        });

        // Convert to arrays with player details
        inning.batting = await Promise.all(
          Object.keys(batsmanStats).map(async (playerId) => {
            const playerDoc = await collections.players.doc(playerId).get();
            const player = playerDoc.exists ? playerDoc.data() : {};
            return {
              playerId,
              name: player.name || 'Unknown',
              ...batsmanStats[playerId]
            };
          })
        );

        inning.bowling = await Promise.all(
          Object.keys(bowlerStats).map(async (playerId) => {
            const playerDoc = await collections.players.doc(playerId).get();
            const player = playerDoc.exists ? playerDoc.data() : {};
            return {
              playerId,
              name: player.name || 'Unknown',
              ...bowlerStats[playerId]
            };
          })
        );

        match.scorecard.push(inning);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: match
        })
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Endpoint not found'
      })
    };
    if (method === 'GET' && (!path || path === '/')) {
      const matchesSnapshot = await collections.matches
        .where('status', 'in', ['live', 'in_progress'])
        .get();

      const liveScores = await Promise.all(
        liveMatches.map(async (match) => {
          const currentInning = await Inning.findById(
            match.innings[match.currentInning - 1]
          )
            .populate('battingTeam', 'name shortName')
            .populate('bowlingTeam', 'name shortName')
            .populate('currentBatsmen.player', 'name')
            .populate('currentBowler.player', 'name');

          return {
            match: {
              _id: match._id,
              title: match.title,
              team1: match.team1,
              team2: match.team2,
              status: match.status,
              currentInning: match.currentInning,
              tossWinner: match.tossWinner,
              tossDecision: match.tossDecision
            },
            currentScore: currentInning ? {
              battingTeam: currentInning.battingTeam,
              bowlingTeam: currentInning.bowlingTeam,
              runs: currentInning.totalRuns,
              wickets: currentInning.totalWickets,
              overs: currentInning.totalOvers,
              balls: currentInning.totalBalls,
              runRate: currentInning.runRate,
              currentBatsmen: currentInning.currentBatsmen,
              currentBowler: currentInning.currentBowler,
              extras: currentInning.extras
            } : null
          };
        })
      );

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: liveScores
        }),
      };
    }

    // GET /api/live-scores/:matchId - Get live score for specific match
    if (method === 'GET' && path.startsWith('/')) {
      const matchId = path.slice(1);

      if (!mongoose.Types.ObjectId.isValid(matchId)) {
        return {
          statusCode: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Invalid match ID'
          }),
        };
      }

      const match = await Match.findById(matchId)
        .populate('team1', 'name shortName')
        .populate('team2', 'name shortName')
        .populate('tossWinner', 'name shortName')
        .populate('winner', 'name shortName')
        .populate('manOfTheMatch', 'name');

      if (!match) {
        return {
          statusCode: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Match not found'
          }),
        };
      }

      // Get current inning details
      let currentScore = null;
      if (match.innings && match.innings.length > 0 && match.status === 'in-progress') {
        const currentInning = await Inning.findById(match.innings[match.currentInning - 1])
          .populate('battingTeam', 'name shortName')
          .populate('bowlingTeam', 'name shortName')
          .populate('currentBatsmen.player', 'name')
          .populate('currentBowler.player', 'name')
          .populate('fallOfWickets.player', 'name');

        if (currentInning) {
          currentScore = {
            inningNumber: currentInning.inningNumber,
            battingTeam: currentInning.battingTeam,
            bowlingTeam: currentInning.bowlingTeam,
            runs: currentInning.totalRuns,
            wickets: currentInning.totalWickets,
            overs: currentInning.totalOvers,
            balls: currentInning.totalBalls,
            runRate: currentInning.runRate,
            wicketsRemaining: currentInning.wicketsRemaining,
            currentBatsmen: currentInning.currentBatsmen,
            currentBowler: currentInning.currentBowler,
            extras: currentInning.extras,
            fallOfWickets: currentInning.fallOfWickets,
            isCompleted: currentInning.isCompleted
          };
        }
      }

      // Get innings summary
      const inningsSummary = await Promise.all(
        match.innings.map(async (inningId, index) => {
          const inning = await Inning.findById(inningId)
            .populate('battingTeam', 'name shortName')
            .populate('bowlingTeam', 'name shortName');

          return {
            inningNumber: index + 1,
            battingTeam: inning.battingTeam,
            runs: inning.totalRuns,
            wickets: inning.totalWickets,
            overs: inning.totalOvers,
            isCompleted: inning.isCompleted
          };
        })
      );

      const liveScoreData = {
        match: {
          _id: match._id,
          title: match.title,
          venue: match.venue,
          date: match.date,
          format: match.format,
          overs: match.overs,
          team1: match.team1,
          team2: match.team2,
          status: match.status,
          currentInning: match.currentInning,
          tossWinner: match.tossWinner,
          tossDecision: match.tossDecision,
          winner: match.winner,
          result: match.result,
          manOfTheMatch: match.manOfTheMatch
        },
        currentScore,
        inningsSummary,
        summary: match.summary
      };

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: liveScoreData
        }),
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      }),
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
      matchFormat: match.matchFormat?.trim() || 'T20',
      matchVenue: match.matchVenue || 'Unknown Venue',
      matchDate: match.matchDate || new Date().toLocaleDateString(),
      matchTime: match.matchTime?.trim() || 'TBD',
      matchStatus: match.matchStatus || 'In Progress',
      currentStatus: match.currentStatus || 'live',
      teamOne: {
        name: match.teamOne?.name || 'Team 1',
        score: match.teamOne?.score || '',
        status: match.teamOne?.status || 'bat'
      },
      teamTwo: {
        name: match.teamTwo?.name || 'Team 2',
        score: match.teamTwo?.score || '',
        status: match.teamTwo?.status || 'bowl'
      },
      result: match.result || null
    };
  });
}