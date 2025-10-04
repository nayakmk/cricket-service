const { collections } = require('../config/database');
const readline = require('readline');

async function mergeDuplicatePlayers() {
  console.log('🔄 Starting player deduplication process...');

  // Get all players
  const playersSnapshot = await collections.players.get();
  const players = [];
  playersSnapshot.forEach(doc => {
    players.push({
      id: doc.id,
      ref: doc.ref,
      ...doc.data()
    });
  });

  console.log(`📊 Found ${players.length} total players`);

  // Create manual merge mappings for known duplicates
  const manualMerges = {
    // "sundar raman" -> "sundar"
    "202510040918210000048": "202510040918160000022", // Sundar Raman -> Sundar
    // "Abinash Subudhi (c)" -> "Abinash Subudhi"
    "202510040918290000079": "202510040918120000010", // Abinash Subudhi (c) -> Abinash Subudhi
    // Test cases for interactive demo
    "202510040918170000030": "202510040918240000060", // Ashutosh Sahoo (c) -> Ashutosh Sahoo
    "202510040918170000029": "202510040918220000051", // SUBHAJIT SARKAR -> Subajit
  };

  // Group by normalized name (remove spaces and special chars)
  const nameGroups = {};
  players.forEach(player => {
    const normalizedName = player.name ? player.name.toLowerCase().replace(/[^a-z]/g, '') : '';
    if (!nameGroups[normalizedName]) {
      nameGroups[normalizedName] = [];
    }
    nameGroups[normalizedName].push(player);
  });

  // Find groups with multiple players
  const duplicates = [];
  Object.keys(nameGroups).forEach(normalizedName => {
    if (nameGroups[normalizedName].length > 1) {
      duplicates.push({
        normalizedName,
        players: nameGroups[normalizedName]
      });
    }
  });

  console.log(`🔍 Found ${duplicates.length} groups of potential duplicates`);

  // Interactive selection for additional merges
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function askQuestion(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  // Display potential duplicates and allow selection
  console.log('\n🔍 Potential duplicate groups found:');
  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    console.log(`\n${i + 1}. Group: "${group.players[0].name}" (${group.players.length} players)`);
    group.players.forEach((player, idx) => {
      const checkbox = idx === 0 ? '[✓]' : '[ ]';
      console.log(`   ${checkbox} ${idx + 1}. ${player.name} (ID: ${player.id})`);
    });
  }

  if (duplicates.length > 0) {
    console.log('\n💡 To merge players, enter the group number and player numbers to merge.');
    console.log('   Example: "1:2,3" means merge players 2 and 3 from group 1');
    console.log('   Example: "1:all" means merge all duplicates in group 1');
    console.log('   Enter "done" when finished selecting merges.');

    const interactiveMerges = [];

    while (true) {
      const answer = await askQuestion('\nEnter merge selection (or "done"): ');

      if (answer.toLowerCase() === 'done') {
        break;
      }

      // Parse input like "1:2,3" or "1:all"
      const parts = answer.split(':');
      if (parts.length !== 2) {
        console.log('❌ Invalid format. Use "group:players" format.');
        continue;
      }

      const groupIndex = parseInt(parts[0]) - 1;
      const playerSpec = parts[1];

      if (groupIndex < 0 || groupIndex >= duplicates.length) {
        console.log('❌ Invalid group number.');
        continue;
      }

      const group = duplicates[groupIndex];
      let playersToMerge = [];

      if (playerSpec.toLowerCase() === 'all') {
        // Merge all duplicates (keep first one)
        playersToMerge = group.players.slice(1);
      } else {
        // Parse specific player numbers like "2,3"
        const playerNumbers = playerSpec.split(',').map(n => parseInt(n.trim()) - 1);
        playersToMerge = playerNumbers
          .filter(idx => idx > 0 && idx < group.players.length) // Skip index 0 (primary player)
          .map(idx => group.players[idx]);
      }

      if (playersToMerge.length === 0) {
        console.log('❌ No valid players selected for merging.');
        continue;
      }

      // Add to interactive merges
      playersToMerge.forEach(player => {
        interactiveMerges.push({
          groupIndex,
          oldPlayer: player,
          newPlayer: group.players[0] // Keep the first player
        });
      });

      console.log(`✅ Added ${playersToMerge.length} players to merge into "${group.players[0].name}"`);
    }

    // Add interactive merges to duplicates array
    interactiveMerges.forEach(merge => {
      const existingGroup = duplicates.find(g => g.players.includes(merge.newPlayer));
      if (existingGroup) {
        // Add to existing group if not already there
        if (!existingGroup.players.includes(merge.oldPlayer)) {
          existingGroup.players.push(merge.oldPlayer);
        }
      } else {
        // Create new group
        duplicates.push({
          normalizedName: `interactive-${merge.newPlayer.id}`,
          players: [merge.newPlayer, merge.oldPlayer]
        });
      }
    });
  }

  rl.close();

  let totalMerged = 0;
  let totalReferencesUpdated = 0;

  // Only process groups that have duplicates to merge (more than 1 player)
  const groupsToProcess = duplicates.filter(group => group.players.length > 1);

  console.log(`\n🔄 Processing ${groupsToProcess.length} groups with duplicates to merge...`);

  for (const group of groupsToProcess) {
    console.log(`\nProcessing group: ${group.players[0].name} (${group.players.length} players)`);

    // Sort by ID to keep the first one (deterministic)
    group.players.sort((a, b) => a.id.localeCompare(b.id));
    const keepPlayer = group.players[0];
    const duplicatePlayers = group.players.slice(1);

    console.log(`Keeping player: ${keepPlayer.id} (${keepPlayer.name})`);
    console.log(`Merging ${duplicatePlayers.length} duplicates...`);

    // Create mapping for this merge
    const mergeMapping = {};
    duplicatePlayers.forEach(player => {
      mergeMapping[player.id] = keepPlayer.id;
    });

    // Update references in teamLineups
    const teamLineupsSnapshot = await collections.teamLineups.get();
    let teamLineupUpdates = 0;

    for (const lineupDoc of teamLineupsSnapshot.docs) {
      const lineupData = lineupDoc.data();
      let needsUpdate = false;
      const updatedData = { ...lineupData };

      // Update playerIds array
      if (lineupData.playerIds && Array.isArray(lineupData.playerIds)) {
        updatedData.playerIds = lineupData.playerIds.map(playerId =>
          mergeMapping[playerId] || playerId
        );
        if (JSON.stringify(updatedData.playerIds) !== JSON.stringify(lineupData.playerIds)) {
          needsUpdate = true;
        }
      }

      // Update playingXI array
      if (lineupData.playingXI && Array.isArray(lineupData.playingXI)) {
        updatedData.playingXI = lineupData.playingXI.map(playerId =>
          mergeMapping[playerId] || playerId
        );
        if (JSON.stringify(updatedData.playingXI) !== JSON.stringify(lineupData.playingXI)) {
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await collections.teamLineups.doc(lineupDoc.id).update(updatedData);
        teamLineupUpdates++;
      }
    }

    console.log(`Updated ${teamLineupUpdates} team lineups`);

    // Update references in innings data
    const matchesSnapshot = await collections.matches.get();
    let inningsUpdates = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const inningsSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').get();

      for (const inningDoc of inningsSnapshot.docs) {
        // Update batsmen
        const batsmenSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').get();
        for (const batsmanDoc of batsmenSnapshot.docs) {
          const batsmanData = batsmanDoc.data();
          if (batsmanData.player && mergeMapping[batsmanData.player]) {
            await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('batsmen').doc(batsmanDoc.id).update({
              player: mergeMapping[batsmanData.player]
            });
            inningsUpdates++;
          }
        }

        // Update bowling
        const bowlingSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').get();
        for (const bowlingDoc of bowlingSnapshot.docs) {
          const bowlingData = bowlingDoc.data();
          if (bowlingData.player && mergeMapping[bowlingData.player]) {
            await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('bowling').doc(bowlingDoc.id).update({
              player: mergeMapping[bowlingData.player]
            });
            inningsUpdates++;
          }
        }

        // Update fall of wickets
        const fowSnapshot = await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('fallOfWickets').get();
        for (const fowDoc of fowSnapshot.docs) {
          const fowData = fowDoc.data();
          if (fowData.playerOut && mergeMapping[fowData.playerOut]) {
            await collections.matches.doc(matchDoc.id).collection('innings').doc(inningDoc.id).collection('fallOfWickets').doc(fowDoc.id).update({
              playerOut: mergeMapping[fowData.playerOut]
            });
            inningsUpdates++;
          }
        }
      }
    }

    console.log(`Updated ${inningsUpdates} innings references`);

    // Delete duplicate players
    for (const duplicatePlayer of duplicatePlayers) {
      await collections.players.doc(duplicatePlayer.id).delete();
      console.log(`Deleted duplicate player: ${duplicatePlayer.id} (${duplicatePlayer.name})`);
    }

    totalMerged += duplicatePlayers.length;
    totalReferencesUpdated += teamLineupUpdates + inningsUpdates;
  }

  console.log(`\nDeduplication complete!`);
  console.log(`Merged ${totalMerged} duplicate players`);
  console.log(`Updated ${totalReferencesUpdated} references across collections`);
}

// Run the merge process
mergeDuplicatePlayers().catch(console.error);