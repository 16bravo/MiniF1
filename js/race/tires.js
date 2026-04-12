// TIRES.JS
// Tire properties and management logic

// Global declaration of tire types with their properties
const TIRES = {
    S: { name: "Soft", color: "#f00", speed: 1.0, drainage: -0.75, wearRate: 1/200000 },
    M: { name: "Medium", color: "#ff0", speed: 0.9975, drainage: -0.75, wearRate: 1/300000 },
    H: { name: "Hard", color: "#fff", speed: 0.995, drainage: -0.75, wearRate: 1/400000 },
    I: { name: "Intermediate", color: "#0f0", speed: 0.85, drainage: -0.25, wearRate: 1/100000 },
    W: { name: "Wet", color: "#00f", speed: 0.5, drainage: 0.2, wearRate: 1/100000 }
};

// Declaration of dry tire choices for random strategy at race start
const dryChoices = ["S", "M", "H"];

// Function to choose the next tire based on track conditions and race distance
// Considers rain level, remaining fuel/distance, number of pit stops already made
function chooseNextTire(driver, currentTrackWater, distanceLeftKm) {
    // Wet conditions: must switch to wet/intermediate tires
    if (currentTrackWater > 0.8) return "W"; // Heavy water → Wet tires
    if (currentTrackWater > 0.3) return "I"; // Light water → Intermediate

    // First pit stop strategy: alternate between Soft and Medium
    if (driver.pitStops < 1) {
        if (driver.tire === "S") return "M";
        if (driver.tire === "M") return "S";
        return (Math.random() < 0.5) ? "S" : "M";
    }

    // Last quarter of race: aggressive strategy with Soft tires only
    if (distanceLeftKm < 50) return "S";

    // Mid-race (150km+ remaining): avoid Hard if planning more stops
    if (distanceLeftKm < 150) {
        return (Math.random() < 0.5) ? "S" : "M"; // Random between S and M
    }

    // Start/middle of race: random choice between S, M, H
    return dryChoices[Math.floor(Math.random() * dryChoices.length)];
}
