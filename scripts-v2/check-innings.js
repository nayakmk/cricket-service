const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));

// Check how many innings each match has
data.forEach(match => {
  console.log(`Match ${match.match_id}: ${match.innings?.length || 0} innings`);
  match.innings?.forEach((inning, i) => {
    console.log(`  Inning ${i+1}: ${inning.team} - ${inning.batting?.length || 0} batsmen`);
  });
});