const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase with environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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
const db = admin.firestore();

async function checkPlayers() {
  console.log('Checking migrated data...\n');

  // Check players collection
  const playersRef = db.collection('players_v2');
  const playersSnapshot = await playersRef.limit(10).get();

  console.log('Sample players from players_v2 collection:');
  playersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.name} (preferredTeam: ${data.preferredTeam || 'none'})`);
  });

  // Check a match with detailed player analysis
  const matchesRef = db.collection('matches_v2');
  const matchSnapshot = await matchesRef.limit(1).get();

  matchSnapshot.forEach(doc => {
    const match = doc.data();
    console.log(`\nMatch: ${match.title}`);
    console.log(`Team1 (${match.team1.name}): ${match.team1.players.length} players`);
    console.log(`Team2 (${match.team2.name}): ${match.team2.players.length} players`);

    // Check for duplicates within teams
    const team1Names = match.team1.players.map(p => p.name);
    const team1Duplicates = team1Names.filter((name, index) => team1Names.indexOf(name) !== index);
    
    const team2Names = match.team2.players.map(p => p.name);
    const team2Duplicates = team2Names.filter((name, index) => team2Names.indexOf(name) !== index);

    console.log(`\nTeam1 duplicates: ${team1Duplicates.length > 0 ? team1Duplicates.join(', ') : 'none'}`);
    console.log(`Team2 duplicates: ${team2Duplicates.length > 0 ? team2Duplicates.join(', ') : 'none'}`);

    // Show all players from each team
    console.log('\nTeam1 ALL players:');
    match.team1.players.forEach(p => console.log(` - ${p.name} (${p.role})`));

    console.log('\nTeam2 ALL players:');
    match.team2.players.forEach(p => console.log(` - ${p.name} (${p.role})`));

    // Check if any players appear in both teams
    const commonPlayers = team1Names.filter(name => team2Names.includes(name));
    console.log(`\nPlayers in both teams: ${commonPlayers.length > 0 ? commonPlayers.join(', ') : 'none'}`);
  });

  process.exit(0);
}

checkPlayers().catch(console.error);