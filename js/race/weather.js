// WEATHER.JS
// Weather simulation and grip management

// Function for generating the rainfall curve (two Gaussian peaks)
function generateRainCurve(rainProbability, totalFrames = MAX_WEATHER_FRAMES) {
    const rainCurve = new Array(totalFrames).fill(0);
    const trackWaterCurve = new Array(totalFrames).fill(0);

    // Generate two random peaks to simulate rain bursts
    const peak1 = Math.floor(Math.random() * totalFrames) - 500;
    const peak2 = Math.floor(Math.random() * totalFrames) - 500;

    // Standard deviation according to rain probability (higher probability = wider rain window)
    const stddev = Math.max(50, 600 * (rainProbability / 100));

    // Peak intensity: random amplitude centered on rain probability
    const amplitude1 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));
    const amplitude2 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));

    // Build the rain curves using Gaussian distribution
    for (let i = 0; i < totalFrames; i++) {
        const intensity1 = amplitude1 * Math.exp(-Math.pow(i - peak1, 2) / (2 * Math.pow(stddev, 2)));
        const intensity2 = amplitude2 * Math.exp(-Math.pow(i - peak2, 2) / (2 * Math.pow(stddev, 2)));
        rainCurve[i] = Math.min(1, rainCurve[i] + intensity1 + intensity2) * 1.5 - 0.5;
        trackWaterCurve[i+1] = Math.max(0, Math.min(1, trackWaterCurve[i] + (rainCurve[i]/100 - 0.0005)));
    }

    return [rainCurve, trackWaterCurve];
}

// Function to obtain a description of the current weather conditions
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

// Function to update the grip coefficient based on weather and track usage
function updateGrip(currentWater, carsOnTrack) {
    // Gradual increase if at least one car is running (track rubber build-up)
    if (carsOnTrack > 0) {
        grip += 0.00000231481 * carsOnTrack;
    }

    // Rapid decrease if it rains (aquaplaning risk)
    if (currentWater > 0) {
        grip -= 0.0001 * currentWater;
    }

    // Realistic bounds: grip between 0 (aquaplaning) and 1 (optimal)
    grip = Math.max(0, Math.min(1, grip));
}
