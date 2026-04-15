/**
 * Game Engine for MoneyPit (Browser Version)
 * Manages canvas rendering, animals, particles, and game state
 */

class Animal {
  constructor(config, canvas) {
    this.id = config.id;
    this.name = config.name;
    this.emoji = config.emoji;
    this.category = config.category;
    this.canFly = config.canFly;
    this.personality = config.personality;
    this.config = config;
    this.canvas = canvas;

    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = 0;
    this.vy = 0;

    this.width = config.width || 20;
    this.height = config.height || 20;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.animationSpeed = 1.0;
    this.bobOffset = 0;
    this.jitterX = 0;
    this.jitterY = 0;

    this.state = 'idle';
    this.emotion = 'neutral';
    this.isSelected = false;

    this.behavior = {
      defaultSpeed: config.behavior.defaultSpeed,
      flySpeed: config.behavior.flySpeed,
      idleWanderRange: config.behavior.idleWanderRange,
      targetX: null,
      targetY: null,
      wanderTimer: 0
    };

    this.animations = {
      idle: [0, 1, 2, 1],
      walking: [3, 4, 5, 4],
      flying: [6, 7, 8, 9],
      installing: [0, 0],
      celebrating: [15, 16, 17, 16]
    };

    this.bezierPath = null;
    this.bezierT = 0;
  }

  update(dt, globalState) {
    const emotions = {
      neutral: { scale: 1.0, jitterAmount: 0 },
      happy: { scale: 1.05, jitterAmount: 1 },
      excited: { scale: 1.1, jitterAmount: 3 },
      working: { scale: 0.95, jitterAmount: 0 },
      celebrating: { scale: 1.15, jitterAmount: 4 }
    };

    const emotion = emotions[this.emotion] || emotions.neutral;
    this.animationSpeed = this.emotion === 'working' ? 0.8 : this.emotion === 'celebrating' ? 1.6 : 1.0;
    this.frameTime += dt * this.animationSpeed * 10;

    const animKey = this.state === 'installing' ? 'installing' :
                    this.state === 'celebrating' ? 'celebrating' :
                    this.state === 'flying' ? 'flying' :
                    this.state === 'walking' ? 'walking' : 'idle';
    const frames = this.animations[animKey] || this.animations.idle;
    this.currentFrame = Math.floor(this.frameTime) % frames.length;

    // Simple wander behavior
    if (this.state === 'idle') {
      this.behavior.wanderTimer += dt;
      if (this.behavior.wanderTimer > 3 || !this.behavior.targetX) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.behavior.idleWanderRange;
        this.behavior.targetX = this.canvas.width / 2 + Math.cos(angle) * distance;
        this.behavior.targetY = this.canvas.height / 2 + Math.sin(angle) * distance;
        this.behavior.wanderTimer = 0;
      }

      const dx = this.behavior.targetX - this.x;
      const dy = this.behavior.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 5) {
        const speed = this.behavior.defaultSpeed * 50;
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
      } else {
        this.vx *= 0.95;
        this.vy *= 0.95;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const padding = 40;
    if (this.x < padding) { this.x = padding; this.vx *= -0.5; }
    if (this.x > this.canvas.width - padding) { this.x = this.canvas.width - padding; this.vx *= -0.5; }
    if (this.y < padding) { this.y = padding; this.vy *= -0.5; }
    if (this.y > this.canvas.height - padding) { this.y = this.canvas.height - padding; this.vy *= -0.5; }

    this.vx *= 0.98;
    this.vy *= 0.98;

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
    ctx.save();
    let drawX = this.x + this.jitterX;
    let drawY = this.y + this.jitterY + this.bobOffset;
    ctx.translate(drawX, drawY);

    if (this.isSelected) {
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.width / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = this.config.color || '#ff6b35';
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

    ctx.font = '12px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, 0, 0);

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

  celebrate() {
    this.setState('celebrating', 'celebrating');
    return { type: 'confetti', x: this.x, y: this.y, count: 15 };
  }
}

class GameEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.animals = [];
    this.particles = [];
    this.selectedAnimalId = null;
    this.selectedAnimal = null;
    this.allAnimalsData = [];

    this.globalState = {
      isInstalling: false,
      emotion: 'neutral',
      flyingEnabled: true
    };

    this.lastTime = Date.now();
    this.animationId = null;
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsTime = Date.now();
  }

  async init() {
    try {
      const response = await fetch('src/assets/animals.json');
      this.allAnimalsData = await response.json();
      this.createRandomAnimals(15);
      if (this.allAnimalsData.length > 0) {
        this.setSelectedAnimal(this.allAnimalsData[0].id);
      }
      this.lastTime = Date.now();
      this.animate();
      console.log('✓ GameEngine initialized with', this.animals.length, 'animals');
    } catch (err) {
      console.error('GameEngine init failed:', err);
    }
  }

  createRandomAnimals(count) {
    const selected = new Set();
    while (selected.size < Math.min(count, this.allAnimalsData.length)) {
      const idx = Math.floor(Math.random() * this.allAnimalsData.length);
      selected.add(idx);
    }

    selected.forEach(idx => {
      const config = this.allAnimalsData[idx];
      const animal = new Animal(config, this.canvas);
      this.animals.push(animal);
    });
  }

  setSelectedAnimal(animalId) {
    if (this.selectedAnimal) {
      this.selectedAnimal.setSelected(false);
    }

    const oldIdx = this.animals.findIndex(a => a.id === animalId);
    if (oldIdx !== -1) {
      this.animals.splice(oldIdx, 1);
    }

    const config = this.allAnimalsData.find(a => a.id === animalId);
    if (config) {
      const newAnimal = new Animal(config, this.canvas);
      newAnimal.setSelected(true);
      this.animals.push(newAnimal);
      this.selectedAnimalId = animalId;
      this.selectedAnimal = newAnimal;
      console.log(`Selected: ${newAnimal.name}`);
    }
  }

  reactToEvent(eventType, emotionOverride = null) {
    const emotion = emotionOverride || {
      'install-start': 'working',
      'install-end': 'celebrating',
      'hover-button': 'excited',
      'mod-selected': 'happy'
    }[eventType] || 'neutral';

    this.animals.forEach(animal => {
      animal.setState(
        eventType === 'install-start' ? 'installing' :
        eventType === 'install-end' ? 'celebrating' : 'idle',
        emotion
      );

      if (eventType === 'install-end') {
        const particleData = animal.celebrate();
        this.spawnParticles(particleData);
      }
    });

    this.globalState.emotion = emotion;
    if (eventType === 'install-start') {
      this.globalState.isInstalling = true;
    } else if (eventType === 'install-end') {
      this.globalState.isInstalling = false;
    }
  }

  spawnParticles(data) {
    const { type, x, y, count } = data;

    if (type === 'confetti') {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random() * 200;
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 150,
          life: 2.0,
          maxLife: 2.0,
          color: ['#ff6b35', '#ffd700', '#00ff88', '#00b4d8'][Math.floor(Math.random() * 4)],
          update: function(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vy += 200 * dt;
            this.life -= dt;
          },
          draw: (ctx) => {
            ctx.fillStyle = data.color;
            ctx.globalAlpha = data.life / data.maxLife;
            ctx.fillRect(data.x, data.y, 4, 4);
            ctx.globalAlpha = 1.0;
          }
        });
      }
    }
  }

  toggleFlying(enabled) {
    this.globalState.flyingEnabled = enabled;
    console.log(`Flying ${enabled ? 'enabled' : 'disabled'}`);
  }

  animate() {
    const now = Date.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.update(Math.min(dt, 0.05));
    this.draw();

    this.frameCount++;
    const elapsed = now - this.lastFpsTime;
    if (elapsed >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  update(dt) {
    this.animals.forEach(animal => animal.update(dt, this.globalState));
    this.particles = this.particles.filter(p => {
      p.update(dt);
      return p.life > 0;
    });
  }

  draw() {
    this.ctx.fillStyle = '#181720';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const gridSize = 40;
    this.ctx.strokeStyle = 'rgba(0, 180, 216, 0.1)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    this.animals
      .sort((a, b) => a.y - b.y)
      .forEach(animal => animal.draw(this.ctx));

    this.particles.forEach(particle => particle.draw(this.ctx));
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// Export to window for browser context
if (typeof window !== 'undefined') {
  window.GameEngine = GameEngine;
  window.Animal = Animal;
}
