// TIRES.JS
// Tire selection and grip factor calculations

// Function to determine tire type based on track water conditions and team strategy
function determineTireType(currentTrackWater, forecastTrackWater, driver) {
    // A missing/invalid teamStratLevel (e.g. a driver whose team lookup failed)
    // must not cascade into NaN below - fall back to a neutral mid-level value.
    const stratLevel = Number.isFinite(driver.teamStratLevel) ? driver.teamStratLevel : 50;

    // Simulate judgment error with a normal distribution
    // Adjusted for team strategy level and weather forecast
    const adjustedRain = generateNormalRandom(
        currentTrackWater * (1 - stratLevel/100) + forecastTrackWater * (stratLevel/100),
        0.05
    );

    // Select tire based on adjusted rain/water level. Any non-finite result
    // (bad inputs slipping through) must default to the safe dry choice, not
    // silently fall through every comparison into the worst case (Wet) - both
    // `NaN < 0.3` and `NaN < 0.8` are false, so without this guard a bad
    // number here always meant "W" regardless of the actual weather.
    if (!Number.isFinite(adjustedRain) || adjustedRain < 0.3) {
        return "S"; // Soft
    } else if (adjustedRain < 0.8) {
        return "I"; // Intermediate
    } else {
        return "W"; // Wet
    }
}

// Function to determine grip factor based on tire type and track water conditions
function getGripFactor(currentTire) {
    // Tire influence on grip: [baseGrip, waterDamage]
    const tireInfluence = currentTire === "S" ? [1, -0.75] :
                          currentTire === "I" ? [0.85, -0.25] :
                          currentTire === "W" ? [0.5, 0.2] : [0, 0];
    
    // Calculate tire factor based on track water conditions
    const tireFactor = Math.min(1, Math.max(0, tireInfluence[0] + tireInfluence[1] * currentTrackWater)) * 0.25 + 0.75;
    
    // Calculate overall grip factor from track grip and tire performance
    const gripFactor = Math.pow(grip, 2) * 0.07 + 0.93;
    
    return gripFactor * tireFactor;
}
