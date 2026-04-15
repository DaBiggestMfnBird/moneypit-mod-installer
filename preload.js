const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectBeamngFolder:  ()     => ipcRenderer.invoke('select-beamng-folder'),
  installMod:          data   => ipcRenderer.invoke('install-mod', data),
  installModFile:      data   => ipcRenderer.invoke('install-mod-file', data),
  getDefaultModsFolder:()     => ipcRenderer.invoke('get-default-mods-folder'),
  validateModsFolder:  folder => ipcRenderer.invoke('validate-mods-folder', folder),
  installUpdate:       ()     => ipcRenderer.invoke('install-update'),
  restartAndInstall:   ()     => ipcRenderer.invoke('restart-and-install'),

  // #2: fixed — removes old listener before adding new (no stacking)
  onInstallProgress: (cb) => {
    ipcRenderer.removeAllListeners('install-progress');
    ipcRenderer.on('install-progress', (_e, data) => cb(data));
  },

  // Auto-updater events
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_e, d) => cb(d)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update-progress',   (_e, d) => cb(d)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded',  ()      => cb()),

  // Mod scraping
  fetchTopMods: (source) => ipcRenderer.invoke('fetch-top-mods', source),
  searchMods:   (query)  => ipcRenderer.invoke('search-mods', query),

  // Browser integration
  openModInBrowser: (url) => ipcRenderer.invoke('open-mod-in-browser', url),
});
