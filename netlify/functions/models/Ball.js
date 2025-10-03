const mongoose = require('mongoose');

const ballSchema = new mongoose.Schema({
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  inning: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inning',
    required: true
  },
  over: {
    type: Number,
    required: true,
    min: 0
  },
  ballNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  batsman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  bowler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  runs: {
    type: Number,
    default: 0,
    min: 0
  },
  isWicket: {
    type: Boolean,
    default: false
  },
  wicketType: {
    type: String,
    enum: ['bowled', 'caught', 'run-out', 'lbw', 'stumped', 'hit-wicket', 'handled-ball', 'obstructing-field', 'double-hit', 'retired-out'],
    required: function() { return this.isWicket; }
  },
  fielder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  },
  extras: {
    type: {
      type: String,
      enum: ['no-ball', 'wide', 'bye', 'leg-bye']
    },
    runs: {
      type: Number,
      default: 0
    }
  },
  isLegalDelivery: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure unique balls in a match
ballSchema.index({ match: 1, inning: 1, over: 1, ballNumber: 1 }, { unique: true });

module.exports = mongoose.model('Ball', ballSchema);