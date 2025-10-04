const { collections, db } = require('../config/database');

/**
 * Export all data for backup before migration
 */
async function exportAllData() {
  console.log('📤 Exporting all data for backup...\n');

  const exportData = {
    exportedAt: new Date().toISOString(),
    collections: {}
  };

  // Export teams
  console.log('Exporting teams...');
  const teamsSnapshot = await collections.teams.get();
  exportData.collections.teams = {};
  teamsSnapshot.docs.forEach(doc => {
    exportData.collections.teams[doc.id] = doc.data();
  });

  // Export players
  console.log('Exporting players...');
  const playersSnapshot = await collections.players.get();
  exportData.collections.players = {};
  playersSnapshot.docs.forEach(doc => {
    exportData.collections.players[doc.id] = doc.data();
  });

  // Export teamLineups
  console.log('Exporting teamLineups...');
  const teamLineupsSnapshot = await collections.teamLineups.get();
  exportData.collections.teamLineups = {};
  teamLineupsSnapshot.docs.forEach(doc => {
    exportData.collections.teamLineups[doc.id] = doc.data();
  });

  // Export matches and subcollections
  console.log('Exporting matches...');
  const matchesSnapshot = await collections.matches.get();
  exportData.collections.matches = {};

  for (const matchDoc of matchesSnapshot.docs) {
    const matchData = matchDoc.data();
    exportData.collections.matches[matchDoc.id] = matchData;

    // Export innings subcollection
    const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').get();
    exportData.collections.matches[matchDoc.id].innings = {};

    for (const inningDoc of inningsSnapshot.docs) {
      const inningData = inningDoc.data();
      exportData.collections.matches[matchDoc.id].innings[inningDoc.id] = inningData;

      // Export batsmen
      const batsmenSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').get();
      exportData.collections.matches[matchDoc.id].innings[inningDoc.id].batsmen = {};
      batsmenSnapshot.docs.forEach(doc => {
        exportData.collections.matches[matchDoc.id].innings[inningDoc.id].batsmen[doc.id] = doc.data();
      });

      // Export bowling
      const bowlingSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').get();
      exportData.collections.matches[matchDoc.id].innings[inningDoc.id].bowling = {};
      bowlingSnapshot.docs.forEach(doc => {
        exportData.collections.matches[matchDoc.id].innings[inningDoc.id].bowling[doc.id] = doc.data();
      });

      // Export fall of wickets
      const fowSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('fallOfWickets').get();
      exportData.collections.matches[matchDoc.id].innings[inningDoc.id].fallOfWickets = {};
      fowSnapshot.docs.forEach(doc => {
        exportData.collections.matches[matchDoc.id].innings[inningDoc.id].fallOfWickets[doc.id] = doc.data();
      });
    }
  }

  // Export sequences
  console.log('Exporting sequences...');
  const sequencesSnapshot = await collections.sequences.get();
  exportData.collections.sequences = {};
  sequencesSnapshot.docs.forEach(doc => {
    exportData.collections.sequences[doc.id] = doc.data();
  });

  // Write to file
  const fs = require('fs');
  const exportPath = './backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

  console.log(`✅ Backup exported to: ${exportPath}`);
  console.log(`📊 Backup contains:`);
  console.log(`   Teams: ${Object.keys(exportData.collections.teams).length}`);
  console.log(`   Players: ${Object.keys(exportData.collections.players).length}`);
  console.log(`   TeamLineups: ${Object.keys(exportData.collections.teamLineups).length}`);
  console.log(`   Matches: ${Object.keys(exportData.collections.matches).length}`);

  return exportPath;
}

// Run the export if this script is executed directly
if (require.main === module) {
  exportAllData()
    .then((backupPath) => {
      console.log(`\n🎉 Backup completed successfully: ${backupPath}`);
      console.log('You can now safely run the migration script.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backup failed:', error);
      process.exit(1);
    });
}

module.exports = { exportAllData };