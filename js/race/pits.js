// PITS.JS
// Pit stop execution logic and state management
// Strategic decisions are in strategy.js, this file only handles pit stop execution

// Function to handle pit stop state transitions
function managePitStops(driver, i, forecastRef, rainTargetTire) {
    const leaderDistanceLeft = raceLength - leader_total_length;
    const currentTrackWater = trackWaterCurve[Math.min(raceFrame, trackWaterCurve.length - 1)];

    // STAGE 1: Call driver to pit (decision from strategy)
    if (evaluatePitDecision(driver, i, currentTrackWater, leaderDistanceLeft, forecastRef, rainTargetTire)) {
        console.log(`${driver.name}: Box! Box! Box!`);
        driver.state = "box";
    }

    // STAGE 2: Driver crosses pit entry (at start/finish line)
    else if (driver.state === "box" && driver.crossingLine) {
        // Calculate pit stop duration (base + damage penalty)
        driver.pitTimer = Math.round(generateNormalRandom(20 + (1 - driver.carState) * 60, 1));
        driver.state = "in pit";
        console.log(`${driver.name} enters the pit. Stop duration: ${driver.pitTimer} frames`);
    }

    // STAGE 3: Decrement pit timer and handle pit exit
    else if (driver.state === "in pit") {
        driver.pitTimer--;

        if (driver.pitTimer <= 0) {
            driver.tire = chooseNextTire(driver, currentTrackWater, (raceLength - driver.totalLength) / 1000, rainTargetTire);
            driver.pitStops = (driver.pitStops || 0) + 1;
            driver.tireState = 1;
            driver.carState = 1;
            driver.state = "racing";
            console.log(`${driver.name} exits pit. Pit stops: ${driver.pitStops}, New tire: ${driver.tire}`);
        }
    }
}

