const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));

const sundarMatches = {};

data.forEach(match => {
  match.innings?.forEach((inning, inningIndex) => {
    inning.batting?.forEach(batsman => {
      if (batsman.name === 'Sundar Raman') {
        if (!sundarMatches[match.match_id]) {
          sundarMatches[match.match_id] = { innings: [], total: 0 };
        }
        sundarMatches[match.match_id].innings.push({
          inning: inningIndex + 1,
          team: inning.team,
          runs: batsman.runs
        });
        sundarMatches[match.match_id].total += batsman.runs;
      }
    });
  });
});

Object.keys(sundarMatches).forEach(matchId => {
  const match = sundarMatches[matchId];
  console.log(`${matchId}: ${match.innings.length} innings, total ${match.total} runs`);
  match.innings.forEach(inning => {
    console.log(`  Inning ${inning.inning}: ${inning.team} - ${inning.runs} runs`);
  });
});

console.log(`Total matches: ${Object.keys(sundarMatches).length}`);
const totalRuns = Object.values(sundarMatches).reduce((sum, match) => sum + match.total, 0);
console.log(`Total runs: ${totalRuns}`);