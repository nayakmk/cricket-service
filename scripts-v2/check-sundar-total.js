const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));

let totalRuns = 0;
let matchCount = 0;

data.forEach(match => {
  let matchRuns = 0;
  match.innings?.forEach(inning => {
    inning.batting?.forEach(batsman => {
      if (batsman.name === 'Sundar Raman') {
        console.log(`${match.match_id}: ${inning.team} - ${batsman.runs} runs`);
        matchRuns += batsman.runs;
        matchCount++;
      }
    });
  });
  if (matchRuns > 0) {
    totalRuns += matchRuns;
  }
});

console.log(`Total matches: ${matchCount}`);
console.log(`Total runs: ${totalRuns}`);