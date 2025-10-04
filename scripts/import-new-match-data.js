const fs = require('fs');
const path = require('path');
const { collections, db, admin } = require('../config/database');
const { sequenceManager } = require('../utils/sequenceManager');

class NewMatchDataImporter {
  constructor() {
    this.matchesData = [];
    this.teamsMap = new Map(); // name -> firestore id
    this.playersMap = new Map(); // name -> firestore id
    this.processedMatches = [];
  }

  loadMatchesData(fileName = 'cricket_matches_summary_new.json') {
    const filePath = path.join(__dirname, '..', 'reports', fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Matches data file not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    this.matchesData = Array.isArray(data) ? data : [data];
    console.log(`Loaded ${this.matchesData.length} matches from ${fileName}`);
    return this.matchesData;
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
        }
      };

      await collections.teams.doc(documentId).set(teamData);
      this.teamsMap.set(teamName, documentId);
      console.log(`Created team: ${teamName} (numericId: ${numericId}, documentId: ${documentId})`);
      return documentId;
    } catch (error) {
      console.error(`Error upserting team ${teamName}:`, error);
      return null;
    }
  }

  async upsertPlayer(playerName) {
    if (!playerName || this.playersMap.has(playerName)) {
      return this.playersMap.get(playerName);
    }

    try {
      // Check if player already exists
      const existingQuery = await collections.players.where('name', '==', playerName).limit(1).get();
      if (!existingQuery.empty) {
        const playerId = existingQuery.docs[0].id;
        this.playersMap.set(playerName, playerId);
        return playerId;
      }

      // Generate numeric ID for the player
      const numericId = await sequenceManager.getNextId('players');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('players');

      // Create new player
      const playerData = {
        numericId: numericId,
        name: playerName,
        email: `${playerName.toLowerCase().replace(/\s+/g, '.')}@cricketclub.com`,
        isActive: true,
        stats: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          highestScore: 0,
          battingAverage: 0,
          bowlingAverage: 0,
          strikeRate: 0,
          economyRate: 0
        }
      };

      await collections.players.doc(documentId).set(playerData);
      this.playersMap.set(playerName, documentId);
      console.log(`Created player: ${playerName} (numericId: ${numericId}, documentId: ${documentId})`);
      return documentId;
    } catch (error) {
      console.error(`Error upserting player ${playerName}:`, error);
      return null;
    }
  }

  async createMatch(matchData) {
    try {
      // Get or create teams
      const team1Id = await this.upsertTeam(matchData.teams.team1);
      const team2Id = await this.upsertTeam(matchData.teams.team2);

      if (!team1Id || !team2Id) {
        console.error('Failed to create/get teams for match:', matchData.match_id);
        return null;
      }

      // Generate match document ID
      const matchDocumentId = await sequenceManager.generateDocumentId('matches');
      const matchNumericId = await sequenceManager.getNextId('matches');

      // Create match data
      const match = {
        numericId: matchNumericId,
        matchId: matchData.match_id,
        tournament: matchData.tournament,
        date: matchData.date,
        ground: matchData.ground,
        teams: {
          team1: { id: team1Id, name: matchData.teams.team1 },
          team2: { id: team2Id, name: matchData.teams.team2 }
        },
        toss: matchData.toss,
        result: matchData.result,
        status: 'completed',
        innings: []
      };

      // Process innings
      for (let i = 0; i < matchData.innings.length; i++) {
        const inningData = matchData.innings[i];
        const inning = await this.createInning(inningData, i + 1, matchDocumentId);
        if (inning) {
          match.innings.push(inning);
        }
      }

      // Save match
      await collections.matches.doc(matchDocumentId).set(match);
      console.log(`Created match: ${matchData.match_id} (documentId: ${matchDocumentId})`);

      return matchDocumentId;
    } catch (error) {
      console.error(`Error creating match ${matchData.match_id}:`, error);
      return null;
    }
  }

  async createInning(inningData, inningNumber, matchId) {
    try {
      // Get team ID
      const teamId = await this.upsertTeam(inningData.team);
      if (!teamId) {
        console.error('Failed to get team for inning:', inningData.team);
        return null;
      }

      // Generate inning document ID
      const inningDocumentId = await sequenceManager.generateDocumentId('innings');
      const inningNumericId = await sequenceManager.getNextId('innings');

      // Create inning data
      const inning = {
        numericId: inningNumericId,
        matchId: matchId,
        teamId: teamId,
        teamName: inningData.team,
        inningNumber: inningNumber,
        score: inningData.score,
        overs: inningData.overs,
        batsmen: [],
        bowlers: [],
        fallOfWickets: inningData.fall_of_wickets || []
      };

      // Process batsmen
      for (const batsmanData of inningData.batsmen || []) {
        const batsman = await this.createBatsmanEntry(batsmanData, inningDocumentId);
        if (batsman) {
          inning.batsmen.push(batsman);
        }
      }

      // Process bowlers
      for (const bowlerData of inningData.bowling || []) {
        const bowler = await this.createBowlerEntry(bowlerData, inningDocumentId);
        if (bowler) {
          inning.bowlers.push(bowler);
        }
      }

      // Save inning
      await collections.innings.doc(inningDocumentId).set(inning);
      console.log(`Created inning ${inningNumber} for team ${inningData.team}`);

      return {
        id: inningDocumentId,
        team: inningData.team,
        score: inningData.score,
        overs: inningData.overs
      };
    } catch (error) {
      console.error(`Error creating inning for ${inningData.team}:`, error);
      return null;
    }
  }

  async createBatsmanEntry(batsmanData, inningId) {
    try {
      // Get or create player
      const playerId = await this.upsertPlayer(batsmanData.name);
      if (!playerId) {
        console.error('Failed to get player for batsman:', batsmanData.name);
        return null;
      }

      return {
        playerId: playerId,
        playerName: batsmanData.name,
        runs: batsmanData.runs || 0,
        balls: batsmanData.balls || 0,
        fours: batsmanData.fours || 0,
        sixes: batsmanData.sixes || 0,
        strikeRate: batsmanData.sr || 0,
        status: batsmanData.status || 'not out'
      };
    } catch (error) {
      console.error(`Error creating batsman entry for ${batsmanData.name}:`, error);
      return null;
    }
  }

  async createBowlerEntry(bowlerData, inningId) {
    try {
      // Get or create player
      const playerId = await this.upsertPlayer(bowlerData.name);
      if (!playerId) {
        console.error('Failed to get player for bowler:', bowlerData.name);
        return null;
      }

      return {
        playerId: playerId,
        playerName: bowlerData.name,
        overs: bowlerData.overs || 0,
        maidens: bowlerData.maidens || 0,
        runs: bowlerData.runs || 0,
        wickets: bowlerData.wickets || 0,
        economy: bowlerData.economy || 0
      };
    } catch (error) {
      console.error(`Error creating bowler entry for ${bowlerData.name}:`, error);
      return null;
    }
  }

  async run(fileName) {
    try {
      console.log('Starting new match data import...');

      // Load data
      this.loadMatchesData(fileName);

      // Process each match
      for (const matchData of this.matchesData) {
        console.log(`Processing match: ${matchData.match_id}`);
        const matchId = await this.createMatch(matchData);
        if (matchId) {
          this.processedMatches.push(matchId);
        }
      }

      console.log(`Successfully imported ${this.processedMatches.length} matches`);

    } catch (error) {
      console.error('Fatal error during import:', error);
      throw error;
    }
  }
}

// Export for use in other scripts
module.exports = NewMatchDataImporter;

// If run directly, import data
if (require.main === module) {
  const fileName = process.argv[2] || 'cricket_matches_summary_new.json';

  (async () => {
    const importer = new NewMatchDataImporter();

    try {
      await importer.run(fileName);
      console.log('New match data import completed successfully!');
    } catch (error) {
      console.error('New match data import failed:', error);
      process.exit(1);
    }
  })();
}