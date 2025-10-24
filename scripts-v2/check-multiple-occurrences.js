const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));

let totalRuns = 0;
let occurrences = 0;

data.forEach(match => {
  match.innings?.forEach((inning, inningIndex) => {
    let inningOccurrences = 0;
    inning.batting?.forEach(batsman => {
      if (batsman.name === 'Sundar Raman') {
        console.log(`Match ${match.match_id}, Inning ${inningIndex + 1}, Team ${inning.team}: ${batsman.runs} runs`);
        totalRuns += batsman.runs;
        occurrences++;
        inningOccurrences++;
      }
    });
    if (inningOccurrences > 1) {
      console.log(`*** Multiple occurrences in match ${match.match_id}, inning ${inningIndex + 1}: ${inningOccurrences}`);
    }
  });
});

console.log(`Total runs: ${totalRuns}`);
console.log(`Total occurrences: ${occurrences}`);