# Cricket App API Test Suite

This directory contains comprehensive REST API tests for the Cricket App backend service.

## Test Files

### `team.rest`
**Main test file** - Contains all basic CRUD operations for all endpoints:
- Teams (GET, POST, PUT, DELETE)
- Players (GET, POST, PUT, DELETE)
- Team Lineups (GET, POST, PUT, DELETE)
- Matches (GET, POST, PUT, DELETE)
- Live Scores (GET)
- Scoring (POST with various ball types)

### `validation.rest`
**Data validation tests** - Verifies that API responses include complete expanded data:
- Teams include captain details (not just captainId)
- Team lineups include full player details (playersDetails, playingXIDetails)
- Matches include complete team and lineup data
- Performance validation tests

### `edge-cases.rest`
**Edge cases and error scenarios** - Tests boundary conditions and error handling:
- Empty collections
- Invalid IDs and non-existent resources
- Malformed requests
- Concurrency scenarios
- CORS validation
- Load testing simulations

## How to Run Tests

### Prerequisites
1. Start the Netlify dev server:
   ```bash
   cd cricket-app-service
   netlify dev --port 8888
   ```

2. Ensure Firebase/Firestore is properly configured and data is initialized

### Using VS Code REST Client Extension
1. Install the "REST Client" extension in VS Code
2. Open any `.rest` file in this directory
3. Click the "Send Request" link above each HTTP request
4. View responses in the response panel

### Using curl (Command Line)
```bash
# Example: Test teams endpoint
curl -X GET http://localhost:8888/api/teams

# Example: Create a new team
curl -X POST http://localhost:8888/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Team", "captainId": "some-player-id"}'
```

### Using Postman/Insomnia
1. Import the `.rest` files or manually create requests
2. Set base URL to `http://localhost:8888/api`
3. Execute requests individually or as collections

## API Endpoints Overview

### Teams (`/api/teams`)
- `GET /api/teams` - Get all teams with captain details
- `GET /api/teams/:id` - Get team by ID with captain details
- `POST /api/teams` - Create new team
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

### Players (`/api/players`)
- `GET /api/players` - Get all players
- `GET /api/players/:id` - Get player by ID
- `POST /api/players` - Create new player
- `PUT /api/players/:id` - Update player
- `DELETE /api/players/:id` - Soft delete player

### Team Lineups (`/api/teamLineups`)
- `GET /api/teamLineups` - Get all lineups with full player details
- `GET /api/teamLineups/:id` - Get lineup by ID with full player details
- `POST /api/teamLineups` - Create new lineup
- `PUT /api/teamLineups/:id` - Update lineup
- `DELETE /api/teamLineups/:id` - Delete lineup

### Matches (`/api/matches`)
- `GET /api/matches` - Get all matches with complete team/lineup data
- `GET /api/matches/:id` - Get match by ID with complete data
- `POST /api/matches` - Create new match
- `PUT /api/matches/:id` - Update match
- `DELETE /api/matches/:id` - Delete match

### Live Scores (`/api/live-scores`)
- `GET /api/live-scores/:matchId` - Get live scores for a match

### Scoring (`/api/scoring`)
- `POST /api/scoring` - Record a ball/scoring event

## Data Structure Validation

The API now returns **expanded JSON responses** to minimize frontend API calls:

### Teams Response
```json
{
  "data": [
    {
      "id": "team-id",
      "name": "Team Name",
      "captainId": "player-id",
      "captain": {
        "id": "player-id",
        "name": "Player Name",
        "role": "Batsman",
        "battingStyle": "Right-handed",
        // ... full player details
      }
    }
  ]
}
```

### Team Lineups Response
```json
{
  "data": [
    {
      "id": "lineup-id",
      "teamId": "team-id",
      "playersDetails": [
        {
          "id": "player-id",
          "name": "Player Name",
          "role": "Batsman",
          // ... full player details
        }
      ],
      "playingXIDetails": [/* 11 players */],
      "captainDetails": {/* full captain info */},
      "wicketkeeperDetails": {/* full wicketkeeper info */}
    }
  ]
}
```

### Matches Response
```json
{
  "data": [
    {
      "id": "match-id",
      "title": "Match Title",
      "team1": {/* complete team with captain */},
      "team2": {/* complete team with captain */},
      "lineups": {
        "team1-id": {/* complete lineup with all players */},
        "team2-id": {/* complete lineup with all players */}
      }
    }
  ]
}
```

## Test Coverage

✅ **Complete CRUD Operations** - All endpoints tested for Create, Read, Update, Delete
✅ **Data Validation** - Expanded responses verified
✅ **Error Handling** - 400, 404, 500 error scenarios tested
✅ **Edge Cases** - Empty collections, invalid IDs, malformed requests
✅ **Performance** - Response time validation
✅ **Concurrency** - Multiple simultaneous requests
✅ **CORS** - Cross-origin request handling
✅ **Load Testing** - Multiple user simulation

## Troubleshooting

### Common Issues

1. **404 Route not found**
   - Ensure Netlify dev server is running on port 8888
   - Check that function files exist in `netlify/functions/`

2. **500 Internal Server Error**
   - Check Firebase/Firestore configuration
   - Verify environment variables are set
   - Check server logs for detailed error messages

3. **Empty responses**
   - Ensure database is initialized with sample data
   - Run `node scripts/initialize-collections.js` if needed

4. **CORS errors**
   - API includes proper CORS headers
   - Check browser console for preflight request issues

### Debug Mode

Enable debug logging by checking the server console output when running tests. The API functions log request details including:
- HTTP method and path
- Processed path after routing
- Error details for failed requests

## Contributing

When adding new API endpoints:
1. Add tests to `team.rest` for basic CRUD operations
2. Add validation tests to `validation.rest` for data structure
3. Add edge case tests to `edge-cases.rest` for error scenarios
4. Update this README with new endpoint documentation