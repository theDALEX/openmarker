const { ipcMain, app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('fs')
const XLSX = require('xlsx')
const { getGroupsRoot } = require('./groupsIpc')

// Tokens reserved for the model's own response
const RESPONSE_RESERVE = 600
// Safety buffer so we never hit the hard context ceiling
const SAFETY_BUFFER = 256

// Context size candidates — tried largest-first, falls back on VRAM error
const CONTEXT_SIZE_CANDIDATES = [8192, 4096, 2048, 1024]

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPrompt(matrix, studentWork, filename) {
    return `You are an academic marker. Use the marking matrix below to grade the student's work.

MARKING MATRIX:
${matrix}

STUDENT SUBMISSION (${filename}):
${studentWork}

Respond with EXACTLY this structure:
GRADE: <grade matching the matrix scheme>
FEEDBACK: <2-3 sentences of specific feedback referencing the criteria>
IMPROVEMENT: <one concrete suggestion for improvement>`
}

function buildChunkPrompt(matrix, chunk, filename, chunkIndex, totalChunks) {
    return `You are an academic marker reviewing part ${chunkIndex} of ${totalChunks} of a student submission.

MARKING MATRIX:
${matrix}

STUDENT SUBMISSION PART ${chunkIndex}/${totalChunks} (${filename}):
${chunk}

Analyse this section against the marking criteria. Note key strengths, weaknesses, and which grade band this section suggests. Be concise — this is an intermediate analysis, not the final grade.`
}

function buildSummaryPrompt(matrix, chunkAnalyses, filename) {
    return `You are an academic marker. You have analysed a student submission in parts. Below are your per-section analyses and the original marking matrix.

MARKING MATRIX:
${matrix}

PER-SECTION ANALYSES for ${filename}:
${chunkAnalyses}

Now provide the FINAL holistic assessment. Respond with EXACTLY this structure:
GRADE: <single grade matching the matrix scheme>
FEEDBACK: <2-3 sentences of specific feedback referencing the criteria across the whole submission>
IMPROVEMENT: <one concrete suggestion for improvement>`
}

// ── Inference helpers ─────────────────────────────────────────────────────────

function isVramError(err) {
    const msg = (err.message || '').toLowerCase()
    return (
        msg.includes('vram') || msg.includes('memory') ||
        msg.includes('too large') || msg.includes('compress') ||
        msg.includes('context shift') || msg.includes('context size')
    )
}

// One-shot raw completion — no chat session, no history, no compression errors
async function completeWithFallback(llamaModel, prompt, maxTokens) {
    const tokens = maxTokens || RESPONSE_RESERVE
    const { LlamaCompletion } = await import('node-llama-cpp')
    for (const size of CONTEXT_SIZE_CANDIDATES) {
        let ctx
        try {
            ctx = await llamaModel.createContext({ contextSize: size })
            const completion = new LlamaCompletion({ contextSequence: ctx.getSequence() })
            const response = await completion.generateCompletion(prompt, { maxTokens: tokens })
            await ctx.dispose()
            return { text: response.trim(), contextSize: size }
        } catch (err) {
            if (ctx) { try { await ctx.dispose() } catch (_) { } }
            if (isVramError(err)) continue
            throw err
        }
    }
    throw new Error('Could not complete — insufficient VRAM even for 1024 token context.')
}

// ── Chunking ──────────────────────────────────────────────────────────────────

function estimateTokens(text) {
    return Math.ceil((text.split(/\s+/).length / 0.75) * 1.1)
}

function splitIntoChunks(text, maxTokens) {
    const words = text.split(/\s+/)
    const wordsPerChunk = Math.max(50, Math.floor(maxTokens * 0.75))
    const chunks = []
    for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
    }
    return chunks
}

function chunkStudentWork(studentWork, matrixTokens, filename, contextSize) {
    const overhead = estimateTokens(buildPrompt('', '', filename)) + matrixTokens + RESPONSE_RESERVE + SAFETY_BUFFER
    const availableForContent = contextSize - overhead

    if (availableForContent <= 0) {
        return splitIntoChunks(studentWork, Math.floor(contextSize * 0.4))
    }

    if (estimateTokens(studentWork) <= availableForContent) return [studentWork]

    return splitIntoChunks(studentWork, availableForContent)
}

// ── Core marking logic ────────────────────────────────────────────────────────

async function markSingleSubmission(llamaModel, matrix, studentWork, filename) {
    // Probe to find the working context size for this machine
    const { contextSize } = await completeWithFallback(llamaModel, 'ping', 1)
    console.log(contextSize)

    const matrixTokens = estimateTokens(matrix)
    const chunks = chunkStudentWork(studentWork, matrixTokens, filename, contextSize)

    if (chunks.length === 1) {
        const { text } = await completeWithFallback(llamaModel, buildPrompt(matrix, chunks[0], filename))
        return text
    }

    // Multi-chunk: analyse each part independently, then synthesise
    const chunkAnalyses = []
    for (let i = 0; i < chunks.length; i++) {
        const { text } = await completeWithFallback(
            llamaModel,
            buildChunkPrompt(matrix, chunks[i], filename, i + 1, chunks.length),
            400
        )
        chunkAnalyses.push(`--- Part ${i + 1} ---\n${text}`)
    }

    // Trim oldest analyses if the summary prompt is too large for the context
    let analyses = chunkAnalyses
    while (
        analyses.length > 2 &&
        estimateTokens(buildSummaryPrompt(matrix, analyses.join('\n\n'), filename)) > contextSize - RESPONSE_RESERVE - SAFETY_BUFFER
    ) {
        analyses = analyses.slice(1)
    }

    const { text: finalText } = await completeWithFallback(
        llamaModel,
        buildSummaryPrompt(matrix, analyses.join('\n\n'), filename)
    )
    return finalText
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerMarkingHandlers() {
    ipcMain.handle('chat', async (_event, message) => {
        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) return { success: false, error: 'No model downloaded yet. Go to the Models tab first.' }
        const modelFiles = fs.readdirSync(modelsFolder).filter(f => f.endsWith('.gguf'))
        if (modelFiles.length === 0) return { success: false, error: 'No model downloaded yet. Go to the Models tab first.' }

        try {
            const { getLlama } = await import('node-llama-cpp')
            const llama = await getLlama()
            const model = await llama.loadModel({ modelPath: path.join(modelsFolder, modelFiles[0]) })
            const { text } = await completeWithFallback(model, message, 512)
            await model.dispose()
            return { success: true, reply: text }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('run-marking', async (event, groupName) => {
        const sender = event.sender
        const groupPath = path.join(getGroupsRoot(), groupName)
        const subDir = path.join(groupPath, 'submissions')
        const matrixPath = path.join(groupPath, 'marking_matrix.docx')
        const gradesDocxPath = path.join(groupPath, 'grades.docx')
        const gradesXlsxPath = path.join(groupPath, 'grades.xlsx')

        const submissions = fs.readdirSync(subDir).filter(f => f.endsWith('.docx') || f.endsWith('.pptx'))
        if (submissions.length === 0) return { success: false, error: 'No .docx or .pptx submissions found.' }
        if (!fs.existsSync(matrixPath)) return { success: false, error: 'No marking matrix uploaded. Please upload a marking matrix first.' }

        const mammoth = require('mammoth')
        const officeParser = require('officeparser')
        const matrixResult = await mammoth.extractRawText({ path: matrixPath })
        const matrix = matrixResult.value

        const modelsFolder = path.join(app.getPath('userData'), 'models')
        if (!fs.existsSync(modelsFolder)) return { success: false, error: 'No models downloaded. Go to Models tab first.' }
        const modelFiles = fs.readdirSync(modelsFolder).filter(f => f.endsWith('.gguf'))
        if (modelFiles.length === 0) return { success: false, error: 'No models downloaded. Go to Models tab first.' }
        const modelPath = path.join(modelsFolder, modelFiles[0])

        sender.send('marking-progress', { type: 'start', total: submissions.length })

        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx')
        const gradeSections = []
        const gradeRows = [['Student File', 'Grade', 'Feedback', 'Improvement']]

        try {
            const { getLlama } = await import('node-llama-cpp')
            const llama = await getLlama()
            const llamaModel = await llama.loadModel({ modelPath })

            for (let i = 0; i < submissions.length; i++) {
                const filename = submissions[i]
                sender.send('marking-progress', { type: 'marking', current: i + 1, total: submissions.length })

                const subPath = path.join(subDir, filename)
                let studentWork = ''
                try {
                    const ext = path.extname(filename).toLowerCase()
                    if (ext === '.docx') {
                        const result = await mammoth.extractRawText({ path: subPath })
                        studentWork = result.value
                    } else if (ext === '.pptx') {
                        studentWork = await new Promise((resolve, reject) => {
                            officeParser.parseOffice(subPath, (text, err) => {
                                if (err) reject(err)
                                else resolve(text)
                            })
                        })
                    }
                } catch {
                    studentWork = '[Could not read file]'
                }

                const resultText = await markSingleSubmission(llamaModel, matrix, studentWork, filename)

                const gradeMatch = resultText.match(/GRADE:\s*(.+)/i)
                const feedbackMatch = resultText.match(/FEEDBACK:\s*([\s\S]+?)(?=IMPROVEMENT:|$)/i)
                const improvementMatch = resultText.match(/IMPROVEMENT:\s*([\s\S]+)/i)

                const grade = gradeMatch ? gradeMatch[1].trim() : resultText.split('\n')[0].trim()
                const feedback = feedbackMatch ? feedbackMatch[1].trim() : ''
                const improvement = improvementMatch ? improvementMatch[1].trim() : ''

                gradeRows.push([filename, grade, feedback, improvement])

                gradeSections.push(
                    new Paragraph({ text: filename, heading: HeadingLevel.HEADING_2 }),
                    new Paragraph({ children: [new TextRun({ text: `Grade: ${grade}`, bold: true, size: 24 })], spacing: { after: 80 } }),
                    ...(feedback ? [new Paragraph({ children: [new TextRun({ text: `Feedback: ${feedback}`, size: 22 })], spacing: { after: 80 } })] : []),
                    ...(improvement ? [new Paragraph({ children: [new TextRun({ text: `Improvement: ${improvement}`, size: 22, italics: true })], spacing: { after: 80 } })] : []),
                    new Paragraph({ text: '', spacing: { after: 200 } })
                )
            }

            await llamaModel.dispose()
        } catch (err) {
            return { success: false, error: err.message }
        }

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ text: `Grades — ${groupName}`, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
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

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(gradeRows)
        ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 80 }, { wch: 60 }]
        XLSX.utils.book_append_sheet(wb, ws, 'Grades')
        XLSX.writeFile(wb, gradesXlsxPath)

        sender.send('marking-progress', { type: 'complete', total: submissions.length })
        return { success: true }
    })

    ipcMain.handle('export-grades', async (_e, groupName) => {
        const gradesDocxPath = path.join(getGroupsRoot(), groupName, 'grades.docx')
        const gradesXlsxPath = path.join(getGroupsRoot(), groupName, 'grades.xlsx')
        if (!fs.existsSync(gradesDocxPath)) return { success: false, error: 'No grades file found. Run marking first.' }

        const win = BrowserWindow.getFocusedWindow()

        const { response } = await dialog.showMessageBox(win, {
            type: 'question',
            title: 'Export Grades',
            message: 'How would you like to export the grades?',
            buttons: ['Word Document (.docx)', 'Excel Spreadsheet (.xlsx)', 'Both', 'Cancel'],
            defaultId: 2,
            cancelId: 3
        })

        if (response === 3) return { success: true, canceled: true }

        if (response === 0 || response === 2) {
            const { filePath, canceled } = await dialog.showSaveDialog(win, {
                title: 'Save Grades Report (.docx)',
                defaultPath: `${groupName}_grades.docx`,
                filters: [{ name: 'Word Document', extensions: ['docx'] }]
            })
            if (!canceled && filePath) fs.copyFileSync(gradesDocxPath, filePath)
        }

        if ((response === 1 || response === 2) && fs.existsSync(gradesXlsxPath)) {
            const { filePath, canceled } = await dialog.showSaveDialog(win, {
                title: 'Save Grades Spreadsheet (.xlsx)',
                defaultPath: `${groupName}_grades.xlsx`,
                filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx'] }]
            })
            if (!canceled && filePath) fs.copyFileSync(gradesXlsxPath, filePath)
        }

        return { success: true }
    })

    ipcMain.handle('download-demo-matrix', async () => {
        const win = BrowserWindow.getFocusedWindow()
        const { filePath, canceled } = await dialog.showSaveDialog(win, {
            title: 'Save Demo Marking Matrix',
            defaultPath: 'demo_marking_matrix.docx',
            filters: [{ name: 'Word Document', extensions: ['docx'] }]
        })
        if (canceled || !filePath) return { success: false, canceled: true }

        const srcPath = path.join(app.getAppPath(), 'demoDocs', 'demo_marking_matrix.docx')
        fs.copyFileSync(srcPath, filePath)
        return { success: true }
    })
}

module.exports = { registerMarkingHandlers }
