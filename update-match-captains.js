const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function updateMatchCaptains() {
  console.log('🔄 Updating match captain names...');

  try {
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).get();
    console.log(`Found ${matchesSnapshot.size} matches to update`);

    const batch = db.batch();
    let updateCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();

      // Skip if captain names are already proper (not "Captain" or "TBD")
      const team1Captain = matchData.team1?.squad?.captainName;
      const team2Captain = matchData.team2?.squad?.captainName;

      if (team1Captain === 'Captain' || team1Captain === 'TBD' ||
          team2Captain === 'Captain' || team2Captain === 'TBD') {

        // Try to find captain from team players
        let newTeam1Captain = team1Captain;
        let newTeam2Captain = team2Captain;

        // Look for captain in team1 players
        if (matchData.team1?.players) {
          for (const player of matchData.team1.players) {
            if (player.isCaptain) {
              newTeam1Captain = player.name;
              break;
            }
          }
        }

        // Look for captain in team2 players
        if (matchData.team2?.players) {
          for (const player of matchData.team2.players) {
            if (player.isCaptain) {
              newTeam2Captain = player.name;
              break;
            }
          }
        }

        // Update if we found better captain names
        if (newTeam1Captain !== team1Captain || newTeam2Captain !== team2Captain) {
          const updatedMatch = {
            ...matchData,
            team1: {
              ...matchData.team1,
              squad: {
                ...matchData.team1.squad,
                captainName: newTeam1Captain
              }
            },
            team2: {
              ...matchData.team2,
              squad: {
                ...matchData.team2.squad,
                captainName: newTeam2Captain
              }
            }
          };

          batch.update(matchDoc.ref, updatedMatch);
          updateCount++;
          console.log(`✅ Updated match ${matchData.title}: ${team1Captain} → ${newTeam1Captain}, ${team2Captain} → ${newTeam2Captain}`);
        }
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} matches with proper captain names`);
    } else {
      console.log('ℹ️ No matches needed updating');
    }

  } catch (error) {
    console.error('❌ Error updating match captains:', error);
  }
}

updateMatchCaptains();