// UTILS.JS
// Utility functions for random number generation and time formatting

// Function to generate a random number according to the Box-Muller transform
function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Function to generate a random number according to a normal distribution with mean and standard deviation
function generateNormalRandom(mean, stddev) {
    return mean + stddev * randn_bm();
}

// Function for formatting driver time (MM:SS.milliseconds format)
function formatDriverTime(seconds) {
    // Extract minutes
    const minutes = Math.floor(seconds / 60);

    // Extract the seconds and milliseconds
    const remainingSeconds = seconds % 60;
    const formattedSeconds = remainingSeconds.toFixed(3);

    // Add a zero before the seconds if necessary
    const [wholeSeconds, milliseconds] = formattedSeconds.split('.');
    const paddedSeconds = wholeSeconds.padStart(2, '0');

    // Construct the result string
    return `${minutes > 0 ? minutes + ":" + paddedSeconds : wholeSeconds}.${milliseconds}`;
}

// Function for formatting intervals (gap to leader)
function formatInterval(time, lap) {
    if (time === 0) {
        return "Leader";
    } else if (lap > 2) {
        return "+ " + Math.floor(lap) + " laps";
    } else if (lap > 1) {
        return "+ " + Math.floor(lap) + " lap";
    } else {
        return "+ " + formatDriverTime(time);
    }
}
