// DOM Elements
const modUrlInput = document.getElementById('modUrl');
const pasteBtn = document.getElementById('pasteBtn');
const modsFolderInput = document.getElementById('modsFolder');
const browseBtn = document.getElementById('browseBtn');
const installBtn = document.getElementById('installBtn');
const folderStatus = document.getElementById('folderStatus');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const progressDetails = document.getElementById('progressDetails');
const resultSection = document.getElementById('resultSection');
const resultCard = document.getElementById('resultCard');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const resetBtn = document.getElementById('resetBtn');

// Drag & drop
const dropZone = document.getElementById('dropZone');
const dropOverlay = document.getElementById('dropOverlay');
const browseFileBtn = document.getElementById('browseFileBtn');
const fileInput = document.getElementById('fileInput');

let modsFolder = '';

async function init() {
  const defaultFolder = await window.electronAPI.getDefaultModsFolder();
  modsFolderInput.value = defaultFolder;
  modsFolder = defaultFolder;
  validateFolder(defaultFolder);
  setupEventListeners();
}

function setupEventListeners() {
  // Paste URL
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      modUrlInput.value = text;
      modUrlInput.focus();
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  });

  // Browse mods folder
  browseBtn.addEventListener('click', async () => {
    const selected = await window.electronAPI.selectBeamngFolder();
    if (selected) {
      modsFolderInput.value = selected;
      modsFolder = selected;
      validateFolder(selected);
    }
  });

  // URL install button
  installBtn.addEventListener('click', handleUrlInstall);

  // Reset
  resetBtn.addEventListener('click', resetUI);

  // URL validation highlight
  modUrlInput.addEventListener('input', () => {
    const url = modUrlInput.value.trim();
    modUrlInput.style.borderColor = url
      ? (isValidUrl(url) ? 'var(--success)' : 'var(--error)')
      : 'var(--border)';
  });

  modUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && modUrlInput.value.trim()) handleUrlInstall();
  });

  // --- Drag & Drop ---
  // Prevent browser default for drag events on the whole window
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('active');
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('active');
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropOverlay.classList.remove('active');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file) handleFileInstall(file);
  });

  // Browse local file button
  browseFileBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileInstall(fileInput.files[0]);
  });
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function validateFolder(folderPath) {
  const result = await window.electronAPI.validateModsFolder(folderPath);

  if (result.valid) {
    folderStatus.innerHTML = `
      <span class="status-dot"></span>
      <span class="status-text">Ready to install</span>
    `;
    folderStatus.style.borderColor = 'rgba(0, 255, 136, 0.3)';
    folderStatus.style.background = 'rgba(0, 255, 136, 0.1)';
  } else {
    folderStatus.innerHTML = `
      <span class="status-dot" style="background: var(--error); animation: none;"></span>
      <span class="status-text" style="color: var(--error);">Folder not found</span>
    `;
    folderStatus.style.borderColor = 'rgba(255, 71, 87, 0.3)';
    folderStatus.style.background = 'rgba(255, 71, 87, 0.1)';
  }
}

function setInstalling(yes) {
  installBtn.disabled = yes;
  installBtn.style.opacity = yes ? '0.5' : '1';
  browseFileBtn.disabled = yes;
  dropZone.style.pointerEvents = yes ? 'none' : '';
  dropZone.style.opacity = yes ? '0.5' : '1';
}

async function handleUrlInstall() {
  const url = modUrlInput.value.trim();

  if (!url) {
    showNotification('Please paste a mod URL first!', 'error');
    modUrlInput.focus();
    return;
  }

  if (!isValidUrl(url)) {
    showNotification('Please enter a valid URL!', 'error');
    return;
  }

  if (!modsFolder) {
    showNotification('Please select your BeamNG mods folder!', 'error');
    return;
  }

  setInstalling(true);
  progressSection.style.display = 'block';
  resultSection.style.display = 'none';

  window.electronAPI.onInstallProgress(updateProgress);

  try {
    const result = await window.electronAPI.installMod({ url, modsFolder });
    result.success ? showSuccess(result.message) : showError(result.message);
  } catch (error) {
    showError(error.message);
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
    showNotification('Please select your BeamNG mods folder!', 'error');
    return;
  }

  setInstalling(true);
  progressSection.style.display = 'block';
  resultSection.style.display = 'none';

  window.electronAPI.onInstallProgress(updateProgress);

  try {
    const result = await window.electronAPI.installModFile({ filePath: file.path, modsFolder });
    result.success ? showSuccess(result.message) : showError(result.message);
  } catch (error) {
    showError(error.message);
  } finally {
    setInstalling(false);
    fileInput.value = '';
  }
}

function updateProgress(data) {
  const { status, progress } = data;
  progressFill.style.width = `${Math.min(progress, 100)}%`;
  progressPercent.textContent = `${Math.round(progress)}%`;

  switch (status) {
    case 'downloading':
      progressStatus.textContent = 'Downloading...';
      progressDetails.textContent = `Fetching mod files (${Math.round(progress)}%)`;
      break;
    case 'extracting':
      progressStatus.textContent = 'Extracting...';
      progressDetails.textContent = 'Unpacking mod files';
      break;
    case 'installing':
      progressStatus.textContent = 'Installing...';
      progressDetails.textContent = 'Copying to mods folder';
      break;
    case 'completed':
      progressStatus.textContent = 'Complete!';
      progressDetails.textContent = 'Mod installed successfully';
      break;
  }
}

function showSuccess(message) {
  resultTitle.textContent = 'Installation Complete!';
  resultMessage.textContent = message || 'Your mod is ready to use in BeamNG.drive';
  resultCard.className = 'result-card success';
  resultCard.style.borderColor = '';
  resultCard.style.boxShadow = '';
  resultSection.style.display = 'block';
  progressSection.style.display = 'none';
}

function showError(message) {
  resultTitle.textContent = 'Installation Failed';
  resultMessage.textContent = message || 'Something went wrong. Please try again.';
  resultCard.className = 'result-card error';
  resultCard.style.borderColor = 'var(--error)';
  resultCard.style.boxShadow = '0 0 40px rgba(255, 71, 87, 0.2)';
  resultSection.style.display = 'block';
  progressSection.style.display = 'none';
}

function resetUI() {
  modUrlInput.value = '';
  modUrlInput.style.borderColor = 'var(--border)';
  progressSection.style.display = 'none';
  resultSection.style.display = 'none';
  setInstalling(false);
  progressFill.style.width = '0%';
  progressPercent.textContent = '0%';
}

function showNotification(message, type = 'info') {
  const existing = document.querySelector('.mp-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'mp-notification';
  notification.innerHTML = `
    <span>${type === 'error' ? '⚠' : 'i'}</span>
    <span>${message}</span>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 14px 22px;
    background: ${type === 'error' ? 'rgba(255,71,87,0.92)' : 'rgba(255,107,53,0.92)'};
    color: white;
    border-radius: 10px;
    font-family: 'Rajdhani', sans-serif;
    font-weight: 600;
    font-size: 1rem;
    z-index: 10000;
    display: flex;
    gap: 10px;
    align-items: center;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    animation: mpSlideIn 0.25s ease;
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'mpSlideOut 0.25s ease forwards';
    setTimeout(() => notification.remove(), 260);
  }, 3000);
}

// Notification animations
const style = document.createElement('style');
style.textContent = `
  @keyframes mpSlideIn {
    from { transform: translateX(110%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes mpSlideOut {
    from { transform: translateX(0);    opacity: 1; }
    to   { transform: translateX(110%); opacity: 0; }
  }
`;
document.head.appendChild(style);

init();
