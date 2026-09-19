// Central calibration file for the Team Principal career mode.
// Every tunable number lives here - no magic numbers in the mode's code.
const TP_CONFIG = {
    // Team gauges (all on a 0-10 scale). Applied when a team has no stored value.
    gauges: {
        max: 10,
        defaultFinance: 2,
        defaultPrestige: 2,
        defaultConfidence: 5
    },

    // Player satisfaction: internal 0-100, only shown as a red -> green bar.
    satisfaction: {
        max: 100,
        start: 50
    },

    // Limits when the player creates their own team at the start of a career.
    createdTeam: {
        prestigeMin: 0,
        prestigeMax: 4,
        financeMin: 0,
        financeMax: 10
    }
};
