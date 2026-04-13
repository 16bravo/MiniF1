// WEATHER.JS (shared)
// All weather-related functions for gp_select, qualifying, and race

// Normal random number generator (Box-Muller transform)
// Defined here so this file is self-contained when loaded in gp_select.html
// In quali/race, generateNormalRandom from their own utils.js takes precedence
if (typeof generateNormalRandom === 'undefined') {
    var generateNormalRandom = function(mean, stddev) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return mean + stddev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
}

// Function for generating the rainfall curve (two Gaussian peaks)
// rainProbability: 0-100 (from circuit data)
// totalFrames: number of simulation frames to generate
function generateRainCurve(rainProbability, totalFrames) {
    const rainCurve = new Array(totalFrames).fill(0);
    const trackWaterCurve = new Array(totalFrames).fill(0);

    // Generate two random peaks to simulate rain bursts
    const peak1 = Math.floor(Math.random() * totalFrames/2) - 500;
    const peak2 = Math.floor(Math.random() * totalFrames) - 500;

    // Standard deviation according to rain probability (higher probability = wider rain window)
    const baseStddev = Math.max(50, 600 * (rainProbability / 100));
    const stddev = baseStddev * (1 + Math.random() * 2);

    // Peak intensity: random amplitude centered on rain probability
    const amplitude1 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));
    const amplitude2 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));

    // Build the rain curves using Gaussian distribution
    for (let i = 0; i < totalFrames; i++) {
        const intensity1 = amplitude1 * Math.exp(-Math.pow(i - peak1, 2) / (2 * Math.pow(stddev, 2)));
        const intensity2 = amplitude2 * Math.exp(-Math.pow(i - peak2, 2) / (2 * Math.pow(stddev, 2)));
        rainCurve[i] = Math.min(1, rainCurve[i] + intensity1 + intensity2) * 1.5 - 0.5;
        trackWaterCurve[i + 1] = Math.max(0, Math.min(1, trackWaterCurve[i] + (rainCurve[i] / 100 - 0.0005)));
    }

    return [rainCurve, trackWaterCurve];
}

// ===== QUALIFYING =====

// Update rain and water level for current qualifying frame
function updateWeather() {
    if (currentFrame < rainCurve.length) {
        currentRain = rainCurve[currentFrame];
        forecastRain = rainCurve[Math.min(4000, currentFrame + Math.floor(baseLapTime * 1.5))];
        currentTrackWater = trackWaterCurve[currentFrame];
        forecastTrackWater = trackWaterCurve[Math.min(4000, currentFrame + Math.floor(baseLapTime * 1.5))];
        currentFrame++;
    } else {
        currentRain = 0;
    }
}

// Update the weather display in qualifying
function updateWeatherDisplay() {
    const weatherElement = document.getElementById('weather-info');
    if (currentRain > 0.5) {
        weatherElement.textContent = "Weather: 🌧️ Heavy Rain";
    } else if (currentRain > 0) {
        weatherElement.textContent = "Weather: 🌦️ Light Rain";
    } else if (currentRain > -0.3) {
        weatherElement.textContent = "Weather: ☁️ Cloudy";
    } else {
        weatherElement.textContent = "Weather: ☀️ Sunny";
    }
}

// ===== RACE =====

// Return a text description of current rain intensity
function getWeatherDescription(currentRain) {
    if (currentRain > 0.5) {
        return "Heavy Rain 🌧️";
    } else if (currentRain > 0) {
        return "Light Rain 🌦️";
    } else if (currentRain > -0.25) {
        return "Cloudy ☁️";
    } else {
        return "Sunny ☀️";
    }
}

// Update track grip coefficient based on weather and track usage
function updateGrip(currentWater, carsOnTrack) {
    if (carsOnTrack > 0) {
        grip += 0.00000231481 * carsOnTrack;
    }
    if (currentWater > 0) {
        grip -= 0.0001 * currentWater;
    }
    grip = Math.max(0, Math.min(1, grip));
}
