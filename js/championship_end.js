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
    'selectedCircuit', 'selectedDrivers', 'weatherQuali', 'weatherRace', 'startingGrid', 'isSprint'
];

let state = {
    races: [],
    results: [],
    points: [...CC.DEFAULT_POINTS],
    opts: { fastestLapPoint: false, fastestLapTopN: 10 },
    driverStandings: [],
    constructorStandings: [],
    slotName: 'Championship'
};

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    const standings = CC.computeStandings(state.races, state.results, state.points, state.opts);
    state.driverStandings = standings.driverStandings;
    state.constructorStandings = standings.constructorStandings;

    renderChampions();
    renderStandings();
    setupTabs();
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
        fastestLapTopN: parseInt(localStorage.getItem('championshipFastestLapTopN') || '10')
    };

    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');
    if (slotNumber >= 1 && slotNumber <= 3) {
        try {
            const slot = JSON.parse(localStorage.getItem(`championshipSlot${slotNumber}`) || 'null');
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
        });
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
}

function downloadJson() {
    const payload = {
        app: 'MiniF1',
        type: 'championship-export',
        exportedAt: new Date().toISOString(),
        name: state.slotName,
        pointsScale: { feature: state.points, sprint: CC.POINTS_SPRINT },
        options: { fastestLapPoint: state.opts.fastestLapPoint, fastestLapTopN: state.opts.fastestLapTopN },
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
    const ok = confirm(
        'Finish this championship and delete its save?\n\n' +
        'Make sure you have downloaded the data first — this cannot be undone.'
    );
    if (!ok) return;

    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');
    if (slotNumber >= 1 && slotNumber <= 3) {
        localStorage.removeItem(`championshipSlot${slotNumber}`);
    }
    CHAMPIONSHIP_SESSION_KEYS.forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage)
        .filter(k => k.startsWith('championshipGrid_'))
        .forEach(k => localStorage.removeItem(k));

    window.location.href = 'index.html';
}
