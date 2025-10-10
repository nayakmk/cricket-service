// Cricket App v2 - Data Migration Script
// Migrates existing JSON data to optimized v2 collections

const fs = require('fs');
const path = require('path');
const { collections } = require('../config/database-v2');
const { dataValidator } = require('../utils/data-validator');
const { idGenerators, generateDisplayId } = require('../utils/id-generator');

/**
 * Migration statistics
 */
class MigrationStats {
  constructor() {
    this.processed = 0;
    this.successful = 0;
    this.failed = 0;
    this.errors = [];
  }

  recordSuccess() {
    this.processed++;
    this.successful++;
  }

  recordFailure(error) {
    this.processed++;
    this.failed++;
    this.errors.push(error);
  }

  log() {
    console.log(`📊 Migration Stats:`);
    console.log(`   Processed: ${this.processed}`);
    console.log(`   Successful: ${this.successful}`);
    console.log(`   Failed: ${this.failed}`);
    if (this.errors.length > 0) {
      console.log(`   Errors: ${this.errors.length}`);
    }
  }
}

/**
 * Base migration class
 */
class BaseMigrator {
  constructor(collectionName, transformFunction) {
    this.collectionName = collectionName;
    this.transformFunction = transformFunction;
    this.stats = new MigrationStats();
    this.collection = collections[collectionName];
  }

  async migrate(data) {
    console.log(`\n🚀 Starting migration for ${this.collectionName}...`);

    const batch = [];
    const BATCH_SIZE = 10; // Firestore batch size limit

    for (const item of data) {
      try {
        const transformedItem = await this.transformFunction(item);

        // Validate the transformed data
        if (!dataValidator.validate(this.collectionName, transformedItem)) {
          const errors = dataValidator.getErrors();
          throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        batch.push(transformedItem);

        // Process batch when it reaches the limit
        if (batch.length >= BATCH_SIZE) {
          await this.processBatch(batch);
          batch.length = 0; // Clear batch
        }

        this.stats.recordSuccess();
        console.log(`✅ Migrated item: ${transformedItem[this.getIdField()]}`);

      } catch (error) {
        console.error(`❌ Failed to migrate item:`, error.message);
        this.stats.recordFailure(error.message);
      }
    }

    // Process remaining items in batch
    if (batch.length > 0) {
      await this.processBatch(batch);
    }

    this.stats.log();
    return this.stats;
  }

  async processBatch(batch) {
    const writeBatch = this.collection.firestore.batch();

    batch.forEach(item => {
      const docRef = this.collection.doc(item[this.getIdField()]);
      writeBatch.set(docRef, {
        ...item,
        migratedAt: new Date(),
        version: '2.0.0'
      });
    });

    await writeBatch.commit();
    console.log(`📦 Processed batch of ${batch.length} items`);
  }

  getIdField() {
    // Return the primary ID field for each collection
    const idFields = {
      players: 'playerId',
      teams: 'teamId',
      matches: 'matchId',
      matchSquads: 'matchSquadId',
      innings: 'inningsId',
      tournamentTeams: 'tournamentTeamId',
      playerMatchStats: 'playerMatchStatsId',
      tournaments: 'tournamentId'
    };
    return idFields[this.collectionName];
  }
}

/**
 * Players data migrator
 */
class PlayersMigrator extends BaseMigrator {
  constructor() {
    super('players', async (player) => {
      // Transform player data to v2 format
      const playerId = idGenerators.playerId();
      const displayId = generateDisplayId('players');

      return {
        playerId,
        displayId,
        name: player.name || '',
        email: player.email || '',
        isActive: player.isActive !== false,
        role: this.mapPlayerRole(player.role),
        battingStyle: player.battingStyle || 'RHB',
        bowlingStyle: player.bowlingStyle || null,
        isWicketKeeper: player.isWicketKeeper || false,
        nationality: player.nationality || null,
        avatar: player.avatar || null,
        preferredTeamId: player.preferredTeamId || null,
        preferredTeam: player.preferredTeam || null,
        teamsPlayedFor: this.transformTeamsPlayedFor(player.teamsPlayedFor || []),
        recentMatches: this.transformRecentMatches(player.recentMatches || []),
        tournamentsPlayed: this.transformTournamentsPlayed(player.tournamentsPlayed || []),
        careerStats: this.transformCareerStats(player.careerStats || {}),
        seasonStats: {
          season: '2025',
          matchesPlayed: player.careerStats?.matchesPlayed || 0
        },
        milestones: player.milestones || { batting: [], bowling: [], fielding: [] },
        createdAt: player.createdAt ? new Date(player.createdAt) : new Date(),
        updatedAt: new Date()
      };
    });
  }

  mapPlayerRole(role) {
    const roleMapping = {
      'Batsman': 'batsman',
      'Bowler': 'bowler',
      'All-rounder': 'all-rounder',
      'Wicket-keeper': 'wicket-keeper'
    };
    return roleMapping[role] || role || 'batsman';
  }

  transformTeamsPlayedFor(teamsPlayedFor) {
    return teamsPlayedFor.map(team => ({
      teamId: team.teamId || idGenerators.teamId(),
      team: {
        teamId: team.teamId || idGenerators.teamId(),
        name: team.team?.name || team.name || '',
        shortName: team.team?.shortName || team.shortName || ''
      },
      matchesPlayed: team.matchesPlayed || 0,
      firstPlayed: team.firstPlayed ? new Date(team.firstPlayed) : new Date(),
      lastPlayed: team.lastPlayed ? new Date(team.lastPlayed) : new Date(),
      isCaptain: team.isCaptain || false,
      totalRuns: team.totalRuns || 0,
      totalWickets: team.totalWickets || 0
    }));
  }

  transformRecentMatches(recentMatches) {
    return recentMatches.slice(0, 10).map(match => ({
      matchId: match.matchId || idGenerators.matchId(),
      match: {
        matchId: match.matchId || idGenerators.matchId(),
        title: match.match?.title || match.title || '',
        date: match.match?.date ? new Date(match.match.date) : new Date(),
        venue: match.match?.venue || match.venue || '',
        tournamentName: match.match?.tournamentName || match.tournamentName || ''
      },
      teamPlayedFor: {
        teamId: match.teamPlayedFor?.teamId || idGenerators.teamId(),
        name: match.teamPlayedFor?.name || '',
        shortName: match.teamPlayedFor?.shortName || ''
      },
      batting: {
        runs: match.batting?.runs || 0,
        balls: match.batting?.balls || 0,
        dismissal: match.batting?.dismissal || null
      },
      bowling: {
        wickets: match.bowling?.wickets || 0,
        runs: match.bowling?.runs || 0,
        overs: match.bowling?.overs || 0
      }
    }));
  }

  transformTournamentsPlayed(tournamentsPlayed) {
    return tournamentsPlayed.map(tournament => ({
      tournamentId: tournament.tournamentId || idGenerators.tournamentId(),
      tournament: {
        tournamentId: tournament.tournamentId || idGenerators.tournamentId(),
        name: tournament.tournament?.name || tournament.name || '',
        season: tournament.tournament?.season || tournament.season || '2025'
      },
      matchesPlayed: tournament.matchesPlayed || 0,
      totalRuns: tournament.totalRuns || 0,
      totalWickets: tournament.totalWickets || 0,
      manOfTheSeries: tournament.manOfTheSeries || false
    }));
  }

  transformCareerStats(careerStats) {
    return {
      matchesPlayed: careerStats.matchesPlayed || 0,
      runs: careerStats.runs || 0,
      wickets: careerStats.wickets || 0,
      highestScore: careerStats.highestScore || 0,
      battingAverage: careerStats.battingAverage || 0,
      bowlingAverage: careerStats.bowlingAverage || 0,
      strikeRate: careerStats.strikeRate || 0,
      economyRate: careerStats.economyRate || 0,
      catches: careerStats.catches || 0,
      runOuts: careerStats.runOuts || 0
    };
  }
}

/**
 * Teams data migrator
 */
class TeamsMigrator extends BaseMigrator {
  constructor() {
    super('teams', async (team) => {
      const teamId = idGenerators.teamId();
      const displayId = generateDisplayId('teams');

      return {
        teamId,
        displayId,
        name: team.name || '',
        shortName: team.shortName || '',
        isActive: team.isActive !== false,
        captainId: team.captainId || null,
        captain: team.captain || null,
        viceCaptainId: team.viceCaptainId || null,
        viceCaptain: team.viceCaptain || null,
        homeGround: team.homeGround || null,
        players: this.transformPlayers(team.players || []),
        recentMatches: this.transformRecentMatches(team.recentMatches || []),
        tournaments: this.transformTournaments(team.tournaments || []),
        teamStats: this.transformTeamStats(team.teamStats || {}),
        createdAt: team.createdAt ? new Date(team.createdAt) : new Date(),
        updatedAt: new Date()
      };
    });
  }

  transformPlayers(players) {
    return players.map(player => ({
      playerId: player.playerId || idGenerators.playerId(),
      player: {
        playerId: player.playerId || idGenerators.playerId(),
        name: player.player?.name || player.name || '',
        role: player.player?.role || player.role || 'batsman',
        battingStyle: player.player?.battingStyle || player.battingStyle || 'RHB',
        avatar: player.player?.avatar || player.avatar || null
      },
      matchesPlayed: player.matchesPlayed || 0,
      totalRuns: player.totalRuns || 0,
      totalWickets: player.totalWickets || 0,
      lastPlayed: player.lastPlayed ? new Date(player.lastPlayed) : new Date(),
      isCaptain: player.isCaptain || false,
      isViceCaptain: player.isViceCaptain || false
    }));
  }

  transformRecentMatches(recentMatches) {
    return recentMatches.slice(0, 10).map(match => ({
      matchId: match.matchId || idGenerators.matchId(),
      match: {
        matchId: match.matchId || idGenerators.matchId(),
        title: match.match?.title || match.title || '',
        date: match.match?.date ? new Date(match.match.date) : new Date(),
        venue: match.match?.venue || match.venue || '',
        opponent: match.match?.opponent || match.opponent || '',
        result: match.match?.result || match.result || ''
      },
      tournamentName: match.tournamentName || '',
      teamScore: match.teamScore || 0,
      opponentScore: match.opponentScore || 0,
      isWinner: match.isWinner || false
    }));
  }

  transformTournaments(tournaments) {
    return tournaments.map(tournament => ({
      tournamentId: tournament.tournamentId || idGenerators.tournamentId(),
      tournament: {
        tournamentId: tournament.tournamentId || idGenerators.tournamentId(),
        name: tournament.tournament?.name || tournament.name || '',
        season: tournament.tournament?.season || tournament.season || '2025'
      },
      matchesPlayed: tournament.matchesPlayed || 0,
      matchesWon: tournament.matchesWon || 0,
      position: tournament.position || 0,
      points: tournament.points || 0
    }));
  }

  transformTeamStats(teamStats) {
    return {
      matchesPlayed: teamStats.matchesPlayed || 0,
      matchesWon: teamStats.matchesWon || 0,
      matchesLost: teamStats.matchesLost || 0,
      winPercentage: teamStats.winPercentage || 0,
      totalPlayers: teamStats.totalPlayers || 0,
      avgPlayersPerMatch: teamStats.avgPlayersPerMatch || 0
    };
  }
}

/**
 * Main migration orchestrator
 */
class DataMigrationOrchestrator {
  constructor() {
    this.migrators = {
      players: new PlayersMigrator(),
      teams: new TeamsMigrator()
      // Add other migrators as needed
    };
  }

  async migrateAll() {
    console.log('🎯 Starting Cricket App v2 Data Migration...');

    const dataFiles = {
      players: path.join(__dirname, '../json/players_sample.json'),
      teams: path.join(__dirname, '../json/SampleTeam.json')
    };

    const results = {};

    for (const [collectionName, filePath] of Object.entries(dataFiles)) {
      try {
        console.log(`\n📂 Reading data from: ${filePath}`);

        if (!fs.existsSync(filePath)) {
          console.log(`⚠️  Data file not found: ${filePath}, skipping...`);
          continue;
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        // Handle different data structures
        let itemsToMigrate = [];
        if (Array.isArray(data)) {
          itemsToMigrate = data;
        } else if (data.players) {
          itemsToMigrate = data.players;
        } else if (data.teams) {
          itemsToMigrate = data.teams;
        } else {
          // Single object
          itemsToMigrate = [data];
        }

        console.log(`📊 Found ${itemsToMigrate.length} items to migrate for ${collectionName}`);

        const migrator = this.migrators[collectionName];
        if (migrator) {
          results[collectionName] = await migrator.migrate(itemsToMigrate);
        } else {
          console.log(`⚠️  No migrator found for ${collectionName}, skipping...`);
        }

      } catch (error) {
        console.error(`❌ Failed to migrate ${collectionName}:`, error);
        results[collectionName] = { error: error.message };
      }
    }

    this.printSummary(results);
    return results;
  }

  printSummary(results) {
    console.log('\n🎉 Migration Complete!');
    console.log('=' .repeat(50));

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (const [collection, result] of Object.entries(results)) {
      if (result.error) {
        console.log(`❌ ${collection}: Failed - ${result.error}`);
      } else {
        console.log(`✅ ${collection}: ${result.successful}/${result.processed} successful`);
        totalProcessed += result.processed;
        totalSuccessful += result.successful;
        totalFailed += result.failed;
      }
    }

    console.log('=' .repeat(50));
    console.log(`📊 Overall: ${totalSuccessful}/${totalProcessed} items migrated successfully`);

    if (totalFailed > 0) {
      console.log(`⚠️  ${totalFailed} items failed to migrate`);
      console.log('Check the error logs above for details');
    }
  }
}

// CLI interface
async function main() {
  const orchestrator = new DataMigrationOrchestrator();

  try {
    await orchestrator.migrateAll();
    console.log('\n🚀 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  DataMigrationOrchestrator,
  PlayersMigrator,
  TeamsMigrator
};

// Run if called directly
if (require.main === module) {
  main();
}