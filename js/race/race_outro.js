// RACE_OUTRO.JS
// End-of-race presentation: let the ranking board glide to its final order
// (instead of snapping), then bring up a broadcast-style podium for the top 3.
// showRaceOutro() is called from simulation.js when the race finishes.

function showRaceOutro() {
    const screen = document.getElementById('screen');
    if (screen) screen.classList.add('race-over');          // enables a CSS transition on the rows
    if (typeof renderFinalStandings === 'function') renderFinalStandings();
    const ind = document.getElementById('ind');
    if (ind) ind.classList.add('ind-finish');

    setTimeout(buildPodium, 1500);

    function surname(n) {
        const p = String(n || '').trim().split(/\s+/);
        return (p.length > 1 ? p.slice(1).join(' ') : p[0] || '').toUpperCase();
    }

    function buildPodium() {
        let order = [];
        try { order = getFinalClassification(); } catch (e) {}
        const top = order.map(i => drivers[i]).filter(d => d && d.state !== 'out').slice(0, 3);
        if (!top.length) return;   // nobody classified - no podium

        const gp = (typeof grandPrix === 'string' && grandPrix) ? grandPrix.toUpperCase() : 'GRAND PRIX';
        const slots = [];
        if (top[1]) slots.push({ pos: 2, d: top[1], cls: 'p2' });
        if (top[0]) slots.push({ pos: 1, d: top[0], cls: 'p1' });
        if (top[2]) slots.push({ pos: 3, d: top[2], cls: 'p3' });

        const slotHtml = (s) => `
            <div class="pod-slot ${s.cls}">
                <div class="pod-card" style="--tc:${s.d.color || '#bbb'}">
                    <div class="pod-name">${surname(s.d.name) || s.d.code || ''}</div>
                    <div class="pod-team">${s.d.team || ''}</div>
                </div>
                <div class="pod-step"><span class="pod-num">${s.pos}</span></div>
            </div>`;

        // Fastest lap: driver only - the sim's lap "time" is on a compressed
        // clock and wouldn't read as a real lap time.
        let flHtml = '';
        if (typeof fastestLap !== 'undefined' && fastestLap.driverIndex !== null && fastestLap.code) {
            flHtml = `<div class="pod-fl"><span class="pod-fl-tag">FASTEST LAP</span>` +
                     `<span class="pod-fl-drv">${fastestLap.code}</span></div>`;
        }

        const ov = document.createElement('div');
        ov.id = 'race-podium';
        ov.innerHTML = `
            <div class="pod-frame">
                <div class="pod-checker"></div>
                <div class="pod-title">${gp} GP <span>&middot; RACE RESULT</span></div>
                <div class="pod-steps">${slots.map(slotHtml).join('')}</div>
                ${flHtml}
                <div class="pod-actions">
                    <button class="pod-results" type="button">VIEW RESULTS</button>
                    <button class="pod-continue" type="button">CONTINUE &#9656;</button>
                </div>
                <div class="pod-checker"></div>
            </div>`;
        document.body.appendChild(ov);
        setTimeout(() => ov.classList.add('pod-in'), 30);   // trigger the fade/rise-in

        // CONTINUE reuses the existing end-of-race navigation button.
        ov.querySelector('.pod-continue').addEventListener('click', () => {
            const b = document.getElementById('raceEndBtn');
            if (b) b.click();
        });
        // VIEW RESULTS just dismisses the podium to reveal the final board.
        ov.querySelector('.pod-results').addEventListener('click', () => {
            ov.classList.add('pod-out');
            setTimeout(() => ov.remove(), 300);
        });
    }
}
