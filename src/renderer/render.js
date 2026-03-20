const info = document.getElementById('info')
const addGroupBtn = document.getElementById('addGroupBtn')
const clearGroupsBtn = document.getElementById('clearGroupsBtn')
const groupList = document.getElementById('groupList')
const homeContent = document.getElementById('homeContent')
const modelsContent = document.getElementById('modelsContent')
const homeNav = document.getElementById('homeNav')
const modelsNav = document.getElementById('modelsNav')
const supportedModelsList = document.getElementById('supportedModelsList')
const localModelsList = document.getElementById('localModelsList')
const localModelsHeading = document.getElementById('localModelsHeading')
const modelStatus = document.getElementById('modelStatus')
const refreshModelsBtn = document.getElementById('refreshModelsBtn')

let groupCount = 0

if (info && window.versions) {
    info.innerText = `Chrome v${window.versions.chrome()} · Node.js v${window.versions.node()} · Electron v${window.versions.electron()}`
}

function addGroup() {
    groupCount += 1
    const item = document.createElement('div')
    item.className = 'group-card'

    const label = document.createElement('span')
    label.textContent = `Group ${groupCount}`

    const deleteButton = document.createElement('button')
    deleteButton.className = 'delete-btn'
    deleteButton.textContent = 'Delete'
    deleteButton.addEventListener('click', () => item.remove())

    item.appendChild(label)
    item.appendChild(deleteButton)
    if (groupList) groupList.appendChild(item)
}

function renderLocalModels(localFiles, allModels) {
    if (!localModelsList) return
    localModelsList.innerHTML = ''

    if (localFiles.length === 0) {
        localModelsHeading.classList.add('hidden')
        return
    }

    localModelsHeading.classList.remove('hidden')

    localFiles.forEach((local) => {
        // Match against known models for extra metadata
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
            if (!confirm(`Delete ${local.file}? This cannot be undone.`)) return
            const result = await window.electronAPI.deleteModel(local.file)
            if (result.success) {
                card.remove()
                const remaining = localModelsList.querySelectorAll('.local-model-card')
                if (remaining.length === 0) localModelsHeading.classList.add('hidden')
                modelStatus.textContent = 'Model deleted.'
                // Reset the matching download button back to "Download"
                const allBtns = supportedModelsList.querySelectorAll('.action-btn')
                allBtns.forEach(btn => {
                    if (btn.dataset.file === local.file) {
                        btn.textContent = 'Download'
                        btn.disabled = false
                    }
                })
            } else {
                alert(`Failed to delete: ${result.error}`)
            }
        })

        topRow.appendChild(badge)
        topRow.appendChild(deleteBtn)

        const meta = document.createElement('div')
        meta.innerHTML = `<strong>${known ? known.name : local.file}</strong><br>
            <small>${local.file}</small><br>
            <small>${local.sizeMB} MB on disk · Added ${local.addedAt}</small>`
        if (known) {
            meta.innerHTML += `<br><small style="opacity:0.6">${known.ram} RAM · ${known.info}</small>`
        }

        card.appendChild(topRow)
        card.appendChild(meta)
        localModelsList.appendChild(card)
    })
}

async function renderModelButtons(models) {
    if (!supportedModelsList) return
    supportedModelsList.innerHTML = ''

    if (!models || models.length === 0) {
        modelStatus.textContent = 'No supported models found.'
        return
    }

    // Check which models are already downloaded
    let localFiles = []
    if (window.electronAPI && window.electronAPI.checkLocalModels) {
        localFiles = await window.electronAPI.checkLocalModels()
    }

    const localFileNames = localFiles.map(l => l.file)

    renderLocalModels(localFiles, models)

    const localCount = localFiles.length
    modelStatus.textContent = localCount > 0
        ? `${localCount} model(s) downloaded locally.`
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

        // Progress bar (hidden by default)
        const progressWrap = document.createElement('div')
        progressWrap.style.cssText = 'display:none; margin-top:8px;'
        const progressBar = document.createElement('progress')
        progressBar.max = 100
        progressBar.value = 0
        progressBar.style.cssText = 'width:100%; height:8px;'
        const progressLabel = document.createElement('small')
        progressLabel.textContent = ''
        progressWrap.appendChild(progressBar)
        progressWrap.appendChild(progressLabel)

        const btn = document.createElement('button')
        btn.className = 'action-btn'
        btn.dataset.file = model.file
        btn.textContent = isLocal ? 'Use Model' : 'Download'

        btn.addEventListener('click', async () => {
            if (isLocal) {
                modelStatus.textContent = `Active model: ${model.name}`
                return
            }

            if (!window.electronAPI || !window.electronAPI.downloadModel) {
                alert('Download API not available.')
                return
            }

            btn.disabled = true
            btn.textContent = 'Downloading...'
            progressWrap.style.display = 'block'
            progressBar.value = 0
            progressLabel.textContent = '0%'

            // Listen for progress updates
            window.electronAPI.removeDownloadProgressListener()
            window.electronAPI.onDownloadProgress((data) => {
                if (data.file !== model.file) return
                progressBar.value = data.percent
                if (data.done) {
                    progressLabel.textContent = 'Complete'
                } else {
                    const dlMB = (data.downloadedBytes / 1024 / 1024).toFixed(1)
                    const totalMB = (data.totalBytes / 1024 / 1024).toFixed(1)
                    progressLabel.textContent = `${data.percent}%  (${dlMB} / ${totalMB} MB)`
                }
            })

            const result = await window.electronAPI.downloadModel(model)
            window.electronAPI.removeDownloadProgressListener()

            if (result.success) {
                btn.textContent = 'Use Model'
                btn.disabled = false
                progressLabel.textContent = result.alreadyExists ? 'Already downloaded' : 'Download complete'
                modelStatus.textContent = `${model.name} is ready.`
                // Refresh local models panel
                const updated = await window.electronAPI.checkLocalModels()
                renderLocalModels(updated, models)
            } else {
                btn.textContent = 'Download'
                btn.disabled = false
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
    if (!modelStatus) return
    modelStatus.textContent = 'Loading models...'
    try {
        const response = await fetch('../data/supportedmodels.json')
        const data = await response.json()
        await renderModelButtons(data)
    } catch (err) {
        modelStatus.textContent = 'Unable to read supportedmodels.json.'
        console.error('Error loading supported models:', err)
    }
}

if (addGroupBtn) addGroupBtn.addEventListener('click', addGroup)

if (clearGroupsBtn && groupList) {
    clearGroupsBtn.addEventListener('click', () => {
        groupList.innerHTML = ''
        groupCount = 0
    })
}

if (refreshModelsBtn) refreshModelsBtn.addEventListener('click', loadSupportedModels)

if (homeNav && modelsNav && homeContent && modelsContent) {
    function selectView(showHome) {
        homeContent.classList.toggle('hidden', !showHome)
        modelsContent.classList.toggle('hidden', showHome)
        homeNav.classList.toggle('active-nav', showHome)
        modelsNav.classList.toggle('active-nav', !showHome)
    }

    homeNav.addEventListener('click', () => selectView(true))
    modelsNav.addEventListener('click', () => {
        selectView(false)
        loadSupportedModels()
    })
    selectView(true)
}
