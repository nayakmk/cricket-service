// Test Auction System - Comprehensive testing for IPL-style auctions
const { db, V2_COLLECTIONS, V2_SCHEMAS } = require('../config/database-v2');
const { AuctionManager } = require('../utils/auctionManager');
const { AuctionTimer } = require('../utils/auctionTimer');

async function testAuctionSystem() {
  console.log('🧪 Starting Auction System Tests...\n');

  try {
    // Test 1: Create a test auction
    console.log('📝 Test 1: Creating test auction...');
    const testAuctionData = {
      tournamentId: 'tournament_1',
      auctionConfig: {
        totalBudgetPerTeam: 100000,
        maxPlayersPerTeam: 11,
        minPlayersPerTeam: 11,
        basePricePerPlayer: 20000,
        minBidIncrement: 5000,
        totalPlayersAuctioned: 0,
        totalSoldPlayers: 0,
        totalUnsoldPlayers: 0
      },
      teams: [
        {
          teamId: 'team_1',
          team: {
            teamId: 'team_1',
            name: 'Test Team 1',
            shortName: 'TT1'
          },
          totalBudget: 100000,
          remainingBudget: 100000,
          spentBudget: 0,
          playersCount: 0,
          players: []
        },
        {
          teamId: 'team_2',
          team: {
            teamId: 'team_2',
            name: 'Test Team 2',
            shortName: 'TT2'
          },
          totalBudget: 100000,
          remainingBudget: 100000,
          spentBudget: 0,
          playersCount: 0,
          players: []
        }
      ],
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auctionSummary: {
        totalPlayers: 0,
        soldPlayers: 0,
        unsoldPlayers: 0,
        totalAuctionValue: 0,
        averagePlayerPrice: 0,
        highestBid: 0,
        lowestBid: 0,
        mostExpensivePlayer: null,
        teamSpending: []
      },
      soldPlayers: [],
      unsoldPlayers: []
    };

    // Generate auction ID
    const { sequenceManager } = require('../utils/sequenceManager');
    const auctionId = `auction_${await sequenceManager.getNextId('auctions')}`;

    testAuctionData.auctionId = auctionId;

    // Create auction document
    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).set(testAuctionData);
    console.log(`✅ Auction created: ${auctionId}`);

    // Test 2: Start auction
    console.log('\n🚀 Test 2: Starting auction...');
    const startResult = await AuctionManager.startAuction(auctionId);
    console.log('✅ Auction started:', startResult.message);

    // Test 3: Get auction status
    console.log('\n📊 Test 3: Getting auction status...');
    const statusResult = await AuctionManager.getAuctionStatus(auctionId);
    console.log('✅ Auction status:', statusResult.status);
    console.log('Current player:', statusResult.currentPlayer?.player?.name || 'None');

    // Test 4: Place a bid
    console.log('\n💰 Test 4: Placing a bid...');
    const bidData = {
      teamId: 'team_1',
      amount: 25000
    };

    // Simulate bid placement (this would normally come from API)
    const auctionDoc = await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).get();
    const auctionData = auctionDoc.data();

    if (auctionData.currentPlayer) {
      const biddingTeam = auctionData.teams.find(team => team.teamId === bidData.teamId);
      const minBid = auctionData.currentPlayer.currentBid + auctionData.auctionConfig.minBidIncrement;

      if (biddingTeam.remainingBudget >= bidData.amount && bidData.amount >= minBid) {
        await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update({
          'currentPlayer.currentBid': bidData.amount,
          'currentPlayer.biddingTeam': bidData.teamId,
          'currentPlayer.biddingTeamName': biddingTeam.team.name,
          'currentPlayer.timeRemaining': 30,
          updatedAt: new Date().toISOString()
        });

        AuctionTimer.resetTimer(auctionId, 30);
        console.log(`✅ Bid placed: ${bidData.amount} by ${biddingTeam.team.name}`);
      }
    }

    // Test 5: Move to next player
    console.log('\n⏭️  Test 5: Moving to next player...');
    const nextResult = await AuctionManager.nextPlayer(auctionId);
    console.log('✅ Moved to next player:', nextResult.message);

    // Test 6: Pause and resume auction
    console.log('\n⏸️  Test 6: Pausing auction...');
    const pauseResult = await AuctionManager.pauseAuction(auctionId);
    console.log('✅ Auction paused:', pauseResult.message);

    console.log('▶️  Resuming auction...');
    const resumeResult = await AuctionManager.resumeAuction(auctionId);
    console.log('✅ Auction resumed:', resumeResult.message);

    // Test 7: Complete auction (force completion for testing)
    console.log('\n🏁 Test 7: Completing auction...');
    const completeResult = await AuctionManager.completeAuction(auctionId);
    console.log('✅ Auction completed:', completeResult.message);
    console.log('Final summary:', completeResult.summary);

    // Cleanup: Delete test auction
    console.log('\n🧹 Cleaning up test data...');
    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).delete();
    console.log('✅ Test auction deleted');

    console.log('\n🎉 All auction system tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run tests if called directly
if (require.main === module) {
  testAuctionSystem()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuctionSystem };