// ============================================================
// TEAM_PRINCIPAL_SATISFACTION.JS
// Satisfaction of the board with the Team Principal, and the expected ranking it is measured against.
//
//   Expected rank: every team gets 60% of last season's rank (grid position) + 30% of its finance
//     rank + 10% of its prestige rank; the teams are ranked again on that score. Ties are allowed:
//     two teams can share the same expected rank.
//   Raw satisfaction of a season: (((expected - actual) / teams) + 1) / 2.
//   Satisfaction = 10% of the previous season's + 90% of the raw one, then the bonus of the result
//     (champion, top 3 - never both -, last), kept between 0 and 100.
//   Below `dismissBelow`, once half of the season is over (checked after every race), the player
//   is dismissed (never in the first season: the team's level isn't their doing): they take over the worst team of the grid (not the one that dismissed them),
//   with a satisfaction back at `start`.
//
// State on slot.data.teamPrincipal:
//   satisfaction - the value carried from the last season (or from the last dismissal)
//   sat          - { season, expected: {teamUid: rank}, processed: races counted, live: value this season }
//   dismissal    - { from, to, season, seen } once dismissed, until the player has seen it
// Requires data/team_principal_config.js, team_principal_common.js, championship_common.js.
// ============================================================

const TeamPrincipalSatisfaction = (function () {
    const cfg = () => TP_CONFIG.satisfaction;
    const EPS = 1e-9;
    const clamp = x => Math.max(0, Math.min(cfg().max, x));

    // Rank of each value among the others, lowest value = rank 1; equal values share a rank.
    function ranksAscending(values) {
        return values.map(v => 1 + values.filter(o => o < v - EPS).length);
    }

    // { teamUid: expected rank } for every team of the grid.
    function expectedRanks(teams) {
        const w = cfg().expected;
        // Last season's rank = the grid position = the position in the list (team_id is not stored on the live teams).
        const prev = ranksAscending(teams.map((t, i) => i + 1));
        const fin = ranksAscending(teams.map(t => -TeamPrincipal.teamGauges(t).finance));
        const pre = ranksAscending(teams.map(t => -TeamPrincipal.teamGauges(t).prestige));
        const score = teams.map((t, i) => w.previousRank * prev[i] + w.finance * fin[i] + w.prestige * pre[i]);
        const expected = ranksAscending(score);
        const out = {};
        teams.forEach((t, i) => { out[t.teamUid] = expected[i]; });
        return out;
    }

    // Raw satisfaction of a season, 0-100.
    function rawSatisfaction(expected, actual, teamCount) {
        return 100 * (((expected - actual) / teamCount) + 1) / 2;
    }

    // Bonus (in points) of a result: champion or top 3 (not both), or last.
    function resultBonus(rank, teamCount) {
        const b = cfg().bonus;
        if (rank === 1) return b.champion;
        if (rank <= 3) return b.top3;
        if (rank === teamCount) return b.last;
        return 0;
    }

    // Satisfaction after a season (or so far in it): `previous` is the carried value.
    function satisfactionOf(previous, expected, actual, teamCount) {
        const carry = cfg().carryOver;
        const raw = rawSatisfaction(expected, actual, teamCount);
        return clamp(carry * previous + (1 - carry) * raw + resultBonus(actual, teamCount));
    }

    // The season's expected ranks, computed once per season (from the grid as the season starts).
    function ensureSeason(tp, teams, season) {
        if (!tp.sat || tp.sat.season !== season) {
            tp.sat = { season: season, expected: expectedRanks(teams), processed: 0, live: null };
        }
        return tp.sat;
    }

    // What the satisfaction bar shows: the value so far this season, else the carried one.
    function current(tp) {
        return tp && tp.sat && tp.sat.live !== null && tp.sat.live !== undefined ? tp.sat.live : (tp ? tp.satisfaction : 0);
    }

    // The worst team of the grid (the last of the list) other than `exceptUid`.
    function worstTeam(teams, exceptUid) {
        for (let i = teams.length - 1; i >= 0; i--) if (teams[i].teamUid !== exceptUid) return teams[i];
        return null;
    }

    // The player is dismissed: they take over `newTeam`; the season's development starts over there.
    function dismiss(tp, team, newTeam, season) {
        tp.dismissal = { from: TeamPrincipal.teamName(team), to: TeamPrincipal.teamName(newTeam), season: season, seen: false };
        tp.teamUid = newTeam.teamUid;
        tp.satisfaction = cfg().start;
        tp.sat.live = cfg().start;
        const dev = tp.dev;
        if (dev) {
            dev.spent = 0;
            dev.projects = { SPD: null, FS: null, SS: null, FB: null };
            dev.last = {};
            dev.pending = [];
        }
    }

    // ---- reading the game state ----

    function readJson(key, fallback) {
        try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v === null ? fallback : v; } catch (e) { return fallback; }
    }

    // Constructors' position of `team` in the championship so far (1-based), null before the first race.
    function constructorPosition(teams, team) {
        const races = readJson('championshipRaces', []);
        const results = readJson('championshipResults', []);
        if (!results.some(r => Array.isArray(r) && r.length > 0)) return null;
        const CC = ChampionshipCommon;
        const clean = CC.sanitizePairs(races, results);
        const standings = CC.computeStandings(clean.races, clean.results, CC.normalizePoints(readJson('championshipPoints', null)), {
            fastestLapPoint: localStorage.getItem('championshipFastestLapPoint') === 'true',
            fastestLapTopN: parseInt(localStorage.getItem('championshipFastestLapTopN') || '10', 10),
            polePositionPoints: parseInt(localStorage.getItem('championshipPolePositionPoints') || '0', 10)
        });
        const idx = standings.constructorStandings.findIndex(r => r.team === TeamPrincipal.teamName(team));
        return idx >= 0 ? idx + 1 : teams.length;
    }

    // What the player is measured against: { objective: expected rank, position (null before the first race), teamCount }.
    function standing(tp, teams, team) {
        const sat = tp.sat && tp.sat.expected ? tp.sat : null;
        const expected = sat ? sat.expected : expectedRanks(teams);
        return { objective: expected[team.teamUid] || teams.length, position: constructorPosition(teams, team), teamCount: teams.length };
    }

    // Updates the satisfaction from the championship so far, and dismisses the player when it falls
    // under the threshold after half of the season. Returns { changed, dismissed }.
    // Meant to be called every time the GP screen opens: it only works when a new race was recorded.
    function check() {
        const none = { changed: false, dismissed: false };
        if (!TeamPrincipal.isActive() || localStorage.getItem('championshipActive') !== 'true') return none;
        const slot = TeamPrincipal.readCurrentSlot();
        const tp = slot && slot.data && slot.data.mode === TeamPrincipal.MODE && slot.data.teamPrincipal;
        const teams = readJson('teams', []);
        if (!tp || !teams.length) return none;

        const races = readJson('championshipRaces', []);
        const results = readJson('championshipResults', []);
        const season = parseInt(localStorage.getItem('careerSeasonNumber') || '1', 10);
        const hadState = !!(tp.sat && tp.sat.season === season);
        const sat = ensureSeason(tp, teams, season);
        const played = results.filter(r => Array.isArray(r) && r.length > 0).length;
        if (played === 0 || played === sat.processed) {
            if (!hadState) TeamPrincipal.writeCurrentSlot(slot);
            return none;
        }

        const team = teams.find(t => t.teamUid === tp.teamUid);
        if (!team) return none;
        const teamCount = teams.length;
        const actual = constructorPosition(teams, team) || teamCount;
        const expected = sat.expected[tp.teamUid] || teamCount;

        sat.processed = played;
        sat.live = satisfactionOf(tp.satisfaction, expected, actual, teamCount);

        // Half of the season over? (a sprint and its GP are one weekend)
        const weekends = races.filter(r => !r.isSprintRace).length;
        const done = races.filter((r, i) => !r.isSprintRace && Array.isArray(results[i]) && results[i].length > 0).length;
        let dismissed = false;
        if (season > cfg().protectedSeasons && weekends > 0 && done >= weekends * cfg().checkFromSeasonFraction && sat.live < cfg().dismissBelow) {
            const newTeam = worstTeam(teams, tp.teamUid);
            if (newTeam) { dismiss(tp, team, newTeam, season); dismissed = true; }
        }
        TeamPrincipal.writeCurrentSlot(slot);
        return { changed: true, dismissed: dismissed };
    }

    // End of the season, on the slot: the season's value becomes the one carried to the next.
    function closeSeason(tp) {
        if (tp.sat && tp.sat.live !== null && tp.sat.live !== undefined) tp.satisfaction = tp.sat.live;
        tp.sat = null;
    }

    return { constructorPosition, standing, ranksAscending, expectedRanks, rawSatisfaction, resultBonus, satisfactionOf, ensureSeason, current, worstTeam,
             dismiss, check, closeSeason };
})();
