// Auction Manager - IPL-style auction system utilities
const { db, V2_COLLECTIONS } = require('../config/database-v2');
const admin = require('firebase-admin');

class AuctionManager {
  // Start auction
  static async startAuction(auctionId) {
    const auctionDoc = await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).get();
    if (!auctionDoc.exists) {
      throw new Error('Auction not found');
    }

    const auctionData = auctionDoc.data();
    if (auctionData.status !== 'scheduled') {
      throw new Error('Auction is not in scheduled state');
    }

    // Get all available players for the tournament
    const playersSnapshot = await db.collection(V2_COLLECTIONS.PLAYERS)
      .where('preferredTeamId', 'in', auctionData.teams.map(team => team.teamId))
      .get();

    const availablePlayers = [];
    for (const playerDoc of playersSnapshot.docs) {
      const playerData = playerDoc.data();
      availablePlayers.push({
        playerId: playerData.numericId.toString(),
        player: {
          playerId: playerData.numericId.toString(),
          name: playerData.name,
          role: playerData.role
        },
        basePrice: auctionData.auctionConfig.basePricePerPlayer,
        status: 'available'
      });
    }

    // Shuffle players for random order
    const shuffledPlayers = availablePlayers.sort(() => Math.random() - 0.5);

    const updateObject = {
      status: 'active',
      startedAt: new Date().toISOString(),
      availablePlayers: shuffledPlayers,
      currentPlayerIndex: 0,
      currentPlayer: shuffledPlayers[0] ? {
        ...shuffledPlayers[0],
        currentBid: shuffledPlayers[0].basePrice,
        biddingTeam: null,
        biddingTeamName: null,
        timeRemaining: 30,
        bidStartTime: new Date().toISOString()
      } : null,
      updatedAt: new Date().toISOString()
    };

    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update(updateObject);

    return {
      success: true,
      message: 'Auction started successfully',
      currentPlayer: updateObject.currentPlayer
    };
  }

  // Move to next player
  static async nextPlayer(auctionId) {
    const auctionDoc = await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).get();
    if (!auctionDoc.exists) {
      throw new Error('Auction not found');
    }

    const auctionData = auctionDoc.data();
    if (auctionData.status !== 'active') {
      throw new Error('Auction is not active');
    }

    const currentIndex = auctionData.currentPlayerIndex || 0;
    const availablePlayers = auctionData.availablePlayers || [];

    // Handle current player (sold or unsold)
    if (auctionData.currentPlayer) {
      const currentPlayer = auctionData.currentPlayer;

      if (currentPlayer.biddingTeam) {
        // Player was sold
        const soldPlayer = {
          playerId: currentPlayer.playerId,
          player: currentPlayer.player,
          basePrice: currentPlayer.basePrice,
          finalPrice: currentPlayer.currentBid,
          soldTo: currentPlayer.biddingTeam,
          soldToTeamName: currentPlayer.biddingTeamName,
          soldAt: new Date().toISOString(),
          bidHistory: [] // Would be populated with actual bid history
        };

        // Update team's budget and players
        const teams = auctionData.teams.map(team => {
          if (team.teamId === currentPlayer.biddingTeam) {
            return {
              ...team,
              remainingBudget: team.remainingBudget - currentPlayer.currentBid,
              spentBudget: team.spentBudget + currentPlayer.currentBid,
              playersCount: team.playersCount + 1,
              players: [...team.players, {
                playerId: currentPlayer.playerId,
                player: currentPlayer.player,
                basePrice: currentPlayer.basePrice,
                finalPrice: currentPlayer.currentBid,
                purchasedAt: new Date().toISOString()
              }]
            };
          }
          return team;
        });

        const updateObject = {
          [`soldPlayers`]: admin.firestore.FieldValue.arrayUnion(soldPlayer),
          teams: teams,
          updatedAt: new Date().toISOString()
        };

        await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update(updateObject);
      } else {
        // Player was unsold
        const unsoldPlayer = {
          playerId: currentPlayer.playerId,
          player: currentPlayer.player,
          basePrice: currentPlayer.basePrice,
          status: 'unsold',
          unsoldAt: new Date().toISOString()
        };

        await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update({
          [`unsoldPlayers`]: admin.firestore.FieldValue.arrayUnion(unsoldPlayer),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Move to next player
    const nextIndex = currentIndex + 1;

    if (nextIndex >= availablePlayers.length) {
      // Auction completed
      return this.completeAuction(auctionId);
    }

    const nextPlayer = {
      ...availablePlayers[nextIndex],
      currentBid: availablePlayers[nextIndex].basePrice,
      biddingTeam: null,
      biddingTeamName: null,
      timeRemaining: 30,
      bidStartTime: new Date().toISOString()
    };

    const updateObject = {
      currentPlayerIndex: nextIndex,
      currentPlayer: nextPlayer,
      updatedAt: new Date().toISOString()
    };

    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update(updateObject);

    return {
      success: true,
      message: 'Moved to next player',
      currentPlayer: nextPlayer
    };
  }

  // Complete auction
  static async completeAuction(auctionId) {
    const auctionDoc = await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).get();
    if (!auctionDoc.exists) {
      throw new Error('Auction not found');
    }

    const auctionData = auctionDoc.data();

    // Calculate final summary
    const soldPlayers = auctionData.soldPlayers || [];
    const unsoldPlayers = auctionData.unsoldPlayers || [];
    const totalAuctionValue = soldPlayers.reduce((sum, player) => sum + player.finalPrice, 0);
    const averagePlayerPrice = soldPlayers.length > 0 ? totalAuctionValue / soldPlayers.length : 0;
    const highestBid = soldPlayers.length > 0 ? Math.max(...soldPlayers.map(p => p.finalPrice)) : 0;
    const lowestBid = soldPlayers.length > 0 ? Math.min(...soldPlayers.map(p => p.finalPrice)) : 0;

    const mostExpensivePlayer = soldPlayers.length > 0 ?
      soldPlayers.reduce((prev, current) => (prev.finalPrice > current.finalPrice) ? prev : current) : null;

    const teamSpending = auctionData.teams.map(team => ({
      teamId: team.teamId,
      teamName: team.team.name,
      totalSpent: team.spentBudget,
      averageSpentPerPlayer: team.playersCount > 0 ? team.spentBudget / team.playersCount : 0,
      playersCount: team.playersCount
    }));

    const updateObject = {
      status: 'completed',
      completedAt: new Date().toISOString(),
      'auctionConfig.totalPlayersAuctioned': soldPlayers.length + unsoldPlayers.length,
      'auctionConfig.totalSoldPlayers': soldPlayers.length,
      'auctionConfig.totalUnsoldPlayers': unsoldPlayers.length,
      'auctionSummary.totalPlayers': soldPlayers.length + unsoldPlayers.length,
      'auctionSummary.soldPlayers': soldPlayers.length,
      'auctionSummary.unsoldPlayers': unsoldPlayers.length,
      'auctionSummary.totalAuctionValue': totalAuctionValue,
      'auctionSummary.averagePlayerPrice': averagePlayerPrice,
      'auctionSummary.highestBid': highestBid,
      'auctionSummary.lowestBid': lowestBid,
      'auctionSummary.mostExpensivePlayer': mostExpensivePlayer,
      'auctionSummary.teamSpending': teamSpending,
      currentPlayer: null,
      updatedAt: new Date().toISOString()
    };

    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update(updateObject);

    return {
      success: true,
      message: 'Auction completed successfully',
      summary: {
        totalPlayers: soldPlayers.length + unsoldPlayers.length,
        soldPlayers: soldPlayers.length,
        unsoldPlayers: unsoldPlayers.length,
        totalAuctionValue: totalAuctionValue,
        averagePlayerPrice: averagePlayerPrice,
        highestBid: highestBid,
        lowestBid: lowestBid,
        mostExpensivePlayer: mostExpensivePlayer,
        teamSpending: teamSpending
      }
    };
  }

  // Get auction status
  static async getAuctionStatus(auctionId) {
    const auctionDoc = await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).get();
    if (!auctionDoc.exists) {
      throw new Error('Auction not found');
    }

    const auctionData = auctionDoc.data();

    return {
      auctionId: auctionData.auctionId,
      status: auctionData.status,
      currentPlayer: auctionData.currentPlayer,
      teams: auctionData.teams,
      auctionSummary: auctionData.auctionSummary,
      timeRemaining: auctionData.currentPlayer ? auctionData.currentPlayer.timeRemaining : 0
    };
  }

  // Pause auction
  static async pauseAuction(auctionId) {
    const updateObject = {
      status: 'paused',
      updatedAt: new Date().toISOString()
    };

    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update(updateObject);

    return {
      success: true,
      message: 'Auction paused successfully'
    };
  }

  // Resume auction
  static async resumeAuction(auctionId) {
    const updateObject = {
      status: 'active',
      updatedAt: new Date().toISOString()
    };

    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update(updateObject);

    return {
      success: true,
      message: 'Auction resumed successfully'
    };
  }
}

module.exports = { AuctionManager };