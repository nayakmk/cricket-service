const fetch = global.fetch || require('node-fetch');

async function testIndividualMatch() {
  try {
    console.log('Testing individual match API...');
    const response = await fetch('http://localhost:8888/api/v2/matches/4');
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testIndividualMatch();