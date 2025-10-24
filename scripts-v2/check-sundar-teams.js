const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));

const sundarMatches = [];
data.forEach(match => {
  match.innings?.forEach(inning => {
    inning.batting?.forEach(batsman => {
      if (batsman.name === 'Sundar Raman') {
        sundarMatches.push({
          matchId: match.match_id,
          team: inning.team,
          runs: batsman.runs
        });
      }
    });
  });
});

console.log('Sundar Raman matches:');
sundarMatches.forEach(m => console.log(`${m.matchId}: ${m.team} - ${m.runs} runs`));
console.log(`Total matches: ${sundarMatches.length}`);