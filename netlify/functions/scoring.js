const { collections } = require('../../config/database');
const { sequenceManager } = require('../../utils/sequenceManager');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

  try {
    console.log('SCORING FUNCTION CALLED');
    console.log('Event path:', event.path);
    console.log('Event method:', event.httpMethod);
    console.log('Event headers:', JSON.stringify(event.headers, null, 2));

    // Handle both direct function calls and API route calls
    let path = event.path;
    console.log('Initial path processing - event.path:', event.path);
    
    // More robust path parsing
    if (path.includes('/.netlify/functions/scoring')) {
      path = path.split('/.netlify/functions/scoring')[1] || '';
      console.log('Split on /.netlify/functions/scoring, path now:', path);
    } else if (path.includes('/api/scoring')) {
      path = path.split('/api/scoring')[1] || '';
      console.log('Split on /api/scoring, path now:', path);
    } else {
      console.log('No path replacement applied, path remains:', path);
    }
    
    // Normalize path by removing leading/trailing slashes
    path = path.replace(/^\/+|\/+$/g, '');
    if (path) path = '/' + path;
    
    console.log('Final parsed path:', path, 'Original path:', event.path);
    const method = event.httpMethod;

    // POST /api/scoring/innings - Start new inning
    if (method === 'POST' && path === '/innings') {
      console.log('MATCHED: POST /innings - path:', path, 'method:', method);
      // ... existing code ...
      
      let requestBody;
      try {
        requestBody = JSON.parse(event.body);
        console.log('Parsed request body:', requestBody);
      } catch (error) {
        console.error('Failed to parse request body:', error);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Invalid JSON in request body'
          })
        };
      }

      const { matchId, battingTeamId, bowlingTeamId } = requestBody;

      if (!matchId || !battingTeamId || !bowlingTeamId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'matchId, battingTeamId, and bowlingTeamId are required'
          })
        };
      }

      // Verify match exists
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

      const matchData = matchDoc.data();

      // Get team names for display
      const [battingTeamDoc, bowlingTeamDoc] = await Promise.all([
        collections.teams.doc(battingTeamId).get(),
        collections.teams.doc(bowlingTeamId).get()
      ]);

      if (!battingTeamDoc.exists || !bowlingTeamDoc.exists) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'One or both teams not found'
          })
        };
      }

      // Determine inning number
      const existingInnings = await collections.matches.doc(matchId).collection('innings').get();
      const inningNumber = existingInnings.size + 1;

      // Generate numeric ID for the inning
      const numericId = await sequenceManager.getNextId('innings');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('innings');

      const newInning = {
        numericId,
        matchId,
        battingTeamId,
        bowlingTeamId,
        battingTeam: battingTeamDoc.data().name,
        bowlingTeam: bowlingTeamDoc.data().name,
        inningNumber,
        totalRuns: 0,
        totalWickets: 0,
        totalOvers: 0,
        totalBalls: 0,
        extras: {
          total: 0,
          wides: 0,
          noBalls: 0,
          byes: 0,
          legByes: 0
        },
        batsmen: [],
        bowling: [],
        fallOfWickets: [],
        currentBatsmen: [],
        currentBowler: null,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store inning as subcollection of the match
      await collections.matches.doc(matchId).collection('innings').doc(documentId).set(newInning);

      // Update match status and current inning
      await collections.matches.doc(matchId).update({
        status: 'live',
        currentInnings: inningNumber,
        updatedAt: new Date().toISOString()
      });

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: documentId, ...newInning },
          message: `Inning ${inningNumber} started successfully for ${battingTeamDoc.data().name}`
        })
      };
    }

    // POST /api/scoring/balls - Record a ball
    if (method === 'POST' && path === '/balls') {
      const ballData = JSON.parse(event.body);

      const {
        matchId,
        inningId,
        runs,
        wicket,
        extraType,
        bowlerId,
        batsmanId,
        nonStrikerId
      } = ballData;

      if (!matchId || !inningId || !bowlerId || !batsmanId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'matchId, inningId, bowlerId, and batsmanId are required'
          })
        };
      }

      // Get inning
      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      const inning = inningDoc.data();
      let updatedInning = { ...inning };

      // Create ball record
      const newBall = {
        inningId,
        over: Math.floor(inning.totalBalls / 6),
        ball: (inning.totalBalls % 6) + 1,
        runs: runs || 0,
        wicket: wicket || null,
        extraType: extraType || null,
        bowlerId,
        batsmanId,
        nonStrikerId,
        timestamp: new Date().toISOString()
      };

      await collections.balls.add(newBall);

      // Update inning statistics
      updatedInning.totalBalls += 1;

      // Handle extras
      if (extraType) {
        switch (extraType) {
          case 'noBall':
            updatedInning.extras.noBalls += 1;
            updatedInning.extras.total += 1;
            updatedInning.totalRuns += 1;
            break;
          case 'wide':
            updatedInning.extras.wides += 1;
            updatedInning.extras.total += 1;
            updatedInning.totalRuns += 1;
            break;
          case 'bye':
            updatedInning.extras.byes += 1;
            updatedInning.extras.total += runs || 0;
            updatedInning.totalRuns += runs || 0;
            break;
          case 'legBye':
            updatedInning.extras.legByes += 1;
            updatedInning.extras.total += runs || 0;
            updatedInning.totalRuns += runs || 0;
            break;
        }
      } else {
        updatedInning.totalRuns += runs || 0;
      }

      // Handle wickets
      if (wicket) {
        updatedInning.totalWickets += 1;
        updatedInning.fallOfWickets.push({
          wicketNumber: updatedInning.totalWickets,
          score: updatedInning.totalRuns,
          batsmanName: '', // Will be populated when we get batsman details
          batsmanId,
          overs: `${Math.floor(updatedInning.totalBalls / 6)}.${updatedInning.totalBalls % 6}`,
          bowlerId
        });
      }

      // Update overs
      if (updatedInning.totalBalls % 6 === 0 && !extraType) {
        updatedInning.totalOvers += 1;
      }

      updatedInning.updatedAt = new Date().toISOString();

      // Update inning
      await collections.matches.doc(matchId).collection('innings').doc(inningId).update(updatedInning);

      // Update batsman statistics in inning
      if (batsmanId && !extraType) {
        // Get batsman details
        const batsmanDoc = await collections.players.doc(batsmanId).get();
        let batsmanName = 'Unknown';
        if (batsmanDoc.exists) {
          batsmanName = batsmanDoc.data().name;
        }

        // Find or create batsman entry in inning
        let batsmanEntry = updatedInning.batsmen.find(b => b.playerId === batsmanId);
        if (!batsmanEntry) {
          batsmanEntry = {
            playerId: batsmanId,
            player: { id: batsmanId, name: batsmanName },
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            status: 'batting',
            strikeRate: 0
          };
          updatedInning.batsmen.push(batsmanEntry);
        }

        // Update batsman stats
        batsmanEntry.runs += runs || 0;
        batsmanEntry.balls += 1;
        if (runs === 4) batsmanEntry.fours += 1;
        if (runs === 6) batsmanEntry.sixes += 1;
        batsmanEntry.strikeRate = batsmanEntry.balls > 0 ? (batsmanEntry.runs / batsmanEntry.balls) * 100 : 0;

        // Update fall of wickets with batsman name
        if (wicket) {
          const lastWicket = updatedInning.fallOfWickets[updatedInning.fallOfWickets.length - 1];
          if (lastWicket) {
            lastWicket.batsmanName = batsmanName;
          }
          batsmanEntry.status = wicket.type || 'out';
        }

        // Update global player statistics
        if (batsmanDoc.exists) {
          const batsman = batsmanDoc.data();
          const updatedStats = {
            ...batsman.statistics,
            runs: (batsman.statistics?.runs || 0) + (runs || 0),
            ballsFaced: (batsman.statistics?.ballsFaced || 0) + 1,
            fours: (batsman.statistics?.fours || 0) + (runs === 4 ? 1 : 0),
            sixes: (batsman.statistics?.sixes || 0) + (runs === 6 ? 1 : 0)
          };
          await collections.players.doc(batsmanId).update({
            statistics: updatedStats,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Update bowler statistics in inning
      if (bowlerId) {
        // Get bowler details
        const bowlerDoc = await collections.players.doc(bowlerId).get();
        let bowlerName = 'Unknown';
        if (bowlerDoc.exists) {
          bowlerName = bowlerDoc.data().name;
        }

        // Find or create bowler entry in inning
        let bowlerEntry = updatedInning.bowling.find(b => b.playerId === bowlerId);
        if (!bowlerEntry) {
          bowlerEntry = {
            playerId: bowlerId,
            player: { id: bowlerId, name: bowlerName },
            overs: 0,
            maidens: 0,
            runs: 0,
            wickets: 0,
            economy: 0,
            dots: 0,
            fours: 0,
            sixes: 0
          };
          updatedInning.bowling.push(bowlerEntry);
        }

        // Update bowler stats
        bowlerEntry.runs += (extraType === 'wide' || extraType === 'noBall') ? 1 : (runs || 0);
        if (runs === 0 && !extraType) bowlerEntry.dots += 1;
        if (runs === 4) bowlerEntry.fours += 1;
        if (runs === 6) bowlerEntry.sixes += 1;
        if (wicket) bowlerEntry.wickets += 1;

        // Update overs (only for valid balls)
        if (!extraType || extraType === 'noBall') {
          const ballsInOver = updatedInning.totalBalls % 6;
          if (ballsInOver === 0) {
            bowlerEntry.overs = Math.floor(updatedInning.totalBalls / 6);
          }
        }

        // Calculate economy
        const oversDecimal = bowlerEntry.overs + ((updatedInning.totalBalls % 6) / 6);
        bowlerEntry.economy = oversDecimal > 0 ? bowlerEntry.runs / oversDecimal : 0;

        // Update global player statistics
        if (bowlerDoc.exists) {
          const bowler = bowlerDoc.data();
          const updatedStats = {
            ...bowler.statistics,
            wickets: (bowler.statistics?.wickets || 0) + (wicket ? 1 : 0),
            runsConceded: (bowler.statistics?.runsConceded || 0) + ((extraType === 'wide' || extraType === 'noBall') ? 1 : (runs || 0)),
            overs: (bowler.statistics?.overs || 0) + (extraType !== 'wide' ? 1 : 0) / 6,
            maidens: (bowler.statistics?.maidens || 0) + bowlerEntry.maidens
          };
          await collections.players.doc(bowlerId).update({
            statistics: updatedStats,
            updatedAt: new Date().toISOString()
          });
        }
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { ...newBall, inning: updatedInning },
          message: 'Ball recorded successfully'
        })
      };
    }

    // PUT /api/scoring/innings/:inningId/batsmen - Set current batsmen
    if (method === 'PUT' && path.match(/^\/innings\/[^\/]+\/batsmen$/)) {
      const inningId = path.split('/')[2];
      const { matchId, strikerId, nonStrikerId } = JSON.parse(event.body);

      if (!matchId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'matchId is required'
          })
        };
      }

      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
        currentBatsmen: [strikerId, nonStrikerId],
        updatedAt: new Date().toISOString()
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Current batsmen updated successfully'
        })
      };
    }

    // PUT /api/scoring/innings/:inningId/bowler - Set current bowler
    if (method === 'PUT' && path.match(/^\/innings\/[^\/]+\/bowler$/)) {
      const inningId = path.split('/')[2];
      const { matchId, bowlerId } = JSON.parse(event.body);

      if (!matchId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'matchId is required'
          })
        };
      }

      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
        currentBowler: bowlerId,
        updatedAt: new Date().toISOString()
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Current bowler updated successfully'
        })
      };
    }

    // PUT /api/scoring/innings/:inningId/end - End inning
    if (method === 'PUT' && path.match(/^\/innings\/[^\/]+\/end$/)) {
      const inningId = path.split('/')[2];
      const { matchId } = JSON.parse(event.body);

      if (!matchId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'matchId is required'
          })
        };
      }

      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      await collections.matches.doc(matchId).collection('innings').doc(inningId).update({
        status: 'completed',
        updatedAt: new Date().toISOString()
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Inning ended successfully'
        })
      };
    }

    // GET /api/scoring/innings/:inningId - Get inning details
    if (method === 'GET' && path.match(/^\/innings\/[^\/]+$/)) {
      const inningId = path.split('/')[2];
      const matchId = event.queryStringParameters?.matchId;

      if (!matchId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'matchId query parameter is required'
          })
        };
      }

      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      const inning = { id: inningDoc.id, ...inningDoc.data() };

      // Get balls for this inning
      const ballsSnapshot = await collections.balls
        .where('inningId', '==', inningId)
        .orderBy('timestamp', 'asc')
        .get();

      inning.balls = [];
      ballsSnapshot.forEach(doc => {
        inning.balls.push({ id: doc.id, ...doc.data() });
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: inning
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

  } catch (error) {
    console.error('Error in scoring function:', error);
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
    const path = event.path.replace('/.netlify/functions/scoring', '');
    const method = event.httpMethod;

    // POST /api/scoring/start-inning - Start a new inning
    if (method === 'POST' && path === '/start-inning') {
      const { matchId, battingTeamId, bowlingTeamId, inningNumber } = JSON.parse(event.body);

      if (!matchId || !battingTeamId || !bowlingTeamId || !inningNumber) {
        return {
          statusCode: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields'
          }),
        };
      }

      // Find the match
      const match = await Match.findById(matchId);
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

      // Create new inning
      const inning = new Inning({
        match: matchId,
        battingTeam: battingTeamId,
        bowlingTeam: bowlingTeamId,
        inningNumber,
        startTime: new Date()
      });

      await inning.save();

      // Update match with the new inning
      match.innings.push(inning._id);
      match.currentInning = inningNumber;
      match.status = 'in-progress';
      await match.save();

      const populatedInning = await Inning.findById(inning._id)
        .populate('battingTeam', 'name shortName')
        .populate('bowlingTeam', 'name shortName');

      return {
        statusCode: 201,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: populatedInning,
          message: 'Inning started successfully'
        }),
      };
    }

    // POST /api/scoring/ball - Record a ball
    if (method === 'POST' && path === '/ball') {
      const {
        matchId,
        inningId,
        batsmanId,
        bowlerId,
        runs,
        isWicket,
        wicketType,
        fielderId,
        extras
      } = JSON.parse(event.body);

      if (!matchId || !inningId || !batsmanId || !bowlerId) {
        return {
          statusCode: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields'
          }),
        };
      }

      // Find the inning
      const inning = await Inning.findById(inningId);
      if (!inning) {
        return {
          statusCode: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          }),
        };
      }

      // Calculate over and ball number
      const currentOver = Math.floor(inning.totalBalls / 6);
      const ballNumber = (inning.totalBalls % 6) + 1;

      // Create ball record
      const ball = new Ball({
        match: matchId,
        inning: inningId,
        over: currentOver,
        ballNumber,
        batsman: batsmanId,
        bowler: bowlerId,
        runs: runs || 0,
        isWicket: isWicket || false,
        wicketType: isWicket ? wicketType : undefined,
        fielder: fielderId,
        extras: extras || {},
        isLegalDelivery: !extras || (!extras['no-ball'] && !extras.wide)
      });

      await ball.save();

      // Update inning statistics
      inning.totalRuns += (runs || 0);
      if (extras) {
        if (extras['no-ball']) inning.extras.noBalls += extras.runs || 1;
        if (extras.wide) inning.extras.wides += extras.runs || 1;
        if (extras.bye) inning.extras.byes += extras.runs || 0;
        if (extras['leg-bye']) inning.extras.legByes += extras.runs || 0;
        inning.totalRuns += (extras.runs || 0);
      }

      if (ball.isLegalDelivery) {
        inning.totalBalls += 1;
        inning.totalOvers = Math.floor(inning.totalBalls / 6) + (inning.totalBalls % 6) / 10;
      }

      if (isWicket) {
        inning.totalWickets += 1;
        // Add to fall of wickets
        inning.fallOfWickets.push({
          player: batsmanId,
          score: inning.totalRuns,
          overs: inning.totalOvers
        });
      }

      await inning.save();

      return {
        statusCode: 201,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: ball,
          inning: {
            totalRuns: inning.totalRuns,
            totalWickets: inning.totalWickets,
            totalOvers: inning.totalOvers,
            totalBalls: inning.totalBalls
          },
          message: 'Ball recorded successfully'
        }),
      };
    }

    // PUT /api/scoring/current-batsmen - Update current batsmen
    if (method === 'PUT' && path === '/current-batsmen') {
      const { inningId, batsmen } = JSON.parse(event.body);

      if (!inningId || !batsmen || !Array.isArray(batsmen)) {
        return {
          statusCode: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Invalid request data'
          }),
        };
      }

      const inning = await Inning.findByIdAndUpdate(
        inningId,
        { currentBatsmen: batsmen },
        { new: true }
      );

      if (!inning) {
        return {
          statusCode: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: inning.currentBatsmen,
          message: 'Current batsmen updated successfully'
        }),
      };
    }

    // PUT /api/scoring/current-bowler - Update current bowler
    if (method === 'PUT' && path === '/current-bowler') {
      const { inningId, bowlerId } = JSON.parse(event.body);

      if (!inningId || !bowlerId) {
        return {
          statusCode: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields'
          }),
        };
      }

      const bowler = await Player.findById(bowlerId);
      if (!bowler) {
        return {
          statusCode: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Bowler not found'
          }),
        };
      }

      const inning = await Inning.findByIdAndUpdate(
        inningId,
        {
          currentBowler: {
            player: bowlerId,
            overs: 0,
            balls: 0,
            runs: 0,
            wickets: 0,
            maidens: 0
          }
        },
        { new: true }
      );

      if (!inning) {
        return {
          statusCode: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: inning.currentBowler,
          message: 'Current bowler updated successfully'
        }),
      };
    }

    // POST /api/scoring/end-inning - End current inning
    if (method === 'POST' && path === '/end-inning') {
      const { matchId, inningId } = JSON.parse(event.body);

      if (!matchId || !inningId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'matchId and inningId are required'
          })
        };
      }

      // Get inning
      const inningDoc = await collections.matches.doc(matchId).collection('innings').doc(inningId).get();
      if (!inningDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Inning not found'
          })
        };
      }

      const inning = inningDoc.data();

      // Mark inning as completed
      const updatedInning = {
        ...inning,
        status: 'completed',
        endTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await collections.matches.doc(matchId).collection('innings').doc(inningId).update(updatedInning);

      // Update match with inning score
      const matchDoc = await collections.matches.doc(matchId).get();
      if (matchDoc.exists) {
        const matchData = matchDoc.data();
        let updatedMatch = { ...matchData };

        // Update team scores based on which team was batting
        if (inning.battingTeamId === matchData.teams?.team1?.id) {
          updatedMatch.team1Score = inning.totalRuns;
        } else if (inning.battingTeamId === matchData.teams?.team2?.id) {
          updatedMatch.team2Score = inning.totalRuns;
        }

        // Check if match should be completed (both innings done)
        const allInnings = await collections.matches.doc(matchId).collection('innings').get();
        const completedInnings = allInnings.docs.filter(doc => doc.data().status === 'completed');

        if (completedInnings.length >= 2) {
          // Determine winner
          if (updatedMatch.team1Score > updatedMatch.team2Score) {
            updatedMatch.winner = matchData.teams?.team1?.name;
            updatedMatch.result = `won by ${updatedMatch.team1Score - updatedMatch.team2Score} runs`;
          } else if (updatedMatch.team2Score > updatedMatch.team1Score) {
            updatedMatch.winner = matchData.teams?.team2?.name;
            updatedMatch.result = `won by ${updatedMatch.team2Score - updatedMatch.team1Score} runs`;
          } else {
            updatedMatch.result = 'Match tied';
          }
          updatedMatch.status = 'completed';
        }

        updatedMatch.updatedAt = new Date().toISOString();
        await collections.matches.doc(matchId).update(updatedMatch);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: inningId, ...updatedInning },
          message: 'Inning ended successfully'
        })
      };
    }

    // Method not allowed
    console.log('METHOD NOT ALLOWED - Final path:', path, 'method:', method, 'original path:', event.path);
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