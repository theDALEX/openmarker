// ── App icon ──────────────────────────────────────────────────────────────────
async function loadAppIcon() {
    if (!window.electronAPI) return
    const iconPath = await window.electronAPI.getIcon()
    document.getElementById('appIcon').src = iconPath
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadAppIcon()
showView('home')
loadGroups()
initModelListeners()
updateHomeModelNotice()
