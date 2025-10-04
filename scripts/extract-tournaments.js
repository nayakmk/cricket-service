const fs = require('fs');
const path = require('path');

function extractTournaments() {
  console.log('=== EXTRACTING TOURNAMENTS FROM MATCH DATA ===\n');

  const inputPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_enhanced.json');

  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // Extract unique tournaments
    const tournaments = new Set();

    for (const match of data) {
      if (match.tournament) {
        tournaments.add(match.tournament);
      }
    }

    console.log(`Found ${tournaments.size} unique tournaments:`);
    Array.from(tournaments).forEach((tournament, index) => {
      console.log(`  ${index + 1}. ${tournament}`);
    });

    return Array.from(tournaments);

  } catch (error) {
    console.error('❌ Error extracting tournaments:', error);
    return [];
  }
}

function createTournamentData(tournaments) {
  const tournamentData = [];

  tournaments.forEach((tournamentName, index) => {
    const tournament = {
      id: `tournament_${index + 1}`,
      name: tournamentName,
      shortName: tournamentName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 5),
      description: `${tournamentName} cricket tournament`,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    tournamentData.push(tournament);
  });

  return tournamentData;
}

function updateMatchesWithTournamentRefs() {
  const inputPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_enhanced.json');
  const outputPath = path.join(__dirname, '..', 'reports', 'cricket_matches_summary_with_tournaments.json');

  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const tournaments = extractTournaments();
    const tournamentData = createTournamentData(tournaments);

    // Create tournament name to ID mapping
    const tournamentMap = {};
    tournamentData.forEach(tournament => {
      tournamentMap[tournament.name] = tournament.id;
    });

    // Update matches to use tournament references
    const updatedData = data.map(match => {
      const tournamentId = tournamentMap[match.tournament];
      return {
        ...match,
        tournamentId: tournamentId,
        tournamentName: match.tournament, // Keep original name for backward compatibility
        tournament: undefined // Remove the direct tournament field
      };
    });

    // Save updated matches
    fs.writeFileSync(outputPath, JSON.stringify(updatedData, null, 2));

    // Save tournament data
    const tournamentOutputPath = path.join(__dirname, '..', 'reports', 'tournaments.json');
    fs.writeFileSync(tournamentOutputPath, JSON.stringify(tournamentData, null, 2));

    console.log(`\n✅ Updated matches saved to: ${outputPath}`);
    console.log(`✅ Tournament data saved to: ${tournamentOutputPath}`);
    console.log(`📊 Processed ${updatedData.length} matches`);
    console.log(`🏆 Created ${tournamentData.length} tournament records`);

    // Show tournament mapping
    console.log('\n=== TOURNAMENT MAPPING ===');
    tournamentData.forEach(tournament => {
      console.log(`${tournament.name} → ${tournament.id} (${tournament.shortName})`);
    });

  } catch (error) {
    console.error('❌ Error updating matches:', error);
  }
}

updateMatchesWithTournamentRefs();