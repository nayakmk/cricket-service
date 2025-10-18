const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));

// Check match 18363760
const match = data.find(m => m.match_id === '18363760');
console.log('Match 18363760:');
console.log('Teams:', match.teams);

match.innings.forEach((inning, i) => {
  console.log(`Inning ${i+1} (${inning.team}):`);
  inning.batting.forEach(batsman => {
    if (batsman.name === 'Sundar Raman') {
      console.log(`  ${batsman.name}: ${batsman.runs} runs`);
    }
  });
});

// Check if Sundar Raman appears in both teams
console.log('\nSundar Raman in team1 players:');
if (match.team1?.players) {
  match.team1.players.forEach(player => {
    if (player.name === 'Sundar Raman') {
      console.log(`  Found in team1: ${JSON.stringify(player)}`);
    }
  });
}

console.log('Sundar Raman in team2 players:');
if (match.team2?.players) {
  match.team2.players.forEach(player => {
    if (player.name === 'Sundar Raman') {
      console.log(`  Found in team2: ${JSON.stringify(player)}`);
    }
  });
}