// Local test of auction function
const func = require('../netlify/functions/auctions-v2.js');

const mockEvent = {
  httpMethod: 'GET',
  path: '/.netlify/functions/auctions-v2/health',
  headers: {},
  body: null
};

const mockContext = {};

async function testLocal() {
  console.log('Testing auction function locally...');

  try {
    const result = await func.handler(mockEvent, mockContext);
    console.log('✅ Function executed successfully:');
    console.log('Status:', result.statusCode);
    console.log('CORS Origin:', result.headers['Access-Control-Allow-Origin']);
    console.log('CORS Methods:', result.headers['Access-Control-Allow-Methods']);
    console.log('Body preview:', result.body.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Function failed:', error);
    console.error('Error details:', error.message);
  }
}

testLocal();