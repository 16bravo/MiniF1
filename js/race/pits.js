// PITS.JS
// Pit stop decision logic and pit stop management

/**
 * Main pit decision function.
 * Handles: rain strategy, 2-compound rule, mandatory stop ramp, end-of-race veto.
 * @param {Object} driver
 * @param {number} driverIndex - index in drivers[] (used for rank)
 * @param {number} currentTrackWater - current track water level (0-1)
 * @param {number} leaderDistanceLeft - distance leader has left in meters
 * @returns {boolean} true if driver should box
 */
function evaluatePitDecision(driver, driverIndex, currentTrackWater, leaderDistanceLeft) {
    if (driver.state !== "racing") return false;

    const effectiveMandatoryPits = rainyRace ? 0 : MANDATORY_PITS;

    // ─── DAMAGE: always pit if car is damaged but not destroyed ───
    if (driver.carState < 0.75 && driver.carState > 0.5) return true;

    // ─── WEATHER FORECAST ───
    const forecastFrame = Math.min(raceFrame, weatherForecast.length - 1);
    const forecast = weatherForecast[forecastFrame] || { max: 0, avg: 0 };

    // Rank: rank ≤ 10 → conservative (avg), rank > 10 → aggressive (max)
    let rank = 1;
    drivers.forEach((d, i) => { if (i !== driverIndex && d.totalLength > driver.totalLength) rank++; });
    const forecastRef = rank <= 10 ? forecast.avg : forecast.max;

    // Determine target rain tire from forecast (W takes priority over I)
    let rainTargetTire = null;
    if (forecastRef > 0.8)      rainTargetTire = "W";
    else if (forecastRef > 0.3) rainTargetTire = "I";

    // ─── MODE PLUIE: pluie détectée dans les 600 prochaines frames ───
    if (rainTargetTire !== null) {
        driver.waitingForRain = true;
        driver.rainTireTarget = rainTargetTire;

        // Déjà les bons pneus pluie: pas d'arrêt sauf usure critique
        if (driver.tire === rainTargetTire) {
            return driver.tireState < 0.3; // Bon pneu mais très usé → changer quand même
        }

        // Chausser légèrement avant le seuil critique (anticiper)
        const mountThreshold = rainTargetTire === "W" ? 0.6 : 0.2;
        if (currentTrackWater >= mountThreshold) return true; // Piste assez mouillée: piter maintenant

        // Urgence: pneus en fin de vie, pas le choix même si pluie pas encore là
        if (driver.tireState < 0.1) return true;

        return false; // Attendre que la piste soit plus mouillée
    }

    // ─── RETOUR AU SEC: la pluie est passée ───
    if (driver.waitingForRain) {
        if (forecastRef < 0.1 && currentTrackWater < 0.2) {
            driver.waitingForRain = false;
            driver.rainTireTarget = null;
            return true; // Piter pour rechausser en sec
        }
        return false; // Encore humide, attendre
    }

    // ─── MODE SEC ───

    // Mauvais pneu pour piste sèche: piter obligatoirement
    if (currentTrackWater === 0 && (driver.tire === "W" || driver.tire === "I")) return true;

    // VETO fin de course: si obligation remplie, ne pas piter dans les 30 derniers km
    if (driver.pitStops >= effectiveMandatoryPits && leaderDistanceLeft < 30000) return false;

    // Tolérance de base selon drapeau
    let toleranceBase;
    if      (flagState === "safetycar") toleranceBase = 0.66;
    else if (flagState === "yellow")    toleranceBase = 0.60;
    else                                toleranceBase = 0.50;

    // Ramp d'obligation: si mandatory stop non fait, tolérance monte progressivement vers 1.0
    // Commence à 100km du leader, atteint 1.0 à 0km → force impérativement un arrêt avant la fin
    let tolerance;
    if (driver.pitStops < effectiveMandatoryPits) {
        const progression = Math.max(0, 1 - (leaderDistanceLeft / 100000)); // 0 à 100km → 1 à 0km
        tolerance = Math.max(toleranceBase, progression);
    } else {
        tolerance = toleranceBase;
    }

    // Vérifier s'il faut vraiment piter
    const decidedToBoxBasedOnTire = driver.tireState < tolerance;
    
    if (decidedToBoxBasedOnTire) {
        // Quel pneu allons-nous choisir ?
        const nextTire = chooseNextTire(driver, currentTrackWater, (raceLength - driver.totalLength) / 1000);
        
        // Si c'est le MÊME pneu et qu'il n'est pas critique, ne pas piter
        if (nextTire === driver.tire && driver.tireState > 0.3) {
            return false; // Pas d'arrêt nécessaire, le pneu ne change pas
        }
    }
    
    return decidedToBoxBasedOnTire;
}

// Function to handle pit stop state transitions
function managePitStops(driver, i) {
    const leaderDistanceLeft = raceLength - leader_total_length;
    const currentTrackWater = trackWaterCurve[Math.min(raceFrame, trackWaterCurve.length - 1)];

    // STAGE 1: Call driver to pit (decision)
    if (evaluatePitDecision(driver, i, currentTrackWater, leaderDistanceLeft)) {
        console.log(`${driver.name}: Box! Box! Box!`);
        driver.state = "box";
    }

    // STAGE 2: Driver crosses pit entry (at start/finish line)
    else if (driver.state === "box" && driver.crossingLine) {
        // Calculate pit stop duration (base + damage penalty)
        driver.pitTimer = Math.round(generateNormalRandom(30 + (1 - driver.carState) * 60, 3));
        driver.state = "in pit";
        console.log(`${driver.name} enters the pit. Stop duration: ${driver.pitTimer} frames`);
    }

    // STAGE 3: Decrement pit timer and handle pit exit
    else if (driver.state === "in pit") {
        driver.pitTimer--;

        if (driver.pitTimer <= 0) {
            driver.tire = chooseNextTire(driver, currentTrackWater, (raceLength - driver.totalLength) / 1000);  // AVANT
            driver.pitStops = (driver.pitStops || 0) + 1;  // APRÈS
            driver.tireState = 1;
            driver.carState = 1;
            driver.state = "racing";
            console.log(`${driver.name} exits pit. Pit stops: ${driver.pitStops}, New tire: ${driver.tire}`);
        }
    }
}

