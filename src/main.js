const { ipcMain, app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('fs')
const https = require('https')
const http = require('http')

const createWindow = () => {
    const win = new BrowserWindow({
        width: 900,
        height: 700,
        title: 'OpenMarker | Your AI-Powered Marking Assistant',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })
    win.loadFile(path.join(__dirname, 'renderer/index.html'))
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    ipcMain.handle('download-model', async (event, model) => {
        const modelsFolder = path.join(app.getAppPath(), '.models')
        if (!fs.existsSync(modelsFolder)) {
            fs.mkdirSync(modelsFolder, { recursive: true })
        }

        const destPath = path.join(modelsFolder, model.file)

        if (fs.existsSync(destPath)) {
            return { success: true, path: destPath, alreadyExists: true }
        }

        const sender = event.sender
        const tmpPath = destPath + '.part'

        return new Promise((resolve) => {
            function doDownload(url, redirectCount) {
                if (redirectCount > 5) {
                    resolve({ success: false, error: 'Too many redirects' })
                    return
                }

                const protocol = url.startsWith('https') ? https : http
                const file = fs.createWriteStream(tmpPath)

                protocol.get(url, (response) => {
                    const { statusCode } = response
                    if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
                        file.close()
                        fs.unlink(tmpPath, () => { })
                        doDownload(response.headers.location, redirectCount + 1)
                        return
                    }

                    if (statusCode !== 200) {
                        file.close()
                        fs.unlink(tmpPath, () => { })
                        resolve({ success: false, error: `HTTP ${statusCode}` })
                        return
                    }

                    const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
                    let downloadedBytes = 0

                    response.on('data', (chunk) => {
                        downloadedBytes += chunk.length
                        if (totalBytes > 0) {
                            const percent = Math.round((downloadedBytes / totalBytes) * 100)
                            sender.send('download-progress', { file: model.file, percent, downloadedBytes, totalBytes })
                        }
                    })

                    response.pipe(file)

                    file.on('finish', () => {
                        file.close(() => {
                            fs.renameSync(tmpPath, destPath)
                            sender.send('download-progress', { file: model.file, percent: 100, done: true })
                            resolve({ success: true, path: destPath })
                        })
                    })

                    file.on('error', (err) => {
                        fs.unlink(tmpPath, () => { })
                        resolve({ success: false, error: err.message })
                    })
                }).on('error', (err) => {
                    file.close()
                    fs.unlink(tmpPath, () => { })
                    resolve({ success: false, error: err.message })
                })
            }

            doDownload(model.url, 0)
        })
    })

    ipcMain.handle('delete-model', async (_event, filename) => {
        const modelsFolder = path.join(app.getAppPath(), '.models')
        const filePath = path.join(modelsFolder, filename)
        // Prevent path traversal
        if (!filePath.startsWith(modelsFolder)) {
            return { success: false, error: 'Invalid filename' }
        }
        try {
            fs.unlinkSync(filePath)
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('check-local-models', async () => {
        const modelsFolder = path.join(app.getAppPath(), '.models')
        if (!fs.existsSync(modelsFolder)) return []
        return fs.readdirSync(modelsFolder)
            .filter(f => f.endsWith('.gguf'))
            .map(f => {
                const stat = fs.statSync(path.join(modelsFolder, f))
                return {
                    file: f,
                    sizeMB: (stat.size / 1024 / 1024).toFixed(1),
                    addedAt: stat.mtime.toLocaleDateString()
                }
            })
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
