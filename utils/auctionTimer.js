// Auction Timer - Manages bidding timers for IPL-style auctions
const { db, V2_COLLECTIONS } = require('../config/database-v2');

class AuctionTimer {
  static timers = new Map(); // auctionId -> timer object

  // Start timer for current player
  static startTimer(auctionId, duration = 30) {
    this.stopTimer(auctionId); // Stop any existing timer

    const timer = {
      auctionId,
      duration,
      remaining: duration,
      interval: setInterval(async () => {
        try {
          await this.tickTimer(auctionId);
        } catch (error) {
          console.error('Timer tick error:', error);
          this.stopTimer(auctionId);
        }
      }, 1000),
      startTime: Date.now()
    };

    this.timers.set(auctionId, timer);
    return timer;
  }

  // Stop timer for auction
  static stopTimer(auctionId) {
    const timer = this.timers.get(auctionId);
    if (timer) {
      clearInterval(timer.interval);
      this.timers.delete(auctionId);
    }
  }

  // Tick timer (called every second)
  static async tickTimer(auctionId) {
    const timer = this.timers.get(auctionId);
    if (!timer) return;

    timer.remaining--;

    // Update auction document with remaining time
    await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).update({
      'currentPlayer.timeRemaining': timer.remaining,
      updatedAt: new Date().toISOString()
    });

    // Timer expired
    if (timer.remaining <= 0) {
      this.stopTimer(auctionId);
      await this.handleTimerExpired(auctionId);
    }
  }

  // Handle timer expiration
  static async handleTimerExpired(auctionId) {
    try {
      const auctionDoc = await db.collection(V2_COLLECTIONS.AUCTIONS).doc(auctionId).get();
      if (!auctionDoc.exists) return;

      const auctionData = auctionDoc.data();

      if (auctionData.currentPlayer && auctionData.currentPlayer.biddingTeam) {
        // Player sold to current bidder
        const { AuctionManager } = require('./auctionManager');
        await AuctionManager.nextPlayer(auctionId);
      } else {
        // No bids, move to next player
        const { AuctionManager } = require('./auctionManager');
        await AuctionManager.nextPlayer(auctionId);
      }
    } catch (error) {
      console.error('Error handling timer expiration:', error);
    }
  }

  // Reset timer (when new bid is placed)
  static resetTimer(auctionId, newDuration = 30) {
    const timer = this.timers.get(auctionId);
    if (timer) {
      timer.remaining = newDuration;
      timer.duration = newDuration;
      timer.startTime = Date.now();
    } else {
      this.startTimer(auctionId, newDuration);
    }
  }

  // Get timer status
  static getTimerStatus(auctionId) {
    const timer = this.timers.get(auctionId);
    if (!timer) return null;

    return {
      auctionId,
      remaining: timer.remaining,
      duration: timer.duration,
      elapsed: Math.floor((Date.now() - timer.startTime) / 1000)
    };
  }

  // Cleanup all timers (for server shutdown)
  static cleanup() {
    for (const [auctionId, timer] of this.timers) {
      clearInterval(timer.interval);
    }
    this.timers.clear();
  }

  // Pause timer
  static pauseTimer(auctionId) {
    const timer = this.timers.get(auctionId);
    if (timer) {
      clearInterval(timer.interval);
      timer.paused = true;
    }
  }

  // Resume timer
  static resumeTimer(auctionId) {
    const timer = this.timers.get(auctionId);
    if (timer && timer.paused) {
      timer.paused = false;
      timer.interval = setInterval(async () => {
        try {
          await this.tickTimer(auctionId);
        } catch (error) {
          console.error('Timer tick error:', error);
          this.stopTimer(auctionId);
        }
      }, 1000);
    }
  }
}

module.exports = { AuctionTimer };