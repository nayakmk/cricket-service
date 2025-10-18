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

async function debugPlayerStats() {
  console.log('Checking player career stats...');

  const playersSnapshot = await db.collection('players_v2').get();
  const playersByName = new Map();
  const playersByNumericId = new Map();

  playersSnapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name;
    const numericId = data.numericId;

    if (!playersByName.has(name)) {
      playersByName.set(name, []);
    }
    playersByName.get(name).push({ id: doc.id, data });

    if (!playersByNumericId.has(numericId)) {
      playersByNumericId.set(numericId, []);
    }
    playersByNumericId.get(numericId).push({ id: doc.id, data });
  });

  console.log(`Total players: ${playersSnapshot.size}`);
  console.log(`Unique names: ${playersByName.size}`);
  console.log(`Unique numericIds: ${playersByNumericId.size}`);

  // Check for duplicates
  let duplicatesByName = 0;
  let duplicatesById = 0;

  for (const [name, players] of playersByName) {
    if (players.length > 1) {
      duplicatesByName++;
      console.log(`Duplicate name "${name}": ${players.length} players`);
    }
  }

  for (const [numericId, players] of playersByNumericId) {
    if (players.length > 1) {
      duplicatesById++;
      console.log(`Duplicate numericId "${numericId}": ${players.length} players`);
    }
  }

  console.log(`\nDuplicates by name: ${duplicatesByName}`);
  console.log(`Duplicates by numericId: ${duplicatesById}`);

  // Show career stats for first few players
  let count = 0;
  for (const doc of playersSnapshot.docs.slice(0, 5)) {
    const data = doc.data();
    console.log(`\n---\nPlayer: ${data.name} (${data.numericId})`);
    console.log('Career Stats:', JSON.stringify(data.careerStats, null, 2));
    count++;
    if (count >= 5) break;
  }
}

debugPlayerStats().catch(console.error);