// "Team Management" tab of gp_select.html (Team Principal career only).
// Phase 1: read-only header + gauges. Requires team_principal_common.js.

function renderTeamManagement() {
    const host = document.getElementById('tab-team-management');
    if (!host) return;

    const state = TeamPrincipal.getState();
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem('teams') || '[]'); } catch (e) {}
    const team = state && TeamPrincipal.findTeamByUid(teams, state.teamUid);
    if (!team) {
        host.innerHTML = '<div class="tp-empty">Your team could not be found in this save.</div>';
        return;
    }

    const g = TeamPrincipal.teamGauges(team);
    const name = TeamPrincipal.teamName(team);
    const flag = String(team.flag || 'uk').replace(/^img\/flags\//, '').replace(/\.png$/, '');
    const image = String(team.image || '').replace(/^img\/cars\//, '').replace(/\.png$/, '');

    host.innerHTML = `
        <div class="tp-header" style="--team-color:${team.color || '#888'}">
            <img class="tp-flag" src="img/flags/${flag}.png" alt="${flag}">
            <div class="tp-team-name">${name}</div>
            ${image ? `<img class="tp-car" src="img/cars/${image}.png" alt="${name}">` : ''}
        </div>
        <div class="tp-gauges">
            <div class="tp-gauge-row"><span class="tp-gauge-label">Finance</span>${TeamPrincipal.gaugeIcons(g.finance, '$', 'tp-finance')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Confidence</span>${TeamPrincipal.gaugeIcons(g.confidence, '♥︎', 'tp-confidence')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Prestige</span>${TeamPrincipal.gaugeIcons(g.prestige, '', 'tp-prestige tp-star')}</div>
            <div class="tp-gauge-row"><span class="tp-gauge-label">Satisfaction</span>${TeamPrincipal.satisfactionBar(state.satisfaction)}</div>
        </div>
    `;
}
