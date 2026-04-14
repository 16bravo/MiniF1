// ============================================================
// CHAMPIONSHIP_SAVE_SELECT.JS
// Save slot management and selection
// ============================================================

const SLOTS_COUNT = 3;

// Initialize save slots on page load
document.addEventListener('DOMContentLoaded', () => {
    renderSlots();
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});

// Render all save slots
function renderSlots() {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';

    for (let i = 1; i <= SLOTS_COUNT; i++) {
        const slotData = getSaveSlot(i);
        const slotEl = createSlotElement(i, slotData);
        container.appendChild(slotEl);
    }
}

// Create a single slot element
function createSlotElement(slotNumber, slotData) {
    const slot = document.createElement('div');
    slot.className = slotData ? 'save-slot' : 'save-slot empty';
    slot.innerHTML = `
        <div class="slot-info">
            <div class="slot-name">${slotData ? slotData.name : `Slot ${slotNumber}`}</div>
            ${slotData ? `
                <div class="slot-progress">${slotData.progress}</div>
                <div class="slot-date">${slotData.lastSaved}</div>
            ` : `
                <div class="slot-progress">Empty save slot</div>
                <div class="slot-date">Click to create new championship</div>
            `}
        </div>
        <div class="slot-actions">
            <button class="btn-play" ${!slotData ? 'disabled' : ''}>${slotData ? 'Play' : 'New'}</button>
            ${slotData ? `<button class="btn-delete">Delete</button>` : ''}
        </div>
    `;

    // Add event listeners
    const playBtn = slot.querySelector('.btn-play');
    const deleteBtn = slot.querySelector('.btn-delete');

    if (slotData) {
        playBtn.addEventListener('click', () => loadSaveSlot(slotNumber));
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSaveSlot(slotNumber);
        });
        slot.addEventListener('click', () => loadSaveSlot(slotNumber));
    } else {
        playBtn.addEventListener('click', () => createNewSave(slotNumber));
        slot.addEventListener('click', () => createNewSave(slotNumber));
    }

    return slot;
}

// Get save slot from localStorage
function getSaveSlot(slotNumber) {
    const stored = localStorage.getItem(`championshipSlot${slotNumber}`);
    return stored ? JSON.parse(stored) : null;
}

// Create a new championship save
function createNewSave(slotNumber) {
    showRenameModal(slotNumber, `Slot ${slotNumber}`, (name) => {
        // Create empty save structure
        const newSave = {
            name: name,
            lastSaved: new Date().toLocaleString('fr-FR'),
            progress: 'Setup - No races added',
            data: {
                races: [],
                results: [],
                currentRaceIndex: 0,
                teams: null,
                drivers: null,
                weatherQuali: null,
                weatherRace: null
            }
        };

        // Save to localStorage
        localStorage.setItem(`championshipSlot${slotNumber}`, JSON.stringify(newSave));

        // Set up session and go to setup (to add races)
        loadSaveSlotToSetup(slotNumber);
    });
}

// Load a save slot for setup (new championship)
function loadSaveSlotToSetup(slotNumber) {
    const slotData = getSaveSlot(slotNumber);
    if (!slotData) return;

    // Clear any existing session data
    localStorage.removeItem('championshipActive');
    localStorage.removeItem('championshipRaces');
    localStorage.removeItem('championshipCurrentRace');
    localStorage.removeItem('championshipResults');
    localStorage.removeItem('selectedCircuit');
    localStorage.removeItem('weatherQuali');
    localStorage.removeItem('weatherRace');

    // Load save data into session
    localStorage.setItem('championshipActive', 'true');
    localStorage.setItem('championshipSlotNumber', slotNumber.toString());
    localStorage.setItem('championshipRaces', JSON.stringify(slotData.data.races || []));
    localStorage.setItem('championshipCurrentRace', (slotData.data.currentRaceIndex || 0).toString());
    localStorage.setItem('championshipResults', JSON.stringify(slotData.data.results || []));
    
    if (slotData.data.teams) localStorage.setItem('teams', JSON.stringify(slotData.data.teams));
    if (slotData.data.drivers) localStorage.setItem('drivers', JSON.stringify(slotData.data.drivers));
    if (slotData.data.weatherQuali) localStorage.setItem('weatherQuali', JSON.stringify(slotData.data.weatherQuali));
    if (slotData.data.weatherRace) localStorage.setItem('weatherRace', JSON.stringify(slotData.data.weatherRace));

    // Redirect to championship setup
    window.location.href = 'championship_setup.html';
}

// Load a save slot (existing championship)
function loadSaveSlot(slotNumber) {
    const slotData = getSaveSlot(slotNumber);
    if (!slotData) return;

    // Clear any existing session data (but keep simple GP data untouched)
    localStorage.removeItem('championshipActive');
    localStorage.removeItem('championshipRaces');
    localStorage.removeItem('championshipCurrentRace');
    localStorage.removeItem('championshipResults');
    localStorage.removeItem('selectedCircuit');
    localStorage.removeItem('weatherQuali');
    localStorage.removeItem('weatherRace');

    // Load save data into session
    localStorage.setItem('championshipActive', 'true');
    localStorage.setItem('championshipSlotNumber', slotNumber.toString());
    localStorage.setItem('championshipRaces', JSON.stringify(slotData.data.races || []));
    localStorage.setItem('championshipCurrentRace', (slotData.data.currentRaceIndex || 0).toString());
    localStorage.setItem('championshipResults', JSON.stringify(slotData.data.results || []));
    
    if (slotData.data.teams) localStorage.setItem('teams', JSON.stringify(slotData.data.teams));
    if (slotData.data.drivers) localStorage.setItem('drivers', JSON.stringify(slotData.data.drivers));
    if (slotData.data.weatherQuali) localStorage.setItem('weatherQuali', JSON.stringify(slotData.data.weatherQuali));
    if (slotData.data.weatherRace) localStorage.setItem('weatherRace', JSON.stringify(slotData.data.weatherRace));

    // Redirect to current race (resume championship)
    window.location.href = 'gp_select.html';
}

// Delete a save slot
function deleteSaveSlot(slotNumber) {
    if (confirm(`Delete save slot ${slotNumber}?`)) {
        localStorage.removeItem(`championshipSlot${slotNumber}`);
        renderSlots();
    }
}

// Show rename modal
function showRenameModal(slotNumber, currentName, callback) {
    const modal = document.getElementById('rename-modal') || createRenameModal();
    const input = modal.querySelector('.modal-input');
    input.value = currentName;
    
    const confirmBtn = modal.querySelector('.btn-confirm');
    const cancelBtn = modal.querySelector('.btn-cancel');

    // Remove old listeners
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    input.replaceWith(input.cloneNode(true));

    const newInput = modal.querySelector('.modal-input');
    const newConfirmBtn = modal.querySelector('.btn-confirm');
    const newCancelBtn = modal.querySelector('.btn-cancel');

    newInput.value = currentName;
    newInput.select();

    const handleConfirm = () => {
        const newName = newInput.value.trim();
        if (newName) callback(newName);
        modal.classList.remove('active');
    };

    const handleCancel = () => {
        modal.classList.remove('active');
    };

    newConfirmBtn.onclick = handleConfirm;
    newCancelBtn.onclick = handleCancel;
    newInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') handleCancel();
    };

    modal.classList.add('active');
}

// Create rename modal element
function createRenameModal() {
    const modal = document.createElement('div');
    modal.id = 'rename-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">Championship Name</div>
            <input type="text" class="modal-input" placeholder="Enter championship name" maxlength="50">
            <div class="modal-buttons">
                <button class="modal-btn cancel btn-cancel">Cancel</button>
                <button class="modal-btn confirm btn-confirm">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// Get progress string for display
function getProgressString() {
    const races = JSON.parse(localStorage.getItem('championshipRaces') || '[]');
    const results = JSON.parse(localStorage.getItem('championshipResults') || '[]');
    const currentRaceIndex = parseInt(localStorage.getItem('championshipCurrentRace') || '0');

    if (races.length === 0) return 'Setup - No races added';

    const currentRace = races[currentRaceIndex];
    if (!currentRace) return 'Setup complete';

    const raceCompleted = Array.isArray(results[currentRaceIndex]);
    
    if (raceCompleted && currentRaceIndex < races.length - 1) {
        return `Race ${currentRaceIndex + 1}/${races.length} completed`;
    } else if (raceCompleted) {
        return `Championship completed!`;
    } else {
        return `Quali - ${currentRace.grandPrix}`;
    }
}

// AUTO-SAVE function to be called from other pages
window.autoSaveChampionship = function() {
    const isChamp = localStorage.getItem('championshipActive') === 'true';
    if (!isChamp) return;

    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');
    if (slotNumber < 1 || slotNumber > 3) return;

    const slotData = getSaveSlot(slotNumber);
    if (!slotData) return;

    // Update championship data from session
    const updatedSave = {
        name: slotData.name,
        lastSaved: new Date().toLocaleString('fr-FR'),
        progress: getProgressString(),
        data: {
            races: JSON.parse(localStorage.getItem('championshipRaces') || '[]'),
            results: JSON.parse(localStorage.getItem('championshipResults') || '[]'),
            currentRaceIndex: parseInt(localStorage.getItem('championshipCurrentRace') || '0'),
            teams: JSON.parse(localStorage.getItem('teams') || 'null'),
            drivers: JSON.parse(localStorage.getItem('drivers') || 'null'),
            weatherQuali: JSON.parse(localStorage.getItem('weatherQuali') || 'null'),
            weatherRace: JSON.parse(localStorage.getItem('weatherRace') || 'null')
        }
    };

    localStorage.setItem(`championshipSlot${slotNumber}`, JSON.stringify(updatedSave));
};
