const { collections } = require('../config/database');
const { sequenceManager } = require('../utils/sequenceManager');

/**
 * Migration script to add numeric IDs to existing data
 * This script will update all existing documents that don't have numericId fields
 */
async function migrateExistingData() {
  try {
    console.log('Starting migration of existing data to add numeric IDs...');

    // Migrate matches
    console.log('Migrating matches...');
    const matchesSnapshot = await collections.matches.get();
    let matchSequence = 0;

    for (const doc of matchesSnapshot.docs) {
      const data = doc.data();
      if (!data.numericId) {
        matchSequence++;
        await collections.matches.doc(doc.id).update({
          numericId: matchSequence,
          updatedAt: new Date().toISOString()
        });
        console.log(`Updated match ${doc.id} with numericId: ${matchSequence}`);
      } else {
        matchSequence = Math.max(matchSequence, data.numericId);
      }
    }

    if (matchSequence > 0) {
      await sequenceManager.initializeSequence('matches', matchSequence);
      console.log(`Updated matches sequence to ${matchSequence}`);
    }

    // Migrate teams
    console.log('Migrating teams...');
    const teamsSnapshot = await collections.teams.get();
    let teamSequence = 0;

    for (const doc of teamsSnapshot.docs) {
      const data = doc.data();
      if (!data.numericId) {
        teamSequence++;
        await collections.teams.doc(doc.id).update({
          numericId: teamSequence,
          updatedAt: new Date().toISOString()
        });
        console.log(`Updated team ${doc.id} with numericId: ${teamSequence}`);
      } else {
        teamSequence = Math.max(teamSequence, data.numericId);
      }
    }

    if (teamSequence > 0) {
      await sequenceManager.initializeSequence('teams', teamSequence);
      console.log(`Updated teams sequence to ${teamSequence}`);
    }

    // Migrate players
    console.log('Migrating players...');
    const playersSnapshot = await collections.players.get();
    let playerSequence = 0;

    for (const doc of playersSnapshot.docs) {
      const data = doc.data();
      if (!data.numericId) {
        playerSequence++;
        await collections.players.doc(doc.id).update({
          numericId: playerSequence,
          updatedAt: new Date().toISOString()
        });
        console.log(`Updated player ${doc.id} with numericId: ${playerSequence}`);
      } else {
        playerSequence = Math.max(playerSequence, data.numericId);
      }
    }

    if (playerSequence > 0) {
      await sequenceManager.initializeSequence('players', playerSequence);
      console.log(`Updated players sequence to ${playerSequence}`);
    }

    // Migrate teamLineups
    console.log('Migrating teamLineups...');
    const teamLineupsSnapshot = await collections.teamLineups.get();
    let teamLineupSequence = 0;

    for (const doc of teamLineupsSnapshot.docs) {
      const data = doc.data();
      if (!data.numericId) {
        teamLineupSequence++;
        await collections.teamLineups.doc(doc.id).update({
          numericId: teamLineupSequence,
          updatedAt: new Date().toISOString()
        });
        console.log(`Updated teamLineup ${doc.id} with numericId: ${teamLineupSequence}`);
      } else {
        teamLineupSequence = Math.max(teamLineupSequence, data.numericId);
      }
    }

    if (teamLineupSequence > 0) {
      await sequenceManager.initializeSequence('teamLineups', teamLineupSequence);
      console.log(`Updated teamLineups sequence to ${teamLineupSequence}`);
    }

    // Migrate users (if any exist)
    console.log('Migrating users...');
    const usersSnapshot = await collections.users.get();
    let userSequence = 0;

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (!data.numericId) {
        userSequence++;
        await collections.users.doc(doc.id).update({
          numericId: userSequence,
          updatedAt: new Date().toISOString()
        });
        console.log(`Updated user ${doc.id} with numericId: ${userSequence}`);
      } else {
        userSequence = Math.max(userSequence, data.numericId);
      }
    }

    if (userSequence > 0) {
      await sequenceManager.initializeSequence('users', userSequence);
      console.log(`Updated users sequence to ${userSequence}`);
    }

    console.log('Migration completed successfully!');
    console.log(`Summary:
- Matches: ${matchSequence} records updated
- Teams: ${teamSequence} records updated
- Players: ${playerSequence} records updated
- Team Lineups: ${teamLineupSequence} records updated
- Users: ${userSequence} records updated`);

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateExistingData()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateExistingData };