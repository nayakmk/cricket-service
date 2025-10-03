const { collections } = require('./config/database');

async function checkTeamsForCompletedMatches() {
  try {
    // Team IDs from completed matches
    const completedTeamIds = [
      'Wa4g5nxRhLoYgeSV9Y9x', // team1 of WKwjNAjqIdvufRzVfYPi
      'ET9cvBAlVGqpQAbDPQya', // team2 of WKwjNAjqIdvufRzVfYPi
      'BCHLU5wGS4dQUIyvKOzq', // team1 of uueFNerflQTAVVBxyrxe
      'sVsZjXAs48LhPE0lJY2g', // team2 of uueFNerflQTAVVBxyrxe
      'bfaH0MO638m0NEwFf4ri', // team1 of vufv7XiBpmIGspl93vtS
      'yDzocf3R995QwQAgt4L8W'  // team2 of vufv7XiBpmIGspl93vtS
    ];

    console.log('Checking teams for completed matches:');
    for (const teamId of completedTeamIds) {
      try {
        const teamDoc = await collections.teams.doc(teamId).get();
        if (teamDoc.exists) {
          const teamData = teamDoc.data();
          console.log(`Team ${teamId} (${teamData.name}): captainId='${teamData.captainId}'`);
        } else {
          console.log(`Team ${teamId}: NOT FOUND`);
        }
      } catch (error) {
        console.log(`Team ${teamId}: ERROR - ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTeamsForCompletedMatches();