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
// Dry rule: first pit must use a compound different from starting tire (2-compound rule)
// End of race: always prefer S (fastest); never use H unless no choice
function chooseNextTire(driver, currentTrackWater, distanceLeftKm) {
    // Wet/intermediate conditions take absolute priority
    if (currentTrackWater > 0.8) return "W";
    if (currentTrackWater > 0.3) return "I";

    // First pit stop: randomly pick any compound except the one used at race start
    // This guarantees the 2-compound rule is satisfied
    if (driver.pitStops < 1) {
        const options = dryChoices.filter(t => t !== driver.startingTire);
        return options[Math.floor(Math.random() * options.length)];
    }

    // End of race (< 50km): always go with Soft for maximum pace
    if (distanceLeftKm < 50) return "S";

    // Mid-race: S or M only, never Hard (too slow, illogical)
    return Math.random() < 0.5 ? "S" : "M";
}
