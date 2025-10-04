const fs = require('fs');
const path = require('path');

function mergeAndStandardizeJSON() {
  console.log('=== MERGING AND STANDARDIZING JSON FILES ===\n');

  const fullPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_full.json');
  const newPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_new.json');
  const outputPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_merged.json');

  try {
    const fullData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const newData = JSON.parse(fs.readFileSync(newPath, 'utf8'));

    console.log(`Full JSON: ${fullData.length} matches`);
    console.log(`New JSON: ${newData.length} matches`);

    // Standardize and merge the data
    const standardizedData = [];

    // Process full JSON data (with detailed bowling stats)
    for (const match of fullData) {
      const standardizedMatch = standardizeMatch(match, 'full');
      standardizedData.push(standardizedMatch);
    }

    // Process new JSON data (with simpler structure)
    for (const match of newData) {
      const standardizedMatch = standardizeMatch(match, 'new');
      standardizedData.push(standardizedMatch);
    }

    // Write merged data
    fs.writeFileSync(outputPath, JSON.stringify(standardizedData, null, 2));
    console.log(`\n✅ Merged ${standardizedData.length} matches into: ${outputPath}`);

    // Validate the merged structure
    validateMergedData(standardizedData);

  } catch (error) {
    console.error('❌ Error merging JSON files:', error);
  }
}

function standardizeMatch(match, source) {
  const standardized = {
    match_id: match.match_id,
    tournament: match.tournament,
    date: match.date,
    ground: match.ground,
    teams: match.teams,
    toss: match.toss,
    result: match.result,
    innings: []
  };

  // Standardize innings
  for (const inning of match.innings) {
    const standardizedInning = {
      team: inning.team,
      score: inning.score,
      overs: inning.overs,
      batsmen: inning.batsmen || [],
      extras: inning.extras || { wd: 0, nb: 0, total: 0 },
      fall_of_wickets: [],
      bowlers: []
    };

    // Standardize fall of wickets
    if (inning.fall_of_wickets) {
      for (const fow of inning.fall_of_wickets) {
        standardizedInning.fall_of_wickets.push({
          score: fow.score,
          wicket: fow.wicket_number || fow.wicket, // Handle both field names
          player: fow.player_out || fow.player, // Handle both field names
          over: fow.over
        });
      }
    }

    // Standardize bowling/bowlers
    const bowlingData = inning.bowling || inning.bowlers || [];
    for (const bowler of bowlingData) {
      standardizedInning.bowlers.push({
        name: bowler.name,
        overs: bowler.overs,
        maidens: bowler.maidens || 0,
        runs: bowler.runs,
        wickets: bowler.wickets,
        economy: bowler.eco || bowler.economy || 0
      });
    }

    standardized.innings.push(standardizedInning);
  }

  return standardized;
}

function validateMergedData(data) {
  console.log('\n=== VALIDATION OF MERGED DATA ===');

  let totalIssues = 0;

  for (let i = 0; i < Math.min(data.length, 3); i++) { // Check first 3 matches
    const match = data[i];
    console.log(`\nMatch ${i + 1}: ${match.match_id}`);

    // Check innings
    if (match.innings && match.innings.length > 0) {
      const inning = match.innings[0];
      console.log(`  ✅ Innings: ${match.innings.length}`);

      // Check batsmen
      if (inning.batsmen && inning.batsmen.length > 0) {
        console.log(`  ✅ Batsmen: ${inning.batsmen.length} records`);
      } else {
        console.log('  ❌ No batsmen data');
        totalIssues++;
      }

      // Check bowlers
      if (inning.bowlers && inning.bowlers.length > 0) {
        console.log(`  ✅ Bowlers: ${inning.bowlers.length} records`);
      } else {
        console.log('  ❌ No bowlers data');
        totalIssues++;
      }

      // Check fall of wickets
      if (inning.fall_of_wickets && inning.fall_of_wickets.length > 0) {
        console.log(`  ✅ Fall of wickets: ${inning.fall_of_wickets.length} records`);
      } else {
        console.log('  ❌ No fall of wickets data');
        totalIssues++;
      }
    } else {
      console.log('  ❌ No innings data');
      totalIssues++;
    }
  }

  if (totalIssues === 0) {
    console.log('\n🎉 All merged data validated successfully!');
  } else {
    console.log(`\n⚠️  Found ${totalIssues} issues in merged data`);
  }
}

mergeAndStandardizeJSON();