const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));

let duplicateCount = 0;
data.forEach(match => {
  const team1Players = match.team1?.players || [];
  const team2Players = match.team2?.players || [];
  const sundarInTeam1 = team1Players.some(p => p.name === 'Sundar Raman');
  const sundarInTeam2 = team2Players.some(p => p.name === 'Sundar Raman');

  if (sundarInTeam1 && sundarInTeam2) {
    console.log(`Match ${match.match_id}: Sundar Raman in both teams`);
    duplicateCount++;
  }
});

console.log(`Matches where Sundar Raman appears in both teams: ${duplicateCount}`);