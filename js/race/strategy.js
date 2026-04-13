// STRATEGY.JS
// Centralized race strategy management
// Orchestrates pit stop decisions, tire strategy, fuel management, and tactical decisions
// Works in conjunction with pits.js (execution) and tires.js (tire properties)

// =====================================================
// WEATHER FORECAST PRE-COMPUTATION
// =====================================================

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
 * @returns {Object} Decision with reason and confidence
 */
function makeStrategyAwarePitDecision(driver, currentTrackWater, leaderDistanceLeft) {
    const basePitNeeded = evaluatePitDecision(driver, currentTrackWater, leaderDistanceLeft);
    const driverIndex = drivers.indexOf(driver);
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

/**
 * Determines next tire based on strategy and remaining race distance
 * Enhanced version of chooseNextTire() with strategic context
 * @param {Object} driver - Driver object
 * @param {number} currentTrackWater - Current track water level
 * @param {number} distanceLeftKm - Distance remaining (km)
 * @param {boolean} considerChampionship - Adjust for championship position (optional)
 * @returns {string} Recommended tire type
 */
function chooseStrategicTire(driver, currentTrackWater, distanceLeftKm, considerChampionship = false) {
    // Use base tire choice function logic
    const baseTire = chooseNextTire(driver, currentTrackWater, distanceLeftKm);
    
    // Strategic adjustment: if driver is in championship contention and ahead
    // -> use harder, longer-lasting tire even if softer is faster
    if (considerChampionship) {
        const position = analyzeDriverPosition(driver, drivers.indexOf(driver));
        if (position.rank <= 3 && distanceLeftKm > 100) {
            // Already leading: longer stints with more durable tire
            if (baseTire === 'S' && distanceLeftKm > 150) return 'M';
        }
    }
    
    return baseTire;
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
