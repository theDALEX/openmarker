// ── Navigation ────────────────────────────────────────────────────────────────
const homeContent = document.getElementById('homeContent')
const groupDetail = document.getElementById('groupDetail')
const aboutContent = document.getElementById('aboutContent')
const helpContent = document.getElementById('helpContent')
const modelsContent = document.getElementById('modelsContent')
const homeNav = document.getElementById('homeNav')
const aboutNav = document.getElementById('aboutNav')
const helpNav = document.getElementById('helpNav')
const modelsNav = document.getElementById('modelsNav')
const backBtn = document.getElementById('backBtn')

function showView(view) {
    homeContent.classList.add('hidden')
    groupDetail.classList.add('hidden')
    aboutContent.classList.add('hidden')
    helpContent.classList.add('hidden')
    modelsContent.classList.add('hidden')
    homeNav.classList.remove('active-nav')
    aboutNav.classList.remove('active-nav')
    helpNav.classList.remove('active-nav')
    modelsNav.classList.remove('active-nav')

    if (view === 'home') { homeContent.classList.remove('hidden'); homeNav.classList.add('active-nav') }
    if (view === 'group') { groupDetail.classList.remove('hidden'); homeNav.classList.add('active-nav') }
    if (view === 'about') { aboutContent.classList.remove('hidden'); aboutNav.classList.add('active-nav') }
    if (view === 'help') { helpContent.classList.remove('hidden'); helpNav.classList.add('active-nav') }
    if (view === 'models') { modelsContent.classList.remove('hidden'); modelsNav.classList.add('active-nav') }
}

homeNav.addEventListener('click', () => { showView('home'); loadGroups(); updateHomeModelNotice() })
modelsNav.addEventListener('click', () => { showView('models'); loadModelsSection() })
aboutNav.addEventListener('click', () => { showView('about'); loadAboutContent() })
groupDetail.addEventListener('click', () => { updateModelStatusForAll(); })
helpNav.addEventListener('click', () => { showView('help'); loadGuideContent(); updateModelStatusForAll(); })
backBtn.addEventListener('click', () => { showView('home'); loadGroups() })
