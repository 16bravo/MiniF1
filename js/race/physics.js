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
function checkForCrash(i, fronts, currentTrackWater, currentRain, extraCrashRisk, rainTargetTire) {
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
        triggerFlag('yellow', i, rainTargetTire); // mechanical failure = yellow flag
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

    // Wrong tyre for the conditions sharply raises the risk (slicks in the wet above all)
    const isSlick = driver.tire === "S" || driver.tire === "M" || driver.tire === "H";
    let tyreRisk = 1;
    if (isSlick) {
        if (currentTrackWater > 0.5) tyreRisk = 1.8;       // slicks in real rain: dangerous
        else if (currentTrackWater > 0.25) tyreRisk = 1.3; // slicks on a wet track
    } else if (driver.tire === "W" && currentTrackWater < 0.15) {
        tyreRisk = 1.2;                                    // full wets on a dry line: overheating, no grip
    } else if (driver.tire === "I" && currentTrackWater > 0.85) {
        tyreRisk = 1.2;                                    // intermediates in a deluge
    }

    // Total crash probability (clamped to 0-1)
    let crashProb = baseRisk * skillFactor * proneFactor * modeFactor * waterFactor * difficultyFactor * proximityFront * tyreRisk + crashChainBonus;
    if (crashProb > 1) crashProb = 1;

    // ===== CRASH HAPPENED =====
    if (Math.random() < crashProb) {
        // Calculate damage severity (normal distribution around 0.5, max 1)
        const damage = Math.min(1, Math.abs(generateNormalRandom(1, 0.25)));
        driver.carState = Math.max(0, driver.carState - damage);
        driver.carPerf = computeCarPerf(driver.carState);
        
        // Add to cumulative damage tracking
        cumulativeDamage += damage;

        console.log(`${driver.name} crashed! Damage: ${damage.toFixed(2)}, Car state: ${driver.carState.toFixed(2)}, Cumulative: ${cumulativeDamage.toFixed(2)}`);

        // Consequences depend on crash severity
        if (driver.carState < 0.25) {
            // Severe crash: car is out
            driver.state = "out";
            triggerFlag('safetycar', i, rainTargetTire); // Normal crash = safety car
        } else if (driver.carState < 0.75) {
            // Minor crash: must pit for repairs
            driver.state = "box";
            driver.carPerf = computeCarPerf(driver.carState);
            triggerFlag('yellow', i, rainTargetTire); // Crash with moderate damage = yellow flag
        }

        // ===== CHAIN CRASH: Propagate risk to nearby drivers =====
        // Driver in front of crash site
        const frontIndex = fronts[i]?.frontIndex;
        const gapFrontCrash = fronts[i]?.gapMeters || 1000;
        if (frontIndex !== undefined && frontIndex !== null && drivers[frontIndex].state === "racing") {
            if (gapFrontCrash < 80) {
                let bonus = (1 - (gapFrontCrash/50))**1; // Stronger effect at very close range
                extraCrashRisk[frontIndex] = Math.max(extraCrashRisk[frontIndex] * 0.9, bonus);
            }
        }

        // Driver behind crash site (need to find who's behind)
        const backIndex = getBackIndex(i, fronts);
        const gapBack = getGapBack(i, fronts);
        if (backIndex !== undefined && backIndex !== null && drivers[backIndex].state === "racing") {
            if (gapBack < 80) {
                let bonus = (1 - (gapBack/50))**1; // Stronger effect at very close range
                extraCrashRisk[backIndex] = Math.max(extraCrashRisk[backIndex] * 0.9, bonus);
            }
        }
    }
}

// Apply a racing-incident to one driver (used by the overtaking model).
// Same consequence ladder as a normal crash: minor -> box + yellow, heavy -> out + SC.
function applyRacingIncident(idx) {
    const d = drivers[idx];
    if (!d || d.state !== "racing") return;
    const damage = Math.min(1, Math.abs(generateNormalRandom(0.9, 0.3)));
    d.carState = Math.max(0, d.carState - damage);
    d.carPerf = computeCarPerf(d.carState);
    cumulativeDamage += damage;
    console.log(`${d.name}: racing incident while battling (damage ${damage.toFixed(2)}, car ${d.carState.toFixed(2)})`);
    if (d.carState < 0.25) {
        d.state = "out";
        d.speed = 0;
        triggerFlag('safetycar', idx, d.wetTarget || null);
    } else if (d.carState < 0.75) {
        d.state = "box";
        triggerFlag('yellow', idx, d.wetTarget || null);
    }
}

/**
 * Resolves one overtaking attempt in a single shot (not per frame).
 * Called from the simulation loop when the attacker is in the attack window,
 * same lap, with a real pace/DRS advantage and off cooldown.
 *
 * Mutates: attacker.totalLength, attacker.overtakeCooldown, defender.overtakeCooldown,
 * and car states / flags if there is contact.
 *
 * @returns {'success'|'fail'|'crash'}
 */
function resolveOvertakeAttempt(attackerIdx, defenderIdx, ctx) {
    const attacker = drivers[attackerIdx];
    const defender = drivers[defenderIdx];
    const trackO = (typeof overtaking === 'number' ? overtaking : 50) / 100; // 0 easy .. 1 hard
    const diff = (typeof difficulty === 'number' ? difficulty : 50) / 100;
    const aSkill = attacker.driverLevel || 70;
    const dSkill = defender.driverLevel || 70;
    const dAggr = defender.aggression || 85;
    const paceAdv = Math.max(0, ctx.paceAdvantage || 0);

    // ---- probability the move sticks ----
    let p = 0.15 + 0.5 * (1 - trackO);
    p += Math.min(0.35, paceAdv * 5);
    p += ctx.drsActive ? 0.15 : 0;
    p += (aSkill - 70) / 100 * 0.3;
    p -= (dSkill - 70) / 100 * 0.4;   // a strong driver ahead is genuinely harder to pass
    p -= (dAggr - 50) / 100 * 0.25;   // an aggressive defender shuts the door
    p = Math.max(0.03, Math.min(0.93, p));

    // ---- crash risk for this attempt ----
    const closing = Math.min(1, paceAdv * 6);
    let cAtt = 0.007 * (0.6 + 0.8 * diff) * (1 + (ctx.currentTrackWater || 0) * 1.5) * (1 + closing * 0.4);
    cAtt *= Math.max(0.45, 1 - (aSkill - 70) / 100);
    const cDef = cAtt * 0.3;

    const attackerCrash = Math.random() < cAtt;
    const defenderCrash = Math.random() < cDef;
    if (attackerCrash) applyRacingIncident(attackerIdx);
    if (defenderCrash) applyRacingIncident(defenderIdx);
    if (attackerCrash || defenderCrash) {
        attacker.overtakeCooldown = 150;
        return 'crash';
    }

    if (Math.random() < p) {
        // The move sticks: attacker emerges just ahead of the defender.
        attacker.totalLength = defender.totalLength + (3 + Math.random() * 9);
        attacker.overtakeCooldown = 120;
        defender.overtakeCooldown = Math.max(defender.overtakeCooldown || 0, 45);
        return 'success';
    }

    // The move fails: attacker backs out, loses the tow, needs a lap to line it up again.
    const before = ctx.attackerLengthBefore != null ? ctx.attackerLengthBefore : attacker.totalLength;
    attacker.totalLength = Math.max(before - 25, defender.totalLength - (12 + Math.random() * 18));
    attacker.overtakeCooldown = 200 + Math.round(Math.random() * 120);
    return 'fail';
}
