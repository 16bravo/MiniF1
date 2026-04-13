// RECORDING.JS
// Race recording wrapper functions

// Function to initialize the race recorder with full metadata
function initRaceRecorder() {
    RaceRecorder.init({
        circuit: circuit,
        selectedCircuit: selectedCircuit,
        rainProbability: selectedCircuit?.rain || 30,
        driversInitial: drivers,
        driversCount: nb_driver,
        circuitLength: null, // Will be set after loadCircuitData
        raceLength: null,
        baseSpeed: null
    });
}

// Function to record current frame state
// Called every frame during the simulation
function recordCurrentFrame(frameData, sessionData, driversSnapshot) {
    RaceRecorder.recordFrame(frameData, sessionData, driversSnapshot);
}

// Function to record position data for animation replay
// Called every animation cycle to store UI element positions
function recordCurrentPositions(positionData) {
    RaceRecorder.recordPositions(positionData);
}

// Function to stop recording and return the data
function stopRecording() {
    return RaceRecorder.stop();
}

// Function to show and download the race recording
function downloadRaceRecording(recording) {
    RaceRecorder.downloadRecording(recording);
}

// Function to show the championship button and save results
function showChampionshipResultsButton() {
    if (localStorage.getItem('championshipActive') === 'true') {
        const btn = document.createElement('button');
        btn.id = 'championshipResultsBtn';
        btn.textContent = 'Show Championship';
        btn.className = 'championshipResultsBtn';
        btn.onclick = () => {
            let championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
            const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
            // Sort drivers by totalLength (descending) before saving to match displayed order
            const sortedDrivers = [...drivers].sort((a, b) => b.totalLength - a.totalLength);
            championshipResults[currentRaceIndex] = sortedDrivers;
            localStorage.setItem('championshipResults', JSON.stringify(championshipResults));
            window.location.href = 'gp_select.html';
        };
        document.body.appendChild(btn);
    }
}
