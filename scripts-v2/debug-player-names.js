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
const { V2_COLLECTIONS } = require('../config/database-v2');

async function debugPlayerLookup() {
  console.log('Checking players in database...');

  const playersSnapshot = await db.collection(V2_COLLECTIONS.PLAYERS).get();
  const dbPlayerNames = new Set();

  playersSnapshot.forEach(doc => {
    const data = doc.data();
    dbPlayerNames.add(data.name);
  });

  console.log(`Found ${dbPlayerNames.size} players in database`);
  console.log('Sample player names:', Array.from(dbPlayerNames).slice(0, 10));

  // Load match data
  const fs = require('fs');
  const matches = JSON.parse(fs.readFileSync('./reports/cricket_matches_from_pdfs_final.json', 'utf8'));

  const matchPlayerNames = new Set();
  for (const match of matches.slice(0, 5)) { // Check first 5 matches
    for (const inning of match.innings || []) {
      for (const batsman of inning.batting || []) {
        if (batsman.name) matchPlayerNames.add(batsman.name);
      }
      for (const bowler of inning.bowling || []) {
        if (bowler.name) matchPlayerNames.add(bowler.name);
      }
    }
  }

  console.log(`Found ${matchPlayerNames.size} player names in match data`);
  console.log('Sample match player names:', Array.from(matchPlayerNames).slice(0, 10));

  // Find mismatches
  const missingInDb = new Set();
  const extraInDb = new Set();

  for (const name of matchPlayerNames) {
    if (!dbPlayerNames.has(name)) {
      missingInDb.add(name);
    }
  }

  for (const name of dbPlayerNames) {
    if (!matchPlayerNames.has(name)) {
      extraInDb.add(name);
    }
  }

  console.log(`\nPlayers in matches but not in DB: ${missingInDb.size}`);
  if (missingInDb.size > 0) {
    console.log(Array.from(missingInDb).slice(0, 10));
  }

  console.log(`\nPlayers in DB but not in matches: ${extraInDb.size}`);
  if (extraInDb.size > 0) {
    console.log(Array.from(extraInDb).slice(0, 10));
  }
}

debugPlayerLookup().catch(console.error);