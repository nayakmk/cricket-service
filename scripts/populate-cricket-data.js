const fs = require('fs');
const path = require('path');
const { collections, db, admin } = require('../config/database');
const { sequenceManager } = require('../utils/sequenceManager');

class CricketDataPopulator {
  constructor() {
    this.matchesData = [];
    this.teamsMap = new Map(); // name -> firestore id
    this.playersMap = new Map(); // name -> firestore id
    this.processedMatches = [];
  }

  loadMatchesData() {
    const filePath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_new.json');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Matches data file not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    this.matchesData = Array.isArray(data) ? data : [data];
    console.log(`Loaded ${this.matchesData.length} matches from JSON file`);
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
          bestBowling: '0/0',
          battingAverage: 0,
          bowlingAverage: 0
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
    // Parse "86/8" or "88/6" format
    const match = scoreStr.match(/^(\d+)\/(\d+)$/);
    if (match) {
      return {
        runs: parseInt(match[1]),
        wickets: parseInt(match[2])
      };
    }
    return { runs: 0, wickets: 0 };
  }

  parseOvers(oversStr) {
    // Handle both string and number formats
    let oversValue = oversStr;
    if (typeof oversStr === 'number') {
      oversValue = oversStr.toString();
    }
    
    // Parse "13.2" or "12.1" format
    const match = oversValue.match(/^(\d+)\.?(\d+)?$/);
    if (match) {
      const overs = parseInt(match[1]);
      const balls = match[2] ? parseInt(match[2]) : 0;
      return { overs, balls };
    }
    return { overs: 0, balls: 0 };
  }

  async createInning(matchId, inningData, inningNumber) {
    try {
      console.log(`Creating inning ${inningNumber} for match ${matchId}`);
      console.log('Inning data:', JSON.stringify(inningData, null, 2));

      if (!matchId) {
        throw new Error(`Invalid matchId: ${matchId}`);
      }

      const { score, overs } = inningData;
      const scoreData = this.parseScore(score);
      const oversData = this.parseOvers(overs);

      if (!inningData.team || inningData.team.trim() === '') {
        throw new Error(`Invalid batting team name: ${inningData.team}`);
      }

      const battingTeamId = await this.upsertTeam(inningData.team);
      if (!battingTeamId) {
        throw new Error(`Failed to upsert batting team: ${inningData.team}`);
      }

      const opposingTeam = inningData.team === this.currentMatchTeams.team1 ? this.currentMatchTeams.team2 : this.currentMatchTeams.team1;
      if (!opposingTeam || opposingTeam.trim() === '') {
        throw new Error(`Invalid bowling team name: ${opposingTeam}`);
      }

      const bowlingTeamId = await this.upsertTeam(opposingTeam);
      if (!bowlingTeamId) {
        throw new Error(`Failed to upsert bowling team: ${opposingTeam}`);
      }

      console.log(`Batting team: ${inningData.team} (ID: ${battingTeamId})`);
      console.log(`Bowling team: ${inningData.team === this.currentMatchTeams.team1 ? this.currentMatchTeams.team2 : this.currentMatchTeams.team1} (ID: ${bowlingTeamId})`);

      // Generate numeric ID for the inning
      const numericId = await sequenceManager.getNextId('innings');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('innings');

      console.log(`Generated inning documentId: ${documentId}`);

      const inningDoc = {
        numericId: numericId,
        match: matchId,
        battingTeam: battingTeamId,
        bowlingTeam: bowlingTeamId,
        inningNumber,
        totalRuns: scoreData.runs,
        totalWickets: scoreData.wickets,
        totalOvers: oversData.overs,
        totalBalls: oversData.balls + (oversData.overs * 6),
        isCompleted: true,
        runRate: oversData.overs > 0 ? (scoreData.runs / oversData.overs) : 0
      };

      console.log(`Storing inning at path: matches/${matchId}/innings/${documentId}`);

      // Store inning as subcollection of the match
      await collections.matches.doc(matchId).collection('innings').doc(documentId).set(inningDoc);

  // Add batsmen data as subcollection of the inning
      if (inningData.batsmen) {
        for (const batsman of inningData.batsmen) {
          if (!batsman.name || batsman.name.trim() === '') {
            console.log(`Skipping batsman with invalid name: ${batsman.name}`);
            continue;
          }

          const playerDocId = await this.upsertPlayer(batsman.name);
          if (!playerDocId) {
            console.log(`Failed to upsert batsman ${batsman.name}, skipping`);
            continue;
          }

          // Get the numeric ID from the player document
          const playerDoc = await collections.players.doc(playerDocId).get();
          const playerNumericId = playerDoc.data().numericId;

          const batsmanDoc = {
            playerId: playerNumericId, // Store numeric ID instead of document ID
            runs: batsman.runs || 0,
            balls: batsman.balls || 0,
            fours: batsman.fours || 0,
            sixes: batsman.sixes || 0,
            strikeRate: batsman.sr || 0,
            status: batsman.status || 'not out'
          };
          await collections.matches.doc(matchId).collection('innings').doc(documentId).collection('batsmen').doc(playerNumericId.toString()).set(batsmanDoc);
        }
      }

      // Add bowling data
      if (inningData.bowling) {
        for (const bowler of inningData.bowling) {
          if (!bowler.name || bowler.name.trim() === '') {
            console.log(`Skipping bowler with invalid name: ${bowler.name}`);
            continue;
          }

          const playerDocId = await this.upsertPlayer(bowler.name);
          if (!playerDocId) {
            console.log(`Failed to upsert bowler ${bowler.name}, skipping`);
            continue;
          }

          // Get the numeric ID from the player document
          const playerDoc = await collections.players.doc(playerDocId).get();
          const playerNumericId = playerDoc.data().numericId;

          const oversDataParsed = this.parseOvers(bowler.overs);
          const bowlingDoc = {
            playerId: playerNumericId, // Store numeric ID instead of document ID
            overs: oversDataParsed.overs,
            balls: oversDataParsed.balls,
            maidens: bowler.maidens || 0,
            runs: bowler.runs || 0,
            wickets: bowler.wickets || 0,
            economy: bowler.eco || 0,
            dots: bowler.dots || 0,
            fours: bowler.fours || 0,
            sixes: bowler.sixes || 0,
            wides: bowler.wides || 0,
            noballs: bowler.noballs || 0
          };
          await collections.matches.doc(matchId).collection('innings').doc(documentId).collection('bowling').doc(playerNumericId.toString()).set(bowlingDoc);
        }
      }

      // Add fall of wickets
      if (inningData.fall_of_wickets) {
        for (const fow of inningData.fall_of_wickets) {
          if (!fow.player || fow.player.trim() === '') {
            console.log(`Skipping fall of wicket with invalid player name: ${fow.player}`);
            continue;
          }

          const playerDocId = await this.upsertPlayer(fow.player);
          if (!playerDocId) {
            console.log(`Failed to upsert player ${fow.player}, skipping fall of wicket`);
            continue;
          }

          // Get the numeric ID from the player document
          const playerDoc = await collections.players.doc(playerDocId).get();
          const playerNumericId = playerDoc.data().numericId;

          const fowDoc = {
            score: fow.score,
            wicketNumber: fow.wicket,
            playerOutId: playerNumericId, // Store numeric ID instead of document ID
            over: fow.over
          };
          await collections.matches.doc(matchId).collection('innings').doc(documentId).collection('fallOfWickets').doc(fow.wicket.toString()).set(fowDoc);
        }
      }

      console.log(`Created inning ${inningNumber} for match ${matchId} (numericId: ${numericId}, documentId: ${documentId})`);
      return documentId;
    } catch (error) {
      console.error(`Error creating inning ${inningNumber}:`, error);
      return null;
    }
  }

  async createMatch(matchData) {
    try {
      console.log(`Processing match: ${matchData.match_id}`);

      // Upsert teams
      const team1Id = await this.upsertTeam(matchData.teams.team1);
      const team2Id = await this.upsertTeam(matchData.teams.team2);

      this.currentMatchTeams = { team1: matchData.teams.team1, team2: matchData.teams.team2 };

      // Determine winner and result
      let winnerId = null;
      let result = 'no-result';

      if (matchData.result && matchData.result.winner) {
        if (matchData.result.winner === matchData.teams.team1) {
          winnerId = team1Id;
        } else if (matchData.result.winner === matchData.teams.team2) {
          winnerId = team2Id;
        }

        if (matchData.result.margin) {
          result = matchData.result.margin;
        }
      }

      // Generate numeric ID for the match
      const numericId = await sequenceManager.getNextId('matches');

      // Generate formatted document ID
      const documentId = await sequenceManager.generateDocumentId('matches');

      // Create match document
      const matchDoc = {
        numericId: numericId,
        title: `${matchData.teams.team1} vs ${matchData.teams.team2}`,
        venue: matchData.ground || 'Unknown Ground',
        date: new Date(matchData.date),
        format: 'Box Cricket',
        team1Id: team1Id,
        team2Id: team2Id,
        tossWinner: matchData.toss?.winner === matchData.teams.team1 ? team1Id : team2Id,
        tossDecision: matchData.toss?.decision || 'bat',
        status: 'completed',
        winner: winnerId,
        result: result,
        notes: matchData.tournament || '',
        startTime: new Date(matchData.date),
        endTime: new Date(matchData.date),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await collections.matches.doc(documentId).set(matchDoc);
      console.log(`Created match: ${matchData.match_id} (numericId: ${numericId}, documentId: ${documentId})`);

      // Create innings subcollections
      const inningsIds = [];
      if (matchData.innings) {
        for (let i = 0; i < matchData.innings.length; i++) {
          const inningId = await this.createInning(documentId, matchData.innings[i], i + 1);
          if (inningId) {
            inningsIds.push(inningId);
          }
        }
      }

      // Update match with innings references
      await collections.matches.doc(documentId).update({
        innings: inningsIds,
        currentInning: matchData.innings ? matchData.innings.length : 1
      });

      return {
        matchId: documentId,
        team1Id,
        team2Id,
        inningsCount: inningsIds.length
      };

    } catch (error) {
      console.error(`Error creating match ${matchData.match_id}:`, error);
      return null;
    }
  }

  async populateAllData() {
    try {
      console.log('Starting data population...');

      for (const matchData of this.matchesData) {
        const result = await this.createMatch(matchData);
        if (result) {
          this.processedMatches.push(result);
        }

        // Small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Successfully processed ${this.processedMatches.length} matches`);
      return this.processedMatches;

    } catch (error) {
      console.error('Error during data population:', error);
      throw error;
    }
  }

  async run() {
    try {
      this.loadMatchesData();
      const results = await this.populateAllData();

      console.log('\n=== POPULATION SUMMARY ===');
      console.log(`Total matches processed: ${results.length}`);
      console.log(`Teams created/updated: ${this.teamsMap.size}`);
      console.log(`Players created/updated: ${this.playersMap.size}`);

      // Save summary to file
      const summary = {
        processedMatches: results,
        teamsMap: Object.fromEntries(this.teamsMap),
        playersMap: Object.fromEntries(this.playersMap),
        timestamp: new Date().toISOString()
      };

      const summaryPath = path.join(process.cwd(), 'population-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
      console.log(`Population summary saved to: ${summaryPath}`);

      return results;

    } catch (error) {
      console.error('Fatal error during population:', error);
      throw error;
    }
  }
}

// Export for use in other scripts
module.exports = CricketDataPopulator;

// If run directly, populate data
if (require.main === module) {
  (async () => {
    const populator = new CricketDataPopulator();

    try {
      await populator.run();
      console.log('Data population completed successfully!');
    } catch (error) {
      console.error('Data population failed:', error);
      process.exit(1);
    }
  })();
}