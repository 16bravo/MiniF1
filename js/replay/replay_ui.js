// REPLAY_UI.JS
// Interface and interactions for replay

let currentReplay = null;
let currentSelectedDriver = null;
let lastSelectedDriver = null;           // Track driver changes
let currentRaceStatVariable = null;
let currentDriverStatVariable = null;
let raceChartInstance = null;
let driverChartInstance = null;
let lastRaceStatVariable = null;  // Tracks the last race variable to detect changes
let lastDriverStatVariable = null; // Tracks the last driver variable to detect changes
let playbackInterval = null;  // Global variable for play/pause control
let playbackFPS = 60;         // Global variable for target FPS
let currentCursorFrame = 0;   // Cursor position for the plugin

// Plugin Chart.js pour afficher une barre verticale du curseur
const cursorLinePlugin = {
    id: 'cursorLine',
    afterDraw(chart) {
        if (!chart.scales.x) return;
        
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const ctx = chart.ctx;
        
        // Calcule la position x du curseur
        const x = xScale.getPixelForValue(currentCursorFrame);
        
        // Dessine la barre verticale rouge
        ctx.save();
        ctx.strokeStyle = '#f44336';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.restore();
    }
};

function loadReplay() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Veuillez sélectionner un fichier');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            currentReplay = data;
            RaceReplay.load(data);
            
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('replayContainer').style.display = 'flex';
            
            initReplayUI();
        } catch (err) {
            alert('Erreur lecture fichier: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function initReplayUI() {
    const totalFrames = RaceReplay.getTotalFrames();
    
    // Update slider max
    document.getElementById('frameSlider').max = totalFrames - 1;
    
    // Initialize FPS input
    document.getElementById('fpsInput').value = playbackFPS;
    
    // Build driver list
    const driverList = document.getElementById('driverList');
    driverList.innerHTML = '';
    
    for (let i = 0; i < currentReplay.dv.length; i++) {
        const driver = RaceReplay.getDriver(i);
        const btn = document.createElement('button');
        btn.textContent = `${driver.code}`;
        btn.className = 'driver-btn';
        btn.style.margin = '3px';
        btn.onclick = () => selectDriver(i);
        driverList.appendChild(btn);
    }
    
    updateFrame();
}

function selectDriver(driverIndex) {
    // Detect driver change
    if (lastSelectedDriver !== driverIndex) {
        if (driverChartInstance) {
            driverChartInstance.destroy();
            driverChartInstance = null;
        }
        lastSelectedDriver = driverIndex;
    }
    
    currentSelectedDriver = driverIndex;
    const driver = RaceReplay.getDriver(driverIndex);
    
    document.getElementById('driverStatsSection').style.display = 'block';
    document.getElementById('selectedDriverName').textContent = driver.name;
    
    // Build stat dropdown
    const vars = RaceReplay.getAvailableDriverVariables();
    const select = document.getElementById('driverStatSelect');
    select.innerHTML = '<option value="">-- Choose --</option>';
    
    vars.forEach(varName => {
        const option = document.createElement('option');
        option.value = varName;
        option.textContent = varName;
        select.appendChild(option);
    });
    
    // Keep the same selected stat if it still exists, otherwise reset
    if (currentDriverStatVariable && vars.includes(currentDriverStatVariable)) {
        select.value = currentDriverStatVariable;
        // Automatically update the chart with the new driver's data
        updateDriverStat();
    }
}

function updateRaceStat() {
    const select = document.getElementById('raceStatSelect');
    currentRaceStatVariable = select.value;
    
    if (!currentRaceStatVariable) return;
    
    // If the selected variable changed, destroy the old chart
    if (lastRaceStatVariable !== currentRaceStatVariable) {
        if (raceChartInstance) {
            raceChartInstance.destroy();
            raceChartInstance = null;
        }
        lastRaceStatVariable = currentRaceStatVariable;
    }
    
    const history = RaceReplay.getGlobalVariableHistory(currentRaceStatVariable);
    const currentFrame = RaceReplay.getCurrentFrame();
    
    const currentValue = history[currentFrame];
    document.getElementById('raceStatValue').textContent = 
        `${currentRaceStatVariable}: ${typeof currentValue === 'number' ? currentValue.toFixed(4) : currentValue}`;
    
    // Create chart once instead of recreating it every frame
    initChart('raceStatChart', history, currentRaceStatVariable, 'race');
    updateChartCursor('raceStatChart', currentFrame, history, 'race');
}

function updateDriverStat() {
    if (currentSelectedDriver === null) return;
    
    const select = document.getElementById('driverStatSelect');
    currentDriverStatVariable = select.value;
    
    if (!currentDriverStatVariable) return;
    
    // If the selected variable changed, destroy the old chart
    if (lastDriverStatVariable !== currentDriverStatVariable) {
        if (driverChartInstance) {
            driverChartInstance.destroy();
            driverChartInstance = null;
        }
        lastDriverStatVariable = currentDriverStatVariable;
    }
    
    const history = RaceReplay.getVariableHistory(currentSelectedDriver, currentDriverStatVariable);
    const currentFrame = RaceReplay.getCurrentFrame();
    
    const currentValue = history[currentFrame];
    document.getElementById('driverStatValue').textContent = 
        `${currentDriverStatVariable}: ${typeof currentValue === 'number' ? currentValue.toFixed(4) : currentValue}`;
    
    // Create chart once instead of recreating it every frame
    initChart('driverStatChart', history, currentDriverStatVariable, 'driver');
    updateChartCursor('driverStatChart', currentFrame, history, 'driver');
}

// Create the chart ONCE with all data
function initChart(canvasId, data, label, type) {
    let chartInstance = type === 'race' ? raceChartInstance : driverChartInstance;
    
    // If the chart already exists, skip creation
    if (chartInstance) return;
    
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    const chartData = {
        labels: data.map((_, i) => i),
        datasets: [
            {
                label: label,
                data: data,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76,175,80,0.1)',
                tension: 0.1,
                fill: true
            }
        ]
    };
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disable animations to avoid slowing down rendering
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        },
        plugins: [cursorLinePlugin]  // Adds the vertical bar plugin
    });
    
    if (type === 'race') raceChartInstance = chartInstance;
    else driverChartInstance = chartInstance;
}

// Update ONLY the cursor (very fast)
function updateChartCursor(canvasId, currentFrame, data, type) {
    currentCursorFrame = currentFrame;  // Update cursor position
    
    const chartInstance = type === 'race' ? raceChartInstance : driverChartInstance;
    
    if (!chartInstance) return;
    
    // Ultra-fast update (only redraws the plugin)
    chartInstance.update('none'); // 'none' = no animation
}

// Play/pause management
function togglePlay() {
    const btn = document.getElementById('playBtn');
    
    if (playbackInterval !== null) {
        // Currently playing → Pause
        clearInterval(playbackInterval);
        playbackInterval = null;
        btn.textContent = '▶ Play';
    } else {
        // Currently paused → Play
        btn.textContent = '⏸ Pause';
        startPlayback();
    }
}

// Function to start playback with target FPS
function startPlayback() {
    const totalFrames = RaceReplay.getTotalFrames();
    const frameDuration = 1000 / playbackFPS; // Target FPS (no cap)
    
    playbackInterval = setInterval(() => {
        const current = RaceReplay.getCurrentFrame();
        
        if (current >= totalFrames - 1) {
            // End of race
            clearInterval(playbackInterval);
            playbackInterval = null;
            document.getElementById('playBtn').textContent = '▶ Play';
            return;
        }
        
        RaceReplay.seekToFrame(current + 1);
        updateFrame();
    }, frameDuration);
}

function nextFrame() {
    // Stop playback if running
    if (playbackInterval !== null) {
        clearInterval(playbackInterval);
        playbackInterval = null;
        document.getElementById('playBtn').textContent = '▶ Play';
    }
    
    const current = RaceReplay.getCurrentFrame();
    RaceReplay.seekToFrame(current + 1);
    updateFrame();
}

function previousFrame() {
    // Stop playback if running
    if (playbackInterval !== null) {
        clearInterval(playbackInterval);
        playbackInterval = null;
        document.getElementById('playBtn').textContent = '▶ Play';
    }
    
    const current = RaceReplay.getCurrentFrame();
    RaceReplay.seekToFrame(current - 1);
    updateFrame();
}

function seekFrame(value) {
    // Stop playback if running
    if (playbackInterval !== null) {
        clearInterval(playbackInterval);
        playbackInterval = null;
        document.getElementById('playBtn').textContent = '▶ Play';
    }
    
    RaceReplay.seekToFrame(parseInt(value));
    updateFrame();
}

// Target FPS management with playback restart
function setPlaybackFPS(fps) {
    const wasPlaying = playbackInterval !== null;
    
    // Stop current playback
    if (playbackInterval !== null) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
    
    // Update FPS
    playbackFPS = Math.max(1, Math.min(240, parseInt(fps))); // Min 1, Max 240 FPS
    document.getElementById('fpsInput').value = playbackFPS;
    
    // Restart playback if it was active
    if (wasPlaying) {
        startPlayback();
    }
}



function updateFrame() {
    const totalFrames = RaceReplay.getTotalFrames();
    const current = RaceReplay.getCurrentFrame();
    const metadata = RaceReplay.getMetadata();
    
    document.getElementById('frameSlider').value = current;
    document.getElementById('frameLabel').textContent = `Frame: ${current} / ${totalFrames - 1}`;

    // USE RECORDED POSITIONS
    ReplayAnimation.updateGlobalInfo(current, metadata);
    ReplayAnimation.updateAllPositions(current);
    
    // Update charts if variables selected
    if (currentRaceStatVariable) updateRaceStat();
    if (currentDriverStatVariable) updateDriverStat();
}



// Helper function for weather
function getWeatherDescription(currentRain) {
    if (currentRain > 0.5) return "Heavy Rain 🌧️";
    if (currentRain > 0) return "Light Rain 🌦️";
    if (currentRain > -0.25) return "Cloudy ☁️";
    return "Sunny ☀️";
}