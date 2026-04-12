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
let sessionDurations = [18, 15, 12];

document.addEventListener("DOMContentLoaded", function() {
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
    [rainCurve, trackWaterCurve] = generateRainCurve(rain);
    grip = 0.75 - rainCurve[0] * 0.75; // Initial grip value
    trackState = "green"; // Initial track state

    // =====================================================
    // SESSION MAIN LOOP
    // =====================================================
    intervalId = setInterval(updateTimer, 1000 / 60);
    updateTable();
});
