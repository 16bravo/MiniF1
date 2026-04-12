// PHYSICS.JS
// Driver physics, pit exit logic, crashes, and lap time calculations

// Function to obtain driver ranking position
function getDriverRank(targetDriver) {
    const sortedRanking = [...ranking].sort((a, b) => {
        if (a.bestTime != null && b.bestTime != null) {
            if (a.bestTime !== b.bestTime) {
                return a.bestTime - b.bestTime;
            }
        } else if (a.bestTime != null) {
            return -1;
        } else if (b.bestTime != null) {
            return 1;
        }
        return a.defaultOrder - b.defaultOrder;
    });

    const index = sortedRanking.findIndex(d => d === targetDriver);
    return index >= 0 ? index + 1 : null;
}

// Function to determine whether the driver should exit the pit
function shouldExitPit(driver) {
    const timeRemaining = timer; // Time remaining in session
    const criticalTime = baseLapTime * 1.75; // Critical time to exit

    if (trackState === 'red') {
        return false; // Don't exit if red flag is displayed
    } else if (driver.sessionLaps === 0) {
        // First lap: wait for free track window
        const isWindowFree = ranking.every(otherDriver => 
            (otherDriver.distance > 0.05 && otherDriver.distance < 0.95) || 
            otherDriver.currentState === "PIT" || 
            otherDriver.currentState === "OUT"
        );
        return isWindowFree;
    } else if (driver.sessionLaps < (maxLapsPerSession - 1) && getDriverRank(driver) > 10 - currentSession * 5) {
        // Mid-session laps: wait for a free window
        const isWindowFree = ranking.every(otherDriver => 
            (otherDriver.distance > 0.05 && otherDriver.distance < 0.95) || 
            otherDriver.currentState === "PIT" || 
            otherDriver.currentState === "OUT"
        );
        return isWindowFree;
    } else if (driver.sessionLaps < maxLapsPerSession) {
        // Last lap: wait for tight window or exit if running out of time
        const isWindowFree = ranking.every(otherDriver => 
            (otherDriver.distance > 0.02 && otherDriver.distance < 0.98) || 
            otherDriver.currentState === "PIT" || 
            otherDriver.currentState === "OUT"
        );
        return isWindowFree && (currentRain > 0.2 || timeRemaining < criticalTime - Math.floor(Math.random() * 10));
    } else {
        // No more laps available
        return false;
    }
}

// Function to determine crash probability and apply consequences
function checkForCrash(driver) {
    const crashProbability = (
        (1 - driver.driverLevel/100) * 0.02 + 
        ((1 - grip) * 0.02 + Math.max(0, currentRain) * 0.02 + (difficulty/100) * 0.01)
    ) / 80;
    
    const crashGravity = Math.abs(generateNormalRandom(0, 0.5)); // Crash severity (0 to 1)
    
    if (Math.random() < crashProbability) {
        if (crashGravity > 0.5) {
            // Major crash: driver out
            driver.currentState = "OUT";
            updateTrackState('red'); // Trigger red flag
        } else {
            // Minor crash: back to pit
            driver.currentState = "<<<";
            updateTrackState('yellow'); // Trigger yellow flag
        }
    }
}

// Function to update driver states based on race phases (pit, out-lap, fast lap, in-lap)
function updateDriverStates() {
    ranking.forEach(driver => {
        if (driver.eliminated) return;
        
        switch (driver.currentState) {
            case "PIT":
                // Driver in pit waiting to exit
                if (shouldExitPit(driver) && timer < Math.floor(Math.random() * 1000) && timer >= 0) {
                    driver.currentTire = determineTireType(currentTrackWater, forecastTrackWater, driver);
                    driver.currentState = ">>>";
                    driver.distance = 0;
                    const outLapTime = calculateLapTime(driver, 0.9); // Slow lap (out-lap)
                    driver.targetLapTime = outLapTime;
                    driver.currentSpeed = 1 / outLapTime; // Speed in % circuit
                    driver.lapTimer = 0;

                    // Record grip analysis for debugging
                    if (!window.gripAnalysis) window.gripAnalysis = [];
                    window.gripAnalysis.push({
                        frame: currentFrame,
                        trackWater: currentTrackWater,
                        grip_S: getGripFactor("S"),
                        grip_I: getGripFactor("I"),
                        grip_W: getGripFactor("W")
                    });
                }
                break;

            case ">>>":
                // Out-lap: driver exiting pit towards track
                driver.distance += driver.currentSpeed * getGripFactor(driver.currentTire);
                if (timer <= 0 || trackState === 'red') {
                    driver.currentState = "<<<";
                } else if (driver.distance >= 1) {
                    // Reached track, switch to fast lap
                    driver.currentState = "LAP";
                    driver.distance = 0;
                    const fastLapTime = calculateLapTime(driver, 1.0); // Fast lap
                    driver.targetLapTime = fastLapTime;
                    driver.currentSpeed = 1 / fastLapTime;
                    driver.lapTimer = 0;
                }
                break;

            case "LAP":
                // On track lap (fast lap attempt)
                const distanceBefore = driver.distance;
                driver.distance += (driver.currentSpeed * getGripFactor(driver.currentTire));
                driver.lapTimer += 1;

                if (trackState === 'red') {
                    // Red flag: driver returns to pit
                    driver.currentState = "<<<";
                    const inLapTime = calculateLapTime(driver, 0.8); // Very slow lap (in-lap)
                    driver.targetLapTime = inLapTime;
                    driver.currentSpeed = 1 / inLapTime;
                    driver.lapTimer = 0;
                } else if (driver.distance >= 1) {
                    // Lap completed: record time
                    const remainingDistance = 1 - distanceBefore;
                    const extraTime = remainingDistance / driver.currentSpeed;
                    const lapTime = driver.lapTimer - 1 + extraTime;

                    driver.lastTime = lapTime;

                    if (!driver.bestTime || lapTime < driver.bestTime) {
                        driver.bestTime = lapTime;
                        driver.displayBestTime = lapTime;
                    }

                    driver.sessionLaps++;
                    driver.runLaps++;
                    grip += 0.003; // Increase grip after each lap (track cleanup)
                    console.log(grip);
                    updateTable();

                    // Switch to in-lap
                    driver.currentState = "<<<";
                    driver.distance = 0;
                    const inLapTime = calculateLapTime(driver, 0.9); // Slow lap (in-lap)
                    driver.targetLapTime = inLapTime;
                    driver.currentSpeed = 1 / inLapTime;
                    driver.lapTimer = 0;
                } else {
                    // During lap: check for crashes
                    checkForCrash(driver);
                }
                break;

            case "<<<":
                // In-lap: driver returning to pit
                driver.distance += driver.currentSpeed * getGripFactor(driver.currentTire);
                if (driver.distance >= 1) {
                    driver.currentState = "PIT";
                    driver.distance = 0;
                }
                break;
        }
    });
}

// Function to calculate lap time based on driver level, tire grip, and weather conditions
function calculateLapTime(driver, speedFactor) {
    // Recalculate driver level based on current weather
    driver.level = (driver.driverLevel/100) * (
        (fastSpeed * driver.teamSPD * ((1 - currentTrackWater) * 0.1 + 0.9) + 
         fastCorners * driver.teamFS + 
         slowCorners * driver.teamSS) / totalCircuit
    );
    
    // Base lap time adjusted for driver level
    const baseTime = baseLapTime - driver.level / 10 + 9;
    
    // Return randomized lap time based on speed factor
    return generateNormalRandom(baseTime / speedFactor, baseLapTime / 400);
}
