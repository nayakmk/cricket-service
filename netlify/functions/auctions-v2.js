// Cricket App v2 - Auctions API
// IPL-style auction system with real-time bidding

const { db, V2_COLLECTIONS, V2_SCHEMAS } = require('../../config/database-v2');
const admin = require('firebase-admin');
const { sequenceManager } = require('../../utils/sequenceManager');
const { AuctionManager } = require('../../utils/auctionManager');
const { AuctionTimer } = require('../../utils/auctionTimer');

// Helper function to find document by displayId in v2 collections
async function findDocumentByDisplayId(collection, displayId) {
  // First try to find by displayId field as string
  let snapshot = await db.collection(collection).where('displayId', '==', displayId.toString()).get();

  // If not found, try by displayId as number
  if (snapshot.empty) {
    const numericDisplayId = parseInt(displayId);
    if (!isNaN(numericDisplayId)) {
      snapshot = await db.collection(collection).where('displayId', '==', numericDisplayId).get();
    }
  }

  if (snapshot.empty) {
    return null;
  }

  // Return the first matching document
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ref: doc.ref,
    exists: true,
    data: () => ({ ...doc.data(), id: doc.id })
  };
}

// Helper function to find document by auctionId
async function findDocumentByAuctionId(auctionId) {
  const snapshot = await db.collection(V2_COLLECTIONS.AUCTIONS).where('auctionId', '==', auctionId).get();

  if (snapshot.empty) {
    return null;
  }

  // Return the first matching document
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ref: doc.ref,
    exists: true,
    data: () => ({ ...doc.data(), id: doc.id })
  };
}

// Helper function to validate data against v2 schemas
function validateData(schema, data) {
  // Basic validation - can be enhanced with more comprehensive validation
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    if (rules.required && (data[field] === undefined || data[field] === null)) {
      errors.push(`${field} is required`);
    }

    if (data[field] !== undefined && data[field] !== null) {
      if (rules.type && typeof data[field] !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }

      if (rules.minLength && data[field].length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && data[field].length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }

      if (rules.enum && !rules.enum.includes(data[field])) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }
  }

  return errors;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://ebcl-app.github.io',
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
    let path = event.path || '';
    if (path && path.startsWith('/.netlify/functions/auctions-v2')) {
      path = path.replace('/.netlify/functions/auctions-v2', '');
    } else if (path && path.startsWith('/api/v2/auctions')) {
      path = path.replace('/api/v2/auctions', '');
    }

    const method = event.httpMethod;

    // Debug logging for API requests
    if (process.env.NODE_ENV === 'development') {
      console.log('Debug - V2 Auctions API - Original path:', event.path, 'Processed path:', path, 'Method:', method);
    }

    // GET /api/v2/auctions/health - Health check endpoint
    if (method === 'GET' && path === '/health') {
      try {
        // Test database connection
        const testQuery = await db.collection(V2_COLLECTIONS.AUCTIONS).limit(1).get();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            status: 'healthy',
            message: 'Auctions API v2 is up and running',
            timestamp: new Date().toISOString(),
            database: {
              connected: true,
              collections: {
                auctions: V2_COLLECTIONS.AUCTIONS,
                players: V2_COLLECTIONS.PLAYERS,
                teams: V2_COLLECTIONS.TEAMS,
                tournaments: V2_COLLECTIONS.TOURNAMENTS
              }
            }
          })
        };
      } catch (error) {
        console.error('Auctions health check failed:', error);
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            status: 'unhealthy',
            message: 'Auctions API v2 is experiencing issues',
            timestamp: new Date().toISOString(),
            error: error.message
          })
        };
      }
    }

    // GET /api/v2/auctions - Get all auctions with pagination
    if ((method === 'GET' || method === 'HEAD') && (!path || path === '/' || path === '')) {
      const {
        status,
        tournamentId,
        page = 1,
        limit = 10,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = event.queryStringParameters || {};

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      let query = db.collection(V2_COLLECTIONS.AUCTIONS);

      // Apply filters
      if (status) {
        query = query.where('status', '==', status);
      }

      if (tournamentId) {
        query = query.where('tournamentId', '==', tournamentId);
      }

      // Apply ordering
      const validOrderFields = ['createdAt', 'startedAt', 'completedAt', 'auctionId'];
      const validDirections = ['asc', 'desc'];

      if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection)) {
        query = query.orderBy(orderBy, orderDirection);
      } else {
        query = query.orderBy('createdAt', 'desc');
      }

      // Get total count for pagination metadata
      const totalSnapshot = await query.get();
      const totalCount = totalSnapshot.size;

      // Apply pagination
      const paginatedQuery = query.limit(limitNum).offset(offset);
      const snapshot = await paginatedQuery.get();

      const auctions = [];
      for (const doc of snapshot.docs) {
        const auctionData = doc.data();
        auctions.push({
          id: auctionData.auctionId,
          auctionId: auctionData.auctionId,
          displayId: auctionData.displayId,
          title: auctionData.title,
          status: auctionData.status,
          tournament: auctionData.tournament,
          auctionConfig: auctionData.auctionConfig,
          auctionSummary: auctionData.auctionSummary,
          currentPlayer: auctionData.currentPlayer,
          createdAt: auctionData.createdAt?.toDate ? auctionData.createdAt.toDate().toISOString() : auctionData.createdAt,
          startedAt: auctionData.startedAt?.toDate ? auctionData.startedAt.toDate().toISOString() : auctionData.startedAt,
          completedAt: auctionData.completedAt?.toDate ? auctionData.completedAt.toDate().toISOString() : auctionData.completedAt,
          updatedAt: auctionData.updatedAt?.toDate ? auctionData.updatedAt.toDate().toISOString() : auctionData.updatedAt
        });
      }

      // For HEAD requests, return only headers without body
      if (method === 'HEAD') {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: ''
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: auctions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            hasNext: pageNum * limitNum < totalCount,
            hasPrev: pageNum > 1
          }
        })
      };
    }

    // GET /api/v2/auctions/:auctionId - Get auction by auctionId with full details
    if (method === 'GET' && path && path.match(/^\/auction_[^\/]+$/)) {
      const auctionId = path.substring(1);
      const auctionDoc = await findDocumentByAuctionId(auctionId);

      if (!auctionDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Auction not found'
          })
        };
      }

      const auctionData = auctionDoc.data();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            id: auctionData.auctionId,
            auctionId: auctionData.auctionId,
            displayId: auctionData.displayId,
            title: auctionData.title,
            status: auctionData.status,
            tournament: auctionData.tournament,
            auctionConfig: auctionData.auctionConfig,
            teams: auctionData.teams,
            soldPlayers: auctionData.soldPlayers,
            unsoldPlayers: auctionData.unsoldPlayers,
            auctionSummary: auctionData.auctionSummary,
            currentPlayer: auctionData.currentPlayer,
            createdAt: auctionData.createdAt?.toDate ? auctionData.createdAt.toDate().toISOString() : auctionData.createdAt,
            startedAt: auctionData.startedAt?.toDate ? auctionData.startedAt.toDate().toISOString() : auctionData.startedAt,
            completedAt: auctionData.completedAt?.toDate ? auctionData.completedAt.toDate().toISOString() : auctionData.completedAt,
            updatedAt: auctionData.updatedAt?.toDate ? auctionData.updatedAt.toDate().toISOString() : auctionData.updatedAt
          }
        })
      };
    }

    // POST /api/v2/auctions - Create new auction
    if (method === 'POST' && (!path || path === '/')) {
      const auctionData = JSON.parse(event.body);

      // Validate required fields - either tournamentId OR teams must be provided
      if (!auctionData.title) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Missing required field: title'
          })
        };
      }

      if (!auctionData.tournamentId && (!auctionData.teams || auctionData.teams.length === 0)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Either tournamentId or teams must be provided'
          })
        };
      }

      // Check if tournament exists (optional for standalone auctions)
      let tournamentDoc = null;
      let tournamentData = null;
      let teams = [];

      if (auctionData.tournamentId) { // Temporarily disable tournament logic for testing

        if (tournamentDoc) {
          tournamentData = tournamentDoc.data();
          // Get teams from tournament
          const tournamentTeamsSnapshot = await db.collection(V2_COLLECTIONS.TOURNAMENT_TEAMS)
            .where('tournamentId', '==', tournamentData.numericId.toString())
            .get();

          for (const teamDoc of tournamentTeamsSnapshot.docs) {
            const teamData = teamDoc.data();
            teams.push({
            teamId: teamData.teamId,
            team: {
              teamId: teamData.teamId,
              name: teamData.team.name,
              shortName: teamData.team.shortName
            },
            totalBudget: auctionData.auctionConfig?.totalBudgetPerTeam || 10000,
            remainingBudget: auctionData.auctionConfig?.totalBudgetPerTeam || 10000,
            spentBudget: 0,
            playersCount: 0,
            players: []
          });
        }
      }
      else if (auctionData.teams && auctionData.teams.length > 0) {
        console.log('DEBUG: Entering standalone teams branch');
        // Generate proper team IDs following v2 patterns
        const year = new Date().getFullYear();
        teams = await Promise.all(auctionData.teams.map(async (team, index) => {
          const teamSequence = await sequenceManager.getNextId('teams');
          const teamId = `team_${year}_${teamSequence.toString().padStart(3, '0')}`;
          const teamDocumentId = await sequenceManager.generateDocumentId('teams');

          return {
            teamId: teamId,
            numericId: teamDocumentId,
            displayId: teamSequence,
            team: {
              teamId: teamId,
              name: team.team.name,
              shortName: team.team.shortName
            },
            totalBudget: auctionData.auctionConfig?.totalBudgetPerTeam || 10000,
            remainingBudget: auctionData.auctionConfig?.totalBudgetPerTeam || 10000,
            spentBudget: 0,
            playersCount: 0,
            players: []
          };
        }));
        } else {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Either tournament must exist or teams must be provided in the payload'
            })
          };
        }
      }

      // Generate auction ID
      const year = new Date().getFullYear();
      const sequenceValue = await sequenceManager.getNextId('auctions');
      const auctionId = `auction_${year}_${sequenceValue.toString().padStart(3, '0')}`;
      const documentId = await sequenceManager.generateDocumentId('auctions');

      const timestamp = new Date().toISOString();

      const newAuction = {
        numericId: documentId,
        auctionId: auctionId,
        displayId: sequenceValue,
        ...(auctionData.tournamentId && { tournamentId: auctionData.tournamentId }),
        tournament: tournamentData ? {
          tournamentId: tournamentData.numericId.toString(),
          name: tournamentData.name,
          shortName: tournamentData.shortName || (tournamentData.name ? tournamentData.name.substring(0, 3).toUpperCase() : 'UNK'),
          season: tournamentData.season
        } : {
          tournamentId: null,
          name: auctionData.title,
          shortName: 'Standalone',
          season: new Date().getFullYear().toString()
        },
        title: auctionData.title,
        status: 'scheduled',
        auctionConfig: {
          totalBudgetPerTeam: auctionData.auctionConfig?.totalBudgetPerTeam || 10000,
          maxPlayersPerTeam: auctionData.auctionConfig?.maxPlayersPerTeam || 15,
          minPlayersPerTeam: auctionData.auctionConfig?.minPlayersPerTeam || 11,
          basePricePerPlayer: auctionData.auctionConfig?.basePricePerPlayer || 500,
          minBidIncrement: auctionData.auctionConfig?.minBidIncrement || 100,
          totalPlayersAuctioned: 0,
          totalSoldPlayers: 0,
          totalUnsoldPlayers: 0
        },
        teams: teams,
        soldPlayers: [],
        unsoldPlayers: [],
        auctionSummary: {
          totalTeams: teams.length,
          totalPlayers: 0,
          soldPlayers: 0,
          unsoldPlayers: 0,
          totalAuctionValue: 0,
          averagePlayerPrice: 0,
          highestBid: 0,
          lowestBid: 0,
          mostExpensivePlayer: null,
          teamSpending: teams.map(team => ({
            teamId: team.teamId,
            teamName: team.team.name,
            totalSpent: 0,
            averageSpentPerPlayer: 0,
            playersCount: 0
          }))
        },
        currentPlayer: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        startedAt: null,
        completedAt: null
      };

      // Validate data (skip for standalone auctions for now)
      // const validationErrors = validateData(V2_SCHEMAS.auctions, newAuction);
      // if (validationErrors.length > 0) {
      //   return {
      //     statusCode: 400,
      //     headers: corsHeaders,
      //     body: JSON.stringify({
      //       success: false,
      //       message: 'Validation errors',
      //       errors: validationErrors
      //     })
      //   };
      // }

      await db.collection(V2_COLLECTIONS.AUCTIONS).doc(documentId).set(newAuction);

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: documentId, ...newAuction }
        })
      };
    }

    // PUT /api/v2/auctions/:auctionId - Update auction
    if (method === 'PUT' && path && path.match(/^\/auction_[^\/]+$/)) {
      const auctionId = path.substring(1);
      const updateData = JSON.parse(event.body);

      const auctionDoc = await findDocumentByAuctionId(auctionId);
      if (!auctionDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Auction not found'
          })
        };
      }

      const existingAuctionData = auctionDoc.data();

      // Define allowed update fields
      const allowedUpdateFields = [
        'title', 'status', 'auctionConfig', 'currentPlayer', 'startedAt', 'completedAt'
      ];

      // Build update object
      const updateObject = {};

      // Apply allowed field updates
      allowedUpdateFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateObject[field] = updateData[field];
        }
      });

      // Handle special cases
      if (updateData.teams) {
        updateObject.teams = updateData.teams;
        updateObject['auctionSummary.teamSpending'] = updateData.teams.map(team => ({
          teamId: team.teamId,
          teamName: team.team.name,
          totalSpent: team.spentBudget,
          averageSpentPerPlayer: team.playersCount > 0 ? team.spentBudget / team.playersCount : 0,
          playersCount: team.playersCount
        }));
      }

      if (updateData.soldPlayers) {
        updateObject.soldPlayers = updateData.soldPlayers;
      }

      if (updateData.unsoldPlayers) {
        updateObject.unsoldPlayers = updateData.unsoldPlayers;
      }

      if (updateData.auctionSummary) {
        updateObject.auctionSummary = updateData.auctionSummary;
      }

      // Always update the updatedAt timestamp
      updateObject.updatedAt = new Date().toISOString();

      await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionDoc.id).update(updateObject);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: { id: auctionDoc.id, ...existingAuctionData, ...updateObject }
        })
      };
    }

    // DELETE /api/v2/auctions/:auctionId - Delete auction
    if (method === 'DELETE' && path && path.match(/^\/auction_[^\/]+$/)) {
      const auctionId = path.substring(1);

      const auctionDoc = await findDocumentByAuctionId(auctionId);
      if (!auctionDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Auction not found'
          })
        };
      }

      // Delete the auction document
      await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionDoc.id).delete();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Auction deleted successfully'
        })
      };
    }

    // POST /api/v2/auctions/:auctionId/start - Start auction
    if (method === 'POST' && path && path.match(/^\/auction_[^\/]+\/start$/)) {
      const auctionId = path.replace('/start', '').substring(1);

      try {
        const result = await AuctionManager.startAuction(auctionId);
        // Start the timer for the first player
        AuctionTimer.startTimer(auctionId, 30);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: error.message
          })
        };
      }
    }

    // POST /api/v2/auctions/:auctionId/next - Move to next player
    if (method === 'POST' && path && path.match(/^\/auction_[^\/]+\/next$/)) {
      const auctionId = path.replace('/next', '').substring(1);

      try {
        const result = await AuctionManager.nextPlayer(auctionId);
        // Start timer for next player if auction is still active
        if (result.currentPlayer) {
          AuctionTimer.startTimer(auctionId, 30);
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: error.message
          })
        };
      }
    }

    // POST /api/v2/auctions/:auctionId/pause - Pause auction
    if (method === 'POST' && path && path.match(/^\/auction_[^\/]+\/pause$/)) {
      const auctionId = path.replace('/pause', '').substring(1);

      try {
        const result = await AuctionManager.pauseAuction(auctionId);
        AuctionTimer.pauseTimer(auctionId);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: error.message
          })
        };
      }
    }

    // POST /api/v2/auctions/:auctionId/resume - Resume auction
    if (method === 'POST' && path && path.match(/^\/auction_[^\/]+\/resume$/)) {
      const auctionId = path.replace('/resume', '').substring(1);

      try {
        const result = await AuctionManager.resumeAuction(auctionId);
        AuctionTimer.resumeTimer(auctionId);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: error.message
          })
        };
      }
    }

    // GET /api/v2/auctions/:auctionId/status - Get auction status
    if (method === 'GET' && path && path.match(/^\/auction_[^\/]+\/status$/)) {
      const auctionId = path.replace('/status', '').substring(1);

      try {
        const result = await AuctionManager.getAuctionStatus(auctionId);
        const timerStatus = AuctionTimer.getTimerStatus(auctionId);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            ...result,
            timer: timerStatus
          })
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: error.message
          })
        };
      }
    }

    // POST /api/v2/auctions/:auctionId/bid - Place a bid
    if (method === 'POST' && path && path.match(/^\/auction_[^\/]+\/bid$/)) {
      const auctionId = path.replace('/bid', '').substring(1);
      const bidData = JSON.parse(event.body);

      // Validate bid data
      if (!bidData.teamId || !bidData.amount || bidData.amount <= 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Invalid bid data: teamId and amount are required'
          })
        };
      }

      const auctionDoc = await findDocumentByAuctionId(auctionId);
      if (!auctionDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Auction not found'
          })
        };
      }

      const auctionData = auctionDoc.data();

      // Check if auction is active
      if (auctionData.status !== 'active') {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Auction is not active'
          })
        };
      }

      // Check if there's a current player
      if (!auctionData.currentPlayer) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'No player currently being auctioned'
          })
        };
      }

      // Find the bidding team
      const biddingTeam = auctionData.teams.find(team => team.teamId === bidData.teamId);
      if (!biddingTeam) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Team not found in auction'
          })
        };
      }

      // Check if team has enough budget
      if (biddingTeam.remainingBudget < bidData.amount) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Insufficient budget'
          })
        };
      }

      // Check minimum bid increment
      const minBid = auctionData.currentPlayer.currentBid + auctionData.auctionConfig.minBidIncrement;
      if (bidData.amount < minBid) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: `Minimum bid is ${minBid}`
          })
        };
      }

      // Update current player bid
      const updateObject = {
        'currentPlayer.currentBid': bidData.amount,
        'currentPlayer.biddingTeam': bidData.teamId,
        'currentPlayer.biddingTeamName': biddingTeam.team.name,
        'currentPlayer.timeRemaining': 30, // Reset timer to 30 seconds
        updatedAt: new Date().toISOString()
      };

      await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionDoc.id).update(updateObject);

      // Reset the auction timer
      AuctionTimer.resetTimer(auctionId, 30);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Bid placed successfully',
          data: {
            playerId: auctionData.currentPlayer.playerId,
            currentBid: bidData.amount,
            biddingTeam: biddingTeam.team.name,
            timeRemaining: 30
          }
        })
      };
    }

    // If no matching route found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Endpoint not found'
      })
    };

  } catch (error) {
    console.error('Auctions API Error:', error);
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