const { TeamStatisticsManager } = require('../utils/teamStatisticsManager');

/**
 * Script to recalculate all team statistics
 * Run this after major data changes or to initialize statistics
 */
async function recalculateStats() {
  try {
    console.log('Starting team statistics recalculation...');
    await TeamStatisticsManager.recalculateAllTeamStatistics();
    console.log('Team statistics recalculation completed successfully!');
  } catch (error) {
    console.error('Failed to recalculate team statistics:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  recalculateStats();
}

module.exports = { recalculateStats };