// ============================================================
// CHAMPIONSHIP_COMMON.JS
// Shared championship helpers used by:
//  - championship_end.js   (end-of-season recap screen)
//  - championship_viewer.js (offline reader for exported .json)
//
// Pure-ish helpers: standings computation with the FIA countback
// tie-break, standings table markup, and the recap-image canvas
// renderer. No DOM assumptions beyond what each function is handed.
// ============================================================

const ChampionshipCommon = (() => {

    // Sprint points are fixed for now (see championship_setup.js): 8,7,6,5,4,3,2,1 then 0.
    const DEFAULT_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const POINTS_SPRINT  = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // ------------------------------------------------------------
    // Data sanitising
    // ------------------------------------------------------------
    // Keep only valid (race, result) pairs: a race must exist, and its result
    // is either absent (not run yet) or an array (a real classification).
    function sanitizePairs(races, results) {
        if (!Array.isArray(races)) races = [];
        if (!Array.isArray(results)) results = [];
        const pairs = races
            .map((r, i) => ({ race: r, result: results[i] }))
            .filter(({ race, result }) => race != null && (result == null || Array.isArray(result)));
        return {
            races: pairs.map(p => p.race),
            results: pairs.map(p => p.result || [])
        };
    }

    function normalizePoints(points) {
        let p = Array.isArray(points) && points.length ? points.slice() : [...DEFAULT_POINTS];
        while (p.length < DEFAULT_POINTS.length) p.push(0);
        return p;
    }

    // ------------------------------------------------------------
    // Standings computation (single source of truth)
    // ------------------------------------------------------------
    // Returns { driverStandings, constructorStandings }, each row:
    //   drivers:      { code, name, team, color, perRace:[], total, countback:[] }
    //   constructors: { team, color, perRace:[], total, countback:[] }
    function computeStandings(races, results, points) {
        points = normalizePoints(points);
        const nRaces = races.length;

        const driverInfo = {};   // code -> { name, team, color }
        const teamColor = {};    // team -> color
        results.forEach(race => {
            (race || []).forEach(d => {
                if (!driverInfo[d.code]) driverInfo[d.code] = { name: d.name, team: d.team, color: d.color };
                if (d.team && !teamColor[d.team]) teamColor[d.team] = d.color;
            });
        });

        const driverPts = {};
        const teamPts = {};
        const driverFeatPos = {};
        const teamFeatPos = {};
        Object.keys(teamColor).forEach(team => { teamPts[team] = Array(nRaces).fill(0); });

        races.forEach((race, raceIdx) => {
            const scale = race.isSprintRace ? POINTS_SPRINT : points;
            const classified = (results[raceIdx] || [])
                .filter(d => d.state !== 'out')
                .sort((a, b) => b.totalLength - a.totalLength);

            classified.forEach((d, pos) => {
                const pts = scale[pos] || 0;
                const finishPos = pos + 1;

                if (!driverPts[d.code]) driverPts[d.code] = Array(nRaces).fill(0);
                driverPts[d.code][raceIdx] = pts;
                if (!teamPts[d.team]) teamPts[d.team] = Array(nRaces).fill(0);
                teamPts[d.team][raceIdx] += pts;

                // Countback uses feature-race finishing positions only (sprints excluded)
                if (!race.isSprintRace) {
                    (driverFeatPos[d.code] = driverFeatPos[d.code] || []).push(finishPos);
                    (teamFeatPos[d.team] = teamFeatPos[d.team] || []).push(finishPos);
                }
            });
        });

        const driverStandings = Object.entries(driverPts)
            .map(([code, perRace]) => ({
                code,
                name: (driverInfo[code] && driverInfo[code].name) || code,
                team: (driverInfo[code] && driverInfo[code].team) || '',
                color: (driverInfo[code] && driverInfo[code].color) || '#888',
                perRace,
                total: perRace.reduce((a, b) => a + b, 0),
                countback: positionHistogram(driverFeatPos[code])
            }))
            .sort(compareStandingRows);

        const constructorStandings = Object.entries(teamPts)
            .map(([team, perRace]) => ({
                team,
                color: teamColor[team] || '#888',
                perRace,
                total: perRace.reduce((a, b) => a + b, 0),
                countback: positionHistogram(teamFeatPos[team])
            }))
            .sort(compareStandingRows);

        return { driverStandings, constructorStandings };
    }

    // hist[p] = number of times classified in position p (feature races only)
    function positionHistogram(positions) {
        const hist = [];
        (positions || []).forEach(p => { if (p >= 1) hist[p] = (hist[p] || 0) + 1; });
        return hist;
    }

    // FIA tie-break: most points; on a tie, most 1st places, then 2nds, then 3rds…
    function compareStandingRows(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        const maxPos = Math.max(a.countback.length, b.countback.length);
        for (let p = 1; p < maxPos; p++) {
            const diff = (b.countback[p] || 0) - (a.countback[p] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    // Classification of a single race: [{ pos, code, name, team, color, points, retired }]
    // Retired drivers are listed after the classified ones, in recorded order.
    function raceClassification(race, result, points) {
        points = normalizePoints(points);
        const scale = race && race.isSprintRace ? POINTS_SPRINT : points;
        const classified = (result || [])
            .filter(d => d.state !== 'out')
            .sort((a, b) => b.totalLength - a.totalLength)
            .map((d, i) => ({
                pos: i + 1, code: d.code, name: d.name, team: d.team,
                color: d.color || '#888', points: scale[i] || 0, retired: false
            }));
        const retired = (result || [])
            .filter(d => d.state === 'out')
            .map(d => ({
                pos: null, code: d.code, name: d.name, team: d.team,
                color: d.color || '#888', points: 0, retired: true
            }));
        return classified.concat(retired);
    }

    // ------------------------------------------------------------
    // Career-style aggregate stats over the whole championship
    // ------------------------------------------------------------
    // Returns { driverStats:[…], teamStats:[…], hasGridData:bool }.
    // Grid-based stats (poles, best grid) need `startPosition` on the result
    // rows — present on championships run after that field was added; older
    // exports report them as null and `hasGridData` is false.
    function computeStats(races, results, points) {
        points = normalizePoints(points);
        const drivers = {};
        const teams = {};
        let hasGridData = false;

        const minDefined = (cur, val) => (val == null ? cur : (cur == null ? val : Math.min(cur, val)));

        function ensureDriver(d) {
            if (!drivers[d.code]) drivers[d.code] = {
                code: d.code, name: d.name, team: d.team, color: d.color || '#888',
                entered: 0, finishes: 0, dnf: 0, wins: 0, podiums: 0, pointFinishes: 0,
                poles: 0, bestFinish: null, bestGrid: null, points: 0, _finishPosSum: 0
            };
            return drivers[d.code];
        }
        function ensureTeam(d) {
            if (!teams[d.team]) teams[d.team] = {
                team: d.team, color: d.color || '#888',
                entered: 0, finishes: 0, dnf: 0, wins: 0, podiums: 0, pointFinishes: 0,
                poles: 0, oneTwo: 0, bestFinish: null, bestGrid: null, points: 0
            };
            return teams[d.team];
        }

        races.forEach((race, ri) => {
            const scale = race.isSprintRace ? POINTS_SPRINT : points;
            const result = results[ri] || [];
            const classified = result.filter(d => d.state !== 'out')
                .sort((a, b) => b.totalLength - a.totalLength);
            const retired = result.filter(d => d.state === 'out');

            const teamsSeen = new Set();
            const teamPodiumPos = {};

            const grid = d => {
                if (typeof d.startPosition === 'number') { hasGridData = true; return d.startPosition; }
                return null;
            };

            classified.forEach((d, idx) => {
                const pos = idx + 1;
                const pts = scale[idx] || 0;
                const g = grid(d);

                const sd = ensureDriver(d);
                sd.entered++; sd.finishes++; sd.points += pts; sd._finishPosSum += pos;
                if (pos === 1) sd.wins++;
                if (pos <= 3) sd.podiums++;
                if (pts > 0) sd.pointFinishes++;
                if (g === 1) sd.poles++;
                sd.bestFinish = minDefined(sd.bestFinish, pos);
                sd.bestGrid = minDefined(sd.bestGrid, g);

                const st = ensureTeam(d);
                if (!teamsSeen.has(d.team)) { st.entered++; teamsSeen.add(d.team); }
                st.finishes++; st.points += pts;
                if (pos === 1) st.wins++;
                if (pos <= 3) { st.podiums++; (teamPodiumPos[d.team] = teamPodiumPos[d.team] || []).push(pos); }
                if (pts > 0) st.pointFinishes++;
                if (g === 1) st.poles++;
                st.bestFinish = minDefined(st.bestFinish, pos);
                st.bestGrid = minDefined(st.bestGrid, g);
            });

            retired.forEach(d => {
                const g = grid(d);
                const sd = ensureDriver(d);
                sd.entered++; sd.dnf++;
                if (g === 1) sd.poles++;
                sd.bestGrid = minDefined(sd.bestGrid, g);

                const st = ensureTeam(d);
                if (!teamsSeen.has(d.team)) { st.entered++; teamsSeen.add(d.team); }
                st.dnf++;
                if (g === 1) st.poles++;
                st.bestGrid = minDefined(st.bestGrid, g);
            });

            Object.entries(teamPodiumPos).forEach(([team, positions]) => {
                if (positions.includes(1) && positions.includes(2)) teams[team].oneTwo++;
            });
        });

        Object.values(drivers).forEach(d => {
            d.avgFinish = d.finishes ? (d._finishPosSum / d.finishes) : null;
            delete d._finishPosSum;
        });

        const byPointsThenBest = (a, b) =>
            b.points - a.points ||
            b.wins - a.wins ||
            (a.bestFinish == null ? 99 : a.bestFinish) - (b.bestFinish == null ? 99 : b.bestFinish);

        return {
            driverStats: Object.values(drivers).sort(byPointsThenBest),
            teamStats: Object.values(teams).sort(byPointsThenBest),
            hasGridData
        };
    }

    // ------------------------------------------------------------
    // Race label (used as short column headers)
    // ------------------------------------------------------------
    function raceCode(race) {
        // displayCode is the user-editable tag; fall back to the circuit key
        const code = String(race.displayCode || (race.circuit || '').slice(0, 3)).toUpperCase();
        return race.isSprintRace ? `${code}·S` : code;
    }

    // ------------------------------------------------------------
    // Standings table markup (shared look with results.css)
    // ------------------------------------------------------------
    function buildStandingsTable(races, nameHeader, rows, nameFn) {
        if (!rows.length) return `<p style="color:#888;padding:20px;">No standings to display.</p>`;

        let html = `<table><thead><tr><th>#</th><th>${nameHeader}</th>`;
        races.forEach(r => {
            html += `<th title="${escapeHtml(r.grandPrix || r.circuit || '')}${r.isSprintRace ? ' (Sprint)' : ''}">${escapeHtml(raceCode(r))}</th>`;
        });
        html += `<th>Total</th></tr></thead><tbody>`;

        rows.forEach((row, idx) => {
            html += `<tr><td>${idx + 1}</td><td>${nameFn(row)}</td>`;
            row.perRace.forEach(pts => {
                html += `<td${pts === 0 ? ' class="no-points"' : ''}>${pts === 0 ? '-' : pts}</td>`;
            });
            html += `<td><b>${row.total}</b></td></tr>`;
        });
        html += `</tbody></table>`;
        return html;
    }

    // ------------------------------------------------------------
    // Recap image (canvas). Sizes the canvas to its content.
    //   opts = { slotName, races, driverStandings, constructorStandings }
    // ------------------------------------------------------------
    function drawRecap(canvas, opts) {
        const W = canvas.width;
        const M = 50;
        const races = opts.races || [];
        const drivers = opts.driverStandings || [];
        const constructors = opts.constructorStandings || [];
        const champDriver = drivers[0];
        const champTeam = constructors[0];

        const nDrv = Math.min(drivers.length, 10);
        const nCon = Math.min(constructors.length, 10);

        let h = 190;
        if (champDriver) h += 142;
        if (champTeam) h += 138;
        h += 44 + Math.max(nDrv, 1) * 34;
        h += 30;
        h += 44 + Math.max(nCon, 1) * 34;
        h += 70;
        canvas.height = Math.max(600, Math.round(h));

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, canvas.height);
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, W, canvas.height);
        ctx.fillStyle = '#e10600';
        ctx.fillRect(0, 0, W, 14);

        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 54px 'Pixel Operator', Arial, sans-serif";
        ctx.fillText('MINIF1', M, 90);
        ctx.fillStyle = '#999999';
        ctx.font = "22px 'Pixel Operator', Arial, sans-serif";
        ctx.fillText('SEASON RECAP', M, 122);
        ctx.textAlign = 'right';
        ctx.fillText(escapeText(opts.slotName), W - M, 122);
        ctx.textAlign = 'left';

        let y = 190;

        if (champDriver) {
            ctx.fillStyle = '#e10600';
            ctx.font = "bold 20px 'Pixel Operator', Arial, sans-serif";
            ctx.fillText("WORLD DRIVERS' CHAMPION", M, y);
            y += 52;
            ctx.fillStyle = champDriver.color || '#888';
            ctx.fillRect(M, y - 38, 14, 44);
            ctx.fillStyle = '#ffd700';
            ctx.font = "bold 48px 'Pixel Operator', Arial, sans-serif";
            ctx.fillText(escapeText(champDriver.name), M + 30, y);
            y += 34;
            ctx.fillStyle = '#cccccc';
            ctx.font = "20px 'Pixel Operator', Arial, sans-serif";
            ctx.fillText(`${escapeText(champDriver.team)}  -  ${champDriver.total} pts`, M + 30, y);
            y += 56;
        }

        if (champTeam) {
            ctx.fillStyle = '#e10600';
            ctx.font = "bold 20px 'Pixel Operator', Arial, sans-serif";
            ctx.fillText("CONSTRUCTORS' CHAMPION", M, y);
            y += 48;
            ctx.fillStyle = champTeam.color || '#888';
            ctx.fillRect(M, y - 34, 14, 40);
            ctx.fillStyle = '#ffd700';
            ctx.font = "bold 40px 'Pixel Operator', Arial, sans-serif";
            ctx.fillText(escapeText(champTeam.team), M + 30, y);
            y += 30;
            ctx.fillStyle = '#cccccc';
            ctx.font = "20px 'Pixel Operator', Arial, sans-serif";
            ctx.fillText(`${champTeam.total} pts`, M + 30, y);
            y += 60;
        }

        y = drawCanvasList(ctx, 'DRIVERS', drivers.slice(0, 10), r => r.name, M, y, W - M);
        y += 30;
        drawCanvasList(ctx, 'CONSTRUCTORS', constructors.slice(0, 10), r => r.team, M, y, W - M);

        ctx.fillStyle = '#666666';
        ctx.font = "16px 'Pixel Operator', Arial, sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(`${races.length} races  -  generated ${new Date().toLocaleDateString('fr-FR')}`, W / 2, canvas.height - 30);
        ctx.textAlign = 'left';
    }

    function drawCanvasList(ctx, title, rows, labelFn, x, y, xRight) {
        ctx.fillStyle = '#e10600';
        ctx.font = "bold 22px 'Pixel Operator', Arial, sans-serif";
        ctx.fillText(title, x, y);
        y += 12;
        ctx.strokeStyle = '#e10600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(xRight, y);
        ctx.stroke();
        y += 32;

        if (!rows.length) {
            ctx.fillStyle = '#888888';
            ctx.font = "18px 'Pixel Operator', Arial, sans-serif";
            ctx.fillText('No results', x, y);
            return y + 20;
        }

        rows.forEach((r, i) => {
            if (r.color) {
                ctx.fillStyle = r.color;
                ctx.fillRect(x, y - 16, 10, 18);
            }
            ctx.fillStyle = i === 0 ? '#ffd700' : '#e8e8e8';
            ctx.font = "20px 'Pixel Operator', Arial, sans-serif";
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}.  ${escapeText(labelFn(r))}`, x + 24, y);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'right';
            ctx.fillText(String(r.total), xRight, y);
            ctx.textAlign = 'left';
            y += 34;
        });
        return y;
    }

    // ------------------------------------------------------------
    // Small shared helpers
    // ------------------------------------------------------------
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function escapeText(str) {
        return String(str == null ? '' : str);
    }

    function slugify(str) {
        return String(str || 'championship').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'championship';
    }

    function dateStamp() {
        return new Date().toISOString().slice(0, 10);
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
        DEFAULT_POINTS, POINTS_SPRINT,
        sanitizePairs, normalizePoints,
        computeStandings, positionHistogram, compareStandingRows, raceClassification,
        computeStats,
        raceCode, buildStandingsTable, drawRecap,
        escapeHtml, escapeText, slugify, dateStamp, triggerDownload
    };
})();

// Node/CommonJS export for unit tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChampionshipCommon;
}
