// RACE_RECORDER.JS
// Module pour enregistrer TOUTES les variables de la course frame par frame
// Avec minification des clés pour économiser l'espace

const RaceRecorder = (() => {
    let recording = null;
    let isRecording = false;

    const MINIFIED_KEYS = {
        // Global state
        f: 'frame',
        rtL: 'raceTimeLeft',
        etL: 'eventTimeLeft',
        cl: 'currentLap',
        fs: 'flagState',
        ft: 'flagTimer',
        drs: 'drsEnabled',
        rr: 'rainyRace',
        g: 'grip',
        gf: 'gripFactor',
        cr: 'currentRain', // currentRain
        ctw: 'currentTrackWater',
        // Driver per-frame
        s: 'speed',
        tl: 'totalLength',
        st: 'state',
        tr: 'tire',
        trS: 'tireState',
        cs: 'carState',
        fu: 'fuel',
        m: 'mode',
        ps: 'pitStops',
        pt: 'pitTimer',
        clg: 'crossingLine',
        cp: 'carPerf',
        tp: 'tirePerf',
        // Positions
        pLx: 'pLx',
        pLy: 'pLy',
        pXx: 'pXx',
        pXy: 'pXy',
        tpx: 'tpx',
        tpy: 'tpy',
        typx: 'typx',
        typy: 'typy'
    };

    // Inverse map for storing
    const KEY_MAP = {};
    for (let short in MINIFIED_KEYS) {
        KEY_MAP[MINIFIED_KEYS[short]] = short;
    }

    function init(metadata) {
        recording = {
            m: { // metadata (minified)
                ts: new Date().toISOString(),
                c: metadata.circuit,
                sc: metadata.selectedCircuit,
                rp: metadata.rainProbability,
                di: metadata.driversInitial,  // ✅ Garder driversInitial ici
                cl: metadata.circuitLength,
                rl: metadata.raceLength,
                bs: metadata.baseSpeed
            },
            gs: [], // global state per frame
            dv: [] // drivers frames
        };
        
        // Initialize driver arrays
        for (let i = 0; i < metadata.driversCount; i++) {
            recording.dv.push({
                i: i,
                n: metadata.driversInitial[i].name,  // ✅ CORRIGÉ
                cd: metadata.driversInitial[i].code,  // ✅ CORRIGÉ
                tm: metadata.driversInitial[i].team_id,  // ✅ CORRIGÉ
                fr: [] // frames
            });
        }
        
        isRecording = true;
    }

    function recordPositions(positions) {
        if (!isRecording || !recording) return;
        // positions = { pLxPositions: [...], pLyPositions: [...], pXxPositions: [...], pXyPositions: [...], ... }
        // Store in the last global state frame
        if (recording.gs.length > 0) {
            const lastFrame = recording.gs[recording.gs.length - 1];
            lastFrame.pLx = positions.pLxPositions;
            lastFrame.pLy = positions.pLyPositions;
            lastFrame.pXx = positions.pXxPositions;
            lastFrame.pXy = positions.pXyPositions;
            lastFrame.tpx = positions.tpxPositions;
            lastFrame.tpy = positions.tpyPositions;
            lastFrame.typx = positions.typxPositions;
            lastFrame.typy = positions.typyPositions;
        }
    }

    function recordFrame(frameData, globalState, drivers) {
        if (!isRecording) return;

        // Record global state (minified)
        const minifiedGlobal = {
            f: frameData.raceFrame,
            rtL: globalState.raceTimeLeft,
            etL: globalState.eventTimeLeft,
            cl: frameData.currentLap,
            fs: mapFlagState(globalState.flagState),  // ✅ Convertir en chiffre
            ft: globalState.flagTimer,
            drs: globalState.drsEnabled,
            rr: globalState.rainyRace,
            g: globalState.grip,
            gf: globalState.gripFactor,
            cr: globalState.currentRain,
            ctw: globalState.currentTrackWater
        };
        recording.gs.push(minifiedGlobal);

        // Record driver states (minified) - Convert state, tire, mode to numeric values
        drivers.forEach((driver, idx) => {
            // Safety check: ensure recording entry exists for this driver index
            if (!recording.dv[idx]) {
                console.warn(`Recording entry missing for driver ${idx} - skipping frame data`);
                return;
            }
            
            const minifiedDriver = {
                s: driver.speed,
                tl: driver.totalLength,
                st: mapState(driver.state),        // ✅ Convertir en chiffre
                tr: mapTire(driver.tire),          // ✅ Convertir en chiffre
                trS: driver.tireState,
                cs: driver.carState,
                fu: driver.fuel,
                m: mapMode(driver.mode),           // ✅ Convertir en chiffre
                ps: driver.pitStops,
                pt: driver.pitTimer,
                clg: driver.crossingLine,
                cp: driver.carPerf,
                tp: driver.tirePerf
            };
            recording.dv[idx].fr.push(minifiedDriver);
        });
    }

    function stop() {
        isRecording = false;
        return recording;
    }

    function downloadRecording(recording) {
        const json = JSON.stringify(recording);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `race_${recording.m.c}_${timestamp}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    function getRecording() {
        return recording;
    }

    return {
        init,
        recordFrame,
        recordPositions,
        stop,
        downloadRecording,
        getRecording,
        KEY_MAP,
        MINIFIED_KEYS
    };
})();