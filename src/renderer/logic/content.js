// ── About & Help content loaders ──────────────────────────────────────────────
async function loadAboutContent() {
    try {
        const response = await fetch('../data/about.json')
        const content = await response.json()
        document.getElementById('aboutHeader').innerHTML = `
         <h3>${content.appName}</h3>
         <p>Version: ${content.version}</p>
         <p>${content.description}</p>
        `
        document.getElementById('aboutMeta').innerHTML = `
        <p><strong>Website:</strong> <a href="${content.website}" target="_blank">Visit</a></p>
        <p><strong>GitHub:</strong> <a href="${content.github}" target="_blank">Visit</a></p>
        <p><strong>License:</strong> ${content.license}</p>
        <p><strong>Developer:</strong> <a href="${content.developerWebsite}" target="_blank">${content.developer}</a></p>
        `
        if (content.model) {
            const m = content.model
            document.getElementById('aboutModel').innerHTML = `
            <hr style="margin: 16px 0; border-color: var(--border)">
            <h3>AI Model</h3>
            <p><strong>${m.name}</strong></p>
            <p>${m.description}</p>
            <p><strong>Quantization:</strong> ${m.quantization} &nbsp;|&nbsp; <strong>RAM Required:</strong> ${m.ramRequired} &nbsp;|&nbsp; <strong>File Size:</strong> ${m.fileSize}</p>
            <p><strong>License:</strong> ${m.license} &nbsp;|&nbsp; <strong>Source:</strong> <a href="${m.source}" target="_blank">Hugging Face</a></p>
            `
        }
    } catch (err) {
        console.error('Failed to load about.json', err)
    }
}

async function loadGuideContent() {
    const helpBody = document.getElementById('helpBody')
    try {
        const response = await fetch('../data/guide.json')
        const content = await response.json()

        let formatsHTML = ''
        if (content.help.supportedFormats) {
            const sf = content.help.supportedFormats
            formatsHTML = `
            <h3>${sf.title}</h3>
            <table border="1" style="border-collapse:collapse; width:100%; margin-bottom:8px;">
                <tr><th style="padding:6px 10px">Extension</th><th style="padding:6px 10px">Type</th><th style="padding:6px 10px">Notes</th></tr>
                ${sf.formats.map(f => `<tr><td style="padding:6px 10px"><code>${f.ext}</code></td><td style="padding:6px 10px">${f.type}</td><td style="padding:6px 10px">${f.notes}</td></tr>`).join('')}
            </table>
            <p style="font-size:0.88rem">${sf.matrixNote}</p>`
        }

        let tableHTML = `
            <h4>${content.help.markingMatrix.scheme.title}</h4>
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr>
                    <th>Grade</th><th>Percentage</th>
                    <th>Task 1: Network Design and Configuration [35%]</th>
                    <th>Task 2: Network Connectivity Testing [35%]</th>
                    <th>Task 3: Reporting [30%]</th>
                </tr>`

        content.help.markingMatrix.scheme.grades.forEach(grade => {
            tableHTML += `
                <tr>
                    <td>${grade.grade}</td><td>${grade.percentage}</td>
                    <td>${grade.task1}</td><td>${grade.task2}</td><td>${grade.task3}</td>
                </tr>`
        })
        tableHTML += `</table><p><em>${content.help.markingMatrix.scheme.department}</em></p>`

        helpBody.innerHTML = `
            <h3>${content.help.fileNamingConvention.title}</h3>
            <p>${content.help.fileNamingConvention.content}</p>
            ${formatsHTML}
            <h3>${content.help.markingMatrix.title}</h3>
            <p>${content.help.markingMatrix.importance}</p>
            ${tableHTML}
            <p>${content.help.futureNote}</p>
        `
    } catch (err) {
        helpBody.textContent = 'Unable to load guide.'
    }
}
