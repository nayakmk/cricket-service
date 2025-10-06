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

// Helper function to find matching player
function findMatchingPlayer(matchName, existingPlayers, playerNames) {
  if (!matchName) return null;

  // Normalize the match name
  const normalizedMatchName = matchName.toLowerCase().replace(/[^a-z\s]/g, '').trim();

  // First try exact match
  if (playerNames.has(normalizedMatchName)) {
    const playerIds = playerNames.get(normalizedMatchName);
    if (playerIds.length === 1) {
      return playerIds[0]; // Return the single match
    }
    // Multiple matches - for now, return the first one
    // TODO: In the future, we could return a list and let user choose
    return playerIds[0];
  }

  // Try partial matches (contains)
  for (const [normalizedName, playerIds] of playerNames) {
    if (normalizedName.includes(normalizedMatchName) || normalizedMatchName.includes(normalizedName)) {
      if (playerIds.length === 1) {
        return playerIds[0];
      }
      // Multiple matches - return first one for now
      return playerIds[0];
    }
  }

  // Try fuzzy matching - check if names share common words
  const matchWords = normalizedMatchName.split(/\s+/);
  for (const [normalizedName, playerIds] of playerNames) {
    const nameWords = normalizedName.split(/\s+/);
    const commonWords = matchWords.filter(word => nameWords.includes(word));
    if (commonWords.length >= Math.min(matchWords.length, nameWords.length) * 0.5) { // 50% overlap
      if (playerIds.length === 1) {
        return playerIds[0];
      }
      return playerIds[0];
    }
  }

  return null; // No match found
}

// Helper function to determine better bowling figure
function getBetterBowlingFigure(figure1, figure2) {
  if (!figure1) return figure2 || '0/0';
  if (!figure2) return figure1;

  // Parse bowling figures like "3/25" or "2/30"
  const parseFigure = (fig) => {
    const match = fig.match(/^(\d+)\/(\d+)$/);
    if (match) {
      return { wickets: parseInt(match[1]), runs: parseInt(match[2]) };
    }
    return { wickets: 0, runs: 0 };
  };

  const f1 = parseFigure(figure1);
  const f2 = parseFigure(figure2);

  // Better figure has more wickets, or same wickets with fewer runs
  if (f1.wickets > f2.wickets) return figure1;
  if (f2.wickets > f1.wickets) return figure2;
  if (f1.runs < f2.runs) return figure1;
  return figure2;
}

exports.handler = async function(event, context) {
  const { httpMethod: method, path: originalPath, body } = event;
  
  // Extract path from the event (handle both direct function calls and redirected API calls)
  let path = originalPath;
  if (path && path.includes('/players')) {
    // Extract everything after /players
    const playersIndex = path.indexOf('/players');
    path = path.substring(playersIndex + 8); // 8 is length of '/players'
    if (!path) path = '/';
  }

  console.log('Players Function - Method:', method, 'Original Path:', originalPath, 'Processed Path:', path);

  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // GET /api/players - Get all players
    if (method === 'GET' && path === '/') {
      const playersSnapshot = await collections.players.get();
      const players = [];
      
      playersSnapshot.forEach(doc => {
        const playerData = doc.data();
        // Only include active players (not soft deleted)
        if (playerData.isActive !== false) {
          players.push({
            id: doc.id,
            numericId: playerData.numericId,
            displayId: playerData.numericId || doc.id,
            ...playerData
          });
        }
      });

      // Sort players alphabetically by name
      players.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          data: players 
        }),
      };
    }

    // GET /api/players/preview-recalculate-stats - Preview player statistics recalculation
    if (method === 'GET' && path === '/preview-recalculate-stats') {
      console.log('ðŸ“Š Starting player statistics recalculation preview...');

      // Get all existing players first
      const playersSnapshot = await collections.players.get();
      const existingPlayers = new Map();
      const playerNames = new Map(); // normalized name -> player IDs

      playersSnapshot.forEach(doc => {
        const player = { id: doc.id, ...doc.data() };
        if (player.isActive !== false && player.name) {
          existingPlayers.set(doc.id, player);
          const normalizedName = player.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
          if (!playerNames.has(normalizedName)) {
            playerNames.set(normalizedName, []);
          }
          playerNames.get(normalizedName).push(doc.id);
        }
      });

      console.log(`ï¿½ Found ${existingPlayers.size} active players in database`);

      // Get all matches
      const matchesSnapshot = await collections.matches.get();
      const matches = [];
      matchesSnapshot.forEach(doc => {
        matches.push({ id: doc.id, ...doc.data() });
      });

      console.log(`ðŸ“Š Processing ${matches.length} matches for preview...`);

      // Initialize player mapping
      const playerMapping = new Map(); // matchPlayerName -> { databasePlayerId, databasePlayerName, matchCount }

      // Process each match to build mapping
      for (const match of matches) {
        // Load innings data from Firestore
        try {
          const inningsSnapshot = await collections.matches.doc(match.id).collection('innings').orderBy('inningNumber').get();

          if (inningsSnapshot.empty) {
            console.log(`No innings data found in Firestore for match ${match.id}`);
            continue;
          }

          console.log(`Found ${inningsSnapshot.size} innings in Firestore for match ${match.id}`);

          for (const inningDoc of inningsSnapshot.docs) {
            const inning = inningDoc.data();
            console.log(`Processing inning ${inning.inningNumber} for preview`);

            // Process batsmen from inning document (stored as array, not subcollection)
            if (inning.batsmen && Array.isArray(inning.batsmen)) {
              for (const batsman of inning.batsmen) {
                if (!batsman.playerId) continue;

                // Get player data by document ID (playerId in match data is the Firestore document ID)
                const playerData = existingPlayers.get(batsman.playerId);
                if (!playerData) continue;

                const playerName = playerData.name;
                if (!playerName) continue;

                // Track mapping for reporting
                if (!playerMapping.has(playerName)) {
                  playerMapping.set(playerName, {
                    databasePlayerId: batsman.playerId, // We already have the correct player ID
                    databasePlayerName: playerName,
                    matchCount: 0
                  });
                }
                playerMapping.get(playerName).matchCount++;
              }
            }

            // Process bowlers from inning document (stored as array, not subcollection)
            if (inning.bowlers && Array.isArray(inning.bowlers)) {
              for (const bowler of inning.bowlers) {
                if (!bowler.playerId) continue;

                // Get player data by document ID (playerId in match data is the Firestore document ID)
                const bowlerPlayerData = existingPlayers.get(bowler.playerId);
                if (!bowlerPlayerData) continue;

                const bowlerPlayerName = bowlerPlayerData.name;
                if (!bowlerPlayerName) continue;

                // Track mapping for reporting
                if (!playerMapping.has(bowlerPlayerName)) {
                  playerMapping.set(bowlerPlayerName, {
                    databasePlayerId: bowler.playerId, // We already have the correct player ID
                    databasePlayerName: bowlerPlayerName,
                    matchCount: 0
                  });
                }
                playerMapping.get(bowlerPlayerName).matchCount++;
              }
            }
          }
        } catch (error) {
          console.error(`Error processing innings for match ${match.id}:`, error);
        }
      }

      console.log(`ðŸ“Š Preview calculated mapping for ${playerMapping.size} players`);

      // Convert player mapping to array for response
      const mappingArray = Array.from(playerMapping.entries()).map(([matchName, mapping]) => ({
        matchPlayerName: matchName,
        databasePlayerId: mapping.databasePlayerId,
        databasePlayerName: mapping.databasePlayerName,
        matchCount: mapping.matchCount,
        status: mapping.databasePlayerId ? 'matched' : 'unmatched'
      }));

      // Sort mapping by status (unmatched first), then by match count
      mappingArray.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'unmatched' ? -1 : 1; // Unmatched first
        }
        return b.matchCount - a.matchCount; // Higher match count first
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Player statistics recalculation preview completed',
          data: {
            totalPlayersInDatabase: existingPlayers.size,
            playerMapping: mappingArray,
            matchesProcessed: matches.length
          }
        }),
      };
    }

    // GET /api/players/:numericId - Get player by numericId
    if (method === 'GET' && path && path.match(/^\/[^\/]+$/)) {
      const numericId = path.substring(1); // Remove leading slash
      const playerDoc = await findDocumentByNumericId(collections.players, numericId);
      
      if (!playerDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            id: playerDoc.id,
            numericId: playerDoc.data().numericId,
            displayId: playerDoc.data().numericId || playerDoc.id,
            ...playerDoc.data()
          }
        }),
      };
    }

    // GET /api/players/:numericId/matches - Get detailed match performance for a player
    if (method === 'GET' && path && path.match(/^\/[^\/]+\/matches$/)) {
      const numericId = path.split('/')[1]; // Extract player numericId from /:numericId/matches
      console.log('Getting matches for player numericId:', numericId);

      const playerDoc = await findDocumentByNumericId(collections.players, numericId);

      if (!playerDoc) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player not found' }),
        };
      }

      const player = { id: playerDoc.id, ...playerDoc.data() };

      // Use cross-reference data if available, otherwise fall back to scanning matches
      let playerMatches = [];
      let summary = {
        totalMatches: 0,
        totalRuns: 0,
        totalWickets: 0,
        totalCatches: 0
      };

      if (player.matchHistory && Array.isArray(player.matchHistory)) {
        // Use pre-computed cross-reference data
        console.log(`Using cross-reference data for ${player.matchHistory.length} matches`);
        playerMatches = player.matchHistory.map(match => ({
          matchId: match.matchId,
          matchDate: match.matchDate,
          team1: match.team1,
          team2: match.team2,
          venue: match.venue,
          result: match.result,
          contributions: match.contributions
        }));

        // Calculate summary from contributions
        for (const match of player.matchHistory) {
          for (const contribution of match.contributions) {
            if (contribution.type === 'batting') {
              summary.totalRuns += contribution.runs || 0;
            } else if (contribution.type === 'bowling') {
              summary.totalWickets += contribution.wickets || 0;
            } else if (contribution.type === 'fielding' && contribution.action === 'catch') {
              summary.totalCatches += contribution.count || 0;
            }
          }
        }
        summary.totalMatches = player.matchHistory.length;
      } else {
        // Fall back to the original scanning method
        console.log('No cross-reference data found, scanning matches...');

        // Get all matches
        const matchesSnapshot = await collections.matches.get();
        const matches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        for (const match of matches) {
          let playerFoundInMatch = false;
          const matchDetails = {
            matchId: match.id,
            matchDate: match.scheduledDate || match.date,
            team1: match.teams?.team1?.name || match.team1?.name || 'Team 1',
            team2: match.teams?.team2?.name || match.team2?.name || 'Team 2',
            venue: match.venue,
            result: match.result,
            contributions: []
          };

          // Check each inning for this player
          const inningsSnapshot = await collections.matches.doc(match.id).collection('innings').orderBy('inningNumber').get();

          for (const inningDoc of inningsSnapshot.docs) {
            const inning = { id: inningDoc.id, ...inningDoc.data() };

            // Check batting performance - arrays in inning document
            if (inning.batsmen && Array.isArray(inning.batsmen)) {
              const battingRecord = inning.batsmen.find(b => b.playerId === player.id); // Use document ID
              if (battingRecord) {
                playerFoundInMatch = true;
                matchDetails.contributions.push({
                  type: 'batting',
                  inningNumber: inning.inningNumber,
                  runs: battingRecord.runs || 0,
                  balls: battingRecord.balls || 0,
                  fours: battingRecord.fours || 0,
                  sixes: battingRecord.sixes || 0,
                  dismissal: battingRecord.statusParsed || battingRecord.status || 'not out',
                  strikeRate: battingRecord.balls > 0 ? ((battingRecord.runs / battingRecord.balls) * 100).toFixed(2) : 0
                });
                summary.totalRuns += battingRecord.runs || 0;
              }
            }

            // Check bowling performance - arrays in inning document
            if (inning.bowlers && Array.isArray(inning.bowlers)) {
              const bowlingRecord = inning.bowlers.find(b => b.playerId === player.id); // Use document ID
              if (bowlingRecord) {
                playerFoundInMatch = true;
                matchDetails.contributions.push({
                  type: 'bowling',
                  inningNumber: inning.inningNumber,
                  overs: bowlingRecord.overs || 0,
                  maidens: bowlingRecord.maidens || 0,
                  runs: bowlingRecord.runs || 0,
                  wickets: bowlingRecord.wickets || 0,
                  economy: bowlingRecord.overs > 0 ? (bowlingRecord.runs / parseFloat(bowlingRecord.overs)).toFixed(2) : 0
                });
                summary.totalWickets += bowlingRecord.wickets || 0;
              }
            }

            // Check for catches (fielding) - look for this player as wicket taker in batsmen
            if (inning.batsmen && Array.isArray(inning.batsmen)) {
              let catchesInThisInning = 0;
              for (const batsman of inning.batsmen) {
                // Check if this batsman was caught by the current player
                if (batsman.status && batsman.status.includes('c ') &&
                    batsman.status.includes(player.name.replace(/\s*\([^)]*\)\s*/g, '').trim())) {
                  catchesInThisInning++;
                  playerFoundInMatch = true;
                }
              }
              if (catchesInThisInning > 0) {
                matchDetails.contributions.push({
                  type: 'fielding',
                  inningNumber: inning.inningNumber,
                  action: 'catch',
                  count: catchesInThisInning
                });
                summary.totalCatches += catchesInThisInning;
              }
            }
          }

          if (playerFoundInMatch) {
            playerMatches.push(matchDetails);
            summary.totalMatches++;
          }
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          data: {
            player: {
              id: player.id,
              name: player.name,
              displayId: player.numericId || player.id
            },
            matches: playerMatches,
            summary: summary
          }
        }),
      };
    }

    // POST /api/players - Create new player
    if (method === 'POST' && path === '/') {
      const playerData = JSON.parse(body);
      
      // Validate required fields
      if (!playerData.name) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player name is required' }),
        };
      }

      // Generate numeric ID for the player
      const numericId = await sequenceManager.getNextId('players');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('players');

      const docRef = await collections.players.doc(documentId).set({
        numericId: numericId,
        name: playerData.name,
        age: playerData.age || null,
        role: playerData.role || 'all-rounder',
        battingStyle: playerData.battingStyle || null,
        bowlingStyle: playerData.bowlingStyle || null,
        nationality: playerData.nationality || null,
        avatar: playerData.avatar || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const newPlayer = await collections.players.doc(documentId).get();
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          data: {
            id: newPlayer.id,
            ...newPlayer.data()
          }
        }),
      };
    }

    // PUT /api/players/:id - Update player
    if (method === 'PUT' && path && path.match(/^\/[^\/]+$/)) {
      const playerId = path.substring(1); // Remove leading slash
      const updateData = JSON.parse(body);
      
      // Check if player exists
      const playerDoc = await collections.players.doc(playerId).get();
      if (!playerDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player not found' }),
        };
      }

      // Update player
      await collections.players.doc(playerId).update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      // Get updated player
      const updatedPlayer = await collections.players.doc(playerId).get();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          data: {
            id: updatedPlayer.id,
            ...updatedPlayer.data()
          }
        }),
      };
    }

    // POST /api/players/recalculate-stats - Recalculate player statistics from all matches
    if (method === 'POST' && path === '/recalculate-stats') {
      const requestBody = JSON.parse(body || '{}');
      const customMappings = requestBody.customMappings || {};

      console.log('ðŸ“Š Starting player statistics recalculation...');
      console.log('Custom mappings provided:', Object.keys(customMappings).length);

      // Get all existing players first
      const playersSnapshot = await collections.players.get();
      const existingPlayers = new Map();
      const playerNames = new Map(); // normalized name -> player IDs

      playersSnapshot.forEach(doc => {
        const player = { id: doc.id, ...doc.data() };
        if (player.isActive !== false && player.name) {
          existingPlayers.set(doc.id, player);
          const normalizedName = player.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
          if (!playerNames.has(normalizedName)) {
            playerNames.set(normalizedName, []);
          }
          playerNames.get(normalizedName).push(doc.id);
        }
      });

      console.log(`ðŸ“Š Found ${existingPlayers.size} active players in database`);

      // Get all matches
      const matchesSnapshot = await collections.matches.get();
      const matches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log(`ðŸ“Š Processing ${matches.length} matches for statistics recalculation`);

      // Initialize player stats
      const playerStats = new Map();
      const playerMapping = new Map(); // matchPlayerName -> { databasePlayerId, databasePlayerName, matchCount }

      // Process each match
      for (const match of matches) {
        const matchPlayers = new Set();

        // Process innings data if available
        try {
          const inningsSnapshot = await collections.matches.doc(match.id).collection('innings').get();
          if (!inningsSnapshot.empty) {
            console.log(`Processing ${inningsSnapshot.docs.length} innings for match ${match.id}`);

            for (const inningDoc of inningsSnapshot.docs) {
              const inning = inningDoc.data();
              console.log(`Processing inning ${inning.inningNumber}`);

              // Process batsmen from inning document (stored as array, not subcollection)
              if (inning.batsmen && Array.isArray(inning.batsmen)) {
                for (const batsman of inning.batsmen) {
                  if (!batsman.playerId) continue;

                  // Get player data by document ID (playerId in match data is the Firestore document ID)
                  const playerData = existingPlayers.get(batsman.playerId);
                  if (!playerData) continue;

                  const playerName = playerData.name;
                  if (!playerName) continue;

                  // Use the player ID directly (should match since we found it by ID)
                  let playerId = batsman.playerId;

                  // Initialize player stats if not exists
                  if (!playerStats.has(playerId)) {
                    playerStats.set(playerId, {
                      matchesPlayed: 0,
                      totalRuns: 0,
                      totalBalls: 0,
                      totalWickets: 0,
                      oversBowled: 0,
                      runsConceded: 0,
                      ballsBowled: 0,
                      inningsBatted: 0,
                      inningsBowled: 0,
                      notOuts: 0
                    });
                  }

                  const stats = playerStats.get(playerId);

                  // Update batting statistics
                  stats.totalRuns += batsman.runs || 0;
                  stats.totalBalls += batsman.balls || 0;
                  stats.inningsBatted += 1;
                  if (batsman.status && batsman.status.toLowerCase().includes('not out')) {
                    stats.notOuts += 1;
                  }

                  // Track mapping for reporting
                  if (!playerMapping.has(playerName)) {
                    playerMapping.set(playerName, {
                      databasePlayerId: playerId,
                      databasePlayerName: playerId ? existingPlayers.get(playerId).name : null,
                      matchCount: 0
                    });
                  }
                  playerMapping.get(playerName).matchCount++;
                }
              }

              // Process bowlers from inning document (stored as array, not subcollection)
              if (inning.bowlers && Array.isArray(inning.bowlers)) {
                for (const bowler of inning.bowlers) {
                  if (!bowler.playerId) continue;

                  // Get player data by document ID (playerId in match data is the Firestore document ID)
                  const bowlerPlayerData = existingPlayers.get(bowler.playerId);
                  if (!bowlerPlayerData) continue;

                  const bowlerPlayerName = bowlerPlayerData.name;
                  if (!bowlerPlayerName) continue;

                  // Use the player ID directly (should match since we found it by ID)
                  let bowlerPlayerId = bowler.playerId;

                  // Initialize player stats if not exists
                  if (!playerStats.has(bowlerPlayerId)) {
                    playerStats.set(bowlerPlayerId, {
                      matchesPlayed: 0,
                      totalRuns: 0,
                      totalBalls: 0,
                      totalWickets: 0,
                      oversBowled: 0,
                      runsConceded: 0,
                      ballsBowled: 0,
                      inningsBatted: 0,
                      inningsBowled: 0,
                      notOuts: 0
                    });
                  }

                  const bowlerStats = playerStats.get(bowlerPlayerId);

                  // Update bowling statistics
                  bowlerStats.totalWickets += bowler.wickets || 0;
                  bowlerStats.runsConceded += bowler.runs || 0;
                  bowlerStats.ballsBowled += bowler.balls || 0;
                  bowlerStats.oversBowled += bowler.overs || 0;
                  bowlerStats.inningsBowled += 1;

                  matchPlayers.add(bowlerPlayerId);

                  // Track mapping for reporting
                  if (!playerMapping.has(bowlerPlayerName)) {
                    playerMapping.set(bowlerPlayerName, {
                      databasePlayerId: bowlerPlayerId,
                      databasePlayerName: bowlerPlayerId ? existingPlayers.get(bowlerPlayerId).name : null,
                      matchCount: 0
                    });
                  }
                  playerMapping.get(bowlerPlayerName).matchCount++;
                }
              }
            }
          } else {
            console.log(`No innings data found in Firestore for match ${match.id}`);
          }
        } catch (error) {
          console.error(`Error processing innings for match ${match.id}:`, error);
        }

        // Mark all players who participated in this match
        for (const playerId of matchPlayers) {
          if (playerStats.has(playerId)) {
            playerStats.get(playerId).matchesPlayed += 1;
          }
        }
      }

      // Convert player mapping to array for response
      const recalcMappingArray = Array.from(playerMapping.entries()).map(([matchName, mapping]) => ({
        matchPlayerName: matchName,
        databasePlayerId: mapping.databasePlayerId,
        databasePlayerName: mapping.databasePlayerName,
        matchCount: mapping.matchCount,
        status: mapping.databasePlayerId ? 'matched' : 'unmatched'
      }));

      // Sort mapping by status (unmatched first), then by match count
      recalcMappingArray.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'unmatched' ? -1 : 1; // Unmatched first
        }
        return b.matchCount - a.matchCount; // Higher match count first
      });

      let playersUpdated = 0;

      // Update player statistics in database
      for (const [playerId, stats] of playerStats) {
        // Skip if player doesn't exist in database
        if (!existingPlayers.has(playerId)) {
          console.log(`âš ï¸ Skipping player ${playerId} - not found in database`);
          continue;
        }

        const battingAverage = stats.inningsBatted > 0 ? (stats.totalRuns / (stats.inningsBatted - stats.notOuts)) : 0;
        const bowlingAverage = stats.totalWickets > 0 ? (stats.runsConceded / stats.totalWickets) : 0;
        const battingStrikeRate = stats.totalBalls > 0 ? ((stats.totalRuns / stats.totalBalls) * 100) : 0;
        const bowlingEconomy = stats.ballsBowled > 0 ? ((stats.runsConceded / stats.ballsBowled) * 6) : 0;

        const updateData = {
          matchesPlayed: stats.matchesPlayed,
          totalRuns: stats.totalRuns,
          totalBalls: stats.totalBalls,
          totalWickets: stats.totalWickets,
          oversBowled: stats.oversBowled,
          runsConceded: stats.runsConceded,
          ballsBowled: stats.ballsBowled,
          inningsBatted: stats.inningsBatted,
          inningsBowled: stats.inningsBowled,
          notOuts: stats.notOuts,
          battingAverage: battingAverage,
          bowlingAverage: bowlingAverage,
          battingStrikeRate: battingStrikeRate,
          bowlingEconomy: bowlingEconomy,
          statsLastUpdated: new Date().toISOString()
        };

        try {
          await collections.players.doc(playerId).update(updateData);
          playersUpdated++;
          console.log(`âœ… Updated player ${playerId}`);
        } catch (error) {
          console.error(`âŒ Error updating player ${playerId}:`, error);
        }
      }

      console.log(`âœ… Updated statistics for ${playersUpdated} players`);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Player statistics recalculated successfully',
          data: {
            matchesProcessed: matches.length,
            playersUpdated: playersUpdated,
            totalPlayersInDatabase: existingPlayers.size,
            playerMapping: recalcMappingArray
          }
        }),
      };
    }

    // POST /api/players/merge - Merge multiple players into one
    if (method === 'POST' && path === '/merge') {
      const requestBody = JSON.parse(body || '{}');
      const { primaryPlayerId, playersToMerge } = requestBody;

      if (!primaryPlayerId || !playersToMerge || !Array.isArray(playersToMerge) || playersToMerge.length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'primaryPlayerId and playersToMerge array are required' }),
        };
      }

      if (playersToMerge.includes(primaryPlayerId)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Cannot merge a player with itself' }),
        };
      }

      console.log(`🔄 Merging players into ${primaryPlayerId}:`, playersToMerge);

      // Get primary player
      const primaryDoc = await collections.players.doc(primaryPlayerId).get();
      if (!primaryDoc.exists) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Primary player not found' }),
        };
      }

      const primaryData = primaryDoc.data();
      let mergedStats = { ...primaryData.stats } || {
        matchesPlayed: 0,
        totalRuns: 0,
        totalBalls: 0,
        totalWickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        ballsBowled: 0,
        inningsBatted: 0,
        inningsBowled: 0,
        notOuts: 0,
        highestScore: 0,
        bestBowling: '0/0'
      };

      const mergedPlayers = [];

      // Process each player to merge
      for (const secondaryPlayerId of playersToMerge) {
        const secondaryDoc = await collections.players.doc(secondaryPlayerId).get();
        if (!secondaryDoc.exists) {
          console.log(`⚠️ Secondary player ${secondaryPlayerId} not found, skipping`);
          continue;
        }

        const secondaryData = secondaryDoc.data();
        const secondaryStats = secondaryData.stats || {};

        // Merge statistics
        mergedStats.matchesPlayed += secondaryStats.matchesPlayed || 0;
        mergedStats.totalRuns += secondaryStats.totalRuns || 0;
        mergedStats.totalBalls += secondaryStats.totalBalls || 0;
        mergedStats.totalWickets += secondaryStats.totalWickets || 0;
        mergedStats.oversBowled += secondaryStats.oversBowled || 0;
        mergedStats.runsConceded += secondaryStats.runsConceded || 0;
        mergedStats.ballsBowled += secondaryStats.ballsBowled || 0;
        mergedStats.inningsBatted += secondaryStats.inningsBatted || 0;
        mergedStats.inningsBowled += secondaryStats.inningsBowled || 0;
        mergedStats.notOuts += secondaryStats.notOuts || 0;
        mergedStats.highestScore = Math.max(mergedStats.highestScore || 0, secondaryStats.highestScore || 0);
        mergedStats.bestBowling = getBetterBowlingFigure(mergedStats.bestBowling, secondaryStats.bestBowling);

        // Soft delete secondary player
        await collections.players.doc(secondaryPlayerId).update({
          isActive: false,
          mergedInto: primaryPlayerId,
          updatedAt: new Date().toISOString()
        });

        mergedPlayers.push({
          id: secondaryPlayerId,
          name: secondaryData.name
        });

        console.log(`✅ Merged ${secondaryPlayerId} (${secondaryData.name}) into ${primaryPlayerId}`);
      }

      // Recalculate averages
      mergedStats.battingAverage = mergedStats.inningsBatted > 0 ? 
        (mergedStats.totalRuns / (mergedStats.inningsBatted - mergedStats.notOuts)) : 0;
      mergedStats.bowlingAverage = mergedStats.totalWickets > 0 ? 
        (mergedStats.runsConceded / mergedStats.totalWickets) : 0;
      mergedStats.battingStrikeRate = mergedStats.totalBalls > 0 ? 
        ((mergedStats.totalRuns / mergedStats.totalBalls) * 100) : 0;
      mergedStats.bowlingEconomy = mergedStats.ballsBowled > 0 ? 
        ((mergedStats.runsConceded / mergedStats.ballsBowled) * 6) : 0;
      mergedStats.statsLastUpdated = new Date().toISOString();

      // Update primary player with merged stats
      await collections.players.doc(primaryPlayerId).update({
        stats: mergedStats,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Successfully merged ${mergedPlayers.length} players into ${primaryPlayerId}`);

      // Update team lineups that reference merged players
      let teamLineupsUpdated = 0;
      for (const secondaryPlayerId of playersToMerge) {
        const teamLineupsQuery = await collections.teamLineups.where('playerId', '==', secondaryPlayerId).get();
        for (const teamLineupDoc of teamLineupsQuery.docs) {
          await collections.teamLineups.doc(teamLineupDoc.id).update({
            playerId: primaryPlayerId,
            updatedAt: new Date().toISOString()
          });
          teamLineupsUpdated++;
        }
      }

      // Update match data that references merged players (batsmen, bowlers, etc.)
      let matchesUpdated = 0;
      const matchesSnapshot = await collections.matches.get();
      for (const matchDoc of matchesSnapshot.docs) {
        let matchUpdated = false;

        // Update innings subcollections (legacy structure)
        const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').get();
        for (const inningDoc of inningsSnapshot.docs) {
          // Update batsmen
          const batsmenSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').get();
          for (const batsmanDoc of batsmenSnapshot.docs) {
            const batsmanData = batsmanDoc.data();
            if (playersToMerge.includes(batsmanData.playerId)) {
              await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').doc(batsmanDoc.id).update({
                playerId: primaryPlayerId,
                playerName: primaryData.name,
                updatedAt: new Date().toISOString()
              });
              matchUpdated = true;
            }
          }

          // Update bowlers
          const bowlersSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').get();
          for (const bowlerDoc of bowlersSnapshot.docs) {
            const bowlerData = bowlerDoc.data();
            if (playersToMerge.includes(bowlerData.playerId)) {
              await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').doc(bowlerDoc.id).update({
                playerId: primaryPlayerId,
                playerName: primaryData.name,
                updatedAt: new Date().toISOString()
              });
              matchUpdated = true;
            }
          }
        }

        // Update innings documents (current array-based structure)
        for (const inningDoc of inningsSnapshot.docs) {
          const inningData = inningDoc.data();
          let inningUpdated = false;

          // Update batsmen array
          if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
            for (let i = 0; i < inningData.batsmen.length; i++) {
              const batsman = inningData.batsmen[i];
              if (batsman.playerId && playersToMerge.includes(batsman.playerId)) {
                inningData.batsmen[i] = {
                  ...batsman,
                  playerId: primaryPlayerId, // Use document ID, not numeric ID
                  playerName: primaryData.name, // Update player name too
                  updatedAt: new Date().toISOString()
                };
                inningUpdated = true;
                matchUpdated = true;
              }
              // Also update player name references in dismissal text
              if (batsman.dismissal && typeof batsman.dismissal === 'string') {
                for (const secondaryPlayerId of playersToMerge) {
                  const secondaryPlayer = await collections.players.doc(secondaryPlayerId).get();
                  if (secondaryPlayer.exists) {
                    const secondaryName = secondaryPlayer.data().name;
                    if (batsman.dismissal.includes(secondaryName)) {
                      batsman.dismissal = batsman.dismissal.replace(new RegExp(secondaryName, 'g'), primaryData.name);
                      inningUpdated = true;
                      matchUpdated = true;
                    }
                  }
                }
              }
            }
          }

          // Update bowling array
          if (inningData.bowling && Array.isArray(inningData.bowling)) {
            for (let i = 0; i < inningData.bowling.length; i++) {
              const bowler = inningData.bowling[i];
              if (bowler.playerId && playersToMerge.includes(bowler.playerId)) {
                inningData.bowling[i] = {
                  ...bowler,
                  playerId: primaryPlayerId, // Use document ID, not numeric ID
                  playerName: primaryData.name, // Update player name too
                  updatedAt: new Date().toISOString()
                };
                inningUpdated = true;
                matchUpdated = true;
              }
            }
          }

          // Update fall of wickets if it contains player names
          if (inningData.fallOfWickets && Array.isArray(inningData.fallOfWickets)) {
            for (let i = 0; i < inningData.fallOfWickets.length; i++) {
              const fow = inningData.fallOfWickets[i];
              if (fow.batsmanName && typeof fow.batsmanName === 'string') {
                for (const secondaryPlayerId of playersToMerge) {
                  const secondaryPlayer = await collections.players.doc(secondaryPlayerId).get();
                  if (secondaryPlayer.exists) {
                    const secondaryName = secondaryPlayer.data().name;
                    if (fow.batsmanName.includes(secondaryName)) {
                      fow.batsmanName = fow.batsmanName.replace(new RegExp(secondaryName, 'g'), primaryData.name);
                      inningUpdated = true;
                      matchUpdated = true;
                    }
                  }
                }
              }
            }
          }

          // Update the inning document if it was modified
          if (inningUpdated) {
            await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).update({
              ...inningData,
              updatedAt: new Date().toISOString()
            });
          }
        }

        if (matchUpdated) {
          matchesUpdated++;
        }
      }

      // Get updated primary player
      const updatedPrimary = await collections.players.doc(primaryPlayerId).get();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: `Successfully merged ${mergedPlayers.length} players`,
          data: {
            primaryPlayer: {
              id: updatedPrimary.id,
              ...updatedPrimary.data()
            },
            mergedPlayers: mergedPlayers,
            mergedStats: mergedStats
          },
          stats: {
            playersDeactivated: mergedPlayers.length,
            teamLineupsUpdated: teamLineupsUpdated,
            matchesUpdated: matchesUpdated
          }
        }),
      };
    }

    // DELETE /api/players/:id - Delete player (soft delete)
    if (method === 'DELETE' && path && path.match(/^\/[^\/]+$/)) {
      const playerId = path.substring(1); // Remove leading slash
      
      console.log('ðŸ—‘ï¸ DELETE request for player ID:', playerId);
      
      // Check if player exists
      const playerDoc = await collections.players.doc(playerId).get();
      if (!playerDoc.exists) {
        console.log('âŒ Player not found:', playerId);
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Player not found' }),
        };
      }

      console.log('âœ… Player found, performing soft delete for:', playerId);
      
      // Soft delete player
      await collections.players.doc(playerId).update({
        isActive: false,
        updatedAt: new Date().toISOString()
      });
      
      console.log('âœ… Player soft deleted successfully:', playerId);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Player deactivated successfully',
          playerId: playerId
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
};
