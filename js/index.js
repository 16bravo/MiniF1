let teamNames;

// Team count bounds. A team always has exactly 2 drivers, so this also bounds
// the field at 20-30 drivers.
const MIN_TEAMS = 10;
const MAX_TEAMS = 15;

// Car pictures available for teams (used by the team editor).
const TEAM_IMAGE_LIST = ["ALP1","ALP24","ALP25","AMR24","AMR25","ARR1","ARR201","ARR21","ARR31","AST1","BEL1","BEN1","BRA1","FER1","FER201","FER21","FER24","FER25","FRA1","GBR1","GER1","HAA1","HAA201","HAA21","HAA24","HAA25","HAA31","HAA41","HAA51","HON1","JAG1","JAG21","LOT1","LOT21","LOT31","MCL1","MCL201","MCL21","MCL24","MCL25","MCL31","MCL41","MER1","MER201","MER21","MER24","MER25","MER31","MERBLM1","PET1","PEU1","PEU2","POR1","POR21","POR31","POR41","RBR1","RBR201","RBR21","RBR24","RBR25","REN1","REN201","REN21","REN31","RENT201","RPT1","RPT201","RPT21","RPT31","SAT201","SAT21","SAU24","SAU25","STR1","VRB24","VRB25","WIL1","WIL201","WIL21","WIL24","WIL25","WIL31","WIL41","WILT201"];

// Sets the "Go to Qualifying / Next Race / Final Results…" button's label
// without touching the flag/sprint-badge markup that sits next to it.
function setGoButtonLabel(text) {
    const textEl = document.getElementById('goToNextPageText');
    if (textEl) textEl.textContent = text;
}

// Function to update the GP flag (and sprint badge) shown on the button -
// the upcoming circuit in championship mode (or the selected one otherwise).
function updateButtonFlag() {
    let circuitData = null;

    // In championship mode, use the same logic as showOverview()
    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    if (isChampionship) {
        const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        const championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        const raceJustPlayed = Array.isArray(championshipResults[currentRaceIndex]);
        const displayIndex = raceJustPlayed
            ? Math.min(currentRaceIndex + 1, races.length - 1)
            : currentRaceIndex;
        circuitData = races[displayIndex];
    } else {
        // Non-championship: use selectedCircuit
        const stored = localStorage.getItem('selectedCircuit');
        if (stored) circuitData = JSON.parse(stored);
    }

    const flagWrap = document.getElementById('buttonFlagWrap');
    const flagImg = document.getElementById('buttonFlagImg');
    const sprintBadge = document.getElementById('buttonSprintBadge');
    if (!flagWrap || !flagImg || !sprintBadge) return;

    if (circuitData) {
        const countryFile = circuitData.country.toLowerCase().replace(/ /g, "_");
        flagImg.src = `img/flags/${countryFile}.png`;
        flagImg.alt = circuitData.country;
        flagWrap.style.display = 'inline-flex';

        // Championship: each race entry carries its own isSprintRace flag.
        // Simple GP mode: there's no per-race entry, fall back to the
        // Circuit tab's sprint toggle.
        const isSprintRace = isChampionship
            ? !!circuitData.isSprintRace
            : localStorage.getItem('isSprint') === 'true';
        sprintBadge.hidden = !isSprintRace;
    } else {
        flagWrap.style.display = 'none';
    }
}

// Generate and store weather curves for both quali and race
function generateAndStoreWeather(rainProbability) {
    const QUALI_FRAMES = 3600;
    const RACE_FRAMES = 5400;
    const mode = document.getElementById('weatherMode')?.value || 'default';

    let qualiRain, qualiWater, raceRain, raceWater;
    if (mode === 'dry') {
        [qualiRain, qualiWater] = generateRainCurve(0, QUALI_FRAMES);
        [raceRain, raceWater] = generateRainCurve(0, RACE_FRAMES);
    } else if (mode === 'rain') {
        [qualiRain, qualiWater] = generateRainCurve(100, QUALI_FRAMES);
        [raceRain, raceWater] = generateRainCurve(100, RACE_FRAMES);
    } else {
        [qualiRain, qualiWater] = generateRainCurve(rainProbability, QUALI_FRAMES);
        [raceRain, raceWater] = generateRainCurve(rainProbability, RACE_FRAMES);
    }
    localStorage.setItem('weatherQuali', JSON.stringify({ rainCurve: qualiRain, trackWaterCurve: qualiWater }));
    localStorage.setItem('weatherRace', JSON.stringify({ rainCurve: raceRain, trackWaterCurve: raceWater }));
    console.log('Weather curves generated, mode:', mode, ', rain probability:', rainProbability);
}

// Function to load circuits from JSON file
async function loadCircuits() {
    try {
        const response = await fetch('./data/circuits.json');
        const circuits = await response.json();

        const circuitList = document.getElementById('circuitList');

        // In non-championship mode, open circuit tab directly (user must select one)
        if (localStorage.getItem('championshipActive') !== 'true') {
            activateTab('step1');
        }

        // Fill the grid with circuits
        circuits.forEach(circuit => {
            const listItem = document.createElement('li');
            listItem.classList.add('circuit-list-item');
            listItem.innerHTML = `<img src="img/flags/${circuit.country.toLowerCase().replace(/ /g, "_")}.png" alt="${circuit.country}"><span>${circuit.grandPrix}</span>`;
            listItem.dataset.value = circuit.circuit;
            circuitList.appendChild(listItem);

            // Add click event to select option
            listItem.addEventListener('click', () => {
                // Delete the ‘selected’ class from all elements
                document.querySelectorAll('.circuit-list-item').forEach(item => item.classList.remove('selected'));
                // Add the ‘selected’ class to the clicked element
                listItem.classList.add('selected');

                // Store circuit information in localStorage
                const circuitData = {
                    circuit: circuit.circuit,
                    grandPrix: circuit.grandPrix,
                    country: circuit.country,
                    length: circuit.length,
                    speed: circuit.speed,
                    rain: circuit.rain,
                    overtaking: circuit.overtaking,
                    difficulty: circuit.difficulty,
                    fastSpeed: circuit.fastSpeed,
                    fastCorners: circuit.fastCorners,
                    slowCorners: circuit.slowCorners
                };
                localStorage.setItem('selectedCircuit', JSON.stringify(circuitData));
                localStorage.setItem('isSprint', document.getElementById('sprintMode').checked.toString());
                generateAndStoreWeather(circuit.rain);
                updateButtonFlag(); // Update button flag when circuit is selected
            });
        });
    } catch (error) {
        console.error('Error while loading the Grand Prix:', error);
    }
    return;
}

// ===================================================================
// TEAM / DRIVER EDITOR - rows, add/remove, count bounds (10-15 teams)
// A team always carries exactly 2 drivers; team_id is the row position.
// ===================================================================

function teamRowCount() {
    return document.querySelectorAll('#teamTable .team-row').length;
}

// Re-number every team input id to its 1-based row position, so the two
// lookups used elsewhere (by id, and teamNames[team_id-1]) always agree.
function renumberTeamRows() {
    document.querySelectorAll('#teamTable .team-name').forEach((input, i) => {
        input.id = String(i + 1);
    });
}

// Build one team <tr> (position = 1-based). Wires the car-image picker and
// the "remove" button, and binds live updates.
function makeTeamRow(team, position) {
    const teamName  = team.team ?? team.name ?? `Team ${position}`;
    const teamImage = (team.image || 'MER24').replace(/^img\/cars\//, '').replace(/\.png$/, '');
    const row = document.createElement('tr');
    row.classList.add('team-row');
    row.innerHTML = `
        <td>
            <input type="text" id="${position}" value="${teamName}" class="team-name team-data" />
            <button type="button" class="team-remove" title="Remove team">&times;</button>
        </td>
        <td><input type="number" value="${team.teamSPD ?? 70}" class="team-data" /></td>
        <td><input type="number" value="${team.teamFS ?? 70}" class="team-data" /></td>
        <td><input type="number" value="${team.teamSS ?? 70}" class="team-data" /></td>
        <td><input type="number" value="${team.teamFB ?? 70}" class="team-data" /></td>
        <td><input type="color" value="${team.color || '#888888'}" class="team-data" /></td>
        <td>
            <div class="image-container">
                <img src="img/cars/${teamImage}.png" alt="${teamName}" class="team-image" />
            </div>
        </td>
    `;

    // Car-image dropdown
    const imageDropdown = document.createElement('div');
    imageDropdown.className = 'image-dropdown';
    document.body.appendChild(imageDropdown);
    row._imageDropdown = imageDropdown; // removed with the row
    TEAM_IMAGE_LIST.forEach(imageName => {
        const opt = document.createElement('img');
        opt.src = `img/cars/${imageName}.png`;
        opt.alt = imageName;
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const img = row.querySelector('.team-image');
            img.setAttribute('src', `img/cars/${imageName}.png`);
            img.alt = imageName;
            imageDropdown.style.display = 'none';
            updateDriverTeamOptions();
        });
        imageDropdown.appendChild(opt);
    });
    const imgElement = row.querySelector('.team-image');
    imgElement.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.image-dropdown').forEach(d => { if (d !== imageDropdown) d.style.display = 'none'; });
        const rect = imgElement.getBoundingClientRect();
        imageDropdown.style.display = 'flex';
        let left = rect.left;
        if (left + 340 > window.innerWidth - 8) left = window.innerWidth - 348;
        imageDropdown.style.top = (rect.bottom + 6) + 'px';
        imageDropdown.style.left = left + 'px';
    });

    row.querySelector('.team-remove').addEventListener('click', () => removeTeamAt(row));
    row.querySelectorAll('.team-data').forEach(inp => inp.addEventListener('input', updateDriverTeamOptions));
    return row;
}

// Build one driver <tr>. teamName is shown as-is; updateDriverTeamOptions()
// keeps it in sync afterwards.
function makeDriverRow(driver, index, teamName) {
    const row = document.createElement('tr');
    row.classList.add('driver-row');
    row.draggable = true;
    row.dataset.driverIndex = index;
    row.style.cursor = 'grab';
    const shownTeam = teamName
        || (teamNames && teamNames[driver.team_id - 1] && teamNames[driver.team_id - 1].name)
        || '';
    row.innerHTML = `
        <td class="driver-handle">&#8942;&#8942;</td>
        <td><input type="text" value="${driver.name ?? ''}" class="team-data" /></td>
        <td><input type="text" value="${driver.code ?? ''}" class="team-data" /></td>
        <td><input type="number" value="${driver.driverLevel ?? 70}" class="team-data" /></td>
        <td id="teamNameDriver">${shownTeam}</td>
    `;
    row.querySelectorAll('.team-data').forEach(inp => inp.addEventListener('input', updateDriverTeamOptions));
    return row;
}

// A generic team + its two generic drivers (used by the "add team" button).
function genericTeam(position) {
    const img = TEAM_IMAGE_LIST[(position * 7) % TEAM_IMAGE_LIST.length];
    return {
        team: `New Team ${position}`,
        teamSPD: 70, teamFS: 70, teamSS: 70, teamFB: 70,
        color: '#888888',
        image: img
    };
}
function genericDrivers(position) {
    return [
        { name: `Driver ${position * 2 - 1}`, code: `D${position * 2 - 1}`, driverLevel: 70 },
        { name: `Driver ${position * 2}`,     code: `D${position * 2}`,     driverLevel: 70 }
    ];
}

function addTeam() {
    if (teamRowCount() >= MAX_TEAMS) return;
    const pos = teamRowCount() + 1;
    document.getElementById('teamTable').querySelector('tbody').appendChild(makeTeamRow(genericTeam(pos), pos));
    renumberTeamRows();
    updateDriverTeamOptions(); // rebuilds teamNames so the driver rows can show the name

    const driverBody = document.getElementById('driverTable').querySelector('tbody');
    genericDrivers(pos).forEach((d, k) => {
        d.team_id = pos;
        driverBody.appendChild(makeDriverRow(d, driverBody.children.length, `New Team ${pos}`));
    });
    setupDriverDragDrop();
    refreshTeamCountControls();
    updateDriverTeamOptions();
}

function removeTeamAt(teamRow) {
    if (teamRowCount() <= MIN_TEAMS) return;
    const rows = [...document.querySelectorAll('#teamTable .team-row')];
    const pos = rows.indexOf(teamRow); // 0-based
    if (pos < 0) return;
    if (teamRow._imageDropdown) teamRow._imageDropdown.remove();
    teamRow.remove();
    // Drop that team's two drivers (rows pos*2 and pos*2+1)
    const driverRows = [...document.querySelectorAll('#driverTable .driver-row')];
    [driverRows[pos * 2 + 1], driverRows[pos * 2]].forEach(r => r && r.remove());
    renumberTeamRows();
    refreshTeamCountControls();
    updateDriverTeamOptions();
}

// The "+ Add team" bar under the team table (created once).
function installTeamCountControls() {
    const content = document.querySelector('#step2 .accordion-content');
    if (!content || content.querySelector('.team-count-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'team-count-bar';
    bar.innerHTML = `
        <button type="button" id="add-team-btn" class="btn-add-team">+ Add team</button>
        <span class="team-count-note"></span>
    `;
    content.appendChild(bar);
    bar.querySelector('#add-team-btn').addEventListener('click', addTeam);
}

function refreshTeamCountControls() {
    const n = teamRowCount();
    const addBtn = document.getElementById('add-team-btn');
    if (addBtn) addBtn.disabled = n >= MAX_TEAMS;
    document.querySelectorAll('#teamTable .team-remove').forEach(b => { b.disabled = n <= MIN_TEAMS; });
    const note = document.querySelector('.team-count-note');
    if (note) note.textContent = `${n} teams · ${n * 2} drivers  (min ${MIN_TEAMS} / max ${MAX_TEAMS})`;
}

// Function to load teams from JSON file
async function loadTeams() {
    try {
        const isChampionship = localStorage.getItem('championshipActive') === 'true';
        let teams;
        const savedTeams = localStorage.getItem('teams');
        if (isChampionship && savedTeams) {
            teams = JSON.parse(savedTeams);
        } else {
            const response = await fetch('./data/team_default.json');
            teams = await response.json();
        }

        const teamTableBody = document.getElementById('teamTable').querySelector('tbody');

        // Trim silently if a saved/edited config is over the max (a warning about
        // out-of-range fields is surfaced at "Go to Qualifying").
        if (Array.isArray(teams) && teams.length > MAX_TEAMS) {
            console.warn(`Team list has ${teams.length} teams, keeping the first ${MAX_TEAMS}`);
            teams = teams.slice(0, MAX_TEAMS);
        }

        // Fill the table with teams (position drives team_id)
        teamTableBody.innerHTML = '';
        teams.forEach((team, idx) => teamTableBody.appendChild(makeTeamRow(team, idx + 1)));

        // Close image dropdown when clicking outside (bind once)
        if (!document.body.dataset.teamDropdownBound) {
            document.body.dataset.teamDropdownBound = '1';
            document.addEventListener('click', () => {
                document.querySelectorAll('.image-dropdown').forEach(d => d.style.display = 'none');
            });
        }

        installTeamCountControls();
        refreshTeamCountControls();
        updateDriverTeamOptions();
    } catch (error) {
        console.error('Error while loading the teams:', error);
    }
    return;
}

// Setup drag and drop for driver rows
let draggedDriverRow = null;

function setupDriverDragDrop() {
    const driverRows = document.querySelectorAll('.driver-row');

    driverRows.forEach(row => {
        if (row.dataset.dndBound) return; // don't double-bind rows added later
        row.dataset.dndBound = '1';
        row.addEventListener('dragstart', (e) => {
            draggedDriverRow = row;
            row.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });

        row.addEventListener('dragend', (e) => {
            row.style.opacity = '1';
            draggedDriverRow = null;
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (row !== draggedDriverRow) {
                row.style.backgroundColor = '#333';
            }
        });

        row.addEventListener('dragleave', (e) => {
            row.style.backgroundColor = '';
        });

        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.style.backgroundColor = '';
            
            if (row !== draggedDriverRow && draggedDriverRow) {
                // Swap the rows
                swapDriverRows(draggedDriverRow, row);
            }
        });
    });
}

// Swap two driver rows and update data
function swapDriverRows(row1, row2) {
    // Get input values from row1 (skip first column which is the handle)
    const row1Inputs = row1.querySelectorAll('input[type="text"], input[type="number"]');
    const row1Name = row1Inputs[0].value;
    const row1Code = row1Inputs[1].value;
    const row1Level = row1Inputs[2].value;
    
    // Get input values from row2 (skip first column which is the handle)
    const row2Inputs = row2.querySelectorAll('input[type="text"], input[type="number"]');
    const row2Name = row2Inputs[0].value;
    const row2Code = row2Inputs[1].value;
    const row2Level = row2Inputs[2].value;
    
    // Swap the values
    row1Inputs[0].value = row2Name;
    row1Inputs[1].value = row2Code;
    row1Inputs[2].value = row2Level;
    
    row2Inputs[0].value = row1Name;
    row2Inputs[1].value = row1Code;
    row2Inputs[2].value = row1Level;
    
    // Update the data in storage
    updateDriverTeamOptions();
}

// Function to update driver team options
function updateDriverTeamOptions() {
    const rows = document.querySelectorAll('.team-row');
    const dataArray = [];
    rows.forEach(row => {
        // Get all cells (<td>) in the current row
        const cells = row.querySelectorAll('td');
    
        // Create an object to store data for the current line
        const rowData = {
            id: parseInt(cells[0].querySelector('.team-name').id),
            name: cells[0].querySelector('.team-name').value, // Get team name input value
            teamSPD: cells[1].querySelector('input[type="number"]').value, // Get speed input value
            teamFS: cells[2].querySelector('input[type="number"]').value, // Get fast corners input value
            teamSS: cells[3].querySelector('input[type="number"]').value, // Get slow corners input value
            teamFB: cells[4].querySelector('input[type="number"]').value, // Get reliability input value
            color: cells[5].querySelector('input[type="color"]').value, // Get color input value
            image: cells[6].querySelector('.team-image').getAttribute('src') // Get team image src attribute
        };
    
        // Add line data to main array
        dataArray.push(rowData);
    });

    teamNames = dataArray;

    // Persist teams in championship mode
    if (localStorage.getItem('championshipActive') === 'true') {
        localStorage.setItem('teams', JSON.stringify(dataArray));
        
        // Auto-save championship if active
        if (window.autoSaveChampionship) {
            window.autoSaveChampionship();
        }
    }

    const cells = document.querySelectorAll('#teamNameDriver')
    
    cells.forEach((cell, index) => {
        let team_index = Math.ceil((index+1)/2)-1;
        cell.innerHTML = (teamNames[team_index] && teamNames[team_index].name) || '';
    });

    const driversRows = document.querySelectorAll('.driver-row');
    const driversArray = [];
    driversRows.forEach((row, index) => {
        // Get all cells (<td>) in the current row
        const cells = row.querySelectorAll('td');
        //console.log(cells);
    
        // Create an object to store data for the current line
        // Note: cells[0] is now the drag handle, so inputs are at indices 1, 2, 3
        const rowData = {
            name: cells[1].querySelector('input[type="text"]').value, 
            code: cells[2].querySelector('input[type="text"]').value,
            level: cells[3].querySelector('input[type="number"]').value,
            team_id: Math.ceil((index+1)/2),
        };
    
        // Add line data to main array
        driversArray.push(rowData);
    });
    //console.log(driversArray);
    // Create a table to store drivers and their teams
    const driversData = driversArray.map(driver => ({
        name: driver.name,
        code: driver.code,
        driverLevel: driver.level,
        team_id: driver.team_id,
        team: teamNames.find(team => team.id === driver.team_id)?.name,
        teamSPD: teamNames.find(team => team.id === driver.team_id)?.teamSPD,
        teamFS: teamNames.find(team => team.id === driver.team_id)?.teamFS,
        teamSS: teamNames.find(team => team.id === driver.team_id)?.teamSS,
        teamFB: teamNames.find(team => team.id === driver.team_id)?.teamFB,
        color: teamNames.find(team => team.id === driver.team_id)?.color,
        image: teamNames.find(team => team.id === driver.team_id)?.image,
    }));

    // Save driver data in localStorage
    localStorage.setItem('selectedDrivers', JSON.stringify(driversData));
    console.log(JSON.parse(localStorage.getItem('selectedDrivers')));

    // Auto-save championship if active
    if (window.autoSaveChampionship) {
        window.autoSaveChampionship();
    }
}

// Function to load drivers from JSON file
async function loadDrivers() {
    try {
        const isChampionship = localStorage.getItem('championshipActive') === 'true';
        let drivers = [];

        if (isChampionship) {
            const savedDrivers = localStorage.getItem('drivers');
            if (savedDrivers) {
                drivers = JSON.parse(savedDrivers);
                // Sort by team_id to preserve team order
                drivers.sort((a, b) => (a.team_id || 0) - (b.team_id || 0));
            } else {
                const response = await fetch('./data/driver_default.json');
                drivers = await response.json();
            }
        } else {
            // Single GP mode
            const response = await fetch('./data/driver_default.json');
            drivers = await response.json();
        }

        // A team carries exactly 2 drivers, so cap the list at the team count.
        const maxDrivers = teamRowCount() * 2 || (drivers.length);
        if (drivers.length > maxDrivers) drivers = drivers.slice(0, maxDrivers);

        const driverTableBody = document.getElementById('driverTable').querySelector('tbody');
        driverTableBody.innerHTML = '';
        drivers.forEach((driver, index) => driverTableBody.appendChild(makeDriverRow(driver, index)));

        setupDriverDragDrop();
        updateDriverTeamOptions();
    } catch (error) {
        console.error('Error while loading the drivers:', error);
    }
    return;
}

function showOverview() {
    const overviewDiv = document.querySelector('#step4 .accordion-content');
    overviewDiv.innerHTML = ""; // Reset

    // --- Circuit ---
    // In championship mode, always read directly from the championship race list
    let circuit;
    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    if (isChampionship) {
        const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        const championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        const raceJustPlayed = Array.isArray(championshipResults[currentRaceIndex]);
        const displayIndex = raceJustPlayed
            ? Math.min(currentRaceIndex + 1, races.length - 1)
            : currentRaceIndex;
        circuit = races[displayIndex];
        // Also keep selectedCircuit in sync
        if (circuit) {
            localStorage.setItem('selectedCircuit', JSON.stringify(circuit));
            // Synchronize isSprint flag with championship race config
            localStorage.setItem('isSprint', (circuit.isSprintRace || false).toString());
        }
    } else {
        circuit = JSON.parse(localStorage.getItem('selectedCircuit'));
    }
    if (circuit) {
        // Weather preview
        const storedQuali = localStorage.getItem('weatherQuali');
        const storedRace = localStorage.getItem('weatherRace');
        let weatherHTML = '';
        if (storedQuali && storedRace) {
            const qualiMax = Math.max(...JSON.parse(storedQuali).rainCurve);
            const raceMax = Math.max(...JSON.parse(storedRace).rainCurve);
            const qualiDesc = getWeatherDescription(qualiMax);
            const raceDesc = getWeatherDescription(raceMax);
            weatherHTML = `
                <div style="display:flex;gap:12px;margin-bottom:14px;">
                    <div style="flex:1;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:10px 14px;text-align:center;">
                        <div style="font-size:0.75em;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Qualifying</div>
                        <div style="font-size:1.2em;">${qualiDesc}</div>
                    </div>
                    <div style="flex:1;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:10px 14px;text-align:center;">
                        <div style="font-size:0.75em;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Race</div>
                        <div style="font-size:1.2em;">${raceDesc}</div>
                    </div>
                </div>`;
        }
        overviewDiv.innerHTML += `
            <h2>Selected Circuit</h2>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px;">
                <img src="img/flags/${circuit.country.toLowerCase().replace(/ /g, "_")}.png" alt="${circuit.country}" style="height:32px;">
                <p style="margin:0;">
                    <strong>${circuit.grandPrix}</strong> (${circuit.country})<br>
                    Length : ${circuit.length} m<br>
                    <span style="font-size:0.85em;color:#aaa;">${localStorage.getItem('isSprint') === 'true' ? '🏁 SPRINT MODE (100km)' : 'Normal Race (300km)'}</span>
                </p>
            </div>
            ${weatherHTML}
            <canvas id="overviewCanvas" width="300" height="200" style="display:block;margin:10px auto;"></canvas>
        `;
        // Circuit design
        fetch('./data/circuits.json')
            .then(res => res.json())
            .then(data => {
                const circuitData = data.find(item => item.circuit === circuit.circuit);
                if (circuitData) {
                    const cX = circuitData.coor.map(pt => pt[0]);
                    const cY = circuitData.coor.map(pt => pt[1]);
                    const ctx = document.getElementById('overviewCanvas').getContext('2d');
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cX[0]/10+50, -cY[0]/10+25);
                    for (let i = 1; i < cX.length; i++) {
                        ctx.lineTo(cX[i]/10+50, -cY[i]/10+25);
                    }
                    ctx.stroke();
                }
            });
    }

    // --- Drivers ---
    const drivers = JSON.parse(localStorage.getItem('selectedDrivers'));
    if (drivers && drivers.length) {
        overviewDiv.innerHTML += `<h2>Selected Drivers</h2>
        <table style="width:100%;color:white;">
            <tr><th width=2px></th><th>Nom</th><th>Code</th><th>Team</th></tr>
            ${drivers.map(driver => {
                const team = teamNames.find(t => t.id === driver.team_id);
                return `<tr>
                    <td style="background:${team?.color || '#fff'};color:${team?.color ? '#fff' : '#000'};"></td>
                    <td style="padding-left:5px;">${driver.name}</td>
                    <td>${driver.code}</td>
                    <td>${team?.name || 'N/A'}</td>
                </tr>`;
            }).join('')}
        </table>`;
    }
}

// Activate a tab panel and update the tab button highlight
function activateTab(stepId) {
    document.querySelectorAll('.accordion-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.gp-tab-btn').forEach(btn => btn.classList.remove('active'));
    const panel = document.getElementById(stepId);
    if (panel) panel.classList.add('active');
    const btn = document.querySelector(`.gp-tab-btn[data-target="${stepId}"]`);
    if (btn) btn.classList.add('active');
    if (stepId === 'step4') showOverview();
    if (stepId.includes('standings')) renderChampionshipStandings();
    if (stepId === 'step-stats') renderChampionshipStats();
    if (stepId === 'step-progression') renderChampionshipProgression();
}

// ---- Championship stats + points progression (shared helpers: championship_common.js) ----
let championshipProgressionChart = null;

// Standings/stats in ChampionshipCommon's format, straight from what's recorded.
function ccChampionshipData() {
    if (typeof ChampionshipCommon === 'undefined') return null;
    let races, results, points;
    try {
        races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        results = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        points = JSON.parse(localStorage.getItem('championshipPoints') || 'null');
    } catch (e) { return null; }
    const clean = ChampionshipCommon.sanitizePairs(races, results);
    const opts = {
        fastestLapPoint: localStorage.getItem('championshipFastestLapPoint') === 'true',
        fastestLapTopN: parseInt(localStorage.getItem('championshipFastestLapTopN') || '10'),
        polePositionPoints: parseInt(localStorage.getItem('championshipPolePositionPoints') || '0')
    };
    return {
        races: clean.races,
        standings: ChampionshipCommon.computeStandings(clean.races, clean.results, ChampionshipCommon.normalizePoints(points), opts),
        stats: ChampionshipCommon.computeStats(clean.races, clean.results, ChampionshipCommon.normalizePoints(points))
    };
}

function renderChampionshipStats() {
    const d = ccChampionshipData();
    const dEl = document.getElementById('champ-stats-drivers');
    const cEl = document.getElementById('champ-stats-constructors');
    const note = document.getElementById('champ-stats-note');
    if (!d || !dEl) return;
    const txt = ChampionshipCommon.statsNote(d.stats);
    if (note) { note.hidden = !txt; note.textContent = txt; }
    dEl.innerHTML = ChampionshipCommon.buildDriverStatsTable(d.stats);
    cEl.innerHTML = ChampionshipCommon.buildTeamStatsTable(d.stats);
}

function renderChampionshipProgression() {
    const d = ccChampionshipData();
    const canvas = document.getElementById('champ-progression-canvas');
    if (!d || !canvas || canvas.offsetParent === null) return;
    const modeEl = document.querySelector('input[name="champProgMode"]:checked');
    const mode = modeEl ? modeEl.value : 'drivers';
    championshipProgressionChart = ChampionshipCommon.progressionChart(canvas, {
        standings: mode === 'constructors' ? d.standings.constructorStandings : d.standings.driverStandings,
        races: d.races, mode, chart: championshipProgressionChart
    });
}

// Render championship standings into the standings tab panels
function renderChampionshipStandings() {
    const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    // Sprint race points: 8,7,6,5,4,3,2,1 then 0 for every other position.
    const POINTS_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const SPECIAL_CHAMPIONSHIP_POINTS = Array.from({length: 22}, (_, i) => 22 - i);
    const SPRINT_CHAMPIONSHIP_POINTS = [100, 75, 60, 50, 42, 35, 28, 22, 18, 14, 10, 6, 3, 2, 1, ...Array(7).fill(0)];
    
    let championshipResults, races;
    try {
        championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
    } catch(e) { championshipResults = []; races = []; }
    if (!Array.isArray(championshipResults)) championshipResults = [];
    if (!Array.isArray(races)) races = [];

    const validPairs = races
        .map((r, i) => ({ race: r, result: championshipResults[i], i }))
        .filter(({ race, result }) => race != null && (result == null || Array.isArray(result)));
    races = validPairs.map(p => p.race);
    championshipResults = validPairs.map(p => p.result ?? []);

    // Check if special championship mode is enabled
    const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
    
    // Get points to use for sprint races
    let pointsSprintToUse = POINTS_SPRINT;
    if (specialMode) {
        pointsSprintToUse = SPECIAL_CHAMPIONSHIP_POINTS;
    }

    let allDrivers = {}, allTeams = {};
    championshipResults.forEach(race => {
        race.forEach(d => {
            allDrivers[d.code] = d.name;
            if (!allTeams[d.team]) allTeams[d.team] = d.team;
        });
    });

    // Tables for all races (both feature and sprint)
    let driverPointsTable = {}, teamPointsTable = {};
    let driverPointsTableSprint = {}, teamPointsTableSprint = {};
    let driverPointsTableFeature = {}, teamPointsTableFeature = {};

    // Feature-race finishing positions, for the FIA countback tie-break
    // (most wins, then 2nds, then 3rds…) - same rule and same feature-only
    // scope as ChampionshipCommon.computeStandings(), which the Stats/
    // Progression tabs already use.
    let driverFeatPos = {}, teamFeatPos = {};

    // Fastest-lap bonus point (set in Championship Setup). Feature races only.
    const flPointEnabled = localStorage.getItem('championshipFastestLapPoint') === 'true';
    const flTopN = parseInt(localStorage.getItem('championshipFastestLapTopN') || '10') || 0;

    // Pole-position bonus points (set in Championship Setup). Feature races only.
    const polePoints = parseInt(localStorage.getItem('championshipPolePositionPoints') || '0') || 0;

    races.forEach((race, raceIdx) => {
        const results = championshipResults[raceIdx] || [];
        const pointsScale = race.isSprintRace ? pointsSprintToUse : POINTS;
        
        results.filter(d => d.state !== 'out').sort((a, b) => b.totalLength - a.totalLength)
            .forEach((driver, idx) => {
                if (!driverPointsTable[driver.code]) driverPointsTable[driver.code] = Array(races.length).fill(0);
                driverPointsTable[driver.code][raceIdx] = pointsScale[idx] || 0;

                if (race.isSprintRace) {
                    if (!driverPointsTableSprint[driver.code]) driverPointsTableSprint[driver.code] = Array(races.length).fill(0);
                    driverPointsTableSprint[driver.code][raceIdx] = pointsScale[idx] || 0;
                } else {
                    if (!driverPointsTableFeature[driver.code]) driverPointsTableFeature[driver.code] = Array(races.length).fill(0);
                    driverPointsTableFeature[driver.code][raceIdx] = pointsScale[idx] || 0;
                    (driverFeatPos[driver.code] = driverFeatPos[driver.code] || []).push(idx + 1);
                    (teamFeatPos[driver.team] = teamFeatPos[driver.team] || []).push(idx + 1);
                }
            });
        
        Object.values(allTeams).forEach(team => {
            if (!teamPointsTable[team]) teamPointsTable[team] = Array(races.length).fill(0);
            if (!teamPointsTableSprint[team]) teamPointsTableSprint[team] = Array(races.length).fill(0);
            if (!teamPointsTableFeature[team]) teamPointsTableFeature[team] = Array(races.length).fill(0);
        });
        
        results.filter(d => d.state !== 'out').sort((a, b) => b.totalLength - a.totalLength)
            .forEach((driver, idx) => {
                teamPointsTable[driver.team][raceIdx] += pointsScale[idx] || 0;
                if (race.isSprintRace) {
                    teamPointsTableSprint[driver.team][raceIdx] += pointsScale[idx] || 0;
                } else {
                    teamPointsTableFeature[driver.team][raceIdx] += pointsScale[idx] || 0;
                }
            });

        // Fastest-lap bonus: +1 to the holder of this feature race, if classified
        // within the configured top N (flTopN <= 0 = any position).
        if (flPointEnabled && !race.isSprintRace) {
            const order = results.filter(d => d.state !== 'out').sort((a, b) => b.totalLength - a.totalLength);
            const flPos = order.findIndex(d => d.fastestLapOfRace);
            if (flPos !== -1 && (flTopN <= 0 || flPos < flTopN)) {
                const h = order[flPos];
                [driverPointsTable, driverPointsTableFeature].forEach(tbl => {
                    if (!tbl[h.code]) tbl[h.code] = Array(races.length).fill(0);
                    tbl[h.code][raceIdx] += 1;
                });
                [teamPointsTable, teamPointsTableFeature].forEach(tbl => {
                    if (!tbl[h.team]) tbl[h.team] = Array(races.length).fill(0);
                    tbl[h.team][raceIdx] += 1;
                });
            }
        }

        // Pole-position bonus: configurable points to whoever starts P1 in this
        // feature race, regardless of the race result (rewards qualifying).
        if (polePoints && !race.isSprintRace) {
            const poleHolder = results.find(d => d && d.startPosition === 1);
            if (poleHolder) {
                [driverPointsTable, driverPointsTableFeature].forEach(tbl => {
                    if (!tbl[poleHolder.code]) tbl[poleHolder.code] = Array(races.length).fill(0);
                    tbl[poleHolder.code][raceIdx] += polePoints;
                });
                [teamPointsTable, teamPointsTableFeature].forEach(tbl => {
                    if (!tbl[poleHolder.team]) tbl[poleHolder.team] = Array(races.length).fill(0);
                    tbl[poleHolder.team][raceIdx] += polePoints;
                });
            }
        }
    });

    // Calculate sprint championship points (based on overall sprint classification)
    const calculateSprintChampionshipPoints = () => {
        let driverSprintChampPoints = {}, teamSprintChampPoints = {};
        
        if (specialMode) {
            // Rank drivers by their sprint points total
            const driverSprintTotals = Object.entries(driverPointsTableSprint)
                .map(([code, ptsArr]) => ({ code, total: ptsArr.reduce((a,b)=>a+b,0) }))
                .sort((a, b) => b.total - a.total);
            
            // Assign sprint championship points [100, 75, 60, ...]
            driverSprintTotals.forEach((d, idx) => {
                driverSprintChampPoints[d.code] = SPRINT_CHAMPIONSHIP_POINTS[idx] || 0;
            });
            
            // Do the same for teams
            const teamSprintTotals = Object.entries(teamPointsTableSprint)
                .map(([team, ptsArr]) => ({ team, total: ptsArr.reduce((a,b)=>a+b,0) }))
                .sort((a, b) => b.total - a.total);
            
            teamSprintTotals.forEach((t, idx) => {
                teamSprintChampPoints[t.team] = SPRINT_CHAMPIONSHIP_POINTS[idx] || 0;
            });
        }
        
        return { driverSprintChampPoints, teamSprintChampPoints };
    };
    
    const { driverSprintChampPoints, teamSprintChampPoints } = calculateSprintChampionshipPoints();

    // Column header for a race: short code, with a ·S suffix for sprint races.
    const colLabel = r => `${String(r.displayCode || r.circuit).toUpperCase()}${r.isSprintRace ? '·S' : ''}`;

    // In CLASSIC mode every race (feature + sprint) counts toward the single
    // championship table. In SPECIAL mode only feature races are shown here;
    // sprints keep their separate tabs and feed a "projected total".
    const columnRaces = specialMode ? races.filter(r => !r.isSprintRace) : races;
    const columnIndices = specialMode
        ? races.map((r, i) => !r.isSprintRace ? i : -1).filter(i => i !== -1)
        : races.map((_, i) => i);

    // Generic renderer used for both drivers and constructors
    const renderStandingsTable = (nameHeader, pointsSource, featureSource, sprintChampPoints, nameFn, sortByProjected, featPosSource) => {
        let table = `<table><thead><tr><th>#</th><th>${nameHeader}</th>`;
        columnRaces.forEach(r => table += `<th>${colLabel(r)}</th>`);
        table += `<th class="standings-sort-total" onclick="window.standingsSortMode = false; renderChampionshipStandings()">Total</th>`;
        if (specialMode) {
            table += `<th>Sprint Pts</th><th class="standings-sort-projected" onclick="window.standingsSortMode = true; renderChampionshipStandings()">Projected Total</th>`;
        }
        table += `</tr></thead><tbody>`;

        // Classic: combined points over all races. Special: feature-only points.
        const source = specialMode ? featureSource : pointsSource;

        let rows = Object.entries(source).map(([key, ptsArr]) => {
            const cols = columnIndices.map(idx => ptsArr[idx] || 0);
            return {
                key,
                cols,
                total: cols.reduce((x, y) => x + y, 0),
                sprintChampPts: sprintChampPoints[key] || 0,
                countback: ChampionshipCommon.positionHistogram(featPosSource && featPosSource[key])
            };
        });

        if (sortByProjected && specialMode) {
            rows.sort((a, b) => (b.total + b.sprintChampPts) - (a.total + a.sprintChampPts));
        } else {
            // FIA countback tie-break on equal points (most wins, then 2nds,
            // then 3rds…) - same rule the Stats/Progression tabs already use.
            rows.sort(ChampionshipCommon.compareStandingRows);
        }

        rows.forEach(({ key, cols, total, sprintChampPts }, idx) => {
            table += `<tr><td>${idx + 1}</td><td>${nameFn(key)}</td>`;
            cols.forEach(pts => table += `<td${pts === 0 ? ' class="no-points"' : ''}>${pts === 0 ? '-' : pts}</td>`);
            table += `<td><b>${total}</b></td>`;
            if (specialMode) {
                table += `<td>${sprintChampPts}</td><td><b>${total + sprintChampPts}</b></td>`;
            }
            table += `</tr>`;
        });
        table += `</tbody></table>`;
        return table;
    };

    const renderDriverStandings = (sortByProjected = false) =>
        renderStandingsTable('Driver', driverPointsTable, driverPointsTableFeature,
            driverSprintChampPoints, code => allDrivers[code] || code, sortByProjected, driverFeatPos);

    const renderTeamStandings = (sortByProjected = false) =>
        renderStandingsTable('Constructor', teamPointsTable, teamPointsTableFeature,
            teamSprintChampPoints, team => team, sortByProjected, teamFeatPos);

    const sortByProjected = window.standingsSortMode === true;
    const driverTable = renderDriverStandings(sortByProjected);
    const teamTable = renderTeamStandings(sortByProjected);

    const driversPanel = document.getElementById('tab-drivers');
    const constructorsPanel = document.getElementById('tab-constructors');
    if (driversPanel) driversPanel.innerHTML = driverTable;
    if (constructorsPanel) constructorsPanel.innerHTML = teamTable;

    // Generate sprint race standings (only if special mode)
    if (specialMode) {
        const sprintRaces = races.filter(r => r.isSprintRace);
        const sprintRaceIndices = races.map((r, i) => r.isSprintRace ? i : -1).filter(i => i !== -1);
        
        let driverPointsTableSprintFiltered = {};
        let teamPointsTableSprintFiltered = {};
        
        Object.entries(driverPointsTableSprint).forEach(([code, ptsArr]) => {
            driverPointsTableSprintFiltered[code] = sprintRaceIndices.map(idx => ptsArr[idx]);
        });
        Object.entries(teamPointsTableSprint).forEach(([team, ptsArr]) => {
            teamPointsTableSprintFiltered[team] = sprintRaceIndices.map(idx => ptsArr[idx]);
        });
        
        let driverTableSprint = `<table><thead><tr><th>#</th><th>Driver</th>`;
        sprintRaces.forEach(r => driverTableSprint += `<th>${String(r.displayCode || r.circuit).toUpperCase()}</th>`);
        driverTableSprint += `<th>Total</th><th>Championship Value</th></tr></thead><tbody>`;
        Object.entries(driverPointsTableSprintFiltered)
            .sort((a, b) => b[1].reduce((x,y)=>x+y,0) - a[1].reduce((x,y)=>x+y,0))
            .forEach(([code, ptsArr], idx) => {
                driverTableSprint += `<tr><td>${idx+1}</td><td>${allDrivers[code]||code}</td>`;
                ptsArr.forEach(pts => driverTableSprint += `<td${pts===0?' class="no-points"':''}>${pts===0?'-':pts}</td>`);
                driverTableSprint += `<td><b>${ptsArr.reduce((x,y)=>x+y,0)}</b></td><td style="color:#888">${SPRINT_CHAMPIONSHIP_POINTS[idx] || 0} pts</td></tr>`;
            });
        driverTableSprint += `</tbody></table>`;

        let teamTableSprint = `<table><thead><tr><th>#</th><th>Constructor</th>`;
        sprintRaces.forEach(r => teamTableSprint += `<th>${String(r.displayCode || r.circuit).toUpperCase()}</th>`);
        teamTableSprint += `<th>Total</th><th>Championship Value</th></tr></thead><tbody>`;
        Object.entries(teamPointsTableSprintFiltered)
            .sort((a, b) => b[1].reduce((x,y)=>x+y,0) - a[1].reduce((x,y)=>x+y,0))
            .forEach(([team, ptsArr], idx) => {
                teamTableSprint += `<tr><td>${idx+1}</td><td>${team}</td>`;
                ptsArr.forEach(pts => teamTableSprint += `<td${pts===0?' class="no-points"':''}>${pts===0?'-':pts}</td>`);
                teamTableSprint += `<td><b>${ptsArr.reduce((x,y)=>x+y,0)}</b></td><td style="color:#888">${SPRINT_CHAMPIONSHIP_POINTS[idx] || 0} pts</td></tr>`;
            });
        teamTableSprint += `</tbody></table>`;

        const driversPanelSprint = document.getElementById('tab-drivers-sprint');
        const constructorsPanelSprint = document.getElementById('tab-constructors-sprint');
        if (driversPanelSprint) driversPanelSprint.innerHTML = driverTableSprint;
        if (constructorsPanelSprint) constructorsPanelSprint.innerHTML = teamTableSprint;
        
        document.querySelectorAll('.special-championship-only').forEach(el => el.style.display = '');
    } else {
        document.querySelectorAll('.special-championship-only').forEach(el => el.style.display = 'none');
    }
}

// Tab button click handlers
document.querySelectorAll('.gp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.target));
});

document.querySelectorAll('input[name="champProgMode"]').forEach(el => {
    el.addEventListener('change', renderChampionshipProgression);
});

// Call showOverview when the overview is open
document.querySelector('#step4 .accordion-header').addEventListener('click', showOverview);

// Manage shrink-box display — kept for JS compatibility but visually replaced by tabs
document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const accordionItem = header.parentElement;
        document.querySelectorAll('.accordion-item').forEach(item => {
            if (item !== accordionItem) item.classList.remove('active');
        });
        accordionItem.classList.toggle('active');
    });
});

// Load circuits, teams and drivers when the page is loaded
window.onload = async () => {
    await loadCircuits();
    await loadTeams();
    await loadDrivers();

    // Regenerate weather when mode changes, if a circuit is already selected
    document.getElementById('weatherMode')?.addEventListener('change', () => {
        const circuit = JSON.parse(localStorage.getItem('selectedCircuit'));
        if (circuit) {
            generateAndStoreWeather(circuit.rain);
            if (document.getElementById('step4')?.classList.contains('active')) {
                showOverview();
            }
        }
    });

    // Render overview if it is the currently active tab
    if (document.getElementById('step4')?.classList.contains('active')) {
        showOverview();
    }

    // Update button flag if a circuit is already selected
    updateButtonFlag();
    
    // Initialize starting grid display after all data is loaded
    toggleStartingGrid();
    
    // Initialize championship standings if in championship mode
    if (localStorage.getItem('championshipActive') === 'true') {
        renderChampionshipStandings();
    }
};

// Auto-save before leaving page
window.addEventListener('beforeunload', () => {
    if (window.autoSaveChampionship) {
        window.autoSaveChampionship();
    }
});

document.getElementById('goToNextPage').addEventListener('click', () => {
    const isChamp = localStorage.getItem('championshipActive') === 'true';
    const skipQualifying = !isChamp && document.getElementById('skipQualifying')?.checked === true;

    // Safety net: the team editor already bounds the field at 10-15 teams, but a
    // saved / hand-edited championship could be out of range.
    if (isChamp) {
        const n = (JSON.parse(localStorage.getItem('selectedDrivers') || '[]') || []).length;
        if (n < MIN_TEAMS * 2 || n > MAX_TEAMS * 2) {
            alert(`This championship has ${n} drivers. It must have between ${MIN_TEAMS * 2} and ${MAX_TEAMS * 2} (${MIN_TEAMS}-${MAX_TEAMS} teams). Fix it in the Team / Driver tabs.`);
            return;
        }
    }

    if (isChamp) {
        const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        const championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        
        const raceJustPlayed = Array.isArray(championshipResults[currentRaceIndex]);
        
        if (raceJustPlayed) {
            // Current race is done, advance to next
            if (currentRaceIndex < races.length - 1) {
                const nextIndex = currentRaceIndex + 1;
                localStorage.setItem('championshipCurrentRace', nextIndex.toString());
                localStorage.setItem('selectedCircuit', JSON.stringify(races[nextIndex]));
                // Synchronize isSprint flag with championship race config
                localStorage.setItem('isSprint', (races[nextIndex].isSprintRace || false).toString());
                generateAndStoreWeather(races[nextIndex].rain);
            }
        }
        
        // Auto-save before leaving
        if (window.autoSaveChampionship) {
            window.autoSaveChampionship();
        }
    }
    
    const selectedCircuit = localStorage.getItem('selectedCircuit');
    if (selectedCircuit) {
        if (skipQualifying) {
            // Save starting grid before going to race
            saveStartingGrid();
            window.location.href = 'race.html';
        } else {
            // Clear custom starting grid when doing real qualifying
            localStorage.removeItem('startingGrid');
            window.location.href = 'quali.html';
        }
    } else {
        alert('Select a Grand Prix.');
    }
});

// Function to populate and manage the starting grid
function renderStartingGrid() {
    const gridTableBody = document.getElementById('gridTableBody');
    if (!gridTableBody) return;
    
    const drivers = JSON.parse(localStorage.getItem('selectedDrivers') || '[]');
    gridTableBody.innerHTML = '';
    
    drivers.forEach((driver, index) => {
        const row = document.createElement('tr');
        row.draggable = true;
        row.dataset.gridIndex = index;
        row.style.cursor = 'grab';
        
        const team = teamNames.find(t => t.id === driver.team_id);
        
        row.innerHTML = `
            <td style="text-align:center;font-weight:bold;">${index + 1}</td>
            <td style="background:${team?.color || '#fff'};color:${team?.color ? '#fff' : '#000'};"></td>
            <td style="padding-left:5px;">${driver.name}</td>
            <td>${driver.code}</td>
            <td>${team?.name || 'N/A'}</td>
        `;
        
        row.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            row.style.opacity = '0.5';
            gridDraggedRow = row;
        });
        
        row.addEventListener('dragend', (e) => {
            row.style.opacity = '1';
            gridDraggedRow = null;
        });
        
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (row !== gridDraggedRow) {
                row.style.backgroundColor = '#333';
            }
        });
        
        row.addEventListener('dragleave', (e) => {
            row.style.backgroundColor = '';
        });
        
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.style.backgroundColor = '';
            
            if (row !== gridDraggedRow && gridDraggedRow) {
                // Swap grid positions
                swapGridRows(gridDraggedRow, row);
            }
        });
        
        gridTableBody.appendChild(row);
    });
}

// Variable to track dragged grid row
let gridDraggedRow = null;

// Function to swap two rows in the grid
function swapGridRows(row1, row2) {
    const drivers = JSON.parse(localStorage.getItem('selectedDrivers') || '[]');
    const sourceIdx = parseInt(row1.dataset.gridIndex);
    const destIdx = parseInt(row2.dataset.gridIndex);
    
    // Remove the dragged driver from its original position
    const [movedDriver] = drivers.splice(sourceIdx, 1);
    
    // Insert the driver at the destination index
    // If we dragged down, destIdx is already correct after removal
    // If we dragged up, we need to adjust
    const insertIdx = sourceIdx < destIdx ? destIdx - 1 : destIdx;
    drivers.splice(insertIdx, 0, movedDriver);
    
    localStorage.setItem('selectedDrivers', JSON.stringify(drivers));
    renderStartingGrid();
}

// Function to generate qualification results for skip qualifying mode
function generateQualificationResults() {
    // This is now handled directly in race.js when mapping drivers
    // No need to do it here - race.js will calculate missing values
    const drivers = JSON.parse(localStorage.getItem('selectedDrivers') || '[]');
    localStorage.setItem('drivers', JSON.stringify(drivers));
    return true;
}

function saveStartingGrid() {
    const drivers = JSON.parse(localStorage.getItem('selectedDrivers') || '[]');
    // Mark that we're using skip qualifying mode
    generateQualificationResults();
    localStorage.setItem('startingGrid', JSON.stringify(drivers));
    // Clear any old qualifying data to avoid conflicts
    localStorage.removeItem('drivers');
}

// Function to toggle the starting grid visibility
function toggleStartingGrid() {
    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    const skipQualifyingCheckbox = document.getElementById('skipQualifying');
    const skipQualifyingContainer = document.getElementById('skipQualifyingContainer');
    const gridSection = document.getElementById('step-grid');
    const gridTabBtn = document.querySelector('.gp-tab-btn[data-target="step-grid"]');
    const goBtn = document.getElementById('goToNextPage');

    // Show/hide skip qualifying option based on mode
    if (skipQualifyingContainer) {
        skipQualifyingContainer.style.display = isChampionship ? 'none' : 'flex';
    }

    // In championship mode, once the current race already has a result, the
    // page has moved on to "Next Race" / "Final Results" navigation (set by
    // the championship init block below) - this function's job is choosing
    // the button for the upcoming session, which no longer applies then.
    if (isChampionship) {
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        const championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        if (Array.isArray(championshipResults[currentRaceIndex])) return;
    }

    // Show/hide grid section and tab based on skip qualifying toggle
    if (skipQualifyingCheckbox && gridSection && gridTabBtn && goBtn) {
        if (skipQualifyingCheckbox.checked) {
            gridSection.style.display = '';
            gridTabBtn.style.display = '';
            setGoButtonLabel('Start Race');
            renderStartingGrid();
        } else {
            gridSection.style.display = 'none';
            gridTabBtn.style.display = 'none';
            setGoButtonLabel('Go to Qualifying');
        }
    }
}

// Add event listener to skip qualifying toggle
document.addEventListener('DOMContentLoaded', function() {
    const skipQualifyingCheckbox = document.getElementById('skipQualifying');
    if (skipQualifyingCheckbox) {
        skipQualifyingCheckbox.addEventListener('change', toggleStartingGrid);
    }
    
    // Initialize sprint toggle from localStorage
    const sprintModeCheckbox = document.getElementById('sprintMode');
    if (sprintModeCheckbox) {
        const isSprint = localStorage.getItem('isSprint') === 'true';
        sprintModeCheckbox.checked = isSprint;
        
        // Add event listener to save and update overview when toggle changes
        sprintModeCheckbox.addEventListener('change', function() {
            localStorage.setItem('isSprint', this.checked.toString());
            console.log('Sprint mode changed to:', this.checked);
            // Update overview if it's currently active
            if (document.getElementById('step4')?.classList.contains('active')) {
                showOverview();
            }
        });
    }

    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    const circuitSection = document.getElementById('step1'); // Circuit selection block

    if (isChampionship) {
        // Hide the circuit selection tab (circuit is pre-selected from championship)
        if (circuitSection) circuitSection.style.display = 'none';
        const circuitTabBtn = document.querySelector('.gp-tab-btn[data-target="step1"]');
        if (circuitTabBtn) circuitTabBtn.style.display = 'none';

        // Show championship standings tabs
        document.querySelectorAll('.championship-only').forEach(el => el.style.display = '');

        // Show/hide sprint tabs based on special championship mode
        const specialMode = localStorage.getItem('championshipSpecialMode') === 'true';
        document.querySelectorAll('.special-championship-only').forEach(el => {
            el.style.display = specialMode ? '' : 'none';
        });

        // Load the current race circuit
        const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        const selectedCircuit = races[currentRaceIndex];
        if (selectedCircuit) {
            localStorage.setItem('selectedCircuit', JSON.stringify(selectedCircuit));
            // Synchronize isSprint flag with championship race config
            localStorage.setItem('isSprint', (selectedCircuit.isSprintRace || false).toString());
            generateAndStoreWeather(selectedCircuit.rain);
        }

        // Check if the current race was just played (has saved results)
        const championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        const raceJustPlayed = Array.isArray(championshipResults[currentRaceIndex]);

        // If coming from a completed race, switch directly to standings
        if (raceJustPlayed) {
            activateTab('step-standings-drivers');
            
            // If this is the LAST race, hide the unnecessary tabs
            if (currentRaceIndex >= races.length - 1) {
                document.querySelector('.gp-tab-btn[data-target="step1"]').style.display = 'none';
                document.querySelector('.gp-tab-btn[data-target="step2"]').style.display = 'none';
                document.querySelector('.gp-tab-btn[data-target="step3"]').style.display = 'none';
                document.querySelector('.gp-tab-btn[data-target="step4"]').style.display = 'none';
            }
            
            // Modify the button behavior for post-race navigation
            const goBtn = document.getElementById('goToNextPage');
            if (goBtn) {
                if (currentRaceIndex < races.length - 1) {
                    // Not the last race: show "Next Race" button
                    setGoButtonLabel('Next Race');
                    goBtn.onclick = () => {
                        const nextIndex = currentRaceIndex + 1;
                        localStorage.setItem('championshipCurrentRace', nextIndex.toString());
                        localStorage.setItem('selectedCircuit', JSON.stringify(races[nextIndex]));
                        // Synchronize isSprint flag with championship race config
                        localStorage.setItem('isSprint', (races[nextIndex].isSprintRace || false).toString());
                        generateAndStoreWeather(races[nextIndex].rain);
                        
                        // Auto-save before leaving
                        if (window.autoSaveChampionship) {
                            window.autoSaveChampionship();
                        }
                        
                        window.location.href = 'gp_select.html';
                    };
                } else {
                    // Last race done: go to the end-of-championship recap screen
                    setGoButtonLabel('Final Results');
                    goBtn.onclick = () => {
                        // Keep championshipActive true so the recap screen can read the data;
                        // the recap screen handles deleting the save when the user is done.
                        if (window.autoSaveChampionship) {
                            window.autoSaveChampionship();
                        }
                        window.location.href = 'championship_end.html';
                    };
                }
            }
        }
    } else {
        // Show circuit selection normally
        if (circuitSection) circuitSection.style.display = '';
    }
});