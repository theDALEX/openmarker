const { ipcMain, app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('fs')

const getGroupsRoot = () => path.join(app.getPath('userData'), 'groups')

function registerGroupHandlers() {
    ipcMain.handle('create-group', async (_e, name) => {
        const safe = name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').trim()
        if (!safe) return { success: false, error: 'Invalid group name' }
        const groupPath = path.join(getGroupsRoot(), safe)
        if (fs.existsSync(groupPath)) return { success: false, error: 'Group already exists' }
        fs.mkdirSync(path.join(groupPath, 'submissions'), { recursive: true })
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
        const filePath = path.join(getGroupsRoot(), groupName, 'marking_matrix.docx')
        return { success: fs.existsSync(filePath), exists: fs.existsSync(filePath) }
    })

    ipcMain.handle('upload-marking-matrix', async (_e, groupName) => {
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(win, {
            title: 'Select Marking Matrix (.docx)',
            properties: ['openFile'],
            filters: [{ name: 'Word Document', extensions: ['docx'] }]
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true }
        const src = result.filePaths[0]
        const dest = path.join(getGroupsRoot(), groupName, 'marking_matrix.docx')
        fs.copyFileSync(src, dest)
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
            title: 'Select student submissions (.docx or .pptx)',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Student Submissions', extensions: ['docx', 'pptx'] }]
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true }
        const subDir = path.join(getGroupsRoot(), groupName, 'submissions')
        const copied = []
        const skipped = []
        for (const src of result.filePaths) {
            const basename = path.basename(src)
            const ext = path.extname(basename).toLowerCase()
            if (ext !== '.docx' && ext !== '.pptx') { skipped.push(basename); continue }
            fs.copyFileSync(src, path.join(subDir, basename))
            copied.push(basename)
        }
        return { success: true, files: copied, skipped }
    })
}

module.exports = { registerGroupHandlers, getGroupsRoot }
