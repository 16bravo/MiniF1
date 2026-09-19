// "Team Management" tab of gp_select.html (Team Principal career only).
// Header + gauges, the team's 4 engineers, the local offer and the 4 decks.
// Requires team_principal_common.js and team_principal_engineers.js.

const TPE = TeamPrincipalEngineers;

function tpEscape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Change one of the managed team's gauges. The team editor rebuilds `teams` from its
// rows, so the value must go through the row's dataset and updateDriverTeamOptions().
function tpSetTeamGauge(uid, key, value) {
    const row = document.querySelector('#teamTable .team-row[data-team-uid="' + uid + '"]');
    if (!row) return;
    row.dataset[key] = Math.max(0, Math.min(TP_CONFIG.gauges.max, value));
    updateDriverTeamOptions();
}

const TP_SVG_LIFE = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.5"/><path d="M8 4v4l3 2"/></svg>';
const TP_SVG_CONTRACT = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 1.5h5.5L12.5 4.5v10H4z"/><path d="M6.5 8h4M6.5 11h4"/></svg>';

// kind: 'hired' (in a slot), 'market' (general deck) or 'local' (yearly offer).
function tpEngineerCard(state, team, e, kind, slot) {
    const flag = e.country.replace(/\.png$/, '');
    const g = TeamPrincipal.teamGauges(team);
    const c = TP_CONFIG.engineers;
    // A signed engineer shows his contract salary; a card shows what this team would be asked.
    const cost = kind === 'hired' && slot && slot.cost !== undefined ? slot.cost : TPE.costFor(state, team, e);
    // Same unit as the finance gauge: one coin = 1 $, so a cost of 0.5 is a half coin.
    const costIcons = TeamPrincipal.gaugeIcons(cost, '$', 'tp-finance tp-cost', c.costIcons);
    const seasonsLeft = TPE.lastSeason(e) - state.year + 1;

    let action = '';
    let reason = '';
    if (kind === 'hired') {
        action = `<button type="button" class="tp-eng-btn" data-action="fire" data-role="${e.stat}">Dismiss</button>`;
    } else {
        const elig = TPE.canApproach(state, team, e);
        if (!elig.ok) reason = elig.reason === 'dismissed' ? "Won't come back this season" : 'Not enough $';
        action = `<button type="button" class="tp-eng-btn hire" data-action="hire" data-id="${e.engineer_id}" ${elig.ok ? '' : 'disabled'}>Hire</button>`;
    }
    // Fixed cells (empty when not applicable) so each stat lines up from card to card.
    // Requirements only matter on the general market (the local offer has none).
    const market = kind === 'market';
    const reqHeart = market ? `♥ ${e.min_confidence}` : '';
    const reqStar = market ? `★ ${e.min_prestige}` : '';
    return `
        <div class="tp-eng rarity-${tpEscape(e.rarity)}">
            <div class="tp-eng-top">
                <img class="tp-eng-flag" src="img/flags/${flag}.png" alt="${flag}">
                <span class="tp-eng-name">${tpEscape(e.name)}</span>
                <span class="tp-rarity">${tpEscape(e.rarity)}</span>
            </div>
            ${kind === 'local' ? `<div class="tp-eng-spec">${TP_CONFIG.engineers.roleNames[e.stat]} <small>${e.stat}</small></div>` : ''}
            <div class="tp-eng-meta">
                ${costIcons}
                <span class="tp-eng-req">${reqHeart}</span>
                <span class="tp-eng-req">${reqStar}</span>
                <span class="tp-eng-num" title="Seasons left before retirement">${TP_SVG_LIFE}${seasonsLeft}</span>
                <span class="tp-eng-num" ${slot ? 'title="Contract seasons left"' : ''}>${slot ? TP_SVG_CONTRACT + slot.contractLeft : ''}</span>
            </div>
            <div class="tp-eng-actions">${action}${reason ? `<span class="tp-eng-reason">${reason}</span>` : ''}</div>
        </div>`;
}

// A race has been played this season (played races carry a non-empty result list).
function tpSeasonStarted() {
    let results = [];
    try { results = JSON.parse(localStorage.getItem('championshipResults') || '[]'); } catch (e) {}
    return Array.isArray(results) && results.some(r => Array.isArray(r) && r.length > 0);
}

// The local offer only lasts until the first race: after that it joins the general deck.
function tpExpireLocalIfSeasonStarted(engineerState) {
    return !!engineerState.local && tpSeasonStarted() && TPE.expireLocal(engineerState);
}

// Current car performance: the four team stats, one per engineer position.
function tpCarStatsHtml(team) {
    const c = TP_CONFIG.carStats;
    const rows = TPE.ROLES.map(role => {
        const value = Math.round(parseFloat(team['team' + role]) || 0);
        const pct = Math.max(0, Math.min(100, (value - c.barMin) / (c.barMax - c.barMin) * 100));
        return `
            <div class="tp-stat-row">
                <span class="tp-stat-label">${TP_CONFIG.engineers.roleNames[role]} <small>${role}</small></span>
                <span class="tp-stat-bar"><span class="tp-stat-fill" style="width:${pct}%"></span></span>
                <span class="tp-stat-value">${value}</span>
            </div>`;
    }).join('');
    return `<div class="tp-carstats" style="--team-color:${tpEscape(tpHexColor(team.color))}"><div class="tp-carstats-title">Car</div>${rows}</div>`;
}

// The team's 2 race drivers plus the reserve slot, laid out exactly like the engineer columns
// (same grid, same card, same cells). Read-only for now: contract, cost, requirements and
// retirement don't exist for drivers yet (they come with the drivers phase), so those cells
// are placeholders in the position they will take.
function tpDriversHtml(teams, team) {
    let drivers = [];
    try { drivers = JSON.parse(localStorage.getItem('drivers') || '[]'); } catch (e) {}
    // team_id is the team's position in the grid (1-based), as everywhere in the game.
    const teamId = teams.findIndex(t => t.teamUid === team.teamUid) + 1;
    const mine = drivers.filter(d => parseInt(d.team_id, 10) === teamId).slice(0, 2);

    const ph = '<span class="tp-eng-ph">–</span>';
    const card = d => {
        if (!d) return '<div class="tp-eng tp-vacant">Vacant position</div>';
        const flag = String(d.flag || 'uk').replace(/^img\/flags\//, '').replace(/\.png$/, '');
        return `
            <div class="tp-eng">
                <div class="tp-eng-top">
                    <img class="tp-eng-flag" src="img/flags/${flag}.png" alt="${flag}">
                    <span class="tp-eng-name">${tpEscape(d.name || '')}</span>
                    <span class="tp-rarity">${tpEscape(d.code || '')}</span>
                </div>
                <div class="tp-eng-meta">
                    ${ph}
                    <span class="tp-eng-req"></span>
                    <span class="tp-eng-req"></span>
                    <span class="tp-eng-num">${TP_SVG_LIFE}–</span>
                    <span class="tp-eng-num">${TP_SVG_CONTRACT}–</span>
                </div>
                <div class="tp-eng-actions"></div>
            </div>`;
    };
    const column = (title, d) => `
        <div class="tp-eng-col">
            <div class="tp-col-title">${title}</div>
            ${card(d)}
        </div>`;
    return `
        <div class="tp-eng-columns">
            ${column('Driver 1', mine[0])}
            ${column('Driver 2', mine[1])}
            ${column('Reserve 1', null)}
            ${column('Reserve 2', null)}
        </div>`;
}

// ---- development projects: this season's budget, calendar and the project of each position ----

const TPP = TeamPrincipalProjects;

function tpRaces() {
    try { return JSON.parse(localStorage.getItem('championshipRaces') || '[]'); } catch (e) { return []; }
}
function tpSeasonNumber() { return parseInt(localStorage.getItem('careerSeasonNumber') || '1', 10); }
function tpGpName(race) { return race.grandPrix || race.circuit || 'GP'; }
function tpGpFlag(race) { return String(race.country || '').toLowerCase().replace(/ /g, '_'); }

// What the development UI needs: the season's dev state, the $ limit (by last season's rank, i.e.
// the team's position in the grid), the GPs still open as a target, and what can be invested now.
function tpDevContext(slot, teams, team, state) {
    const tp = slot.data.teamPrincipal;
    const season = tpSeasonNumber();
    const fresh = !(tp.dev && tp.dev.season === season);
    const dev = TPP.ensure(tp, season);
    if (fresh) TeamPrincipal.writeCurrentSlot(slot);
    const races = tpRaces();
    const rank = teams.findIndex(t => t.teamUid === team.teamUid) + 1;
    const cap = TPP.devCap(rank, teams.length);
    const left = TPP.remainingBudget(dev, cap);
    const currentRace = parseInt(localStorage.getItem('championshipCurrentRace') || '0', 10);
    const open = TPP.openWeekend(dev, races, currentRace);
    const targets = TPP.weekends(races).filter(w => w.no >= open);
    const maxInvest = TPP.maxInvest(left, TPE.freeFinance(state, team));
    return { dev: dev, races: races, cap: cap, left: left, targets: targets, maxInvest: maxInvest,
             canStart: targets.length > 0 && maxInvest >= TP_CONFIG.projects.minInvest - 1e-9 };
}

// A running project: the part it improves, its target GP, what was invested and the engineer at work.
function tpProjectCard(role, ctx, state, team) {
    const p = ctx.dev.projects[role];
    const w = TPP.weekends(ctx.races).find(x => x.no === p.target);
    const flag = w ? tpGpFlag(w.race) : '';
    const slot = TPE.teamSlots(state, team.teamUid)[role];
    const eng = slot ? TPE.get(slot.id) : null;
    return `
        <div class="tp-proj">
            <div class="tp-proj-role">${TP_CONFIG.engineers.roleNames[role]} <small>${role}</small></div>
            <div class="tp-proj-top">
                ${flag ? `<img class="tp-eng-flag" src="img/flags/${flag}.png" alt="${flag}">` : ''}
                <span class="tp-proj-gp">${tpEscape(w ? tpGpName(w.race) : 'GP ' + p.target)}</span>
                <span class="tp-proj-no">#${p.target}</span>
            </div>
            <div class="tp-proj-meta">
                ${TeamPrincipal.gaugeIcons(p.invested, '$', 'tp-finance tp-cost', Math.max(TP_CONFIG.engineers.costIcons, Math.ceil(p.invested - 1e-9)))}
                <span class="tp-proj-max" title="The most this project can add">up to +${(Math.round(p.ceiling * 10) / 10).toFixed(1)}</span>
            </div>
            <div class="tp-proj-eng ${eng ? '' : 'vacant'}">${eng ? tpEscape(eng.name) : 'Vacant position: it will not grow'}</div>
        </div>`;
}

// The Projects sub-tab: the single "New project" button, the projects running, the last results.
function tpProjectsTabHtml(ctx, state, team) {
    const running = TPP.ROLES.filter(r => ctx.dev.projects[r]);
    const free = TPP.ROLES.filter(r => !ctx.dev.projects[r]);
    const canNew = ctx.canStart && free.length > 0;
    const hint = !free.length ? 'Every position already has a project.'
        : !ctx.targets.length ? 'No GP left this season.'
        : !ctx.canStart ? 'No development budget or free $ left.' : '';
    const last = TPP.ROLES.filter(r => ctx.dev.last[r]);
    const gpName = no => { const w = TPP.weekends(ctx.races).find(x => x.no === no); return w ? tpGpName(w.race) : 'GP ' + no; };
    return `
        <div class="tp-projects-bar">
            <button type="button" class="tp-eng-btn hire" data-action="project-new" ${canNew ? '' : 'disabled'}>New project</button>
            ${hint ? `<span class="tp-proj-hint">${hint}</span>` : ''}
        </div>
        ${running.length
            ? `<div class="tp-proj-grid">${running.map(r => tpProjectCard(r, ctx, state, team)).join('')}</div>`
            : '<div class="tp-empty">No project running.</div>'}
        ${last.length ? `
        <h3 class="tp-section">Last results</h3>
        <div class="tp-proj-results">${last.map(r => {
            const l = ctx.dev.last[r];
            return `<div class="tp-result-row"><span class="tp-result-role">${TP_CONFIG.engineers.roleNames[r]} <small>${r}</small></span>
                <span class="tp-result-gain ${l.gain > 0 ? 'up' : 'none'}">${l.gain > 0 ? '+' + l.gain.toFixed(1) : 'no gain'}</span>
                <span class="tp-result-max">${tpEscape(gpName(l.weekendNo))} · up to +${l.ceiling.toFixed(1)}</span></div>`;
        }).join('')}</div>` : ''}`;
}

// The sub-tab shown in Team Management (a per-viewer convenience, remembered between visits).
const TP_SUBTABS = [['drivers', 'Drivers'], ['engineers', 'Engineers'], ['projects', 'Projects']];
function tpGetSubTab() {
    let v = null;
    try { v = localStorage.getItem('tpSubTab'); } catch (e) {}
    return TP_SUBTABS.some(t => t[0] === v) ? v : 'engineers';
}
function tpSetSubTab(v) { try { localStorage.setItem('tpSubTab', v); } catch (e) {} }

function tpRenderTab(host) {
    const slot = TeamPrincipal.readCurrentSlot();
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (e) {}
    const tp = slot && slot.data && slot.data.teamPrincipal;
    const team = tp && TeamPrincipal.findTeamByUid(teams, tp.teamUid);
    if (!team) {
        host.innerHTML = '<div class="tp-empty">Your team could not be found in this save.</div>';
        return;
    }

    // First visit (or a save older than the current year): build / advance the engineer world.
    const year = TeamPrincipal.currentYear();
    let dirty = false;
    if (!slot.data.engineerState) { slot.data.engineerState = TPE.initState(teams, year, team); dirty = true; }
    else if (slot.data.engineerState.year < year) { TPE.advanceYear(slot.data.engineerState, year, team); dirty = true; }
    if (tpExpireLocalIfSeasonStarted(slot.data.engineerState)) dirty = true;
    if (dirty) TeamPrincipal.writeCurrentSlot(slot);
    const state = slot.data.engineerState;
    const dctx = tpDevContext(slot, teams, team, state);

    const g = TeamPrincipal.teamGauges(team);
    const name = TeamPrincipal.teamName(team);
    const flag = String(team.flag || 'uk').replace(/^img\/flags\//, '').replace(/\.png$/, '');
    const image = String(team.image || '').replace(/^img\/cars\//, '').replace(/\.png$/, '');
    const committed = TPE.committed(state, team.teamUid);
    const slots = TPE.teamSlots(state, team.teamUid);

    // Only shown while the offer is open (start of the season, before the first race).
    // It sits in the same column grid as the engineers, so its card lines up with theirs.
    const localHtml = state.local ? `
        <h3 class="tp-section">Local offer</h3>
        <div class="tp-eng-columns tp-local"><div class="tp-eng-col">${tpEngineerCard(state, team, TPE.get(state.local.id), 'local')}</div></div>` : '';

    const columns = TPE.ROLES.map(role => {
        const cur = slots[role];
        const curHtml = cur
            ? tpEngineerCard(state, team, TPE.get(cur.id), 'hired', cur)
            : '<div class="tp-eng tp-vacant">Vacant position</div>';
        // Only cards this team can actually take are shown - plus an engineer it just dismissed,
        // who is in the pool (first) but won't come back before the season ends.
        const deckHtml = state.decks[role].map(id => TPE.get(id))
            .filter(e => { const r = TPE.canApproach(state, team, e); return r.ok || r.reason === 'dismissed'; })
            .map(e => tpEngineerCard(state, team, e, 'market')).join('')
            || '<div class="tp-empty">No card available.</div>';
        return `
            <div class="tp-eng-col">
                <div class="tp-col-title">${TP_CONFIG.engineers.roleNames[role]} <span class="tp-col-stat">${role}</span></div>
                ${curHtml}
                <div class="tp-deck-title">Market</div>
                ${deckHtml}
            </div>`;
    }).join('');

    // The header and the gauges are always shown; only the panel below them changes.
    const sub = tpGetSubTab();
    const panels = {
        drivers: tpDriversHtml(teams, team),
        engineers: `${localHtml}<div class="tp-eng-columns">${columns}</div>`,
        projects: tpProjectsTabHtml(dctx, state, team)
    };

    host.innerHTML = `
        <div class="tp-header" style="--team-color:${tpEscape(team.color || '#888')}">
            <img class="tp-flag" src="img/flags/${flag}.png" alt="${flag}">
            <div class="tp-team-name">${tpEscape(name)}</div>
            <div class="tp-header-tools">
                <input type="color" class="tp-color" value="${tpEscape(tpHexColor(team.color))}" title="Team color">
                <span class="tp-img-picker tp-car-picker">
                    <img class="tp-current" data-action="toggle-car" src="img/cars/${image}.png" alt="${tpEscape(name)}" title="Change car design">
                    <div class="tp-img-grid">${TEAM_IMAGE_LIST.map(n => `<img src="img/cars/${n}.png" alt="${n}" loading="lazy" data-action="set-car" data-car="${n}">`).join('')}</div>
                </span>
            </div>
        </div>
        <div class="tp-top">
        <div class="tp-gauges">
            <div class="tp-gauge-row"><span class="tp-gauge-label">Finance</span>${TeamPrincipal.financeIcons(g.finance, committed)}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Development</span>${TeamPrincipal.financeIcons(dctx.cap, dctx.dev.spent)}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Confidence</span>${TeamPrincipal.gaugeIcons(g.confidence, '♥', 'tp-confidence')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Prestige</span>${TeamPrincipal.gaugeIcons(g.prestige, '', 'tp-prestige tp-star')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Satisfaction</span>${TeamPrincipal.satisfactionBar(tp.satisfaction)}</div>
        </div>
        ${tpCarStatsHtml(team)}
        </div>
        <div class="tp-subtabs">
            ${TP_SUBTABS.map(([id, label]) => `<button type="button" class="tp-subtab ${id === sub ? 'active' : ''}" data-action="subtab" data-tab="${id}">${label}</button>`).join('')}
        </div>
        <div class="tp-subpanel" data-tab="${sub}">${panels[sub]}</div>
    `;
}

// <input type="color"> only accepts #rrggbb; team colors may be stored as #rgb or a name.
function tpHexColor(c) {
    const s = String(c || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
    return m ? '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3] : '#888888';
}

// Color / car design go through the team editor's row (same reason as tpSetTeamGauge).
function tpSetTeamLook(uid, look) {
    const row = document.querySelector('#teamTable .team-row[data-team-uid="' + uid + '"]');
    if (!row) return;
    if (look.color) row.querySelector('input[type="color"]').value = look.color;
    if (look.car) {
        const img = row.querySelector('.team-image');
        img.setAttribute('src', 'img/cars/' + look.car + '.png');
        img.alt = look.car;
    }
    updateDriverTeamOptions();
}

function tpHandleAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;

    if (btn.dataset.action === 'subtab') {
        tpSetSubTab(btn.dataset.tab);
        renderTeamManagement();
        return;
    }
    if (btn.dataset.action === 'toggle-car') {
        e.stopPropagation();
        btn.parentElement.querySelector('.tp-img-grid').classList.toggle('open');
        return;
    }
    if (btn.dataset.action === 'set-car') {
        const slotNow = TeamPrincipal.readCurrentSlot();
        tpSetTeamLook(slotNow.data.teamPrincipal.teamUid, { car: btn.dataset.car });
        renderTeamManagement();
        return;
    }

    const slot = TeamPrincipal.readCurrentSlot();
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (err) {}
    const team = TeamPrincipal.findTeamByUid(teams, slot.data.teamPrincipal.teamUid);
    const state = slot.data.engineerState;
    if (!team || !state) return;

    // Stale page: the offer closed since it was drawn.
    if (tpExpireLocalIfSeasonStarted(state)) {
        TeamPrincipal.writeCurrentSlot(slot);
        renderTeamManagement();
        return;
    }

    if (btn.dataset.action === 'hire') {
        tpOpenNegotiation(parseInt(btn.dataset.id, 10));
        return;
    }
    if (btn.dataset.action === 'project-new') {
        tpOpenProject();
        return;
    }

    // fire
    const role = btn.dataset.role;
    const cur = TPE.get(TPE.teamSlots(state, team.teamUid)[role].id);
    const loss = TP_CONFIG.engineers.dismissalConfidenceLoss;
    if (!confirm(`Dismiss ${cur.name}? The team loses ${loss} confidence.`)) return;
    const result = TPE.fire(state, team, role);
    if (result.ok) {
        TeamPrincipal.writeCurrentSlot(slot);
        tpSetTeamGauge(team.teamUid, 'confidence', TeamPrincipal.teamGauges(team).confidence - result.confidenceLoss);
    }
    renderTeamManagement();
}

// ---- new project dialog: target GP and $ invested ----

function tpOpenProject() {
    tpCloseModal();
    const slot = TeamPrincipal.readCurrentSlot();
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (err) {}
    const team = TeamPrincipal.findTeamByUid(teams, slot.data.teamPrincipal.teamUid);
    const state = slot.data.engineerState;
    if (!team || !state) return;
    const ctx = tpDevContext(slot, teams, team, state);
    // Only the parts without a running project can be improved (one project at a time per stat).
    const freeRoles = TPP.ROLES.filter(r => !ctx.dev.projects[r]);
    if (!ctx.canStart || !freeRoles.length) return;

    const p = TP_CONFIG.projects;
    const choice = { role: freeRoles[0], target: ctx.targets[0].no, invest: p.minInvest };
    const slots = TPE.teamSlots(state, team.teamUid);

    const modal = document.createElement('div');
    modal.id = 'tp-modal';
    modal.className = 'tp-modal-backdrop';
    document.body.appendChild(modal);

    function draw() {
        const options = ctx.targets.map(w =>
            `<option value="${w.no}" ${w.no === choice.target ? 'selected' : ''}>#${w.no} ${tpEscape(tpGpName(w.race))}</option>`).join('');
        const roleButtons = freeRoles.map(r =>
            `<button type="button" class="tp-seg ${r === choice.role ? 'active' : ''}" data-proj="role" data-role="${r}">${TP_CONFIG.engineers.roleNames[r]} <small>${r}</small></button>`).join('');
        const engineer = slots[choice.role] ? TPE.get(slots[choice.role].id) : null;
        modal.innerHTML = `
            <div class="tp-modal" role="dialog">
                <div class="tp-modal-head">
                    <span class="tp-modal-name">New project</span>
                </div>
                <div class="tp-neg-row tp-neg-wrap">
                    <span class="tp-neg-label">Improve</span>
                    <div class="tp-seg-group" data-testid="roles">${roleButtons}</div>
                </div>
                <div class="tp-modal-note tp-proj-eng ${engineer ? '' : 'vacant'}" data-testid="engineer">${engineer ? 'Engineer: ' + tpEscape(engineer.name) : 'Vacant position: the project will not grow'}</div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Target</span>
                    <select class="tp-proj-select" data-proj="target">${options}</select>
                </div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Invest</span>
                    <button type="button" class="tp-step" data-proj="invest-" ${choice.invest <= p.minInvest + 1e-9 ? 'disabled' : ''}>−</button>
                    <span class="tp-neg-value tp-neg-coins" data-testid="invest">${TeamPrincipal.gaugeIcons(choice.invest, '$', 'tp-finance tp-cost', Math.max(2, Math.ceil(choice.invest - 1e-9)))}</span>
                    <button type="button" class="tp-step" data-proj="invest+" ${choice.invest + p.investStep > ctx.maxInvest + 1e-9 ? 'disabled' : ''}>+</button>
                </div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Budget</span>
                    <span data-testid="budget">${TeamPrincipal.financeIcons(ctx.cap, ctx.dev.spent + choice.invest)}</span>
                </div>
                <div class="tp-modal-actions">
                    <button type="button" class="tp-eng-btn" data-proj="cancel">Cancel</button>
                    <button type="button" class="tp-eng-btn hire" data-proj="submit">Start project</button>
                </div>
            </div>`;
    }

    function submit() {
        // Re-read everything: the dialog may have been open a while.
        const s2 = TeamPrincipal.readCurrentSlot();
        let t2 = [];
        try { t2 = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (err) {}
        const team2 = TeamPrincipal.findTeamByUid(t2, s2.data.teamPrincipal.teamUid);
        const ctx2 = tpDevContext(s2, t2, team2, s2.data.engineerState);
        if (!ctx2.canStart || ctx2.dev.projects[choice.role] || choice.invest > ctx2.maxInvest + 1e-9 ||
            !ctx2.targets.some(w => w.no === choice.target)) {
            tpCloseModal(); renderTeamManagement(); return;
        }
        TPP.create(ctx2.dev, choice.role, choice.target, choice.invest);
        TeamPrincipal.writeCurrentSlot(s2);
        // The $ put into a project are consumed for good.
        tpSetTeamGauge(team2.teamUid, 'finance', TeamPrincipal.teamGauges(team2).finance - choice.invest);
        tpCloseModal();
        renderTeamManagement();
    }

    modal.addEventListener('click', ev => {
        if (ev.target === modal) { tpCloseModal(); return; }
        const b = ev.target.closest('[data-proj]');
        if (!b || b.disabled || b.tagName === 'SELECT') return;
        const act = b.dataset.proj;
        if (act === 'cancel') { tpCloseModal(); return; }
        if (act === 'submit') { submit(); return; }
        if (act === 'role') choice.role = b.dataset.role;
        if (act === 'invest-') choice.invest = Math.max(p.minInvest, Math.round((choice.invest - p.investStep) * 100) / 100);
        if (act === 'invest+' && choice.invest + p.investStep <= ctx.maxInvest + 1e-9) choice.invest = Math.round((choice.invest + p.investStep) * 100) / 100;
        draw();
    });
    modal.addEventListener('change', ev => {
        if (ev.target.dataset && ev.target.dataset.proj === 'target') { choice.target = parseInt(ev.target.value, 10); draw(); }
    });
    draw();
}

// ---- before each GP: projects grow, and the ones reaching their target GP are drawn ----

// The stats live in the team editor's row (hidden in this mode) - writing them there keeps them
// flowing into the grid the simulation reads, without touching the engine.
function tpApplyTeamStats(uid, outcomes) {
    const row = document.querySelector('#teamTable .team-row[data-team-uid="' + uid + '"]');
    if (!row) return;
    const cell = { SPD: 1, FS: 2, SS: 3, FB: 4 };
    const cells = row.querySelectorAll('td');
    outcomes.forEach(o => { cells[cell[o.role]].querySelector('input[type="number"]').value = o.newStat; });
    updateDriverTeamOptions();
}

// Runs the development of the weekend about to start (once per weekend). Resolves with the
// finished projects' outcomes (possibly none).
function tpDevelopBeforeRace() {
    if (typeof TeamPrincipal === 'undefined' || !TeamPrincipal.isActive()) return Promise.resolve([]);
    return TPE.load().then(() => {
        const slot = TeamPrincipal.readCurrentSlot();
        const tp = slot && slot.data && slot.data.teamPrincipal;
        const state = slot && slot.data && slot.data.engineerState;
        if (!tp || !tp.dev || !state) return [];   // nothing was ever started
        let teams = [];
        try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (err) {}
        const team = TeamPrincipal.findTeamByUid(teams, tp.teamUid);
        if (!team) return [];

        const dev = TPP.ensure(tp, tpSeasonNumber());
        const races = tpRaces();
        const weekendNo = TPP.weekendNoOfRace(races, parseInt(localStorage.getItem('championshipCurrentRace') || '0', 10));
        const slots = TPE.teamSlots(state, team.teamUid);
        const outcomes = TPP.processUpTo(dev, weekendNo,
            role => slots[role] ? TPE.get(slots[role].id).value : 0,
            role => parseFloat(team['team' + role]) || 0);
        TeamPrincipal.writeCurrentSlot(slot);
        if (outcomes.length) tpApplyTeamStats(team.teamUid, outcomes);
        return outcomes;
    });
}

function tpShowDevelopmentResults(outcomes, done) {
    tpCloseModal();
    const modal = document.createElement('div');
    modal.id = 'tp-modal';
    modal.className = 'tp-modal-backdrop';
    const rows = outcomes.map(o => `
        <div class="tp-result-row">
            <span class="tp-result-role">${TP_CONFIG.engineers.roleNames[o.role]} <small>${o.role}</small></span>
            <span class="tp-result-gain ${o.gain > 0 ? 'up' : 'none'}" data-testid="gain-${o.role}">${o.gain > 0 ? '+' + o.gain.toFixed(1) : 'no gain'}</span>
            <span class="tp-result-max">up to +${o.ceiling.toFixed(1)}</span>
        </div>`).join('');
    modal.innerHTML = `
        <div class="tp-modal" role="dialog">
            <div class="tp-modal-head"><span class="tp-modal-name">Development results</span></div>
            ${rows}
            <div class="tp-modal-actions"><button type="button" class="tp-eng-btn hire" data-proj="continue">Continue</button></div>
        </div>`;
    modal.addEventListener('click', ev => {
        const b = ev.target.closest('[data-proj="continue"]');
        if (!b) return;
        tpCloseModal();
        done();
    });
    document.body.appendChild(modal);
}

// ---- hiring dialog: contract length, salary and the engineer's reaction ----

const TP_VERDICT = {
    accept:   { label: 'Enthusiastic', cls: 'accept' },
    hesitant: { label: 'Hesitant', cls: 'hesitant' },
    closed:   { label: 'Closed', cls: 'closed' }
};

function tpCloseModal() {
    const m = document.getElementById('tp-modal');
    if (m) m.remove();
}

function tpOpenNegotiation(engineerId) {
    tpCloseModal();
    const slot = TeamPrincipal.readCurrentSlot();
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (err) {}
    const team = TeamPrincipal.findTeamByUid(teams, slot.data.teamPrincipal.teamUid);
    const state = slot.data.engineerState;
    const e = TPE.get(engineerId);
    if (!team || !state || !e) return;

    const first = TPE.assess(state, team, e, TPE.baseSeasons(e), TPE.costFor(state, team, e));
    const maxSeasons = TPE.maxSeasons(state, e);
    const baseCost = first.baseCost;
    const maxCost = TPE.maxOfferCost(state, team, e);
    const occupant = TPE.teamSlots(state, team.teamUid)[e.stat];
    const c = TP_CONFIG.engineers;

    const offer = {
        seasons: Math.min(maxSeasons, first.negotiate ? first.targetSeasons : first.baseSeasons),
        cost: baseCost
    };

    const modal = document.createElement('div');
    modal.id = 'tp-modal';
    modal.className = 'tp-modal-backdrop';
    document.body.appendChild(modal);

    function coins(v) { return TeamPrincipal.gaugeIcons(v, '$', 'tp-finance tp-cost', Math.max(c.costIcons, Math.ceil(v - 1e-9))); }

    // The salary moves in half-coin steps, from the base value up to the cap (or what the free $ allow).
    const step = c.negotiation.salaryStep;
    const costCap = Math.min(Math.max(baseCost, c.negotiation.salaryMax), maxCost);
    function nextCost(v) { return Math.round((v + step) * 100) / 100; }

    function draw() {
        const a = TPE.assess(state, team, e, offer.seasons, offer.cost);
        const v = TP_VERDICT[a.verdict];
        const flag = e.country.replace(/\.png$/, '');
        modal.innerHTML = `
            <div class="tp-modal" role="dialog">
                <div class="tp-modal-head">
                    <img class="tp-eng-flag" src="img/flags/${flag}.png" alt="${flag}">
                    <span class="tp-modal-name">${tpEscape(e.name)}</span>
                    <span class="tp-rarity rarity-${tpEscape(e.rarity)}">${tpEscape(e.rarity)}</span>
                    <span class="tp-modal-role">${c.roleNames[e.stat]} <small>${e.stat}</small></span>
                </div>
                ${occupant ? `<div class="tp-modal-warn">Replaces ${tpEscape(TPE.get(occupant.id).name)}: - ${c.dismissalConfidenceLoss} ♥</div>` : ''}
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Contract</span>
                    <button type="button" class="tp-step" data-neg="seasons-" ${offer.seasons <= 1 ? 'disabled' : ''}>−</button>
                    <span class="tp-neg-value" data-testid="seasons">${offer.seasons}</span>
                    <button type="button" class="tp-step" data-neg="seasons+" ${offer.seasons >= maxSeasons ? 'disabled' : ''}>+</button>
                    <span class="tp-neg-unit">season${offer.seasons > 1 ? 's' : ''}</span>
                </div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Salary</span>
                    <button type="button" class="tp-step" data-neg="cost-" ${offer.cost <= baseCost + 1e-9 ? 'disabled' : ''}>−</button>
                    <span class="tp-neg-value tp-neg-coins" data-testid="salary">${coins(offer.cost)}</span>
                    <button type="button" class="tp-step" data-neg="cost+" ${nextCost(offer.cost) > costCap + 1e-9 ? 'disabled' : ''}>+</button>
                </div>
                <div class="tp-verdict ${v.cls}" data-testid="verdict">${v.label}</div>
                <div class="tp-modal-actions">
                    <button type="button" class="tp-eng-btn" data-neg="cancel">Cancel</button>
                    <button type="button" class="tp-eng-btn hire" data-neg="submit">${a.negotiate ? 'Send offer' : 'Sign contract'}</button>
                </div>
            </div>`;
    }

    function submit() {
        const result = TPE.hire(state, team, engineerId, { seasons: offer.seasons, cost: offer.cost });
        if (result.ok || result.refused) {
            TeamPrincipal.writeCurrentSlot(slot);
            if (result.confidenceLoss) {
                tpSetTeamGauge(team.teamUid, 'confidence', TeamPrincipal.teamGauges(team).confidence - result.confidenceLoss);
            }
        }
        if (result.refused) {
            modal.innerHTML = `
                <div class="tp-modal" role="dialog">
                    <div class="tp-modal-head"><span class="tp-modal-name">${tpEscape(e.name)}</span></div>
                    <div class="tp-modal-warn" data-testid="refused">He refused your offer. The team loses ${result.confidenceLoss} confidence and he won't talk to you again this season.</div>
                    <div class="tp-modal-actions"><button type="button" class="tp-eng-btn hire" data-neg="done">OK</button></div>
                </div>`;
            return;
        }
        tpCloseModal();
        renderTeamManagement();
    }

    modal.addEventListener('click', ev => {
        if (ev.target === modal) { tpCloseModal(); return; }
        const b = ev.target.closest('[data-neg]');
        if (!b || b.disabled) return;
        const act = b.dataset.neg;
        if (act === 'cancel') { tpCloseModal(); return; }
        if (act === 'done') { tpCloseModal(); renderTeamManagement(); return; }
        if (act === 'submit') { submit(); return; }
        if (act === 'seasons-') offer.seasons = Math.max(1, offer.seasons - 1);
        if (act === 'seasons+') offer.seasons = Math.min(maxSeasons, offer.seasons + 1);
        if (act === 'cost-') offer.cost = Math.max(baseCost, Math.round((offer.cost - step) * 100) / 100);
        if (act === 'cost+' && nextCost(offer.cost) <= costCap + 1e-9) offer.cost = nextCost(offer.cost);
        draw();
    });
    draw();
}

function renderTeamManagement() {
    const host = document.getElementById('tab-team-management');
    if (!host) return;
    if (!host.dataset.bound) {
        host.dataset.bound = '1';
        host.addEventListener('click', tpHandleAction);
        // Preview the color while dragging, save it once the picker is released.
        host.addEventListener('input', e => {
            if (e.target.classList.contains('tp-color')) {
                host.querySelectorAll('.tp-header, .tp-carstats').forEach(el => el.style.setProperty('--team-color', e.target.value));
            }
        });
        host.addEventListener('change', e => {
            if (!e.target.classList.contains('tp-color')) return;
            tpSetTeamLook(TeamPrincipal.readCurrentSlot().data.teamPrincipal.teamUid, { color: e.target.value });
        });
        document.addEventListener('click', () => {
            host.querySelectorAll('.tp-img-grid.open').forEach(g => g.classList.remove('open'));
        });
    }
    TPE.load().then(() => tpRenderTab(host));
}
