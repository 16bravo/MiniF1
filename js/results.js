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

    const DEFAULT_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const DEFAULT_POINTS_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const SPECIAL_CHAMPIONSHIP_POINTS = Array.from({length: 22}, (_, i) => 22 - i);
    
    // Load custom points from championship setup or use defaults
    let POINTS = [...DEFAULT_POINTS];
    let POINTS_SPRINT = [...DEFAULT_POINTS_SPRINT];
    
    try {
        const savedPoints = localStorage.getItem('championshipPoints');
        const savedPointsSprint = localStorage.getItem('championshipPointsSprint');
        const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
        
        if (savedPoints) {
            POINTS = JSON.parse(savedPoints);
            // Ensure we have 22 positions (handle migration from old system)
            while (POINTS.length < DEFAULT_POINTS.length) {
                POINTS.push(0);
            }
        }
        
        if (specialMode) {
            // Use special championship points for sprint races
            POINTS_SPRINT = [...SPECIAL_CHAMPIONSHIP_POINTS];
        } else if (savedPointsSprint) {
            POINTS_SPRINT = JSON.parse(savedPointsSprint);
            // Ensure we have 22 positions (handle migration from old system)
            while (POINTS_SPRINT.length < DEFAULT_POINTS_SPRINT.length) {
                POINTS_SPRINT.push(0);
            }
        }

        // Sprint race points are fixed for now: 8,7,6,5,4,3,2,1 then 0. Ignore any saved/legacy scale.
        POINTS_SPRINT = [...DEFAULT_POINTS_SPRINT];
    } catch(e) {
        console.error('Error loading championship points:', e);
        // Falls back to defaults
    }

    // List of drivers and teams
    let allDrivers = {};
    let allTeams = {};
    championshipResults.forEach(race => {
        race.forEach(driver => {
            allDrivers[driver.code] = driver.name;
            if (!allTeams[driver.team]) allTeams[driver.team] = driver.team;
        });
    });

    // Points table per driver and per race
    let driverPointsTable = {};
    let teamPointsTable = {};
    races.forEach((race, raceIdx) => {
        const results = championshipResults[raceIdx] || [];
        // Determine if this race is sprint or normal
        const pointsScale = race.isSprintRace ? POINTS_SPRINT : POINTS;
        
        // Drivers
        results
            .filter(d => d.state !== "out")
            .sort((a, b) => b.totalLength - a.totalLength)
            .forEach((driver, idx) => {
                if (!driverPointsTable[driver.code]) driverPointsTable[driver.code] = Array(races.length).fill(0);
                driverPointsTable[driver.code][raceIdx] = pointsScale[idx] || 0;
            });
        // Constructors
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

    // Display driver standings table
    const standingsDiv = document.getElementById('championship-standings');
    let driverTable = `<table><thead><tr><th>Rank</th><th>Drivers</th>`;
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

    // Display constructor standings table
    let teamTable = `<table><thead><tr><th>Rank</th><th>Constructors</th>`;
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

    // Button handling
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