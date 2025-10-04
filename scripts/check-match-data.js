const { collections } = require('../config/database');

async function checkMatch() {
  try {
    const matchDoc = await collections.matches.doc('202510042150500000036').get();
    if (matchDoc.exists) {
      const data = matchDoc.data();
      console.log('Match data structure:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('Match not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkMatch();