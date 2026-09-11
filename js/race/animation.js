// ANIMATION.JS
// Circuit data loading and animation initialization

// Function for loading JSON data
// Fetches circuit coordinates and metadata from circuits.json
async function loadCircuitData(circuit) {
    const response = await fetch('./data/circuits.json');
    const data = await response.json();
    
    // Find the data for the specified circuit
    const circuitData = data.find(item => item.circuit === circuit);

    if (circuitData) {
        // Extract x and y coordinates into separate arrays
        cX = circuitData.coor.map(point => point[0]);
        cY = circuitData.coor.map(point => point[1]);
        circuit_map_length = cX.length;

        // Extract circuit properties
        circuitLength = circuitData.length;
        raceLength = circuitData.total;
        baseSpeed = circuitData.speed;
        country = circuitData.country;
        grandPrix = circuitData.grandPrix;

        // Apply sprint mode divisor if activated
        const isSprint = localStorage.getItem('isSprint') === 'true';
        if (isSprint) {
            const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
            const sprintDivisor = specialMode ? 6 : 3;
            raceLength = Math.ceil(raceLength / sprintDivisor);
            console.log('Sprint mode active - race distance:', raceLength, 'meters (~' + Math.ceil(raceLength / 1000) + 'km)');
        }

        // Get rain probability from selected circuit or default to 30%
        let rain = selectedCircuit && selectedCircuit.rain ? selectedCircuit.rain : 30;

        // Calculate derived values
        laps = Math.ceil(raceLength / circuitLength);
        pageWidth = window.innerWidth || document.documentElement.clientWidth || 1920;
        // Horizontal span of the car animation
        dist_per_pixel = 15000 / pageWidth;

        // Update RaceRecorder with full circuit metadata
        if (!recorderMetadataSet) {
            RaceRecorder.init({
                circuit: circuit,
                selectedCircuit: selectedCircuit,
                rainProbability: rain,
                driversInitial: drivers,
                driversCount: nb_driver,
                circuitLength: circuitLength,
                raceLength: raceLength,
                baseSpeed: baseSpeed,
                isSprint: isSprint
            });
            recorderMetadataSet = true;
        }

        // ===== CIRCUIT MAP DRAWING =====
        // Draw the circuit on canvas (minimap background)
        var canvas = document.getElementById("myCanvas");
        if (canvas.getContext) {
            var ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.lineWidth = "5";
            ctx.strokeStyle = "rgb(50,50,50)";
            ctx.fillStyle = 'black';
            ctx.moveTo(cX[0] / 5 + 750, -cY[0] / 5 + 350);
            for (let i = 1; i < 1038; i++) {
                ctx.lineTo(cX[i] / 5 + 750, -cY[i] / 5 + 350);
            }
            ctx.fill();
            ctx.stroke();
            ctx.closePath();
        }

        // Update UI with circuit/GP name and flag
        var countryNameHTML = document.getElementById("countryName");
        var countryFlagHTML = document.getElementById("countryFlag");

        countryNameHTML.innerText = "#" + String((selectedCircuit && selectedCircuit.displayCode) || circuit).toUpperCase() + "GP";
        countryFlagHTML.src = "img/flags/" + country.toLowerCase().replace(/ /g, "_") + ".png";

        // Load weather curves from localStorage (pre-generated in gp_select)
        const storedWeather = localStorage.getItem('weatherRace');
        if (storedWeather) {
            const w = JSON.parse(storedWeather);
            rainCurve = w.rainCurve;
            trackWaterCurve = w.trackWaterCurve;
            console.log('Weather curves loaded from localStorage (race)');
        } else {
            // Fallback: generate if not pre-computed
            [rainCurve, trackWaterCurve] = generateRainCurve(rain, 12600);
            console.warn('Weather curves not found in localStorage, generated as fallback');
        }
        computeWeatherForecast(); // Pre-compute 600-frame rolling forecast used by strategy
        applyWetStartConditions(); // If the track is wet at the start, put the field on rain tyres
        initFuelModel();          // Set per-race fuel loads now that raceLength is known
        console.log("Circuit data loaded for:", circuit);
        console.log("Race length:", raceLength, "meters");
        console.log("Total laps:", laps);

        // Start the animation after all data is loaded
        initAnimation();
    } else {
        throw new Error(`Circuit ${circuit} not found in circuits.json`);
    }
}

// Animation initialization function
// Called after circuit data is fully loaded. Pre-race ceremony over the frozen
// page: starting-grid intro -> F1 start lights -> the race starts on lights out.
function initAnimation() {
    console.log("Starting animation...");
    const lightsThenGo = () => {
        if (typeof showStartLights === 'function') showStartLights(move);
        else move();
    };
    if (typeof showStartingGrid === 'function') {
        showStartingGrid(lightsThenGo);
    } else {
        lightsThenGo();
    }
}

// ===== TURBO (fast-forward) =====
// Toggled by the "Skip" button (js/turbo_toggle.js). Doesn't jump to the
// result: it just runs several ticks per real-world timer callback instead
// of one, so the race keeps animating, only much faster. move() re-creates
// its interval at every ~30-tick chunk boundary regardless of mode, so a
// toggle takes effect within one chunk (well under a second) without
// anything else needing to react to it.
let turboMode = false;
const TURBO_TICK_MS = 0;  // browsers clamp this to a few ms once nested anyway
const TURBO_BATCH = 3;    // ticks driven per callback in turbo mode - the extra multiplier on top of TURBO_TICK_MS

function toggleTurboMode() {
    turboMode = !turboMode;
    return turboMode;
}

// Main animation loop start
// Sets up the main interval that calls frame() repeatedly
function move() {
    currentFrame = 0;
    let interval = setInterval(function() {
        if (turboMode) {
            // Drive several ticks per callback. Stop feeding this interval
            // the moment either becomes true:
            //  - a chunk boundary was hit and the race continues: frame()
            //    already cleared this interval and recursed into a fresh
            //    move() of its own (currentFrame drops back to 0 - further
            //    calls here would belong to that new interval, not this one);
            //  - the race just ended: frame() has already run its one-time
            //    RACE ENDED branch (podium, save, etc) - calling it again
            //    would duplicate all of that.
            for (let k = 0; k < TURBO_BATCH; k++) {
                const before = currentFrame;
                frame(interval);
                const stillRacing = leader_total_length <= raceLength && raceTimeLeft > 0 && eventTimeLeft > 0;
                if (currentFrame < before || !stillRacing) break;
            }
        } else {
            frame(interval);
        }
    }, turboMode ? TURBO_TICK_MS : (1000 / fps));
}
