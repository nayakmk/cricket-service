const http = require('http');

// Test pagination for teams API
async function testPagination() {
  const BASE_URL = 'http://localhost:8888/api';

  try {
    // Test teams API with pagination
    console.log('Testing teams API with pagination...');

    const response = await makeRequest(`${BASE_URL}/teams?page=1&limit=5`);
    console.log('Teams API Response:');
    console.log('Status:', response.status);
    console.log('Data count:', response.data?.data?.length || 0);
    console.log('Pagination:', response.data?.pagination);
    console.log('---');

    // Test matches API with pagination
    console.log('Testing matches API with pagination...');
    const matchesResponse = await makeRequest(`${BASE_URL}/matches?page=1&limit=5`);
    console.log('Matches API Response:');
    console.log('Status:', matchesResponse.status);
    console.log('Data count:', matchesResponse.data?.data?.length || 0);
    console.log('Pagination:', matchesResponse.data?.pagination);
    console.log('---');

    // Test players API with pagination
    console.log('Testing players API with pagination...');
    const playersResponse = await makeRequest(`${BASE_URL}/players?page=1&limit=5`);
    console.log('Players API Response:');
    console.log('Status:', playersResponse.status);
    console.log('Data count:', playersResponse.data?.data?.length || 0);
    console.log('Pagination:', playersResponse.data?.pagination);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

testPagination();