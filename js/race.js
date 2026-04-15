// RACE.JS
// Main race module - initializes data and orchestrates race simulation
// Uses modules: utils, weather, tires, physics, ranking, flags, pits, drs, animation, recording, simulation

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
let grip = 0.75; // Current track grip (0-1, updated each frame)
let gripFactor = (1 / (1 + Math.exp(-10 * (grip - 0.5))) * 0.2) + 0.8; // Grip performance multiplier

// FLAGS AND SAFETY CAR
let flagState = "green"; // Current flag state: 'green', 'yellow', 'safetycar', 'red'
let flagTimer = 0; // Frame counter for flag duration
let safetyCarLapCount = 0; // Counter for safety car laps
let redFlagClassification = null; // Driver order saved under red flag for restart

// DRS (Drag Reduction System)
let drsEnabled = false; // DRS disabled by default

// PIT STRATEGY
const MANDATORY_PITS = 1; // Mandatory pit stops (0 if rainy race)
let weatherForecast = []; // Pre-computed forecast {max, avg} per frame

// CIRCUIT DATA
const selectedCircuit = JSON.parse(localStorage.getItem('selectedCircuit'));
let baseLapTime, country, grandPrix, circuit, overtaking, difficulty;
if (selectedCircuit) {
    baseLapTime = selectedCircuit.length / ((selectedCircuit.speed * 1000) / 3600);
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
const driversData = JSON.parse(localStorage.getItem('drivers'));
let drivers = [];
let nb_driver; // Will be set after loading drivers

if (driversData) {
    drivers = driversData.map(driver => ({
        name: driver.name,
        code: driver.code,
        team: driver.team,
        team_id: driver.team_id,
        color: driver.color,
        image: driver.image,
        driverLevel: driver.driverLevel,
        level: driver.level,
        speed: 1,
        totalLength: 0,
        reliability: driver.reliability,
        crashProne: driver.crashProne || 50,
        state: 'racing',
        tire: dryChoices[Math.floor(Math.random() * dryChoices.length)],
        startingTire: null, // Set below (same as tire)
        tireState: 1,
        carState: 1,
        fuel: 100 + Math.round(Math.random() * 10),
        mode: 'agressive',
        aggression: driver.aggression || 85,
        tireManagement: driver.tireManagement || 85,
        crashRisk: 0,
        crossingLine: false,
        pitStops: 0,
        pitTimer: 0,
        waitingForRain: false, // Strategy: waiting for rain to pit
        rainTireTarget: null   // Strategy: target rain tire ('W' or 'I')
    }));
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
