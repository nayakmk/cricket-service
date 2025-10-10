// Cricket App v2 - Data Validation Utilities
// Provides guardrails for data integrity across all v2 collections

const { V2_SCHEMAS, validateDocument } = require('../config/database-v2');
const { validateId } = require('./id-generator');

/**
 * Enhanced validation with business logic rules
 */
class DataValidator {
  constructor() {
    this.errors = [];
  }

  /**
   * Validates a complete document against schema and business rules
   * @param {string} collectionName - Name of the collection
   * @param {object} document - Document to validate
   * @returns {boolean} True if valid
   */
  validate(collectionName, document) {
    this.errors = [];

    try {
      // Schema validation
      validateDocument(collectionName, document);

      // Business logic validation
      this.validateBusinessRules(collectionName, document);

      return true;
    } catch (error) {
      this.errors.push(error.message);
      return false;
    }
  }

  /**
   * Validates business logic rules specific to cricket domain
   * @param {string} collectionName - Collection name
   * @param {object} document - Document to validate
   */
  validateBusinessRules(collectionName, document) {
    switch (collectionName) {
      case 'players':
        this.validatePlayerRules(document);
        break;
      case 'teams':
        this.validateTeamRules(document);
        break;
      case 'matches':
        this.validateMatchRules(document);
        break;
      case 'matchSquads':
        this.validateMatchSquadRules(document);
        break;
      case 'innings':
        this.validateInningsRules(document);
        break;
      case 'tournaments':
        this.validateTournamentRules(document);
        break;
      case 'tournamentTeams':
        this.validateTournamentTeamRules(document);
        break;
      case 'playerMatchStats':
        this.validatePlayerMatchStatsRules(document);
        break;
    }
  }

  /**
   * Player-specific validation rules
   */
  validatePlayerRules(player) {
    // Validate ID format
    if (!validateId(player.playerId, 'playerId')) {
      this.errors.push('Invalid playerId format');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(player.email)) {
      this.errors.push('Invalid email format');
    }

    // Validate role-specific requirements
    if (player.role === 'wicket-keeper' && !player.isWicketKeeper) {
      this.errors.push('Wicket-keeper role must have isWicketKeeper set to true');
    }

    // Validate batting/bowling styles
    if (!['LHB', 'RHB'].includes(player.battingStyle)) {
      this.errors.push('Invalid batting style');
    }

    // Validate career stats consistency
    const career = player.careerStats;
    if (career.battingAverage !== 0 && career.matchesPlayed > 0) {
      const calculatedAverage = career.runs / (career.matchesPlayed - career.battingAverage);
      if (Math.abs(calculatedAverage - career.battingAverage) > 0.01) {
        this.errors.push('Batting average calculation mismatch');
      }
    }

    // Validate teams played for
    if (player.teamsPlayedFor && player.teamsPlayedFor.length > 0) {
      player.teamsPlayedFor.forEach((team, index) => {
        if (!validateId(team.teamId, 'teamId')) {
          this.errors.push(`Invalid teamId in teamsPlayedFor[${index}]`);
        }
        if (team.firstPlayed > team.lastPlayed) {
          this.errors.push(`First played date cannot be after last played date for team ${team.team.name}`);
        }
      });
    }
  }

  /**
   * Team-specific validation rules
   */
  validateTeamRules(team) {
    // Validate ID format
    if (!validateId(team.teamId, 'teamId')) {
      this.errors.push('Invalid teamId format');
    }

    // Validate captain/vice-captain consistency
    if (team.captainId && !team.players.some(p => p.playerId === team.captainId)) {
      this.errors.push('Captain must be in the team players list');
    }

    if (team.viceCaptainId && !team.players.some(p => p.playerId === team.viceCaptainId)) {
      this.errors.push('Vice-captain must be in the team players list');
    }

    // Validate player roles
    const requiredRoles = ['wicket-keeper'];
    const playerRoles = team.players.map(p => p.player.role);
    requiredRoles.forEach(role => {
      if (!playerRoles.includes(role)) {
        this.errors.push(`Team must have at least one ${role}`);
      }
    });

    // Validate team stats
    const stats = team.teamStats;
    if (stats.matchesPlayed !== (stats.matchesWon + stats.matchesLost)) {
      this.errors.push('Team stats: matchesPlayed should equal matchesWon + matchesLost');
    }
  }

  /**
   * Match-specific validation rules
   */
  validateMatchRules(match) {
    // Validate ID format
    if (!validateId(match.matchId, 'matchId')) {
      this.errors.push('Invalid matchId format');
    }

    // Validate tournament and team references
    if (!validateId(match.tournamentId, 'tournamentId')) {
      this.errors.push('Invalid tournamentId format');
    }

    if (!validateId(match.team1SquadId, 'teamId')) {
      this.errors.push('Invalid team1SquadId format');
    }

    if (!validateId(match.team2SquadId, 'teamId')) {
      this.errors.push('Invalid team2SquadId format');
    }

    // Validate match status and dates
    if (match.status === 'completed' && !match.completedDate) {
      this.errors.push('Completed matches must have completedDate');
    }

    if (match.scheduledDate > new Date()) {
      this.errors.push('Scheduled date cannot be in the future for completed matches');
    }

    // Validate scores
    if (match.status === 'completed') {
      const team1Score = match.scores.team1.runs;
      const team2Score = match.scores.team2.runs;

      if (match.result.resultType === 'normal') {
        if (team1Score === team2Score) {
          this.errors.push('Normal result matches cannot have equal scores');
        }
      }
    }

    // Validate innings references
    if (match.innings && match.innings.length > 0) {
      match.innings.forEach(inningsId => {
        if (!validateId(inningsId, 'inningsId')) {
          this.errors.push(`Invalid innings ID: ${inningsId}`);
        }
      });
    }
  }

  /**
   * Match Squad-specific validation rules
   */
  validateMatchSquadRules(squad) {
    // Validate matchSquadId format
    if (!validateId(squad.matchSquadId, 'matchSquadId')) {
      this.errors.push('Invalid matchSquadId format');
    }

    // Validate team and match references
    if (!validateId(squad.team.teamId, 'teamId')) {
      this.errors.push('Invalid teamId in squad');
    }

    if (!validateId(squad.match.matchId, 'matchId')) {
      this.errors.push('Invalid matchId in squad');
    }

    // Validate squad size (11 players typical for cricket)
    if (squad.players.length < 8 || squad.players.length > 11) {
      this.errors.push('Squad must have between 8 and 11 players');
    }

    // Validate captain is in squad
    if (!squad.players.some(p => p.playerId === squad.captainId)) {
      this.errors.push('Captain must be in the squad players list');
    }

    // Validate wicket-keeper designation
    const wicketKeepers = squad.players.filter(p => p.isWicketKeeper);
    if (wicketKeepers.length === 0) {
      this.errors.push('Squad must have at least one wicket-keeper');
    }

    // Validate roles distribution
    const roles = squad.players.map(p => p.role);
    const batsmen = roles.filter(r => r === 'batsman').length;
    const bowlers = roles.filter(r => r === 'bowler').length;
    const allRounders = roles.filter(r => r === 'all-rounder').length;

    if (batsmen < 3) {
      this.errors.push('Squad must have at least 3 batsmen');
    }

    if (bowlers < 2) {
      this.errors.push('Squad must have at least 2 bowlers');
    }
  }

  /**
   * Innings-specific validation rules
   */
  validateInningsRules(innings) {
    // Validate ID format
    if (!validateId(innings.inningsId, 'inningsId')) {
      this.errors.push('Invalid inningsId format');
    }

    // Validate team references
    if (!validateId(innings.battingTeamId, 'teamId')) {
      this.errors.push('Invalid battingTeamId format');
    }

    if (!validateId(innings.bowlingTeamId, 'teamId')) {
      this.errors.push('Invalid bowlingTeamId format');
    }

    // Validate innings number
    if (innings.inningNumber < 1 || innings.inningNumber > 4) {
      this.errors.push('Innings number must be between 1 and 4');
    }

    // Validate wickets (max 10 in cricket)
    if (innings.totalWickets > 10) {
      this.errors.push('Total wickets cannot exceed 10');
    }

    // Validate batting performances
    innings.battingPerformances.forEach((performance, index) => {
      if (performance.runs < 0) {
        this.errors.push(`Batting performance ${index}: runs cannot be negative`);
      }

      if (performance.balls < 0) {
        this.errors.push(`Batting performance ${index}: balls cannot be negative`);
      }

      // Validate strike rate calculation
      if (performance.balls > 0) {
        const calculatedStrikeRate = (performance.runs / performance.balls) * 100;
        if (Math.abs(calculatedStrikeRate - performance.strikeRate) > 0.1) {
          this.errors.push(`Batting performance ${index}: strike rate calculation mismatch`);
        }
      }
    });

    // Validate bowling performances
    innings.bowlingPerformances.forEach((performance, index) => {
      if (performance.wickets > 10) {
        this.errors.push(`Bowling performance ${index}: wickets cannot exceed 10`);
      }

      if (performance.overs < 0) {
        this.errors.push(`Bowling performance ${index}: overs cannot be negative`);
      }
    });
  }

  /**
   * Tournament-specific validation rules
   */
  validateTournamentRules(tournament) {
    // Validate ID format
    if (!validateId(tournament.tournamentId, 'tournamentId')) {
      this.errors.push('Invalid tournamentId format');
    }

    // Validate date logic
    if (tournament.startDate > tournament.endDate) {
      this.errors.push('Tournament start date cannot be after end date');
    }

    // Validate rules
    const rules = tournament.rules;
    if (rules.playersPerTeam < 8 || rules.playersPerTeam > 11) {
      this.errors.push('Players per team must be between 8 and 11');
    }

    if (rules.oversPerInning < 1) {
      this.errors.push('Overs per inning must be at least 1');
    }

    // Validate standings consistency
    if (tournament.standings && tournament.standings.length > 0) {
      tournament.standings.forEach((standing, index) => {
        if (!validateId(standing.teamId, 'teamId')) {
          this.errors.push(`Invalid teamId in standings[${index}]`);
        }

        const totalMatches = standing.played;
        const accountedMatches = standing.won + standing.lost + standing.tied;
        if (totalMatches !== accountedMatches) {
          this.errors.push(`Standings[${index}]: played should equal won + lost + tied`);
        }
      });
    }
  }

  /**
   * Tournament Team-specific validation rules
   */
  validateTournamentTeamRules(tournamentTeam) {
    // Validate ID format
    if (!validateId(tournamentTeam.tournamentTeamId, 'tournamentTeamId')) {
      this.errors.push('Invalid tournamentTeamId format');
    }

    // Validate references
    if (!validateId(tournamentTeam.tournamentId, 'tournamentId')) {
      this.errors.push('Invalid tournamentId format');
    }

    if (!validateId(tournamentTeam.teamId, 'teamId')) {
      this.errors.push('Invalid teamId format');
    }

    // Validate captain is in players list
    if (!tournamentTeam.players.some(p => p.playerId === tournamentTeam.captainId)) {
      this.errors.push('Captain must be in the tournament team players list');
    }

    // Validate tournament stats
    const stats = tournamentTeam.tournamentStats;
    if (stats.played !== (stats.won + stats.lost + stats.tied)) {
      this.errors.push('Tournament stats: played should equal won + lost + tied');
    }
  }

  /**
   * Player Match Stats-specific validation rules
   */
  validatePlayerMatchStatsRules(stats) {
    // Validate ID format
    if (!validateId(stats.playerMatchStatsId, 'playerMatchStatsId')) {
      this.errors.push('Invalid playerMatchStatsId format');
    }

    // Validate references
    if (!validateId(stats.playerId, 'playerId')) {
      this.errors.push('Invalid playerId format');
    }

    if (!validateId(stats.matchId, 'matchId')) {
      this.errors.push('Invalid matchId format');
    }

    if (!validateId(stats.tournamentId, 'tournamentId')) {
      this.errors.push('Invalid tournamentId format');
    }

    if (!validateId(stats.teamId, 'teamId')) {
      this.errors.push('Invalid teamId format');
    }

    // Validate batting stats
    const batting = stats.batting;
    if (batting.balls > 0) {
      const calculatedStrikeRate = (batting.runs / batting.balls) * 100;
      if (Math.abs(calculatedStrikeRate - batting.strikeRate) > 0.1) {
        this.errors.push('Batting strike rate calculation mismatch');
      }
    }

    // Validate bowling stats
    const bowling = stats.bowling;
    if (bowling.overs > 0) {
      const calculatedEconomy = bowling.runs / bowling.overs;
      if (Math.abs(calculatedEconomy - bowling.economy) > 0.1) {
        this.errors.push('Bowling economy calculation mismatch');
      }
    }
  }

  /**
   * Gets validation errors
   * @returns {string[]} Array of error messages
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Clears validation errors
   */
  clearErrors() {
    this.errors = [];
  }
}

// Export singleton instance
const dataValidator = new DataValidator();

module.exports = {
  DataValidator,
  dataValidator,
  validateDocument: (collectionName, document) => {
    return dataValidator.validate(collectionName, document);
  },
  getValidationErrors: () => dataValidator.getErrors()
};