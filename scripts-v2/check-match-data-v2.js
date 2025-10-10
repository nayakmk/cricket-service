const { db } = require('../config/database');

async function checkMatchData() {
  try {
    const matchesRef = db.collection('matches_v2');
    const snapshot = await matchesRef.limit(1).get();

    if (!snapshot.empty) {
      const match = snapshot.docs[0].data();
      console.log('Match data check:');
      console.log('team1Id (top-level):', match.team1Id);
      console.log('team2Id (top-level):', match.team2Id);
      console.log('team1.id:', match.team1?.id);
      console.log('team1.squad.teamId:', match.team1?.squad?.teamId);
      console.log('team1.squadId:', match.team1?.squadId);
      console.log('team2.id:', match.team2?.id);
      console.log('team2.squad.teamId:', match.team2?.squad?.teamId);
      console.log('team2.squadId:', match.team2?.squadId);
      console.log('toss.winnerSquadId:', match.toss?.winnerSquadId);
      console.log('toss.winnerTeamId:', match.toss?.winnerTeamId);
      console.log('result.winnerSquadId:', match.result?.winnerSquadId);
      console.log('result.winnerTeamId:', match.result?.winnerTeamId);
      console.log('team1.squad.captainId:', match.team1?.squad?.captainId);
      console.log('team1.squad.captainName:', match.team1?.squad?.captainName);
      console.log('team2.squad.captainId:', match.team2?.squad?.captainId);
      console.log('team2.squad.captainName:', match.team2?.squad?.captainName);
    } else {
      console.log('No matches found in matches_v2');
    }
  } catch (error) {
    console.error('Error checking match data:', error);
  }

  process.exit(0);
}

checkMatchData();