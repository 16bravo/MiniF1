// PITS.JS
// Pit stop decision logic and pit stop management

// Function to evaluate tire wear tolerance based on race conditions
// Under safety car or yellow flag, drivers can push longer before stopping
function evaluatePitDecision(driver, currentTrackWater, leaderDistanceLeft) {
    // Tolerance for tire wear: drivers stop more easily under normal conditions
    const tireTolerance = flagState === "safetycar" ? 0.66 : flagState === "yellow" ? 0.6 : 0.5;

    // Check if pit stop is needed
    const needsPitStop =
        driver.state === "racing" && // Driver must be racing
        (
            // DAMAGE REPAIR: Car is slightly damaged but not destroyed
            (driver.carState < 0.75 && driver.carState > 0.5) ||
            
            // TIRE MANAGEMENT: Different strategies based on race distance remaining
            (
                // End phase: less than 100km remaining
                (leaderDistanceLeft < 100 && driver.tireState < 0.33) ||
                
                // Final sprint: less than 30km remaining
                (leaderDistanceLeft < 30 && driver.tireState < 0.25) ||
                
                // Normal race (>30km remaining): manage tire wear
                (leaderDistanceLeft >= 30) &&
                (
                    // Tires are worn below tolerance (with driver error margin)
                    driver.tireState < (tireTolerance + generateNormalRandom(0, 0.05)) ||
                    
                    // Wet conditions: wrong tire choice
                    (currentTrackWater > 0.8 && driver.tire !== "W") ||
                    (currentTrackWater > 0.3 && currentTrackWater <= 0.8 && driver.tire !== "I") ||
                    
                    // Dry conditions: wrong tire choice
                    (currentTrackWater === 0 && (driver.tire === "W" || driver.tire === "I"))
                )
            )
        );

    return needsPitStop;
}

// Function to handle pit stop state transitions
function managePitStops(driver, i) {
    const leaderDistanceLeft = raceLength - leader_total_length;
    const currentTrackWater = trackWaterCurve[Math.min(raceFrame, trackWaterCurve.length - 1)];

    // STAGE 1: Call driver to pit (decision)
    if (evaluatePitDecision(driver, currentTrackWater, leaderDistanceLeft)) {
        console.log(`${driver.name}: Box! Box! Box!`);
        driver.state = "box";
    }

    // STAGE 2: Driver crosses pit entry (at start/finish line)
    else if (driver.state === "box" && driver.crossingLine) {
        // Calculate pit stop duration (base + damage penalty)
        driver.pitTimer = Math.round(generateNormalRandom(30 + (1 - driver.carState) * 60, 3));
        driver.state = "in pit";
        console.log(`${driver.name} enters the pit. Stop duration: ${driver.pitTimer} frames`);
    }

    // STAGE 3: Decrement pit timer and handle pit exit
    else if (driver.state === "in pit") {
        driver.pitTimer--;
        
        if (driver.pitTimer <= 0) {
            // Fresh tires and repairs complete
            driver.pitStops = (driver.pitStops || 0) + 1;
            driver.tireState = 1; // Brand new tires
            driver.carState = 1; // Fully repaired car
            driver.tire = chooseNextTire(driver, currentTrackWater, (raceLength - driver.totalLength) / 1000);
            driver.state = "racing";
            console.log(`${driver.name} exits pit. Pit stops: ${driver.pitStops}, New tire: ${driver.tire}`);
        }
    }
}
