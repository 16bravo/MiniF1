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

    engineers: {
        // retire_in in data/engineer_default.json counts seasons from this year for everyone.
        baseYear: 2026,
        deckSize: 5,                  // visible cards per position in the general decks
        defaultContractSeasons: 4,    // contract length when hiring (stored; expiry comes with the season-end phase)
        dismissalConfidenceLoss: 1,   // heart lost when an engineer is fired or replaced
        // A dismissed engineer won't return to the team that dismissed him before the end of the
        // season; after that he asks this much more $ (added to his base salary) to come back.
        rehirePremium: 0.5,
        localCostMultiplier: 0.5,     // the yearly local card costs this much of its normal cost
        // Countries with their own regional pack; every other country shares 'row'.
        mainRegions: ['uk', 'italy', 'germany', 'france', 'japan', 'usa', 'china', 'india', 'brazil'],
        roleNames: { SPD: 'Engine', FS: 'Aero', SS: 'Mechanical', FB: 'Reliability' },
        // A card's cost is drawn in the finance gauge's unit (1 coin = 1 $) on this many coins.
        costIcons: 2,

        // Contract negotiation (spec section 8.3).
        negotiation: {
            acceptRatio: 0.8,           // r: an engineer accepts a team slightly under his thresholds
            costPointStep: 0.1,         // each extra 0.1 $ offered is worth 1 point
            salaryStep: 0.5,            // the salary is offered in steps of this many $ (shown as half coins)
            salaryMax: 2,               // and never above this many $
            pointsPerSeason: 1,         // points per season of gap to the engineer's target length
            hesitantOdds: [0.75, 0.5, 0.25], // chance of a deal when the score falls in [-1,0), [-2,-1), [-3,-2)
            refusalConfidenceLoss: 0.5, // heart lost when an offer is refused
            defaultBaseSeasons: 4,      // base contract length for cards with no contract_seasons in the database
            maxSeasons: 5               // longest contract that can be offered
        }
    },

    // Development projects (spec section 7).
    projects: {
        // $ a team may put into development in one season, by its rank last season:
        // `best` for the 1st, `worst` for the last, linear in between, rounded UP to `step`.
        devBudget: { best: 3, worst: 6, step: 0.5 },
        investStep: 0.5,          // projects are funded in steps of this many $
        minInvest: 0.5,
        // Ceiling gained per GP by a project = invested $ * pointsPerDollar * engineerFactor(rating) * experience(GP n)
        pointsPerDollar: 0.85,
        // engineerFactor(rating) = valueScale * rating ^ valueExponent (0 when the position is vacant)
        valueScale: 1.6e-8,
        valueExponent: 3.9425185046,
        // experience(GP n) = 1 + experiencePerGp * (n - 1): more points possible late in the season
        experiencePerGp: 0.004,
        statMax: 99               // a team stat never goes above this
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
