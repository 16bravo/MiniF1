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
        start: 50,                    // at the start of a career and after a dismissal
        // Expected rank of a team = its rank on this weighted mix of last season's rank, its finance
        // rank and its prestige rank (ties allowed).
        expected: { previousRank: 0.6, finance: 0.3, prestige: 0.1 },
        carryOver: 0.1,               // weight of the previous season's satisfaction (the rest is the season's own)
        bonus: { champion: 20, top3: 10, last: -10 },   // points added to the final value (champion and top 3 never add up)
        dismissBelow: 20,             // dismissed when the satisfaction falls under this...
        checkFromSeasonFraction: 0.5, // ...once this share of the season's Grands Prix has been raced
        protectedSeasons: 1           // no dismissal during the first season(s): the team's level isn't the player's doing
    },

    engineers: {
        // retire_in in data/engineer_default.json counts seasons from this year for everyone.
        baseYear: 2026,
        deckSize: 5,                  // visible cards per position in the general decks
        defaultContractSeasons: 4,    // contract length when hiring (stored; expiry comes with the season-end phase)
        dismissalConfidenceLoss: 1,   // heart lost when an engineer is fired or replaced
        // Taking the local offer over an engineer who still has a contract costs only this much confidence,
        // and doesn't count as a dismissal of the season.
        localReplaceConfidenceLoss: 0.5,
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
            hesitantOdds: [0.5, 0.5, 0.5],  // chance of a deal when the score falls in [-1,0), [-2,-1), [-3,-2): a coin flip (not shown to the player)
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
        // A project is run at an effort level: the $ spent on it at each GP. Its total cost is
        // effort * number of GPs (from the next GP up to the target GP included).
        // Scaled so that the top effort held for a whole 25-GP season costs the largest season limit (6 $).
        effortLevels: [0.048, 0.096, 0.144, 0.192, 0.24],   // $ per GP, levels 1 to 5 (drives the ceiling growth)
        // What a project really costs is its effort * GPs times this factor; the ceiling still grows
        // from the full effort, so lowering the factor makes development cheaper without weakening it.
        costFactor: 0.5,
        // Ceiling gained per GP by a project =
        //   effort ($ per GP) * pointsPerDollar * engineerFactor(rating) * experience(GP n) * ceilingMultiplier
        pointsPerDollar: 0.85,
        ceilingMultiplier: 4,     // makes up for the smaller effort scale: same effort, 4 times the ceiling
        // The gain is drawn (uniformly) between max - guaranteedBelowMax and max, never below 0: a big
        // investment always pays at least max - 3. Small ceilings (max <= 3) can still draw 0.
        guaranteedBelowMax: 3,
        // engineerFactor(rating) = valueScale * rating ^ valueExponent (0 when the position is vacant)
        valueScale: 1.6e-8,
        valueExponent: 3.9425185046,
        // experience(GP n) = 1 + experiencePerGp * (n - 1): more points possible late in the season
        experiencePerGp: 0.004,
        statMax: 99               // a team stat never goes above this
    },

    // Season opening (spec section 9), for every team of the grid.
    regulation: {
        firstYear: 2026,      // a new regulation every `cycle` years after it (2030, 2034...); 2026 keeps the game's stats
        cycle: 4,
        // New regulation: stat = a random number between base - spread and base, with
        // base = engineer's value + last season's rank / rankDivisor + offset (+ bonusPerRace per race of
        // "next season" development at the reference effort). Without an engineer: noEngineer.
        rankDivisor: 2,
        offset: -5,
        spread: 15,
        noEngineer: 50,
        bonusPerRace: 0.4,
        // Any other year: a free project per stat before the first race = a project at effort `level` over `races`
        // races, times `multiplier` + `bonusPerRace` per race of "next season" development (at effort `level`;
        // a lower effort counts for a proportional share).
        preseason: { level: 5, races: 5, multiplier: 2, bonusPerRace: 0.08 }
    },

    // End of season (spec sections 10, 11, 5.3): applied to every team of the grid.
    seasonEnd: {
        // $ earned by rank in the final constructors' standings: `best` for the 1st, `worst` for the
        // last, linear in between, rounded to the nearest `step`.
        finance: { best: 4, worst: 1, step: 0.5 },
        // Prestige = base (the highest that applies) + the extras below, kept between 0 and 10.
        // Wins / titles / races count the whole history of the team family (data/team_families.json)
        // plus the seasons played in the game.
        prestige: {
            base: 1,
            win: 2,                       // at least 1 win
            manyWins: 3, manyWinsOver: 10, // more than 10 wins
            title: 5,                     // 1 title
            titles: 6,                    // several titles
            races: [500, 1000],           // +1 for each threshold reached
            champion: 2, top3: 1, last: -1, // last season's result (top3 = 2nd or 3rd)
            // Brand prestige, by team name (other teams: 0)
            brand: { 'McLaren': 4, 'Mercedes': 4, 'Ferrari': 4, 'Audi': 4,
                     'Red Bull': 2, 'Aston Martin': 2, 'Alpine': 2, 'Cadillac': 2 }
        },
        // Confidence change: a title, else finishing above / below the expected rank
        // (the rank of the previous season for now), plus a bonus for a season with no dismissal.
        confidence: { title: 2, above: 1, below: -1, noDismissal: 1 }
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
