// #2 — Error boundary: guard against preload failure
if (typeof window.electronAPI === 'undefined') {
  document.body.innerHTML = `
    <div style="font-family:monospace;color:#ff4757;padding:40px;background:#04040c;height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
      <div style="font-size:1.4rem;font-weight:700;">SYSTEM ERROR</div>
      <div style="color:#888;font-size:.9rem;">Preload bridge failed to initialize.<br>Try restarting the application.</div>
    </div>`;
  throw new Error('electronAPI not available — preload failed');
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const modUrlInput    = document.getElementById('modUrl');
const pasteBtn       = document.getElementById('pasteBtn');
const modsFolderInput= document.getElementById('modsFolder');
const browseBtn      = document.getElementById('browseBtn');
const installBtn     = document.getElementById('installBtn');
const folderStatus   = document.getElementById('folderStatus');
const progressSection= document.getElementById('progressSection');
const progressFill   = document.getElementById('progressFill');
const progressPercent= document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const progressDetails= document.getElementById('progressDetails');
const resultSection  = document.getElementById('resultSection');
const resultCard     = document.getElementById('resultCard');
const resultTitle    = document.getElementById('resultTitle');
const resultMessage  = document.getElementById('resultMessage');
const resetBtn       = document.getElementById('resetBtn');
const dropZone       = document.getElementById('dropZone');
const dropOverlay    = document.getElementById('dropOverlay');
const browseFileBtn  = document.getElementById('browseFileBtn');
const fileInput      = document.getElementById('fileInput');
const hudStat        = document.getElementById('hudStat');

let modsFolder = '';

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const defaultFolder = await window.electronAPI.getDefaultModsFolder();
  modsFolderInput.value = defaultFolder;
  modsFolder            = defaultFolder;
  validateFolder(defaultFolder);
  setupEventListeners();
  setupUpdateListeners();
  pulseHud();
}

// ── HUD readout cycling ───────────────────────────────────────────────────────
function pulseHud() {
  const msgs = ['SYS ONLINE', 'MODS READY', 'PIT CREW ACTIVE', 'ALL CLEAR'];
  let i = 0;
  setInterval(() => {
    if (!hudStat) return;
    hudStat.style.opacity = '0';
    setTimeout(() => {
      hudStat.textContent  = msgs[i++ % msgs.length];
      hudStat.style.opacity = '1';
    }, 300);
  }, 4000);
}

// ── Auto-updater UI ───────────────────────────────────────────────────────────
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

// ── Event listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
  pasteBtn.addEventListener('click', async () => {
    try {
      modUrlInput.value = await navigator.clipboard.readText();
      modUrlInput.focus();
    } catch {}
  });

  browseBtn.addEventListener('click', async () => {
    const selected = await window.electronAPI.selectBeamngFolder();
    if (selected) { modsFolderInput.value = selected; modsFolder = selected; validateFolder(selected); }
  });

  installBtn.addEventListener('click', handleUrlInstall);
  resetBtn.addEventListener('click', resetUI);

  modUrlInput.addEventListener('input', () => {
    const url = modUrlInput.value.trim();
    modUrlInput.style.borderColor = url
      ? (isValidUrl(url) ? 'var(--success)' : 'var(--error)')
      : 'var(--border)';
  });
  modUrlInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && modUrlInput.value.trim()) handleUrlInstall();
  });

  // Drag & drop
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop',     e => e.preventDefault());

  dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropOverlay.classList.add('active'); });
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropOverlay.classList.add('active'); });
  dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropOverlay.classList.remove('active'); });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    // #5: guard file.path (Electron-specific) with fallback
    const file = e.dataTransfer.files[0];
    if (file) handleFileInstall(file);
  });

  browseFileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFileInstall(fileInput.files[0]); });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isValidUrl(s) { try { new URL(s); return true; } catch { return false; } }

async function validateFolder(p) {
  const r = await window.electronAPI.validateModsFolder(p);
  if (r.valid) {
    folderStatus.innerHTML = `<span class="status-dot"></span><span class="status-text">Ready to install</span>`;
    folderStatus.style.borderColor = 'rgba(0,255,136,0.3)';
    folderStatus.style.background  = 'rgba(0,255,136,0.08)';
  } else {
    folderStatus.innerHTML = `<span class="status-dot" style="background:var(--error);animation:none;"></span><span class="status-text" style="color:var(--error);">Folder not found</span>`;
    folderStatus.style.borderColor = 'rgba(255,71,87,0.3)';
    folderStatus.style.background  = 'rgba(255,71,87,0.06)';
  }
}

function setInstalling(yes) {
  installBtn.disabled            = yes;
  installBtn.style.opacity       = yes ? '0.45' : '1';
  browseFileBtn.disabled         = yes;
  dropZone.style.pointerEvents   = yes ? 'none'  : '';
  dropZone.style.opacity         = yes ? '0.4'   : '1';
}

// ── Install from URL ──────────────────────────────────────────────────────────
async function handleUrlInstall() {
  const url = modUrlInput.value.trim();
  if (!url)            { showNotification('Paste a mod URL first!', 'error'); modUrlInput.focus(); return; }
  if (!isValidUrl(url)){ showNotification('That URL looks wrong.', 'error'); return; }
  if (!modsFolder)     { showNotification('Select your BeamNG mods folder first!', 'error'); return; }

  setInstalling(true);
  progressSection.style.display = 'block';
  resultSection.style.display   = 'none';
  window.electronAPI.onInstallProgress(updateProgress);

  try {
    const result = await window.electronAPI.installMod({ url, modsFolder });
    result.success ? showSuccess(result.message) : showError(result.message);
  } catch (e) { showError(e.message); }
  finally     { setInstalling(false); }
}

// ── Install from file ─────────────────────────────────────────────────────────
async function handleFileInstall(file) {
  if (!file.name.endsWith('.zip')) { showNotification('Only .zip mod files are supported!', 'error'); return; }
  if (!modsFolder)                 { showNotification('Select your BeamNG mods folder first!', 'error'); return; }

  // #5: file.path is Electron-only. Guard with a clear message if absent.
  const filePath = file.path;
  if (!filePath) { showNotification('Could not read file path. Try Browse instead.', 'error'); return; }

  setInstalling(true);
  progressSection.style.display = 'block';
  resultSection.style.display   = 'none';
  window.electronAPI.onInstallProgress(updateProgress);

  try {
    const result = await window.electronAPI.installModFile({ filePath, modsFolder });
    result.success ? showSuccess(result.message) : showError(result.message);
  } catch (e) { showError(e.message); }
  finally     { setInstalling(false); fileInput.value = ''; }
}

// ── Progress / Result ─────────────────────────────────────────────────────────
function updateProgress({ status, progress }) {
  progressFill.style.width    = `${Math.min(progress, 100)}%`;
  progressPercent.textContent = `${Math.round(progress)}%`;
  const map = {
    downloading: ['Downloading...', `Fetching mod files (${Math.round(progress)}%)`],
    extracting:  ['Extracting...',  'Unpacking mod files'],
    installing:  ['Installing...',  'Copying to mods folder'],
    completed:   ['Complete!',      'Mod installed successfully'],
  };
  const [st, det] = map[status] || ['Working...', ''];
  progressStatus.textContent  = st;
  progressDetails.textContent = det;
}

function showSuccess(message) {
  resultTitle.textContent = 'Installation Complete!';
  resultMessage.textContent = message || 'Your mod is ready to use in BeamNG.drive';
  resultCard.className      = 'result-card success';
  resultCard.style.borderColor = resultCard.style.boxShadow = '';
  resultSection.style.display  = 'block';
  progressSection.style.display = 'none';
}

function showError(message) {
  resultTitle.textContent   = 'Installation Failed';
  resultMessage.textContent = message || 'Something went wrong. Please try again.';
  resultCard.className      = 'result-card error';
  resultSection.style.display  = 'block';
  progressSection.style.display = 'none';
}

function resetUI() {
  modUrlInput.value             = '';
  modUrlInput.style.borderColor = 'var(--border)';
  progressSection.style.display = resultSection.style.display = 'none';
  setInstalling(false);
  progressFill.style.width    = '0%';
  progressPercent.textContent = '0%';
}

// ── Notification ──────────────────────────────────────────────────────────────
function showNotification(message, type = 'info', onClick) {
  document.querySelector('.mp-notif')?.remove();
  const n = document.createElement('div');
  n.className = 'mp-notif';
  n.innerHTML = `<span>${type === 'error' ? '⚠' : '↑'}</span><span>${message}</span>`;
  Object.assign(n.style, {
    position: 'fixed', top: '18px', right: '18px',
    padding: '12px 20px',
    background: type === 'error' ? 'rgba(255,71,87,0.92)' : 'rgba(0,180,216,0.92)',
    color: '#fff', borderRadius: '2px',
    fontFamily: "'Rajdhani',sans-serif", fontWeight: '700', fontSize: '.95rem',
    zIndex: '10000', display: 'flex', gap: '10px', alignItems: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    animation: 'mpIn .22s ease', cursor: onClick ? 'pointer' : 'default',
  });
  if (onClick) n.addEventListener('click', () => { n.remove(); onClick(); });
  document.body.appendChild(n);
  setTimeout(() => { n.style.animation = 'mpOut .22s ease forwards'; setTimeout(() => n.remove(), 240); }, 4000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes mpIn  { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes mpOut { from{transform:translateX(0);opacity:1} to{transform:translateX(110%);opacity:0} }
`;
document.head.appendChild(style);

init();
