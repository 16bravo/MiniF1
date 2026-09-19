// Central calibration file for the Team Principal career mode.
// Every tunable number lives here - no magic numbers in the mode's code.
const TP_CONFIG = {
    // Team gauges (all on a 0-10 scale). Applied when a team has no stored value.
    gauges: {
        max: 10,
        defaultFinance: 2,
        defaultPrestige: 2,
        defaultConfidence: 10
    },

    // Player satisfaction: internal 0-100, only shown as a red -> green bar.
    satisfaction: {
        max: 100,
        start: 50
    },

    engineers: {
        // retire_in in data/engineer_default.json counts seasons from this year for everyone.
        baseYear: 2026,
        deckSize: 5,                  // visible cards per position in the general decks
        defaultContractSeasons: 4,    // contract length when hiring (stored; expiry comes with the season-end phase)
        dismissalConfidenceLoss: 1,   // heart lost when an engineer is fired or replaced
        localCostMultiplier: 0.5,     // the yearly local card costs this much of its normal cost
        // Countries with their own regional pack; every other country shares 'row'.
        mainRegions: ['uk', 'italy', 'germany', 'france', 'japan', 'usa', 'china', 'india', 'brazil'],
        roleNames: { SPD: 'Engine', FS: 'Aero', SS: 'Mechanical', FB: 'Reliability' },
        // A card's cost is drawn in the finance gauge's unit (1 coin = 1 $) on this many coins.
        costIcons: 2
    },

    // Car stat bars run from barMin (empty) to barMax (full); the number is always shown.
    carStats: { barMin: 50, barMax: 100 },

    // Limits when the player creates their own team at the start of a career.
    createdTeam: {
        prestigeMin: 0,
        prestigeMax: 4,
        financeMin: 0,
        financeMax: 10
    }
};
