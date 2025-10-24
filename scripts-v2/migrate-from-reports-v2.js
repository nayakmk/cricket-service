const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

// V2 Data Transformer Class
class V2DataTransformer {
  constructor() {
    this.idGenerators = {
      players: () => `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teams: () => `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      matches: () => `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      matchSquads: () => `squad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      innings: () => `innings_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playerMatchStats: () => `stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  // Transform team data to v2 format
  transformTeam(teamData) {
    const teamId = this.idGenerators.teams();

    const team = {
      teamId,
      displayId: Math.floor(Math.random() * 999999) + 1,
      name: teamData.name || teamData.teamName,
      shortName: teamData.shortName || this.generateShortName(teamData.name || teamData.teamName),
      isActive: true,
      captainId: null,
      captain: null,
      viceCaptainId: null,
      viceCaptain: null,
      homeGround: null,
      players: [],
      recentMatches: [],
      tournaments: [],
      teamStats: {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winPercentage: 0,
        totalPlayers: 0,
        avgPlayersPerMatch: 0
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    return team;
  }

  generateShortName(teamName) {
    if (!teamName) return 'UNK';
    return teamName.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 3);
  }

  // Extract players from innings data
  extractPlayersFromInnings(innings, teamName) {
    const players = [];

    if (!innings || !Array.isArray(innings)) return players;

    const teamInnings = innings.find(inn => inn.team === teamName);
    if (!teamInnings) return players;

    if (teamInnings.batting && Array.isArray(teamInnings.batting)) {
      teamInnings.batting.forEach(batter => {
        if (!players.find(p => p.name === batter.name)) {
          players.push({
            name: batter.name,
            role: batter.is_wicket_keeper ? 'Wicket-keeper' :
                  batter.is_captain ? 'All-rounder' : 'Batsman',
            battingStyle: batter.batting_style === 'LHB' ? 'Left-handed' : 'Right-handed',
            isCaptain: batter.is_captain || false,
            isWicketKeeper: batter.is_wicket_keeper || false
          });
        }
      });
    }

    if (teamInnings.bowling && Array.isArray(teamInnings.bowling)) {
      teamInnings.bowling.forEach(bowler => {
        if (!players.find(p => p.name === bowler.name)) {
          players.push({
            name: bowler.name,
            role: bowler.is_wicket_keeper ? 'Wicket-keeper' :
                  bowler.is_captain ? 'All-rounder' : 'Bowler',
            isCaptain: bowler.is_captain || false,
            isWicketKeeper: bowler.is_wicket_keeper || false
          });
        }
      });
    }

    return players;
  }

  // Transform player data to v2 format
  transformPlayer(playerData) {
    const playerId = this.idGenerators.players();

    const roleMapping = {
      'Batsman': 'batsman',
      'Bowler': 'bowler',
      'All-rounder': 'all-rounder',
      'Wicket-keeper': 'wicket-keeper'
    };

    const role = roleMapping[playerData.role] || 'all-rounder';

    const battingStyleMapping = {
      'Left-handed': 'LHB',
      'Right-handed': 'RHB'
    };

    const battingStyle = battingStyleMapping[playerData.battingStyle] || 'RHB';

    const player = {
      playerId,
      displayId: Math.floor(Math.random() * 999999) + 1,
      name: playerData.name,
      email: `${playerData.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      isActive: true,
      role,
      battingStyle,
      bowlingStyle: null,
      isWicketKeeper: playerData.isWicketKeeper || false,
      nationality: 'Unknown',
      avatar: null,
      preferredTeamId: null,
      preferredTeam: null,
      teamsPlayedFor: [],
      recentMatches: [],
      tournamentsPlayed: [],
      careerStats: {
        matchesPlayed: 0,
        runs: 0,
        wickets: 0,
        highestScore: 0,
        battingAverage: 0,
        bowlingAverage: 0,
        strikeRate: 0,
        economy: 0,
        bestBowling: '0/0',
        centuries: 0,
        fifties: 0,
        ducks: 0
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    return player;
  }

  // Extract innings data
  extractInningsData(innings, matchId, team1Id, team2Id, team1Name, team2Name) {
    const inningsList = [];

    if (!innings || !Array.isArray(innings)) return inningsList;

    innings.forEach((inningData, index) => {
      const inningsId = this.idGenerators.innings();

      const teamId = inningData.team === team1Name ? team1Id : team2Id;

      const innings = {
        inningsId,
        displayId: Math.floor(Math.random() * 999999) + 1,
        matchId,
        teamId,
        inningsNumber: index + 1,
        totalRuns: inningData.score ? parseInt(inningData.score.split('/')[0]) : 0,
        totalWickets: inningData.score ? parseInt(inningData.score.split('/')[1]) || 10 : 0,
        totalOvers: inningData.overs || 0,
        declared: false,
        followOn: false,
        battingOrder: inningData.batting ? inningData.batting.map(b => b.name) : [],
        bowlingFigures: inningData.bowling ? inningData.bowling.map(b => ({
          bowler: b.name,
          overs: parseFloat(b.overs) || 0,
          maidens: b.maidens || 0,
          runs: b.runs || 0,
          wickets: b.wickets || 0
        })) : [],
        extras: {
          byes: inningData.extras?.b || 0,
          legByes: 0,
          wides: inningData.extras?.wd || 0,
          noBalls: inningData.extras?.nb || 0
        },
        fallOfWickets: [],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      inningsList.push(innings);
    });

    return inningsList;
  }

  // Extract player match stats
  extractPlayerMatchStats(innings, matchId, players) {
    const statsList = [];

    if (!innings || !Array.isArray(innings)) return statsList;

    innings.forEach(inningData => {
      if (inningData.batting && Array.isArray(inningData.batting)) {
        inningData.batting.forEach(batter => {
          const player = players.find(p => p.name === batter.name);
          if (player) {
            const statsId = this.idGenerators.playerMatchStats();

            const stats = {
              statsId,
              displayId: Math.floor(Math.random() * 999999) + 1,
              playerId: player.playerId,
              matchId,
              batting: {
                runs: batter.runs || 0,
                balls: batter.balls || 0,
                fours: batter.fours || 0,
                sixes: batter.sixes || 0,
                strikeRate: batter.sr || 0,
                dismissalType: batter.how_out?.type || null,
                bowler: batter.how_out?.bowler || null,
                fielder: batter.how_out?.fielder || null
              },
              bowling: { runs: 0, wickets: 0, overs: 0 },
              fielding: { catches: 0, runOuts: 0, stumpings: 0 },
              createdAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now()
            };

            statsList.push(stats);
          }
        });
      }

      if (inningData.bowling && Array.isArray(inningData.bowling)) {
        inningData.bowling.forEach(bowler => {
          const player = players.find(p => p.name === bowler.name);
          if (player) {
            let stats = statsList.find(s => s.playerId === player.playerId);
            if (!stats) {
              const statsId = this.idGenerators.playerMatchStats();

              stats = {
                statsId,
                displayId: Math.floor(Math.random() * 999999) + 1,
                playerId: player.playerId,
                matchId,
                batting: { runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissalType: null, bowler: null, fielder: null },
                bowling: { runs: 0, wickets: 0, overs: 0 },
                fielding: { catches: 0, runOuts: 0, stumpings: 0 },
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
              };
              statsList.push(stats);
            }

            stats.bowling = {
              overs: parseFloat(bowler.overs) || 0,
              maidens: bowler.maidens || 0,
              runs: bowler.runs || 0,
              wickets: bowler.wickets || 0,
              economy: bowler.eco || 0
            };
          }
        });
      }
    });

    return statsList;
  }
}

// Migration function
async function migrateToV2() {
  console.log('Starting v2 migration from reports folder...');

  const transformer = new V2DataTransformer();

  // Load match data from reports folder
  const reportsDir = path.join(__dirname, '..', 'reports');
  const matchFiles = fs.readdirSync(reportsDir)
    .filter(file => file.endsWith('.json') && file !== 'population-summary.json');

  console.log('Found', matchFiles.length, 'match files to process');

  // First pass: Collect all unique players across all matches
  console.log('Collecting unique players from all match files...');
  const uniquePlayers = new Map();
  const uniqueTeams = new Map();

  for (const matchFile of matchFiles) {
    try {
      const rawData = JSON.parse(fs.readFileSync(path.join(reportsDir, matchFile), 'utf8'));
      const matchData = Array.isArray(rawData) ? rawData[0] : rawData;

      const team1Name = matchData.teams?.team1 || matchData.team1?.name;
      const team2Name = matchData.teams?.team2 || matchData.team2?.name;

      if (!team1Name || !team2Name) continue;

      if (!uniqueTeams.has(team1Name)) {
        uniqueTeams.set(team1Name, {
          name: team1Name,
          shortName: transformer.generateShortName(team1Name)
        });
      }
      if (!uniqueTeams.has(team2Name)) {
        uniqueTeams.set(team2Name, {
          name: team2Name,
          shortName: transformer.generateShortName(team2Name)
        });
      }

      const team1Players = transformer.extractPlayersFromInnings(matchData.innings, team1Name);
      const team2Players = transformer.extractPlayersFromInnings(matchData.innings, team2Name);

      [...team1Players, ...team2Players].forEach(player => {
        if (!uniquePlayers.has(player.name)) {
          uniquePlayers.set(player.name, player);
        }
      });

    } catch (error) {
      console.warn('Error processing for player collection:', error.message);
    }
  }

  console.log(`Found ${uniquePlayers.size} unique players and ${uniqueTeams.size} unique teams`);

  // Create all unique teams and players first
  console.log('Creating teams and players...');
  const allPlayers = [];
  const allTeams = [];

  for (const [teamName, teamData] of uniqueTeams) {
    const team = transformer.transformTeam(teamData);
    allTeams.push(team);
  }

  for (const [playerName, playerData] of uniquePlayers) {
    const player = transformer.transformPlayer(playerData);
    allPlayers.push(player);
  }

  const setupBatch = db.batch();
  allTeams.forEach(team => {
    setupBatch.set(db.collection('teams_v2').doc(team.teamId), team);
  });
  allPlayers.forEach(player => {
    setupBatch.set(db.collection('players_v2').doc(player.playerId), player);
  });

  await setupBatch.commit();
  console.log(`Created ${allTeams.length} teams and ${allPlayers.length} players`);

  const playerLookup = new Map();
  allPlayers.forEach(player => {
    playerLookup.set(player.name, player);
  });

  const teamLookup = new Map();
  allTeams.forEach(team => {
    teamLookup.set(team.name, team);
  });

  // Second pass: Process matches
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const matchFile of matchFiles) {
    try {
      console.log('Processing match ...');

      const rawData = JSON.parse(fs.readFileSync(path.join(reportsDir, matchFile), 'utf8'));
      const matchData = Array.isArray(rawData) ? rawData[0] : rawData;

      const team1Name = matchData.teams?.team1 || matchData.team1?.name;
      const team2Name = matchData.teams?.team2 || matchData.team2?.name;

      if (!team1Name || !team2Name) {
        throw new Error('Missing team names in match file');
      }

      const team1 = teamLookup.get(team1Name);
      const team2 = teamLookup.get(team2Name);

      if (!team1 || !team2) {
        throw new Error(`Teams not found: ${team1Name}, ${team2Name}`);
      }

      const team1Players = transformer.extractPlayersFromInnings(matchData.innings, team1Name);
      const team2Players = transformer.extractPlayersFromInnings(matchData.innings, team2Name);

      const team1PlayerObjects = team1Players.map(p => playerLookup.get(p.name)).filter(p => p);
      const team2PlayerObjects = team2Players.map(p => playerLookup.get(p.name)).filter(p => p);

      const team1Squad = {
        squadId: transformer.idGenerators.matchSquads(),
        displayId: Math.floor(Math.random() * 999999) + 1,
        teamId: team1.teamId,
        teamName: team1.name,
        shortName: team1.shortName,
        captain: team1.captain,
        viceCaptain: team1.viceCaptain,
        players: team1PlayerObjects.slice(0, 11).map(p => ({
          playerId: p.playerId,
          name: p.name,
          role: p.role
        })),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const team2Squad = {
        squadId: transformer.idGenerators.matchSquads(),
        displayId: Math.floor(Math.random() * 999999) + 1,
        teamId: team2.teamId,
        teamName: team2.name,
        shortName: team2.shortName,
        captain: team2.captain,
        viceCaptain: team2.viceCaptain,
        players: team2PlayerObjects.slice(0, 11).map(p => ({
          playerId: p.playerId,
          name: p.name,
          role: p.role
        })),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const match = {
        matchId: transformer.idGenerators.matches(),
        displayId: Math.floor(Math.random() * 999999) + 1,
        tournamentId: 'default_tournament',
        tournamentName: matchData.tournament || 'Box Cricket League',
        matchNumber: 1,
        venue: matchData.ground || 'Box Cricket Ground',
        matchDate: matchData.date ? new Date(matchData.date) : admin.firestore.Timestamp.now(),
        status: 'completed',
        // Nested team structure with squad and score information
        team1: {
          id: team1.teamId,
          name: team1.name,
          shortName: team1.shortName,
          squad: {
            teamId: team1Squad.teamId,
            name: team1Squad.teamName,
            shortName: team1Squad.shortName,
            captainName: team1Squad.captain?.name || 'Captain'
          },
          squadId: team1Squad.squadId,
          score: matchData.team1_score || matchData.team1Score || 0
        },
        team2: {
          id: team2.teamId,
          name: team2.name,
          shortName: team2.shortName,
          squad: {
            teamId: team2Squad.teamId,
            name: team2Squad.teamName,
            shortName: team2Squad.shortName,
            captainName: team2Squad.captain?.name || 'Captain'
          },
          squadId: team2Squad.squadId,
          score: matchData.team2_score || matchData.team2Score || 0
        },
        // Legacy fields for backward compatibility
        team1Id: team1.teamId,
        team1SquadId: team1Squad.squadId,
        team1Squad: {
          teamId: team1Squad.teamId,
          name: team1Squad.teamName,
          shortName: team1Squad.shortName,
          captainName: team1Squad.captain?.name || 'Captain'
        },
        team2Id: team2.teamId,
        team2SquadId: team2Squad.squadId,
        team2Squad: {
          teamId: team2Squad.teamId,
          name: team2Squad.teamName,
          shortName: team2Squad.shortName,
          captainName: team2Squad.captain?.name || 'Captain'
        },
        team1Score: matchData.team1_score || matchData.team1Score || 0,
        team2Score: matchData.team2_score || matchData.team2Score || 0,
        players: [],
        toss: {
          winnerSquadId: matchData.toss?.winner === team1Name ? team1Squad.squadId : team2Squad.squadId,
          winnerTeamName: matchData.toss?.winner || team1Name,
          decision: matchData.toss?.decision || 'bat'
        },
        result: {
          winnerSquadId: matchData.result?.winner === team1Name ? team1Squad.squadId :
                        matchData.result?.winner === team2Name ? team2Squad.squadId : null,
          winnerTeamName: matchData.result?.winner || null,
          margin: matchData.result?.margin || null,
          resultType: 'normal'
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const batch = db.batch();
      batch.set(db.collection('matches_v2').doc(match.matchId), match);
      batch.set(db.collection('matches_v2').doc(match.matchId).collection('squads').doc(team1Squad.squadId), team1Squad);
      batch.set(db.collection('matches_v2').doc(match.matchId).collection('squads').doc(team2Squad.squadId), team2Squad);

      const inningsData = transformer.extractInningsData(matchData.innings, match.matchId, team1.teamId, team2.teamId, team1Name, team2Name);
      inningsData.forEach(innings => {
        batch.set(db.collection('matches_v2').doc(match.matchId).collection('innings').doc(innings.inningsId), innings);
      });

      const playerStats = transformer.extractPlayerMatchStats(matchData.innings, match.matchId, allPlayers);
      playerStats.forEach(stats => {
        batch.set(db.collection('matches_v2').doc(match.matchId).collection('playerStats').doc(stats.statsId), stats);
      });

      await batch.commit();

      console.log('Successfully migrated');
      successCount++;

    } catch (error) {
      console.error('Error processing:', error.message);
      errors.push({ file: matchFile, error: error.message });
      errorCount++;
    }
  }

  console.log('\nMigration completed:');
  console.log(`- Successfully processed: ${successCount} files`);
  console.log(`- Errors: ${errorCount} files`);
  console.log(`- Total unique players created: ${uniquePlayers.size}`);
  console.log(`- Total unique teams created: ${uniqueTeams.size}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(err => console.log(`  - ${err.file}: ${err.error}`));
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToV2()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToV2, V2DataTransformer };