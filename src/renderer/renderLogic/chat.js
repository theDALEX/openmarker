// ── Chat ──────────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages')
const chatInput = document.getElementById('chatInput')
const chatSendBtn = document.getElementById('chatSendBtn')
const chatStatus = document.getElementById('chatStatus')

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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
    chatStatus.textContent = 'Loading...'
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
