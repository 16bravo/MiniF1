let teamNames;

// Function to load circuits from JSON file
async function loadCircuits() {
    try {
        const response = await fetch('../data/circuits.json');
        const circuits = await response.json();

        const circuitList = document.getElementById('circuitList');

        document.getElementById('step1').classList.add('active');

        // Fill the grid with circuits
        circuits.forEach(circuit => {
            const listItem = document.createElement('li');
            listItem.classList.add('circuit-list-item');
            listItem.innerHTML = `<img src="img/flags/${circuit.country}.png" alt="${circuit.country}"><span>${circuit.grandPrix}</span>`;
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
        const response = await fetch('../data/team_default.json');
        const teams = await response.json();

        const teamTableBody = document.getElementById('teamTable').querySelector('tbody');
        const imageList = ["ALP1","ALP24","ALP25","AMR24","AMR25","ARR1","ARR201","ARR21","ARR31","AST1","BEL1","BEN1","BRA1","FER1","FER201","FER21","FER24","FER25","FRA1","GBR1","GER1","HAA1","HAA201","HAA21","HAA24","HAA25","HAA31","HAA41","HAA51","HON1","JAG1","JAG21","LOT1","LOT21","LOT31","MCL1","MCL201","MCL21","MCL24","MCL25","MCL31","MCL41","MER1","MER201","MER21","MER24","MER25","MER31","MERBLM1","PET1","PEU1","PEU2","POR1","POR21","POR31","POR41","RBR1","RBR201","RBR21","RBR24","RBR25","REN1","REN201","REN21","REN31","RENT201","RPT1","RPT201","RPT21","RPT31","SAT201","SAT21","SAU24","SAU25","STR1","VRB24","VRB25","WIL1","WIL201","WIL21","WIL24","WIL25","WIL31","WIL41","WILT201"];

        // Fill the table with teams
        teams.forEach(team => {
            const row = document.createElement('tr');
            row.classList.add('team-row');

            row.innerHTML = `
                <td><input type="text" id="${team.team_id}" value="${team.team}" class="team-name team-data" /></td>
                <td><input type="number" value="${team.teamSPD}" class="team-data" /></td>
                <td><input type="number" value="${team.teamFS}" class="team-data" /></td>
                <td><input type="number" value="${team.teamSS}" class="team-data" /></td>
                <td><input type="number" value="${team.teamFB}" class="team-data" /></td>
                <td><input type="color" value="${team.color}" class="team-data" /></td>
                <td>
                    <div class="image-container">
                        <img src="img/cars/${team.image}.png" alt="${team.team}" class="team-image" />
                        <div class="image-dropdown"></div>
                    </div>
                </td>
            `;

            const imageDropdown = row.querySelector('.image-dropdown');

            imageList.forEach(imageName => {
                const imageOption = document.createElement('img');
                imageOption.src = `img/cars/${imageName}.png`;
                imageOption.alt = imageName;
                imageOption.style.width = "70px"
                imageOption.addEventListener('click', () => {
                    const imgElement = row.querySelector('.team-image');
                    imgElement.src = imageOption.src;
                    imgElement.alt = imageOption.alt;
                    imageDropdown.style.display = 'none';
                });
                imageDropdown.appendChild(imageOption);
            });

            const imgElement = row.querySelector('.team-image');
            imgElement.addEventListener('click', () => {
                imageDropdown.style.display = 'block';
            });

            teamTableBody.appendChild(row);
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
    //console.log(teamNames);

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
        const response = await fetch('../data/driver_default.json');
        const drivers = await response.json();

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
    const circuit = JSON.parse(localStorage.getItem('selectedCircuit'));
    if (circuit) {
        overviewDiv.innerHTML += `
            <h2>Selected Circuit</h2>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px;">
                <img src="img/flags/${circuit.country}.png" alt="${circuit.country}" style="height:32px;">
                <p style="margin:0;">
                    <strong>${circuit.grandPrix}</strong> (${circuit.country})<br>
                    Length : ${circuit.length} m
                </p>
            </div>
            <canvas id="overviewCanvas" width="300" height="200" style="display:block;margin:10px auto;"></canvas>
        `;
        // Circuit design
        fetch('../data/circuits.json')
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

// Call showOverview when the overview is open
document.querySelector('#step4 .accordion-header').addEventListener('click', showOverview);

// Manage shrink-box display
document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const accordionItem = header.parentElement;

        // Retract all other boxes
        document.querySelectorAll('.accordion-item').forEach(item => {
            if (item !== accordionItem) {
                item.classList.remove('active');
            }
        });

        // Extend or retract the current box
        accordionItem.classList.toggle('active');
    });
});

// Load circuits, teams and drivers when the page is loaded
window.onload = async () => {
    await loadCircuits();
    await loadTeams();
    await loadDrivers();
};

document.getElementById('goToNextPage').addEventListener('click', () => {
    const selectedCircuit = localStorage.getItem('selectedCircuit');
    if (selectedCircuit) {
        // Redirect to next page
        window.location.href = 'quali.html';
    } else {
        alert('Select a Grand Prix.');
    }
});
