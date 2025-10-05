const fetch = require('node-fetch');

async function checkMatchesData() {
  try {
    console.log('CHECKING MATCHES DATA');
    console.log('====================');

    const response = await fetch('http://localhost:8888/api/matches', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    console.log('Matches API Response Status:', response.status);

    if (result.data && result.data.length > 0) {
      console.log('Total matches found:', result.data.length);

      // Check first few matches
      result.data.slice(0, 3).forEach((match, index) => {
        console.log(`\nMatch ${index + 1}:`);
        console.log('  Match ID:', match.id);
        console.log('  Status:', match.status);
        console.log('  Has innings:', !!match.innings);
        if (match.innings) {
          console.log('  Innings count:', match.innings.length);
        }
      });
    } else {
      console.log('No matches found');
      console.log('Full response:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.log('Error checking matches data:', error);
  }
}

checkMatchesData();