// ============================================================
// TEAM_PRINCIPAL_ENGINEERS.JS
// Engineer cards for the Team Principal mode: who works where, the four
// general decks (one per position) and the yearly local card.
//
// State (stored in slot.data.engineerState, keyed by teamUid so it survives
// the team_id reshuffle at season end):
//   { year, teams: { uid: { SPD, FS, SS, FB } }, decks: { SPD:[ids], ... }, local: {id} | null }
//   where each team slot is { id, contractLeft } or null (vacant).
// Requires data/team_principal_config.js and team_principal_common.js.
// ============================================================

const TeamPrincipalEngineers = (function () {
    const ROLES = ['SPD', 'FS', 'SS', 'FB'];
    const cfg = () => TP_CONFIG.engineers;
    let cache = null; // { list, byId }

    function load() {
        if (cache) return Promise.resolve(cache);
        return fetch('data/engineer_default.json').then(r => r.json()).then(list => {
            cache = { list: list, byId: new Map(list.map(e => [e.engineer_id, e])) };
            return cache;
        });
    }

    function get(id) { return cache ? cache.byId.get(id) : undefined; }
    function isLoaded() { return !!cache; }

    // Retirement is a pure function of the calendar year: everyone's counter runs
    // from baseYear, whether or not they have a team.
    function isAlive(e, year) { return e.active_from <= year && year < cfg().baseYear + e.retire_in; }
    function lastSeason(e) { return cfg().baseYear + e.retire_in - 1; }

    function regionOf(flag) {
        const name = String(flag || '').replace(/^img\/flags\//, '').replace(/\.png$/, '');
        return cfg().mainRegions.indexOf(name) >= 0 ? name : 'row';
    }

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function emptySlots() { return { SPD: null, FS: null, SS: null, FB: null }; }
    function teamSlots(state, uid) { return state.teams[uid] || emptySlots(); }

    function usedIds(state) {
        const used = new Set();
        Object.keys(state.teams).forEach(uid => ROLES.forEach(r => {
            const s = state.teams[uid][r];
            if (s) used.add(s.id);
        }));
        ROLES.forEach(r => state.decks[r].forEach(id => used.add(id)));
        if (state.local) used.add(state.local.id);
        return used;
    }

    // Engineers in the game this year that nobody holds and no deck shows.
    function pool(state, year, filter) {
        const used = usedIds(state);
        return cache.list.filter(e => isAlive(e, year) && !used.has(e.engineer_id) && (!filter || filter(e)));
    }

    function fillDecks(state, year) {
        ROLES.forEach(role => {
            while (state.decks[role].length < cfg().deckSize) {
                const candidates = pool(state, year, e => e.stat === role);
                if (!candidates.length) break;
                state.decks[role].push(pick(candidates).engineer_id);
            }
        });
    }

    // A card entering a deck may push the deck over its size: the last other card goes
    // back to the pool so a deck never shows more than deckSize. `toFront` puts the
    // card in first position (a released engineer is shown first, so you see him again).
    function addToDeck(state, role, id, toFront) {
        if (toFront) state.decks[role].unshift(id); else state.decks[role].push(id);
        while (state.decks[role].length > cfg().deckSize) {
            const others = state.decks[role].filter(x => x !== id);
            state.decks[role].splice(state.decks[role].indexOf(others[others.length - 1]), 1);
        }
    }

    function drawLocal(state, year, playerTeam) {
        state.local = null;
        if (!playerTeam) return;
        const region = regionOf(playerTeam.flag);
        const candidates = pool(state, year, e => regionOf(e.country) === region);
        if (candidates.length) state.local = { id: pick(candidates).engineer_id };
    }

    // teams: the grid; playerTeam: the managed team (gets the local card).
    function initState(teams, year, playerTeam) {
        const state = { year: year, teams: {}, decks: { SPD: [], FS: [], SS: [], FB: [] }, local: null };
        const uidByName = {};
        teams.forEach(t => { uidByName[TeamPrincipal.teamName(t)] = t.teamUid; });
        cache.list.forEach(e => {
            const uid = e.start ? uidByName[e.start] : null;
            if (!uid || !isAlive(e, year)) return;
            if (!state.teams[uid]) state.teams[uid] = emptySlots();
            state.teams[uid][e.stat] = { id: e.engineer_id, contractLeft: e.contract_seasons || cfg().defaultContractSeasons };
        });
        drawLocal(state, year, playerTeam);
        fillDecks(state, year);
        return state;
    }

    // Season rollover: an unhired local card falls into its position's deck,
    // retirees leave the decks, a new local card is drawn, decks are refilled.
    function advanceYear(state, year, playerTeam) {
        if (state.local) {
            const e = get(state.local.id);
            if (e && isAlive(e, year)) addToDeck(state, e.stat, e.engineer_id);
            state.local = null;
        }
        ROLES.forEach(r => { state.decks[r] = state.decks[r].filter(id => isAlive(get(id), year)); });
        drawLocal(state, year, playerTeam);
        fillDecks(state, year);
        state.year = year;
    }

    // ---- money / eligibility ----

    function effectiveCost(state, e) {
        const local = state.local && state.local.id === e.engineer_id;
        return local ? e.cost * cfg().localCostMultiplier : e.cost;
    }

    // $ locked by this team's contracts (drivers join in a later phase).
    function committed(state, uid) {
        const slots = teamSlots(state, uid);
        return ROLES.reduce((sum, r) => sum + (slots[r] ? get(slots[r].id).cost : 0), 0);
    }

    function freeFinance(state, team) {
        return Math.max(0, TeamPrincipal.teamGauges(team).finance - committed(state, team.teamUid));
    }

    // { ok, reason } - reason is 'confidence' | 'prestige' | 'finance'.
    function eligibility(state, team, e) {
        const g = TeamPrincipal.teamGauges(team);
        // The yearly local card is take-it-or-leave-it: only its price can stop you.
        const isLocal = state.local && state.local.id === e.engineer_id;
        if (!isLocal && g.confidence < e.min_confidence) return { ok: false, reason: 'confidence' };
        if (!isLocal && g.prestige < e.min_prestige) return { ok: false, reason: 'prestige' };
        const slots = teamSlots(state, team.teamUid);
        const replaced = slots[e.stat] ? get(slots[e.stat].id).cost : 0;
        const free = TeamPrincipal.teamGauges(team).finance - committed(state, team.teamUid) + replaced;
        if (free + 1e-9 < effectiveCost(state, e)) return { ok: false, reason: 'finance' };
        return { ok: true };
    }

    function release(state, uid, role) {
        const slot = teamSlots(state, uid)[role];
        if (!slot) return false;
        state.teams[uid][role] = null;
        addToDeck(state, role, slot.id, true);
        return true;
    }

    // Takes a card from a deck (or the local offer). Replacing an engineer counts as a dismissal.
    function hire(state, team, engineerId) {
        const e = get(engineerId);
        const inDeck = e && state.decks[e.stat].indexOf(engineerId) >= 0;
        const isLocal = e && state.local && state.local.id === engineerId;
        if (!inDeck && !isLocal) return { ok: false, reason: 'unavailable' };
        const elig = eligibility(state, team, e);
        if (!elig.ok) return elig;

        const uid = team.teamUid;
        if (!state.teams[uid]) state.teams[uid] = emptySlots();

        // Take the card first: the replaced engineer joins the deck afterwards and
        // must not push the card being hired out of it.
        if (inDeck) state.decks[e.stat].splice(state.decks[e.stat].indexOf(engineerId), 1);
        if (isLocal) state.local = null;
        const dismissed = release(state, uid, e.stat);
        state.teams[uid][e.stat] ={ id: engineerId, contractLeft: cfg().defaultContractSeasons };
        fillDecks(state, state.year);
        return { ok: true, confidenceLoss: dismissed ? cfg().dismissalConfidenceLoss : 0 };
    }

    function fire(state, team, role) {
        return release(state, team.teamUid, role)
            ? { ok: true, confidenceLoss: cfg().dismissalConfidenceLoss }
            : { ok: false, reason: 'vacant' };
    }

    return { ROLES, load, isLoaded, get, isAlive, lastSeason, regionOf, initState, advanceYear, teamSlots,
             effectiveCost, committed, freeFinance, eligibility, hire, fire };
})();
