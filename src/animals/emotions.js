/**
 * Emotion System for Animals
 * Defines visual & behavioral changes based on emotional state
 */

const EMOTIONS = {
  neutral: {
    name: 'Neutral',
    scale: 1.0,
    filter: 'none',
    animationSpeed: 1.0,
    particles: null,
    jitterAmount: 0,
    opacityBoost: 0
  },

  happy: {
    name: 'Happy',
    scale: 1.05,
    filter: 'drop-shadow(0 0 8px #00ff88)',
    animationSpeed: 1.2,
    particles: 'sparkles',
    jitterAmount: 1,
    opacityBoost: 0.1
  },

  excited: {
    name: 'Excited',
    scale: 1.1,
    filter: 'drop-shadow(0 0 12px #ff6b35) hue-rotate(15deg)',
    animationSpeed: 1.4,
    particles: 'sparkles',
    jitterAmount: 3,
    opacityBoost: 0.15
  },

  working: {
    name: 'Working',
    scale: 0.95,
    filter: 'saturate(1.3) brightness(1.1)',
    animationSpeed: 0.8,
    particles: null,
    jitterAmount: 0,
    opacityBoost: 0
  },

  celebrating: {
    name: 'Celebrating',
    scale: 1.15,
    filter: 'drop-shadow(0 0 16px #ffd700) hue-rotate(-20deg)',
    animationSpeed: 1.6,
    particles: 'confetti',
    jitterAmount: 4,
    opacityBoost: 0.2
  }
};

module.exports = { EMOTIONS };
