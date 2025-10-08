const { collections } = require('../config/database');

/**
 * Utility to build and maintain local mappings of IDs to names/details
 * This creates a cache that can be used throughout the application
 */
class DataMappingsCache {
  constructor() {
    this.teams = new Map(); // numericId -> { id, name, shortName }
    this.players = new Map(); // numericId -> { id, name, teamId, teamName }
    this.matches = new Map(); // numericId -> { id, title, team1, team2 }
    this.lastUpdated = null;
  }

  /**
   * Load all mappings from the database
   */
  async loadMappings() {
    console.log('🔄 Loading data mappings cache...');

    try {
      // Load teams
      const teamsSnapshot = await collections.teams.get();
      this.teams.clear();
      for (const doc of teamsSnapshot.docs) {
        const data = doc.data();
        this.teams.set(data.numericId, {
          id: data.numericId,
          name: data.name,
          shortName: data.shortName || data.name.substring(0, 3).toUpperCase()
        });
      }

      // Load players
      const playersSnapshot = await collections.players.get();
      this.players.clear();
      for (const doc of playersSnapshot.docs) {
        const data = doc.data();
        const team = this.teams.get(data.teamId);
        this.players.set(data.numericId, {
          id: data.numericId,
          name: data.name,
          teamId: data.teamId,
          teamName: team ? team.name : 'Unknown Team'
        });
      }

      // Load matches
      const matchesSnapshot = await collections.matches.get();
      this.matches.clear();
      for (const doc of matchesSnapshot.docs) {
        const data = doc.data();
        const team1 = this.teams.get(data.team1Id);
        const team2 = this.teams.get(data.team2Id);
        this.matches.set(data.numericId, {
          id: data.numericId,
          title: data.title,
          team1: team1 ? team1.name : 'Unknown Team',
          team2: team2 ? team2.name : 'Unknown Team'
        });
      }

      this.lastUpdated = new Date();
      console.log(`✅ Loaded mappings: ${this.teams.size} teams, ${this.players.size} players, ${this.matches.size} matches`);

    } catch (error) {
      console.error('❌ Error loading mappings:', error);
    }
  }

  /**
   * Get team details by numericId
   */
  getTeam(numericId) {
    return this.teams.get(numericId) || null;
  }

  /**
   * Get player details by numericId
   */
  getPlayer(numericId) {
    return this.players.get(numericId) || null;
  }

  /**
   * Get match details by numericId
   */
  getMatch(numericId) {
    return this.matches.get(numericId) || null;
  }

  /**
   * Get all teams
   */
  getAllTeams() {
    return Array.from(this.teams.values());
  }

  /**
   * Get all players
   */
  getAllPlayers() {
    return Array.from(this.players.values());
  }

  /**
   * Get all matches
   */
  getAllMatches() {
    return Array.from(this.matches.values());
  }

  /**
   * Check if mappings are stale (older than 5 minutes)
   */
  isStale() {
    if (!this.lastUpdated) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return (new Date() - this.lastUpdated) > fiveMinutes;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      teams: this.teams.size,
      players: this.players.size,
      matches: this.matches.size,
      lastUpdated: this.lastUpdated
    };
  }
}

// Create singleton instance
const dataMappingsCache = new DataMappingsCache();

module.exports = {
  DataMappingsCache,
  dataMappingsCache
};