const fs = require('fs');
const path = require('path');

function parseBatsmanStatus(status) {
  if (!status || status.toLowerCase().includes('not out')) {
    return {
      out: false,
      type: 'Not Out',
      fielder: null,
      bowler: null
    };
  }

  // Parse different dismissal types
  const statusLower = status.toLowerCase();

  // Caught: "c fielder b bowler" or "c fielder"
  if (statusLower.startsWith('c ')) {
    const parts = status.split(' b ');
    if (parts.length === 2) {
      // "c fielder b bowler"
      const fielder = parts[0].substring(2).trim(); // Remove "c "
      const bowler = parts[1].trim();
      return {
        out: true,
        type: 'Caught',
        fielder: fielder,
        bowler: bowler
      };
    } else {
      // "c fielder" - caught but bowler not specified
      const fielder = status.substring(2).trim();
      return {
        out: true,
        type: 'Caught',
        fielder: fielder,
        bowler: null
      };
    }
  }

  // Bowled: "b bowler"
  if (statusLower.startsWith('b ')) {
    const bowler = status.substring(2).trim();
    return {
      out: true,
      type: 'Bowled',
      fielder: null,
      bowler: bowler
    };
  }

  // Run out: "run out fielder" or "run out (fielder)"
  if (statusLower.includes('run out')) {
    const runOutMatch = status.match(/run out(?:\s*\(([^)]+)\))?(?:\s*([^b]*))?/i);
    if (runOutMatch) {
      const fielder = runOutMatch[1] || runOutMatch[2] || null;
      return {
        out: true,
        type: 'Run Out',
        fielder: fielder ? fielder.trim() : null,
        bowler: null
      };
    }
  }

  // LBW: "lbw b bowler"
  if (statusLower.startsWith('lbw')) {
    const bowlerMatch = status.match(/lbw\s+b\s+(.+)/i);
    const bowler = bowlerMatch ? bowlerMatch[1].trim() : null;
    return {
      out: true,
      type: 'LBW',
      fielder: null,
      bowler: bowler
    };
  }

  // Caught and Bowled: "c&b bowler"
  if (statusLower.includes('c&b')) {
    const bowlerMatch = status.match(/c&b\s+(.+)/i);
    const bowler = bowlerMatch ? bowlerMatch[1].trim() : null;
    return {
      out: true,
      type: 'Caught and Bowled',
      fielder: null, // Bowler is also the fielder
      bowler: bowler
    };
  }

  // Stumped: "st keeper b bowler"
  if (statusLower.startsWith('st ')) {
    const parts = status.split(' b ');
    if (parts.length === 2) {
      const keeper = parts[0].substring(3).trim(); // Remove "st "
      const bowler = parts[1].trim();
      return {
        out: true,
        type: 'Stumped',
        fielder: keeper,
        bowler: bowler
      };
    }
  }

  // Retired: "retired hurt" or "retired out"
  if (statusLower.includes('retired')) {
    return {
      out: true,
      type: statusLower.includes('hurt') ? 'Retired Hurt' : 'Retired Out',
      fielder: null,
      bowler: null
    };
  }

  // Default case - unknown dismissal type
  return {
    out: true,
    type: 'Unknown',
    fielder: null,
    bowler: null,
    originalStatus: status
  };
}

function enhanceJSONWithParsedStatus() {
  console.log('=== ENHANCING JSON WITH PARSED BATSMAN STATUS ===\n');

  const inputPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_merged.json');
  const outputPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_enhanced.json');

  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`Processing ${data.length} matches...`);

    let totalBatsmen = 0;
    let parsedStatuses = 0;

    for (const match of data) {
      for (const inning of match.innings) {
        for (const batsman of inning.batsmen) {
          totalBatsmen++;
          const parsedStatus = parseBatsmanStatus(batsman.status);

          // Add parsed status to batsman object
          batsman.statusParsed = parsedStatus;

          if (parsedStatus.type !== 'Unknown') {
            parsedStatuses++;
          }
        }
      }
    }

    // Write enhanced data
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\n✅ Enhanced JSON saved to: ${outputPath}`);
    console.log(`📊 Processed ${totalBatsmen} batsmen`);
    console.log(`✅ Successfully parsed ${parsedStatuses} statuses`);
    console.log(`❌ Unknown status types: ${totalBatsmen - parsedStatuses}`);

    // Show some examples
    console.log('\n=== EXAMPLES OF PARSED STATUSES ===');
    let examplesShown = 0;
    for (const match of data) {
      if (examplesShown >= 3) break;
      for (const inning of match.innings) {
        for (const batsman of inning.batsmen) {
          if (batsman.statusParsed && batsman.statusParsed.out && examplesShown < 3) {
            console.log(`"${batsman.status}" → ${JSON.stringify(batsman.statusParsed, null, 2)}`);
            examplesShown++;
            break;
          }
        }
        if (examplesShown >= 3) break;
      }
      if (examplesShown >= 3) break;
    }

  } catch (error) {
    console.error('❌ Error enhancing JSON:', error);
  }
}

enhanceJSONWithParsedStatus();