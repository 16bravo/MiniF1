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

    const effectiveMandatoryPits = rainyRace ? 0 : MANDATORY_PITS;

    // ─── DAMAGE: always pit if car is damaged but not destroyed ───
    if (driver.carState < 0.75 && driver.carState > 0.5) return true;

    // ─── RAIN MODE: rain detected in the next 600 frames ───
    if (rainTargetTire !== null) {
        driver.rainMode = true;
        //driver.rainTireTarget = rainTargetTire;

        // The driver already has the correct rain tire and it's not too worn: no need to pit
        if (driver.tire === rainTargetTire && driver.tireState > 0.3) {
            return false;
        }

        // Pit before rain gets too bad: if forecast is good for rain and track is already wet, pit now to be ready
        const mountThreshold = rainTargetTire === "W" ? 0.6 : 0.2;
        if (currentTrackWater >= mountThreshold) return true;

        // If tire is already very worn, pit anyway to avoid disaster in rain (even if track not yet wet)
        if (driver.tireState < 0.1) return true;

        return false; // Wait for rain to mount or tire to wear more before pitting
    }

    // ─── RETURN TO DRY: rain has passed ───
    if (driver.tire === "W" || driver.tire === "I") {
        if (forecastRef < 0.1 && currentTrackWater < 0.2) {
            driver.rainMode = false;
            //driver.rainTireTarget = null;
            return true; // Pit to switch back to dry tires
        }
        return false; // Still wet, wait
    }

    // ─── DRY MODE ───

    // Wrong tire for dry track: mandatory pit
    if (currentTrackWater === 0 && (driver.tire === "W" || driver.tire === "I")) return true;

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

/**
 * Evaluates if driver should adopt aggressive or conservative mode based on race situation
 * @param {Object} driver - Driver object
 * @param {number} driverIndex - Index of driver
 * @returns {string} Recommended mode: 'agressive', 'defensive', or 'conservative'
 */
function evaluateRaceMode(driver, driverIndex) {
    const position = analyzeDriverPosition(driver, driverIndex);
    const distanceRemaining = position.distanceRemaining;
    
    // Fighting for position: in top 5 and close to driver ahead
    if (position.rank <= 5 && position.gapToLeader < 10) {
        return 'agressive';
    }
    
    // Leader or protected: maintain current position
    if (position.rank === 1 || position.gapToLeader < 2) {
        return 'defensive';
    }
    
    // Back of field or already decided: manage fuel/tires
    if (position.rank > 10) {
        return 'conservative';
    }
    
    // Mid-field default
    return driver.mode;
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
