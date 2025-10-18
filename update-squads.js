const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function updateSquadDocuments() {
  try {
    console.log('Updating squad documents with top-level matchId and teamId...');

    const squadsSnapshot = await db.collection(V2_COLLECTIONS.MATCH_SQUADS).get();
    console.log(`Found ${squadsSnapshot.docs.length} squad documents`);

    const batch = db.batch();
    let updateCount = 0;

    for (const doc of squadsSnapshot.docs) {
      const squadData = doc.data();

      // Check if top-level fields are missing
      if (!squadData.matchId || !squadData.teamId) {
        const updates = {};

        if (!squadData.matchId && squadData.match?.matchId) {
          updates.matchId = squadData.match.matchId;
        }

        if (!squadData.teamId && squadData.team?.teamId) {
          updates.teamId = squadData.team.teamId;
        }

        if (Object.keys(updates).length > 0) {
          batch.update(doc.ref, updates);
          updateCount++;
        }
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`Updated ${updateCount} squad documents`);
    } else {
      console.log('No squad documents needed updating');
    }

  } catch (error) {
    console.error('Error updating squad documents:', error);
  }
}

updateSquadDocuments();