// ── DOM refs ──────────────────────────────────────────────────────────────────
const homeContent = document.getElementById('homeContent')
const groupDetail = document.getElementById('groupDetail')
const modelsContent = document.getElementById('modelsContent')
const homeNav = document.getElementById('homeNav')
const modelsNav = document.getElementById('modelsNav')

// Home
const newGroupName = document.getElementById('newGroupName')
const addGroupBtn = document.getElementById('addGroupBtn')
const groupList = document.getElementById('groupList')

// Group detail
const backBtn = document.getElementById('backBtn')
const groupDetailName = document.getElementById('groupDetailName')
const addSubmissionsBtn = document.getElementById('addSubmissionsBtn')
const runMarkingBtn = document.getElementById('runMarkingBtn')
const submissionsList = document.getElementById('submissionsList')
const markingStatus = document.getElementById('markingStatus')
const markingResults = document.getElementById('markingResults')
const matrixEditor = document.getElementById('matrixEditor')
const saveMatrixBtn = document.getElementById('saveMatrixBtn')
const matrixSaveStatus = document.getElementById('matrixSaveStatus')
const gradesSection = document.getElementById('gradesSection')
const downloadGradesBtn = document.getElementById('downloadGradesBtn')

// Models
const supportedModelsList = document.getElementById('supportedModelsList')
const localModelsList = document.getElementById('localModelsList')
const localModelsHeading = document.getElementById('localModelsHeading')
const modelStatus = document.getElementById('modelStatus')
const refreshModelsBtn = document.getElementById('refreshModelsBtn')

let currentGroup = null

// ── Navigation ────────────────────────────────────────────────────────────────
function showView(view) {
    homeContent.classList.add('hidden')
    groupDetail.classList.add('hidden')
    modelsContent.classList.add('hidden')
    homeNav.classList.remove('active-nav')
    modelsNav.classList.remove('active-nav')

    if (view === 'home') { homeContent.classList.remove('hidden'); homeNav.classList.add('active-nav') }
    if (view === 'group') { groupDetail.classList.remove('hidden'); homeNav.classList.add('active-nav') }
    if (view === 'models') { modelsContent.classList.remove('hidden'); modelsNav.classList.add('active-nav') }
}

homeNav.addEventListener('click', () => { showView('home'); loadGroups() })
modelsNav.addEventListener('click', () => { showView('models'); loadSupportedModels() })
backBtn.addEventListener('click', () => { showView('home'); loadGroups() })

// ── Groups list ───────────────────────────────────────────────────────────────
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

// ── Group detail ──────────────────────────────────────────────────────────────
async function openGroup(name) {
    currentGroup = name
    groupDetailName.textContent = name
    markingStatus.classList.add('hidden')
    markingResults.innerHTML = ''
    gradesSection.classList.add('hidden')
    showView('group')

    await refreshSubmissions()
    await loadMatrix()
    await loadGrades()
}

async function refreshSubmissions() {
    submissionsList.innerHTML = ''
    const files = await window.electronAPI.listSubmissions(currentGroup)
    if (files.length === 0) {
        submissionsList.innerHTML = '<li style="color:var(--muted); font-size:0.9rem">No submissions yet.</li>'
        return
    }
    files.forEach(f => {
        const li = document.createElement('li')
        li.className = 'submission-item'
        li.textContent = f
        submissionsList.appendChild(li)
    })
}

async function loadMatrix() {
    const result = await window.electronAPI.getMarkingMatrix(currentGroup)
    if (result.success) matrixEditor.value = result.content
}

async function loadGrades() {
    const result = await window.electronAPI.getGrades(currentGroup)
    if (result.exists) gradesSection.classList.remove('hidden')
    else gradesSection.classList.add('hidden')
}

addSubmissionsBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.addSubmissions(currentGroup)
    if (result.canceled) return
    if (!result.success) { alert('Failed to add files'); return }
    await refreshSubmissions()
})

saveMatrixBtn.addEventListener('click', async () => {
    await window.electronAPI.saveMarkingMatrix(currentGroup, matrixEditor.value)
    matrixSaveStatus.textContent = 'Saved ✓'
    setTimeout(() => { matrixSaveStatus.textContent = '' }, 2000)
})

// ── Run marking ───────────────────────────────────────────────────────────────
runMarkingBtn.addEventListener('click', async () => {
    // Save matrix first
    await window.electronAPI.saveMarkingMatrix(currentGroup, matrixEditor.value)

    runMarkingBtn.disabled = true
    markingResults.innerHTML = ''
    markingStatus.classList.remove('hidden')
    markingStatus.textContent = 'Starting...'
    gradesSection.classList.add('hidden')

    window.electronAPI.removeMarkingProgressListener()
    window.electronAPI.onMarkingProgress((data) => {
        if (data.type === 'start') {
            markingStatus.textContent = `Marking 0 / ${data.total} submissions...`
        } else if (data.type === 'marking') {
            markingStatus.textContent = `Marking ${data.current} / ${data.total}: ${data.file}`
        } else if (data.type === 'done-one') {
            const block = document.createElement('div')
            block.className = 'result-block'
            block.innerHTML = `<strong>${data.file}</strong><pre class="result-text">${escHtml(data.result)}</pre>`
            markingResults.appendChild(block)
        } else if (data.type === 'complete') {
            markingStatus.textContent = 'Marking complete.'
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

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Models ────────────────────────────────────────────────────────────────────
function renderLocalModels(localFiles, allModels) {
    if (!localModelsList) return
    localModelsList.innerHTML = ''
    if (localFiles.length === 0) { localModelsHeading.classList.add('hidden'); return }
    localModelsHeading.classList.remove('hidden')

    localFiles.forEach((local) => {
        const known = allModels.find(m => m.file === local.file)
        const card = document.createElement('div')
        card.className = 'group-card local-model-card'

        const topRow = document.createElement('div')
        topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;'

        const badge = document.createElement('span')
        badge.className = 'local-badge'
        badge.textContent = 'Downloaded'

        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'delete-btn'
        deleteBtn.textContent = 'Delete'
        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Delete ${local.file}?`)) return
            const res = await window.electronAPI.deleteModel(local.file)
            if (res.success) {
                card.remove()
                if (!localModelsList.querySelector('.local-model-card')) localModelsHeading.classList.add('hidden')
                modelStatus.textContent = 'Model deleted.'
                supportedModelsList.querySelectorAll('.action-btn').forEach(btn => {
                    if (btn.dataset.file === local.file) { btn.textContent = 'Download'; btn.disabled = false }
                })
            } else { alert(`Failed: ${res.error}`) }
        })

        topRow.appendChild(badge)
        topRow.appendChild(deleteBtn)

        const meta = document.createElement('div')
        meta.innerHTML = `<strong>${known ? known.name : local.file}</strong><br>
            <small>${local.file}</small><br>
            <small>${local.sizeMB} MB on disk · Added ${local.addedAt}</small>`
        if (known) meta.innerHTML += `<br><small style="opacity:0.6">${known.ram} RAM · ${known.info}</small>`

        card.appendChild(topRow)
        card.appendChild(meta)
        localModelsList.appendChild(card)
    })
}

async function renderModelButtons(models) {
    if (!supportedModelsList) return
    supportedModelsList.innerHTML = ''
    if (!models || models.length === 0) { modelStatus.textContent = 'No supported models found.'; return }

    let localFiles = []
    if (window.electronAPI) localFiles = await window.electronAPI.checkLocalModels()
    const localFileNames = localFiles.map(l => l.file)
    renderLocalModels(localFiles, models)
    modelStatus.textContent = localFiles.length > 0
        ? `${localFiles.length} model(s) downloaded locally.`
        : 'No local models found. Download one to get started.'

    models.forEach((model) => {
        const isLocal = localFileNames.includes(model.file)
        const card = document.createElement('div')
        card.className = 'group-card'

        const meta = document.createElement('div')
        meta.innerHTML = `<strong>${model.name}</strong><br>
            <small>${model.file} · ${model.ram} RAM · ${model.size}</small><br>
            <small>${model.info}</small><br>
            <small style="opacity:0.6">${model.tag}</small>`

        const progressWrap = document.createElement('div')
        progressWrap.style.cssText = 'display:none; margin-top:8px;'
        const progressBar = document.createElement('progress')
        progressBar.max = 100; progressBar.value = 0
        progressBar.style.cssText = 'width:100%; height:8px;'
        const progressLabel = document.createElement('small')
        progressWrap.appendChild(progressBar)
        progressWrap.appendChild(progressLabel)

        const btn = document.createElement('button')
        btn.className = 'action-btn'
        btn.dataset.file = model.file
        btn.textContent = isLocal ? 'Use Model' : 'Download'

        btn.addEventListener('click', async () => {
            if (isLocal) { modelStatus.textContent = `Active: ${model.name}`; return }
            btn.disabled = true; btn.textContent = 'Downloading...'
            progressWrap.style.display = 'block'; progressBar.value = 0; progressLabel.textContent = '0%'

            window.electronAPI.removeDownloadProgressListener()
            window.electronAPI.onDownloadProgress((data) => {
                if (data.file !== model.file) return
                progressBar.value = data.percent
                progressLabel.textContent = data.done
                    ? 'Complete'
                    : `${data.percent}%  (${(data.downloadedBytes / 1024 / 1024).toFixed(1)} / ${(data.totalBytes / 1024 / 1024).toFixed(1)} MB)`
            })

            const result = await window.electronAPI.downloadModel(model)
            window.electronAPI.removeDownloadProgressListener()

            if (result.success) {
                btn.textContent = 'Use Model'; btn.disabled = false
                progressLabel.textContent = result.alreadyExists ? 'Already downloaded' : 'Download complete'
                modelStatus.textContent = `${model.name} is ready.`
                const updated = await window.electronAPI.checkLocalModels()
                renderLocalModels(updated, models)
            } else {
                btn.textContent = 'Download'; btn.disabled = false
                progressWrap.style.display = 'none'
                alert(`Download failed: ${result.error}`)
            }
        })

        card.appendChild(meta)
        card.appendChild(progressWrap)
        card.appendChild(btn)
        supportedModelsList.appendChild(card)
    })
}

async function loadSupportedModels() {
    modelStatus.textContent = 'Loading models...'
    try {
        const response = await fetch('../data/supportedmodels.json')
        const data = await response.json()
        await renderModelButtons(data)
    } catch (err) {
        modelStatus.textContent = 'Unable to read supportedmodels.json.'
    }
}

if (refreshModelsBtn) refreshModelsBtn.addEventListener('click', loadSupportedModels)

// ── Chat ──────────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages')
const chatInput = document.getElementById('chatInput')
const chatSendBtn = document.getElementById('chatSendBtn')
const chatStatus = document.getElementById('chatStatus')

function appendMessage(role, text) {
    const msg = document.createElement('div')
    msg.className = `chat-msg chat-msg-${role}`
    msg.innerHTML = `<span class="chat-bubble">${escHtml(text)}</span>`
    chatMessages.appendChild(msg)
    chatMessages.scrollTop = chatMessages.scrollHeight
}

async function sendChat() {
    const text = chatInput.value.trim()
    if (!text) return

    appendMessage('user', text)
    chatInput.value = ''
    chatSendBtn.disabled = true
    chatStatus.textContent = 'Thinking...'
    chatStatus.classList.remove('hidden')

    const result = await window.electronAPI.chat(text)
    chatStatus.classList.add('hidden')
    chatSendBtn.disabled = false

    if (result.success) {
        appendMessage('assistant', result.reply)
    } else {
        appendMessage('assistant', `⚠ ${result.error}`)
    }
}

chatSendBtn.addEventListener('click', sendChat)
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
})

// ── Init ──────────────────────────────────────────────────────────────────────
showView('home')
loadGroups()
