const information = document.getElementById('info')
if (information) {
    information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`
}

const addGroupBtn = document.getElementById('addGroupBtn')
const clearGroupsBtn = document.getElementById('clearGroupsBtn')
const groupList = document.getElementById('groupList')
let groupCount = 0

function addGroup() {
    groupCount += 1
    const item = document.createElement('div')
    item.className = 'group-card'

    const label = document.createElement('span')
    label.textContent = `Group ${groupCount}`

    const deleteButton = document.createElement('button')
    deleteButton.className = 'delete-btn'
    deleteButton.textContent = 'Delete'
    deleteButton.addEventListener('click', () => {
        item.remove()
    })

    item.appendChild(label)
    item.appendChild(deleteButton)
    groupList.appendChild(item)
}

if (addGroupBtn && groupList) {
    addGroupBtn.addEventListener('click', addGroup)
}

if (clearGroupsBtn && groupList) {
    clearGroupsBtn.addEventListener('click', () => {
        groupList.innerHTML = ''
        groupCount = 0
    })
}
