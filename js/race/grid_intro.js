// GRID_INTRO.JS
// Old-school "starting grid" broadcast graphic shown over the (frozen) race
// page just before the lights go out. A blurred, dark, no-background overlay
// with a horizontally scrolling strip of grid slots - position, surname,
// team, and the qualifying time / session when qualifying was actually run.
//
// showStartingGrid(onComplete) calls onComplete() exactly once, when the
// scroll finishes OR the viewer skips (button / click / Esc / Space).

function showStartingGrid(onComplete) {
    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey);
        const el = document.getElementById('grid-intro');
        if (el) {
            el.classList.add('grid-intro-out');
            setTimeout(() => el.remove(), 260);
        }
        try { onComplete(); } catch (e) { console.error(e); }
    };
    const onKey = (e) => {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); finish(); }
    };

    // Grid order = the driver array order (already the starting grid).
    const grid = (typeof drivers !== 'undefined' && Array.isArray(drivers)) ? drivers : [];
    if (!grid.length) { onComplete(); return; }

    const hasTimes = grid.some(d => typeof d.qualiTime === 'number' && d.qualiTime > 0);
    const surname = (name) => {
        const p = String(name || '').trim().split(/\s+/);
        return (p.length > 1 ? p.slice(1).join(' ') : p[0] || '').toUpperCase();
    };
    // P1-10 set their time in Q3, P11-15 in Q2, the rest in Q1 (only meaningful
    // when qualifying was run; skip-quali / simple GP grids have no session).
    const session = (pos) => (pos <= 10 ? 'Q3' : pos <= 15 ? 'Q2' : 'Q1');
    const fmt = (t) => (typeof formatDriverTime === 'function' ? formatDriverTime(t) : t.toFixed(3));

    const gpName = (typeof grandPrix === 'string' && grandPrix) ? grandPrix : 'Grand Prix';

    const tyres = (typeof TIRES !== 'undefined') ? TIRES : {};
    const card = (d, pos) => {
        const timePart = (hasTimes && typeof d.qualiTime === 'number' && d.qualiTime > 0)
            ? `<span class="gi-time">${fmt(d.qualiTime)}</span><span class="gi-ses">${session(pos)}</span>`
            : '';
        const tk = d.startingTire || d.tire || null;
        const tyrePart = (tk && tyres[tk])
            ? `<span class="gi-tyre" style="--tyc:${tyres[tk].color}" title="${tyres[tk].name || tk}">${tk}</span>`
            : '';
        return `<div class="gi-card" style="--tc:${d.color || '#bbb'}">
            <div class="gi-pos">${pos}</div>
            <div class="gi-info">
                <div class="gi-name">${surname(d.name) || (d.code || '')}</div>
                <div class="gi-team">${d.team || ''}</div>
                <div class="gi-t">${timePart}${tyrePart}</div>
            </div>
        </div>`;
    };

    let cols = '';
    for (let i = 0; i < grid.length; i += 2) {
        cols += `<div class="gi-col">${card(grid[i], i + 1)}${grid[i + 1] ? card(grid[i + 1], i + 2) : ''}</div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'grid-intro';
    overlay.innerHTML = `
        <div class="gi-frame">
            <div class="gi-checker"></div>
            <div class="gi-title">${String(gpName).toUpperCase()} GP &nbsp;&middot;&nbsp; STARTING GRID</div>
            <div class="gi-viewport"><div class="gi-strip">${cols}</div></div>
            <div class="gi-checker"></div>
        </div>
        <button class="gi-skip" type="button">SKIP &#9656;</button>`;
    document.body.appendChild(overlay);

    // Size the scroll: how far the strip must travel to reveal its tail.
    // Reading offsetWidth forces a synchronous layout so scrollWidth is right.
    const strip = overlay.querySelector('.gi-strip');
    const viewport = overlay.querySelector('.gi-viewport');
    void strip.offsetWidth;
    const dist = Math.max(0, strip.scrollWidth - viewport.clientWidth);
    const dur = dist > 20 ? Math.min(25, Math.max(10, dist / 1 + 5)) : 10;
    strip.style.setProperty('--gi-dist', dist + 'px');
    strip.style.setProperty('--gi-dur', dur + 's');
    strip.classList.add('gi-run');

    strip.addEventListener('animationend', finish);
    // Backstop: never leave the race un-started if animationend doesn't fire.
    setTimeout(finish, dur * 1000 + 900);

    overlay.querySelector('.gi-skip').addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    overlay.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);
}
