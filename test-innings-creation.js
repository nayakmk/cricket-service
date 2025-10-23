const fs = require('fs');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

// Test innings creation for one match
async function testInningsCreation() {
  const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));
  const match = data[0]; // First match

  console.log('Match:', match.match_id);
  console.log('Teams:', match.teams);
  console.log('Innings teams:', match.innings?.map(i => i.team));

  // Mock team data structure
  const team1Data = {
    teamId: '1000000000000000001',
    data: { name: match.teams.team1 }
  };

  const team2Data = {
    teamId: '1000000000000000002',
    data: { name: match.teams.team2 }
  };

  // Test innings lookup
  const team1Innings = match.innings?.find(innings =>
    innings.team === team1Data.data.name ||
    innings.battingTeam === team1Data.data.name
  );

  const team2Innings = match.innings?.find(innings =>
    innings.team === team2Data.data.name ||
    innings.battingTeam === team2Data.data.name
  );

  console.log('Team1 innings found:', !!team1Innings);
  console.log('Team2 innings found:', !!team2Innings);

  if (team1Innings) {
    console.log('Team1 innings score:', team1Innings.score);
    console.log('Team1 batting count:', team1Innings.batting?.length);
  }

  if (team2Innings) {
    console.log('Team2 innings score:', team2Innings.score);
    console.log('Team2 batting count:', team2Innings.batting?.length);
  }
}

testInningsCreation().catch(console.error);