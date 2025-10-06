const { collections } = require('../../config/database');
const { sequenceManager } = require('../../utils/sequenceManager');

// Helper function to find document by numericId
async function findDocumentByNumericId(collection, numericId) {
  const snapshot = await collection.where('numericId', '==', parseInt(numericId, 10)).get();

  if (snapshot.empty) {
    return null;
  }

  // Return the first matching document (should only be one)
  const doc = snapshot.docs[0];

  // Return an object that mimics a Firestore document
  return {
    id: doc.id,
    ref: doc.ref,
    exists: true,
    data: () => ({ ...doc.data(), id: doc.id })
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'false',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  const { httpMethod: method, path: originalPath, body } = event;
  
  // Extract path from the event (handle both direct function calls and redirected API calls)
  let path = originalPath;
  if (path && path.includes('/teams')) {
    // Extract everything after /teams
    const teamsIndex = path.indexOf('/teams');
    path = path.substring(teamsIndex + 6); // 6 is length of '/teams'
    if (!path) path = '/';
  }

  console.log('Teams Function - Method:', method, 'Original Path:', originalPath, 'Processed Path:', path);

  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // GET /api/teams - Get all teams
    if (method === 'GET' && path === '/') {
      const teamsSnapshot = await collections.teams.get();
      const teams = [];
      
      for (const doc of teamsSnapshot.docs) {
        const teamData = {
          id: doc.id,
          numericId: doc.data().numericId,
          displayId: doc.data().numericId || doc.id,
          ...doc.data()
        };
        
        // Fetch captain details if captainId exists
        if (teamData.captainId) {
          try {
            const captainDoc = await collections.players.doc(teamData.captainId).get();
            if (captainDoc.exists) {
              teamData.captain = {
                id: captainDoc.id,
                name: captainDoc.data().name,
                role: captainDoc.data().role
              };
            }
          } catch (error) {
            console.error(`Error fetching captain ${teamData.captainId}:`, error);
            teamData.captain = null;
          }
        } else {
          teamData.captain = null;
        }

        // Fetch player details if playerIds exist
        if (teamData.playerIds && teamData.playerIds.length > 0) {
          try {
            const playerPromises = teamData.playerIds.map(playerId => 
              collections.players.doc(playerId).get()
            );
            const playerDocs = await Promise.all(playerPromises);
            
            teamData.players = playerDocs
              .filter(doc => doc.exists)
              .map(doc => ({
                id: doc.id,
                numericId: doc.data().numericId,
                name: doc.data().name,
                role: doc.data().role,
                battingStyle: doc.data().battingStyle,
                bowlingStyle: doc.data().bowlingStyle,
                matchesPlayed: doc.data().matchesPlayed || 0,
                totalRuns: doc.data().totalRuns || 0,
                totalWickets: doc.data().totalWickets || 0,
                battingAverage: doc.data().battingAverage || 0,
                bowlingAverage: doc.data().bowlingAverage || 0
              }));
            
            teamData.playersCount = teamData.players.length;
          } catch (error) {
            console.error(`Error fetching players for team ${doc.id}:`, error);
            teamData.players = [];
            teamData.playersCount = 0;
          }
        } else {
          teamData.players = [];
          teamData.playersCount = teamData.playersCount || 0;
        }

        // Fetch match history for this team
        try {
          // Query all matches and filter in code (more reliable than nested queries)
          const matchesSnapshot = await collections.matches
            .orderBy('scheduledDate', 'desc')
            .get();
          
          teamData.matchHistory = [];
          for (const matchDoc of matchesSnapshot.docs) {
            const matchData = matchDoc.data();
            
            // Check if this team is team1 or team2
            const isTeam1 = matchData.team1?.name === teamData.name;
            const isTeam2 = matchData.team2?.name === teamData.name;
            
            if (isTeam1 || isTeam2) {
              const opponent = isTeam1 ? matchData.team2 : matchData.team1;
              
              teamData.matchHistory.push({
                id: matchDoc.id,
                numericId: matchData.numericId,
                displayId: matchData.numericId || matchDoc.id,
                title: matchData.title,
                status: matchData.status,
                scheduledDate: matchData.scheduledDate,
                venue: matchData.venue,
                opponent: opponent,
                winner: matchData.winner,
                result: matchData.result,
                team1Score: matchData.team1Score,
                team2Score: matchData.team2Score
              });
            }
          }
          
          // Sort matches by date (most recent first) - already sorted by query
          
          // Calculate team statistics from match history
          const completedMatches = teamData.matchHistory.filter(match => match.status === 'completed');
          const wins = completedMatches.filter(match => match.result?.winner === teamData.name).length;
          const losses = completedMatches.filter(match => match.result?.winner && match.result.winner !== teamData.name).length;
          const draws = completedMatches.filter(match => !match.result?.winner).length;
          
          teamData.statistics = {
            totalMatches: completedMatches.length,
            wins: wins,
            losses: losses,
            draws: draws,
            winPercentage: completedMatches.length > 0 ? (wins / completedMatches.length) * 100 : 0
          };
          
        } catch (error) {
          console.error(`Error fetching match history for team ${doc.id}:`, error);
          teamData.matchHistory = [];
        }

        // Fetch team-specific player statistics from match squads
        try {
          const matchSquadsSnapshot = await collections.teams.doc(doc.id).collection('matchSquads').get();
          const teamPlayerStats = new Map(); // playerId -> stats

          // Process each match squad
          for (const squadDoc of matchSquadsSnapshot.docs) {
            const squadData = squadDoc.data();
            const matchId = squadData.matchId;

            // Get innings data for this match
            const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

            for (const inningDoc of inningsSnapshot.docs) {
              const inningData = inningDoc.data();

              // Only process innings where this team was batting
              if (inningData.battingTeam === teamData.name) {
                // Process batsmen statistics
                if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
                  inningData.batsmen.forEach(batsman => {
                    if (batsman.playerId && squadData.playerIds.includes(batsman.playerId)) {
                      const stats = teamPlayerStats.get(batsman.playerId) || {
                        playerId: batsman.playerId,
                        matchesPlayed: 0,
                        totalRuns: 0,
                        totalBalls: 0,
                        totalFours: 0,
                        totalSixes: 0,
                        battingInnings: 0,
                        notOuts: 0,
                        highestScore: 0
                      };

                      stats.matchesPlayed = Math.max(stats.matchesPlayed, squadData.playerIds.length > 0 ? 1 : 0);
                      stats.totalRuns += batsman.runs || 0;
                      stats.totalBalls += batsman.balls || 0;
                      stats.totalFours += batsman.fours || 0;
                      stats.totalSixes += batsman.sixes || 0;
                      stats.battingInnings += 1;
                      stats.highestScore = Math.max(stats.highestScore, batsman.runs || 0);

                      // Check if not out
                      if (!batsman.howOut || batsman.howOut.type === 'not out' || batsman.status?.toLowerCase().includes('not out')) {
                        stats.notOuts += 1;
                      }

                      teamPlayerStats.set(batsman.playerId, stats);
                    }
                  });
                }

                // Process bowling statistics
                if (inningData.bowling && Array.isArray(inningData.bowling)) {
                  inningData.bowling.forEach(bowler => {
                    if (bowler.playerId && squadData.playerIds.includes(bowler.playerId)) {
                      const existingStats = teamPlayerStats.get(bowler.playerId);
                      const stats = existingStats || {
                        playerId: bowler.playerId,
                        matchesPlayed: 0,
                        totalRuns: 0,
                        totalBalls: 0,
                        totalFours: 0,
                        totalSixes: 0,
                        battingInnings: 0,
                        notOuts: 0,
                        highestScore: 0,
                        bowlingInnings: 0,
                        totalWickets: 0,
                        bowlingRuns: 0,
                        bowlingBalls: 0,
                        maidens: 0
                      };

                      if (!existingStats) {
                        stats.matchesPlayed = Math.max(stats.matchesPlayed, squadData.playerIds.length > 0 ? 1 : 0);
                      }

                      stats.bowlingInnings += 1;
                      stats.totalWickets += bowler.wickets || 0;
                      stats.bowlingRuns += bowler.runs || 0;
                      stats.bowlingBalls += bowler.balls || 0;
                      stats.maidens += bowler.maidens || 0;

                      teamPlayerStats.set(bowler.playerId, stats);
                    }
                  });
                }
              }
            }
          }

          // Convert to array and enrich with player details
          teamData.teamPlayers = [];
          for (const [playerId, stats] of teamPlayerStats) {
            try {
              const playerDoc = await collections.players.doc(playerId).get();
              if (playerDoc.exists) {
                const playerData = playerDoc.data();
                teamData.teamPlayers.push({
                  id: playerId,
                  numericId: playerData.numericId,
                  name: playerData.name,
                  role: playerData.role,
                  battingStyle: playerData.battingStyle,
                  bowlingStyle: playerData.bowlingStyle,
                  teamStats: {
                    matchesPlayed: stats.matchesPlayed,
                    batting: {
                      totalRuns: stats.totalRuns,
                      totalBalls: stats.totalBalls,
                      totalFours: stats.totalFours,
                      totalSixes: stats.totalSixes,
                      battingInnings: stats.battingInnings,
                      notOuts: stats.notOuts,
                      highestScore: stats.highestScore,
                      battingAverage: stats.battingInnings > 0 ? (stats.totalRuns / (stats.battingInnings - stats.notOuts || 1)).toFixed(2) : '0.00',
                      strikeRate: stats.totalBalls > 0 ? ((stats.totalRuns / stats.totalBalls) * 100).toFixed(2) : '0.00'
                    },
                    bowling: {
                      bowlingInnings: stats.bowlingInnings,
                      totalWickets: stats.totalWickets,
                      bowlingRuns: stats.bowlingRuns,
                      bowlingBalls: stats.bowlingBalls,
                      maidens: stats.maidens,
                      bowlingAverage: stats.totalWickets > 0 ? (stats.bowlingRuns / stats.totalWickets).toFixed(2) : '0.00',
                      economy: stats.bowlingBalls > 0 ? ((stats.bowlingRuns / stats.bowlingBalls) * 6).toFixed(2) : '0.00'
                    }
                  }
                });
              }
            } catch (error) {
              console.error(`Error fetching player ${playerId} details:`, error);
            }
          }

          // Sort team players by matches played (most active first)
          teamData.teamPlayers.sort((a, b) => b.teamStats.matchesPlayed - a.teamStats.matchesPlayed);

        } catch (error) {
          console.error(`Error fetching team player statistics for team ${doc.id}:`, error);
          teamData.teamPlayers = [];
        }

        // Ensure statistics and bestPlayers are included (with defaults if not set)
        teamData.statistics = teamData.statistics || {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winPercentage: 0
        };
        
        teamData.bestPlayers = teamData.bestPlayers || {
          batsman: null,
          bowler: null,
          allRounder: null,
          wicketKeeper: null
        };
        
        teams.push(teamData);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          data: teams 
        }),
      };
    }

    // GET /api/teams/:numericId - Get team by numericId
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1); // Remove leading slash
      const teamDoc = await findDocumentByNumericId(collections.teams, numericId);

      if (!teamDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team not found' }),
        };
      }

      const teamData = {
        id: teamDoc.id,
        numericId: teamDoc.data().numericId,
        displayId: teamDoc.data().numericId || teamDoc.id,
        ...teamDoc.data()
      };
      
      // Fetch captain details if captainId exists
      if (teamData.captainId) {
        try {
          const captainDoc = await collections.players.doc(teamData.captainId).get();
          if (captainDoc.exists) {
            teamData.captain = {
              id: captainDoc.id,
              name: captainDoc.data().name,
              role: captainDoc.data().role
            };
          }
        } catch (error) {
          console.error(`Error fetching captain ${teamData.captainId}:`, error);
          teamData.captain = null;
        }
      } else {
        teamData.captain = null;
      }

      // Fetch player details if playerIds exist
      if (teamData.playerIds && teamData.playerIds.length > 0) {
        try {
          const playerPromises = teamData.playerIds.map(playerId => 
            collections.players.doc(playerId).get()
          );
          const playerDocs = await Promise.all(playerPromises);
          
          teamData.players = playerDocs
            .filter(doc => doc.exists)
            .map(doc => ({
              id: doc.id,
              numericId: doc.data().numericId,
              name: doc.data().name,
              role: doc.data().role,
              battingStyle: doc.data().battingStyle,
              bowlingStyle: doc.data().bowlingStyle,
              matchesPlayed: doc.data().matchesPlayed || 0,
              totalRuns: doc.data().totalRuns || 0,
              totalWickets: doc.data().totalWickets || 0,
              battingAverage: doc.data().battingAverage || 0,
              bowlingAverage: doc.data().bowlingAverage || 0
            }));
          
          teamData.playersCount = teamData.players.length;
        } catch (error) {
          console.error(`Error fetching players for team ${teamDoc.id}:`, error);
          teamData.players = [];
          teamData.playersCount = 0;
        }
      } else {
        teamData.players = [];
        teamData.playersCount = teamData.playersCount || 0;
      }

      // Fetch match history for this team
      try {
        const matchesSnapshot = await collections.matches
          .where('team1.name', '==', teamData.name)
          .get();
        
        const matchesSnapshot2 = await collections.matches
          .where('team2.name', '==', teamData.name)
          .get();
        
        const allMatchDocs = [...matchesSnapshot.docs, ...matchesSnapshot2.docs];
        
        teamData.matchHistory = [];
        for (const matchDoc of allMatchDocs) {
          const matchData = matchDoc.data();
          const opponent = matchData.team1?.name === teamData.name ? matchData.team2 : matchData.team1;
          
          teamData.matchHistory.push({
            id: matchDoc.id,
            numericId: matchData.numericId,
            displayId: matchData.numericId || matchDoc.id,
            title: matchData.title,
            status: matchData.status,
            scheduledDate: matchData.scheduledDate,
            venue: matchData.venue,
            opponent: opponent,
            winner: matchData.winner,
            result: matchData.result,
            team1Score: matchData.team1Score,
            team2Score: matchData.team2Score
          });
        }
        
        // Sort matches by date (most recent first)
        teamData.matchHistory.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
        
        // Calculate team statistics from match history
        const completedMatches = teamData.matchHistory.filter(match => match.status === 'completed');
        const wins = completedMatches.filter(match => match.result?.winner === teamData.name).length;
        const losses = completedMatches.filter(match => match.result?.winner && match.result.winner !== teamData.name).length;
        const draws = completedMatches.filter(match => !match.result?.winner).length;
        
        teamData.statistics = {
          totalMatches: completedMatches.length,
          wins: wins,
          losses: losses,
          draws: draws,
          winPercentage: completedMatches.length > 0 ? (wins / completedMatches.length) * 100 : 0
        };
        
      } catch (error) {
        console.error(`Error fetching match history for team ${teamDoc.id}:`, error);
        teamData.matchHistory = [];
      }

      // Fetch team-specific player statistics from match squads
      try {
        const matchSquadsSnapshot = await collections.teams.doc(teamDoc.id).collection('matchSquads').get();
        const teamPlayerStats = new Map(); // playerId -> stats

        // Process each match squad
        for (const squadDoc of matchSquadsSnapshot.docs) {
          const squadData = squadDoc.data();
          const matchId = squadData.matchId;

          // Get innings data for this match
          const inningsSnapshot = await collections.matches.doc(matchId).collection('innings').get();

          for (const inningDoc of inningsSnapshot.docs) {
            const inningData = inningDoc.data();

            // Only process innings where this team was batting
            if (inningData.battingTeam === teamData.name) {
              // Process batsmen statistics
              if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
                inningData.batsmen.forEach(batsman => {
                  if (batsman.playerId && squadData.playerIds.includes(batsman.playerId)) {
                    const stats = teamPlayerStats.get(batsman.playerId) || {
                      playerId: batsman.playerId,
                      matchesPlayed: 0,
                      totalRuns: 0,
                      totalBalls: 0,
                      totalFours: 0,
                      totalSixes: 0,
                      battingInnings: 0,
                      notOuts: 0,
                      highestScore: 0
                    };

                    stats.matchesPlayed = Math.max(stats.matchesPlayed, squadData.playerIds.length > 0 ? 1 : 0);
                    stats.totalRuns += batsman.runs || 0;
                    stats.totalBalls += batsman.balls || 0;
                    stats.totalFours += batsman.fours || 0;
                    stats.totalSixes += batsman.sixes || 0;
                    stats.battingInnings += 1;
                    stats.highestScore = Math.max(stats.highestScore, batsman.runs || 0);

                    // Check if not out
                    if (!batsman.howOut || batsman.howOut.type === 'not out' || batsman.status?.toLowerCase().includes('not out')) {
                      stats.notOuts += 1;
                    }

                    teamPlayerStats.set(batsman.playerId, stats);
                  }
                });
              }

              // Process bowling statistics
              if (inningData.bowling && Array.isArray(inningData.bowling)) {
                inningData.bowling.forEach(bowler => {
                  if (bowler.playerId && squadData.playerIds.includes(bowler.playerId)) {
                    const existingStats = teamPlayerStats.get(bowler.playerId);
                    const stats = existingStats || {
                      playerId: bowler.playerId,
                      matchesPlayed: 0,
                      totalRuns: 0,
                      totalBalls: 0,
                      totalFours: 0,
                      totalSixes: 0,
                      battingInnings: 0,
                      notOuts: 0,
                      highestScore: 0,
                      bowlingInnings: 0,
                      totalWickets: 0,
                      bowlingRuns: 0,
                      bowlingBalls: 0,
                      maidens: 0
                    };

                    if (!existingStats) {
                      stats.matchesPlayed = Math.max(stats.matchesPlayed, squadData.playerIds.length > 0 ? 1 : 0);
                    }

                    stats.bowlingInnings += 1;
                    stats.totalWickets += bowler.wickets || 0;
                    stats.bowlingRuns += bowler.runs || 0;
                    stats.bowlingBalls += bowler.balls || 0;
                    stats.maidens += bowler.maidens || 0;

                    teamPlayerStats.set(bowler.playerId, stats);
                  }
                });
              }
            }
          }
        }

        // Convert to array and enrich with player details
        teamData.teamPlayers = [];
        for (const [playerId, stats] of teamPlayerStats) {
          try {
            const playerDoc = await collections.players.doc(playerId).get();
            if (playerDoc.exists) {
              const playerData = playerDoc.data();
              teamData.teamPlayers.push({
                id: playerId,
                name: playerData.name,
                role: playerData.role,
                battingStyle: playerData.battingStyle,
                bowlingStyle: playerData.bowlingStyle,
                teamStats: {
                  matchesPlayed: stats.matchesPlayed,
                  batting: {
                    totalRuns: stats.totalRuns,
                    totalBalls: stats.totalBalls,
                    totalFours: stats.totalFours,
                    totalSixes: stats.totalSixes,
                    battingInnings: stats.battingInnings,
                    notOuts: stats.notOuts,
                    highestScore: stats.highestScore,
                    battingAverage: stats.battingInnings > 0 ? (stats.totalRuns / (stats.battingInnings - stats.notOuts || 1)).toFixed(2) : '0.00',
                    strikeRate: stats.totalBalls > 0 ? ((stats.totalRuns / stats.totalBalls) * 100).toFixed(2) : '0.00'
                  },
                  bowling: {
                    bowlingInnings: stats.bowlingInnings,
                    totalWickets: stats.totalWickets,
                    bowlingRuns: stats.bowlingRuns,
                    bowlingBalls: stats.bowlingBalls,
                    maidens: stats.maidens,
                    bowlingAverage: stats.totalWickets > 0 ? (stats.bowlingRuns / stats.totalWickets).toFixed(2) : '0.00',
                    economy: stats.bowlingBalls > 0 ? ((stats.bowlingRuns / stats.bowlingBalls) * 6).toFixed(2) : '0.00'
                  }
                }
              });
            }
          } catch (error) {
            console.error(`Error fetching player ${playerId} details:`, error);
          }
        }

        // Sort team players by matches played (most active first)
        teamData.teamPlayers.sort((a, b) => b.teamStats.matchesPlayed - a.teamStats.matchesPlayed);

      } catch (error) {
        console.error(`Error fetching team player statistics for team ${teamDoc.id}:`, error);
        teamData.teamPlayers = [];
      }

      // Ensure statistics and bestPlayers are included (with defaults if not set)
      teamData.statistics = teamData.statistics || {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winPercentage: 0
      };
      
      teamData.bestPlayers = teamData.bestPlayers || {
        batsman: null,
        bowler: null,
        allRounder: null,
        wicketKeeper: null
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          data: teamData 
        }),
      };
    }

    // POST /api/teams - Create new team
    if (method === 'POST' && path === '/') {
      const teamData = JSON.parse(body);
      
      // Validate required fields
      if (!teamData.name) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team name is required' }),
        };
      }

      // Generate numeric ID for the team
      const numericId = await sequenceManager.getNextId('teams');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('teams');

      const docRef = await collections.teams.doc(documentId).set({
        numericId: numericId,
        name: teamData.name,
        shortName: teamData.shortName || teamData.name.substring(0, 3).toUpperCase(),
        captainId: teamData.captainId || null,
        playerIds: teamData.playerIds || [],
        logo: teamData.logo || null,
        homeGround: teamData.homeGround || null,
        foundedYear: teamData.foundedYear || null,
        // Team statistics
        statistics: {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winPercentage: 0
        },
        // Best players data
        bestPlayers: {
          batsman: null,
          bowler: null,
          allRounder: null,
          wicketKeeper: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const newTeam = await collections.teams.doc(documentId).get();
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ 
          data: {
            id: newTeam.id,
            ...newTeam.data()
          }
        }),
      };
    }

    // PUT /api/teams/:id - Update team
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const teamId = path.substring(1); // Remove leading slash
      const updateData = JSON.parse(body);
      
      // Check if team exists
      const teamDoc = await collections.teams.doc(teamId).get();
      if (!teamDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team not found' }),
        };
      }

      // Update team
      await collections.teams.doc(teamId).update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      // Get updated team
      const updatedTeam = await collections.teams.doc(teamId).get();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          data: {
            id: updatedTeam.id,
            ...updatedTeam.data()
          }
        }),
      };
    }

    // DELETE /api/teams/:id - Delete team
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const teamId = path.substring(1); // Remove leading slash
      
      // Check if team exists
      const teamDoc = await collections.teams.doc(teamId).get();
      if (!teamDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Team not found' }),
        };
      }

      // Delete team
      await collections.teams.doc(teamId).delete();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Team deleted successfully',
          teamId: teamId
        }),
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Route not found',
        method: method,
        path: path,
        originalPath: originalPath
      }),
    };

  } catch (error) {
    console.error('Teams API Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      }),
    };
  }
};