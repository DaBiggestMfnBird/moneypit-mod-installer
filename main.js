const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const extractZip = require('extract-zip');
const { URL } = require('url');

// Max download size: 500 MB
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

// Allowed HTTPS origins for URL installs
const ALLOWED_HOSTS = [
  'beamng.com',
  'www.beamng.com',
  'worldofmods.com',
  'www.worldofmods.com',
  'modland.net',
  'www.modland.net',
  'github.com',
  'objects.githubusercontent.com',
  'raw.githubusercontent.com',
  'github-releases.githubusercontent.com',
];

let mainWindow;
let splashWindow;

// ---- Splash screen ----
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    backgroundColor: '#05050d',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splashWindow.loadFile('splash.html');
  splashWindow.on('closed', () => { splashWindow = null; });
}

// ---- Main window ----
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#05050d',
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  // Show main window after splash (2 seconds gives boot text time to finish)
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
      }
      mainWindow.show();
    }, 2000);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createSplash();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- Dynamically find latest BeamNG version folder ----
function getBeamNGModsFolder() {
  const bases = [
    process.env.LOCALAPPDATA || '',
    process.env.APPDATA || '',
    process.env.HOME || '',
  ];

  for (const base of bases) {
    if (!base) continue;
    const beamDir = path.join(base, 'BeamNG.drive');
    if (!fs.existsSync(beamDir)) continue;

    try {
      const versions = fs.readdirSync(beamDir)
        .filter(d => /^\d+\.\d+$/.test(d))
        .sort((a, b) => {
          const [aMaj, aMin] = a.split('.').map(Number);
          const [bMaj, bMin] = b.split('.').map(Number);
          return bMaj !== aMaj ? bMaj - aMaj : bMin - aMin;
        });

      if (versions.length > 0) {
        return path.join(beamDir, versions[0], 'mods');
      }
    } catch {
      // try next base
    }
  }

  return path.join(process.env.LOCALAPPDATA || process.env.HOME || '', 'BeamNG.drive', 'mods');
}

// ---- URL security validation ----
function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
  if (!allowed) {
    throw new Error(`Downloads from "${hostname}" are not supported. Use BeamNG.com, WorldOfMods, Modland, or GitHub.`);
  }

  return parsed;
}

// ---- Path traversal guard ----
function safeExtractPath(base, entryName) {
  const resolved = path.resolve(base, entryName);
  if (!resolved.startsWith(path.resolve(base) + path.sep)) {
    throw new Error(`Path traversal attempt detected: ${entryName}`);
  }
  return resolved;
}

// ---- Extract mod name from URL ----
function extractModName(url) {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(p => p);
    return parts[parts.length - 1] || 'moneypit-mod';
  } catch {
    return 'moneypit-mod-' + Date.now();
  }
}

// ---- Download with progress and size cap ----
async function downloadFile(url, dest, onProgress) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 120000,
    maxRedirects: 5,
  });

  const contentType = (response.headers['content-type'] || '').toLowerCase();
  const isAcceptable = contentType.includes('zip')
    || contentType.includes('octet-stream')
    || contentType === '';
  if (!isAcceptable) {
    response.data.destroy();
    throw new Error(`Unexpected content type: "${contentType}". Only zip files are supported.`);
  }

  const totalSize = parseInt(response.headers['content-length'] || '0', 10);
  if (totalSize > MAX_DOWNLOAD_BYTES) {
    response.data.destroy();
    throw new Error('File exceeds the 500 MB size limit.');
  }

  let downloadedSize = 0;

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(dest);

    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (downloadedSize > MAX_DOWNLOAD_BYTES) {
        writer.destroy();
        response.data.destroy();
        reject(new Error('File exceeded 500 MB size limit during download.'));
        return;
      }
      if (totalSize > 0 && onProgress) {
        onProgress((downloadedSize / totalSize) * 100);
      }
    });

    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });
}

// ---- Copy mod files from extracted dir to mods folder (with path guard) ----
async function installExtractedMods(extractDir, modsFolder) {
  const modFiles = await findModFiles(extractDir);

  if (modFiles.length === 0) {
    const files = await fs.readdir(extractDir);
    for (const file of files) {
      const srcPath = path.join(extractDir, file);
      const stat = await fs.stat(srcPath);
      if (stat.isDirectory()) {
        await fs.copy(srcPath, safeExtractPath(modsFolder, file));
      } else if (file.endsWith('.zip') || file.endsWith('.car')) {
        await fs.copy(srcPath, safeExtractPath(modsFolder, file));
      }
    }
  } else {
    for (const modFile of modFiles) {
      await fs.copy(modFile, safeExtractPath(modsFolder, path.basename(modFile)));
    }
  }
}

async function findModFiles(dir) {
  const modFiles = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      modFiles.push(...await findModFiles(fullPath));
    } else if (entry.name.endsWith('.zip') || entry.name.endsWith('.car')) {
      modFiles.push(fullPath);
    }
  }
  return modFiles;
}

// ---- IPC: select mods folder ----
ipcMain.handle('select-beamng-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

// ---- IPC: install from URL ----
ipcMain.handle('install-mod', async (event, { url, modsFolder }) => {
  let tempDir = null;
  try {
    validateUrl(url);

    const modName = extractModName(url);
    tempDir = path.join(app.getPath('temp'), 'moneypit-mod-installer', Date.now() + '-' + modName);

    await fs.ensureDir(tempDir);
    await fs.ensureDir(modsFolder);

    event.sender.send('install-progress', { status: 'downloading', progress: 0 });

    const zipPath = path.join(tempDir, 'mod.zip');
    await downloadFile(url, zipPath, (progress) => {
      event.sender.send('install-progress', { status: 'downloading', progress });
    });

    event.sender.send('install-progress', { status: 'extracting', progress: 50 });

    const extractDir = path.join(tempDir, 'extracted');
    await fs.ensureDir(extractDir);
    await extractZip(zipPath, { dir: path.resolve(extractDir) });

    event.sender.send('install-progress', { status: 'installing', progress: 75 });

    await installExtractedMods(extractDir, modsFolder);

    event.sender.send('install-progress', { status: 'completed', progress: 100 });
    return { success: true, message: `Mod "${modName}" installed successfully!` };

  } catch (error) {
    console.error('URL install error:', error);
    return { success: false, message: error.message };
  } finally {
    if (tempDir) fs.remove(tempDir).catch(() => {});
  }
});

// ---- IPC: install from local .zip file (drag & drop) ----
ipcMain.handle('install-mod-file', async (event, { filePath, modsFolder }) => {
  let tempDir = null;
  try {
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.endsWith('.zip')) throw new Error('Only .zip mod files are supported.');
    if (!fs.existsSync(resolvedPath)) throw new Error('File not found.');

    const stat = await fs.stat(resolvedPath);
    if (stat.size > MAX_DOWNLOAD_BYTES) throw new Error('File exceeds the 500 MB size limit.');

    const modName = path.basename(resolvedPath, '.zip');
    tempDir = path.join(app.getPath('temp'), 'moneypit-mod-installer', Date.now() + '-' + modName);

    await fs.ensureDir(tempDir);
    await fs.ensureDir(modsFolder);

    event.sender.send('install-progress', { status: 'extracting', progress: 0 });

    const extractDir = path.join(tempDir, 'extracted');
    await fs.ensureDir(extractDir);
    await extractZip(resolvedPath, { dir: path.resolve(extractDir) });

    event.sender.send('install-progress', { status: 'installing', progress: 75 });

    await installExtractedMods(extractDir, modsFolder);

    event.sender.send('install-progress', { status: 'completed', progress: 100 });
    return { success: true, message: `Mod "${modName}" installed successfully!` };

  } catch (error) {
    console.error('File install error:', error);
    return { success: false, message: error.message };
  } finally {
    if (tempDir) fs.remove(tempDir).catch(() => {});
  }
});

// ---- IPC: default mods folder ----
ipcMain.handle('get-default-mods-folder', () => getBeamNGModsFolder());

// ---- IPC: validate mods folder ----
ipcMain.handle('validate-mods-folder', async (event, folderPath) => {
  try {
    const exists = await fs.pathExists(folderPath);
    return { valid: exists, exists };
  } catch {
    return { valid: false, exists: false };
  }
});
