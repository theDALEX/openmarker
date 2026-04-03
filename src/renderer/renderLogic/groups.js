// ── Groups ────────────────────────────────────────────────────────────────────
const newGroupName = document.getElementById('newGroupName')
const addGroupBtn = document.getElementById('addGroupBtn')
const groupList = document.getElementById('groupList')
const groupDetailName = document.getElementById('groupDetailName')
const submissionsList = document.getElementById('submissionsList')
const uploadMatrixBtn = document.getElementById('uploadMatrixBtn')
const downloadDemoMatrixBtn = document.getElementById('downloadDemoMatrixBtn')
const matrixFileName = document.getElementById('matrixFileName')
const addSubmissionsBtn = document.getElementById('addSubmissionsBtn')

let currentGroup = null

async function loadGroups() {
    groupList.innerHTML = ''
    const groups = await window.electronAPI.listGroups()
    if (groups.length === 0) {
        groupList.innerHTML = '<p style="color:var(--muted); font-size:0.9rem">No groups yet. Create one above.</p>'
        return
    }
    groups.forEach(g => groupList.appendChild(makeGroupCard(g)))
}

function makeGroupCard(g) {
    const card = document.createElement('div')
    card.className = 'group-card'

    const info = document.createElement('div')
    info.innerHTML = `<strong>${g.name}</strong><br> <small style="color:var(--muted)">${g.submissionCount} submission${g.submissionCount !== 1 ? 's' : ''}</small>`

    const btns = document.createElement('div')
    btns.style.display = 'flex'
    btns.style.gap = '8px'

    const openBtn = document.createElement('button')
    openBtn.className = 'action-btn'
    openBtn.textContent = 'Open'
    openBtn.addEventListener('click', () => openGroup(g.name))

    const delBtn = document.createElement('button')
    delBtn.className = 'delete-btn'
    delBtn.textContent = 'Delete'
    delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete group "${g.name}" and all its files?`)) return
        await window.electronAPI.deleteGroup(g.name)
        card.remove()
    })

    btns.appendChild(openBtn)
    btns.appendChild(delBtn)
    card.appendChild(info)
    card.appendChild(btns)
    return card
}

addGroupBtn.addEventListener('click', async () => {
    const name = newGroupName.value.trim()
    if (!name) { newGroupName.focus(); return }
    const result = await window.electronAPI.createGroup(name)
    if (!result.success) { alert(result.error); return }
    newGroupName.value = ''
    await loadGroups()
})

newGroupName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addGroupBtn.click()
})

async function openGroup(name) {
    currentGroup = name
    groupDetailName.textContent = name
    document.getElementById('markingStatus').classList.add('hidden')
    document.getElementById('markingResults').innerHTML = ''
    document.getElementById('gradesSection').classList.add('hidden')
    showView('group')

    await refreshSubmissions()
    await loadMatrixStatus()
    await loadGrades()
}

async function refreshSubmissions() {
    submissionsList.innerHTML = ''
    const files = await window.electronAPI.listSubmissions(currentGroup)
    if (files.length === 0) {
        submissionsList.innerHTML = '<li style="color:var(--muted); font-size:0.9rem">No submissions yet.</li>'
        return
    }
    const li = document.createElement('li')
    li.className = 'submission-item'
    li.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} uploaded`
    submissionsList.appendChild(li)
}

async function loadMatrixStatus() {
    const result = await window.electronAPI.getMarkingMatrix(currentGroup)
    if (result.exists) {
        matrixFileName.textContent = '✓ Marking matrix uploaded'
        matrixFileName.style.color = 'var(--tip)'
    } else {
        matrixFileName.textContent = 'No matrix uploaded'
        matrixFileName.style.color = ''
    }
}

async function loadGrades() {
    const result = await window.electronAPI.getGrades(currentGroup)
    const gradesSection = document.getElementById('gradesSection')
    if (result.exists) gradesSection.classList.remove('hidden')
    else gradesSection.classList.add('hidden')
}

addSubmissionsBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.addSubmissions(currentGroup)
    if (result.canceled) return
    if (!result.success) { alert('Failed to add files'); return }
    await refreshSubmissions()
})

uploadMatrixBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.uploadMarkingMatrix(currentGroup)
    if (result.canceled) return
    if (!result.success) { alert('Failed to upload matrix'); return }
    await loadMatrixStatus()
})

downloadDemoMatrixBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.downloadDemoMatrix()
    if (!result.success && !result.canceled) alert(`Failed: ${result.error}`)
})
