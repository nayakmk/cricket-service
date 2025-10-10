/**
 * V2 MIGRATION FROM JSON SOURCE
 *
 * Migrates data directly from the original JSON source to v2 collections
 * with proper nested team structure and API enhancements
 *
 * Source: reports/cricket_matches_from_pdfs_final.json
 * Target: v2 collections with nested team structure
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
      matchSquads: { processed: 0, migrated: 0, errors: 0 }
    };

    // In-memory caches for lookups
    this.teamsMap = new Map(); // name -> { id, data }
    this.playersMap = new Map(); // name -> { id, data }
    this.matchSquadsMap = new Map(); // matchId_teamId -> squadId
    this.teamCaptainsMap = new Map(); // teamName -> captainName
  }

  async migrateFromJSON() {
    console.log('🚀 Starting V2 Migration from JSON Source...');

    try {
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

        const v2DocRef = this.db.collection(V2_COLLECTIONS.TEAMS).doc(teamData.numericId.toString());
        currentBatch.set(v2DocRef, teamData);

        // Cache for later use
        this.teamsMap.set(teamName, {
          id: teamData.numericId.toString(),  // Now using numericId as document ID
          numericId: teamData.numericId.toString(),
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
    // Use smaller base number to avoid JavaScript precision issues
    const baseId = 1000000000; // 1 billion instead of 1 quintillion
    const numericId = baseId + index;

    return {
      numericId: numericId,
      displayId: index,
      name: teamName,
      shortName: teamName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3),
      captainId: null,
      captain: null,
      viceCaptainId: null,
      viceCaptain: null,
      homeGround: 'MM Sports Park- Box Cricket',
      players: [], // Will be populated later
      recentMatches: [],
      tournaments: [{
        tournamentId: '1000000001',
        name: 'EPL WEEKEND MAHAMUKABALA',
        shortName: 'EPL',
        season: '2024'
      }],
      teamStats: {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winPercentage: 0,
        totalPlayers: 0,
        avgPlayersPerMatch: 0
      },
      isActive: true,
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

        // Cache for later use
        this.playersMap.set(playerName, {
          id: playerData.numericId.toString(),
          data: playerData
        });

        const v2DocRef = this.db.collection(V2_COLLECTIONS.PLAYERS).doc(playerData.numericId.toString());
        currentBatch.set(v2DocRef, playerData);

        batchCount++;

        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.players.migrated++;
        console.log(`✅ Migrated player: ${playerData.name}`);

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
    const baseId = 2000000000; // 2 billion
    const numericId = baseId + index;

    return {
      numericId: numericId,
      displayId: index,
      name: playerName,
      role: 'batsman', // Default, will be updated based on actual performance
      battingStyle: 'RHB', // Default
      bowlingStyle: null,
      preferredTeamId: null, // Will be set later
      preferredTeam: null,
      dateOfBirth: null,
      nationality: 'Unknown',
      isActive: true,
      careerStats: {
        matchesPlayed: 0,
        runs: 0,
        wickets: 0,
        battingAverage: 0,
        bowlingAverage: 0,
        strikeRate: 0,
        economy: 0,
        highestScore: 0,
        bestBowling: '0/0'
      },
      recentMatches: [],
      achievements: [],
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
        const matchData = this.createMatchData(match);

        // Extract and store captain information for teams
        const captains = this.extractCaptainNames(match);
        if (captains.team1.name !== 'TBD') {
          this.teamCaptainsMap.set(match.teams?.team1, captains.team1.name);
        }
        if (captains.team2.name !== 'TBD') {
          this.teamCaptainsMap.set(match.teams?.team2, captains.team2.name);
        }

        const v2DocRef = this.db.collection(V2_COLLECTIONS.MATCHES).doc(matchData.numericId.toString());
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
      try {
        const teamData = this.teamsMap.get(teamName);
        if (!teamData) {
          console.warn(`Team not found in cache: ${teamName}`);
          continue;
        }

        // Find captain player ID
        const captainPlayer = Array.from(this.playersMap.values()).find(player =>
          player.data.name === captainName
        );

        if (captainPlayer) {
          const teamRef = this.db.collection(V2_COLLECTIONS.TEAMS).doc(teamData.id);  // Use the actual document ID
          currentBatch.update(teamRef, {
            captainId: captainPlayer.data.numericId.toString(),
            captain: {
              playerId: captainPlayer.data.numericId.toString(),
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
        } else {
          console.warn(`Captain player not found: ${captainName} for team ${teamName}`);
        }

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

  createMatchData(match) {
    const matchNumericId = parseInt(match.match_id) || Date.now();
    const team1Data = this.teamsMap.get(match.teams?.team1);
    const team2Data = this.teamsMap.get(match.teams?.team2);

    if (!team1Data || !team2Data) {
      throw new Error(`Teams not found for match ${match.match_id}`);
    }

    // Extract scores from innings
    const scores = this.extractScoresFromInnings(match.innings || []);

    // Extract captain names from player data
    const captains = this.extractCaptainNames(match);

    // Extract players grouped by team
    const teamPlayers = this.extractPlayersByTeam(match, team1Data, team2Data);

    // Create nested team structure with players and scores
    const team1 = {
      id: team1Data.numericId,
      name: team1Data.data.name,
      shortName: team1Data.data.shortName,
      squad: {
        teamId: team1Data.numericId,
        name: team1Data.data.name,
        shortName: team1Data.data.shortName,
        captainName: captains.team1.name,
        captainId: captains.team1.id
      },
      squadId: `${matchNumericId}_${team1Data.numericId}`,
      score: scores.team1,
      players: teamPlayers.team1
    };

    const team2 = {
      id: team2Data.numericId,
      name: team2Data.data.name,
      shortName: team2Data.data.shortName,
      squad: {
        teamId: team2Data.numericId,
        name: team2Data.data.name,
        shortName: team2Data.data.shortName,
        captainName: captains.team2.name,
        captainId: captains.team2.id
      },
      squadId: `${matchNumericId}_${team2Data.numericId}`,
      score: scores.team2,
      players: teamPlayers.team2
    };

    // Determine winner
    const result = this.determineMatchResult(match, team1Data, team2Data);

    return {
      numericId: matchNumericId,
      displayId: parseInt(match.match_id.slice(-6)) || Math.floor(Math.random() * 999999) + 1,
      title: `${match.teams?.team1 || 'Team 1'} vs ${match.teams?.team2 || 'Team 2'}`,
      tournamentId: '1000000001',
      tournament: {
        tournamentId: '1000000001',
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
        winnerSquadId: match.toss.winner === match.teams?.team1 ? team1Data.numericId : team2Data.numericId,
        winnerTeamId: match.toss.winner === match.teams?.team1 ? team1Data.numericId : team2Data.numericId,
        winnerTeamName: match.toss.winner,
        decision: match.toss.decision
      } : null,

      result: result,

      playerOfMatchId: null, // Will be determined from player performance
      playerOfMatch: null,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  }

  extractScoresFromInnings(innings) {
    const scores = {
      team1: { runs: 0, wickets: 0, overs: 0, declared: false },
      team2: { runs: 0, wickets: 0, overs: 0, declared: false }
    };

    for (const inning of innings) {
      const teamKey = inning.team === innings[0]?.team ? 'team1' : 'team2';

      if (inning.score) {
        const scoreParts = inning.score.split('/');
        scores[teamKey].runs = parseInt(scoreParts[0]) || 0;
        scores[teamKey].wickets = parseInt(scoreParts[1]) || 0;
        scores[teamKey].overs = inning.overs || 0;
      }
    }

    return scores;
  }

  extractCaptainNames(match) {
    const captains = {
      team1: { name: 'TBD', id: null },
      team2: { name: 'TBD', id: null }
    };

    // Find captain from innings player data
    for (const inning of match.innings || []) {
      const battingTeamKey = inning.team === match.teams?.team1 ? 'team1' : 'team2';

      // Check batsmen for captain
      for (const batsman of inning.batting || []) {
        if (batsman.is_captain) {  // Fixed: was isCaptain, should be is_captain
          captains[battingTeamKey].name = batsman.name;
          const playerData = this.playersMap.get(batsman.name);
          if (playerData) {
            captains[battingTeamKey].id = playerData.id;
          }
          break;
        }
      }

      // Check bowlers for captain (if not found in batsmen)
      if (captains[battingTeamKey].name === 'TBD') {
        for (const bowler of inning.bowling || []) {
          if (bowler.is_captain) {  // Fixed: was isCaptain, should be is_captain
            captains[battingTeamKey].name = bowler.name;
            const playerData = this.playersMap.get(bowler.name);
            if (playerData) {
              captains[battingTeamKey].id = playerData.id;
            }
            break;
          }
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
          const playerData = this.playersMap.get(batsman.name);
          if (playerData) {
            teamPlayers[battingTeamKey].push({
              playerId: playerData.id,
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
          }
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
          const playerData = this.playersMap.get(bowler.name);
          if (playerData) {
            teamPlayers[bowlingTeamKey].push({
              playerId: playerData.id,
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

    const winnerTeamId = match.result.winner === match.teams?.team1 ? team1Data.numericId :
                        match.result.winner === match.teams?.team2 ? team2Data.numericId : null;

    return {
      winnerSquadId: winnerTeamId,
      winnerTeamId: winnerTeamId,
      winnerTeamName: match.result.winner,
      margin: match.result.margin,
      resultType: 'normal'
    };
  }

  async createMatchSquads(jsonData) {
    console.log(`Creating match squads for ${jsonData.length} matches...`);

    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;
    let squadCount = 0;

    for (const match of jsonData) {
      this.stats.matchSquads.processed++;

      try {
        const matchNumericId = parseInt(match.match_id) || Date.now();
        const team1Data = this.teamsMap.get(match.teams?.team1);
        const team2Data = this.teamsMap.get(match.teams?.team2);

        if (!team1Data || !team2Data) {
          console.warn(`Teams not found for match ${match.match_id}, skipping squad creation`);
          continue;
        }

        // Extract captain information
        const captains = this.extractCaptainNames(match);

        // Create squad for team 1
        const team1Squad = await this.createMatchSquadDocument(
          match,
          matchNumericId,
          team1Data,
          team2Data,
          captains.team1,
          squadCount + 1
        );

        const team1SquadRef = this.db.collection(V2_COLLECTIONS.MATCH_SQUADS).doc(team1Squad.matchSquadId);
        currentBatch.set(team1SquadRef, team1Squad);
        batchCount++;
        squadCount++;

        // Create squad for team 2
        const team2Squad = await this.createMatchSquadDocument(
          match,
          matchNumericId,
          team2Data,
          team1Data,
          captains.team2,
          squadCount + 1
        );

        const team2SquadRef = this.db.collection(V2_COLLECTIONS.MATCH_SQUADS).doc(team2Squad.matchSquadId);
        currentBatch.set(team2SquadRef, team2Squad);
        batchCount++;
        squadCount++;

        // Store squad IDs in the map for potential future use
        this.matchSquadsMap.set(`${matchNumericId}_${team1Data.numericId}`, team1Squad.matchSquadId);
        this.matchSquadsMap.set(`${matchNumericId}_${team2Data.numericId}`, team2Squad.matchSquadId);

        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.matchSquads.migrated += 2; // Two squads per match

      } catch (error) {
        console.error(`❌ Failed to create squads for match ${match.match_id}:`, error.message);
        this.stats.matchSquads.errors++;
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Match squads creation completed: ${this.stats.matchSquads.migrated}/${this.stats.matchSquads.processed * 2} squads created`);
  }

  async createMatchSquadDocument(match, matchNumericId, teamData, opponentTeamData, captainInfo, displayId) {
    // Get all players for this team from the innings data
    const squadPlayers = this.extractSquadPlayers(match, teamData);

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
    const matchSquadId = `${teamData.numericId}_${match.match_id}`;

    return {
      matchSquadId: matchSquadId,
      displayId: displayId,
      match: {
        matchId: match.match_id,
        title: `${match.teams?.team1 || 'Team 1'} vs ${match.teams?.team2 || 'Team 2'}`,
        date: new Date(match.date),
        venue: match.ground || 'MM Sports Park- Box Cricket',
        tournamentName: match.tournament || 'EPL WEEKEND MAHAMUKABALA',
        status: 'completed'
      },
      team: {
        teamId: teamData.numericId.toString(),
        name: teamData.data.name,
        shortName: teamData.data.shortName
      },
      players: squadPlayers.map(player => ({
        playerId: player.playerId,
        name: player.name,
        role: player.role,
        battingStyle: player.battingStyle || 'RHB',
        bowlingStyle: player.bowlingStyle || null,
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
        teamId: opponentTeamData.numericId.toString(),
        name: opponentTeamData.data.name,
        shortName: opponentTeamData.data.shortName
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  }

  extractSquadPlayers(match, teamData) {
    const squadPlayers = new Map(); // Use Map to avoid duplicates

    // Extract players from innings data
    for (const inning of match.innings || []) {
      const isBattingTeam = inning.team === teamData.data.name;

      // Add batsmen
      for (const batsman of inning.batting || []) {
        const playerData = this.playersMap.get(batsman.name);
        if (playerData && !squadPlayers.has(batsman.name)) {
          squadPlayers.set(batsman.name, {
            playerId: playerData.id,
            name: batsman.name,
            role: batsman.is_wicket_keeper ? 'wicket-keeper' : 'batsman',
            battingStyle: 'RHB', // Default, could be enhanced
            bowlingStyle: null
          });
        }
      }

      // Add bowlers
      for (const bowler of inning.bowling || []) {
        const playerData = this.playersMap.get(bowler.name);
        if (playerData && !squadPlayers.has(bowler.name)) {
          squadPlayers.set(bowler.name, {
            playerId: playerData.id,
            name: bowler.name,
            role: 'bowler',
            battingStyle: 'RHB',
            bowlingStyle: 'RF' // Default, could be enhanced
          });
        }
      }
    }

    // Convert to array and enhance roles based on performance
    const playersArray = Array.from(squadPlayers.values());

    // If we have very few players, try to get more from the team data
    if (playersArray.length < 8) {
      // This is a fallback - in a real implementation, you'd have complete squad data
      console.warn(`Limited player data for team ${teamData.data.name}, only ${playersArray.length} players found`);
    }

    return playersArray;
  }

  printMigrationSummary() {
    console.log('\n🎉 V2 Migration from JSON Summary:');
    console.log('=====================================');
    console.log(`Teams: ${this.stats.teams.migrated}/${this.stats.teams.processed} migrated (${this.stats.teams.errors} errors)`);
    console.log(`Players: ${this.stats.players.migrated}/${this.stats.players.processed} migrated (${this.stats.players.errors} errors)`);
    console.log(`Matches: ${this.stats.matches.migrated}/${this.stats.matches.processed} migrated (${this.stats.matches.errors} errors)`);
    console.log(`Match Squads: ${this.stats.matchSquads.migrated}/${this.stats.matchSquads.processed} migrated (${this.stats.matchSquads.errors} errors)`);

    const totalMigrated = this.stats.teams.migrated + this.stats.players.migrated + this.stats.matches.migrated + this.stats.matchSquads.migrated;
    const totalProcessed = this.stats.teams.processed + this.stats.players.processed + this.stats.matches.processed + this.stats.matchSquads.processed;
    const totalErrors = this.stats.teams.errors + this.stats.players.errors + this.stats.matches.errors + this.stats.matchSquads.errors;

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