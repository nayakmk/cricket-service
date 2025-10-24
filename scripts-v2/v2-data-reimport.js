/**
 * V2 MIGRATION FROM JSON SOURCE
 *
 * Migrates data directly from the original JSON source to v2 collections
 * with proper nested team structure and embedded innings data
 *
 * Source: reports/cricket_matches_from_pdfs_final.json
 * Target: v2 collections with embedded innings data in matches
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { V2_COLLECTIONS } = require('../config/database-v2');

class JSONToV2Migration {
  constructor() {
    this.db = admin.firestore();
    this.batchSize = 10;
    this.stats = {
      teams: { processed: 0, migrated: 0, errors: 0 },
      players: { processed: 0, migrated: 0, errors: 0 },
      matches: { processed: 0, migrated: 0, errors: 0 },
      matchSquads: { processed: 0, migrated: 0, errors: 0 },
      teamPlayers: { processed: 0, migrated: 0, errors: 0 },
      teamStats: { processed: 0, migrated: 0, errors: 0 }
    };

    // In-memory caches for lookups
    this.teamsMap = new Map(); // name -> { id, data }
    this.playersMap = new Map(); // name -> { id, data }
    this.matchSquadsMap = new Map(); // matchId_teamId -> squadId
    this.teamCaptainsMap = new Map(); // teamName -> captainName
  }

  async initializeSequences() {
    console.log('🔢 Initializing sequences from scratch...');

    const sequenceTypes = [
      { type: 'matches', description: 'Display ID sequence for matches', startValue: 1 },
      { type: 'players', description: 'Display ID sequence for players', startValue: 1 },
      { type: 'teams', description: 'Display ID sequence for teams', startValue: 1 },
      { type: 'tournaments', description: 'Display ID sequence for tournaments', startValue: 1 }
    ];

    for (const seq of sequenceTypes) {
      // Always create fresh sequences starting from 1
      const sequenceData = {
        sequenceType: seq.type,
        description: seq.description,
        currentValue: seq.startValue - 1, // Will be incremented to startValue on first use
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection(V2_COLLECTIONS.SEQUENCES).doc(seq.type).set(sequenceData);
      console.log(`✅ Initialized ${seq.type} sequence starting from ${seq.startValue}`);
    }

    console.log('✅ All sequences initialized successfully');
  }

  async getNextSequenceValue(sequenceType) {
    const sequenceRef = this.db.collection(V2_COLLECTIONS.SEQUENCES).doc(sequenceType);

    // Use transaction to atomically increment the sequence
    const result = await this.db.runTransaction(async (transaction) => {
      const sequenceDoc = await transaction.get(sequenceRef);

      if (!sequenceDoc.exists) {
        throw new Error(`Sequence ${sequenceType} not found`);
      }

      const currentValue = sequenceDoc.data().currentValue;
      const nextValue = currentValue + 1;

      // Update the sequence
      transaction.update(sequenceRef, {
        currentValue: nextValue,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return nextValue;
    });

    return result;
  }

  async cleanAllV2Collections() {
    console.log('🧹 Cleaning all v2 collections...');

    const collectionsToClean = [
      V2_COLLECTIONS.PLAYERS,
      V2_COLLECTIONS.TEAMS,
      V2_COLLECTIONS.MATCHES,
      V2_COLLECTIONS.MATCH_SQUADS,
      V2_COLLECTIONS.SEQUENCES
    ];

    for (const collectionName of collectionsToClean) {
      console.log(`  Deleting all documents from ${collectionName}...`);

      try {
        const collectionRef = this.db.collection(collectionName);
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
          console.log(`  ✅ ${collectionName} is already empty`);
          continue;
        }

        // Delete documents in batches
        const batchSize = 10;
        const batches = [];
        let currentBatch = this.db.batch();
        let batchCount = 0;

        snapshot.forEach((doc) => {
          currentBatch.delete(doc.ref);
          batchCount++;

          if (batchCount >= batchSize) {
            batches.push(currentBatch.commit());
            currentBatch = this.db.batch();
            batchCount = 0;
          }
        });

        if (batchCount > 0) {
          batches.push(currentBatch.commit());
        }

        await Promise.all(batches);
        console.log(`  ✅ Deleted ${snapshot.size} documents from ${collectionName}`);

      } catch (error) {
        console.error(`  ❌ Failed to clean ${collectionName}:`, error.message);
        throw error;
      }
    }

    console.log('✅ All v2 collections cleaned successfully');
  }

  async migrateFromJSON() {
    console.log('🚀 Starting V2 Migration from JSON Source...');

    try {
      // Step 0: Clean all v2 collections
      console.log('\n🧹 Step 0: Cleaning all v2 collections...');
      await this.cleanAllV2Collections();

      // Initialize sequences from scratch
      await this.initializeSequences();

      // Load JSON data
      const jsonData = this.loadJSONData();

      // Step 1: Extract and migrate teams
      console.log('\n📋 Step 1: Extracting and migrating teams...');
      await this.extractAndMigrateTeams(jsonData);

      // Step 2: Extract and migrate players
      console.log('\n👥 Step 2: Extracting and migrating players...');
      await this.extractAndMigratePlayers(jsonData);

      // Step 3: Migrate matches with nested team structure
      console.log('\n🏏 Step 3: Migrating matches with nested structure...');
      await this.migrateMatchesFromJSON(jsonData);

      // Step 3.5: Update teams with captain information
      console.log('\n👑 Step 3.5: Updating teams with captain information...');
      await this.updateTeamsWithCaptains();

      // Step 4: Create match squads
      console.log('\n👥 Step 4: Creating match squads...');
      await this.createMatchSquads(jsonData);

      // Step 5: Populate teams with players from match data
      console.log('\n👥 Step 5: Populating teams with players...');
      await this.populateTeamsWithPlayers();

      // Step 6: Calculate and update team statistics
      console.log('\n📊 Step 6: Calculating team statistics...');
      await this.calculateAndUpdateTeamStats();

      this.printMigrationSummary();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  loadJSONData() {
    const jsonPath = path.join(__dirname, '../reports/cricket_matches_from_pdfs_final.json');
    console.log(`Loading JSON data from: ${jsonPath}`);

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found: ${jsonPath}`);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const jsonData = JSON.parse(rawData);

    console.log(`Loaded ${jsonData.length} matches from JSON`);
    return jsonData;
  }

  async extractAndMigrateTeams(jsonData) {
    const teamsSet = new Set();

    // Extract unique teams from all matches
    for (const match of jsonData) {
      if (match.teams?.team1) teamsSet.add(match.teams.team1);
      if (match.teams?.team2) teamsSet.add(match.teams.team2);
    }

    console.log(`Found ${teamsSet.size} unique teams`);

    const teamsArray = Array.from(teamsSet);
    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (let i = 0; i < teamsArray.length; i++) {
      this.stats.teams.processed++;

      try {
        const teamName = teamsArray[i];
        const teamData = this.createTeamData(teamName, i + 1);

        const teamDocRef = this.db.collection(V2_COLLECTIONS.TEAMS).doc(); // Auto-generated UUID
        const teamDocId = teamDocRef.id;
        
        currentBatch.set(teamDocRef, teamData);

        // Cache for later use
        this.teamsMap.set(teamName, {
          id: teamDocId,
          teamId: teamData.teamId,
          data: teamData
        });

        batchCount++;

        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.teams.migrated++;
        console.log(`✅ Migrated team: ${teamData.name}`);

      } catch (error) {
        console.error(`❌ Failed to migrate team ${teamsArray[i]}:`, error.message);
        this.stats.teams.errors++;
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Teams migration completed: ${this.stats.teams.migrated}/${this.stats.teams.processed} migrated`);
  }

  createTeamData(teamName, index) {
    // Use 19-digit IDs for consistency - use BigInt to handle large numbers
    const baseId = 1000000000000000000n; // 1 followed by 18 zeros as BigInt
    const numericId = (baseId + BigInt(index)).toString();

    return {
      teamId: numericId,
      displayId: index,
      name: teamName,
      shortName: teamName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3),
      isActive: true,
      externalReferenceId: teamName, // Original team name from JSON
      captainId: null,
      captain: null,
      viceCaptainId: null,
      viceCaptain: null,
      homeGround: 'MM Sports Park- Box Cricket',
      players: [], // Will be populated with detailed player info later
      recentMatches: [], // Will be populated with recent match history
      tournaments: [{
        tournamentId: '1000000000000000001',
        tournament: {
          tournamentId: '1000000000000000001',
          name: 'EPL WEEKEND MAHAMUKABALA',
          season: '2024'
        },
        matchesPlayed: 0,
        matchesWon: 0,
        position: 0,
        points: 0
      }],
      teamStats: {
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        winPercentage: 0,
        totalPlayers: 0,
        avgPlayersPerMatch: 0
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  }

  async extractAndMigratePlayers(jsonData) {
    const playersSet = new Set();

    // Extract unique players from all matches and innings
    for (const match of jsonData) {
      for (const inning of match.innings || []) {
        for (const batsman of inning.batting || []) {
          if (batsman.name) playersSet.add(batsman.name);
        }
        for (const bowler of inning.bowling || []) {
          if (bowler.name) playersSet.add(bowler.name);
        }
      }
    }

    console.log(`Found ${playersSet.size} unique players`);

    const playersArray = Array.from(playersSet);
    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (let i = 0; i < playersArray.length; i++) {
      this.stats.players.processed++;

      try {
        const playerName = playersArray[i];
        const playerData = this.createPlayerData(playerName, i + 1);

        // Check if player already exists by playerId
        const existingPlayerQuery = await this.db.collection(V2_COLLECTIONS.PLAYERS)
          .where('playerId', '==', playerData.playerId)
          .limit(1)
          .get();

        let playerDocRef;
        let playerDocId;

        if (!existingPlayerQuery.empty) {
          // Player already exists, skip creation
          const existingDoc = existingPlayerQuery.docs[0];
          playerDocId = existingDoc.id;
          console.log(`Player already exists: ${playerData.name} (${playerData.playerId})`);
          
          // Update cache with existing player data
          const existingData = existingDoc.data();
          this.playersMap.set(playerName, {
            id: playerDocId,
            playerId: existingData.playerId,
            data: existingData,
            teams: [] // Track which teams this player belongs to
          });
          
          this.stats.players.migrated++;
          continue; // Skip to next player
        } else {
          // Create new player
          playerDocRef = this.db.collection(V2_COLLECTIONS.PLAYERS).doc(); // Auto-generated UUID
          playerDocId = playerDocRef.id;
          console.log(`Creating new player: ${playerData.name} (${playerData.playerId})`);
          
          currentBatch.set(playerDocRef, playerData);
        }
        
        // Cache for later use
        this.playersMap.set(playerName, {
          id: playerDocId,
          playerId: playerData.playerId,
          data: playerData,
          teams: [] // Track which teams this player belongs to
        });

        batchCount++;

        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.players.migrated++;

      } catch (error) {
        console.error(`❌ Failed to migrate player ${playersArray[i]}:`, error.message);
        this.stats.players.errors++;
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Players migration completed: ${this.stats.players.migrated}/${this.stats.players.processed} migrated`);
  }

  createPlayerData(playerName, index) {
    // Use BigInt to handle large numbers accurately
    const baseId = 2000000000000000000n; // 2 followed by 18 zeros as BigInt
    const numericId = (baseId + BigInt(index)).toString();

    return {
      playerId: numericId,
      displayId: index,
      name: playerName,
      email: `${playerName.toLowerCase().replace(/\s+/g, '.')}@cricketapp.local`, // Generate email for validation
      isActive: true,
      role: 'batsman', // Default, will be updated based on actual performance
      battingStyle: 'RHB', // Default
      bowlingStyle: null,
      isWicketKeeper: false, // Default
      nationality: 'Unknown',
      avatar: null,
      externalReferenceId: playerName, // Original player name from JSON
      preferredTeamId: null, // Will be set later
      preferredTeam: null, // Will be set later
      teamsPlayedFor: [], // Will be populated with team history
      recentMatches: [], // Will be populated with recent match history
      tournamentsPlayed: [{
        tournamentId: '1000000000000000001',
        tournament: {
          tournamentId: '1000000000000000001',
          name: 'EPL WEEKEND MAHAMUKABALA',
          season: '2024'
        },
        matchesPlayed: 0,
        totalRuns: 0,
        totalWickets: 0,
        manOfTheSeries: false
      }],
      careerStats: {
        batting: {
          matchesPlayed: 0,
          runs: 0,
          highestScore: 0,
          average: 0,
          strikeRate: 0,
          centuries: 0,
          fifties: 0,
          ducks: 0,
          notOuts: 0
        },
        bowling: {
          matchesPlayed: 0,
          wickets: 0,
          average: 0,
          economyRate: 0,
          strikeRate: 0,
          bestBowling: null,
          fiveWicketHauls: 0,
          hatTricks: 0
        },
        fielding: {
          catches: 0,
          runOuts: 0,
          stumpings: 0
        },
        overall: {
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          winPercentage: 0
        }
      },
      seasonStats: {
        season: '2024',
        matchesPlayed: 0
      },
      achievements: {
        batting: [],
        bowling: [],
        fielding: [],
        team: [],
        individual: []
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  }

  async migrateMatchesFromJSON(jsonData) {
    console.log(`Processing ${jsonData.length} matches from JSON`);

    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (const match of jsonData) {
      this.stats.matches.processed++;

      try {
        // Check if match already exists
        const existingMatch = await this.db.collection(V2_COLLECTIONS.MATCHES)
          .where('externalReferenceId', '==', match.match_id)
          .limit(1)
          .get();

        if (!existingMatch.empty) {
          console.log(`Match ${match.match_id} already exists, skipping`);
          continue;
        }

        // Get next displayId from sequence
        const displayId = await this.getNextSequenceValue('matches');
        const matchData = this.createMatchData(match, displayId);

        // Extract and store captain information for teams
        const captains = this.extractCaptainNames(match);
        if (captains.team1.name !== 'TBD') {
          const existingCaptain = this.teamCaptainsMap.get(match.teams?.team1);
          if (existingCaptain && existingCaptain !== captains.team1.name) {
            console.log(`⚠️  Team ${match.teams?.team1} captain changed from ${existingCaptain} to ${captains.team1.name}`);
          }
          this.teamCaptainsMap.set(match.teams?.team1, captains.team1.name);
        }
        if (captains.team2.name !== 'TBD') {
          const existingCaptain = this.teamCaptainsMap.get(match.teams?.team2);
          if (existingCaptain && existingCaptain !== captains.team2.name) {
            console.log(`⚠️  Team ${match.teams?.team2} captain changed from ${existingCaptain} to ${captains.team2.name}`);
          }
          this.teamCaptainsMap.set(match.teams?.team2, captains.team2.name);
        }

        const v2DocRef = this.db.collection(V2_COLLECTIONS.MATCHES).doc(); // Auto-generated UUID
        currentBatch.set(v2DocRef, matchData);

        batchCount++;

        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.matches.migrated++;
        console.log(`✅ Migrated match: ${matchData.title}`);

      } catch (error) {
        console.error(`❌ Failed to migrate match ${match.match_id}:`, error.message);
        this.stats.matches.errors++;
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Matches migration completed: ${this.stats.matches.migrated}/${this.stats.matches.processed} migrated`);
  }

  async updateTeamsWithCaptains() {
    console.log(`Updating ${this.teamCaptainsMap.size} teams with captain information`);

    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (const [teamName, captainName] of this.teamCaptainsMap.entries()) {
      console.log(`🔍 Processing team: ${teamName} -> Captain: ${captainName}`);
      try {
        const teamData = this.teamsMap.get(teamName);
        if (!teamData) {
          console.warn(`Team not found in cache: ${teamName}`);
          continue;
        }

        // Find captain player - use the is_captain field from JSON data
        const captainPlayer = Array.from(this.playersMap.values()).find(player =>
          player.data.name === captainName
        );

        if (!captainPlayer) {
          console.warn(`⚠️  Captain "${captainName}" not found in players database`);
          continue;
        }

        const teamRef = this.db.collection(V2_COLLECTIONS.TEAMS).doc(teamData.id);  // Use the actual document ID
        currentBatch.update(teamRef, {
          captainId: captainPlayer.data.playerId.toString(),
          captain: {
            playerId: captainPlayer.data.playerId.toString(),
            name: captainName,
            role: captainPlayer.data.role
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;

        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        console.log(`✅ Updated captain for team: ${teamName} -> ${captainName}`);

      } catch (error) {
        console.error(`❌ Failed to update captain for team ${teamName}:`, error.message);
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Team captains update completed`);
  }

  createMatchData(match, displayId) {
    // Use BigInt to handle large numbers accurately for matches (same range as teams)
    const baseId = 1000000000000000000n; // 1 followed by 18 zeros as BigInt
    const numericId = (baseId + BigInt(displayId)).toString();
    const team1Data = this.teamsMap.get(match.teams?.team1);
    const team2Data = this.teamsMap.get(match.teams?.team2);

    if (!team1Data || !team2Data) {
      throw new Error(`Teams not found for match ${match.match_id}`);
    }

    // Extract scores from innings
    const scores = this.extractScoresFromInnings(match, match.innings || []);

    // Extract captain names from player data
    const captains = this.extractCaptainNames(match);

    // Extract players grouped by team
    const teamPlayers = this.extractPlayersByTeam(match, team1Data, team2Data);

    // Create innings data for both teams
    const team1Players = this.extractSquadPlayers(match, team1Data);
    const team2Players = this.extractSquadPlayers(match, team2Data);

    // Helper function to find dismissal data for a player
    const findPlayerDismissal = (playerName, teamName) => {
      if (!match.innings) return null;

      for (const inning of match.innings) {
        // Check if this inning belongs to the player's team
        if (inning.team === teamName || inning.battingTeam === teamName) {
          if (inning.batting && Array.isArray(inning.batting)) {
            const playerBatting = inning.batting.find(batter =>
              batter.name && batter.name.toLowerCase() === playerName.toLowerCase()
            );
            if (playerBatting && playerBatting.how_out) {
              return playerBatting.how_out;
            }
          }
        }
      }
      return null;
    };

    // Create team 1 innings
    const team1Innings = this.createInningsData(
      match,
      team1Data,
      team1Players,
      captains.team1,
      findPlayerDismissal
    );

    // Create team 2 innings
    const team2Innings = this.createInningsData(
      match,
      team2Data,
      team2Players,
      captains.team2,
      findPlayerDismissal
    );

    // Create nested team structure with players, scores, and innings
    const team1 = {
      id: team1Data.teamId,
      name: team1Data.data.name,
      shortName: team1Data.data.shortName,
      squad: {
        teamId: team1Data.teamId,
        name: team1Data.data.name,
        shortName: team1Data.data.shortName,
        captainName: captains.team1.name,
        captainId: captains.team1.id
      },
      squadId: `${numericId}_${team1Data.teamId}`,
      score: scores.team1,
      players: teamPlayers.team1,
      ...(team1Innings && { innings: team1Innings })
    };

    const team2 = {
      id: team2Data.teamId,
      name: team2Data.data.name,
      shortName: team2Data.data.shortName,
      squad: {
        teamId: team2Data.teamId,
        name: team2Data.data.name,
        shortName: team2Data.data.shortName,
        captainName: captains.team2.name,
        captainId: captains.team2.id
      },
      squadId: `${numericId}_${team2Data.teamId}`,
      score: scores.team2,
      players: teamPlayers.team2,
      ...(team2Innings && { innings: team2Innings })
    };

    // Determine winner
    const result = this.determineMatchResult(match, team1Data, team2Data);

    // Extract fall of wickets from all innings
    const fallOfWickets = this.extractFallOfWickets(match);

    return {
      numericId: numericId,
      displayId: displayId,
      externalReferenceId: match.match_id, // Original match ID from JSON
      title: `${match.teams?.team1 || 'Team 1'} vs ${match.teams?.team2 || 'Team 2'}`,
      tournament: {
        tournamentId: '1000000000000000001',
        name: match.tournament || 'EPL WEEKEND MAHAMUKABALA',
        shortName: 'EPL',
        season: '2025'
      },
      matchType: 'T20',
      venue: match.ground || 'MM Sports Park- Box Cricket',
      status: 'completed',
      scheduledDate: new Date(match.date),
      completedDate: new Date(match.date),

      // Nested team structure with players and scores (API enhancement)
      team1: team1,
      team2: team2,

      toss: match.toss ? {
        winnerSquadId: match.toss.winner === match.teams?.team1 ? team1Data.teamId : team2Data.teamId,
        winnerTeamId: match.toss.winner === match.teams?.team1 ? team1Data.teamId : team2Data.teamId,
        winnerTeamName: match.toss.winner,
        decision: match.toss.decision
      } : null,

      result: result,

      // Fall of wickets from all innings
      fallOfWickets: fallOfWickets,

      playerOfMatchId: null, // Will be determined from player performance
      playerOfMatch: null,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  }

  extractScoresFromInnings(match, innings) {
    const scores = {
      team1: { runs: 0, wickets: 0, overs: 0, declared: false },
      team2: { runs: 0, wickets: 0, overs: 0, declared: false }
    };

    for (const inning of innings) {
      const teamKey = inning.team === match.teams?.team1 ? 'team1' : 'team2';

      if (inning.score) {
        const scoreParts = inning.score.split('/');
        scores[teamKey].runs = parseInt(scoreParts[0]) || 0;
        scores[teamKey].wickets = parseInt(scoreParts[1]) || 0;
        scores[teamKey].overs = inning.overs || 0;
      }
    }

    return scores;
  }

  extractFallOfWickets(match) {
    const innings = match.innings || [];
    const fallOfWickets = {
      team1: [],
      team2: []
    };

    for (const inning of innings) {
      const teamKey = inning.team === match.teams?.team1 ? 'team1' : 'team2';

      if (inning.fall_of_wickets && Array.isArray(inning.fall_of_wickets)) {
        // For each fall of wicket, find the corresponding batsman to get detailed dismissal info
        const detailedFallOfWickets = inning.fall_of_wickets.map(fow => {
          // Find the batsman who got out at this score/wicket
          const batsman = inning.batting?.find(b => b.name === fow.player);

          let dismissalDetails = {
            score: fow.score,
            wicket: fow.wicket,
            over: fow.over,
            inningsNumber: innings.indexOf(inning) + 1,
            player: {
              name: fow.player,
              playerId: null // Will be resolved from players map
            },
            dismissal: {
              type: batsman?.how_out?.type || 'unknown',
              bowler: batsman?.how_out?.bowler ? {
                name: batsman.how_out.bowler,
                playerId: null // Will be resolved from players map
              } : null,
              fielder: batsman?.how_out?.fielder ? {
                name: batsman.how_out.fielder,
                playerId: null // Will be resolved from players map
              } : null,
              fielders: batsman?.how_out?.fielders ? batsman.how_out.fielders.map(fielderName => ({
                name: fielderName,
                playerId: null // Will be resolved from players map
              })) : [],
              text: batsman?.how_out?.text || ''
            }
          };

          // Resolve player IDs from the players map
          if (this.playersMap.has(fow.player)) {
            dismissalDetails.player.playerId = this.playersMap.get(fow.player).playerId;
          }

          if (dismissalDetails.dismissal.bowler && this.playersMap.has(dismissalDetails.dismissal.bowler.name)) {
            dismissalDetails.dismissal.bowler.playerId = this.playersMap.get(dismissalDetails.dismissal.bowler.name).playerId;
          }

          if (dismissalDetails.dismissal.fielder && this.playersMap.has(dismissalDetails.dismissal.fielder.name)) {
            dismissalDetails.dismissal.fielder.playerId = this.playersMap.get(dismissalDetails.dismissal.fielder.name).playerId;
          }

          if (dismissalDetails.dismissal.fielders) {
            dismissalDetails.dismissal.fielders = dismissalDetails.dismissal.fielders.map(fielder => {
              if (this.playersMap.has(fielder.name)) {
                fielder.playerId = this.playersMap.get(fielder.name).playerId;
              }
              return fielder;
            });
          }

          return dismissalDetails;
        });

        fallOfWickets[teamKey].push(...detailedFallOfWickets);
      }
    }

    return fallOfWickets;
  }

  extractCaptainNames(match) {
    const captains = {
      team1: { name: 'TBD', id: null },
      team2: { name: 'TBD', id: null }
    };

    // Find captain from innings player data
    for (const inning of match.innings || []) {
      const battingTeamKey = inning.team === match.teams?.team1 ? 'team1' : 'team2';
      const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

      // Check batsmen for captain of batting team
      for (const batsman of inning.batting || []) {
        if (batsman.is_captain) {
          captains[battingTeamKey].name = batsman.name;
          const playerData = this.playersMap.get(batsman.name);
          if (playerData) {
            captains[battingTeamKey].id = playerData.playerId;
          }
          break;
        }
      }

      // Check bowlers for captain of bowling team
      for (const bowler of inning.bowling || []) {
        if (bowler.is_captain) {
          captains[bowlingTeamKey].name = bowler.name;
          const playerData = this.playersMap.get(bowler.name);
          if (playerData) {
            captains[bowlingTeamKey].id = playerData.playerId;
          }
          break;
        }
      }

      // If we found captains for both teams, we can stop
      if (captains.team1.name !== 'TBD' && captains.team2.name !== 'TBD') {
        break;
      }
    }

    return captains;
  }

  extractPlayersByTeam(match, team1Data, team2Data) {
    const teamPlayers = {
      team1: [],
      team2: []
    };

    // Track players already added to avoid duplicates
    const addedPlayers = new Set();

    for (const inning of match.innings || []) {
      const battingTeamKey = inning.team === match.teams?.team1 ? 'team1' : 'team2';
      const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

      // Add batsmen to the batting team
      for (const batsman of inning.batting || []) {
        if (!addedPlayers.has(batsman.name)) {
          let playerData = this.playersMap.get(batsman.name);
          if (!playerData) {
            // Player not in cache, create a temporary player entry
            console.warn(`⚠️  Player "${batsman.name}" not found in cache, creating temporary entry`);
            const tempPlayerId = `temp_${batsman.name.replace(/\s+/g, '_').toLowerCase()}`;
            playerData = {
              playerId: tempPlayerId,
              data: { playerId: tempPlayerId, name: batsman.name }
            };
          }
          // Track which team this player belongs to
          const teamName = battingTeamKey === 'team1' ? match.teams?.team1 : match.teams?.team2;
          if (teamName && !playerData.teams?.includes(teamName)) {
            if (!playerData.teams) playerData.teams = [];
            playerData.teams.push(teamName);
          }
          teamPlayers[battingTeamKey].push({
            playerId: playerData.playerId,
            name: batsman.name,
            role: batsman.is_wicket_keeper ? 'wicket-keeper' : 'batsman',
            batting: {
              runs: batsman.runs || 0,
              balls: batsman.balls || 0,
              fours: batsman.fours || 0,
              sixes: batsman.sixes || 0
            },
            bowling: { wickets: 0, runs: 0, overs: 0 }, // Will be updated from bowling data
            fielding: { catches: 0, runOuts: 0 }
          });
          addedPlayers.add(batsman.name);
        } else {
          // Update existing player's batting stats
          const existingPlayer = teamPlayers[battingTeamKey].find(p => p.name === batsman.name) ||
                                teamPlayers[bowlingTeamKey].find(p => p.name === batsman.name);
          if (existingPlayer) {
            existingPlayer.batting.runs += batsman.runs || 0;
            existingPlayer.batting.balls += batsman.balls || 0;
            existingPlayer.batting.fours += batsman.fours || 0;
            existingPlayer.batting.sixes += batsman.sixes || 0;
          }
        }
      }

      // Process dismissals to update fielding stats
      for (const batsman of inning.batting || []) {
        if (batsman.how_out && batsman.how_out.type) {
          const dismissalType = batsman.how_out.type.toLowerCase();
          
          if (dismissalType === 'caught') {
            // Update catches for the fielder(s)
            if (batsman.how_out.fielder) {
              const fielder = teamPlayers[battingTeamKey].find(p => p.name === batsman.how_out.fielder) ||
                             teamPlayers[bowlingTeamKey].find(p => p.name === batsman.how_out.fielder);
              if (fielder) {
                fielder.fielding.catches += 1;
              }
            }
          } else if (dismissalType === 'run out') {
            // Update runOuts for the fielder(s) involved in run out
            if (batsman.how_out.fielders && batsman.how_out.fielders.length > 0) {
              for (const fielderName of batsman.how_out.fielders) {
                const fielder = teamPlayers[battingTeamKey].find(p => p.name === fielderName) ||
                               teamPlayers[bowlingTeamKey].find(p => p.name === fielderName);
                if (fielder) {
                  fielder.fielding.runOuts += 1;
                }
              }
            } else if (batsman.how_out.fielder) {
              // Fallback for single fielder
              const fielder = teamPlayers[battingTeamKey].find(p => p.name === batsman.how_out.fielder) ||
                             teamPlayers[bowlingTeamKey].find(p => p.name === batsman.how_out.fielder);
              if (fielder) {
                fielder.fielding.runOuts += 1;
              }
            }
          }
          // Note: Other dismissal types (LBW, bowled, stumped, etc.) don't affect fielding stats
        }
      }

      // Add/update bowlers to the bowling team
      for (const bowler of inning.bowling || []) {
        const existingPlayer = teamPlayers[bowlingTeamKey].find(p => p.name === bowler.name);
        if (existingPlayer) {
          // Update bowling stats for existing player
          existingPlayer.bowling.wickets += bowler.wickets || 0;
          existingPlayer.bowling.runs += bowler.runs || 0;
          existingPlayer.bowling.overs += parseFloat(bowler.overs || 0);
        } else if (!addedPlayers.has(bowler.name)) {
          // Add new bowler to the bowling team
          let playerData = this.playersMap.get(bowler.name);
          if (!playerData) {
            // Player not in cache, create a temporary player entry
            console.warn(`⚠️  Player "${bowler.name}" not found in cache, creating temporary entry`);
            const tempPlayerId = `temp_${bowler.name.replace(/\s+/g, '_').toLowerCase()}`;
            playerData = {
              playerId: tempPlayerId,
              data: { playerId: tempPlayerId, name: bowler.name }
            };
          }
          // Track which team this player belongs to
          const teamName = bowlingTeamKey === 'team1' ? match.teams?.team1 : match.teams?.team2;
          if (teamName && !playerData.teams?.includes(teamName)) {
            if (!playerData.teams) playerData.teams = [];
            playerData.teams.push(teamName);
          }
          teamPlayers[bowlingTeamKey].push({
            playerId: playerData.playerId,
            name: bowler.name,
            role: 'bowler',
            batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
            bowling: {
              wickets: bowler.wickets || 0,
              runs: bowler.runs || 0,
              overs: parseFloat(bowler.overs || 0)
            },
            fielding: { catches: 0, runOuts: 0 }
          });
          addedPlayers.add(bowler.name);
        }
      }
    }

    return teamPlayers;
  }

  determineMatchResult(match, team1Data, team2Data) {
    if (!match.result) {
      return {
        winnerSquadId: null,
        winnerTeamId: null,
        winnerTeamName: null,
        margin: null,
        resultType: 'normal'
      };
    }

    const winnerTeamId = match.result.winner === match.teams?.team1 ? team1Data.teamId :
                        match.result.winner === match.teams?.team2 ? team2Data.teamId : null;

    return {
      winnerSquadId: winnerTeamId,
      winnerTeamId: winnerTeamId,
      winnerTeamName: match.result.winner,
      margin: match.result.margin,
      resultType: 'normal'
    };
  }

  async createMatchSquads(jsonData) {
    console.log(`Embedding squad data as innings in ${jsonData.length} matches...`);

    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (const match of jsonData) {
      try {
        const matchIdStr = match.match_id.toString().padStart(19, '0');
        const matchNumericId = parseInt(matchIdStr);

        // Find the match document to update
        const matchQuery = await this.db.collection(V2_COLLECTIONS.MATCHES)
          .where('externalReferenceId', '==', match.match_id)
          .limit(1)
          .get();

        if (matchQuery.empty) {
          console.warn(`Match ${match.match_id} not found in database, skipping innings embedding`);
          continue;
        }

        const matchDoc = matchQuery.docs[0];
        const team1Data = this.teamsMap.get(match.teams?.team1);
        const team2Data = this.teamsMap.get(match.teams?.team2);

        if (!team1Data || !team2Data) {
          console.warn(`Teams not found for match ${match.match_id}: team1=${match.teams?.team1} (found: ${!!team1Data}), team2=${match.teams?.team2} (found: ${!!team2Data})`);
          continue;
        }
        if (!team1Data.teamId || !team2Data.teamId) {
          console.warn(`Teams missing teamId for match ${match.match_id}: team1=${match.teams?.team1} (teamId: ${team1Data.teamId}), team2=${match.teams?.team2} (teamId: ${team2Data.teamId})`);
          continue;
        }

        // Extract captain information
        const captains = this.extractCaptainNames(match);

        // Extract players with stats for career updates from JSON match data
        const team1Players = this.extractSquadPlayers(match, team1Data);
        const team2Players = this.extractSquadPlayers(match, team2Data);

        // Update player career stats based on this match performance
        await this.updatePlayerCareerStats(match, team1Players, team2Players, team1Data, team2Data);

        // Increment processed count (2 teams per match)
        this.stats.matchSquads.processed += 2;
        this.stats.matchSquads.migrated += 2;
        batchCount++;

        // Update player career stats based on this match performance
        await this.updatePlayerCareerStats(match, team1Players, team2Players, team1Data, team2Data);

        // Increment processed count (2 innings per match)
        this.stats.matchSquads.processed += 2;
        this.stats.matchSquads.migrated += 2;

        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

      } catch (error) {
        console.error(`❌ Failed to embed innings for match ${match.match_id}:`, error.message);
        this.stats.matchSquads.errors++;
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Innings embedding completed: ${this.stats.matchSquads.migrated}/${this.stats.matchSquads.processed} innings embedded`);
  }

  async updatePlayerCareerStats(match, team1Players, team2Players, team1Data, team2Data) {
    // Check if this match has already been processed for career stats
    const existingMatch = await this.db.collection(V2_COLLECTIONS.MATCHES)
      .where('externalReferenceId', '==', match.match_id)
      .limit(1)
      .get();

    if (existingMatch.empty) {
      console.log(`Match ${match.match_id} not found in database, skipping career stats update`);
      return;
    }

    // Calculate winner team ID
    const winnerTeamId = match.result?.winner === match.teams?.team1 ? team1Data.teamId :
                        match.result?.winner === match.teams?.team2 ? team2Data.teamId : null;
    // Process all players from both teams
    const playersToUpdate = [...team1Players, ...team2Players];
    const maxBatchSize = 500; // Firestore batch limit
    const batches = [];

    // Use batch operations for better performance
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (const player of playersToUpdate) {
      try {
        // Find player document by playerId
        const playerQuery = await this.db.collection(V2_COLLECTIONS.PLAYERS)
          .where('playerId', '==', player.playerId)
          .limit(1)
          .get();
        
        if (playerQuery.empty) {
          console.warn(`Player with playerId ${player.playerId} not found, skipping career stats update`);
          continue;
        }        const playerDoc = playerQuery.docs[0];
        const playerRef = playerDoc.ref;
        const playerData = playerDoc.data();
        const careerStats = playerData.careerStats || {
          batting: { matchesPlayed: 0, runs: 0, highestScore: 0, average: 0, strikeRate: 0, centuries: 0, fifties: 0, ducks: 0, notOuts: 0 },
          bowling: { matchesPlayed: 0, wickets: 0, average: 0, economyRate: 0, strikeRate: 0, bestBowling: '0/0', fiveWicketHauls: 0, hatTricks: 0 },
          fielding: { catches: 0, runOuts: 0, stumpings: 0 },
          overall: { matchesPlayed: 0, wins: 0, losses: 0, winPercentage: 0 }
        };

        // Update batting stats
        if (player.batting) {
          careerStats.batting.matchesPlayed += 1;
          careerStats.batting.runs += player.batting.runs || 0;

          if (player.batting.runs > careerStats.batting.highestScore) {
            careerStats.batting.highestScore = player.batting.runs;
          }

          if (player.batting.runs >= 100) careerStats.batting.centuries += 1;
          else if (player.batting.runs >= 50) careerStats.batting.fifties += 1;
          else if (player.batting.runs === 0) careerStats.batting.ducks += 1;

          // Calculate batting average and strike rate
          const totalRuns = careerStats.batting.runs;
          const totalMatches = careerStats.batting.matchesPlayed;
          careerStats.batting.average = totalMatches > 0 ? totalRuns / totalMatches : 0;
          careerStats.batting.strikeRate = player.batting.balls > 0 ? (player.batting.runs / player.batting.balls) * 100 : 0;
        }

        // Update bowling stats
        if (player.bowling && player.bowling.overs > 0) {
          careerStats.bowling.matchesPlayed += 1;
          careerStats.bowling.wickets += player.bowling.wickets || 0;

          if (player.bowling.wickets >= 5) careerStats.bowling.fiveWicketHauls += 1;
          if (player.bowling.wickets >= 3 && player.bowling.wickets < 5) {
            // Check for hat trick (3 wickets in consecutive balls) - simplified logic
            careerStats.bowling.hatTricks += 1;
          }

          // Update best bowling
          const currentBestBowling = careerStats.bowling.bestBowling || '0/0';
          const currentBest = currentBestBowling.split('/').map(Number);
          const newWickets = player.bowling.wickets;
          const newRuns = player.bowling.runs;

          if (newWickets > currentBest[0] || (newWickets === currentBest[0] && newRuns < currentBest[1])) {
            careerStats.bowling.bestBowling = `${newWickets}/${newRuns}`;
          }

          // Calculate bowling average and economy
          careerStats.bowling.average = careerStats.bowling.wickets > 0 ? player.bowling.runs / careerStats.bowling.wickets : 0;
          careerStats.bowling.economyRate = player.bowling.overs > 0 ? player.bowling.runs / player.bowling.overs : 0;
          careerStats.bowling.strikeRate = careerStats.bowling.wickets > 0 ? (player.bowling.overs * 6) / careerStats.bowling.wickets : 0;
        }

        // Update fielding stats
        if (player.fielding) {
          careerStats.fielding.catches += player.fielding.catches || 0;
          careerStats.fielding.runOuts += player.fielding.runOuts || 0;
          // Stumpings would be tracked separately for wicket keepers
        }

        // Update overall stats
        careerStats.overall.matchesPlayed += 1;
        if (winnerTeamId === player.teamId) {
          careerStats.overall.wins += 1;
        } else {
          careerStats.overall.losses += 1;
        }
        careerStats.overall.winPercentage = careerStats.overall.matchesPlayed > 0 ?
          (careerStats.overall.wins / careerStats.overall.matchesPlayed) * 100 : 0;

        // Update achievements based on milestones
        const achievements = playerData.achievements || { batting: [], bowling: [], fielding: [], team: [], individual: [] };

        // Batting achievements
        if (player.batting?.runs >= 100) achievements.batting.push(`Century: ${player.batting.runs} runs`);
        if (player.batting?.runs >= 50 && player.batting?.runs < 100) achievements.batting.push(`Half Century: ${player.batting.runs} runs`);

        // Bowling achievements
        if (player.bowling?.wickets >= 5) achievements.bowling.push(`Five wicket haul: ${player.bowling.wickets}/${player.bowling.runs}`);
        if (player.bowling?.wickets >= 3) achievements.bowling.push(`Hat trick: ${player.bowling.wickets} wickets`);

        // Fielding achievements
        if (player.fielding?.catches >= 3) achievements.fielding.push(`Multiple catches: ${player.fielding.catches} catches`);
        if (player.fielding?.runOuts >= 2) achievements.fielding.push(`Run out specialist: ${player.fielding.runOuts} run outs`);

        // Update recent matches
        const recentMatches = playerData.recentMatches || [];
        
        // Helper function to clean objects by removing undefined values
        const cleanObject = (obj) => {
          if (!obj || typeof obj !== 'object') return obj;
          const cleaned = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              cleaned[key] = value;
            }
          }
          return Object.keys(cleaned).length > 0 ? cleaned : undefined;
        };

        const matchSummary = {
          matchId: match.match_id,
          date: new Date(match.date || Date.now()),
          opponent: player.teamId === team1Data.teamId ? match.teams?.team2 : match.teams?.team1,
          result: winnerTeamId === player.teamId ? 'Won' : 'Lost'
        };

        // Only add batting/bowling/fielding if they have valid data
        const cleanedBatting = cleanObject(player.batting);
        const cleanedBowling = cleanObject(player.bowling);
        const cleanedFielding = cleanObject(player.fielding);

        if (cleanedBatting) matchSummary.batting = cleanedBatting;
        if (cleanedBowling) matchSummary.bowling = cleanedBowling;
        if (cleanedFielding) matchSummary.fielding = cleanedFielding;

        recentMatches.unshift(matchSummary);
        if (recentMatches.length > 10) recentMatches.pop(); // Keep only last 10 matches

        // Update recent teams
        const recentTeams = playerData.recentTeams || [];
        const teamInfo = {
          teamId: player.teamId,
          teamName: player.teamId === team1Data.teamId ? match.teams?.team1 : match.teams?.team2,
          lastPlayed: new Date(match.date || Date.now()),
          matchesPlayed: 1
        };

        // Check if team already exists in recent teams
        const existingTeamIndex = recentTeams.findIndex(t => t.teamId === player.teamId);
        if (existingTeamIndex >= 0) {
          // Update existing team entry
          recentTeams[existingTeamIndex].matchesPlayed += 1;
          recentTeams[existingTeamIndex].lastPlayed = teamInfo.lastPlayed;
          // Move to front
          const [existingTeam] = recentTeams.splice(existingTeamIndex, 1);
          recentTeams.unshift(existingTeam);
        } else {
          // Add new team
          recentTeams.unshift(teamInfo);
          if (recentTeams.length > 5) recentTeams.pop(); // Keep only last 5 teams
        }

        // Add to batch instead of immediate update
        currentBatch.update(playerRef, {
          careerStats,
          achievements,
          recentMatches,
          recentTeams,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;

        // Commit batch if it reaches the limit
        if (batchCount >= maxBatchSize) {
          console.log(`Committing batch of ${batchCount} player updates...`);
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

      } catch (error) {
        console.error(`Error preparing career stats update for player ${player.playerId}:`, error);
      }
    }

    // Commit any remaining operations in the batch
    if (batchCount > 0) {
      console.log(`Committing final batch of ${batchCount} player updates...`);
      batches.push(currentBatch.commit());
    }

    // Wait for all batches to complete sequentially to avoid read conflicts
    console.log(`Waiting for ${batches.length} batches to complete...`);
    for (const batchPromise of batches) {
      await batchPromise;
    }
    console.log('All career stats updates completed!');
  }

  createInningsData(match, teamData, squadPlayers, captainInfo, findPlayerDismissal) {
    // Helper function to clean undefined values from objects
    const cleanObject = (obj) => {
      if (obj === null || obj === undefined) return undefined;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) {
        const cleanedArray = obj.map(cleanObject).filter(item => item !== undefined);
        return cleanedArray;
      }
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = cleanObject(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    };

    try {
      if (!teamData || !teamData.teamId || !teamData.data || !teamData.data.name) {
        console.error(`Invalid teamData for innings creation:`, teamData);
        return null;
      }

      // Find the innings data for this team from the match JSON
      const teamInnings = match.innings?.find(innings =>
        innings.team === teamData.data.name ||
        innings.battingTeam === teamData.data.name
      );

      if (!teamInnings) {
        console.warn(`No innings data found for team ${teamData.data.name} in match ${match.match_id}`);
        console.warn(`Available innings teams:`, match.innings?.map(i => i.team));
        return null;
      }

      // Create the innings structure with actual data from JSON
      const inningsData = {
        teamId: teamData.teamId,
        teamName: teamData.data.name,
        score: teamInnings.score,
        overs: teamInnings.overs,
        extras: teamInnings.extras,
        captain: captainInfo.id ? {
          playerId: captainInfo.id,
          name: captainInfo.name
        } : null,
        viceCaptain: null,
        batting: teamInnings.batting?.map(batter => ({
          playerId: this.findPlayerIdByName(batter.name) || `temp_${batter.name.replace(/\s+/g, '_').toLowerCase()}`,
          name: batter.name,
          role: batter.is_wicket_keeper ? 'wicket-keeper' : 'batsman',
          battingOrder: null, // Will be set based on actual order
          bowlingOrder: null,
          battingStyle: batter.batting_style || 'RHB',
          bowlingStyle: null,
          isCaptain: batter.is_captain || false,
          isWicketKeeper: batter.is_wicket_keeper || false,
          runs: batter.runs || 0,
          balls: batter.balls || 0,
          fours: batter.fours || 0,
          sixes: batter.sixes || 0,
          strikeRate: batter.sr || 0,
          howOut: batter.how_out ? {
            type: batter.how_out.type,
            text: batter.how_out.text,
            bowler: batter.how_out.bowler,
            fielder: batter.how_out.fielder,
            fielders: batter.how_out.fielders
          } : null
        })) || [],
        bowling: teamInnings.bowling?.map(bowler => ({
          playerId: this.findPlayerIdByName(bowler.name) || `temp_${bowler.name.replace(/\s+/g, '_').toLowerCase()}`,
          name: bowler.name,
          overs: bowler.overs || 0,
          maidens: bowler.maidens || 0,
          runs: bowler.runs || 0,
          wickets: bowler.wickets || 0,
          dots: bowler.dots || 0,
          fours: bowler.fours || 0,
          sixes: bowler.sixes || 0,
          wides: bowler.wides || 0,
          noBalls: bowler.noballs || bowler.no_balls || 0,
          economy: bowler.eco || 0,
          isCaptain: bowler.is_captain || false,
          isWicketKeeper: bowler.is_wicket_keeper || false
        })) || [],
        fallOfWickets: teamInnings.fall_of_wickets?.map(fow => ({
          score: fow.score,
          wicket: fow.wicket,
          player: fow.player,
          over: fow.over
        })) || [],
        didNotBat: teamInnings.did_not_bat || []
      };

      return inningsData;
    } catch (error) {
      console.error(`Error creating innings data for team ${teamData.data.name}:`, error);
      return null;
    }
  }

  findPlayerIdByName(playerName) {
    if (!playerName) return null;

    // Search through the players map for a matching name
    for (const [nameKey, playerData] of this.playersMap.entries()) {
      if (playerData.data?.name && playerData.data.name.toLowerCase() === playerName.toLowerCase()) {
        return playerData.playerId;
      }
    }

    // If not found, try a fuzzy match (remove extra spaces, etc.)
    const normalizedName = playerName.toLowerCase().trim();
    for (const [nameKey, playerData] of this.playersMap.entries()) {
      if (playerData.data?.name) {
        const normalizedPlayerName = playerData.data.name.toLowerCase().trim();
        if (normalizedPlayerName === normalizedName) {
          return playerData.playerId;
        }
      }
    }

    console.warn(`Player ID not found for name: ${playerName}`);
    return null;
  }

  async createMatchSquadDocument(match, matchNumericId, teamData, opponentTeamData, captainInfo, displayId) {
    console.log(`Creating squad for team ${teamData.data.name} in match ${match.match_id}`);
    // Get all players for this team from the innings data
    const squadPlayers = this.extractSquadPlayers(match, teamData);
    console.log(`Extracted ${squadPlayers.length} players for team ${teamData.data.name}`);

    // Determine wicket keepers
    const wicketKeepers = [];
    for (const player of squadPlayers) {
      if (player.role === 'wicket-keeper') {
        wicketKeepers.push({
          playerId: player.playerId,
          name: player.name,
          isPrimary: wicketKeepers.length === 0 // First wicket keeper is primary
        });
      }
    }

    // Create the match squad document
    const matchSquadId = `${matchNumericId}_${teamData.teamId}`;

    return {
      matchSquadId: matchSquadId,
      displayId: displayId,
      matchId: matchNumericId.toString(),
      teamId: teamData.teamId.toString(),
      match: {
        matchId: matchNumericId.toString(),
        title: `${match.teams?.team1 || 'Team 1'} vs ${match.teams?.team2 || 'Team 2'}`,
        date: new Date(match.date),
        venue: match.ground || 'MM Sports Park- Box Cricket',
        tournamentName: match.tournament || 'EPL WEEKEND MAHAMUKABALA',
        status: 'completed'
      },
      team: {
        teamId: teamData.teamId.toString(),
        name: teamData.data.name,
        shortName: teamData.data.shortName
      },
      players: squadPlayers.map((player, index) => ({
        playerId: player.playerId,
        teamId: player.teamId,
        name: player.name,
        role: player.role,
        battingStyle: player.battingStyle || 'RHB',
        bowlingStyle: player.bowlingStyle || null,
        battingOrder: player.battingOrder || (index + 1), // Default to array order if not specified
        bowlingOrder: player.bowlingOrder || null, // Will be set if player bowled
        isCaptain: player.playerId === captainInfo.id,
        isWicketKeeper: player.role === 'wicket-keeper',
        avatar: null
      })),
      captainId: captainInfo.id,
      captain: captainInfo.id ? {
        playerId: captainInfo.id,
        name: captainInfo.name
      } : null,
      wicketKeepers: wicketKeepers,
      opponentSquad: {
        teamId: opponentTeamData.teamId.toString(),
        name: opponentTeamData.data.name,
        shortName: opponentTeamData.data.shortName
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  }

  extractPlayersFromV2Match(teamData) {
    // Extract players directly from v2 match team data
    const players = teamData.players || [];

    return players.map(player => ({
      playerId: player.playerId,
      teamId: teamData.id,
      name: player.name,
      role: player.role || 'batsman',
      battingStyle: 'RHB',
      bowlingStyle: player.role === 'bowler' ? 'RF' : null,
      batting: player.batting || { runs: 0, balls: 0, fours: 0, sixes: 0 },
      bowling: player.bowling || { wickets: 0, runs: 0, overs: 0, maidens: 0 },
      fielding: player.fielding || { catches: 0, runOuts: 0 }
    })).filter(player => player.playerId); // Only include players with valid IDs
  }

  extractSquadPlayers(match, teamData) {
    const playerStats = new Map(); // playerName -> aggregated stats
    const battingOrderMap = new Map(); // playerName -> batting position
    const bowlingOrderMap = new Map(); // playerName -> bowling position

    // Process all innings to collect player statistics and orders
    for (const inning of match.innings || []) {
      const isBattingTeam = inning.team === teamData.data.name;

      if (isBattingTeam) {
        // Process batting statistics and batting order
        for (let i = 0; i < (inning.batting || []).length; i++) {
          const batsman = inning.batting[i];
          const playerName = batsman.name;

          // Set batting order (1-based)
          if (!battingOrderMap.has(playerName)) {
            battingOrderMap.set(playerName, i + 1);
          }

          if (!playerStats.has(playerName)) {
            playerStats.set(playerName, {
              playerId: null,
              teamId: teamData.teamId,
              name: playerName,
              role: batsman.is_wicket_keeper ? 'wicket-keeper' : 'batsman',
              battingStyle: batsman.batting_style || 'RHB',
              bowlingStyle: null,
              battingOrder: i + 1,
              bowlingOrder: null,
              batting: {
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0
              },
              bowling: {
                wickets: 0,
                runs: 0,
                overs: 0,
                maidens: 0
              },
              fielding: {
                catches: 0,
                runOuts: 0
              }
            });
          }

          const playerStat = playerStats.get(playerName);
          playerStat.batting.runs += batsman.runs || 0;
          playerStat.batting.balls += batsman.balls || 0;
          playerStat.batting.fours += batsman.fours || 0;
          playerStat.batting.sixes += batsman.sixes || 0;
        }

        // Process bowling statistics and bowling order
        for (let i = 0; i < (inning.bowling || []).length; i++) {
          const bowler = inning.bowling[i];
          const playerName = bowler.name;

          // Set bowling order (1-based)
          if (!bowlingOrderMap.has(playerName)) {
            bowlingOrderMap.set(playerName, i + 1);
          }

          if (!playerStats.has(playerName)) {
            playerStats.set(playerName, {
              playerId: null,
              teamId: teamData.teamId,
              name: playerName,
              role: 'bowler',
              battingStyle: 'RHB',
              bowlingStyle: 'RF',
              battingOrder: null,
              bowlingOrder: i + 1,
              batting: {
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0
              },
              bowling: {
                wickets: 0,
                runs: 0,
                overs: 0,
                maidens: 0
              },
              fielding: {
                catches: 0,
                runOuts: 0
              }
            });
          }

          const playerStat = playerStats.get(playerName);
          playerStat.bowling.wickets += bowler.wickets || 0;
          playerStat.bowling.runs += bowler.runs || 0;
          playerStat.bowling.overs += bowler.overs || 0;
          playerStat.bowling.maidens += bowler.maidens || 0;
        }
      }

      // Process fielding statistics from all innings (catches, run outs)
      // This is a simplified version - in real cricket, fielding stats come from the opposing team's innings
      for (const batsman of inning.batting || []) {
        if (batsman.how_out && batsman.how_out.type) {
          const dismissalType = batsman.how_out.type.toLowerCase();

          if (dismissalType === 'caught') {
            // Find the fielder who caught it
            const fielderName = batsman.how_out.fielder;
            if (fielderName && playerStats.has(fielderName)) {
              playerStats.get(fielderName).fielding.catches += 1;
            }
          } else if (dismissalType === 'run out') {
            // Run outs might involve multiple fielders
            const fielders = batsman.how_out.fielders || [];
            fielders.forEach(fielderName => {
              if (fielderName && playerStats.has(fielderName)) {
                playerStats.get(fielderName).fielding.runOuts += 1;
              }
            });
          }
        }
      }
    }

    // Convert to array and set playerIds from playersMap, and assign orders
    const playersArray = Array.from(playerStats.values()).map(player => {
      const playerData = this.playersMap.get(player.name);
      if (playerData) {
        player.playerId = playerData.playerId;
      }

      // Set batting and bowling orders from the maps
      player.battingOrder = battingOrderMap.get(player.name) || player.battingOrder;
      player.bowlingOrder = bowlingOrderMap.get(player.name) || player.bowlingOrder;

      return player;
    }).filter(player => player.playerId); // Only include players we have in our database

    // If we have very few players, try to get more from the team data
    if (playersArray.length < 8) {
      console.warn(`Limited player data for team ${teamData.data.name}, only ${playersArray.length} players found`);
    }

    return playersArray;
  }

  async populateTeamsWithPlayers() {
    console.log('🚀 Starting Team Players Population...');

    try {
      // Get all matches to extract players from embedded innings data
      const matchesSnapshot = await this.db.collection(V2_COLLECTIONS.MATCHES).get();
      const matches = matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`Found ${matches.length} matches to process for player extraction`);

      // Build team-player mapping from innings data in matches
      const teamPlayersMap = new Map();

      for (const match of matches) {
        // Process innings data from both teams
        const teamsToProcess = [];
        if (match.team1?.innings) {
          teamsToProcess.push({ teamId: match.team1.id, innings: match.team1.innings });
        }
        if (match.team2?.innings) {
          teamsToProcess.push({ teamId: match.team2.id, innings: match.team2.innings });
        }

        for (const { teamId, innings } of teamsToProcess) {
          if (!teamId) continue;

          if (!teamPlayersMap.has(teamId)) {
            teamPlayersMap.set(teamId, new Map());
          }

          // Extract players from batting data
          for (const batsman of innings.batting || []) {
            if (batsman.playerId && batsman.name) {
              teamPlayersMap.get(teamId).set(batsman.playerId, {
                playerId: batsman.playerId,
                name: batsman.name,
                role: batsman.role || 'batsman',
                battingStyle: batsman.battingStyle || null,
                avatar: batsman.avatar || null
              });
            }
          }

          // Extract players from bowling data
          for (const bowler of innings.bowling || []) {
            if (bowler.playerId && bowler.name) {
              teamPlayersMap.get(teamId).set(bowler.playerId, {
                playerId: bowler.playerId,
                name: bowler.name,
                role: bowler.role || 'bowler',
                battingStyle: bowler.battingStyle || null,
                avatar: bowler.avatar || null
              });
            }
          }
        }
      }

      console.log(`Built team-player mapping for ${teamPlayersMap.size} teams`);

      // Now update each team with their players
      const teamsSnapshot = await this.db.collection(V2_COLLECTIONS.TEAMS).get();
      const teams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ref: doc.ref,
        ...doc.data()
      }));

      console.log(`Found ${teams.length} teams to update`);

      let updatedCount = 0;
      let errorCount = 0;

      for (const team of teams) {
        try {
          console.log(`Updating team: ${team.name} (${team.teamId})`);

          const teamPlayerMap = teamPlayersMap.get(team.teamId);
          const teamPlayers = teamPlayerMap ? Array.from(teamPlayerMap.values()) : [];

          console.log(`Found ${teamPlayers.length} players in matches for team ${team.name} (${team.teamId})`);

          if (teamPlayers.length === 0) {
            console.log(`⚠️  No players found for team ${team.name}, skipping update`);
            continue;
          }

          // Get stats for each player
          const playersWithStats = [];
          for (const player of teamPlayers) {
            const playerStats = await this.getPlayerStatsForTeam(player.playerId, team.teamId);

            playersWithStats.push({
              playerId: player.playerId,
              player: player,
              stats: playerStats, // Use the full enhanced stats structure
              isCaptain: player.playerId === team.captainId,
              isViceCaptain: player.playerId === team.viceCaptainId
            });
          }

          // Sort players by name
          playersWithStats.sort((a, b) => a.player.name.localeCompare(b.player.name));

          // Update team with players
          await team.ref.update({
            players: playersWithStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ Updated ${team.name} with ${playersWithStats.length} players`);
          updatedCount++;

        } catch (error) {
          console.error(`❌ Failed to update team ${team.name}:`, error);
          errorCount++;
        }
      }

      // Update stats
      this.stats.teamPlayers.processed = teams.length;
      this.stats.teamPlayers.migrated = updatedCount;
      this.stats.teamPlayers.errors = errorCount;

      console.log(`\n🎉 Team Players Population Summary:`);
      console.log(`Updated: ${updatedCount}/${teams.length} teams`);
      console.log(`Errors: ${errorCount}`);

      if (errorCount === 0) {
        console.log('\n✅ All teams updated successfully!');
      }

    } catch (error) {
      console.error('❌ Team players population failed:', error);
      throw error;
    }
  }

  async getPlayerStatsForTeam(playerId, teamId) {
    // Get all matches where this player participated for this team
    // Now we need to query matches and look in the innings data
    const matches = await this.db.collection(V2_COLLECTIONS.MATCHES)
      .where('team1.id', '==', teamId)
      .get();

    const matches2 = await this.db.collection(V2_COLLECTIONS.MATCHES)
      .where('team2.id', '==', teamId)
      .get();

    const allMatches = [...matches.docs, ...matches2.docs];

    let matchesPlayed = 0;
    let totalRuns = 0;
    let totalWickets = 0;
    let lastPlayed = null;

    // Enhanced batting stats
    let battingInnings = 0;
    let notOuts = 0;
    let highestScore = 0;
    let centuries = 0;
    let fifties = 0;
    let ducks = 0;
    let totalBallsFaced = 0;

    // Enhanced bowling stats
    let bowlingInnings = 0;
    let totalOvers = 0;
    let totalRunsConceded = 0;
    let maidens = 0;
    let bestBowlingFigures = { wickets: 0, runs: 0 };
    let fiveWicketHauls = 0;

    // Fielding stats
    let catches = 0;
    let runOuts = 0;

    for (const matchDoc of allMatches) {
      const match = matchDoc.data();

      // Find the innings for this team
      let teamInnings = null;
      if (match.team1?.id === teamId && match.team1?.innings) {
        teamInnings = match.team1.innings;
      } else if (match.team2?.id === teamId && match.team2?.innings) {
        teamInnings = match.team2.innings;
      }

      if (!teamInnings) continue;

      const player = teamInnings.batting?.find(p => p.playerId === playerId);
      if (player) {
        matchesPlayed++;

        // Enhanced batting stats
        if (player.batting) {
          battingInnings++;
          const runs = player.batting.runs || 0;
          const balls = player.batting.balls || 0;
          const isNotOut = player.batting.notOut || false;

          totalRuns += runs;
          totalBallsFaced += balls;

          if (!isNotOut) {
            notOuts++;
          }

          if (runs > highestScore) {
            highestScore = runs;
          }

          if (runs >= 100) {
            centuries++;
          } else if (runs >= 50) {
            fifties++;
          }

          if (runs === 0 && !isNotOut) {
            ducks++;
          }
        }

        // Enhanced bowling stats
        if (player.bowling) {
          bowlingInnings++;
          const wickets = player.bowling.wickets || 0;
          const runsConceded = player.bowling.runs || 0;
          const overs = player.bowling.overs || 0;
          const maidenOvers = player.bowling.maidens || 0;

          totalWickets += wickets;
          totalRunsConceded += runsConceded;
          totalOvers += overs;
          maidens += maidenOvers;

          // Track best bowling figures
          if (wickets > bestBowlingFigures.wickets ||
              (wickets === bestBowlingFigures.wickets && runsConceded < bestBowlingFigures.runs)) {
            bestBowlingFigures = { wickets, runs: runsConceded };
          }

          if (wickets >= 5) {
            fiveWicketHauls++;
          }
        }

        // Fielding stats
        if (player.fielding) {
          catches += player.fielding.catches || 0;
          runOuts += player.fielding.runOuts || 0;
        }

        // Track last played date
        let matchDate = null;
        try {
          if (match.date?.toDate) {
            matchDate = match.date.toDate();
          } else if (match.date) {
            matchDate = new Date(match.date);
          }
          // Validate the date
          if (matchDate && !isNaN(matchDate.getTime())) {
            if (!lastPlayed || matchDate > lastPlayed) {
              lastPlayed = matchDate;
            }
          }
        } catch (error) {
          console.warn(`Invalid date format for match ${match.externalReferenceId}: ${match.date}`);
        }
      }
    }

    // Calculate derived stats
    const battingAverage = battingInnings > notOuts ? parseFloat((totalRuns / (battingInnings - notOuts)).toFixed(2)) : 0.00;
    const strikeRate = totalBallsFaced > 0 ? parseFloat(((totalRuns / totalBallsFaced) * 100).toFixed(2)) : 0.00;
    const bowlingAverage = totalWickets > 0 ? parseFloat((totalRunsConceded / totalWickets).toFixed(2)) : 0.00;
    const economyRate = totalOvers > 0 ? parseFloat((totalRunsConceded / totalOvers).toFixed(2)) : 0.00;

    return {
      matchesPlayed,
      batting: {
        innings: battingInnings,
        runs: totalRuns,
        highest: highestScore,
        average: battingAverage,
        strikeRate: strikeRate,
        centuries,
        fifties,
        ducks,
        notOuts
      },
      bowling: {
        innings: bowlingInnings,
        wickets: totalWickets,
        runs: totalRunsConceded,
        overs: totalOvers,
        maidens,
        bestFigures: `${bestBowlingFigures.wickets}/${bestBowlingFigures.runs}`,
        average: bowlingAverage,
        economy: economyRate,
        fiveWicketHauls
      },
      fielding: {
        catches,
        runOuts
      },
      lastPlayed: lastPlayed ? admin.firestore.Timestamp.fromDate(lastPlayed) : null
    };
  }

  async calculateAndUpdateTeamStats() {
    console.log('📊 Calculating comprehensive team statistics...');

    try {
      // Get all teams
      const teamsSnapshot = await this.db.collection(V2_COLLECTIONS.TEAMS).get();
      const teams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ref: doc.ref,
        ...doc.data()
      }));

      console.log(`Found ${teams.length} teams to calculate stats for`);

      let updatedCount = 0;
      let errorCount = 0;

      for (const team of teams) {
        try {
          console.log(`Calculating stats for team: ${team.name} (${team.teamId})`);

          // Get all matches where this team participated
          // Since Firestore doesn't support querying nested fields, get all matches and filter in memory
          const allMatchesSnapshot = await this.db.collection(V2_COLLECTIONS.MATCHES).get();
          const allMatches = allMatchesSnapshot.docs.filter(doc => {
            const match = doc.data();
            return match.team1?.id === team.teamId || match.team2?.id === team.teamId;
          });

          // Calculate team statistics
          const teamStats = {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winPercentage: 0,
            totalRunsScored: 0,
            totalRunsConceded: 0,
            totalWicketsTaken: 0,
            totalWicketsLost: 0,
            highestScore: 0,
            lowestScore: null,
            averageScore: 0,
            lastPlayed: null,
            recentMatches: []
          };

          for (const matchDoc of allMatches) {
            const match = matchDoc.data();
            teamStats.matchesPlayed++;

            // Find the innings for this team
            const teamInnings = match.innings?.find(inning => inning.teamId === team.teamId);
            const opponentInnings = match.innings?.find(inning => inning.teamId !== team.teamId);

            if (teamInnings) {
              // Calculate runs scored and wickets lost
              const runsScored = teamInnings.batting?.reduce((total, batsman) => total + (batsman.runs || 0), 0) || 0;
              const wicketsLost = teamInnings.batting?.filter(batsman => batsman.how_out && batsman.how_out.type !== 'not out').length || 0;

              teamStats.totalRunsScored += runsScored;
              teamStats.totalWicketsLost += wicketsLost;

              // Track highest/lowest scores
              if (runsScored > teamStats.highestScore) {
                teamStats.highestScore = runsScored;
              }
              if (teamStats.lowestScore === null || runsScored < teamStats.lowestScore) {
                teamStats.lowestScore = runsScored;
              }
            }

            if (opponentInnings) {
              // Calculate wickets taken and runs conceded
              const wicketsTaken = opponentInnings.bowling?.reduce((total, bowler) => total + (bowler.wickets || 0), 0) || 0;
              const runsConceded = opponentInnings.batting?.reduce((total, batsman) => total + (batsman.runs || 0), 0) || 0;

              teamStats.totalWicketsTaken += wicketsTaken;
              teamStats.totalRunsConceded += runsConceded;
            }

            // Determine match result
            if (match.result?.winnerTeamId === team.teamId) {
              teamStats.wins++;
            } else if (match.result?.winnerTeamId && match.result.winnerTeamId !== team.teamId) {
              teamStats.losses++;
            } else {
              teamStats.draws++;
            }

            // Track last played date
            const matchDate = match.scheduledDate?.toDate ? match.scheduledDate.toDate() : new Date(match.scheduledDate || Date.now());
            if (!teamStats.lastPlayed || matchDate > teamStats.lastPlayed) {
              teamStats.lastPlayed = matchDate;
            }

            // Add to recent matches (keep last 5)
            const opponentName = match.team1?.id === team.teamId ? match.team2?.name : match.team1?.name;
            const matchSummary = {
              matchId: match.numericId || matchDoc.id,
              opponent: opponentName,
              result: match.result?.winner === team.name ? 'Won' : (match.result?.winner ? 'Lost' : 'Draw'),
              runsScored: teamInnings?.batting?.reduce((total, batsman) => total + (batsman.runs || 0), 0) || 0,
              runsConceded: opponentInnings?.batting?.reduce((total, batsman) => total + (batsman.runs || 0), 0) || 0,
              date: matchDate
            };

            teamStats.recentMatches.unshift(matchSummary);
            if (teamStats.recentMatches.length > 5) {
              teamStats.recentMatches.pop();
            }
          }

          // Calculate derived statistics
          teamStats.winPercentage = teamStats.matchesPlayed > 0 ? (teamStats.wins / teamStats.matchesPlayed) * 100 : 0;
          teamStats.averageScore = teamStats.matchesPlayed > 0 ? teamStats.totalRunsScored / teamStats.matchesPlayed : 0;

          // Convert dates to Firestore timestamps
          if (teamStats.lastPlayed) {
            teamStats.lastPlayed = admin.firestore.Timestamp.fromDate(teamStats.lastPlayed);
          }

          teamStats.recentMatches = teamStats.recentMatches.map(match => ({
            ...match,
            date: admin.firestore.Timestamp.fromDate(match.date)
          }));

          // Update team with statistics
          await team.ref.update({
            teamStats: teamStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ Updated ${team.name} with stats: ${teamStats.matchesPlayed} matches, ${teamStats.wins} wins, ${teamStats.losses} losses`);
          updatedCount++;

        } catch (error) {
          console.error(`❌ Failed to calculate stats for team ${team.name}:`, error);
          errorCount++;
        }
      }

      // Update stats
      this.stats.teamStats.processed = teams.length;
      this.stats.teamStats.migrated = updatedCount;
      this.stats.teamStats.errors = errorCount;

      console.log(`\n📊 Team Statistics Calculation Summary:`);
      console.log(`Updated: ${updatedCount}/${teams.length} teams`);
      console.log(`Errors: ${errorCount}`);

      if (errorCount === 0) {
        console.log('\n✅ All team statistics calculated successfully!');
      }

    } catch (error) {
      console.error('❌ Team statistics calculation failed:', error);
      throw error;
    }
  }

  printMigrationSummary() {
    console.log('\n🎉 V2 Migration from JSON Summary:');
    console.log('=====================================');
    console.log(`Teams: ${this.stats.teams.migrated}/${this.stats.teams.processed} migrated (${this.stats.teams.errors} errors)`);
    console.log(`Players: ${this.stats.players.migrated}/${this.stats.players.processed} migrated (${this.stats.players.errors} errors)`);
    console.log(`Matches: ${this.stats.matches.migrated}/${this.stats.matches.processed} migrated (${this.stats.matches.errors} errors)`);
    console.log(`Match Innings: ${this.stats.matchSquads.migrated}/${this.stats.matchSquads.processed} embedded (${this.stats.matchSquads.errors} errors)`);
    console.log(`Team Players: ${this.stats.teamPlayers.migrated}/${this.stats.teamPlayers.processed} migrated (${this.stats.teamPlayers.errors} errors)`);
    console.log(`Team Stats: ${this.stats.teamStats.migrated}/${this.stats.teamStats.processed} migrated (${this.stats.teamStats.errors} errors)`);

    const totalMigrated = this.stats.teams.migrated + this.stats.players.migrated + this.stats.matches.migrated + this.stats.matchSquads.migrated + this.stats.teamPlayers.migrated + this.stats.teamStats.migrated;
    const totalProcessed = this.stats.teams.processed + this.stats.players.processed + this.stats.matches.processed + this.stats.matchSquads.processed + this.stats.teamPlayers.processed + this.stats.teamStats.processed;
    const totalErrors = this.stats.teams.errors + this.stats.players.errors + this.stats.matches.errors + this.stats.matchSquads.errors + this.stats.teamPlayers.errors + this.stats.teamStats.errors;

    console.log(`\nTotal: ${totalMigrated}/${totalProcessed} migrated (${totalErrors} errors)`);

    if (totalErrors === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('📝 Next steps:');
      console.log('1. Test the v2 API endpoints');
      console.log('2. Update client applications to use v2 collections');
      console.log('3. Verify nested team structure in API responses');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the error messages above.');
    }
  }
}

// Main execution function
async function runJSONToV2Migration() {
  const migrationManager = new JSONToV2Migration();

  try {
    await migrationManager.migrateFromJSON();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { JSONToV2Migration, runJSONToV2Migration };

// Run if called directly
if (require.main === module) {
  runJSONToV2Migration();
}