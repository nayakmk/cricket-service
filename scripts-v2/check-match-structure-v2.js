const { db } = require('./config/database');

async function checkMatch() {
  try {
    const matchesRef = db.collection('matches_v2');
    const snapshot = await matchesRef.limit(1).get();

    if (!snapshot.empty) {
      const match = snapshot.docs[0].data();
      console.log('Match structure:');
      console.log(JSON.stringify({
        id: match.id,
        teams: {
          team1: {
            name: match.team1?.name,
            playersCount: match.team1?.players?.length || 0,
            score: match.team1?.score
          },
          team2: {
            name: match.team2?.name,
            playersCount: match.team2?.players?.length || 0,
            score: match.team2?.score
          }
        }
      }, null, 2));

      if (match.team1?.players?.length > 0) {
        console.log('\nSample player from team1:');
        console.log(JSON.stringify(match.team1.players[0], null, 2));
      }
    } else {
      console.log('No matches found');
    }
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkMatch();