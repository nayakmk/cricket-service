const fs = require('fs');
const path = require('path');
const { collections, db, admin } = require('../config/database');

class InningsDataPopulator {
  constructor() {
    this.matchesData = [];
  }

  async populateInningsForExistingMatches() {
    try {
      console.log('Starting to populate innings data for existing matches...');

      // Get all matches
      const matchesSnapshot = await collections.matches.get();
      const matches = [];

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = { id: matchDoc.id, ...matchDoc.data() };
        matches.push(matchData);
      }

      console.log(`Found ${matches.length} matches to process`);

      for (const match of matches) {
        if (match.status === 'completed' && (!match.innings || match.innings.length === 0)) {
          console.log(`Processing completed match: ${match.id} - ${match.title}`);

          // Create mock innings data for completed matches
          // In a real scenario, you'd have the actual innings data from your source
          const inningsData = this.generateMockInningsData(match);
          const inningsIds = [];

          for (let i = 0; i < inningsData.length; i++) {
            const inningData = inningsData[i];
            const inningRef = await collections.matches.doc(match.id).collection('innings').add(inningData);
            inningsIds.push(inningRef.id);
            console.log(`Created inning ${i + 1} for match ${match.id}`);
          }

          // Update match with innings references
          await collections.matches.doc(match.id).update({
            innings: inningsIds,
            currentInning: inningsData.length
          });

          console.log(`Updated match ${match.id} with ${inningsIds.length} innings`);
        } else if (match.innings && match.innings.length > 0) {
          console.log(`Match ${match.id} already has innings data, skipping`);
        }
      }

      console.log('Finished populating innings data for existing matches');
    } catch (error) {
      console.error('Error populating innings data:', error);
    }
  }

  generateMockInningsData(match) {
    // This is a simplified mock data generator
    // In reality, you'd have the actual innings data from your cricket data source

    const innings = [];

    // First innings
    const firstInning = {
      inningNumber: 1,
      battingTeamId: match.team1Id,
      bowlingTeamId: match.team2Id,
      runs: 120,
      wickets: 8,
      overs: 20,
      balls: 120,
      extras: {
        noBalls: 2,
        wides: 5,
        byes: 1,
        legByes: 3
      },
      batting: [
        {
          player: 'player1',
          runs: 45,
          balls: 32,
          fours: 5,
          sixes: 1,
          howOut: 'bowled'
        },
        {
          player: 'player2',
          runs: 25,
          balls: 28,
          fours: 2,
          sixes: 0,
          howOut: 'caught'
        },
        // Add more batsmen...
      ],
      bowling: [
        {
          player: 'playerA',
          overs: 4,
          maidens: 0,
          runs: 25,
          wickets: 2
        },
        {
          player: 'playerB',
          overs: 4,
          maidens: 0,
          runs: 30,
          wickets: 1
        },
        // Add more bowlers...
      ],
      fallOfWickets: [
        { wicketNumber: 1, playerOut: 'player1', score: 45, overs: 8.2 },
        { wicketNumber: 2, playerOut: 'player2', score: 67, overs: 12.1 },
        // Add more wickets...
      ]
    };

    innings.push(firstInning);

    // Second innings (if match went to second innings)
    if (match.result && match.result.includes('wickets') || match.result.includes('runs')) {
      const secondInning = {
        inningNumber: 2,
        battingTeamId: match.team2Id,
        bowlingTeamId: match.team1Id,
        runs: 95,
        wickets: 10,
        overs: 18.5,
        balls: 113,
        extras: {
          noBalls: 1,
          wides: 3,
          byes: 2,
          legByes: 1
        },
        batting: [
          {
            player: 'playerA',
            runs: 35,
            balls: 25,
            fours: 3,
            sixes: 1,
            howOut: 'lbw'
          },
          // Add more batsmen...
        ],
        bowling: [
          {
            player: 'player1',
            overs: 3.5,
            maidens: 0,
            runs: 15,
            wickets: 3
          },
          // Add more bowlers...
        ],
        fallOfWickets: [
          { wicketNumber: 1, playerOut: 'playerA', score: 35, overs: 6.3 },
          // Add more wickets...
        ]
      };

      innings.push(secondInning);
    }

    return innings;
  }

  async run() {
    await this.populateInningsForExistingMatches();
    process.exit(0);
  }
}

// Run the populator
const populator = new InningsDataPopulator();
populator.run().catch(console.error);