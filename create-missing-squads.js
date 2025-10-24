const { db, V2_COLLECTIONS } = require('./config/database-v2');
const admin = require('firebase-admin');

async function createMissingSquads() {
  try {
    console.log('Creating squads for matches that don\'t have them...');

    // Get all matches
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).get();
    console.log(`Found ${matchesSnapshot.docs.length} matches`);

    // Get all existing squads
    const squadsSnapshot = await db.collection(V2_COLLECTIONS.MATCH_SQUADS).get();
    const existingMatchIds = new Set();
    squadsSnapshot.docs.forEach(doc => {
      const squadData = doc.data();
      if (squadData.matchId) {
        existingMatchIds.add(squadData.matchId);
      }
    });
    console.log(`Found ${existingMatchIds.size} matches with existing squads`);

    // Find matches without squads
    const matchesWithoutSquads = [];
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const matchId = matchData.numericId;
      if (!existingMatchIds.has(matchId) && matchData.team1?.players && matchData.team2?.players) {
        matchesWithoutSquads.push({ doc: matchDoc, data: matchData });
      }
    }

    console.log(`Found ${matchesWithoutSquads.length} matches without squads that have player data`);

    if (matchesWithoutSquads.length === 0) {
      console.log('No matches need squad creation');
      return;
    }

    const batch = db.batch();
    let squadCount = 0;

    for (const { doc: matchDoc, data: matchData } of matchesWithoutSquads) {
      const matchId = matchData.numericId;

      // Create squad for team1
      if (matchData.team1?.players && matchData.team1.players.length > 0) {
        const team1Squad = {
          matchId: matchId,
          teamId: matchData.team1.id || matchData.team1Id,
          match: {
            matchId: matchId,
            title: `${matchData.team1.name || 'Team 1'} vs ${matchData.team2?.name || 'Team 2'}`,
            date: matchData.date || new Date(),
            venue: matchData.venue || 'Unknown Venue',
            tournamentName: matchData.tournamentName || 'Unknown Tournament',
            status: matchData.status || 'completed'
          },
          team: {
            teamId: matchData.team1.id || matchData.team1Id,
            name: matchData.team1.name || 'Team 1',
            shortName: matchData.team1.shortName || matchData.team1.name?.substring(0, 3).toUpperCase() || 'T1'
          },
          players: matchData.team1.players.map((player, index) => ({
            playerId: player.playerId,
            teamId: matchData.team1.id || matchData.team1Id,
            name: player.name,
            role: player.role || 'batsman',
            battingStyle: 'RHB',
            bowlingStyle: player.role === 'bowler' ? 'RF' : null,
            battingOrder: index + 1,
            bowlingOrder: player.role === 'bowler' ? index + 1 : null,
            isCaptain: false, // We don't have captain info
            isWicketKeeper: player.role === 'wicket-keeper',
            avatar: null
          })),
          captainId: null,
          captain: null,
          wicketKeepers: matchData.team1.players
            .filter(p => p.role === 'wicket-keeper')
            .map(p => ({ playerId: p.playerId, name: p.name, isPrimary: false })),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const team1SquadRef = db.collection(V2_COLLECTIONS.MATCH_SQUADS).doc();
        batch.set(team1SquadRef, team1Squad);
        squadCount++;
      }

      // Create squad for team2
      if (matchData.team2?.players && matchData.team2.players.length > 0) {
        const team2Squad = {
          matchId: matchId,
          teamId: matchData.team2.id || matchData.team2Id,
          match: {
            matchId: matchId,
            title: `${matchData.team1?.name || 'Team 1'} vs ${matchData.team2.name || 'Team 2'}`,
            date: matchData.date || new Date(),
            venue: matchData.venue || 'Unknown Venue',
            tournamentName: matchData.tournamentName || 'Unknown Tournament',
            status: matchData.status || 'completed'
          },
          team: {
            teamId: matchData.team2.id || matchData.team2Id,
            name: matchData.team2.name || 'Team 2',
            shortName: matchData.team2.shortName || matchData.team2.name?.substring(0, 3).toUpperCase() || 'T2'
          },
          players: matchData.team2.players.map((player, index) => ({
            playerId: player.playerId,
            teamId: matchData.team2.id || matchData.team2Id,
            name: player.name,
            role: player.role || 'batsman',
            battingStyle: 'RHB',
            bowlingStyle: player.role === 'bowler' ? 'RF' : null,
            battingOrder: index + 1,
            bowlingOrder: player.role === 'bowler' ? index + 1 : null,
            isCaptain: false,
            isWicketKeeper: player.role === 'wicket-keeper',
            avatar: null
          })),
          captainId: null,
          captain: null,
          wicketKeepers: matchData.team2.players
            .filter(p => p.role === 'wicket-keeper')
            .map(p => ({ playerId: p.playerId, name: p.name, isPrimary: false })),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const team2SquadRef = db.collection(V2_COLLECTIONS.MATCH_SQUADS).doc();
        batch.set(team2SquadRef, team2Squad);
        squadCount++;
      }

      if (squadCount >= 400) { // Firestore batch limit
        await batch.commit();
        console.log(`Committed batch of ${squadCount} squads`);
        batch = db.batch();
        squadCount = 0;
      }
    }

    if (squadCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${squadCount} squads`);
    }

    console.log('Squad creation completed');

  } catch (error) {
    console.error('Error creating squads:', error);
  }
}

createMissingSquads();