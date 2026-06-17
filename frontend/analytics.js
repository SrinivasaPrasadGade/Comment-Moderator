/**
 * analytics.js — Real-Time Analytics Dashboard Controller
 * Polls GET /api/stats every 5 seconds and renders:
 *   - 3 stat cards (total messages, flagged count, avg toxicity)
 *   - Toxicity score line chart (last 50 messages)
 *   - Flag category breakdown bar chart
 */

let toxicityLineChart = null;
let categoryBarChart = null;
let analyticsInterval = null;

function getThemeColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        isLight,
        main: isLight ? '#000000' : '#ffffff',
        grid: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.04)',
        text: isLight ? '#64748b' : '#6b7280',
        label: isLight ? '#334155' : '#d1d5db',
        barBgs: isLight ? [
            'rgba(0, 0, 0, 0.8)',
            'rgba(0, 0, 0, 0.6)',
            'rgba(0, 0, 0, 0.5)',
            'rgba(0, 0, 0, 0.4)',
            'rgba(0, 0, 0, 0.7)',
            'rgba(0, 0, 0, 0.9)',
        ] : [
            'rgba(255, 255, 255, 0.8)',
            'rgba(200, 200, 200, 0.8)',
            'rgba(160, 160, 160, 0.8)',
            'rgba(220, 220, 220, 0.8)',
            'rgba(180, 180, 180, 0.8)',
            'rgba(255, 255, 255, 1.0)',
        ]
    };
}

function updateChartColors() {
    const theme = getThemeColors();

    if (toxicityLineChart) {
        toxicityLineChart.data.datasets[0].borderColor = theme.main;
        toxicityLineChart.data.datasets[0].backgroundColor = createLineGradient(document.getElementById('toxicityLineChart'), theme.isLight);
        
        const pointColors = toxicityLineChart.data.datasets[0].pointBackgroundColor.map(c => {
            return (c === '#ef4444') ? '#ef4444' : theme.main; 
        });
        const pointBorderColors = toxicityLineChart.data.datasets[0].pointBorderColor.map(c => {
            return (c === '#fca5a5') ? '#fca5a5' : (theme.isLight ? '#64748b' : '#e4e4e7'); 
        });
        toxicityLineChart.data.datasets[0].pointBackgroundColor = pointColors;
        toxicityLineChart.data.datasets[0].pointBorderColor = pointBorderColors;
        
        toxicityLineChart.options.scales.x.grid.color = theme.grid;
        toxicityLineChart.options.scales.y.grid.color = theme.grid;
        toxicityLineChart.options.scales.x.ticks.color = theme.text;
        toxicityLineChart.options.scales.y.ticks.color = theme.text;
        toxicityLineChart.update('none');
    }

    if (categoryBarChart) {
        categoryBarChart.data.datasets[0].backgroundColor = theme.barBgs;
        categoryBarChart.data.datasets[0].borderColor = theme.main;
        categoryBarChart.options.scales.x.grid.color = theme.grid;
        categoryBarChart.options.scales.x.ticks.color = theme.text;
        categoryBarChart.options.scales.y.ticks.color = theme.label;
        categoryBarChart.update('none');
    }
    
    const legendDot = document.querySelector('.legend-dot');
    if (legendDot) legendDot.style.background = theme.main;
}


/**
 * Start polling the analytics endpoint.
 * Called when the user navigates to the Analytics tab.
 */
function startAnalyticsPolling() {
    // Fetch immediately on tab switch
    fetchAnalytics();

    // Clear any previous interval to prevent duplicates
    if (analyticsInterval) clearInterval(analyticsInterval);

    // Poll every 5 seconds
    analyticsInterval = setInterval(fetchAnalytics, 5000);
}

/**
 * Stop polling (called when leaving the analytics tab).
 */
function stopAnalyticsPolling() {
    if (analyticsInterval) {
        clearInterval(analyticsInterval);
        analyticsInterval = null;
    }
}


/**
 * Fetch data from /api/stats and update all dashboard components.
 */
async function fetchAnalytics() {
    try {
        const res = await fetch(window.location.origin + '/api/stats');
        if (!res.ok) throw new Error(`Stats API error: ${res.status}`);
        const data = await res.json();

        updateStatCards(data);
        updateToxicityLineChart(data.recent_scores);
        updateCategoryBarChart(data.category_counts);
    } catch (err) {
        console.error('[Analytics] Fetch failed:', err);
    }
}


// ─── Stat Cards ──────────────────────────────────────────────────

function updateStatCards(data) {
    const totalEl = document.getElementById('analytics-total');
    const flaggedEl = document.getElementById('analytics-flagged');
    const avgEl = document.getElementById('analytics-avg-tox');
    const pctEl = document.getElementById('analytics-flagged-pct');

    // Animate flash effect when values change
    animateValue(totalEl, data.total_messages);
    animateValue(flaggedEl, data.flagged_count);
    animateValue(avgEl, `${Math.round(data.avg_toxicity * 100)}%`);

    pctEl.textContent = `${data.flagged_pct}% of total`;
}

function animateValue(el, newValue) {
    const strValue = String(newValue);
    if (el.textContent !== strValue) {
        el.textContent = strValue;
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 600);
    }
}


// ─── Toxicity Line Chart ─────────────────────────────────────────

function updateToxicityLineChart(recentScores) {
    const ctx = document.getElementById('toxicityLineChart');
    if (!ctx) return;

    const theme = getThemeColors();
    const labels = recentScores.map((_, i) => `#${i + 1}`);
    const scores = recentScores.map(s => Math.round(s.toxicity_score * 100));
    const flagged = recentScores.map(s => s.flagged);

    // Point colors: red for flagged, main color for safe
    const pointColors = flagged.map(f => f ? '#ef4444' : theme.main);
    const pointBorderColors = flagged.map(f => f ? '#fca5a5' : (theme.isLight ? '#64748b' : '#e4e4e7'));

    if (toxicityLineChart) {
        // Update data without destroying — smooth transitions
        toxicityLineChart.data.labels = labels;
        toxicityLineChart.data.datasets[0].data = scores;
        toxicityLineChart.data.datasets[0].pointBackgroundColor = pointColors;
        toxicityLineChart.data.datasets[0].pointBorderColor = pointBorderColors;
        toxicityLineChart.update('none'); // Skip animation for live updates
        return;
    }

    toxicityLineChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Toxicity %',
                    data: scores,
                    borderColor: theme.main,
                    borderWidth: 2.5,
                    backgroundColor: createLineGradient(ctx, theme.isLight),
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointBorderColors,
                    pointBorderWidth: 2,
                    clip: false
                },
                {
                    // Horizontal threshold line at 80%
                    label: 'Threshold (80%)',
                    data: Array(labels.length).fill(80),
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    borderWidth: 2,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    fill: false,
                    clip: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 12, bottom: 12, left: 5, right: 5 }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    grid: {
                        color: theme.grid,
                        drawBorder: false,
                    },
                    ticks: {
                        color: theme.text,
                        font: { family: 'Inter', size: 10 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 15,
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: theme.grid,
                        drawBorder: false,
                    },
                    ticks: {
                        color: theme.text,
                        font: { family: 'Inter', size: 11 },
                        callback: v => v + '%',
                        stepSize: 20,
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 20, 35, 0.92)',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', size: 13, weight: '600' },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: items => `Message ${items[0].label}`,
                        label: item => {
                            if (item.datasetIndex === 1) return null; // skip threshold in tooltip
                            return `Toxicity: ${item.raw}%`;
                        }
                    }
                }
            }
        }
    });
}

function createLineGradient(canvas, isLight) {
    const ctx2d = canvas.getContext('2d');
    const gradient = ctx2d.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 320);
    const rgb = isLight ? '0, 0, 0' : '255, 255, 255';
    gradient.addColorStop(0, `rgba(${rgb}, 0.25)`);
    gradient.addColorStop(0.5, `rgba(${rgb}, 0.08)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    return gradient;
}


// ─── Category Bar Chart ──────────────────────────────────────────

function updateCategoryBarChart(categoryCounts) {
    const ctx = document.getElementById('categoryBarChart');
    if (!ctx) return;

    const theme = getThemeColors();
    // Define the canonical categories we always want to show
    const allCategories = ['toxicity', 'obscene', 'insult', 'threat', 'identity_attack', 'severe_toxicity'];
    const labels = allCategories.map(formatLabel);
    const counts = allCategories.map(c => categoryCounts[c] || 0);

    if (categoryBarChart) {
        categoryBarChart.data.datasets[0].data = counts;
        categoryBarChart.update('none');
        return;
    }

    categoryBarChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Flagged Count',
                data: counts,
                backgroundColor: theme.barBgs,
                borderColor: theme.main,
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.7,
                categoryPercentage: 0.7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bars
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: theme.grid,
                        drawBorder: false,
                    },
                    ticks: {
                        color: theme.text,
                        font: { family: 'Inter', size: 11 },
                        precision: 0,
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: theme.label,
                        font: { family: 'Outfit', size: 12, weight: '500' },
                        padding: 8,
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 20, 35, 0.92)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', size: 13, weight: '600' },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: item => `${item.raw} flagged messages`
                    }
                }
            }
        }
    });
}


/**
 * Format category labels for display.
 * 'identity_attack' → 'Identity Attack', 'severe_toxicity' → 'Severe Toxicity'
 */
function formatLabel(key) {
    return key
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}


// ─── Lifecycle ───────────────────────────────────────────────────

// Override the tab switch to properly stop/start polling
const _origSwitchTab = typeof switchTab === 'function' ? switchTab : null;
(function patchSwitchTab() {
    // Monkey-patch: stop analytics polling when navigating away
    const origHandler = document.querySelectorAll('.nav-item');
    origHandler.forEach(item => {
        item.addEventListener('click', () => {
            const isAnalytics = item.id === 'nav-analytics';
            if (!isAnalytics) {
                stopAnalyticsPolling();
            }
        });
    });
})();
