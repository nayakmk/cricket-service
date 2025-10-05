# Cricket Scoring API Specification

## Overview
This is a comprehensive API specification for a cricket scoring service built with Netlify Functions and Google Firestore. The API provides endpoints for managing cricket matches, teams, players, live scoring, and statistics.

## Base URL
```
https://localhost:8888/api/
```

## Authentication
Currently, no authentication is required. All endpoints are publicly accessible.

## Response Format
All responses follow this structure:
```json
{
  "success": boolean,
  "data": object|array,
  "message": string (optional)
}
```

## Error Responses
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 1. Matches API (`matches.js`)

### GET /api/matches
Get all matches with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by match status (`scheduled`, `live`, `completed`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "numericId": number,
      "displayId": "string",
      "title": "string",
      "status": "scheduled|live|completed",
      "matchType": "string",
      "venue": "string",
      "scheduledDate": "ISO8601 string",
      "createdAt": "ISO8601 string",
      "updatedAt": "ISO8601 string",
      "team1": {
        "id": "string",
        "name": "string",
        "shortName": "string"
      },
      "team2": {
        "id": "string",
        "name": "string",
        "shortName": "string"
      },
      "toss": {
        "winner": "string",
        "decision": "bat|bowl"
      },
      "currentInnings": number,
      "team1Score": number,
      "team2Score": number,
      "winner": "string",
      "result": "string"
    }
  ]
}
```

### GET /api/matches/{id}
Get detailed information for a specific match.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "numericId": number,
    "displayId": "string",
    "title": "string",
    "status": "scheduled|live|completed",
    "matchType": "string",
    "venue": "string",
    "scheduledDate": "ISO8601 string",
    "createdAt": "ISO8601 string",
    "updatedAt": "ISO8601 string",
    "team1": {
      "id": "string",
      "name": "string",
      "shortName": "string"
    },
    "team2": {
      "id": "string",
      "name": "string",
      "shortName": "string"
    },
    "toss": {
      "winner": "string",
      "decision": "bat|bowl"
    },
    "currentInnings": number,
    "team1Score": number,
    "team2Score": number,
    "winner": "string",
    "result": "string",
    "innings": [
      {
        "id": "string",
        "inningNumber": number,
        "battingTeam": "string",
        "bowlingTeam": "string",
        "totalRuns": number,
        "totalWickets": number,
        "totalOvers": number,
        "totalBalls": number,
        "batsmen": [
          {
            "playerId": "string",
            "player": {
              "id": "string",
              "name": "string"
            },
            "runs": number,
            "balls": number,
            "fours": number,
            "sixes": number,
            "status": "not out|bowled|caught|run out|lbw",
            "strikeRate": number
          }
        ],
        "bowling": [
          {
            "playerId": "string",
            "player": {
              "id": "string",
              "name": "string"
            },
            "overs": number,
            "maidens": number,
            "runs": number,
            "wickets": number,
            "economy": number,
            "dots": number,
            "fours": number,
            "sixes": number
          }
        ],
        "fallOfWickets": [
          {
            "wicketNumber": number,
            "score": number,
            "batsmanName": "string",
            "overs": number
          }
        ]
      }
    ]
  }
}
```

### POST /api/matches
Create a new match.

**Request Body:**
```json
{
  "title": "string",
  "matchType": "string",
  "venue": "string",
  "scheduledDate": "ISO8601 string",
  "team1Id": "string",
  "team2Id": "string",
  "toss": {
    "winner": "string",
    "decision": "bat|bowl"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "numericId": number,
    "displayId": "string",
    "title": "string",
    "status": "scheduled",
    "matchType": "string",
    "venue": "string",
    "scheduledDate": "ISO8601 string",
    "createdAt": "ISO8601 string",
    "updatedAt": "ISO8601 string",
    "team1": {
      "id": "string",
      "name": "string",
      "shortName": "string"
    },
    "team2": {
      "id": "string",
      "name": "string",
      "shortName": "string"
    },
    "toss": {
      "winner": "string",
      "decision": "bat|bowl"
    }
  }
}
```

### PUT /api/matches/{id}
Update an existing match.

**Request Body:**
```json
{
  "title": "string",
  "matchType": "string",
  "venue": "string",
  "scheduledDate": "ISO8601 string",
  "status": "scheduled|live|completed",
  "team1Score": number,
  "team2Score": number,
  "winner": "string",
  "result": "string",
  "currentInnings": number
}
```

### DELETE /api/matches/{id}
Delete a match.

**Response:**
```json
{
  "success": true,
  "message": "Match deleted successfully"
}
```

---

## 2. Teams API (`teams.js`)

### GET /api/teams
Get all teams.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "numericId": number,
      "displayId": "string",
      "name": "string",
      "shortName": "string",
      "captainId": "string",
      "captain": {
        "id": "string",
        "name": "string"
      },
      "playersCount": number,
      "createdAt": "ISO8601 string",
      "updatedAt": "ISO8601 string"
    }
  ]
}
```

### GET /api/teams/{id}
Get detailed information for a specific team.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "numericId": number,
    "displayId": "string",
    "name": "string",
    "shortName": "string",
    "captainId": "string",
    "captain": {
      "id": "string",
      "name": "string"
    },
    "players": [
      {
        "id": "string",
        "name": "string",
        "role": "batsman|bowler|all-rounder|wicket-keeper"
      }
    ],
    "createdAt": "ISO8601 string",
    "updatedAt": "ISO8601 string"
  }
}
```

### POST /api/teams
Create a new team.

**Request Body:**
```json
{
  "name": "string",
  "shortName": "string",
  "captainId": "string",
  "playerIds": ["string"]
}
```

### PUT /api/teams/{id}
Update an existing team.

**Request Body:**
```json
{
  "name": "string",
  "shortName": "string",
  "captainId": "string",
  "playerIds": ["string"]
}
```

### DELETE /api/teams/{id}
Delete a team.

---

## 3. Players API (`players.js`)

### GET /api/players
Get all players.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "numericId": number,
      "displayId": "string",
      "name": "string",
      "email": "string",
      "role": "batsman|bowler|all-rounder|wicket-keeper",
      "battingStyle": "RHB|LHB",
      "bowlingStyle": "RF|RFM|RM|RLB|RLM|LS|LF|LM|LLB|LLM",
      "nationality": "string",
      "isActive": boolean,
      "matchesPlayed": number,
      "totalRuns": number,
      "totalWickets": number,
      "battingAverage": number,
      "bowlingAverage": number,
      "battingStrikeRate": number,
      "bowlingEconomy": number,
      "createdAt": "ISO8601 string",
      "updatedAt": "ISO8601 string"
    }
  ]
}
```

### GET /api/players/{id}
Get detailed information for a specific player including match history.

**Response:**
```json
{
  "success": true,
  "data": {
    "player": {
      "id": "string",
      "name": "string",
      "displayId": "string"
    },
    "matches": [
      {
        "matchId": "string",
        "matchDate": {
          "_seconds": number,
          "_nanoseconds": number
        },
        "team1": "string",
        "team2": "string",
        "venue": "string",
        "result": "string",
        "contributions": [
          {
            "type": "batting",
            "inningNumber": number,
            "runs": number,
            "balls": number,
            "fours": number,
            "sixes": number,
            "dismissal": "string",
            "strikeRate": number
          },
          {
            "type": "bowling",
            "inningNumber": number,
            "overs": number,
            "maidens": number,
            "runs": number,
            "wickets": number,
            "economy": number
          },
          {
            "type": "fielding",
            "inningNumber": number,
            "action": "catch",
            "count": number
          }
        ]
      }
    ],
    "summary": {
      "totalMatches": number,
      "totalRuns": number,
      "totalWickets": number,
      "totalCatches": number
    }
  }
}
```

### GET /api/players/preview-recalculate-stats
Preview player statistics recalculation.

**Response:**
```json
{
  "success": true,
  "data": {
    "playerMapping": [
      {
        "matchPlayerName": "string",
        "databasePlayerId": "string",
        "databasePlayerName": "string",
        "matchCount": number,
        "status": "matched|unmatched"
      }
    ],
    "totalPlayersInDatabase": number,
    "playerMapping": number,
    "matchesProcessed": number
  }
}
```

### POST /api/players
Create a new player.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "role": "batsman|bowler|all-rounder|wicket-keeper",
  "battingStyle": "RHB|LHB",
  "bowlingStyle": "RF|RFM|RM|RLB|RLM|LS|LF|LM|LLB|LLM",
  "nationality": "string",
  "age": number,
  "avatar": "string"
}
```

### PUT /api/players/{id}
Update an existing player.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "role": "batsman|bowler|all-rounder|wicket-keeper",
  "battingStyle": "RHB|LHB",
  "bowlingStyle": "RF|RFM|RM|RLB|RLM|LS|LF|LM|LLB|LLM",
  "nationality": "string",
  "age": number,
  "avatar": "string",
  "isActive": boolean
}
```

### DELETE /api/players/{id}
Soft delete a player (sets isActive to false).

---

## 4. Scoring API (`scoring.js`)

### POST /api/scoring/innings
Start a new inning for a match.

**Request Body:**
```json
{
  "matchId": "string",
  "battingTeamId": "string",
  "bowlingTeamId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "inningNumber": number,
    "battingTeam": "string",
    "bowlingTeam": "string",
    "totalRuns": 0,
    "totalWickets": 0,
    "totalOvers": 0,
    "totalBalls": 0
  }
}
```

### POST /api/scoring/balls
Record a ball in the current inning.

**Request Body:**
```json
{
  "inningId": "string",
  "batsmanId": "string",
  "bowlerId": "string",
  "runs": number,
  "extras": {
    "type": "wide|no-ball|bye|leg-bye",
    "runs": number
  },
  "wicket": {
    "type": "bowled|caught|run out|lbw|stumped",
    "fielderId": "string",
    "batsmanId": "string"
  }
}
```

### PUT /api/scoring/current-batsmen
Update current batsmen for an inning.

**Request Body:**
```json
{
  "inningId": "string",
  "batsman1Id": "string",
  "batsman2Id": "string"
}
```

### PUT /api/scoring/current-bowler
Update current bowler for an inning.

**Request Body:**
```json
{
  "inningId": "string",
  "bowlerId": "string"
}
```

### POST /api/scoring/end-inning
End the current inning.

**Request Body:**
```json
{
  "inningId": "string"
}
```

---

## 5. Live Scores API (`live-scores.js`)

### GET /api/live-scores
Get all live matches with current scores.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "matchId": "string",
      "title": "string",
      "venue": "string",
      "currentInnings": number,
      "battingTeam": "string",
      "bowlingTeam": "string",
      "score": "string",
      "overs": "string",
      "runRate": number,
      "requiredRunRate": number,
      "batsmen": [
        {
          "name": "string",
          "runs": number,
          "balls": number,
          "fours": number,
          "sixes": number,
          "strikeRate": number
        }
      ],
      "bowler": {
        "name": "string",
        "overs": number,
        "maidens": number,
        "runs": number,
        "wickets": number,
        "economy": number
      },
      "recentBalls": ["0", "1", "4", "W"]
    }
  ]
}
```

### GET /api/live-scores/{matchId}
Get live score for a specific match.

**Response:** Same as above but for a single match.

---

## 6. News API (`news.js`)

### GET /api/news
Get cricket news and updates.

**Query Parameters:**
- `category` (optional): Filter by category
- `limit` (optional): Number of items to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "url": "string",
      "imageUrl": "string",
      "publishedAt": "ISO8601 string",
      "source": "string",
      "category": "string"
    }
  ]
}
```

---

## 7. Schedules API (`schedules.js`)

### GET /api/schedules
Get match schedules.

**Query Parameters:**
- `date` (optional): Filter by date (YYYY-MM-DD)
- `team` (optional): Filter by team ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "title": "string",
      "date": "ISO8601 string",
      "time": "string",
      "venue": "string",
      "team1": {
        "id": "string",
        "name": "string",
        "shortName": "string"
      },
      "team2": {
        "id": "string",
        "name": "string",
        "shortName": "string"
      },
      "status": "upcoming|live|completed",
      "matchType": "string"
    }
  ]
}
```

---

## 8. Team Lineups API (`teamLineups.js`)

### GET /api/teamLineups
Get all team lineups.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "numericId": number,
      "displayId": "string",
      "teamId": "string",
      "team": {
        "id": "string",
        "name": "string",
        "shortName": "string"
      },
      "captainId": "string",
      "captain": {
        "id": "string",
        "name": "string"
      },
      "wicketKeeperId": "string",
      "wicketKeeper": {
        "id": "string",
        "name": "string"
      },
      "playerIds": ["string"],
      "players": [
        {
          "id": "string",
          "name": "string",
          "role": "string"
        }
      ],
      "createdAt": "ISO8601 string",
      "updatedAt": "ISO8601 string"
    }
  ]
}
```

### GET /api/teamLineups/{id}
Get a specific team lineup.

### POST /api/teamLineups
Create a new team lineup.

**Request Body:**
```json
{
  "teamId": "string",
  "captainId": "string",
  "wicketKeeperId": "string",
  "playerIds": ["string"]
}
```

### PUT /api/teamLineups/{id}
Update a team lineup.

### DELETE /api/teamLineups/{id}
Delete a team lineup.

---

## 9. External API (`external.js`)

### GET /api/external/cricket-news
Get cricket news from external sources.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "string",
      "description": "string",
      "url": "string",
      "publishedAt": "string",
      "source": "string"
    }
  ]
}
```

### GET /api/external/player-stats
Get player statistics from external sources.

**Query Parameters:**
- `playerName`: Name of the player

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "string",
    "matches": number,
    "runs": number,
    "wickets": number,
    "average": number,
    "strikeRate": number
  }
}
```

---

## Data Types

### Player Roles
- `batsman`
- `bowler`
- `all-rounder`
- `wicket-keeper`

### Batting Styles
- `RHB` (Right Hand Batsman)
- `LHB` (Left Hand Batsman)

### Bowling Styles
- `RF` (Right-arm Fast)
- `RFM` (Right-arm Fast Medium)
- `RM` (Right-arm Medium)
- `RLB` (Right-arm Leg Break)
- `RLM` (Right-arm Leg Medium)
- `LS` (Left-arm Slow)
- `LF` (Left-arm Fast)
- `LM` (Left-arm Medium)
- `LLB` (Left-arm Leg Break)
- `LLM` (Left-arm Leg Medium)

### Match Status
- `scheduled`
- `live`
- `completed`

### Wicket Types
- `bowled`
- `caught`
- `run out`
- `lbw` (Leg Before Wicket)
- `stumped`

### Extra Types
- `wide`
- `no-ball`
- `bye`
- `leg-bye`

## Error Codes

- `400` - Bad Request (missing required fields)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## Rate Limiting

Currently no rate limiting is implemented. All endpoints are available without restrictions.

## CORS

All endpoints support CORS with the following headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```