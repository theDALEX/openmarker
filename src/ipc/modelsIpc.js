const { ipcMain, app } = require('electron')
const path = require('node:path')
const fs = require('fs')
const https = require('https')
const http = require('http')

const getModelsFolder = () => path.join(app.getPath('userData'), 'models')

// Active downloads map: file -> { req, tmpPath }
const activeDownloads = {}

function downloadModelFile(modelDef, sender) {
    const modelsFolder = getModelsFolder()
    if (!fs.existsSync(modelsFolder)) fs.mkdirSync(modelsFolder, { recursive: true })
    const destPath = path.join(modelsFolder, modelDef.file)

    if (fs.existsSync(destPath)) {
        if (sender) sender.send('model-ready', { file: modelDef.file, alreadyExists: true })
        return
    }

    const tmpPath = destPath + '.part'
    if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch (_) { }
    }

    function doDownload(url, redirectCount) {
        if (redirectCount > 10) {
            if (sender) sender.send('model-download-error', { file: modelDef.file, error: 'Too many redirects' })
            return
        }

        const protocol = url.startsWith('https') ? https : http
        const file = fs.createWriteStream(tmpPath)

        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; OpenMarker)',
                'Accept': '*/*'
            }
        }, (response) => {
            const { statusCode } = response

            if ([301, 302, 307, 308].includes(statusCode)) {
                response.resume()
                file.close(() => {
                    try { fs.unlinkSync(tmpPath) } catch (_) { }
                    // Resolve relative redirect URLs against the current URL
                    const newUrl = new URL(response.headers.location, url).toString()
                    doDownload(newUrl, redirectCount + 1)
                })
                return
            }

            if (statusCode !== 200) {
                response.resume()
                file.close(() => { try { fs.unlinkSync(tmpPath) } catch (_) { } })
                delete activeDownloads[modelDef.file]
                if (sender) sender.send('model-download-error', { file: modelDef.file, error: `HTTP ${statusCode}` })
                return
            }

            const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
            let downloadedBytes = 0

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length
                if (sender) {
                    const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : -1
                    sender.send('model-download-progress', { file: modelDef.file, percent, downloadedBytes, totalBytes })
                }
            })

            response.pipe(file)

            file.on('finish', () => {
                file.close(() => {
                    delete activeDownloads[modelDef.file]
                    // Send finalizing only after file is fully written
                    if (sender) sender.send('model-download-progress', { file: modelDef.file, percent: 100, downloadedBytes, totalBytes, finalizing: true })
                    fs.rename(tmpPath, destPath, (renameErr) => {
                        if (renameErr) {
                            const rd = fs.createReadStream(tmpPath)
                            const wr = fs.createWriteStream(destPath)
                            rd.pipe(wr)
                            wr.on('finish', () => {
                                fs.unlink(tmpPath, () => { })
                                if (sender) sender.send('model-ready', { file: modelDef.file, alreadyExists: false })
                            })
                            wr.on('error', (err) => {
                                if (sender) sender.send('model-download-error', { file: modelDef.file, error: err.message })
                            })
                        } else {
                            if (sender) sender.send('model-ready', { file: modelDef.file, alreadyExists: false })
                        }
                    })
                })
            })

            file.on('error', (err) => {
                delete activeDownloads[modelDef.file]
                try { fs.unlinkSync(tmpPath) } catch (_) { }
                if (sender) sender.send('model-download-error', { file: modelDef.file, error: err.message })
            })
        })

        // Destroy hung connections after 30s of inactivity
        req.setTimeout(30000, () => {
            req.destroy(new Error('Request timeout'))
        })

        req.on('error', (err) => {
            delete activeDownloads[modelDef.file]
            file.close(() => { try { fs.unlinkSync(tmpPath) } catch (_) { } })
            if (sender) sender.send('model-download-error', { file: modelDef.file, error: err.message })
        })

        activeDownloads[modelDef.file] = { req, tmpPath }
    }

    doDownload(modelDef.url, 0)
}

function registerModelHandlers() {
    ipcMain.on('download-model', (event, modelDef) => {
        downloadModelFile(modelDef, event.sender)
    })

    ipcMain.handle('delete-model', async (_e, fileName) => {
        const filePath = path.join(getModelsFolder(), fileName)
        if (!filePath.startsWith(getModelsFolder())) return { success: false }
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('list-local-models', async () => {
        const folder = getModelsFolder()
        if (!fs.existsSync(folder)) return []
        return fs.readdirSync(folder)
            .filter(f => f.endsWith('.gguf'))
            .map(f => {
                const stat = fs.statSync(path.join(folder, f))
                return { file: f, sizeMB: (stat.size / 1024 / 1024).toFixed(0) }
            })
    })

    ipcMain.handle('check-model-ready', async () => {
        const folder = getModelsFolder()
        if (!fs.existsSync(folder)) return false
        return fs.readdirSync(folder).some(f => f.endsWith('.gguf'))
    })

    ipcMain.handle('get-active-model-path', async () => {
        const folder = getModelsFolder()
        if (!fs.existsSync(folder)) return null
        const file = fs.readdirSync(folder).find(f => f.endsWith('.gguf'))
        return file ? path.join(folder, file) : null
    })
}

module.exports = { registerModelHandlers, getModelsFolder }
