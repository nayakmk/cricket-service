/**
 * COMPREHENSIVE DATA VALIDATION SCRIPT
 *
 * Validates that all backreferences across collections use numericIds only
 * Ensures data integrity and consistency throughout the database
 */

const { db, collections } = require('../config/database');

class DataValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Run complete data validation
   */
  async runValidation() {
    console.log('🚀 Starting comprehensive data validation...');

    try {
      // Validate team match history
      console.log('📊 Validating team match history...');
      await this.validateTeamMatchHistory();

      // Validate team best players
      console.log('🏏 Validating team best players...');
      await this.validateTeamBestPlayers();

      // Validate team statistics
      console.log('📈 Validating team statistics...');
      await this.validateTeamStatistics();

      // Validate player references
      console.log('👤 Validating player references...');
      await this.validatePlayerReferences();

      // Validate match references
      console.log('🎯 Validating match references...');
      await this.validateMatchReferences();

      // Generate validation report
      this.generateReport();

    } catch (error) {
      console.error('❌ Error during validation:', error);
      this.errors.push(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Validate team match history uses numericIds
   */
  async validateTeamMatchHistory() {
    const teamsSnapshot = await collections.teams.get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamName = teamData.name;

      if (teamData.matches && Array.isArray(teamData.matches)) {
        for (const match of teamData.matches) {
          // Check match_id is numeric
          if (typeof match.match_id !== 'number') {
            this.errors.push(`Team ${teamName}: match_id should be numeric, got ${typeof match.match_id} (${match.match_id})`);
          }

          // Check winner_id is numeric or null
          if (match.winner_id !== null && typeof match.winner_id !== 'number') {
            this.errors.push(`Team ${teamName}: winner_id should be numeric or null, got ${typeof match.winner_id} (${match.winner_id})`);
          }
        }
      }
    }

    console.log(`✅ Validated match history for ${teamsSnapshot.size} teams`);
  }

  /**
   * Validate team best players use numericIds
   */
  async validateTeamBestPlayers() {
    const teamsSnapshot = await collections.teams.get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamName = teamData.name;

      if (teamData.bestPlayers) {
        const bestPlayers = teamData.bestPlayers;

        // Check each best player position
        const positions = ['batsman', 'bowler', 'allRounder', 'wicketKeeper'];
        for (const position of positions) {
          const player = bestPlayers[position];
          if (player && player.id) {
            if (typeof player.id !== 'string') {
              this.errors.push(`Team ${teamName}: bestPlayers.${position}.id should be string (document ID), got ${typeof player.id}`);
            }
            // Note: bestPlayers should reference player document IDs, not numericIds
            // This is correct as bestPlayers are direct references to player documents
          }
        }
      } else {
        this.warnings.push(`Team ${teamName}: missing bestPlayers data`);
      }
    }

    console.log(`✅ Validated best players for ${teamsSnapshot.size} teams`);
  }

  /**
   * Validate team statistics integrity
   */
  async validateTeamStatistics() {
    const teamsSnapshot = await collections.teams.get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamName = teamData.name;

      if (teamData.statistics) {
        const stats = teamData.statistics;

        // Check required statistics fields
        const requiredFields = ['totalMatches', 'wins', 'losses', 'winPercentage'];
        for (const field of requiredFields) {
          if (typeof stats[field] !== 'number') {
            this.errors.push(`Team ${teamName}: statistics.${field} should be number, got ${typeof stats[field]}`);
          }
        }

        // Validate win percentage calculation
        if (stats.totalMatches > 0) {
          const expectedWinPercentage = (stats.wins / stats.totalMatches) * 100;
          if (Math.abs(stats.winPercentage - expectedWinPercentage) > 0.1) {
            this.errors.push(`Team ${teamName}: winPercentage mismatch. Expected: ${expectedWinPercentage.toFixed(2)}, Got: ${stats.winPercentage.toFixed(2)}`);
          }
        }
      } else {
        this.warnings.push(`Team ${teamName}: missing statistics data`);
      }
    }

    console.log(`✅ Validated statistics for ${teamsSnapshot.size} teams`);
  }

  /**
   * Validate player references and data integrity
   */
  async validatePlayerReferences() {
    const playersSnapshot = await collections.players.get();

    for (const playerDoc of playersSnapshot.docs) {
      const playerData = playerDoc.data();
      const playerName = playerData.name;

      // Check numericId exists and is number
      if (typeof playerData.numericId !== 'number') {
        this.errors.push(`Player ${playerName}: numericId should be number, got ${typeof playerData.numericId}`);
      }

      // Check team references use numericIds
      if (playerData.teamIds && Array.isArray(playerData.teamIds)) {
        for (const teamId of playerData.teamIds) {
          if (typeof teamId !== 'number') {
            this.errors.push(`Player ${playerName}: teamIds should contain numericIds, got ${typeof teamId} (${teamId})`);
          }
        }
      }
    }

    console.log(`✅ Validated ${playersSnapshot.size} players`);
  }

  /**
   * Validate match references use numericIds
   */
  async validateMatchReferences() {
    const matchesSnapshot = await collections.matches.get();

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const matchId = matchData.numericId || matchDoc.id;

      // Check numericId exists
      if (typeof matchData.numericId !== 'number') {
        this.errors.push(`Match ${matchId}: numericId should be number, got ${typeof matchData.numericId}`);
      }

      // Check team references are numericIds
      if (typeof matchData.team1Id !== 'number') {
        this.errors.push(`Match ${matchId}: team1Id should be numericId, got ${typeof matchData.team1Id} (${matchData.team1Id})`);
      }

      if (typeof matchData.team2Id !== 'number') {
        this.errors.push(`Match ${matchId}: team2Id should be numericId, got ${typeof matchData.team2Id} (${matchData.team2Id})`);
      }

      // Validate innings references
      const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').get();
      for (const inningDoc of inningsSnapshot.docs) {
        const inningData = inningDoc.data();

        // Check batting team reference
        if (inningData.battingTeamId && typeof inningData.battingTeamId !== 'number') {
          this.errors.push(`Match ${matchId} Inning: battingTeamId should be numericId, got ${typeof inningData.battingTeamId}`);
        }

        // Check player references in batsmen
        if (inningData.batsmen && Array.isArray(inningData.batsmen)) {
          for (const batsman of inningData.batsmen) {
            if (batsman.playerId && typeof batsman.playerId !== 'string') {
              this.errors.push(`Match ${matchId} Batsman: playerId should be string (document ID), got ${typeof batsman.playerId}`);
            }
          }
        }

        // Check player references in bowling
        if (inningData.bowling && Array.isArray(inningData.bowling)) {
          for (const bowler of inningData.bowling) {
            if (bowler.playerId && typeof bowler.playerId !== 'string') {
              this.errors.push(`Match ${matchId} Bowler: playerId should be string (document ID), got ${typeof bowler.playerId}`);
            }
          }
        }
      }
    }

    console.log(`✅ Validated ${matchesSnapshot.size} matches`);
  }

  /**
   * Generate validation report
   */
  generateReport() {
    console.log('\n📋 VALIDATION REPORT');
    console.log('==================');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed! Data integrity is maintained.');
      return;
    }

    if (this.errors.length > 0) {
      console.log(`❌ ${this.errors.length} ERRORS found:`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  ${this.warnings.length} WARNINGS:`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n🔧 CRITICAL: Data integrity issues found. Please fix before proceeding.');
      process.exit(1);
    } else {
      console.log('\n✅ No critical errors. Warnings indicate missing optional data.');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DataValidator();
  validator.runValidation().catch(console.error);
}

module.exports = { DataValidator };