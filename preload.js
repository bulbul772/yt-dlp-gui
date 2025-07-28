const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  pasteClipboard: () => ipcRenderer.invoke('paste-clipboard'),
  fetchInfo: url => ipcRenderer.invoke('fetch-info', url),
  enqueue: job => ipcRenderer.invoke('enqueue-download', job),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  getDownloadsFolder: () => ipcRenderer.invoke('get-downloads-folder'),
  pauseDownload: id => ipcRenderer.invoke('pause-download', id),
  resumeDownload: id => ipcRenderer.invoke('resume-download', id),
  cancelDownload: id => ipcRenderer.invoke('cancel-download', id),
  onQueued: cb => ipcRenderer.on('download-queued', (_e, d) => cb(d)),
  onProgress: cb => ipcRenderer.on('download-progress', (_e, p) => cb(p)),
  onError: cb => ipcRenderer.on('download-error', (_e, p) => cb(p)),
  onComplete: cb => ipcRenderer.on('download-complete', (_e, p) => cb(p))
});
