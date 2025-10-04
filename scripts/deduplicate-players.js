const { collections } = require('../config/database');

/**
 * Script to deduplicate players collection
 * Removes duplicate players based on name and keeps the most complete record
 */
async function deduplicatePlayers() {
  try {
    console.log('🔍 Starting player deduplication process...');

    // Get all players
    const playersSnapshot = await collections.players.get();
    const players = [];

    playersSnapshot.forEach(doc => {
      players.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`📊 Found ${players.length} total players`);

    // Group players by name (case-insensitive)
    const playersByName = new Map();

    players.forEach(player => {
      const nameKey = player.name?.toLowerCase()?.trim();
      if (nameKey) {
        if (!playersByName.has(nameKey)) {
          playersByName.set(nameKey, []);
        }
        playersByName.get(nameKey).push(player);
      }
    });

    console.log(`🎯 Found ${playersByName.size} unique player names`);

    // Find duplicates
    const duplicates = [];
    playersByName.forEach((playerGroup, name) => {
      if (playerGroup.length > 1) {
        duplicates.push({
          name: name,
          players: playerGroup
        });
      }
    });

    console.log(`🚨 Found ${duplicates.length} duplicate player groups`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    // Process each duplicate group
    for (const duplicateGroup of duplicates) {
      console.log(`\n🔄 Processing duplicates for: "${duplicateGroup.name}"`);

      const players = duplicateGroup.players;
      console.log(`   Found ${players.length} duplicates:`);
      players.forEach((player, index) => {
        console.log(`   ${index + 1}. ID: ${player.id}, Name: ${player.name}, Active: ${player.isActive}`);
      });

      // Find the best record to keep (most complete data)
      let bestPlayer = players[0];
      let bestScore = 0;

      players.forEach(player => {
        let score = 0;
        if (player.role) score += 1;
        if (player.age) score += 1;
        if (player.battingStyle) score += 1;
        if (player.bowlingStyle) score += 1;
        if (player.nationality) score += 1;
        if (player.avatar) score += 1;
        if (player.isActive !== false) score += 2; // Prefer active players

        if (score > bestScore) {
          bestScore = score;
          bestPlayer = player;
        }
      });

      console.log(`   🏆 Keeping player: ${bestPlayer.id} (${bestPlayer.name})`);

      // Delete duplicates (soft delete by setting isActive to false)
      const playersToDelete = players.filter(p => p.id !== bestPlayer.id);

      for (const playerToDelete of playersToDelete) {
        console.log(`   🗑️  Soft deleting duplicate: ${playerToDelete.id} (${playerToDelete.name})`);

        await collections.players.doc(playerToDelete.id).update({
          isActive: false,
          updatedAt: new Date().toISOString(),
          deduplicated: true,
          originalName: playerToDelete.name
        });
      }
    }

    console.log('\n✅ Player deduplication completed!');

    // Get final count
    const finalSnapshot = await collections.players.where('isActive', '==', true).get();
    console.log(`📊 Final active players count: ${finalSnapshot.size}`);

  } catch (error) {
    console.error('❌ Error during player deduplication:', error);
    throw error;
  }
}

// Run the deduplication if this script is executed directly
if (require.main === module) {
  deduplicatePlayers()
    .then(() => {
      console.log('🎉 Deduplication script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Deduplication script failed:', error);
      process.exit(1);
    });
}

module.exports = { deduplicatePlayers };