// PITS.JS
// Pit stop execution logic and state management
// Strategic decisions are in strategy.js, this file only handles pit stop execution

// ===== PIT STOP TUNABLES =================================================
// Base duration is a tight Normal(20s, 1s) - by itself that makes a truly bad
// stop statistically impossible (a 15s+ overrun would be a +15 sigma event).
// This layers an occasional crew error on top, independent of car damage -
// same "roll a probability, then pick a severity tier by weight" pattern as
// driver mistakes (see mistakes.js).
const PIT_ISSUE_P = 0.10; // ~10% of stops have some kind of hiccup
const PIT_ISSUE_TIERS = [
    { name: "slow wheel change",      weight: 0.70, lossMin: 1.5, lossMax: 4  },
    { name: "sticky wheel nut",       weight: 0.22, lossMin: 5,   lossMax: 10 },
    { name: "cross-threaded wheel nut", weight: 0.08, lossMin: 15,  lossMax: 30 },
];

// Rolls whether this stop has a crew error and, if so, how much extra time
// it costs. Returns 0 (no issue) most of the time.
function rollPitIssue() {
    if (Math.random() >= PIT_ISSUE_P) return { extra: 0, tier: null };

    let r = Math.random() * PIT_ISSUE_TIERS.reduce((s, t) => s + t.weight, 0);
    let tier = PIT_ISSUE_TIERS[PIT_ISSUE_TIERS.length - 1];
    for (const t of PIT_ISSUE_TIERS) { if ((r -= t.weight) <= 0) { tier = t; break; } }

    return { extra: tier.lossMin + Math.random() * (tier.lossMax - tier.lossMin), tier: tier.name };
}

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
        // Calculate pit stop duration (base + damage penalty), plus an
        // occasional crew error on top (see PIT_ISSUE_* above).
        const baseTime = generateNormalRandom(20 + (1 - driver.carState) * 60, 1);
        const issue = rollPitIssue();
        driver.pitTimer = Math.round(baseTime + issue.extra);
        driver.state = "in pit";
        if (issue.tier) {
            console.log(`${driver.name}: ${issue.tier} - lost an extra ${issue.extra.toFixed(1)}s in the pits`);
        }
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
            // Refuelling seam: no refuelling today (refuelAmount is always 0), but a
            // future explicit player option can set driver.refuelAmount before the stop.
            if (typeof refuel === "function" && driver.refuelAmount > 0) {
                refuel(driver, driver.refuelAmount);
                driver.refuelAmount = 0;
            }
            driver.state = "racing";
            driver.lastPitExitFrame = raceFrame; // decision cooldown starts now
            console.log(`${driver.name} exits pit. Pit stops: ${driver.pitStops}, New tire: ${driver.tire}`);
        }
    }
}

