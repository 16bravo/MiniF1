// UI.JS
// User interface: ranking table, flag messages, and track state updates

// Function to update the ranking table display
function updateTable() {
    const tableBody = document.getElementById('ranking-table');
    tableBody.innerHTML = "";

    // Sort drivers by best time, then by default order
    const sortedRanking = [...ranking].sort((a, b) => {
        const aTime = a.bestTime != null ? a.bestTime : Infinity;
        const bTime = b.bestTime != null ? b.bestTime : Infinity;
        if (aTime !== bTime) {
            return aTime - bTime;
        }
        return a.defaultOrder - b.defaultOrder;
    });

    sortedRanking.forEach((driver, index) => {
        // Determine tire color
        const tireColor = driver.currentTire === "S" ? "red" :
                          driver.currentTire === "I" ? "#21b946" :
                          driver.currentTire === "W" ? "#3b9add" : "black";

        const row = document.createElement('tr');
        if (driver.eliminated) {
            row.classList.add('eliminated');
        }

        row.innerHTML = `
            <td><b>${index + 1}</b></td>
            <td style="border-left: 3px solid ${driver.color}; width: 10px;"><b>${driver.name}</b></td>
            <td>${driver.team}</td>
            <td style="color: ${tireColor}; font-weight: bold;">${driver.currentTire}</td>
            <td>${driver.currentState}</td>
            <td>${driver.lastTime ? formatDriverTime(driver.lastTime) : ''}</td>
            <td>${driver.displayBestTime ? formatDriverTime(driver.displayBestTime) : ''}</td>
            <td>${driver.runLaps}</td>
        `;

        tableBody.appendChild(row);
    });
}

// Function to update track state and trigger appropriate flag
function updateTrackState(state) {
    trackState = state;
    updateFlagMessage(state);
    
    if (state === 'yellow') {
        flagTimer = 60; // 60 frames for yellow flag
    } else if (state === 'red') {
        flagTimer = 300; // 300 frames for red flag
    } else if (state === 'green') {
        flagTimer = 0; // No timer for green flag
    }
}

// Function to update and display flag message
function updateFlagMessage(type) {
    const flagMessage = document.getElementById('flag-message');
    const flagColor = document.getElementById('flag-color');
    const flagText = document.getElementById('flag-text');

    if (type === 'red') {
        flagColor.style.backgroundColor = 'red';
        flagText.style.color = 'red';
        flagText.textContent = 'RED FLAG';
        flagMessage.style.display = 'block';
        flagMessage.style.visibility = 'visible';
    } else if (type === 'yellow') {
        flagColor.style.backgroundColor = 'yellow';
        flagText.style.color = 'yellow';
        flagText.textContent = 'YELLOW FLAG';
        flagMessage.style.display = 'block';
        flagMessage.style.visibility = 'visible';
    } else if (type === 'green') {
        flagColor.style.backgroundColor = 'green';
        flagText.style.color = 'green';
        flagText.textContent = 'GREEN FLAG';
        flagMessage.style.display = 'block';
        flagMessage.style.visibility = 'visible';

        // Hide the green flag after 1 second (60 frames at 60 FPS)
        setTimeout(() => {
            flagMessage.style.visibility = 'hidden';
        }, 1000);
    } else {
        // Hide the message for any other type
        flagMessage.style.visibility = 'hidden';
    }
}
