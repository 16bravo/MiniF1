// STRATEGY.JS
// Centralized race strategy management
// Orchestrates pit stop decisions, tire strategy, fuel management, and tactical decisions
// Works in conjunction with pits.js (execution) and tires.js (tire properties)

// =====================================================
// WEATHER FORECAST PRE-COMPUTATION
// =====================================================

/**
 * Determines the target rain tire based on weather forecast
 * @param {number} forecastRef - Weather forecast reference value (0-1)
 * @returns {string|null} "W" (wet), "I" (intermediate), or null (no rain)
 */
function getRainTargetTire(forecastRef) {
    if (forecastRef > 0.8) return "W";
    if (forecastRef > 0.3) return "I";
    return null;
}

/**
 * Updates the global weather regime ('dry' <-> 'wet'). A change stamps
 * weatherRegimeChangedFrame, which is the ONLY trigger for drivers to (re)pick a
 * rain-tyre plan. Called once per frame from the simulation loop.
 * @param {number} currentTrackWater - current track water level (0-1)
 */
function updateWeatherRegime(currentTrackWater) {
    const fc = weatherForecast[Math.min(raceFrame, weatherForecast.length - 1)] || { max: 0, avg: 0 };
    if (weatherRegime === 'dry' && (currentTrackWater > 0.25 || fc.max > 0.55)) {
        weatherRegime = 'wet';
        weatherRegimeChangedFrame = raceFrame;
        console.log(`Weather regime -> WET at frame ${raceFrame} (water ${currentTrackWater.toFixed(2)})`);
    } else if (weatherRegime === 'wet' && currentTrackWater < 0.15 && fc.avg < 0.1) {
        weatherRegime = 'dry';
        weatherRegimeChangedFrame = raceFrame;
        console.log(`Weather regime -> DRY at frame ${raceFrame}`);
    }
}

/**
 * Picks a driver's rain-tyre plan (driver.wetTarget). Called ONLY at a weather
 * transition (or when a driver rejoins after being in the pits during one), never
 * every frame. Drivers further back gamble more (shorter-term bets): the position
 * used is a snapshot taken at the moment rain arrives, not a live value.
 * @param {Object} driver
 * @param {number} rank - driver's race position at this instant (1 = leader)
 * @param {number} currentTrackWater - current track water level (0-1)
 */
function decideWetStrategy(driver, rank, currentTrackWater) {
    if (weatherRegime === 'dry') { driver.wetTarget = null; return; }

    const fc = weatherForecast[Math.min(raceFrame, weatherForecast.length - 1)] || { max: 0, avg: 0 };
    const gamble = rank >= 11 ? Math.min(1, (rank - 10) / 12) : 0; // 0 for leaders, ~1 for backmarkers
    const heavy = currentTrackWater > 0.55 || fc.max > 0.75;
    const dryingSoon = fc.avg < currentTrackWater - 0.1 && fc.avg < 0.35;
    const currentlySlick = driver.tire === "S" || driver.tire === "M" || driver.tire === "H";

    if (heavy) {
        driver.wetTarget = gamble > 0.5 ? "I" : "W";                 // backmarkers gamble on inters
    } else if (dryingSoon && currentTrackWater < 0.35) {
        driver.wetTarget = gamble > 0.3 ? (currentlySlick ? driver.tire : "S") : "I"; // risk slicks if drying
    } else {
        driver.wetTarget = "I";
    }
}

/**
 * If the track is already wet at the green light, put the whole field on a
 * suitable rain tyre and lock the weather regime to 'wet' from frame 0.
 * Called once, from loadCircuitData(), after the weather curves + forecast are ready.
 */
function applyWetStartConditions() {
    const startWater = (trackWaterCurve && trackWaterCurve[0]) || 0;
    if (startWater <= 0.15) return; // dry (or barely damp) start: nothing to do

    weatherRegime = 'wet';
    weatherRegimeChangedFrame = 0;
    drivers.forEach((driver, i) => {
        if (driver.state === 'out') return;
        decideWetStrategy(driver, i + 1, startWater); // i+1 = grid slot at the start
        driver.wetDecidedRegimeFrame = 0;
        if (driver.wetTarget === 'W' || driver.wetTarget === 'I') {
            driver.tire = driver.wetTarget;
            driver.startingTire = driver.tire;
        }
    });
    console.log(`Wet start (track water ${startWater.toFixed(2)}) - field starts on rain tyres`);
}

// Tire choice options for dry races
const dryChoices = ["S", "M", "H"];

/**
 * Chooses the next tire based on track conditions and race distance
 * Dry rule: first pit must use a compound different from starting tire (2-compound rule)
 * End of race: always prefer S (fastest); never use H unless no choice
 * @param {Object} driver - Driver object
 * @param {number} currentTrackWater - Current track water level (0-1)
 * @param {number} distanceLeftKm - Distance remaining (km)
 * @returns {string} Tire type letter
 */
function chooseNextTire(driver, currentTrackWater, distanceLeftKm, rainTargetTire) {
    // Wet/intermediate conditions take absolute priority (using shared logic)
    if (rainTargetTire !== null) return rainTargetTire;

    // First pit stop: randomly pick any compound except the one used at race start
    // This guarantees the 2-compound rule is satisfied
    if (driver.pitStops < 1) {
        const options = dryChoices.filter(t => t !== driver.startingTire);
        return options[Math.floor(Math.random() * options.length)];
    }

    // End of race (< 50km): always go with Soft for maximum pace
    if (distanceLeftKm < 50) return "S";

    // Mid-race: S or M only, never Hard (too slow, illogical)
    return Math.random() < 0.5 ? "S" : "M";
}

/**
 * Main pit decision function.
 * Handles: rain strategy, 2-compound rule, mandatory stop ramp, end-of-race veto.
 * @param {Object} driver
 * @param {number} driverIndex - index in drivers[] (used for rank)
 * @param {number} currentTrackWater - current track water level (0-1)
 * @param {number} leaderDistanceLeft - distance leader has left in meters
 * @param {number} forecastRef - Reference value from weather forecast
 * @param {string|null} rainTargetTire - Target rain tire type
 * @returns {boolean} true if driver should box
 */
function evaluatePitDecision(driver, driverIndex, currentTrackWater, leaderDistanceLeft, forecastRef, rainTargetTire) {
    if (driver.state !== "racing") return false;

    // No mandatory pits in sprint races or rainy races
    const isSprint = localStorage.getItem('isSprint') === 'true';
    const effectiveMandatoryPits = (rainyRace || isSprint) ? 0 : MANDATORY_PITS;

    // ─── DAMAGE: always pit if car is damaged but not destroyed ───
    if (driver.carState < 0.75 && driver.carState > 0.5) return true;

    // ─── WET-WEATHER STRATEGY ───
    // rainTargetTire here is driver.wetTarget: a plan fixed once, at the last
    // weather-regime change (see decideWetStrategy). This block only executes it,
    // it never re-decides - that is what stops the midfield pit-lane ping-pong.
    const sincePit = raceFrame - (driver.lastPitExitFrame || -9999);
    const onRainTyre = driver.tire === "W" || driver.tire === "I";

    if (rainTargetTire === "W" || rainTargetTire === "I") {
        if (sincePit < 150) return false;                                   // just pitted: settle
        if (driver.tire === rainTargetTire) return driver.tireState < 0.15; // right tyre: only when worn out
        if (onRainTyre) {
            // Already on a rain tyre, just not the planned one - swap only if
            // the conditions now clearly justify it (a small pace delta is not worth a stop).
            if (rainTargetTire === "W" && currentTrackWater > 0.6) return true;
            if (rainTargetTire === "I" && currentTrackWater < 0.4) return true;
            return driver.tireState < 0.15;
        }
        return true;                                                        // on slicks, rain is here
    }

    // ─── RETURN TO DRY: the plan is to run slicks ───
    if (onRainTyre) {
        if (sincePit < 150) return false;
        if (weatherRegime === "dry" && currentTrackWater < 0.3) return true;
        return false; // still too wet to commit to slicks
    }

    // ─── DRY MODE ───

    // End-of-race veto: if mandatory stop fulfilled, do not pit in the last 30 km
    if (driver.pitStops >= effectiveMandatoryPits && leaderDistanceLeft < 30000) return false;

    // Base tolerance according to flag
    let toleranceBase;
    if      (flagState === "safetycar") toleranceBase = 0.66;
    else if (flagState === "yellow")    toleranceBase = 0.60;
    else                                toleranceBase = 0.50;

    // Mandatory stop ramp: if mandatory stop not done, tolerance gradually increases to 1.0
    // Starts at 100km from leader, reaches 1.0 at 0km → forces a stop before the end
    let tolerance;
    if (driver.pitStops < effectiveMandatoryPits) {
        const progression = Math.max(0, 1 - (leaderDistanceLeft / 100000)); // 0 à 100km → 1 à 0km
        tolerance = Math.max(toleranceBase, progression);
    } else {
        tolerance = toleranceBase;
    }

    // Check if we really need to pit
    const decidedToBoxBasedOnTire = driver.tireState < tolerance;
    
    if (decidedToBoxBasedOnTire) {
        // Which tire will we choose?
        const nextTire = chooseNextTire(driver, currentTrackWater, (raceLength - driver.totalLength) / 1000, rainTargetTire);
        
        // If it's the SAME tire and it's not critical, do not pit
        if (nextTire === driver.tire && driver.tireState > 0.3) {
            return false; // No stop needed, tire does not change
        }
    }
    
    return decidedToBoxBasedOnTire;
}

/**
 * Pre-computes a 600-frame rolling weather forecast for every frame of the race.
 * Called once after trackWaterCurve is loaded (in animation.js).
 * Result stored in global weatherForecast[].
 * Each entry: { max: number, avg: number }
 */
function computeWeatherForecast() {
    const WINDOW = 600;
    weatherForecast = trackWaterCurve.map((_, t) => {
        const slice = trackWaterCurve.slice(t, Math.min(t + WINDOW, trackWaterCurve.length));
        const max = Math.max(...slice);
        const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length;
        return { max, avg };
    });
    console.log(`Weather forecast pre-computed: ${weatherForecast.length} frames`);
}

// =====================================================
// STRATEGIC ANALYSIS & DECISION MAKING
// =====================================================

/**
 * Analyzes current driver position and standing relative to competition
 * @param {Object} driver - Driver object to analyze
 * @param {number} driverIndex - Index of driver in drivers array
 * @returns {Object} Position analysis with rank, gap to leader, laps behind
 */
function analyzeDriverPosition(driver, driverIndex) {
    // Find driver's current rank
    let rank = 1;
    let gapToLeader = 0;
    let lapsBehind = 0;
    
    if (drivers && drivers.length > 0) {
        const leaderLength = Math.max(...drivers.map(d => d.totalLength));
        drivers.forEach((d, i) => {
            if (i !== driverIndex && d.totalLength > driver.totalLength) {
                rank++;
            }
        });
        
        gapToLeader = leaderLength - driver.totalLength;
        lapsBehind = Math.floor(gapToLeader / circuitLength);
    }
    
    return {
        rank,
        gapToLeader,
        lapsBehind,
        distanceRemaining: Math.max(0, raceLength - driver.totalLength)
    };
}

/**
 * Projects the number of pit stops needed for the race
 * @param {Object} driver - Driver object
 * @param {number} distanceRemainingKm - Distance left in race (km)
 * @returns {number} Estimated pit stops still needed
 */
function projectPitStopsNeeded(driver, distanceRemainingKm) {
    if (distanceRemainingKm <= 0) return 0;
    
    // Estimate distance per tire stint (conservative: 150-200km depending on wear)
    const tireWearRate = TIRES[driver.tire].wearRate;
    const estimatedTireStintDistance = 150 + (driver.tireManagement / 100) * 50;
    
    // Estimate remaining stints needed
    const stintsNeeded = Math.ceil(distanceRemainingKm / estimatedTireStintDistance);
    
    // Pit stops = stints - 1 (current stint doesn't need a stop)
    return Math.max(0, stintsNeeded - 1);
}

// ===== DRIVING MODE =====
// Tactical driving style, decided ~once per lap (parallel to fuel effort, separate axis):
//   agressive - drives on the edge: effective level up (attack AND defence), tyres wear
//               faster, crash risk up. Both cars in a battle are forced here.
//   normal    - the resting state.
//   gestion   - eases off: protects worn tyres and the car, slightly below its edge.
// Kept simple and centralised so the numbers are easy to retune after testing.
const MODE_WEAR        = { gestion: 0.98, normal: 1.0, agressive: 1.02 };
const MODE_CRASH_MULT  = { gestion: 1.0,  normal: 1.0, agressive: 1.5  };
const MODE_LEVEL_BONUS = { gestion: -2,   normal: 0,   agressive: 4    };

function modeWearFactor(driver)  { const v = MODE_WEAR[driver.mode];        return v === undefined ? 1 : v; }
function modeCrashFactor(driver) { const v = MODE_CRASH_MULT[driver.mode];  return v === undefined ? 1 : v; }
function modeLevelBonus(driver)  { const v = MODE_LEVEL_BONUS[driver.mode]; return v === undefined ? 0 : v; }

/**
 * Picks a driver's driving mode for the next lap. Pure w.r.t. the driver;
 * a player-controlled car keeps whatever mode its input set.
 * @param {Object} driver
 * @param {{gapAheadSec:number, gapBehindSec:number}} ctx - gaps to the nearest rivals in race order
 * @returns {'gestion'|'normal'|'agressive'}
 */
function evaluateRaceMode(driver, ctx) {
    if (driver.playerControlled) return driver.mode;

    // Personality: a naturally aggressive driver fights from further away and
    // eases off more reluctantly. driver.aggression is a fixed trait for now.
    const aggrBias = ((driver.aggression || 70) - 70) / 30;   // ~ -2.3 .. +1
    const attackReach = 1.0 + aggrBias * 0.5;                 // only truly on the gearbox counts
    const defendReach = 0.9 + aggrBias * 0.4;
    const fracLeft = Math.max(0, (raceLength - driver.totalLength) / raceLength);
    const tyre = driver.tireState;
    const ahead = ctx.gapAheadSec, behind = ctx.gapBehindSec;

    if (flagState === "yellow" || flagState === "safetycar" || flagState === "red") {
        return "gestion";                                     // no overtaking anyway
    }
    if (tyre < 0.28 && fracLeft > 0.15 && !(behind > 0 && behind < defendReach)) {
        return "gestion";                                     // tyres nearly gone: nurse them (unless actively defending)
    }
    if ((behind > 0 && behind < defendReach) || (ahead > 0 && ahead < attackReach)) {
        return "agressive";                                   // nose-to-tail fight, either side
    }
    if (fracLeft < 0.12 && (ahead < 3 || behind < 3)) {
        return "agressive";                                   // last laps, a place still within reach
    }
    if (tyre < 0.40 || (ahead > 6 && behind > 6)) {
        return "gestion";                                     // worn tyres or clear track: ease off, save the car
    }
    return "normal";
}

/**
 * Calculates optimal fuel consumption rate based on race situation
 * @param {Object} driver - Driver object
 * @param {number} distanceRemainingKm - Distance left in race (km)
 * @returns {number} Fuel multiplier (0.8 = conservative, 1.0 = normal, 1.2 = aggressive)
 */
function calculateFuelStrategy(driver, distanceRemainingKm) {
    if (distanceRemainingKm <= 0) return 0;
    
    const position = analyzeDriverPosition(driver, drivers.indexOf(driver));
    
    // Low on fuel: must be conservative
    if (driver.fuel < 15) {
        return 0.7; // Aggressive fuel saving
    }
    
    // Final sprint: can use remaining fuel
    if (distanceRemainingKm < 20) {
        return 1.3; // Aggressive sprint
    }
    
    // Leader or fighting for position: normal consumption
    if (position.rank <= 5) {
        return 1.0;
    }
    
    // Back of field: save fuel
    return 0.85;
}

/**
 * Computes tire wear threshold adjustment based on multiple factors
 * Accounts for flag state, remaining distance, and driver tactics
 * @param {number} leaderDistanceLeft - Distance leader has remaining (m)
 * @param {string} currentTire - Current tire type letter
 * @param {number} tireManagement - Driver's tire management skill (0-100)
 * @returns {number} Adjusted tire tolerance threshold for pit decision
 */
function calculateTireTolerance(leaderDistanceLeft, currentTire, tireManagement) {
    // Base tolerance by flag state
    let tolerance = 0.5;
    if (flagState === "safetycar") tolerance = 0.66;
    if (flagState === "yellow") tolerance = 0.6;
    
    // Adjust by remaining distance
    if (leaderDistanceLeft < 30) {
        tolerance = 0.25; // Final sprint: keep pushing
    } else if (leaderDistanceLeft < 100) {
        tolerance = 0.33; // End phase: more aggressive
    }
    
    // Apply driver skill (high tire management = lower tolerance, push longer)
    const skillBonus = (tireManagement / 100) * 0.15;
    tolerance -= skillBonus;
    tolerance = Math.max(0.2, tolerance); // Minimum threshold of 0.2
    
    return tolerance;
}

/**
 * Analyzes pit stop window: is now a good time to pit?
 * Considers position, gap to next driver, and traffic
 * @param {Object} driver - Driver object
 * @param {number} driverIndex - Index of driver
 * @returns {Object} Pit window analysis with safety and opportunity scores
 */
function analyzePitWindow(driver, driverIndex) {
    const position = analyzeDriverPosition(driver, driverIndex);
    
    // Find nearest traffic ahead and behind
    let nearestAhead = Infinity;
    let nearestBehind = Infinity;
    
    drivers.forEach((d, i) => {
        if (d.state !== 'racing') return;
        if (i !== driverIndex) {
            const gap = d.totalLength - driver.totalLength;
            if (gap > 0 && gap < nearestAhead) nearestAhead = gap;
            if (gap < 0 && Math.abs(gap) < nearestBehind) nearestBehind = Math.abs(gap);
        }
    });
    
    // Safe pit window: if gap to next driver > 25 meters
    const isSafeWindow = nearestAhead > 25;
    
    // Good opportunity: traffic behind is >15 meters away
    const isGoodOpportunity = nearestBehind > 15;
    
    return {
        isSafeWindow,
        isGoodOpportunity,
        nearestAheadGap: nearestAhead,
        nearestBehindGap: nearestBehind,
        overallSafety: isSafeWindow ? 1.0 : (nearestAhead / 25)
    };
}

/**
 * Suggests tactical decisions based on race situation
 * Recommends pit timing, tire type adjustments, and mode changes
 * @param {Object} driver - Driver object
 * @param {number} driverIndex - Index of driver
 * @param {number} currentTrackWater - Current track water level (0-1)
 * @returns {Object} Tactical recommendations
 */
function generateTacticalRecommendation(driver, driverIndex, currentTrackWater) {
    const position = analyzeDriverPosition(driver, driverIndex);
    const pitWindow = analyzePitWindow(driver, driverIndex);
    const mode = evaluateRaceMode(driver, driverIndex);
    const fuelMultiplier = calculateFuelStrategy(driver, position.distanceRemaining);
    
    return {
        rank: position.rank,
        recommendedMode: mode,
        currentWindowSafety: pitWindow.overallSafety,
        shouldConsiderPit: pitWindow.isSafeWindow && position.distanceRemaining > 50,
        fuelStrategy: fuelMultiplier,
        adaptToWeather: currentTrackWater > 0.3,
        projectedStopsNeeded: projectPitStopsNeeded(driver, position.distanceRemaining / 1000)
    };
}

// =====================================================
// TRACK POSITION UPDATES & HISTORICAL TRACKING
// =====================================================

/**
 * Stores strategy history track for each driver
 * Useful for analyzing strategy effectiveness and detecting anomalies
 */
const strategyHistory = {};

/**
 * Records a strategy decision for later analysis
 * @param {number} driverIndex - Index of driver
 * @param {string} decision - Type of decision (pit, mode_change, tire_choice, etc.)
 * @param {Object} context - Contextual data about the decision
 */
function recordStrategyDecision(driverIndex, decision, context) {
    if (!strategyHistory[driverIndex]) {
        strategyHistory[driverIndex] = [];
    }
    
    strategyHistory[driverIndex].push({
        frame: raceFrame,
        decision,
        context
    });
}

/**
 * Retrieves last strategic decision made for a driver
 * @param {number} driverIndex - Index of driver
 * @returns {Object|null} Last decision or null if none
 */
function getLastStrategyDecision(driverIndex) {
    const history = strategyHistory[driverIndex];
    return history && history.length > 0 ? history[history.length - 1] : null;
}

// =====================================================
// INTEGRATION WITH PIT MANAGEMENT
// =====================================================

/**
 * Enhanced pit decision that incorporates strategic context
 * Wraps evaluatePitDecision() with additional safety checks
 * @param {Object} driver - Driver object
 * @param {number} currentTrackWater - Current track water level
 * @param {number} leaderDistanceLeft - Distance leader has remaining (m)
 * @param {number} forecastRef - Reference value from weather forecast
 * @param {string|null} rainTargetTire - Target rain tire type
 * @returns {Object} Decision with reason and confidence
 */
function makeStrategyAwarePitDecision(driver, currentTrackWater, leaderDistanceLeft, forecastRef, rainTargetTire) {
    const driverIndex = drivers.indexOf(driver);
    const basePitNeeded = evaluatePitDecision(driver, driverIndex, currentTrackWater, leaderDistanceLeft, forecastRef, rainTargetTire);
    const pitWindow = analyzePitWindow(driver, driverIndex);
    
    return {
        shouldPit: basePitNeeded,
        isSafeWindow: pitWindow.isSafeWindow,
        overallGreen: basePitNeeded && pitWindow.isSafeWindow,
        reason: basePitNeeded ? 
            (pitWindow.isSafeWindow ? 'Pit needed, safe window' : 'Pit needed, risky window') :
            'No pit needed'
    };
}

// =====================================================
// RACE STATUS SUMMARY
// =====================================================

/**
 * Generates a comprehensive strategy status for all drivers
 * Useful for debugging and understanding current race strategy state
 * @returns {Array} Array of strategy status objects for each driver
 */
function getFullStrategyStatus() {
    return drivers.map((driver, i) => ({
        name: driver.name,
        rank: analyzeDriverPosition(driver, i).rank,
        pitsCompleted: driver.pitStops,
        pitsEstimated: projectPitStopsNeeded(driver, analyzeDriverPosition(driver, i).distanceRemaining / 1000),
        currentTire: driver.tire,
        tireState: driver.tireState.toFixed(2),
        fuel: driver.fuel.toFixed(1),
        mode: driver.mode,
        lastDecision: getLastStrategyDecision(i)
    }));
}
