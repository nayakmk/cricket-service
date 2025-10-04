const fs = require('fs');
const path = require('path');

function compareJSONStructures() {
  console.log('=== JSON STRUCTURE COMPARISON ===\n');

  const fullPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_full.json');
  const newPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_new.json');

  try {
    const fullData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const newData = JSON.parse(fs.readFileSync(newPath, 'utf8'));

    console.log(`Full JSON: ${fullData.length} matches`);
    console.log(`New JSON: ${newData.length} matches\n`);

    // Compare first match from each file
    const fullMatch = fullData[0];
    const newMatch = newData[0];

    console.log('=== MATCH LEVEL STRUCTURE ===');
    console.log('Full JSON keys:', Object.keys(fullMatch));
    console.log('New JSON keys:', Object.keys(newMatch));
    console.log('');

    // Compare innings structure
    if (fullMatch.innings && fullMatch.innings.length > 0 && newMatch.innings && newMatch.innings.length > 0) {
      const fullInning = fullMatch.innings[0];
      const newInning = newMatch.innings[0];

      console.log('=== INNINGS LEVEL STRUCTURE ===');
      console.log('Full JSON inning keys:', Object.keys(fullInning));
      console.log('New JSON inning keys:', Object.keys(newInning));
      console.log('');

      // Check batsmen structure
      if (fullInning.batsmen && fullInning.batsmen.length > 0 && newInning.batsmen && newInning.batsmen.length > 0) {
        console.log('=== BATSMEN STRUCTURE ===');
        console.log('Full JSON batsman keys:', Object.keys(fullInning.batsmen[0]));
        console.log('New JSON batsman keys:', Object.keys(newInning.batsmen[0]));
        console.log('');
      }

      // Check bowling structure
      if (fullInning.bowling && fullInning.bowling.length > 0) {
        console.log('=== BOWLING STRUCTURE (Full JSON) ===');
        console.log('Full JSON bowling keys:', Object.keys(fullInning.bowling[0]));
      }

      if (newInning.bowlers && newInning.bowlers.length > 0) {
        console.log('=== BOWLERS STRUCTURE (New JSON) ===');
        console.log('New JSON bowlers keys:', Object.keys(newInning.bowlers[0]));
        console.log('');
      }

      // Check fall of wickets structure
      if (fullInning.fall_of_wickets && fullInning.fall_of_wickets.length > 0) {
        console.log('=== FALL OF WICKETS STRUCTURE (Full JSON) ===');
        console.log('Full JSON FOW keys:', Object.keys(fullInning.fall_of_wickets[0]));
      }

      if (newInning.fall_of_wickets && newInning.fall_of_wickets.length > 0) {
        console.log('=== FALL OF WICKETS STRUCTURE (New JSON) ===');
        console.log('New JSON FOW keys:', Object.keys(newInning.fall_of_wickets[0]));
        console.log('');
      }
    }

    console.log('=== SUMMARY OF DIFFERENCES ===');
    console.log('1. Bowling data:');
    console.log('   - Full JSON: "bowling" array');
    console.log('   - New JSON: "bowlers" array');
    console.log('');

    console.log('2. Fall of wickets field names:');
    console.log('   - Full JSON: "wicket_number", "player_out"');
    console.log('   - New JSON: "wicket", "player"');
    console.log('');

    console.log('3. Data completeness:');
    console.log('   - Full JSON: More detailed bowling stats (dots, fours, sixes, wides, noballs)');
    console.log('   - New JSON: Simpler bowling stats (overs, runs, wickets, economy)');
    console.log('');

    console.log('4. Match count:');
    console.log(`   - Full JSON: ${fullData.length} matches`);
    console.log(`   - New JSON: ${newData.length} matches`);

  } catch (error) {
    console.error('Error comparing JSON structures:', error);
  }
}

compareJSONStructures();