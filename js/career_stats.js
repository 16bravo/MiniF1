// ============================================================
// CAREER_STATS.JS
// "History Stats" tab (God Mode only) - an all-time leaderboard that starts
// from the real-world historical baseline (data/historical_stats.json,
// generated from data/source/stats.xlsx) and adds every stat accumulated
// across the active career's played seasons (closed-out seasonHistory +
// the season currently in progress) on top, so a career driver/team can
// climb the all-time list over a long God Mode career.
// ============================================================

let __careerHistoricalStats = null; // cached fetch of data/historical_stats.json

function fetchHistoricalStats() {
    if (__careerHistoricalStats) return Promise.resolve(__careerHistoricalStats);
    return fetch('data/historical_stats.json')
        .then(r => r.json())
        .then(data => { __careerHistoricalStats = data; return data; })
        .catch(() => ({ drivers: {}, teams: {} }));
}

// Every season the active career has played: closed-out seasons archived in
// the save slot (compact {driverStats, teamStats, championDriverName,
// championTeamName} summaries - see ChampionshipCommon.summarizeSeasonArchive
// - or, for a save not yet migrated, the old raw {races, results} shape),
// plus whatever races/results the current season already has.
function gatherCareerSeasons() {
    const seasons = [];
    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');

    if (slotNumber >= 1 && slotNumber <= 3) {
        try {
            const slot = JSON.parse(localStorage.getItem(`careerSlot${slotNumber}`) || 'null');
            if (slot && slot.data && Array.isArray(slot.data.seasonHistory)) {
                slot.data.seasonHistory.forEach(s => seasons.push(s));
            }
        } catch (e) { /* ignore */ }
    }

    try {
        const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        const results = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        const points = JSON.parse(localStorage.getItem('championshipPoints') || 'null');
        const opts = {
            fastestLapPoint: localStorage.getItem('championshipFastestLapPoint') === 'true',
            fastestLapTopN: parseInt(localStorage.getItem('championshipFastestLapTopN') || '10'),
            polePositionPoints: parseInt(localStorage.getItem('championshipPolePositionPoints') || '0')
        };
        // season number needed to place this season on the History Stats
        // year-by-year timeline (see sumCareerSeasons's driverHistories/teamHistories).
        const season = parseInt(localStorage.getItem('careerSeasonNumber') || '1', 10);
        if (Array.isArray(races) && races.length) {
            seasons.push({ races, results, points, opts, season });
        }
    } catch (e) { /* ignore */ }

    return seasons;
}

const minDefined = (cur, val) => (val == null ? cur : (cur == null ? val : Math.min(cur, val)));

// Sum every completed/in-progress season's driver+team counters (keyed by
// display name, matching the historical JSON's key), and separately tally
// titles. A season already carries its own driverStats/teamStats (archived,
// compact) or needs computing fresh from races/results (the live season, or
// an old save not yet migrated) - a season only counts a title once every one
// of its races has a result.
function sumCareerSeasons(seasons) {
    const driverTotals = {};
    const teamTotals = {};
    const driverTitles = {};
    const teamTitles = {};
    const driverHistories = {}; // name -> { year: position }
    const teamHistories = {};   // team -> { year: position }
    const startYear = parseInt(localStorage.getItem('careerStartYear') || '0', 10) || 2026;
    const yearFor = seasonNumber => startYear + (seasonNumber || 1) - 1;

    const addDriver = d => {
        const t = driverTotals[d.name] || (driverTotals[d.name] = {
            name: d.name, team: d.team, flag: null,
            wins: 0, poles: 0, podiums: 0, points: 0, fastestLaps: 0, hattricks: 0, gps: 0,
            bestGrid: null, bestFinish: null
        });
        t.team = d.team; // keep the most recently seen team
        // Keep the most recently seen flag too - if this driver later leaves
        // the roster and has no historical-baseline match, this is the only
        // place their flag survives (see buildLeaderboard).
        if (d.flag) t.flag = d.flag;
        t.wins += d.wins || 0; t.poles += d.poles || 0; t.podiums += d.podiums || 0;
        t.points += d.points || 0; t.fastestLaps += d.fastestLaps || 0;
        t.hattricks += (d.hatTricks != null ? d.hatTricks : d.hattricks) || 0;
        // gpWeekends = distinct Grands Prix (a sprint weekend is one GP, not
        // two) - matches how the historical baseline counts GPs. Older
        // archived seasons saved before this existed fall back to `entered`
        // (computeStats' session-based count, one race further inflated per
        // sprint weekend) since their raw races/results are already gone.
        t.gps += d.gpWeekends != null ? d.gpWeekends : (d.entered != null ? d.entered : (d.gps || 0));
        t.bestGrid = minDefined(t.bestGrid, d.bestGrid);
        t.bestFinish = minDefined(t.bestFinish, d.bestFinish);
    };
    const addTeam = tm => {
        const t = teamTotals[tm.team] || (teamTotals[tm.team] = {
            team: tm.team, flag: null, wins: 0, poles: 0, podiums: 0, points: 0, fastestLaps: 0, gps: 0
        });
        if (tm.flag) t.flag = tm.flag;
        t.wins += tm.wins || 0; t.poles += tm.poles || 0; t.podiums += tm.podiums || 0;
        t.points += tm.points || 0; t.fastestLaps += tm.fastestLaps || 0;
        t.gps += tm.gpWeekends != null ? tm.gpWeekends : (tm.entered != null ? tm.entered : (tm.gps || 0));
    };

    seasons.forEach(season => {
        if (Array.isArray(season.driverStats)) {
            // Already-archived compact summary - it already carries each
            // driver's/team's final position for that season (see
            // ChampionshipCommon.summarizeSeasonArchive).
            const year = yearFor(season.season);
            season.driverStats.forEach(d => {
                addDriver(d);
                if (d.position != null) (driverHistories[d.name] = driverHistories[d.name] || {})[year] = d.position;
            });
            (season.teamStats || []).forEach(t => {
                addTeam(t);
                if (t.position != null) (teamHistories[t.team] = teamHistories[t.team] || {})[year] = t.position;
            });
            if (season.championDriverName) driverTitles[season.championDriverName] = (driverTitles[season.championDriverName] || 0) + 1;
            if (season.championTeamName) teamTitles[season.championTeamName] = (teamTitles[season.championTeamName] || 0) + 1;
            return;
        }

        // Live in-progress season (or an old save's un-migrated season): compute now.
        const clean = ChampionshipCommon.sanitizePairs(season.races, season.results);
        if (!clean.races.length) return;
        const stats = ChampionshipCommon.computeStats(clean.races, clean.results, season.points);
        const gpWeekends = ChampionshipCommon.countGpWeekends(clean.races, clean.results);
        const flags = ChampionshipCommon.extractFlags(clean.races, clean.results);
        stats.driverStats.forEach(d => addDriver(Object.assign({ gpWeekends: gpWeekends.driverGps[d.name] || 0, flag: flags.driverFlags[d.name] || null }, d)));
        stats.teamStats.forEach(t => addTeam(Object.assign({ gpWeekends: gpWeekends.teamGps[t.team] || 0, flag: flags.teamFlags[t.team] || null }, t)));

        const seasonComplete = season.races.length > 0 &&
            season.results.length === season.races.length &&
            season.results.every(r => Array.isArray(r));
        if (seasonComplete) {
            const standings = ChampionshipCommon.computeStandings(clean.races, clean.results, season.points, season.opts || {});
            const ds = standings.driverStandings, cs = standings.constructorStandings;
            if (ds && ds[0]) driverTitles[ds[0].name] = (driverTitles[ds[0].name] || 0) + 1;
            if (cs && cs[0]) teamTitles[cs[0].team] = (teamTitles[cs[0].team] || 0) + 1;
            // A season only has a "final classification" once it's over -
            // matches the title tally just above.
            const year = yearFor(season.season);
            ds.forEach((row, i) => { (driverHistories[row.name] = driverHistories[row.name] || {})[year] = i + 1; });
            cs.forEach((row, i) => { (teamHistories[row.team] = teamHistories[row.team] || {})[year] = i + 1; });
        }
    });

    return { driverTotals, teamTotals, driverTitles, teamTitles, driverHistories, teamHistories };
}

// Merge the historical baseline with the career's summed contributions into
// one row per name (union of both sides), then sort into a leaderboard.
function buildLeaderboard(historical, totals, titles, liveFlags, isDriver, histories) {
    const rows = {};

    Object.keys(historical).forEach(name => {
        const h = historical[name];
        rows[name] = {
            name, flag: h.flag,
            titles: h.titles || 0, wins: h.wins || 0, poles: h.poles || 0, podiums: h.podiums || 0,
            points: h.points || 0, gps: h.gps || 0, fastestLaps: h.fastestLaps || 0,
            hattricks: isDriver ? (h.hattricks || 0) : null,
            bestQualif: isDriver ? (h.bestQualif != null ? h.bestQualif : null) : null,
            bestRace: isDriver ? (h.bestRace != null ? h.bestRace : null) : null,
            // Real years (1950-2025ish) plus this career's own completed
            // seasons on top - see openHistoryDetailModal for how it's shown.
            history: Object.assign({}, h.history || {}, histories[name] || {})
        };
    });

    Object.values(totals).forEach(t => {
        const name = t.name || t.team;
        if (!rows[name]) {
            rows[name] = {
                name, flag: t.flag || null, titles: 0, wins: 0, poles: 0, podiums: 0, points: 0, gps: 0, fastestLaps: 0,
                hattricks: isDriver ? 0 : null, bestQualif: isDriver ? null : null, bestRace: isDriver ? null : null,
                history: histories[name] || {}
            };
        } else if (!rows[name].flag && t.flag) {
            // No historical flag (e.g. a name collision with a fictional
            // driver) - fall back to the last one seen in the simulated races.
            rows[name].flag = t.flag;
        }
        const row = rows[name];
        row.wins += t.wins; row.poles += t.poles; row.podiums += t.podiums;
        row.points += t.points; row.gps += t.gps; row.fastestLaps += t.fastestLaps;
        if (isDriver) {
            row.hattricks = (row.hattricks || 0) + t.hattricks;
            row.bestQualif = minDefined(row.bestQualif, t.bestGrid);
            row.bestRace = minDefined(row.bestRace, t.bestFinish);
        }
    });

    Object.keys(titles).forEach(name => {
        if (!rows[name]) rows[name] = { name, flag: null, titles: 0, wins: 0, poles: 0, podiums: 0, points: 0, gps: 0, fastestLaps: 0, hattricks: isDriver ? 0 : null, bestQualif: null, bestRace: null, history: histories[name] || {} };
        rows[name].titles += titles[name];
    });

    Object.keys(liveFlags).forEach(name => {
        if (rows[name]) { rows[name].flag = liveFlags[name]; rows[name].active = true; }
    });

    return Object.values(rows).sort((a, b) => b.wins - a.wins || b.points - a.points);
}

function flagImg(flagRaw) {
    if (!flagRaw) return '';
    const name = String(flagRaw).replace(/^img\/flags\//, '').replace(/\.png$/, '');
    return `<img class="standings-flag" src="img/flags/${name}.png" alt="">`;
}

function nameWithFlag(flagRaw, label, active) {
    const text = ChampionshipCommon.escapeHtml(label);
    return `<span class="standings-name-cell">${flagImg(flagRaw)}${active ? `<strong>${text}</strong>` : text}</span>`;
}

// Column definitions drive both the header row and each cell - `dir` is the
// sort direction applied the first time a column is clicked (lower-is-better
// records default to ascending, every count/points column defaults to descending).
const DRIVER_COLUMNS = [
    { key: 'name', label: 'Driver', dir: 'asc' },
    { key: 'titles', label: 'Titles', dir: 'desc' },
    { key: 'wins', label: 'Wins', dir: 'desc' },
    { key: 'poles', label: 'Poles', dir: 'desc' },
    { key: 'podiums', label: 'Podiums', dir: 'desc' },
    { key: 'points', label: 'Points', dir: 'desc' },
    { key: 'gps', label: 'GPs', dir: 'desc' },
    { key: 'fastestLaps', label: 'Fastest Laps', dir: 'desc' },
    { key: 'hattricks', label: 'Hat-tricks', dir: 'desc' },
    { key: 'bestQualif', label: 'Best Qualif', dir: 'asc' },
    { key: 'bestRace', label: 'Best Race', dir: 'asc' }
];
const TEAM_COLUMNS = [
    { key: 'name', label: 'Constructor', dir: 'asc' },
    { key: 'titles', label: 'Titles', dir: 'desc' },
    { key: 'wins', label: 'Wins', dir: 'desc' },
    { key: 'poles', label: 'Poles', dir: 'desc' },
    { key: 'podiums', label: 'Podiums', dir: 'desc' },
    { key: 'points', label: 'Points', dir: 'desc' },
    { key: 'gps', label: 'GPs', dir: 'desc' },
    { key: 'fastestLaps', label: 'Fastest Laps', dir: 'desc' }
];

function compareRows(a, b, key, dir) {
    if (key === 'name') {
        return dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    const av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;  // "no record" always sinks to the bottom
    if (bv == null) return -1;
    return dir === 'asc' ? av - bv : bv - av;
}

function sortRows(rows, key, dir) {
    return rows.slice().sort((a, b) => compareRows(a, b, key, dir) || b.wins - a.wins);
}

function formatCell(row, key) {
    if (key === 'points') {
        const p = row.points;
        return Number(p.toFixed ? p.toFixed(1).replace(/\.0$/, '') : p);
    }
    if (key === 'bestQualif' || key === 'bestRace') return row[key] != null ? row[key] : '-';
    return row[key];
}

function buildCareerTable(rows, columns, sort) {
    const head = columns.map(col => {
        const active = sort.key === col.key;
        const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
        return `<th class="career-sortable${active ? ' active' : ''}" data-key="${col.key}">${col.label}${arrow}</th>`;
    }).join('');

    const body = rows.map((r, i) => `
        <tr${r.active ? ' class="career-active-row"' : ''}>
            <td>${i + 1}</td>
            <td><button type="button" class="career-name-link" data-idx="${i}">${nameWithFlag(r.flag, r.name, r.active)}</button></td>
            ${columns.slice(1).map(col => `<td>${formatCell(r, col.key)}</td>`).join('')}
        </tr>`).join('');

    return `
        <div class="champ-stats-scroll">
            <table class="career-stats-table">
                <thead><tr><th>#</th>${head}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;
}

// Honours by season: for every year, the top 3 drivers and constructors of the final classification,
// the champion (1st column) followed by the number of titles he had won by that season included
// (from the same rows as the leaderboards, so real history and this career's own seasons are merged).
// Latest season first.
function buildPalmares(driverRows, teamRows) {
    const byYear = {};
    const collect = (rows, kind) => rows.forEach(r => {
        Object.keys(r.history || {}).forEach(year => {
            const pos = r.history[year];
            if (pos === 1 || pos === 2 || pos === 3) {
                const y = byYear[year] || (byYear[year] = { drivers: [], teams: [] });
                y[kind][pos - 1] = r;
            }
        });
    });
    collect(driverRows, 'drivers');
    collect(teamRows, 'teams');

    const titlesUpTo = (r, year) => Object.keys(r.history || {}).filter(y => +y <= +year && r.history[y] === 1).length;
    const cell = (r, year, champion) => r
        ? nameWithFlag(r.flag, r.name, r.active) + (champion ? ` <span class="palmares-titles">(${titlesUpTo(r, year)})</span>` : '')
        : '<span class="palmares-none">-</span>';
    const group = (list, year) => [0, 1, 2].map(i => `<td>${cell(list[i], year, i === 0)}</td>`).join('');

    const years = Object.keys(byYear).sort((a, b) => b - a);
    const body = years.map(y => `
        <tr><td class="palmares-year">${y}</td>${group(byYear[y].drivers, y)}${group(byYear[y].teams, y)}</tr>`).join('');

    return `
        <div class="champ-stats-scroll">
            <table class="career-palmares-table">
                <thead>
                    <tr><th rowspan="2">Season</th><th colspan="3">Drivers</th><th colspan="3">Constructors</th></tr>
                    <tr><th>1st</th><th>2nd</th><th>3rd</th><th>1st</th><th>2nd</th><th>3rd</th></tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;
}

let __careerStatsView = 'drivers'; // remembered across tab re-activations
let __careerActiveOnly = false;
const __careerSort = {
    drivers: { key: 'wins', dir: 'desc' },
    constructors: { key: 'wins', dir: 'desc' }
};

function renderCareerStats() {
    const container = document.getElementById('tab-career-stats');
    if (!container) return;
    container.innerHTML = '<div class="champ-sub">Loading…</div>';

    fetchHistoricalStats().then(historical => {
        const seasons = gatherCareerSeasons();
        const { driverTotals, teamTotals, driverTitles, teamTitles, driverHistories, teamHistories } = sumCareerSeasons(seasons);

        let liveDriverFlags = {}, liveTeamFlags = {};
        try {
            (JSON.parse(localStorage.getItem('drivers') || '[]') || []).forEach(d => { if (d.name && d.flag) liveDriverFlags[d.name] = d.flag; });
            // The raw 'teams' array uses 'team' in data/team_default.json but gets
            // normalized to 'name' once saved through the Team Edit tab (see
            // updateDriverTeamOptions() in index.js / makeTeamRow's same fallback) -
            // accept either, or every edited/added team's flag lookup silently fails.
            (JSON.parse(localStorage.getItem('teams') || '[]') || []).forEach(t => {
                const teamName = t.team || t.name;
                if (teamName && t.flag) liveTeamFlags[teamName] = t.flag;
            });
        } catch (e) { /* ignore */ }

        const driverRows = buildLeaderboard(historical.drivers || {}, driverTotals, driverTitles, liveDriverFlags, true, driverHistories);
        const teamRows = buildLeaderboard(historical.teams || {}, teamTotals, teamTitles, liveTeamFlags, false, teamHistories);

        const renderView = () => {
            const isSeasonView = __careerStatsView === 'seasons';
            const isDriverView = __careerStatsView !== 'constructors';
            const columns = isDriverView ? DRIVER_COLUMNS : TEAM_COLUMNS;
            const sort = __careerSort[isSeasonView ? 'drivers' : __careerStatsView];
            let sortedRows = sortRows(isDriverView ? driverRows : teamRows, sort.key, sort.dir);
            if (__careerActiveOnly) sortedRows = sortedRows.filter(r => r.active);

            container.innerHTML = `
                <div class="champ-chart-controls">
                    <label><input type="radio" name="careerStatsView" value="drivers" ${isDriverView ? 'checked' : ''}> Drivers</label>
                    <label><input type="radio" name="careerStatsView" value="constructors" ${__careerStatsView === 'constructors' ? 'checked' : ''}> Constructors</label>
                    <label><input type="radio" name="careerStatsView" value="seasons" ${isSeasonView ? 'checked' : ''}> Seasons</label>
                    ${isSeasonView ? '' : `<label><input type="checkbox" id="careerActiveOnly" ${__careerActiveOnly ? 'checked' : ''}> Active only</label>`}
                </div>
                <h3 class="champ-sub">${isSeasonView ? 'Honours by season' : (isDriverView ? 'Drivers' : 'Constructors')}</h3>
                ${isSeasonView ? buildPalmares(driverRows, teamRows)
                    : sortedRows.length ? buildCareerTable(sortedRows, columns, sort) : '<div class="champ-sub">No active drivers/teams with recorded stats yet.</div>'}`;

            container.querySelectorAll('input[name="careerStatsView"]').forEach(el => {
                el.addEventListener('change', () => { __careerStatsView = el.value; renderView(); });
            });
            const activeOnly = container.querySelector('#careerActiveOnly');
            if (activeOnly) activeOnly.addEventListener('change', e => {
                __careerActiveOnly = e.target.checked;
                renderView();
            });
            container.querySelectorAll('.career-sortable').forEach(th => {
                th.addEventListener('click', () => {
                    const key = th.dataset.key;
                    const col = columns.find(c => c.key === key);
                    if (sort.key === key) {
                        sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sort.key = key;
                        sort.dir = col ? col.dir : 'desc';
                    }
                    renderView();
                });
            });
            container.querySelectorAll('.career-name-link').forEach(btn => {
                btn.addEventListener('click', () => openHistoryDetailModal(sortedRows[parseInt(btn.dataset.idx, 10)], columns));
            });
        };
        renderView();
    });
}

// ============================================================
// Per-driver/team detail popup: full stat breakdown + a year-by-year
// timeline (real-world history from data/historical_stats.json, continuing
// into this career's own completed seasons - see row.history, built in
// buildLeaderboard).
// ============================================================

function tierColor(position) {
    if (typeof position !== 'number') return { bg: '#3a2222', fg: '#e08a8a' }; // DSQ / NC
    if (position === 1) return { bg: '#f5d016', fg: '#111' };
    if (position === 2) return { bg: '#c8c8c8', fg: '#111' };
    if (position === 3) return { bg: '#cd7f32', fg: '#111' };
    if (position <= 10) return { bg: '#3d7fc9', fg: '#fff' };
    return { bg: '#555', fg: '#ddd' };
}

function closeHistoryDetailModal() {
    const modal = document.getElementById('history-detail-modal');
    if (modal) modal.classList.remove('active');
}

function createHistoryDetailModal() {
    const modal = document.createElement('div');
    modal.id = 'history-detail-modal';
    modal.className = 'history-modal';
    modal.innerHTML = `
        <div class="history-modal-content">
            <button type="button" class="history-modal-close" aria-label="Close">&times;</button>
            <div class="history-modal-header"></div>
            <div class="history-modal-stats"></div>
            <div class="history-modal-timeline-wrap">
                <div class="history-modal-timeline"></div>
            </div>
        </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => { if (e.target === modal) closeHistoryDetailModal(); });
    modal.querySelector('.history-modal-close').addEventListener('click', closeHistoryDetailModal);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeHistoryDetailModal();
    });

    return modal;
}

function openHistoryDetailModal(row, columns) {
    if (!row) return;
    const modal = document.getElementById('history-detail-modal') || createHistoryDetailModal();

    modal.querySelector('.history-modal-header').innerHTML =
        `${flagImg(row.flag)}<h3>${ChampionshipCommon.escapeHtml(row.name)}</h3>`;

    const statCols = columns.filter(c => c.key !== 'name');
    modal.querySelector('.history-modal-stats').innerHTML = statCols.map(c => `
        <div class="history-modal-stat">
            <span class="history-modal-stat-value">${formatCell(row, c.key)}</span>
            <span class="history-modal-stat-label">${c.label}</span>
        </div>`).join('');

    const years = Object.keys(row.history || {}).sort((a, b) => Number(a) - Number(b));
    modal.querySelector('.history-modal-timeline').innerHTML = years.length
        ? years.map(y => {
            const pos = row.history[y];
            const tier = tierColor(pos);
            return `
                <div class="history-year-col">
                    <div class="history-year-label">${y}</div>
                    <div class="history-year-pill" style="background:${tier.bg};color:${tier.fg}">${pos}</div>
                </div>`;
        }).join('')
        : '<div class="champ-sub">No season history recorded.</div>';

    modal.classList.add('active');
}
