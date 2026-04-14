// Charger les circuits et initialiser la sélection par défaut
let allCircuits = [];
let selectedRaces = [];

// Auto-save races to slot if active
function autoSaveRaces() {
    localStorage.setItem('championshipRaces', JSON.stringify(selectedRaces));
    if (window.autoSaveChampionship) {
        window.autoSaveChampionship();
    }
}

async function loadCircuits() {
    const response = await fetch('data/circuits.json');
    allCircuits = await response.json();

    // Prendre les 24 premiers circuits valides
    selectedRaces = allCircuits
        .filter(c => c.grandPrix && c.country)
        .slice(0, 24);

    renderSelectedRaces();
    renderRaceOptions();
}

let dragSrcIdx = null;

function renderSelectedRaces() {
    const ul = document.getElementById('selected-races');
    ul.innerHTML = '';
    selectedRaces.forEach((circuit, idx) => {
        const li = document.createElement('li');
        li.className = 'race-row';
        li.draggable = true;
        li.dataset.idx = idx;

        // ---- Drag handle ----
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '⠿';
        handle.title = 'Drag to reorder';

        const num = document.createElement('span');
        num.className = 'race-num';
        num.textContent = idx + 1;

        const name = document.createElement('span');
        name.className = 'race-name';
        name.textContent = `${circuit.grandPrix}`;

        const country = document.createElement('img');
        country.className = 'race-country';
        country.src = `img/flags/${circuit.country.toLowerCase().replace(/ /g, '_')}.png`;
        country.alt = circuit.country;
        country.title = circuit.country;

        const actions = document.createElement('span');
        actions.className = 'race-actions';

        // Bouton monter
        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.className = 'btn-move';
        upBtn.disabled = idx === 0;
        upBtn.onclick = () => {
            [selectedRaces[idx - 1], selectedRaces[idx]] = [selectedRaces[idx], selectedRaces[idx - 1]];
            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        };

        // Bouton descendre
        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.className = 'btn-move';
        downBtn.disabled = idx === selectedRaces.length - 1;
        downBtn.onclick = () => {
            [selectedRaces[idx], selectedRaces[idx + 1]] = [selectedRaces[idx + 1], selectedRaces[idx]];
            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        };

        // Bouton supprimer
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.className = 'btn-del';
        delBtn.onclick = () => {
            selectedRaces.splice(idx, 1);
            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        };

        // ---- Drag & drop events ----
        li.addEventListener('dragstart', (e) => {
            dragSrcIdx = idx;
            e.dataTransfer.effectAllowed = 'move';
            li.classList.add('dragging');
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            document.querySelectorAll('.race-row').forEach(r => r.classList.remove('drag-over'));
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            document.querySelectorAll('.race-row').forEach(r => r.classList.remove('drag-over'));
            li.classList.add('drag-over');
        });

        li.addEventListener('dragleave', () => {
            li.classList.remove('drag-over');
        });

        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drag-over');
            const destIdx = idx;
            if (dragSrcIdx === null || dragSrcIdx === destIdx) return;

            // Reorder selectedRaces array — this is what gets saved
            const moved = selectedRaces.splice(dragSrcIdx, 1)[0];
            selectedRaces.splice(destIdx, 0, moved);
            dragSrcIdx = null;

            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        });

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(delBtn);
        li.appendChild(handle);
        li.appendChild(num);
        li.appendChild(name);
        li.appendChild(country);
        li.appendChild(actions);
        ul.appendChild(li);
    });

    // Update race count badge
    const badge = document.getElementById('race-count-badge');
    if (badge) badge.textContent = `${selectedRaces.length} race${selectedRaces.length !== 1 ? 's' : ''}`;
}

function renderRaceOptions() {
    const select = document.getElementById('race-select');
    select.innerHTML = '';
    allCircuits.forEach(circuit => {
        if (!selectedRaces.some(r => r.circuit === circuit.circuit) && circuit.grandPrix && circuit.country) {
            const option = document.createElement('option');
            option.value = circuit.circuit;
            option.textContent = `${circuit.grandPrix} (${circuit.country})`;
            select.appendChild(option);
        }
    });
}

document.addEventListener('DOMContentLoaded', loadCircuits);

document.getElementById('add-race-btn').onclick = function() {
    const select = document.getElementById('race-select');
    const selectedCircuitId = select.value;
    const circuitToAdd = allCircuits.find(c => c.circuit === selectedCircuitId);
    if (circuitToAdd) {
        selectedRaces.push(circuitToAdd);
        renderSelectedRaces();
        renderRaceOptions();
        autoSaveRaces();
    }
};

document.getElementById('reset-championship-btn').onclick = function() {
    console.log('Resetting championship data...');
    // Réinitialise toutes les données du championnat
    localStorage.removeItem('championshipRaces');
    localStorage.removeItem('championshipCurrentRace');
    localStorage.removeItem('championshipResults');
    localStorage.removeItem('championshipActive');
    console.log(localStorage.getItem('drivers'));
    localStorage.removeItem('drivers');
    localStorage.removeItem('teams');
    console.log(localStorage.getItem('drivers'));
    // Si tu utilises d'autres clés pour la grille, supprime-les aussi :
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('championshipGrid_')) localStorage.removeItem(key);
    });
    window.location.reload();
};

document.getElementById('start-championship-btn').onclick = function() {
    // Sauvegarder la liste des courses dans le localStorage
    localStorage.setItem('championshipRaces', JSON.stringify(selectedRaces));
    localStorage.setItem('championshipCurrentRace', '0');
    localStorage.setItem('championshipResults', JSON.stringify([])); // Vide au départ
    localStorage.setItem('championshipActive', 'true');
    localStorage.removeItem('teams'); // Force reload from default JSON on first GP
    
    // Auto-save to slot if active
    if (window.autoSaveChampionship) {
        window.autoSaveChampionship();
    }
    
    // Rediriger vers la sélection des pilotes/équipes pour la première course
    window.location.href = 'gp_select.html';
};