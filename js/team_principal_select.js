// Team picker shown once when a Team Principal career save is created:
// edit the grid (add/remove teams, 10-15), then pick the team to manage.

const TP_SLOT = parseInt(new URLSearchParams(location.search).get('slot') || '0', 10);
const TP_BACK_URL = 'championship_save_select.html?mode=career&careerType=teamPrincipal';

// Same default stats as index.js's genericTeam().
const TP_GENERIC_STATS = 70;

// Current choice of the team being added (FLAG_LIST / TEAM_IMAGE_LIST: js/team_assets.js).
const tpChoice = { flag: 'uk', car: 'MER24' };

// A thumbnail that opens a scrollable grid of images; picking one stores it in tpChoice[key].
function tpImagePicker(hostId, key, list, dir) {
    const host = document.getElementById(hostId);
    const current = document.createElement('img');
    current.className = 'tp-current';
    current.src = `img/${dir}/${tpChoice[key]}.png`;
    const grid = document.createElement('div');
    grid.className = 'tp-img-grid';
    list.forEach(name => {
        const opt = document.createElement('img');
        opt.src = `img/${dir}/${name}.png`;
        opt.alt = name;
        opt.loading = 'lazy';
        opt.addEventListener('click', e => {
            e.stopPropagation();
            tpChoice[key] = name;
            current.src = opt.src;
            grid.classList.remove('open');
        });
        grid.appendChild(opt);
    });
    current.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = grid.classList.contains('open');
        document.querySelectorAll('.tp-img-grid').forEach(g => g.classList.remove('open'));
        if (!wasOpen) grid.classList.add('open');
    });
    host.append(current, grid);
}

// Keep a number input inside [min, max] as the user types.
function tpClampInput(input, min, max) {
    input.min = min; input.max = max;
    input.addEventListener('input', () => {
        if (input.value === '') return;
        const n = parseFloat(input.value);
        if (Number.isFinite(n)) input.value = Math.max(min, Math.min(max, n));
    });
}

function tpReadSlot() {
    try { return JSON.parse(localStorage.getItem('careerSlot' + TP_SLOT) || 'null'); } catch (e) { return null; }
}

// ---- Grid being edited: one entry per team, each with its 2 drivers ----
// (drivers stay attached to their team so adding/removing a team can't misalign them)
let tpGrid = [];
let tpGenericDriverCount = 22;

function tpGenericDrivers() {
    return [0, 1].map(() => {
        const n = ++tpGenericDriverCount;
        return { name: `Driver ${n}`, code: `D${n}`, driverLevel: 70, flag: FLAG_LIST[(n * 13) % FLAG_LIST.length] };
    });
}

function tpClampValue(v, lo, hi, dflt) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}

function tpBuildTeamFromForm() {
    const c = TP_CONFIG.createdTeam;
    const name = document.getElementById('tp-new-name').value.replace(/[<>"&]/g, '').trim() || 'My Team';
    return {
        teamUid: TeamPrincipal.newTeamUid(name),
        team: name,
        teamSPD: TP_GENERIC_STATS, teamFS: TP_GENERIC_STATS, teamSS: TP_GENERIC_STATS, teamFB: TP_GENERIC_STATS,
        color: document.getElementById('tp-new-color').value,
        image: tpChoice.car,
        flag: tpChoice.flag + '.png',
        prestige: tpClampValue(document.getElementById('tp-new-prestige').value, c.prestigeMin, c.prestigeMax, TP_CONFIG.gauges.defaultPrestige),
        finance: tpClampValue(document.getElementById('tp-new-finance').value, c.financeMin, c.financeMax, TP_CONFIG.gauges.defaultFinance),
        confidence: TP_CONFIG.gauges.defaultConfidence
    };
}

// Writes the edited grid into the slot (team_id = position, drivers follow their team),
// records the managed team and continues to the career setup.
function tpChooseTeam(teamUid) {
    const slot = tpReadSlot();
    if (!slot) return;
    slot.data.teams = tpGrid.map((g, i) => Object.assign({}, g.team, { team_id: i + 1 }));
    slot.data.drivers = [];
    tpGrid.forEach((g, i) => g.drivers.forEach(d => slot.data.drivers.push(Object.assign({}, d, { team_id: i + 1 }))));
    slot.data.teamPrincipal = TeamPrincipal.initialState(teamUid);
    localStorage.setItem('careerSlot' + TP_SLOT, JSON.stringify(slot));
    window.location.href = TP_BACK_URL + '&setup=' + TP_SLOT;
}

function tpAddTeam() {
    if (tpGrid.length >= MAX_TEAMS) return;
    tpGrid.push({ team: tpBuildTeamFromForm(), drivers: tpGenericDrivers() });
    tpRenderGrid();
}

function tpRemoveTeam(index) {
    if (tpGrid.length <= MIN_TEAMS) return;
    tpGrid.splice(index, 1);
    tpRenderGrid();
}

function tpRenderGrid() {
    const grid = document.getElementById('tp-grid');
    grid.innerHTML = '';
    tpGrid.forEach((entry, index) => {
        const team = entry.team;
        const g = TeamPrincipal.teamGauges(team);
        const flag = String(team.flag || 'uk').replace(/\.png$/, '');
        const card = document.createElement('div');
        card.className = 'tp-pick-card';
        card.style.setProperty('--team-color', team.color || '#888');
        card.innerHTML = `
            <div class="tp-pick-top">
                <img class="tp-flag" src="img/flags/${flag}.png" alt="${flag}" style="height:20px">
                <span class="tp-pick-name"></span>
                <button type="button" class="tp-remove" title="Remove team from the grid">&times;</button>
            </div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Prestige</span>${TeamPrincipal.gaugeIcons(g.prestige, '', 'tp-prestige tp-star')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Finance</span>${TeamPrincipal.gaugeIcons(g.finance, '$', 'tp-finance')}</div>
        `;
        card.querySelector('.tp-pick-name').textContent = TeamPrincipal.teamName(team);
        const removeBtn = card.querySelector('.tp-remove');
        removeBtn.disabled = tpGrid.length <= MIN_TEAMS;
        removeBtn.addEventListener('click', e => { e.stopPropagation(); tpRemoveTeam(index); });
        card.addEventListener('click', () => tpChooseTeam(team.teamUid));
        grid.appendChild(card);
    });

    const n = tpGrid.length;
    document.getElementById('tp-count-note').textContent = `${n} teams · ${n * 2} drivers (min ${MIN_TEAMS} / max ${MAX_TEAMS})`;
    document.getElementById('tp-add-confirm').disabled = n >= MAX_TEAMS;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!tpReadSlot()) { window.location.href = TP_BACK_URL; return; }

    document.getElementById('back-btn').addEventListener('click', () => {
        // Leaving without a team: drop the half-created save so it doesn't linger empty.
        const slot = tpReadSlot();
        if (slot && slot.data && !slot.data.teamPrincipal) localStorage.removeItem('careerSlot' + TP_SLOT);
        window.location.href = TP_BACK_URL;
    });

    tpImagePicker('tp-new-flag', 'flag', FLAG_LIST, 'flags');
    tpImagePicker('tp-new-car', 'car', TEAM_IMAGE_LIST, 'cars');
    document.addEventListener('click', () => {
        document.querySelectorAll('.tp-img-grid').forEach(g => g.classList.remove('open'));
    });

    const c = TP_CONFIG.createdTeam;
    const prestige = document.getElementById('tp-new-prestige');
    const finance = document.getElementById('tp-new-finance');
    tpClampInput(prestige, c.prestigeMin, c.prestigeMax);
    tpClampInput(finance, c.financeMin, c.financeMax);
    prestige.value = TP_CONFIG.gauges.defaultPrestige;
    finance.value = TP_CONFIG.gauges.defaultFinance;
    document.getElementById('tp-prestige-hint').textContent = `(${c.prestigeMin}-${c.prestigeMax})`;
    document.getElementById('tp-finance-hint').textContent = `(${c.financeMin}-${c.financeMax})`;

    document.getElementById('tp-create-toggle').addEventListener('click', () => {
        document.getElementById('tp-create').classList.toggle('open');
    });
    document.getElementById('tp-add-confirm').addEventListener('click', tpAddTeam);

    Promise.all([
        fetch('data/team_default.json').then(r => r.json()),
        fetch('data/driver_default.json').then(r => r.json())
    ]).then(([teams, drivers]) => {
        tpGrid = teams.map(team => ({
            team: team,
            drivers: drivers.filter(d => d.team_id === team.team_id).map(d => ({
                name: d.name, code: d.code, driverLevel: d.driverLevel, flag: d.flag
            }))
        }));
        tpRenderGrid();
    });
});
