// STATE_MAPPINGS.JS
// Mapping des états textuels en valeurs numériques pour l'enregistrement
// Ces mappings permettent d'afficher facilement les états dans les graphiques

// Driver State Mapping
const DRIVER_STATE_MAP = {
    "out": 0,
    "in pit red flag": 1,
    "in pit": 2,
    "box": 3,
    "racing": 4
};

// Reverse mapping for display
const DRIVER_STATE_REVERSE = {
    0: "out",
    1: "in pit red flag",
    2: "in pit",
    3: "box",
    4: "racing"
};

// Tire Type Mapping
const TIRE_MAP = {
    "S": 0,  // Soft
    "M": 1,  // Medium
    "H": 2,  // Hard
    "I": 3,  // Intermediate
    "W": 4   // Wet
};

// Reverse mapping for display
const TIRE_REVERSE = {
    0: "S",
    1: "M",
    2: "H",
    3: "I",
    4: "W"
};

// Driver Mode Mapping
const MODE_MAP = {
    "agressive": 1,
    "gestion": 0
};

// Reverse mapping for display
const MODE_REVERSE = {
    0: "gestion",
    1: "agressive"
};

// Flag State Mapping
const FLAG_STATE_MAP = {
    "ending": 0,
    "green": 1,
    "yellow": 2,
    "safetycar": 3,
    "red": 4
};

// Reverse mapping for display
const FLAG_STATE_REVERSE = {
    0: "ending",
    1: "green",
    2: "yellow",
    3: "safetycar",
    4: "red"
};

// Helper functions to convert
function mapState(stateStr) {
    return DRIVER_STATE_MAP[stateStr] !== undefined ? DRIVER_STATE_MAP[stateStr] : 4;
}

function unmapState(stateNum) {
    return DRIVER_STATE_REVERSE[stateNum] || "racing";
}

function mapTire(tireStr) {
    return TIRE_MAP[tireStr] !== undefined ? TIRE_MAP[tireStr] : 0;
}

function unmapTire(tireNum) {
    return TIRE_REVERSE[tireNum] || "S";
}

function mapMode(modeStr) {
    return MODE_MAP[modeStr] !== undefined ? MODE_MAP[modeStr] : 0;
}

function unmapMode(modeNum) {
    return MODE_REVERSE[modeNum] || "gestion";
}

function mapFlagState(flagStr) {
    return FLAG_STATE_MAP[flagStr] !== undefined ? FLAG_STATE_MAP[flagStr] : 1;
}

function unmapFlagState(flagNum) {
    return FLAG_STATE_REVERSE[flagNum] || "green";
}
