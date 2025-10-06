const { collections } = require('../config/database');

const teamColors = {
  'Thunder Strikers': '#4A90E2',
  'Lightning Bolts': '#F59E0B',
  'Royal Warriors': '#10B981',
  'Phoenix Risers': '#EF4444',
  'Kings XI': '#8B5CF6',
  'Eagle Eyes': '#F97316',
  'Purnendu': '#4A90E2', // Default blue for teams not in the list
};

async function addColorsToTeams() {
  try {
    console.log('Adding colors to teams...');

    const teamsSnapshot = await collections.teams.get();
    const updatePromises = [];

    for (const doc of teamsSnapshot.docs) {
      const teamData = doc.data();
      const teamName = teamData.name;

      // Assign color based on team name, or use a default color
      const color = teamColors[teamName] || '#6B7280'; // Default gray

      console.log(`Updating team ${teamName} with color ${color}`);

      updatePromises.push(
        collections.teams.doc(doc.id).update({
          color: color,
          updatedAt: new Date().toISOString()
        })
      );
    }

    await Promise.all(updatePromises);
    console.log(`Successfully updated ${updatePromises.length} teams with colors`);

  } catch (error) {
    console.error('Error adding colors to teams:', error);
  }
}

addColorsToTeams();