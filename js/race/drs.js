// DRS.JS
// Drag Reduction System (DRS) logic and boost application

// Function to determine if DRS should be active
// DRS enabled after lap 2, dry conditions, and no flags
function isDrsEnabled() {
    // Conditions for DRS to be active:
    // 1. At least 2 laps completed (safety mode)
    // 2. Track is dry (water < 0.2)
    // 3. No yellow/safety car/red flag
    return (currentLap >= 2) && 
           (trackWaterCurve[Math.min(raceFrame, trackWaterCurve.length - 1)] <= 0.2) && 
           !(flagState === "yellow" || flagState === "safetycar" || flagState === "red");
}

// Function to detect if DRS activation zone is available
// (first 10 frames of animation loop for safety)
function isInDrsZone() {
    return currentFrame <= 10;
}

// Function to apply DRS boost to a driver
// DRS provides 6% speed boost when gap to front is < 1 second
function applyDrsBoost(driver, gapSecondsTrack) {
    if (!isDrsEnabled()) return 1.0; // No boost if DRS disabled
    
    if (!isInDrsZone()) return 1.0; // No boost outside DRS zone

    // Gap check: DRS only works if within 1 second of front driver
    if (gapSecondsTrack < 1 && gapSecondsTrack > 0) {
        driver.drsActive = true;
        return 1.06; // 6% speed boost
    }

    driver.drsActive = false;
    return 1.0; // No boost
}
