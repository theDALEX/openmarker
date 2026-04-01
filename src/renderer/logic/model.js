// ── Model auto-download banner ─────────────────────────────────────────────────
const modelDownloadBanner = document.getElementById('modelDownloadBanner')

function setGuideModelStatus(state, percent, finalizing) {
    const el = document.getElementById('guideModelStatus')
    if (!el) return
    if (state === 'ready') {
        el.className = 'guide-model-status guide-model-ready'
        el.innerHTML = '<span class="model-status-dot"></span> AI model downloaded and ready to mark'
    } else if (state === 'downloading') {
        el.className = 'guide-model-status guide-model-downloading'
        const label = finalizing ? 'Saving to disk...' : `Downloading AI model... ${percent}%`
        el.innerHTML = `<span class="model-status-bar-wrap"><span class="model-status-bar-fill" style="width:${percent}%"></span></span> ${label}`
    } else if (state === 'error') {
        el.className = 'guide-model-status guide-model-error'
        el.innerHTML = '⚠ Model download failed. Restart the app to retry.'
    }
}

function initModelDownload() {
    window.electronAPI.removeModelListeners()

    window.electronAPI.onModelReady((data) => {
        if (data.alreadyExists) {
            modelDownloadBanner.classList.add('hidden')
        } else {
            modelDownloadBanner.className = 'model-banner model-banner-success'
            modelDownloadBanner.textContent = '✓ AI model downloaded and ready.'
            setTimeout(() => modelDownloadBanner.classList.add('hidden'), 4000)
        }
        setGuideModelStatus('ready')
    })

    window.electronAPI.onModelDownloadProgress((data) => {
        modelDownloadBanner.classList.remove('hidden')
        modelDownloadBanner.className = 'model-banner model-banner-progress'
        if (data.finalizing) {
            modelDownloadBanner.textContent = `⬇ Saving model to disk...`
            setGuideModelStatus('downloading', 100, true)
        } else {
            modelDownloadBanner.textContent = `⬇ Downloading AI model... ${data.percent}%  (${(data.downloadedBytes / 1024 / 1024).toFixed(0)} / ${(data.totalBytes / 1024 / 1024).toFixed(0)} MB)`
            setGuideModelStatus('downloading', data.percent, false)
        }
    })

    window.electronAPI.onModelDownloadError((data) => {
        modelDownloadBanner.classList.remove('hidden')
        modelDownloadBanner.className = 'model-banner model-banner-error'
        modelDownloadBanner.textContent = `⚠ Model download failed: ${data.error}`
        setGuideModelStatus('error')
    })

    window.electronAPI.notifyRendererReady()
}

async function updateGuideModelStatus() {
    const ready = await window.electronAPI.checkModelReady()
    if (ready) setGuideModelStatus('ready')
}
