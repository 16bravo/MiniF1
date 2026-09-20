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
        const state = { year: year, teams: {}, decks: { SPD: [], FS: [], SS: [], FB: [] }, local: null, closed: {},
                        dismissed: {}, grudges: {} };
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
    // The local offer is only open before the season's first race. Left on the
    // table, the card joins its position's general deck (and loses its advantages).
    function expireLocal(state, year) {
        if (!state.local) return false;
        const e = get(state.local.id);
        state.local = null;
        if (e && isAlive(e, year === undefined ? state.year : year)) addToDeck(state, e.stat, e.engineer_id);
        return true;
    }

    function advanceYear(state, year, playerTeam) {
        expireLocal(state, year);
        ROLES.forEach(r => { state.decks[r] = state.decks[r].filter(id => isAlive(get(id), year)); });
        drawLocal(state, year, playerTeam);
        fillDecks(state, year);
        state.closed = {}; // refusals only last until the end of the season
        // Engineers dismissed this season may be approached again, but they hold a grudge:
        // that team pays them more to come back.
        Object.keys(state.dismissed || {}).forEach(uid => state.dismissed[uid].forEach(id => listAdd(state, 'grudges', uid, id)));
        state.dismissed = {};
        state.year = year;
    }

    // ---- money / eligibility ----

    function effectiveCost(state, e) {
        const local = state.local && state.local.id === e.engineer_id;
        return local ? e.cost * cfg().localCostMultiplier : e.cost;
    }

    // What a contract blocks: the salary agreed when signing (falls back to the card's base cost).
    function slotCost(slot) { return slot ? (slot.cost !== undefined ? slot.cost : get(slot.id).cost) : 0; }

    // $ locked by this team's contracts (drivers join in a later phase).
    function committed(state, uid) {
        const slots = teamSlots(state, uid);
        return ROLES.reduce((sum, r) => sum + slotCost(slots[r]), 0);
    }

    function freeFinance(state, team) {
        return Math.max(0, TeamPrincipal.teamGauges(team).finance - committed(state, team.teamUid));
    }

    function round2(x) { return Math.round(x * 100) / 100; }

    // ---- contract negotiation (spec section 8.3) ----

    function baseSeasons(e) { return e.contract_seasons || cfg().negotiation.defaultBaseSeasons; }

    // Longest contract that can be offered: the global cap, and never past his retirement.
    function maxSeasons(state, e) {
        return Math.max(1, Math.min(cfg().negotiation.maxSeasons, lastSeason(e) - state.year + 1));
    }

    // Per-team lists of engineer ids kept in the state (state.closed / dismissed / grudges).
    function listHas(state, key, uid, id) {
        return !!(state[key] && state[key][uid] && state[key][uid].indexOf(id) >= 0);
    }
    function listAdd(state, key, uid, id) {
        if (!state[key]) state[key] = {};
        if (!state[key][uid]) state[key][uid] = [];
        if (state[key][uid].indexOf(id) < 0) state[key][uid].push(id);
    }
    function listRemove(state, key, uid, id) {
        if (listHas(state, key, uid, id)) state[key][uid].splice(state[key][uid].indexOf(id), 1);
    }

    // Refused the team's offer this season: he won't talk to it again until the season ends.
    function isClosed(state, uid, id) { return listHas(state, 'closed', uid, id); }
    // Dismissed by the team this season: visible in the market but won't come back before it ends.
    function isDismissed(state, uid, id) { return listHas(state, 'dismissed', uid, id); }
    // Dismissed by the team in an earlier season: he comes back, at a premium.
    function hasGrudge(state, uid, id) { return listHas(state, 'grudges', uid, id); }

    // The base salary this team is asked for: the card's value (local offer discount applied),
    // plus the premium of an engineer it dismissed before.
    function costFor(state, team, e) {
        return round2(effectiveCost(state, e) + (hasGrudge(state, team.teamUid, e.engineer_id) ? cfg().rehirePremium : 0));
    }

    // The team's margin over what the engineer expects. A surplus of trust makes up for
    // a lack of prestige and the other way round; he accepts slightly under his thresholds.
    function margin(team, e) {
        const r = cfg().negotiation.acceptRatio;
        const g = TeamPrincipal.teamGauges(team);
        return (g.confidence - r * e.min_confidence) + (g.prestige - r * e.min_prestige);
    }

    // The most that can be offered as salary: free $ plus what the replaced engineer frees.
    function maxOfferCost(state, team, e) {
        const replaced = slotCost(teamSlots(state, team.teamUid)[e.stat]);
        return round2(TeamPrincipal.teamGauges(team).finance - committed(state, team.teamUid) + replaced);
    }

    // Step 1 - eligibility, i.e. can the engineer be approached at all (this is what the market
    // shows): he hasn't refused us this season; trust OR prestige reaches his threshold (an
    // engineer joins a less prestigious team if he believes in the project, and a prestigious
    // team can win him without trust); and his base salary fits in the free $.
    // The yearly local offer has no threshold. Step 2 is the negotiation (assess / hire).
    function canApproach(state, team, e) {
        if (isClosed(state, team.teamUid, e.engineer_id)) return { ok: false, reason: 'closed' };
        if (isDismissed(state, team.teamUid, e.engineer_id)) return { ok: false, reason: 'dismissed' };
        const g = TeamPrincipal.teamGauges(team);
        const isLocal = !!state.local && state.local.id === e.engineer_id;
        if (!isLocal && g.confidence < e.min_confidence && g.prestige < e.min_prestige) {
            return { ok: false, reason: 'requirements' };
        }
        if (maxOfferCost(state, team, e) + 1e-9 < costFor(state, team, e)) return { ok: false, reason: 'finance' };
        return { ok: true };
    }

    // How an offer (seasons, salary) is received.
    //   negotiate:false -> accepted at base terms (no negotiation: margin >= 0, or the local offer)
    //   verdict: 'accept' | 'hesitant' | 'closed', odds: chance of a deal (1 / 0.75-0.25 / 0).
    function assess(state, team, e, seasons, cost) {
        const n = cfg().negotiation;
        const baseCost = costFor(state, team, e);
        const isLocal = !!state.local && state.local.id === e.engineer_id;
        const M = isLocal ? 0 : margin(team, e);
        const out = { baseCost: baseCost, baseSeasons: baseSeasons(e), margin: M, negotiate: false,
                      targetSeasons: baseSeasons(e), score: null, verdict: 'accept', odds: 1 };
        if (isLocal || M >= 0) return out;

        out.negotiate = true;
        out.targetSeasons = Math.max(1, baseSeasons(e) + Math.round(M / 2));
        const costPoints = Math.round((cost - baseCost) / n.costPointStep * 1e6) / 1e6;
        const S = M + (out.targetSeasons - seasons) * n.pointsPerSeason + costPoints;
        out.score = S;
        if (S >= 0) return out;
        // Bands are read on the integer part: -1 <= S < 0 is the "-1" row of the table, and so on.
        const band = -Math.floor(S);
        if (band > n.hesitantOdds.length) { out.verdict = 'closed'; out.odds = 0; }
        else { out.verdict = 'hesitant'; out.odds = n.hesitantOdds[band - 1]; }
        return out;
    }

    function release(state, uid, role) {
        const slot = teamSlots(state, uid)[role];
        if (!slot) return false;
        state.teams[uid][role] = null;
        addToDeck(state, role, slot.id, true);
        // He won't come back to the team that just dismissed him before the season is over.
        listAdd(state, 'dismissed', uid, slot.id);
        listRemove(state, 'grudges', uid, slot.id);
        return true;
    }

    // Makes an offer to a card of a deck (or to the local offer): `offer` = { seasons, cost }.
    // Without a negotiation the contract is signed at base terms with the chosen length; in a
    // negotiation the engineer may refuse (the team loses confidence and he stops talking to it
    // until the end of the season). Replacing an engineer counts as a dismissal.
    // `roll` is the random source (0..1), injectable for tests.
    function hire(state, team, engineerId, offer, roll) {
        const e = get(engineerId);
        const inDeck = e && state.decks[e.stat].indexOf(engineerId) >= 0;
        const isLocal = e && state.local && state.local.id === engineerId;
        if (!inDeck && !isLocal) return { ok: false, reason: 'unavailable' };
        const can = canApproach(state, team, e);
        if (!can.ok) return can;

        const uid = team.teamUid;
        const seasons = offer && offer.seasons !== undefined ? offer.seasons : baseSeasons(e);
        if (!(seasons >= 1 && seasons <= maxSeasons(state, e) && Math.floor(seasons) === seasons)) {
            return { ok: false, reason: 'seasons' };
        }
        // The salary can be raised above the card's base value (never below it, never above the cap).
        const baseCost = costFor(state, team, e);
        let cost = baseCost;
        if (offer && offer.cost !== undefined) {
            cost = round2(Math.min(Math.max(baseCost, offer.cost), Math.max(baseCost, cfg().negotiation.salaryMax)));
        }
        if (cost > maxOfferCost(state, team, e) + 1e-9) return { ok: false, reason: 'finance' };

        const terms = assess(state, team, e, seasons, cost);
        if (terms.negotiate && terms.verdict !== 'accept') {
            const r = roll ? roll() : Math.random();
            if (!(r < terms.odds)) {
                listAdd(state, 'closed', uid, engineerId);
                return { ok: false, refused: true, confidenceLoss: cfg().negotiation.refusalConfidenceLoss };
            }
        }

        if (!state.teams[uid]) state.teams[uid] = emptySlots();
        // Take the card first: the replaced engineer joins the deck afterwards and
        // must not push the card being hired out of it.
        if (inDeck) state.decks[e.stat].splice(state.decks[e.stat].indexOf(engineerId), 1);
        if (isLocal) state.local = null;
        const dismissed = release(state, uid, e.stat);
        state.teams[uid][e.stat] = { id: engineerId, contractLeft: seasons, cost: cost };
        listRemove(state, 'grudges', uid, engineerId); // reconciled
        fillDecks(state, state.year);
        return { ok: true, confidenceLoss: dismissed ? cfg().dismissalConfidenceLoss : 0, seasons: seasons, cost: cost };
    }

    // ---- renewal: offered during the last season of a contract ----

    // A contract can be renewed during its last season, unless he retires at the end of it.
    function canRenew(state, team, role) {
        const slot = teamSlots(state, team.teamUid)[role];
        if (!slot || slot.contractLeft !== 1) return { ok: false, reason: 'notLastSeason' };
        const e = get(slot.id);
        if (lastSeason(e) <= state.year) return { ok: false, reason: 'retiring' };
        if (isClosed(state, team.teamUid, e.engineer_id)) return { ok: false, reason: 'closed' };
        return { ok: true };
    }

    // Longest renewal: seasons AFTER the current one, capped, and never past his retirement.
    function renewMaxSeasons(state, e) {
        return Math.max(1, Math.min(cfg().negotiation.maxSeasons, lastSeason(e) - state.year));
    }

    // Same negotiation as a hire (the margin is recomputed now). Accepted: the contract is
    // extended by `offer.seasons` after the current season, at the new salary. Refused: the team
    // loses confidence and he won't talk to it again this season - he is released when it ends.
    function renew(state, team, role, offer, roll) {
        const can = canRenew(state, team, role);
        if (!can.ok) return can;
        const uid = team.teamUid;
        const slot = state.teams[uid][role];
        const e = get(slot.id);
        const seasons = offer && offer.seasons !== undefined ? offer.seasons : baseSeasons(e);
        if (!(seasons >= 1 && seasons <= renewMaxSeasons(state, e) && Math.floor(seasons) === seasons)) {
            return { ok: false, reason: 'seasons' };
        }
        const baseCost = costFor(state, team, e);
        let cost = baseCost;
        if (offer && offer.cost !== undefined) {
            cost = round2(Math.min(Math.max(baseCost, offer.cost), Math.max(baseCost, cfg().negotiation.salaryMax)));
        }
        if (cost > maxOfferCost(state, team, e) + 1e-9) return { ok: false, reason: 'finance' };

        const terms = assess(state, team, e, seasons, cost);
        if (terms.negotiate && terms.verdict !== 'accept') {
            const r = roll ? roll() : Math.random();
            if (!(r < terms.odds)) {
                listAdd(state, 'closed', uid, e.engineer_id);
                return { ok: false, refused: true, confidenceLoss: cfg().negotiation.refusalConfidenceLoss };
            }
        }
        slot.contractLeft = 1 + seasons;
        slot.cost = cost;
        return { ok: true, seasons: seasons, cost: cost };
    }

    // ---- end of season ----

    // Contracts run down by a season and retirements are applied, for every team.
    //  - retired engineers leave their position empty;
    //  - the player's engineers whose contract ends were not renewed: they are released to the
    //    market (a contract ending is not a dismissal: no confidence loss, no grudge);
    //  - AI teams simply renew (until they get their own decisions): same salary, the base length.
    // Returns the player's `retired` and `released` engineer ids.
    function endOfSeason(state, year, playerUid) {
        const out = { retired: [], released: [] };
        Object.keys(state.teams).forEach(uid => ROLES.forEach(role => {
            const slot = state.teams[uid][role];
            if (!slot) return;
            const e = get(slot.id);
            if (!isAlive(e, year)) {
                state.teams[uid][role] = null;
                if (uid === playerUid) out.retired.push(e.engineer_id);
                return;
            }
            slot.contractLeft -= 1;
            if (slot.contractLeft > 0) return;
            if (uid === playerUid) {
                state.teams[uid][role] = null;
                addToDeck(state, role, e.engineer_id, true);
                out.released.push(e.engineer_id);
            } else {
                slot.contractLeft = Math.max(1, Math.min(baseSeasons(e), lastSeason(e) - year + 1));
            }
        }));
        return out;
    }

    // AI teams fill an empty position on their own: the best card of the market they can approach
    // and who accepts them at his base terms (no negotiation). This is the seed of the AI phase.
    function aiFillVacancies(state, teams, playerUid) {
        teams.forEach(team => {
            if (team.teamUid === playerUid) return;
            ROLES.forEach(role => {
                if ((state.teams[team.teamUid] || {})[role]) return;
                const candidates = state.decks[role].map(get).filter(e =>
                    canApproach(state, team, e).ok && !assess(state, team, e, baseSeasons(e), costFor(state, team, e)).negotiate);
                if (!candidates.length) return;
                candidates.sort((a, b) => b.value - a.value);
                const best = candidates[0];
                hire(state, team, best.engineer_id, { seasons: Math.min(baseSeasons(best), maxSeasons(state, best)) });
            });
        });
    }

    function fire(state, team, role) {
        return release(state, team.teamUid, role)
            ? { ok: true, confidenceLoss: cfg().dismissalConfidenceLoss }
            : { ok: false, reason: 'vacant' };
    }

    return { ROLES, load, isLoaded, get, isAlive, lastSeason, regionOf, initState, advanceYear, expireLocal, teamSlots,
             effectiveCost, costFor, committed, freeFinance, baseSeasons, maxSeasons, maxOfferCost, isClosed,
             isDismissed, hasGrudge, margin, canApproach, assess, hire, fire,
             canRenew, renewMaxSeasons, renew, endOfSeason, aiFillVacancies };
})();
