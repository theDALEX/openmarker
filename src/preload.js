const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    downloadModel: (model) => ipcRenderer.invoke('download-model', model),
    deleteModel: (filename) => ipcRenderer.invoke('delete-model', filename),
    checkLocalModels: () => ipcRenderer.invoke('check-local-models'),
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (_event, data) => callback(data))
    },
    removeDownloadProgressListener: () => {
        ipcRenderer.removeAllListeners('download-progress')
    }
})

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
})
