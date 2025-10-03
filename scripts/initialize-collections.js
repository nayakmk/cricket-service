// Firestore Collections Initialization Script
// This script demonstrates how collections are created in Firestore
// Collections are created automatically when you first write to them

const { collections } = require('../config/database');

async function initializeCollections() {
  try {
    console.log('🔥 Initializing Firestore Collections for Cricket App...\n');

    // Step 1: Create Players first (without team assignments)
    console.log('👥 Creating Players collection...');
    
    // Team Odia Players
    const teamOdiaPlayers = [
      {
        name: 'Puneet',
        email: 'puneet@example.com',
        role: 'Batsman',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Rupraj',
        email: 'rupraj@example.com',
        role: 'All-rounder',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm medium',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Sowmyak',
        email: 'sowmyak@example.com',
        role: 'Batsman',
        battingStyle: 'Left-handed',
        bowlingStyle: 'Left-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Saroj',
        email: 'saroj@example.com',
        role: 'Bowler',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Malya',
        email: 'malya@example.com',
        role: 'All-rounder',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Sambeet',
        email: 'sambeet@example.com',
        role: 'Wicket-keeper',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm medium',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Puru',
        email: 'puru@example.com',
        role: 'Batsman',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Farahshi',
        email: 'farahshi@example.com',
        role: 'All-rounder',
        battingStyle: 'Left-handed',
        bowlingStyle: 'Left-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Abhibash',
        email: 'abhibash@example.com',
        role: 'Bowler',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Norace',
        email: 'norace@example.com',
        role: 'All-rounder',
        battingStyle: 'Left-handed',
        bowlingStyle: 'Left-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Ashutosh',
        email: 'ashutosh@example.com',
        role: 'Batsman',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Hara',
        email: 'hara@example.com',
        role: 'Bowler',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Team ROI Players
    const teamROIPlayers = [
      {
        name: 'Sundar',
        email: 'sundar@example.com',
        role: 'Batsman',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm medium',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Kartic',
        email: 'kartic@example.com',
        role: 'All-rounder',
        battingStyle: 'Left-handed',
        bowlingStyle: 'Left-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Subajit',
        email: 'subajit@example.com',
        role: 'Wicket-keeper',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm medium',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Pawan',
        email: 'pawan@example.com',
        role: 'Bowler',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Sri',
        email: 'sri@example.com',
        role: 'All-rounder',
        battingStyle: 'Left-handed',
        bowlingStyle: 'Left-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Sonal',
        email: 'sonal@example.com',
        role: 'Batsman',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Kumar G',
        email: 'kumar.g@example.com',
        role: 'Bowler',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Anil',
        email: 'anil@example.com',
        role: 'All-rounder',
        battingStyle: 'Left-handed',
        bowlingStyle: 'Left-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Arka',
        email: 'arka@example.com',
        role: 'Batsman',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm medium',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Ishaan',
        email: 'ishaan@example.com',
        role: 'Bowler',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm fast',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Shankank',
        email: 'shankank@example.com',
        role: 'All-rounder',
        battingStyle: 'Left-handed',
        bowlingStyle: 'Left-arm spin',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Akhilesh',
        email: 'akhilesh@example.com',
        role: 'Wicket-keeper',
        battingStyle: 'Right-handed',
        bowlingStyle: 'Right-arm medium',
        statistics: {
          matchesPlayed: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          average: 0,
          strikeRate: 0,
          economy: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Create all players and store their IDs
    const allPlayers = [...teamOdiaPlayers, ...teamROIPlayers];
    const createdPlayers = [];
    
    for (const player of allPlayers) {
      const docRef = await collections.players.add(player);
      const playerWithId = { id: docRef.id, ...player };
      createdPlayers.push(playerWithId);
      console.log(`✅ Created player: ${player.name} (ID: ${docRef.id})`);
    }

    // Step 2: Create Teams with captain IDs
    console.log('\n📋 Creating Teams collection...');
    
    // Find captain player IDs
    const puneetCaptain = createdPlayers.find(p => p.name === 'Puneet');
    const sundarCaptain = createdPlayers.find(p => p.name === 'Sundar');

    const sampleTeams = [
      {
        name: 'Team Odia',
        shortName: 'TOD',
        captainId: puneetCaptain.id, // Captain as player ID reference
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Team ROI',
        shortName: 'TRI',
        captainId: sundarCaptain.id, // Captain as player ID reference
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const createdTeams = [];
    for (const team of sampleTeams) {
      const docRef = await collections.teams.add(team);
      const teamWithId = { id: docRef.id, ...team };
      createdTeams.push(teamWithId);
      console.log(`✅ Created team: ${team.name} (ID: ${docRef.id})`);
    }

    // Step 3: Create Team Lineups collection (Playing 11)
    console.log('\n🏃‍♂️ Creating Team Lineups collection...');
    
    // Get Team Odia players (first 12 players)
    const teamOdiaPlayerIds = createdPlayers.slice(0, 12).map(p => p.id);
    // Get Team ROI players (last 12 players)
    const teamROIPlayerIds = createdPlayers.slice(12, 24).map(p => p.id);

    const teamLineups = [
      {
        teamId: createdTeams[0].id, // Team Odia
        teamName: 'Team Odia',
        playerIds: teamOdiaPlayerIds,
        playingXI: teamOdiaPlayerIds.slice(0, 11), // First 11 as playing XI
        captain: puneetCaptain.id,
        wicketKeeper: createdPlayers.find(p => p.name === 'Sambeet').id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        teamId: createdTeams[1].id, // Team ROI
        teamName: 'Team ROI',
        playerIds: teamROIPlayerIds,
        playingXI: teamROIPlayerIds.slice(0, 11), // First 11 as playing XI
        captain: sundarCaptain.id,
        wicketKeeper: createdPlayers.find(p => p.name === 'Subajit').id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const createdLineups = [];
    for (const lineup of teamLineups) {
      const docRef = await collections.teamLineups.add(lineup);
      const lineupWithId = { id: docRef.id, ...lineup };
      createdLineups.push(lineupWithId);
      console.log(`✅ Created lineup for: ${lineup.teamName} (ID: ${docRef.id})`);
    }

    // Step 4: Create Match
    console.log('\n🏏 Creating Matches collection...');
    const sampleMatch = {
      title: 'Team Odia vs Team ROI - Box Cricket Tournament',
      venue: 'Local Cricket Ground',
      date: new Date().toISOString(),
      format: 'Box Cricket',
      overs: 20,
      team1Id: createdTeams[0].id, // Team Odia ID
      team2Id: createdTeams[1].id, // Team ROI ID
      team1LineupId: createdLineups[0].id, // Team Odia lineup
      team2LineupId: createdLineups[1].id, // Team ROI lineup
      status: 'scheduled',
      tossWinner: null,
      tossDecision: null,
      currentInnings: 'first',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const matchDocRef = await collections.matches.add(sampleMatch);
    const createdMatch = { id: matchDocRef.id, ...sampleMatch };
    console.log(`✅ Created match: ${sampleMatch.title} (ID: ${matchDocRef.id})`);

    console.log('\n🎉 All collections initialized successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`- Teams: ${createdTeams.length}`);
    console.log(`- Players: ${createdPlayers.length}`);
    console.log(`- Team Lineups: ${createdLineups.length}`);
    console.log(`- Matches: 1`);
    console.log(`\n🔗 Created Match ID: ${createdMatch.id}`);
    console.log(`🔗 Team Odia ID: ${createdTeams[0].id}`);
    console.log(`🔗 Team ROI ID: ${createdTeams[1].id}`);
    console.log(`🔗 Team Odia Captain: ${puneetCaptain.name} (${puneetCaptain.id})`);
    console.log(`🔗 Team ROI Captain: ${sundarCaptain.name} (${sundarCaptain.id})`);

    return {
      teams: createdTeams,
      players: createdPlayers,
      lineups: createdLineups,
      match: createdMatch
    };

  } catch (error) {
    console.error('❌ Error initializing collections:', error);
  }
}

// Export for use in other scripts
module.exports = { initializeCollections };

// Run if called directly
if (require.main === module) {
  initializeCollections();
}