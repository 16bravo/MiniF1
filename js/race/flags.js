// FLAGS.JS
// Flag management and race control

// Function to display the flag banner on the UI
function showFlagBanner(flag) {
    const banner = document.getElementById('flagBanner');
    let color = "white";
    let text = "";

    switch(flag) {
        case "red":
            color = "#c00";
            text = "RED FLAG";
            break;
        case "safetycar":
            color = "#ff0";
            text = "SAFETY CAR";
            break;
        case "yellow":
            color = "#ff0";
            text = "YELLOW FLAG";
            break;
        case "green":
            color = "#0f0";
            text = "GREEN FLAG";
            break;
        case "ending":
            color = "white";
            text = "";
        default:
            color = "white";
            text = "";
    }

    banner.style.opacity = flag === "green" ? "0.7" : "1";
    banner.style.color = color;
    banner.textContent = text;
    banner.style.display = text ? "block" : "none";
    if (text) {
        banner.style.opacity = "1";
    } else {
        banner.style.opacity = "0";
    }
}

// Function to trigger race flags and manage all state transitions
// Handles flag effects (DRS disabled, driver pit stops, etc.)
function triggerFlag(type, driverIndex) {
    console.log(`${type} triggered by ${drivers[driverIndex]?.name || "?"}`);
    flagState = type;
    showFlagBanner(type);

    if (flagState === "red") {
        // RED FLAG: Halt the entire race
        drsEnabled = false; // DRS disabled under red flag
        flagTimer = 300; // 5 minutes simulated (300 frames at 60 fps)
        
        // Save the current classification for restart ordering
        redFlagClassification = [...drivers]
            .map((d, idx) => ({ idx, dist: drivers[idx].totalLength, state: d.state }))
            .filter(obj => obj.state !== "out") // Exclude drivers already out
            .sort((a, b) => b.dist - a.dist) // Sort by position
            .map(obj => obj.idx);

        // All racing drivers must pit
        for (let i = 0; i < drivers.length; i++) {
            if (drivers[i].state !== "out") {
                drivers[i].state = "in pit red flag";
                drivers[i].carState = 1; // Repair car
                drivers[i].tireState = 1; // Fresh tires
                drivers[i].tire = chooseNextTire(drivers[i], 0, (raceLength - drivers[i].totalLength) / 1000);
                drivers[i].pitStops = (drivers[i].pitStops || 0) + 1;
                drivers[i].speed = 0;
            }
        }

    } else if (flagState === "safetycar") {
        // SAFETY CAR: Slow down, no overtaking
        drsEnabled = false;
        flagTimer = 300; // 5 minutes or until track cleared
        
    } else if (flagState === "yellow") {
        // YELLOW FLAG: Caution, reduced speed, no overtaking
        drsEnabled = false;
        flagTimer = 120; // 2 minutes (reduce speed by 10%)
        
    } else if (flagState === "green") {
        // GREEN FLAG: Resume normal racing
        drsEnabled = true; // DRS re-enabled
        flagTimer = 60; // Display green for 1 second (60 frames)
    }
}
