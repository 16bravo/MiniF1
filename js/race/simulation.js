// SIMULATION.JS
// Main race simulation loop - orchestrates all physics, weather, pit stops, and driver updates

// Frame by frame race simulation function
// This is the main orchestrator that updates all drivers and game state each frame
function frame(interval) {
    // ===== GENERAL TRACK SIMULATION =====
    // TIMING: Increment global frame counter
    raceFrame++;

    // ===== RECORD FRAME STATE =====
    recordCurrentFrame(
        {
            raceFrame: raceFrame,
            currentLap: currentLap
        },
        {
            raceTimeLeft: raceTimeLeft,
            eventTimeLeft: eventTimeLeft,
            flagState: flagState,
            flagTimer: flagTimer,
            drsEnabled: isDrsEnabled(),
            rainyRace: rainyRace,
            grip: grip,
            gripFactor: gripFactor,
            currentRain: rainCurve[Math.min(raceFrame, rainCurve.length - 1)],
            currentTrackWater: trackWaterCurve[Math.min(raceFrame, trackWaterCurve.length - 1)]
        },
        drivers
    );

    // ===== RACE TIMING =====
    // Checking end of race
    if (eventTimeLeft > 0) eventTimeLeft--; // Event time always decrements
    if (raceTimeLeft > 0 && flagState !== 'red') raceTimeLeft--; // Race time stops under red flag

    // Check if one of the timers falls below 5 minutes (300s)
    const showRaceTimer = raceTimeLeft > 0 && raceTimeLeft <= 300;
    const showEventTimer = eventTimeLeft > 0 && eventTimeLeft <= 300;

    // Update display: show timer if < 5 min remaining, otherwise show lap count
    if (showRaceTimer || showEventTimer) {
        let timerText = '';
        if (showRaceTimer) {
            timerText += `TIME LEFT </br> <strong>${Math.floor(raceTimeLeft/60)}:${(raceTimeLeft%60).toString().padStart(2, '0')}</strong>`;
        }
        if (showEventTimer) {
            timerText += `TIME LEFT </br> <strong>${Math.floor(eventTimeLeft/60)}:${(eventTimeLeft%60).toString().padStart(2, '0')}</strong>`;
        }
        document.getElementById('ind').innerHTML = `<strong>${timerText.trim()}</strong>`;
    } else {
        document.getElementById('ind').innerHTML = "<strong>LAP </br>" + currentLap + "</strong> / " + laps;
    }

    // ===== DISTANCE CALCULATION =====
    const leaderDistanceLeft = raceLength - leader_total_length; // Remaining race distance

    // ===== WEATHER UPDATE =====
    // Retrieve current weather from rain curves
    const currentRain = rainCurve[Math.min(raceFrame, rainCurve.length - 1)];
    const currentTrackWater = trackWaterCurve[Math.min(raceFrame, trackWaterCurve.length - 1)];
    document.getElementById('weather').textContent = getWeatherDescription(currentRain);
    
    // Update rainy race flag when water appears on track
    if (currentTrackWater > 0) {
        rainyRace = true;
    }

    // Weather regime ('dry' <-> 'wet'): a change here is the only moment drivers
    // (re)decide their rain-tyre plan - it is never recomputed frame to frame.
    updateWeatherRegime(currentTrackWater);

    // ===== GRIP UPDATE =====
    // Count the number of cars on track (excluding pits and retirements)
    let carsOnTrack = drivers.filter(d => d.state === "racing").length;
    updateGrip(currentTrackWater, carsOnTrack);
    gripFactor = (1 / (1 + Math.exp(-10 * (grip - 0.5))) * 0.2) + 0.8;

    // ===== FLAGS & SAFETY CAR MANAGEMENT =====
    // Decrement flagTimer if a temporary flag is active
    if (flagTimer >= 0) {
        flagTimer--;
        
        if (flagTimer <= 0) {
            if (flagState === "green") {
                // End of green flag display
                flagState = "ending";
                document.getElementById('flagBanner').style.opacity = "0";
            } else if (flagState === "yellow" || flagState === "safetycar") {
                // Yellow/Safety car ended: return to green
                flagState = "green";
                lastGreenFrame = raceFrame;   // cold-tyre mistake window on the restart lap
                showFlagBanner("green");
            }
        }
    }

    // RED FLAG RESTART CHECK: After 300 frames minimum, restart when rain clears
    if (flagState === "red" && flagTimer < 0 && currentRain < 0.2) {
        console.log("End of red flag - conditions met for restart");
        flagState = "green";
        lastGreenFrame = raceFrame;   // cold-tyre mistake window on the restart lap
        showFlagBanner("green");
        // Resume all drivers from red flag classification
        for (let pos = 0; pos < redFlagClassification.length; pos++) {
            let idx = redFlagClassification[pos];
            drivers[idx].state = "racing";
        }
    }

    // ===== CUMULATIVE DAMAGE WINDOW MANAGEMENT =====
    // Function to manage cumulative damage window for red flag trigger
    function updateDamageWindow() {
        const framesSinceReset = raceFrame - damageWindowStartFrame;
        
        // Reset window if 300 frames have passed
        if (framesSinceReset >= DAMAGE_WINDOW) {
            cumulativeDamage = 0;
            damageWindowStartFrame = raceFrame;
        }
        
        // Check if damage threshold exceeded
        if (cumulativeDamage > DAMAGE_RED_FLAG_THRESHOLD && flagState !== 'red') {
            return true; // Trigger red flag
        }
        return false;
    }

    // ===== DRIVERS SIMULATION =====
    // MAIN RACE LOOP: Update each frame while race is running
    if (leader_total_length <= raceLength && raceTimeLeft > 0 && eventTimeLeft > 0) {
        // Get current lap (distance of the leader divided by circuit length)
        currentLap = Math.ceil(leader_total_length / circuitLength);

        // ===== RACE RANKING =====
        // Sort drivers by distance (true live ranking)
        let sorted_indices = [...Array(nb_driver).keys()].sort((a, b) => drivers[b].totalLength - drivers[a].totalLength);
        
        // Filter on racing drivers only
        let racing_indices = sorted_indices.filter(idx =>
            (drivers[idx].state === "racing" || drivers[idx].state === "box") && drivers[idx].carState > 0.7 && drivers[idx].tireState > 0.5
        );

        // Build driver ranking array
        let driver_ranking = new Array(nb_driver);
        for (let r = 0; r < racing_indices.length; r++) {
            driver_ranking[racing_indices[r]] = r + 1;
        }

        // Get driver in front of each driver on track
        const fronts = computeFrontsForAll();

        // Get gaps to front in rankings
        const frontIndicesRanking = computeGapsFrontInRanking(drivers, driver_ranking);

        // Nearest racing car ahead in the order, and its speed this frame - used
        // only under caution: the follower matches it exactly and can never pass it.
        // Infinity length means "no racing car ahead" (this is the train leader).
        let cautionAheadLen = Infinity;
        let cautionTrainPace = 0;   // the caution train's pace, set by the first racing car

        // ===== UPDATE EACH DRIVER =====
        // Process drivers in race order (fastest first)
        for (let pos = 0; pos < sorted_indices.length; pos++) {
            let i = sorted_indices[pos]; // Driver index in original array
            let driverLengthBefore = drivers[i].totalLength; // Store length before update for gap calculations
            const driver = drivers[i];
            if (driver.overtakeCooldown > 0) driver.overtakeCooldown--; // gap between pass attempts

            // Fastest-lap eligibility: a lap is void the moment it sees a caution
            // or a non-racing frame (in / out of the pits). Lap 1 still counts.
            if (flagState === "yellow" || flagState === "safetycar" || flagState === "red" ||
                driver.state !== "racing") {
                driver._lapDirty = true;
            }
            
            // ===== CAR PERFORMANCE =====
            driver.carPerf = computeCarPerf(driver.carState);

            // ===== FRONT DRIVER ON TRACK =====
            const { frontIndex, gapMetersTrack, sameLap } = fronts[i];

            // ===== TIRE MANAGEMENT =====
            const tireProps = TIRES[driver.tire];
            const tireManagement = driver.tireManagement || 85;

            // ===== WET-WEATHER STRATEGY (decided at weather transitions, then latched) =====
            const forecastFrame = Math.min(raceFrame, weatherForecast.length - 1);
            const forecast = weatherForecast[forecastFrame] || { max: 0, avg: 0 };
            if (weatherRegimeChangedFrame >= 0 &&
                driver.wetDecidedRegimeFrame !== weatherRegimeChangedFrame &&
                (driver.state === "racing" || driver.state === "box")) {
                decideWetStrategy(driver, pos + 1, currentTrackWater);
                driver.wetDecidedRegimeFrame = weatherRegimeChangedFrame;
            }
            const rainTargetTire = driver.wetTarget || null;
            const forecastRef = forecast.avg; // legacy arg, no longer used for decisions

            // ===== PER-LAP STRATEGY DECISIONS (engine effort + driving mode) =====
            const driverLap = Math.floor(driver.totalLength / circuitLength);
            if (driver._stratLap !== driverLap && (driver.state === "racing" || driver.state === "box")) {
                driver._stratLap = driverLap;
                let gapAheadSec = Infinity, gapBehindSec = Infinity;
                const sp = Math.max(0.01, driver.speed) * 30;
                for (let q = pos - 1; q >= 0; q--) {
                    const a = drivers[sorted_indices[q]];
                    if (a.state !== "out") { gapAheadSec = (a.totalLength - driver.totalLength) / sp; break; }
                }
                for (let q = pos + 1; q < sorted_indices.length; q++) {
                    const b = drivers[sorted_indices[q]];
                    if (b.state !== "out") { gapBehindSec = (driver.totalLength - b.totalLength) / sp; break; }
                }
                const raceCtx = { gapAheadSec, gapBehindSec };
                decideEffort(driver, raceCtx);
                driver.mode = evaluateRaceMode(driver, raceCtx);

                // Roll this lap's one-off mistake (lock-up / missed braking / spin).
                if (typeof rollLapMistake === "function") {
                    rollLapMistake(driver, { currentTrackWater, gapBehindSec, lastGreenFrame });
                }
            }

            // Tyre wear factor from the driving mode
            let modeFactor = modeWearFactor(driver);

            // Tire gross wear (bounded between 0 and 1)
            let tireManagementBonus = 1 - tireManagement / 100;
            let wearRate = tireProps.wearRate * modeFactor * tireManagementBonus;
            let waterFactor = currentTrackWater;
            driver.tireState -= (((driver.speed * 4000/180) * wearRate*(1.16 - waterFactor)) * 5.5);
            driver.tireState = Math.max(0, Math.min(1, driver.tireState));

            // Driver position on circuit as percentage (0-1)
            let driver_length_percent = (driver.totalLength % circuitLength) / circuitLength;
            driver.crossingLine = driver_length_percent <= 0.1 || driver_length_percent >= 0.9;

            // ===== ONE-OFF DRIVER MISTAKE =====
            // Rolled once per lap in the strategy block above; it plays out here
            // once the driver reaches the (random) point on the lap where it happens.
            if (driver.mistakePending > 0 && driver.state === "racing" &&
                flagState !== "yellow" && flagState !== "safetycar" && flagState !== "red" &&
                driver_length_percent >= driver.mistakePendingAt &&
                typeof applyDriverMistake === "function") {
                applyDriverMistake(driver);
                driver_length_percent = (driver.totalLength % circuitLength) / circuitLength;
            }

            // ===== TIRE PERFORMANCE =====
            // Performance based on wear state and water
            let tireWear = driver.tireState;
            let waterPerf = tireProps.speed + tireProps.drainage * currentTrackWater;
            driver.tirePerf = ((1 - 0.06 / (1 + Math.exp(10 * (tireWear - 0.5)))) * 
                               (0.98 + 0.02 / (1 + Math.exp(1000 * (tireWear - 0.99))))) * waterPerf;

            // ===== DRIVER STATE MACHINE =====
            // Handle different driver states: racing, box, in pit, out, pit stop red flag
            
            if (driver.state === "racing" && (driver.carState <= 0 || driver.tireState <= 0 || driver.fuel <= 0)) {
                // AUTO-ELIMINATION: car destroyed, tires shredded, or out of fuel
                console.log(`${driver.name} eliminated (${driver.fuel <= 0 ? 'out of fuel' : 'car state or tires at 0'})`);
                driver.state = "out";
                driver.speed = 0;
                driver.totalLength = driver.totalLength;
                
            } else if (driver.state === "out") {
                // DRIVER OUT: Frozen position, greyed out on display
                document.getElementById("pL" + (i + 1)).style.opacity = 0.6;
                document.getElementById("pX" + (i + 1)).style.opacity = 0.6;
                document.getElementById("t" + (i + 1)).style.opacity = 0.6;
                document.getElementById("ty" + (i + 1)).style.opacity = 0.6;
                document.getElementById("p" + (i + 1)).style.display = "none";
                
                driver.speed = 0;
                driver.totalLength = driver.totalLength;
                
            } else if (driver.state === "in pit") {
                // IN PIT: Reduced speed through pit lane
                driver.speed = 0.7; // Pit lane speed limit
                driver.totalLength += driver.speed * 4000/180;
                
            } else if (driver.state === "in pit red flag") {
                // RED FLAG PIT: Driver stopped in pit grid position
                driver.speed = 0;
                driver.totalLength = (Math.ceil(leader_total_length / circuitLength)) * circuitLength - 
                                    redFlagClassification.indexOf(i) * 14; 

            } else {
                // NORMAL RACING CONDITIONS
                // Check for crash
                checkForCrash(i, fronts, currentTrackWater, currentRain, extraCrashRisk, rainTargetTire);

                // Gap to front on track
                let gapSecondsTrack = driver.speed > 0 ? gapMetersTrack / driver.speed : Infinity;

                // Recalculate driver level dynamically based on current weather
                driver.level = (driver.driverLevel/100) ** (1 + Math.max(0, currentTrackWater) * 3) *
                               (driver.circuitStats / driver.totalCircuitStats);
                driver.level += modeLevelBonus(driver); // driving mode: on the edge (+) / eased off (-)

                // Expected movement at full speed
                let expected_length = (generateNormalRandom(baseSpeed * 9 + ((driver.level/100)) * 1000, 6)/30) * 
                                     gripFactor * driver.tirePerf * driver.carPerf;
                let expectedSpeed = (expected_length) * 180/4000;
                expectedSpeed *= fuelPaceFactor(driver); // engine effort + fuel weight

                // DRS BOOST application
                let drsBoost = applyDrsBoost(driver, gapSecondsTrack);
                expectedSpeed *= drsBoost;

                // Expected full speed before dirty air and overtaking logic
                let expectedTotalLength = driver.totalLength + expectedSpeed * 4000/180;

                // ===== DIRTY AIR / SLIPSTREAM / OVERTAKING =====
                // Approaching gets progressively harder (dirty air + defence); once
                // right on the gearbox the attacker commits to a move (resolveOvertakeAttempt).
                const defender = frontIndex !== null ? drivers[frontIndex] : null;
                const defenderOnTrack = defender &&
                    (defender.state === "racing" || defender.state === "box");
                // A real rival: healthy and roughly on the follower's pace. Anything
                // slower (limping, badly damaged) is an obstacle, not a rival.
                const defenderOnPace = defenderOnTrack &&
                    defender.carState >= 0.5 && defender.tireState >= 0.5 &&
                    defender.speed >= 0.80 * expectedSpeed;

                const inRange = gapMetersTrack < 300 && gapMetersTrack > 0 && pos > 0 && sameLap;

                if (flagState === "yellow" || flagState === "safetycar") {
                    // ===== UNDER CAUTION: field slowed, positions held, gaps close slowly =====
                    // Replaces the racing move entirely (no double movement). The first
                    // racing car sets the train pace; everyone behind matches it and
                    // takes back any slack gently - slower under a local yellow than
                    // behind the safety car - but can never close inside minGap or pass.
                    const sc = flagState === "safetycar";
                    if (cautionAheadLen === Infinity) {
                        // First racing car: sets the pace of the whole train.
                        driver.speed = expectedSpeed * (sc ? 0.48 : 0.80);
                        driver.totalLength = driverLengthBefore + driver.speed * 4000/180;
                        cautionTrainPace = driver.speed;
                    } else {
                        // Everyone else moves at the train pace (so gaps hold whatever the
                        // pace differences), then nibbles at its own slack - quickly behind
                        // the safety car, barely at all under a local yellow. Hard-capped a
                        // car-length behind the car ahead: no overtaking.
                        const minGap = sc ? 8 : 6;
                        const slack = Math.max(0, (cautionAheadLen - driverLengthBefore) - minGap);
                        const nibble = slack * (sc ? 0.04 : 0.003);
                        let target = driverLengthBefore + cautionTrainPace * 4000/180 + nibble;
                        target = Math.min(target, cautionAheadLen - minGap);
                        target = Math.min(target,
                            driverLengthBefore + expectedSpeed * (sc ? 0.75 : 0.95) * 4000/180);
                        driver.totalLength = Math.max(driverLengthBefore, target);
                        driver.speed = (driver.totalLength - driverLengthBefore) * 180/4000;
                    }

                } else if (inRange && defenderOnTrack && !defenderOnPace) {
                    // Slow car in the way: it costs a little time to get past but it
                    // is not defending - no dirty-air battle, no risky lunge.
                    const near = 1 - gapMetersTrack / 300;
                    const nuisance = near * near * 0.06;                 // ~6% only when right on top of it
                    driver.speed = Math.max(defender.speed, expectedSpeed * (1 - nuisance));
                    driver.totalLength = driverLengthBefore + driver.speed * 4000/180;

                } else if (inRange && defenderOnPace) {
                    const proximity = 1 - gapMetersTrack / 300;      // 0 at 300 m, 1 at the gearbox
                    const trackO = (typeof overtaking === 'number' ? overtaking : 50) / 100; // 0 easy .. 1 hard

                    // Dirty air: pace loss, worse on high-downforce tracks, less in the wet.
                    const dirtyAir = proximity * proximity * (0.06 + 0.10 * trackO) * (1 - currentTrackWater * 0.5);
                    // Slipstream: pace gain, bigger on power tracks, only when close.
                    const tow = proximity * 0.04 * (1 - 0.5 * trackO);

                    let netSpeed = expectedSpeed * (1 - dirtyAir + tow);

                    // The last bit is the hardest: closing rate is strongly damped
                    // inside ~1 s unless the driver commits to a move.
                    const defenderSpeed = Math.max(0.01, defender.speed);
                    if (gapMetersTrack < 60 && netSpeed > defenderSpeed) {
                        const overspeed = netSpeed - defenderSpeed;
                        netSpeed = defenderSpeed + overspeed * (gapMetersTrack / 60) * 0.5;
                    }
                    driver.speed = Math.max(0, netSpeed);
                    driver.totalLength = driverLengthBefore + driver.speed * 4000/180;

                    // Commit to a pass: on the gearbox, off cooldown, with a real advantage.
                    const drsAvail = isDrsEnabled() && gapSecondsTrack > 0 && gapSecondsTrack < 1;
                    const paceAdvantage = (expectedSpeed * (1 + tow) - defenderSpeed) / defenderSpeed;
                    if (gapMetersTrack < 30 && (driver.overtakeCooldown || 0) <= 0 &&
                        (paceAdvantage > 0.02 || (drsAvail && paceAdvantage > 0))) {
                        resolveOvertakeAttempt(i, frontIndex, {
                            paceAdvantage, drsActive: drsAvail,
                            currentTrackWater, attackerLengthBefore: driverLengthBefore
                        });
                        driver.speed = driver.state === "racing"
                            ? Math.max(0, (driver.totalLength - driverLengthBefore) * 180/4000)
                            : 0;
                    }
                } else {
                    // No battle: full pace.
                    driver.speed = expectedSpeed;
                    driver.totalLength = expectedTotalLength;
                }
            }
            
            // ===== FUEL BURN & ENGINE STRESS (after the frame's position is final) =====
            burnFuel(driver, driver.totalLength - driverLengthBefore);
            updateEngineStress(driver);

            // ===== LAP TIMING & FASTEST LAP =====
            // Detect a start/finish crossing now that this frame's position is final.
            if (driver.state === "racing" || driver.state === "box") {
                const lapIdxNow = Math.floor(driver.totalLength / circuitLength);
                if (lapIdxNow > driver._lapCountSeen) {
                    const moved = driver.totalLength - driverLengthBefore;
                    const overshoot = driver.totalLength - lapIdxNow * circuitLength;
                    // Fraction of a frame since the line was actually crossed.
                    const crossFrame = raceFrame - (moved > 0 ? Math.min(1, overshoot / moved) : 0);
                    const oneLap = lapIdxNow === driver._lapCountSeen + 1;
                    const lapTime = crossFrame - driver._lapAnchorFrame;
                    const pittedThisLap = driver.pitStops > driver._lapPitStops;

                    // > 10: guards against the car wobbling back and forth across the
                    // line (e.g. a mistake shove) registering as a ~1-frame "lap".
                    if (oneLap && lapTime > 10) {
                        driver.lastLap = lapTime;
                        const cleanLap = !driver._lapDirty && !pittedThisLap && !driver._outLapPending;
                        if (cleanLap && (driver.bestLap === null || lapTime < driver.bestLap)) {
                            driver.bestLap = lapTime;
                            if (lapTime < fastestLap.timeFrames) {
                                fastestLap = {
                                    driverIndex: i, code: driver.code, name: driver.name,
                                    team: driver.team, color: driver.color,
                                    timeFrames: lapTime, lap: lapIdxNow
                                };
                            }
                        }
                    }

                    driver._outLapPending = pittedThisLap;   // the lap after a stop is the out lap
                    driver._lapCountSeen = lapIdxNow;
                    driver._lapAnchorFrame = crossFrame;
                    driver._lapPitStops = driver.pitStops;
                    driver._lapDirty = false;
                } else if (lapIdxNow < driver._lapCountSeen) {
                    // A mistake shoved the car back over the line - resync, don't score.
                    driver._lapCountSeen = lapIdxNow;
                    driver._lapAnchorFrame = raceFrame;
                    driver._lapDirty = true;
                }
            }

            // This car becomes the "car ahead" for the next ones in the caution train.
            if (driver.state === "racing") {
                cautionAheadLen = driver.totalLength;
            }

            // ===== PIT STOP MANAGEMENT =====
            managePitStops(driver, i, forecastRef, rainTargetTire);

            // ===== ANIMATION UI UPDATE =====
            // Update driver positions on minimap and ranking display
            var variation_X = (diff_driver_length_previous[i] - diff_driver_length[i]) / dist_per_pixel;
            var variation_Y = driver_position_previous[i] - driver_position[i];
            var variation_map = circuit_minimap_position_previous[i] - circuit_minimap_position[i];
            
            var p = "p" + (i + 1);
            var pL = "pL" + (i + 1);
            var pX = "pX" + (i + 1);
            var t = "t" + (i + 1);
            var ty = "ty" + (i + 1);

            // Tire display
            const tireLetter = driver.tire;
            const tireColor = TIRES[tireLetter].color;
            const tyElement = document.getElementById(ty);
            if (tyElement) {
                tyElement.textContent = tireLetter;
                tyElement.style.color = tireColor;
                tyElement.style.fontWeight = "bold";
                tyElement.style.fontSize = "18px";
            }

            driver_position_X[i] -= variation_X / (fps*(duration/1000));
            driver_position_Y[i] -= variation_Y / (fps*(duration/1000));
        
            circuit_minimap_position_live[i] = Math.round(circuit_minimap_position_previous[i] - 
                                                         variation_map * (currentFrame/frames)) % circuit_map_length;
            
            document.getElementById(pL).style.top = driver_position_Y[i] + 'px';
            document.getElementById(pL).style.right = driver_position_X[i]+25 + 'px';
            document.getElementById(pX).style.top = driver_position_Y[i] + 'px';
            document.getElementById(t).style.top = driver_position_Y[i] + 'px';
            document.getElementById(ty).style.top = driver_position_Y[i] + 'px';

            // Circuit minimap positioning
            document.getElementById(p).style.left = cX[circuit_minimap_position_live[i]] / zoom - followX + 750 + 'px';
            document.getElementById(p).style.top = -cY[circuit_minimap_position_live[i]] / zoom + followY + 350 + 'px';
        }

        // ===== FASTEST-LAP MARKER (purple stopwatch) =====
        // Rides on the row of whoever currently holds the fastest lap.
        if (fastestLap.driverIndex !== null) {
            const clk = document.getElementById('clock');
            if (clk) {
                clk.style.visibility = 'visible';
                const cy = driver_position_Y[fastestLap.driverIndex];
                if (Number.isFinite(cy)) clk.style.top = cy + 'px'; // keep last good spot if the row's Y is momentarily NaN
                clk.title = `${fastestLap.code}  ${formatDriverTime(fastestLap.timeFrames)}`;
            }
        }

        // ===== CHECK CUMULATIVE DAMAGE FOR RED FLAG =====
        if (updateDamageWindow()) {
            triggerFlag('red', 0, rainTargetTire); // Trigger based on cumulative damage
        }

        // ===== RECORD POSITIONS for replay =====
        const pLxPositions = [];
        const pLyPositions = [];
        const pXxPositions = [];
        const pXyPositions = [];
        const tpxPositions = [];
        const tpyPositions = [];
        const typxPositions = [];
        const typyPositions = [];
        
        for (let i = 0; i < nb_driver; i++) {
            const pLElem = document.getElementById("pL" + (i + 1));
            const pXElem = document.getElementById("pX" + (i + 1));
            const tElem = document.getElementById("t" + (i + 1));
            const tyElem = document.getElementById("ty" + (i + 1));
            
            pLxPositions.push(pLElem ? parseFloat(pLElem.style.right) : 0);
            pLyPositions.push(pLElem ? parseFloat(pLElem.style.top) : 0);
            pXxPositions.push(pXElem ? parseFloat(pXElem.style.left) : 0);
            pXyPositions.push(pXElem ? parseFloat(pXElem.style.top) : 0);
            tpxPositions.push(tElem ? parseFloat(tElem.style.left) : 0);
            tpyPositions.push(tElem ? parseFloat(tElem.style.top) : 0);
            typxPositions.push(tyElem ? parseFloat(tyElem.style.left) : 0);
            typyPositions.push(tyElem ? parseFloat(tyElem.style.top) : 0);
        }
        
        recordCurrentPositions({
            pLxPositions, pLyPositions, pXxPositions, pXyPositions,
            tpxPositions, tpyPositions, typxPositions, typyPositions
        });
    }

    // ===== ANIMATION FRAME UPDATE =====
    // Update animation every N frames (30 frame cycle)
    if (currentFrame >= frames) {
        clearInterval(interval);
        
        if (leader_total_length <= raceLength && raceTimeLeft > 0 && eventTimeLeft > 0) {
            // Race still running: update positions for next animation cycle
            circuit_minimap_position_previous = circuit_minimap_position;
            circuit_minimap_position = drivers.map(driver => (driver.totalLength / circuitLength) * circuit_map_length);

            leader_total_length = Math.max(...drivers.map(driver => driver.totalLength));
            diff_driver_length_previous = [...diff_driver_length];
            diff_driver_length = drivers.map(driver => leader_total_length - driver.totalLength);
            
            let sorted_lengths = [...diff_driver_length].sort((a, b) => a - b);
            const val_to_rank = new Map();
            sorted_lengths.forEach((val, idx) => val_to_rank.set(val, idx + 1));
            const driver_ranking = diff_driver_length.map(value => val_to_rank.get(value));

            for (let i = 0; i < nb_driver; i++) {
                driver_position_previous[i] = driver_position_Y[i];
                driver_position[i] = (driver_ranking[i] - 1) * 35 + 75;
                diff_driver_time[i] = drivers[i].speed > 0
                    ? diff_driver_length[i] / (drivers[i].speed * 30)
                    : 0;

                var pL = "pL" + (i + 1);
                var pX = "pX" + (i + 1);
                var t = "t" + (i + 1);

                document.getElementById(pL).style.top = driver_position_Y[i] + 'px';
                document.getElementById(pX).style.top = driver_position_Y[i] + 'px';

                // Update driver gap display
                if (drivers[i].state === "out") {
                    document.getElementById(t).style.color = "gray";
                    document.getElementById(t).innerHTML = "<strong>OUT</strong>";
                } else if (drivers[i].state === "in pit" || drivers[i].state === "in pit red flag") {
                    document.getElementById(t).style.color = drivers[i].color;
                    document.getElementById(t).innerHTML = "<strong>IN PIT</strong>";
                } else {
                    document.getElementById(t).style.color = "white";
                    document.getElementById(t).textContent = formatInterval(diff_driver_time[i], diff_driver_length[i] / circuitLength);
                }
            }

            move(); // Restart animation cycle
        } else {
            // RACE ENDED
            document.getElementById('ind').innerHTML = "<strong> END OF </br> THE RACE </strong>";
            document.getElementById('ind').style.color = "white";
            clearInterval(interval);
            // Save first (getFinalClassification re-sorts drivers, no render needed).
            handleRaceEnd();
            // Then settle the board: a short glide to the final order + podium,
            // or an instant snap if the outro module isn't loaded.
            if (typeof showRaceOutro === 'function') {
                showRaceOutro();
            } else {
                renderFinalStandings();
            }

            // Add download button for race recording
            const recording = stopRecording();
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download Race Record';
            downloadBtn.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 20px;font-size:1.1em;cursor:pointer;background:#4CAF50;color:white;border:none;border-radius:5px;';
            downloadBtn.onclick = () => downloadRaceRecording(recording);
            document.body.appendChild(downloadBtn);
        }
    }

    currentFrame++;
}

// Final classification, best first: classified cars by distance, then retired
// cars (shown at the back). Same ordering the championship standings derive
// from `championshipResults` (which filter out `state === "out"` and re-sort
// the rest by totalLength).
function getFinalClassification() {
    const inRace = [], out = [];
    drivers.forEach((d, i) => (d.state === "out" ? out : inRace).push(i));
    inRace.sort((a, b) => drivers[b].totalLength - drivers[a].totalLength);
    out.sort((a, b) => drivers[b].totalLength - drivers[a].totalLength);
    return inRace.concat(out);
}

// Re-render the ranking board synchronously from the final positions so the
// frozen last frame is consistent with the recorded result (the frame-by-frame
// animation otherwise trails the simulation by ~one animation cycle).
function renderFinalStandings() {
    const order = getFinalClassification();
    const leaderIdx = order.find(i => drivers[i].state !== "out");
    const leaderLength = leaderIdx != null ? drivers[leaderIdx].totalLength : 0;

    order.forEach((i, rank) => {
        const y = rank * 35 + 75;
        driver_position[i] = y;
        driver_position_previous[i] = y;
        driver_position_Y[i] = y;

        const pL = document.getElementById("pL" + (i + 1));
        const pX = document.getElementById("pX" + (i + 1));
        const t  = document.getElementById("t" + (i + 1));
        const ty = document.getElementById("ty" + (i + 1));
        [pL, pX, t, ty].forEach(el => { if (el) el.style.top = y + "px"; });

        if (!t) return;
        const d = drivers[i];
        if (d.state === "out") {
            t.style.color = "gray";
            t.innerHTML = "<strong>OUT</strong>";
        } else if (d.state === "in pit" || d.state === "in pit red flag") {
            t.style.color = d.color;
            t.innerHTML = "<strong>IN PIT</strong>";
        } else {
            const gapLen = leaderLength - d.totalLength;
            const gapTime = d.speed > 0 ? gapLen / (d.speed * 30) : 0;
            t.style.color = "white";
            t.textContent = formatInterval(gapTime, gapLen / circuitLength);
        }

        // Fastest-lap holder: purple driver code + the stopwatch parked on the row.
        if (pX && fastestLap.driverIndex === i) {
            pX.style.color = "#a72bc5";
            const clk = document.getElementById("clock");
            if (clk) { clk.style.visibility = "visible"; clk.style.top = y + "px"; }
        }
    });
}

// Handle race end: save results and manage grids for championship races
function handleRaceEnd() {
    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
    const isSprint = localStorage.getItem('isSprint') === 'true';
    
    // Final classification (classified cars by distance, retired cars at the back) —
    // same order shown by renderFinalStandings() on the frozen frame.
    const sortedDrivers = getFinalClassification().map(i => drivers[i]);

    // Fastest lap: stamp the holder and tidy the internal timing scratch fields
    // before the driver objects get serialised into championshipResults.
    if (fastestLap.driverIndex !== null && drivers[fastestLap.driverIndex]) {
        drivers[fastestLap.driverIndex].fastestLapOfRace = true;
    }
    drivers.forEach(d => {
        delete d._lapCountSeen; delete d._lapAnchorFrame; delete d._lapDirty;
        delete d._lapPitStops; delete d._outLapPending;
    });

    if (isChampionship) {
        // Save race results
        let championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        championshipResults[currentRaceIndex] = sortedDrivers;
        localStorage.setItem('championshipResults', JSON.stringify(championshipResults));
        
        // Auto-save championship if active
        if (window.autoSaveChampionship) {
            window.autoSaveChampionship();
        }
        
        // In Special Championship Mode: after sprint race, only save results for next GP
        if (specialMode && isSprint) {
            // DON'T modify featureGrid - it must stay based on qualification
            // Just save current sprint results for NEXT GP's sprint grid
            localStorage.setItem('lastSprintResults', JSON.stringify(sortedDrivers));
            console.log('Sprint results saved for next GP sprint grid');
        }
    }
    
    // Show race end button
    showRaceEndButton();
}

// Show button at race end with appropriate text and behavior
function showRaceEndButton() {
    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
    const isSprint = localStorage.getItem('isSprint') === 'true';
    
    const btn = document.createElement('button');
    btn.id = 'raceEndBtn';
    btn.className = 'raceEndBtn';
    
    if (isChampionship) {
        if (specialMode && isSprint) {
            // After sprint in special mode: go to feature race
            btn.textContent = 'Go to Feature Race';
            btn.onclick = () => {
                const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
                const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
                const nextRaceIndex = currentRaceIndex + 1;
                
                if (nextRaceIndex < races.length && races[nextRaceIndex].circuit === races[currentRaceIndex].circuit) {
                    localStorage.setItem('championshipCurrentRace', nextRaceIndex.toString());
                    localStorage.setItem('selectedCircuit', JSON.stringify(races[nextRaceIndex]));
                    localStorage.setItem('isSprint', 'false');
                    window.location.href = 'race.html';
                }
            };
        } else {
            // After feature race: show championship standings
            btn.textContent = 'Show Championship';
            btn.onclick = () => {
                window.location.href = 'gp_select.html';
            };
        }
    } else {
        // Simple GP mode: return to gp_select
        btn.textContent = 'Back to GP Select';
        btn.onclick = () => {
            // Clean up temporary race data
            localStorage.removeItem('drivers');
            localStorage.removeItem('startingGrid');
            localStorage.removeItem('weatherQuali');
            localStorage.removeItem('weatherRace');
            window.location.href = 'gp_select.html';
        };
    }
    
    document.body.appendChild(btn);
}
