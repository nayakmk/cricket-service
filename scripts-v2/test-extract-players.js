require('dotenv').config();

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

// Simple test to check extractSquadPlayers output
async function testExtractSquadPlayers() {
  // Load the JSON data
  const fs = require('fs');
  const matches = JSON.parse(fs.readFileSync('./reports/cricket_matches_from_pdfs_final.json', 'utf8'));

  // Take first match
  const match = matches[0];
  console.log('Testing match:', match.match_id);

  // Mock team data structure
  const teamData = {
    numericId: 1000000000000000001n, // Mock team ID
    data: {
      name: match.teams.team1
    }
  };

  // Simulate extractSquadPlayers logic
  const playerStats = new Map();

  for (const inning of match.innings || []) {
    const isBattingTeam = inning.team === teamData.data.name;

    if (isBattingTeam) {
      console.log(`Processing batting for team ${inning.team}`);

      for (const batsman of inning.batting || []) {
        const playerName = batsman.name;
        console.log(`Processing batsman: ${playerName}, runs: ${batsman.runs}`);

        if (!playerStats.has(playerName)) {
          playerStats.set(playerName, {
            playerId: null,
            teamId: teamData.numericId.toString(),
            name: playerName,
            role: batsman.is_wicket_keeper ? 'wicket-keeper' : 'batsman',
            battingStyle: 'RHB',
            bowlingStyle: null,
            batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
            bowling: { wickets: 0, runs: 0, overs: 0, maidens: 0 },
            fielding: { catches: 0, runOuts: 0, stumpings: 0 }
          });
        }

        const player = playerStats.get(playerName);
        player.batting.runs += batsman.runs || 0;
        player.batting.balls += batsman.balls || 0;
        player.batting.fours += batsman.fours || 0;
        player.batting.sixes += batsman.sixes || 0;
      }
    }
  }

  console.log(`Found ${playerStats.size} players with stats`);
  for (const [name, stats] of playerStats) {
    console.log(`${name}: ${JSON.stringify(stats.batting)}`);
  }
}

testExtractSquadPlayers().catch(console.error);