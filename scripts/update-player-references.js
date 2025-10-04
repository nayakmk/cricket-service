const { collections } = require('../config/database');

/**
 * Script to update player ID references in all collections after deduplication
 * Maps deleted player IDs to their kept counterparts
 */
async function updatePlayerReferences() {
  try {
    console.log('🔍 Starting player reference update process...');

    // Step 1: Get the mapping of deleted players to kept players
    const playersSnapshot = await collections.players.get();
    const playerMapping = new Map(); // deletedId -> keptId

    // Group players by name again to recreate the mapping
    const playersByName = new Map();

    playersSnapshot.forEach(doc => {
      const player = { id: doc.id, ...doc.data() };
      const nameKey = player.name?.toLowerCase()?.trim();
      if (nameKey) {
        if (!playersByName.has(nameKey)) {
          playersByName.set(nameKey, []);
        }
        playersByName.get(nameKey).push(player);
      }
    });

    // Create mapping from deduplicated players to kept players
    playersByName.forEach((playerGroup, name) => {
      if (playerGroup.length > 1) {
        // Find the kept player (isActive !== false) and map deleted ones to it
        const keptPlayer = playerGroup.find(p => p.isActive !== false);
        const deletedPlayers = playerGroup.filter(p => p.isActive === false);

        if (keptPlayer) {
          deletedPlayers.forEach(deletedPlayer => {
            playerMapping.set(deletedPlayer.id, keptPlayer.id);
            console.log(`📋 Mapping deleted player ${deletedPlayer.id} (${deletedPlayer.name}) -> kept player ${keptPlayer.id} (${keptPlayer.name})`);
          });
        }
      }
    });

    console.log(`📊 Found ${playerMapping.size} player ID mappings to update`);

    if (playerMapping.size === 0) {
      console.log('✅ No player mappings found. Nothing to update.');
      return;
    }

    // Step 2: Update Teams collection
    console.log('\n🏏 Updating Teams collection...');
    await updateTeamsCollection(playerMapping);

    // Step 3: Update Matches collection and subcollections
    console.log('\n🏏 Updating Matches collection and subcollections...');
    await updateMatchesCollection(playerMapping);

    // Step 4: Update Team Lineups collection
    console.log('\n🏏 Updating Team Lineups collection...');
    await updateTeamLineupsCollection(playerMapping);

    console.log('\n✅ Player reference update completed!');

  } catch (error) {
    console.error('❌ Error during player reference update:', error);
    throw error;
  }
}

async function updateTeamsCollection(playerMapping) {
  const teamsSnapshot = await collections.teams.get();
  let teamsUpdated = 0;

  for (const teamDoc of teamsSnapshot.docs) {
    const teamData = teamDoc.data();
    let needsUpdate = false;

    // Update captainId reference
    if (teamData.captainId && playerMapping.has(teamData.captainId)) {
      needsUpdate = true;
      console.log(`   Team ${teamDoc.id}: Updating captainId ${teamData.captainId} -> ${playerMapping.get(teamData.captainId)}`);
      teamData.captainId = playerMapping.get(teamData.captainId);
    }

    if (needsUpdate) {
      await collections.teams.doc(teamDoc.id).update(teamData);
      teamsUpdated++;
    }
  }

  console.log(`✅ Updated ${teamsUpdated} team documents`);
}

async function updateMatchesCollection(playerMapping) {
  const matchesSnapshot = await collections.matches.get();
  let matchesUpdated = 0;
  let inningsUpdated = 0;

  for (const matchDoc of matchesSnapshot.docs) {
    const matchData = matchDoc.data();
    let matchNeedsUpdate = false;

    // Update teamA and teamB player references
    ['teamA', 'teamB'].forEach(teamKey => {
      if (matchData[teamKey] && matchData[teamKey].players) {
        matchData[teamKey].players = matchData[teamKey].players.map(playerRef => {
          if (typeof playerRef === 'string' && playerMapping.has(playerRef)) {
            matchNeedsUpdate = true;
            console.log(`   Match ${matchDoc.id}: Updating ${teamKey} player reference ${playerRef} -> ${playerMapping.get(playerRef)}`);
            return playerMapping.get(playerRef);
          }
          return playerRef;
        });
      }
    });

    if (matchNeedsUpdate) {
      await collections.matches.doc(matchDoc.id).update(matchData);
      matchesUpdated++;
    }

    // Update innings subcollections
    const inningsRef = collections.matches.doc(matchDoc.id).collection('innings');
    const inningsSnapshot = await inningsRef.get();

    for (const inningsDoc of inningsSnapshot.docs) {
      // Update batsmen subcollection
      const batsmenRef = inningsRef.doc(inningsDoc.id).collection('batsmen');
      const batsmenSnapshot = await batsmenRef.get();

      for (const batsmanDoc of batsmenSnapshot.docs) {
        const batsmanData = batsmanDoc.data();
        if (batsmanData.player && playerMapping.has(batsmanData.player)) {
          console.log(`   Match ${matchDoc.id}, Innings ${inningsDoc.id}, Batsman ${batsmanDoc.id}: Updating player ${batsmanData.player} -> ${playerMapping.get(batsmanData.player)}`);
          await batsmenRef.doc(batsmanDoc.id).update({
            player: playerMapping.get(batsmanData.player)
          });
          inningsUpdated++;
        }
      }

      // Update bowling subcollection
      const bowlingRef = inningsRef.doc(inningsDoc.id).collection('bowling');
      const bowlingSnapshot = await bowlingRef.get();

      for (const bowlerDoc of bowlingSnapshot.docs) {
        const bowlerData = bowlerDoc.data();
        if (bowlerData.player && playerMapping.has(bowlerData.player)) {
          console.log(`   Match ${matchDoc.id}, Innings ${inningsDoc.id}, Bowler ${bowlerDoc.id}: Updating player ${bowlerData.player} -> ${playerMapping.get(bowlerData.player)}`);
          await bowlingRef.doc(bowlerDoc.id).update({
            player: playerMapping.get(bowlerData.player)
          });
          inningsUpdated++;
        }
      }
    }
  }

  console.log(`✅ Updated ${matchesUpdated} match documents and ${inningsUpdated} innings documents`);
}

async function updateTeamLineupsCollection(playerMapping) {
  const teamLineupsSnapshot = await collections.teamLineups.get();
  let lineupsUpdated = 0;

  for (const lineupDoc of teamLineupsSnapshot.docs) {
    const lineupData = lineupDoc.data();
    let needsUpdate = false;

    // Update playerIds array
    if (lineupData.playerIds && Array.isArray(lineupData.playerIds)) {
      lineupData.playerIds = lineupData.playerIds.map(playerId => {
        if (playerMapping.has(playerId)) {
          needsUpdate = true;
          console.log(`   Team Lineup ${lineupDoc.id}: Updating playerId ${playerId} -> ${playerMapping.get(playerId)}`);
          return playerMapping.get(playerId);
        }
        return playerId;
      });
    }

    // Update playingXI array
    if (lineupData.playingXI && Array.isArray(lineupData.playingXI)) {
      lineupData.playingXI = lineupData.playingXI.map(playerId => {
        if (playerMapping.has(playerId)) {
          needsUpdate = true;
          console.log(`   Team Lineup ${lineupDoc.id}: Updating playingXI player ${playerId} -> ${playerMapping.get(playerId)}`);
          return playerMapping.get(playerId);
        }
        return playerId;
      });
    }

    if (needsUpdate) {
      await collections.teamLineups.doc(lineupDoc.id).update(lineupData);
      lineupsUpdated++;
    }
  }

  console.log(`✅ Updated ${lineupsUpdated} team lineup documents`);
}

// Run the reference update if this script is executed directly
if (require.main === module) {
  updatePlayerReferences()
    .then(() => {
      console.log('🎉 Player reference update script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Player reference update script failed:', error);
      process.exit(1);
    });
}

module.exports = { updatePlayerReferences };