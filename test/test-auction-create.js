// Test auction creation with user's payload
const func = require('../netlify/functions/auctions-v2.js');

const mockEvent = {
  httpMethod: 'POST',
  path: '/api/v2/auctions',
  headers: {},
  body: JSON.stringify({
    tournamentId: 'GEN2025',
    title: 'Cricket Auction - General Tournament',
    auctionConfig: {
      totalBudgetPerTeam: 10000,
      maxPlayersPerTeam: 15,
      minPlayersPerTeam: 11,
      basePricePerPlayer: 500,
      minBidIncrement: 100
    },
    teams: [
      {
        teamId: 1,
        team: {
          teamId: 1,
          name: 'Team Soumyak',
          shortName: 'TS'
        }
      },
      {
        teamId: 2,
        team: {
          teamId: 2,
          name: 'Team Gaurav Tigers',
          shortName: 'TGT'
        }
      },
      {
        teamId: 3,
        team: {
          teamId: 3,
          name: 'Subhajit Sloggers',
          shortName: 'SS'
        }
      },
      {
        teamId: 4,
        team: {
          teamId: 4,
          name: 'Rupraj Riders',
          shortName: 'RR'
        }
      }
    ]
  })
};

const mockContext = {};

async function testAuctionCreation() {
  console.log('Testing auction creation with user payload...');

  try {
    const result = await func.handler(mockEvent, mockContext);
    console.log('✅ Status:', result.statusCode);
    console.log('✅ Response:', JSON.parse(result.body));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAuctionCreation();