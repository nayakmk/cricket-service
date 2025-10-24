// Check if auction was saved
const { db, V2_COLLECTIONS } = require('../config/database-v2');

async function checkAuction() {
  console.log('Checking created auction in database...');

  try {
    const snapshot = await db.collection(V2_COLLECTIONS.AUCTIONS).where('auctionId', '==', 'auction_2025_004').get();

    if (snapshot.empty) {
      console.log('❌ Auction not found in database');
    } else {
      const auction = snapshot.docs[0].data();
      console.log('✅ Auction found:', {
        auctionId: auction.auctionId,
        title: auction.title,
        status: auction.status,
        teamsCount: auction.teams.length,
        tournamentId: auction.tournamentId
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuction();