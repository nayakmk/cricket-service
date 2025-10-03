const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  shortName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  },
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  logo: {
    type: String // URL to team logo
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    matchesWon: { type: Number, default: 0 },
    matchesLost: { type: Number, default: 0 },
    matchesDrawn: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Virtual for win percentage
teamSchema.virtual('winPercentage').get(function() {
  return this.stats.matchesPlayed > 0 ? (this.stats.matchesWon / this.stats.matchesPlayed) * 100 : 0;
});

module.exports = mongoose.model('Team', teamSchema);