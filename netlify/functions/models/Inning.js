const mongoose = require('mongoose');

const inningSchema = new mongoose.Schema({
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  battingTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  bowlingTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  inningNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 2
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  totalRuns: {
    type: Number,
    default: 0
  },
  totalWickets: {
    type: Number,
    default: 0,
    max: 10
  },
  totalOvers: {
    type: Number,
    default: 0
  },
  totalBalls: {
    type: Number,
    default: 0
  },
  currentBatsmen: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isOut: { type: Boolean, default: false }
  }],
  currentBowler: {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    overs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 }
  },
  fallOfWickets: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    score: { type: Number, required: true },
    overs: { type: Number, required: true }
  }],
  extras: {
    noBalls: { type: Number, default: 0 },
    wides: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    legByes: { type: Number, default: 0 }
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

// Virtual for run rate
inningSchema.virtual('runRate').get(function() {
  return this.totalOvers > 0 ? this.totalRuns / this.totalOvers : 0;
});

// Virtual for remaining wickets
inningSchema.virtual('wicketsRemaining').get(function() {
  return 10 - this.totalWickets;
});

module.exports = mongoose.model('Inning', inningSchema);