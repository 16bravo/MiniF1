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
function tpEngineerCard(state, team, e, kind, slot, readOnly) {
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
    if (readOnly) {
        // shown for comparison only (season opening pop-up): no button
    } else if (kind === 'hired') {
        action = `<button type="button" class="tp-eng-btn" data-action="fire" data-role="${e.stat}">Dismiss</button>`;
        // The last season of a contract: it can be renewed (unless he retires or refused already).
        const renewal = TPE.canRenew(state, team, e.stat);
        if (renewal.ok) action += `<button type="button" class="tp-eng-btn hire" data-action="renew" data-id="${e.engineer_id}">Renew</button>`;
        else if (renewal.reason === 'closed') reason = "Won't renew";
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
function tpGpLabel(weekendNo) {
    const w = TPP.weekends(tpRaces()).find(x => x.no === weekendNo);
    return '#' + weekendNo + ' ' + (w ? tpGpName(w.race) : 'GP');
}
function tpGpFlag(race) { return String(race.country || '').toLowerCase().replace(/ /g, '_'); }

// What the development UI needs: the season's dev state, the $ limit (by last season's rank, i.e.
// the team's position in the grid), the GPs still open as a target (the weekend being opened has
// already been worked on: a project can only aim at the following ones), and the $ that can go
// into a new project - the lower of what is left of the season limit and the free $.
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
    const free = TPE.freeFinance(state, team);
    const currentRace = parseInt(localStorage.getItem('championshipCurrentRace') || '0', 10);
    const open = TPP.openWeekend(dev, races, currentRace);
    const targets = TPP.weekends(races).filter(w => w.no >= open);
    const avail = TPP.available(left, free);
    const cheapest = TPP.projectCost(1, open, open);   // one GP at the lowest effort
    let blocked = '';
    if (!targets.length) blocked = 'No GP left this season.';
    else if (left < cheapest - 1e-9) blocked = 'Season development limit reached.';
    else if (free < cheapest - 1e-9) blocked = 'Not enough free $: the rest of the finance is committed to contracts.';
    return { dev: dev, races: races, cap: cap, left: left, free: free, open: open, targets: targets, avail: avail,
             blocked: blocked, canStart: !blocked };
}

// The effort level as pips (level 3 of 5: three filled, two empty).
function tpEffortPips(level) {
    return TP_CONFIG.projects.effortLevels.map((_, i) => `<i class="tp-pip ${i < level ? 'on' : ''}"></i>`).join('');
}

// A running project: the part it improves, its target GP, the effort and what it cost, the engineer at work.
function tpProjectCard(role, ctx, state, team) {
    const p = ctx.dev.projects[role];
    const w = TPP.weekends(ctx.races).find(x => x.no === p.target);
    const flag = w ? tpGpFlag(w.race) : '';
    const slot = TPE.teamSlots(state, team.teamUid)[role];
    const eng = slot ? TPE.get(slot.id) : null;
    const isNext = p.kind === 'next';
    return `
        <div class="tp-proj">
            <div class="tp-proj-role">${TP_CONFIG.engineers.roleNames[role]} <small>${role}</small></div>
            <div class="tp-proj-top">
                ${isNext ? '<span class="tp-proj-gp">Next season</span><span class="tp-proj-no">until the season ends</span>' : `
                ${flag ? `<img class="tp-eng-flag" src="img/flags/${flag}.png" alt="${flag}">` : ''}
                <span class="tp-proj-gp">${tpEscape(w ? tpGpName(w.race) : 'GP ' + p.target)}</span>
                <span class="tp-proj-no">#${p.target}</span>`}
            </div>
            <div class="tp-proj-meta">
                <span class="tp-effort" title="Effort ${p.level} of ${TP_CONFIG.projects.effortLevels.length}">${tpEffortPips(p.level)}</span>
                ${TeamPrincipal.gaugeIcons(p.cost, '$', 'tp-finance tp-cost', Math.max(TP_CONFIG.engineers.costIcons, Math.ceil(p.cost - 1e-9)))}
                ${isNext ? '' : `<span class="tp-proj-max" title="The most this project can add">up to +${TPP.ceilingValue(p.ceiling)}</span>`}
            </div>
            <div class="tp-proj-eng ${eng ? '' : 'vacant'}">${eng ? tpEscape(eng.name) : 'Vacant position: it will not grow'}</div>
        </div>`;
}

// The development budget is what is left of the team's finance once its contracts are paid,
// within the limit the team is allowed to spend on development this season (by last season's rank).
function tpDevBudgetHtml(ctx) {
    const n = v => Math.max(1, Math.ceil(v - 1e-9));
    const r2 = x => Math.round(x * 100) / 100;
    const row = (label, icons, tip) => `<div class="tp-gauge-row" title="${tpEscape(tip)}"><span class="tp-gauge-label">${label}</span>${icons}</div>`;
    return `
        <div class="tp-devbudget">
            ${row('Allowed', TeamPrincipal.financeIcons(ctx.cap, ctx.dev.spent, n(ctx.cap)),
                  `Season limit: ${ctx.cap} $ may go into development, ${r2(ctx.dev.spent)} $ already used (orange = used, green = still allowed)`)}
            ${row('Team budget', TeamPrincipal.gaugeIcons(ctx.free, '$', 'tp-finance', n(ctx.free)),
                  `Left in the team budget after contracts: ${r2(ctx.free)} $`)}
            ${row('Available', TeamPrincipal.gaugeIcons(ctx.avail, '$', 'tp-finance', n(ctx.avail)),
                  `Can be put into a new project now: ${r2(ctx.avail)} $ (the lower of the two)`)}
        </div>`;
}

// The Projects sub-tab: the development budget, the single "New project" button, the projects
// running, the last results.
function tpProjectsTabHtml(ctx, state, team) {
    const running = TPP.ROLES.filter(r => ctx.dev.projects[r]);
    const free = TPP.ROLES.filter(r => !ctx.dev.projects[r]);
    const canNew = ctx.canStart && free.length > 0;
    const hint = !free.length ? 'Every position already has a project.' : ctx.blocked;
    const last = TPP.ROLES.filter(r => ctx.dev.last[r]);
    const gpName = no => { const w = TPP.weekends(ctx.races).find(x => x.no === no); return w ? tpGpName(w.race) : 'GP ' + no; };
    return `
        ${tpDevBudgetHtml(ctx)}
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
                <span class="tp-result-gain ${l.gain > 0 ? 'up' : 'none'}">${l.gain > 0 ? '+' + Math.round(l.gain) : 'no gain'}</span>
                <span class="tp-result-max">${tpEscape(gpName(l.weekendNo))} · up to +${Math.round(l.ceiling)}</span></div>`;
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

// First visit (or a save older than the current year): build / advance the engineer world.
function tpEnsureEngineerState(slot, teams, team) {
    const year = TeamPrincipal.currentYear();
    let dirty = false;
    if (!slot.data.engineerState) { slot.data.engineerState = TPE.initState(teams, year, team); dirty = true; }
    else if (slot.data.engineerState.year < year) { TPE.advanceYear(slot.data.engineerState, year, team); dirty = true; }
    if (tpExpireLocalIfSeasonStarted(slot.data.engineerState)) dirty = true;
    if (dirty) TeamPrincipal.writeCurrentSlot(slot);
    return slot.data.engineerState;
}

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

    const state = tpEnsureEngineerState(slot, teams, team);
    const dctx = tpDevContext(slot, teams, team, state);

    const g = TeamPrincipal.teamGauges(team);
    const name = TeamPrincipal.teamName(team);
    const flag = String(team.flag || 'uk').replace(/^img\/flags\//, '').replace(/\.png$/, '');
    const image = String(team.image || '').replace(/^img\/cars\//, '').replace(/\.png$/, '');
    const committed = TPE.committed(state, team.teamUid);
    const slots = TPE.teamSlots(state, team.teamUid);

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
        engineers: `<div class="tp-eng-columns">${columns}</div>`,
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
            <div class="tp-gauge-row"><span class="tp-gauge-label">Confidence</span>${TeamPrincipal.gaugeIcons(g.confidence, '♥', 'tp-confidence')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Prestige</span>${TeamPrincipal.gaugeIcons(g.prestige, '', 'tp-prestige tp-star')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Satisfaction</span>${TeamPrincipal.satisfactionBar(TeamPrincipalSatisfaction.current(tp))}</div>
            ${tpRankRowsHtml(tp, teams, team)}
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
        const grid = btn.parentElement.querySelector('.tp-img-grid');
        grid.classList.toggle('open');
        if (grid.classList.contains('open')) placePickerGrid(grid);
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
    if (btn.dataset.action === 'renew') {
        tpOpenNegotiation(parseInt(btn.dataset.id, 10), true);
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

// ---- new project dialog: the part to improve, an effort level and the target GP ----

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

    const levelCount = TP_CONFIG.projects.effortLevels.length;
    const firstTarget = ctx.targets[0].no;
    // Effort x number of GPs = cost; whatever exceeds the season limit or the free $ is refused.
    const costOf = (level, w) => TPP.projectCost(level, ctx.open, w);
    const fits = (level, w) => costOf(level, w) <= ctx.avail + 1e-9;
    const lastTarget = ctx.targets[ctx.targets.length - 1].no;
    const choice = { role: freeRoles[0], level: 1, target: firstTarget, kind: 'improve' };
    // Development for the next season runs to the end of the season; an improvement has its own target GP.
    const targetOf = () => choice.kind === 'next' ? lastTarget : choice.target;
    const slots = TPE.teamSlots(state, team.teamUid);

    // After a change of effort, a target that no longer fits moves to the farthest GP that still does.
    function fitTarget() {
        if (choice.kind === 'next' || fits(choice.level, choice.target)) return;
        const within = ctx.targets.filter(w => w.no <= choice.target && fits(choice.level, w.no));
        choice.target = within.length ? within[within.length - 1].no : firstTarget;
    }

    const modal = document.createElement('div');
    modal.id = 'tp-modal';
    modal.className = 'tp-modal-backdrop';
    document.body.appendChild(modal);

    function draw() {
        const options = ctx.targets.map(w =>
            `<option value="${w.no}" ${w.no === choice.target ? 'selected' : ''} ${fits(choice.level, w.no) ? '' : 'disabled'}>#${w.no} ${tpEscape(tpGpName(w.race))}</option>`).join('');
        const roleButtons = freeRoles.map(r =>
            `<button type="button" class="tp-seg ${r === choice.role ? 'active' : ''}" data-proj="role" data-role="${r}">${TP_CONFIG.engineers.roleNames[r]} <small>${r}</small></button>`).join('');
        const levelButtons = Array.from({ length: levelCount }, (_, i) => i + 1).map(n =>
            `<button type="button" class="tp-seg tp-seg-level ${n === choice.level ? 'active' : ''}" data-proj="level" data-level="${n}" ${fits(n, choice.kind === 'next' ? lastTarget : firstTarget) ? '' : 'disabled'}>${n}</button>`).join('');
        const kindButtons = [['improve', 'Improvement'], ['next', 'Next season']].map(([k, label]) =>
            `<button type="button" class="tp-seg ${k === choice.kind ? 'active' : ''}" data-proj="kind" data-kind="${k}">${label}</button>`).join('');
        const engineer = slots[choice.role] ? TPE.get(slots[choice.role].id) : null;
        const cost = costOf(choice.level, targetOf());
        const gps = targetOf() - ctx.open + 1;
        const isNext = choice.kind === 'next';
        modal.innerHTML = `
            <div class="tp-modal" role="dialog">
                <div class="tp-modal-head">
                    <span class="tp-modal-name">New project</span>
                </div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Type</span>
                    <div class="tp-seg-group" data-testid="kinds">${kindButtons}</div>
                </div>
                <div class="tp-neg-row tp-neg-wrap">
                    <span class="tp-neg-label">${isNext ? 'Prepare' : 'Improve'}</span>
                    <div class="tp-seg-group" data-testid="roles">${roleButtons}</div>
                </div>
                <div class="tp-modal-note tp-proj-eng ${engineer ? '' : 'vacant'}" data-testid="engineer">${engineer ? 'Engineer: ' + tpEscape(engineer.name) : (isNext ? 'Vacant position' : 'Vacant position: the project will not grow')}</div>
                ${isNext ? '<div class="tp-modal-note" data-testid="next-note">Prepares the next season: it does not change the car this year, and ties the engineer up until the season ends.</div>' : ''}
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Effort</span>
                    <div class="tp-seg-group" data-testid="levels">${levelButtons}</div>
                </div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Target</span>
                    ${isNext ? '<span class="tp-neg-value">End of the season</span>' : `<select class="tp-proj-select" data-proj="target">${options}</select>`}
                </div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Cost</span>
                    <span class="tp-neg-value tp-neg-coins" data-testid="cost">${TeamPrincipal.gaugeIcons(cost, '$', 'tp-finance tp-cost', Math.max(2, Math.ceil(cost - 1e-9)))}</span>
                    <span class="tp-neg-unit" data-testid="gps">${gps} GP${gps > 1 ? 's' : ''}</span>
                </div>
                <div class="tp-neg-row">
                    <span class="tp-neg-label">Allowed</span>
                    <span data-testid="budget">${TeamPrincipal.financeIcons(ctx.cap, ctx.dev.spent + cost, Math.max(1, Math.ceil(ctx.cap - 1e-9)))}</span>
                </div>
                <div class="tp-modal-actions">
                    <button type="button" class="tp-eng-btn" data-proj="cancel">Cancel</button>
                    <button type="button" class="tp-eng-btn hire" data-proj="submit" ${fits(choice.level, targetOf()) ? '' : 'disabled'}>Start project</button>
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
        const target2 = choice.kind === 'next' ? ctx2.targets[ctx2.targets.length - 1].no : choice.target;
        const cost = TPP.projectCost(choice.level, ctx2.open, target2);
        if (!ctx2.canStart || ctx2.dev.projects[choice.role] || cost > ctx2.avail + 1e-9 ||
            !ctx2.targets.some(w => w.no === target2)) {
            tpCloseModal(); renderTeamManagement(); return;
        }
        TPP.create(ctx2.dev, choice.role, target2, choice.level, ctx2.open, choice.kind);
        TeamPrincipal.writeCurrentSlot(s2);
        // The whole cost is consumed for good.
        tpSetTeamGauge(team2.teamUid, 'finance', TeamPrincipal.teamGauges(team2).finance - cost);
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
        if (act === 'kind') { choice.kind = b.dataset.kind; if (choice.kind === 'next') { while (choice.level > 1 && !fits(choice.level, lastTarget)) choice.level--; } }
        if (act === 'level') { choice.level = parseInt(b.dataset.level, 10); fitTarget(); }
        draw();
    });
    modal.addEventListener('change', ev => {
        if (ev.target.dataset && ev.target.dataset.proj === 'target') { choice.target = parseInt(ev.target.value, 10); draw(); }
    });
    draw();
}

// ---- season review: what the last season changed, shown once when the tab is first opened ----

function tpOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Objective (the expected rank) and current position in the constructors' championship, under the gauges.
function tpRankRowsHtml(tp, teams, team) {
    if (typeof TeamPrincipalSatisfaction === 'undefined') return '';
    const s = TeamPrincipalSatisfaction.standing(tp, teams, team);
    const state = s.position === null ? '' : (s.position < s.objective ? 'up' : (s.position > s.objective ? 'down' : ''));
    return `<div class="tp-gauge-row"><span class="tp-gauge-label">Objective</span><span class="tp-rank" data-testid="objective">${tpOrdinal(s.objective)}</span></div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Position</span><span class="tp-rank ${state}" data-testid="position">${s.position === null ? '-' : tpOrdinal(s.position)}</span></div>`;
}

// Resolves once the player has pressed OK (at once when there is nothing to show).
function tpShowSeasonRecap() {
    return new Promise(resolve => {
    if (document.getElementById('tp-modal')) return resolve();
    const slot = TeamPrincipal.readCurrentSlot();
    const tp = slot && slot.data && slot.data.teamPrincipal;
    const r = tp && tp.recap;
    if (!r || r.seen) return resolve();

    const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n * 100) / 100);
    const cls = n => (n > 0 ? 'up' : n < 0 ? 'down' : '');
    const row = (label, value, klass) => `<div class="tp-result-row"><span class="tp-result-role">${label}</span><span class="tp-result-gain ${klass || ''}">${value}</span></div>`;
    const cp = r.confidence.parts;
    const startYear = parseInt(localStorage.getItem('careerStartYear') || '0', 10) || TP_CONFIG.engineers.baseYear;
    const rows = [
        row('Final position', `${tpOrdinal(r.rank)} of ${r.teamCount}`, ''),
        row('Finance', signed(r.finance.gain) + ' $', cls(r.finance.gain)),
        row('Prestige', `${r.prestige.before} → ${r.prestige.after}`, cls(r.prestige.after - r.prestige.before)),
        row('Confidence', `${signed(r.confidence.after - r.confidence.before)} ♥`, cls(r.confidence.after - r.confidence.before))
    ];
    const why = [];
    if (r.rank === 1) why.push('Champions: ' + signed(cp.result));
    else if (cp.result > 0) why.push('Above expectations (' + tpOrdinal(r.expected || r.prevRank) + '): ' + signed(cp.result));
    else if (cp.result < 0) why.push('Below expectations (' + tpOrdinal(r.expected || r.prevRank) + '): ' + signed(cp.result));
    if (cp.noDismissal) why.push('No dismissal: ' + signed(cp.noDismissal));
    const engineers = [];
    if (r.released.length) engineers.push(`<div class="tp-modal-note">Contract ended: ${r.released.map(tpEscape).join(', ')}</div>`);
    if (r.retired.length) engineers.push(`<div class="tp-modal-note">Retired: ${r.retired.map(tpEscape).join(', ')}</div>`);

    const modal = document.createElement('div');
    modal.id = 'tp-modal';
    modal.className = 'tp-modal-backdrop';
    modal.innerHTML = `
        <div class="tp-modal" role="dialog">
            <div class="tp-modal-head"><span class="tp-modal-name">${startYear + r.season - 1} season review</span></div>
            ${rows.join('')}
            ${why.length ? `<div class="tp-modal-note" data-testid="why">${why.join(' · ')}</div>` : ''}
            ${engineers.join('')}
            <div class="tp-modal-actions"><button type="button" class="tp-eng-btn hire" data-review="ok">OK</button></div>
        </div>`;
    modal.addEventListener('click', ev => {
        if (!ev.target.closest('[data-review="ok"]')) return;
        const s2 = TeamPrincipal.readCurrentSlot();
        if (s2 && s2.data.teamPrincipal && s2.data.teamPrincipal.recap) {
            s2.data.teamPrincipal.recap.seen = true;
            TeamPrincipal.writeCurrentSlot(s2);
        }
        tpCloseModal();
        resolve();
    });
    document.body.appendChild(modal);
    });
}

// ---- satisfaction: updated when the GP screen opens; a dismissal is announced once ----

// Everything the player must see before a GP weekend can start, one pop-up after the other and
// none of them can be skipped (they come back on reload until dealt with): a dismissal, the review of the
// season that just ended, the local offer of the new season. Resolves when all are done.
function tpRunSeasonStart() {
    if (typeof TeamPrincipal === 'undefined' || !TeamPrincipal.isActive() ||
        localStorage.getItem('championshipActive') !== 'true') return Promise.resolve();
    TeamPrincipalSatisfaction.check();
    // TeamPrincipalSatisfaction.report();   // console report of the expected ranks (uncomment to check a save)
    return TPE.load().catch(() => {})
        .then(() => tpShowDismissal())
        .then(() => tpShowSeasonRecap())
        .then(() => tpShowPreseason())
        .then(() => tpShowLocalOffer());
}

// What the season opening did to the stats: the new regulation's starting values, or the automatic
// pre-season development. Shown once, for the player's team.
function tpShowPreseason() {
    return new Promise(resolve => {
        if (document.getElementById('tp-modal')) return resolve();
        const slot = TeamPrincipal.readCurrentSlot();
        const tp = slot && slot.data && slot.data.teamPrincipal;
        const pre = tp && tp.pre;
        if (!pre || pre.seen || !pre.rows || !pre.rows.length) return resolve();
        const names = TP_CONFIG.engineers.roleNames;
        const rows = pre.rows.map(r => pre.regulation
            ? `<div class="tp-result-row"><span class="tp-result-role">${names[r.role]} <small>${r.role}</small></span>
                   <span class="tp-result-gain none" data-testid="stat-${r.role}">${r.before} → ${Math.round(r.after)}</span></div>`
            : `<div class="tp-result-row"><span class="tp-result-role">${names[r.role]} <small>${r.role}</small></span>
                   <span class="tp-result-gain ${r.gain > 0 ? 'up' : 'none'}" data-testid="gain-${r.role}">${r.gain > 0 ? '+' + Math.round(r.gain) : 'no gain'}</span>
                   <span class="tp-result-max">up to +${Math.round(r.ceiling)}</span></div>`).join('');
        const modal = document.createElement('div');
        modal.id = 'tp-modal';
        modal.className = 'tp-modal-backdrop';
        modal.innerHTML = `
            <div class="tp-modal" role="dialog">
                <div class="tp-modal-head"><span class="tp-modal-name">${pre.regulation ? 'New regulation' : 'Pre-season development'}</span></div>
                <div class="tp-modal-note">${pre.regulation ? 'The car stats start over for every team.' : 'Your engineers worked on the car over the winter.'}</div>
                ${rows}
                <div class="tp-modal-actions"><button type="button" class="tp-eng-btn hire" data-pre="ok">Continue</button></div>
            </div>`;
        modal.addEventListener('click', ev => {
            if (!ev.target.closest('[data-pre="ok"]')) return;
            const s2 = TeamPrincipal.readCurrentSlot();
            if (s2 && s2.data.teamPrincipal && s2.data.teamPrincipal.pre) {
                s2.data.teamPrincipal.pre.seen = true;
                TeamPrincipal.writeCurrentSlot(s2);
            }
            tpCloseModal();
            if (document.getElementById('tab-team-management') && document.querySelector('.tp-subpanel')) renderTeamManagement();
            resolve();
        });
        document.body.appendChild(modal);
    });
}

// The local offer of the season, to take or to leave, next to the engineer currently in that position.
function tpShowLocalOffer() {
    return new Promise(resolve => {
        if (document.getElementById('tp-modal') || !TPE.isLoaded()) return resolve();
        const slot = TeamPrincipal.readCurrentSlot();
        let teams = [];
        try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (e) {}
        const tp = slot && slot.data && slot.data.teamPrincipal;
        const team = tp && TeamPrincipal.findTeamByUid(teams, tp.teamUid);
        if (!team) return resolve();
        const state = tpEnsureEngineerState(slot, teams, team);
        if (!state.local) return resolve();

        const c = TP_CONFIG.engineers;
        const e = TPE.get(state.local.id);
        const cur = TPE.teamSlots(state, team.teamUid)[e.stat];
        const curHtml = cur ? tpEngineerCard(state, team, TPE.get(cur.id), 'hired', cur, true)
                            : '<div class="tp-eng tp-vacant">Vacant position</div>';
        const affordable = TPE.maxOfferCost(state, team, e) + 1e-9 >= TPE.costFor(state, team, e);
        const seasons = TPE.baseSeasons(e);
        const modal = document.createElement('div');
        modal.id = 'tp-modal';
        modal.className = 'tp-modal-backdrop';
        modal.innerHTML = `
            <div class="tp-modal tp-modal-wide" role="dialog">
                <div class="tp-modal-head"><span class="tp-modal-name">Local offer</span>
                    <span class="tp-modal-role">${c.roleNames[e.stat]} <small>${e.stat}</small></span></div>
                <div class="tp-modal-note">A local engineer offers to join the team. Take it or leave it: the offer is gone once the season opens.</div>
                <div class="tp-compare">
                    <div><div class="tp-compare-title">Current</div>${curHtml}</div>
                    <div><div class="tp-compare-title">Offer</div>${tpEngineerCard(state, team, e, 'local', null, true)}</div>
                </div>
                <div class="tp-modal-note">Contract: ${seasons} season${seasons > 1 ? 's' : ''}</div>
                ${cur ? `<div class="tp-modal-warn" data-testid="replace-warning">Replaces ${tpEscape(TPE.get(cur.id).name)}: - ${c.localReplaceConfidenceLoss} ♥</div>` : ''}
                ${affordable ? '' : '<div class="tp-modal-warn">Not enough free $ for this offer.</div>'}
                <div class="tp-modal-actions">
                    <button type="button" class="tp-eng-btn" data-local="decline">Leave it</button>
                    <button type="button" class="tp-eng-btn hire" data-local="accept" ${affordable ? '' : 'disabled'}>Take it</button>
                </div>
            </div>`;
        modal.addEventListener('click', ev => {
            const b = ev.target.closest('[data-local]');
            if (!b || b.disabled) return;
            const s2 = TeamPrincipal.readCurrentSlot();
            const st2 = s2.data.engineerState;
            if (b.dataset.local === 'accept') {
                const result = TPE.acceptLocal(st2, team);
                if (!result.ok) return;
                if (result.confidenceLoss) {
                    tpSetTeamGauge(team.teamUid, 'confidence', TeamPrincipal.teamGauges(team).confidence - result.confidenceLoss);
                }
            } else {
                TPE.expireLocal(st2);
            }
            TeamPrincipal.writeCurrentSlot(s2);
            tpCloseModal();
            if (document.getElementById('tab-team-management') && document.querySelector('.tp-subpanel')) renderTeamManagement();
            resolve();
        });
        document.body.appendChild(modal);
    });
}

function tpShowDismissal() {
    return new Promise(resolve => {
    if (document.getElementById('tp-modal')) return resolve();
    const slot = TeamPrincipal.readCurrentSlot();
    const tp = slot && slot.data && slot.data.teamPrincipal;
    const d = tp && tp.dismissal;
    if (!d || d.seen) return resolve();
    const modal = document.createElement('div');
    modal.id = 'tp-modal';
    modal.className = 'tp-modal-backdrop';
    modal.innerHTML = `
        <div class="tp-modal" role="dialog">
            <div class="tp-modal-head"><span class="tp-modal-name">You have been dismissed</span></div>
            <div class="tp-modal-warn" data-testid="dismissal">The board of ${tpEscape(d.from)} has lost confidence in you.</div>
            <div class="tp-modal-note">You are now Team Principal of ${tpEscape(d.to)}.</div>
            <div class="tp-modal-actions"><button type="button" class="tp-eng-btn hire" data-dismissal="ok">OK</button></div>
        </div>`;
    modal.addEventListener('click', ev => {
        if (!ev.target.closest('[data-dismissal="ok"]')) return;
        const s2 = TeamPrincipal.readCurrentSlot();
        if (s2 && s2.data.teamPrincipal && s2.data.teamPrincipal.dismissal) {
            s2.data.teamPrincipal.dismissal.seen = true;
            TeamPrincipal.writeCurrentSlot(s2);
        }
        tpCloseModal();
        if (document.getElementById('tab-team-management') && document.querySelector('.tp-subpanel')) renderTeamManagement();
        resolve();
    });
    document.body.appendChild(modal);
    });
}

// ---- as each GP weekend opens: projects grow, and the ones reaching their target GP are drawn ----
// The research is over before the GP: the results are in the car's stats, and shown, as soon as
// the weekend page opens (a weekend that has been raced already belongs to the previous GP).

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

// Runs the development of the weekend being opened (once per weekend). Resolves with the
// finished projects' outcomes (possibly none); they also wait in dev.pending until shown.
function tpDevelopBeforeRace() {
    if (typeof TeamPrincipal === 'undefined' || !TeamPrincipal.isActive()) return Promise.resolve([]);
    return TPE.load().then(() => {
        const slot = TeamPrincipal.readCurrentSlot();
        const tp = slot && slot.data && slot.data.teamPrincipal;
        if (!tp) return [];
        // (No engineer world yet means the tab was never opened: no project can exist, but the
        // weekend is still counted so a project started now can't target this one.)
        const state = slot.data.engineerState;
        let teams = [];
        try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (err) {}
        const team = TeamPrincipal.findTeamByUid(teams, tp.teamUid);
        if (!team) return [];

        const dev = TPP.ensure(tp, tpSeasonNumber());
        const races = tpRaces();
        const weekendNo = TPP.weekendNoOfRace(races, parseInt(localStorage.getItem('championshipCurrentRace') || '0', 10));
        const slots = state ? TPE.teamSlots(state, team.teamUid) : {};
        const outcomes = TPP.processUpTo(dev, weekendNo,
            role => slots[role] ? TPE.get(slots[role].id).value : 0,
            role => parseFloat(team['team' + role]) || 0);
        TeamPrincipal.writeCurrentSlot(slot);
        if (outcomes.length) tpApplyTeamStats(team.teamUid, outcomes);
        return outcomes;
    });
}

// The weekend page opened: run its development, then show what finished. The weekend is processed
// the first time its page opens - at the sprint when there is one, never between the sprint and the GP.
function tpRunWeekendDevelopment() {
    if (typeof TeamPrincipal === 'undefined' || !TeamPrincipal.isActive() ||
        localStorage.getItem('championshipActive') !== 'true') return Promise.resolve();
    let results = [];
    try { results = JSON.parse(localStorage.getItem('championshipResults') || '[]'); } catch (e) {}
    const idx = parseInt(localStorage.getItem('championshipCurrentRace') || '0', 10);
    if (Array.isArray(results[idx]) && results[idx].length > 0) return Promise.resolve();
    return tpDevelopBeforeRace().then(() => tpShowPendingDevelopment());
}

// Results not shown yet (kept in the save, so a reload before pressing OK doesn't lose them).
function tpShowPendingDevelopment() {
    if (document.getElementById('tp-modal')) return;
    const slot = TeamPrincipal.readCurrentSlot();
    const dev = slot && slot.data && slot.data.teamPrincipal && slot.data.teamPrincipal.dev;
    if (!dev || !dev.pending || !dev.pending.length) return;
    tpShowDevelopmentResults(dev.pending, () => {
        const s2 = TeamPrincipal.readCurrentSlot();
        if (s2 && s2.data.teamPrincipal && s2.data.teamPrincipal.dev) {
            TPP.takePending(s2.data.teamPrincipal.dev);
            TeamPrincipal.writeCurrentSlot(s2);
        }
        if (document.getElementById('tab-team-management') && document.querySelector('.tp-subpanel')) renderTeamManagement();
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
            <span class="tp-result-gain ${o.gain > 0 ? 'up' : 'none'}" data-testid="gain-${o.role}">${o.gain > 0 ? '+' + Math.round(o.gain) : 'no gain'}</span>
            <span class="tp-result-max">up to +${Math.round(o.ceiling)}</span>
        </div>`).join('');
    modal.innerHTML = `
        <div class="tp-modal" role="dialog">
            <div class="tp-modal-head"><span class="tp-modal-name">Development results</span></div>
            <div class="tp-modal-note">${tpEscape(tpGpLabel(outcomes[0].weekendNo))}</div>
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

// `renew`: the same dialog for extending the contract of an engineer already in the team.
function tpOpenNegotiation(engineerId, renew) {
    tpCloseModal();
    const slot = TeamPrincipal.readCurrentSlot();
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (err) {}
    const team = TeamPrincipal.findTeamByUid(teams, slot.data.teamPrincipal.teamUid);
    const state = slot.data.engineerState;
    const e = TPE.get(engineerId);
    if (!team || !state || !e) return;
    if (renew && !TPE.canRenew(state, team, e.stat).ok) return;

    const first = TPE.assess(state, team, e, TPE.baseSeasons(e), TPE.costFor(state, team, e));
    const maxSeasons = renew ? TPE.renewMaxSeasons(state, e) : TPE.maxSeasons(state, e);
    const baseCost = first.baseCost;
    const maxCost = TPE.maxOfferCost(state, team, e);
    // Replacing an engineer is a dismissal; renewing the one in place is not.
    const occupant = renew ? null : TPE.teamSlots(state, team.teamUid)[e.stat];
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
                    <span class="tp-modal-role">${c.roleNames[e.stat]} <small>${e.stat}</small>${renew ? ' · Renewal' : ''}</span>
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
        const result = renew
            ? TPE.renew(state, team, e.stat, { seasons: offer.seasons, cost: offer.cost })
            : TPE.hire(state, team, engineerId, { seasons: offer.seasons, cost: offer.cost });
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
                    <div class="tp-modal-warn" data-testid="refused">He refused your offer. The team loses ${result.confidenceLoss} confidence and ${renew ? 'he will leave when the season ends' : "he won't talk to you again this season"}.</div>
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
    TPE.load().then(() => { tpRenderTab(host); tpShowSeasonRecap(); });
}

// ---- Season tab: the calendar and the points rules, read-only (a Team Principal doesn't set them) ----

function tpPointsRow(scale) {
    const scored = scale.map((p, i) => ({ pos: i + 1, p: p })).filter(x => x.p > 0);
    return '<div class="tp-rules-points">' + scored.map(x =>
        '<span class="tp-rules-pt"><b>P' + x.pos + '</b> ' + x.p + '</span>').join('') + '</div>';
}

function renderSeasonInfo() {
    const host = document.getElementById('tab-season');
    if (!host) return;
    const races = tpRaces();
    const current = parseInt(localStorage.getItem('championshipCurrentRace') || '0', 10);
    const results = JSON.parse(localStorage.getItem('championshipResults') || '[]');
    const year = TeamPrincipal.currentYear();
    const points = JSON.parse(localStorage.getItem('championshipPoints') || 'null') || [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    const rows = [];
    races.forEach((race, i) => {
        if (race.isSprintRace) return;
        const sprint = i > 0 && races[i - 1].isSprintRace && races[i - 1].circuit === race.circuit;
        const played = Array.isArray(results[i]) && results[i].length > 0;
        const cls = 'tp-cal-row' + (played ? ' played' : (i === current || (sprint && i - 1 === current) ? ' next' : ''));
        // The Grand Prix's winner and team, its pole (starting P1) and the holder of the fastest lap.
        let winner = '', team = '', pole = '', fastest = '';
        if (played) {
            const classified = ChampionshipCommon.raceClassification(race, results[i], points).filter(r => !r.retired);
            if (classified[0]) { winner = classified[0].name; team = classified[0].team; }
            const poleRow = results[i].find(d => d && d.startPosition === 1);
            const flRow = results[i].find(d => d && d.fastestLapOfRace);
            pole = poleRow ? poleRow.name : '';
            fastest = flRow ? flRow.name : '';
        }
        const cell = v => '<td>' + (v ? tpEscape(v) : '<span class="tp-cal-none">-</span>') + '</td>';
        rows.push('<tr class="' + cls + '"><td class="tp-cal-no">' + (rows.length + 1) + '</td>' +
            '<td class="tp-cal-badge">' + (sprint ? '<span class="tp-cal-sprint">Sprint</span>' : '') + '</td>' +
            '<td class="tp-cal-name">' + tpEscape(tpGpName(race)) + '</td>' +
            '<td class="tp-cal-country">' + tpEscape(race.country || '') + '</td>' +
            cell(winner) + cell(team) + cell(pole) + cell(fastest) + '</tr>');
    });

    const sprintPoints = JSON.parse(localStorage.getItem('championshipPointsSprint') || 'null') || [8, 7, 6, 5, 4, 3, 2, 1];
    const flPoint = localStorage.getItem('championshipFastestLapPoint') === 'true';
    const flTop = parseInt(localStorage.getItem('championshipFastestLapTopN') || '10', 10);
    const polePts = parseInt(localStorage.getItem('championshipPolePositionPoints') || '0', 10);

    host.innerHTML =
        '<div class="tp-section">Calendar ' + year + '<span class="tp-section-note">' + rows.length + ' Grand Prix</span></div>' +
        '<div class="tp-cal-scroll"><table class="tp-cal"><thead><tr><th>#</th><th></th><th>Grand Prix</th><th>Country</th>' +
            '<th>Winner</th><th>Team</th><th>Pole</th><th>Fastest lap</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
        '<div class="tp-section">Points<span class="tp-section-note">Grand Prix</span></div>' + tpPointsRow(points) +
        '<div class="tp-section">Points<span class="tp-section-note">Sprint</span></div>' + tpPointsRow(sprintPoints) +
        '<div class="tp-section">Bonus</div>' +
        '<ul class="tp-rules-list">' +
        '<li>Fastest lap: ' + (flPoint ? '1 point' + (flTop > 0 ? ' if classified in the top ' + flTop : '') : 'no point') + '</li>' +
        '<li>Pole position: ' + (polePts > 0 ? polePts + ' point' + (polePts > 1 ? 's' : '') : 'no point') + '</li>' +
        '</ul>';
}

// ---- My Career tab: the manager's record over all the seasons (from TeamPrincipalCareer) ----

function renderTeamPrincipalCareer() {
    const host = document.getElementById('tab-tp-career');
    if (!host) return;
    const slot = TeamPrincipal.readCurrentSlot();
    const tp = slot && slot.data && slot.data.teamPrincipal;
    if (!tp) { host.innerHTML = ''; return; }
    const t = TeamPrincipalCareer.totals(tp.career);
    const esc = tpEscape;
    const stat = (label, value) => `<div class="tp-career-stat"><div class="tp-career-value">${value}</div><div class="tp-career-label">${label}</div></div>`;

    let teams = [];
    try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (e) {}
    const team = TeamPrincipal.findTeamByUid(teams, tp.teamUid);
    const now = team ? TeamPrincipalSatisfaction.standing(tp, teams, team) : null;
    const year = TeamPrincipal.currentYear();

    if (!t.seasons) {
        host.innerHTML = `<div class="tp-section">Career</div>
            <div class="tp-empty">No season completed yet. Your record starts at the end of ${year}.</div>` + tpCareerCurrentHtml(team, now, year);
        return;
    }

    const seasonRows = tp.career.seasons.slice().reverse().map(s => {
        const best = s.drivers && s.drivers[0];
        return `<tr>
            <td class="tp-cal-no">${s.year}</td>
            <td class="tp-cal-name">${esc(s.team)}${s.dismissedFrom ? ` <span class="tp-cal-none">(after ${esc(s.dismissedFrom)})</span>` : ''}</td>
            <td class="tp-rank ${s.rank === 1 ? 'up' : ''}">${tpOrdinal(s.rank)}<span class="tp-cal-none"> / ${s.teams}</span></td>
            <td>${s.expected ? tpOrdinal(s.expected) : '-'}</td>
            <td>${s.points}</td><td>${s.wins}</td><td>${s.poles}</td>
            <td>${best ? esc(best.name) + ' <span class="tp-cal-none">(' + best.points + ')</span>' : '-'}</td></tr>`;
    }).join('');

    host.innerHTML = `
        <div class="tp-section">Career<span class="tp-section-note">${t.seasons} season${t.seasons > 1 ? 's' : ''} completed</span></div>
        <div class="tp-career-stats">
            ${stat('Titles', t.titles)}${stat('Top 3 finishes', t.top3)}${stat('Wins', t.wins)}${stat('Poles', t.poles)}
            ${stat('Fastest laps', t.fastestLaps)}${stat('Points', t.points)}
            ${stat('Best finish', t.best ? tpOrdinal(t.best.rank) : '-')}${stat('Objectives met', t.objectivesMet + ' / ' + t.seasons)}
            ${stat('Dismissals', t.dismissals)}
        </div>
        <div class="tp-section">Teams managed</div>
        <div class="tp-cal-scroll"><table class="tp-cal"><thead><tr><th>Team</th><th>Years</th><th>Seasons</th><th>Titles</th><th>Wins</th><th>Points</th></tr></thead><tbody>
            ${t.teams.map(x => `<tr><td class="tp-cal-name">${esc(x.team)}</td><td>${x.from}${x.to !== x.from ? ' - ' + x.to : ''}</td><td>${x.seasons}</td><td>${x.titles}</td><td>${x.wins}</td><td>${x.points}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="tp-section">Best drivers<span class="tp-section-note">points scored for your teams</span></div>
        <div class="tp-cal-scroll"><table class="tp-cal"><thead><tr><th>Driver</th><th>Points</th><th>Wins</th><th>Seasons</th></tr></thead><tbody>
            ${t.drivers.slice(0, 5).map(d => `<tr><td class="tp-cal-name">${esc(d.name)}</td><td>${d.points}</td><td>${d.wins}</td><td>${d.seasons}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="tp-section">Season by season</div>
        <div class="tp-cal-scroll"><table class="tp-cal"><thead><tr><th>Year</th><th>Team</th><th>Position</th><th>Objective</th><th>Points</th><th>Wins</th><th>Poles</th><th>Best driver</th></tr></thead><tbody>
            ${seasonRows}
        </tbody></table></div>` + tpCareerCurrentHtml(team, now, year);
}

// The season in progress: only where the team stands, its record is written when it ends.
function tpCareerCurrentHtml(team, now, year) {
    if (!team || !now) return '';
    return `<div class="tp-section">${year}<span class="tp-section-note">in progress</span></div>
        <div class="tp-career-now">${tpEscape(TeamPrincipal.teamName(team))} · objective ${tpOrdinal(now.objective)} · position ${now.position === null ? '-' : tpOrdinal(now.position)}</div>`;
}
