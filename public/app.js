let currentData = {};
let editingId = null;
let selectedPlayers = [];

// Merge functionality
function togglePlayerSelection(playerId) {
  console.log('togglePlayerSelection called with:', playerId);
  const checkbox = document.getElementById(`player-${playerId}`);
  console.log('Checkbox found:', checkbox);
  if (checkbox.checked) {
    if (!selectedPlayers.includes(playerId)) {
      selectedPlayers.push(playerId);
    }
  } else {
    selectedPlayers = selectedPlayers.filter(id => id !== playerId);
  }
  console.log('Selected players now:', selectedPlayers);
  updateMergeUI();
}

function clearSelection() {
  selectedPlayers.forEach(playerId => {
    const checkbox = document.getElementById(`player-${playerId}`);
    if (checkbox) checkbox.checked = false;
  });
  selectedPlayers = [];
  updateMergeUI();
}

function updateMergeUI() {
  console.log('updateMergeUI called, selectedPlayers:', selectedPlayers);
  const mergeActions = document.getElementById('merge-actions');
  const selectionCount = document.getElementById('selection-count');

  console.log('mergeActions element:', mergeActions);
  if (mergeActions) {
    if (selectedPlayers.length > 0) {
      mergeActions.style.display = 'block';
      if (selectionCount) {
        selectionCount.textContent = `${selectedPlayers.length} player${selectedPlayers.length > 1 ? 's' : ''} selected`;
      }
      console.log('Showing merge actions');
    } else {
      mergeActions.style.display = 'none';
      console.log('Hiding merge actions');
    }
  }
}

function filterPlayersByStatus() {
  const filterValue = document.getElementById('player-status-filter').value;
  const playerCards = document.querySelectorAll('.data-card');
  
  playerCards.forEach(card => {
    const isActive = card.classList.contains('status-active');
    const isSuspended = card.classList.contains('status-suspended');
    
    switch(filterValue) {
      case 'active':
        card.style.display = isActive ? 'block' : 'none';
        break;
      case 'suspended':
        card.style.display = isSuspended ? 'block' : 'none';
        break;
      default: // 'all'
        card.style.display = 'block';
        break;
    }
  });
  
  // Update the count display
  const visibleCards = Array.from(playerCards).filter(card => card.style.display !== 'none');
  const countText = document.querySelector('#players-content p');
  if (countText) {
    const totalText = countText.textContent.replace(/\d+/, visibleCards.length);
    countText.textContent = totalText;
  }
}

function showMergeModal() {
  console.log('showMergeModal called, selectedPlayers:', selectedPlayers);
  if (selectedPlayers.length < 2) {
    alert('Please select at least 2 players to merge.');
    return;
  }

  console.log('Creating merge modal...');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Merge Players</h3>
        <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        <p>Select which player profile should be the final merged profile:</p>
        <div class="merge-preview">
          <div class="primary-player-selection">
            ${selectedPlayers.map((playerId, index) => {
              const player = getPlayerById(playerId);
              return `
                <div class="player-option">
                  <label class="player-radio-label">
                    <input type="radio" name="primaryPlayer" value="${playerId}" ${index === 0 ? 'checked' : ''}>
                    <div class="player-info">
                      <strong>${player.name}</strong>
                      <div class="player-stats">
                        ${player.matchesPlayed || 0} matches • ${player.totalRuns || 0} runs • ${player.totalWickets || 0} wickets
                      </div>
                    </div>
                  </label>
                </div>
              `;
            }).join('')}
          </div>
          <div class="merge-info">
            <h4>What happens during merge:</h4>
            <ul>
              <li>✅ Player statistics will be combined</li>
              <li>✅ All match references will be updated</li>
              <li>✅ Team lineups will be updated</li>
              <li>✅ Duplicate players will be deactivated</li>
            </ul>
          </div>
          <p class="warning"><strong>This action cannot be undone!</strong></p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
        <button class="btn btn-danger" onclick="performMerge()">Merge Players</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  console.log('Modal added to body');
}

function getPlayerById(playerId) {
  return currentData.players.find(p => p.id === playerId);
}

async function performMerge() {
  if (selectedPlayers.length < 2) return;

  // Get the selected primary player from radio buttons
  const primaryPlayerRadio = document.querySelector('input[name="primaryPlayer"]:checked');
  if (!primaryPlayerRadio) {
    alert('Please select a primary player.');
    return;
  }

  const primaryPlayerId = primaryPlayerRadio.value;
  const playersToMerge = selectedPlayers.filter(id => id !== primaryPlayerId);

  try {
    const result = await apiCall('/api/players/merge', 'POST', {
      primaryPlayerId,
      playersToMerge
    });

    document.querySelector('.modal').remove();
    showSuccess('players-content', `Players merged successfully! ${result.stats.playersDeactivated} players deactivated, ${result.stats.teamLineupsUpdated} team lineups updated, ${result.stats.matchesUpdated} matches updated.`);
    clearSelection();
    loadPlayers();
  } catch (error) {
    showError('players-content', error);
  }
}

// Form management functions
function showCreateForm(section) {
  hideAllForms();
  const form = document.getElementById(`${section}-form`);
  const content = document.getElementById(`${section}-content`);
  const formTitle = document.getElementById(`${section}-form-title`);

  if (form) form.classList.add('active');
  if (content) content.style.display = 'none';
  if (formTitle) formTitle.textContent = 'Create New ' + section.charAt(0).toUpperCase() + section.slice(1).slice(0, -1);
  editingId = null;
  clearForm(section);

  // Reset form state for lineups
  if (section === 'lineups') {
    const form = document.getElementById('lineups-form-element');
    form.removeAttribute('data-mode');
    form.removeAttribute('data-lineup-id');
    document.getElementById('lineups-form-title').textContent = 'Create New Team Lineup';
  }
}

function hideCreateForm(section) {
  const form = document.getElementById(`${section}-form`);
  const content = document.getElementById(`${section}-content`);
  if (form) {
    form.classList.remove('active');
    form.style.display = 'none'; // Clear any inline styles
  }
  if (content) {
    content.style.display = 'block';
  }
  editingId = null;
}

function hideAllForms() {
  document.querySelectorAll('.form-container').forEach(form => {
    form.classList.remove('active');
  });
}

function clearForm(section) {
  const form = document.getElementById(`${section}-form-element`);
  form.reset();
}

// CRUD API functions
async function apiCall(endpoint, method = 'GET', data = null) {
  const config = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(endpoint, config);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API Call Failed:', error);
    throw error;
  }
}

function showLoading(elementId) {
  document.getElementById(elementId).innerHTML = '<div class="loading">Loading...</div>';
}

function showError(elementId, error) {
  document.getElementById(elementId).innerHTML = `<div class="error">Error: ${error.message}</div>`;
}

// Utility functions
function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="success">${message}</div>`;
  } else {
    // Fallback to global success message if element not found
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.querySelector('.container').insertBefore(successDiv, document.querySelector('.nav-tabs'));

    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }
}

// CRUD Operations

// Teams CRUD
async function createTeam(teamData) {
  return await apiCall('/api/v2/teams', 'POST', teamData);
}

async function updateTeam(teamId, teamData) {
  return await apiCall(`/api/v2/teams/${teamId}`, 'PUT', teamData);
}

async function deleteTeam(teamId) {
  return await apiCall(`/api/v2/teams/${teamId}`, 'DELETE');
}

// Form handlers
document.getElementById('teams-form-element').addEventListener('submit', async function(e) {
  e.preventDefault();

  const teamData = {
    name: document.getElementById('teamName').value,
    shortName: document.getElementById('shortName').value,
    captainId: document.getElementById('captainId').value || null,
    homeGround: document.getElementById('homeGround').value || null,
    foundedYear: document.getElementById('foundedYear').value ? parseInt(document.getElementById('foundedYear').value) : null
  };

  try {
    if (editingId) {
      // Update existing team
      await apiCall(`/api/v2/teams/${editingId}`, 'PUT', teamData);
      showSuccess('teams-content', 'Team updated successfully!');
    } else {
      // Create new team
      await apiCall('/api/v2/teams', 'POST', teamData);
      showSuccess('teams-content', 'Team created successfully!');
    }
    hideCreateForm('teams');
    loadTeams(); // Refresh the list
  } catch (error) {
    showError('teams-content', error);
  }
});

// Edit/Delete handlers
function editTeam(teamId, event) {
  event.stopPropagation();
  const team = currentData.teams.find(t => t.id === teamId);
  if (!team) return;

  editingId = teamId;
  showCreateForm('teams');
  document.getElementById('teams-form-title').textContent = 'Edit Team';

  // Populate form
  document.getElementById('teamName').value = team.name || '';
  document.getElementById('shortName').value = team.shortName || '';
  document.getElementById('captainId').value = team.captainId || '';
  document.getElementById('homeGround').value = team.homeGround || '';
  document.getElementById('foundedYear').value = team.foundedYear || '';
}

async function deleteTeam(teamId, event) {
  event.stopPropagation();

  if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
    return;
  }

  try {
    await apiCall(`/api/v2/teams/${teamId}`, 'DELETE');
    showSuccess('teams-content', 'Team deleted successfully!');
    loadTeams(); // Refresh the list
  } catch (error) {
    showError('teams-content', error);
  }
}

// Form handlers for APIs that don't support operations yet
document.getElementById('matches-form-element').addEventListener('submit', async function(e) {
  e.preventDefault();

  const team1Id = document.getElementById('team1Id').value.trim();
  const team2Id = document.getElementById('team2Id').value.trim();

  if (!team1Id || !team2Id) {
    showError('matches-content', new Error('Please select both teams'));
    return;
  }

  if (team1Id === team2Id) {
    showError('matches-content', new Error('Please select different teams'));
    return;
  }

  const matchData = {
    title: document.getElementById('matchType').value,
    venue: document.getElementById('venue').value.trim(),
    scheduledDate: document.getElementById('scheduledDate').value,
    team1Id: team1Id,
    team2Id: team2Id
  };

  // Get selected players for each team
  const team1Players = getSelectedPlayers('team1');
  const team2Players = getSelectedPlayers('team2');

  if (team1Players.length === 0 || team2Players.length === 0) {
    showError('matches-content', new Error('Please select players for both teams'));
    return;
  }

  try {
    // Create the match
    const result = await apiCall('/api/v2/matches', 'POST', matchData);
    const matchId = result.data.id;

    // Create team lineups for the selected players
    const lineupPromises = [];

    // Get team details for the lineups
    const [team1Data, team2Data] = await Promise.all([
      apiCall(`/api/v2/teams/${team1Id}`),
      apiCall(`/api/v2/teams/${team2Id}`)
    ]);

    lineupPromises.push(
      apiCall('/api/teamLineups', 'POST', {
        teamId: team1Id,
        teamName: team1Data.data.name,
        playerIds: team1Players,
        matchId: matchId
      })
    );

    lineupPromises.push(
      apiCall('/api/teamLineups', 'POST', {
        teamId: team2Id,
        teamName: team2Data.data.name,
        playerIds: team2Players,
        matchId: matchId
      })
    );

    await Promise.all(lineupPromises);

    showSuccess('matches-content', `Match created successfully with playing 11! Starting scoring interface...`);

    // Start the scoring interface
    setTimeout(() => {
      startMatchScoring(matchId, matchData, team1Players, team2Players);
    }, 1500);

  } catch (error) {
    console.error('Match creation failed:', error);
    showError('matches-content', error);
  }
});

// Function to populate team dropdowns
async function populateTeamDropdowns() {
  try {
    console.log('populateTeamDropdowns called');
    // Load teams if not already loaded
    if (!currentData.teams || currentData.teams.length === 0) {
      console.log('Loading teams from API');
      const data = await apiCall('/api/v2/teams');
      currentData.teams = data.data;
      console.log('Loaded teams:', currentData.teams.length, 'teams');
    } else {
      console.log('Using cached teams:', currentData.teams.length, 'teams');
    }

    const teams = currentData.teams;
    const team1Select = document.getElementById('team1Id');
    const team2Select = document.getElementById('team2Id');
    const editTeam1Select = document.getElementById('editTeam1Id');
    const editTeam2Select = document.getElementById('editTeam2Id');

    // Clear existing options except the first one
    if (team1Select) team1Select.innerHTML = '<option value="">Choose a team...</option>';
    if (team2Select) team2Select.innerHTML = '<option value="">Choose a team...</option>';
    if (editTeam1Select) editTeam1Select.innerHTML = '<option value="">Choose a team...</option>';
    if (editTeam2Select) editTeam2Select.innerHTML = '<option value="">Choose a team...</option>';

    // Add teams to all dropdowns
    teams.forEach(team => {
      console.log('Adding team to dropdown:', team.id, team.name);
      // Regular create form dropdowns
      if (team1Select) {
        const option1 = document.createElement('option');
        option1.value = team.id;
        option1.textContent = `${team.name} (${team.displayId || team.id})`;
        team1Select.appendChild(option1);
      }

      if (team2Select) {
        const option2 = document.createElement('option');
        option2.value = team.id;
        option2.textContent = `${team.name} (${team.displayId || team.id})`;
        team2Select.appendChild(option2);
      }

      // Edit form dropdowns
      if (editTeam1Select) {
        const editOption1 = document.createElement('option');
        editOption1.value = team.id;
        editOption1.textContent = `${team.name} (${team.displayId || team.id})`;
        editTeam1Select.appendChild(editOption1);
      }

      if (editTeam2Select) {
        const editOption2 = document.createElement('option');
        editOption2.value = team.id;
        editOption2.textContent = `${team.name} (${team.displayId || team.id})`;
        editTeam2Select.appendChild(editOption2);
      }
    });
  } catch (error) {
    console.error('Failed to load teams for dropdowns:', error);
  }
}

// Function to handle team selection changes
function onTeamChange(teamPrefix) {
  const select = document.getElementById(`${teamPrefix}Id`);
  const loadBtn = document.getElementById(`load${teamPrefix.charAt(0).toUpperCase() + teamPrefix.slice(1)}Btn`);
  const selectedValue = select.value;

  // Enable/disable load players button
  loadBtn.disabled = !selectedValue;

  // Clear player selection if team changed
  const playersDiv = document.getElementById(`${teamPrefix}-players`);
  if (!selectedValue) {
    playersDiv.innerHTML = '<p>Select team and click "Load Players"</p>';
  }
}

// Function to show the match creation form with populated dropdowns
function showCreateMatchForm() {
  showCreateForm('matches');
  populateTeamDropdowns();
}

document.getElementById('players-form-element').addEventListener('submit', async function(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('playerName').value.trim(),
    role: document.getElementById('role').value,
    battingStyle: document.getElementById('battingStyle').value || null,
    bowlingStyle: document.getElementById('bowlingStyle').value.trim() || null,
    teamId: document.getElementById('teamId').value.trim() || null
  };

  const mode = this.getAttribute('data-mode') || 'create';
  const playerId = this.getAttribute('data-player-id');

  try {
    let result;
    if (mode === 'edit' && playerId) {
      // Update existing player
      result = await apiCall(`/api/v2/players/${playerId}`, 'PUT', formData);
      showSuccess('players-content', `Player "${formData.name}" updated successfully!`);
    } else {
      // Create new player
      result = await apiCall('/api/v2/players', 'POST', formData);
      showSuccess('players-content', `Player "${formData.name}" created successfully!`);
    }

    // Reset form and hide it
    this.reset();
    this.removeAttribute('data-mode');
    this.removeAttribute('data-player-id');
    document.getElementById('players-form-title').textContent = 'Create New Player';
    hideCreateForm('players');

    // Reload players list
    await loadPlayers();

  } catch (error) {
    showError('players-content', error);
  }
});

document.getElementById('lineups-form-element').addEventListener('submit', async function(e) {
  e.preventDefault();

  const playerIds = document.getElementById('players').value
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  const lineupData = {
    teamId: document.getElementById('lineupTeamId').value.trim(),
    teamName: '', // Will be resolved by API
    captainId: document.getElementById('captain').value.trim(),
    wicketKeeperId: document.getElementById('wicketKeeper').value.trim(),
    playerIds: playerIds,
    playingXI: playerIds.slice(0, 11) // First 11 players as playing XI
  };

  const mode = this.getAttribute('data-mode') || 'create';
  const lineupId = this.getAttribute('data-lineup-id');

  try {
    let result;
    if (mode === 'edit' && lineupId) {
      // Update existing lineup
      result = await apiCall(`/api/teamLineups/${lineupId}`, 'PUT', lineupData);
      showSuccess('lineups-content', 'Team lineup updated successfully!');
    } else {
      // Create new lineup
      result = await apiCall('/api/teamLineups', 'POST', lineupData);
      showSuccess('lineups-content', 'Team lineup created successfully!');
    }

    // Reset form and hide it
    this.reset();
    this.removeAttribute('data-mode');
    this.removeAttribute('data-lineup-id');
    document.getElementById('lineups-form-title').textContent = 'Create New Team Lineup';
    hideCreateForm('lineups');

    // Reload lineups list
    await loadLineups();

  } catch (error) {
    showError('lineups-content', error);
  }
});



async function editMatch(matchId) {
  console.log('editMatch called with matchId:', matchId);

  try {
    // Get match details
    console.log('Fetching match data for:', matchId);
    const matchResponse = await apiCall(`/api/v2/matches/${matchId}`);
    const match = matchResponse.data;
    console.log('Match data received:', match);

    if (match.status === 'scheduled') {
      // Show edit form for scheduled matches
      console.log('Match is scheduled, showing edit form');
      showEditMatchForm(match);
    } else if (match.status === 'live' || match.status === 'completed') {
      // For live/completed matches, show scoring view
      console.log('Match is live/completed, showing scoring view');
      showMatchScoringView(match);
    } else {
      // For other statuses, allow editing
      console.log('Match has other status, showing edit form');
      showEditMatchForm(match);
    }
  } catch (error) {
    console.error('Error loading match for editing:', error);
    showError('matches-content', error);
  }
}

async function showEditMatchForm(match) {
  console.log('showEditMatchForm called with match:', match);
  // Populate team dropdowns first
  await populateTeamDropdowns();

  // Load existing team lineups for this match
  let team1Lineup = null;
  let team2Lineup = null;

  try {
    const lineupsResponse = await apiCall(`/api/teamLineups/match/${match.id}`);
    const matchLineups = lineupsResponse.data;

    // Find lineups for each team and enrich with player details
    const team1LineupData = matchLineups.find(lineup => lineup.teamId === (match.team1Id || match.team1?.id));
    const team2LineupData = matchLineups.find(lineup => lineup.teamId === (match.team2Id || match.team2?.id));

    if (team1LineupData) {
      // Fetch player details for team1 lineup
      const playerPromises = team1LineupData.playerIds.map(playerId => apiCall(`/api/v2/players/${playerId}`));
      const playerResponses = await Promise.all(playerPromises);
      team1Lineup = {
        ...team1LineupData,
        playersDetails: playerResponses.map(response => response.data)
      };
    }

    if (team2LineupData) {
      // Fetch player details for team2 lineup
      const playerPromises = team2LineupData.playerIds.map(playerId => apiCall(`/api/v2/players/${playerId}`));
      const playerResponses = await Promise.all(playerPromises);
      team2Lineup = {
        ...team2LineupData,
        playersDetails: playerResponses.map(response => response.data)
      };
    }

    console.log('Found team lineups:', { team1Lineup, team2Lineup });
  } catch (error) {
    console.warn('Could not load team lineups:', error);
  }

  const formHtml = `
    <div class="form-container">
      <h3>Edit Match</h3>
      <form id="editMatchForm">
        <div class="form-row">
          <div class="form-group">
            <label for="editMatchType">Match Type:</label>
            <select id="editMatchType" required>
              <option value="T20" ${match.matchType === 'T20' ? 'selected' : ''}>T20</option>
              <option value="ODI" ${match.matchType === 'ODI' ? 'selected' : ''}>ODI</option>
              <option value="Test" ${match.matchType === 'Test' ? 'selected' : ''}>Test</option>
            </select>
          </div>
          <div class="form-group">
            <label for="editVenue">Venue:</label>
            <input type="text" id="editVenue" value="${match.venue || ''}" required>
          </div>
        </div>
        <div class="form-group">
          <label for="editScheduledDate">Scheduled Date:</label>
          <input type="datetime-local" id="editScheduledDate" value="${match.scheduledDate ? new Date(match.scheduledDate).toISOString().slice(0, 16) : ''}" required>
        </div>

        <div class="team-selection-section">
          <h4>Select Teams & Players</h4>
          <div class="team-selection-grid">
            <div class="team-panel">
              <h5>Team 1</h5>
              <div class="form-group">
                <label for="editTeam1Id">Select Team:</label>
                <select id="editTeam1Id" required onchange="onEditTeamChange('team1')">
                  <option value="">Choose a team...</option>
                  <!-- Teams will be populated by populateTeamDropdowns() -->
                </select>
                <button type="button" class="btn btn-small" onclick="loadEditTeamPlayers('team1')" id="editLoadTeam1Btn">Load Players</button>
              </div>
              <div id="edit-team1-players" class="player-selection-list">
                <p>Select team and click "Load Players"</p>
              </div>
            </div>

            <div class="team-panel">
              <h5>Team 2</h5>
              <div class="form-group">
                <label for="editTeam2Id">Select Team:</label>
                <select id="editTeam2Id" required onchange="onEditTeamChange('team2')">
                  <option value="">Choose a team...</option>
                  <!-- Teams will be populated by populateTeamDropdowns() -->
                </select>
                <button type="button" class="btn btn-small" onclick="loadEditTeamPlayers('team2')" id="editLoadTeam2Btn">Load Players</button>
              </div>
              <div id="edit-team2-players" class="player-selection-list">
                <p>Select team and click "Load Players"</p>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="editStatus">Status:</label>
          <select id="editStatus">
            <option value="scheduled" ${match.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="live" ${match.status === 'live' ? 'selected' : ''}>Live</option>
            <option value="completed" ${match.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" onclick="updateMatch('${match.id}')">Update Match</button>
          <button type="button" class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
          ${match.status === 'scheduled' ? `<button type="button" class="btn btn-primary" onclick="startScoringFromEdit('${match.id}')">Start Scoring</button>` : ''}
        </div>
      </form>
    </div>
  `;

  document.getElementById('matches-content').innerHTML = formHtml;

  // Pre-select the teams and show existing lineups
  console.log('Pre-selecting teams for match:', match);
  if (match.team1Id || match.team1?.id) {
    const team1Id = match.team1Id || match.team1?.id;
    console.log('Setting team1Id:', team1Id);
    const team1Select = document.getElementById('editTeam1Id');
    console.log('team1Select options:', Array.from(team1Select.options).map(o => ({value: o.value, text: o.text})));
    team1Select.value = team1Id;
    console.log('team1Select value after setting:', team1Select.value);

    // If team not found in dropdown, try to add it
    if (team1Select.value !== team1Id) {
      console.log('team1Id not found in dropdown options, trying to add it');
      // Try to find the team in currentData.teams
      const team = currentData.teams?.find(t => t.id === team1Id);
      if (team) {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = `${team.name} (${team.displayId || team.id})`;
        team1Select.appendChild(option);
        team1Select.value = team1Id;
        console.log('Added team1 to dropdown, value now:', team1Select.value);
      }
    }

    // Show existing lineup if available
    if (team1Lineup && team1Lineup.playersDetails) {
      displayEditPlayerSelectionList(document.getElementById('edit-team1-players'), team1Lineup.playersDetails, 'team1');
      // Pre-check the selected players
      team1Lineup.playerIds.forEach(playerId => {
        const checkbox = document.getElementById(`edit-team1-player-${playerId}`);
        if (checkbox) checkbox.checked = true;
      });
    } else if (team1Select.value) {
      loadEditTeamPlayers('team1');
    }
  }

  if (match.team2Id || match.team2?.id) {
    const team2Id = match.team2Id || match.team2?.id;
    console.log('Setting team2Id:', team2Id);
    const team2Select = document.getElementById('editTeam2Id');
    console.log('team2Select options:', Array.from(team2Select.options).map(o => ({value: o.value, text: o.text})));
    team2Select.value = team2Id;
    console.log('team2Select value after setting:', team2Select.value);

    // If team not found in dropdown, try to add it
    if (team2Select.value !== team2Id) {
      console.log('team2Id not found in dropdown options, trying to add it');
      // Try to find the team in currentData.teams
      const team = currentData.teams?.find(t => t.id === team2Id);
      if (team) {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = `${team.name} (${team.displayId || team.id})`;
        team2Select.appendChild(option);
        team2Select.value = team2Id;
        console.log('Added team2 to dropdown, value now:', team2Select.value);
      }
    }

    // Show existing lineup if available
    if (team2Lineup && team2Lineup.playersDetails) {
      displayEditPlayerSelectionList(document.getElementById('edit-team2-players'), team2Lineup.playersDetails, 'team2');
      // Pre-check the selected players
      team2Lineup.playerIds.forEach(playerId => {
        const checkbox = document.getElementById(`edit-team2-player-${playerId}`);
        if (checkbox) checkbox.checked = true;
      });
    } else if (team2Select.value) {
      loadEditTeamPlayers('team2');
    }
  }
}

async function updateMatch(matchId) {
  const team1Id = document.getElementById('editTeam1Id').value;
  const team2Id = document.getElementById('editTeam2Id').value;
  const team1Players = getSelectedEditPlayers('team1');
  const team2Players = getSelectedEditPlayers('team2');

  if (!team1Players.length || !team2Players.length) {
    showError('matches-content', new Error('Please select players for both teams'));
    return;
  }

  const matchData = {
    matchType: document.getElementById('editMatchType').value,
    venue: document.getElementById('editVenue').value,
    scheduledDate: document.getElementById('editScheduledDate').value,
    status: document.getElementById('editStatus').value,
    team1Id: team1Id,
    team2Id: team2Id
  };

  try {
    // Update the match
    await apiCall(`/api/v2/matches/${matchId}`, 'PUT', matchData);

    // Update or create team lineups
    const lineupPromises = [];

    // Get team details for the lineups
    const [team1Data, team2Data] = await Promise.all([
      apiCall(`/api/teams/${team1Id}`),
      apiCall(`/api/teams/${team2Id}`)
    ]);

    // Check if lineups already exist for this match
    const existingLineupsResponse = await apiCall(`/api/teamLineups/match/${matchId}`);
    const existingLineups = existingLineupsResponse.data;

    const team1Lineup = existingLineups.find(lineup => lineup.teamId === team1Id);
    const team2Lineup = existingLineups.find(lineup => lineup.teamId === team2Id);

    if (team1Lineup) {
      // Update existing lineup
      lineupPromises.push(
        apiCall(`/api/teamLineups/${team1Lineup.id}`, 'PUT', {
          playerIds: team1Players
        })
      );
    } else {
      // Create new lineup
      lineupPromises.push(
        apiCall('/api/teamLineups', 'POST', {
          teamId: team1Id,
          teamName: team1Data.data.name,
          playerIds: team1Players,
          matchId: matchId
        })
      );
    }

    if (team2Lineup) {
      // Update existing lineup
      lineupPromises.push(
        apiCall(`/api/teamLineups/${team2Lineup.id}`, 'PUT', {
          playerIds: team2Players
        })
      );
    } else {
      // Create new lineup
      lineupPromises.push(
        apiCall('/api/teamLineups', 'POST', {
          teamId: team2Id,
          teamName: team2Data.data.name,
          playerIds: team2Players,
          matchId: matchId
        })
      );
    }

    await Promise.all(lineupPromises);

    showSuccess('matches-content', 'Match and team lineups updated successfully!');
    setTimeout(() => loadMatches(), 1500);
  } catch (error) {
    showError('matches-content', error);
  }
}

function startScoringFromEdit(matchId) {
  // Get the selected players from the edit form
  const team1Players = getSelectedEditPlayers('team1');
  const team2Players = getSelectedEditPlayers('team2');

  console.log('Starting scoring with selected players:', {
    team1Players: team1Players,
    team2Players: team2Players
  });

  if (team1Players.length === 0 || team2Players.length === 0) {
    alert('Please select players for both teams before starting scoring.');
    return;
  }

  // Get the match data and update/create team lineups
  apiCall(`/api/v2/matches/${matchId}`)
    .then(response => {
      const match = response.data;

      // Update or create team lineups for both teams
      const lineupPromises = [];

      if (match.team1?.id) {
        lineupPromises.push(
          apiCall('/api/teamLineups', 'POST', {
            teamId: match.team1.id,
            teamName: match.team1.name,
            playerIds: team1Players,
            matchId: matchId
          }).catch(error => {
            // If lineup already exists, try to update it
            console.log('Creating/updating team1 lineup');
          })
        );
      }

      if (match.team2?.id) {
        lineupPromises.push(
          apiCall('/api/teamLineups', 'POST', {
            teamId: match.team2.id,
            teamName: match.team2.name,
            playerIds: team2Players,
            matchId: matchId
          }).catch(error => {
            // If lineup already exists, try to update it
            console.log('Creating/updating team2 lineup');
          })
        );
      }

      return Promise.all(lineupPromises).then(() => match);
    })
    .then(match => {
      // Now start the scoring with the created lineups
      startMatchScoring(match.id, match, team1Players, team2Players);
    })
    .catch(error => {
      console.error('Error starting scoring from edit:', error);
      showError('matches-content', error);
    });
}

function getSelectedEditPlayers(teamPrefix) {
  const checkboxes = document.querySelectorAll(`input[id^="edit-${teamPrefix}-player-"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

function getPlayersForTeam(teamId) {
  // This is a simplified function - in a real app you'd get team lineups
  // For now, return some default players
  return currentData.players ? currentData.players.slice(0, 11).map(p => p.id) : [];
}

function showMatchScoringView(match) {
  // For live/completed matches, show the scoring interface
  if (match.status === 'live' || match.status === 'completed') {
    // Load teams and players data first
    Promise.all([
      apiCall('/api/v2/teams'),
      apiCall('/api/v2/players')
    ])
    .then(([teamsResponse, playersResponse]) => {
      currentData.teams = teamsResponse.data;
      currentData.players = playersResponse.data;

      const team1Players = getPlayersForTeam(match.teams?.team1?.id || match.team1Id);
      const team2Players = getPlayersForTeam(match.teams?.team2?.id || match.team2Id);

      startMatchScoring(match.id, match, team1Players, team2Players);
    })
    .catch(error => {
      console.error('Error loading data for scoring view:', error);
      showError('matches-content', error);
    });
  } else {
    showEditMatchForm(match);
  }
}

function cancelEdit() {
  loadMatches();
}

async function deleteMatch(matchId) {
  if (!confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
    return;
  }

  try {
    await apiCall(`/api/v2/matches/${matchId}`, 'DELETE');

    // Reload all matches from the server to ensure data consistency
    await loadMatches();

    // Show success message
    showSuccess('matches-content', 'Match deleted successfully');

  } catch (error) {
    showError('matches-content', error);
  }
}

function editPlayer(playerId, event) {
  event.stopPropagation();

  // Find the player data
  const player = currentData.players.find(p => p.id === playerId);
  if (!player) {
    showError('players-content', new Error('Player not found'));
    return;
  }

  // Populate the form with player data
  document.getElementById('playerName').value = player.name || '';
  document.getElementById('role').value = player.role || 'all-rounder';
  document.getElementById('battingStyle').value = player.battingStyle || '';
  document.getElementById('bowlingStyle').value = player.bowlingStyle || '';
  document.getElementById('teamId').value = player.teamId || '';

  // Update form title and set editing mode
  document.getElementById('players-form-title').textContent = 'Edit Player';
  document.getElementById('players-form-element').setAttribute('data-mode', 'edit');
  document.getElementById('players-form-element').setAttribute('data-player-id', playerId);

  // Show the form
  const playersForm = document.getElementById('players-form');
  const playersContent = document.getElementById('players-content');
  if (playersForm) playersForm.classList.add('active');
  if (playersContent) playersContent.style.display = 'none';
}

async function deletePlayer(playerId, event) {
  event.stopPropagation();

  // Find the player data for confirmation
  const player = currentData.players.find(p => p.id === playerId);
  if (!player) {
    showError('players-content', new Error('Player not found'));
    return;
  }

  // Show confirmation dialog
  if (!confirm(`Are you sure you want to delete player "${player.name}"? This will deactivate the player.`)) {
    return;
  }

  try {
    await apiCall(`/api/players/${playerId}`, 'DELETE');
    showSuccess('players-content', `Player "${player.name}" deactivated successfully!`);

    // Reload players list
    await loadPlayers();

  } catch (error) {
    showError('players-content', error);
  }
}

function editLineup(lineupId, event) {
  event.stopPropagation();

  // Find the lineup data
  const lineup = currentData.lineups.find(l => l.id === lineupId);
  if (!lineup) {
    showError('lineups-content', new Error('Lineup not found'));
    return;
  }

  // Populate the form with lineup data
  document.getElementById('lineupTeamId').value = lineup.teamId || '';
  document.getElementById('captain').value = lineup.captainId || '';
  document.getElementById('wicketKeeper').value = lineup.wicketKeeperId || '';
  document.getElementById('players').value = (lineup.playerIds || []).join(', ');

  // Update form title and set editing mode
  document.getElementById('lineups-form-title').textContent = 'Edit Team Lineup';
  document.getElementById('lineups-form-element').setAttribute('data-mode', 'edit');
  document.getElementById('lineups-form-element').setAttribute('data-lineup-id', lineupId);

  // Show the form
  const lineupsForm = document.getElementById('lineups-form');
  const lineupsContent = document.getElementById('lineups-content');
  if (lineupsForm) lineupsForm.classList.add('active');
  if (lineupsContent) lineupsContent.style.display = 'none';
}

async function deleteLineup(lineupId, event) {
  event.stopPropagation();

  if (!confirm('Are you sure you want to delete this team lineup? This action cannot be undone.')) {
    return;
  }

  try {
    await apiCall(`/api/teamLineups/${lineupId}`, 'DELETE');
    showSuccess('lineups-content', 'Team lineup deleted successfully!');
    await loadLineups(); // Refresh the list
  } catch (error) {
    showError('lineups-content', error);
  }
}

// Matches functions
async function loadMatches() {
  const contentId = 'matches-content';
  showLoading(contentId);

  try {
    const data = await apiCall('/api/v2/matches');
    currentData.matches = data.data;
    displayMatches(data.data, contentId);
  } catch (error) {
    showError(contentId, error);
  }
}

function displayMatches(matches, containerId) {
  if (!matches || matches.length === 0) {
    document.getElementById(containerId).innerHTML = '<p>No matches found.</p>';
    return;
  }

  let html = `<p>Found ${matches.length} matches:</p>`;
  html += '<div class="data-grid">';

  matches.forEach(match => {
    const statusClass = match.status === 'live' ? 'status-live' :
                       match.status === 'completed' ? 'status-completed' :
                       match.status === 'scheduled' ? 'status-scheduled' : 'status-upcoming';

    html += `
      <div class="data-card">
        <h3>${match.title || match.displayId || match.id}</h3>
        <p><span class="status-indicator ${statusClass}"></span>${match.status || 'scheduled'}</p>
        <p><strong>Teams:</strong> ${match.team1 ? match.team1.name : 'TBD'} vs ${match.team2 ? match.team2.name : 'TBD'}</p>
        <p><strong>Score:</strong> ${match.team1Score || 0} - ${match.team2Score || 0}</p>
        <p><strong>Result:</strong> ${match.result || 'N/A'}</p>
        <p><strong>Type:</strong> ${match.matchType || 'N/A'}</p>
        <p><strong>Venue:</strong> ${match.venue || 'N/A'}</p>
        ${match.scheduledDate ? `<p><strong>Date:</strong> ${new Date(match.scheduledDate).toLocaleString()}</p>` : ''}
        <div class="card-actions">
          <button class="btn btn-small btn-view" onclick="showMatchDetail('${match.id}')">View</button>
          <button class="btn btn-small btn-edit" onclick="editMatch('${match.id}')">Edit</button>
          <button class="btn btn-small btn-delete" onclick="deleteMatch('${match.id}')">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  document.getElementById(containerId).innerHTML = html;
}

// Load detailed innings data using new API structure
async function loadMatchInningsData(matchId) {
  try {
    // First get the list of innings for this match
    const inningsListResponse = await fetch(`/api/v2/matches/${matchId}/innings`);
    if (!inningsListResponse.ok) {
      throw new Error('Failed to load innings list');
    }

    const inningsListData = await inningsListResponse.json();
    if (!inningsListData.success || !inningsListData.data) {
      throw new Error('Invalid innings list response');
    }

    const innings = [];

    // For each inning, get the detailed data
    for (const inningSummary of inningsListData.data) {
      try {
        const detailedResponse = await fetch(`/api/v2/matches/${matchId}/innings/${inningSummary.id}`);
        if (detailedResponse.ok) {
          const detailedData = await detailedResponse.json();
          if (detailedData.success && detailedData.data) {
            // Transform the data to match the expected format
            const inning = detailedData.data;
            const match = currentData.matches?.find(m => m.id === matchId);
            const teamName = match?.team1?.id === inning.battingTeam ?
                           match?.team1?.name || 'Team 1' :
                           match?.team2?.name || 'Team 2';

            const transformedInning = {
              team: teamName,
              score: `${inning.totalRuns}/${inning.totalWickets}`,
              overs: `${Math.floor(inning.totalOvers)}.${inning.totalBalls % 6}`,
              batsmen: inning.batsmen?.map(b => ({
                name: b.player?.name || `Player ${b.playerId}`,
                runs: b.runs || 0,
                balls: b.balls || 0,
                fours: b.fours || 0,
                sixes: b.sixes || 0,
                sr: b.strikeRate || 0,
                status: b.status || 'not out'
              })) || [],
              bowling: inning.bowling?.map(b => ({
                name: b.player?.name || `Player ${b.playerId}`,
                overs: b.overs || 0,
                maidens: b.maidens || 0,
                runs: b.runs || 0,
                wickets: b.wickets || 0,
                economy: b.economy || 0,
                dots: b.dots || 0,
                fours: b.fours || 0,
                sixes: b.sixes || 0
              })) || [],
              fall_of_wickets: inning.fallOfWickets?.map(fow => ({
                wicket_number: fow.wicket || 0,
                score: fow.score || 0,
                player_out: fow.playerName || fow.player || 'Unknown',
                over: fow.over || 0
              })) || []
            };
            innings.push(transformedInning);
          }
        }
      } catch (error) {
        console.log(`Failed to load detailed data for inning ${inningSummary.id}:`, error);
      }
    }

    return innings.length > 0 ? innings : null;

  } catch (error) {
    console.log('API endpoints not available, trying direct file access');
  }

  // Fallback: try to load from a static JSON endpoint
  try {
    const response = await fetch('/reports/cricket_matches_summary_full.json');
    if (response.ok) {
      const matchesData = await response.json();
      const matchData = matchesData.find(m => m.match_id === matchId || m.match_id === currentData.matches?.find(m => m.id === matchId)?.originalId);
      return matchData ? matchData.innings : null;
    }
  } catch (error) {
    console.log('Could not load innings data from JSON file');
  }

  return null;
}

async function showMatchDetail(matchId) {
  const detailDiv = document.getElementById('match-detail');
  detailDiv.style.display = 'block';
  detailDiv.innerHTML = '<div class="loading">Loading match details...</div>';

  try {
    const data = await apiCall(`/api/v2/matches/${matchId}`);
    const match = data.data;

    let html = `<h3>Match Details: ${match.title || match.displayId}</h3>`;

    // Match Overview Section
    html += '<div class="detail-section">';
    html += '<h4>📋 Match Overview</h4>';
    html += '<div class="detail-grid">';

    // Basic Information
    html += `<div class="detail-item"><strong>Match ID:</strong> ${match.displayId || match.id}</div>`;
    html += `<div class="detail-item"><strong>Title:</strong> ${match.title || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Status:</strong> <span class="status-${match.status}">${match.status || 'Unknown'}</span></div>`;
    html += `<div class="detail-item"><strong>Type:</strong> ${match.matchType || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Venue:</strong> ${match.venue || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Tournament:</strong> ${match.tournament ? match.tournament.name : 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Scheduled Date:</strong> ${match.scheduledDate ? new Date(match.scheduledDate).toLocaleString() : 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Created:</strong> ${match.createdAt ? new Date(match.createdAt).toLocaleString() : 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Last Updated:</strong> ${match.updatedAt ? new Date(match.updatedAt).toLocaleString() : 'N/A'}</div>`;

    if (match.externalMatchId) {
      html += `<div class="detail-item"><strong>External Match ID:</strong> ${match.externalMatchId}</div>`;
    }

    html += '</div>';
    html += '</div>';

    // Teams Section
    html += '<div class="detail-section">';
    html += '<h4>👥 Teams & Squads</h4>';
    html += '<div class="detail-grid">';

    if (match.team1) {
      html += `<div class="detail-item"><strong>Team 1:</strong> ${match.team1.name} (${match.team1.shortName})</div>`;
      if (match.team1.squad) {
        html += `<div class="detail-item"><strong>Team 1 Captain:</strong> ${match.team1.squad.captainName || 'N/A'}</div>`;
        html += `<div class="detail-item"><strong>Team 1 Players:</strong> ${match.team1.squad.playersCount || 0}</div>`;
      }
    }

    if (match.team2) {
      html += `<div class="detail-item"><strong>Team 2:</strong> ${match.team2.name} (${match.team2.shortName})</div>`;
      if (match.team2.squad) {
        html += `<div class="detail-item"><strong>Team 2 Captain:</strong> ${match.team2.squad.captainName || 'N/A'}</div>`;
        html += `<div class="detail-item"><strong>Team 2 Players:</strong> ${match.team2.squad.playersCount || 0}</div>`;
      }
    }

    html += '</div>';

    // Show nested players within team1 and team2 objects
    if (match.team1 && match.team1.players && match.team1.players.length > 0) {
      html += '<h5>Team 1 Nested Players</h5>';
      html += '<div class="players-grid">';

      match.team1.players.forEach(player => {
        const isCaptain = player.isCaptain;
        const isViceCaptain = player.isViceCaptain;
        const captainBadge = isCaptain ? ' (C)' : '';
        const vcBadge = isViceCaptain ? ' (VC)' : '';
        const impact = calculatePlayerImpact(player);
        const impactRating = getImpactRating(impact);

        html += `
          <div class="player-card">
            <div class="player-header">
              <strong>${player.player ? player.player.name : player.name || `Player ${player.playerId || player.id}`}</strong>
              <span class="player-role">${player.player ? player.player.role : player.role || 'N/A'}${captainBadge}${vcBadge}</span>
            </div>
            <div class="player-team">Team: ${match.team1.name}</div>
            <div class="player-impact">
              <div class="impact-score" style="color: ${impactRating.color}; font-weight: bold;">
                Impact: ${impact} pts
              </div>
              <div class="impact-rating">
                <span class="rating-stars">${impactRating.rating}</span>
                <span class="rating-label">${impactRating.label}</span>
              </div>
            </div>
            <div class="player-stats">
              <div class="stat-group">
                <h6>Batting</h6>
                <div class="stat-item"><span>Runs:</span> ${player.batting?.runs || 0}</div>
                <div class="stat-item"><span>Balls:</span> ${player.batting?.balls || 0}</div>
                <div class="stat-item"><span>4s:</span> ${player.batting?.fours || 0}</div>
                <div class="stat-item"><span>6s:</span> ${player.batting?.sixes || 0}</div>
                <div class="stat-item"><span>SR:</span> ${player.batting?.strikeRate ? player.batting.strikeRate.toFixed(2) : 'N/A'}</div>
              </div>
              <div class="stat-group">
                <h6>Bowling</h6>
                <div class="stat-item"><span>Overs:</span> ${player.bowling?.overs || 0}</div>
                <div class="stat-item"><span>Wickets:</span> ${player.bowling?.wickets || 0}</div>
                <div class="stat-item"><span>Runs:</span> ${player.bowling?.runs || 0}</div>
                <div class="stat-item"><span>Econ:</span> ${player.bowling?.economy ? player.bowling.economy.toFixed(2) : 'N/A'}</div>
              </div>
            </div>
            <div class="player-additional-info">
              <div class="stat-item"><span>Matches Played:</span> ${player.matchesPlayed || 0}</div>
              <div class="stat-item"><span>Total Runs:</span> ${player.totalRuns || 0}</div>
              <div class="stat-item"><span>Total Wickets:</span> ${player.totalWickets || 0}</div>
            </div>
          </div>
        `;
      });

      html += '</div>';
    }

    if (match.team2 && match.team2.players && match.team2.players.length > 0) {
      html += '<h5>Team 2 Nested Players</h5>';
      html += '<div class="players-grid">';

      match.team2.players.forEach(player => {
        const isCaptain = player.isCaptain;
        const isViceCaptain = player.isViceCaptain;
        const captainBadge = isCaptain ? ' (C)' : '';
        const vcBadge = isViceCaptain ? ' (VC)' : '';
        const impact = calculatePlayerImpact(player);
        const impactRating = getImpactRating(impact);

        html += `
          <div class="player-card">
            <div class="player-header">
              <strong>${player.player ? player.player.name : player.name || `Player ${player.playerId || player.id}`}</strong>
              <span class="player-role">${player.player ? player.player.role : player.role || 'N/A'}${captainBadge}${vcBadge}</span>
            </div>
            <div class="player-team">Team: ${match.team2.name}</div>
            <div class="player-impact">
              <div class="impact-score" style="color: ${impactRating.color}; font-weight: bold;">
                Impact: ${impact} pts
              </div>
              <div class="impact-rating">
                <span class="rating-stars">${impactRating.rating}</span>
                <span class="rating-label">${impactRating.label}</span>
              </div>
            </div>
            <div class="player-stats">
              <div class="stat-group">
                <h6>Batting</h6>
                <div class="stat-item"><span>Runs:</span> ${player.batting?.runs || 0}</div>
                <div class="stat-item"><span>Balls:</span> ${player.batting?.balls || 0}</div>
                <div class="stat-item"><span>4s:</span> ${player.batting?.fours || 0}</div>
                <div class="stat-item"><span>6s:</span> ${player.batting?.sixes || 0}</div>
                <div class="stat-item"><span>SR:</span> ${player.batting?.strikeRate ? player.batting.strikeRate.toFixed(2) : 'N/A'}</div>
              </div>
              <div class="stat-group">
                <h6>Bowling</h6>
                <div class="stat-item"><span>Overs:</span> ${player.bowling?.overs || 0}</div>
                <div class="stat-item"><span>Wickets:</span> ${player.bowling?.wickets || 0}</div>
                <div class="stat-item"><span>Runs:</span> ${player.bowling?.runs || 0}</div>
                <div class="stat-item"><span>Econ:</span> ${player.bowling?.economy ? player.bowling.economy.toFixed(2) : 'N/A'}</div>
              </div>
            </div>
            <div class="player-additional-info">
              <div class="stat-item"><span>Matches Played:</span> ${player.matchesPlayed || 0}</div>
              <div class="stat-item"><span>Total Runs:</span> ${player.totalRuns || 0}</div>
              <div class="stat-item"><span>Total Wickets:</span> ${player.totalWickets || 0}</div>
            </div>
          </div>
        `;
      });

      html += '</div>';
    }

    html += '</div>';

    // Toss & Match Events
    if (match.toss || match.result || match.playerOfMatch) {
      html += '<div class="detail-section">';
      html += '<h4>🎯 Match Events</h4>';
      html += '<div class="detail-grid">';

      if (match.toss) {
        html += `<div class="detail-item"><strong>Toss Winner:</strong> ${match.toss.winnerTeamName || 'N/A'}</div>`;
        html += `<div class="detail-item"><strong>Toss Decision:</strong> ${match.toss.decision || 'N/A'}</div>`;
      }

      if (match.result) {
        html += `<div class="detail-item"><strong>Result Type:</strong> ${match.result.resultType || 'N/A'}</div>`;
        if (match.result.winnerTeamName) {
          html += `<div class="detail-item"><strong>Winner:</strong> ${match.result.winnerTeamName}</div>`;
        }
        if (match.result.margin) {
          html += `<div class="detail-item"><strong>Margin:</strong> ${match.result.margin}</div>`;
        }
      }

      if (match.playerOfMatch) {
        html += `<div class="detail-item"><strong>Player of the Match:</strong> ${match.playerOfMatch.name || 'N/A'}</div>`;
      }

      html += '</div>';
      html += '</div>';
    }

    // Scores Section
    if (match.scores) {
      html += '<div class="detail-section">';
      html += '<h4>📊 Scores</h4>';
      html += '<div class="detail-grid">';

      if (match.scores.team1) {
        html += `<div class="detail-item"><strong>Team 1 Score:</strong> ${match.scores.team1.runs || 0}/${match.scores.team1.wickets || 0} (${match.scores.team1.overs || 0} overs${match.scores.team1.declared ? ' - declared' : ''})</div>`;
      }

      if (match.scores.team2) {
        html += `<div class="detail-item"><strong>Team 2 Score:</strong> ${match.scores.team2.runs || 0}/${match.scores.team2.wickets || 0} (${match.scores.team2.overs || 0} overs${match.scores.team2.declared ? ' - declared' : ''})</div>`;
      }

      html += '</div>';
      html += '</div>';
    }

    // Squads Details
    if (match.squads && Object.keys(match.squads).length > 0) {
      html += '<div class="detail-section">';
      html += '<h4>🏏 Team Squads</h4>';

      Object.entries(match.squads).forEach(([teamId, squad]) => {
        html += `<h5>${squad.teamName || `Team ${teamId}`}</h5>`;
        html += '<div class="detail-grid">';

        if (squad.captain) {
          html += `<div class="detail-item"><strong>Captain:</strong> ${squad.captain.name} (${squad.captain.role || 'N/A'})</div>`;
        }

        if (squad.wicketKeeper) {
          html += `<div class="detail-item"><strong>Wicket Keeper:</strong> ${squad.wicketKeeper.name} (${squad.wicketKeeper.role || 'N/A'})</div>`;
        }

        if (squad.players && squad.players.length > 0) {
          html += `<div class="detail-item"><strong>Players (${squad.players.length}):</strong></div>`;
          html += '<div class="players-list">';
          squad.players.forEach(player => {
            html += `<div class="player-item">${player.name} (${player.role || 'N/A'})</div>`;
          });
          html += '</div>';
        }

        html += '</div>';
      });

      html += '</div>';
    }

    // Player Statistics
    if (match.playerStats && match.playerStats.length > 0) {
      html += '<div class="detail-section">';
      html += '<h4>📈 Player Statistics</h4>';
      html += '<div class="table-container">';
      html += '<table class="data-table">';
      html += '<thead><tr><th>Player</th><th>Team</th><th>Role</th><th>Runs</th><th>Balls</th><th>4s</th><th>6s</th><th>SR</th><th>Overs</th><th>Wickets</th><th>Runs Conceded</th><th>Econ</th></tr></thead>';
      html += '<tbody>';

      match.playerStats.forEach(stat => {
        const playerName = stat.player ? stat.player.name : `Player ${stat.playerId}`;
        const playerRole = stat.player ? stat.player.role : 'N/A';
        const playerTeam = getPlayerTeamName(stat.playerId, match);
        html += `<tr>
          <td>${playerName}</td>
          <td>${playerTeam}</td>
          <td>${playerRole}</td>
          <td>${stat.batting?.runs || 0}</td>
          <td>${stat.batting?.balls || 0}</td>
          <td>${stat.batting?.fours || 0}</td>
          <td>${stat.batting?.sixes || 0}</td>
          <td>${stat.batting?.strikeRate ? stat.batting.strikeRate.toFixed(2) : 'N/A'}</td>
          <td>${stat.bowling?.overs || 0}</td>
          <td>${stat.bowling?.wickets || 0}</td>
          <td>${stat.bowling?.runs || 0}</td>
          <td>${stat.bowling?.economy ? stat.bowling.economy.toFixed(2) : 'N/A'}</td>
        </tr>`;
      });

      html += '</tbody></table></div></div>';
    }

    // All Players from Match
    html += '<div class="detail-section">';
    html += '<h4>👥 All Players in Match</h4>';

    // Team 1 Players
    if (match.squads && match.squads[match.team1?.id]) {
      const team1Squad = match.squads[match.team1.id];
      html += `<h5>🏏 ${match.team1?.name || 'Team 1'} Squad</h5>`;
      html += '<div class="players-grid">';

      if (team1Squad.players && team1Squad.players.length > 0) {
        team1Squad.players.forEach(player => {
          const playerStats = getPlayerMatchStats(player.id, match);
          const isCaptain = team1Squad.captain && team1Squad.captain.id === player.id;
          const isWicketKeeper = team1Squad.wicketKeeper && team1Squad.wicketKeeper.id === player.id;
          const captainBadge = isCaptain ? ' (C)' : '';
          const wkBadge = isWicketKeeper ? ' (WK)' : '';

          html += `
            <div class="player-card">
              <div class="player-header">
                <strong>${player.name}</strong>
                <span class="player-role">${player.role || 'N/A'}${captainBadge}${wkBadge}</span>
              </div>
              <div class="player-stats">
                <div class="stat-group">
                  <h6>Batting</h6>
                  <div class="stat-item"><span>Runs:</span> ${playerStats.batting?.runs || 0}</div>
                  <div class="stat-item"><span>Balls:</span> ${playerStats.batting?.balls || 0}</div>
                  <div class="stat-item"><span>4s:</span> ${playerStats.batting?.fours || 0}</div>
                  <div class="stat-item"><span>6s:</span> ${playerStats.batting?.sixes || 0}</div>
                  <div class="stat-item"><span>SR:</span> ${playerStats.batting?.strikeRate ? playerStats.batting.strikeRate.toFixed(2) : 'N/A'}</div>
                </div>
                <div class="stat-group">
                  <h6>Bowling</h6>
                  <div class="stat-item"><span>Overs:</span> ${playerStats.bowling?.overs || 0}</div>
                  <div class="stat-item"><span>Wickets:</span> ${playerStats.bowling?.wickets || 0}</div>
                  <div class="stat-item"><span>Runs:</span> ${playerStats.bowling?.runs || 0}</div>
                  <div class="stat-item"><span>Econ:</span> ${playerStats.bowling?.economy ? playerStats.bowling.economy.toFixed(2) : 'N/A'}</div>
                </div>
              </div>
            </div>
          `;
        });
      }

      html += '</div>';
    }

    // Team 2 Players
    if (match.squads && match.squads[match.team2?.id]) {
      const team2Squad = match.squads[match.team2.id];
      html += `<h5>🏏 ${match.team2?.name || 'Team 2'} Squad</h5>`;
      html += '<div class="players-grid">';

      if (team2Squad.players && team2Squad.players.length > 0) {
        team2Squad.players.forEach(player => {
          const playerStats = getPlayerMatchStats(player.id, match);
          const isCaptain = team2Squad.captain && team2Squad.captain.id === player.id;
          const isWicketKeeper = team2Squad.wicketKeeper && team2Squad.wicketKeeper.id === player.id;
          const captainBadge = isCaptain ? ' (C)' : '';
          const wkBadge = isWicketKeeper ? ' (WK)' : '';

          html += `
            <div class="player-card">
              <div class="player-header">
                <strong>${player.name}</strong>
                <span class="player-role">${player.role || 'N/A'}${captainBadge}${wkBadge}</span>
              </div>
              <div class="player-stats">
                <div class="stat-group">
                  <h6>Batting</h6>
                  <div class="stat-item"><span>Runs:</span> ${playerStats.batting?.runs || 0}</div>
                  <div class="stat-item"><span>Balls:</span> ${playerStats.batting?.balls || 0}</div>
                  <div class="stat-item"><span>4s:</span> ${playerStats.batting?.fours || 0}</div>
                  <div class="stat-item"><span>6s:</span> ${playerStats.batting?.sixes || 0}</div>
                  <div class="stat-item"><span>SR:</span> ${playerStats.batting?.strikeRate ? playerStats.batting.strikeRate.toFixed(2) : 'N/A'}</div>
                </div>
                <div class="stat-group">
                  <h6>Bowling</h6>
                  <div class="stat-item"><span>Overs:</span> ${playerStats.bowling?.overs || 0}</div>
                  <div class="stat-item"><span>Wickets:</span> ${playerStats.bowling?.wickets || 0}</div>
                  <div class="stat-item"><span>Runs:</span> ${playerStats.bowling?.runs || 0}</div>
                  <div class="stat-item"><span>Econ:</span> ${playerStats.bowling?.economy ? playerStats.bowling.economy.toFixed(2) : 'N/A'}</div>
                </div>
              </div>
            </div>
          `;
        });
      }

      html += '</div>';
    }

    // If no squads data, show players from innings
    if ((!match.squads || Object.keys(match.squads).length === 0) && match.innings) {
      html += '<h5>Players from Innings Data</h5>';
      const allPlayers = new Map();

      match.innings.forEach(inning => {
        // Add batsmen
        if (inning.batsmen) {
          inning.batsmen.forEach(batsman => {
            if (batsman.player && batsman.player.id) {
              allPlayers.set(batsman.player.id, {
                ...batsman.player,
                team: inning.battingTeam?.name || 'Unknown'
              });
            }
          });
        }

        // Add bowlers
        if (inning.bowling) {
          inning.bowling.forEach(bowler => {
            if (bowler.player && bowler.player.id) {
              allPlayers.set(bowler.player.id, {
                ...bowler.player,
                team: inning.bowlingTeam?.name || 'Unknown'
              });
            }
          });
        }
      });

      if (allPlayers.size > 0) {
        html += '<div class="players-grid">';

        allPlayers.forEach(player => {
          const playerStats = getPlayerMatchStats(player.id, match);

          html += `
            <div class="player-card">
              <div class="player-header">
                <strong>${player.name}</strong>
                <span class="player-role">${player.role || 'N/A'}</span>
              </div>
              <div class="player-team">Team: ${player.team}</div>
              <div class="player-stats">
                <div class="stat-group">
                  <h6>Batting</h6>
                  <div class="stat-item"><span>Runs:</span> ${playerStats.batting?.runs || 0}</div>
                  <div class="stat-item"><span>Balls:</span> ${playerStats.batting?.balls || 0}</div>
                  <div class="stat-item"><span>4s:</span> ${playerStats.batting?.fours || 0}</div>
                  <div class="stat-item"><span>6s:</span> ${playerStats.batting?.sixes || 0}</div>
                  <div class="stat-item"><span>SR:</span> ${playerStats.batting?.strikeRate ? playerStats.batting.strikeRate.toFixed(2) : 'N/A'}</div>
                </div>
                <div class="stat-group">
                  <h6>Bowling</h6>
                  <div class="stat-item"><span>Overs:</span> ${playerStats.bowling?.overs || 0}</div>
                  <div class="stat-item"><span>Wickets:</span> ${playerStats.bowling?.wickets || 0}</div>
                  <div class="stat-item"><span>Runs:</span> ${playerStats.bowling?.runs || 0}</div>
                  <div class="stat-item"><span>Econ:</span> ${playerStats.bowling?.economy ? playerStats.bowling.economy.toFixed(2) : 'N/A'}</div>
                </div>
              </div>
            </div>
          `;
        });

        html += '</div>';
      }
    }

    html += '</div>';

    // Load detailed innings data
    try {
      const inningsData = await loadMatchInningsData(matchId);
      if (inningsData && inningsData.length > 0) {
        html += '<div class="detail-section">';
        html += '<h4>🎾 Detailed Innings</h4>';

        inningsData.forEach((inning, index) => {
          const inningNumber = index + 1;
          html += `<div class="inning-details">`;
          html += `<h5>Inning ${inningNumber}: ${inning.team} - ${inning.score} (${inning.overs})</h5>`;

          // Batting table
          if (inning.batsmen && inning.batsmen.length > 0) {
            html += '<h6>🏏 Batting</h6>';
            html += '<div class="table-container">';
            html += '<table class="innings-table">';
            html += '<tr><th>Batsman</th><th>Runs</th><th>Balls</th><th>4s</th><th>6s</th><th>SR</th><th>Dismissal</th></tr>';

            inning.batsmen.forEach(batsman => {
              html += `<tr>
                <td>${batsman.name}</td>
                <td>${batsman.runs}</td>
                <td>${batsman.balls}</td>
                <td>${batsman.fours || 0}</td>
                <td>${batsman.sixes || 0}</td>
                <td>${batsman.sr || 'N/A'}</td>
                <td>${batsman.status}</td>
              </tr>`;
            });

            html += '</table>';
            html += '</div>';
          }

          // Bowling table
          if (inning.bowling && inning.bowling.length > 0) {
            html += '<h6>🎯 Bowling</h6>';
            html += '<div class="table-container">';
            html += '<table class="innings-table">';
            html += '<tr><th>Bowler</th><th>Overs</th><th>Maidens</th><th>Runs</th><th>Wickets</th><th>Econ</th><th>Dots</th><th>4s</th><th>6s</th></tr>';

            inning.bowling.forEach(bowler => {
              html += `<tr>
                <td>${bowler.name}</td>
                <td>${bowler.overs}</td>
                <td>${bowler.maidens || 0}</td>
                <td>${bowler.runs}</td>
                <td>${bowler.wickets}</td>
                <td>${bowler.economy || 'N/A'}</td>
                <td>${bowler.dots || 0}</td>
                <td>${bowler.fours || 0}</td>
                <td>${bowler.sixes || 0}</td>
              </tr>`;
            });

            html += '</table>';
            html += '</div>';
          }

          // Fall of wickets
          if (inning.fall_of_wickets && inning.fall_of_wickets.length > 0) {
            html += '<h6>📉 Fall of Wickets</h6>';
            html += '<div class="table-container">';
            html += '<table class="innings-table">';
            html += '<tr><th>Wicket</th><th>Score</th><th>Player Out</th><th>Over</th></tr>';

            inning.fall_of_wickets.forEach(fow => {
              html += `<tr>
                <td>${fow.wicket_number}</td>
                <td>${fow.score}</td>
                <td>${fow.player_out}</td>
                <td>${fow.over}</td>
              </tr>`;
            });

            html += '</table>';
            html += '</div>';
          }

          html += '</div>';
        });

        html += '</div>';
      } else {
        // Fallback to basic innings summary
        if (match.innings && match.innings.length > 0) {
          html += '<div class="detail-section">';
          html += '<h4>🎾 Innings Summary</h4>';
          html += '<div class="table-container">';
          html += '<table class="innings-table">';
          html += '<tr><th>Inning</th><th>Runs</th><th>Wickets</th><th>Overs</th><th>Run Rate</th><th>Batting Team</th><th>Bowling Team</th></tr>';

          match.innings.forEach(inning => {
            const battingTeam = match.team1 && match.team1.id === inning.battingTeam ?
                              match.team1.name :
                              match.team2 && match.team2.id === inning.battingTeam ? match.team2.name : inning.battingTeam;
            const bowlingTeam = match.team1 && match.team1.id === inning.bowlingTeam ? match.team1.name :
                              match.team2 && match.team2.id === inning.bowlingTeam ? match.team2.name : inning.bowlingTeam;

            html += `<tr>
              <td>${inning.id}</td>
              <td>${inning.totalRuns}</td>
              <td>${inning.totalWickets}</td>
              <td>${inning.totalOvers}</td>
              <td>${inning.runRate ? inning.runRate.toFixed(2) : 'N/A'}</td>
              <td>${battingTeam}</td>
              <td>${bowlingTeam}</td>
            </tr>`;
          });

          html += '</table>';
          html += '</div></div>';
        }
      }
    } catch (inningsError) {
      console.error('Error loading innings data:', inningsError);
      // Fallback to basic innings summary
      if (match.innings && match.innings.length > 0) {
        html += '<div class="detail-section">';
        html += '<h4>🎾 Innings Summary</h4>';
        html += '<div class="table-container">';
        html += '<table class="innings-table">';
        html += '<tr><th>Inning</th><th>Runs</th><th>Wickets</th><th>Overs</th><th>Run Rate</th><th>Batting Team</th><th>Bowling Team</th></tr>';

        match.innings.forEach(inning => {
          const battingTeam = match.team1 && match.team1.id === inning.battingTeam ? match.team1.name :
                            match.team2 && match.team2.id === inning.battingTeam ? match.team2.name : inning.battingTeam;
          const bowlingTeam = match.team1 && match.team1.id === inning.bowlingTeam ? match.team1.name :
                            match.team2 && match.team2.id === inning.bowlingTeam ? match.team2.name : inning.bowlingTeam;

          html += `<tr>
            <td>${inning.id}</td>
            <td>${inning.totalRuns}</td>
            <td>${inning.totalWickets}</td>
            <td>${inning.totalOvers}</td>
            <td>${inning.runRate ? inning.runRate.toFixed(2) : 'N/A'}</td>
            <td>${battingTeam}</td>
            <td>${bowlingTeam}</td>
          </tr>`;
        });

        html += '</table>';
        html += '</div></div>';
      }
    }

    // Raw JSON Data (for debugging/advanced users)
    html += '<div class="detail-section">';
    html += '<h4>🔧 Raw Match Data (JSON)</h4>';
    html += '<details>';
    html += '<summary>Click to view complete match data</summary>';
    html += `<pre style="background: var(--background-color); padding: 16px; border-radius: var(--border-radius); overflow-x: auto; font-size: 12px; max-height: 400px; overflow-y: auto;">${JSON.stringify(match, null, 2)}</pre>`;
    html += '</details>';
    html += '</div>';

    html += '<br><button class="btn btn-secondary" onclick="hideMatchDetail()">Close Details</button>';

    detailDiv.innerHTML = html;
    detailDiv.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    detailDiv.innerHTML = `<div class="error">Error loading match details: ${error.message}</div>`;
  }
}

function getPlayerTeamName(playerId, match) {
  // Check if player is in team1 squad
  if (match.squads && match.squads[match.team1?.id]) {
    const team1Squad = match.squads[match.team1.id];
    if (team1Squad.players && team1Squad.players.some(p => p.id === playerId)) {
      return match.team1?.name || 'Team 1';
    }
  }

  // Check if player is in team2 squad
  if (match.squads && match.squads[match.team2?.id]) {
    const team2Squad = match.squads[match.team2.id];
    if (team2Squad.players && team2Squad.players.some(p => p.id === playerId)) {
      return match.team2?.name || 'Team 2';
    }
  }

  // Fallback: check innings data
  if (match.innings) {
    for (const inning of match.innings) {
      // Check batsmen
      if (inning.batsmen) {
        const batsman = inning.batsmen.find(b => b.playerId === playerId || (b.player && b.player.id === playerId));
        if (batsman) {
          return inning.battingTeam?.name || 'Unknown';
        }
      }

      // Check bowlers
      if (inning.bowling) {
        const bowler = inning.bowling.find(b => b.playerId === playerId || (b.player && b.player.id === playerId));
        if (bowler) {
          return inning.bowlingTeam?.name || 'Unknown';
        }
      }
    }
  }

  return 'Unknown';
}

function calculatePlayerImpact(player) {
  let impact = 0;

  // Batting Impact
  const batting = player.batting || {};
  const runs = batting.runs || 0;
  const balls = batting.balls || 0;
  const fours = batting.fours || 0;
  const sixes = batting.sixes || 0;

  // Batting points: runs + boundaries bonus + strike rate bonus
  impact += runs;
  impact += fours * 1; // 1 extra point per boundary
  impact += sixes * 2; // 2 extra points per six

  // Strike rate bonus (if strike rate > 100, add bonus points)
  if (balls > 0) {
    const strikeRate = (runs / balls) * 100;
    if (strikeRate > 100) {
      impact += Math.floor((strikeRate - 100) / 10); // Bonus for high strike rate
    }
  }

  // Bowling Impact
  const bowling = player.bowling || {};
  const wickets = bowling.wickets || 0;
  const overs = bowling.overs || 0;
  const bowlingRuns = bowling.runs || 0;

  // Bowling points: 25 points per wicket + economy bonus
  impact += wickets * 25;

  // Economy rate bonus (lower economy = better)
  if (overs > 0) {
    const economy = bowlingRuns / overs;
    if (economy < 6) {
      impact += Math.floor((6 - economy) * 2); // Bonus for good economy
    }
  }

  // Fielding Impact (if available)
  const fielding = player.fielding || {};
  const catches = fielding.catches || 0;
  const runOuts = fielding.runOuts || 0;

  impact += catches * 10; // 10 points per catch
  impact += runOuts * 10; // 10 points per run out

  return Math.round(impact);
}

function getImpactRating(impact) {
  if (impact >= 100) return { rating: '⭐⭐⭐⭐⭐', color: '#FFD700', label: 'Game Changer' };
  if (impact >= 75) return { rating: '⭐⭐⭐⭐', color: '#32CD32', label: 'Excellent' };
  if (impact >= 50) return { rating: '⭐⭐⭐', color: '#1E90FF', label: 'Good' };
  if (impact >= 25) return { rating: '⭐⭐', color: '#FFA500', label: 'Decent' };
  if (impact >= 10) return { rating: '⭐', color: '#FF6347', label: 'Minimal' };
  return { rating: '⚪', color: '#808080', label: 'Low Impact' };
}

// Teams functions
async function loadTeams() {
  const contentId = 'teams-content';
  showLoading(contentId);

  try {
    const data = await apiCall('/api/v2/teams');
    currentData.teams = data.data;
    displayTeams(data.data, contentId);
  } catch (error) {
    showError(contentId, error);
  }
}

function displayTeams(teams, containerId) {
  if (!teams || teams.length === 0) {
    document.getElementById(containerId).innerHTML = '<p>No teams found.</p>';
    return;
  }

  let html = `<p>Found ${teams.length} teams:</p>`;
  html += '<div class="data-grid">';

  teams.forEach(team => {
    const playersCount = team.players ? team.players.length : 0;
    const matchesPlayed = team.teamStats ? team.teamStats.matchesPlayed : 0;
    const winPercentage = team.teamStats ? team.teamStats.winPercentage : 0;

    html += `
      <div class="data-card" onclick="showTeamDetail('${team.id}')">
        <h3>${team.name}</h3>
        <p><strong>Short Name:</strong> ${team.shortName || 'N/A'}</p>
        <p><strong>ID:</strong> ${team.displayId || team.id}</p>
        <p><strong>Captain:</strong> ${team.captain ? team.captain.name : 'N/A'}</p>
        <p><strong>Vice Captain:</strong> ${team.viceCaptain ? team.viceCaptain.name : 'N/A'}</p>
        <p><strong>Players:</strong> ${playersCount}</p>
        <p><strong>Matches:</strong> ${matchesPlayed} | <strong>Win %:</strong> ${winPercentage.toFixed(1)}%</p>
        <div class="card-actions">
          <button class="btn btn-small btn-edit" onclick="editTeam('${team.id}', event)">Edit</button>
          <button class="btn btn-small btn-delete" onclick="deleteTeam('${team.id}', event)">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  document.getElementById(containerId).innerHTML = html;
}

async function showTeamDetail(teamId) {
  const detailDiv = document.getElementById('team-detail');
  detailDiv.style.display = 'block';
  detailDiv.innerHTML = '<div class="loading">Loading team details...</div>';

  try {
    const data = await apiCall(`/api/v2/teams/${teamId}`);
    const team = data.data;

    let html = `<h3>Team Details: ${team.name}</h3>`;
    html += '<div class="detail-grid">';

    html += `<div class="detail-item"><strong>Name:</strong> ${team.name}</div>`;
    html += `<div class="detail-item"><strong>Short Name:</strong> ${team.shortName || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>ID:</strong> ${team.displayId || team.id}</div>`;
    html += `<div class="detail-item"><strong>Captain:</strong> ${team.captain ? team.captain.name : 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Vice Captain:</strong> ${team.viceCaptain ? team.viceCaptain.name : 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Home Ground:</strong> ${team.homeGround || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Active:</strong> ${team.isActive ? 'Yes' : 'No'}</div>`;
    html += `<div class="detail-item"><strong>Created:</strong> ${team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A'}</div>`;

    // Team Statistics
    if (team.teamStats) {
      html += '<div class="detail-section"><h4>Team Statistics</h4>';
      html += `<div class="detail-item"><strong>Matches Played:</strong> ${team.teamStats.matchesPlayed || 0}</div>`;
      html += `<div class="detail-item"><strong>Matches Won:</strong> ${team.teamStats.matchesWon || 0}</div>`;
      html += `<div class="detail-item"><strong>Matches Lost:</strong> ${team.teamStats.matchesLost || 0}</div>`;
      html += `<div class="detail-item"><strong>Win Percentage:</strong> ${team.teamStats.winPercentage ? team.teamStats.winPercentage.toFixed(1) + '%' : 'N/A'}</div>`;
      html += `<div class="detail-item"><strong>Total Players:</strong> ${team.teamStats.totalPlayers || 0}</div>`;
      html += `<div class="detail-item"><strong>Avg Players/Match:</strong> ${team.teamStats.avgPlayersPerMatch ? team.teamStats.avgPlayersPerMatch.toFixed(1) : 'N/A'}</div>`;
      html += '</div>';
    }

    // Players
    if (team.players && team.players.length > 0) {
      html += '<div class="detail-section"><h4>Players</h4>';
      html += '<div class="players-list">';
      team.players.forEach(player => {
        const isCaptain = player.isCaptain ? ' (C)' : '';
        const isViceCaptain = player.isViceCaptain ? ' (VC)' : '';
        html += `<div class="player-item">
          <strong>${player.player.name}</strong> - ${player.player.role}${isCaptain}${isViceCaptain}
          <br><small>Matches: ${player.matchesPlayed}, Runs: ${player.totalRuns}, Wickets: ${player.totalWickets}</small>
        </div>`;
      });
      html += '</div></div>';
    }

    html += '</div>';

    html += '<br><button class="btn btn-secondary" onclick="hideTeamDetail()">Close Details</button>';

    detailDiv.innerHTML = html;
    detailDiv.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    detailDiv.innerHTML = `<div class="error">Error loading team details: ${error.message}</div>`;
  }
}

function hideTeamDetail() {
  document.getElementById('team-detail').style.display = 'none';
}

// Players functions
async function loadPlayers() {
  const contentId = 'players-content';
  showLoading(contentId);

  try {
    const data = await apiCall('/api/v2/players');
    currentData.players = data.data;
    displayPlayers(data.data, contentId);
  } catch (error) {
    showError(contentId, error);
  }
}

function displayPlayers(players, containerId) {
  if (!players || players.length === 0) {
    document.getElementById(containerId).innerHTML = '<p>No players found.</p>';
    return;
  }

  let html = `<p>Found ${players.length} players:</p>`;
  
  // Add filter controls
  html += '<div class="filter-controls" style="margin-bottom: 20px;">';
  html += '<label for="player-status-filter" style="margin-right: 10px;"><strong>Filter by Status:</strong></label>';
  html += '<select id="player-status-filter" onchange="filterPlayersByStatus()">';
  html += '<option value="all">All Players</option>';
  html += '<option value="active">Active Only</option>';
  html += '<option value="suspended">Suspended Only</option>';
  html += '</select>';
  html += '</div>';
  
  html += '<div class="merge-actions" id="merge-actions" style="display: none;">';
  html += '<button class="btn btn-warning" onclick="showMergeModal()">Merge Selected Players</button>';
  html += '<button class="btn btn-secondary" onclick="clearSelection()">Clear Selection</button>';
  html += '<button class="btn" onclick="alert(\'Test button works!\')">Test Button</button>';
  html += '<span id="selection-count">0 players selected</span>';
  html += '</div>';
  html += '<div class="data-grid">';

  players.forEach(player => {
    const status = player.isActive === false ? 'Suspended' : 'Active';
    const statusClass = player.isActive === false ? 'status-suspended' : 'status-active';
    
    // Extract stats from careerStats object
    const careerStats = player.careerStats || {};
    const matchesPlayed = careerStats.matchesPlayed || 0;
    const totalRuns = careerStats.runs || 0;
    const totalWickets = careerStats.wickets || 0;
    const battingAverage = careerStats.battingAverage || 0;
    const bowlingAverage = careerStats.bowlingAverage || 0;
    const strikeRate = careerStats.strikeRate || 0;
    const economyRate = careerStats.economyRate || 0;
    
    // Get preferred team name
    const teamName = player.preferredTeam ? player.preferredTeam.name : 'N/A';
    
    html += `
      <div class="data-card ${statusClass}" onclick="showPlayerDetail('${player.id}')">
        <div class="card-checkbox">
          <input type="checkbox" id="player-${player.id}" onchange="togglePlayerSelection('${player.id}')" onclick="event.stopPropagation(); console.log('Checkbox clicked for ${player.id}')">
        </div>
        <h3>${player.name}</h3>
        <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${status}</span></p>
        <p><strong>Role:</strong> ${player.role || 'N/A'}</p>
        <p><strong>ID:</strong> ${player.displayId || player.id}</p>
        <p><strong>Team:</strong> ${teamName}</p>
        <p><strong>Matches:</strong> ${matchesPlayed}</p>
        <p><strong>Runs:</strong> ${totalRuns} | <strong>Wickets:</strong> ${totalWickets}</p>
        <p><strong>Batting Avg:</strong> ${battingAverage ? battingAverage.toFixed(2) : 'N/A'} | <strong>Bowling Avg:</strong> ${bowlingAverage ? bowlingAverage.toFixed(2) : 'N/A'}</p>
        <p><strong>Strike Rate:</strong> ${strikeRate ? strikeRate.toFixed(2) : 'N/A'} | <strong>Economy:</strong> ${economyRate ? economyRate.toFixed(2) : 'N/A'}</p>
        <div class="card-actions">
          <button class="btn btn-small btn-edit" onclick="editPlayer('${player.id}', event)">Edit</button>
          <button class="btn btn-small btn-delete" onclick="deletePlayer('${player.id}', event)">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  document.getElementById(containerId).innerHTML = html;
}

async function showPlayerDetail(playerId) {
  const detailDiv = document.getElementById('player-detail');
  detailDiv.style.display = 'block';
  detailDiv.innerHTML = '<div class="loading">Loading player details...</div>';

  try {
    // Get basic player info
    const playerData = await apiCall(`/api/v2/players/${playerId}`);
    const player = playerData.data;

    let html = `<h3>Player Details: ${player.name}</h3>`;
    html += '<div class="detail-grid">';

    html += `<div class="detail-item"><strong>Name:</strong> ${player.name}</div>`;
    html += `<div class="detail-item"><strong>Role:</strong> ${player.role || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>ID:</strong> ${player.displayId || player.id}</div>`;
    html += `<div class="detail-item"><strong>Preferred Team:</strong> ${player.preferredTeam ? player.preferredTeam.name : 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Batting Style:</strong> ${player.battingStyle || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Bowling Style:</strong> ${player.bowlingStyle || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Nationality:</strong> ${player.nationality || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Active:</strong> ${player.isActive !== false ? 'Yes' : 'No'}</div>`;

    // Career Statistics
    if (player.careerStats) {
      html += '<div class="detail-section"><h4>Career Statistics</h4>';
      html += `<div class="detail-item"><strong>Matches Played:</strong> ${player.careerStats.matchesPlayed || 0}</div>`;
      html += `<div class="detail-item"><strong>Runs:</strong> ${player.careerStats.runs || 0}</div>`;
      html += `<div class="detail-item"><strong>Wickets:</strong> ${player.careerStats.wickets || 0}</div>`;
      html += `<div class="detail-item"><strong>Highest Score:</strong> ${player.careerStats.highestScore || 0}</div>`;
      html += `<div class="detail-item"><strong>Batting Average:</strong> ${player.careerStats.battingAverage ? player.careerStats.battingAverage.toFixed(2) : 'N/A'}</div>`;
      html += `<div class="detail-item"><strong>Bowling Average:</strong> ${player.careerStats.bowlingAverage ? player.careerStats.bowlingAverage.toFixed(2) : 'N/A'}</div>`;
      html += `<div class="detail-item"><strong>Strike Rate:</strong> ${player.careerStats.strikeRate ? player.careerStats.strikeRate.toFixed(2) : 'N/A'}</div>`;
      html += `<div class="detail-item"><strong>Economy Rate:</strong> ${player.careerStats.economyRate ? player.careerStats.economyRate.toFixed(2) : 'N/A'}</div>`;
      html += `<div class="detail-item"><strong>Catches:</strong> ${player.careerStats.catches || 0}</div>`;
      html += `<div class="detail-item"><strong>Run Outs:</strong> ${player.careerStats.runOuts || 0}</div>`;
      html += '</div>';
    }

    // Teams Played For
    if (player.teamsPlayedFor && player.teamsPlayedFor.length > 0) {
      html += '<div class="detail-section"><h4>Teams Played For</h4>';
      html += '<div class="teams-list">';
      player.teamsPlayedFor.forEach(teamInfo => {
        const captainText = teamInfo.isCaptain ? ' (Captain)' : '';
        html += `<div class="team-item">
          <strong>${teamInfo.team.name}</strong>${captainText}
          <br><small>Matches: ${teamInfo.matchesPlayed}, Runs: ${teamInfo.totalRuns}, Wickets: ${teamInfo.totalWickets}</small>
        </div>`;
      });
      html += '</div></div>';
    }

    // Recent Matches
    if (player.recentMatches && player.recentMatches.length > 0) {
      html += '<div class="detail-section"><h4>Recent Matches</h4>';
      html += '<div class="matches-table-container">';
      html += '<table class="data-table">';
      html += '<thead>';
      html += '<tr>';
      html += '<th>Date</th>';
      html += '<th>Match</th>';
      html += '<th>Team</th>';
      html += '<th>Batting</th>';
      html += '<th>Bowling</th>';
      html += '</tr>';
      html += '</thead>';
      html += '<tbody>';

      player.recentMatches.forEach(match => {
        const matchDate = match.match.date ? new Date(match.match.date).toLocaleDateString() : 'N/A';
        const batting = match.batting ? `${match.batting.runs}/${match.batting.balls} (${match.batting.dismissal || 'not out'})` : '-';
        const bowling = match.bowling ? `${match.bowling.wickets}/${match.bowling.runs} (${match.bowling.overs} overs)` : '-';

        html += '<tr>';
        html += `<td>${matchDate}</td>`;
        html += `<td>${match.match.title}</td>`;
        html += `<td>${match.teamPlayedFor.name}</td>`;
        html += `<td>${batting}</td>`;
        html += `<td>${bowling}</td>`;
        html += '</tr>';
      });

      html += '</tbody>';
      html += '</table>';
      html += '</div></div>';
    }

    html += '</div>';

    html += '<br><button class="btn btn-secondary" onclick="hidePlayerDetail()">Close Details</button>';

    detailDiv.innerHTML = html;
    detailDiv.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    detailDiv.innerHTML = `<div class="error">Error loading player details: ${error.message}</div>`;
  }
}

function hidePlayerDetail() {
  document.getElementById('player-detail').style.display = 'none';
}

async function recalculatePlayerStats() {
  console.log('🔄 recalculatePlayerStats called');

  // First, get the preview mapping
  const contentId = 'players-content';
  showLoading(contentId, 'Getting player mapping preview...');

  try {
    console.log('📡 Making API call to /api/players/preview-recalculate-stats');
    const previewResult = await apiCall('/api/players/preview-recalculate-stats', 'GET');
    console.log('📊 Preview result:', previewResult);

    // Transform API response to expected format
    const transformedStats = {
      playerMapping: previewResult.data.playerMapping,
      databasePlayers: [], // We'll populate this from playerMapping
      jsonPlayers: [], // We'll populate this from playerMapping
      playersInDatabase: previewResult.data.totalPlayersInDatabase,
      jsonPlayersFound: previewResult.data.playerMapping.length,
      matchesProcessed: previewResult.data.matchesProcessed
    };

    // Extract unique database players from mapping
    const dbPlayerMap = new Map();
    previewResult.data.playerMapping.forEach(mapping => {
      if (mapping.databasePlayerId && !dbPlayerMap.has(mapping.databasePlayerId)) {
        dbPlayerMap.set(mapping.databasePlayerId, {
          id: mapping.databasePlayerId,
          name: mapping.databasePlayerName,
          numericId: mapping.databasePlayerId, // Assuming ID is numeric for display
          role: 'N/A' // We don't have role info in mapping
        });
      }
    });
    transformedStats.databasePlayers = Array.from(dbPlayerMap.values());

    // Extract unique JSON players from mapping
    const jsonPlayerMap = new Map();
    previewResult.data.playerMapping.forEach(mapping => {
      if (!jsonPlayerMap.has(mapping.matchPlayerName)) {
        // Find if there's a suggested match
        const suggestedMatch = previewResult.data.playerMapping.find(m => 
          m.matchPlayerName === mapping.matchPlayerName && m.databasePlayerId
        );
        
        jsonPlayerMap.set(mapping.matchPlayerName, {
          name: mapping.matchPlayerName,
          matchCount: mapping.matchCount,
          suggestedMatch: suggestedMatch ? {
            id: suggestedMatch.databasePlayerId,
            name: suggestedMatch.databasePlayerName
          } : null
        });
      }
    });
    transformedStats.jsonPlayers = Array.from(jsonPlayerMap.values());

    // Show preview modal
    showRecalculationPreviewModal(transformedStats);

  } catch (error) {
    console.error('❌ Preview failed:', error);
    showError(contentId, error);
  }
}

function showRecalculationPreviewModal(stats) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'recalculation-preview-modal';

  const matched = stats.playerMapping.filter(p => p.status === 'matched');
  const unmatched = stats.playerMapping.filter(p => p.status === 'unmatched');

  let html = `
    <div class="modal-content" style="max-width: 1400px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h3>📊 Player Statistics Recalculation - Manual Mapping</h3>
        <span class="modal-close" onclick="closeRecalculationPreviewModal()">&times;</span>
      </div>
      <div class="modal-body">
        <div class="preview-summary">
          <div class="summary-item">
            <strong>Matches to Process:</strong> ${stats.matchesProcessed}
          </div>
          <div class="summary-item">
            <strong>Players in Database:</strong> ${stats.playersInDatabase}
          </div>
          <div class="summary-item">
            <strong>Players in Match Data:</strong> ${stats.jsonPlayersFound}
          </div>
          <div class="summary-item">
            <strong>Auto-Matched:</strong> <span style="color: #28a745;">${matched.length}</span>
          </div>
          <div class="summary-item">
            <strong>Need Manual Mapping:</strong> <span style="color: #ffc107;">${unmatched.length}</span>
          </div>
        </div>

        <div class="mapping-interface">
          <div class="mapping-instructions">
            <h4>How to Map Players:</h4>
            <ul>
              <li><strong>Auto-matched players</strong> are already linked (green background)</li>
              <li><strong>Click on unmatched JSON players</strong> to select them</li>
              <li><strong>Click on database players</strong> to map the selected JSON player to them</li>
              <li><strong>Unmapped players</strong> will be skipped during recalculation</li>
              <li><strong>Suggested matches</strong> are shown with dashed borders</li>
            </ul>
          </div>

          <div class="mapping-columns">
            <div class="mapping-column">
              <h4>📋 Database Players (${stats.databasePlayers.length})</h4>
              <div class="player-list" id="database-players-list">`;

  // Database players list
  stats.databasePlayers.forEach(player => {
    const isMapped = stats.playerMapping.some(m => m.databasePlayerId === player.id && m.status === 'matched');
    const mappingClass = isMapped ? 'mapped-player' : 'unmapped-player';
    html += `<div class="player-card ${mappingClass}" data-player-id="${player.id}" onclick="selectDatabasePlayer('${player.id}')">
                    <div class="player-name">${player.name}</div>
                    <div class="player-details">
                      ID: ${player.numericId || player.id} |
                      Role: ${player.role || 'N/A'}
                    </div>
                  </div>`;
  });

  html += `</div>
            </div>

            <div class="mapping-column">
              <h4>📄 JSON Match Players (${stats.jsonPlayers.length})</h4>
              <div class="player-list" id="json-players-list">`;

  // JSON players list
  stats.jsonPlayers.forEach(jsonPlayer => {
    const isMapped = jsonPlayer.suggestedMatch !== null;
    const mappingClass = isMapped ? 'suggested-match' : 'unmapped-player';
    const suggestedDbId = jsonPlayer.suggestedMatch ? jsonPlayer.suggestedMatch.id : '';
    html += `<div class="player-card ${mappingClass}" data-json-name="${jsonPlayer.name}" data-suggested-db="${suggestedDbId}" onclick="selectJsonPlayer('${jsonPlayer.name}')">
                    <div class="player-name">${jsonPlayer.name}</div>
                    <div class="player-details">
                      Matches: ${jsonPlayer.matchCount}
                      ${jsonPlayer.suggestedMatch ? `<br>Suggested: ${jsonPlayer.suggestedMatch.name}` : ''}
                    </div>
                  </div>`;
  });

  html += `</div>
            </div>
          </div>

          <div class="mapping-actions">
            <button class="btn btn-secondary" onclick="clearAllMappings()">Clear All Mappings</button>
            <button class="btn btn-info" onclick="autoMapSuggested()">Auto-Map Suggested</button>
            <div class="mapping-status">
              <span id="mapping-status">Selected: None</span>
            </div>
          </div>

          <div class="current-mappings">
            <h4>Current Mappings (${matched.length})</h4>
            <div id="current-mappings-list">`;

  // Show current mappings
  matched.forEach(mapping => {
    html += `<div class="mapping-item">
                    <span class="json-player">${mapping.matchPlayerName}</span>
                    <span class="arrow">→</span>
                    <span class="db-player">${mapping.databasePlayerName}</span>
                    <button class="btn-small btn-danger" onclick="removeMapping('${mapping.matchPlayerName}')">Remove</button>
                  </div>`;
  });

  html += `</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeRecalculationPreviewModal()">Cancel</button>
        <button class="btn btn-success" onclick="proceedWithRecalculation()">
          Proceed with Recalculation (${matched.length} players will be updated)
        </button>
      </div>
    </div>
  `;

  modal.innerHTML = html;
  document.body.appendChild(modal);

  // Store the preview data for later use
  window.recalculationPreviewData = stats;
  window.currentMappings = new Map(); // jsonPlayerName -> databasePlayerId

  // Initialize mappings from auto-matched players
  matched.forEach(mapping => {
    window.currentMappings.set(mapping.matchPlayerName, mapping.databasePlayerId);
  });

  // Initialize selected players
  window.selectedJsonPlayer = null;
  window.selectedDatabasePlayer = null;
}

function closeRecalculationPreviewModal() {
  const modal = document.getElementById('recalculation-preview-modal');
  if (modal) {
    modal.remove();
  }
  delete window.recalculationPreviewData;
  delete window.currentMappings;
  delete window.selectedJsonPlayer;
  delete window.selectedDatabasePlayer;
}

// Player mapping functions
function selectJsonPlayer(jsonPlayerName) {
  // Clear previous selection
  document.querySelectorAll('.player-card.selected-json').forEach(card => {
    card.classList.remove('selected-json');
  });

  // Select new JSON player
  const jsonCard = document.querySelector(`[data-json-name="${jsonPlayerName}"]`);
  if (jsonCard) {
    jsonCard.classList.add('selected-json');
    window.selectedJsonPlayer = jsonPlayerName;
    updateMappingStatus();
  }
}

function selectDatabasePlayer(databasePlayerId) {
  if (!window.selectedJsonPlayer) {
    alert('Please select a JSON player first');
    return;
  }

  // Create the mapping
  window.currentMappings.set(window.selectedJsonPlayer, databasePlayerId);

  // Update UI
  updateMappingsDisplay();
  updatePlayerCardStyles();

  // Clear selection
  document.querySelectorAll('.player-card.selected-json').forEach(card => {
    card.classList.remove('selected-json');
  });
  window.selectedJsonPlayer = null;
  updateMappingStatus();
}

function removeMapping(jsonPlayerName) {
  window.currentMappings.delete(jsonPlayerName);
  updateMappingsDisplay();
  updatePlayerCardStyles();
}

function clearAllMappings() {
  if (confirm('Are you sure you want to clear all manual mappings? Auto-matched players will remain.')) {
    // Keep only auto-matched mappings
    const autoMatched = new Map();
    const stats = window.recalculationPreviewData;
    const matched = stats.playerMapping.filter(p => p.status === 'matched');
    matched.forEach(mapping => {
      autoMatched.set(mapping.matchPlayerName, mapping.databasePlayerId);
    });
    window.currentMappings = autoMatched;
    updateMappingsDisplay();
    updatePlayerCardStyles();
  }
}

function autoMapSuggested() {
  const stats = window.recalculationPreviewData;
  stats.jsonPlayers.forEach(jsonPlayer => {
    if (jsonPlayer.suggestedMatch && !window.currentMappings.has(jsonPlayer.name)) {
      window.currentMappings.set(jsonPlayer.name, jsonPlayer.suggestedMatch.id);
    }
  });
  updateMappingsDisplay();
  updatePlayerCardStyles();
}

function updateMappingStatus() {
  const statusEl = document.getElementById('mapping-status');
  if (window.selectedJsonPlayer) {
    statusEl.textContent = `Selected: ${window.selectedJsonPlayer} - Click a database player to map`;
    statusEl.style.color = '#007bff';
  } else {
    statusEl.textContent = 'Selected: None';
    statusEl.style.color = '#6c757d';
  }
}

function updateMappingsDisplay() {
  const mappingsList = document.getElementById('current-mappings-list');
  const stats = window.recalculationPreviewData;

  let html = '';
  let count = 0;

  window.currentMappings.forEach((dbPlayerId, jsonPlayerName) => {
    const dbPlayer = stats.databasePlayers.find(p => p.id === dbPlayerId);
    if (dbPlayer) {
      html += `<div class="mapping-item">
                      <span class="json-player">${jsonPlayerName}</span>
                      <span class="arrow">→</span>
                      <span class="db-player">${dbPlayer.name}</span>
                      <button class="btn-small btn-danger" onclick="removeMapping('${jsonPlayerName}')">Remove</button>
                    </div>`;
      count++;
    }
  });

  mappingsList.innerHTML = html;

  // Update the header count
  const header = mappingsList.previousElementSibling;
  header.textContent = `Current Mappings (${count})`;

  // Update proceed button
  const proceedBtn = document.querySelector('#recalculation-preview-modal .btn-success');
  if (proceedBtn) {
    proceedBtn.textContent = `Proceed with Recalculation (${count} players will be updated)`;
  }
}

function updatePlayerCardStyles() {
  // Update database player cards
  document.querySelectorAll('#database-players-list .player-card').forEach(card => {
    const playerId = card.dataset.playerId;
    const isMapped = Array.from(window.currentMappings.values()).includes(playerId);
    card.classList.toggle('mapped-player', isMapped);
    card.classList.toggle('unmapped-player', !isMapped);
  });

  // Update JSON player cards
  document.querySelectorAll('#json-players-list .player-card').forEach(card => {
    const jsonName = card.dataset.jsonName;
    const isMapped = window.currentMappings.has(jsonName);
    card.classList.toggle('mapped-player', isMapped);
    card.classList.toggle('unmapped-player', !isMapped);
  });
}

async function proceedWithRecalculation() {
  closeRecalculationPreviewModal();

  if (!confirm('This will update statistics for all mapped players. Continue?')) {
    return;
  }

  const contentId = 'players-content';
  showLoading(contentId);

  try {
    console.log('📡 Making API call to /api/players/recalculate-stats');

    // Send custom mappings if they exist
    const requestBody = {};
    if (window.currentMappings && window.currentMappings.size > 0) {
      requestBody.customMappings = Object.fromEntries(window.currentMappings);
    }

    const result = await apiCall('/api/players/recalculate-stats', 'POST', requestBody);
    console.log('📊 Recalculation result:', result);

    // Display success message with mapping
    let message = `Statistics recalculated successfully! Updated ${result.data.playersUpdated} players with data from ${result.data.matchesProcessed} matches.`;
    message += `<br><br><strong>Player Mapping Summary:</strong>`;
    message += `<br>• Total players in database: ${result.data.totalPlayersInDatabase}`;
    message += `<br>• Players with updated statistics: ${result.data.playersUpdated}`;

    // Create detailed mapping display
    if (result.data.playerMapping && result.data.playerMapping.length > 0) {
      const matched = result.data.playerMapping.filter(p => p.status === 'matched');
      const unmatched = result.data.playerMapping.filter(p => p.status === 'unmatched');

      message += `<br>• Players matched from match data: ${matched.length}`;
      message += `<br>• Players from match data with no database match: ${unmatched.length}`;

      // Add detailed mapping table
      message += `<br><br><div class="player-mapping-container">`;
      message += `<h4>Player Statistics Mapping Details</h4>`;
      message += `<div class="mapping-tabs">`;
      message += `<button class="mapping-tab active" onclick="showMappingTab('matched')">Matched Players (${matched.length})</button>`;
      message += `<button class="mapping-tab" onclick="showMappingTab('unmatched')">Unmatched Players (${unmatched.length})</button>`;
      message += `</div>`;

      message += `<div id="matched-mapping" class="mapping-content active">`;
      message += `<div class="table-container">`;
      message += `<table class="mapping-table">`;
      message += `<thead><tr><th>Match Player Name</th><th>Database Player</th><th>Match Appearances</th></tr></thead>`;
      message += `<tbody>`;
      matched.slice(0, 50).forEach(player => { // Show first 50 to avoid overwhelming display
        message += `<tr>`;
        message += `<td>${player.matchPlayerName}</td>`;
        message += `<td>${player.databasePlayerName} (${player.databasePlayerId})</td>`;
        message += `<td>${player.matchCount}</td>`;
        message += `</tr>`;
      });
      if (matched.length > 50) {
        message += `<tr><td colspan="3"><em>... and ${matched.length - 50} more matched players</em></td></tr>`;
      }
      message += `</tbody></table></div></div>`;

      message += `<div id="unmatched-mapping" class="mapping-content">`;
      message += `<div class="table-container">`;
      message += `<table class="mapping-table">`;
      message += `<thead><tr><th>Match Player Name</th><th>Status</th><th>Match Appearances</th></tr></thead>`;
      message += `<tbody>`;
      unmatched.slice(0, 50).forEach(player => { // Show first 50
        message += `<tr>`;
        message += `<td>${player.matchPlayerName}</td>`;
        message += `<td><span class="status-unmatched">No match found</span></td>`;
        message += `<td>${player.matchCount}</td>`;
        message += `</tr>`;
      });
      if (unmatched.length > 50) {
        message += `<tr><td colspan="3"><em>... and ${unmatched.length - 50} more unmatched players</em></td></tr>`;
      }
      message += `</tbody></table></div></div>`;

      message += `</div>`;
    }

    showSuccess(contentId, message);
    loadPlayers(); // Refresh the list
  } catch (error) {
    console.error('❌ Recalculation failed:', error);
    showError(contentId, error);
  }
}

// Lineups functions
async function loadLineups() {
  const contentId = 'lineups-content';
  showLoading(contentId);

  try {
    const data = await apiCall('/api/teamLineups');
    currentData.lineups = data.data;
    displayLineups(data.data, contentId);
  } catch (error) {
    showError(contentId, error);
  }
}

function displayLineups(lineups, containerId) {
  if (!lineups || lineups.length === 0) {
    document.getElementById(containerId).innerHTML = '<p>No lineups found.</p>';
    return;
  }

  let html = `<p>Found ${lineups.length} team lineups:</p>`;
  html += '<div class="data-grid">';

  lineups.forEach(lineup => {
    html += `
      <div class="data-card" onclick="showLineupDetail('${lineup.id}')">
        <h3>${lineup.teamName || 'Unknown Team'}</h3>
        <p><strong>Players:</strong> ${lineup.playersCount || 0}</p>
        <p><strong>Captain:</strong> ${lineup.captainName || 'N/A'}</p>
        <p><strong>Wicket Keeper:</strong> ${lineup.wicketKeeperName || 'N/A'}</p>
        <div class="card-actions">
          <button class="btn btn-small btn-edit" onclick="editLineup('${lineup.id}', event)">Edit</button>
          <button class="btn btn-small btn-delete" onclick="deleteLineup('${lineup.id}', event)">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  document.getElementById(containerId).innerHTML = html;
}

async function showLineupDetail(lineupId) {
  const detailDiv = document.getElementById('lineup-detail');
  detailDiv.style.display = 'block';
  detailDiv.innerHTML = '<div class="loading">Loading lineup details...</div>';

  try {
    const data = await apiCall(`/api/teamLineups/${lineupId}`);
    const lineup = data.data;

    let html = `<h3>Lineup Details: ${lineup.teamName || 'Unknown Team'}</h3>`;
    html += '<div class="detail-grid">';

    html += `<div class="detail-item"><strong>Team:</strong> ${lineup.teamName || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Players Count:</strong> ${lineup.playersCount || 0}</div>`;
    html += `<div class="detail-item"><strong>Captain:</strong> ${lineup.captainName || 'N/A'}</div>`;
    html += `<div class="detail-item"><strong>Wicket Keeper:</strong> ${lineup.wicketKeeperName || 'N/A'}</div>`;

    html += '</div>';

    html += '<br><button class="btn btn-secondary" onclick="hideLineupDetail()">Close Details</button>';

    detailDiv.innerHTML = html;
    detailDiv.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    detailDiv.innerHTML = `<div class="error">Error loading lineup details: ${error.message}</div>`;
  }
}

function hideLineupDetail() {
  document.getElementById('lineup-detail').style.display = 'none';
}

// Player mapping tab switching
function showMappingTab(tabName) {
  // Hide all mapping content
  const contents = document.querySelectorAll('.mapping-content');
  contents.forEach(content => content.classList.remove('active'));

  // Remove active class from all tabs
  const tabs = document.querySelectorAll('.mapping-tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  // Show selected content and activate tab
  document.getElementById(tabName + '-mapping').classList.add('active');
  event.target.classList.add('active');
}

// Match scoring functions
async function loadTeamPlayers(teamPrefix) {
  const teamId = document.getElementById(teamPrefix + 'Id').value.trim();
  if (!teamId) {
    alert('Please enter a team ID first');
    return;
  }

  const playerListDiv = document.getElementById(teamPrefix + '-players');
  playerListDiv.innerHTML = '<div class="loading">Loading players...</div>';

  try {
    // For now, load all players and filter by teamId
    // TODO: Add team filtering to players API
    const result = await apiCall('/api/v2/players');
    const allPlayers = result.data;

    // Filter players by teamId (assuming players have teamId field)
    const teamPlayers = allPlayers.filter(player => player.teamId === teamId);

    if (teamPlayers.length === 0) {
      playerListDiv.innerHTML = '<p>No players found for this team. Players will be selectable from all available players.</p>';
      // Show all players as selectable
      displayPlayerSelectionList(playerListDiv, allPlayers, teamPrefix);
    } else {
      displayPlayerSelectionList(playerListDiv, teamPlayers, teamPrefix);
    }

  } catch (error) {
    console.error('Failed to load team players:', error);
    playerListDiv.innerHTML = '<p class="error">Failed to load players</p>';
  }
}

function displayPlayerSelectionList(container, players, teamPrefix) {
  if (!players || players.length === 0) {
    container.innerHTML = '<p>No players available</p>';
    return;
  }

  let html = '';
  players.forEach(player => {
    const checkboxId = `${teamPrefix}-player-${player.id}`;
    html += `
      <div class="player-checkbox-item">
        <input type="checkbox" id="${checkboxId}" value="${player.id}" onchange="updatePlayerSelection('${teamPrefix}')">
        <div class="player-info">
          <div class="player-name">${player.name}</div>
          <div class="player-role">${player.role || 'N/A'} • ID: ${player.displayId || player.id}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function updatePlayerSelection(teamPrefix) {
  // Could add validation or limits here
  const selectedCount = getSelectedPlayers(teamPrefix).length;
  console.log(`${teamPrefix} selected players: ${selectedCount}`);
}

function getSelectedPlayers(teamPrefix) {
  const checkboxes = document.querySelectorAll(`#${teamPrefix}-players input[type="checkbox"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

async function startMatchScoring(matchId, matchData, team1Players, team2Players) {
  // Hide the form and show scoring interface
  hideCreateForm('matches');

  // Ensure players are loaded
  if (!currentData.players || currentData.players.length === 0) {
    try {
      const data = await apiCall('/api/v2/players');
      currentData.players = data.data;
    } catch (error) {
      console.error('Failed to load players:', error);
      showError('matches-content', new Error('Failed to load players for scoring interface'));
      return;
    }
  }

  // Create scoring interface
  const scoringHtml = createScoringInterface(matchId, matchData, team1Players, team2Players);
  document.getElementById('matches-content').innerHTML = scoringHtml;

  // Initialize scoring state
  window.currentMatch = {
    id: matchId,
    data: matchData,
    team1Players: team1Players,
    team2Players: team2Players,
    innings: [],
    currentInning: null
  };

  console.log('Match scoring interface initialized for match:', matchId);
}

function createScoringInterface(matchId, matchData, team1Players, team2Players) {
  return `
    <div class="scoring-container">
      <div class="match-header">
        <h3>${matchData.title} Match - ${matchData.venue}</h3>
        <div class="match-info">
          <span>Team 1: ${matchData.team1Id}</span> |
          <span>Team 2: ${matchData.team2Id}</span> |
          <span>Date: ${new Date(matchData.scheduledDate).toLocaleString()}</span>
        </div>
      </div>

      <div class="innings-setup">
        <h4>Set Up First Innings</h4>
        <div class="inning-config">
          <div class="form-group">
            <label>Batting Team:</label>
            <select id="battingTeam">
              <option value="${matchData.team1Id}">Team 1 (${matchData.team1Id})</option>
              <option value="${matchData.team2Id}">Team 2 (${matchData.team2Id})</option>
            </select>
          </div>
          <button class="btn" onclick="startInning()">Start Innings</button>
        </div>
      </div>

      <div id="scoring-interface" style="display: none;">
        <!-- Scoring interface will be populated here -->
      </div>
    </div>
  `;
}

async function startInning() {
  console.log('startInning called');

  const battingTeamSelect = document.getElementById('battingTeam');
  console.log('battingTeamSelect:', battingTeamSelect);

  if (!battingTeamSelect) {
    alert('Batting team selection not found');
    return;
  }

  const battingTeamId = battingTeamSelect.value;
  console.log('battingTeamId:', battingTeamId);

  if (!battingTeamId) {
    alert('Please select a batting team');
    return;
  }

  const bowlingTeamId = battingTeamId === window.currentMatch.data.team1Id ?
    window.currentMatch.data.team2Id : window.currentMatch.data.team1Id;

  console.log('bowlingTeamId:', bowlingTeamId);

  if (!window.currentMatch || !window.currentMatch.data) {
    alert('Match data not available');
    return;
  }

  console.log('Starting inning with:', { battingTeamId, bowlingTeamId, matchId: window.currentMatch.data.id });

  try {
    // Try direct function call first to test if function is accessible
    console.log('Trying direct function call to /.netlify/functions/scoring/innings...');
    const directResult = await apiCall('/.netlify/functions/scoring/innings', 'POST', {
      matchId: window.currentMatch.data.id,
      battingTeamId: battingTeamId,
      bowlingTeamId: bowlingTeamId
    });

    console.log('Direct call result:', directResult);
    if (directResult.success) {
      console.log('Direct function call succeeded!');
      // Update local match data with the created inning
      const newInning = directResult.data;
      window.currentMatch.innings.push(newInning);
      window.currentMatch.currentInning = newInning;

      // Update match status
      window.currentMatch.data.status = 'live';
      window.currentMatch.data.currentInnings = newInning.inningNumber;

      // Show scoring interface
      showScoringInterface();

      // Refresh match data in UI
      loadMatches();
      return;
    }
  } catch (directError) {
    console.log('Direct function call failed:', directError.message);
  }

  // Fallback to API route
  console.log('Trying API route /api/scoring/innings...');
  const result = await apiCall('/api/scoring/innings', 'POST', {
    matchId: window.currentMatch.data.id,
    battingTeamId: battingTeamId,
    bowlingTeamId: bowlingTeamId
  });

  if (result.success) {
    // Update local match data with the created inning
    const newInning = result.data;
    window.currentMatch.innings.push(newInning);
    window.currentMatch.currentInning = newInning;

    // Update match status
    window.currentMatch.data.status = 'live';
    window.currentMatch.data.currentInnings = newInning.inningNumber;

    // Show scoring interface
    showScoringInterface();

    // Refresh match data in UI
    loadMatches();
  } else {
    alert('Failed to start inning: ' + (result.message || 'Unknown error'));
  }
}

function onEditTeamChange(teamPrefix) {
  const select = document.getElementById(`edit${teamPrefix.charAt(0).toUpperCase() + teamPrefix.slice(1)}Id`);
  const loadBtn = document.getElementById(`editLoad${teamPrefix.charAt(0).toUpperCase() + teamPrefix.slice(1)}Btn`);
  const selectedValue = select.value;

  // Enable/disable load players button
  loadBtn.disabled = !selectedValue;

  // Clear player selection if team changed
  const playersDiv = document.getElementById(`edit-${teamPrefix}-players`);
  if (!selectedValue) {
    playersDiv.innerHTML = '<p>Select team and click "Load Players"</p>';
  }
}

async function loadEditTeamPlayers(teamPrefix) {
  const teamId = document.getElementById(`edit${teamPrefix.charAt(0).toUpperCase() + teamPrefix.slice(1)}Id`).value.trim();
  console.log(`loadEditTeamPlayers called for ${teamPrefix}, teamId:`, teamId);
  if (!teamId) {
    console.log('No teamId found, showing alert');
    alert('Please select a team first');
    return;
  }

  const playerListDiv = document.getElementById(`edit-${teamPrefix}-players`);
  playerListDiv.innerHTML = '<div class="loading">Loading players...</div>';

  try {
    // For now, load all players and filter by teamId
    // TODO: Add team filtering to players API
    const result = await apiCall('/api/v2/players');
    const allPlayers = result.data;

    // Filter players by teamId (assuming players have teamId field)
    const teamPlayers = allPlayers.filter(player => player.teamId === teamId);

    if (teamPlayers.length === 0) {
      playerListDiv.innerHTML = '<p>No players found for this team. Players will be selectable from all available players.</p>';
      // Show all players as selectable
      displayEditPlayerSelectionList(playerListDiv, allPlayers, teamPrefix);
    } else {
      displayEditPlayerSelectionList(playerListDiv, teamPlayers, teamPrefix);
    }

  } catch (error) {
    console.error('Failed to load team players:', error);
    playerListDiv.innerHTML = '<p class="error">Failed to load players</p>';
  }
}

function displayEditPlayerSelectionList(container, players, teamPrefix) {
  if (!players || players.length === 0) {
    container.innerHTML = '<p>No players available</p>';
    return;
  }

  let html = '';
  players.forEach(player => {
    const checkboxId = `edit-${teamPrefix}-player-${player.id}`;
    html += `
      <div class="player-checkbox-item">
        <input type="checkbox" id="${checkboxId}" value="${player.id}" onchange="updateEditPlayerSelection('${teamPrefix}')">
        <div class="player-info">
          <strong>${player.name}</strong>
          <span class="player-role">${player.role || 'Player'}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function updateEditPlayerSelection(teamPrefix) {
  // This function can be used to track selected players if needed
  // For now, just log the selection
  const selectedPlayers = [];
  const checkboxes = document.querySelectorAll(`input[id^="edit-${teamPrefix}-player-"]:checked`);
  checkboxes.forEach(checkbox => {
    selectedPlayers.push(checkbox.value);
  });
  console.log(`Selected players for ${teamPrefix}:`, selectedPlayers);
}

function showScoringInterface() {
  const inning = window.currentMatch.currentInning;
  const battingPlayers = inning.battingTeamId === window.currentMatch.data.team1Id ?
    window.currentMatch.team1Players : window.currentMatch.team2Players;
  const bowlingPlayers = inning.bowlingTeamId === window.currentMatch.data.team1Id ?
    window.currentMatch.team1Players : window.currentMatch.team2Players;

  const html = `
    <div class="live-scoring">
      <div class="score-display">
        <h4>Innings ${inning.inningNumber}: ${inning.battingTeam} vs ${inning.bowlingTeam}</h4>
        <div class="score-summary">
          <span class="runs">${inning.totalRuns}/${inning.totalWickets}</span>
          <span class="overs">(${Math.floor(inning.totalOvers)}.${inning.totalBalls % 6} overs)</span>
        </div>
      </div>

      <div class="scoring-controls">
        <div class="batsman-selection">
          <h5>Select Batsman</h5>
          <select id="currentBatsman" onchange="selectBatsman()">
            <option value="">Choose batsman...</option>
            ${battingPlayers.map(playerId => {
              const player = currentData.players.find(p => p.id === playerId);
              return player ? `<option value="${playerId}">${player.name}</option>` : '';
            }).join('')}
          </select>
        </div>

        <div class="bowler-selection">
          <h5>Select Bowler</h5>
          <select id="currentBowler" onchange="selectBowler()">
            <option value="">Choose bowler...</option>
            ${bowlingPlayers.map(playerId => {
              const player = currentData.players.find(p => p.id === playerId);
              return player ? `<option value="${playerId}">${player.name}</option>` : '';
            }).join('')}
          </select>
        </div>

        <div class="runs-input">
          <h5>Add Runs/Wickets</h5>
          <div class="run-buttons">
            <button class="btn" onclick="addRuns(0)">0</button>
            <button class="btn" onclick="addRuns(1)">1</button>
            <button class="btn" onclick="addRuns(2)">2</button>
            <button class="btn" onclick="addRuns(3)">3</button>
            <button class="btn" onclick="addRuns(4)">4</button>
            <button class="btn" onclick="addRuns(6)">6</button>
          </div>
          <div class="wicket-buttons">
            <button class="btn btn-danger" onclick="addWicket('bowled')">Bowled</button>
            <button class="btn btn-danger" onclick="addWicket('caught')">Caught</button>
            <button class="btn btn-danger" onclick="addWicket('runout')">Run Out</button>
            <button class="btn btn-danger" onclick="addWicket('lbw')">LBW</button>
          </div>
        </div>
      </div>

      <div class="current-over">
        <h5>This Over: <span id="current-over-balls"></span></h5>
      </div>

      <div class="inning-actions">
        <button class="btn btn-success" onclick="endInning()">End Innings</button>
        <button class="btn btn-secondary" onclick="saveInningData()">Save Current Data</button>
      </div>
    </div>
  `;

  document.getElementById('scoring-interface').innerHTML = html;
  document.getElementById('scoring-interface').style.display = 'block';
  document.querySelector('.innings-setup').style.display = 'none';
}

function selectBatsman() {
  const batsmanId = document.getElementById('currentBatsman').value;
  if (window.currentMatch.currentInning) {
    window.currentMatch.currentInning.currentBatsman = batsmanId;
  }
}

function selectBowler() {
  const bowlerId = document.getElementById('currentBowler').value;
  if (window.currentMatch.currentInning) {
    window.currentMatch.currentInning.currentBowler = bowlerId;
  }
}

async function addRuns(runs) {
  const inning = window.currentMatch.currentInning;
  if (!inning || !inning.currentBatsman || !inning.currentBowler) {
    alert('Please select both batsman and bowler first');
    return;
  }

  // Add to batsman's score
  let batsman = inning.batsmen.find(b => b.playerId === inning.currentBatsman);
  if (!batsman) {
    batsman = {
      playerId: inning.currentBatsman,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      notOut: true
    };
    inning.batsmen.push(batsman);
  }

  batsman.runs += runs;
  batsman.balls += 1;

  if (runs === 4) batsman.fours += 1;
  if (runs === 6) batsman.sixes += 1;

  // Add to bowler's figures
  let bowler = inning.bowling.find(b => b.playerId === inning.currentBowler);
  if (!bowler) {
    bowler = {
      playerId: inning.currentBowler,
      overs: 0,
      balls: 0,
      runs: 0,
      wickets: 0
    };
    inning.bowling.push(bowler);
  }

  bowler.runs += runs;
  bowler.balls += 1;

  // Update over
  inning.currentOver.push(runs);
  inning.totalBalls += 1;

  // Check if over is complete
  if (inning.currentOver.length >= 6) {
    bowler.overs += 1;
    bowler.balls = 0; // Reset balls for next over
    inning.currentOver = [];
    inning.totalOvers += 1;

    // Switch bowler
    document.getElementById('currentBowler').value = '';
    inning.currentBowler = null;
  }

  // Update total runs
  inning.totalRuns += runs;

  // Record the ball in the backend
  try {
    await apiCall('/api/scoring/balls', 'POST', {
      matchId: window.currentMatch.id,
      inningId: inning.id,
      runs: runs,
      bowlerId: inning.currentBowler,
      batsmanId: inning.currentBatsman,
      nonStrikerId: inning.currentNonStriker || null
    });
    console.log('Ball recorded successfully');
  } catch (error) {
    console.error('Failed to record ball:', error);
    // Continue with local updates even if backend call fails
  }

  // Update display
  updateScoreDisplay();
  updateCurrentOverDisplay();
}

async function addWicket(type) {
  const inning = window.currentMatch.currentInning;
  if (!inning || !inning.currentBatsman || !inning.currentBowler) {
    alert('Please select both batsman and bowler first');
    return;
  }

  // Mark batsman as out
  const batsman = inning.batsmen.find(b => b.playerId === inning.currentBatsman);
  if (batsman) {
    batsman.notOut = false;
    batsman.dismissalType = type;
  }

  // Add to bowler's wickets
  const bowler = inning.bowling.find(b => b.playerId === inning.currentBowler);
  if (bowler) {
    bowler.wickets += 1;
  }

  // Update totals
  inning.totalWickets += 1;
  inning.totalBalls += 1;

  // Record the wicket ball in the backend
  try {
    await apiCall('/api/scoring/balls', 'POST', {
      matchId: window.currentMatch.id,
      inningId: inning.id,
      runs: 0,
      wicket: { type: type },
      bowlerId: inning.currentBowler,
      batsmanId: inning.currentBatsman,
      nonStrikerId: inning.currentNonStriker || null
    });
    console.log('Wicket recorded successfully');
  } catch (error) {
    console.error('Failed to record wicket:', error);
    // Continue with local updates even if backend call fails
  }

  // Update over
  inning.currentOver.push('W');

  // Check if over is complete
  if (inning.currentOver.length >= 6) {
    if (bowler) {
      bowler.overs += 1;
      bowler.balls = 0;
    }
    inning.currentOver = [];
    inning.totalOvers += 1;
  }

  // Clear current batsman
  document.getElementById('currentBatsman').value = '';
  inning.currentBatsman = null;

  // Update display
  updateScoreDisplay();
  updateCurrentOverDisplay();
}

function updateScoreDisplay() {
  const inning = window.currentMatch.currentInning;
  if (!inning) return;

  const scoreElement = document.querySelector('.score-summary .runs');
  const oversElement = document.querySelector('.score-summary .overs');

  if (scoreElement) {
    scoreElement.textContent = `${inning.totalRuns}/${inning.totalWickets}`;
  }

  if (oversElement) {
    const overs = Math.floor(inning.totalOvers) + (inning.totalBalls % 6) / 10;
    oversElement.textContent = `(${overs.toFixed(1)} overs)`;
  }
}

function updateCurrentOverDisplay() {
  const inning = window.currentMatch.currentInning;
  if (!inning) return;

  const overElement = document.getElementById('current-over-balls');
  if (overElement) {
    overElement.textContent = inning.currentOver.join(' ');
  }
}

async function saveInningData() {
  const match = window.currentMatch;
  const inning = match.currentInning;

  if (!inning) {
    alert('No active inning to save');
    return;
  }

  try {
    // Save inning data to Firestore
    const inningData = {
      inningNumber: inning.inningNumber,
      battingTeam: inning.battingTeam,
      bowlingTeam: inning.bowlingTeam,
      totalRuns: inning.totalRuns,
      totalWickets: inning.totalWickets,
      totalOvers: inning.totalOvers,
      totalBalls: inning.totalBalls,
      batsmen: inning.batsmen || [],
      bowling: inning.bowling || [],
      fallOfWickets: inning.fallOfWickets || [],
      extras: inning.extras || {
        total: 0,
        wides: 0,
        noBalls: 0,
        byes: 0,
        legByes: 0
      }
    };

    // Save to matches/{matchId}/innings/{inningId} via scoring API
    await apiCall(`/api/scoring/innings/${inning.id}`, 'PUT', inningData);

    // Update match scores
    const currentTeam1Score = match.data.team1Score || 0;
    const currentTeam2Score = match.data.team2Score || 0;

    let updatedTeam1Score = currentTeam1Score;
    let updatedTeam2Score = currentTeam2Score;

    // Add innings runs to the batting team's score
    if (inning.battingTeam === match.data.team1Id) {
      updatedTeam1Score += inning.totalRuns;
    } else if (inning.battingTeam === match.data.team2Id) {
      updatedTeam2Score += inning.totalRuns;
    }

    // Update match with new scores
    const matchUpdate = {
      team1Score: updatedTeam1Score,
      team2Score: updatedTeam2Score
    };

    await apiCall(`/api/v2/matches/${match.id}`, 'PUT', matchUpdate);

    // Save batsmen data
    for (const batsman of inning.batsmen) {
      await apiCall(`/api/v2/matches/${match.id}/innings/${inning.inningNumber}/batsmen`, 'POST', batsman);
    }

    // Save bowling data
    for (const bowler of inning.bowling) {
      await apiCall(`/api/v2/matches/${match.id}/innings/${inning.inningNumber}/bowling`, 'POST', bowler);
    }

    alert('Inning data saved successfully!');
    console.log('Inning data saved for match:', match.id);

  } catch (error) {
    console.error('Failed to save inning data:', error);
    alert('Failed to save inning data: ' + error.message);
  }
}

function endInning() {
  const inning = window.currentMatch.currentInning;
  if (!inning) return;

  // Mark inning as complete
  inning.completed = true;

  // Save data first
  saveInningData();

  // Check if match should continue with next innings
  const nextInningNumber = window.currentMatch.innings.length + 1;

  if (nextInningNumber <= 2) { // For limited overs, typically 2 innings max
    // Setup next innings
    setTimeout(() => {
      setupNextInning();
    }, 1000);
  } else {
    // Match complete
    alert('Match completed!');
    // Could add match completion logic here
  }
}

function setupNextInning() {
  const match = window.currentMatch;
  const html = `
    <div class="innings-setup">
      <h4>Set Up Innings ${match.innings.length + 1}</h4>
      <div class="inning-config">
        <div class="form-group">
          <label>Batting Team:</label>
          <select id="battingTeam">
            <option value="${match.data.team1Id}">Team 1 (${match.data.team1Id})</option>
            <option value="${match.data.team2Id}">Team 2 (${match.data.team2Id})</option>
          </select>
        </div>
        <button class="btn" onclick="startInning()">Start Next Innings</button>
      </div>
    </div>

    <div id="scoring-interface" style="display: none;"></div>
  `;

  document.getElementById('matches-content').innerHTML += html;
}

// Burger Menu Functionality
function toggleMobileMenu() {
  const overlay = document.getElementById('mobileNavOverlay');
  const mobileNav = document.getElementById('mobileNav');
  const burgerMenu = document.querySelector('.burger-menu');

  overlay.classList.toggle('open');
  mobileNav.classList.toggle('open');
  burgerMenu.classList.toggle('open');
}

// Close mobile menu when clicking on a link
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('mobile-nav-link')) {
    toggleMobileMenu();
  }
});

// Update navigation active states
function updateNavStates(activeSection) {
  // Update desktop nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelector(`.nav-link[onclick*="${activeSection}"]`).classList.add('active');

  // Update mobile nav
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelector(`.mobile-nav-link[onclick*="${activeSection}"]`).classList.add('active');
}

// Enhanced showSection function
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });

  // Show selected section
  document.getElementById(sectionId).classList.add('active');

  // Update navigation
  updateNavStates(sectionId);

  // Load data if needed
  if (sectionId === 'matches' && !currentData.matches) {
    loadMatches();
  } else if (sectionId === 'teams' && !currentData.teams) {
    loadTeams();
  } else if (sectionId === 'players' && !currentData.players) {
    loadPlayers();
  } else if (sectionId === 'lineups' && !currentData.lineups) {
    loadLineups();
  }
}

// Initialize status checks - temporarily disabled to debug syntax error
// checkAPIStatus();
// checkDBStatus();

// Status checking functions
async function checkAPIStatus() {
  const statusElement = document.getElementById('api-status');
  const statusDot = document.getElementById('apiStatusDot');

  try {
    const response = await fetch('/api/v2/matches/health');
    const data = await response.json();

    if (response.ok && data.success && data.status === 'healthy') {
      statusElement.textContent = 'Online';
      statusDot.classList.add('online');
      statusDot.classList.remove('offline');
    } else {
      throw new Error(data.message || 'Health check failed');
    }
  } catch (error) {
    statusElement.textContent = 'Offline';
    statusDot.classList.add('offline');
    statusDot.classList.remove('online');
  }
}

async function checkDBStatus() {
  const statusElement = document.getElementById('db-status');
  const statusDot = document.getElementById('dbStatusDot');

  try {
    const response = await apiCall('/api/v2/matches/health');
    if (response && response.status === 'healthy') {
      statusElement.textContent = 'Connected';
      statusDot.classList.add('online');
      statusDot.classList.remove('offline');
    } else {
      throw new Error('Database not accessible');
    }
  } catch (error) {
    statusElement.textContent = 'Disconnected';
    statusDot.classList.add('offline');
    statusDot.classList.remove('online');
  }
}