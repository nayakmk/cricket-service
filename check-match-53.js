// Check if match 53 exists
const handler = require('./netlify/functions/matches-v2.js').handler;

async function checkMatch53() {
  const event = {
    httpMethod: 'GET',
    path: '/53'
  };

  const result = await handler(event, {});
  console.log('Status:', result.statusCode);
  if (result.statusCode === 200) {
    console.log('Match 53 exists');
  } else {
    console.log('Match 53 not found:', result.body);
  }
}

checkMatch53().catch(console.error);