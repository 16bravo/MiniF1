// ============================================================
// TEAM_PRINCIPAL_PROJECTS.JS
// Development projects of the Team Principal mode (spec section 7): one project at a
// time per stat, run at an effort level (the $ spent per GP) until a target GP. Each GP the
// ceiling grows by an amount that depends on the effort, the engineer in place and the point
// in the season; at the target GP the gain is drawn between 0 and the ceiling and added to
// the team stat. The whole cost (effort * number of GPs) is paid when the project starts.
//
// State lives in slot.data.teamPrincipal.dev:
//   { season, spent, processedWeekend, projects: { SPD|FS|SS|FB: project|null }, last: { role: {...} }, pending: [outcomes] }
//   project = { role, target (weekend n), level (1-5), effort ($ per GP), cost, from, ceiling }
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
        return invested * cfg().pointsPerDollar * engineerFactor(rating) * experience(weekendNo) * cfg().ceilingMultiplier;
    }

    // $ a team may put into development this season, from its rank last season (1 = champion).
    function devCap(rank, teamCount) {
        const b = cfg().devBudget;
        const raw = teamCount <= 1 ? b.best : b.best + (rank - 1) * (b.worst - b.best) / (teamCount - 1);
        return Math.ceil(raw / b.step - 1e-9) * b.step;
    }

    // The ceiling as the player sees it and as the draw uses it: rounded up to a whole number of points.
    function ceilingValue(ceiling) { return Math.max(0, Math.ceil(ceiling - 1e-9)); }

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

    // What a team can put into a new project: the $ left of its season limit, and the free $.
    function available(budgetLeft, freeFinance) { return round2(Math.min(budgetLeft, freeFinance)); }

    // $ per GP of an effort level (1-based).
    function effortOf(level) { return cfg().effortLevels[level - 1]; }

    // Total cost of a project: one effort per GP (times costFactor), from the first open GP up to the target GP included.
    function projectCost(level, openWeekend, targetWeekend) {
        return round2(effortOf(level) * cfg().costFactor * (targetWeekend - openWeekend + 1));
    }

    // A project running at `level` until `targetWeekend`, from the first open GP; it costs `cost`.
    function create(dev, role, targetWeekend, level, openWeekend) {
        if (dev.projects[role]) return null;
        const cost = projectCost(level, openWeekend, targetWeekend);
        const project = { role: role, target: targetWeekend, level: level, effort: effortOf(level), cost: cost, from: openWeekend, ceiling: 0 };
        dev.projects[role] = project;
        dev.spent = round2(dev.spent + cost);
        return project;
    }

    // Finished-project results not shown to the player yet (they are shown as the GP weekend opens).
    function takePending(dev) {
        const out = dev.pending || [];
        dev.pending = [];
        return out;
    }

    // Runs the weekends up to `weekendNo` that haven't been processed yet: every project grows
    // its ceiling, and the ones reaching their target draw their gain.
    //   ratingOf(role) -> rating of the engineer in place (0 if vacant); statOf(role) -> current stat.
    // Returns one outcome per finished project: { role, weekendNo, cost, ceiling, gain, newStat }.
    function processUpTo(dev, weekendNo, ratingOf, statOf, roll) {
        const outcomes = [];
        for (let w = dev.processedWeekend + 1; w <= weekendNo; w++) {
            ROLES.forEach(role => {
                const p = dev.projects[role];
                if (!p || w > p.target) return;
                p.ceiling += increment(p.effort !== undefined ? p.effort : p.invested, ratingOf(role), w);
                if (w !== p.target) return;
                const stat = statOf(role);
                // Whole points only: the ceiling is rounded UP to an integer, the draw (between
                // max - guaranteedBelowMax and max, at least 0) is rounded to the NEAREST integer.
                const maxValue = ceilingValue(p.ceiling);
                const minValue = Math.max(0, maxValue - cfg().guaranteedBelowMax);
                const drawn = Math.round(minValue + (roll ? roll() : Math.random()) * (maxValue - minValue));
                const gain = Math.max(0, Math.min(drawn, Math.floor(cfg().statMax - stat)));
                const outcome = { role: role, weekendNo: w, cost: p.cost !== undefined ? p.cost : p.invested, ceiling: maxValue,
                                  gain: gain, newStat: round2(stat + gain) };
                dev.last[role] = { weekendNo: w, gain: outcome.gain, ceiling: outcome.ceiling };
                dev.projects[role] = null;
                outcomes.push(outcome);
            });
            dev.processedWeekend = w;
        }
        // Kept until the player has seen them.
        if (outcomes.length) dev.pending = (dev.pending || []).concat(outcomes);
        return outcomes;
    }

    return { ROLES, weekends, weekendNoOfRace, engineerFactor, experience, increment, devCap, ensure,
             openWeekend, remainingBudget, available, effortOf, projectCost, create, takePending, processUpTo, ceilingValue };
})();
