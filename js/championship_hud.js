// CHAMPIONSHIP_HUD.JS
// A small hover popup on quali.html and race.html that shows where the
// championship stands going into this session (from what's recorded so far).
// Does nothing outside championship mode.

(function () {
    if (localStorage.getItem('championshipActive') !== 'true') return;
    if (typeof ChampionshipCommon === 'undefined') return;
    const CC = ChampionshipCommon;

    function build() {
        let races, results, points;
        try {
            races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
            results = JSON.parse(localStorage.getItem('championshipResults') || '[]');
            points = JSON.parse(localStorage.getItem('championshipPoints') || 'null');
        } catch (e) { return; }

        const clean = CC.sanitizePairs(races, results);
        points = CC.normalizePoints(points);
        const opts = {
            fastestLapPoint: localStorage.getItem('championshipFastestLapPoint') === 'true',
            fastestLapTopN: parseInt(localStorage.getItem('championshipFastestLapTopN') || '10')
        };
        let { driverStandings, constructorStandings } =
            CC.computeStandings(clean.races, clean.results, points, opts);

        const totalRounds = clean.races.filter(r => !r.isSprintRace).length || clean.races.length;
        const roundsDone = clean.results.filter(r => Array.isArray(r) && r.length).length;

        // Before any round is scored, show the whole entry list on zero points.
        if (!driverStandings.length) {
            let field = [];
            try { field = JSON.parse(localStorage.getItem('selectedDrivers') || '[]') || []; } catch (e) {}
            if (!field.length) return; // no field to show either - bail
            driverStandings = field.map(d => ({
                code: d.code, name: d.name, team: d.team, color: d.color || '#888', total: 0
            }));
            const teams = {};
            field.forEach(d => { if (d.team && !teams[d.team]) teams[d.team] = { team: d.team, color: d.color || '#888', total: 0 }; });
            constructorStandings = Object.values(teams);
        }

        const listHtml = (rows, nameFn) => {
            if (!rows.length) return `<div class="champ-hud-empty">No rounds completed yet.</div>`;
            return `<ol class="champ-hud-list">` + rows.map((r, i) => `
                <li>
                    <span class="champ-hud-pos">${i + 1}</span>
                    <span class="champ-hud-swatch" style="background:${CC.escapeHtml(r.color || '#888')}"></span>
                    <span class="champ-hud-name">${CC.escapeHtml(nameFn(r))}</span>
                    <span class="champ-hud-pts">${r.total}</span>
                </li>`).join('') + `</ol>`;
        };

        const hud = document.createElement('div');
        hud.id = 'champ-hud';
        hud.innerHTML = `
            <button id="champ-hud-icon" type="button" title="Championship standings" aria-label="Championship standings">&#127942;</button>
            <div id="champ-hud-popup" hidden>
                <div class="champ-hud-head">Championship &middot; ${roundsDone} / ${totalRounds} round${totalRounds !== 1 ? 's' : ''} done</div>
                <div class="champ-hud-tabs">
                    <button type="button" data-tab="d" class="active">Drivers</button>
                    <button type="button" data-tab="c">Constructors</button>
                </div>
                <div id="champ-hud-d">${listHtml(driverStandings, r => r.name)}</div>
                <div id="champ-hud-c" hidden>${listHtml(constructorStandings, r => r.team)}</div>
            </div>`;
        document.body.appendChild(hud);

        // Position clear of a page header if there is one (quali).
        if (document.querySelector('.container > .header')) hud.style.top = '64px';

        const popup = hud.querySelector('#champ-hud-popup');
        let hideTimer = null;
        const show = () => { clearTimeout(hideTimer); popup.hidden = false; };
        const hide = () => { if (!hud.classList.contains('pinned')) popup.hidden = true; };
        hud.addEventListener('mouseenter', show);
        hud.addEventListener('mouseleave', () => { hideTimer = setTimeout(hide, 250); });
        hud.querySelector('#champ-hud-icon').addEventListener('click', () => {
            hud.classList.toggle('pinned');
            popup.hidden = !hud.classList.contains('pinned');
        });

        hud.querySelectorAll('.champ-hud-tabs button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                hud.querySelectorAll('.champ-hud-tabs button').forEach(b => b.classList.toggle('active', b === btn));
                hud.querySelector('#champ-hud-d').hidden = btn.dataset.tab !== 'd';
                hud.querySelector('#champ-hud-c').hidden = btn.dataset.tab !== 'c';
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
}());
