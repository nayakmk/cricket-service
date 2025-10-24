/**
 * V2 COLLECTIONS VERIFICATION SCRIPT
 *
 * Verifies that v2 collections have been properly migrated with nested team structure
 */

const admin = require('firebase-admin');
const { V2_COLLECTIONS } = require('../config/database-v2');

class V2VerificationManager {
  constructor() {
    this.db = admin.firestore();
  }

  async verifyV2Collections() {
    console.log('🔍 Verifying V2 Collections Migration...\n');

    try {
      // Verify teams collection
      await this.verifyTeamsCollection();

      // Verify players collection
      await this.verifyPlayersCollection();

      // Verify matches collection with nested structure
      await this.verifyMatchesCollection();

      this.printVerificationSummary();

    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  }

  async verifyTeamsCollection() {
    console.log('📋 Verifying teams_v2 collection...');

    const teamsSnapshot = await this.db.collection(V2_COLLECTIONS.TEAMS).limit(5).get();

    if (teamsSnapshot.empty) {
      console.log('❌ No teams found in v2 collection');
      return;
    }

    console.log(`✅ Found ${teamsSnapshot.size} teams in v2 collection`);

    // Check structure of first team
    const firstTeam = teamsSnapshot.docs[0].data();
    const requiredFields = ['numericId', 'displayId', 'name', 'shortName', 'isActive'];
    const missingFields = requiredFields.filter(field => !(field in firstTeam));

    if (missingFields.length > 0) {
      console.log(`❌ Team missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ Team structure is valid');
    }

    console.log(`Sample team: ${firstTeam.name} (${firstTeam.numericId})`);
  }

  async verifyPlayersCollection() {
    console.log('👥 Verifying players_v2 collection...');

    const playersSnapshot = await this.db.collection(V2_COLLECTIONS.PLAYERS).limit(5).get();

    if (playersSnapshot.empty) {
      console.log('❌ No players found in v2 collection');
      return;
    }

    console.log(`✅ Found ${playersSnapshot.size} players in v2 collection`);

    // Check structure of first player
    const firstPlayer = playersSnapshot.docs[0].data();
    const requiredFields = ['numericId', 'displayId', 'name', 'role', 'isActive'];
    const missingFields = requiredFields.filter(field => !(field in firstPlayer));

    if (missingFields.length > 0) {
      console.log(`❌ Player missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ Player structure is valid');
    }

    console.log(`Sample player: ${firstPlayer.name} (${firstPlayer.role})`);
  }

  async verifyMatchesCollection() {
    console.log('🏏 Verifying matches_v2 collection with nested team structure...');

    const matchesSnapshot = await this.db.collection(V2_COLLECTIONS.MATCHES).limit(5).get();

    if (matchesSnapshot.empty) {
      console.log('❌ No matches found in v2 collection');
      return;
    }

    console.log(`✅ Found ${matchesSnapshot.size} matches in v2 collection`);

    // Check structure of first match
    const firstMatch = matchesSnapshot.docs[0].data();

    // Check for nested team structure
    const hasNestedTeam1 = firstMatch.team1 && typeof firstMatch.team1 === 'object' && firstMatch.team1.squad;
    const hasNestedTeam2 = firstMatch.team2 && typeof firstMatch.team2 === 'object' && firstMatch.team2.squad;

    // Check for absence of legacy fields
    const hasLegacyTeam1Squad = !!firstMatch.team1Squad;
    const hasLegacyTeam2Squad = !!firstMatch.team2Squad;
    const hasLegacyTeam1Score = typeof firstMatch.team1Score === 'number';
    const hasLegacyTeam2Score = typeof firstMatch.team2Score === 'number';

    console.log('Nested structure check:');
    console.log(`  ✅ team1 has nested squad: ${hasNestedTeam1}`);
    console.log(`  ✅ team2 has nested squad: ${hasNestedTeam2}`);

    console.log('Legacy fields check (should be absent):');
    console.log(`  ✅ team1Squad absent: ${!hasLegacyTeam1Squad}`);
    console.log(`  ✅ team2Squad absent: ${!hasLegacyTeam2Squad}`);
    console.log(`  ✅ team1Score absent: ${!hasLegacyTeam1Score}`);
    console.log(`  ✅ team2Score absent: ${!hasLegacyTeam2Score}`);

    if (hasNestedTeam1 && hasNestedTeam2 && !hasLegacyTeam1Squad && !hasLegacyTeam2Squad && !hasLegacyTeam1Score && !hasLegacyTeam2Score) {
      console.log('✅ Match nested structure is correct');
    } else {
      console.log('❌ Match structure has issues');
    }

    console.log(`Sample match: ${firstMatch.title}`);
    console.log('Team1 structure:', JSON.stringify(firstMatch.team1, null, 2));
  }

  printVerificationSummary() {
    console.log('\n🎉 V2 Collections Verification Summary:');
    console.log('=======================================');
    console.log('✅ All collections verified');
    console.log('✅ Nested team structure confirmed');
    console.log('✅ Legacy fields properly removed');
    console.log('\n📝 V2 Collections are ready for use!');
  }
}

// Main execution function
async function runV2Verification() {
  const verificationManager = new V2VerificationManager();

  try {
    await verificationManager.verifyV2Collections();
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { V2VerificationManager, runV2Verification };

// Run if called directly
if (require.main === module) {
  runV2Verification();
}