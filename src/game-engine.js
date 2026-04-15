/**
 * Game Engine for MoneyPit
 * Manages canvas rendering, animals, particles, and game state
 */

const { AnimalAssetLoader } = require('./animals/asset-loader');
const { EMOTIONS } = require('./animals/emotions');

class GameEngine {
  constructor(canvasElement, app) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.app = app;

    // Collections
    this.animals = [];
    this.particles = [];
    this.assetLoader = new AnimalAssetLoader(app);

    // Game state
    this.selectedAnimalId = null;
    this.selectedAnimal = null;
    this.globalState = {
      isInstalling: false,
      emotion: 'neutral',
      flyingEnabled: true,
      installProgress: 0
    };

    // Timing
    this.lastTime = Date.now();
    this.animationId = null;

    // Stats
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsTime = Date.now();
  }

  async init() {
    try {
      // Load animal assets
      await this.assetLoader.preload();

      // Create initial animals (15 diverse ones)
      this.animals = this.assetLoader.createAnimalInstances(15, this.canvas);

      // Select first one
      if (this.animals.length > 0) {
        this.setSelectedAnimal(this.animals[0].id);
      }

      // Setup resize handler
      window.addEventListener('resize', () => this.onWindowResize());

      // Start animation loop
      this.lastTime = Date.now();
      this.animate();

      console.log('✓ GameEngine initialized with', this.animals.length, 'animals');
    } catch (err) {
      console.error('GameEngine init failed:', err);
      throw err;
    }
  }

  animate() {
    const now = Date.now();
    const dt = (now - this.lastTime) / 1000; // Delta time in seconds
    this.lastTime = now;

    // Update
    this.update(Math.min(dt, 0.05)); // Cap dt to prevent huge jumps

    // Draw
    this.draw();

    // Calculate FPS
    this.frameCount++;
    const elapsed = now - this.lastFpsTime;
    if (elapsed >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
      // console.log(`FPS: ${this.fps}`);
    }

    // Continue loop
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  update(dt) {
    // Update all animals
    this.animals.forEach(animal => {
      animal.update(dt, this.globalState);
    });

    // Update particles
    this.particles = this.particles.filter(p => {
      p.update(dt);
      return p.life > 0;
    });
  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#181720';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid background
    this.drawBackground();

    // Draw animals (sorted by Y for depth)
    this.animals
      .sort((a, b) => a.y - b.y)
      .forEach(animal => animal.draw(this.ctx));

    // Draw particles on top
    this.particles.forEach(particle => particle.draw(this.ctx));

    // Debug info
    // this.drawDebugInfo();
  }

  drawBackground() {
    // Grid pattern
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
  }

  drawDebugInfo() {
    this.ctx.fillStyle = '#00ff88';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);
    this.ctx.fillText(`Animals: ${this.animals.length}`, 10, 35);
    this.ctx.fillText(`Particles: ${this.particles.length}`, 10, 50);
  }

  setSelectedAnimal(animalId) {
    // Deselect previous
    if (this.selectedAnimal) {
      this.selectedAnimal.setSelected(false);
    }

    // Find and select new animal
    const config = this.assetLoader.getAnimalByid(animalId);
    if (!config) {
      console.warn('Animal not found:', animalId);
      return;
    }

    // Remove old selected if it exists
    const oldIdx = this.animals.findIndex(a => a.id === animalId);
    if (oldIdx !== -1) {
      this.animals.splice(oldIdx, 1);
    }

    // Create new selected animal instance
    const newAnimal = this.assetLoader.createAnimalInstances(1, this.canvas)[0];
    newAnimal.id = animalId;
    newAnimal.setSelected(true);
    this.animals.push(newAnimal);

    this.selectedAnimalId = animalId;
    this.selectedAnimal = newAnimal;

    console.log(`Selected: ${newAnimal.name}`);
  }

  reactToEvent(eventType, emotionOverride = null) {
    const emotion = emotionOverride || {
      'install-start': 'working',
      'install-end': 'celebrating',
      'hover-button': 'excited',
      'mod-selected': 'happy'
    }[eventType] || 'neutral';

    // All animals react
    this.animals.forEach(animal => {
      animal.setState(
        eventType === 'install-start' ? 'installing' :
        eventType === 'install-end' ? 'celebrating' : 'idle',
        emotion
      );

      // Emit particles on install completion
      if (eventType === 'install-end') {
        const particleData = animal.celebrate();
        this.spawnParticles(particleData);
      }
    });

    // Update global state
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
        const angle = (Math.random() * Math.PI * 2);
        const speed = 150 + Math.random() * 200;
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 150,
          life: 2.0,
          maxLife: 2.0,
          color: ['#ff6b35', '#ffd700', '#00ff88', '#00b4d8'][
            Math.floor(Math.random() * 4)
          ],
          update: function(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vy += 200 * dt; // Gravity
            this.life -= dt;
          },
          draw: (ctx) => {
            const particle = this;
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.life / particle.maxLife;
            ctx.fillRect(particle.x, particle.y, 4, 4);
            ctx.globalAlpha = 1.0;
          }
        });
      }
    } else if (type === 'sparkles') {
      for (let i = 0; i < count; i++) {
        const angle = (Math.random() * Math.PI * 2);
        const speed = 80 + Math.random() * 120;
        this.particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          maxLife: 1.0,
          color: '#00ff88',
          update: function(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vx *= 0.95;
            this.vy *= 0.95;
            this.life -= dt;
          },
          draw: (ctx) => {
            const particle = this;
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.life / particle.maxLife;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
            ctx.fill();
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

  onWindowResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

module.exports = { GameEngine };
