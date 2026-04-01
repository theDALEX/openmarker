// ── Navigation ────────────────────────────────────────────────────────────────
const homeContent = document.getElementById('homeContent')
const groupDetail = document.getElementById('groupDetail')
const aboutContent = document.getElementById('aboutContent')
const helpContent = document.getElementById('helpContent')
const homeNav = document.getElementById('homeNav')
const aboutNav = document.getElementById('aboutNav')
const helpNav = document.getElementById('helpNav')
const backBtn = document.getElementById('backBtn')

function showView(view) {
    homeContent.classList.add('hidden')
    groupDetail.classList.add('hidden')
    aboutContent.classList.add('hidden')
    helpContent.classList.add('hidden')
    homeNav.classList.remove('active-nav')
    aboutNav.classList.remove('active-nav')
    helpNav.classList.remove('active-nav')

    if (view === 'home') { homeContent.classList.remove('hidden'); homeNav.classList.add('active-nav') }
    if (view === 'group') { groupDetail.classList.remove('hidden'); homeNav.classList.add('active-nav') }
    if (view === 'about') { aboutContent.classList.remove('hidden'); aboutNav.classList.add('active-nav') }
    if (view === 'help') { helpContent.classList.remove('hidden'); helpNav.classList.add('active-nav') }
}

homeNav.addEventListener('click', () => { showView('home'); loadGroups() })
aboutNav.addEventListener('click', () => { showView('about'); loadAboutContent() })
helpNav.addEventListener('click', () => { showView('help'); loadGuideContent(); updateGuideModelStatus() })
backBtn.addEventListener('click', () => { showView('home'); loadGroups() })

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'openHelpFromGroupBtn') {
        showView('help')
        loadGuideContent()
        updateGuideModelStatus()
    }
})
