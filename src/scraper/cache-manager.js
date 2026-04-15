/**
 * Persistent Cache Manager
 * File-based caching for offline support
 */

const fs = require('fs-extra');
const path = require('path');

class PersistentCache {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    fs.ensureDirSync(this.cacheDir);
  }

  async get(key) {
    try {
      const filePath = path.join(this.cacheDir, `${this.hashKey(key)}.json`);
      if (!fs.existsSync(filePath)) return null;

      const data = await fs.readJson(filePath);
      const now = Date.now();

      // Check if expired
      if (now - data.timestamp > data.ttl * 1000) {
        await fs.remove(filePath);
        return null;
      }

      return data.value;
    } catch (err) {
      console.error('Cache read failed:', err.message);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      const filePath = path.join(this.cacheDir, `${this.hashKey(key)}.json`);
      const data = {
        value,
        timestamp: Date.now(),
        ttl
      };
      await fs.writeJson(filePath, data);
    } catch (err) {
      console.error('Cache write failed:', err.message);
    }
  }

  async clear() {
    try {
      await fs.emptyDir(this.cacheDir);
    } catch (err) {
      console.error('Cache clear failed:', err.message);
    }
  }

  hashKey(key) {
    // Simple hash for filename
    return key.replace(/[^a-zA-Z0-9]/g, '_');
  }
}

module.exports = { PersistentCache };
