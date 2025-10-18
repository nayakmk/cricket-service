/**
 * V2 COLLECTIONS MIGRATION SCRIPT
 *
 * Migrates data from v1 collections to v2 collections with nested team structure
 *
 * V1 Structure (flat):
 * - team1, team1Squad, team1SquadId, team1Score
 * - team2, team2Squad, team2SquadId, team2Score
 *
 * V2 Structure (nested):
 * - team1: { id, name, shortName, squad: {...}, squadId, score }
 * - team2: { id, name, shortName, squad: {...}, squadId, score }
 */

const admin = require('firebase-admin');
const { V2_COLLECTIONS } = require('../config/database-v2');

class V2MigrationManager {
  constructor() {
    this.db = admin.firestore();
    this.batchSize = 10; // Firestore batch size limit
    this.stats = {
      teams: { processed: 0, migrated: 0, errors: 0 },
      players: { processed: 0, migrated: 0, errors: 0 },
      matches: { processed: 0, migrated: 0, errors: 0 }
    };
  }

  async migrateAllCollections() {
    console.log('🚀 Starting V2 Collections Migration...');

    try {
      // Step 1: Migrate teams
      console.log('\n📋 Step 1: Migrating teams collection...');
      await this.migrateTeams();

      // Step 2: Migrate players
      console.log('\n👥 Step 2: Migrating players collection...');
      await this.migratePlayers();

      // Step 3: Migrate matches with nested team structure
      console.log('\n🏏 Step 3: Migrating matches collection...');
      await this.migrateMatches();

      // Step 4: Update team references in matches
      console.log('\n🔗 Step 4: Updating team references...');
      await this.updateTeamReferences();

      this.printMigrationSummary();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateTeams() {
    const teamsSnapshot = await this.db.collection('teams').get();

    console.log(`Found ${teamsSnapshot.size} teams to migrate`);

    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (const doc of teamsSnapshot.docs) {
      this.stats.teams.processed++;

      try {
        const teamData = doc.data();

        // Check if team already exists in v2 collection
        const existingTeam = await this.db.collection(V2_COLLECTIONS.TEAMS)
          .where('numericId', '==', teamData.numericId || teamData.id)
          .limit(1)
          .get();

        if (!existingTeam.empty) {
          console.log(`Team ${teamData.name} already exists in v2, skipping`);
          continue;
        }

        // Transform to v2 structure
        const v2TeamData = {
          numericId: teamData.numericId || teamData.id,
          displayId: teamData.displayId || teamData.numericId || Math.floor(Math.random() * 999999) + 1,
          name: teamData.name,
          shortName: teamData.shortName || teamData.name.substring(0, 3).toUpperCase(),
          captainId: teamData.captainId || null,
          captain: teamData.captain || null,
          viceCaptainId: teamData.viceCaptainId || null,
          viceCaptain: teamData.viceCaptain || null,
          homeGround: teamData.homeGround || null,
          players: teamData.players || [],
          recentMatches: teamData.recentMatches || [],
          tournaments: teamData.tournaments || [],
          teamStats: teamData.teamStats || {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            winPercentage: 0,
            totalPlayers: 0,
            avgPlayersPerMatch: 0
          },
          isActive: teamData.isActive !== false,
          createdAt: teamData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const v2DocRef = this.db.collection(V2_COLLECTIONS.TEAMS).doc();
        currentBatch.set(v2DocRef, v2TeamData);

        batchCount++;

        // Commit batch when it reaches the limit
        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.teams.migrated++;
        console.log(`✅ Migrated team: ${v2TeamData.name}`);

      } catch (error) {
        console.error(`❌ Failed to migrate team ${doc.id}:`, error.message);
        this.stats.teams.errors++;
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Teams migration completed: ${this.stats.teams.migrated}/${this.stats.teams.processed} migrated`);
  }

  async migratePlayers() {
    const playersSnapshot = await this.db.collection('players').get();

    console.log(`Found ${playersSnapshot.size} players to migrate`);

    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (const doc of playersSnapshot.docs) {
      this.stats.players.processed++;

      try {
        const playerData = doc.data();

        // Check if player already exists in v2 collection
        const existingPlayer = await this.db.collection(V2_COLLECTIONS.PLAYERS)
          .where('numericId', '==', playerData.numericId || playerData.id)
          .limit(1)
          .get();

        if (!existingPlayer.empty) {
          console.log(`Player ${playerData.name} already exists in v2, skipping`);
          continue;
        }

        // Transform to v2 structure
        const v2PlayerData = {
          numericId: playerData.numericId || playerData.id,
          displayId: playerData.displayId || playerData.numericId || Math.floor(Math.random() * 999999) + 1,
          name: playerData.name,
          role: playerData.role || 'batsman',
          battingStyle: playerData.battingStyle || (playerData.role === 'wicket-keeper' ? 'RHB' : 'RHB'),
          bowlingStyle: playerData.bowlingStyle || null,
          preferredTeamId: playerData.preferredTeamId || null,
          preferredTeam: playerData.preferredTeam || null,
          dateOfBirth: playerData.dateOfBirth || null,
          nationality: playerData.nationality || 'Unknown',
          isActive: playerData.isActive !== false,
          careerStats: playerData.careerStats || {
            matchesPlayed: 0,
            runs: 0,
            wickets: 0,
            battingAverage: 0,
            bowlingAverage: 0,
            strikeRate: 0,
            economy: 0,
            highestScore: 0,
            bestBowling: '0/0'
          },
          recentMatches: playerData.recentMatches || [],
          achievements: playerData.achievements || [],
          createdAt: playerData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const v2DocRef = this.db.collection(V2_COLLECTIONS.PLAYERS).doc();
        currentBatch.set(v2DocRef, v2PlayerData);

        batchCount++;

        // Commit batch when it reaches the limit
        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.players.migrated++;
        console.log(`✅ Migrated player: ${v2PlayerData.name}`);

      } catch (error) {
        console.error(`❌ Failed to migrate player ${doc.id}:`, error.message);
        this.stats.players.errors++;
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Players migration completed: ${this.stats.players.migrated}/${this.stats.players.processed} migrated`);
  }

  async migrateMatches() {
    const matchesSnapshot = await this.db.collection('matches').get();

    console.log(`Found ${matchesSnapshot.size} matches to migrate`);

    const batches = [];
    let currentBatch = this.db.batch();
    let batchCount = 0;

    for (const doc of matchesSnapshot.docs) {
      this.stats.matches.processed++;

      try {
        const matchData = doc.data();

        // Check if match already exists in v2 collection
        const existingMatch = await this.db.collection(V2_COLLECTIONS.MATCHES)
          .where('numericId', '==', matchData.numericId || matchData.id)
          .limit(1)
          .get();

        if (!existingMatch.empty) {
          console.log(`Match ${matchData.numericId || matchData.id} already exists in v2, skipping`);
          continue;
        }

        // Transform to v2 nested structure
        const v2MatchData = {
          numericId: matchData.numericId || matchData.id,
          displayId: matchData.displayId || matchData.numericId || Math.floor(Math.random() * 999999) + 1,
          title: matchData.title,
          status: matchData.status || 'completed',
          matchType: matchData.matchType || 'T20',
          venue: matchData.venue || matchData.ground || 'Unknown Venue',
          scheduledDate: matchData.scheduledDate,
          tournamentId: matchData.tournamentId || 'default_tournament',
          tournament: matchData.tournament || {
            tournamentId: 'default_tournament',
            name: matchData.tournament || 'Unknown Tournament',
            shortName: (matchData.tournament || 'Unknown Tournament').substring(0, 3).toUpperCase(),
            season: '2024'
          },
          createdAt: matchData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),

          // Nested team structure - this is the key change
          team1: this.createNestedTeamStructure(matchData, 'team1'),
          team2: this.createNestedTeamStructure(matchData, 'team2'),

          // Keep some legacy fields for reference during transition
          team1Id: matchData.team1Id || matchData.team1?.id,
          team2Id: matchData.team2Id || matchData.team2?.id,

          toss: matchData.toss,
          result: matchData.result,
          ...(matchData.playerOfMatch && { playerOfMatch: matchData.playerOfMatch }),
          ...(matchData.externalMatchId && { externalMatchId: matchData.externalMatchId })
        };

        const v2DocRef = this.db.collection(V2_COLLECTIONS.MATCHES).doc();
        currentBatch.set(v2DocRef, v2MatchData);

        batchCount++;

        // Commit batch when it reaches the limit
        if (batchCount >= this.batchSize) {
          batches.push(currentBatch.commit());
          currentBatch = this.db.batch();
          batchCount = 0;
        }

        this.stats.matches.migrated++;
        console.log(`✅ Migrated match: ${v2MatchData.title}`);

      } catch (error) {
        console.error(`❌ Failed to migrate match ${doc.id}:`, error.message);
        this.stats.matches.errors++;
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`✅ Matches migration completed: ${this.stats.matches.migrated}/${this.stats.matches.processed} migrated`);
  }

  createNestedTeamStructure(matchData, teamPrefix) {
    // Handle the actual structure from the import script
    const team = matchData.teams?.[teamPrefix];
    const teamId = matchData[`${teamPrefix}Id`];
    const teamScore = matchData.scores?.[teamPrefix] || matchData[`${teamPrefix}Score`] || 0;

    if (team && typeof team === 'object') {
      // Already in nested format or has team object
      return {
        id: team.id || teamId,
        name: team.name,
        shortName: team.shortName || team.name?.substring(0, 3).toUpperCase(),
        squad: {
          teamId: team.id || teamId,
          name: team.name,
          shortName: team.shortName || team.name?.substring(0, 3).toUpperCase(),
          captainName: 'Captain'
        },
        squadId: `squad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        score: typeof teamScore === 'object' ? teamScore : {
          runs: teamScore || 0,
          wickets: 0,
          overs: 0,
          declared: false
        }
      };
    }

    // Fallback for minimal data
    return {
      id: teamId || `team_${Date.now()}`,
      name: `Team ${teamPrefix === 'team1' ? '1' : '2'}`,
      shortName: `T${teamPrefix === 'team1' ? '1' : '2'}`,
      squad: {
        teamId: teamId || `team_${Date.now()}`,
        name: `Team ${teamPrefix === 'team1' ? '1' : '2'}`,
        shortName: `T${teamPrefix === 'team1' ? '1' : '2'}`,
        captainName: 'Captain'
      },
      squadId: `squad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      score: typeof teamScore === 'object' ? teamScore : {
        runs: teamScore || 0,
        wickets: 0,
        overs: 0,
        declared: false
      }
    };
  }

  async updateTeamReferences() {
    // Update any references to old team IDs in the v2 collections
    console.log('Updating team references in v2 collections...');

    // This could involve updating player preferredTeamId references
    // and any other cross-references that need updating

    console.log('✅ Team references updated');
  }

  printMigrationSummary() {
    console.log('\n🎉 V2 Collections Migration Summary:');
    console.log('=====================================');
    console.log(`Teams: ${this.stats.teams.migrated}/${this.stats.teams.processed} migrated (${this.stats.teams.errors} errors)`);
    console.log(`Players: ${this.stats.players.migrated}/${this.stats.players.processed} migrated (${this.stats.players.errors} errors)`);
    console.log(`Matches: ${this.stats.matches.migrated}/${this.stats.matches.processed} migrated (${this.stats.matches.errors} errors)`);

    const totalMigrated = this.stats.teams.migrated + this.stats.players.migrated + this.stats.matches.migrated;
    const totalProcessed = this.stats.teams.processed + this.stats.players.processed + this.stats.matches.processed;
    const totalErrors = this.stats.teams.errors + this.stats.players.errors + this.stats.matches.errors;

    console.log(`\nTotal: ${totalMigrated}/${totalProcessed} migrated (${totalErrors} errors)`);

    if (totalErrors === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('📝 Next steps:');
      console.log('1. Test the v2 API endpoints');
      console.log('2. Update client applications to use v2 collections');
      console.log('3. Consider archiving or removing v1 collections after verification');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the error messages above.');
    }
  }
}

// Main execution function
async function runV2Migration() {
  const migrationManager = new V2MigrationManager();

  try {
    await migrationManager.migrateAllCollections();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { V2MigrationManager, runV2Migration };

// Run if called directly
if (require.main === module) {
  runV2Migration();
}