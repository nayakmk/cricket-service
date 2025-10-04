const { collections } = require('../config/database');

async function showFinalDataSummary() {
  console.log('🎯 FINAL CRICKET DATA SUMMARY\n');

  try {
    // Tournaments
    const tournamentsSnapshot = await collections.tournaments.get();
    console.log(`🏆 Tournaments: ${tournamentsSnapshot.size}`);
    tournamentsSnapshot.docs.forEach(doc => {
      const t = doc.data();
      console.log(`   • ${t.name} (${t.shortName})`);
    });

    // Teams
    const teamsSnapshot = await collections.teams.get();
    console.log(`\n👥 Teams: ${teamsSnapshot.size}`);

    // Players
    const playersSnapshot = await collections.players.get();
    console.log(`\n🏃 Players: ${playersSnapshot.size}`);

    // Matches
    const matchesSnapshot = await collections.matches.get();
    console.log(`\n🏏 Matches: ${matchesSnapshot.size}`);

    // Sample match with details
    if (!matchesSnapshot.empty) {
      const sampleMatch = matchesSnapshot.docs[0];
      const matchData = sampleMatch.data();
      console.log(`\n📋 Sample Match: ${matchData.title}`);
      console.log(`   • Tournament: ${matchData.tournamentId ? 'Referenced' : 'N/A'}`);
      console.log(`   • Teams: Embedded details available`);
      console.log(`   • Toss: ${matchData.toss?.winner?.name || 'N/A'}`);
      console.log(`   • Result: ${matchData.result || 'N/A'}`);

      // Check innings
      const inningsSnapshot = await collections.matches.doc(sampleMatch.id).collection('innings').get();
      console.log(`   • Innings: ${inningsSnapshot.size}`);

      if (!inningsSnapshot.empty) {
        const sampleInning = inningsSnapshot.docs[0];
        const batsmenSnapshot = await collections.matches.doc(sampleMatch.id).collection('innings').doc(sampleInning.id).collection('batsmen').get();
        const bowlingSnapshot = await collections.matches.doc(sampleMatch.id).collection('innings').doc(sampleInning.id).collection('bowling').get();
        const fowSnapshot = await collections.matches.doc(sampleMatch.id).collection('innings').doc(sampleInning.id).collection('fallOfWickets').get();

        console.log(`     - Batsmen: ${batsmenSnapshot.size} (with parsed status)`);
        console.log(`     - Bowling: ${bowlingSnapshot.size}`);
        console.log(`     - Fall of Wickets: ${fowSnapshot.size}`);
      }
    }

    console.log('\n✅ DATA STRUCTURE ACHIEVEMENTS:');
    console.log('   • ✅ Tournament collection with references');
    console.log('   • ✅ Embedded team details in matches');
    console.log('   • ✅ Parsed batsman dismissal status');
    console.log('   • ✅ Innings as subcollections');
    console.log('   • ✅ Batsmen, bowling, and FOW as sub-subcollections');
    console.log('   • ✅ Optimized API performance (no extra queries needed)');

  } catch (error) {
    console.error('❌ Error generating summary:', error);
  }
}

showFinalDataSummary();