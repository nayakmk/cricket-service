# Cricket App Service - Netlify Backend

A serverless backend service for cricket scoring application built with Netlify Functions and MongoDB.

## Features

- **Match Management**: Create, read, update, and delete cricket matches
- **Team Management**: Manage teams and their players
- **Player Management**: Handle player profiles and statistics
- **Live Scoring**: Real-time ball-by-ball scoring system
- **Live Scores**: Get current match scores and statistics

## Tech Stack

- **Runtime**: Node.js with Netlify Functions
- **Database**: Google Firestore
- **Authentication**: Firebase Admin SDK
- **Deployment**: Netlify

## Project Structure

```
cricket-app-service/
├── netlify/
│   └── functions/
│       ├── matches.js          # Match CRUD operations
│       ├── teams.js            # Team management
│       ├── players.js          # Player management
│       ├── scoring.js          # Ball-by-ball scoring
│       └── live-scores.js      # Live score retrieval
├── models/                     # Mongoose models
│   ├── Match.js
│   ├── Team.js
│   ├── Player.js
│   ├── Inning.js
│   ├── Ball.js
│   └── User.js
├── config/
│   └── database.js             # Database connection
├── public/
│   ├── index.html
│   └── _redirects              # Netlify redirects
├── netlify.toml                # Netlify configuration
├── package.json
├── .env                        # Environment variables
└── README.md
```

## API Endpoints

### Matches
- `GET /.netlify/functions/matches` - Get all matches
- `GET /.netlify/functions/matches/:id` - Get match by ID
- `POST /.netlify/functions/matches` - Create new match
- `PUT /.netlify/functions/matches/:id` - Update match
- `DELETE /.netlify/functions/matches/:id` - Delete match

### Teams
- `GET /.netlify/functions/teams` - Get all teams
- `GET /.netlify/functions/teams/:id` - Get team by ID
- `POST /.netlify/functions/teams` - Create new team
- `PUT /.netlify/functions/teams/:id` - Update team
- `DELETE /.netlify/functions/teams/:id` - Delete team

### Players
- `GET /.netlify/functions/players` - Get all players
- `GET /.netlify/functions/players/:id` - Get player by ID
- `POST /.netlify/functions/players` - Create new player
- `PUT /.netlify/functions/players/:id` - Update player
- `DELETE /.netlify/functions/players/:id` - Delete player

### Scoring
- `POST /.netlify/functions/scoring/start-inning` - Start new inning
- `POST /.netlify/functions/scoring/ball` - Record a ball
- `PUT /.netlify/functions/scoring/current-batsmen` - Update current batsmen
- `PUT /.netlify/functions/scoring/current-bowler` - Update current bowler
- `POST /.netlify/functions/scoring/end-inning` - End inning

### Live Scores
- `GET /.netlify/functions/live-scores` - Get all live matches
- `GET /.netlify/functions/live-scores/:matchId` - Get live score for specific match

## Setup Instructions

### 1. Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account
- Netlify CLI (`npm install -g netlify-cli`)
- Netlify account

### 2. Clone and Install

```bash
git clone <repository-url>
cd cricket-app-service
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cricket-scoring-app?retryWrites=true&w=majority

# JWT Secret (for future authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Frontend URL for CORS
FRONTEND_URL=https://your-netlify-app.netlify.app

NODE_ENV=production
```

### 4. MongoDB Atlas Setup

1. Create a MongoDB Atlas cluster
2. Create a database user
3. Whitelist your IP (or 0.0.0.0/0 for testing)
4. Get your connection string and update the `.env` file

### 5. Local Development

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Start local development server
npm run dev
```

This will start the Netlify development server on `http://localhost:8888`

### 6. Deploy to Netlify

```bash
# Deploy to production
npm run deploy

# Or link to an existing site
netlify link

# Then deploy
netlify deploy --prod
```

### 7. Update Frontend

Update your frontend's `cricketScoringService.js` to use the correct Netlify app URL:

```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-netlify-app.netlify.app'  // Replace with your actual Netlify URL
  : 'http://localhost:8888';
```

## Firestore Collections

Firestore is schemaless, so collections are created automatically when you first write to them. The following collections will be used:

### Collections Structure

- **`teams`**: Team information with player references
- **`players`**: Player profiles and statistics
- **`matches`**: Match details and team references
- **`innings`**: Created dynamically during matches
- **`balls`**: Ball-by-ball scoring data
- **`users`**: User accounts (future implementation)

### Initialize Collections (Optional)

To create sample data and verify your Firestore connection:

```bash
npm run init-collections
```

This will create sample teams, players, and a match to get you started.

## Data Models

### Match
- Basic match information (title, venue, date, format)
- Teams, toss details, status
- Innings and scoring data

### Team
- Team name, short name, captain
- Player roster and statistics

### Player
- Personal details and cricket statistics
- Batting/bowling styles and preferences

### Inning
- Inning-specific data (runs, wickets, overs)
- Current batsmen and bowler
- Ball-by-ball records

### Ball
- Individual delivery information
- Runs, wickets, extras tracking

## Error Handling

All API endpoints return responses in the following format:

```json
{
  "success": true|false,
  "data": {...},
  "message": "Optional message",
  "error": "Error details if applicable"
}
```

## CORS Configuration

The functions are configured to allow requests from:
- Your Netlify frontend URL (set in `FRONTEND_URL` env var)
- Local development (`http://localhost:3000`)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `FIREBASE_PRIVATE_KEY_ID` | Firebase private key ID | Yes |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (with newlines) | Yes |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | Yes |
| `FIREBASE_CLIENT_ID` | Firebase client ID | Yes |
| `FIREBASE_CLIENT_X509_CERT_URL` | Firebase certificate URL | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | No (for future auth) |
| `FRONTEND_URL` | Frontend application URL | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## Development Tips

1. **Local Testing**: Use `netlify dev` for local function testing
2. **Logs**: Check Netlify dashboard for function logs
3. **Database**: Use Firebase Console for Firestore database inspection
4. **CORS**: Update `FRONTEND_URL` when deploying frontend

## Contributing

1. Test functions locally with `netlify dev`
2. Ensure all endpoints return proper JSON responses
3. Update this README for any API changes
4. Test with real MongoDB data before deploying

## License

ISC