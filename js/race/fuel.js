// FUEL.JS
// Fuel load, engine effort, consumption and its consequences.
//
// Model summary:
//  - fuel is a quantity (no unit). A full race at effort 0 burns ~EXPECTED_RACE_BURN.
//  - effort e in [-1 .. 0 .. +1] (save .. normal .. push) is decided ~once per lap
//    by decideEffort() - a pure function that a player input can replace later.
//  - push  -> faster, burns more, stresses the engine (higher failure risk).
//  - a heavier car is slower; the penalty fades to 0 as the tank empties.
//  - empty tank -> retirement (should almost never happen thanks to the guard).

let EXPECTED_RACE_BURN = 100;    // what a full race at effort 0 consumes (~100 GP, ~33 sprint)

// Called from loadCircuitData(), once raceLength is known.
function initFuelModel() {
    const sprint = localStorage.getItem('isSprint') === 'true';
    EXPECTED_RACE_BURN = sprint ? 33 : 100;
    drivers.forEach(d => {
        // GP: 0-5% over what's needed. Sprint: 5-20% over - cars deliberately
        // carry a bit extra so they can push most of the (short) race.
        const margin = sprint ? 0.05 + Math.random() * 0.15 : Math.random() * 0.05;
        d.fuel = EXPECTED_RACE_BURN * (1 + margin);
        d.effort = 0;
        d.engineStress = 0;
        if (d.playerControlled === undefined) d.playerControlled = false;
        d._fuelLap = -1;
    });
    console.log(`Fuel model: expected race burn ${EXPECTED_RACE_BURN}${sprint ? ' (sprint)' : ''}`);
}

// Burn multiplier for a given effort (asymmetric: save a lot of fuel for a little pace).
function fuelBurnMult(e) {
    return e >= 0 ? 1 + e * 0.25 : 1 + e * 0.20;
}

// Pace multiplier from effort + fuel weight. Applied to expectedSpeed each frame.
function fuelPaceFactor(driver) {
    const e = driver.effort || 0;
    const effortMult = 1 + e * 0.03;                                  // ~ +/- 3%
    const weightMalus = 0.03 * Math.max(0, driver.fuel || 0) / 100;   // ~3% full tank -> 0 empty
    return effortMult * (1 - weightMalus);
}

// Burn fuel for the distance covered this frame. Normalised to the race length,
// so a whole race at effort 0 burns exactly EXPECTED_RACE_BURN.
function burnFuel(driver, distanceThisFrame) {
    if (driver.state !== 'racing' && driver.state !== 'box') return;
    if (!(distanceThisFrame > 0) || !(raceLength > 0)) return;
    driver.fuel -= (distanceThisFrame / raceLength) * EXPECTED_RACE_BURN * fuelBurnMult(driver.effort || 0);
    if (driver.fuel < 0) driver.fuel = 0;
}

// Engine stress accumulator: climbs while pushing, decays otherwise.
function updateEngineStress(driver) {
    const e = driver.effort || 0;
    if (e > 0) driver.engineStress = Math.min(1.5, (driver.engineStress || 0) + e * 0.0009);
    else driver.engineStress = Math.max(0, (driver.engineStress || 0) - 0.0005);
}

// Multiplier applied to the mechanical-failure probability in checkForCrash().
function engineStressFailureMultiplier(driver) {
    return 1 + (driver.engineStress || 0) * 0.5;   // up to ~ +75% for a car that pushed all race
}

// Decide a driver's engine effort for the next lap. Pure w.r.t. the driver;
// a player-controlled car keeps whatever effort its input set.
function decideEffort(driver, ctx) {
    if (driver.playerControlled) return;

    const fracLeft = Math.max(0, (raceLength - driver.totalLength) / raceLength);
    const fuelNeeded = fracLeft * EXPECTED_RACE_BURN;
    const margin = driver.fuel - fuelNeeded;          // >0 surplus, <0 deficit
    const gapAhead = ctx.gapAheadSec, gapBehind = ctx.gapBehindSec;

    let e;
    if (flagState === 'yellow' || flagState === 'safetycar' || flagState === 'red') {
        e = -0.8;                                     // everyone saves behind the safety car
    } else if (margin < -6) {
        e = -1;                                       // big deficit: maximum save
    } else if (margin < -1) {
        e = -0.5;                                     // small deficit: save
    } else if (fracLeft < 0.15 && margin > 2.5) {
        e = 1;                                        // last laps with fuel to spare: empty the tank
    } else if (gapBehind > 0 && gapBehind < 1.5 && margin > -1) {
        e = 0.7;                                      // defending a close car: burn to hold position
    } else if (gapAhead > 0 && gapAhead < 2.5 && margin > 0.5) {
        e = 0.6;                                      // attacking a car within reach
    } else if (gapBehind > 40 && gapAhead > 40) {
        e = -0.4;                                     // alone with a huge lead: ease off, protect the engine
    } else {
        e = 0;
    }

    // Guard: never commit to an effort that would project the tank below a small reserve.
    if (fuelNeeded > 0.01) {
        const reserve = 2.5;
        const maxMult = Math.max(0.6, (driver.fuel - reserve) / fuelNeeded);
        const safeE = maxMult >= 1 ? (maxMult - 1) / 0.25 : (maxMult - 1) / 0.20;
        e = Math.max(-1, Math.min(e, safeE));
    }

    driver.effort = e;
}

// Refuelling seam - no refuelling today, but the hook exists for a future
// explicit player option. Call from the pit-stop logic with driver.refuelAmount.
function refuel(driver, amount) {
    if (amount > 0) driver.fuel = Math.max(0, (driver.fuel || 0) + amount);
}
