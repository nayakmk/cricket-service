const { TeamStatisticsManagerV2 } = require('./utils/teamStatisticsManagerV2');

/**
 * Script to recalculate all team statistics for v2 collections
 * This should be run after data migration or when statistics need to be rebuilt
 */
async function recalculateV2TeamStatistics() {
  try {
    console.log('Starting v2 team statistics recalculation...');

    await TeamStatisticsManagerV2.recalculateAllTeamStatistics();

    console.log('V2 team statistics recalculation completed successfully!');
  } catch (error) {
    console.error('Error during v2 team statistics recalculation:', error);
    process.exit(1);
  }
}

// Run the recalculation if this script is executed directly
if (require.main === module) {
  recalculateV2TeamStatistics();
}

module.exports = { recalculateV2TeamStatistics };