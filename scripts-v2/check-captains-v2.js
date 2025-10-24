const { db, V2_COLLECTIONS } = require('../config/database-v2');

async function checkCaptainData() {
  try {
    console.log('Checking teams captain data...');
    const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
    console.log(`Found ${teamsSnapshot.size} teams:`);

    teamsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Team: ${data.name}, captainId: ${data.captainId || 'NOT SET'}`);
    });

    console.log('\nChecking matches captain data...');
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).limit(5).get();
    console.log(`Found ${matchesSnapshot.size} matches:`);

    matchesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const team1Captain = data.team1?.squad?.captainName || 'NOT SET';
      const team2Captain = data.team2?.squad?.captainName || 'NOT SET';
      console.log(`Match: ${data.title}, Team1 Captain: ${team1Captain}, Team2 Captain: ${team2Captain}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkCaptainData();