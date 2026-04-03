// ── Models Section ─────────────────────────────────────────────────────────────

// Track in-progress downloads: file -> { percent, finalizing }
const downloadStates = {}

function initModelListeners() {
    window.electronAPI.removeModelListeners()

    window.electronAPI.onModelDownloadProgress((data) => {
        downloadStates[data.file] = { percent: data.percent, finalizing: !!data.finalizing }
        updateModelCard(data.file)
    })

    window.electronAPI.onModelReady((data) => {
        delete downloadStates[data.file]
        loadModelsSection()
        updateHomeModelNotice()
    })

    window.electronAPI.onModelDownloadError((data) => {
        delete downloadStates[data.file]
        updateModelCard(data.file, data.error)
    })
}

function updateModelCard(file, errorMsg) {
    const card = document.querySelector(`[data-model-file="${file}"]`)
    if (!card) return
    const statusEl = card.querySelector('.model-card-status')
    if (!statusEl) return
    const state = downloadStates[file]
    if (errorMsg) {
        statusEl.className = 'model-card-status model-card-error'
        statusEl.textContent = `⚠ Failed: ${errorMsg}`
        const btn = card.querySelector('.model-download-btn')
        if (btn) { btn.disabled = false; btn.textContent = 'Retry' }
        return
    }
    if (state) {
        statusEl.className = 'model-card-status model-card-downloading'
        statusEl.textContent = state.finalizing ? 'Saving to disk...' : `Downloading... ${state.percent}%`
        const bar = card.querySelector('.model-dl-bar-fill')
        if (bar) bar.style.width = state.percent + '%'
    }
}

async function loadModelsSection() {
    const localList = document.getElementById('localModelsList')
    const availableList = document.getElementById('availableModelsList')
    if (!localList || !availableList) return

    const [localModels, supportedModels] = await Promise.all([
        window.electronAPI.listLocalModels(),
        fetch('../data/supportedmodels.json').then(r => r.json())
    ])

    const localFiles = new Set(localModels.map(m => m.file))

    // ── Downloaded models ──
    localList.innerHTML = ''
    if (localModels.length === 0) {
        localList.innerHTML = '<p style="color:var(--muted);font-size:0.9rem">No models downloaded yet.</p>'
    } else {
        localModels.forEach(m => {
            const card = document.createElement('div')
            card.className = 'model-card model-card-local'
            card.dataset.modelFile = m.file
            card.innerHTML = `
                <div class="model-card-info">
                    <span class="local-badge">Downloaded</span>
                    <strong>${m.file}</strong>
                    <small style="color:var(--muted)">${m.sizeMB} MB</small>
                </div>
                <button class="delete-btn model-delete-btn">Delete</button>
            `
            card.querySelector('.model-delete-btn').addEventListener('click', async () => {
                if (!confirm(`Delete ${m.file}?`)) return
                await window.electronAPI.deleteModel(m.file)
                loadModelsSection()
                updateHomeModelNotice()
            })
            localList.appendChild(card)
        })
    }

    // ── Available to download ──
    availableList.innerHTML = ''
    supportedModels.forEach(m => {
        if (localFiles.has(m.file)) return // already downloaded, skip
        const isDownloading = !!downloadStates[m.file]
        const state = downloadStates[m.file]
        const percent = state ? state.percent : 0
        const statusText = isDownloading
            ? (state.finalizing ? 'Saving to disk...' : `Downloading... ${percent}%`)
            : ''

        const card = document.createElement('div')
        card.className = 'model-card'
        card.dataset.modelFile = m.file
        card.innerHTML = `
            <div class="model-card-info">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <strong>${m.name}</strong>
                    ${m.tag ? m.tag.map(tag => `<span class="model-tag">${tag}</span>`).join(' ') : ''}
                </div>
                <small style="color:var(--muted)">${m.info}</small>
                <small style="color:var(--muted)">Size: ${m.size} &nbsp;|&nbsp; RAM: ${m.ram}</small>
                ${isDownloading ? `
                <div class="model-dl-bar-wrap">
                    <div class="model-dl-bar-fill" style="width:${percent}%"></div>
                </div>` : ''}
                <span class="model-card-status ${isDownloading ? 'model-card-downloading' : ''}">${statusText}</span>
            </div>
            <button class="action-btn model-download-btn" ${isDownloading ? 'disabled' : ''}>
                ${isDownloading ? 'Downloading...' : '⬇ Download'}
            </button>
        `
        card.querySelector('.model-download-btn').addEventListener('click', () => {
            window.electronAPI.downloadModel(m)
            downloadStates[m.file] = { percent: 0, finalizing: false }
            loadModelsSection()
        })
        availableList.appendChild(card)
    })

    // If all models are downloaded, show a note
    const allDownloaded = supportedModels.every(m => localFiles.has(m.file))
    if (allDownloaded && supportedModels.length > 0) {
        availableList.innerHTML = '<p style="color:var(--muted);font-size:0.9rem">All available models are downloaded.</p>'
    }
}

async function updateHomeModelNotice() {
    const notice = document.getElementById('noModelNotice')
    if (!notice) return
    const ready = await window.electronAPI.checkModelReady()
    notice.classList.toggle('hidden', ready)
}

// Updates model availability across all screens
async function updateModelStatusForAll() {
    const els = document.querySelectorAll('.all-model-status')
    if (!els.length) return
    const ready = await window.electronAPI.checkModelReady()
    els.forEach(el => {
        if (ready) {
            el.className = 'all-model-status all-model-ready'
            el.innerHTML = '<span class="model-status-dot"></span> AI model downloaded and ready to mark'
        } else {
            el.className = 'all-model-status all-model-error'
            el.innerHTML = '⚠ No model downloaded. Go to <strong>Models</strong> to download one.'
        }
    })
}