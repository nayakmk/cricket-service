/**
 * COMPLETE DATA REIMPORT SCRIPT - CRITICAL MAINTENANCE INSTRUCTION
 *
 * 🚨 CRITICAL: This script must be kept in sync with all data processing changes!
 *
 * PURPOSE:
 * This script performs a complete reimport of all cricket data, cleaning and rebuilding
 * the entire database from raw JSON data. It ensures data integrity and consistency.
 *
 * MAINTENANCE REQUIREMENTS:
 * ⚠️  Whenever you make ANY changes to data structures, processing logic, or add new
 *    data relationships, you MUST update this script accordingly.
 *
 * REQUIRED UPDATES WHEN:
 * 1. Adding new data fields to matches, teams, or players
 * 2. Changing data import logic or validation rules
 * 3. Adding new cross-references or relationships
 * 4. Modifying statistics calculations or aggregations
 * 5. Adding new data processing utilities or managers
 * 6. Changing match data structure or team/player references
 * 7. Fixing PDF extraction bugs (e.g., batting stats column parsing)
 * 8. Updating winner resolution logic or match ID handling
 *
 * STEPS TO UPDATE:
 * 1. Review each step in runCompleteReimport() method
 * 2. Add new steps for any new data processing requirements
 * 3. Update existing steps to handle new data fields/logic
 * 4. Test the complete reimport process end-to-end
 * 5. Verify data integrity and relationships are maintained
 *
 * CURRENT PROCESS (11 Steps):
 * 1. Clean up existing data
 * 2. Initialize sequences
 * 3. Load and import matches data
 * 4. Add cross-references to players
 * 5. Update player statistics
 * 6. Populate team players
 * 7. Populate team match history
 * 8. Recalculate team statistics
 * 9. Run update-player-stats.js
 * 10. Verify data integrity
 * 11. Run comprehensive validation
 *
 * FAILURE TO UPDATE = DATA CORRUPTION RISK
 * Always run this script after major data changes to ensure consistency!
 */

const fs = require('fs');
const path = require('path');
const { collections, db, admin } = require('../config/database');
const { sequenceManager } = require('../utils/sequenceManager');
const { populateTeamMatchHistory } = require('./populate-team-match-history');
const { TeamStatisticsManager } = require('../utils/teamStatisticsManager');
const { DataValidator } = require('./validate-data-integrity');

class CompleteDataReimport {
  constructor() {
    this.matchesData = [];
    this.teamsMap = new Map(); // name -> firestore id
    this.playersMap = new Map(); // name -> firestore id
    this.playersNumericMap = new Map(); // name -> numeric id
    this.processedMatches = [];
    this.playerMatchHistory = new Map();
  }

  async runCompleteReimport() {
    console.log('🚀 Starting complete data reimport process...');

    try {
      // Step 1: Clean up all existing data
      console.log('🧹 Step 1: Cleaning up existing data...');
      await this.deleteAllData();

      // Step 2: Initialize sequences
      console.log('🔢 Step 2: Initializing sequences...');
      await this.initializeSequences();

      // Step 3: Load and import matches data
      console.log('📊 Step 3: Loading and importing matches data...');
      await this.loadAndImportMatchesData();

      // Step 4: Add cross-references to players
      console.log('🔗 Step 4: Adding cross-references to players...');
      await this.addPlayerCrossReferences();

      // Step 5: Update player statistics
      console.log('📈 Step 5: Updating player statistics...');
      await this.updatePlayerStatistics();

      // Step 6: Populate team players
      console.log('👥 Step 6: Populating team players...');
      await this.populateTeamPlayers();

      // Step 7: Populate team match history
      console.log('🏏 Step 7: Populating team match history...');
      await populateTeamMatchHistory();

      // Step 8: Recalculate team statistics
      console.log('📊 Step 8: Recalculating team statistics...');
      await TeamStatisticsManager.recalculateAllTeamStatistics();

      // Step 9: Run update-player-stats.js
      console.log('📈 Step 9: Running update-player-stats.js...');
      await this.runUpdatePlayerStats();

      // Step 10: Verify data integrity
      console.log('✅ Step 10: Verifying data integrity...');
      await this.verifyDataIntegrity();

      // Step 11: Run comprehensive validation
      console.log('🔍 Step 11: Running comprehensive data validation...');
      const validator = new DataValidator();
      await validator.runValidation();

      console.log('🎉 Complete data reimport process finished successfully!');

    } catch (error) {
      console.error('❌ Error during reimport process:', error);
      throw error;
    }
  }

  async deleteAllData() {
    const collectionsToDelete = [
      'matches',
      'teams',
      'players',
      'teamLineups',
      'innings',
      'balls',
      'users',
      'sequences'
    ];

    for (const collectionName of collectionsToDelete) {
      try {
        await this.deleteCollection(collectionName);
        console.log(`✓ Deleted all documents from ${collectionName} collection`);
      } catch (error) {
        console.error(`✗ Error deleting ${collectionName} collection:`, error);
      }
    }
  }

  async deleteCollection(collectionName) {
    const collectionRef = collections[collectionName];
    const batchSize = 500;

    while (true) {
      const snapshot = await collectionRef.limit(batchSize).get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`  Deleted ${snapshot.docs.length} documents from ${collectionName}`);
    }
  }

  async initializeSequences() {
    const sequences = [
      { collection: 'matches', startValue: 1 },
      { collection: 'teams', startValue: 1 },
      { collection: 'players', startValue: 1 },
      { collection: 'teamLineups', startValue: 1 },
      { collection: 'innings', startValue: 1 }
    ];

    for (const seq of sequences) {
      await sequenceManager.initializeSequence(seq.collection, seq.startValue);
      console.log(`✓ Initialized sequence for ${seq.collection} starting at ${seq.startValue}`);
    }
  }

  async loadAndImportMatchesData() {
    // Load matches data
    const filePath = path.join(__dirname, '..', 'reports', 'cricket_matches_from_pdfs_final.json');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Matches data file not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    this.matchesData = Array.isArray(data) ? data : [data];
    console.log(`Loaded ${this.matchesData.length} matches from JSON file`);

    // Import all data
    for (const matchData of this.matchesData) {
      await this.importMatch(matchData);
    }

    console.log(`✓ Imported ${this.processedMatches.length} matches`);
  }

  async importMatch(matchData) {
    try {
      // Create/update teams
      const team1DocId = await this.upsertTeam(matchData.teams?.team1 || 'Team 1');
      const team2DocId = await this.upsertTeam(matchData.teams?.team2 || 'Team 2');

      // Check if team creation was successful
      if (!team1DocId || !team2DocId) {
        console.error(`✗ Failed to create teams for match: ${matchData.title || matchData.match_id}`);
        return;
      }

      // Get team numericIds
      const team1Data = (await collections.teams.doc(team1DocId).get()).data();
      const team2Data = (await collections.teams.doc(team2DocId).get()).data();
      const team1NumericId = team1Data.numericId;
      const team2NumericId = team2Data.numericId;

      // Generate match document ID
      const matchNumericId = await sequenceManager.getNextId('matches');
      const matchDocumentId = await sequenceManager.generateDocumentId('matches');

      if (!matchDocumentId) {
        console.error(`✗ Failed to generate document ID for match: ${matchData.title || matchData.match_id}`);
        return;
      }

      // Resolve winner_id from winner name first
      let winner_id = null;
      const winnerName = matchData.result?.winner || matchData.winner || null;
      if (winnerName) {
        if (winnerName === matchData.teams?.team1) {
          winner_id = team1NumericId;
        } else if (winnerName === matchData.teams?.team2) {
          winner_id = team2NumericId;
        }
      }

      // Prepare match data with correct structure
      const matchDoc = {
        numericId: matchNumericId,
        matchId: matchData.match_id || matchData.id, // Store original match ID from JSON
        title: matchData.title || `${matchData.teams?.team1 || 'Team 1'} vs ${matchData.teams?.team2 || 'Team 2'}` || `Match ${matchNumericId}`,
        tournament: matchData.tournament || 'Unknown Tournament',
        matchType: matchData.match_type || matchData.type || 'T20',
        venue: matchData.ground || matchData.venue || 'Unknown Venue',
        status: matchData.status || 'completed',
        scheduledDate: matchData.date ? new Date(matchData.date).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        teams: {
          team1: {
            id: team1NumericId,
            name: matchData.teams?.team1 || 'Team 1',
            shortName: (matchData.teams?.team1 || 'Team 1').split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3)
          },
          team2: {
            id: team2NumericId,
            name: matchData.teams?.team2 || 'Team 2',
            shortName: (matchData.teams?.team2 || 'Team 2').split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3)
          }
        },
        team1Id: team1NumericId,
        team2Id: team2NumericId,
        team1Score: matchData.team1_score || matchData.team1Score || 0,
        team2Score: matchData.team2_score || matchData.team2Score || 0,
        winner: winnerName,
        winner_id: winner_id,
        result: {
          winner: winner_id,
          margin: matchData.result?.margin || 'Match completed'
        },
        toss: matchData.toss ? {
          winner: matchData.toss.winner === matchData.teams?.team1 ? team1NumericId :
                  matchData.toss.winner === matchData.teams?.team2 ? team2NumericId : null,
          decision: matchData.toss.decision
        } : null,
        currentInnings: matchData.current_innings || null
      };

      // Save match
      await collections.matches.doc(matchDocumentId).set(matchDoc);

      // Import innings data
      if (matchData.innings && Array.isArray(matchData.innings)) {
        for (const [index, inningData] of matchData.innings.entries()) {
          await this.importInning(matchDocumentId, inningData, index + 1, matchData);
        }
      }

      this.processedMatches.push(matchDoc);
      console.log(`✓ Imported match: ${matchDoc.title} (${matchDocumentId})`);

    } catch (error) {
      console.error(`✗ Error importing match:`, error);
    }
  }

  async importInning(matchId, inningData, inningNumber, matchData) {
    try {
      // Prepare batsmen data
      const batsmen = [];
      if (inningData.batting && Array.isArray(inningData.batting)) {
        for (const batsmanData of inningData.batting) {
          const playerId = await this.upsertPlayer(
            batsmanData.name,
            batsmanData.batting_style,
            batsmanData.is_captain,
            batsmanData.is_wicket_keeper
          );
          if (playerId) {
            // Process how_out field to create dismissal text
            let dismissal = 'not out';
            if (batsmanData.how_out) {
              if (typeof batsmanData.how_out === 'string') {
                dismissal = batsmanData.how_out;
              } else if (batsmanData.how_out.text) {
                dismissal = batsmanData.how_out.text;
              } else if (batsmanData.how_out.type) {
                dismissal = batsmanData.how_out.type;
              }
            } else if (batsmanData.dismissal) {
              dismissal = batsmanData.dismissal;
            } else if (batsmanData.status) {
              dismissal = batsmanData.status;
            }

            batsmen.push({
              playerId: playerId,
              player: await this.getCompletePlayerObject(playerId),
              runs: batsmanData.runs || 0,
              balls: batsmanData.balls || 0,
              fours: batsmanData.fours || 0,
              sixes: batsmanData.sixes || 0,
              status: dismissal,
              statusParsed: dismissal,
              strikeRate: batsmanData.balls > 0 ? ((batsmanData.runs / batsmanData.balls) * 100).toFixed(2) : 0,
              // Process how_out object to convert player names to playerIds
              howOut: batsmanData.how_out ? this.processHowOut(batsmanData.how_out, this.playersMap, this.playersNumericMap) : null
            });
          }
        }
      }

      // Prepare bowlers data
      const bowlers = [];
      if (inningData.bowling && Array.isArray(inningData.bowling)) {
        for (const bowlerData of inningData.bowling) {
          const isCaptain = bowlerData.is_captain || false;
          const isWicketKeeper = bowlerData.is_wicket_keeper || false;
          const playerId = await this.upsertPlayer(bowlerData.name, null, isCaptain, isWicketKeeper);
          if (playerId) {
            bowlers.push({
              playerId: playerId,
              player: await this.getCompletePlayerObject(playerId),
              overs: bowlerData.overs || 0,
              maidens: bowlerData.maidens || 0,
              runs: bowlerData.runs || 0,
              wickets: bowlerData.wickets || 0,
              economy: bowlerData.economy || (bowlerData.overs > 0 ? (bowlerData.runs / bowlerData.overs).toFixed(2) : 0),
              dots: bowlerData.dots || 0,
              fours: bowlerData.fours || 0,
              sixes: bowlerData.sixes || 0
            });
          }
        }
      }

      // Determine bowling team (opposition)
      const battingTeam = inningData.batting_team || inningData.team;
      const team1 = matchData.teams?.team1 || matchData.team1?.name || matchData.team1_name;
      const team2 = matchData.teams?.team2 || matchData.team2?.name || matchData.team2_name;
      const bowlingTeam = battingTeam === team1 ? team2 : team1;

      // Parse score to extract runs and wickets
      let totalRuns = 0;
      let totalWickets = 0;

      if (inningData.score && typeof inningData.score === 'string' && inningData.score.includes('/')) {
        const [runsStr, wicketsStr] = inningData.score.split('/');
        totalRuns = parseInt(runsStr, 10) || 0;
        totalWickets = parseInt(wicketsStr, 10) || 0;
      } else {
        // Fallback to direct fields if available
        totalRuns = inningData.total_runs || inningData.score || 0;
        totalWickets = inningData.total_wickets || inningData.wickets || 0;
      }

      // Prepare inning document
      const inningDoc = {
        inningNumber: inningNumber,
        battingTeam: battingTeam,
        bowlingTeam: bowlingTeam,
        totalRuns: totalRuns,
        totalWickets: totalWickets,
        totalOvers: inningData.total_overs || inningData.overs || 0,
        totalBalls: inningData.total_balls || inningData.balls || 0,
        runRate: inningData.run_rate || 0,
        batsmen: batsmen,
        bowlers: bowlers,
        fallOfWickets: this.processFallOfWickets(inningData.fall_of_wickets, this.playersMap, this.playersNumericMap)
      };

      // Generate inning document ID
      const inningDocumentId = await sequenceManager.generateDocumentId('innings');

      // Save inning
      const inningRef = collections.matches.doc(matchId).collection('innings').doc(inningDocumentId);
      await inningRef.set(inningDoc);

      console.log(`  ✓ Imported inning ${inningNumber} for match ${matchId}`);

    } catch (error) {
      console.error(`✗ Error importing inning ${inningNumber} for match ${matchId}:`, error);
    }
  }

  async upsertTeam(teamName) {
    if (!teamName || this.teamsMap.has(teamName)) {
      return this.teamsMap.get(teamName);
    }

    try {
      // Check if team already exists
      const existingQuery = await collections.teams.where('name', '==', teamName).limit(1).get();
      if (!existingQuery.empty) {
        const teamId = existingQuery.docs[0].id;
        this.teamsMap.set(teamName, teamId);
        return teamId;
      }

      // Generate numeric ID for the team
      const numericId = await sequenceManager.getNextId('teams');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('teams');

      // Create new team
      const teamData = {
        numericId: numericId,
        name: teamName,
        shortName: teamName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3),
        isActive: true,
        stats: {
          matchesPlayed: 0,
          matchesWon: 0,
          matchesLost: 0,
          matchesDrawn: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await collections.teams.doc(documentId).set(teamData);
      this.teamsMap.set(teamName, documentId);
      console.log(`✓ Created team: ${teamName} (ID: ${documentId})`);
      return documentId;
    } catch (error) {
      console.error(`✗ Error upserting team ${teamName}:`, error);
      return null;
    }
  }

  // Helper function to process how_out object and convert player names to playerIds
  processHowOut(howOut, playersMap, playersNumericMap) {
    if (!howOut || typeof howOut !== 'object') {
      return howOut;
    }

    const processedHowOut = { ...howOut };

    // Convert fielder name to playerId
    if (processedHowOut.fielder && typeof processedHowOut.fielder === 'string') {
      const fielderId = playersMap.get(processedHowOut.fielder);
      const fielderNumericId = this.playersNumericMap.get(processedHowOut.fielder);
      if (fielderId) {
        processedHowOut.fielderId = fielderNumericId;
        processedHowOut.fielderName = processedHowOut.fielder; // Keep original name for display
      }
    }

    // Convert bowler name to playerId
    if (processedHowOut.bowler && typeof processedHowOut.bowler === 'string') {
      const bowlerId = playersMap.get(processedHowOut.bowler);
      const bowlerNumericId = this.playersNumericMap.get(processedHowOut.bowler);
      if (bowlerId) {
        processedHowOut.bowlerId = bowlerNumericId;
        processedHowOut.bowlerName = processedHowOut.bowler; // Keep original name for display
      }
    }

    // Handle fielders array if it exists
    if (processedHowOut.fielders && Array.isArray(processedHowOut.fielders)) {
      processedHowOut.fieldersIds = processedHowOut.fielders.map(fielderName => {
        if (typeof fielderName === 'string') {
          const fielderNumericId = this.playersNumericMap.get(fielderName);
          return fielderNumericId || fielderName; // Return numeric ID if found, otherwise keep name
        }
        return fielderName;
      });
    }

    return processedHowOut;
  }

  // Helper function to process fall_of_wickets and convert player names to playerIds
  processFallOfWickets(fallOfWickets, playersMap, playersNumericMap) {
    if (!fallOfWickets || !Array.isArray(fallOfWickets)) {
      return fallOfWickets || [];
    }

    return fallOfWickets.map(fow => {
      const processedFow = { ...fow };
      
      // Convert player name to playerId
      if (processedFow.player && typeof processedFow.player === 'string') {
        const playerId = playersMap.get(processedFow.player);
        const playerNumericId = this.playersNumericMap.get(processedFow.player);
        if (playerId) {
          processedFow.playerId = playerNumericId;
          processedFow.playerName = processedFow.player; // Keep original name for display
        }
      }
      
      return processedFow;
    });
  }

  async upsertPlayer(playerName, battingStyle = null, isCaptain = false, isWicketKeeper = false) {
    if (!playerName || this.playersMap.has(playerName)) {
      return this.playersMap.get(playerName);
    }

    try {
      // Check if player already exists
      const existingQuery = await collections.players.where('name', '==', playerName).limit(1).get();
      if (!existingQuery.empty) {
        const existingPlayer = existingQuery.docs[0];
        const playerId = existingPlayer.id;
        const playerData = existingPlayer.data();
        
        // Update player with new information if not already set
        const updates = {};
        if (battingStyle && !playerData.battingStyle) {
          updates.battingStyle = battingStyle;
        }
        if (isCaptain && !playerData.isCaptain) {
          updates.isCaptain = isCaptain;
        }
        if (isWicketKeeper && !playerData.isWicketKeeper) {
          updates.isWicketKeeper = isWicketKeeper;
        }
        
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date().toISOString();
          await collections.players.doc(playerId).update(updates);
        }
        
        this.playersMap.set(playerName, playerId);
        this.playersNumericMap.set(playerName, playerData.numericId);
        return playerId;
      }

      // Generate numeric ID for the player
      const numericId = await sequenceManager.getNextId('players');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('players');

      // Create new player with enhanced structure
      const playerData = {
        numericId: numericId,
        name: playerName,
        email: `${playerName.toLowerCase().replace(/\s+/g, '.')}@cricketclub.com`,
        isActive: true,
        role: 'all-rounder', // Default role
        battingStyle: battingStyle,
        bowlingStyle: null,
        isCaptain: isCaptain,
        isWicketKeeper: isWicketKeeper,
        nationality: null,
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Enhanced stats structure
        stats: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          highestScore: 0,
          battingAverage: 0,
          bowlingAverage: 0,
          strikeRate: 0,
          economyRate: 0
        },
        runsConceded: 0,
        statsLastUpdated: new Date().toISOString(),
        inningsBowled: 0,
        totalBalls: 0,
        bowlingAverage: 0,
        notOuts: 0,
        inningsBatted: 0,
        oversBowled: 0,
        bowlingEconomy: 0,
        totalWickets: 0,
        ballsBowled: 0,
        matchesPlayed: 0,
        battingStrikeRate: 0,
        battingAverage: 0,
        totalRuns: 0,
        fieldingStats: {
          catches: 0,
          runOuts: 0,
          stumpings: 0
        },
        // Initialize empty match history (will be populated by cross-references)
        matchHistory: [],
        careerBests: {
          batting: {
            score: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            matchId: null,
            date: null
          },
          bowling: {
            wickets: 0,
            runs: 0,
            overs: 0,
            matchId: null,
            date: null
          }
        },
        battingStats: {
          totalRuns: 0,
          totalBalls: 0,
          totalFours: 0,
          totalSixes: 0,
          highestScore: 0,
          notOuts: 0,
          ducks: 0,
          fifties: 0,
          centuries: 0,
          average: 0,
          strikeRate: 0,
          totalInnings: 0
        },
        bowlingStats: {
          totalOvers: 0,
          totalMaidens: 0,
          totalRuns: 0,
          totalWickets: 0,
          bestFigures: {
            wickets: 0,
            runs: 0
          },
          hatTricks: 0,
          fiveWicketHauls: 0,
          tenWicketHauls: 0,
          average: 0,
          economy: 0,
          strikeRate: 0,
          totalInnings: 0
        },
        milestones: {
          batting: [],
          bowling: [],
          fielding: []
        },
        summaryStats: {
          totalMatches: 0,
          totalRuns: 0,
          totalWickets: 0,
          totalCatches: 0,
          totalInnings: 0,
          totalBattingInnings: 0,
          totalBowlingInnings: 0
        }
      };

      await collections.players.doc(documentId).set(playerData);
      this.playersMap.set(playerName, documentId);
      this.playersNumericMap.set(playerName, numericId);
      console.log(`✓ Created player: ${playerName} (ID: ${documentId})`);
      return documentId;
    } catch (error) {
      console.error(`✗ Error upserting player ${playerName}:`, error);
      return null;
    }
  }

  async addPlayerCrossReferences() {
    console.log('Adding cross-references to player collection...');

    // Get all players
    const playersSnapshot = await collections.players.get();
    const players = new Map();

    playersSnapshot.forEach(doc => {
      const player = { id: doc.id, ...doc.data() };
      players.set(doc.id, player);
    });

    console.log(`Found ${players.size} players`);

    // Initialize match history for each player
    const playerMatchHistory = new Map();

    // Get all matches
    const matchesSnapshot = await collections.matches.get();
    console.log(`Processing ${matchesSnapshot.size} matches...`);

    for (const matchDoc of matchesSnapshot.docs) {
      const match = { id: matchDoc.id, ...matchDoc.data() };
      console.log(`Processing match ${match.id}`);

      // Get innings for this match
      const inningsSnapshot = await collections.matches.doc(match.id).collection('innings').get();

      for (const inningDoc of inningsSnapshot.docs) {
        const inning = { id: inningDoc.id, ...inningDoc.data() };

        // Process batsmen data
        if (inning.batsmen && Array.isArray(inning.batsmen)) {
          for (const batsman of inning.batsmen) {
            if (batsman.playerId) {
              const player = players.get(batsman.playerId);
              if (player) {
                if (!playerMatchHistory.has(batsman.playerId)) {
                  playerMatchHistory.set(batsman.playerId, {
                    playerId: batsman.playerId,
                    playerName: player.name,
                    matches: []
                  });
                }

                const history = playerMatchHistory.get(batsman.playerId);
                let matchEntry = history.matches.find(m => m.matchId === match.numericId);

                if (!matchEntry) {
                  matchEntry = {
                    matchId: match.numericId,
                    matchDate: match.scheduledDate || match.createdAt,
                    team1: match.team1Id,
                    team2: match.team2Id,
                    venue: match.venue,
                    result: match.result,
                    contributions: []
                  };
                  history.matches.push(matchEntry);
                }

                matchEntry.contributions.push({
                  type: 'batting',
                  inningNumber: inning.inningNumber,
                  runs: batsman.runs || 0,
                  balls: batsman.balls || 0,
                  fours: batsman.fours || 0,
                  sixes: batsman.sixes || 0,
                  dismissal: batsman.status,
                  strikeRate: batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(2) : 0
                });
              }
            }
          }
        }

        // Process bowlers data
        if (inning.bowlers && Array.isArray(inning.bowlers)) {
          for (const bowler of inning.bowlers) {
            if (bowler.playerId) {
              const player = players.get(bowler.playerId);
              if (player) {
                if (!playerMatchHistory.has(bowler.playerId)) {
                  playerMatchHistory.set(bowler.playerId, {
                    playerId: bowler.playerId,
                    playerName: player.name,
                    matches: []
                  });
                }

                const history = playerMatchHistory.get(bowler.playerId);
                let matchEntry = history.matches.find(m => m.matchId === match.numericId);

                if (!matchEntry) {
                  matchEntry = {
                    matchId: match.numericId,
                    matchDate: match.scheduledDate || match.createdAt,
                    team1: match.team1Id,
                    team2: match.team2Id,
                    venue: match.venue,
                    result: match.result,
                    contributions: []
                  };
                  history.matches.push(matchEntry);
                }

                matchEntry.contributions.push({
                  type: 'bowling',
                  inningNumber: inning.inningNumber,
                  overs: bowler.overs || 0,
                  maidens: bowler.maidens || 0,
                  runs: bowler.runs || 0,
                  wickets: bowler.wickets || 0,
                  economy: bowler.economy || 0
                });
              }
            }
          }
        }

        // Process fielding (catches and runouts from batsmen dismissals)
        if (inning.batsmen && Array.isArray(inning.batsmen)) {
          for (const batsman of inning.batsmen) {
            if (batsman.status) {
              // Process catches
              if (batsman.status.includes('c ')) {
                // Try to extract fielder name from dismissal
                const catchMatch = batsman.status.match(/c\s+([^b]+)/i);
                if (catchMatch) {
                  const fielderName = catchMatch[1].trim();
                  // Find player by name (this is approximate)
                  for (const [playerId, player] of players) {
                    if (player.name.toLowerCase().includes(fielderName.toLowerCase()) ||
                        fielderName.toLowerCase().includes(player.name.toLowerCase())) {
                      if (!playerMatchHistory.has(playerId)) {
                        playerMatchHistory.set(playerId, {
                          playerId: playerId,
                          playerName: player.name,
                          matches: []
                        });
                      }

                      const history = playerMatchHistory.get(playerId);
                      let matchEntry = history.matches.find(m => m.matchId === match.numericId);

                      if (!matchEntry) {
                        matchEntry = {
                          matchId: match.numericId,
                          matchDate: match.scheduledDate || match.createdAt,
                          team1: match.team1Id,
                          team2: match.team2Id,
                          venue: match.venue,
                          result: match.result,
                          contributions: []
                        };
                        history.matches.push(matchEntry);
                      }

                      matchEntry.contributions.push({
                        type: 'fielding',
                        inningNumber: inning.inningNumber,
                        action: 'catch',
                        count: 1
                      });
                      break;
                    }
                  }
                }
              }

              // Process runouts
              if (batsman.status.includes('run out')) {
                // Try to extract fielder name from dismissal
                const runoutMatch = batsman.status.match(/run out\s+([^/]+)/i);
                if (runoutMatch) {
                  const fielderName = runoutMatch[1].trim();
                  // Find player by name (this is approximate)
                  for (const [playerId, player] of players) {
                    if (player.name.toLowerCase().includes(fielderName.toLowerCase()) ||
                        fielderName.toLowerCase().includes(player.name.toLowerCase())) {
                      if (!playerMatchHistory.has(playerId)) {
                        playerMatchHistory.set(playerId, {
                          playerId: playerId,
                          playerName: player.name,
                          matches: []
                        });
                      }

                      const history = playerMatchHistory.get(playerId);
                      let matchEntry = history.matches.find(m => m.matchId === match.numericId);

                      if (!matchEntry) {
                        matchEntry = {
                          matchId: match.numericId,
                          matchDate: match.scheduledDate || match.createdAt,
                          team1: match.team1Id,
                          team2: match.team2Id,
                          venue: match.venue,
                          result: match.result,
                          contributions: []
                        };
                        history.matches.push(matchEntry);
                      }

                      matchEntry.contributions.push({
                        type: 'fielding',
                        inningNumber: inning.inningNumber,
                        action: 'run out',
                        count: 1
                      });
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Update players with match history
    for (const [playerId, history] of playerMatchHistory) {
      await collections.players.doc(playerId).update({
        matchHistory: history.matches,
        updatedAt: new Date().toISOString()
      });
    }

    console.log(`✓ Added cross-references for ${playerMatchHistory.size} players`);
  }

  async updatePlayerStatistics() {
    console.log('Updating player statistics...');

    const playersSnapshot = await collections.players.get();

    for (const playerDoc of playersSnapshot.docs) {
      const player = { id: playerDoc.id, ...playerDoc.data() };

      if (player.matchHistory && Array.isArray(player.matchHistory)) {
        let totalRuns = 0;
        let totalBalls = 0;
        let totalFours = 0;
        let totalSixes = 0;
        let highestScore = 0;
        let notOuts = 0;
        let totalWickets = 0;
        let totalOvers = 0;
        let totalRunsConceded = 0;
        let totalCatches = 0;
        let totalRunOuts = 0;
        let totalStumpings = 0;
        let totalMatches = player.matchHistory.length;

        for (const match of player.matchHistory) {
          for (const contribution of match.contributions) {
            if (contribution.type === 'batting') {
              totalRuns += contribution.runs || 0;
              totalBalls += contribution.balls || 0;
              totalFours += contribution.fours || 0;
              totalSixes += contribution.sixes || 0;
              highestScore = Math.max(highestScore, contribution.runs || 0);

              if (contribution.dismissal === 'not out') {
                notOuts++;
              }
            } else if (contribution.type === 'bowling') {
              totalWickets += contribution.wickets || 0;
              totalOvers += parseFloat(contribution.overs) || 0;
              totalRunsConceded += contribution.runs || 0;
            } else if (contribution.type === 'fielding') {
              if (contribution.action === 'catch') {
                totalCatches += contribution.count || 0;
              } else if (contribution.action === 'run out') {
                totalRunOuts += contribution.count || 0;
              } else if (contribution.action === 'stumping') {
                totalStumpings += contribution.count || 0;
              }
            }
          }
        }

        // Calculate averages
        const totalInnings = totalMatches; // Approximation
        const battingAverage = totalInnings > notOuts ? (totalRuns / (totalInnings - notOuts)).toFixed(2) : totalRuns.toFixed(2);
        const bowlingAverage = totalWickets > 0 ? (totalRunsConceded / totalWickets).toFixed(2) : '0.00';
        const strikeRate = totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(2) : '0.00';
        const economy = totalOvers > 0 ? (totalRunsConceded / totalOvers).toFixed(2) : '0.00';

        // Update player with calculated statistics
        const updatedStats = {
          // Basic stats
          matchesPlayed: totalMatches,
          totalRuns: totalRuns,
          totalWickets: totalWickets,
          battingAverage: parseFloat(battingAverage),
          bowlingAverage: parseFloat(bowlingAverage),
          battingStrikeRate: parseFloat(strikeRate),
          bowlingEconomy: parseFloat(economy),

          // Enhanced stats
          runsConceded: totalRunsConceded,
          inningsBowled: Math.ceil(totalOvers / 6), // Approximation
          totalBalls: totalBalls,
          notOuts: notOuts,
          inningsBatted: totalInnings,
          oversBowled: totalOvers,
          ballsBowled: Math.round(totalOvers * 6),
          fieldingStats: {
            catches: totalCatches,
            runOuts: totalRunOuts,
            stumpings: totalStumpings
          },

          // Career bests
          careerBests: {
            batting: {
              score: highestScore,
              balls: 0, // Would need more detailed tracking
              fours: 0,
              sixes: 0,
              matchId: null,
              date: null
            },
            bowling: {
              wickets: totalWickets,
              runs: totalRunsConceded,
              overs: totalOvers,
              matchId: null,
              date: null
            }
          },

          // Detailed stats
          battingStats: {
            totalRuns: totalRuns,
            totalBalls: totalBalls,
            totalFours: totalFours,
            totalSixes: totalSixes,
            highestScore: highestScore,
            notOuts: notOuts,
            ducks: 0,
            fifties: totalRuns >= 50 ? 1 : 0, // Approximation
            centuries: totalRuns >= 100 ? 1 : 0, // Approximation
            average: parseFloat(battingAverage),
            strikeRate: parseFloat(strikeRate),
            totalInnings: totalInnings
          },

          bowlingStats: {
            totalOvers: totalOvers,
            totalMaidens: 0, // Not tracked in current data
            totalRuns: totalRunsConceded,
            totalWickets: totalWickets,
            bestFigures: {
              wickets: totalWickets,
              runs: totalRunsConceded
            },
            hatTricks: 0,
            fiveWicketHauls: totalWickets >= 5 ? 1 : 0,
            tenWicketHauls: 0,
            average: parseFloat(bowlingAverage),
            economy: parseFloat(economy),
            strikeRate: totalWickets > 0 ? (totalOvers * 6 / totalWickets).toFixed(2) : '0.00',
            totalInnings: Math.ceil(totalOvers / 6)
          },

          summaryStats: {
            totalMatches: totalMatches,
            totalRuns: totalRuns,
            totalWickets: totalWickets,
            totalCatches: totalCatches,
            totalInnings: totalInnings,
            totalBattingInnings: totalInnings,
            totalBowlingInnings: Math.ceil(totalOvers / 6)
          },

          statsLastUpdated: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await collections.players.doc(player.id).update(updatedStats);
        console.log(`✓ Updated statistics for player: ${player.name}`);
      }
    }

    console.log('✓ Player statistics updated');
  }

  async populateTeamPlayers() {
    console.log('Populating team players...');

    // Get all teams
    const teamsSnapshot = await collections.teams.get();

    console.log(`Found ${teamsSnapshot.size} teams to process`);

    // Process each team
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      console.log(`Processing team: ${teamData.name} (${teamDoc.id})`);

      try {
        // Get all match squads for this team
        const matchSquadsSnapshot = await collections.teams.doc(teamDoc.id).collection('matchSquads').get();

        // Collect all unique player IDs
        const uniquePlayerIds = new Set();

        for (const squadDoc of matchSquadsSnapshot.docs) {
          const squadData = squadDoc.data();
          if (squadData.playerIds && Array.isArray(squadData.playerIds)) {
            squadData.playerIds.forEach(playerId => uniquePlayerIds.add(playerId));
          }
        }

        const playerIdsArray = Array.from(uniquePlayerIds);
        const playersCount = playerIdsArray.length;

        // Update the team document with player information
        await collections.teams.doc(teamDoc.id).update({
          playerIds: playerIdsArray,
          playersCount: playersCount,
          updatedAt: new Date().toISOString()
        });

        console.log(`✓ Updated team ${teamData.name}: ${playersCount} players`);

      } catch (error) {
        console.error(`✗ Error processing team ${teamData.name}:`, error);
      }
    }

    console.log('✓ Team players populated');
  }

  async runUpdatePlayerStats() {
    console.log('Running update-player-stats.js...');

    // Import the updatePlayerStats function from the script
    const updatePlayerStats = require('./update-player-stats.js');

    // Call the function
    await updatePlayerStats();

    console.log('✓ update-player-stats.js completed successfully');
  }

  async verifyDataIntegrity() {
    console.log('Verifying data integrity...');

    // Check matches
    const matchesCount = (await collections.matches.get()).size;
    console.log(`✓ Matches: ${matchesCount}`);

    // Check teams
    const teamsCount = (await collections.teams.get()).size;
    console.log(`✓ Teams: ${teamsCount}`);

    // Check players
    const playersCount = (await collections.players.get()).size;
    console.log(`✓ Players: ${playersCount}`);

    // Check that players have cross-references
    const playersWithHistory = (await collections.players.where('matchHistory', '!=', null).get()).size;
    console.log(`✓ Players with match history: ${playersWithHistory}`);

    // Check innings data
    let totalInnings = 0;
    const matches = await collections.matches.get();
    for (const matchDoc of matches.docs) {
      const innings = await collections.matches.doc(matchDoc.id).collection('innings').get();
      totalInnings += innings.size;
    }
    console.log(`✓ Total innings: ${totalInnings}`);

    console.log('✓ Data integrity verification completed');
  }

  async getCompletePlayerObject(playerId) {
    try {
      const playerDoc = await collections.players.doc(playerId).get();
      if (playerDoc.exists) {
        const playerData = playerDoc.data();
        return {
          id: playerId,
          numericId: playerData.numericId,
          name: playerData.name,
          email: playerData.email,
          isActive: playerData.isActive,
          role: playerData.role,
          battingStyle: playerData.battingStyle,
          bowlingStyle: playerData.bowlingStyle,
          isCaptain: playerData.isCaptain,
          isWicketKeeper: playerData.isWicketKeeper,
          nationality: playerData.nationality,
          avatar: playerData.avatar
        };
      }
      return { id: playerId, name: 'Unknown Player' };
    } catch (error) {
      console.error(`Error getting complete player object for ${playerId}:`, error);
      return { id: playerId, name: 'Unknown Player' };
    }
  }
}

// Run the complete reimport
async function main() {
  const reimport = new CompleteDataReimport();
  await reimport.runCompleteReimport();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CompleteDataReimport;