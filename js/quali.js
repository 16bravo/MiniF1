// QUALI.JS
// Main qualification module - initializes data and orchestrates session management

// =====================================================
// GLOBAL VARIABLES (accessible to all modules)
// =====================================================
let ranking = [];
let drivers = [];
let baseLapTime, country, grandPrix, rain, overtaking, difficulty, fastSpeed, fastCorners, slowCorners, totalCircuit;
let currentSession = 0;
let timer = 0;
let currentRain = 0;
let forecastRain = 0;
let currentTrackWater = 0;
let forecastTrackWater = 0;
let currentFrame = 0;
let flagTimer = 0;
let grip = 0.75;
let trackState = "green";
let rainCurve = [];
let trackWaterCurve = [];
let maxLapsPerSession = 3;
let baseSpeed = 230;
let intervalId = null;
let sessionDurations = [18, 15, 13];
let isSprint = false;

// =====================================================
// QUALIFICATION THRESHOLDS (parametrable configuration)
// =====================================================
// These define which drivers advance to next session
let qualiConfig = {
    q1Threshold: 20,   // All 20 drivers (no elimination in Q1)
    q2Threshold: 15,   // Top 15 advance to Q2 (5 eliminated after Q1)
    q3Threshold: 10    // Top 10 advance to Q3 (5 eliminated after Q2)
};

/**
 * Automatically calculate qualification thresholds based on number of drivers
 * Rules:
 * - 20 drivers or less: Q3 (15 drivers) / Q2 (10 drivers) / Q1 (20 drivers)
 * - 22+ drivers: Q3 (16 drivers) / Q2 (10 drivers) / Q1 (22+ drivers)
 * @param {number} numDrivers - Total number of drivers
 */
function calculateQualiThresholds(numDrivers) {
    if (numDrivers < 22) {
        return {
            q1Threshold: numDrivers,  // All drivers participate in Q1
            q2Threshold: 15,          // Top 15 advance to Q2
            q3Threshold: 10           // Top 10 advance to Q3
        };
    } else {
        // 22+ drivers
        return {
            q1Threshold: numDrivers,  // All drivers participate in Q1
            q2Threshold: 16,          // Top 16 advance to Q2
            q3Threshold: 10           // Top 10 advance to Q3
        };
    }
}

/**
 * Load or override qualification configuration from localStorage
 * Allows custom thresholds and session durations
 */
function loadQualiConfiguration() {
    const storedConfig = localStorage.getItem('qualiConfig');
    if (storedConfig) {
        const customConfig = JSON.parse(storedConfig);
        qualiConfig = { ...qualiConfig, ...customConfig };
        console.log('Custom qualification config loaded:', qualiConfig);
    }
    
    const storedDurations = localStorage.getItem('sessionDurations');
    if (storedDurations) {
        sessionDurations = JSON.parse(storedDurations);
        console.log('Custom session durations loaded:', sessionDurations);
    }
}

document.addEventListener("DOMContentLoaded", function() {
    // =====================================================
    // SPRINT MODE CHECK
    // =====================================================
    isSprint = localStorage.getItem('isSprint') === 'true';
    if (isSprint) {
        sessionDurations = [12, 10, 8];
        console.log('Sprint mode active - session durations:', sessionDurations);
    }

    // =====================================================
    // CIRCUIT DATA INITIALIZATION
    // =====================================================
    const selectedCircuit = JSON.parse(localStorage.getItem('selectedCircuit'));
    
    if (selectedCircuit) {
        baseLapTime = selectedCircuit.length / ((selectedCircuit.speed * 1015) / 3600);
        country = selectedCircuit.country;
        grandPrix = selectedCircuit.grandPrix;
        rain = selectedCircuit.rain;
        overtaking = selectedCircuit.overtaking;
        difficulty = selectedCircuit.difficulty;
        fastSpeed = selectedCircuit.fastSpeed / 100;
        fastCorners = selectedCircuit.fastCorners / 100;
        slowCorners = selectedCircuit.slowCorners / 100;
        totalCircuit = fastSpeed + fastCorners + slowCorners;

        console.log('Selected Circuit:', selectedCircuit.circuit);
        console.log('Grand Prix:', grandPrix);
        console.log('Country:', country);
        console.log('Lap Time:', baseLapTime);
        console.log('Rain:', rain);

        document.getElementById("GPName").textContent = grandPrix + " Grand Prix";
        document.getElementById("GPFlag").src = "img/flags/" + country.toLowerCase().replace(/ /g, "_") + ".png";
    } else {
        alert('No Grand Prix selected.');
    }

    // =====================================================
    // DRIVERS DATA INITIALIZATION
    // =====================================================
    drivers = JSON.parse(localStorage.getItem('selectedDrivers'));
    
    // Initialize qualification configuration based on number of drivers
    qualiConfig = calculateQualiThresholds(drivers.length);
    loadQualiConfiguration(); // Allow custom overrides from localStorage
    console.log('Qualification configuration:', qualiConfig);
    
    currentSession = 0;
    timer = sessionDurations[currentSession] * 60;
    ranking = drivers.map(driver => ({
        name: driver.name,
        code: driver.code,
        team: driver.team,
        team_id: driver.team_id,
        color: driver.color,
        image: driver.image,
        driverLevel: driver.driverLevel,
        teamStratLevel: driver.teamSPD, // Team strategy level
        teamSPD: driver.teamSPD,
        teamFS: driver.teamFS,
        teamSS: driver.teamSS,
        reliability: driver.teamFB,
        level: (driver.driverLevel/100) * ((fastSpeed*driver.teamSPD + fastCorners*driver.teamFS + slowCorners*driver.teamSS)/totalCircuit),
        lastTime: null,
        bestTime: 1000,
        displayBestTime: null,
        eliminated: false,
        lapTime: 0,
        distance: 0,
        currentSpeed: 0,
        runLaps: 0, // Total laps in entire qualification
        sessionLaps: 0, // Laps in current session
        currentTire: "S", // Default tire
        currentState: "PIT" // Default state
    }));

    // =====================================================
    // SESSION AND ENVIRONMENT VARIABLES
    // =====================================================
    // (Already declared at global scope)

    // =====================================================
    // WEATHER AND TRACK INITIALIZATION
    // =====================================================
    const storedWeather = localStorage.getItem('weatherQuali');
    if (storedWeather) {
        const w = JSON.parse(storedWeather);
        rainCurve = w.rainCurve;
        trackWaterCurve = w.trackWaterCurve;
        console.log('Weather curves loaded from localStorage (quali)');
    } else {
        // Fallback: generate if not pre-computed
        [rainCurve, trackWaterCurve] = generateRainCurve(rain, 5000);
        console.warn('Weather curves not found in localStorage, generated as fallback');
    }
    grip = 0.66 - Math.max(0, rainCurve[0]) * 0.66; // Initial grip value
    trackState = "green"; // Initial track state

    // =====================================================
    // SESSION MAIN LOOP
    // =====================================================
    intervalId = setInterval(updateTimer, 1000 / 60);
    updateTable();
});
