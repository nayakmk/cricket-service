const { collections } = require('../../config/database');

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3001',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
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
    if (path.startsWith('/.netlify/functions/matches')) {
      path = path.replace('/.netlify/functions/matches', '');
    } else if (path.startsWith('/api/matches')) {
      path = path.replace('/api/matches', '');
    }
    
    const method = event.httpMethod;
    
    console.log('Debug - Original path:', event.path, 'Processed path:', path, 'Method:', method);

    // GET /api/matches - Get all matches
    if (method === 'GET' && (!path || path === '/' || path === '')) {
      const { status, page = 1, limit = 10 } = event.queryStringParameters || {};

      let query = collections.matches.orderBy('createdAt', 'desc');

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.get();
      const matches = [];
      
      console.log(`Found ${snapshot.docs.length} matches in database`);
      
      for (const doc of snapshot.docs) {
        const matchData = { id: doc.id, ...doc.data() };
        console.log(`Processing match ${matchData.id}: status=${matchData.status}, team1Id=${matchData.team1Id}, team2Id=${matchData.team2Id}`);
        
        // TEMP: Skip team fetching to see if all matches are returned
        matchData.team1 = null;
        matchData.team2 = null;
        matchData.lineups = {};
        
        matches.push(matchData);
        console.log(`Added match ${matchData.id} to results. Total matches so far: ${matches.length}`);
      }

      console.log(`Returning ${matches.length} matches`);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: matches
        })
      };
    }

    // GET /api/matches/:id - Get match by ID
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
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

      const matchData = { id: matchDoc.id, ...matchDoc.data() };

      // Fetch complete team1 details
      if (matchData.team1Id) {
        try {
          const team1Doc = await collections.teams.doc(matchData.team1Id).get();
          if (team1Doc.exists) {
            const team1Data = { id: team1Doc.id, ...team1Doc.data() };
            
            // Fetch captain details for team1
            if (team1Data.captainId) {
              const captainDoc = await collections.players.doc(team1Data.captainId).get();
              if (captainDoc.exists) {
                team1Data.captain = { id: captainDoc.id, ...captainDoc.data() };
              }
            }
            
            matchData.team1 = team1Data;
          }
        } catch (error) {
          console.error(`Error fetching team1 ${matchData.team1Id}:`, error);
          matchData.team1 = null;
        }
      }
      
      // Fetch complete team2 details
      if (matchData.team2Id) {
        try {
          const team2Doc = await collections.teams.doc(matchData.team2Id).get();
          if (team2Doc.exists) {
            const team2Data = { id: team2Doc.id, ...team2Doc.data() };
            
            // Fetch captain details for team2
            if (team2Data.captainId) {
              const captainDoc = await collections.players.doc(team2Data.captainId).get();
              if (captainDoc.exists) {
                team2Data.captain = { id: captainDoc.id, ...captainDoc.data() };
              }
            }
            
            matchData.team2 = team2Data;
          }
        } catch (error) {
          console.error(`Error fetching team2 ${matchData.team2Id}:`, error);
          matchData.team2 = null;
        }
      }
      
      // Fetch innings data with complete details
      try {
        const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').orderBy('inningNumber').get();
        const innings = [];

        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = { id: inningDoc.id, ...inningDoc.data() };

          // Fetch batting team details
          if (inningData.battingTeam) {
            try {
              const battingTeamDoc = await collections.teams.doc(inningData.battingTeam).get();
              if (battingTeamDoc.exists) {
                inningData.battingTeamDetails = { id: battingTeamDoc.id, ...battingTeamDoc.data() };
              }
            } catch (error) {
              console.error(`Error fetching batting team ${inningData.battingTeam}:`, error);
            }
          }

          // Fetch bowling team details
          if (inningData.bowlingTeam) {
            try {
              const bowlingTeamDoc = await collections.teams.doc(inningData.bowlingTeam).get();
              if (bowlingTeamDoc.exists) {
                inningData.bowlingTeamDetails = { id: bowlingTeamDoc.id, ...bowlingTeamDoc.data() };
              }
            } catch (error) {
              console.error(`Error fetching bowling team ${inningData.bowlingTeam}:`, error);
            }
          }

          // Fetch batsmen data
          try {
            const batsmenSnapshot = await collections.matches.doc(matchId).collection('innings').doc(inningDoc.id).collection('batsmen').get();
            const batsmen = [];

            for (const batsmanDoc of batsmenSnapshot.docs) {
              const batsmanData = { id: batsmanDoc.id, ...batsmanDoc.data() };

              // Fetch player details
              if (batsmanData.player) {
                try {
                  const playerDoc = await collections.players.doc(batsmanData.player).get();
                  if (playerDoc.exists) {
                    batsmanData.playerDetails = { id: playerDoc.id, ...playerDoc.data() };
                  }
                } catch (error) {
                  console.error(`Error fetching batsman player ${batsmanData.player}:`, error);
                }
              }

              batsmen.push(batsmanData);
            }

            inningData.batsmen = batsmen;
          } catch (error) {
            console.error('Error fetching batsmen:', error);
            inningData.batsmen = [];
          }

          // Fetch bowling data
          try {
            const bowlingSnapshot = await collections.matches.doc(matchId).collection('innings').doc(inningDoc.id).collection('bowling').get();
            const bowling = [];

            for (const bowlerDoc of bowlingSnapshot.docs) {
              const bowlerData = { id: bowlerDoc.id, ...bowlerDoc.data() };

              // Fetch player details
              if (bowlerData.player) {
                try {
                  const playerDoc = await collections.players.doc(bowlerData.player).get();
                  if (playerDoc.exists) {
                    bowlerData.playerDetails = { id: playerDoc.id, ...playerDoc.data() };
                  }
                } catch (error) {
                  console.error(`Error fetching bowler player ${bowlerData.player}:`, error);
                }
              }

              bowling.push(bowlerData);
            }

            inningData.bowling = bowling;
          } catch (error) {
            console.error('Error fetching bowling:', error);
            inningData.bowling = [];
          }

          // Fetch fall of wickets data
          try {
            const fowSnapshot = await collections.matches.doc(matchId).collection('innings').doc(inningDoc.id).collection('fallOfWickets').orderBy('wicketNumber').get();
            const fallOfWickets = [];

            for (const fowDoc of fowSnapshot.docs) {
              const fowData = { id: fowDoc.id, ...fowDoc.data() };

              // Fetch player details
              if (fowData.playerOut) {
                try {
                  const playerDoc = await collections.players.doc(fowData.playerOut).get();
                  if (playerDoc.exists) {
                    fowData.playerOutDetails = { id: playerDoc.id, ...playerDoc.data() };
                  }
                } catch (error) {
                  console.error(`Error fetching player out ${fowData.playerOut}:`, error);
                }
              }

              fallOfWickets.push(fowData);
            }

            inningData.fallOfWickets = fallOfWickets;
          } catch (error) {
            console.error('Error fetching fall of wickets:', error);
            inningData.fallOfWickets = [];
          }

          innings.push(inningData);
        }

        matchData.innings = innings;
      } catch (error) {
        console.error('Error fetching innings:', error);
        matchData.innings = [];
      }
      
      // Fetch team lineups for both teams
      try {
        const teamIds = [matchData.team1Id, matchData.team2Id].filter(id => id && id.trim() !== '');
        if (teamIds.length > 0) {
          const lineupsSnapshot = await collections.teamLineups
            .where('teamId', 'in', teamIds)
            .get();
          
          const lineups = {};
          for (const lineupDoc of lineupsSnapshot.docs) {
            const lineupData = { id: lineupDoc.id, ...lineupDoc.data() };
            
            // Fetch player details for this lineup
            if (lineupData.players && Array.isArray(lineupData.players)) {
              const playersWithDetails = [];
              for (const playerId of lineupData.players) {
                try {
                  const playerDoc = await collections.players.doc(playerId).get();
                  if (playerDoc.exists) {
                    playersWithDetails.push({ id: playerDoc.id, ...playerDoc.data() });
                  }
                } catch (playerError) {
                  console.error(`Error fetching player ${playerId}:`, playerError);
                }
              }
              lineupData.playersDetails = playersWithDetails;
            }
            
            // Fetch captain and wicketkeeper details
            if (lineupData.captain) {
              try {
                const captainDoc = await collections.players.doc(lineupData.captain).get();
                if (captainDoc.exists) {
                  lineupData.captainDetails = { id: captainDoc.id, ...captainDoc.data() };
                }
              } catch (error) {
                console.error(`Error fetching captain ${lineupData.captain}:`, error);
              }
            }
            
            if (lineupData.wicketKeeper) {
              try {
                const wicketkeeperDoc = await collections.players.doc(lineupData.wicketKeeper).get();
                if (wicketkeeperDoc.exists) {
                  lineupData.wicketkeeperDetails = { id: wicketkeeperDoc.id, ...wicketkeeperDoc.data() };
                }
              } catch (error) {
                console.error(`Error fetching wicketkeeper ${lineupData.wicketKeeper}:`, error);
              }
            }
            
            lineups[lineupData.teamId] = lineupData;
          }
          
          matchData.lineups = lineups;
        } else {
          matchData.lineups = {};
        }
      } catch (error) {
        console.error('Error fetching lineups:', error);
        matchData.lineups = {};
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: matchData
        })
      };
    }

    // POST /api/matches - Create new match
    if (method === 'POST' && (!path || path === '/')) {
      const matchData = JSON.parse(event.body);

      // Validate required fields
      if (!matchData.team1Id || !matchData.team2Id || !matchData.title) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required fields: team1Id, team2Id, title'
          })
        };
      }

      // Verify teams exist
      const [team1Doc, team2Doc] = await Promise.all([
        collections.teams.doc(matchData.team1Id).get(),
        collections.teams.doc(matchData.team2Id).get()
      ]);

      if (!team1Doc.exists || !team2Doc.exists) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'One or both teams not found'
          })
        };
      }

      // Add timestamps
      const timestamp = new Date().toISOString();
      const newMatch = {
        ...matchData,
        status: matchData.status || 'scheduled',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const docRef = await collections.matches.add(newMatch);
      const createdMatch = { id: docRef.id, ...newMatch };

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: createdMatch
        })
      };
    }

    // PUT /api/matches/:id - Update match
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const matchId = path.substring(1);
      const updateData = JSON.parse(event.body);

      // Check if match exists
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

      // Update with timestamp
      const updatedMatch = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await collections.matches.doc(matchId).update(updatedMatch);
      const updatedDoc = await collections.matches.doc(matchId).get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: result
        })
      };
    }

    // DELETE /api/matches/:id - Delete match
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const matchId = path.substring(1);

      // Check if match exists
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

      // Delete related innings and balls if needed
      try {
        const inningsSnapshot = await collections.innings.where('matchId', '==', matchId).get();
        const deletePromises = [];
        
        inningsSnapshot.forEach(doc => {
          deletePromises.push(collections.innings.doc(doc.id).delete());
        });

        // Delete balls related to this match (if any)
        const ballsSnapshot = await collections.balls.where('matchId', '==', matchId).get();
        ballsSnapshot.forEach(doc => {
          deletePromises.push(collections.balls.doc(doc.id).delete());
        });

        await Promise.all(deletePromises);
      } catch (cleanupError) {
        console.warn('Error cleaning up related data:', cleanupError);
      }

      // Delete the match
      await collections.matches.doc(matchId).delete();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Match deleted successfully'
        })
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Route not found',
        debug: {
          originalPath: event.path,
          processedPath: path,
          method: method,
          queryParams: event.queryStringParameters
        }
      })
    };

  } catch (error) {
    console.error('Error in matches function:', error);
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