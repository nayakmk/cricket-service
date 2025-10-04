const { collections, db } = require('../config/database');
const { sequenceManager } = require('../utils/sequenceManager');

/**
 * Comprehensive migration script to update all existing documents with new formatted IDs
 * WARNING: This is extremely risky and could break the entire application
 * Make sure to backup all data before running this script
 */
async function migrateAllDocuments() {
  console.log('🚨 WARNING: This migration is extremely risky!');
  console.log('🚨 Make sure you have a complete backup before proceeding!');
  console.log('🚨 This will recreate ALL documents with new IDs and update ALL references\n');

  try {
    // Step 1: Migrate teams first (since other collections reference them)
    console.log('Step 1: Migrating teams...');
    const teamsMigration = await migrateCollection('teams');
    console.log(`✅ Teams migrated: ${teamsMigration.length} documents\n`);

    // Step 2: Migrate players (referenced by teamLineups and matches)
    console.log('Step 2: Migrating players...');
    const playersMigration = await migrateCollection('players');
    console.log(`✅ Players migrated: ${playersMigration.length} documents\n`);

    // Step 3: Migrate teamLineups (references teams and players)
    console.log('Step 3: Migrating teamLineups...');
    const teamLineupsMigration = await migrateCollection('teamLineups');
    console.log(`✅ TeamLineups migrated: ${teamLineupsMigration.length} documents\n`);

    // Step 4: Migrate matches (references teams)
    console.log('Step 4: Migrating matches...');
    const matchesMigration = await migrateCollection('matches');
    console.log(`✅ Matches migrated: ${matchesMigration.length} documents\n`);

    // Step 5: Update all references
    console.log('Step 5: Updating all references...');
    await updateAllReferences(teamsMigration, playersMigration, teamLineupsMigration, matchesMigration);
    console.log('✅ All references updated\n');

    // Step 6: Clean up old documents
    console.log('Step 6: Cleaning up old documents...');
    await cleanupOldDocuments(teamsMigration, playersMigration, teamLineupsMigration, matchesMigration);
    console.log('✅ Old documents cleaned up\n');

    console.log('🎉 Migration completed successfully!');
    console.log('📊 Summary:');
    console.log(`   Teams: ${teamsMigration.length} migrated`);
    console.log(`   Players: ${playersMigration.length} migrated`);
    console.log(`   TeamLineups: ${teamLineupsMigration.length} migrated`);
    console.log(`   Matches: ${matchesMigration.length} migrated`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n🔄 Attempting rollback...');
    // Note: Rollback would be very complex and is not implemented here
    throw error;
  }
}

/**
 * Migrate a single collection
 */
async function migrateCollection(collectionName) {
  const collection = collections[collectionName];
  const snapshot = await collection.get();

  const migrations = [];

  for (const doc of snapshot.docs) {
    const oldId = doc.id;
    const data = doc.data();

    // Generate new document ID
    const newId = await sequenceManager.generateDocumentId(collectionName);

    // Create new document with new ID
    await collection.doc(newId).set({
      ...data,
      migratedAt: new Date().toISOString(),
      originalId: oldId
    });

    // Handle subcollections for matches
    if (collectionName === 'matches') {
      await migrateSubcollections(oldId, newId, collectionName);
    }

    migrations.push({ oldId, newId, collectionName });
    console.log(`   ${collectionName}: ${oldId} → ${newId}`);
  }

  return migrations;
}

/**
 * Migrate subcollections (like innings, balls for matches)
 */
async function migrateSubcollections(oldParentId, newParentId, parentCollection) {
  if (parentCollection === 'matches') {
    // Migrate innings subcollection
    const inningsSnapshot = await collections.matches.doc(oldParentId).collection('innings').get();

    for (const inningDoc of inningsSnapshot.docs) {
      const inningData = inningDoc.data();

      // Copy inning document
      await collections.matches.doc(newParentId).collection('innings').doc(inningDoc.id).set(inningData);

      // Migrate batsmen subcollection
      const batsmenSnapshot = await collections.matches.doc(oldParentId).collection('innings').doc(inningDoc.id).collection('batsmen').get();
      for (const batsmanDoc of batsmenSnapshot.docs) {
        await collections.matches.doc(newParentId).collection('innings').doc(inningDoc.id).collection('batsmen').doc(batsmanDoc.id).set(batsmanDoc.data());
      }

      // Migrate bowling subcollection
      const bowlingSnapshot = await collections.matches.doc(oldParentId).collection('innings').doc(inningDoc.id).collection('bowling').get();
      for (const bowlingDoc of bowlingSnapshot.docs) {
        await collections.matches.doc(newParentId).collection('innings').doc(inningDoc.id).collection('bowling').doc(bowlingDoc.id).set(bowlingDoc.data());
      }

      // Migrate fallOfWickets subcollection
      const fowSnapshot = await collections.matches.doc(oldParentId).collection('innings').doc(inningDoc.id).collection('fallOfWickets').get();
      for (const fowDoc of fowSnapshot.docs) {
        await collections.matches.doc(newParentId).collection('innings').doc(inningDoc.id).collection('fallOfWickets').doc(fowDoc.id).set(fowDoc.data());
      }
    }
  }
}

/**
 * Update all references between documents
 */
async function updateAllReferences(teamsMigration, playersMigration, teamLineupsMigration, matchesMigration) {
  const idMappings = {
    teams: Object.fromEntries(teamsMigration.map(m => [m.oldId, m.newId])),
    players: Object.fromEntries(playersMigration.map(m => [m.oldId, m.newId])),
    teamLineups: Object.fromEntries(teamLineupsMigration.map(m => [m.oldId, m.newId])),
    matches: Object.fromEntries(matchesMigration.map(m => [m.oldId, m.newId]))
  };

  // Update team references in matches
  for (const match of matchesMigration) {
    const matchDoc = await collections.matches.doc(match.newId).get();
    const matchData = matchDoc.data();

    const updatedData = { ...matchData };

    if (matchData.team1Id && idMappings.teams[matchData.team1Id]) {
      updatedData.team1Id = idMappings.teams[matchData.team1Id];
    }
    if (matchData.team2Id && idMappings.teams[matchData.team2Id]) {
      updatedData.team2Id = idMappings.teams[matchData.team2Id];
    }

    await collections.matches.doc(match.newId).update(updatedData);
  }

  // Update captain references in teams
  for (const team of teamsMigration) {
    const teamDoc = await collections.teams.doc(team.newId).get();
    const teamData = teamDoc.data();

    if (teamData.captainId && idMappings.players[teamData.captainId]) {
      await collections.teams.doc(team.newId).update({
        captainId: idMappings.players[teamData.captainId]
      });
    }
  }

  // Update team and player references in teamLineups
  for (const lineup of teamLineupsMigration) {
    const lineupDoc = await collections.teamLineups.doc(lineup.newId).get();
    const lineupData = lineupDoc.data();

    const updatedData = { ...lineupData };

    if (lineupData.teamId && idMappings.teams[lineupData.teamId]) {
      updatedData.teamId = idMappings.teams[lineupData.teamId];
    }

    if (lineupData.captain && idMappings.players[lineupData.captain]) {
      updatedData.captain = idMappings.players[lineupData.captain];
    }

    if (lineupData.wicketKeeper && idMappings.players[lineupData.wicketKeeper]) {
      updatedData.wicketKeeper = idMappings.players[lineupData.wicketKeeper];
    }

    if (lineupData.players && Array.isArray(lineupData.players)) {
      updatedData.players = lineupData.players.map(playerId =>
        idMappings.players[playerId] || playerId
      );
    }

    await collections.teamLineups.doc(lineup.newId).update(updatedData);
  }

  // Update player references in match subcollections
  for (const match of matchesMigration) {
    const inningsSnapshot = await collections.matches.doc(match.newId).collection('innings').get();

    for (const inningDoc of inningsSnapshot.docs) {
      const inningData = inningDoc.data();
      const updatedInningData = { ...inningData };

      // Update team references in innings
      if (inningData.battingTeam && idMappings.players[inningData.battingTeam]) {
        updatedInningData.battingTeam = idMappings.players[inningData.battingTeam];
      }
      if (inningData.bowlingTeam && idMappings.players[inningData.bowlingTeam]) {
        updatedInningData.bowlingTeam = idMappings.players[inningData.bowlingTeam];
      }

      await collections.matches.doc(match.newId).collection('innings').doc(inningDoc.id).update(updatedInningData);

      // Update player references in batsmen
      const batsmenSnapshot = await collections.matches.doc(match.newId).collection('innings').doc(inningDoc.id).collection('batsmen').get();
      for (const batsmanDoc of batsmenSnapshot.docs) {
        const batsmanData = batsmanDoc.data();
        if (batsmanData.player && idMappings.players[batsmanData.player]) {
          await collections.matches.doc(match.newId).collection('innings').doc(inningDoc.id).collection('batsmen').doc(batsmanDoc.id).update({
            player: idMappings.players[batsmanData.player]
          });
        }
      }

      // Update player references in bowling
      const bowlingSnapshot = await collections.matches.doc(match.newId).collection('innings').doc(inningDoc.id).collection('bowling').get();
      for (const bowlingDoc of bowlingSnapshot.docs) {
        const bowlingData = bowlingDoc.data();
        if (bowlingData.player && idMappings.players[bowlingData.player]) {
          await collections.matches.doc(match.newId).collection('innings').doc(inningDoc.id).collection('bowling').doc(bowlingDoc.id).update({
            player: idMappings.players[bowlingData.player]
          });
        }
      }

      // Update player references in fall of wickets
      const fowSnapshot = await collections.matches.doc(match.newId).collection('innings').doc(inningDoc.id).collection('fallOfWickets').get();
      for (const fowDoc of fowSnapshot.docs) {
        const fowData = fowDoc.data();
        if (fowData.playerOut && idMappings.players[fowData.playerOut]) {
          await collections.matches.doc(match.newId).collection('innings').doc(inningDoc.id).collection('fallOfWickets').doc(fowDoc.id).update({
            playerOut: idMappings.players[fowData.playerOut]
          });
        }
      }
    }
  }
}

/**
 * Clean up old documents after successful migration
 */
async function cleanupOldDocuments(teamsMigration, playersMigration, teamLineupsMigration, matchesMigration) {
  console.log('🧹 Cleaning up old documents...');

  // Delete old documents in reverse order (matches first, then dependencies)
  for (const match of matchesMigration) {
    await collections.matches.doc(match.oldId).delete();
    console.log(`   Deleted old match: ${match.oldId}`);
  }

  for (const lineup of teamLineupsMigration) {
    await collections.teamLineups.doc(lineup.oldId).delete();
    console.log(`   Deleted old teamLineup: ${lineup.oldId}`);
  }

  for (const player of playersMigration) {
    await collections.players.doc(player.oldId).delete();
    console.log(`   Deleted old player: ${player.oldId}`);
  }

  for (const team of teamsMigration) {
    await collections.teams.doc(team.oldId).delete();
    console.log(`   Deleted old team: ${team.oldId}`);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  console.log('🚨 CRITICAL WARNING 🚨');
  console.log('This migration will permanently change ALL document IDs in your database!');
  console.log('Make sure you have a complete backup before proceeding.');
  console.log('This operation CANNOT be undone!\n');

  // Add a delay to let user read the warning
  setTimeout(() => {
    migrateAllDocuments()
      .then(() => {
        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        console.log('\n🔄 You may need to restore from backup!');
        process.exit(1);
      });
  }, 3000);
}

module.exports = { migrateAllDocuments };