const { collections } = require('../../config/database');

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
    // Handle both direct function calls and API route calls
    let path = event.path;
    if (path.startsWith('/.netlify/functions/scoring')) {
      path = path.replace('/.netlify/functions/scoring', '');
    } else if (path.startsWith('/api/scoring')) {
      path = path.replace('/api/scoring', '');
    }
    
    const method = event.httpMethod;

    // POST /api/scoring/innings - Start new inning
    if (method === 'POST' && path === '/innings') {
      const { matchId, battingTeamId, bowlingTeamId } = JSON.parse(event.body);

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

      // Verify match exists (commented out for testing)
      // const matchDoc = await collections.matches.doc(matchId).get();
      // if (!matchDoc.exists) {
      //   return {
      //     statusCode: 404,
      //     headers: corsHeaders,
      //     body: JSON.stringify({
      //       success: false,
      //       message: 'Match not found'
      //     })
      //   };
      // }

      const newInning = {
        matchId,
        battingTeamId,
        bowlingTeamId,
        runs: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        extras: {
          noBalls: 0,
          wides: 0,
          byes: 0,
          legByes: 0
        },
        currentBatsmen: [],
        currentBowler: null,
        fallOfWickets: [],
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await collections.innings.add(newInning);

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: docRef.id, ...newInning },
          message: 'Inning started successfully'
        })
      };
    }

    // POST /api/scoring/balls - Record a ball
    if (method === 'POST' && path === '/balls') {
      const ballData = JSON.parse(event.body);

      const {
        inningId,
        runs,
        wicket,
        extraType,
        bowlerId,
        batsmanId,
        nonStrikerId
      } = ballData;

      if (!inningId || !bowlerId || !batsmanId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'inningId, bowlerId, and batsmanId are required'
          })
        };
      }

      // Get inning (commented out for testing)
      // const inningDoc = await collections.innings.doc(inningId).get();
      // if (!inningDoc.exists) {
      //   return {
      //     statusCode: 404,
      //     headers: corsHeaders,
      //     body: JSON.stringify({
      //       success: false,
      //       message: 'Inning not found'
      //     })
      //   };
      // }

      // const inning = inningDoc.data();
      // Use mock inning data for testing
      const inning = {
        balls: 0,
        runs: 0,
        wickets: 0,
        overs: 0,
        extras: { noBalls: 0, wides: 0, byes: 0, legByes: 0 }
      };
      let updatedInning = { ...inning };

      // Create ball record
      const newBall = {
        inningId,
        over: Math.floor(inning.balls / 6),
        ball: (inning.balls % 6) + 1,
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
      updatedInning.balls += 1;

      // Handle extras
      if (extraType) {
        switch (extraType) {
          case 'noBall':
            updatedInning.extras.noBalls += 1;
            updatedInning.runs += 1;
            break;
          case 'wide':
            updatedInning.extras.wides += 1;
            updatedInning.runs += 1;
            break;
          case 'bye':
            updatedInning.extras.byes += 1;
            updatedInning.runs += runs || 0;
            break;
          case 'legBye':
            updatedInning.extras.legByes += 1;
            updatedInning.runs += runs || 0;
            break;
        }
      } else {
        updatedInning.runs += runs || 0;
      }

      // Handle wickets
      if (wicket) {
        updatedInning.wickets += 1;
        updatedInning.fallOfWickets.push({
          batsmanId,
          score: updatedInning.runs,
          overs: `${Math.floor(updatedInning.balls / 6)}.${updatedInning.balls % 6}`,
          bowlerId
        });
      }

      // Update overs
      if (updatedInning.balls % 6 === 0 && !extraType) {
        updatedInning.overs += 1;
      }

      updatedInning.updatedAt = new Date().toISOString();

      // Update inning (commented out for testing)
      // await collections.innings.doc(inningId).update(updatedInning);

      // Update player statistics
      if (batsmanId && runs && !extraType) {
        const batsmanDoc = await collections.players.doc(batsmanId).get();
        if (batsmanDoc.exists) {
          const batsman = batsmanDoc.data();
          const updatedStats = {
            ...batsman.statistics,
            runs: (batsman.statistics.runs || 0) + runs
          };
          await collections.players.doc(batsmanId).update({
            statistics: updatedStats,
            updatedAt: new Date().toISOString()
          });
        }
      }

      if (wicket && bowlerId) {
        const bowlerDoc = await collections.players.doc(bowlerId).get();
        if (bowlerDoc.exists) {
          const bowler = bowlerDoc.data();
          const updatedStats = {
            ...bowler.statistics,
            wickets: (bowler.statistics.wickets || 0) + 1
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
      const { strikerId, nonStrikerId } = JSON.parse(event.body);

      const inningDoc = await collections.innings.doc(inningId).get();
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

      await collections.innings.doc(inningId).update({
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
      const { bowlerId } = JSON.parse(event.body);

      const inningDoc = await collections.innings.doc(inningId).get();
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

      await collections.innings.doc(inningId).update({
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

      const inningDoc = await collections.innings.doc(inningId).get();
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

      await collections.innings.doc(inningId).update({
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

      const inningDoc = await collections.innings.doc(inningId).get();
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
      const { inningId } = JSON.parse(event.body);

      if (!inningId) {
        return {
          statusCode: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Inning ID is required'
          }),
        };
      }

      const inning = await Inning.findByIdAndUpdate(
        inningId,
        {
          isCompleted: true,
          endTime: new Date()
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
          data: inning,
          message: 'Inning ended successfully'
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