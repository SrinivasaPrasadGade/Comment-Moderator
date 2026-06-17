let toxicityChart = null;
let currentFilter = 'all';

// Fetch and load dashboard stats and charts
async function loadDashboard() {
    try {
        const statsRes = await fetch(`${API_BASE_URL}/dashboard/stats`);
        if (!statsRes.ok) throw new Error('Stats fetch error');
        
        const stats = await statsRes.json();
        
        // Update stats widgets
        document.getElementById('stat-total').innerText = stats.total;
        document.getElementById('stat-approved').innerText = stats.approved;
        document.getElementById('stat-flagged').innerText = stats.flagged;
        document.getElementById('stat-avg-toxicity').innerText = `${Math.round(stats.avg_toxicity * 100)}%`;
        
        // Render or update chart
        renderChart(stats);
        
        // Render moderation queue
        await loadQueue();
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Render chart using Chart.js
function renderChart(stats) {
    const ctx = document.getElementById('toxicityChart').getContext('2d');
    
    // Destroy previous instance to avoid canvas bugs
    if (toxicityChart) {
        toxicityChart.destroy();
    }
    
    toxicityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Approved', 'Flagged', 'Rejected'],
            datasets: [{
                data: [stats.approved, stats.flagged, stats.rejected],
                backgroundColor: [
                    '#22c55e', // green
                    '#f59e0b', // yellow/orange
                    '#ef4444'  // red
                ],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: {
                            family: 'Inter',
                            size: 11
                        },
                        padding: 15
                    }
                }
            },
            cutout: '75%'
        }
    });
}

// Fetch queue and render based on active filter
async function loadQueue() {
    const queueList = document.getElementById('queue-list');
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/queue`);
        if (!response.ok) throw new Error('Failed to load queue');
        
        const queue = await response.json();
        queueList.innerHTML = '';
        
        const filteredQueue = queue.filter(item => {
            if (currentFilter === 'all') return true;
            return item.status === currentFilter;
        });

        if (filteredQueue.length === 0) {
            queueList.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 3rem;">
                    <i class="fa-solid fa-list-check" style="font-size: 2.2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No comments in this section.</p>
                </div>
            `;
            return;
        }

        filteredQueue.forEach(item => {
            const dateStr = new Date(item.timestamp).toLocaleString();
            const scorePercent = Math.round(item.toxicity_score * 100);
            
            // Score color based on severity
            let scoreColor = '#10b981';
            if (item.toxicity_score >= 0.75) scoreColor = '#ef4444';
            else if (item.toxicity_score >= 0.5) scoreColor = '#f59e0b';
            
            const li = document.createElement('div');
            li.className = `queue-item ${item.status}`;
            
            li.innerHTML = `
                <div class="comment-details">
                    <div class="comment-info">
                        <span class="comment-author">${escapeHTML(item.author)}</span>
                        <span class="comment-time">${dateStr}</span>
                        <span class="badge ${item.status}">${item.status}</span>
                    </div>
                    <p class="comment-text">"${escapeHTML(item.content)}"</p>
                    ${item.flagged_reason ? `<p class="comment-reason"><i class="fa-solid fa-triangle-exclamation"></i> Flagged: ${item.flagged_reason.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>` : ''}
                    
                    <div class="score-bar-wrapper">
                        <span class="score-lbl">Toxicity index:</span>
                        <div class="score-bar">
                            <div class="score-bar-fill" style="width: ${scorePercent}%; background-color: ${scoreColor};"></div>
                        </div>
                        <span style="font-size: 0.75rem; font-weight: 600; color: ${scoreColor}">${scorePercent}%</span>
                    </div>
                </div>
                
                <div class="comment-actions">
                    ${item.status !== 'approved' ? `
                        <button class="btn-action btn-approve" onclick="moderateComment(${item.id}, 'approved')" title="Approve Comment">
                            <i class="fa-solid fa-check"></i>
                        </button>
                    ` : ''}
                    ${item.status !== 'rejected' ? `
                        <button class="btn-action btn-reject" onclick="moderateComment(${item.id}, 'rejected')" title="Reject Comment">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            queueList.appendChild(li);
        });
    } catch (error) {
        console.error('Queue render error:', error);
    }
}

// Moderate action triggered by buttons
async function moderateComment(commentId, newStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/comments/${commentId}/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) throw new Error('Action failed');
        
        // Reload dashboard components
        await loadDashboard();
    } catch (error) {
        console.error('Moderation error:', error);
        alert('Failed to update comment status.');
    }
}

// Tab filtering handler
function filterQueue(status) {
    currentFilter = status;
    
    // Update active state in queue buttons
    document.querySelectorAll('.queue-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    loadQueue();
}
