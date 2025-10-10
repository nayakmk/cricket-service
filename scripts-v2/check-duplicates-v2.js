const admin = require('firebase-admin');
require('dotenv').config();

if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

async function checkDuplicates() {
  console.log('Checking for duplicates in v2 collections...\n');

  // Check teams_v2 for duplicates
  console.log('Checking teams_v2...');
  const teamsSnapshot = await db.collection('teams_v2').get();
  const teams = [];
  teamsSnapshot.forEach(doc => {
    teams.push({ id: doc.id, ...doc.data() });
  });

  const teamNames = new Map();
  const teamShortNames = new Map();
  const duplicateTeamNames = [];
  const duplicateTeamShortNames = [];

  teams.forEach(team => {
    // Check duplicate names
    if (teamNames.has(team.name)) {
      duplicateTeamNames.push({
        name: team.name,
        ids: [teamNames.get(team.name), team.id]
      });
    } else {
      teamNames.set(team.name, team.id);
    }

    // Check duplicate short names
    if (teamShortNames.has(team.shortName)) {
      duplicateTeamShortNames.push({
        shortName: team.shortName,
        ids: [teamShortNames.get(team.shortName), team.id]
      });
    } else {
      teamShortNames.set(team.shortName, team.id);
    }
  });

  console.log(`Total teams: ${teams.length}`);
  if (duplicateTeamNames.length > 0) {
    console.log('Duplicate team names:');
    duplicateTeamNames.forEach(dup => console.log(`  - "${dup.name}": ${dup.ids.join(', ')}`));
  } else {
    console.log('✓ No duplicate team names');
  }

  if (duplicateTeamShortNames.length > 0) {
    console.log('Duplicate team short names:');
    duplicateTeamShortNames.forEach(dup => console.log(`  - "${dup.shortName}": ${dup.ids.join(', ')}`));
  } else {
    console.log('✓ No duplicate team short names');
  }

  // Check players_v2 for duplicates
  console.log('\nChecking players_v2...');
  const playersSnapshot = await db.collection('players_v2').get();
  const players = [];
  playersSnapshot.forEach(doc => {
    players.push({ id: doc.id, ...doc.data() });
  });

  const playerNames = new Map();
  const playerEmails = new Map();
  const duplicatePlayerNames = [];
  const duplicatePlayerEmails = [];

  players.forEach(player => {
    // Check duplicate names
    if (playerNames.has(player.name)) {
      duplicatePlayerNames.push({
        name: player.name,
        ids: [playerNames.get(player.name), player.id]
      });
    } else {
      playerNames.set(player.name, player.id);
    }

    // Check duplicate emails
    if (player.email && playerEmails.has(player.email)) {
      duplicatePlayerEmails.push({
        email: player.email,
        ids: [playerEmails.get(player.email), player.id]
      });
    } else if (player.email) {
      playerEmails.set(player.email, player.id);
    }
  });

  console.log(`Total players: ${players.length}`);
  if (duplicatePlayerNames.length > 0) {
    console.log('Duplicate player names:');
    duplicatePlayerNames.forEach(dup => console.log(`  - "${dup.name}": ${dup.ids.join(', ')}`));
  } else {
    console.log('✓ No duplicate player names');
  }

  if (duplicatePlayerEmails.length > 0) {
    console.log('Duplicate player emails:');
    duplicatePlayerEmails.forEach(dup => console.log(`  - "${dup.email}": ${dup.ids.join(', ')}`));
  } else {
    console.log('✓ No duplicate player emails');
  }

  // Check matches_v2 for duplicates
  console.log('\nChecking matches_v2...');
  const matchesSnapshot = await db.collection('matches_v2').get();
  const matches = [];
  matchesSnapshot.forEach(doc => {
    matches.push({ id: doc.id, ...doc.data() });
  });

  const matchDisplayIds = new Map();
  const duplicateMatchDisplayIds = [];

  matches.forEach(match => {
    // Check duplicate display IDs
    if (matchDisplayIds.has(match.displayId)) {
      duplicateMatchDisplayIds.push({
        displayId: match.displayId,
        ids: [matchDisplayIds.get(match.displayId), match.id]
      });
    } else {
      matchDisplayIds.set(match.displayId, match.id);
    }
  });

  console.log(`Total matches: ${matches.length}`);
  if (duplicateMatchDisplayIds.length > 0) {
    console.log('Duplicate match display IDs:');
    duplicateMatchDisplayIds.forEach(dup => console.log(`  - "${dup.displayId}": ${dup.ids.join(', ')}`));
  } else {
    console.log('✓ No duplicate match display IDs');
  }

  // Check subcollections for duplicates
  console.log('\nChecking subcollections...');

  let totalSquads = 0;
  let totalInnings = 0;
  let totalPlayerStats = 0;

  for (const match of matches) {
    // Check squads subcollection
    const squadsSnapshot = await db.collection('matches_v2').doc(match.id).collection('squads').get();
    totalSquads += squadsSnapshot.size;

    // Check innings subcollection
    const inningsSnapshot = await db.collection('matches_v2').doc(match.id).collection('innings').get();
    totalInnings += inningsSnapshot.size;

    // Check playerStats subcollection
    const playerStatsSnapshot = await db.collection('matches_v2').doc(match.id).collection('playerStats').get();
    totalPlayerStats += playerStatsSnapshot.size;
  }

  console.log(`Total squads across all matches: ${totalSquads}`);
  console.log(`Total innings across all matches: ${totalInnings}`);
  console.log(`Total player stats across all matches: ${totalPlayerStats}`);

  // Summary
  const hasDuplicates =
    duplicateTeamNames.length > 0 ||
    duplicateTeamShortNames.length > 0 ||
    duplicatePlayerNames.length > 0 ||
    duplicatePlayerEmails.length > 0 ||
    duplicateMatchDisplayIds.length > 0;

  console.log('\n=== DUPLICATE CHECK SUMMARY ===');
  if (hasDuplicates) {
    console.log('❌ Duplicates found in v2 collections!');
    console.log(`- Teams: ${duplicateTeamNames.length} name duplicates, ${duplicateTeamShortNames.length} short name duplicates`);
    console.log(`- Players: ${duplicatePlayerNames.length} name duplicates, ${duplicatePlayerEmails.length} email duplicates`);
    console.log(`- Matches: ${duplicateMatchDisplayIds.length} display ID duplicates`);
  } else {
    console.log('✅ No duplicates found in v2 collections!');
  }
}

checkDuplicates().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});