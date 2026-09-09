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
let championshipOpts = { fastestLapPoint: false, fastestLapTopN: 0 };
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
        fastestLapTopN: (parsed.options && Number(parsed.options.fastestLapTopN)) || 0
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
// Stats (career-style aggregates over the championship)
// ------------------------------------------------------------
function renderStats() {
    const { driverStats, teamStats, hasGridData, hasFastestLapData } =
        CC.computeStats(races, results, featurePoints);

    const note = document.getElementById('statsGridNote');
    const missing = [];
    if (!hasGridData) missing.push('Pole and Best Grid need qualifying data');
    if (!hasFastestLapData) missing.push('Fastest Lap needs race lap timing');
    note.hidden = missing.length === 0;
    note.textContent = missing.join('; ') + ' — not recorded by this championship (run before that tracking existed).';

    document.getElementById('stats-drivers').innerHTML = buildDriverStatsTable(driverStats, hasFastestLapData);
    document.getElementById('stats-constructors').innerHTML = buildTeamStatsTable(teamStats, hasFastestLapData);
}

function fmtPos(n) { return n == null ? '—' : 'P' + n; }
function fmtAvg(n) { return n == null ? '—' : n.toFixed(1); }
function num(n) { return n ? String(n) : '-'; }

function buildDriverStatsTable(rows, showFL) {
    if (!rows.length) return `<p style="color:#888;padding:20px;">No data.</p>`;
    let h = `<table><thead><tr>
        <th>#</th><th>Driver</th><th>Team</th>
        <th title="Grands Prix entered">GP</th>
        <th title="Race finishes">Fin</th>
        <th title="Retirements (DNF)">DNF</th>
        <th title="Race wins">Wins</th>
        <th title="Podium finishes (top 3)">Pod</th>
        <th title="Points-scoring finishes">Scoring</th>
        <th title="Pole positions (started 1st)">Pole</th>` +
        (showFL ? `<th title="Fastest laps (feature races)">FL</th>` : '') + `
        <th title="Best race finish">Best</th>
        <th title="Best qualifying / grid slot">Grid</th>
        <th title="Average finishing position">Avg</th>
        <th title="Championship points">Points</th>
    </tr></thead><tbody>`;
    rows.forEach((r, i) => {
        h += `<tr>` +
            `<td>${i + 1}</td>` +
            `<td>${CC.escapeHtml(r.name)}</td>` +
            `<td>${CC.escapeHtml(r.team)}</td>` +
            `<td>${r.entered}</td>` +
            `<td>${r.finishes}</td>` +
            `<td>${num(r.dnf)}</td>` +
            `<td>${num(r.wins)}</td>` +
            `<td>${num(r.podiums)}</td>` +
            `<td>${num(r.pointFinishes)}</td>` +
            `<td>${num(r.poles)}</td>` +
            (showFL ? `<td>${num(r.fastestLaps)}</td>` : '') +
            `<td>${fmtPos(r.bestFinish)}</td>` +
            `<td>${fmtPos(r.bestGrid)}</td>` +
            `<td>${fmtAvg(r.avgFinish)}</td>` +
            `<td><b>${r.points}</b></td>` +
            `</tr>`;
    });
    return h + `</tbody></table>`;
}

function buildTeamStatsTable(rows, showFL) {
    if (!rows.length) return `<p style="color:#888;padding:20px;">No data.</p>`;
    let h = `<table><thead><tr>
        <th>#</th><th>Constructor</th>
        <th title="Grands Prix entered">GP</th>
        <th title="Car finishes">Fin</th>
        <th title="Retirements (DNF)">DNF</th>
        <th title="Race wins">Wins</th>
        <th title="Podium finishes (per car)">Pod</th>
        <th title="1-2 finishes">1-2</th>
        <th title="Points-scoring finishes (per car)">Scoring</th>
        <th title="Pole positions">Pole</th>` +
        (showFL ? `<th title="Fastest laps (feature races)">FL</th>` : '') + `
        <th title="Best race finish">Best</th>
        <th title="Best qualifying / grid slot">Grid</th>
        <th title="Championship points">Points</th>
    </tr></thead><tbody>`;
    rows.forEach((r, i) => {
        h += `<tr>` +
            `<td>${i + 1}</td>` +
            `<td>${CC.escapeHtml(r.team)}</td>` +
            `<td>${r.entered}</td>` +
            `<td>${r.finishes}</td>` +
            `<td>${num(r.dnf)}</td>` +
            `<td>${num(r.wins)}</td>` +
            `<td>${num(r.podiums)}</td>` +
            `<td>${num(r.oneTwo)}</td>` +
            `<td>${num(r.pointFinishes)}</td>` +
            `<td>${num(r.poles)}</td>` +
            (showFL ? `<td>${num(r.fastestLaps)}</td>` : '') +
            `<td>${fmtPos(r.bestFinish)}</td>` +
            `<td>${fmtPos(r.bestGrid)}</td>` +
            `<td><b>${r.points}</b></td>` +
            `</tr>`;
    });
    return h + `</tbody></table>`;
}

// ------------------------------------------------------------
// Points progression chart
// ------------------------------------------------------------
function renderProgression() {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('progressionCanvas');
    if (!canvas || canvas.offsetParent === null) return; // not visible yet

    const mode = document.querySelector('input[name="progMode"]:checked').value;
    const source = mode === 'constructors' ? constructorStandings : driverStandings;
    const rows = source.slice(0, 10);

    const labels = races.map((r, i) => CC.raceCode(r) || `R${i + 1}`);

    const datasets = rows.map((row, i) => {
        let running = 0;
        const cumulative = row.perRace.map(p => (running += (p || 0)));
        const label = mode === 'constructors' ? row.team : row.name;
        return {
            label,
            data: cumulative,
            borderColor: row.color || '#888',
            backgroundColor: 'transparent',
            borderWidth: 2,
            // dashed line for the 2nd entry sharing a colour (teammates)
            borderDash: (mode === 'drivers' && i > 0 && rows[i - 1].color === row.color) ? [6, 4] : [],
            tension: 0.15,
            pointRadius: 2
        };
    });

    if (progressionChart) progressionChart.destroy();
    progressionChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { color: '#1e1e1e' }, ticks: { color: '#999' } },
                y: { grid: { color: '#1e1e1e' }, ticks: { color: '#999' }, beginAtZero: true }
            },
            plugins: {
                legend: { labels: { color: '#ccc', boxWidth: 14, font: { size: 11 } } },
                tooltip: { enabled: true }
            }
        }
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
