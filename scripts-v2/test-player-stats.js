require('dotenv').config();

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

async function testPlayerStatsUpdate() {
  // Get one match
  const matchesSnapshot = await db.collection('matches_v2').limit(1).get();
  if (matchesSnapshot.empty) {
    console.log('No matches found');
    return;
  }

  const matchDoc = matchesSnapshot.docs[0];
  const match = { id: matchDoc.id, ...matchDoc.data() };

  console.log('Testing with match:', match.id);

  // Get the innings for this match
  const inningsSnapshot = await db.collection('innings_v2')
    .where('matchId', '==', match.id)
    .get();

  // Check what innings exist
  const allInningsSnapshot = await db.collection('innings_v2').limit(5).get();
  console.log(`Total innings in collection: ${allInningsSnapshot.size}`);
  if (!allInningsSnapshot.empty) {
    console.log('Sample inning:', JSON.stringify(allInningsSnapshot.docs[0].data(), null, 2));
  }

  // Simulate extractSquadPlayers logic for one team
  const team1Innings = inningsSnapshot.docs.filter(doc => doc.data().teamId === match.teams.team1Id);
  console.log(`Team1 innings: ${team1Innings.length}`);

  if (team1Innings.length > 0) {
    const firstInning = team1Innings[0].data();
    console.log('First inning data:', JSON.stringify(firstInning, null, 2));
  }
}

testPlayerStatsUpdate().catch(console.error);