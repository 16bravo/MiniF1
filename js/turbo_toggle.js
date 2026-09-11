// TURBO_TOGGLE.JS
// Shared fast-forward toggle for the race and qualifying pages. The lap-by-
// lap simulation normally paces itself in real time (one tick every
// ~1/60s); toggling it on shrinks that per-tick delay so the animation
// keeps playing, just much faster (not an instant jump to the result).
// The button itself is generic - it just calls whichever page-specific hook
// is defined (toggleTurboMode(), from animation.js or quali/session.js).

function initTurboToggleButton() {
    if (typeof toggleTurboMode !== 'function') return; // neither page hook is present

    const btn = document.createElement('button');
    btn.id = 'turboSkipBtn';
    btn.className = 'turboSkipBtn';
    btn.type = 'button';
    btn.textContent = '▶▶'; // plain glyphs (not emoji) - same fast-forward language as the podium's "CONTINUE ▸"
    btn.title = 'Fast-forward the simulation';
    btn.addEventListener('click', () => {
        const on = toggleTurboMode();
        btn.classList.toggle('active', on);
        btn.title = on
            ? 'Fast-forward: ON - click to return to normal speed'
            : 'Fast-forward the simulation';
    });
    document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', initTurboToggleButton);
