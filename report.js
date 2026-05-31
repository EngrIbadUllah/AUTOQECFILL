document.addEventListener('DOMContentLoaded', () => {
    renderReport();
    document.getElementById('downloadCsv').addEventListener('click', downloadReport);
});

async function renderReport() {
    const data = await chrome.storage.local.get(['evaluationLog', 'exceptions']);
    const log = data.evaluationLog || [];
    const exceptions = data.exceptions || [];
    
    document.getElementById('reportDate').textContent = new Date().toLocaleDateString(undefined, { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    document.getElementById('totalCount').textContent = log.length;
    
    const exceptionMatches = log.filter(item => {
        return exceptions.some(ex => {
            const itemName = item.name.toLowerCase().trim();
            const exName = ex.name.toLowerCase().trim();
            return (item.type === ex.category) && (itemName.includes(exName) || exName.includes(itemName));
        });
    });
    document.getElementById('exceptionCount').textContent = exceptionMatches.length;
    
    if (log.length > 0) {
        document.getElementById('completionTime').textContent = log[log.length - 1].time;
    }

    const sectionsContainer = document.getElementById('reportSections');
    const types = ['Teacher', 'Online', 'Course'];
    
    let html = '';
    types.forEach(type => {
        const items = log.filter(item => item.type === type);
        if (items.length > 0) {
            html += `<div class="section-title">${type} Evaluations</div>`;
            html += `<table>
                <thead>
                    <tr>
                        <th>Subject / Teacher</th>
                        <th>Grade</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>`;
            
            items.forEach(item => {
                const matchingException = exceptions.find(ex => {
                    const itemName = item.name.toLowerCase().trim();
                    const exName = ex.name.toLowerCase().trim();
                    return (item.type === ex.category) && (itemName.includes(exName) || exName.includes(itemName));
                });

                html += `
                    <tr>
                        <td>${item.name}</td>
                        <td><span class="grade-badge">${item.grade}</span></td>
                        <td>
                            <span class="status-badge" style="color: ${matchingException ? 'var(--success-text)' : 'var(--subtext)'}">
                                ${matchingException ? '✓ Exception' : '○ Default'}
                            </span>
                        </td>
                    </tr>`;
            });
            html += `</tbody></table>`;
        }
    });

    if (html === '') {
        html = '<div style="text-align: center; padding: 80px; color: var(--subtext);">No evaluation data found.</div>';
    }
    sectionsContainer.innerHTML = html;
}

function downloadReport() {
    chrome.storage.local.get(['evaluationLog'], (data) => {
        const log = data.evaluationLog || [];
        let csv = 'Time,Type,Name,Grade\n';
        log.forEach(item => {
            csv += `${item.time},${item.type},"${item.name}",${item.grade}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QEC_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    });
}
