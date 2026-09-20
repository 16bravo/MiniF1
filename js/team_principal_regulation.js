// ============================================================
// TEAM_PRINCIPAL_REGULATION.JS
// What happens to the teams' stats when a season opens (Team Principal mode), for every team:
//
// In both cases the engineer counted is the one of the season that just ended: he is the one who worked
// on the car, whatever happens to him afterwards (contract ended, retirement...); no engineer = no value.
//
//   New regulation (2030, 2034... a cycle of `cycle` years after `firstYear`): SPD/FS/SS/FB restart.
//     base = engineer's value + last season's rank / 2 - 5   (+ 0.4 per race of "next season" development)
//     stat = a random number between base - 15 and base;  50 when the position has no engineer.
//   Any other year: a free automatic project per stat before the first race, worth a project at
//     effort 5 over 5 races, times 2 (+ 0.08 per race of "next season" development), drawn like a project.
//
// The "next season" development (a project of the player, see team_principal_projects.js) only feeds those
// two bonuses. Its `carry` holds, per stat, the sum over its races of (effort level / reference level).
// Requires data/team_principal_config.js and team_principal_projects.js. Pure logic, no DOM.
// ============================================================

const TeamPrincipalRegulation = (function () {
    const cfg = () => TP_CONFIG.regulation;
    const TPP = TeamPrincipalProjects;
    const ROLES = TPP.ROLES;
    const clampStat = x => Math.max(0, Math.min(TP_CONFIG.projects.statMax, x));

    // The seasons of a new regulation: firstYear itself keeps the stats the game starts with.
    function isRegulationYear(year) {
        return year > cfg().firstYear && (year - cfg().firstYear) % cfg().cycle === 0;
    }

    // Starting stat after a regulation change; 50 (noEngineer) without an engineer. `carry`: next-season development.
    function startingBase(value, lastRank, carry) {
        return value + lastRank / cfg().rankDivisor + cfg().offset + cfg().bonusPerRace * (carry || 0);
    }
    function startingStat(value, lastRank, carry, roll) {
        if (value === null || value === undefined) return cfg().noEngineer;
        const base = startingBase(value, lastRank, carry);
        return clampStat(Math.round(base - cfg().spread + (roll ? roll() : Math.random()) * cfg().spread));
    }

    // Ceiling of the automatic pre-season project: an effort-5 project over 5 races, times (2 + bonus).
    function preseasonCeiling(rating, carry) {
        const p = cfg().preseason;
        let sum = 0;
        for (let w = 1; w <= p.races; w++) sum += TPP.increment(TPP.effortOf(p.level), rating, w);
        return (p.multiplier + p.bonusPerRace * (carry || 0)) * sum;
    }

    // Applies the season opening to `teams` (their team stats are rewritten).
    //   st: the engineer world (positions in place now), lastRank(uid): rank of the team last season,
    //   valueOf(id): rating of an engineer, carry: { role: units } of the player's team (playerUid only),
    //   previous: { uid: { role: value | null } } = the engineers of the season that just ended (the ones
    //   who worked on the car); without it, the engineers in place now.
    // Returns the player's rows: [{ role, before, after, ceiling?, gain? }].
    function applySeasonStart(teams, year, st, lastRank, valueOf, carry, playerUid, roll, previous) {
        const regulation = isRegulationYear(year);
        const rows = [];
        teams.forEach(team => {
            const slots = (st && st.teams[team.teamUid]) || {};
            ROLES.forEach(role => {
                const engineer = (previous && previous[team.teamUid] && previous[team.teamUid][role] !== undefined)
                    ? previous[team.teamUid][role]
                    : (slots[role] ? valueOf(slots[role].id) : null);
                const units = team.teamUid === playerUid && carry ? (carry[role] || 0) : 0;
                const key = 'team' + role;
                const before = parseFloat(team[key]) || 0;
                let after, ceiling = null, gain = null;
                if (regulation) {
                    after = startingStat(engineer, lastRank(team.teamUid), units, roll);
                } else {
                    const drawn = TPP.drawGain(preseasonCeiling(engineer || 0, units), before, roll);
                    ceiling = drawn.ceiling; gain = drawn.gain;
                    after = Math.round((before + gain) * 100) / 100;
                }
                team[key] = after;
                if (team.teamUid === playerUid) rows.push({ role: role, before: before, after: after, ceiling: ceiling, gain: gain });
            });
        });
        return { regulation: regulation, rows: rows };
    }

    return { isRegulationYear, startingBase, startingStat, preseasonCeiling, applySeasonStart };
})();
