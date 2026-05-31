const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('fat', {
    getStatus: () => ipcRenderer.invoke('status:get'),
    onStatus: (cb) => ipcRenderer.on('status', (_e, data) => cb(data)),
});
