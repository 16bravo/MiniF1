document.addEventListener('DOMContentLoaded', function() {
    let championshipResults, races;
    try {
        championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
    } catch(e) {
        championshipResults = [];
        races = [];
    }
    if (!Array.isArray(championshipResults)) championshipResults = [];
    if (!Array.isArray(races)) races = [];

    // Keep valid race definitions:
    // - future races have no result yet (undefined/null) → kept
    // - completed races must have an array result → kept
    // - any other value (corrupted object, string…) → dropped
    const validPairs = races
        .map((r, i) => ({ race: r, result: championshipResults[i], i }))
        .filter(({ race, result }) => race != null && (result == null || Array.isArray(result)));

    if (validPairs.length < races.length) {
        console.warn(`Results: ${races.length - validPairs.length} corrupted race(s) removed.`);
    }
    races = validPairs.map(p => p.race);
    championshipResults = validPairs.map(p => p.result ?? []);

    const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    const POINTS_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1];

    // Liste des pilotes et équipes
    let allDrivers = {};
    let allTeams = {};
    championshipResults.forEach(race => {
        race.forEach(driver => {
            allDrivers[driver.code] = driver.name;
            if (!allTeams[driver.team]) allTeams[driver.team] = driver.team;
        });
    });

    // Tableau des points par pilote et par course
    let driverPointsTable = {};
    let teamPointsTable = {};
    races.forEach((race, raceIdx) => {
        const results = championshipResults[raceIdx] || [];
        // Determine if this race is sprint or normal
        const pointsScale = race.isSprintRace ? POINTS_SPRINT : POINTS;
        
        // Pilotes
        results
            .filter(d => d.state !== "out")
            .sort((a, b) => b.totalLength - a.totalLength)
            .forEach((driver, idx) => {
                if (!driverPointsTable[driver.code]) driverPointsTable[driver.code] = Array(races.length).fill(0);
                driverPointsTable[driver.code][raceIdx] = pointsScale[idx] || 0;
            });
        // Constructeurs
        Object.values(allTeams).forEach(team => {
            if (!teamPointsTable[team]) teamPointsTable[team] = Array(races.length).fill(0);
        });
        results
            .filter(d => d.state !== "out")
            .sort((a, b) => b.totalLength - a.totalLength)
            .forEach((driver, idx) => {
                teamPointsTable[driver.team][raceIdx] += pointsScale[idx] || 0;
            });
    });

    // Affichage du tableau pilotes
    const standingsDiv = document.getElementById('championship-standings');
    let driverTable = `<table><thead><tr><th>Rang</th><th>Drivers</th>`;
    races.forEach(r => driverTable += `<th>${r.circuit}</th>`);
    driverTable += `<th>Total</th></tr></thead><tbody>`;
    Object.entries(driverPointsTable)
        .sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0))
        .forEach(([code, ptsArr], idx) => {
            driverTable += `<tr><td>${idx + 1}</td><td>${allDrivers[code] || code}</td>`;
            ptsArr.forEach(pts => driverTable += `<td${pts === 0 ? ' class="no-points"' : ''}>${pts === 0 ? "-" : pts}</td>`);
            driverTable += `<td><b>${ptsArr.reduce((x, y) => x + y, 0)}</b></td></tr>`;
        });
    driverTable += `</tbody></table>`;

    // Affichage du tableau constructeurs
    let teamTable = `<table><thead><tr><th>Rang</th><th>Constructors</th>`;
    races.forEach(r => teamTable += `<th>${r.circuit}</th>`);
    teamTable += `<th>Total</th></tr></thead><tbody>`;
    Object.entries(teamPointsTable)
        .sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0))
        .forEach(([team, ptsArr], idx) => {
            teamTable += `<tr><td>${idx + 1}</td><td>${team}</td>`;
            ptsArr.forEach(pts => teamTable += `<td${pts === 0 ? ' class="no-points"' : ''}>${pts === 0 ? "-" : pts}</td>`);
            teamTable += `<td><b>${ptsArr.reduce((x, y) => x + y, 0)}</b></td></tr>`;
        });
    teamTable += `</tbody></table>`;

    document.getElementById('tab-drivers').innerHTML = driverTable;
    document.getElementById('tab-constructors').innerHTML = teamTable;

    // Tab switching logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('tab-' + this.dataset.tab).classList.add('active');
        });
    });

    // Gestion des boutons
    const nextBtn = document.getElementById('nextRaceBtn');
    const endBtn = document.getElementById('endChampionshipBtn');
    const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
    if (currentRaceIndex < races.length - 1) {
        nextBtn.style.display = 'inline-block';
        endBtn.style.display = 'none';
        nextBtn.onclick = function() {
            localStorage.setItem('championshipCurrentRace', (currentRaceIndex + 1).toString());
            
            // Auto-save championship before leaving
            if (window.autoSaveChampionship) {
                window.autoSaveChampionship();
            }
            
            window.location.href = 'gp_select.html';
        };
    } else {
        nextBtn.style.display = 'none';
        endBtn.style.display = 'inline-block';
        endBtn.onclick = function() {
            localStorage.setItem('championshipActive', 'false');
            
            // Auto-save championship before ending
            if (window.autoSaveChampionship) {
                window.autoSaveChampionship();
            }
            
            alert('Championnat terminé !');
            window.location.href = 'index.html';
        };
    }
});