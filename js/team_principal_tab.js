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
        <h3 class="tp-section">Drivers</h3>
        <div class="tp-eng-columns">
            ${column('Driver 1', mine[0])}
            ${column('Driver 2', mine[1])}
            ${column('Reserve', null)}
        </div>`;
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

    // First visit (or a save older than the current year): build / advance the engineer world.
    const year = TeamPrincipal.currentYear();
    let dirty = false;
    if (!slot.data.engineerState) { slot.data.engineerState = TPE.initState(teams, year, team); dirty = true; }
    else if (slot.data.engineerState.year < year) { TPE.advanceYear(slot.data.engineerState, year, team); dirty = true; }
    if (tpExpireLocalIfSeasonStarted(slot.data.engineerState)) dirty = true;
    if (dirty) TeamPrincipal.writeCurrentSlot(slot);
    const state = slot.data.engineerState;

    const g = TeamPrincipal.teamGauges(team);
    const name = TeamPrincipal.teamName(team);
    const flag = String(team.flag || 'uk').replace(/^img\/flags\//, '').replace(/\.png$/, '');
    const image = String(team.image || '').replace(/^img\/cars\//, '').replace(/\.png$/, '');
    const committed = TPE.committed(state, team.teamUid);
    const slots = TPE.teamSlots(state, team.teamUid);

    // Only shown while the offer is open (start of the season, before the first race).
    const localHtml = state.local ? `
        <h3 class="tp-section">Local offer</h3>
        <div class="tp-local">${tpEngineerCard(state, team, TPE.get(state.local.id), 'local')}</div>` : '';

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
            <div class="tp-gauge-row"><span class="tp-gauge-label">Satisfaction</span>${TeamPrincipal.satisfactionBar(tp.satisfaction)}</div>
        </div>
        ${tpCarStatsHtml(team)}
        </div>
        ${tpDriversHtml(teams, team)}
        ${localHtml}
        <h3 class="tp-section">Engineers</h3>
        <div class="tp-eng-columns">${columns}</div>
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
