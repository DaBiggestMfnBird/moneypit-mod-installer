/**
 * Animal Class
 * Core entity representing a single animal with position, state, and behavior
 */

const { BehaviorTree } = require('./behaviors');
const { EMOTIONS } = require('./emotions');

class Animal {
  constructor(config, spriteSheet, canvas) {
    this.id = config.id;
    this.name = config.name;
    this.emoji = config.emoji;
    this.category = config.category;
    this.canFly = config.canFly;
    this.personality = config.personality;
    this.spriteSheet = spriteSheet; // Reference to sprite image
    this.config = config;
    this.canvas = canvas;

    // Position & velocity
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = 0;
    this.vy = 0;

    // Animation
    this.width = config.width || 20;
    this.height = config.height || 20;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.animationSpeed = 1.0;
    this.bobOffset = 0;
    this.jitterX = 0;
    this.jitterY = 0;

    // State
    this.state = 'idle'; // idle, walking, flying, installing, celebrating
    this.emotion = 'neutral'; // neutral, happy, excited, working, celebrating
    this.isSelected = false;

    // Behavior tree
    this.behavior = new BehaviorTree(config.behavior);

    // Animation frame map (simplified - in real app would load from spritesheet)
    this.animations = {
      idle: [0, 1, 2, 1],
      walking: [3, 4, 5, 4],
      flying: [6, 7, 8, 9],
      happy: [10, 11],
      excited: [12, 13, 14],
      installing: [0, 0],
      celebrating: [15, 16, 17, 16]
    };

    // Bezier path for flying
    this.bezierPath = null;
    this.bezierT = 0;
  }

  update(dt, globalState) {
    // Update behavior
    this.behavior.update(this, dt, globalState);

    // Update animation
    const emotion = EMOTIONS[this.emotion] || EMOTIONS.neutral;
    this.animationSpeed = emotion.animationSpeed;
    this.frameTime += dt * this.animationSpeed * 10; // Frame advancement

    // Get current animation frames
    const animKey = this.state === 'installing' ? 'installing' :
                    this.state === 'celebrating' ? 'celebrating' :
                    this.state === 'flying' ? 'flying' :
                    this.state === 'walking' ? 'walking' : 'idle';
    const frames = this.animations[animKey] || this.animations.idle;
    this.currentFrame = Math.floor(this.frameTime) % frames.length;

    // Update position with bounds check
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Soft bounds (bounce back)
    const padding = 40;
    if (this.x < padding) {
      this.x = padding;
      this.vx *= -0.5;
    }
    if (this.x > this.canvas.width - padding) {
      this.x = this.canvas.width - padding;
      this.vx *= -0.5;
    }
    if (this.y < padding) {
      this.y = padding;
      this.vy *= -0.5;
    }
    if (this.y > this.canvas.height - padding) {
      this.y = this.canvas.height - padding;
      this.vy *= -0.5;
    }

    // Friction
    this.vx *= 0.98;
    this.vy *= 0.98;

    // Jitter effect (for excited state)
    const jitterAmount = emotion.jitterAmount || 0;
    if (jitterAmount > 0) {
      this.jitterX = (Math.random() - 0.5) * jitterAmount * 2;
      this.jitterY = (Math.random() - 0.5) * jitterAmount * 2;
    } else {
      this.jitterX *= 0.9;
      this.jitterY *= 0.9;
    }
  }

  draw(ctx) {
    const emotion = EMOTIONS[this.emotion] || EMOTIONS.neutral;

    // Save context state
    ctx.save();

    // Calculate final position with effects
    let drawX = this.x + this.jitterX;
    let drawY = this.y + this.jitterY + this.bobOffset;

    // Move to position
    ctx.translate(drawX, drawY);

    // Apply scaling
    ctx.scale(emotion.scale, emotion.scale);

    // Draw selection indicator
    if (this.isSelected) {
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2;
      ctx.arc(0, 0, this.width / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw base animal (simple colored rectangle for now, replace with sprite)
    ctx.fillStyle = this.config.color || '#ff6b35';
    ctx.fillRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height
    );

    // Draw outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height
    );

    // Draw emoji label (simple text for now)
    ctx.font = '12px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, 0, 0);

    // Restore context
    ctx.restore();
  }

  setState(newState, newEmotion = this.emotion) {
    this.state = newState;
    this.emotion = newEmotion;
    this.currentFrame = 0;
    this.frameTime = 0;
  }

  setSelected(isSelected) {
    this.isSelected = isSelected;
    if (isSelected) {
      this.x = this.canvas.width / 2;
      this.y = this.canvas.height / 2;
      this.vx = 0;
      this.vy = 0;
    }
  }

  fidget() {
    // Quick random movement
    const angle = Math.random() * Math.PI * 2;
    this.vx += Math.cos(angle) * 20;
    this.vy += Math.sin(angle) * 20;
  }

  celebrate() {
    // Trigger celebration animation
    this.setState('celebrating', 'celebrating');

    // Emit particles (handled by game engine)
    return {
      type: 'confetti',
      x: this.x,
      y: this.y,
      count: 15
    };
  }
}

module.exports = { Animal };
