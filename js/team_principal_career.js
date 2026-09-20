// ============================================================
// TEAM_PRINCIPAL_CAREER.JS
// The manager's career record: one small entry per finished season (the team managed, the result,
// the drivers' points), kept in slot.data.teamPrincipal.career. Nothing else is stored: every total
// shown in the "My Career" tab (titles, wins, best driver, teams managed...) is computed from these
// entries, so the save stays light (~250 bytes per season, against the ~3 kB of a season archive).
//
//   career.seasons = [ { season, year, team, rank, teams, expected, points, wins, podiums, poles,
//                        fastestLaps, drivers: [{ name, points, wins }], dismissedFrom? } ]
// Pure logic, no DOM. Requires nothing but the season summary of championship_common.js.
// ============================================================

const TeamPrincipalCareer = (function () {
    const round1 = x => Math.round(x * 10) / 10;

    // The entry of a finished season for the managed team.
    //   row: { name, rank, expected } of the team in the season-end table; summary: the season's archive
    //   summary (driverStats / teamStats, see ChampionshipCommon.summarizeSeasonArchive).
    function buildRecord(season, year, row, teamCount, summary, dismissal) {
        const ts = ((summary && summary.teamStats) || []).find(t => t.team === row.name) || {};
        const drivers = ((summary && summary.driverStats) || [])
            .filter(d => d.team === row.name && ((d.points || 0) > 0 || (d.gpWeekends || 0) > 0))
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .map(d => ({ name: d.name, points: round1(d.points || 0), wins: d.wins || 0 }));
        const record = {
            season: season, year: year, team: row.name, rank: row.rank, teams: teamCount, expected: row.expected || null,
            points: round1(ts.points || 0), wins: ts.wins || 0, podiums: ts.podiums || 0, poles: ts.poles || 0,
            fastestLaps: ts.fastestLaps || 0, drivers: drivers
        };
        // Dismissed during this season: the record is for the team taken over, this is where he came from.
        if (dismissal && dismissal.season === season && dismissal.from && dismissal.from !== row.name) {
            record.dismissedFrom = dismissal.from;
        }
        return record;
    }

    // Adds (or replaces, if the season is already there) an entry.
    function add(tp, record) {
        if (!tp.career) tp.career = { seasons: [] };
        const list = tp.career.seasons;
        const i = list.findIndex(r => r.season === record.season);
        if (i >= 0) list[i] = record; else list.push(record);
        list.sort((a, b) => a.season - b.season);
    }

    // Everything the career tab shows, from the entries.
    function totals(career) {
        const seasons = (career && career.seasons) || [];
        const t = { seasons: seasons.length, titles: 0, top3: 0, wins: 0, poles: 0, fastestLaps: 0, points: 0,
                    best: null, objectivesMet: 0, dismissals: 0, teams: [], drivers: [] };
        const teams = {}, drivers = {};
        seasons.forEach(s => {
            if (s.rank === 1) t.titles += 1;
            if (s.rank <= 3) t.top3 += 1;
            t.wins += s.wins || 0; t.poles += s.poles || 0; t.fastestLaps += s.fastestLaps || 0; t.points += s.points || 0;
            if (!t.best || s.rank < t.best.rank) t.best = { rank: s.rank, year: s.year, team: s.team };
            if (s.expected && s.rank <= s.expected) t.objectivesMet += 1;
            if (s.dismissedFrom) t.dismissals += 1;
            const tm = teams[s.team] || (teams[s.team] = { team: s.team, seasons: 0, titles: 0, wins: 0, points: 0, from: s.year, to: s.year });
            tm.seasons += 1; tm.wins += s.wins || 0; tm.points += s.points || 0; tm.to = s.year;
            if (s.rank === 1) tm.titles += 1;
            (s.drivers || []).forEach(d => {
                const dr = drivers[d.name] || (drivers[d.name] = { name: d.name, points: 0, wins: 0, seasons: 0 });
                dr.points += d.points || 0; dr.wins += d.wins || 0; dr.seasons += 1;
            });
        });
        t.points = round1(t.points);
        t.teams = Object.values(teams).sort((a, b) => a.from - b.from);
        t.drivers = Object.values(drivers).map(d => Object.assign(d, { points: round1(d.points) })).sort((a, b) => b.points - a.points);
        return t;
    }

    return { buildRecord, add, totals };
})();
