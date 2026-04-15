// RANKING.JS
// Driver ranking and gap calculations

// Function to find the driver in front of each driver on the track
// Returns an array with front driver index, gap in meters, and same lap status
function computeFrontsForAll() {
    const positions = drivers.map(driver => driver.totalLength % circuitLength);
    const laps = drivers.map(driver => Math.floor(driver.totalLength / circuitLength));

    // Sort drivers by position on circuit (ascending order = least advanced first)
    const posArray = positions.map((pos, i) => ({
        index: i,
        pos,
        lap: laps[i]
    })).sort((a, b) => a.pos - b.pos);

    // For each driver, find who is in front
    const fronts = new Array(nb_driver);

    for (let myRank = 0; myRank < posArray.length; myRank++) {
        const myPosObj = posArray[myRank];
        const frontRank = (myRank === posArray.length - 1) ? 0 : myRank + 1; // Wrap around to first
        const frontObj = posArray[frontRank];

        // Gap to front driver on track (accounting for circuit loop)
        let gapMetersTrack = (frontObj.pos - myPosObj.pos + circuitLength) % circuitLength;
        const sameLap = (myPosObj.lap === frontObj.lap);

        fronts[myPosObj.index] = {
            frontIndex: frontObj.index,
            gapMetersTrack,
            sameLap
        };
    }
    return fronts;
}

// Utility function to find who is directly behind a given driver
function getBackIndex(i, fronts) {
    // Find the driver whose front is i
    for (let j = 0; j < fronts.length; j++) {
        if (fronts[j]?.frontIndex === i) return j;
    }
    return null;
}

// Utility function to get the gap to a driver that is directly behind
function getGapBack(i, fronts) {
    // Find the driver whose front is i
    for (let j = 0; j < fronts.length; j++) {
        if (fronts[j]?.frontIndex === i) return fronts[j].gapMeters || 1000;
    }
    return 1000;
}

// Function to compute gap to front driver in overall ranking (not just on track)
// Used for comparison and mid-field calculations
function computeGapsFrontInRanking(drivers, driver_ranking) {
    const gaps = new Array(drivers.length).fill(0);
    const frontIndices = new Array(drivers.length).fill(null);

    for (let i = 0; i < drivers.length; i++) {
        const myRank = driver_ranking[i];
        const frontRank = (myRank - 1) % drivers.length;
        let frontIndexRanking = driver_ranking.length - 1; // Default to last if no one ahead

        if (frontRank > 0) {
            frontIndexRanking = driver_ranking.indexOf(frontRank) % drivers.length;
        }

        frontIndices[i] = frontIndexRanking;
    }
    return frontIndices;
}
