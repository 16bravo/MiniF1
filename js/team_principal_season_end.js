// ============================================================
// TEAM_PRINCIPAL_SEASON_END.JS
// End of season of the Team Principal mode: $ earned, prestige and confidence of every
// team, then the engineers' contracts, retirements and the new season's market.
// Used by championship_end.js's startNextSeason(), in three steps:
//   prepare()      - before the grid is reordered (the previous rank is the grid position)
//   applyGauges()  - after the reorder, on the live 'teams' list
//   finish()       - on the career slot: engineers, recap for the player
// Requires data/team_principal_config.js, team_principal_common.js and team_principal_engineers.js.
// ============================================================

const TeamPrincipalSeasonEnd = (function () {
    const cfg = () => TP_CONFIG.seasonEnd;
    let families = null; // data/team_families.json

    function load() {
        if (families) return Promise.resolve(families);
        return fetch('data/team_families.json').then(r => r.json())
            .catch(() => ({}))
            .then(d => { families = d; return d; });
    }
    function isLoaded() { return !!families; }

    const clamp10 = x => Math.max(0, Math.min(TP_CONFIG.gauges.max, x));
    const round2 = x => Math.round(x * 100) / 100;

    // ---- rules ----

    // $ earned by rank: linear from `best` (1st) to `worst` (last), rounded to the nearest step.
    function financeGain(rank, teamCount) {
        const f = cfg().finance;
        const raw = teamCount <= 1 ? f.best : f.best + (rank - 1) * (f.worst - f.best) / (teamCount - 1);
        return Math.round(raw / f.step) * f.step;
    }

    // Prestige of a team from its total history (`totals`: titles, wins, gps), its brand and last
    // season's result. Base = the highest that applies; the rest adds up.
    function prestige(name, totals, rank, teamCount) {
        const p = cfg().prestige;
        let base = p.base;
        if (totals.wins >= 1) base = Math.max(base, p.win);
        if (totals.wins > p.manyWinsOver) base = Math.max(base, p.manyWins);
        if (totals.titles >= 1) base = Math.max(base, p.title);
        if (totals.titles >= 2) base = Math.max(base, p.titles);
        let extra = p.brand[name] || 0;
        p.races.forEach(threshold => { if (totals.gps >= threshold) extra += 1; });
        if (rank === 1) extra += p.champion;
        else if (rank <= 3) extra += p.top3;
        if (rank === teamCount) extra += p.last;
        return { base: base, extra: extra, value: clamp10(base + extra) };
    }

    // Confidence change: a title, else above / below the expected rank (see TeamPrincipalSatisfaction);
    // +1 if nobody was dismissed.
    function confidenceDelta(rank, expectedRank, dismissed) {
        const c = cfg().confidence;
        const parts = { result: rank === 1 ? c.title : (rank < expectedRank ? c.above : (rank > expectedRank ? c.below : 0)),
                        noDismissal: dismissed ? 0 : c.noDismissal };
        return { parts: parts, delta: parts.result + parts.noDismissal };
    }

    // Titles / wins / GPs of the seasons played in the game, by team name.
    function gameTotals(seasons) {
        const t = {};
        const entry = name => t[name] || (t[name] = { titles: 0, wins: 0, gps: 0 });
        seasons.forEach(s => {
            (s.teamStats || []).forEach(x => {
                const o = entry(x.team);
                o.wins += x.wins || 0;
                o.gps += x.gpWeekends != null ? x.gpWeekends : (x.entered != null ? x.entered : (x.gps || 0));
            });
            if (s.championTeamName) entry(s.championTeamName).titles += 1;
        });
        return t;
    }

    // ---- steps ----

    // Before the reorder: the grid position is last season's rank; the final standings give this one.
    // `summary` = the just-finished season's archive summary (it is not in seasonHistory yet).
    function prepare(slot, constructorStandings, summary, season) {
        let teams = [];
        try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (e) {}
        const rankedNames = (constructorStandings || []).map(r => r.team);
        const ordered = teams.map((t, i) => ({ t: t, prev: i + 1 }))
            .sort((a, b) => {
                const ra = rankedNames.indexOf(TeamPrincipal.teamName(a.t)), rb = rankedNames.indexOf(TeamPrincipal.teamName(b.t));
                if (ra >= 0 && rb >= 0) return ra - rb;
                if (ra >= 0) return -1;
                if (rb >= 0) return 1;
                return a.prev - b.prev;
            });
        const dismissed = (slot.data.engineerState && slot.data.engineerState.dismissed) || {};
        // The season's expected ranks (60% last rank, 30% finance, 10% prestige), as the season started.
        const tp = slot.data.teamPrincipal;
        const expected = tp ? TeamPrincipalSatisfaction.ensureSeason(tp, teams, season).expected : {};
        const rows = ordered.map((o, i) => ({
            uid: o.t.teamUid, name: TeamPrincipal.teamName(o.t), prevRank: o.prev, rank: i + 1,
            expected: expected[o.t.teamUid] || o.prev,
            dismissed: !!(dismissed[o.t.teamUid] && dismissed[o.t.teamUid].length)
        }));
        return { season: season, teamCount: teams.length, rows: rows, summary: summary,
                 game: gameTotals((slot.data.seasonHistory || []).concat([summary])) };
    }

    // After the reorder: update finance, prestige and confidence of every team in the live list.
    function applyGauges(ctx) {
        let teams = [];
        try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (e) {}
        const fam = families || {};
        ctx.rows.forEach(row => {
            const team = teams.find(t => t.teamUid === row.uid);
            if (!team) return;
            const g = TeamPrincipal.teamGauges(team);
            const f = fam[row.name] || { titles: 0, wins: 0, gps: 0 };
            const gm = ctx.game[row.name] || { titles: 0, wins: 0, gps: 0 };
            const totals = { titles: f.titles + gm.titles, wins: f.wins + gm.wins, gps: f.gps + gm.gps };

            const gain = financeGain(row.rank, ctx.teamCount);
            const pr = prestige(row.name, totals, row.rank, ctx.teamCount);
            const cf = confidenceDelta(row.rank, row.expected, row.dismissed);
            row.before = { finance: g.finance, confidence: g.confidence, prestige: g.prestige };
            row.after = { finance: clamp10(g.finance + gain), confidence: clamp10(g.confidence + cf.delta), prestige: pr.value };
            row.gain = gain; row.confidence = cf; row.prestige = pr; row.totals = totals;
            team.finance = round2(row.after.finance);
            team.confidence = round2(row.after.confidence);
            team.prestige = row.after.prestige;
        });
        localStorage.setItem('teams', JSON.stringify(teams));
    }

    // On the slot: the engineers (contracts end, retirements, new market, AI teams), then the
    // review shown to the player.
    function finish(slot, ctx, nextYear) {
        const tp = slot.data.teamPrincipal;
        const TPE = TeamPrincipalEngineers;
        const st = slot.data.engineerState;
        let events = { retired: [], released: [] };
        // The engineers of the season that just ended, before contracts end and engineers retire: the ones
        // who worked on the car, whose value counts for the next season's opening (regulation or not).
        const previous = {};
        if (st && TPE.isLoaded()) {
            Object.keys(st.teams).forEach(uid => {
                previous[uid] = {};
                TPE.ROLES.forEach(role => {
                    const s = st.teams[uid][role];
                    previous[uid][role] = s ? TPE.get(s.id).value : null;
                });
            });
        }
        if (st && TPE.isLoaded()) {
            const teams = slot.data.teams || [];
            const player = teams.find(t => t.teamUid === tp.teamUid);
            events = TPE.endOfSeason(st, nextYear, tp.teamUid);
            TPE.advanceYear(st, nextYear, player);
            TPE.aiFillVacancies(st, teams, tp.teamUid);
        }
        // The season's satisfaction becomes the one carried to the next season.
        TeamPrincipalSatisfaction.closeSeason(tp);
        // The next season opens: a new regulation, or the automatic pre-season development, for every team.
        if (st && TPE.isLoaded() && typeof TeamPrincipalRegulation !== 'undefined') {
            const grid = slot.data.teams || [];
            const rankOf = {};
            ctx.rows.forEach(r => { rankOf[r.uid] = r.rank; });
            const carry = tp.dev && tp.dev.season === ctx.season ? tp.dev.carry : null;
            const opening = TeamPrincipalRegulation.applySeasonStart(grid, nextYear, st, uid => rankOf[uid] || grid.length,
                id => TPE.get(id).value, carry, tp.teamUid, null, previous);
            localStorage.setItem('teams', JSON.stringify(grid));
            tp.pre = { season: ctx.season + 1, year: nextYear, regulation: opening.regulation, rows: opening.rows, seen: false };
            if (tp.dev) tp.dev.carry = {};
        }
        const row = ctx.rows.find(r => r.uid === tp.teamUid);
        if (!row || !row.after) return;
        // The manager's career record: the season just finished, for the team managed at its end.
        if (typeof TeamPrincipalCareer !== 'undefined') {
            TeamPrincipalCareer.add(tp, TeamPrincipalCareer.buildRecord(
                ctx.season, TeamPrincipal.currentYear(), row, ctx.teamCount, ctx.summary, tp.dismissal));
        }
        const nameOf = id => (TPE.get(id) || {}).name || '';
        tp.recap = {
            season: ctx.season, rank: row.rank, prevRank: row.prevRank, expected: row.expected, teamCount: ctx.teamCount,
            finance: { before: row.before.finance, after: row.after.finance, gain: row.gain },
            prestige: { before: row.before.prestige, after: row.after.prestige },
            confidence: { before: row.before.confidence, after: row.after.confidence, parts: row.confidence.parts },
            released: events.released.map(nameOf), retired: events.retired.map(nameOf),
            seen: false
        };
    }

    return { load, isLoaded, financeGain, prestige, confidenceDelta, gameTotals, prepare, applyGauges, finish };
})();
