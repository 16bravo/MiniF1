// RACE.JS
// JavaScript file for the race simulation
// Local storage data : circuit, drivers

// VARIABLES
// RACE
// Maximum race time (2h = 7200 seconds/frames)
const MAX_RACE_TIME = 7200;
// Maximum event time (3h = 10800 seconds/frames)
const MAX_EVENT_TIME = 10800;
// Time counters (in seconds/frames)
let raceTimeLeft = MAX_RACE_TIME;
let eventTimeLeft = MAX_EVENT_TIME;
let raceFrame = 0; // global counter
// DRS
let drsEnabled = false; // DRS disabled by default

// WEATHER
const MAX_WEATHER_FRAMES = 12600; // 3h30 weather simulation
let rainCurve = []; // Rain curve for the simulation
let trackWaterCurve = []; // Track water curve for the simulation
let rainyRace = false; // Wet Race condition for mandatory stops

let grip = 0.75; // Grip by default at the start, will change according to the weather
let gripFactor = (1 / (1 + Math.exp(-10 * (grip - 0.5))) * 0.2 ) + 0.8;

// FLAG AND SAFETY CAR
let flagState = "green"; // 'green', 'yellow', 'safetycar', 'red'
let flagTimer = 0; // counter for flag duration
let safetyCarLapCount = 0; //counter for safety car laps
let redFlagClassification = null; // ranking stored under red flag

// CIRCUIT
// Recover circuit data from localStorage
const selectedCircuit = JSON.parse(localStorage.getItem('selectedCircuit'));
let baseLapTime, country, grandPrix, circuit;
if (selectedCircuit) {
    baseLapTime = selectedCircuit.length / (( selectedCircuit.speed * 1000 ) / 3600);
    country = selectedCircuit.country;
    grandPrix = selectedCircuit.grandPrix;
    circuit = selectedCircuit.circuit;
    overtaking = selectedCircuit.overtaking/2 + 50; //adjusted overtaking value
    difficulty = selectedCircuit.difficulty; //adjusted difficulty value
    console.log('Selected Circuit:', selectedCircuit.circuit);
    console.log('Grand Prix:', grandPrix);
    console.log('Country:', country);
    console.log('Lap Time:', baseLapTime);
} else {
    alert('No Grand Prix selected.');
};

// TIRES
// Global declaration of tire types
const TIRES = {
    S: { name: "Soft", color: "#f00", speed: 1.0, drainage: -0.75, wearRate: 1/200000 },
    M: { name: "Medium", color: "#ff0", speed: 0.9975, drainage: -0.75, wearRate: 1/300000 },
    H: { name: "Hard", color: "#fff", speed: 0.995, drainage: -0.75, wearRate: 1/400000 },
    I: { name: "Intermediate", color: "#0f0", speed: 0.85, drainage: -0.25, wearRate: 1/100000 },
    W: { name: "Wet", color: "#00f", speed: 0.5, drainage: 0.2, wearRate: 1/100000 }
};
// Declaration of dry tire choices
const dryChoices = ["S", "M", "H"];

//DRIVERS
// Recover pilot data
const driversData = JSON.parse(localStorage.getItem('drivers'));
let drivers;
if (driversData) {
    // Mapping of pilot data to obtain only the necessary properties
    drivers = driversData.map(driver => ({
        name: driver.name,
        code: driver.code,
        color: driver.color,
        image: driver.image,
        driverLevel: driver.driverLevel,
        level: driver.level,
        speed: 1,
        totalLength: 0,
        reliability: driver.reliability,
        crashProne: driver.crashProne || 50,
        state: 'racing',
        tire: dryChoices[Math.floor(Math.random() * dryChoices.length)], // Random choice/strategy between S, M, H
        tireState: 1,
        carState: 1,
        fuel: 100 + Math.round(Math.random() * 10), // Random fuel between 100 and 110
        mode: 'agressive', // Default at start
        aggression: driver.aggression || 85, // Default value to be set later
        tireManagement: driver.tireManagement || 85, // Default value to be set later
        crashRisk: 0,
        crossingLine: false,
        pitStops: 0,
        pitTimer: 0 // Timer for the pit stop but possibility of increasing the start value in the event of a pit start!
    }));
    console.log(drivers); // Verification of recovered data

    // Waits for the DOM to be fully loaded to avoid problems accessing elements
    document.addEventListener('DOMContentLoaded', function() {
        // Iterate through drivers and update images
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
                } else {
                    console.warn(`Aucune balise img trouvée à l'intérieur de l'élément avec l'ID "pL${index + 1}".`);
                }
            } else {
                console.warn(`Les éléments avec l'ID "${index + 1}" n'ont pas été trouvé.`);
            }
        });
    });
} else {
    alert('No data for drivers in localStorage.');
};

// ANIMATION
// Global variables for coordinates and other data
let cX = [];
let cY = [];
let circuitLength, raceLength, baseSpeed, circuit_map_length;

// Graphic config
let zoom = 5;
let followX = 400;
let followY = -200;

// Animation config
var nb_driver = 20;
const duration = 500; // Duration of the animation in milliseconds
const fps = 60; // Frames per second
const frames = duration / (1000 / fps); // Total number of frames
let currentFrame = 0; // Frame counter
const maxRepeats = 60; // Maximum number of repeats = number of laps
let currentLap = 0; //Current lap of the race
let laps; //Number of lap of the race 
let dist_per_pixel; //distance in meters per pixel for a width of 1000px
let pageWidth; //page width for display

// Driver data config
let leader_total_length = 0; // Leader at 0m
//let total_driver_length = new Array(nb_driver).fill(0).map((_, i) => 100 - i * 14);
drivers.forEach((driver, i) => {
    driver.totalLength = - i * 14;
}); // Position of each driver on the grid
let diff_driver_length = new Array(nb_driver).fill(0);
let diff_driver_length_previous = new Array(nb_driver).fill(0);
let diff_driver_time = new Array(nb_driver).fill(0);
let driver_position = new Array(nb_driver).fill(0).map((_, i) => i * 35 + 75);
let driver_position_previous = new Array(nb_driver).fill(0).map((_, i) => i * 35 + 75);
let driver_position_X = new Array(nb_driver).fill(25);
let driver_position_Y = new Array(nb_driver).fill(0).map((_, i) => i * 35 + 75);
//let driver_speed = new Array(nb_driver).fill(1);
let extraCrashRisk = new Array(nb_driver).fill(0);

// Minimap display
let circuit_driver_position = new Array(nb_driver).fill(0);
let circuit_minimap_position = new Array(nb_driver).fill(0);
let circuit_minimap_position_previous = new Array(nb_driver).fill(0);
let circuit_minimap_position_live = new Array(nb_driver).fill(0);

// =========================================================================================================

// FUNCTIONS
// GENERIC
// Function to generate a random number according to the Box-Muller transform
function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Function to generate a random number according to a normal distribution with mean and standard deviation
function generateNormalRandom(mean, stddev) {
    return mean + stddev * randn_bm();
}

// Function for formatting driver time
function formatDriverTime(seconds) {
    // Extract minutes
    const minutes = Math.floor(seconds / 60);

    // Extract the seconds and milliseconds
    const remainingSeconds = seconds % 60;
    const formattedSeconds = remainingSeconds.toFixed(3);

    // Add a zero before the seconds if necessary
    const [wholeSeconds, milliseconds] = formattedSeconds.split('.');
    const paddedSeconds = wholeSeconds.padStart(2, '0');

    // Construct the result string
    return `${minutes > 0 ? minutes + ":" + paddedSeconds : wholeSeconds}.${milliseconds}`;
}

// Function for formatting intervals
function formatInterval(time, lap) {
    if (time === 0) {
        return "Leader";
    } else if (lap > 2) {
        return "+ " + Math.floor(lap) + " laps";
    } else if (lap > 1) {
        return "+ " + Math.floor(lap) + " lap";
    } else {
        return "+ " + formatDriverTime(time);
    }
}

// WEATHER
// Function for generating the rainfall curve
function generateRainCurve(rainProbability, totalFrames = MAX_WEATHER_FRAMES) {
    const rainCurve = new Array(totalFrames).fill(0);
    const trackWaterCurve = new Array(totalFrames).fill(0);

    // Generate two random peaks
    const peak1 = Math.floor(Math.random() * totalFrames) - 500;
    const peak2 = Math.floor(Math.random() * totalFrames) - 500;

    // Standard deviation according to rain probability
    const stddev = Math.max(50, 600 * (rainProbability / 100));

    // Peak intensity
    const amplitude1 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));
    const amplitude2 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));

    for (let i = 0; i < totalFrames; i++) {
        const intensity1 = amplitude1 * Math.exp(-Math.pow(i - peak1, 2) / (2 * Math.pow(stddev, 2)));
        const intensity2 = amplitude2 * Math.exp(-Math.pow(i - peak2, 2) / (2 * Math.pow(stddev, 2)));
        rainCurve[i] = Math.min(1, rainCurve[i] + intensity1 + intensity2) * 1.5 - 0.5;
        trackWaterCurve[i+1] = Math.max(0, Math.min(1, trackWaterCurve[i] + (rainCurve[i]/100 - 0.0005)));
    }

    return [rainCurve, trackWaterCurve];
}

// Function to obtain a description of the weather
function getWeatherDescription(currentRain) {
    if (currentRain > 0.5) {
        return "Heavy Rain 🌧️";
    } else if (currentRain > 0) {
        return "Light Rain 🌦️";
    } else if (currentRain > - 0.25) {
        return "Cloudy ☁️";
    } else {
        return "Sunny ☀️";
    }
}

// GRIP
// Function to update the grip
function updateGrip(currentWater, carsOnTrack) {
    // Gradual increase if at least one car is running
    if (carsOnTrack > 0) {
        grip += 0.00000231481 * carsOnTrack; // Adjusts the factor according to the duration of the race
    }

    // Rapid decrease if it rains
    if (currentWater > 0) {
        grip -= 0.0001 * currentWater; // The more it rains, the faster it washes
    }

    // Realistic terminals
    grip = Math.max(0, Math.min(1, grip));
}

// RACE
// Function to find the driver in front of another
function computeFrontsForAll() {
    const positions = drivers.map(driver => driver.totalLength % circuitLength);
    const laps = drivers.map(driver => Math.floor(driver.totalLength / circuitLength));

    // Ascending order (least advanced first)
    const posArray = positions.map((pos, i) => ({
        index: i,
        pos,
        lap: laps[i]
    })).sort((a, b) => a.pos - b.pos);

    // For each driver, we store its front end
    const fronts = new Array(nb_driver);

    for (let myRank = 0; myRank < posArray.length; myRank++) {
        const myPosObj = posArray[myRank];
        const frontRank = (myRank === posArray.length - 1) ? 0 : myRank + 1;
        const frontObj = posArray[frontRank];

        let gapMetersTrack = (frontObj.pos - myPosObj.pos + circuitLength) % circuitLength;
        const sameLap = (myPosObj.lap === frontObj.lap);

        fronts[myPosObj.index] = {
            frontIndex: frontObj.index,
            gapMetersTrack,
            sameLap
        };
    }
    return fronts;
}

// Utility functions to find the driver behind
function getBackIndex(i, fronts) {
    // Find the driver whose front is i
    for (let j = 0; j < fronts.length; j++) {
        if (fronts[j]?.frontIndex === i) return j;
    }
    return null;
}

function getGapBack(i, fronts) {
    // Find the driver whose front is i
    for (let j = 0; j < fronts.length; j++) {
        if (fronts[j]?.frontIndex === i) return fronts[j].gapMeters;
    }
    return 1000;
};

// Get gap to front driver in the ranking
function computeGapsFrontInRanking(drivers, driver_ranking) {
    const gaps = new Array(drivers.length).fill(0);
    const frontIndices = new Array(drivers.length).fill(null);

    for (let i = 0; i < drivers.length; i++) {
        const myRank = driver_ranking[i];
        const frontRank = (myRank - 1) % 20;
        let frontIndexRanking = driver_ranking.length - 1; // Default to last driver if no one is in front
        //let gapToFrontRanking = 0;

        if (frontRank > 0) {
            frontIndexRanking = driver_ranking.indexOf(frontRank) % 20;
            //gapToFrontRanking = drivers[frontIndexRanking].totalLength - drivers[i].totalLength;
        }

        /*// Gap en secondes
        const gapSeconds = gapToFrontRanking / (drivers[i].speed || 1);
        gaps[i] = gapSeconds;*/

        frontIndices[i] = frontIndexRanking;
    }
    return frontIndices;
};

// Logistics function for performance depending on car condition
function computeCarPerf(carState) {
    // Steep slope between 0.75 and 0.5, perf min = 0.3
    return 0.3 + 0.7 / (1 + Math.exp(-20 * (carState - 0.75)));
};

// STRATEGY
// Function to choose the next tire
function chooseNextTire(driver, currentTrackWater, distanceLeftKm) {
    // If very wet
    if (currentTrackWater > 0.8) return "W";
    if (currentTrackWater > 0.3) return "I";

    // First stop: alternate S/M
    if (driver.pitStops < 1) {
        if (driver.tire === "S") return "M";
        if (driver.tire === "M") return "S";
        return (Math.random() < 0.5) ? "S" : "M";
    }

    // Last quarter of race: Soft only
    if (distanceLeftKm < 50) return "S";

    // Mid-race: no Hard if < 150km remaining
    if (distanceLeftKm < 150) {
        return (Math.random() < 0.5) ? "S" : "M"; // Random between S and M
    }

    // Start/middle of race: random choice between S, M, H
    return dryChoices[Math.floor(Math.random() * dryChoices.length)];
};

// WITHDRAWAL
// Function for calculating the probability of a crash and applying the consequences
function checkForCrash(i, fronts, currentTrackWater, currentRain, extraCrashRisk) {
    const driver = drivers[i];
    if (driver.state !== "racing") return;

    // Mechanical withdrawal
    let abandonProb = ((101 - driver.reliability) / 100) / 9600;
    //console.log(`Probabilité d'abandon pour ${drivers[i].name} : ${abandonProb}`);
    if (Math.random() < abandonProb) {
        driver.state = "out";
        driver.carState = 0;
        drivers[i].speed = 0;
        drivers[i].totalLength = drivers[i].totalLength;
        console.log(`${driver.name} retires due to mechanical problems!`);
        triggerFlag('yellow', i); // Yellow flag
        return;
    }

    // Risk factors
    const baseRisk = 0.0002;
    const skillFactor = (100 - driver.driverLevel) / 100;
    const proneFactor = (driver.crashProne || 50) / 100;
    const modeFactor = driver.mode === "agressive" ? 1.5 : 1;
    const waterFactor = 1 + currentTrackWater * 2;
    const difficultyFactor = 1 + (difficulty || 50) / 100;
    // Proximité devant
    const gapFront = fronts[i]?.gapMeters || 1000;
    const proximityFront = gapFront < 5 ? 2 : gapFront < 10 ? 1.5 : 1;
    // const backs = computeBacksForAll();

    // Added risk (chain crash)
    let crashChainBonus = extraCrashRisk[i] || 0;

    // Total risk
    let crashProb = baseRisk * skillFactor * proneFactor * modeFactor * waterFactor * difficultyFactor * proximityFront + crashChainBonus;
    if (crashProb > 1) crashProb = 1; // max terminal

    if (Math.random() < crashProb) {
        // Crash! We decrement carState
        const damage = Math.min(1, Math.abs(generateNormalRandom(1, 0.25))); // Normal around 0.5, max 1
        //console.log(`Crash pour ${driver.name} ! Dommages : ${damage}`);
        driver.carState = Math.max(0, driver.carState - damage);
        //console.log(`Nouvel état de la voiture : ${driver.carState}`);

        driver.carPerf = computeCarPerf(driver.carState);

        // Consequences
        if (driver.carState < 0.5) {
            driver.state = "out";
            // Yellow flag + safety car
            // If heavy rain, red flag
            if (currentRain > 0.5) {
                triggerFlag('red', i);
            } else {
                triggerFlag('safetycar', i); // safety car
            }
        } else if (driver.carState < 0.75) {
            driver.state = "box";
            driver.carPerf = computeCarPerf(driver.carState);
            triggerFlag('yellow', i); // simple yellow flag
        }

        // Chain crash: increasing the risk of close calls ---
        // In front
        const frontIndex = fronts[i]?.frontIndex;
        const gapFront = fronts[i]?.gapMeters || 1000;
        if (frontIndex !== undefined && frontIndex !== null && drivers[frontIndex].state === "racing") {
            if (gapFront < 20) {
                let bonus = (1 - (gapFront/20))**4;
                extraCrashRisk[frontIndex] = Math.max(extraCrashRisk[frontIndex], bonus);
            }
        }
        // Behind (a function is needed to find the driver behind)
        const backIndex = getBackIndex(i, fronts);
        const gapBack = getGapBack(i, fronts);
        if (backIndex !== undefined && backIndex !== null && drivers[backIndex].state === "racing") {
            if (gapBack < 20) {
                let bonus = (1 - (gapBack/20))**4;
                extraCrashRisk[backIndex] = Math.max(extraCrashRisk[backIndex], bonus);
            }
        }
    }
};

// FLAGS
// Function to display the flag banner
function showFlagBanner(flag) {
    const banner = document.getElementById('flagBanner');
    let color = "white";
    let text = "";

    switch(flag) {
        case "red":
            color = "#c00";
            text = "RED FLAG";
            break;
        case "safetycar":
            color = "#ff0";
            text = "SAFETY CAR";
            break;
        case "yellow":
            color = "#ff0";
            text = "YELLOW FLAG";
            break;
        case "green":
            color = "#0f0";
            text = "GREEN FLAG";
            break;
        case "ending":
            color = "white";
            text = "";
        default:
            color = "white";
            text = "";
    }

    banner.style.opacity = flag === "green" ? "0.7" : "1";
    banner.style.color = color;
    banner.textContent = text;
    banner.style.display = text ? "block" : "none";
    if (text) {
        banner.style.opacity = "1";
    } else {
        banner.style.opacity = "0";
    }
};

// Global flag management function (to be completed later)
function triggerFlag(type, driverIndex) {
    // type: 'yellow', 'red', etc.
    // driverIndex: index of the driver concerned
    console.log(`${type} déclenché par ${drivers[driverIndex]?.name || "?"}`);
    flagState = type;
    showFlagBanner(type);

    if (flagState === "red") {
        drsEnabled = false; // DRS disabled under red flag
        flagTimer = 300; // 5 minutes simulated (300 frames)
        // Save the current classification
        redFlagClassification = [...drivers]
            .map((d, idx) => ({ idx, dist: drivers[idx].totalLength, state: d.state }))
            .filter(obj => obj.state !== "out") // Exclure les "out"
            .sort((a, b) => b.dist - a.dist)
            .map(obj => obj.idx);

        // Set all drivers who are not ‘out’ to ‘in pit red flag’.
        for (let i = 0; i < drivers.length; i++) {
            if (drivers[i].state !== "out") {
                drivers[i].state = "in pit red flag";
                drivers[i].carState = 1;
                drivers[i].tireState = 1;
                drivers[i].tire = chooseNextTire(drivers[i], 0, (raceLength - drivers[i].totalLength) / 1000); // tu peux ajuster le choix si besoin
                drivers[i].pitStops = (drivers[i].pitStops || 0) + 1;
                drivers[i].speed = 0;
            }
        }
    } else if (flagState === "safetycar") {
        drsEnabled = false; // DRS disabled under safety car
        flagTimer = 300; // 5 minutes simulated (300 frames)
    } else if (flagState === "yellow") {
        drsEnabled = false; // DRS disabled under yellow flag
        flagTimer = 120; // Slow everyone down by 10%, no overtaking, 2 minutes
    } else if (flagState === "green") {
        // End of yellow flag, everyone can drive at full speed
        drsEnabled = true; // DRS re-enabled
        flagTimer = 60; // 30 frames of green display
    }
}

// ANIMATION
// Function for loading JSON data
async function loadCircuitData(circuit) {
    const response = await fetch('./data/circuits.json'); // Replace with the correct path to your JSON file
    const data = await response.json();
    // Find the data for the specified circuit
    const circuitData = data.find(item => item.circuit === circuit);
    if (circuitData) {
        // Extract x and y coordinates in separate tables
        cX = circuitData.coor.map(point => point[0]);
        cY = circuitData.coor.map(point_1 => point_1[1]);

        circuit_map_length = cX.length;

        // Extract other values
        circuitLength = circuitData.length;
        raceLength = circuitData.total;
        baseSpeed = circuitData.speed;
        country = circuitData.country;
        grandPrix = circuitData.grandPrix;

        // Calculates other data
        laps = Math.ceil(raceLength / circuitLength);
        pageWidth = window.innerWidth || document.documentElement.clientWidth;
        console.log(pageWidth);
        dist_per_pixel = circuitLength / pageWidth;

        //CIRCUIT MAP
        var canvas = document.getElementById("myCanvas");
        if (canvas.getContext) {
            var ctx = canvas.getContext('2d');
            ctx.beginPath();     // Start a new path.																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																													
            ctx.lineWidth = "5";
            ctx.strokeStyle = "rgb(50,50,50)";
            ctx.fillStyle = 'black';
            ctx.moveTo(cX[0] / 5 + 750, -cY[0] / 5 + 350);
            for (i = 1; i < 1038; i++) {
                ctx.lineTo(cX[i] / 5 + 750, -cY[i] / 5 + 350);
            };
            ctx.fill();
            ctx.stroke();
            ctx.closePath(); // Close the current path.																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																													
        }

        //Change circuit/GP name
        var countryNameHTML = document.getElementById("countryName");
        var countryFlagHTML = document.getElementById("countryFlag");

        countryNameHTML.innerText = "#" + circuit.toUpperCase() + "GP";
        countryFlagHTML.src = "img/flags/" + country.toLowerCase().replace(/ /g, "_") + ".png";

        let rain = selectedCircuit && selectedCircuit.rain ? selectedCircuit.rain : 30; // 30% by default
        [rainCurve, trackWaterCurve] = generateRainCurve(rain);
        //console.log(rainCurve);

        // Initialise the animation after loading the data
        initAnimation();
    } else {
        throw new Error(`Le circuit ${circuit} n'a pas été trouvé dans le fichier JSON.`);
    }
};

//Animation initialisation function (allows debugging)
function initAnimation() {
    move();
}

//Race animation function
function move() {
    currentFrame = 0;
    let interval = setInterval(function() {
        frame(interval);
    }, 1000 / fps);
}

// MAIN SIMULATION
// Frame by Frame function
function frame(interval) {
    // GENERAL TRACK SIMULATION
    // TIMING
    raceFrame++; // Increment the total number of frames

    // Checking end of race
    if (eventTimeLeft > 0) eventTimeLeft--; // Decrement the test time at each frame (always)
    if (raceTimeLeft > 0 && flagState !== 'red' ) raceTimeLeft--; // Decrement the race time only if the race is running (not under red flag)
    //console.log("Race time left:", raceTimeLeft, "Event time left:", eventTimeLeft);

    // Check if one of the timers falls below 5 minutes (300s)
    const showRaceTimer = raceTimeLeft > 0 && raceTimeLeft <= 300;
    const showEventTimer = eventTimeLeft > 0 && eventTimeLeft <= 300;

    // Update the display of the lap and the timer
    if (showRaceTimer || showEventTimer) {
        let timerText = '';
        if (showRaceTimer) {
            timerText += `TIME LEFT </br> <strong>${Math.floor(raceTimeLeft/60)}:${(raceTimeLeft%60).toString().padStart(2, '0')}</strong>`;
        }
        if (showEventTimer) {
            timerText += `TIME LEFT </br> <strong>${Math.floor(eventTimeLeft/60)}:${(eventTimeLeft%60).toString().padStart(2, '0')}</strong>`;
        }
        document.getElementById('ind').innerHTML = `<strong>${timerText.trim()}</strong>`;
    } else {
        document.getElementById('ind').innerHTML = "<strong>LAP </br>" + currentLap + "</strong> / " + laps;
    };

    // DISTANCE
    const leaderDistanceLeft = raceLength - leader_total_length; // remaining race distance

    // WEATHER
    // At each frame, we retrieve the current weather forecast
    const currentRain = rainCurve[Math.min(raceFrame, rainCurve.length - 1)];
    const currentTrackWater = trackWaterCurve[Math.min(raceFrame, trackWaterCurve.length - 1)];
    document.getElementById('weather').textContent = getWeatherDescription(currentRain); // Show current weather
    // Update Rainy Race when there is rain
    if (currentTrackWater>0) {
        rainyRace = true;
    };
    console.log("rainy race ? " + rainyRace);

    // GRIP
    // Count the number of cars ‘on track’ (excluding pits and retirements)
    let carsOnTrack = drivers.filter(d => d.state === "racing").length;
    updateGrip(currentTrackWater, carsOnTrack);
    gripFactor = (1 / (1 + Math.exp(-10 * (grip - 0.5))) * 0.2 ) + 0.8;


    // FLAGS & SAFETY CAR
    // Decrement flagTimer if a temporary flag is active
    if (flagTimer >= 0) {
        flagTimer--;
        //console.log(flagTimer);
        if (flagTimer <= 0) {
            if (flagState === "green") { // If green flag over, we remove the banner
                flagState = "ending";
                document.getElementById('flagBanner').style.opacity = "0"
            } else if (flagState === "yellow" || flagState === "safetycar") { // If yellow flag over, it's green flag
                flagState = "green";
                showFlagBanner("green");
            } else if (flagState === "red" && currentRain < 0.2) { // If red flag over and weather ok, it's green flag
                console.log("Fin du drapeau rouge");
                flagState = "green";
                showFlagBanner("green");
                for (let pos = 0; pos < redFlagClassification.length; pos++) {
                    let idx = redFlagClassification[pos];
                    drivers[idx].state = "racing";
                }
            }
        }
    }

    // DRS
    drsEnabled = (currentLap >= 2) && (currentTrackWater <= 0.2) && !(flagState === "yellow" || flagState === "safetycar" || flagState === "red"); // Check if DRS is activated

    // DRIVERS SIMULATION
    // UPDATE EACH FRAME WHILE THE RACE IS NOT OVER
    if (leader_total_length <= raceLength && raceTimeLeft > 0 && eventTimeLeft > 0) { //While the race is running
        //Get current lap (distance of the leader)
        currentLap = Math.ceil(leader_total_length / circuitLength);

        // RACE RANKING
        // Sort the drivers by distance, true ranking
        let sorted_indices = [...Array(nb_driver).keys()].sort((a, b) => drivers[b].totalLength - drivers[a].totalLength);
        // Filter on the racing driver
        let racing_indices = sorted_indices.filter(idx => 
            drivers[idx].state === "racing" || drivers[idx].state === "box"
        );
        let leaderIndex = sorted_indices[0];
        // Ranking of the drivers
        let driver_ranking = new Array(nb_driver);
        for (let r = 0; r < racing_indices.length; r++) {
            driver_ranking[racing_indices[r]] = r + 1;
        };

        // Get the driver in front of each driver on the track
        const fronts = computeFrontsForAll();

        // Get the gaps to the front in rankings
        const frontIndicesRanking = computeGapsFrontInRanking(drivers, driver_ranking);

        //Animation and computation for each driver in the race order
        for (let pos = 0; pos < sorted_indices.length; pos++) {
            let i = sorted_indices[pos];
            // CAR STATE
            drivers[i].carPerf = computeCarPerf(drivers[i].carState);

            // FRONT DRIVER ON THE TRACK
            // frontIndex : who is in front
            // gapMeters : what distance
            // sameLap : are they in the same lap ?
            const { frontIndex, gapMetersTrack, sameLap } = fronts[i];
            //console.log(`Driver ${drivers[i].name} (${i}) - Front: ${frontIndex} (${drivers[frontIndex]?.name || "?"}), Gap: ${gapMetersTrack.toFixed(2)}m, Same Lap: ${sameLap}`);

            // Proximity to the driver in front on the track, default 1 = no dirty air
            let proximityFactor = 1;

            //=================================================================================================================================================================================

            // TIRE MANAGEMENT
            const tireProps = TIRES[drivers[i].tire];
            const tireManagement = drivers[i].tireManagement || 85;

            // Wear factor according to control mode
            let modeFactor = 1;
            if (drivers[i].mode === "agressive") modeFactor = 1.02;
            else if (drivers[i].mode === "gestion") modeFactor = 0.98;

            // Tire: Gross wear (bounded between 0 and 1)
            let tireManagementBonus = 1 - tireManagement / 100;
            let wearRate = tireProps.wearRate * modeFactor * tireManagementBonus;
            let waterFactor = currentTrackWater;
            drivers[i].tireState -= (((drivers[i].speed * 4000/180) * wearRate*(1.16 - waterFactor)) * 5.5);
            drivers[i].tireState = Math.max(0, Math.min(1, drivers[i].tireState)); // Tire state between 0 and 1
            //console.log(drivers[i].name + " tire state: " + drivers[i].tireState);

            // Driver position on the circuit in percent
            let driver_length_percent = (drivers[i].totalLength % circuitLength) / circuitLength;
            drivers[i].crossingLine = driver_length_percent <= 0.1 || driver_length_percent >= 0.9; // true if the driver has already crossed the line (is he around 0%?)
            //console.log(drivers[i].name + " crossing line: " + drivers[i].crossingLine);

            // TIRE PERF
            let tireWear = drivers[i].tireState;
            let waterPerf = tireProps.speed + tireProps.drainage * currentTrackWater; // Tire: Water performance
            drivers[i].tirePerf = ((1 - 0.06 / (1 + Math.exp(10 * (tireWear - 0.5)))) * (0.98 + 0.02 / (1 + Math.exp(1000 * (tireWear - 0.99))))) * waterPerf; // Tire: Final performance (sigmoid from condition + early life malus)

            //=================================================================================================================================================================================

            // PERFORMANCE ACCORDING TO STATE = Must determine the total length of the driver
            if (
                // DRIVER MUST BE OUT
                // Checking condition : If a driver car is in a 0 state, he is automatically eliminated
                drivers[i].state === "racing" &&
                (drivers[i].carState <= 0 || drivers[i].tireState <= 0)
            ) {
                console.log(`${drivers[i].name} éliminé automatiquement (état voiture ou pneus à 0)`);                
                drivers[i].state = "out";

                // Simulated movement
                drivers[i].speed = 0; // No movement at all
                drivers[i].totalLength = drivers[i].totalLength;             
            } else if (
                // DRIVER IS OUT
                // If the driver is out, he is stopped
                drivers[i].state === "out"
            ) { // If the driver is ‘out’, freeze everything & Grey out in the ranking & Hide the car and points on the minimap
                document.getElementById("pL" + (i + 1)).style.opacity = 0.6;
                document.getElementById("pX" + (i + 1)).style.opacity = 0.6;
                document.getElementById("t" + (i + 1)).style.opacity = 0.6;
                document.getElementById("ty" + (i + 1)).style.opacity = 0.6;
                document.getElementById("p" + (i + 1)).style.display = "none";

                // Simulated movement
                drivers[i].speed = 0; // No movement at all
                drivers[i].totalLength = drivers[i].totalLength;
            } else if (
                // DRIVER IN THE PIT
                // If the driver is in the pit
                drivers[i].state === "in pit"
            ) { // If the driver is in the pit, he is slowed down
                // Simulated movement
                drivers[i].speed = 0.7; // Pit stop speed
                drivers[i].totalLength += drivers[i].speed * 4000/180;
            } else if (
                // RED FLAG
                // If the race is under red flag
                drivers[i].state === "in pit red flag"
            ) { // If the driver is in the pit under red flag, he is stopped
                // Simulated movement
                drivers[i].speed = 0; // Arrêt complet
                drivers[i].totalLength = (Math.ceil(leader_total_length / circuitLength)) * circuitLength - redFlagClassification[i] * 14; // Return the driver to the red flag position
            } else if (
                // SAFETY CAR OR YELLOW FLAG
                // If the race is under safety car or yellow flag
                flagState === "safetycar" ||
                flagState === "yellow"
            ) {
                // FLAG FACTOR
                //console.log((flagState === "safetycar") ? ((i === leaderIndex) ? "safety car, leader" : "safety car") : ("yellow flag"));
                let flagFactor = (flagState === "safetycar") ? ((i === leaderIndex) ? 0.5 : 0.8) : (0.9);
                // GAP TO LEADER IN FRONT IN THE RANKING

                // Expected movement
                let expected_length = (generateNormalRandom(baseSpeed*9 + drivers[i].level*2, 12)/30) * gripFactor * drivers[i].tirePerf * drivers[i].carPerf * flagFactor;
                //let expected_speed = (expected_length) * 180/4000; // Expected full speed

                let total_driver_length_expected = drivers[i].totalLength + expected_length;
                let total_driver_length_front = (drivers[frontIndicesRanking[i]].totalLength < drivers[i].totalLength ? drivers[frontIndicesRanking[i]].totalLength + circuitLength : drivers[frontIndicesRanking[i]].totalLength) - 5;
                
                // Gap en secondes
                let gapSecondsRanking = (total_driver_length_front - drivers[i].totalLength) / (drivers[i].speed || 1);
                //let gapSecondsRanking = gapsFrontRanking[i];

                let distanceFactor = Math.max(0,Math.min(1, (5 - gapSecondsRanking)/5));

                // Simulated Movement
                console.log(`Driver ${drivers[i].name} (ID: ${i} / Pos: ${pos}) - Expected Length: ${total_driver_length_expected.toFixed(2)}, Total Length: ${drivers[i].totalLength.toFixed(2)}, Front ${drivers[frontIndicesRanking[i]].name} (ID: ${frontIndicesRanking[i]} / Pos: ${pos-1}) -  Front driver length : ${total_driver_length_front.toFixed(2)}, Gap to Front: ${gapSecondsRanking.toFixed(2)}s`);
                drivers[i].totalLength = Math.min(total_driver_length_front, distanceFactor * total_driver_length_front + (1 - distanceFactor) * total_driver_length_expected);
                //drivers[i].totalLength = Math.min(total_driver_length_front, total_driver_length_expected * 0.999);
            } else
                // NORMAL CONDITIONS
            {
                // CRASH
                checkForCrash(i, fronts, currentTrackWater, currentRain, extraCrashRisk);

                // Gap on the track
                let gapSecondsTrack = gapMetersTrack / drivers[i].speed;

                // Expected movement
                let expected_length = (generateNormalRandom(baseSpeed*9 + drivers[i].level*2, 12)/30) * gripFactor * drivers[i].tirePerf * drivers[i].carPerf;
                let expected_speed = (expected_length) * 180/4000; // Expected full speed
                
                // DRS activated if in the zone and less than one second away
                if (currentFrame<=10 && drsEnabled && gapSecondsTrack < 1) {
                    proximityFactor = 1.06; // DRS acceleration
                    expected_speed = expected_speed * proximityFactor;
                };

                if (gapSecondsTrack < 4 && gapSecondsTrack > 0) { // less than 4 seconds, dirty air
                    proximityFactor = proximityFactor-0.00125/(1+Math.exp(4*(gapSecondsTrack-2.75))); // proximity factor with major deterioration nearby
                    expected_speed *= proximityFactor;
                    let frontAggression = (drivers[frontIndex].aggression * ((drivers[frontIndex].mode == "agressive") ? 1 : 0.5) * (sameLap ? 1 : 0.1)) * 0.005 + 0.5;
                    let defenseFactor = ((gapSecondsTrack < 5) ? ((5 - gapSecondsTrack) / 5) * (frontAggression) : 0) * 0.5 + ((overtaking)/100) * 0.5;

                    // Simulated movement
                    drivers[i].speed = defenseFactor * Math.min(expected_speed,drivers[frontIndex].speed*0.999) + (1 - defenseFactor) * drivers[i].speed;
                    drivers[i].totalLength += drivers[i].speed * 4000/180;
                } else { // default case : no flag, no dirty air
                    // Simulated movement
                    // No change in driver_speed
                    drivers[i].speed = expected_speed;
                    drivers[i].totalLength += drivers[i].speed * 4000/180;
                };
            };

            //=================================================================================================================================================================================

            // PIT STOP MANAGEMENT
            // Tolerance for tire wear: a driver will stop more easily if there is a flag or safety car
            const tireTolerance = flagState === "safetycar" ? 0.75 : flagState === "yellow" ? 0.6 : 0.5;

            // When a racing driver has to stop
            if ( 
                drivers[i].state === "racing" && // The driver is racing and ...
                ((drivers[i].carState < 0.75 && drivers[i].carState > 0.5) || // ... or the car is a bit damaged
                ((leaderDistanceLeft < 30 && drivers[i].tireState < 0.25) || // ... or there is less than 30km left and the tire is really worn
                (leaderDistanceLeft >= 30) && // ... or there is more than 30km left
                ((drivers[i].tireState < (tireTolerance + generateNormalRandom(0, 0.05)) || // ... and the tire is under tolerance (worn out)
                (currentTrackWater > 0.8 && drivers[i].tire != "W") || // ... or the track is wet and the tire is not wet
                (currentTrackWater > 0.3 && currentTrackWater <= 0.8 && drivers[i].tire != "I") || // ... or the track is a bit wet and the tire is not intermediate
                (currentTrackWater == 0 && (drivers[i].tire == "W" || drivers[i].tire == "I")))))) // ... or the track is dry and the tire is wet or intermediate
            ) {
                // In this case, the driver is called to the pit
                console.log(drivers[i].name + " : Box! Box! Box!");
                drivers[i].state = "box";
            }
            // When a driver is called to the pit
            else if (
                drivers[i].state === "box" && // Driver called
                drivers[i].crossingLine // Crossed the line
            ) {
                // Determine pit stop times (pit lane + pit stop)
                console.log(drivers[i].name + " enters the pit");
                drivers[i].pitTimer = Math.round(generateNormalRandom(30 + (1-drivers[i].carState) * 60, 3));
                drivers[i].state = "in pit";
            }
            // When a driver is in the pit
            else if (drivers[i].state === "in pit") {
                // The pit timer is decremented
                drivers[i].pitTimer--;
                // At the end of the pit stop, the driver is released
                if (drivers[i].pitTimer <= 0) {
                    // Exit the pits: replace the driver at 10% of the circuit
                    drivers[i].pitStops = (drivers[i].pitStops || 0) + 1; // Increment the number of pit stops
                    drivers[i].tireState = 1; // New tires
                    drivers[i].carState = 1; // Repaired car
                    drivers[i].tire = chooseNextTire(drivers[i], currentTrackWater, (raceLength - drivers[i].totalLength) / 1000); // Choose the next tire
                    drivers[i].state = "racing";
                }
            };

            //=================================================================================================================================================================================

            // ANIMATION
            // Get the position of the driver on the minimap
            var variation_X = (diff_driver_length_previous[i] - diff_driver_length[i] )  / dist_per_pixel;
            var variation_Y = driver_position_previous[i] - driver_position[i];
            // Movement of the driver on the minimap
            var variation_map = circuit_minimap_position_previous[i] - circuit_minimap_position[i];
            //console.log(variation_map);
            
            var p = "p" + (i + 1); // Position on the minimap 
            var pL = "pL" + (i + 1); // Position of the little pixel car
            var pX = "pX" + (i + 1); // Position of the name in the rankings
            var t = "t" + (i + 1); // Interval of the driver in the rankings
            var ty = "ty" + (i + 1); // Position of the tire in the rankings

            // Tire display management
            const tireLetter = drivers[i].tire; // "S", "M", "H", "I", "W"
            const tireColor = TIRES[tireLetter].color;

            // Update tire display
            const tyElement = document.getElementById(ty);
            if (tyElement) {
                tyElement.textContent = tireLetter;
                tyElement.style.color = tireColor;
                tyElement.style.fontWeight = "bold";
                tyElement.style.fontSize = "18px";
            }

            driver_position_X[i] -= variation_X / (fps*(duration/1000));
            driver_position_Y[i] -= variation_Y / (fps*(duration/1000));
        
            circuit_minimap_position_live[i] = Math.round(circuit_minimap_position_previous[i] - variation_map * (currentFrame/frames)) % circuit_map_length;
            
            document.getElementById(pL).style.top = driver_position_Y[i] + 'px'; // Update little pixel car position on Y
            document.getElementById(pL).style.right = driver_position_X[i]+25 + 'px'; // Update little pixel car position on X
            document.getElementById(pX).style.top = driver_position_Y[i] + 'px'; // Update name position in the ranking
            document.getElementById(t).style.top = driver_position_Y[i] + 'px'; // Update interval time in the ranking
            document.getElementById(ty).style.top = driver_position_Y[i] + 'px'; // Update tire info in the ranking

            //Circuit Map
            document.getElementById(p).style.left = cX[circuit_minimap_position_live[i]] / zoom - followX + 750 + 'px'; // Position of the driver point on the minimap on X
            document.getElementById(p).style.top = -cY[circuit_minimap_position_live[i]] / zoom + followY + 350 + 'px'; // Position of the driver point on the minimap on Y
        };
    };

    // UPDATE EACH MAXFRAMES (30 FRAMES) FOR ANIMATION
    if (currentFrame >= frames) {
        clearInterval(interval);
        if (leader_total_length <= raceLength && raceTimeLeft > 0 && eventTimeLeft > 0) { // End of race: either the leader has finished or the race time has elapsed
            circuit_minimap_position_previous = circuit_minimap_position
            circuit_minimap_position = drivers.map(driver => (driver.totalLength / circuitLength) * circuit_map_length);

            leader_total_length = Math.max(...drivers.map(driver => driver.totalLength));
            diff_driver_length_previous = [...diff_driver_length];
            diff_driver_length = drivers.map(driver => leader_total_length - driver.totalLength);
            let sorted_lengths = [...diff_driver_length].sort((a, b) => a - b);
            const val_to_rank = new Map();
            sorted_lengths.forEach((val, idx) => val_to_rank.set(val, idx + 1));
            const driver_ranking = diff_driver_length.map(value => val_to_rank.get(value));

            for (i = 0; i < nb_driver; i++) {
                // Update the position of the driver on the minimap
                driver_position_previous[i] = driver_position_Y[i];
                driver_position[i] = (driver_ranking[i] - 1) * 35 + 75; //position at the end of the lap

                diff_driver_time[i] = diff_driver_length[i] / (drivers[i].speed*30);

                var pL = "pL" + (i + 1);
                var pX = "pX" + (i + 1);

                var t = "t" + (i + 1);

                document.getElementById(pL).style.top = driver_position_Y[i] + 'px';
                document.getElementById(pX).style.top = driver_position_Y[i] + 'px';

                // Display the driver in the ranking
                if (drivers[i].state === "out") {
                    document.getElementById(t).style.color = "gray";
                    document.getElementById(t).innerHTML = "<strong>OUT</strong>";
                } else if (drivers[i].state === "in pit" || drivers[i].state === "in pit red flag") {
                    document.getElementById(t).style.color = drivers[i].color;
                    document.getElementById(t).innerHTML = "<strong>IN PIT</strong>";
                } else {
                    document.getElementById(t).style.color = "white";
                    document.getElementById(t).textContent = formatInterval(diff_driver_time[i], diff_driver_length[i] / circuitLength);
                };
            };

            move(); // Restart the animation
        }else {
            // Ended Race
            //console.log("Course terminée");
            document.getElementById('ind').innerHTML = "<strong> END OF </br> THE RACE </strong>";
            document.getElementById('ind').style.color = "white";
            clearInterval(interval);
        }
    };

    currentFrame++;    
}

// Démarrer l'animation
document.addEventListener('DOMContentLoaded', function() {
    loadCircuitData(circuit);
});