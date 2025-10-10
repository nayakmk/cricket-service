// Cricket App v2 - ID Generation Utilities
// Generates custom IDs for all v2 collections

const crypto = require('crypto');

/**
 * Generates a unique ID based on timestamp with random suffix
 * Format: 19-digit timestamp (YYYYMMDDHHMMSSmmm) + random padding
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} 19-digit unique ID
 */
function generateCustomId(prefix = '') {
  const now = new Date();

  // Create timestamp string: YYYYMMDDHHMMSSmmm (17 digits)
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0') +
    now.getMilliseconds().toString().padStart(3, '0');

  // Add random 2-digit suffix to ensure uniqueness (total 19 digits)
  const randomSuffix = crypto.randomInt(0, 100).toString().padStart(2, '0');

  return prefix + timestamp + randomSuffix;
}

/**
 * Generates display IDs for user-friendly reference
 * @param {string} collectionName - Name of the collection
 * @returns {number} Sequential display ID
 */
function generateDisplayId(collectionName) {
  // In a real implementation, this would query the database
  // for the highest existing displayId and increment it
  // For now, we'll use a simple counter based on collection
  const counters = {
    players: 1,
    teams: 1,
    matches: 101,
    matchSquads: 201,
    innings: 301,
    tournamentTeams: 401,
    playerMatchStats: 501,
    tournaments: 601
  };

  return counters[collectionName] || 1;
}

/**
 * Generates specific IDs for different entity types
 */
const idGenerators = {
  playerId: () => generateCustomId('2'),
  teamId: () => generateCustomId('2'),
  matchId: () => generateCustomId('1'),
  tournamentId: () => generateCustomId('2'),
  inningsId: () => generateCustomId('3'),
  tournamentTeamId: () => generateCustomId('4'),
  playerMatchStatsId: () => generateCustomId('5'),
  matchSquadId: (teamId, matchId) => `${teamId}_${matchId}`
};

/**
 * Validates ID format
 * @param {string} id - ID to validate
 * @param {string} type - Type of ID (playerId, teamId, etc.)
 * @returns {boolean} True if valid
 */
function validateId(id, type) {
  const patterns = {
    playerId: /^\d{19}$/,
    teamId: /^\d{19}$/,
    matchId: /^\d{19}$/,
    tournamentId: /^\d{19}$/,
    inningsId: /^\d{19}$/,
    tournamentTeamId: /^\d{19}$/,
    playerMatchStatsId: /^\d{19}$/,
    matchSquadId: /^\d{19}_\d{19}$/
  };

  return patterns[type] ? patterns[type].test(id) : false;
}

/**
 * Extracts timestamp from custom ID
 * @param {string} id - Custom ID
 * @returns {Date} Date object
 */
function extractTimestampFromId(id) {
  // Extract first 17 digits (timestamp part)
  const timestampStr = id.substring(0, 17);
  const year = parseInt(timestampStr.substring(0, 4));
  const month = parseInt(timestampStr.substring(4, 6)) - 1; // JS months are 0-based
  const day = parseInt(timestampStr.substring(6, 8));
  const hour = parseInt(timestampStr.substring(8, 10));
  const minute = parseInt(timestampStr.substring(10, 12));
  const second = parseInt(timestampStr.substring(12, 14));
  const millisecond = parseInt(timestampStr.substring(14, 17));

  return new Date(year, month, day, hour, minute, second, millisecond);
}

module.exports = {
  generateCustomId,
  generateDisplayId,
  idGenerators,
  validateId,
  extractTimestampFromId
};