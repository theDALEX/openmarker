const { ipcMain, app } = require('electron')
const path = require('node:path')
const fs = require('fs')
const https = require('https')
const http = require('http')

const MODEL = {
    name: 'Mistral-7B-Instruct-v0.3-Q4_K_M-GGUF',
    file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    url: 'https://huggingface.co/thedalex/Mistral-7B-Instruct-v0.3-Q4_K_M-GGUF/resolve/main/Mistral-7B-Instruct-Q4_K_M.gguf?download=true'
}

function downloadModelFile(sender) {
    const modelsFolder = path.join(app.getPath('userData'), 'models')
    if (!fs.existsSync(modelsFolder)) fs.mkdirSync(modelsFolder, { recursive: true })
    const destPath = path.join(modelsFolder, MODEL.file)
    if (fs.existsSync(destPath)) {
        if (sender) sender.send('model-ready', { alreadyExists: true })
        return
    }
    const tmpPath = destPath + '.part'
    // Clean up any stale partial file from a previous interrupted download
    if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch (_) { }
    }
    function doDownload(url, redirectCount) {
        if (redirectCount > 10) { if (sender) sender.send('model-download-error', { error: 'Too many redirects' }); return }
        const protocol = url.startsWith('https') ? https : http
        const file = fs.createWriteStream(tmpPath)
        const req = protocol.get(url, (response) => {
            const { statusCode } = response
            if ([301, 302, 307, 308].includes(statusCode)) {
                response.resume() // drain response
                file.close(() => {
                    try { fs.unlinkSync(tmpPath) } catch (_) { }
                    doDownload(response.headers.location, redirectCount + 1)
                })
                return
            }
            if (statusCode !== 200) {
                response.resume()
                file.close(() => { try { fs.unlinkSync(tmpPath) } catch (_) { } })
                if (sender) sender.send('model-download-error', { error: `HTTP ${statusCode}` })
                return
            }
            const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
            let downloadedBytes = 0
            response.on('data', (chunk) => {
                downloadedBytes += chunk.length
                if (totalBytes > 0 && sender) {
                    const percent = Math.round((downloadedBytes / totalBytes) * 100)
                    sender.send('model-download-progress', { percent, downloadedBytes, totalBytes })
                }
            })
            response.on('end', () => {
                if (sender) sender.send('model-download-progress', { percent: 100, downloadedBytes, totalBytes, finalizing: true })
            })
            response.pipe(file)
            file.on('finish', () => {
                file.close(() => {
                    fs.rename(tmpPath, destPath, (renameErr) => {
                        if (renameErr) {
                            // fallback: copy then delete (handles cross-drive on Windows)
                            const rd = fs.createReadStream(tmpPath)
                            const wr = fs.createWriteStream(destPath)
                            rd.pipe(wr)
                            wr.on('finish', () => {
                                fs.unlink(tmpPath, () => { })
                                if (sender) sender.send('model-ready', { alreadyExists: false })
                            })
                            wr.on('error', (err) => {
                                if (sender) sender.send('model-download-error', { error: err.message })
                            })
                        } else {
                            if (sender) sender.send('model-ready', { alreadyExists: false })
                        }
                    })
                })
            })
            file.on('error', (err) => {
                try { fs.unlinkSync(tmpPath) } catch (_) { }
                if (sender) sender.send('model-download-error', { error: err.message })
            })
        })
        req.on('error', (err) => {
            file.close(() => { try { fs.unlinkSync(tmpPath) } catch (_) { } })
            if (sender) sender.send('model-download-error', { error: err.message })
        })
    }
    doDownload(MODEL.url, 0)
}

function registerModelHandlers() {
    ipcMain.on('renderer-ready', (event) => {
        downloadModelFile(event.sender)
    })

    ipcMain.handle('check-model-ready', async () => {
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        const destPath = path.join(modelsFolder, MODEL.file)
        if (fs.existsSync(destPath)) return true
        // If a complete .part file exists (rename got stuck), finish it now
        const tmpPath = destPath + '.part'
        if (fs.existsSync(tmpPath)) {
            try {
                fs.renameSync(tmpPath, destPath)
                return true
            } catch (_) { }
        }
        return false
    })

    ipcMain.handle('check-local-models', async () => {
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) return []
        return fs.readdirSync(modelsFolder).filter(f => f.endsWith('.gguf')).map(f => {
            const stat = fs.statSync(path.join(modelsFolder, f))
            return { file: f, sizeMB: (stat.size / 1024 / 1024).toFixed(1), addedAt: stat.mtime.toLocaleDateString() }
        })
    })
}

module.exports = { registerModelHandlers }
