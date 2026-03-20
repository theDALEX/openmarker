const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // Chat
    chat: (message) => ipcRenderer.invoke('chat', message),

    // Groups
    createGroup: (name) => ipcRenderer.invoke('create-group', name),
    listGroups: () => ipcRenderer.invoke('list-groups'),
    deleteGroup: (name) => ipcRenderer.invoke('delete-group', name),
    getMarkingMatrix: (groupName) => ipcRenderer.invoke('get-marking-matrix', groupName),
    saveMarkingMatrix: (groupName, content) => ipcRenderer.invoke('save-marking-matrix', groupName, content),
    getGrades: (groupName) => ipcRenderer.invoke('get-grades', groupName),
    listSubmissions: (groupName) => ipcRenderer.invoke('list-submissions', groupName),
    addSubmissions: (groupName) => ipcRenderer.invoke('add-submissions', groupName),
    runMarking: (groupName) => ipcRenderer.invoke('run-marking', groupName),
    exportGrades: (groupName) => ipcRenderer.invoke('export-grades', groupName),
    onMarkingProgress: (cb) => ipcRenderer.on('marking-progress', (_e, data) => cb(data)),
    removeMarkingProgressListener: () => ipcRenderer.removeAllListeners('marking-progress'),

    // Models
    downloadModel: (model) => ipcRenderer.invoke('download-model', model),
    deleteModel: (filename) => ipcRenderer.invoke('delete-model', filename),
    checkLocalModels: () => ipcRenderer.invoke('check-local-models'),
    onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb(data)),
    removeDownloadProgressListener: () => ipcRenderer.removeAllListeners('download-progress'),
})

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
})
