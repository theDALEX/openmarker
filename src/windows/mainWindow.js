const { BrowserWindow } = require('electron')
const path = require('node:path')

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 750,
        icon: path.join(__dirname, '../../assets/openmarkerIcon.jpg'),
        title: 'OpenMarker | Your AI-Powered Marking Assistant',
        webPreferences: {
            preload: path.join(__dirname, '../preload.js')
        }
    })
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

module.exports = { createWindow }
