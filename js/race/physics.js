// PHYSICS.JS
// Car performance and crash mechanics

// Logistics function: performance loss based on car damage/wear
// Implements steep degradation between 0.75 and 0.5 car state
function computeCarPerf(carState) {
    // Steep slope between 0.75 and 0.5, min perf = 0.3
    return 0.3 + 0.7 / (1 + Math.exp(-20 * (carState - 0.75)));
}

// Function for calculating the probability of a crash and applying consequences
// Considers driver skill, car state, grip, water, difficulty, and proximity to other drivers
function checkForCrash(i, fronts, currentTrackWater, currentRain, extraCrashRisk) {
    const driver = drivers[i];
    if (driver.state !== "racing") return; // Only racing drivers can crash

    // ===== MECHANICAL WITHDRAWAL =====
    // Random mechanical failure independent of weather/conditions
    let abandonProb = ((101 - driver.reliability) / 100) / 9600;
    if (Math.random() < abandonProb) {
        driver.state = "out";
        driver.carState = 0;
        drivers[i].speed = 0;
        drivers[i].totalLength = drivers[i].totalLength;
        console.log(`${driver.name} retires due to mechanical problems!`);
        triggerFlag('yellow', i); // mechanical failure = yellow flag
        return;
    }

    // ===== CRASH PROBABILITY CALCULATION =====
    // Base risk factors
    const baseRisk = 0.0002;
    const skillFactor = (100 - driver.driverLevel) / 100; // Less skilled = higher risk
    const proneFactor = (driver.crashProne || 50) / 100; // Inherent crash proneness
    const modeFactor = driver.mode === "agressive" ? 1.5 : 1; // Aggressive driving increases risk
    const waterFactor = 1 + currentTrackWater * 2; // Wet track multiplies risk
    const difficultyFactor = 1 + (difficulty || 50) / 100; // Circuit difficulty adds risk
    
    // Proximity risk: close to front driver = higher crash chance
    const gapFront = fronts[i]?.gapMeters || 1000;
    const proximityFront = gapFront < 5 ? 2 : gapFront < 10 ? 1.5 : 1;
    
    // Chain crash bonus: cars near a crash site have increased risk
    let crashChainBonus = extraCrashRisk[i] || 0;

    // Total crash probability (clamped to 0-1)
    let crashProb = baseRisk * skillFactor * proneFactor * modeFactor * waterFactor * difficultyFactor * proximityFront + crashChainBonus;
    if (crashProb > 1) crashProb = 1;

    // ===== CRASH HAPPENED =====
    if (Math.random() < crashProb) {
        // Calculate damage severity (normal distribution around 0.5, max 1)
        const damage = Math.min(1, Math.abs(generateNormalRandom(1, 0.25)));
        driver.carState = Math.max(0, driver.carState - damage);
        driver.carPerf = computeCarPerf(driver.carState);

        console.log(`${driver.name} crashed! Damage: ${damage.toFixed(2)}, Car state: ${driver.carState.toFixed(2)}`);

        // Consequences depend on crash severity
        if (driver.carState < 0.5) {
            // Severe crash: car is out
            driver.state = "out";
            if (currentRain > 0.5) {
                triggerFlag('red', i); // Heavy rain + severe crash = red flag
            } else {
                triggerFlag('safetycar', i); // Normal crash = safety car
            }
        } else if (driver.carState < 0.75) {
            // Minor crash: must pit for repairs
            driver.state = "box";
            driver.carPerf = computeCarPerf(driver.carState);
            triggerFlag('yellow', i);
        }

        // ===== CHAIN CRASH: Propagate risk to nearby drivers =====
        // Driver in front of crash site
        const frontIndex = fronts[i]?.frontIndex;
        const gapFrontCrash = fronts[i]?.gapMeters || 1000;
        if (frontIndex !== undefined && frontIndex !== null && drivers[frontIndex].state === "racing") {
            if (gapFrontCrash < 20) {
                let bonus = (1 - (gapFrontCrash/20))**4; // Stronger effect at very close range
                extraCrashRisk[frontIndex] = Math.max(extraCrashRisk[frontIndex], bonus);
            }
        }

        // Driver behind crash site (need to find who's behind)
        const backIndex = getBackIndex(i, fronts);
        const gapBack = getGapBack(i, fronts);
        if (backIndex !== undefined && backIndex !== null && drivers[backIndex].state === "racing") {
            if (gapBack < 20) {
                let bonus = (1 - (gapBack/20))**4;
                extraCrashRisk[backIndex] = Math.max(extraCrashRisk[backIndex], bonus);
            }
        }
    }
}
