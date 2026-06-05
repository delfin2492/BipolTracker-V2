let detailChart = null;
let currentBusId = null;
let rawLogData = [];
let currentTab = 'co2';

window.openBusDetailSheet = async function (bus) {
    console.log("Opening bottom sheet for:", bus.bus_id);
    currentBusId = bus.bus_id;

    // Update DOM instantly with current data
    document.getElementById('detail-bus-name').innerText = bus.bus_id;
    document.getElementById('detail-speed').innerText = bus.speed;
    document.getElementById('detail-gas').innerText = bus.gas_level;
    document.getElementById('detail-co2').innerText = bus.co2 !== undefined ? bus.co2 : 0;

    // Show sheet
    document.getElementById('bus-detail-sheet').classList.add('active');

    // Fetch history
    try {
        console.log("Fetching logs from API...");
        const res = await fetch(`/api/bus/${encodeURIComponent(bus.bus_id)}/logs?limit=40`);
        const json = await res.json();
        console.log("Received data:", json);
        if (json.data) {
            rawLogData = json.data;
            renderChart();
        }
    } catch (e) {
        console.error('Failed to fetch bus logs', e);
    }
};

window.updateBusDetailSheet = function (bus) {
    if (currentBusId !== bus.bus_id) return;
    
    // Update text
    document.getElementById('detail-speed').innerText = bus.speed;
    document.getElementById('detail-gas').innerText = bus.gas_level;
    document.getElementById('detail-co2').innerText = bus.co2 !== undefined ? bus.co2 : 0;

    // Push new data to array if chart is open
    if (rawLogData && rawLogData.length > 0) {
        rawLogData.push(bus);
        if (rawLogData.length > 40) rawLogData.shift(); // keep max 40
        renderChart();
    }
};

window.closeBusDetailSheet = function () {
    document.getElementById('bus-detail-sheet').classList.remove('active');
    currentBusId = null;
};

window.switchChartTab = function (tab, element) {
    currentTab = tab;
    document.querySelectorAll('.chart-tab').forEach(el => el.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }
    renderChart();
};

function renderChart() {
    console.log("Rendering chart with", rawLogData.length, "data points");
    const ctx = document.getElementById('busDetailChart').getContext('2d');
    
    if (!rawLogData || !rawLogData.length) {
        // Clear chart if no data
        if (detailChart) detailChart.destroy();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "14px Outfit";
        ctx.fillStyle = "#6b7280";
        ctx.textAlign = "center";
        ctx.fillText("Menunggu data historis...", ctx.canvas.width/2, ctx.canvas.height/2);
        return;
    }

    try {
        // Labels: time HH:MM:SS
        const labels = rawLogData.map(log => {
            const d = new Date(log.created_at);
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        });

        let dataPoints = [];
        let label = '';
        let color = '';
        let bgColor = '';

        if (currentTab === 'co2') {
            dataPoints = rawLogData.map(log => log.co2 || 0);
            label = 'CO2 (PPM)';
            color = '#10b981';
            bgColor = 'rgba(16, 185, 129, 0.2)';
        } else if (currentTab === 'gas') {
            dataPoints = rawLogData.map(log => log.gas_level || 0);
            label = 'CO Level';
            color = '#f59e0b';
            bgColor = 'rgba(245, 158, 11, 0.2)';
        } else if (currentTab === 'speed') {
            dataPoints = rawLogData.map(log => log.speed || 0);
            label = 'Speed (km/h)';
            color = '#0ea5e9';
            bgColor = 'rgba(14, 165, 233, 0.2)';
        }

        if (detailChart) {
            detailChart.destroy();
        }

        detailChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: bgColor,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 10,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: { size: 11 },
                        bodyFont: { size: 13, weight: 'bold' }
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            maxTicksLimit: 5,
                            font: { size: 10 }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    } catch (err) {
        console.error("Error drawing chart:", err);
    }
}
