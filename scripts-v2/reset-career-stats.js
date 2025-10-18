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

async function resetCareerStats() {
  console.log('Resetting career stats to 0...');

  const playersRef = db.collection('players_v2');
  const snapshot = await playersRef.get();

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const playerData = doc.data();
    if (playerData.careerStats) {
      batch.update(doc.ref, {
        careerStats: {
          batting: { matchesPlayed: 0, runs: 0, highestScore: 0, average: 0, strikeRate: 0, centuries: 0, fifties: 0, ducks: 0, notOuts: 0 },
          bowling: { matchesPlayed: 0, wickets: 0, average: 0, economyRate: 0, strikeRate: 0, bestBowling: '0/0', fiveWicketHauls: 0, hatTricks: 0 },
          fielding: { catches: 0, runOuts: 0, stumpings: 0 },
          overall: { matchesPlayed: 0, wins: 0, losses: 0, winPercentage: 0 }
        },
        recentMatches: [],
        recentTeams: []
      });
      count++;
    }
  });

  await batch.commit();
  console.log(`Reset career stats for ${count} players`);
}

resetCareerStats().catch(console.error);