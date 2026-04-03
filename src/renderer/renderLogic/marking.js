// ── Marking & Grades ──────────────────────────────────────────────────────────
const runMarkingBtn = document.getElementById('runMarkingBtn')
const markingStatus = document.getElementById('markingStatus')
const downloadGradesBtn = document.getElementById('downloadGradesBtn')

runMarkingBtn.addEventListener('click', async () => {
    runMarkingBtn.disabled = true
    document.getElementById('markingResults').innerHTML = ''
    markingStatus.classList.remove('hidden')
    markingStatus.textContent = 'Starting...'
    document.getElementById('gradesSection').classList.add('hidden')

    window.electronAPI.removeMarkingProgressListener()
    window.electronAPI.onMarkingProgress((data) => {
        if (data.type === 'start') {
            markingStatus.textContent = `Marking in progress... 0 / ${data.total} files`
        } else if (data.type === 'marking' || data.type === 'done-one') {
            markingStatus.textContent = `Marking in progress... ${data.current} / ${data.total} files`
        } else if (data.type === 'complete') {
            markingStatus.textContent = `Marking complete — ${data.total} file${data.total !== 1 ? 's' : ''} marked.`
        }
    })

    const result = await window.electronAPI.runMarking(currentGroup)
    window.electronAPI.removeMarkingProgressListener()
    runMarkingBtn.disabled = false

    if (!result.success) {
        markingStatus.textContent = `Error: ${result.error}`
        return
    }

    await loadGrades()
})

downloadGradesBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.exportGrades(currentGroup)
    if (!result.success && !result.canceled) alert(`Export failed: ${result.error}`)
})
