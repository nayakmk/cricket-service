const fs = require('fs');
const path = require('path');
const { collections, db, admin } = require('../config/database');

class CricketDataPopulator {
  constructor() {
    this.matchesData = [];
    this.teamsMap = new Map(); // name -> firestore id
    this.playersMap = new Map(); // name -> firestore id
    this.processedMatches = [];
  }

  loadMatchesData() {
    const filePath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_full.json');
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

      // Create new team
      const teamData = {
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

      const docRef = await collections.teams.add(teamData);
      this.teamsMap.set(teamName, docRef.id);
      console.log(`Created team: ${teamName} (${docRef.id})`);
      return docRef.id;
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

      // Create new player
      const playerData = {
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

      const docRef = await collections.players.add(playerData);
      this.playersMap.set(playerName, docRef.id);
      console.log(`Created player: ${playerName} (${docRef.id})`);
      return docRef.id;
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
    // Parse "13.2" or "12.1" format
    const match = oversStr.match(/^(\d+)\.?(\d+)?$/);
    if (match) {
      const overs = parseInt(match[1]);
      const balls = match[2] ? parseInt(match[2]) : 0;
      return { overs, balls };
    }
    return { overs: 0, balls: 0 };
  }

  async createInning(matchRef, inningData, inningNumber) {
    try {
      const { score, overs } = inningData;
      const scoreData = this.parseScore(score);
      const oversData = this.parseOvers(overs);

      const battingTeamId = await this.upsertTeam(inningData.team);
      const bowlingTeamId = await this.upsertTeam(
        inningData.team === this.currentMatchTeams.team1 ? this.currentMatchTeams.team2 : this.currentMatchTeams.team1
      );

      const inningDoc = {
        match: matchRef.id,
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

      const inningRef = await matchRef.collection('innings').add(inningDoc);

      // Add batsmen data
      if (inningData.batsmen) {
        for (const batsman of inningData.batsmen) {
          const playerId = await this.upsertPlayer(batsman.name);
          await inningRef.collection('batsmen').add({
            player: playerId,
            runs: batsman.runs || 0,
            balls: batsman.balls || 0,
            fours: batsman.fours || 0,
            sixes: batsman.sixes || 0,
            strikeRate: batsman.sr || 0,
            status: batsman.status || 'not out'
          });
        }
      }

      // Add bowling data
      if (inningData.bowling) {
        for (const bowler of inningData.bowling) {
          const playerId = await this.upsertPlayer(bowler.name);
          const oversData = this.parseOvers(bowler.overs);
          await inningRef.collection('bowling').add({
            player: playerId,
            overs: oversData.overs,
            balls: oversData.balls,
            maidens: bowler.maidens || 0,
            runs: bowler.runs || 0,
            wickets: bowler.wickets || 0,
            economy: bowler.eco || 0,
            dots: bowler.dots || 0,
            fours: bowler.fours || 0,
            sixes: bowler.sixes || 0,
            wides: bowler.wides || 0,
            noballs: bowler.noballs || 0
          });
        }
      }

      // Add fall of wickets
      if (inningData.fall_of_wickets) {
        for (const fow of inningData.fall_of_wickets) {
          const playerId = await this.upsertPlayer(fow.player_out);
          await inningRef.collection('fallOfWickets').add({
            score: fow.score,
            wicketNumber: fow.wicket_number,
            playerOut: playerId,
            over: fow.over
          });
        }
      }

      console.log(`Created inning ${inningNumber} for match ${matchRef.id}`);
      return inningRef.id;
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

      // Create match document
      const matchDoc = {
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
        endTime: new Date(matchData.date)
      };

      const matchRef = await collections.matches.add(matchDoc);
      console.log(`Created match: ${matchData.match_id} (${matchRef.id})`);

      // Create innings subcollections
      const inningsIds = [];
      if (matchData.innings) {
        for (let i = 0; i < matchData.innings.length; i++) {
          const inningId = await this.createInning(matchRef, matchData.innings[i], i + 1);
          if (inningId) {
            inningsIds.push(inningId);
          }
        }
      }

      // Update match with innings references
      await matchRef.update({
        innings: inningsIds,
        currentInning: matchData.innings ? matchData.innings.length : 1
      });

      return {
        matchId: matchRef.id,
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