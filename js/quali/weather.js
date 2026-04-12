// WEATHER.JS
// Weather system and rain/water conditions management

// Function to generate the rainfall curve and track water level simulation
function generateRainCurve(rainProbability, totalFrames = 5000) {
    const rainCurve = new Array(totalFrames).fill(0);
    const trackWaterCurve = new Array(totalFrames).fill(0);

    // Generate two random peaks
    const peak1 = Math.floor(Math.random() * (totalFrames)) - 500;
    const peak2 = Math.floor(Math.random() * (totalFrames)) - 500;

    // Define standard deviation as a function of rain probability
    // Higher probability = wider distribution of rain effects
    const stddev = Math.max(50, 600 * (rainProbability / 100));

    // Generate peak intensities
    const amplitude1 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));
    const amplitude2 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));

    // Add the two peaks to the curve
    for (let i = 0; i < totalFrames; i++) {
        const intensity1 = amplitude1 * Math.exp(-Math.pow(i - peak1, 2) / (2 * Math.pow(stddev, 2)));
        const intensity2 = amplitude2 * Math.exp(-Math.pow(i - peak2, 2) / (2 * Math.pow(stddev, 2)));
        rainCurve[i] = Math.min(1, rainCurve[i] + intensity1 + intensity2) * 1.5 - 0.5; // Limit to 1
        trackWaterCurve[i+1] = Math.max(0, Math.min(1, trackWaterCurve[i] + (rainCurve[i]/100 - 0.0005))); // Limit between 0 and 1
    }

    return [rainCurve, trackWaterCurve];
}

// Weather update function - updates rain and water level for current frame
function updateWeather() {
    if (currentFrame < rainCurve.length) {
        currentRain = rainCurve[currentFrame]; // Collect rain for current frame
        forecastRain = rainCurve[Math.min(4000, currentFrame + Math.floor(baseLapTime * 1.5))]; // Forecast rain in 1.5 normal laps
        currentTrackWater = trackWaterCurve[currentFrame]; // Collect water on track for current frame
        forecastTrackWater = trackWaterCurve[Math.min(4000, currentFrame + Math.floor(baseLapTime * 1.5))]; // Forecast water on track in 1.5 normal laps
        currentFrame++;
    } else {
        currentRain = 0; // After 4000 frames, rain is set to 0
    }
}

// Function to update the weather display with corresponding emoji and description
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
