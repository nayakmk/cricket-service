const { sequenceManager } = require('../utils/sequenceManager');

/**
 * Test script to verify the new document ID generation
 */
async function testDocumentIdGeneration() {
  try {
    console.log('Testing document ID generation...\n');

    // Test matches
    console.log('Matches:');
    for (let i = 0; i < 3; i++) {
      const id = await sequenceManager.generateDocumentId('matches');
      console.log(`  Match ${i + 1}: ${id} (length: ${id.length})`);
    }

    // Test teams
    console.log('\nTeams:');
    for (let i = 0; i < 3; i++) {
      const id = await sequenceManager.generateDocumentId('teams');
      console.log(`  Team ${i + 1}: ${id} (length: ${id.length})`);
    }

    // Test players
    console.log('\nPlayers:');
    for (let i = 0; i < 3; i++) {
      const id = await sequenceManager.generateDocumentId('players');
      console.log(`  Player ${i + 1}: ${id} (length: ${id.length})`);
    }

    console.log('\n✅ Document ID generation test completed successfully!');
    console.log('Format: YYYYMMDDHHMMSS + 7-digit sequence number');
    console.log('Example: 202510041230450000001 (21 characters)');

  } catch (error) {
    console.error('Error testing document ID generation:', error);
    throw error;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDocumentIdGeneration()
    .then(() => {
      console.log('\nTest completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testDocumentIdGeneration };