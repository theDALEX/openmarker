const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { createWindow } = require('./windows/mainWindow')
const { registerGroupHandlers } = require('./ipc/groupsIpc')
const { registerMarkingHandlers } = require('./ipc/markingIpc')
const { registerModelHandlers } = require('./ipc/modelsIpc')

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    ipcMain.handle('get-icon', async () => {
        return require('url').pathToFileURL(path.join(__dirname, '../assets/openmarkerIcon.png')).href
    })

    registerGroupHandlers()
    registerMarkingHandlers()
    registerModelHandlers()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
