// ============================================================
// TEAM_PRINCIPAL_COMMON.JS
// Shared helpers for the Team Principal career mode: stable team identity,
// team gauges ($ / heart / star), player state stored in the career slot.
// Requires data/team_principal_config.js (TP_CONFIG).
// ============================================================

const TeamPrincipal = (function () {
    const MODE = 'teamPrincipal';

    function slugify(name) {
        return String(name || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'team';
    }

    // Stable identity for a team. team_id is only the row position and is
    // reassigned every season, so it can't identify the player's team.
    function newTeamUid(name) {
        return slugify(name) + '_' + Math.random().toString(36).slice(2, 7);
    }

    function clampGauge(v, fallback) {
        const n = parseFloat(v);
        const x = Number.isFinite(n) ? n : fallback;
        return Math.max(0, Math.min(TP_CONFIG.gauges.max, x));
    }

    function teamGauges(team) {
        const g = TP_CONFIG.gauges;
        return {
            finance: clampGauge(team && team.finance, g.defaultFinance),
            confidence: clampGauge(team && team.confidence, g.defaultConfidence),
            prestige: clampGauge(team && team.prestige, g.defaultPrestige)
        };
    }

    function teamName(t) { return (t && (t.team || t.name)) || ''; }

    function findTeamByUid(teams, uid) {
        return (teams || []).find(t => t.teamUid === uid) || null;
    }

    // ---- player state, stored in the career slot (slot.data.mode / .teamPrincipal) ----

    function slotKey(slotNumber) { return 'careerSlot' + slotNumber; }

    function readSlot(slotNumber) {
        try { return JSON.parse(localStorage.getItem(slotKey(slotNumber)) || 'null'); } catch (e) { return null; }
    }

    // True when the live session is a Team Principal career.
    function isActive() {
        return localStorage.getItem('careerMode') === 'true' &&
               localStorage.getItem('careerType') === MODE;
    }

    function getState() {
        const slot = readSlot(parseInt(localStorage.getItem('championshipSlotNumber') || '0', 10));
        return (slot && slot.data && slot.data.mode === MODE && slot.data.teamPrincipal) || null;
    }

    function currentSlotNumber() { return parseInt(localStorage.getItem('championshipSlotNumber') || '0', 10); }

    function readCurrentSlot() { return readSlot(currentSlotNumber()); }

    // Read-modify-write of the live career slot (autoSaveChampionship carries
    // mode / teamPrincipal / engineerState over, so writing the slot directly is safe).
    function writeCurrentSlot(slot) {
        localStorage.setItem(slotKey(currentSlotNumber()), JSON.stringify(slot));
    }

    // Calendar year of the season being played.
    function currentYear() {
        const start = parseInt(localStorage.getItem('careerStartYear') || '0', 10) || TP_CONFIG.engineers.baseYear;
        return start + (parseInt(localStorage.getItem('careerSeasonNumber') || '1', 10) - 1);
    }

    function initialState(teamUid) {
        return { teamUid: teamUid, satisfaction: TP_CONFIG.satisfaction.start };
    }

    // ---- rendering ----

    // Coins carry their $ in a child so its size is independent of the icon box.
    function iconGlyph(glyph) {
        return glyph === '$' ? '<i class="tp-coin-glyph">$</i>' : glyph;
    }

    // `count` icons (default: the gauge max), each filled from `value` (1 = one full icon).
    function gaugeIcons(value, glyph, cls, count) {
        const max = count || TP_CONFIG.gauges.max;
        let html = '<span class="tp-icons ' + cls + '">';
        for (let i = 0; i < max; i++) {
            const fill = Math.max(0, Math.min(1, value - i));
            html += '<span class="tp-icon" style="--fill:' + (fill * 100) + '%">' + iconGlyph(glyph) + '</span>';
        }
        return html + '</span>';
    }

    // Finance gauge in three tones per icon: committed (contracts), free, and the
    // rest of the ceiling that this team's finance doesn't reach.
    // `count` icons (default: the gauge max).
    function financeIcons(total, committed, count) {
        const max = count || TP_CONFIG.gauges.max;
        const clamp01 = x => Math.max(0, Math.min(1, x));
        let html = '<span class="tp-icons tp-finance-tri">';
        for (let i = 0; i < max; i++) {
            const c = clamp01(committed - i) * 100;
            const t = clamp01(total - i) * 100;
            html += '<span class="tp-icon" style="--c:' + c + '%;--t:' + Math.max(c, t) + '%">' + iconGlyph('$') + '</span>';
        }
        return html + '</span>';
    }

    function satisfactionBar(value) {
        const pct = Math.max(0, Math.min(100, (value / TP_CONFIG.satisfaction.max) * 100));
        return '<div class="tp-sat-track"><div class="tp-sat-marker" style="left:' + pct + '%"></div></div>';
    }

    return { MODE, newTeamUid, teamGauges, teamName, findTeamByUid, isActive, getState,
             currentSlotNumber, readCurrentSlot, writeCurrentSlot, currentYear,
             initialState, gaugeIcons, financeIcons, satisfactionBar };
})();
