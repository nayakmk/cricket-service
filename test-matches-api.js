const fetch = global.fetch || require('node-fetch');

async function testMatchesAPI() {
  try {
    console.log('Testing matches API...');

    const response = await fetch('http://localhost:8888/api/v2/matches?status=completed&limit=1');
    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (data.success && data.data && data.data.length > 0) {
      const match = data.data[0];
      console.log('\nMatch details:');
      console.log('ID:', match.id);
      console.log('Status:', match.status);
      console.log('Team1 squad players:', match.team1?.squad?.players?.length || 0);
      console.log('Team2 squad players:', match.team2?.squad?.players?.length || 0);

      if (match.team1?.squad?.players && match.team1.squad.players.length > 0) {
        console.log('Sample Team1 player:', JSON.stringify(match.team1.squad.players[0], null, 2));
        if (match.team1.squad.players[0].impactScore) {
          console.log('Team1 player impactScore type:', typeof match.team1.squad.players[0].impactScore);
          if (typeof match.team1.squad.players[0].impactScore === 'object') {
            console.log('Team1 player impactScore structure:', Object.keys(match.team1.squad.players[0].impactScore));
          }
        }
      }

      if (match.team2?.squad?.players && match.team2.squad.players.length > 0) {
        console.log('Sample Team2 player:', JSON.stringify(match.team2.squad.players[0], null, 2));
        if (match.team2.squad.players[0].impactScore) {
          console.log('Team2 player impactScore type:', typeof match.team2.squad.players[0].impactScore);
          if (typeof match.team2.squad.players[0].impactScore === 'object') {
            console.log('Team2 player impactScore structure:', Object.keys(match.team2.squad.players[0].impactScore));
          }
        }
      }

      // Check result structure
      console.log('\nResult structure:');
      console.log('Result:', JSON.stringify(match.result, null, 2));

      if (match.result && match.result.winner) {
        console.log('Winner type:', typeof match.result.winner);
        if (typeof match.result.winner === 'object') {
          console.log('Winner has id:', !!match.result.winner.id);
          console.log('Winner has name:', !!match.result.winner.name);
          console.log('Winner has shortName:', !!match.result.winner.shortName);
        }
      }
    } else {
      console.log('No matches found or API error');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testMatchesAPI();