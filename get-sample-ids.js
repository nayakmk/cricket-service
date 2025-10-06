const { collections } = require('./config/database');

async function getSampleIds() {
  try {
    const teams = await collections.teams.limit(3).get();
    console.log('Sample Team numericIds:');
    teams.forEach(doc => {
      const data = doc.data();
      console.log('Team:', data.name, '- numericId:', data.numericId);
    });

    const players = await collections.players.limit(3).get();
    console.log('\nSample Player numericIds:');
    players.forEach(doc => {
      const data = doc.data();
      console.log('Player:', data.name, '- numericId:', data.numericId);
    });

    const matches = await collections.matches.limit(3).get();
    console.log('\nSample Match numericIds:');
    matches.forEach(doc => {
      const data = doc.data();
      console.log('Match:', data.team1Name, 'vs', data.team2Name, '- numericId:', data.numericId);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

getSampleIds();