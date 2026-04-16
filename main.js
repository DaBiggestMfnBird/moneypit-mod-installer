const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater }                          = require('electron-updater');
const path                                     = require('path');
const fs                                       = require('fs-extra');
const axios                                    = require('axios');
const extractZip                               = require('extract-zip');
const { URL }                                  = require('url');
const crypto                                   = require('crypto');
const { ModScraper }                           = require('./src/scraper/mod-scraper');

// Safely initialize Aptabase analytics
let trackEvent = () => {}; // fallback no-op
try {
  const aptabase = require('@aptabase/electron');
  trackEvent = aptabase.trackEvent;
} catch (e) {
  console.warn('⚠️ Aptabase analytics unavailable:', e.message);
  console.log('Analytics disabled but app will continue normally');
}

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

const ALLOWED_HOSTS = [
  'beamng.com','www.beamng.com',
  'worldofmods.com','www.worldofmods.com',
  'modland.net','www.modland.net',
  'github.com',
  'objects.githubusercontent.com',
  'raw.githubusercontent.com',
  'github-releases.githubusercontent.com',
];

// ── #8 File logging ──────────────────────────────────────────────────────────
let logStream;

function initLogger() {
  try {
    const logDir = app.getPath('logs');
    fs.ensureDirSync(logDir);
    logStream = fs.createWriteStream(path.join(logDir, 'moneypit.log'), { flags: 'a' });
    log(`MoneyPit Mod Installer started — v${app.getVersion()}`);
  } catch (e) {
    console.error('Logger init failed:', e);
  }
}

function log(msg, level = 'INFO') {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  logStream?.write(line + '\n');
}

function logError(msg, err) {
  log(`${msg}: ${err?.message || err}`, 'ERROR');
  if (err?.stack) log(err.stack, 'ERROR');
}

// ── Windows ──────────────────────────────────────────────────────────────────
let mainWindow, splashWindow;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480, height: 320,
    frame: false, resizable: false,
    center: true, alwaysOnTop: true,
    backgroundColor: '#04040c',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile('splash.html');
  splashWindow.on('closed', () => { splashWindow = null; });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900, height: 750,
    minWidth: 800, minHeight: 600,
    show: false, backgroundColor: '#04040c',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      splashWindow?.close();
      mainWindow.show();
      checkForUpdates();
    }, 2000);
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
// ── Mod Scraper ──────────────────────────────────────────────────────────────
let modScraper = null;

app.whenReady().then(() => {
  // #6: correct Windows taskbar identity
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.moneypit.modinstaller');
  }
  initLogger();
  modScraper = new ModScraper(app);
  log('✓ ModScraper initialized');

  // Track app launch
  trackEvent('app_launched', {
    version: app.getVersion(),
    platform: process.platform
  });

  createSplash();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── #9 Auto-updater ──────────────────────────────────────────────────────────
function checkForUpdates() {
  if (!app.isPackaged) { log('Update check skipped — dev mode'); return; }

  autoUpdater.logger       = { info: m => log(m), error: m => log(m, 'ERROR') };
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available',    i  => { log(`Update available: v${i.version}`); mainWindow?.webContents.send('update-available', { version: i.version }); });
  autoUpdater.on('update-not-available',()  => log('App is up to date'));
  autoUpdater.on('error',               e  => logError('Updater error', e));
  autoUpdater.on('download-progress',   p  => mainWindow?.webContents.send('update-progress', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded',   ()  => { log('Update ready'); mainWindow?.webContents.send('update-downloaded'); });

  autoUpdater.checkForUpdates().catch(e => logError('Update check failed', e));
}

ipcMain.handle('install-update',      () => autoUpdater.downloadUpdate());
ipcMain.handle('restart-and-install', () => autoUpdater.quitAndInstall());

// ── BeamNG mods folder ───────────────────────────────────────────────────────
function getBeamNGModsFolder() {
  const bases = [process.env.LOCALAPPDATA, process.env.APPDATA, process.env.HOME].filter(Boolean);

  for (const base of bases) {
    const beamDir = path.join(base, 'BeamNG.drive');
    if (!fs.existsSync(beamDir)) continue;
    try {
      const versions = fs.readdirSync(beamDir)
        .filter(d => /^\d+\.\d+$/.test(d))
        .sort((a, b) => {
          const [aM, am] = a.split('.').map(Number);
          const [bM, bm] = b.split('.').map(Number);
          return bM !== aM ? bM - aM : bm - am;
        });
      if (versions.length) {
        const p = path.join(beamDir, versions[0], 'mods');
        log(`Detected BeamNG mods folder: ${p}`);
        return p;
      }
    } catch (e) { logError('Version scan failed', e); }
  }

  const fallback = path.join(process.env.LOCALAPPDATA || process.env.HOME || '', 'BeamNG.drive', 'mods');
  log(`Using fallback: ${fallback}`);
  return fallback;
}

// ── Security ─────────────────────────────────────────────────────────────────
function validateUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid URL format.'); }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed.');
  const h = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.some(a => h === a || h.endsWith('.' + a)))
    throw new Error(`Downloads from "${h}" are not supported. Use BeamNG.com, WorldOfMods, Modland, or GitHub.`);
  return parsed;
}

function safeExtractPath(base, entryName) {
  const resolved = path.resolve(base, entryName);
  if (!resolved.startsWith(path.resolve(base) + path.sep))
    throw new Error(`Path traversal attempt detected: ${entryName}`);
  return resolved;
}

// Sanitise mod name — no shell-special chars
function sanitizeModName(raw) {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'moneypit-mod';
}

// Parse optional #sha256=<64-hex> fragment for integrity check
function extractExpectedHash(rawUrl) {
  try {
    const frag = new URL(rawUrl).hash.replace(/^#/, '');
    const m = frag.split('&').map(s => s.split('=')).find(([k]) => k === 'sha256');
    if (!m) return null;
    const hex = (m[1] || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hex)) throw new Error('Malformed sha256 hash — must be 64 hex chars.');
    return hex;
  } catch (e) {
    if (e.message.startsWith('Malformed')) throw e;
    return null;
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', c => h.update(c))
      .on('end',  () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

function extractModName(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(p => p);
    return sanitizeModName(parts[parts.length - 1] || 'moneypit-mod');
  } catch { return 'moneypit-mod-' + Date.now(); }
}

// ── Download ─────────────────────────────────────────────────────────────────
async function downloadFile(url, dest, onProgress) {
  log(`Downloading: ${url}`);
  const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 120000, maxRedirects: 5 });

  const ct = (response.headers['content-type'] || '').toLowerCase();
  if (ct && !ct.includes('zip') && !ct.includes('octet-stream')) {
    response.data.destroy();
    throw new Error(`Unexpected content type: "${ct}". Only zip files are supported.`);
  }

  const total = parseInt(response.headers['content-length'] || '0', 10);
  if (total > MAX_DOWNLOAD_BYTES) { response.data.destroy(); throw new Error('File exceeds the 500 MB size limit.'); }

  let downloaded = 0;
  const hash = crypto.createHash('sha256');
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(dest);
    response.data.on('data', chunk => {
      downloaded += chunk.length;
      if (downloaded > MAX_DOWNLOAD_BYTES) { writer.destroy(); response.data.destroy(); reject(new Error('File exceeded 500 MB limit.')); return; }
      hash.update(chunk);
      if (total > 0 && onProgress) onProgress((downloaded / total) * 100);
    });
    response.data.pipe(writer);
    writer.on('finish', () => resolve(hash.digest('hex')));
    writer.on('error',  reject);
    response.data.on('error', reject);
  });
}

// ── Install ───────────────────────────────────────────────────────────────────
async function findModFiles(dir) {
  const r = [], entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...await findModFiles(full));
    else if (e.name.endsWith('.zip') || e.name.endsWith('.car')) r.push(full);
  }
  return r;
}

async function installExtractedMods(extractDir, modsFolder) {
  const modFiles = await findModFiles(extractDir);
  if (modFiles.length === 0) {
    for (const file of await fs.readdir(extractDir)) {
      const src = path.join(extractDir, file), stat = await fs.stat(src);
      if (stat.isDirectory() || file.endsWith('.zip') || file.endsWith('.car'))
        await fs.copy(src, safeExtractPath(modsFolder, file));
    }
  } else {
    for (const f of modFiles)
      await fs.copy(f, safeExtractPath(modsFolder, path.basename(f)));
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('select-beamng-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return (!r.canceled && r.filePaths.length) ? r.filePaths[0] : null;
});

ipcMain.handle('install-mod', async (event, { url, modsFolder }) => {
  let tmp = null;
  try {
    validateUrl(url);
    const expectedHash = extractExpectedHash(url);
    const name = extractModName(url);
    log(`URL install: ${url} → ${modsFolder}`);
    tmp = path.join(app.getPath('temp'), 'moneypit', Date.now() + '-' + name);
    await fs.ensureDir(tmp); await fs.ensureDir(modsFolder);

    event.sender.send('install-progress', { status: 'downloading', progress: 0 });
    const zip = path.join(tmp, 'mod.zip');
    const actualHash = await downloadFile(url, zip, p => event.sender.send('install-progress', { status: 'downloading', progress: p }));
    log(`SHA256: ${actualHash}`);
    if (expectedHash && expectedHash !== actualHash) {
      throw new Error(`Checksum mismatch. Expected ${expectedHash}, got ${actualHash}. File may be corrupt or tampered.`);
    }

    event.sender.send('install-progress', { status: 'extracting', progress: 50 });
    const ext = path.join(tmp, 'extracted');
    await fs.ensureDir(ext);
    await extractZip(zip, { dir: path.resolve(ext) });

    event.sender.send('install-progress', { status: 'installing', progress: 75 });
    await installExtractedMods(ext, modsFolder);

    log(`Installed: ${name}`);
    event.sender.send('install-progress', { status: 'completed', progress: 100 });

    // Track successful mod installation
    trackEvent('mod_installed', {
      modName: name,
      source: 'url',
      success: true
    });

    return { success: true, message: `Mod "${name}" installed successfully!` };
  } catch (err) {
    logError('URL install failed', err);

    // Track failed mod installation
    trackEvent('mod_install_failed', {
      source: 'url',
      error: err.message
    });

    return { success: false, message: err.message };
  } finally { if (tmp) fs.remove(tmp).catch(e => logError('Temp cleanup', e)); }
});

ipcMain.handle('install-mod-file', async (event, { filePath, modsFolder }) => {
  let tmp = null;
  try {
    const resolved = path.resolve(filePath);
    if (!resolved.endsWith('.zip'))     throw new Error('Only .zip mod files are supported.');
    if (!fs.existsSync(resolved))       throw new Error('File not found.');
    const stat = await fs.stat(resolved);
    if (stat.size > MAX_DOWNLOAD_BYTES) throw new Error('File exceeds the 500 MB size limit.');

    const name = sanitizeModName(path.basename(resolved, '.zip'));
    log(`File install: ${resolved} → ${modsFolder}`);
    log(`SHA256: ${await hashFile(resolved)}`);
    tmp = path.join(app.getPath('temp'), 'moneypit', Date.now() + '-' + name);
    await fs.ensureDir(tmp); await fs.ensureDir(modsFolder);

    event.sender.send('install-progress', { status: 'extracting', progress: 0 });
    const ext = path.join(tmp, 'extracted');
    await fs.ensureDir(ext);
    await extractZip(resolved, { dir: path.resolve(ext) });

    event.sender.send('install-progress', { status: 'installing', progress: 75 });
    await installExtractedMods(ext, modsFolder);

    log(`Installed from file: ${name}`);
    event.sender.send('install-progress', { status: 'completed', progress: 100 });

    // Track successful file-based mod installation
    trackEvent('mod_installed', {
      modName: name,
      source: 'file',
      success: true
    });

    return { success: true, message: `Mod "${name}" installed successfully!` };
  } catch (err) {
    logError('File install failed', err);

    // Track failed file-based mod installation
    trackEvent('mod_install_failed', {
      source: 'file',
      error: err.message
    });

    return { success: false, message: err.message };
  } finally { if (tmp) fs.remove(tmp).catch(e => logError('Temp cleanup', e)); }
});

ipcMain.handle('get-default-mods-folder', () => getBeamNGModsFolder());

ipcMain.handle('validate-mods-folder', async (event, folderPath) => {
  try { return { valid: await fs.pathExists(folderPath), exists: true }; }
  catch { return { valid: false, exists: false }; }
});

// ── Mod Scraping ──────────────────────────────────────────────────────────────
ipcMain.handle('fetch-top-mods', async (event, source = 'beamng') => {
  try {
    const allowedSources = ['beamng', 'worldofmods', 'modland'];
    if (!allowedSources.includes(source)) {
      throw new Error('Invalid mod source');
    }
    const result = await modScraper.fetchTopMods(source, 15);
    return { success: true, ...result };
  } catch (err) {
    logError('Top mods fetch failed', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('search-mods', async (event, query) => {
  try {
    if (!query || query.length < 2) {
      throw new Error('Search query too short');
    }
    // For now, just return empty array - could implement search
    return { success: true, mods: [] };
  } catch (err) {
    logError('Mod search failed', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-mod-in-browser', async (event, url) => {
  try {
    if (!url || !url.startsWith('http')) {
      throw new Error('Invalid URL');
    }
    // Validate URL is from allowed mod hosts
    const allowedHosts = ['beamng.com', 'worldofmods.com', 'modland.net', 'github.com'];
    const urlObj = new URL(url);
    const isAllowed = allowedHosts.some(host => urlObj.hostname.includes(host));
    if (!isAllowed) {
      throw new Error('URL not from approved mod source');
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    logError('Failed to open mod URL', err);
    return { success: false, error: err.message };
  }
});

// ── Analytics ────────────────────────────────────────────────────────────
ipcMain.on('track-event', (event, { name, props }) => {
  trackEvent(name, props);
});
