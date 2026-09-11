// ============================================================
// CHAMPIONSHIP_VIEWER.JS
// Offline reader for championship .json files exported from the
// end-of-season recap screen (championship_end.js).
//
//  - final standings (drivers + constructors, FIA countback)
//  - race-by-race classification
//  - cumulative points progression chart
//  - regenerate / re-download the recap image
//
// Shared logic comes from championship_common.js (ChampionshipCommon).
// ============================================================

const CC = ChampionshipCommon;

let exportData = null;        // parsed export
let races = [];
let results = [];
let featurePoints = [...CC.DEFAULT_POINTS];
let championshipOpts = { fastestLapPoint: false, fastestLapTopN: 0, polePositionPoints: 0 };
let champName = 'Championship';
let driverStandings = [];
let constructorStandings = [];
let progressionChart = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loadBtn').addEventListener('click', handleLoad);
    document.getElementById('fileInput').addEventListener('change', () => {
        // Auto-load when a file is picked
        if (document.getElementById('fileInput').files.length) handleLoad();
    });
    document.getElementById('loadAnotherBtn').addEventListener('click', resetToUpload);
    document.getElementById('downloadImgBtn').addEventListener('click', downloadImage);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
    document.querySelectorAll('input[name="progMode"]').forEach(r => {
        r.addEventListener('change', renderProgression);
    });
});

// ------------------------------------------------------------
// File loading
// ------------------------------------------------------------
function handleLoad() {
    const file = document.getElementById('fileInput').files[0];
    const errEl = document.getElementById('loadError');
    errEl.hidden = true;

    if (!file) {
        showError('Choose a .json file first.');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        let parsed;
        try {
            parsed = JSON.parse(e.target.result);
        } catch (err) {
            showError('This file is not valid JSON.');
            return;
        }

        // Guard: a race replay file, not a championship export
        if (parsed && parsed.gs && parsed.dv && !parsed.races) {
            showError('This looks like a race replay recording — open it in "Replay Race" instead.');
            return;
        }
        if (!parsed || !Array.isArray(parsed.races) || !Array.isArray(parsed.results)) {
            showError('Unrecognised file. Expected a championship export with "races" and "results".');
            return;
        }

        loadChampionship(parsed);
    };
    reader.onerror = () => showError('Could not read the file.');
    reader.readAsText(file);
}

function showError(msg) {
    const errEl = document.getElementById('loadError');
    errEl.textContent = msg;
    errEl.hidden = false;
}

function loadChampionship(parsed) {
    exportData = parsed;

    const clean = CC.sanitizePairs(parsed.races, parsed.results);
    races = clean.races;
    results = clean.results;
    champName = parsed.name || 'Championship';
    featurePoints = CC.normalizePoints(
        parsed.pointsScale && parsed.pointsScale.feature ? parsed.pointsScale.feature : null
    );
    championshipOpts = {
        fastestLapPoint: !!(parsed.options && parsed.options.fastestLapPoint),
        fastestLapTopN: (parsed.options && Number(parsed.options.fastestLapTopN)) || 0,
        polePositionPoints: (parsed.options && Number(parsed.options.polePositionPoints)) || 0
    };

    const standings = CC.computeStandings(races, results, featurePoints, championshipOpts);
    driverStandings = standings.driverStandings;
    constructorStandings = standings.constructorStandings;

    document.getElementById('upload-section').hidden = true;
    document.getElementById('viewer').hidden = false;
    document.getElementById('loadAnotherBtn').hidden = false;
    document.getElementById('downloadImgBtn').hidden = false;

    renderMeta();
    renderStandings();
    populateRaceSelect();
    renderRaceResult();
    renderStats();
    renderProgression();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(drawRecap);
    } else {
        drawRecap();
    }

    activateTab('standings');
}

function resetToUpload() {
    document.getElementById('viewer').hidden = true;
    document.getElementById('upload-section').hidden = false;
    document.getElementById('loadAnotherBtn').hidden = true;
    document.getElementById('downloadImgBtn').hidden = true;
    document.getElementById('fileInput').value = '';
    document.getElementById('loadError').hidden = true;
    if (progressionChart) { progressionChart.destroy(); progressionChart = null; }
}

// ------------------------------------------------------------
// Tabs
// ------------------------------------------------------------
function activateTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
    // Chart.js needs a visible canvas to size correctly
    if (tab === 'progression') renderProgression();
}

// ------------------------------------------------------------
// Meta line
// ------------------------------------------------------------
function renderMeta() {
    const featureCount = races.filter(r => !r.isSprintRace).length;
    const sprintCount = races.length - featureCount;
    const exported = exportData.exportedAt ? new Date(exportData.exportedAt).toLocaleDateString('fr-FR') : null;

    let detail = `${featureCount} Grand Prix`;
    if (sprintCount) detail += ` + ${sprintCount} sprint${sprintCount !== 1 ? 's' : ''}`;
    if (exported) detail += ` &middot; exported ${exported}`;

    document.getElementById('meta').innerHTML =
        `<span class="meta-name">${CC.escapeHtml(champName)}</span>` +
        `<span class="meta-detail">${detail}</span>`;
}

// ------------------------------------------------------------
// Standings
// ------------------------------------------------------------
function renderStandings() {
    document.getElementById('standings-drivers').innerHTML =
        CC.buildStandingsTable(races, 'Driver', driverStandings, r => CC.escapeHtml(r.name));
    document.getElementById('standings-constructors').innerHTML =
        CC.buildStandingsTable(races, 'Constructor', constructorStandings, r => CC.escapeHtml(r.team));
}

// ------------------------------------------------------------
// Race-by-race classification
// ------------------------------------------------------------
function populateRaceSelect() {
    const select = document.getElementById('raceSelect');
    select.innerHTML = '';
    races.forEach((r, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        const label = r.grandPrix || r.circuit || `Race ${i + 1}`;
        opt.textContent = `${i + 1}. ${label}${r.isSprintRace ? '  (Sprint)' : ''}`;
        select.appendChild(opt);
    });
    select.onchange = renderRaceResult;
}

function renderRaceResult() {
    const idx = parseInt(document.getElementById('raceSelect').value || '0');
    const race = races[idx];
    const container = document.getElementById('raceResult');
    if (!race) { container.innerHTML = ''; return; }

    const rows = CC.raceClassification(race, results[idx], featurePoints);
    if (!rows.length) {
        container.innerHTML = `<p style="color:#888;padding:20px;">No classification recorded for this race.</p>`;
        return;
    }

    // Who (if anyone) picked up the fastest-lap bonus in this race
    const flBonusCode = CC.fastestLapWinner(race, results[idx], championshipOpts);

    let html = `<table><thead><tr><th>#</th><th>Driver</th><th>Team</th><th>Status</th><th>Points</th></tr></thead><tbody>`;
    rows.forEach(row => {
        const pts = row.points + (flBonusCode && row.code === flBonusCode ? 1 : 0);
        html += `<tr class="${row.retired ? 'dnf' : ''}">` +
            `<td>${row.retired ? '—' : row.pos}</td>` +
            `<td>${CC.escapeHtml(row.name)}${row.fastestLap ? ' <span class="fl-badge" title="Fastest lap">FL</span>' : ''}</td>` +
            `<td>${CC.escapeHtml(row.team)}</td>` +
            `<td>${row.retired ? 'DNF' : 'Finished'}</td>` +
            `<td${pts === 0 ? ' class="no-points"' : ''}><b>${pts || '-'}</b></td>` +
            `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ------------------------------------------------------------
// Stats (career-style aggregates over the championship) - shared with the
// end-of-season screen and the between-races standings tab (see championship_common.js)
// ------------------------------------------------------------
function renderStats() {
    const stats = CC.computeStats(races, results, featurePoints);
    const note = document.getElementById('statsGridNote');
    const txt = CC.statsNote(stats);
    note.hidden = !txt;
    note.textContent = txt;
    document.getElementById('stats-drivers').innerHTML = CC.buildDriverStatsTable(stats);
    document.getElementById('stats-constructors').innerHTML = CC.buildTeamStatsTable(stats);
}

// ------------------------------------------------------------
// Points progression chart
// ------------------------------------------------------------
function renderProgression() {
    const canvas = document.getElementById('progressionCanvas');
    if (!canvas || canvas.offsetParent === null) return; // not visible yet
    const mode = document.querySelector('input[name="progMode"]:checked').value;
    progressionChart = CC.progressionChart(canvas, {
        standings: mode === 'constructors' ? constructorStandings : driverStandings,
        races, mode, chart: progressionChart
    });
}

// ------------------------------------------------------------
// Recap image
// ------------------------------------------------------------
function drawRecap() {
    CC.drawRecap(document.getElementById('recapCanvas'), {
        slotName: champName,
        races,
        driverStandings,
        constructorStandings
    });
}

function downloadImage() {
    const canvas = document.getElementById('recapCanvas');
    drawRecap(); // idempotent — ensures it is up to date even if the tab was never opened
    canvas.toBlob(blob => {
        if (!blob) { alert('Could not generate the image.'); return; }
        CC.triggerDownload(blob, `minif1_championship_${CC.slugify(champName)}_${CC.dateStamp()}.png`);
    }, 'image/png');
}
