// PHYSICS.JS
// Car performance and crash mechanics

// Caution-rate tuning. Targets per Grand Prix: ~3 retirements, but only ~1 yellow
// and ~0.67 safety car - most cars that drop out do so without a flag (stopped
// in a safe place, parked in the pits, beached in a run-off).
//  - INCIDENT_SERIOUS : fraction of incidents that damage the car (rest = a moment).
//  - SC_DAMAGE_SD     : spread of the damage a serious incident does.
//  - SC_CARSTATE      : carState below which the car is out.
//  - TERMINAL_FLAG    : of terminal crashes, how they split flag-wise.
//  - DAMAGED_YELLOW   : chance a damaged (but running) car brings out a yellow -
//                       usually it just limps to the pits under green.
const INCIDENT_SERIOUS = 0.58;
const SC_DAMAGE_SD = 0.5;
const SC_CARSTATE = 0.35;
const TERMINAL_FLAG = { safetycar: 0.36, yellow: 0.13 };  // remainder (0.51) -> no flag
const DAMAGED_YELLOW = 0.22;

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
    // Random mechanical failure - baseline from reliability, raised by sustained
    // engine stress (a driver who has been pushing hard all race). Denominator
    // tuned for ~1.6 mechanical DNF per race - most without a flag.
    let abandonProb = ((101 - driver.reliability) / 100) / 8000;
    if (typeof engineStressFailureMultiplier === 'function') {
        abandonProb *= engineStressFailureMultiplier(driver);
    }
    if (Math.random() < abandonProb) {
        driver.state = "out";
        driver.carState = 0;
        drivers[i].speed = 0;
        drivers[i].totalLength = drivers[i].totalLength;
        console.log(`${driver.name} retires due to mechanical problems!`);
        // A stricken car usually rolls to a safe spot - only some failures bring out a caution.
        if (Math.random() < 0.16) triggerFlag('yellow', i, rainTargetTire);
        return;
    }

    // ===== CRASH PROBABILITY CALCULATION =====
    // Base risk factors
    const baseRisk = 0.0006;   // tuned with INCIDENT_SERIOUS for the target caution rate
    const skillFactor = (100 - driver.driverLevel) / 100; // Less skilled = higher risk
    const proneFactor = (driver.crashProne || 50) / 100; // Inherent crash proneness
    const modeFactor = (typeof modeCrashFactor === "function") ? modeCrashFactor(driver)
                     : (driver.mode === "agressive" ? 1.5 : 1); // Aggressive driving increases risk
    const waterFactor = 1 + currentTrackWater * 1.1; // Wet track multiplies risk (~2.1x soaked)
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

    // ===== INCIDENT HAPPENED =====
    if (Math.random() < crashProb) {
        // Most incidents are just a moment - a lock-up or a trip through the
        // gravel: time lost, no damage, no flag. Only INCIDENT_SERIOUS of them
        // actually damage the car (repair stop = yellow, or terminal = safety car).
        if (Math.random() > INCIDENT_SERIOUS) {
            driver.totalLength = Math.max(0, driver.totalLength - (15 + Math.random() * 45));
            console.log(`${driver.name}: a moment, keeps going`);
            return;
        }

        // Serious: guaranteed to cost the car something.
        const damage = Math.min(1, 0.38 + Math.abs(generateNormalRandom(0, SC_DAMAGE_SD)));
        driver.carState = Math.max(0, driver.carState - damage);
        driver.carPerf = computeCarPerf(driver.carState);
        cumulativeDamage += damage;

        console.log(`${driver.name} crashed! Damage: ${damage.toFixed(2)}, Car state: ${driver.carState.toFixed(2)}, Cumulative: ${cumulativeDamage.toFixed(2)}`);

        if (driver.carState < SC_CARSTATE) {
            // Terminal: the car is out. A crash out doesn't always bring a caution -
            // sometimes the car stops clear, sometimes it's a big one.
            driver.state = "out";
            const roll = Math.random();
            if (roll < TERMINAL_FLAG.safetycar) triggerFlag('safetycar', i, rainTargetTire);
            else if (roll < TERMINAL_FLAG.safetycar + TERMINAL_FLAG.yellow) triggerFlag('yellow', i, rainTargetTire);
        } else {
            // Damaged but going: pits for repairs, usually under green.
            driver.state = "box";
            driver.carPerf = computeCarPerf(driver.carState);
            if (Math.random() < DAMAGED_YELLOW) triggerFlag('yellow', i, rainTargetTire);
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
    const damage = Math.min(1, Math.abs(generateNormalRandom(0, SC_DAMAGE_SD * 1.1)));
    d.carState = Math.max(0, d.carState - damage);
    d.carPerf = computeCarPerf(d.carState);
    cumulativeDamage += damage;
    console.log(`${d.name}: racing incident while battling (damage ${damage.toFixed(2)}, car ${d.carState.toFixed(2)})`);
    if (d.carState < SC_CARSTATE) {
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
    // Effective skill includes the driving-mode bonus (both cars in a battle are
    // forced aggressive, so the level bump largely cancels - they just both pay
    // the tyre / crash cost of a long fight).
    const aSkill = (attacker.driverLevel || 70) + modeLevelBonus(attacker);
    const dSkill = (defender.driverLevel || 70) + modeLevelBonus(defender);
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
