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
                showFlagBanner("green");
            }
        }
    }

    // RED FLAG RESTART CHECK: After 300 frames minimum, restart when rain clears
    if (flagState === "red" && flagTimer < 0 && currentRain < 0.2) {
        console.log("End of red flag - conditions met for restart");
        flagState = "green";
        showFlagBanner("green");
        // Resume all drivers from red flag classification
        for (let pos = 0; pos < redFlagClassification.length; pos++) {
            let idx = redFlagClassification[pos];
            drivers[idx].state = "racing";
        }
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
        let leaderIndex = racing_indices[0];
        
        // Build driver ranking array
        let driver_ranking = new Array(nb_driver);
        for (let r = 0; r < racing_indices.length; r++) {
            driver_ranking[racing_indices[r]] = r + 1;
        }

        // Get driver in front of each driver on track
        const fronts = computeFrontsForAll();

        // Get gaps to front in rankings
        const frontIndicesRanking = computeGapsFrontInRanking(drivers, driver_ranking);

        let frontDriverLength = 0; // To track the length of the driver in front for gap calculations

        // ===== UPDATE EACH DRIVER =====
        // Process drivers in race order (fastest first)
        for (let pos = 0; pos < sorted_indices.length; pos++) {
            let i = sorted_indices[pos]; // Driver index in original array
            let isLeader = (i === leaderIndex); // Check if this driver is the current leader on track
            let driverLengthBefore = drivers[i].totalLength; // Store length before update for gap calculations
            const driver = drivers[i];
            
            // ===== CAR PERFORMANCE =====
            driver.carPerf = computeCarPerf(driver.carState);

            // ===== FRONT DRIVER ON TRACK =====
            const { frontIndex, gapMetersTrack, sameLap } = fronts[i];

            // ===== TIRE MANAGEMENT =====
            const tireProps = TIRES[driver.tire];
            const tireManagement = driver.tireManagement || 85;

            // ===== WEATHER FORECAST FOR STRATEGY =====
            const forecastFrame = Math.min(raceFrame, weatherForecast.length - 1);
            const forecast = weatherForecast[forecastFrame] || { max: 0, avg: 0 };
            // For Rain Strategy : Rank: rank ≤ 10 → conservative (avg), rank > 10 → aggressive (max)
            const forecastRef = pos <= 10 ? forecast.avg : forecast.max;
            // Determine target rain tire from forecast (centralized logic)
            const rainTargetTire = getRainTargetTire(forecastRef);

            // Wear factor according to control mode
            let modeFactor = 1;
            if (driver.mode === "agressive") modeFactor = 1.02;
            else if (driver.mode === "gestion") modeFactor = 0.98;

            // Tire gross wear (bounded between 0 and 1)
            let tireManagementBonus = 1 - tireManagement / 100;
            let wearRate = tireProps.wearRate * modeFactor * tireManagementBonus;
            let waterFactor = currentTrackWater;
            driver.tireState -= (((driver.speed * 4000/180) * wearRate*(1.16 - waterFactor)) * 5.5);
            driver.tireState = Math.max(0, Math.min(1, driver.tireState));

            // Driver position on circuit as percentage (0-1)
            let driver_length_percent = (driver.totalLength % circuitLength) / circuitLength;
            driver.crossingLine = driver_length_percent <= 0.1 || driver_length_percent >= 0.9;

            // ===== TIRE PERFORMANCE =====
            // Performance based on wear state and water
            let tireWear = driver.tireState;
            let waterPerf = tireProps.speed + tireProps.drainage * currentTrackWater;
            driver.tirePerf = ((1 - 0.06 / (1 + Math.exp(10 * (tireWear - 0.5)))) * 
                               (0.98 + 0.02 / (1 + Math.exp(1000 * (tireWear - 0.99))))) * waterPerf;

            // ===== DRIVER STATE MACHINE =====
            // Handle different driver states: racing, box, in pit, out, pit stop red flag
            
            if (driver.state === "racing" && (driver.carState <= 0 || driver.tireState <= 0)) {
                // AUTO-ELIMINATION: Car completely damaged or tires shredded
                console.log(`${driver.name} automatically eliminated (car state or tires at 0)`);
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
                let gapSecondsTrack = gapMetersTrack / driver.speed;

                // Expected movement at full speed
                let expected_length = (generateNormalRandom(baseSpeed*9 + driver.level*10, 6)/30) * 
                                     gripFactor * driver.tirePerf * driver.carPerf;
                let expected_speed = (expected_length) * 180/4000;
                
                let proximityFactor = 1;

                // DRS BOOST application
                let drsBoost = applyDrsBoost(driver, gapSecondsTrack);
                expected_speed *= drsBoost;

                // DIRTY AIR: Aerodynamic loss when following closely
                if (gapSecondsTrack < 4 && gapSecondsTrack > 0) {
                    proximityFactor = proximityFactor - 0.00125/(1+Math.exp(4*(gapSecondsTrack-2.75)));
                    expected_speed *= proximityFactor;
                    
                    // Aggressive defending/attacking behavior
                    let frontAggression = (drivers[frontIndex].aggression * 
                                         ((drivers[frontIndex].mode == "agressive") ? 1 : 0.5) * 
                                         (sameLap ? 1 : 0.1)) * 0.005 + 0.5;
                    
                    // OVERTAKING PROBABILITY SYSTEM
                    // Base probability: 90% on easy circuits (overtaking=0), 10% on hard circuits (overtaking=100)
                    let passProbability = 0.9 - (overtaking / 100) * 0.8; // 0.9 to 0.1
                    
                    // Adjust by driver level advantage (high level driver passes more often)
                    let levelAdvantage = (driver.level - drivers[frontIndex].level) / 10;
                    passProbability += levelAdvantage * 0.15; // ±0.15 based on level difference
                    passProbability = Math.max(0.05, Math.min(0.95, passProbability)); // Clamp to 5%-95%
                    
                    // Reduce probability by leader's defensive aggression (max 40% reduction)
                    passProbability *= (1 - frontAggression * 0.4);
                    
                    // Speed difference factor: need at least 0.5% speed advantage for meaningful pass attempt
                    let speedDifference = (expected_speed - drivers[frontIndex].speed) / drivers[frontIndex].speed;
                    if (speedDifference < 0.005) {
                        passProbability *= 0.1; // Very low chance if not faster
                    }
                    
                    // Check if this frame is a passing opportunity
                    let isPassingFrame = Math.random() < passProbability;
                    
                    if (isPassingFrame && speedDifference > 0.005) {
                        // Allow the driver to go at expected speed to overtake
                        driver.speed = expected_speed;
                    } else {
                        // Otherwise, stay near the leader with reduced speed
                        let defenseFactor = ((gapSecondsTrack < 5) ? 
                                            ((5 - gapSecondsTrack) / 5) * frontAggression : 0) * 0.3;
                        driver.speed = defenseFactor * (drivers[frontIndex].speed * 0.98) + 
                                      (1 - defenseFactor) * driver.speed;
                    }
                    
                    driver.totalLength += driver.speed * 4000/180;

                } else {
                    // No dirty air: full speed
                    driver.speed = expected_speed;
                    driver.totalLength += driver.speed * 4000/180;
                    
                }
            }
            
            // ===== YELLOW FLAG OR SAFETY CAR: Enforce no overtaking and speed limits =====
            if ((flagState === "yellow" || flagState === "safetycar") && driver.state === "racing") {
                // Maximum speed allowed : 80% of normal speed under yellow, 70% under safety car, 50% if the driver is the leader under safety car
                const maxAllowedSpeed = (flagState === "yellow") ? 0.8 : 0.7 * driver.speed * (isLeader ? 0.7 : 1);
                driver.speed = Math.min(driver.speed, maxAllowedSpeed);
                driver.totalLength += driver.speed * 4000/180;
                // The driver must not overtake the front driver
                if (!isLeader) {
                    driver.totalLength = Math.min(driver.totalLength, Math.max(driverLengthBefore, frontDriverLength - 5));
                }
            }

            // Record driver total length
            frontDriverLength = (driver.state === "racing" || driver.state === "box") && driver.carState > 0.7 && driver.tireState > 0.5 ? driver.totalLength : frontDriverLength;

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
                diff_driver_time[i] = diff_driver_length[i] / (drivers[i].speed*30);

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
            showChampionshipResultsButton();

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
