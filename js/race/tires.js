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

