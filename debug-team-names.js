const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));
console.log('First match team names:');
console.log('teams.team1:', data[0].teams?.team1);
console.log('teams.team2:', data[0].teams?.team2);
console.log('Innings team names:');
data[0].innings.forEach((inning, i) => {
  console.log(`Inning ${i+1} team:`, inning.team);
});