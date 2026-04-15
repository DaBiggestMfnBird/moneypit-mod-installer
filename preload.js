const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectBeamngFolder: () => ipcRenderer.invoke('select-beamng-folder'),
  installMod: (data) => ipcRenderer.invoke('install-mod', data),
  installModFile: (data) => ipcRenderer.invoke('install-mod-file', data),
  getDefaultModsFolder: () => ipcRenderer.invoke('get-default-mods-folder'),
  validateModsFolder: (folderPath) => ipcRenderer.invoke('validate-mods-folder', folderPath),
  onInstallProgress: (callback) => {
    // Remove any existing listener before adding a new one to prevent stacking
    ipcRenderer.removeAllListeners('install-progress');
    ipcRenderer.on('install-progress', (event, data) => callback(data));
  }
});
