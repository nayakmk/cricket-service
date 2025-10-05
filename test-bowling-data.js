const fetch = require('node-fetch');

async function checkPlayerMatchData() {
  try {
    console.log('CHECKING PLAYER MATCH DATA FOR BOWLING FIGURES');
    console.log('================================================');

    const playerId = '202510050943150000094';

    const response = await fetch('http://localhost:8888/api/players/' + playerId + '/matches', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    console.log('API Response Status:', response.status);

    if (result.data && result.data.matches) {
      console.log('Total matches found:', result.data.matches.length);

      result.data.matches.slice(0, 3).forEach((match, index) => {
        console.log(`\nMatch ${index + 1}:`);
        console.log('  Match ID:', match.matchId);
        console.log('  Has bowling data:', !!match.bowling);
        if (match.bowling) {
          console.log('  Bowling data:', JSON.stringify(match.bowling, null, 2));
        } else {
          console.log('  No bowling data found');
        }
        console.log('  Has batting data:', !!match.batting);
        if (match.batting) {
          console.log('  Batting data:', JSON.stringify(match.batting, null, 2));
        }
      });

      console.log('\nSUMMARY:');
      console.log('Total wickets in summary:', result.data.summary.totalWickets);
      console.log('Total runs in summary:', result.data.summary.totalRuns);
    } else {
      console.log('No match data found in response');
      console.log('Full response:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.log('Error checking player match data:', error);
  }
}

checkPlayerMatchData();