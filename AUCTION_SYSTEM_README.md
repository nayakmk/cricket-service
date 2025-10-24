# IPL-Style Auction System

A comprehensive auction system for cricket tournaments with real-time bidding, team budget management, and complete auction lifecycle management.

## Features

- **Real-time Bidding**: Live auction with countdown timers
- **Team Budget Management**: Automatic budget tracking and validation
- **Player Assignment**: Automatic player assignment to teams upon successful bids
- **Auction Lifecycle**: Scheduled → Active → Completed states
- **Comprehensive Analytics**: Detailed auction summaries and statistics
- **V2 Collections Integration**: Fully integrated with Players, Teams, and Tournaments

## API Endpoints

### Auction Management

#### Create Auction
```http
POST /api/v2/auctions
Content-Type: application/json

{
  "tournamentId": "tournament_1",
  "auctionConfig": {
    "totalBudgetPerTeam": 100000,
    "maxPlayersPerTeam": 11,
    "minPlayersPerTeam": 11,
    "basePricePerPlayer": 20000,
    "minBidIncrement": 5000
  },
  "teams": [
    {
      "teamId": "team_1",
      "team": {
        "teamId": "team_1",
        "name": "Mumbai Indians",
        "shortName": "MI"
      }
    }
  ]
}
```

#### Get All Auctions
```http
GET /api/v2/auctions?page=1&limit=10
```

#### Get Auction by ID
```http
GET /api/v2/auctions/auction_1
```

#### Update Auction
```http
PUT /api/v2/auctions/auction_1
Content-Type: application/json

{
  "status": "active",
  "auctionConfig": {
    "totalBudgetPerTeam": 120000
  }
}
```

#### Delete Auction
```http
DELETE /api/v2/auctions/auction_1
```

### Auction Control

#### Start Auction
```http
POST /api/v2/auctions/auction_1/start
```

#### Get Auction Status
```http
GET /api/v2/auctions/auction_1/status
```

#### Pause Auction
```http
POST /api/v2/auctions/auction_1/pause
```

#### Resume Auction
```http
POST /api/v2/auctions/auction_1/resume
```

#### Move to Next Player
```http
POST /api/v2/auctions/auction_1/next
```

### Bidding

#### Place a Bid
```http
POST /api/v2/auctions/auction_1/bid
Content-Type: application/json

{
  "teamId": "team_1",
  "amount": 25000
}
```

## Data Structures

### Auction Schema
```javascript
{
  auctionId: "auction_1",
  tournamentId: "tournament_1",
  status: "scheduled|active|paused|completed",
  auctionConfig: {
    totalBudgetPerTeam: 100000,
    maxPlayersPerTeam: 11,
    minPlayersPerTeam: 11,
    basePricePerPlayer: 20000,
    minBidIncrement: 5000,
    totalPlayersAuctioned: 0,
    totalSoldPlayers: 0,
    totalUnsoldPlayers: 0
  },
  teams: [
    {
      teamId: "team_1",
      team: { teamId, name, shortName },
      totalBudget: 100000,
      remainingBudget: 100000,
      spentBudget: 0,
      playersCount: 0,
      players: []
    }
  ],
  currentPlayer: {
    playerId: "player_1",
    player: { playerId, name, role },
    basePrice: 20000,
    currentBid: 25000,
    biddingTeam: "team_1",
    biddingTeamName: "Mumbai Indians",
    timeRemaining: 25,
    bidStartTime: "2024-01-01T10:00:00Z"
  },
  availablePlayers: [...],
  soldPlayers: [...],
  unsoldPlayers: [...],
  auctionSummary: {
    totalPlayers: 0,
    soldPlayers: 0,
    unsoldPlayers: 0,
    totalAuctionValue: 0,
    averagePlayerPrice: 0,
    highestBid: 0,
    lowestBid: 0,
    mostExpensivePlayer: null,
    teamSpending: [...]
  },
  createdAt: "2024-01-01T09:00:00Z",
  updatedAt: "2024-01-01T10:00:00Z"
}
```

## Auction Flow

1. **Scheduled**: Auction is created and configured
2. **Active**: Auction starts, players are auctioned one by one
   - Timer starts (30 seconds) when player comes up for auction
   - Teams can place bids with minimum increment
   - Timer resets to 30 seconds on each new bid
   - Player is sold if timer expires with a bid, or unsold if no bids
3. **Completed**: All players auctioned, final statistics calculated

## Timer System

- **Initial Timer**: 30 seconds when player comes up for auction
- **Bid Timer Reset**: Timer resets to 30 seconds on each valid bid
- **Expiration**: When timer reaches 0:
  - If bids exist: Player sold to highest bidder
  - If no bids: Player marked as unsold, move to next player

## Validation Rules

- **Budget Check**: Teams cannot bid more than remaining budget
- **Minimum Bid**: New bids must be at least current bid + minimum increment
- **Team Eligibility**: Only teams in the auction can bid
- **Auction State**: Bidding only allowed when auction is active

## Testing

Run the comprehensive test suite:

```bash
node test/test-auction-system.js
```

This will test:
- Auction creation
- Auction start/stop
- Bid placement
- Player transitions
- Auction completion
- Data cleanup

## Integration

The auction system is fully integrated with V2 collections:

- **Tournaments**: Auctions are linked to specific tournaments
- **Teams**: Team budgets and player assignments are managed
- **Players**: Player availability and assignments are tracked

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common errors:
- `Auction not found`
- `Auction is not active`
- `Insufficient budget`
- `Minimum bid is X`
- `Team not found in auction`