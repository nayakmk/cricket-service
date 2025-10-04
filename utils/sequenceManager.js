const { collections, db } = require('../config/database');

/**
 * Sequence manager for generating numeric IDs
 * Maintains counters for different collections to provide user-friendly numeric identifiers
 */
class SequenceManager {
  constructor() {
    this.sequences = {};
  }

  /**
   * Generate a formatted document ID with timestamp + sequence
   * Format: YYYYMMDDHHMMSS + 7-digit sequence (minimum 10 characters total)
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<string>} Formatted document ID
   */
  async generateDocumentId(collectionName) {
    try {
      // Get current timestamp in YYYYMMDDHHMMSS format
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
                       (now.getMonth() + 1).toString().padStart(2, '0') +
                       now.getDate().toString().padStart(2, '0') +
                       now.getHours().toString().padStart(2, '0') +
                       now.getMinutes().toString().padStart(2, '0') +
                       now.getSeconds().toString().padStart(2, '0');

      // Get next sequence number for this collection
      const sequence = await this.getNextId(collectionName);

      // Format sequence as 7-digit number (ensures minimum length)
      const sequenceStr = sequence.toString().padStart(7, '0');

      // Combine timestamp + sequence = minimum 19 characters (YYYYMMDDHHMMSS = 14 + 0000001 = 7 = 21 total)
      const documentId = timestamp + sequenceStr;

      return documentId;
    } catch (error) {
      console.error(`Error generating document ID for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get next numeric ID for a collection
   * @param {string} collectionName - Name of the collection (e.g., 'matches', 'teams', 'players')
   * @returns {Promise<number>} Next numeric ID
   */
  async getNextId(collectionName) {
    try {
      const sequenceRef = collections.sequences.doc(collectionName);

      // Use Firestore transaction to ensure atomicity
      const result = await db.runTransaction(async (transaction) => {
        const sequenceDoc = await transaction.get(sequenceRef);

        let currentValue = 0;
        if (sequenceDoc.exists) {
          currentValue = sequenceDoc.data().currentValue || 0;
        }

        const nextValue = currentValue + 1;

        // Update the sequence
        transaction.set(sequenceRef, {
          currentValue: nextValue,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        return nextValue;
      });

      return result;
    } catch (error) {
      console.error(`Error getting next ID for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get current sequence value for a collection (without incrementing)
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<number>} Current sequence value
   */
  async getCurrentId(collectionName) {
    try {
      const sequenceDoc = await collections.sequences.doc(collectionName).get();

      if (sequenceDoc.exists) {
        return sequenceDoc.data().currentValue || 0;
      }

      return 0;
    } catch (error) {
      console.error(`Error getting current ID for ${collectionName}:`, error);
      return 0;
    }
  }

  /**
   * Initialize sequence for a collection if it doesn't exist
   * @param {string} collectionName - Name of the collection
   * @param {number} startValue - Starting value (default: 0)
   */
  async initializeSequence(collectionName, startValue = 0) {
    try {
      const sequenceRef = collections.sequences.doc(collectionName);
      const sequenceDoc = await sequenceRef.get();

      if (!sequenceDoc.exists) {
        await sequenceRef.set({
          currentValue: startValue,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log(`Initialized sequence for ${collectionName} starting at ${startValue}`);
      }
    } catch (error) {
      console.error(`Error initializing sequence for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Reset sequence for a collection
   * @param {string} collectionName - Name of the collection
   * @param {number} resetValue - Value to reset to (default: 0)
   */
  async resetSequence(collectionName, resetValue = 0) {
    try {
      await collections.sequences.doc(collectionName).set({
        currentValue: resetValue,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`Reset sequence for ${collectionName} to ${resetValue}`);
    } catch (error) {
      console.error(`Error resetting sequence for ${collectionName}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
const sequenceManager = new SequenceManager();

module.exports = {
  SequenceManager,
  sequenceManager
};