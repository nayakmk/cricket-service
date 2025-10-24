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

// Simple test to update career stats for one match
async function testCareerStatsUpdate() {
  // Get one match
  const matchesSnapshot = await db.collection('matches_v2').limit(1).get();
  if (matchesSnapshot.empty) {
    console.log('No matches found');
    return;
  }

  const matchDoc = matchesSnapshot.docs[0];
  const match = { id: matchDoc.id, ...matchDoc.data() };

  console.log('Testing career stats update for match:', match.id);
  console.log('Match teams:', match.teams);
  console.log('Match innings count:', match.innings?.length || 0);

  // Get teams
  const teamsSnapshot = await db.collection('teams_v2').get();
  const teamsMap = new Map();
  teamsSnapshot.forEach(doc => {
    const teamData = doc.data();
    teamsMap.set(teamData.name, { numericId: teamData.numericId, data: teamData });
  });

  const team1Data = teamsMap.get(match.teams?.team1);
  const team2Data = teamsMap.get(match.teams?.team2);

  if (!team1Data || !team2Data) {
    console.log('Teams not found:', match.teams);
    return;
  }

  console.log('Team1 data:', team1Data);
  console.log('Team2 data:', team2Data);

  // Extract players with stats
  const team1Players = extractSquadPlayers(match, team1Data);
  const team2Players = extractSquadPlayers(match, team2Data);

  console.log(`Team1 players: ${team1Players.length}, Team2 players: ${team2Players.length}`);

  if (team1Players.length > 0) {
    console.log('Sample Team1 player:', JSON.stringify(team1Players[0], null, 2));
  }

  if (team2Players.length > 0) {
    console.log('Sample Team2 player:', JSON.stringify(team2Players[0], null, 2));
  }

  // Update career stats
  await updatePlayerCareerStats(match, team1Players, team2Players);

  console.log('Career stats update completed');
}

function extractSquadPlayers(match, teamData) {
  const playerStats = new Map();

  for (const inning of match.innings || []) {
    const isBattingTeam = inning.team === teamData.data.name;

    if (isBattingTeam) {
      for (const batsman of inning.batting || []) {
        const playerName = batsman.name;
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
            fielding: { catches: 0, runOuts: 0 }
          });
        }

        const player = playerStats.get(playerName);
        player.batting.runs += batsman.runs || 0;
        player.batting.balls += batsman.balls || 0;
        player.batting.fours += batsman.fours || 0;
        player.batting.sixes += batsman.sixes || 0;
      }

      for (const bowler of inning.bowling || []) {
        const playerName = bowler.name;
        if (!playerStats.has(playerName)) {
          playerStats.set(playerName, {
            playerId: null,
            teamId: teamData.numericId.toString(),
            name: playerName,
            role: 'bowler',
            battingStyle: 'RHB',
            bowlingStyle: 'RF',
            batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
            bowling: { wickets: 0, runs: 0, overs: 0, maidens: 0 },
            fielding: { catches: 0, runOuts: 0 }
          });
        }

        const player = playerStats.get(playerName);
        player.bowling.wickets += bowler.wickets || 0;
        player.bowling.runs += bowler.runs || 0;
        player.bowling.overs += bowler.overs || 0;
        player.bowling.maidens += bowler.maidens || 0;
      }
    }
  }

  // Convert to array and set playerIds
  const playersArray = Array.from(playerStats.values()).map(player => {
    // Mock playerId lookup - in real code this would query the database
    player.playerId = `200000000000000000${Math.floor(Math.random() * 10)}`; // Mock ID
    return player;
  });

  return playersArray;
}

async function updatePlayerCareerStats(match, team1Players, team2Players) {
  const playersToUpdate = [...team1Players, ...team2Players];
  console.log(`Updating ${playersToUpdate.length} players`);

  for (const player of playersToUpdate) {
    console.log(`Updating player ${player.name} (${player.playerId}): batting=${JSON.stringify(player.batting)}`);
  }
}

function extractSquadPlayers(match, teamData) {
  const playerStats = new Map(); // playerName -> aggregated stats

  // Process all innings to collect player statistics
  for (const inning of match.innings || []) {
    const isBattingTeam = inning.team === teamData.data.name;

    if (isBattingTeam) {
      // Process batting statistics
      for (const batsman of inning.batting || []) {
        const playerName = batsman.name;
        if (!playerStats.has(playerName)) {
          playerStats.set(playerName, {
            playerId: null,
            teamId: teamData.numericId.toString(),
            name: playerName,
            role: batsman.is_wicket_keeper ? 'wicket-keeper' : 'batsman',
            battingStyle: 'RHB',
            bowlingStyle: null,
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

      // Process bowling statistics
      for (const bowler of inning.bowling || []) {
        const playerName = bowler.name;
        if (!playerStats.has(playerName)) {
          playerStats.set(playerName, {
            playerId: null,
            teamId: teamData.numericId.toString(),
            name: playerName,
            role: 'bowler',
            battingStyle: 'RHB',
            bowlingStyle: 'RF',
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

  // Convert to array and set playerIds from playersMap
  const playersArray = Array.from(playerStats.values()).map(player => {
    // Mock player lookup - in real code this would use playersMap
    // For testing, we'll assign mock IDs
    player.playerId = `200000000000000000${Math.floor(Math.random() * 10)}`; // Mock ID
    return player;
  }).filter(player => player.playerId); // Only include players we have in our database

  return playersArray;
}

testCareerStatsUpdate().catch(console.error);