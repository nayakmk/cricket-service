const fs = require('fs');
const path = require('path');
const { collections, db, admin } = require('../config/database');
const { sequenceManager } = require('../utils/sequenceManager');

class UnifiedCricketDataImporter {
  constructor() {
    this.matchesData = [];
    this.teamsMap = new Map(); // name -> firestore id
    this.playersMap = new Map(); // name -> firestore id
    this.tournamentsMap = new Map(); // name -> firestore id
    this.processedMatches = [];
  }

  loadMatchesData(fileName = 'cricket_matches_summary_with_tournaments.json') {
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

  async getTeamDetails(teamId) {
    if (!teamId) return null;

    try {
      const teamDoc = await collections.teams.doc(teamId).get();
      if (teamDoc.exists) {
        const teamData = teamDoc.data();
        return {
          id: teamDoc.id,
          name: teamData.name,
          shortName: teamData.shortName,
          numericId: teamData.numericId
        };
      }
    } catch (error) {
      console.error(`Error fetching team details for ${teamId}:`, error);
    }
    return null;
  }

  async upsertTournament(tournamentName) {
    if (!tournamentName || this.tournamentsMap.has(tournamentName)) {
      return this.tournamentsMap.get(tournamentName);
    }

    try {
      // Check if tournament already exists
      const existingQuery = await collections.tournaments.where('name', '==', tournamentName).limit(1).get();
      if (!existingQuery.empty) {
        const tournamentId = existingQuery.docs[0].id;
        this.tournamentsMap.set(tournamentName, tournamentId);
        return tournamentId;
      }

      // Generate numeric ID for the tournament
      const numericId = await sequenceManager.getNextId('tournaments');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('tournaments');

      // Create new tournament
      const tournamentData = {
        numericId: numericId,
        name: tournamentName,
        shortName: tournamentName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 5),
        description: `${tournamentName} cricket tournament`,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await collections.tournaments.doc(documentId).set(tournamentData);
      this.tournamentsMap.set(tournamentName, documentId);
      console.log(`Created tournament: ${tournamentName} (numericId: ${numericId}, documentId: ${documentId})`);
      return documentId;
    } catch (error) {
      console.error(`Error upserting tournament ${tournamentName}:`, error);
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

  parseScore(scoreStr) {
    // Parse "87/4" format, trim whitespace
    if (!scoreStr || typeof scoreStr !== 'string') {
      return { runs: 0, wickets: 0 };
    }
    const trimmed = scoreStr.trim();
    const match = trimmed.match(/^(\d+)\/(\d+)$/);
    if (match) {
      return {
        runs: parseInt(match[1]),
        wickets: parseInt(match[2])
      };
    }
    return { runs: 0, wickets: 0 };
  }

  parseOvers(oversStr) {
    // Parse "12.0" or "12.1" format (can be number or string)
    const str = typeof oversStr === 'number' ? oversStr.toString() : oversStr;
    const match = str.match(/^(\d+)\.?(\d+)?$/);
    if (match) {
      const overs = parseInt(match[1]);
      const balls = match[2] ? parseInt(match[2]) : 0;
      return { overs, balls };
    }
    return { overs: 0, balls: 0 };
  }

  extractTeamNameFromInningTeam(inningTeam) {
    // Extract team name from format like "Tournament Name\nTeam Name"
    const teamName = inningTeam.split('\n').pop().trim();
    return teamName && teamName !== inningTeam ? teamName : inningTeam;
  }

  async createInning(matchId, inningData, inningNumber, matchTeams) {
    try {
      const { score, overs } = inningData;
      const scoreData = this.parseScore(score);
      const oversData = this.parseOvers(overs);

      // Extract actual team name from the innings team string
      const battingTeamName = this.extractTeamNameFromInningTeam(inningData.team);
      const battingTeamId = await this.upsertTeam(battingTeamName);
      const bowlingTeamId = await this.upsertTeam(
        battingTeamName === matchTeams.team1 ? matchTeams.team2 : matchTeams.team1
      );

      // Generate inning document ID
      const inningDocumentId = await sequenceManager.generateDocumentId('innings');
      const inningNumericId = await sequenceManager.getNextId('innings');

      const inning = {
        numericId: inningNumericId,
        matchId: matchId,
        battingTeam: battingTeamId,
        bowlingTeam: bowlingTeamId,
        inningNumber: inningNumber,
        totalRuns: scoreData.runs,
        totalWickets: scoreData.wickets,
        totalOvers: oversData.overs,
        totalBalls: oversData.balls,
        extras: inningData.extras || { wd: 0, nb: 0, total: 0 },
        batsmen: [],
        bowlers: [],
        fallOfWickets: []
      };

      // Process batsmen data
      if (inningData.batting) {
        for (const batsmanData of inningData.batting) {
          const playerId = await this.upsertPlayer(batsmanData.name);
          if (playerId) {
            inning.batsmen.push({
              playerId: playerId,
              playerName: batsmanData.name,
              runs: batsmanData.runs || 0,
              balls: batsmanData.balls || 0,
              fours: batsmanData.fours || 0,
              sixes: batsmanData.sixes || 0,
              strikeRate: batsmanData.sr || 0,
              status: batsmanData.how_out || 'not out',
              statusParsed: batsmanData.how_out || null
            });
          }
        }
      }

      // Process bowlers data
      if (inningData.bowling) {
        const bowlersData = inningData.bowling;
        for (const bowlerData of bowlersData) {
          const playerId = await this.upsertPlayer(bowlerData.name);
          if (playerId) {
            inning.bowlers.push({
              playerId: playerId,
              playerName: bowlerData.name,
              overs: bowlerData.overs || 0,
              maidens: bowlerData.maidens || 0,
              runs: bowlerData.runs || 0,
              wickets: bowlerData.wickets || 0,
              economy: bowlerData.eco || bowlerData.economy || 0,
              dots: bowlerData.dots || 0,
              fours: bowlerData.fours || 0,
              sixes: bowlerData.sixes || 0,
              wides: bowlerData.wides || 0,
              noballs: bowlerData.noballs || 0
            });
          }
        }
      }

      // Process fall of wickets
      if (inningData.fall_of_wickets && inningData.fall_of_wickets.length > 0) {
        for (const fow of inningData.fall_of_wickets) {
          const playerId = await this.upsertPlayer(fow.player);
          // Get the numeric ID from the player document
          const playerDoc = await collections.players.doc(playerId).get();
          const playerNumericId = playerDoc.data().numericId;

          inning.fallOfWickets.push({
            score: fow.score,
            wicketNumber: fow.wicket,
            playerOutId: playerNumericId,
            batsmanName: fow.player, // Store the original player name as fallback
            over: fow.over
          });
        }
      }

      // Save inning as subcollection (without sub-subcollections)
      await collections.matches.doc(matchId).collection('innings').doc(inningDocumentId).set(inning);
      console.log(`Created inning ${inningNumber} for team ${inningData.team} as subcollection`);
      return inningDocumentId;
    } catch (error) {
      console.error(`Error creating inning for ${inningData.team}:`, error);
      return null;
    }
  }

  extractTeamNamesFromInnings(matchData) {
    const teamNames = new Set();
    
    if (matchData.innings && Array.isArray(matchData.innings)) {
      for (const inning of matchData.innings) {
        if (inning.team) {
          // Extract team name from format like "Tournament Name\nTeam Name"
          const teamName = inning.team.split('\n').pop().trim();
          if (teamName && teamName !== inning.team) { // Make sure we extracted something meaningful
            teamNames.add(teamName);
          }
        }
      }
    }
    
    // Convert Set to Array and ensure we have exactly 2 teams
    const teamsArray = Array.from(teamNames);
    if (teamsArray.length >= 2) {
      return {
        team1: teamsArray[0],
        team2: teamsArray[1]
      };
    }
    
    // Fallback to original team names if extraction fails
    return matchData.teams || { team1: 'Unknown Team 1', team2: 'Unknown Team 2' };
  }

  async createMatch(matchData) {
    try {
      console.log(`Processing match: ${matchData.match_id}`);

      // Extract correct team names from innings data
      const correctTeams = this.extractTeamNamesFromInnings(matchData);
      console.log(`Extracted team names: ${correctTeams.team1} vs ${correctTeams.team2}`);

      // Upsert teams with correct names
      const team1Id = await this.upsertTeam(correctTeams.team1);
      const team2Id = await this.upsertTeam(correctTeams.team2);

      // Upsert tournament
      const tournamentId = await this.upsertTournament(matchData.tournamentName || matchData.tournament);

      // Get team details for embedding
      const team1Details = await this.getTeamDetails(team1Id);
      const team2Details = await this.getTeamDetails(team2Id);

      // Determine winner and result
      let winnerId = null;
      let winnerDetails = null;
      let result = 'no-result';

      if (matchData.result && matchData.result.winner) {
        // Check if result winner name is contained in team names (handle partial matches)
        if (correctTeams.team1.toLowerCase().includes(matchData.result.winner.toLowerCase()) ||
            matchData.result.winner.toLowerCase().includes(correctTeams.team1.toLowerCase())) {
          winnerId = team1Id;
          winnerDetails = team1Details;
        } else if (correctTeams.team2.toLowerCase().includes(matchData.result.winner.toLowerCase()) ||
                   matchData.result.winner.toLowerCase().includes(correctTeams.team2.toLowerCase())) {
          winnerId = team2Id;
          winnerDetails = team2Details;
        }

        if (matchData.result.margin) {
          result = matchData.result.margin;
        }
      }

      // Determine toss winner details
      let tossWinnerDetails = null;
      if (matchData.toss?.winner) {
        // Check if toss winner name is contained in team names (handle partial matches)
        if (correctTeams.team1.toLowerCase().includes(matchData.toss.winner.toLowerCase()) ||
            matchData.toss.winner.toLowerCase().includes(correctTeams.team1.toLowerCase())) {
          tossWinnerDetails = team1Details;
        } else if (correctTeams.team2.toLowerCase().includes(matchData.toss.winner.toLowerCase()) ||
                   matchData.toss.winner.toLowerCase().includes(correctTeams.team2.toLowerCase())) {
          tossWinnerDetails = team2Details;
        }
      }

      // Generate numeric ID for the match
      const numericId = await sequenceManager.getNextId('matches');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('matches');

      // Create match document with embedded details
      const matchDoc = {
        numericId: numericId,
        matchId: matchData.match_id,
        title: `${correctTeams.team1} vs ${correctTeams.team2}`,
        venue: matchData.ground || 'Unknown Ground',
        date: new Date(matchData.date),
        format: 'Box Cricket',
        tournamentId: tournamentId,

        // Team details embedded
        teams: {
          team1: team1Details,
          team2: team2Details
        },

        // Legacy ID fields for compatibility
        team1Id: team1Id,
        team2Id: team2Id,

        // Toss details embedded
        toss: {
          winner: tossWinnerDetails,
          decision: matchData.toss?.decision || 'bat'
        },

        // Legacy toss fields for compatibility
        tossWinner: matchData.toss?.winner === correctTeams.team1 ? team1Id : team2Id,
        tossDecision: matchData.toss?.decision || 'bat',

        // Result details embedded
        result: {
          winner: winnerDetails,
          margin: result
        },

        // Legacy result fields for compatibility
        winner: winnerId,
        result: result,

        status: 'completed',
        notes: matchData.tournament || '',
        startTime: new Date(matchData.date),
        endTime: new Date(matchData.date),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save match document
      await collections.matches.doc(documentId).set(matchDoc);
      console.log(`Created match: ${matchData.match_id} (documentId: ${documentId})`);

      // Create innings as subcollections
      if (matchData.innings) {
        for (let i = 0; i < matchData.innings.length; i++) {
          await this.createInning(documentId, matchData.innings[i], i + 1, { team1: correctTeams.team1, team2: correctTeams.team2 });
        }
      }

      return documentId;
    } catch (error) {
      console.error(`Error creating match ${matchData.match_id}:`, error);
      return null;
    }
  }

  async clearExistingData() {
    console.log('Clearing existing match data...');

    try {
      // Delete all tournaments
      const tournamentsSnapshot = await collections.tournaments.get();
      const tournamentDeletePromises = tournamentsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(tournamentDeletePromises);
      console.log(`Cleared ${tournamentsSnapshot.size} tournaments`);

      // Delete all matches and their subcollections
      const matchesSnapshot = await collections.matches.get();
      const deletePromises = [];

      for (const matchDoc of matchesSnapshot.docs) {
        // Delete innings subcollection
        const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').get();
        inningsSnapshot.docs.forEach(inningDoc => {
          deletePromises.push(collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).delete());
        });

        // Delete match document
        deletePromises.push(collections.matches.doc(matchDoc.id).delete());
      }

      await Promise.all(deletePromises);
      console.log('Cleared existing match data');
    } catch (error) {
      console.error('Error clearing existing data:', error);
      throw error;
    }
  }

  async run(fileName, clearExisting = false) {
    try {
      console.log('Starting unified cricket data import...');

      if (clearExisting) {
        await this.clearExistingData();
      }

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
module.exports = UnifiedCricketDataImporter;

// If run directly, import data
if (require.main === module) {
  const fileName = process.argv[2] || 'cricket_matches_summary_new.json';
  const clearExisting = process.argv[3] === '--clear';

  (async () => {
    const importer = new UnifiedCricketDataImporter();

    try {
      await importer.run(fileName, clearExisting);
      console.log('Unified cricket data import completed successfully!');
    } catch (error) {
      console.error('Unified cricket data import failed:', error);
      process.exit(1);
    }
  })();
}