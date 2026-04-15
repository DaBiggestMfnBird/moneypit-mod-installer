/**
 * Renderer — MoneyPit Mod Installer
 * Integrates GameEngine, animals, UI interactions, and mod scraping
 */

let gameEngine = null;
let modsFolder = '';
let currentModSource = 'beamng';

// Error boundary
if (typeof window.electronAPI === 'undefined') {
  document.body.innerHTML = `
    <div style="font-family:monospace;color:#ff4757;padding:40px;background:#04040c;height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
      <div style="font-size:1.4rem;font-weight:700;">SYSTEM ERROR</div>
      <div style="color:#888;font-size:.9rem;">Preload bridge failed to initialize.<br>Try restarting the application.</div>
    </div>`;
  throw new Error('electronAPI not available');
}

// ── DOM References ──────────────────────────────────────────────────────────
const gameCanvas = document.getElementById('gameCanvas');
const animalGrid = document.getElementById('animalGrid');
const flyingToggle = document.getElementById('flyingToggle');
const modUrlInput = document.getElementById('modUrl');
const pasteBtn = document.getElementById('pasteBtn');
const installBtn = document.getElementById('installBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progressSection = document.getElementById('progressSection');
const resultSection = document.getElementById('resultSection');
const resultCard = document.getElementById('resultCard');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const resetBtn = document.getElementById('resetBtn');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const progressDetails = document.getElementById('progressDetails');
const modsCarousel = document.getElementById('modsCarousel');
const hudStat = document.getElementById('hudStat');
const guideBtn = document.getElementById('guideBtn');
const guideModal = document.getElementById('guideModal');
const closeGuideBtn = document.getElementById('closeGuideBtn');

// ── Initialization ──────────────────────────────────────────────────────────
async function init() {
  try {
    // Get default mods folder
    const defaultFolder = await window.electronAPI.getDefaultModsFolder();
    modsFolder = defaultFolder;
    console.log('✓ Mods folder:', modsFolder);

    // Initialize game engine
    const { GameEngine } = window;
    gameEngine = new GameEngine(gameCanvas, {
      getPath: (type) => type === 'userData' ? '' : ''
    });
    await gameEngine.init();

    // Setup UI
    setupEventListeners();
    setupAnimalGrid();
    loadTopMods();
    setupUpdateListeners();
    pulseHud();

    console.log('✓ Renderer initialized');
  } catch (err) {
    console.error('Init failed:', err);
    showNotification('Initialization failed: ' + err.message, 'error');
  }
}

// ── Animal Grid Setup ───────────────────────────────────────────────────────
function setupAnimalGrid() {
  if (!gameEngine || !gameEngine.allAnimalsData) return;

  const animals = gameEngine.allAnimalsData;
  animalGrid.innerHTML = '';

  animals.forEach(animal => {
    const btn = document.createElement('button');
    btn.className = 'animal-btn';
    btn.title = animal.name;
    btn.dataset.animal = animal.id;
    btn.textContent = animal.emoji;

    btn.addEventListener('click', () => {
      selectAnimal(animal.id, btn);
    });

    animalGrid.appendChild(btn);
  });

  // Select first animal
  const firstBtn = animalGrid.querySelector('.animal-btn');
  if (firstBtn) {
    selectAnimal(animals[0].id, firstBtn);
  }
}

function selectAnimal(animalId, buttonElement) {
  // Update visual state
  document.querySelectorAll('.animal-btn').forEach(b => b.classList.remove('active'));
  buttonElement.classList.add('active');

  // Update game engine
  gameEngine.setSelectedAnimal(animalId);
  gameEngine.reactToEvent('mod-selected', 'happy');

  const animal = gameEngine.allAnimalsData.find(a => a.id === animalId);
  if (animal) {
    console.log('Selected:', animal.name);
    // Track animal selection
    window.electronAPI.trackEvent('animal_selected', { animalId, animalName: animal.name });
  }
}

// ── Top Mods ────────────────────────────────────────────────────────────────
async function loadTopMods() {
  try {
    window.electronAPI.trackEvent('mods_carousel_loading', { source: currentModSource });
    const result = await window.electronAPI.fetchTopMods(currentModSource);
    if (result.success) {
      window.electronAPI.trackEvent('mods_carousel_loaded', {
        source: currentModSource,
        modCount: result.mods.length,
        cached: result.cached
      });
      renderModsCarousel(result.mods);
    }
  } catch (err) {
    console.error('Failed to load top mods:', err);
    window.electronAPI.trackEvent('mods_carousel_failed', {
      source: currentModSource,
      error: err.message
    });
  }
}

function renderModsCarousel(mods) {
  modsCarousel.innerHTML = '';

  if (!mods || mods.length === 0) {
    modsCarousel.innerHTML = '<div class="carousel-loading">No mods found</div>';
    return;
  }

  mods.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    card.dataset.modUrl = mod.url;
    card.innerHTML = `
      <div class="mod-card-name">${escapeHtml(mod.name)}</div>
      <div class="mod-card-meta">${mod.downloads.toLocaleString()} DL</div>
    `;

    // Click opens mod page in user's browser
    card.addEventListener('click', async () => {
      if (mod.url && mod.url.startsWith('http')) {
        try {
          // Open in default browser via IPC
          await window.electronAPI.openModInBrowser(mod.url);
          showNotification(`📖 Opened "${escapeHtml(mod.name)}" in your browser\n\nDownload the .zip file, then drag it here to install`, 'info');
        } catch (err) {
          showNotification('Could not open browser', 'error');
        }
      } else {
        showNotification('Invalid mod URL', 'error');
      }
    });

    modsCarousel.appendChild(card);
  });
}

// ── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Paste button
  pasteBtn.addEventListener('click', async () => {
    try {
      modUrlInput.value = await navigator.clipboard.readText();
      modUrlInput.focus();
    } catch (err) {
      console.error('Clipboard error:', err);
    }
  });

  // Install button
  installBtn.addEventListener('click', handleUrlInstall);

  // URL input validation
  modUrlInput.addEventListener('input', () => {
    const url = modUrlInput.value.trim();
    modUrlInput.style.borderColor = url
      ? (isValidUrl(url) ? 'var(--success)' : 'var(--error)')
      : 'var(--border-color)';
  });

  // Enter to install
  modUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && modUrlInput.value.trim()) {
      handleUrlInstall();
    }
  });

  // Drag & drop
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('active');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file) handleFileInstall(file);
  });

  // File input
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileInstall(fileInput.files[0]);
  });

  // Flying toggle
  flyingToggle.addEventListener('change', (e) => {
    gameEngine.toggleFlying(e.target.checked);
    window.electronAPI.trackEvent('flying_toggled', { enabled: e.target.checked });
  });

  // Reset button
  resetBtn.addEventListener('click', resetUI);

  // Guide modal
  guideBtn.addEventListener('click', () => {
    guideModal.style.display = 'flex';
    window.electronAPI.trackEvent('guide_opened', {});
  });

  closeGuideBtn.addEventListener('click', () => {
    guideModal.style.display = 'none';
  });

  // Close guide when clicking outside modal
  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) {
      guideModal.style.display = 'none';
    }
  });

  // Close guide with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && guideModal.style.display !== 'none') {
      guideModal.style.display = 'none';
    }
  });
}

// ── Install Handlers ────────────────────────────────────────────────────────
async function handleUrlInstall() {
  const url = modUrlInput.value.trim();
  if (!url) {
    showNotification('Paste a mod URL first!', 'error');
    modUrlInput.focus();
    return;
  }
  if (!isValidUrl(url)) {
    showNotification('That URL looks wrong.', 'error');
    return;
  }
  if (!modsFolder) {
    showNotification('Select your BeamNG mods folder first!', 'error');
    return;
  }

  setInstalling(true);
  progressSection.style.display = 'block';
  resultSection.style.display = 'none';
  gameEngine.reactToEvent('install-start', 'working');
  window.electronAPI.trackEvent('install_started', { source: 'url' });

  // Setup progress listener
  window.electronAPI.onInstallProgress(updateProgress);

  try {
    const result = await window.electronAPI.installMod({ url, modsFolder });
    if (result.success) {
      gameEngine.reactToEvent('install-end', 'celebrating');
      showSuccess(result.message);
    } else {
      showError(result.message);
      window.electronAPI.trackEvent('install_failed', { source: 'url', error: result.message });
    }
  } catch (err) {
    showError(err.message);
    window.electronAPI.trackEvent('install_error', { source: 'url', error: err.message });
  } finally {
    setInstalling(false);
  }
}

async function handleFileInstall(file) {
  if (!file.name.endsWith('.zip')) {
    showNotification('Only .zip mod files are supported!', 'error');
    return;
  }
  if (!modsFolder) {
    showNotification('Select your BeamNG mods folder first!', 'error');
    return;
  }

  const filePath = file.path;
  if (!filePath) {
    showNotification('Could not read file path.', 'error');
    return;
  }

  setInstalling(true);
  progressSection.style.display = 'block';
  resultSection.style.display = 'none';
  gameEngine.reactToEvent('install-start', 'working');
  window.electronAPI.trackEvent('install_started', { source: 'file', fileName: file.name });

  window.electronAPI.onInstallProgress(updateProgress);

  try {
    const result = await window.electronAPI.installModFile({ filePath, modsFolder });
    if (result.success) {
      gameEngine.reactToEvent('install-end', 'celebrating');
      showSuccess(result.message);
    } else {
      showError(result.message);
      window.electronAPI.trackEvent('install_failed', { source: 'file', error: result.message });
    }
  } catch (err) {
    showError(err.message);
    window.electronAPI.trackEvent('install_error', { source: 'file', error: err.message });
  } finally {
    setInstalling(false);
    fileInput.value = '';
  }
}

// ── Progress & Results ──────────────────────────────────────────────────────
function updateProgress({ status, progress }) {
  progressFill.style.width = `${Math.min(progress, 100)}%`;
  progressPercent.textContent = `${Math.round(progress)}%`;

  const map = {
    downloading: ['Downloading...', `Fetching mod files (${Math.round(progress)}%)`],
    extracting: ['Extracting...', 'Unpacking mod files'],
    installing: ['Installing...', 'Copying to mods folder'],
    completed: ['Complete!', 'Mod installed successfully']
  };

  const [st, det] = map[status] || ['Working...', ''];
  progressStatus.textContent = st;
  progressDetails.textContent = det;
}

function showSuccess(message) {
  resultTitle.textContent = 'Installation Complete!';
  resultMessage.textContent = message || 'Your mod is ready to use in BeamNG.drive';
  resultCard.className = 'result-card success';
  resultSection.style.display = 'block';
  progressSection.style.display = 'none';
}

function showError(message) {
  resultTitle.textContent = 'Installation Failed';
  resultMessage.textContent = message || 'Something went wrong. Please try again.';
  resultCard.className = 'result-card error';
  resultSection.style.display = 'block';
  progressSection.style.display = 'none';
}

function resetUI() {
  modUrlInput.value = '';
  modUrlInput.style.borderColor = 'var(--border-color)';
  progressSection.style.display = 'none';
  resultSection.style.display = 'none';
  setInstalling(false);
  progressFill.style.width = '0%';
  progressPercent.textContent = '0%';
  gameEngine.reactToEvent('install-end', 'happy');
}

function setInstalling(yes) {
  installBtn.disabled = yes;
  installBtn.style.opacity = yes ? '0.45' : '1';
  dropZone.style.pointerEvents = yes ? 'none' : '';
  dropZone.style.opacity = yes ? '0.4' : '1';
}

// ── Updates ─────────────────────────────────────────────────────────────────
function setupUpdateListeners() {
  window.electronAPI.onUpdateAvailable(({ version }) => {
    showNotification(`Update v${version} available — click to download`, 'info', () => {
      window.electronAPI.installUpdate();
    });
  });

  window.electronAPI.onUpdateDownloaded(() => {
    showNotification('Update ready — click to restart and install', 'info', () => {
      window.electronAPI.restartAndInstall();
    });
  });
}

// ── HUD ─────────────────────────────────────────────────────────────────────
function pulseHud() {
  const msgs = ['SYS ONLINE', 'MODS READY', 'PIT CREW ACTIVE', 'ALL CLEAR'];
  let i = 0;
  setInterval(() => {
    if (!hudStat) return;
    hudStat.style.opacity = '0';
    setTimeout(() => {
      hudStat.textContent = msgs[i++ % msgs.length];
      hudStat.style.opacity = '1';
    }, 300);
  }, 4000);
}

// ── Notifications ───────────────────────────────────────────────────────────
function showNotification(message, type = 'info', onClick) {
  document.querySelector('.mp-notif')?.remove();
  const n = document.createElement('div');
  n.className = 'mp-notif';
  n.innerHTML = `<span>${type === 'error' ? '⚠' : '↑'}</span><span>${message}</span>`;
  Object.assign(n.style, {
    position: 'fixed',
    top: '18px',
    right: '18px',
    padding: '12px 20px',
    background: type === 'error' ? 'rgba(255,71,87,0.92)' : 'rgba(0,180,216,0.92)',
    color: '#fff',
    borderRadius: '2px',
    fontFamily: "'Rajdhani',sans-serif",
    fontWeight: '700',
    fontSize: '.95rem',
    zIndex: '10000',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    animation: 'mpIn .22s ease',
    cursor: onClick ? 'pointer' : 'default',
    whiteSpace: 'pre-wrap',
    maxWidth: '400px',
    lineHeight: '1.3'
  });

  if (onClick) n.addEventListener('click', () => {
    n.remove();
    onClick();
  });

  document.body.appendChild(n);
  setTimeout(
    () => {
      n.style.animation = 'mpOut .22s ease forwards';
      setTimeout(() => n.remove(), 240);
    },
    4000
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function isValidUrl(s) {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ── Start ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
