// MISTAKES.JS
// Occasional one-off driver errors during the race: a lock-up, a missed
// braking point, a half-spin. DISCRETE events layered on top of the
// (near-deterministic) race pace. Without them the field just settles into a
// fixed order, because the per-frame pace noise averages out over a lap.
//
// Rolled once per lap per driver, from the per-lap strategy block in
// simulation.js. When it fires, the driver is flagged to lose a chunk of
// time at a random point later in the same lap, so mistakes are spread
// around the circuit instead of all happening at the start/finish line.
//
// A human-controlled car is NEVER rolled here: a player makes their own
// mistakes through their inputs. Hence the driver.playerControlled guard -
// today always false, so every car is subject to this for now.

// ===== TUNABLES ==========================================================

// Per-lap mistake probability for an average driver (level 70) in neutral,
// dry conditions. Every modifier below scales this single number.
let MISTAKE_BASE_P = 0.008;

// Severity tiers: how a mistake splits, and what it costs (in seconds of
// track time, converted to a distance loss when applied).
const MISTAKE_TIERS = [
    { name: "lock-up",        weight: 0.72, lossMin: 0.3, lossMax: 1.2  },
    { name: "missed braking", weight: 0.24, lossMin: 1.5, lossMax: 4.0  },
    { name: "spin",           weight: 0.04, lossMin: 5.0, lossMax: 11.0 },
];

// Probability multipliers. 1 = no effect.
const MISTAKE_MOD = {
    levelStep:      0.03,   // per driver-level point away from 70 (below -> more, above -> fewer)
    levelFloor:     0.15,   // a near-perfect driver still keeps 15% of the base risk
    tyreWorn:       2.4,    // dead tyres (<= knee) vs fresh
    tyreWornKnee:   0.40,   // wear level below which the risk starts climbing
    water:          2.6,    // fully wet vs dry
    aggressiveMode: 1.9,    // driver.mode === "agressive"
    gestionMode:    0.55,   // driver.mode === "gestion"
    pressure:       1.7,    // a car within pressureGap seconds behind
    pressureGap:    0.8,
    coldTyres:      2.2,    // within coldFrames of a pit stop or a green-flag restart
    coldFrames:     55,
};

// ===== ROLLS =============================================================

function mistakeProbability(driver, ctx) {
    let p = MISTAKE_BASE_P;

    // Driver skill: better drivers make fewer mistakes.
    const lvl = driver.driverLevel || 70;
    p *= Math.max(MISTAKE_MOD.levelFloor, 1 + (70 - lvl) * MISTAKE_MOD.levelStep);

    // Worn tyres: harder to brake and rotate the car cleanly.
    const tyre = (typeof driver.tireState === "number") ? driver.tireState : 1;
    const wornT = Math.max(0, 1 - tyre / MISTAKE_MOD.tyreWornKnee);   // 0 fresh .. 1 dead
    p *= 1 + (MISTAKE_MOD.tyreWorn - 1) * wornT;

    // Wet track.
    const water = Math.min(1, Math.max(0, ctx.currentTrackWater || 0));
    p *= 1 + (MISTAKE_MOD.water - 1) * water;

    // Driving mode.
    if (driver.mode === "agressive")   p *= MISTAKE_MOD.aggressiveMode;
    else if (driver.mode === "gestion") p *= MISTAKE_MOD.gestionMode;

    // Under pressure from the car behind.
    if (ctx.gapBehindSec > 0 && ctx.gapBehindSec < MISTAKE_MOD.pressureGap) {
        p *= MISTAKE_MOD.pressure;
    }

    // Cold tyres: just out of the pits, or the lap after a restart.
    const now = (typeof raceFrame === "number") ? raceFrame : 0;
    const sincePit   = now - (driver.lastPitExitFrame != null ? driver.lastPitExitFrame : -9999);
    const sinceGreen = now - (ctx.lastGreenFrame != null ? ctx.lastGreenFrame : -9999);
    if (sincePit < MISTAKE_MOD.coldFrames || sinceGreen < MISTAKE_MOD.coldFrames) {
        p *= MISTAKE_MOD.coldTyres;
    }

    return p;
}

// Rolled once per lap from the strategy block. Sets driver.mistakePending*
// if a mistake is triggered for this lap.
function rollLapMistake(driver, ctx) {
    if (driver.playerControlled) return;
    if (driver.state !== "racing") return;
    if (flagState === "yellow" || flagState === "safetycar" || flagState === "red") return;
    if (driver.mistakePending > 0) return;   // never stack two

    if (Math.random() >= mistakeProbability(driver, ctx)) return;

    // Pick a severity tier by weight.
    let r = Math.random() * MISTAKE_TIERS.reduce((s, t) => s + t.weight, 0);
    let tier = MISTAKE_TIERS[MISTAKE_TIERS.length - 1];
    for (const t of MISTAKE_TIERS) { if ((r -= t.weight) <= 0) { tier = t; break; } }

    driver.mistakePending     = tier.lossMin + Math.random() * (tier.lossMax - tier.lossMin);
    driver.mistakePendingTier  = tier.name;
    driver.mistakePendingAt    = 0.12 + Math.random() * 0.76;   // fraction of the lap where it happens
}

// Apply the pending mistake now: knock the driver back by the equivalent
// track distance, mirroring the existing "a moment, keeps going" incident in
// physics.js. Seconds <-> metres uses the same conversion as the sim's gap
// maths (metres = seconds * speed * 30), so "lost 2.0s" really shows up as
// ~2 s dropped to the car behind.
function applyDriverMistake(driver) {
    const sp = Math.max(0.01, driver.speed) * 30;
    driver.totalLength = Math.max(0, driver.totalLength - driver.mistakePending * sp);
    console.log(`${driver.name}: ${driver.mistakePendingTier} - lost ${driver.mistakePending.toFixed(1)}s`);
    driver.mistakePending     = 0;
    driver.mistakePendingTier  = null;
    driver.mistakePendingAt    = 0;
}

// Node/test export (mirrors the pattern used by the other race modules).
if (typeof module !== "undefined" && module.exports) {
    module.exports = { mistakeProbability, rollLapMistake, applyDriverMistake,
                       MISTAKE_TIERS, MISTAKE_MOD };
}
