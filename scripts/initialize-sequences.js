const { collections } = require('../config/database');
const { sequenceManager } = require('../utils/sequenceManager');

/**
 * Initialize sequences for existing data
 * This script should be run once to set up numeric IDs for existing records
 */
async function initializeSequences() {
  try {
    console.log('Initializing sequences for existing data...');

    // Initialize sequences for matches
    const matchesSnapshot = await collections.matches.get();
    if (!matchesSnapshot.empty) {
      let maxMatchId = 0;
      matchesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.numericId && data.numericId > maxMatchId) {
          maxMatchId = data.numericId;
        }
      });

      await sequenceManager.initializeSequence('matches', maxMatchId);
      console.log(`Initialized matches sequence at ${maxMatchId}`);
    } else {
      await sequenceManager.initializeSequence('matches', 0);
      console.log('Initialized matches sequence at 0');
    }

    // Initialize sequences for teams
    const teamsSnapshot = await collections.teams.get();
    if (!teamsSnapshot.empty) {
      let maxTeamId = 0;
      teamsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.numericId && data.numericId > maxTeamId) {
          maxTeamId = data.numericId;
        }
      });

      await sequenceManager.initializeSequence('teams', maxTeamId);
      console.log(`Initialized teams sequence at ${maxTeamId}`);
    } else {
      await sequenceManager.initializeSequence('teams', 0);
      console.log('Initialized teams sequence at 0');
    }

    // Initialize sequences for players
    const playersSnapshot = await collections.players.get();
    if (!playersSnapshot.empty) {
      let maxPlayerId = 0;
      playersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.numericId && data.numericId > maxPlayerId) {
          maxPlayerId = data.numericId;
        }
      });

      await sequenceManager.initializeSequence('players', maxPlayerId);
      console.log(`Initialized players sequence at ${maxPlayerId}`);
    } else {
      await sequenceManager.initializeSequence('players', 0);
      console.log('Initialized players sequence at 0');
    }

    // Initialize sequences for teamLineups
    const teamLineupsSnapshot = await collections.teamLineups.get();
    if (!teamLineupsSnapshot.empty) {
      let maxTeamLineupId = 0;
      teamLineupsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.numericId && data.numericId > maxTeamLineupId) {
          maxTeamLineupId = data.numericId;
        }
      });

      await sequenceManager.initializeSequence('teamLineups', maxTeamLineupId);
      console.log(`Initialized teamLineups sequence at ${maxTeamLineupId}`);
    } else {
      await sequenceManager.initializeSequence('teamLineups', 0);
      console.log('Initialized teamLineups sequence at 0');
    }

    // Initialize sequences for users
    const usersSnapshot = await collections.users.get();
    if (!usersSnapshot.empty) {
      let maxUserId = 0;
      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.numericId && data.numericId > maxUserId) {
          maxUserId = data.numericId;
        }
      });

      await sequenceManager.initializeSequence('users', maxUserId);
      console.log(`Initialized users sequence at ${maxUserId}`);
    } else {
      await sequenceManager.initializeSequence('users', 0);
      console.log('Initialized users sequence at 0');
    }
  } catch (error) {
    console.error('Error initializing sequences:', error);
    throw error;
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeSequences()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeSequences };