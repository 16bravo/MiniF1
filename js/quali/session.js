// SESSION.JS
// Qualification session management and progression

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
        // Q1 to Q2: eliminate bottom 5 drivers
        ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
        for (let i = 15; i < 20; i++) {
            ranking[i].eliminated = true;
            ranking[i].bestTime += 2000;
        }
    } else if (currentSession === 1) {
        // Q2 to Q3: eliminate next 5 drivers
        ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
        for (let i = 10; i < 15; i++) {
            ranking[i].eliminated = true;
            ranking[i].bestTime += 1000;
        }
    }
    
    if (currentSession < 2) {
        // Move to next session
        currentSession++;
        resetQualifiers();
        timer = sessionDurations[currentSession] * 60;
        document.getElementById('session-info').innerText = `Q${currentSession + 1}`;
    } else {
        // Qualification completed
        clearInterval(intervalId);
        document.getElementById('session-info').innerText = "End of Qualification";
        setTimeout(showRaceButton, 500);
    }
}

// Function to create and display the "Go to Race" button after qualification
function showRaceButton() {
    // Final sort of all 20 drivers based on their best time
    ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
    localStorage.setItem('drivers', JSON.stringify(ranking));

    // Create button
    const button = document.createElement('button');
    button.id = 'raceButton';
    button.innerText = 'Go to Race';

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
