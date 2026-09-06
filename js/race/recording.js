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
