// RACE_REPLAY.JS
// Module pour relire une course enregistrée
// Ignore la simulation, lit les variables pré-enregistrées

const RaceReplay = (() => {
    let recording = null;
    let currentFrameIndex = 0;
    let isPlaying = false;
    let playbackSpeed = 1;
    let animationInterval = null;

    // UNMAPPED keys pour conversion
    const UNMAPPED_KEYS = {
        'f': 'frame', 'rtL': 'raceTimeLeft', 'etL': 'eventTimeLeft', 'cl': 'currentLap',
        'fs': 'flagState', 'ft': 'flagTimer', 'drs': 'drsEnabled', 'rr': 'rainyRace',
        'g': 'grip', 'gf': 'gripFactor', 'cr': 'currentRain', 'ctw': 'currentTrackWater',
        's': 'speed', 'tl': 'totalLength', 'st': 'state', 'tr': 'tire', 'trS': 'tireState',
        'cs': 'carState', 'fu': 'fuel', 'm': 'mode', 'ps': 'pitStops', 'pt': 'pitTimer',
        'clg': 'crossingLine', 'cp': 'carPerf', 'tp': 'tirePerf'
    };

    function unmapData(minifiedObj) {
        const result = {};
        for (let key in minifiedObj) {
            result[UNMAPPED_KEYS[key] || key] = minifiedObj[key];
        }
        return result;
    }

    function load(recordingData) {
        recording = recordingData;
        currentFrameIndex = 0;
        return recording;
    }

    function getMetadata() {
        return recording?.m || null;
    }

    function getTotalFrames() {
        return recording?.gs.length || 0;
    }

    function getGlobalStateAtFrame(frameIndex) {
        if (!recording || frameIndex >= recording.gs.length) return null;
        return unmapData(recording.gs[frameIndex]);
    }

    function getDriverStateAtFrame(driverIndex, frameIndex) {
        if (!recording || driverIndex >= recording.dv.length || 
            frameIndex >= recording.dv[driverIndex].fr.length) return null;
        return unmapData(recording.dv[driverIndex].fr[frameIndex]);
    }

    function getAllDriverStatesAtFrame(frameIndex) {
        const states = [];
        for (let i = 0; i < recording.dv.length; i++) {
            states[i] = getDriverStateAtFrame(i, frameIndex);
        }
        return states;
    }

    function getDriver(driverIndex) {
        if (!recording || driverIndex >= recording.dv.length) return null;
        return {
            index: recording.dv[driverIndex].i,
            name: recording.dv[driverIndex].n,
            code: recording.dv[driverIndex].cd,
            teamId: recording.dv[driverIndex].tm
        };
    }

    function getVariableHistory(driverIndex, variableName) {
        // Extract one variable for one driver across all frames
        const history = [];
        if (!recording || driverIndex >= recording.dv.length) return history;
        
        const minifiedKey = Object.keys(UNMAPPED_KEYS).find(k => UNMAPPED_KEYS[k] === variableName);
        if (!minifiedKey) return history;
        
        recording.dv[driverIndex].fr.forEach(frame => {
            history.push(frame[minifiedKey]);
        });
        return history;
    }

    function getGlobalVariableHistory(variableName) {
        // Extract one global variable across all frames
        const history = [];
        const minifiedKey = Object.keys(UNMAPPED_KEYS).find(k => UNMAPPED_KEYS[k] === variableName);
        if (!minifiedKey || !recording) return history;
        
        recording.gs.forEach(frame => {
            history.push(frame[minifiedKey]);
        });
        return history;
    }

    function seekToFrame(frameIndex) {
        currentFrameIndex = Math.max(0, Math.min(frameIndex, getTotalFrames() - 1));
    }

    function getCurrentFrame() {
        return currentFrameIndex;
    }

    function getAvailableGlobalVariables() {
        return ['raceTimeLeft', 'eventTimeLeft', 'currentLap', 'flagState', 'flagTimer', 
                'drsEnabled', 'rainyRace', 'grip', 'gripFactor', 'currentRain', 'currentTrackWater'];
    }

    function getAvailableDriverVariables() {
        return ['speed', 'totalLength', 'state', 'tire', 'tireState', 'carState', 'fuel', 
                'mode', 'pitStops', 'pitTimer', 'crossingLine', 'carPerf', 'tirePerf'];
    }

    function getPositionsAtFrame(frameIndex) {
        if (!recording || frameIndex >= recording.gs.length) return null;
        const frame = recording.gs[frameIndex];
        return {
            pLx: frame.pLx || [],
            pLy: frame.pLy || [],
            pXx: frame.pXx || [],
            pXy: frame.pXy || [],
            tpx: frame.tpx || [],
            tpy: frame.tpy || [],
            typx: frame.typx || [],
            typy: frame.typy || []
        };
    }

    return {
        load,
        getMetadata,
        getTotalFrames,
        getGlobalStateAtFrame,
        getDriverStateAtFrame,
        getAllDriverStatesAtFrame,
        getDriver,
        getVariableHistory,
        getGlobalVariableHistory,
        seekToFrame,
        getCurrentFrame,
        getAvailableGlobalVariables,
        getAvailableDriverVariables,
        getPositionsAtFrame,
        unmapData
    };
})();