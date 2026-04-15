/**
 * Animal Asset Loader
 * Handles preloading animal configs and creating instances
 */

const fs = require('fs-extra');
const path = require('path');
const { Animal } = require('./animal');

class AnimalAssetLoader {
  constructor(app) {
    this.app = app;
    this.cacheDir = path.join(app.getPath('userData'), 'animal-assets');
    this.animalsDb = [];
    this.spriteSheet = null;
    this.initialized = false;
  }

  async preload() {
    try {
      // 1. Create cache dir if needed
      await fs.ensureDir(this.cacheDir);

      // 2. Load animal configs from JSON
      const animalsPath = path.join(
        __dirname,
        '../assets/animals.json'
      );
      const animalsJson = await fs.readJson(animalsPath);
      this.animalsDb = animalsJson;

      this.initialized = true;
      console.log(`✓ Loaded ${this.animalsDb.length} animal configs`);
      return this.animalsDb.length;
    } catch (err) {
      console.error('Failed to preload animals:', err);
      throw err;
    }
  }

  createAnimalInstances(count = 10, canvas) {
    if (!this.initialized) {
      throw new Error('Asset loader not initialized. Call preload() first.');
    }

    const animals = [];
    const selected = new Set();

    // Randomly select N animals
    while (selected.size < Math.min(count, this.animalsDb.length)) {
      const idx = Math.floor(Math.random() * this.animalsDb.length);
      selected.add(idx);
    }

    // Create instances
    selected.forEach(idx => {
      const config = this.animalsDb[idx];
      const animal = new Animal(config, this.spriteSheet, canvas);
      animals.push(animal);
    });

    return animals;
  }

  getAnimalByid(animalId) {
    const config = this.animalsDb.find(a => a.id === animalId);
    if (!config) return null;
    return config;
  }

  getAllAnimals() {
    return this.animalsDb;
  }

  getAnimalsByCategory(category) {
    return this.animalsDb.filter(a => a.category === category);
  }

  getAnimalsByCanFly(canFly) {
    return this.animalsDb.filter(a => a.canFly === canFly);
  }
}

module.exports = { AnimalAssetLoader };
