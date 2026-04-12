// UTILS.JS
// Utility functions and formatting helpers for qualification module

// Function to generate a random number according to the Box-Muller transform
function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Function to generate a random number according to a normal distribution with a given mean and standard deviation
function generateNormalRandom(mean, stddev) {
    return mean + stddev * randn_bm();
}

// Function to format session time (minutes:seconds)
function formatSessionTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Function to format driver lap time (minutes:seconds.milliseconds)
function formatDriverTime(seconds) {
    // Extract minutes
    const minutes = Math.floor(seconds / 60);
    
    // Extract seconds and milliseconds
    const remainingSeconds = seconds % 60;
    const formattedSeconds = remainingSeconds.toFixed(3);

    // Add a zero before the seconds if necessary
    const [wholeSeconds, milliseconds] = formattedSeconds.split('.');
    const paddedSeconds = wholeSeconds.padStart(2, '0');

    // Build the result string
    return `${minutes > 0 ? minutes + ":" : ''}${paddedSeconds}.${milliseconds}`;
}
