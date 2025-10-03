const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  venue: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  format: {
    type: String,
    enum: ['T20', 'ODI', 'Test', 'Box Cricket'],
    default: 'Box Cricket'
  },
  overs: {
    type: Number,
    default: 20,
    min: 1
  },
  team1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  team2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  tossWinner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  tossDecision: {
    type: String,
    enum: ['bat', 'bowl']
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  result: {
    type: String,
    enum: ['team1-won', 'team2-won', 'tie', 'abandoned', 'no-result']
  },
  manOfTheMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  },
  innings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inning'
  }],
  currentInning: {
    type: Number,
    default: 1,
    min: 1,
    max: 2
  },
  umpire1: {
    type: String,
    trim: true
  },
  umpire2: {
    type: String,
    trim: true
  },
  scorer: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  }
}, {
  timestamps: true
});

// Virtual for match summary
matchSchema.virtual('summary').get(function() {
  if (this.innings.length === 0) return 'Match not started';

  const firstInning = this.innings[0];
  if (this.innings.length === 1) {
    return `${firstInning.totalRuns}/${firstInning.totalWickets} (${firstInning.totalOvers}.${firstInning.totalBalls % 6})`;
  }

  const secondInning = this.innings[1];
  return `${firstInning.totalRuns}/${firstInning.totalWickets} & ${secondInning.totalRuns}/${secondInning.totalWickets}`;
});

// Virtual for current score
matchSchema.virtual('currentScore').get(function() {
  if (this.innings.length === 0 || this.status !== 'in-progress') return null;

  const currentInning = this.innings[this.currentInning - 1];
  if (!currentInning) return null;

  return {
    runs: currentInning.totalRuns,
    wickets: currentInning.totalWickets,
    overs: currentInning.totalOvers,
    balls: currentInning.totalBalls,
    runRate: currentInning.runRate
  };
});

module.exports = mongoose.model('Match', matchSchema);