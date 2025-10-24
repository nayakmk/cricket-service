const { db, V2_COLLECTIONS } = require('./config/database-v2');

async function updateSquadMatchIds() {
  try {
    console.log('Updating squad matchIds to use numericIds...');

    // First, build the mapping from externalReferenceId to numericId
    const matchesSnapshot = await db.collection(V2_COLLECTIONS.MATCHES).get();
    const idMap = {};
    matchesSnapshot.docs.forEach(doc => {
      const matchData = doc.data();
      if (matchData.externalReferenceId) {
        idMap[matchData.externalReferenceId.toString()] = matchData.numericId;
      }
    });

    console.log(`Built mapping for ${Object.keys(idMap).length} matches`);

    // Get all squads
    const squadsSnapshot = await db.collection(V2_COLLECTIONS.MATCH_SQUADS).get();
    console.log(`Found ${squadsSnapshot.docs.length} squads`);

    const batch = db.batch();
    let updateCount = 0;

    for (const doc of squadsSnapshot.docs) {
      const squadData = doc.data();
      let newMatchId = null;

      // If squad has old-style matchId (shorter number), map it
      if (squadData.matchId && idMap[squadData.matchId]) {
        newMatchId = idMap[squadData.matchId];
      }
      // If squad already has a long numericId, check if it matches a match
      else if (squadData.matchId && squadData.matchId.length > 10) {
        // Check if this numericId exists in matches
        const matchDoc = matchesSnapshot.docs.find(doc => doc.data().numericId === squadData.matchId);
        if (!matchDoc) {
          console.log(`Squad has invalid matchId: ${squadData.matchId}`);
        }
      }

      if (newMatchId) {
        batch.update(doc.ref, { matchId: newMatchId });
        updateCount++;
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`Updated ${updateCount} squads with correct matchIds`);
    } else {
      console.log('No squads needed matchId updates');
    }

  } catch (error) {
    console.error('Error updating squad matchIds:', error);
  }
}

updateSquadMatchIds();