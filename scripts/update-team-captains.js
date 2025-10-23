const { db, V2_COLLECTIONS } = require('../config/database-v2');

async function examineTeamCaptains() {
  try {
    console.log('🔍 Examining current team captains...\n');

    const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      console.log(`Team: ${teamData.name} (${teamData.displayId})`);
      console.log(`  Current Captain: ${teamData.captain?.name || 'None'}`);
      console.log(`  Captain ID: ${teamData.captainId || 'None'}`);

      // Get players in this team
      if (teamData.players && teamData.players.length > 0) {
        console.log('  Players in team:');
        for (const playerRef of teamData.players) {
          if (playerRef.player && playerRef.player.name) {
            console.log(`    - ${playerRef.player.name} (${playerRef.playerId})`);
          }
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error examining teams:', error);
  }
}

async function updateTeamCaptains() {
  try {
    console.log('🔄 Updating team captains based on matching player names...\n');

    const teamsSnapshot = await db.collection(V2_COLLECTIONS.TEAMS).get();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamName = teamData.name ? teamData.name.toLowerCase() : '';

      console.log(`Processing team: ${teamData.name || 'Unnamed Team'} (${teamData.displayId || 'No ID'})`);

      // Skip if team name is undefined or empty
      if (!teamName || teamName.trim() === '') {
        console.log(`  ⚠️  Skipping team with undefined/empty name`);
        skippedCount++;
        console.log('');
        continue;
      }

      // Check if captain is already properly set
      if (teamData.captain && teamData.captain.name) {
        console.log(`  ℹ️  Team already has captain: ${teamData.captain.name}`);
        skippedCount++;
        console.log('');
        continue;
      }

      // Find players in this team whose name appears in the team name
      let matchingPlayer = null;
      if (teamData.players && teamData.players.length > 0) {
        // Extract potential captain names from team name
        const teamNameParts = teamName.split(' ').filter(part => part.length > 2);

        for (const playerRef of teamData.players) {
          if (playerRef.player && playerRef.player.name) {
            const playerName = playerRef.player.name.toLowerCase();

            // Check various matching criteria
            let isMatch = false;

            // 1. Player name is contained in team name
            if (teamName.includes(playerName)) {
              isMatch = true;
            }

            // 2. Team name contains player name (check each word)
            if (!isMatch) {
              for (const part of teamNameParts) {
                if (playerName.includes(part) || part.includes(playerName)) {
                  isMatch = true;
                  break;
                }
              }
            }

            // 3. Check first names match
            if (!isMatch) {
              const playerFirstName = playerName.split(' ')[0];
              const teamFirstWord = teamNameParts[0];
              if (playerFirstName === teamFirstWord || teamFirstWord.includes(playerFirstName) || playerFirstName.includes(teamFirstWord)) {
                isMatch = true;
              }
            }

            if (isMatch) {
              matchingPlayer = playerRef;
              console.log(`  ✅ Found matching player: ${playerRef.player.name}`);
              break;
            }
          }
        }
      }

      if (matchingPlayer) {
        // Update captain information
        const updateData = {
          captainId: matchingPlayer.playerId,
          captain: {
            playerId: matchingPlayer.playerId,
            name: matchingPlayer.player.name,
            role: matchingPlayer.player.role || 'batsman'
          },
          updatedAt: new Date()
        };

        await db.collection(V2_COLLECTIONS.TEAMS).doc(teamDoc.id).update(updateData);
        console.log(`  ✅ Updated captain to: ${matchingPlayer.player.name}`);
        updatedCount++;
      } else {
        console.log(`  ⚠️  No matching player found for team: ${teamData.name}`);
        console.log(`     Team name parts: ${teamNameParts.join(', ')}`);
        console.log(`     Available players: ${teamData.players ? teamData.players.map(p => p.player?.name).filter(n => n).join(', ') : 'None'}`);
        skippedCount++;
      }

      console.log('');
    }

    console.log(`\n✅ Successfully updated ${updatedCount} teams with captain information`);
    console.log(`⏭️  Skipped ${skippedCount} teams (already had captains or no matches found)`);

  } catch (error) {
    console.error('Error updating team captains:', error);
  }
}

// Run the examination first, then ask user if they want to proceed with updates
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--examine')) {
    await examineTeamCaptains();
  } else if (args.includes('--update')) {
    await updateTeamCaptains();
  } else {
    console.log('Usage:');
    console.log('  --examine : Examine current team captains');
    console.log('  --update  : Update team captains based on matching player names');
  }
}

main().catch(console.error);