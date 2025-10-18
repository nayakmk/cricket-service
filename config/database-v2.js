// Cricket App v2 - Optimized Collections with Validation
// Firebase Firestore Collection Definitions with Schema Validation

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (same as database.js)
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

// Collection Names for v2
const V2_COLLECTIONS = {
  PLAYERS: 'players_v2',
  TEAMS: 'teams_v2',
  MATCHES: 'matches_v2',
  MATCH_SQUADS: 'match_squads_v2',
  INNINGS: 'innings_v2',
  TOURNAMENT_TEAMS: 'tournament_teams_v2',
  PLAYER_MATCH_STATS: 'player_match_stats_v2',
  TOURNAMENTS: 'tournaments_v2',
  SEQUENCES: 'sequences_v2'
};

// Validation Schemas for v2 Collections
const V2_SCHEMAS = {
  // Players Collection Validation
  players: {
    playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    email: { type: 'string', required: true, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
    isActive: { type: 'boolean', required: true },
    role: { type: 'string', required: true, enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'] },
    battingStyle: { type: 'string', required: true, enum: ['LHB', 'RHB'] },
    bowlingStyle: { type: 'string', nullable: true },
    isWicketKeeper: { type: 'boolean', required: true },
    nationality: { type: 'string', nullable: true },
    avatar: { type: 'string', nullable: true },
    externalReferenceId: { type: 'string', nullable: true }, // Original ID from external source
    preferredTeamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    preferredTeam: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true }
    },
    teamsPlayedFor: {
      type: 'array',
      items: {
        teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        team: {
          teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          shortName: { type: 'string', required: true }
        },
        matchesPlayed: { type: 'number', required: true, min: 0 },
        firstPlayed: { type: 'timestamp', required: true },
        lastPlayed: { type: 'timestamp', required: true },
        isCaptain: { type: 'boolean', required: true },
        totalRuns: { type: 'number', required: true, min: 0 },
        totalWickets: { type: 'number', required: true, min: 0 }
      }
    },
    recentMatches: {
      type: 'array',
      maxItems: 10,
      items: {
        matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        match: {
          matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          title: { type: 'string', required: true },
          date: { type: 'timestamp', required: true },
          venue: { type: 'string', required: true },
          tournamentName: { type: 'string', required: true }
        },
        teamPlayedFor: {
          teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          shortName: { type: 'string', required: true }
        },
        batting: {
          runs: { type: 'number', required: true, min: 0 },
          balls: { type: 'number', required: true, min: 0 },
          dismissal: { type: 'string', nullable: true }
        },
        bowling: {
          wickets: { type: 'number', required: true, min: 0 },
          runs: { type: 'number', required: true, min: 0 },
          overs: { type: 'number', required: true, min: 0 }
        }
      }
    },
    tournamentsPlayed: {
      type: 'array',
      items: {
        tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        tournament: {
          tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          season: { type: 'string', required: true }
        },
        matchesPlayed: { type: 'number', required: true, min: 0 },
        totalRuns: { type: 'number', required: true, min: 0 },
        totalWickets: { type: 'number', required: true, min: 0 },
        manOfTheSeries: { type: 'boolean', required: true }
      }
    },
    careerStats: {
      batting: {
        matchesPlayed: { type: 'number', required: true, min: 0 },
        runs: { type: 'number', required: true, min: 0 },
        highestScore: { type: 'number', required: true, min: 0 },
        average: { type: 'number', required: true, min: 0 },
        strikeRate: { type: 'number', required: true, min: 0 },
        centuries: { type: 'number', required: true, min: 0 },
        fifties: { type: 'number', required: true, min: 0 },
        ducks: { type: 'number', required: true, min: 0 },
        notOuts: { type: 'number', required: true, min: 0 }
      },
      bowling: {
        matchesPlayed: { type: 'number', required: true, min: 0 },
        wickets: { type: 'number', required: true, min: 0 },
        average: { type: 'number', required: true, min: 0 },
        economyRate: { type: 'number', required: true, min: 0 },
        strikeRate: { type: 'number', required: true, min: 0 },
        bestBowling: { type: 'string', nullable: true },
        fiveWicketHauls: { type: 'number', required: true, min: 0 },
        hatTricks: { type: 'number', required: true, min: 0 }
      },
      fielding: {
        catches: { type: 'number', required: true, min: 0 },
        runOuts: { type: 'number', required: true, min: 0 },
        stumpings: { type: 'number', required: true, min: 0 }
      },
      overall: {
        matchesPlayed: { type: 'number', required: true, min: 0 },
        wins: { type: 'number', required: true, min: 0 },
        losses: { type: 'number', required: true, min: 0 },
        winPercentage: { type: 'number', required: true, min: 0 }
      }
    },
    seasonStats: {
      season: { type: 'string', required: true },
      matchesPlayed: { type: 'number', required: true, min: 0 }
    },
    achievements: {
      batting: { type: 'array', items: { type: 'string' } },
      bowling: { type: 'array', items: { type: 'string' } },
      fielding: { type: 'array', items: { type: 'string' } },
      team: { type: 'array', items: { type: 'string' } },
      individual: { type: 'array', items: { type: 'string' } }
    },
    createdAt: { type: 'timestamp', required: true },
    updatedAt: { type: 'timestamp', required: true }
  },

  // Teams Collection Validation
  teams: {
    teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    shortName: { type: 'string', required: true, minLength: 1, maxLength: 10 },
    isActive: { type: 'boolean', required: true },
    externalReferenceId: { type: 'string', nullable: true }, // Original ID from external source
    captainId: { type: 'string', nullable: true, pattern: '^\\d{19}$' },
    captain: {
      playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      role: { type: 'string', required: true }
    },
    viceCaptainId: { type: 'string', nullable: true, pattern: '^\\d{19}$' },
    viceCaptain: {
      playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      role: { type: 'string', required: true }
    },
    homeGround: { type: 'string', nullable: true },
    players: {
      type: 'array',
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        player: {
          playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          role: { type: 'string', required: true },
          battingStyle: { type: 'string', required: true },
          avatar: { type: 'string', nullable: true }
        },
        matchesPlayed: { type: 'number', required: true, min: 0 },
        totalRuns: { type: 'number', required: true, min: 0 },
        totalWickets: { type: 'number', required: true, min: 0 },
        lastPlayed: { type: 'timestamp', required: true },
        isCaptain: { type: 'boolean', required: true },
        isViceCaptain: { type: 'boolean', required: true }
      }
    },
    recentMatches: {
      type: 'array',
      maxItems: 10,
      items: {
        matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        match: {
          matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          title: { type: 'string', required: true },
          date: { type: 'timestamp', required: true },
          venue: { type: 'string', required: true },
          opponent: { type: 'string', required: true },
          result: { type: 'string', required: true }
        },
        tournamentName: { type: 'string', required: true },
        teamScore: { type: 'number', required: true, min: 0 },
        opponentScore: { type: 'number', required: true, min: 0 },
        isWinner: { type: 'boolean', required: true }
      }
    },
    tournaments: {
      type: 'array',
      items: {
        tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        tournament: {
          tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          season: { type: 'string', required: true }
        },
        matchesPlayed: { type: 'number', required: true, min: 0 },
        matchesWon: { type: 'number', required: true, min: 0 },
        position: { type: 'number', required: true, min: 0 },
        points: { type: 'number', required: true, min: 0 }
      }
    },
    teamStats: {
      matchesPlayed: { type: 'number', required: true, min: 0 },
      matchesWon: { type: 'number', required: true, min: 0 },
      matchesLost: { type: 'number', required: true, min: 0 },
      winPercentage: { type: 'number', required: true, min: 0, max: 100 },
      totalPlayers: { type: 'number', required: true, min: 0 },
      avgPlayersPerMatch: { type: 'number', required: true, min: 0 }
    },
    createdAt: { type: 'timestamp', required: true },
    updatedAt: { type: 'timestamp', required: true }
  },

  // Matches Collection Validation
  matches: {
    matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    externalReferenceId: { type: 'string', nullable: true }, // Original ID from external source
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    tournament: {
      tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true },
      season: { type: 'string', required: true }
    },
    matchType: { type: 'string', required: true, enum: ['T20', 'ODI', 'Test'] },
    venue: { type: 'string', required: true },
    status: { type: 'string', required: true, enum: ['scheduled', 'live', 'completed', 'abandoned'] },
    scheduledDate: { type: 'timestamp', required: true },
    completedDate: { type: 'timestamp', nullable: true },
    team1SquadId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    team1Squad: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true },
      captainName: { type: 'string', required: true }
    },
    team2SquadId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    team2Squad: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true },
      captainName: { type: 'string', required: true }
    },
    players: {
      type: 'array',
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        player: {
          playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          role: { type: 'string', required: true },
          teamName: { type: 'string', required: true }
        },
        teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        batting: {
          runs: { type: 'number', required: true, min: 0 },
          balls: { type: 'number', required: true, min: 0 },
          fours: { type: 'number', required: true, min: 0 },
          sixes: { type: 'number', required: true, min: 0 }
        },
        bowling: {
          wickets: { type: 'number', required: true, min: 0 },
          runs: { type: 'number', required: true, min: 0 },
          overs: { type: 'number', required: true, min: 0 }
        },
        fielding: {
          catches: { type: 'number', required: true, min: 0 },
          runOuts: { type: 'number', required: true, min: 0 }
        }
      }
    },
    toss: {
      winnerSquadId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      winnerTeamName: { type: 'string', required: true },
      decision: { type: 'string', required: true, enum: ['bat', 'bowl'] }
    },
    result: {
      winnerSquadId: { type: 'string', nullable: true, pattern: '^\\d{19}$' },
      winnerTeamName: { type: 'string', nullable: true },
      margin: { type: 'string', nullable: true },
      resultType: { type: 'string', required: true, enum: ['normal', 'tie', 'abandoned'] }
    },
    scores: {
      team1: {
        runs: { type: 'number', required: true, min: 0 },
        wickets: { type: 'number', required: true, min: 0, max: 10 },
        overs: { type: 'number', required: true, min: 0 },
        declared: { type: 'boolean', required: true }
      },
      team2: {
        runs: { type: 'number', required: true, min: 0 },
        wickets: { type: 'number', required: true, min: 0, max: 10 },
        overs: { type: 'number', required: true, min: 0 },
        declared: { type: 'boolean', required: true }
      }
    },
    playerOfMatchId: { type: 'string', nullable: true, pattern: '^\\d{19}$' },
    playerOfMatch: {
      playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      role: { type: 'string', required: true }
    },
    innings: { type: 'array', items: { type: 'string', pattern: '^\\d{19}$' } },
    createdAt: { type: 'timestamp', required: true },
    updatedAt: { type: 'timestamp', required: true }
  },

  // Match Squads Collection Validation
  matchSquads: {
    matchSquadId: { type: 'string', required: true, pattern: '^\\d{19}_\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    match: {
      matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      title: { type: 'string', required: true },
      date: { type: 'timestamp', required: true },
      venue: { type: 'string', required: true },
      tournamentName: { type: 'string', required: true },
      status: { type: 'string', required: true }
    },
    team: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true }
    },
    players: {
      type: 'array',
      minItems: 1,
      maxItems: 11,
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        name: { type: 'string', required: true },
        role: { type: 'string', required: true, enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'] },
        battingStyle: { type: 'string', required: true, enum: ['LHB', 'RHB'] },
        bowlingStyle: { type: 'string', nullable: true },
        isCaptain: { type: 'boolean', required: true },
        isWicketKeeper: { type: 'boolean', required: true },
        avatar: { type: 'string', nullable: true }
      }
    },
    captainId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    captain: {
      playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true }
    },
    wicketKeepers: {
      type: 'array',
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        name: { type: 'string', required: true },
        isPrimary: { type: 'boolean', required: true }
      }
    },
    opponentSquad: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true },
      captainName: { type: 'string', required: true },
      playersCount: { type: 'number', required: true, min: 1, max: 11 }
    }
  },

  // Innings Collection Validation
  innings: {
    inningsId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    match: {
      matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      title: { type: 'string', required: true },
      date: { type: 'timestamp', required: true },
      venue: { type: 'string', required: true }
    },
    inningNumber: { type: 'number', required: true, min: 1, max: 4 },
    battingTeamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    battingTeam: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true }
    },
    bowlingTeamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    bowlingTeam: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true }
    },
    totalRuns: { type: 'number', required: true, min: 0 },
    totalWickets: { type: 'number', required: true, min: 0, max: 10 },
    totalOvers: { type: 'number', required: true, min: 0 },
    totalBalls: { type: 'number', required: true, min: 0 },
    runRate: { type: 'number', required: true, min: 0 },
    declared: { type: 'boolean', required: true },
    battingPerformances: {
      type: 'array',
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        playerName: { type: 'string', required: true },
        playerRole: { type: 'string', required: true },
        runs: { type: 'number', required: true, min: 0 },
        balls: { type: 'number', required: true, min: 0 },
        fours: { type: 'number', required: true, min: 0 },
        sixes: { type: 'number', required: true, min: 0 },
        strikeRate: { type: 'number', required: true, min: 0 },
        dismissal: {
          type: {
            type: 'string',
            required: true,
            enum: ['bowled', 'caught', 'run-out', 'lbw', 'stumped', 'not-out']
          },
          bowlerId: { type: 'string', nullable: true, pattern: '^\\d{19}$' },
          bowlerName: { type: 'string', required: true },
          fielderId: { type: 'string', nullable: true, pattern: '^\\d{19}$' },
          fielderName: { type: 'string', required: true },
          description: { type: 'string', required: true }
        }
      }
    },
    bowlingPerformances: {
      type: 'array',
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        playerName: { type: 'string', required: true },
        overs: { type: 'number', required: true, min: 0 },
        maidens: { type: 'number', required: true, min: 0 },
        runs: { type: 'number', required: true, min: 0 },
        wickets: { type: 'number', required: true, min: 0 },
        economy: { type: 'number', required: true, min: 0 },
        dots: { type: 'number', required: true, min: 0 }
      }
    },
    fieldingPerformances: {
      type: 'array',
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        playerName: { type: 'string', required: true },
        catches: { type: 'number', required: true, min: 0 },
        runOuts: { type: 'number', required: true, min: 0 },
        stumpings: { type: 'number', required: true, min: 0 }
      }
    }
  },

  // Tournament Teams Collection Validation
  tournamentTeams: {
    tournamentTeamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    tournament: {
      tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true },
      season: { type: 'string', required: true },
      format: { type: 'string', required: true }
    },
    teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    team: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true }
    },
    registeredPlayers: { type: 'array', items: { type: 'string', pattern: '^\\d{19}$' } },
    players: {
      type: 'array',
      items: {
        playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        role: { type: 'string', required: true, enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'] },
        battingStyle: { type: 'string', required: true, enum: ['LHB', 'RHB'] },
        bowlingStyle: { type: 'string', nullable: true },
        isCaptain: { type: 'boolean', required: true },
        isViceCaptain: { type: 'boolean', required: true },
        isWicketKeeper: { type: 'boolean', required: true },
        avatar: { type: 'string', nullable: true },
        joinedDate: { type: 'timestamp', required: true }
      }
    },
    captainId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    captain: {
      playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true }
    },
    viceCaptainId: { type: 'string', nullable: true, pattern: '^\\d{19}$' },
    viceCaptain: {
      playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true }
    },
    matchesPlayed: { type: 'array', items: { type: 'string', pattern: '^\\d{19}$' } },
    tournamentStats: {
      played: { type: 'number', required: true, min: 0 },
      won: { type: 'number', required: true, min: 0 },
      lost: { type: 'number', required: true, min: 0 },
      tied: { type: 'number', required: true, min: 0 },
      points: { type: 'number', required: true, min: 0 },
      netRunRate: { type: 'number', required: true }
    }
  },

  // Player Match Stats Collection Validation
  playerMatchStats: {
    playerMatchStatsId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    player: {
      playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      role: { type: 'string', required: true },
      battingStyle: { type: 'string', required: true },
      bowlingStyle: { type: 'string', nullable: true }
    },
    matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    match: {
      matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      title: { type: 'string', required: true },
      date: { type: 'timestamp', required: true },
      venue: { type: 'string', required: true },
      result: { type: 'string', required: true }
    },
    tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    tournament: {
      tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      season: { type: 'string', required: true }
    },
    teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    team: {
      teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
      name: { type: 'string', required: true },
      shortName: { type: 'string', required: true }
    },
    date: { type: 'timestamp', required: true },
    batting: {
      runs: { type: 'number', required: true, min: 0 },
      balls: { type: 'number', required: true, min: 0 },
      fours: { type: 'number', required: true, min: 0 },
      sixes: { type: 'number', required: true, min: 0 },
      strikeRate: { type: 'number', required: true, min: 0 },
      dismissal: { type: 'string', nullable: true }
    },
    bowling: {
      overs: { type: 'number', required: true, min: 0 },
      maidens: { type: 'number', required: true, min: 0 },
      runs: { type: 'number', required: true, min: 0 },
      wickets: { type: 'number', required: true, min: 0 },
      economy: { type: 'number', required: true, min: 0 }
    },
    fielding: {
      catches: { type: 'number', required: true, min: 0 },
      runOuts: { type: 'number', required: true, min: 0 },
      stumpings: { type: 'number', required: true, min: 0 }
    }
  },

  // Tournaments Collection Validation
  tournaments: {
    tournamentId: { type: 'string', required: true, pattern: '^\\d{19}$' },
    displayId: { type: 'number', required: true, min: 1, max: 999999 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    shortName: { type: 'string', required: true, minLength: 1, maxLength: 20 },
    description: { type: 'string', required: true },
    season: { type: 'string', required: true },
    format: { type: 'string', required: true, enum: ['league', 'knockout', 'round-robin'] },
    isActive: { type: 'boolean', required: true },
    startDate: { type: 'timestamp', required: true },
    endDate: { type: 'timestamp', nullable: true },
    venue: { type: 'string', nullable: true },
    organizer: { type: 'string', required: true },
    rules: {
      matchType: { type: 'string', required: true, enum: ['T20', 'ODI', 'Test'] },
      oversPerInning: { type: 'number', required: true, min: 1 },
      playersPerTeam: { type: 'number', required: true, min: 1, max: 11 },
      maxOversPerBowler: { type: 'number', required: true, min: 1 }
    },
    teams: { type: 'array', items: { type: 'string', pattern: '^\\d{19}$' } },
    teamDetails: {
      type: 'array',
      items: {
        teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        team: {
          teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          shortName: { type: 'string', required: true },
          captainName: { type: 'string', required: true }
        },
        played: { type: 'number', required: true, min: 0 },
        won: { type: 'number', required: true, min: 0 },
        lost: { type: 'number', required: true, min: 0 },
        tied: { type: 'number', required: true, min: 0 },
        points: { type: 'number', required: true, min: 0 },
        netRunRate: { type: 'number', required: true },
        position: { type: 'number', required: true, min: 1 }
      }
    },
    matches: {
      type: 'array',
      items: {
        matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        match: {
          matchId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          title: { type: 'string', required: true },
          date: { type: 'timestamp', required: true },
          venue: { type: 'string', required: true },
          team1Name: { type: 'string', required: true },
          team2Name: { type: 'string', required: true },
          winner: { type: 'string', nullable: true },
          result: { type: 'string', required: true }
        },
        round: { type: 'string', required: true },
        status: { type: 'string', required: true, enum: ['completed', 'scheduled'] }
      }
    },
    topPlayers: {
      batsmen: {
        type: 'array',
        items: {
          playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          runs: { type: 'number', required: true, min: 0 },
          average: { type: 'number', required: true, min: 0 }
        }
      },
      bowlers: {
        type: 'array',
        items: {
          playerId: { type: 'string', required: true, pattern: '^\\d{19}$' },
          name: { type: 'string', required: true },
          wickets: { type: 'number', required: true, min: 0 },
          average: { type: 'number', required: true, min: 0 }
        }
      }
    },
    standings: {
      type: 'array',
      items: {
        teamId: { type: 'string', required: true, pattern: '^\\d{19}$' },
        teamName: { type: 'string', required: true },
        played: { type: 'number', required: true, min: 0 },
        won: { type: 'number', required: true, min: 0 },
        lost: { type: 'number', required: true, min: 0 },
        tied: { type: 'number', required: true, min: 0 },
        points: { type: 'number', required: true, min: 0 },
        netRunRate: { type: 'number', required: true }
      }
    },
    createdAt: { type: 'timestamp', required: true },
    updatedAt: { type: 'timestamp', required: true }
  },

  // Sequences Collection Validation
  sequences: {
    sequenceType: { type: 'string', required: true, enum: ['matches', 'players', 'teams', 'tournaments'] },
    currentValue: { type: 'number', required: true, min: 0 },
    description: { type: 'string', required: true },
    createdAt: { type: 'timestamp', required: true },
    updatedAt: { type: 'timestamp', required: true }
  }
};

// Validation function
function validateDocument(collectionName, document) {
  const schema = V2_SCHEMAS[collectionName];
  if (!schema) {
    throw new Error(`No validation schema found for collection: ${collectionName}`);
  }

  const errors = [];

  function validateField(fieldSchema, value, fieldPath = '') {
    if (fieldSchema.required && (value === undefined || value === null)) {
      errors.push(`${fieldPath} is required`);
      return;
    }

    if (value === null || value === undefined) {
      if (!fieldSchema.nullable) {
        errors.push(`${fieldPath} cannot be null`);
      }
      return;
    }

    switch (fieldSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${fieldPath} must be a string`);
        } else {
          if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
            errors.push(`${fieldPath} must be at least ${fieldSchema.minLength} characters`);
          }
          if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
            errors.push(`${fieldPath} must be at most ${fieldSchema.maxLength} characters`);
          }
          if (fieldSchema.pattern && !new RegExp(fieldSchema.pattern).test(value)) {
            errors.push(`${fieldPath} format is invalid`);
          }
          if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
            errors.push(`${fieldPath} must be one of: ${fieldSchema.enum.join(', ')}`);
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${fieldPath} must be a number`);
        } else {
          if (fieldSchema.min !== undefined && value < fieldSchema.min) {
            errors.push(`${fieldPath} must be at least ${fieldSchema.min}`);
          }
          if (fieldSchema.max !== undefined && value > fieldSchema.max) {
            errors.push(`${fieldPath} must be at most ${fieldSchema.max}`);
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${fieldPath} must be a boolean`);
        }
        break;

      case 'timestamp':
        if (!(value instanceof admin.firestore.Timestamp) && !(value instanceof Date)) {
          errors.push(`${fieldPath} must be a timestamp`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${fieldPath} must be an array`);
        } else {
          if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
            errors.push(`${fieldPath} must have at least ${fieldSchema.minItems} items`);
          }
          if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
            errors.push(`${fieldPath} must have at most ${fieldSchema.maxItems} items`);
          }
          if (fieldSchema.items) {
            value.forEach((item, index) => {
              validateField(fieldSchema.items, item, `${fieldPath}[${index}]`);
            });
          }
        }
        break;

      default:
        if (typeof fieldSchema === 'object' && fieldSchema.type === undefined) {
          // Nested object validation
          Object.keys(fieldSchema).forEach(key => {
            validateField(fieldSchema[key], value[key], fieldPath ? `${fieldPath}.${key}` : key);
          });
        }
        break;
    }
  }

  Object.keys(schema).forEach(field => {
    validateField(schema[field], document[field], field);
  });

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return true;
}

// Get collection reference
function getV2Collection(collectionName) {
  if (!V2_COLLECTIONS[collectionName]) {
    throw new Error(`Unknown v2 collection: ${collectionName}`);
  }
  return admin.firestore().collection(V2_COLLECTIONS[collectionName]);
}

// Export v2 collections and utilities
module.exports = {
  V2_COLLECTIONS,
  V2_SCHEMAS,
  validateDocument,
  getV2Collection,
  collections: {
    players: getV2Collection('PLAYERS'),
    teams: getV2Collection('TEAMS'),
    matches: getV2Collection('MATCHES'),
    matchSquads: getV2Collection('MATCH_SQUADS'),
    innings: getV2Collection('INNINGS'),
    tournamentTeams: getV2Collection('TOURNAMENT_TEAMS'),
    playerMatchStats: getV2Collection('PLAYER_MATCH_STATS'),
    tournaments: getV2Collection('TOURNAMENTS'),
    sequences: getV2Collection('SEQUENCES')
  }
};

// Export the database instance and collections
module.exports = {
  db: admin.firestore(),
  V2_COLLECTIONS,
  V2_SCHEMAS,
  collections: {
    players: getV2Collection('PLAYERS'),
    teams: getV2Collection('TEAMS'),
    matches: getV2Collection('MATCHES'),
    matchSquads: getV2Collection('MATCH_SQUADS'),
    innings: getV2Collection('INNINGS'),
    tournamentTeams: getV2Collection('TOURNAMENT_TEAMS'),
    playerMatchStats: getV2Collection('PLAYER_MATCH_STATS'),
    tournaments: getV2Collection('TOURNAMENTS')
  }
};