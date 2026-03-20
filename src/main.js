const { ipcMain, app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('fs')
const https = require('https')
const http = require('http')

// Groups live in <userData>/.groups/
const getGroupsRoot = () => path.join(app.getPath('userData'), 'groups')

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1000,
        height: 750,
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

    // ── Chat ──────────────────────────────────────────────────────────────────

    ipcMain.handle('chat', async (_event, message) => {
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) return { success: false, error: 'No model downloaded yet. Go to the Models tab first.' }
        const modelFiles = fs.readdirSync(modelsFolder).filter(f => f.endsWith('.gguf'))
        if (modelFiles.length === 0) return { success: false, error: 'No model downloaded yet. Go to the Models tab first.' }

        try {
            const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
            const llama = await getLlama()
            const model = await llama.loadModel({ modelPath: path.join(modelsFolder, modelFiles[0]) })
            const context = await model.createContext({ contextSize: 2048 })
            const session = new LlamaChatSession({ contextSequence: context.getSequence() })
            const reply = await session.prompt(message, { maxTokens: 512 })
            await context.dispose()
            await model.dispose()
            return { success: true, reply: reply.trim() }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // ── Groups ────────────────────────────────────────────────────────────────

    ipcMain.handle('create-group', async (_e, name) => {
        const safe = name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').trim()
        if (!safe) return { success: false, error: 'Invalid group name' }
        const groupPath = path.join(getGroupsRoot(), safe)
        if (fs.existsSync(groupPath)) return { success: false, error: 'Group already exists' }
        fs.mkdirSync(path.join(groupPath, 'submissions'), { recursive: true })
        fs.writeFileSync(path.join(groupPath, 'marking_matrix.md'),
            '# Marking Matrix\n\nDescribe the grading criteria here.\n\n## Criteria\n\n- **Content** (40%): ...\n- **Structure** (30%): ...\n- **Clarity** (30%): ...\n')
        fs.writeFileSync(path.join(groupPath, 'grades.md'), '# Grades\n\n')
        return { success: true, name: safe, path: groupPath }
    })

    ipcMain.handle('list-groups', async () => {
        const root = getGroupsRoot()
        if (!fs.existsSync(root)) return []
        return fs.readdirSync(root, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => {
                const subDir = path.join(root, d.name, 'submissions')
                const subCount = fs.existsSync(subDir)
                    ? fs.readdirSync(subDir).filter(f => !f.startsWith('.')).length
                    : 0
                return { name: d.name, submissionCount: subCount }
            })
    })

    ipcMain.handle('delete-group', async (_e, name) => {
        const groupPath = path.join(getGroupsRoot(), name)
        if (!groupPath.startsWith(getGroupsRoot())) return { success: false, error: 'Invalid' }
        fs.rmSync(groupPath, { recursive: true, force: true })
        return { success: true }
    })

    ipcMain.handle('get-marking-matrix', async (_e, groupName) => {
        const filePath = path.join(getGroupsRoot(), groupName, 'marking_matrix.md')
        if (!fs.existsSync(filePath)) return { success: false, error: 'Not found' }
        return { success: true, content: fs.readFileSync(filePath, 'utf8') }
    })

    ipcMain.handle('save-marking-matrix', async (_e, groupName, content) => {
        const filePath = path.join(getGroupsRoot(), groupName, 'marking_matrix.md')
        fs.writeFileSync(filePath, content, 'utf8')
        return { success: true }
    })

    ipcMain.handle('get-grades', async (_e, groupName) => {
        const filePath = path.join(getGroupsRoot(), groupName, 'grades.md')
        if (!fs.existsSync(filePath)) return { success: false, content: '' }
        return { success: true, content: fs.readFileSync(filePath, 'utf8') }
    })

    ipcMain.handle('list-submissions', async (_e, groupName) => {
        const subDir = path.join(getGroupsRoot(), groupName, 'submissions')
        if (!fs.existsSync(subDir)) return []
        return fs.readdirSync(subDir).filter(f => !f.startsWith('.'))
    })

    ipcMain.handle('add-submissions', async (_e, groupName) => {
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(win, {
            title: 'Select student submissions',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Text files', extensions: ['txt', 'md', 'pdf', 'docx'] }]
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true }
        const subDir = path.join(getGroupsRoot(), groupName, 'submissions')
        const copied = []
        for (const src of result.filePaths) {
            const dest = path.join(subDir, path.basename(src))
            fs.copyFileSync(src, dest)
            copied.push(path.basename(src))
        }
        return { success: true, files: copied }
    })

    // ── AI Marking ────────────────────────────────────────────────────────────

    ipcMain.handle('run-marking', async (event, groupName) => {
        const sender = event.sender
        const groupPath = path.join(getGroupsRoot(), groupName)
        const subDir = path.join(groupPath, 'submissions')
        const matrixPath = path.join(groupPath, 'marking_matrix.md')
        const gradesPath = path.join(groupPath, 'grades.md')

        const submissions = fs.readdirSync(subDir).filter(f => !f.startsWith('.'))
        if (submissions.length === 0) return { success: false, error: 'No submissions found' }

        const matrix = fs.readFileSync(matrixPath, 'utf8')

        // Find a downloaded model
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) return { success: false, error: 'No models downloaded. Go to Models tab and download one first.' }
        const modelFiles = fs.readdirSync(modelsFolder).filter(f => f.endsWith('.gguf'))
        if (modelFiles.length === 0) return { success: false, error: 'No models downloaded. Go to Models tab and download one first.' }
        const modelPath = path.join(modelsFolder, modelFiles[0])

        sender.send('marking-progress', { type: 'start', total: submissions.length })

        let gradesOutput = `# Grades — ${groupName}\n\nGenerated: ${new Date().toLocaleString()}\n\n---\n\n`

        try {
            const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
            const llama = await getLlama()
            const model = await llama.loadModel({ modelPath })
            const context = await model.createContext({ contextSize: 4096 })
            const session = new LlamaChatSession({ contextSequence: context.getSequence() })

            for (let i = 0; i < submissions.length; i++) {
                const filename = submissions[i]
                sender.send('marking-progress', { type: 'marking', current: i + 1, total: submissions.length, file: filename })

                const subPath = path.join(subDir, filename)
                let studentWork = ''
                try {
                    studentWork = fs.readFileSync(subPath, 'utf8')
                } catch {
                    studentWork = '[Could not read file — may be binary format]'
                }

                const prompt = buildPrompt(matrix, studentWork, filename)
                const response = await session.prompt(prompt, { maxTokens: 512 })

                gradesOutput += `## ${filename}\n\n${response.trim()}\n\n---\n\n`
                sender.send('marking-progress', { type: 'done-one', file: filename, result: response.trim() })

                // Reset session for next student to avoid context bleed
                await context.dispose()
                const freshContext = await model.createContext({ contextSize: 4096 })
                session.contextSequence = freshContext.getSequence()
            }

            await model.dispose()
        } catch (err) {
            return { success: false, error: err.message }
        }

        fs.writeFileSync(gradesPath, gradesOutput, 'utf8')
        sender.send('marking-progress', { type: 'complete' })
        return { success: true }
    })

    // ── Model download / delete (unchanged) ──────────────────────────────────

    ipcMain.handle('download-model', async (event, model) => {
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) fs.mkdirSync(modelsFolder, { recursive: true })
        const destPath = path.join(modelsFolder, model.file)
        if (fs.existsSync(destPath)) return { success: true, path: destPath, alreadyExists: true }
        const sender = event.sender
        const tmpPath = destPath + '.part'
        return new Promise((resolve) => {
            function doDownload(url, redirectCount) {
                if (redirectCount > 5) { resolve({ success: false, error: 'Too many redirects' }); return }
                const protocol = url.startsWith('https') ? https : http
                const file = fs.createWriteStream(tmpPath)
                protocol.get(url, (response) => {
                    const { statusCode } = response
                    if ([301, 302, 307, 308].includes(statusCode)) {
                        file.close(); fs.unlink(tmpPath, () => { })
                        doDownload(response.headers.location, redirectCount + 1); return
                    }
                    if (statusCode !== 200) {
                        file.close(); fs.unlink(tmpPath, () => { })
                        resolve({ success: false, error: `HTTP ${statusCode}` }); return
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
                    file.on('error', (err) => { fs.unlink(tmpPath, () => { }); resolve({ success: false, error: err.message }) })
                }).on('error', (err) => { file.close(); fs.unlink(tmpPath, () => { }); resolve({ success: false, error: err.message }) })
            }
            doDownload(model.url, 0)
        })
    })

    ipcMain.handle('delete-model', async (_event, filename) => {
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        const filePath = path.join(modelsFolder, filename)
        if (!filePath.startsWith(modelsFolder)) return { success: false, error: 'Invalid filename' }
        try { fs.unlinkSync(filePath); return { success: true } }
        catch (err) { return { success: false, error: err.message } }
    })

    ipcMain.handle('check-local-models', async () => {
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) return []
        return fs.readdirSync(modelsFolder).filter(f => f.endsWith('.gguf')).map(f => {
            const stat = fs.statSync(path.join(modelsFolder, f))
            return { file: f, sizeMB: (stat.size / 1024 / 1024).toFixed(1), addedAt: stat.mtime.toLocaleDateString() }
        })
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

function buildPrompt(matrix, studentWork, filename) {
    return `You are an academic marker. Use the marking matrix below to grade the student's work.

MARKING MATRIX:
${matrix}

STUDENT SUBMISSION (${filename}):
${studentWork.slice(0, 3000)}

Respond with:
1. A grade (e.g. A, B+, 72%, etc. — match the scheme in the matrix)
2. 2-3 sentences of specific feedback referencing the criteria
3. One suggestion for improvement

Keep your response concise and structured.`
}
