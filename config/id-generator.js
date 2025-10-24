const crypto = require('crypto');

/**
 * Generates a custom 19-digit ID for database entities
 * Format: timestamp (13 digits) + random (6 digits)
 * @param {string} entityType - The type of entity (e.g., 'players', 'teams')
 * @returns {string} 19-digit ID
 */
function generateCustomId(entityType) {
  const timestamp = Date.now().toString();
  const random = crypto.randomInt(100000, 999999).toString();
  return timestamp + random;
}

/**
 * Generates a display ID for user-friendly reference
 * Format: ENTITY-TIMESTAMP-RANDOM
 * @param {string} entityType - The type of entity
 * @returns {string} Display ID
 */
function generateDisplayId(entityType) {
  const prefix = entityType.toUpperCase().slice(0, 3);
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = crypto.randomInt(100, 999).toString();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * ID generators for different entity types
 */
const idGenerators = {
  players: () => generateCustomId('players'),
  teams: () => generateCustomId('teams'),
  matches: () => generateCustomId('matches'),
  matchSquads: () => generateCustomId('matchSquads'),
  innings: () => generateCustomId('innings'),
  tournamentTeams: () => generateCustomId('tournamentTeams'),
  playerMatchStats: () => generateCustomId('playerMatchStats'),
  tournaments: () => generateCustomId('tournaments')
};

/**
 * Display ID generators for different entity types
 */
const displayIdGenerators = {
  players: () => generateDisplayId('players'),
  teams: () => generateDisplayId('teams'),
  matches: () => generateDisplayId('matches'),
  matchSquads: () => generateDisplayId('matchSquads'),
  innings: () => generateDisplayId('innings'),
  tournamentTeams: () => generateDisplayId('tournamentTeams'),
  playerMatchStats: () => generateDisplayId('playerMatchStats'),
  tournaments: () => generateDisplayId('tournaments')
};

module.exports = {
  generateCustomId,
  generateDisplayId,
  idGenerators,
  displayIdGenerators
};