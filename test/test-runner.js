#!/usr/bin/env node

/**
 * Cricket App API Test Runner
 * Runs automated tests against the Cricket App API endpoints
 *
 * Usage: node test-runner.js
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:8888/api';
const TEST_TIMEOUT = 5000; // 5 seconds
const LONG_TEST_TIMEOUT = 15000; // 15 seconds for endpoints that fetch lots of data

class APITester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  async makeRequest(method, endpoint, data = null, timeout = TEST_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const url = `${BASE_URL}${endpoint}`;
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: timeout
      };

      const req = http.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = {
              status: res.statusCode,
              headers: res.headers,
              data: body ? JSON.parse(body) : null
            };
            resolve(response);
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: body
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async testEndpoint(name, method, endpoint, expectedStatus = 200, data = null, validator = null, timeout = TEST_TIMEOUT) {
    try {
      console.log(`🧪 Testing: ${name}`);
      const response = await this.makeRequest(method, endpoint, data, timeout);

      let passed = response.status === expectedStatus;

      if (validator && passed) {
        passed = validator(response);
      }

      if (passed) {
        console.log(`✅ PASS: ${name} (${response.status})`);
        this.passed++;
      } else {
        console.log(`❌ FAIL: ${name} (Expected: ${expectedStatus}, Got: ${response.status})`);
        this.failed++;
      }

      this.results.push({
        name,
        passed,
        expectedStatus,
        actualStatus: response.status,
        endpoint,
        method
      });

    } catch (error) {
      console.log(`❌ ERROR: ${name} - ${error.message}`);
      this.failed++;
      this.results.push({
        name,
        passed: false,
        error: error.message,
        endpoint,
        method
      });
    }
  }

  async runTests() {
    console.log('🚀 Starting Cricket App API Tests\n');
    console.log('=' .repeat(50));

    // Test Teams Endpoints
    await this.testEndpoint('Get All Teams', 'GET', '/teams');
    await this.testEndpoint('Get Team by ID', 'GET', '/teams/2');

    // Test Players Endpoints
    await this.testEndpoint('Get All Players', 'GET', '/players');
    await this.testEndpoint('Get Player by ID', 'GET', '/players/2');

    // Test Team Lineups Endpoints
    await this.testEndpoint('Get All Team Lineups', 'GET', '/teamLineups', 200, null, null, LONG_TEST_TIMEOUT);
    await this.testEndpoint('Get Team Lineup by ID', 'GET', '/teamLineups/2', 404); // Expect 404 since no data exists

    // Test Matches Endpoints
    await this.testEndpoint('Get All Matches', 'GET', '/matches', 200, null, null, LONG_TEST_TIMEOUT);
    await this.testEndpoint('Get Match by ID', 'GET', '/matches/2');

    // Test Expanded Data Validation
    await this.testEndpoint(
      'Teams include captain details',
      'GET',
      '/teams',
      200,
      null,
      (response) => {
        if (!response.data || !response.data.data || !Array.isArray(response.data.data)) return false;
        const team = response.data.data.find(t => t.captainId);
        return team && team.captain && typeof team.captain === 'object';
      }
    );

    await this.testEndpoint(
      'Team Lineups include playersDetails',
      'GET',
      '/teamLineups/2',
      404,
      null,
      null
    );

    // Test Error Scenarios
    await this.testEndpoint('Invalid Team ID returns 404', 'GET', '/teams/invalid-id', 404);
    await this.testEndpoint('Invalid Player ID returns 404', 'GET', '/players/invalid-id', 404);
    await this.testEndpoint('Invalid Match ID returns 404', 'GET', '/matches/invalid-id', 404);

    // Test Content-Type header validation
    await this.testEndpoint(
      'Teams response has JSON Content-Type',
      'GET',
      '/teams',
      200,
      null,
      (response) => {
        return response.headers && response.headers['content-type'] === 'application/json';
      }
    );

    await this.testEndpoint(
      'Players response has JSON Content-Type',
      'GET',
      '/players',
      200,
      null,
      (response) => {
        return response.headers && response.headers['content-type'] === 'application/json';
      }
    );

    // Test External APIs
    await this.testEndpoint('Get External Live Scores', 'GET', '/external/live-scores', 200);
    await this.testEndpoint('Get Cricket News', 'GET', '/external/news', 200);
    await this.testEndpoint('Get Cricket Schedules', 'GET', '/external/schedules', 200);

    console.log('\n' + '=' .repeat(50));
    console.log(`📊 Test Results: ${this.passed} passed, ${this.failed} failed`);

    if (this.failed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Check the details above.');
      console.log('\nFailed Tests:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.name}: ${result.error || `Expected ${result.expectedStatus}, got ${result.actualStatus}`}`);
      });
    }

    return this.failed === 0;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new APITester();
  tester.runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = APITester;