/**
 * Behavior Tree System for Animals
 * Manages movement, state transitions, and interactions
 */

class BehaviorTree {
  constructor(config) {
    this.defaultSpeed = config.defaultSpeed || 1.0;
    this.flySpeed = config.flySpeed || 0;
    this.idleWanderRange = config.idleWanderRange || 100;
    this.fidgetChance = config.fidgetChance || 0.3;

    // Behavior state
    this.targetX = null;
    this.targetY = null;
    this.wanderTimer = 0;
    this.fidgetTimer = 0;
  }

  update(animal, dt, globalState) {
    const { state, canFly, x, y, canvas } = animal;

    switch (state) {
      case 'idle':
        this.updateIdle(animal, dt, canvas);
        break;
      case 'walking':
        this.updateWalking(animal, dt, canvas);
        break;
      case 'flying':
        this.updateFlying(animal, dt, canvas);
        break;
      case 'installing':
        this.updateInstalling(animal, dt);
        break;
      case 'celebrating':
        this.updateCelebrating(animal, dt, canvas);
        break;
    }

    // Occasionally fidget
    this.fidgetTimer -= dt;
    if (this.fidgetTimer <= 0) {
      if (Math.random() < this.fidgetChance) {
        animal.fidget();
      }
      this.fidgetTimer = 0.5 + Math.random() * 1.5; // Fidget every 0.5-2 seconds
    }
  }

  updateIdle(animal, dt, canvas) {
    // Random wander in a circle
    this.wanderTimer += dt;

    if (this.wanderTimer > 3 || !this.targetX) {
      // Pick new wander target
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * this.idleWanderRange;
      this.targetX = canvas.width / 2 + Math.cos(angle) * distance;
      this.targetY = canvas.height / 2 + Math.sin(angle) * distance;
      this.wanderTimer = 0;
    }

    // Move toward target
    const dx = this.targetX - animal.x;
    const dy = this.targetY - animal.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      const speed = this.defaultSpeed * 50; // pixels per second
      animal.vx = (dx / dist) * speed;
      animal.vy = (dy / dist) * speed;
    } else {
      animal.vx *= 0.95;
      animal.vy *= 0.95;
    }
  }

  updateWalking(animal, dt, canvas) {
    // Similar to idle but more direct
    if (!this.targetX) {
      this.targetX = Math.random() * canvas.width;
      this.targetY = Math.random() * canvas.height;
    }

    const dx = this.targetX - animal.x;
    const dy = this.targetY - animal.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      const speed = this.defaultSpeed * 60; // pixels per second
      animal.vx = (dx / dist) * speed;
      animal.vy = (dy / dist) * speed;
    } else {
      // Target reached, pick new
      this.targetX = Math.random() * canvas.width;
      this.targetY = Math.random() * canvas.height;
    }
  }

  updateFlying(animal, dt, canvas) {
    // Move along bezier path or random pattern
    if (!animal.bezierPath) {
      // Generate random bezier path if flying
      animal.bezierPath = this.generateBezierPath(animal, canvas);
      animal.bezierT = 0;
    }

    // Move along path
    animal.bezierT += dt * 0.5; // 2 second duration per path
    if (animal.bezierT >= 1) {
      // Path complete, generate new one
      animal.bezierPath = this.generateBezierPath(animal, canvas);
      animal.bezierT = 0;
    }

    const pos = this.sampleBezier(animal.bezierPath, animal.bezierT);
    const speed = this.flySpeed * 100;
    const dx = pos.x - animal.x;
    const dy = pos.y - animal.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      animal.vx = (dx / dist) * speed;
      animal.vy = (dy / dist) * speed;
    }
  }

  updateInstalling(animal, dt) {
    // Reduced movement, slight bobbing
    animal.vx *= 0.9;
    animal.vy *= 0.9;
    animal.bobOffset = Math.sin(Date.now() * 0.005) * 3;
  }

  updateCelebrating(animal, dt, canvas) {
    // Erratic, joyful movement
    if (Math.random() < 0.1) {
      // Random jump direction
      const angle = Math.random() * Math.PI * 2;
      animal.vx = Math.cos(angle) * this.defaultSpeed * 100;
      animal.vy = Math.sin(angle) * this.defaultSpeed * 100;
    }
    animal.vx *= 0.92;
    animal.vy *= 0.92;
  }

  generateBezierPath(animal, canvas) {
    // Generate a smooth bezier curve from current position
    const startX = animal.x;
    const startY = animal.y;

    // Random endpoint within canvas
    const endX = Math.random() * canvas.width;
    const endY = Math.random() * canvas.height;

    // Control points for smooth curve
    const cp1X = startX + (endX - startX) * 0.3 + (Math.random() - 0.5) * 200;
    const cp1Y = startY + (endY - startY) * 0.3 + (Math.random() - 0.5) * 200;
    const cp2X = startX + (endX - startX) * 0.7 + (Math.random() - 0.5) * 200;
    const cp2Y = startY + (endY - startY) * 0.7 + (Math.random() - 0.5) * 200;

    // Clamp control points to canvas
    return {
      p0: { x: startX, y: startY },
      p1: {
        x: Math.max(0, Math.min(canvas.width, cp1X)),
        y: Math.max(0, Math.min(canvas.height, cp1Y))
      },
      p2: {
        x: Math.max(0, Math.min(canvas.width, cp2X)),
        y: Math.max(0, Math.min(canvas.height, cp2Y))
      },
      p3: {
        x: Math.max(0, Math.min(canvas.width, endX)),
        y: Math.max(0, Math.min(canvas.height, endY))
      }
    };
  }

  sampleBezier(path, t) {
    // Cubic Bezier interpolation
    const { p0, p1, p2, p3 } = path;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x =
      mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    const y =
      mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

    return { x, y };
  }
}

module.exports = { BehaviorTree };
