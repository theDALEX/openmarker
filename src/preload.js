const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // Chat
    chat: (message) => ipcRenderer.invoke('chat', message),
    //Icon
    getIcon: () => ipcRenderer.invoke('get-icon'),
    // Groups
    createGroup: (name) => ipcRenderer.invoke('create-group', name),
    listGroups: () => ipcRenderer.invoke('list-groups'),
    deleteGroup: (name) => ipcRenderer.invoke('delete-group', name),
    getMarkingMatrix: (groupName) => ipcRenderer.invoke('get-marking-matrix', groupName),
    uploadMarkingMatrix: (groupName) => ipcRenderer.invoke('upload-marking-matrix', groupName),
    downloadDemoMatrix: () => ipcRenderer.invoke('download-demo-matrix'),
    getGrades: (groupName) => ipcRenderer.invoke('get-grades', groupName),
    listSubmissions: (groupName) => ipcRenderer.invoke('list-submissions', groupName),
    addSubmissions: (groupName) => ipcRenderer.invoke('add-submissions', groupName),
    runMarking: (groupName) => ipcRenderer.invoke('run-marking', groupName),
    exportGrades: (groupName) => ipcRenderer.invoke('export-grades', groupName),
    onMarkingProgress: (cb) => ipcRenderer.on('marking-progress', (_e, data) => cb(data)),
    removeMarkingProgressListener: () => ipcRenderer.removeAllListeners('marking-progress'),

    // Models
    checkModelReady: () => ipcRenderer.invoke('check-model-ready'),
    listLocalModels: () => ipcRenderer.invoke('list-local-models'),
    deleteModel: (fileName) => ipcRenderer.invoke('delete-model', fileName),
    downloadModel: (modelDef) => ipcRenderer.send('download-model', modelDef),
    onModelReady: (cb) => ipcRenderer.on('model-ready', (_e, data) => cb(data)),
    onModelDownloadProgress: (cb) => ipcRenderer.on('model-download-progress', (_e, data) => cb(data)),
    onModelDownloadError: (cb) => ipcRenderer.on('model-download-error', (_e, data) => cb(data)),
    removeModelListeners: () => {
        ipcRenderer.removeAllListeners('model-ready')
        ipcRenderer.removeAllListeners('model-download-progress')
        ipcRenderer.removeAllListeners('model-download-error')
    },
})

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
})
