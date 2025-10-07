const fs = require('fs');
const path = require('path');

function updateWinnersFromJSON() {
  try {
    console.log('UPDATING WINNERS FROM JSON DATA');
    console.log('================================');

    // Load the JSON data
    const jsonFilePath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_parsed_new_set_v7.json');
    if (!fs.existsSync(jsonFilePath)) {
      console.error(`JSON file not found: ${jsonFilePath}`);
      return;
    }

    const matchesData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    console.log(`Loaded ${matchesData.length} matches from JSON`);

    // Group matches by winner
    const winnerStats = {};

    matchesData.forEach(match => {
      if (match.result && match.result.winner && match.result.winner.trim() !== '') {
        const winner = match.result.winner.trim();
        const margin = match.result.margin || '';

        if (!winnerStats[winner]) {
          winnerStats[winner] = [];
        }

        winnerStats[winner].push({
          matchId: match.match_id,
          opponent: winner === match.teams.team1 ? match.teams.team2 : match.teams.team1,
          margin: margin
        });
      }
    });

    // Display winner statistics
    console.log('\nWINNER STATISTICS:');
    console.log('==================');

    Object.keys(winnerStats).forEach(winner => {
      console.log(`\n${winner}: ${winnerStats[winner].length} wins`);
      winnerStats[winner].forEach(win => {
        console.log(`  vs ${win.opponent} (${win.margin}) - Match ID: ${win.matchId}`);
      });
    });

    // Summary
    const totalMatchesWithWinners = Object.values(winnerStats).reduce((sum, wins) => sum + wins.length, 0);
    console.log(`\nSUMMARY:`);
    console.log(`Total matches with winners: ${totalMatchesWithWinners}`);
    console.log(`Unique winners: ${Object.keys(winnerStats).length}`);

  } catch (error) {
    console.error('Error updating winners from JSON:', error);
  }
}

updateWinnersFromJSON();