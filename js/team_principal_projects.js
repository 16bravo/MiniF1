// ============================================================
// TEAM_PRINCIPAL_PROJECTS.JS
// Development projects of the Team Principal mode (spec section 7): one project at a
// time per stat, aimed at a target GP. Each GP the ceiling grows by an amount that
// depends on the invested $, the engineer in place and the point in the season; at the
// target GP the gain is drawn between 0 and the ceiling and added to the team stat.
//
// State lives in slot.data.teamPrincipal.dev:
//   { season, spent, processedWeekend, projects: { SPD|FS|SS|FB: project|null }, last: { role: {...} } }
//   project = { role, target (weekend n), invested, ceiling }
// A "weekend" is one GP: a sprint and the GP that follows it count once.
// Requires data/team_principal_config.js. Pure logic, no DOM.
// ============================================================

const TeamPrincipalProjects = (function () {
    const ROLES = ['SPD', 'FS', 'SS', 'FB'];
    const cfg = () => TP_CONFIG.projects;
    const round2 = x => Math.round(x * 100) / 100;

    // ---- calendar ----

    // The GP weekends of the season: [{ no (1-based), index (race entry of the GP), race }].
    function weekends(races) {
        const out = [];
        (races || []).forEach((r, i) => { if (!r.isSprintRace) out.push({ no: out.length + 1, index: i, race: r }); });
        return out;
    }

    // Weekend number of a race entry (a sprint belongs to the weekend of the GP that follows it).
    function weekendNoOfRace(races, i) {
        let features = 0;
        for (let k = 0; k < i && k < races.length; k++) if (!races[k].isSprintRace) features++;
        return features + 1;
    }

    // ---- formulas ----

    function engineerFactor(rating) { return cfg().valueScale * Math.pow(Math.max(0, rating), cfg().valueExponent); }

    function experience(weekendNo) { return 1 + cfg().experiencePerGp * (weekendNo - 1); }

    // Ceiling gained at one GP by a project (0 when the engineer position is vacant: rating 0).
    function increment(invested, rating, weekendNo) {
        return invested * cfg().pointsPerDollar * engineerFactor(rating) * experience(weekendNo);
    }

    // $ a team may put into development this season, from its rank last season (1 = champion).
    function devCap(rank, teamCount) {
        const b = cfg().devBudget;
        const raw = teamCount <= 1 ? b.best : b.best + (rank - 1) * (b.worst - b.best) / (teamCount - 1);
        return Math.ceil(raw / b.step - 1e-9) * b.step;
    }

    // ---- state ----

    // The season's development state; a new season starts from a clean budget.
    function ensure(tp, season) {
        if (!tp.dev || tp.dev.season !== season) {
            tp.dev = { season: season, spent: 0, processedWeekend: 0,
                       projects: { SPD: null, FS: null, SS: null, FB: null }, last: (tp.dev && tp.dev.last) || {} };
        }
        return tp.dev;
    }

    // The first weekend a new project can still target.
    function openWeekend(dev, races, currentRaceIndex) {
        return Math.max(dev.processedWeekend + 1, weekendNoOfRace(races, currentRaceIndex));
    }

    function remainingBudget(dev, cap) { return Math.max(0, round2(cap - dev.spent)); }

    // Largest investment (on the funding step) that fits both the budget left and the free $.
    function maxInvest(budgetLeft, freeFinance) {
        const step = cfg().investStep;
        return Math.floor(Math.min(budgetLeft, freeFinance) / step + 1e-9) * step;
    }

    function create(dev, role, targetWeekend, invested) {
        if (dev.projects[role]) return null;
        const project = { role: role, target: targetWeekend, invested: round2(invested), ceiling: 0 };
        dev.projects[role] = project;
        dev.spent = round2(dev.spent + project.invested);
        return project;
    }

    // Runs the weekends up to `weekendNo` that haven't been processed yet: every project grows
    // its ceiling, and the ones reaching their target draw their gain.
    //   ratingOf(role) -> rating of the engineer in place (0 if vacant); statOf(role) -> current stat.
    // Returns one outcome per finished project: { role, weekendNo, invested, ceiling, gain, newStat }.
    function processUpTo(dev, weekendNo, ratingOf, statOf, roll) {
        const outcomes = [];
        for (let w = dev.processedWeekend + 1; w <= weekendNo; w++) {
            ROLES.forEach(role => {
                const p = dev.projects[role];
                if (!p || w > p.target) return;
                p.ceiling += increment(p.invested, ratingOf(role), w);
                if (w !== p.target) return;
                const stat = statOf(role);
                const drawn = (roll ? roll() : Math.random()) * p.ceiling;
                const gain = Math.max(0, Math.min(drawn, cfg().statMax - stat));
                const outcome = { role: role, weekendNo: w, invested: p.invested, ceiling: round2(p.ceiling),
                                  gain: round2(gain), newStat: round2(stat + gain) };
                dev.last[role] = { weekendNo: w, gain: outcome.gain, ceiling: outcome.ceiling };
                dev.projects[role] = null;
                outcomes.push(outcome);
            });
            dev.processedWeekend = w;
        }
        return outcomes;
    }

    return { ROLES, weekends, weekendNoOfRace, engineerFactor, experience, increment, devCap, ensure,
             openWeekend, remainingBudget, maxInvest, create, processUpTo };
})();
