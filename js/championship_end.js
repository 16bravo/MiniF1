// ============================================================
// CHAMPIONSHIP_END.JS
// End-of-championship recap screen:
//  - final driver & constructor standings (FIA countback tie-break)
//  - champion cards
//  - downloadable season summary image (PNG)
//  - full championship data export (JSON) — readable later in championship_viewer.html
//  - "finish & delete save" action
//
// Shared standings / table / recap-image logic lives in championship_common.js
// ============================================================

const CC = ChampionshipCommon;

// Session keys wiped when the championship save is deleted
const CHAMPIONSHIP_SESSION_KEYS = [
    'championshipActive', 'championshipRaces', 'championshipCurrentRace', 'championshipResults',
    'championshipSpecialMode', 'championshipPoints', 'championshipPointsSprint', 'championshipSlotNumber',
    'drivers', 'teams', 'featureGrid', 'sprintGrid', 'lastSprintResults',
    'selectedCircuit', 'selectedDrivers', 'weatherQuali', 'weatherRace', 'startingGrid', 'isSprint',
    'careerMode', 'careerType', 'careerSeasonNumber', 'careerStartYear'
];

// Career (God Mode) saves live in a separate careerSlot{N} key space from regular
// one-shot championshipSlot{N} saves - this page has no ?mode= URL param (unlike
// championship_save_select.html), so the live session's careerMode flag decides.
function careerSlotPrefix() {
    return localStorage.getItem('careerMode') === 'true' ? 'careerSlot' : 'championshipSlot';
}

// Mirrors championship_save_select.js's constant/helper of the same name -
// this page doesn't load that script, so it's kept in sync here (see there
// for the "bump for a future update" note).
const DEFAULT_CAREER_START_YEAR = 2026;
function careerYearFor(startYear, season) {
    return (startYear || DEFAULT_CAREER_START_YEAR) + ((season || 1) - 1);
}

let state = {
    races: [],
    results: [],
    points: [...CC.DEFAULT_POINTS],
    opts: { fastestLapPoint: false, fastestLapTopN: 10, polePositionPoints: 0 },
    driverStandings: [],
    constructorStandings: [],
    slotName: 'Championship'
};

document.addEventListener('DOMContentLoaded', () => {
    // Team Principal: have the engineer database ready for startNextSeason().
    if (TeamPrincipal.isActive()) { TeamPrincipalEngineers.load(); TeamPrincipalSeasonEnd.load(); }
    loadData();

    const standings = CC.computeStandings(state.races, state.results, state.points, state.opts);
    state.driverStandings = standings.driverStandings;
    state.constructorStandings = standings.constructorStandings;

    renderChampions();
    renderStandings();
    renderStats();
    setupTabs();
    setupProgression();
    setupButtons();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(drawRecapImage);
    } else {
        drawRecapImage();
    }
});

// ------------------------------------------------------------
// Data loading from localStorage
// ------------------------------------------------------------
function loadData() {
    let races, results;
    try {
        races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        results = JSON.parse(localStorage.getItem('championshipResults') || '[]');
    } catch (e) {
        races = [];
        results = [];
    }
    const clean = CC.sanitizePairs(races, results);
    state.races = clean.races;
    state.results = clean.results;

    try {
        const saved = JSON.parse(localStorage.getItem('championshipPoints') || 'null');
        state.points = CC.normalizePoints(saved);
    } catch (e) {
        state.points = [...CC.DEFAULT_POINTS];
    }

    state.opts = {
        fastestLapPoint: localStorage.getItem('championshipFastestLapPoint') === 'true',
        fastestLapTopN: parseInt(localStorage.getItem('championshipFastestLapTopN') || '10'),
        polePositionPoints: parseInt(localStorage.getItem('championshipPolePositionPoints') || '0')
    };

    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');
    if (slotNumber >= 1 && slotNumber <= 3) {
        try {
            const slot = JSON.parse(localStorage.getItem(`${careerSlotPrefix()}${slotNumber}`) || 'null');
            if (slot && slot.name) state.slotName = slot.name;
        } catch (e) { /* ignore */ }
    }
}

// ------------------------------------------------------------
// Champion cards
// ------------------------------------------------------------
function renderChampions() {
    const container = document.getElementById('champions');
    const champDriver = state.driverStandings[0];
    const champTeam = state.constructorStandings[0];

    if (!champDriver && !champTeam) {
        container.innerHTML = `<div class="champion-card"><div class="champion-sub">No race results were recorded for this championship.</div></div>`;
        return;
    }

    let html = '';
    if (champDriver) {
        html += `
            <div class="champion-card">
                <div class="champion-label">World Drivers' Champion</div>
                <div class="champion-name">
                    <span class="champion-swatch" style="background:${CC.escapeHtml(champDriver.color)}"></span>
                    ${CC.escapeHtml(champDriver.name)}
                </div>
                <div class="champion-sub">${CC.escapeHtml(champDriver.team)} &middot; ${champDriver.total} pts</div>
            </div>`;
    }
    if (champTeam) {
        html += `
            <div class="champion-card">
                <div class="champion-label">Constructors' Champion</div>
                <div class="champion-name">
                    <span class="champion-swatch" style="background:${CC.escapeHtml(champTeam.color)}"></span>
                    ${CC.escapeHtml(champTeam.team)}
                </div>
                <div class="champion-sub">${champTeam.total} pts &middot; ${state.races.length} race${state.races.length !== 1 ? 's' : ''}</div>
            </div>`;
    }
    container.innerHTML = html;
}

// ------------------------------------------------------------
// Standings tables
// ------------------------------------------------------------
function renderStandings() {
    document.getElementById('tab-drivers').innerHTML =
        CC.buildStandingsTable(state.races, 'Driver', state.driverStandings, r => CC.escapeHtml(r.name));
    document.getElementById('tab-constructors').innerHTML =
        CC.buildStandingsTable(state.races, 'Constructor', state.constructorStandings, r => CC.escapeHtml(r.team));
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('tab-' + this.dataset.tab).classList.add('active');
            if (this.dataset.tab === 'progression') renderProgression();
        });
    });
}

// ------------------------------------------------------------
// Stats + points progression (shared helpers in championship_common.js)
// ------------------------------------------------------------
let progressionChart = null;

function renderStats() {
    const stats = CC.computeStats(state.races, state.results, state.points);
    const note = document.getElementById('statsGridNote');
    const txt = CC.statsNote(stats);
    note.hidden = !txt;
    note.textContent = txt;
    document.getElementById('stats-drivers').innerHTML = CC.buildDriverStatsTable(stats);
    document.getElementById('stats-constructors').innerHTML = CC.buildTeamStatsTable(stats);
}

function renderProgression() {
    const canvas = document.getElementById('progressionCanvas');
    if (!canvas || canvas.offsetParent === null) return; // panel not visible yet
    const modeEl = document.querySelector('input[name="progMode"]:checked');
    const mode = modeEl ? modeEl.value : 'drivers';
    progressionChart = CC.progressionChart(canvas, {
        standings: mode === 'constructors' ? state.constructorStandings : state.driverStandings,
        races: state.races, mode, chart: progressionChart
    });
}

function setupProgression() {
    document.querySelectorAll('input[name="progMode"]').forEach(el => {
        el.addEventListener('change', renderProgression);
    });
}

// ------------------------------------------------------------
// Recap image
// ------------------------------------------------------------
function drawRecapImage() {
    CC.drawRecap(document.getElementById('recapCanvas'), {
        slotName: state.slotName,
        races: state.races,
        driverStandings: state.driverStandings,
        constructorStandings: state.constructorStandings
    });
}

// ------------------------------------------------------------
// Buttons
// ------------------------------------------------------------
function setupButtons() {
    document.getElementById('downloadJsonBtn').addEventListener('click', downloadJson);
    document.getElementById('downloadImgBtn').addEventListener('click', downloadImage);
    document.getElementById('finishBtn').addEventListener('click', finishAndDelete);

    if (localStorage.getItem('careerMode') === 'true') {
        const nextSeasonBtn = document.getElementById('nextSeasonBtn');
        nextSeasonBtn.hidden = false;
        nextSeasonBtn.addEventListener('click', () => startNextSeason());
        document.getElementById('finishBtn').textContent = 'End Career & Delete Save';
    }
}

function downloadJson() {
    const payload = {
        app: 'MiniF1',
        type: 'championship-export',
        exportedAt: new Date().toISOString(),
        name: state.slotName,
        pointsScale: { feature: state.points, sprint: CC.POINTS_SPRINT },
        options: { fastestLapPoint: state.opts.fastestLapPoint, fastestLapTopN: state.opts.fastestLapTopN, polePositionPoints: state.opts.polePositionPoints },
        races: state.races,
        results: state.results,
        standings: {
            drivers: state.driverStandings.map((r, i) => ({
                position: i + 1, code: r.code, name: r.name, team: r.team,
                perRace: r.perRace, total: r.total, wins: r.countback[1] || 0
            })),
            constructors: state.constructorStandings.map((r, i) => ({
                position: i + 1, team: r.team, perRace: r.perRace, total: r.total, wins: r.countback[1] || 0
            }))
        }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    CC.triggerDownload(blob, `minif1_championship_${CC.slugify(state.slotName)}_${CC.dateStamp()}.json`);
}

function downloadImage() {
    document.getElementById('recapCanvas').toBlob(blob => {
        if (!blob) { alert('Could not generate the image.'); return; }
        CC.triggerDownload(blob, `minif1_championship_${CC.slugify(state.slotName)}_${CC.dateStamp()}.png`);
    }, 'image/png');
}

function finishAndDelete() {
    const isCareer = localStorage.getItem('careerMode') === 'true';
    const ok = confirm(
        (isCareer ? 'End this career and delete its save?\n\n' : 'Finish this championship and delete its save?\n\n') +
        'Make sure you have downloaded the data first — this cannot be undone.'
    );
    if (!ok) return;

    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');
    if (slotNumber >= 1 && slotNumber <= 3) {
        localStorage.removeItem(`${careerSlotPrefix()}${slotNumber}`);
    }
    CHAMPIONSHIP_SESSION_KEYS.forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage)
        .filter(k => k.startsWith('championshipGrid_'))
        .forEach(k => localStorage.removeItem(k));

    window.location.href = 'index.html';
}

// Reorders the 'teams' localStorage array to match the just-finished season's
// Constructors' standings (champion first), and updates every driver's
// team_id to follow their (unchanged) team to its new position - team
// identity here is positional (a team's team_id / a driver's team_id is
// always just "1 + that team's index in the teams array" as of the last
// save, see updateDriverTeamOptions()/loadDrivers() in index.js), so the
// only way to keep the right drivers with the right teams across a reorder
// is to remap by each team's OLD index, not by re-deriving anything from
// still-stored id values. Every team property (color, stats, image, flag...)
// travels untouched - only the array position changes. A team with no
// result at all this season (e.g. added but never raced) keeps its prior
// relative order, appended after every ranked team.
function reorderTeamsByStandings(constructorStandings) {
    let teams, drivers;
    try {
        teams = JSON.parse(localStorage.getItem('teams') || '[]');
        drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
    } catch (e) { return; }
    if (!Array.isArray(teams) || !teams.length || !Array.isArray(constructorStandings) || !constructorStandings.length) return;

    const teamName = t => t.team || t.name || '';
    const rankByName = {};
    constructorStandings.forEach((s, i) => { rankByName[s.team] = i; });

    const withOldIndex = teams.map((t, i) => ({ t, i }));
    withOldIndex.sort((a, b) => {
        const ra = rankByName[teamName(a.t)], rb = rankByName[teamName(b.t)];
        if (ra != null && rb != null) return ra - rb;
        if (ra != null) return -1;
        if (rb != null) return 1;
        return a.i - b.i; // both unranked - keep their original relative order
    });

    const oldIdToNewId = {};
    withOldIndex.forEach((entry, newIdx) => { oldIdToNewId[entry.i + 1] = newIdx + 1; });

    const orderedTeams = withOldIndex.map(entry => entry.t);
    // Not load-bearing (position is what everything actually reads), but kept
    // in sync so the stored id field doesn't read as stale/wrong if inspected.
    orderedTeams.forEach((t, idx) => {
        if (t.team_id != null) t.team_id = idx + 1;
        if (t.id != null) t.id = idx + 1;
    });
    if (Array.isArray(drivers)) {
        drivers.forEach(d => {
            const newId = oldIdToNewId[d.team_id];
            if (newId != null) d.team_id = newId;
        });
        drivers.sort((a, b) => (a.team_id || 0) - (b.team_id || 0));
    }

    localStorage.setItem('teams', JSON.stringify(orderedTeams));
    if (Array.isArray(drivers)) localStorage.setItem('drivers', JSON.stringify(drivers));
}

// Archive the just-finished season into the career save's history, then roll the
// session over to a fresh season (same slot, same drivers/teams, new calendar via
// championship_setup.html - teams/drivers are deliberately NOT reset, see
// championship_setup.js's start-championship-btn handler).
function startNextSeason(skipWait) {
    // Team Principal: the season-end data (team families, engineer database) must be loaded first.
    if (!skipWait && TeamPrincipal.isActive() &&
        !(TeamPrincipalSeasonEnd.isLoaded() && TeamPrincipalEngineers.isLoaded())) {
        Promise.all([TeamPrincipalSeasonEnd.load(), TeamPrincipalEngineers.load()])
            .then(() => startNextSeason(true), () => startNextSeason(true));
        return;
    }
    const startYear = parseInt(localStorage.getItem('careerStartYear') || '0', 10);
    const season = parseInt(localStorage.getItem('careerSeasonNumber') || '1');
    const nextYear = careerYearFor(startYear, season + 1);

    // A Team Principal doesn't go through the setup screen: the next season simply starts.
    const ok = confirm(TeamPrincipal.isActive()
        ? `Start the ${nextYear} season?\n\nThis season will be archived in the save. Drivers and teams carry over as they are now.`
        : `Start the ${nextYear} season?\n\n` +
          'This season will be archived in the save, and you\'ll go through setup again ' +
          '(calendar/points) before it begins. Drivers and teams carry over as they are now.'
    );
    if (!ok) return;

    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');
    // Team Principal: the satisfaction of the whole season counts (normally already done when the GP screen opened).
    if (TeamPrincipal.isActive() && typeof TeamPrincipalSatisfaction !== 'undefined') TeamPrincipalSatisfaction.check();
    // Compact archive of the season just played (also feeds the Team Principal season end).
    const summary = CC.summarizeSeasonArchive(state.races, state.results, state.points, state.opts);

    // Team Principal: the grid position is last season's rank, so it is read before the reorder.
    let tpCtx = null;
    if (slotNumber >= 1 && slotNumber <= 3 && TeamPrincipal.isActive() && TeamPrincipalSeasonEnd.isLoaded()) {
        const pre = JSON.parse(localStorage.getItem(`${careerSlotPrefix()}${slotNumber}`) || 'null');
        if (pre && pre.data && pre.data.mode === 'teamPrincipal' && pre.data.teamPrincipal) {
            tpCtx = TeamPrincipalSeasonEnd.prepare(pre, state.constructorStandings, summary, season);
        }
    }

    // Grid order for the new season follows this season's final Constructors'
    // standings (champion first) - same drivers/teams, new positions.
    reorderTeamsByStandings(state.constructorStandings);
    // Team Principal: finance, prestige and confidence of every team, on the reordered list.
    if (tpCtx) TeamPrincipalSeasonEnd.applyGauges(tpCtx);

    // championship_end.html doesn't include championship_save_select.js, so the
    // slot is rewritten directly here rather than through window.autoSaveChampionship.
    if (slotNumber >= 1 && slotNumber <= 3) {
        const key = `${careerSlotPrefix()}${slotNumber}`;
        const slot = JSON.parse(localStorage.getItem(key) || 'null');
        if (slot) {
            // Archive a compact per-season summary, not the full races/results -
            // see CC.summarizeSeasonArchive for why (unbounded growth otherwise).
            slot.data.seasonHistory = slot.data.seasonHistory || [];
            slot.data.seasonHistory.push(Object.assign({ season: season }, summary));
            // Carry the calendar forward as-is (order, added/removed rounds, sprint
            // toggles, display names) - the next season starts from what this one
            // ended up with, still editable on the setup screen, not the raw default.
            slot.data.races = state.races;
            slot.data.results = [];
            slot.data.currentRaceIndex = 0;
            slot.data.season = season + 1;
            // Reflect the just-applied team/driver reorder in the save too, not
            // only live localStorage (which the next autosave would sync anyway,
            // but this way it's correct even if the browser closes before then).
            try { slot.data.teams = JSON.parse(localStorage.getItem('teams') || 'null'); } catch (e) {}
            try { slot.data.drivers = JSON.parse(localStorage.getItem('drivers') || 'null'); } catch (e) {}
            // Team Principal: contracts and retirements, the new market, the AI teams' positions, and
            // the season review shown to the player. (Without the engineer database, the Team
            // Management tab catches the year up on its next visit.)
            if (tpCtx) TeamPrincipalSeasonEnd.finish(slot, tpCtx, nextYear);
            slot.lastSaved = new Date().toLocaleString('fr-FR');
            slot.progress = `${nextYear} — Setup`;
            localStorage.setItem(key, JSON.stringify(slot));
        }
    }

    localStorage.setItem('careerSeasonNumber', String(season + 1));
    localStorage.setItem('championshipRaces', JSON.stringify(state.races));
    localStorage.setItem('championshipCurrentRace', '0');
    localStorage.setItem('championshipResults', JSON.stringify([]));

    window.location.href = 'championship_setup.html';
}
