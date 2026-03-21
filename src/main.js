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
        icon: path.join(__dirname, '../assets/openmarkerIcon.jpg'),
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

    //Icon
    ipcMain.handle('get-icon', async () => {
        return path.join(__dirname, '../assets/openmarkerIcon.png')
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
        const filePath = path.join(getGroupsRoot(), groupName, 'grades.docx')
        return { success: fs.existsSync(filePath), exists: fs.existsSync(filePath) }
    })

    ipcMain.handle('list-submissions', async (_e, groupName) => {
        const subDir = path.join(getGroupsRoot(), groupName, 'submissions')
        if (!fs.existsSync(subDir)) return []
        return fs.readdirSync(subDir).filter(f => !f.startsWith('.'))
    })

    ipcMain.handle('add-submissions', async (_e, groupName) => {
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(win, {
            title: 'Select student submissions (.docx only)',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Word Documents', extensions: ['docx'] }]
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true }
        const subDir = path.join(getGroupsRoot(), groupName, 'submissions')
        const copied = []
        const skipped = []
        for (const src of result.filePaths) {
            const basename = path.basename(src)
            if (!basename.endsWith('.docx')) { skipped.push(basename); continue }
            fs.copyFileSync(src, path.join(subDir, basename))
            copied.push(basename)
        }
        return { success: true, files: copied, skipped }
    })

    // ── AI Marking ────────────────────────────────────────────────────────────

    ipcMain.handle('run-marking', async (event, groupName) => {
        const sender = event.sender
        const groupPath = path.join(getGroupsRoot(), groupName)
        const subDir = path.join(groupPath, 'submissions')
        const matrixPath = path.join(groupPath, 'marking_matrix.md')
        const gradesDocxPath = path.join(groupPath, 'grades.docx')

        const submissions = fs.readdirSync(subDir).filter(f => f.endsWith('.docx'))
        if (submissions.length === 0) return { success: false, error: 'No .docx submissions found.' }

        const matrix = fs.readFileSync(matrixPath, 'utf8')

        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) return { success: false, error: 'No models downloaded. Go to Models tab first.' }
        const modelFiles = fs.readdirSync(modelsFolder).filter(f => f.endsWith('.gguf'))
        if (modelFiles.length === 0) return { success: false, error: 'No models downloaded. Go to Models tab first.' }
        const modelPath = path.join(modelsFolder, modelFiles[0])

        sender.send('marking-progress', { type: 'start', total: submissions.length })

        const mammoth = require('mammoth')
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx')

        const gradeSections = []
        const resultsForUI = []

        try {
            const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
            const llama = await getLlama()
            const llamaModel = await llama.loadModel({ modelPath })

            for (let i = 0; i < submissions.length; i++) {
                const filename = submissions[i]
                sender.send('marking-progress', { type: 'marking', current: i + 1, total: submissions.length, file: filename })

                const subPath = path.join(subDir, filename)
                let studentWork = ''
                try {
                    const result = await mammoth.extractRawText({ path: subPath })
                    studentWork = result.value
                } catch {
                    studentWork = '[Could not read .docx file]'
                }

                const context = await llamaModel.createContext({ contextSize: 4096 })
                const session = new LlamaChatSession({ contextSequence: context.getSequence() })
                const response = await session.prompt(buildPrompt(matrix, studentWork, filename), { maxTokens: 512 })
                await context.dispose()

                const resultText = response.trim()
                resultsForUI.push({ file: filename, result: resultText })
                sender.send('marking-progress', { type: 'done-one', file: filename, result: resultText })

                // Build docx paragraphs for this student
                gradeSections.push(
                    new Paragraph({ text: filename, heading: HeadingLevel.HEADING_2 }),
                    ...resultText.split('\n').map(line =>
                        new Paragraph({
                            children: [new TextRun({ text: line || ' ', size: 24 })],
                            spacing: { after: 80 }
                        })
                    ),
                    new Paragraph({ text: '', spacing: { after: 200 } })
                )
            }

            await llamaModel.dispose()
        } catch (err) {
            return { success: false, error: err.message }
        }

        // Write grades.docx
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        text: `Grades — ${groupName}`,
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()} | OpenMarker`, italics: true, size: 20, color: '888888' })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 }
                    }),
                    ...gradeSections
                ]
            }]
        })

        const buffer = await Packer.toBuffer(doc)
        fs.writeFileSync(gradesDocxPath, buffer)

        sender.send('marking-progress', { type: 'complete' })
        return { success: true, results: resultsForUI }
    })

    ipcMain.handle('export-grades', async (_e, groupName) => {
        const gradesDocxPath = path.join(getGroupsRoot(), groupName, 'grades.docx')
        if (!fs.existsSync(gradesDocxPath)) return { success: false, error: 'No grades file found. Run marking first.' }
        const win = BrowserWindow.getFocusedWindow()
        const { filePath, canceled } = await dialog.showSaveDialog(win, {
            title: 'Save Grades',
            defaultPath: `${groupName}_grades.docx`,
            filters: [{ name: 'Word Document', extensions: ['docx'] }]
        })
        if (canceled || !filePath) return { success: false, canceled: true }
        fs.copyFileSync(gradesDocxPath, filePath)
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
