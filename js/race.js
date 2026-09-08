// RACE.JS
// Main race module - initializes data and orchestrates race simulation
// Uses modules: utils, weather, tires, physics, ranking, flags, pits, drs, animation, recording, simulation

// =====================================================
// SPRINT GRID GENERATION (for Special Championship Mode)
// =====================================================

/**
 * Generate sprint race grid by inverting top 10 of qualifying/previous sprint
 * Handles missing drivers and newcomers
 * @param {Array} currentRanking - Current ranking from quali or previous sprint
 * @returns {Array} - New grid with inverted top 10
 */
function generateSprintGrid(currentRanking) {
    if (!Array.isArray(currentRanking) || currentRanking.length === 0) {
        return currentRanking;
    }
    
    // Extract top 10 and rest (P11+)
    const top10 = currentRanking.slice(0, 10);
    const rest = currentRanking.slice(10);
    
    // Invert top 10: P1→P10, P2→P9, etc.
    const invertedTop10 = top10.reverse();
    
    // Combine inverted top 10 + rest
    const newGrid = [...invertedTop10, ...rest];
    
    console.log('Sprint grid generated - top 10 inverted');
    return newGrid;
}

// =====================================================
// GLOBAL VARIABLES (accessible to all modules)
// =====================================================

// RACE TIMING
const MAX_RACE_TIME = 7200; // Maximum race time (2h = 7200 seconds/frames)
const MAX_EVENT_TIME = 10800; // Maximum event time (3h = 10800 seconds/frames)
let raceTimeLeft = MAX_RACE_TIME; // Race time remaining
let eventTimeLeft = MAX_EVENT_TIME; // Event time remaining
let raceFrame = 0; // Global frame counter

// WEATHER
const MAX_WEATHER_FRAMES = 12600; // 3h30 weather simulation duration
let rainCurve = []; // Rain intensity curve for the race
let trackWaterCurve = []; // Track water accumulation curve
let rainyRace = false; // Flag for mandatory wet pit stops
// Weather regime: rain-tyre strategy is (re)decided ONLY when this flips, then latched.
// Continuously recomputing a tyre target from the live forecast made midfield cars
// ping-pong between compounds and pit every few seconds.
let weatherRegime = 'dry';           // 'dry' | 'wet'
let weatherRegimeChangedFrame = -1;  // frame of the last regime change (drivers replan then)
let grip = 0.75; // Current track grip (0-1, updated each frame)
let gripFactor = (1 / (1 + Math.exp(-10 * (grip - 0.5))) * 0.2) + 0.8; // Grip performance multiplier

// FLAGS AND SAFETY CAR
let flagState = "green"; // Current flag state: 'green', 'yellow', 'safetycar', 'red'
let flagTimer = 0; // Frame counter for flag duration
let lastGreenFrame = -9999; // Frame of the last green-flag restart (cold-tyre mistake window)
let safetyCarLapCount = 0; // Counter for safety car laps
let redFlagClassification = null; // Driver order saved under red flag for restart

// DRS (Drag Reduction System)
let drsEnabled = false; // DRS disabled by default

// CUMULATIVE DAMAGE TRACKING
let cumulativeDamage = 0;      // Total damage accumulated in current window
let damageWindowStartFrame = 0; // Frame when current damage window started
const DAMAGE_WINDOW = 300;      // Track damage over 300 frames
const DAMAGE_RED_FLAG_THRESHOLD = 2.5; // Red flag if damage > 2.5

// PIT STRATEGY
const MANDATORY_PITS = 1; // Mandatory pit stops (0 if rainy race)
let weatherForecast = []; // Pre-computed forecast {max, avg} per frame

// CIRCUIT DATA
const selectedCircuit = JSON.parse(localStorage.getItem('selectedCircuit'));
let baseLapTime, country, grandPrix, circuit, overtaking, difficulty;
if (selectedCircuit) {
    // Same formula as quali.js (speed is a km/h-ish figure; the 1015 factor keeps both in sync)
    baseLapTime = selectedCircuit.length / ((selectedCircuit.speed * 1015) / 3600);
    country = selectedCircuit.country;
    grandPrix = selectedCircuit.grandPrix;
    circuit = selectedCircuit.circuit;
    overtaking = selectedCircuit.overtaking; // 0-100 scale: 0 = easy to overtake (90%), 100 = hard to overtake (10%)
    difficulty = selectedCircuit.difficulty; // Adjusted difficulty factor
    console.log('Selected Circuit:', selectedCircuit.circuit);
    console.log('Grand Prix:', grandPrix);
    console.log('Country:', country);
    console.log('Lap Time:', baseLapTime);
} else {
    alert('No Grand Prix selected.');
}

// DRIVERS DATA
const isChampionship = localStorage.getItem('championshipActive') === 'true';
const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
const isSprint = localStorage.getItem('isSprint') === 'true';

let driversData = [];

// In Special Championship Mode, load correct grid based on race type
if (isChampionship && specialMode) {
    if (isSprint) {
        // Sprint race: load sprint grid (inverted top 10)
        const sprintGrid = JSON.parse(localStorage.getItem('sprintGrid') || '[]');
        if (sprintGrid.length > 0) {
            driversData = sprintGrid;
            console.log('Sprint race: loaded sprintGrid (inverted top 10)');
        }
    } else {
        // Feature race: load feature grid (original qualification order)
        const featureGrid = JSON.parse(localStorage.getItem('featureGrid') || '[]');
        if (featureGrid.length > 0) {
            driversData = featureGrid;
            console.log('Feature race: loaded featureGrid (original qualification)');
        }
    }
} else if (isChampionship) {
    // Standard championship mode
    driversData = JSON.parse(localStorage.getItem('drivers') || '[]');
} else {
    // Simple GP mode: prioritize custom starting grid over old qualifying data
    const startingGrid = JSON.parse(localStorage.getItem('startingGrid') || '[]');
    const driversFromQualif = JSON.parse(localStorage.getItem('drivers') || '[]');
    
    if (startingGrid.length > 0) {
        // Custom starting grid takes priority (skip qualifying mode)
        driversData = startingGrid;
        console.log('Using custom starting grid from skip qualifying mode');
    } else if (driversFromQualif.length > 0) {
        // Use qualifying results if available
        driversData = driversFromQualif;
        console.log('Using drivers from qualification results');
    } else {
        // Fallback to selected drivers
        driversData = JSON.parse(localStorage.getItem('selectedDrivers') || '[]');
        console.log('Using default selected drivers');
    }
}

let drivers = [];
let nb_driver; // Will be set after loading drivers

if (driversData && driversData.length > 0) {
    // Pre-calculate circuit stats for missing data
    const circuitFastSpeed = selectedCircuit?.fastSpeed / 100 || 0.4;
    const circuitFastCorners = selectedCircuit?.fastCorners / 100 || 0.3;
    const circuitSlowCorners = selectedCircuit?.slowCorners / 100 || 0.3;
    const circuitTotalStats = circuitFastSpeed + circuitFastCorners + circuitSlowCorners;
    
    drivers = driversData.map((driver, gridIndex) => {
        // Calculate missing circuit stats if needed
        const driverCircuitStats = driver.circuitStats ||
            (circuitFastSpeed * (driver.teamSPD || 0.5) +
             circuitFastCorners * (driver.teamFS || 0.5) + 
             circuitSlowCorners * (driver.teamSS || 0.5));
        
        const driverTotalCircuitStats = driver.totalCircuitStats || circuitTotalStats;
        
        const driverLevel = driver.level || 
            ((driver.driverLevel || 50) / 100) * (driverCircuitStats / driverTotalCircuitStats);
        
        return {
            name: driver.name,
            code: driver.code,
            // Grid slot = index in the (quali-ordered) driver list; kept in the saved
            // results so the championship archive can compute poles / best qualifying.
            startPosition: driver.startPosition || (gridIndex + 1),
            team: driver.team,
            team_id: driver.team_id,
            color: driver.color,
            image: driver.image,
            driverLevel: driver.driverLevel,
            level: driverLevel,
            circuitStats: driverCircuitStats,
            totalCircuitStats: driverTotalCircuitStats,
            speed: 1,
            totalLength: 0,
            reliability: driver.reliability || (driver.teamFB || 85),
            crashProne: driver.crashProne || 50,
            state: 'racing',
            // Use tire from qualification data if available, otherwise random
            tire: driver.currentTire ? (driver.currentTire === 'S' ? 'S' : (driver.currentTire === 'M' ? 'M' : 'H')) : dryChoices[Math.floor(Math.random() * dryChoices.length)],
            startingTire: null, // Set below (same as tire)
            tireState: 1,
            carState: 1,
            fuel: 100,              // real load set by initFuelModel() once raceLength is known
            effort: 0,              // engine effort -1..+1 (save..push), decided per lap by decideEffort()
            engineStress: 0,        // accumulates while pushing -> raises mechanical-failure risk
            refuelAmount: 0,        // future player option: fuel added at the next stop (seam only)
            playerControlled: false,
            mode: 'normal',         // driving mode - re-decided each lap by evaluateRaceMode()
            mistakePending: 0,          // seconds to lose from a rolled one-off mistake this lap
            mistakePendingTier: null,   // "lock-up" / "missed braking" / "spin"
            mistakePendingAt: 0,        // fraction of the lap where the mistake plays out
            aggression: driver.aggression || 85,
            tireManagement: driver.tireManagement || 85,
            crashRisk: 0,
            crossingLine: false,
            pitStops: 0,
            pitTimer: 0,
            waitingForRain: false, // Strategy: waiting for rain to pit
            rainTireTarget: null,  // Strategy: target rain tire ('W' or 'I')
            wetTarget: null,             // Latched rain-tyre plan ('W' / 'I' / null)
            wetDecidedRegimeFrame: -1,   // Which weather-regime change this plan was made for
            lastPitExitFrame: -1,        // Frame the driver last left the pits (decision cooldown)
            overtakeCooldown: 0          // Frames until this driver may attempt another pass
        };
    });
    
    // SPRINT RACE: Reset driver states to fresh (except for grid order)
    if (isChampionship && specialMode && isSprint) {
        drivers.forEach(driver => {
            driver.tireState = 1; // Fresh tires
            driver.carState = 1;  // Fresh car
            driver.totalLength = 0; // Reset position
            driver.speed = 0;
            driver.pitStops = 0;
            driver.state = "racing";
            console.log(`${driver.name}: Reset to fresh state for sprint race`);
        });
    }
    
    drivers.forEach(d => { d.startingTire = d.tire; }); // Track starting compound
    nb_driver = drivers.length; // Set nb_driver from actual driver count
    console.log("Drivers loaded:", drivers.length);

    // Update UI with driver images and colors when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Generate driver UI elements dynamically (must happen when DOM exists)
        generateDriverUIElements();
        
        // Update dynamic container heights based on number of drivers
        updateDynamicContainerHeights();
        
        // Initialize animation tracking arrays
        initializeAnimationArrays();

        // Update driver images and colors
        drivers.forEach((driver, index) => {
            const pLElement = document.getElementById("pL" + (index + 1));
            const pXElement = document.getElementById("pX" + (index + 1));
            const pElement = document.getElementById("p" + (index + 1));
            if (pLElement && pXElement && pElement) {
                pXElement.textContent = driver.code;
                pXElement.style.borderColor = driver.color;
                pElement.style.color = driver.color;
                const imgElement = pLElement.querySelector('img');
                if (imgElement) {
                    imgElement.src = driver.image;
                }
            }
        });
    });
} else {
    alert('No data for drivers in localStorage.');
}

// =====================================================
// ANIMATION CONFIGURATION
// =====================================================
let cX = []; // Circuit X coordinates
let cY = []; // Circuit Y coordinates
let circuitLength, raceLength, baseSpeed, circuit_map_length;

// Animation settings
let zoom = 5;
let followX = 400;
let followY = -200;

// Animation frame parameters
const fps = 60; // Frames per second
const duration = 500; // Duration of animation cycle in milliseconds
const frames = duration / (1000 / fps); // Total frames per cycle
let currentFrame = 0; // Current frame counter
let currentLap = 0; // Current lap number
let laps; // Total laps in race
let dist_per_pixel; // Distance in meters per pixel
let pageWidth; // Page width for calculations

// Driver tracking arrays for animation (will be initialized after nb_driver is set)
let leader_total_length = 0;
let diff_driver_length = [];
let diff_driver_length_previous = [];
let diff_driver_time = [];
let driver_position = [];
let driver_position_previous = [];
let driver_position_X = [];
let driver_position_Y = [];
let extraCrashRisk = [];

// Minimap tracking
let circuit_driver_position = [];
let circuit_minimap_position = [];
let circuit_minimap_position_previous = [];
let circuit_minimap_position_live = [];

// Function to initialize animation arrays after drivers are loaded
function initializeAnimationArrays() {
    // Grid positioning for drivers
    drivers.forEach((driver, i) => {
        driver.totalLength = -i * 14;
    });

    // Create arrays with correct size
    diff_driver_length = new Array(nb_driver).fill(0);
    diff_driver_length_previous = new Array(nb_driver).fill(0);
    diff_driver_time = new Array(nb_driver).fill(0);
    driver_position = new Array(nb_driver).fill(0).map((_, i) => i * 35 + 75);
    driver_position_previous = new Array(nb_driver).fill(0).map((_, i) => i * 35 + 75);
    driver_position_X = new Array(nb_driver).fill(25);
    driver_position_Y = new Array(nb_driver).fill(0).map((_, i) => i * 35 + 75);
    extraCrashRisk = new Array(nb_driver).fill(0);

    // Minimap tracking arrays
    circuit_driver_position = new Array(nb_driver).fill(0);
    circuit_minimap_position = new Array(nb_driver).fill(0);
    circuit_minimap_position_previous = new Array(nb_driver).fill(0);
    circuit_minimap_position_live = new Array(nb_driver).fill(0);

    console.log('Initialized animation arrays for', nb_driver, 'drivers');
}

// =====================================================
// RECORDING INITIALIZATION (deferred to DOMContentLoaded)
// =====================================================
let recorderMetadataSet = false;

// =====================================================
// START RACE
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize race recorder (now that nb_driver is set)
    initRaceRecorder();
    
    loadCircuitData(circuit);
});
