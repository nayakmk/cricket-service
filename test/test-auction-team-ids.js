// Test auction creation with proper team ID generation
async function testAuctionWithProperTeamIds() {
  console.log('🧪 Testing auction creation with proper team ID generation...\n');

  // Import the auction function directly
  const auctionHandler = require('../netlify/functions/auctions-v2');

  const testPayload = {
    title: "Test Auction - Proper Team IDs",
    description: "Testing standalone auction with proper team ID generation",
    teams: [
      {
        team: {
          name: "Team Alpha",
          shortName: "ALP"
        }
      },
      {
        team: {
          name: "Team Beta",
          shortName: "BET"
        }
      }
    ],
    players: [
      {
        id: "player_001",
        name: "Player One",
        basePrice: 10000,
        category: "batsman"
      }
    ],
    auctionSettings: {
      startingBid: 10000,
      bidIncrement: 5000,
      maxPlayersPerTeam: 11,
      auctionTimeLimit: 30
    }
  };

  try {
    console.log('📤 Creating auction...');

    // Mock the event object that Netlify functions expect
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify(testPayload),
      headers: {
        'content-type': 'application/json'
      }
    };

    const response = await auctionHandler.handler(mockEvent);

    if (response.statusCode !== 201) {
      throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
    }

    const data = JSON.parse(response.body);

    console.log('✅ Auction created successfully!');
    console.log('📊 Response data:');
    console.log('- id (document ID):', data.data?.id);
    console.log('- auctionId (formatted):', data.data?.auctionId);
    console.log('- displayId:', data.data?.displayId);
    console.log('- title:', data.data?.title);
    console.log('- teams count:', data.data?.teams?.length || 0);

    // Check team IDs
    if (data.data?.teams && data.data.teams.length > 0) {
      console.log('\n🔍 Checking team IDs...');
      data.data.teams.forEach((team, index) => {
        console.log(`Team ${index + 1}:`);
        console.log(`- teamId: ${team.teamId}`);
        console.log(`- numericId: ${team.numericId}`);
        console.log(`- displayId: ${team.displayId}`);
        console.log(`- name: ${team.team.name}`);

        // Verify team ID format
        if (team.teamId && team.teamId.startsWith('team_') && team.teamId.split('_').length === 3) {
          console.log('✅ Team ID format is correct');
        } else {
          console.log('❌ Team ID format is incorrect');
        }

        if (team.numericId && team.numericId.length >= 19 && /^\d+$/.test(team.numericId)) {
          console.log('✅ Team numeric ID is valid');
        } else {
          console.log('❌ Team numeric ID is invalid');
        }
      });
    }

    // Check if auction was actually saved to database
    if (data.data?.auctionId) {
      console.log('\n🔍 Checking database...');
      const { db, V2_COLLECTIONS } = require('../config/database-v2');
      const snapshot = await db.collection(V2_COLLECTIONS.AUCTIONS).where('auctionId', '==', data.data.auctionId).get();

      if (!snapshot.empty) {
        const savedAuction = snapshot.docs[0].data();
        console.log('✅ Auction saved in database:');
        console.log('- Document ID:', snapshot.docs[0].id);
        console.log('- auctionId:', savedAuction.auctionId);
        console.log('- teams count:', savedAuction.teams?.length || 0);

        // Check team details
        if (savedAuction.teams && savedAuction.teams.length > 0) {
          console.log('\n🔍 Team details from database:');
          savedAuction.teams.forEach((team, index) => {
            console.log(`Team ${index + 1}:`);
            console.log(`- teamId: ${team.teamId}`);
            console.log(`- numericId: ${team.numericId}`);
            console.log(`- displayId: ${team.displayId}`);
            console.log(`- name: ${team.team.name}`);

            // Verify team ID format
            if (team.teamId && team.teamId.startsWith('team_') && team.teamId.split('_').length === 3) {
              console.log('✅ Team ID format is correct');
            } else {
              console.log('❌ Team ID format is incorrect');
            }
          });
        }
      } else {
        console.log('❌ Auction not found in database');
      }
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuctionWithProperTeamIds();