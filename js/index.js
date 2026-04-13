let teamNames;

// Function to update the GP flag on the button
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
    
    if (circuitData) {
        const flagImg = document.getElementById('buttonFlagImg');
        const countryFile = circuitData.country.toLowerCase().replace(/ /g, "_");
        flagImg.src = `img/flags/${countryFile}.png`;
        flagImg.alt = circuitData.country;
        flagImg.style.display = 'inline-block';
    } else {
        const flagImg = document.getElementById('buttonFlagImg');
        flagImg.style.display = 'none';
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
                generateAndStoreWeather(circuit.rain);
                updateButtonFlag(); // Update button flag when circuit is selected
            });
        });
    } catch (error) {
        console.error('Error while loading the Grand Prix:', error);
    }
    return;
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
        const imageList = ["ALP1","ALP24","ALP25","AMR24","AMR25","ARR1","ARR201","ARR21","ARR31","AST1","BEL1","BEN1","BRA1","FER1","FER201","FER21","FER24","FER25","FRA1","GBR1","GER1","HAA1","HAA201","HAA21","HAA24","HAA25","HAA31","HAA41","HAA51","HON1","JAG1","JAG21","LOT1","LOT21","LOT31","MCL1","MCL201","MCL21","MCL24","MCL25","MCL31","MCL41","MER1","MER201","MER21","MER24","MER25","MER31","MERBLM1","PET1","PEU1","PEU2","POR1","POR21","POR31","POR41","RBR1","RBR201","RBR21","RBR24","RBR25","REN1","REN201","REN21","REN31","RENT201","RPT1","RPT201","RPT21","RPT31","SAT201","SAT21","SAU24","SAU25","STR1","VRB24","VRB25","WIL1","WIL201","WIL21","WIL24","WIL25","WIL31","WIL41","WILT201"];

        // Fill the table with teams
        teams.forEach(team => {
            // Normalize: JSON default uses {team_id, team}, localStorage uses {id, name}
            const teamId   = team.team_id ?? team.id;
            const teamName = team.team    ?? team.name;
            // Normalize image: localStorage stores full path like "img/cars/RBR1.png"
            const teamImage = team.image
                ? team.image.replace(/^img\/cars\//, '').replace(/\.png$/, '')
                : '';
            const row = document.createElement('tr');
            row.classList.add('team-row');

            row.innerHTML = `
                <td><input type="text" id="${teamId}" value="${teamName}" class="team-name team-data" /></td>
                <td><input type="number" value="${team.teamSPD}" class="team-data" /></td>
                <td><input type="number" value="${team.teamFS}" class="team-data" /></td>
                <td><input type="number" value="${team.teamSS}" class="team-data" /></td>
                <td><input type="number" value="${team.teamFB}" class="team-data" /></td>
                <td><input type="color" value="${team.color}" class="team-data" /></td>
                <td>
                    <div class="image-container">
                        <img src="img/cars/${teamImage}.png" alt="${teamName}" class="team-image" />
                    </div>
                </td>
            `;

            const imageDropdown = document.createElement('div');
            imageDropdown.className = 'image-dropdown';
            document.body.appendChild(imageDropdown);

            imageList.forEach(imageName => {
                const imageOption = document.createElement('img');
                imageOption.src = `img/cars/${imageName}.png`;
                imageOption.alt = imageName;
                imageOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const imgElement = row.querySelector('.team-image');
                    imgElement.setAttribute('src', `img/cars/${imageOption.alt}.png`);
                    imgElement.alt = imageOption.alt;
                    imageDropdown.style.display = 'none';
                    updateDriverTeamOptions();
                });
                imageDropdown.appendChild(imageOption);
            });

            const imgElement = row.querySelector('.team-image');
            imgElement.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close any other open dropdowns
                document.querySelectorAll('.image-dropdown').forEach(d => {
                    if (d !== imageDropdown) d.style.display = 'none';
                });
                const rect = imgElement.getBoundingClientRect();
                imageDropdown.style.display = 'flex';
                // Position below the image, stay within viewport
                let top = rect.bottom + 6;
                let left = rect.left;
                const dropW = 340;
                if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8;
                imageDropdown.style.top = top + 'px';
                imageDropdown.style.left = left + 'px';
            });

            teamTableBody.appendChild(row);
        });

        // Close image dropdown when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.image-dropdown').forEach(d => d.style.display = 'none');
        });

        // Add event managers to update drivers when teams change
        //console.log(document.querySelectorAll('.team-data'));
        document.querySelectorAll('.team-data').forEach(input => {
            input.addEventListener('input', updateDriverTeamOptions);
        });

        // Update driver team options initially
        updateDriverTeamOptions();
    } catch (error) {
        console.error('Error while loading the teams:', error);
    }
    return;
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
            name: cells[0].querySelector('.team-name').value, // Récupérer la valeur du champ de saisie pour le nom de l'équipe
            teamSPD: cells[1].querySelector('input[type="number"]').value, // Récupérer la valeur du champ de saisie pour la vitesse
            teamFS: cells[2].querySelector('input[type="number"]').value, // Récupérer la valeur du champ de saisie pour les virages rapides
            teamSS: cells[3].querySelector('input[type="number"]').value, // Récupérer la valeur du champ de saisie pour les virages lents
            teamFB: cells[4].querySelector('input[type="number"]').value, // Récupérer la valeur du champ de saisie pour la fiabilité
            color: cells[5].querySelector('input[type="color"]').value, // Récupérer la valeur du champ de saisie pour la couleur
            image: cells[6].querySelector('.team-image').getAttribute('src') // Récupérer l'attribut src de l'image de l'équipe
        };
    
        // Add line data to main array
        dataArray.push(rowData);
    });

    teamNames = dataArray;

    // Persist teams in championship mode
    if (localStorage.getItem('championshipActive') === 'true') {
        localStorage.setItem('teams', JSON.stringify(dataArray));
    }

    const cells = document.querySelectorAll('#teamNameDriver')
    
    cells.forEach((cell, index) => {
        //console.log(Math.ceil((index+1)/2));
        let team_index = Math.ceil((index+1)/2)-1;
        cell.innerHTML = teamNames[team_index]['name'];
    });

    const driversRows = document.querySelectorAll('.driver-row');
    const driversArray = [];
    driversRows.forEach((row, index) => {
        // Get all cells (<td>) in the current row
        const cells = row.querySelectorAll('td');
        //console.log(cells);
    
        // Create an object to store data for the current line
        const rowData = {
            name: cells[0].querySelector('input[type="text"]').value, 
            code: cells[1].querySelector('input[type="text"]').value,
            level: cells[2].querySelector('input[type="number"]').value,
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
                // Tri par team_id pour garder l'ordre des équipes
                drivers.sort((a, b) => (a.team_id || 0) - (b.team_id || 0));
            } else {
                const response = await fetch('./data/driver_default.json');
                drivers = await response.json();
            }
        } else {
            // Mode simple GP
            const response = await fetch('./data/driver_default.json');
            drivers = await response.json();
        }

        const driverTableBody = document.getElementById('driverTable').querySelector('tbody');

        // Fill the table with drivers
        drivers.forEach(driver => {
            const row = document.createElement('tr');
            row.classList.add('driver-row');

            row.innerHTML = `
                <td><input type="text" value="${driver.name}" class="team-data" /></td>
                <td><input type="text" value="${driver.code}" class="team-data" /></td>
                <td><input type="number" value="${driver.driverLevel}" class="team-data" /></td>
                <td id="teamNameDriver">${teamNames[driver.team_id-1]["name"]}</td>
                <!---<td><select data-team-id="${driver.team_id}">${teamNames[driver.team_id-1][`name`]}</select></td>--->
            `;

            driverTableBody.appendChild(row);
        });

        // Add event managers to update drivers when teams change
        //console.log(document.querySelectorAll('.team-data'));
        document.querySelectorAll('.team-data').forEach(input => {
            input.addEventListener('input', updateDriverTeamOptions);
        });

        // Update driver team options after loading
        updateDriverTeamOptions();

        //console.log(teamNames);
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
        if (circuit) localStorage.setItem('selectedCircuit', JSON.stringify(circuit));
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
                    Length : ${circuit.length} m
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
    if (stepId === 'step-standings-drivers' || stepId === 'step-standings-constructors') renderChampionshipStandings();
}

// Render championship standings into the two standings tab panels
function renderChampionshipStandings() {
    const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
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

    let allDrivers = {}, allTeams = {};
    championshipResults.forEach(race => {
        race.forEach(d => {
            allDrivers[d.code] = d.name;
            if (!allTeams[d.team]) allTeams[d.team] = d.team;
        });
    });

    let driverPointsTable = {}, teamPointsTable = {};
    races.forEach((race, raceIdx) => {
        const results = championshipResults[raceIdx] || [];
        results.filter(d => d.state !== 'out').sort((a, b) => b.totalLength - a.totalLength)
            .forEach((driver, idx) => {
                if (!driverPointsTable[driver.code]) driverPointsTable[driver.code] = Array(races.length).fill(0);
                driverPointsTable[driver.code][raceIdx] = POINTS[idx] || 0;
            });
        Object.values(allTeams).forEach(team => {
            if (!teamPointsTable[team]) teamPointsTable[team] = Array(races.length).fill(0);
        });
        results.filter(d => d.state !== 'out').sort((a, b) => b.totalLength - a.totalLength)
            .forEach((driver, idx) => { teamPointsTable[driver.team][raceIdx] += POINTS[idx] || 0; });
    });

    let driverTable = `<table><thead><tr><th>#</th><th>Driver</th>`;
    races.forEach(r => driverTable += `<th>${r.circuit}</th>`);
    driverTable += `<th>Total</th></tr></thead><tbody>`;
    Object.entries(driverPointsTable)
        .sort((a, b) => b[1].reduce((x,y)=>x+y,0) - a[1].reduce((x,y)=>x+y,0))
        .forEach(([code, ptsArr], idx) => {
            driverTable += `<tr><td>${idx+1}</td><td>${allDrivers[code]||code}</td>`;
            ptsArr.forEach(pts => driverTable += `<td${pts===0?' class="no-points"':''}>${pts===0?'-':pts}</td>`);
            driverTable += `<td><b>${ptsArr.reduce((x,y)=>x+y,0)}</b></td></tr>`;
        });
    driverTable += `</tbody></table>`;

    let teamTable = `<table><thead><tr><th>#</th><th>Constructor</th>`;
    races.forEach(r => teamTable += `<th>${r.circuit}</th>`);
    teamTable += `<th>Total</th></tr></thead><tbody>`;
    Object.entries(teamPointsTable)
        .sort((a, b) => b[1].reduce((x,y)=>x+y,0) - a[1].reduce((x,y)=>x+y,0))
        .forEach(([team, ptsArr], idx) => {
            teamTable += `<tr><td>${idx+1}</td><td>${team}</td>`;
            ptsArr.forEach(pts => teamTable += `<td${pts===0?' class="no-points"':''}>${pts===0?'-':pts}</td>`);
            teamTable += `<td><b>${ptsArr.reduce((x,y)=>x+y,0)}</b></td></tr>`;
        });
    teamTable += `</tbody></table>`;

    const driversPanel = document.getElementById('tab-drivers');
    const constructorsPanel = document.getElementById('tab-constructors');
    if (driversPanel) driversPanel.innerHTML = driverTable;
    if (constructorsPanel) constructorsPanel.innerHTML = teamTable;
}

// Tab button click handlers
document.querySelectorAll('.gp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.target));
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
};

document.getElementById('goToNextPage').addEventListener('click', () => {
    const isChamp = localStorage.getItem('championshipActive') === 'true';
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
                generateAndStoreWeather(races[nextIndex].rain);
            }
        }
    }
    
    const selectedCircuit = localStorage.getItem('selectedCircuit');
    if (selectedCircuit) {
        window.location.href = 'quali.html';
    } else {
        alert('Select a Grand Prix.');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const isChampionship = localStorage.getItem('championshipActive') === 'true';
    const circuitSection = document.getElementById('step1'); // Le bloc de sélection du circuit

    if (isChampionship) {
        // Hide the circuit selection tab (circuit is pre-selected from championship)
        if (circuitSection) circuitSection.style.display = 'none';
        const circuitTabBtn = document.querySelector('.gp-tab-btn[data-target="step1"]');
        if (circuitTabBtn) circuitTabBtn.style.display = 'none';

        // Show championship standings tabs
        document.querySelectorAll('.championship-only').forEach(el => el.style.display = '');

        // Charger le circuit de la course en cours
        const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
        const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');
        const selectedCircuit = races[currentRaceIndex];
        if (selectedCircuit) {
            localStorage.setItem('selectedCircuit', JSON.stringify(selectedCircuit));
            generateAndStoreWeather(selectedCircuit.rain);
        }

        // Check if the current race was just played (has saved results)
        const championshipResults = JSON.parse(localStorage.getItem('championshipResults') || '[]');
        const raceJustPlayed = Array.isArray(championshipResults[currentRaceIndex]);

        // If coming from a completed race, switch directly to standings
        if (raceJustPlayed) {
            activateTab('step-standings-drivers');
        }
    } else {
        // Afficher la sélection du circuit normalement
        if (circuitSection) circuitSection.style.display = '';
    }
});