const { collections } = require('./config/database');

async function checkMatches() {
  try {
    const matches = await collections.matches.limit(5).get();
    console.log('Sample matches:');
    matches.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Match ${doc.id}: status=${data.status}, winner=${data.winner}, result=${JSON.stringify(data.result)}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkMatches();