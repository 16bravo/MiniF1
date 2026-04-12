// REPLAY_UI.JS
// Interface et interactions pour la relecture

let currentReplay = null;
let currentSelectedDriver = null;
let lastSelectedDriver = null;           // Track changes de pilote
let currentRaceStatVariable = null;
let currentDriverStatVariable = null;
let raceChartInstance = null;
let driverChartInstance = null;
let lastRaceStatVariable = null;  // Garde trace de la dernière var pour détecter les changements
let lastDriverStatVariable = null; // Garde trace de la dernière var pour détecter les changements
let playbackInterval = null;  // ✅ Variable globale pour control play/pause
let playbackFPS = 60;         // ✅ Variable globale pour FPS cible
let currentCursorFrame = 0;   // ✅ Position du curseur pour le plugin

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
    // Détecte si on a changé de pilote
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
    
    // Garde la même stat sélectionnée si elle existe, sinon vide
    if (currentDriverStatVariable && vars.includes(currentDriverStatVariable)) {
        select.value = currentDriverStatVariable;
        // Met à jour automatiquement le graphique avec la nouvelle donnée du pilote
        updateDriverStat();
    }
}

function updateRaceStat() {
    const select = document.getElementById('raceStatSelect');
    currentRaceStatVariable = select.value;
    
    if (!currentRaceStatVariable) return;
    
    // Si on a changé de variable sélectionnée, détruire l'ancien graphique
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
    
    // Crée le graphique une fois au lieu de le recréer à chaque frame
    initChart('raceStatChart', history, currentRaceStatVariable, 'race');
    updateChartCursor('raceStatChart', currentFrame, history, 'race');
}

function updateDriverStat() {
    if (currentSelectedDriver === null) return;
    
    const select = document.getElementById('driverStatSelect');
    currentDriverStatVariable = select.value;
    
    if (!currentDriverStatVariable) return;
    
    // Si on a changé de variable sélectionnée, détruire l'ancien graphique
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
    
    // Crée le graphique une fois au lieu de le recréer à chaque frame
    initChart('driverStatChart', history, currentDriverStatVariable, 'driver');
    updateChartCursor('driverStatChart', currentFrame, history, 'driver');
}

// Crée le graphique UNE SEULE FOIS avec toutes les données
function initChart(canvasId, data, label, type) {
    let chartInstance = type === 'race' ? raceChartInstance : driverChartInstance;
    
    // Si le graphique existe déjà, skip la création
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
            animation: false, // Désactive les animations pour pas ralentir
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        },
        plugins: [cursorLinePlugin]  // ✅ Ajoute le plugin barre verticale
    });
    
    if (type === 'race') raceChartInstance = chartInstance;
    else driverChartInstance = chartInstance;
}

// Met à jour SEULEMENT le curseur (très rapide)
function updateChartCursor(canvasId, currentFrame, data, type) {
    currentCursorFrame = currentFrame;  // ✅ Met à jour la position du curseur
    
    const chartInstance = type === 'race' ? raceChartInstance : driverChartInstance;
    
    if (!chartInstance) return;
    
    // Mise à jour ultra rapide (seulement le redraw du plugin)
    chartInstance.update('none'); // 'none' = pas d'animation
}

// ✅ CORRIGÉ: Gestion du play/pause
function togglePlay() {
    const btn = document.getElementById('playBtn');
    
    if (playbackInterval !== null) {
        // En train de jouer → Pause
        clearInterval(playbackInterval);
        playbackInterval = null;
        btn.textContent = '▶ Play';
    } else {
        // En pause → Play
        btn.textContent = '⏸ Pause';
        startPlayback();
    }
}

// ✅ CORRIGÉ: Fonction pour démarrer la lecture avec FPS cible
function startPlayback() {
    const totalFrames = RaceReplay.getTotalFrames();
    const frameDuration = 1000 / playbackFPS; // FPS cible (pas de frein)
    
    playbackInterval = setInterval(() => {
        const current = RaceReplay.getCurrentFrame();
        
        if (current >= totalFrames - 1) {
            // Fin de la course
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
    // Arrête la lecture si en cours
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
    // Arrête la lecture si en cours
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
    // Arrête la lecture si en cours
    if (playbackInterval !== null) {
        clearInterval(playbackInterval);
        playbackInterval = null;
        document.getElementById('playBtn').textContent = '▶ Play';
    }
    
    RaceReplay.seekToFrame(parseInt(value));
    updateFrame();
}

// ✅ Gestion FPS cible avec redémarrage de la lecture
function setPlaybackFPS(fps) {
    const wasPlaying = playbackInterval !== null;
    
    // Arrête la lecture actuelle
    if (playbackInterval !== null) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
    
    // Mise à jour FPS
    playbackFPS = Math.max(1, Math.min(240, parseInt(fps))); // Min 1, Max 240 FPS
    document.getElementById('fpsInput').value = playbackFPS;
    
    // Relance la lecture si elle était active
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

    // ✅ UTILISE LES POSITIONS ENREGISTRÉES
    ReplayAnimation.updateGlobalInfo(current, metadata);
    ReplayAnimation.updateAllPositions(current);
    
    // Update charts if variables selected
    if (currentRaceStatVariable) updateRaceStat();
    if (currentDriverStatVariable) updateDriverStat();
}



// ✅ Fonction helper pour la météo
function getWeatherDescription(currentRain) {
    if (currentRain > 0.5) return "Heavy Rain 🌧️";
    if (currentRain > 0) return "Light Rain 🌦️";
    if (currentRain > -0.25) return "Cloudy ☁️";
    return "Sunny ☀️";
}