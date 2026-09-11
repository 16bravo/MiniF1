// SESSION.JS
// Qualification session management and progression

// Helper function to generate sprint race grid by inverting top 10
function generateSprintGridHelper(currentRanking) {
    if (!Array.isArray(currentRanking) || currentRanking.length === 0) {
        return currentRanking;
    }
    
    // Extract top 10 and rest (P11+)
    const top10 = currentRanking.slice(0, 10);
    const rest = currentRanking.slice(10);
    
    // Invert top 10: P1→P10, P2→P9, etc.
    const invertedTop10 = top10.reverse();
    
    // Combine inverted top 10 + rest
    return [...invertedTop10, ...rest];
}

// Function to reset qualifier times at the start of a new session
function resetQualifiers() {
    ranking.forEach(driver => {
        if (!driver.eliminated) {
            driver.lastTime = null;
            driver.bestTime = 1000;
            driver.displayBestTime = null;
            driver.sessionLaps = 0;
        }
    });
}

// Function to advance to the next qualifying session and eliminate drivers
function advanceSession() {
    if (currentSession === 0) {
        // Q1 to Q2: eliminate drivers below Q2 threshold
        ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
        for (let i = qualiConfig.q2Threshold; i < ranking.length; i++) {
            ranking[i].eliminated = true;
            ranking[i].bestTime += 2000;
        }
        console.log(`Q1→Q2: Eliminated ${ranking.length - qualiConfig.q2Threshold} drivers (threshold: ${qualiConfig.q2Threshold})`);
    } else if (currentSession === 1) {
        // Q2 to Q3: eliminate drivers below Q3 threshold
        ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
        for (let i = qualiConfig.q3Threshold; i < qualiConfig.q2Threshold; i++) {
            ranking[i].eliminated = true;
            ranking[i].bestTime += 1000;
        }
        console.log(`Q2→Q3: Eliminated ${qualiConfig.q2Threshold - qualiConfig.q3Threshold} drivers (threshold: ${qualiConfig.q3Threshold})`);
    }
    
    if (currentSession < 2) {
        // Move to next session
        currentSession++;
        resetQualifiers();
        timer = sessionDurations[currentSession] * 60;
        const prefix = (localStorage.getItem('isSprint') === 'true') ? 'SQ' : 'Q';
        document.getElementById('session-info').innerText = `${prefix}${currentSession + 1}`;
    } else {
        // Qualification completed
        clearInterval(intervalId);
        intervalId = null;
        document.getElementById('session-info').innerText =
            (localStorage.getItem('isSprint') === 'true') ? "End of Sprint Qualifying" : "End of Qualification";
        setTimeout(showRaceButton, 500);
    }
}

// ===== TURBO (fast-forward) =====
// Toggled by the "Skip" button (js/turbo_toggle.js). Doesn't jump to the
// result: it drives several ticks per real-world timer callback instead of
// one, so the session keeps animating, only much faster. Unlike the race
// page, quali's timer loop is one long-lived interval (not re-created
// between sessions), so the toggle has to explicitly restart it to switch
// between the two callbacks below.
let turboMode = false;
const TURBO_TICK_MS = 0;  // browsers clamp this to a few ms once nested anyway
const TURBO_BATCH = 3;    // ticks driven per callback in turbo mode - the extra multiplier on top of TURBO_TICK_MS

function turboTick() {
    // Stop early if qualifying just wrapped up mid-batch: advanceSession()
    // clears intervalId once every session is done, and calling updateTimer()
    // again after that would re-run its "qualification completed" branch
    // (which would schedule a second "Go to Race" button, etc).
    for (let k = 0; k < TURBO_BATCH && intervalId !== null; k++) {
        updateTimer();
    }
}

function toggleTurboMode() {
    turboMode = !turboMode;
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = setInterval(turboMode ? turboTick : updateTimer, turboMode ? TURBO_TICK_MS : (1000 / 60));
    }
    return turboMode;
}

// Function to create and display the "Go to Race" button after qualification
function showRaceButton() {
    // Final sort of all 20 drivers based on their best time
    ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
    
    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
    
    // Determine if the race we're about to run is a sprint.
    // Default: keep whatever was already set (GP-select toggle / championship overview).
    let isNextRaceSprint = localStorage.getItem('isSprint') === 'true';
    if (isChampionship) {
        const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        isNextRaceSprint = specialMode
            ? (currentRaceIndex % 2 === 0)                // special mode: races alternate sprint/feature
            : !!(races[currentRaceIndex] && races[currentRaceIndex].isSprintRace); // classic: read the flag
    }
    
    // Store feature race grid (original qualification order)
    localStorage.setItem('featureGrid', JSON.stringify(ranking));
    
    // In Special Championship Mode, generate sprint grid
    let gridToUse = ranking;
    if (isChampionship && specialMode) {
        const lastSprintResults = JSON.parse(localStorage.getItem('lastSprintResults') || '[]');
        
        if (lastSprintResults.length > 0) {
            // Use previous sprint results (inverted) for this GP's sprint
            gridToUse = generateSprintGridHelper(lastSprintResults);
            console.log('Sprint grid generated from LAST GP sprint results - top 10 inverted');
            // Clear lastSprintResults after using it
            localStorage.removeItem('lastSprintResults');
        } else {
            // First GP: use current qualification results (inverted)
            gridToUse = generateSprintGridHelper(ranking);
            console.log('Sprint grid generated from qualification - top 10 inverted (first GP)');
        }
        
        localStorage.setItem('sprintGrid', JSON.stringify(gridToUse));
    }
    
    localStorage.setItem('drivers', JSON.stringify(gridToUse));
    localStorage.setItem('isSprint', isNextRaceSprint.toString());

    // Auto-save championship if active
    if (window.autoSaveChampionship) {
        window.autoSaveChampionship();
    }

    // Create button
    const button = document.createElement('button');
    button.id = 'raceButton';
    // In Special Mode, go to sprint; otherwise go to race
    button.innerText = (isChampionship && specialMode) ? 'Go to Sprint' : 'Go to Race';

    // Add click event to redirect to race.html
    button.addEventListener('click', () => {
        window.location.href = 'race.html';
    });

    // Add button to page
    document.body.appendChild(button);

    // Display button
    button.style.display = 'block';
}

// Function to update the main session timer and manage session progression
function updateTimer() {
    if (timer > -300) { // Timer continues to run even after session ends
        if (trackState === 'red') {
            // Handle red flag: stop main timer
            if (flagTimer > 0) {
                flagTimer--;
            } else if (currentRain > 0.5) {
                // If heavy rain, red flag persists
            } else {
                updateTrackState('green'); // Return to green flag
            }
        } else if (trackState === 'yellow') {
            // Handle yellow flag: slow down drivers
            if (flagTimer > 0) {
                flagTimer--;
                timer--;
            } else {
                updateTrackState('green'); // Return to green flag
            }
        } else {
            timer--;
        }
        
        // Update timer display
        document.getElementById('timer').innerText = formatSessionTime(Math.max(0, timer));
        
        // Update track grip based on rain
        const rainEffect = Math.max(0, rainCurve[currentFrame]);
        grip = Math.max(0, Math.min(1, grip - ((rainEffect ** 3) * 0.02)));

        // Update weather
        updateWeather();
        updateWeatherDisplay();

        // Update driver states
        updateDriverStates();

        // Update ranking table
        updateTable();
    } else {
        // Session ended: advance to next session
        ranking.forEach(driver => {
            if (driver.inLap) {
                driver.inLap = false;
            }
        });
        advanceSession();
    }
}
