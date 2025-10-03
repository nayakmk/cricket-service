const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  role: {
    type: String,
    enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'],
    default: 'batsman'
  },
  battingStyle: {
    type: String,
    enum: ['right-handed', 'left-handed']
  },
  bowlingStyle: {
    type: String,
    enum: ['right-arm-fast', 'right-arm-medium', 'right-arm-off-spin', 'right-arm-leg-spin',
           'left-arm-fast', 'left-arm-medium', 'left-arm-off-spin', 'left-arm-leg-spin']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    bestBowling: { type: String, default: '0/0' },
    battingAverage: { type: Number, default: 0 },
    bowlingAverage: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Update stats before saving
playerSchema.pre('save', function(next) {
  if (this.stats.matchesPlayed > 0) {
    this.stats.battingAverage = this.stats.runs / this.stats.matchesPlayed;
    if (this.stats.wickets > 0) {
      this.stats.bowlingAverage = (this.stats.runs || 0) / this.stats.wickets;
    }
  }
  next();
});

module.exports = mongoose.model('Player', playerSchema);