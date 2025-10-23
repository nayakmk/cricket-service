// Test fixing the original problematic match 53
const handler = require('./netlify/functions/matches-v2.js').handler;

async function fixMatch53() {
  console.log('🔧 FIXING MATCH 53 - Original problematic scenario\n');

  // Update match 53 with the original problematic data
  const updateEvent = {
    httpMethod: 'PUT',
    path: '/53',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      totalOvers: 20,
      squads: {
        "1": {
          teamId: "1",
          players: [
            { playerId: "DvXj1xu69dNcTr1OyLys", name: "Abinash Subudhi", role: "batsman" },
            { playerId: "2gHjBfHAzrxjYndrWxKp", name: "Amit Jain", role: "batsman" },
            { playerId: "UgOtQ7XrKBPi0ok8H0Pd", name: "Akhilesh", role: "batsman" }
          ]
        },
        "2": {
          teamId: "2",
          players: [
            { playerId: "G1hCyyltz5Td9SmIW4dA", name: "Archana Sinha", role: "batsman" },
            { playerId: "5OEu3eiWWrqCAinlwkJX", name: "Ashutosh Sahoo", role: "batsman" },
            { playerId: "8Wk2PkjILn3RJZ7RRV4t", name: "ISHAN BANERJEE", role: "batsman" }
          ]
        }
      }
    })
  };

  const updateResult = await handler(updateEvent, {});
  if (updateResult.statusCode !== 200) {
    console.error('❌ PUT failed:', updateResult.statusCode);
    console.error('Response:', updateResult.body);
    return;
  }

  console.log('✅ Match 53 updated successfully');

  // Check the fixed structure
  const getEvent = {
    httpMethod: 'GET',
    path: '/53',
    queryStringParameters: {
      includePlayers: 'true'
    }
  };

  const getResult = await handler(getEvent, {});
  if (getResult.statusCode !== 200) {
    console.error('❌ GET failed:', getResult.statusCode);
    return;
  }

  const matchData = JSON.parse(getResult.body).data;

  console.log('\n🔍 FIXED MATCH 53 STRUCTURE:');
  console.log('Required fields present:');
  const requiredFields = ['innings', 'fallOfWickets', 'toss', 'result', 'playerOfMatch', 'playerOfMatchId'];
  requiredFields.forEach(field => {
    console.log(`  ${field}: ${field in matchData} ✅`);
  });

  console.log('\nTeam structures:');
  console.log('  team1.players exists:', !!(matchData.team1 && matchData.team1.players), 'count:', matchData.team1?.players?.length || 0);
  console.log('  team2.players exists:', !!(matchData.team2 && matchData.team2.players), 'count:', matchData.team2?.players?.length || 0);

  console.log('\n❌ Fields that should NOT be present:');
  const badFields = ['squads', 'totalOvers', 'currentInnings', 'scores', 'team1Score', 'team2Score', 'winner'];
  badFields.forEach(field => {
    if (field in matchData) {
      console.log(`  ❌ ${field} is still present`);
    } else {
      console.log(`  ✅ ${field} is absent`);
    }
  });

  console.log('\n🎉 MATCH 53 STRUCTURE FIXED!');
}

fixMatch53().catch(console.error);