const { generateCustomId } = require('./id-generator');

/**
 * Data Validator class for business logic validation
 */
class DataValidator {
  constructor() {
    this.validationRules = {
      teams: this.validateTeam.bind(this),
      players: this.validatePlayer.bind(this),
      matches: this.validateMatch.bind(this),
      matchSquads: this.validateMatchSquad.bind(this),
      innings: this.validateInnings.bind(this),
      playerMatchStats: this.validatePlayerMatchStats.bind(this),
      tournaments: this.validateTournament.bind(this),
      tournamentTeams: this.validateTournamentTeam.bind(this)
    };
  }

  /**
   * Main validation method that checks business rules
   * @param {Object} data - The data to validate
   * @param {string} collection - The collection name
   * @returns {Object} Validation result with isValid and errors
   */
  validateBusinessRules(data, collection) {
    const errors = [];

    if (this.validationRules[collection]) {
      const ruleErrors = this.validationRules[collection](data);
      errors.push(...ruleErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate team business rules
   */
  validateTeam(team) {
    const errors = [];

    // Team must have a name
    if (!team.name || team.name.trim().length === 0) {
      errors.push('Team name is required');
    }

    // Team must have a short name
    if (!team.shortName || team.shortName.trim().length === 0) {
      errors.push('Team short name is required');
    }

    // Captain must be an object with playerId
    if (!team.captain || typeof team.captain !== 'object' || !team.captain.playerId) {
      errors.push('Team captain must be an object with playerId');
    }

    // Vice captain must be an object with playerId
    if (!team.viceCaptain || typeof team.viceCaptain !== 'object' || !team.viceCaptain.playerId) {
      errors.push('Team vice captain must be an object with playerId');
    }

    // Players array should exist
    if (!Array.isArray(team.players)) {
      errors.push('Team players must be an array');
    }

    return errors;
  }

  /**
   * Validate player business rules
   */
  validatePlayer(player) {
    const errors = [];

    // Player must have a name
    if (!player.name || player.name.trim().length === 0) {
      errors.push('Player name is required');
    }

    // Player must have a role
    if (!player.role || player.role.trim().length === 0) {
      errors.push('Player role is required');
    }

    // Role must be valid
    const validRoles = ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'];
    if (!validRoles.includes(player.role)) {
      errors.push(`Player role must be one of: ${validRoles.join(', ')}`);
    }

    // Batting style should be valid if provided
    if (player.battingStyle) {
      const validBattingStyles = ['Left-handed', 'Right-handed'];
      if (!validBattingStyles.includes(player.battingStyle)) {
        errors.push(`Batting style must be one of: ${validBattingStyles.join(', ')}`);
      }
    }

    // Bowling style should be valid if provided
    if (player.bowlingStyle) {
      const validBowlingStyles = [
        'Left-arm fast', 'Left-arm medium', 'Left-arm spin',
        'Right-arm fast', 'Right-arm medium', 'Right-arm spin'
      ];
      if (!validBowlingStyles.includes(player.bowlingStyle)) {
        errors.push(`Bowling style must be one of: ${validBowlingStyles.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Validate match business rules
   */
  validateMatch(match) {
    const errors = [];

    // Match must have tournament info
    if (!match.tournamentName || match.tournamentName.trim().length === 0) {
      errors.push('Match tournament name is required');
    }

    // Match must have venue
    if (!match.venue || match.venue.trim().length === 0) {
      errors.push('Match venue is required');
    }

    // Match must have valid status
    const validStatuses = ['scheduled', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(match.status)) {
      errors.push(`Match status must be one of: ${validStatuses.join(', ')}`);
    }

    // Team squads must be properly structured
    if (!match.team1Squad || typeof match.team1Squad !== 'object') {
      errors.push('Team 1 squad information is required');
    }

    if (!match.team2Squad || typeof match.team2Squad !== 'object') {
      errors.push('Team 2 squad information is required');
    }

    // Toss information must be valid
    if (!match.toss || typeof match.toss !== 'object') {
      errors.push('Toss information is required');
    } else {
      const validDecisions = ['bat', 'bowl'];
      if (!validDecisions.includes(match.toss.decision)) {
        errors.push(`Toss decision must be one of: ${validDecisions.join(', ')}`);
      }
    }

    // Result information structure
    if (!match.result || typeof match.result !== 'object') {
      errors.push('Result information is required');
    } else {
      const validResultTypes = ['normal', 'tie', 'abandoned'];
      if (!validResultTypes.includes(match.result.resultType)) {
        errors.push(`Result type must be one of: ${validResultTypes.join(', ')}`);
      }
    }

    // Players array must exist and be valid
    if (!Array.isArray(match.players)) {
      errors.push('Match players must be an array');
    } else {
      match.players.forEach((player, index) => {
        if (!player.playerId || !player.player || !player.batting || !player.bowling || !player.fielding) {
          errors.push(`Player at index ${index} is missing required fields`);
        }
      });
    }

    return errors;
  }

  /**
   * Validate match squad business rules
   */
  validateMatchSquad(squad) {
    const errors = [];

    // Squad must have team ID
    if (!squad.teamId) {
      errors.push('Match squad team ID is required');
    }

    // Squad must have team name
    if (!squad.teamName || squad.teamName.trim().length === 0) {
      errors.push('Match squad team name is required');
    }

    // Squad must have captain
    if (!squad.captain || typeof squad.captain !== 'object' || !squad.captain.playerId) {
      errors.push('Match squad captain must be an object with playerId');
    }

    // Squad must have vice captain
    if (!squad.viceCaptain || typeof squad.viceCaptain !== 'object' || !squad.viceCaptain.playerId) {
      errors.push('Match squad vice captain must be an object with playerId');
    }

    // Players array must exist
    if (!Array.isArray(squad.players)) {
      errors.push('Match squad players must be an array');
    }

    return errors;
  }

  /**
   * Validate innings business rules
   */
  validateInnings(innings) {
    const errors = [];

    // Innings must have match ID
    if (!innings.matchId) {
      errors.push('Innings match ID is required');
    }

    // Innings must have team ID
    if (!innings.teamId) {
      errors.push('Innings team ID is required');
    }

    // Innings number must be valid
    if (!innings.inningsNumber || innings.inningsNumber < 1 || innings.inningsNumber > 2) {
      errors.push('Innings number must be 1 or 2');
    }

    // Scores must be non-negative
    if (innings.totalRuns < 0) {
      errors.push('Total runs cannot be negative');
    }

    if (innings.totalWickets < 0 || innings.totalWickets > 10) {
      errors.push('Total wickets must be between 0 and 10');
    }

    if (innings.totalOvers < 0) {
      errors.push('Total overs cannot be negative');
    }

    return errors;
  }

  /**
   * Validate player match stats business rules
   */
  validatePlayerMatchStats(stats) {
    const errors = [];

    // Stats must have player ID
    if (!stats.playerId) {
      errors.push('Player match stats player ID is required');
    }

    // Stats must have match ID
    if (!stats.matchId) {
      errors.push('Player match stats match ID is required');
    }

    // Batting stats must be valid
    if (stats.batting) {
      if (stats.batting.runs < 0) errors.push('Batting runs cannot be negative');
      if (stats.batting.balls < 0) errors.push('Batting balls cannot be negative');
      if (stats.batting.fours < 0) errors.push('Batting fours cannot be negative');
      if (stats.batting.sixes < 0) errors.push('Batting sixes cannot be negative');
    }

    // Bowling stats must be valid
    if (stats.bowling) {
      if (stats.bowling.wickets < 0) errors.push('Bowling wickets cannot be negative');
      if (stats.bowling.runs < 0) errors.push('Bowling runs cannot be negative');
      if (stats.bowling.overs < 0) errors.push('Bowling overs cannot be negative');
    }

    // Fielding stats must be valid
    if (stats.fielding) {
      if (stats.fielding.catches < 0) errors.push('Fielding catches cannot be negative');
      if (stats.fielding.runOuts < 0) errors.push('Fielding run outs cannot be negative');
      if (stats.fielding.stumpings < 0) errors.push('Fielding stumpings cannot be negative');
    }

    return errors;
  }

  /**
   * Validate tournament business rules
   */
  validateTournament(tournament) {
    const errors = [];

    // Tournament must have a name
    if (!tournament.name || tournament.name.trim().length === 0) {
      errors.push('Tournament name is required');
    }

    // Tournament must have valid format
    const validFormats = ['T20', 'ODI', 'Test', 'Box Cricket'];
    if (!validFormats.includes(tournament.format)) {
      errors.push(`Tournament format must be one of: ${validFormats.join(', ')}`);
    }

    return errors;
  }

  /**
   * Validate tournament team business rules
   */
  validateTournamentTeam(tournamentTeam) {
    const errors = [];

    // Must have tournament ID
    if (!tournamentTeam.tournamentId) {
      errors.push('Tournament team tournament ID is required');
    }

    // Must have team ID
    if (!tournamentTeam.teamId) {
      errors.push('Tournament team team ID is required');
    }

    return errors;
  }
}

module.exports = { DataValidator };