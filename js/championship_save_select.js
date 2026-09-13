// ============================================================
// CHAMPIONSHIP_SAVE_SELECT.JS
// Save slot management and selection
// ============================================================

const SLOTS_COUNT = 3;

// The real-world season a brand-new career starts in. Bump this for a future
// content update (e.g. once the game moves to the next real season) - it only
// affects new careers; existing saves keep the startYear they were created with.
const DEFAULT_CAREER_START_YEAR = 2026;

// The year shown for a given career season - season 1 is startYear itself.
function careerYearFor(startYear, season) {
    return (startYear || DEFAULT_CAREER_START_YEAR) + ((season || 1) - 1);
}

// 'career' when reached from Career > God Mode (championship_save_select.html?mode=career),
// 'championship' otherwise. Career saves are a fully separate slot set from regular
// one-shot Championship saves, but reuse this exact same screen/code.
const urlMode = new URLSearchParams(location.search).get('mode') === 'career' ? 'career' : 'championship';
const SLOT_PREFIX = urlMode === 'career' ? 'careerSlot' : 'championshipSlot';

// Initialize save slots on page load
document.addEventListener('DOMContentLoaded', () => {
    renderSlots();

    const titleEl = document.getElementById('save-title-text');
    if (titleEl) titleEl.textContent = urlMode === 'career' ? 'Career Saves' : 'Championship Saves';

    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = urlMode === 'career' ? 'career_select.html' : 'index.html';
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

// Get save slot from localStorage. Defaults to this page's own slot list
// (SLOT_PREFIX, from ?mode=); pass an explicit prefix when the caller needs the
// live session's slot list instead (see activeSlotPrefix()).
function getSaveSlot(slotNumber, prefix) {
    const stored = localStorage.getItem(`${prefix || SLOT_PREFIX}${slotNumber}`);
    return stored ? JSON.parse(stored) : null;
}

// autoSaveChampionship is called from other pages (gp_select, quali, race,
// championship_setup) that never carry a ?mode= query string, so it can't rely on
// this page's SLOT_PREFIX - it must read the live session's careerMode flag instead.
function activeSlotPrefix() {
    return localStorage.getItem('careerMode') === 'true' ? 'careerSlot' : 'championshipSlot';
}

// Create a new championship (or career) save
function createNewSave(slotNumber) {
    showRenameModal(slotNumber, `Slot ${slotNumber}`, (name, startYear) => {
        // Create empty save structure
        const newSave = {
            name: name,
            lastSaved: new Date().toLocaleString('fr-FR'),
            progress: urlMode === 'career' ? `${startYear} - Setup - No races added` : 'Setup - No races added',
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
        if (urlMode === 'career') {
            newSave.data.season = 1;
            newSave.data.seasonHistory = [];
            newSave.data.startYear = startYear;
        }

        // Save to localStorage
        localStorage.setItem(`${SLOT_PREFIX}${slotNumber}`, JSON.stringify(newSave));

        // Set up session and go to setup (to add races)
        loadSaveSlotToSetup(slotNumber);
    });
}

// Restore the championship settings (points scale + fastest-lap rule) that were
// saved with a slot. These are global session keys (not namespaced per slot),
// so they're reset to defaults first - otherwise a slot with no settings of
// its own (a brand-new save, or one never gotten past the setup screen) would
// silently inherit whatever scale was last configured in a DIFFERENT save.
function applySavedChampionshipSettings(slotData) {
    localStorage.removeItem('championshipPoints');
    localStorage.removeItem('championshipPointsSprint');
    localStorage.removeItem('championshipSpecialMode');
    localStorage.removeItem('championshipFastestLapPoint');
    localStorage.removeItem('championshipFastestLapTopN');
    localStorage.removeItem('championshipPolePositionPoints');

    const s = slotData && slotData.data && slotData.data.settings;
    if (!s) return;
    if (Array.isArray(s.points))       localStorage.setItem('championshipPoints', JSON.stringify(s.points));
    if (Array.isArray(s.pointsSprint)) localStorage.setItem('championshipPointsSprint', JSON.stringify(s.pointsSprint));
    localStorage.setItem('championshipSpecialMode', (!!s.specialMode).toString());
    localStorage.setItem('championshipFastestLapPoint', (!!s.fastestLapPoint).toString());
    if (Number.isFinite(s.fastestLapTopN)) {
        localStorage.setItem('championshipFastestLapTopN', String(s.fastestLapTopN));
    }
    if (Number.isFinite(s.polePositionPoints)) {
        localStorage.setItem('championshipPolePositionPoints', String(s.polePositionPoints));
    }
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
    localStorage.setItem('careerMode', urlMode === 'career' ? 'true' : 'false');
    localStorage.setItem('careerSeasonNumber', String(slotData.data.season || 1));
    localStorage.setItem('careerStartYear', String(slotData.data.startYear || DEFAULT_CAREER_START_YEAR));

    if (slotData.data.teams) localStorage.setItem('teams', JSON.stringify(slotData.data.teams));
    if (slotData.data.drivers) localStorage.setItem('drivers', JSON.stringify(slotData.data.drivers));
    if (slotData.data.weatherQuali) localStorage.setItem('weatherQuali', JSON.stringify(slotData.data.weatherQuali));
    if (slotData.data.weatherRace) localStorage.setItem('weatherRace', JSON.stringify(slotData.data.weatherRace));
    applySavedChampionshipSettings(slotData);

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
    localStorage.setItem('careerMode', urlMode === 'career' ? 'true' : 'false');
    localStorage.setItem('careerSeasonNumber', String(slotData.data.season || 1));
    localStorage.setItem('careerStartYear', String(slotData.data.startYear || DEFAULT_CAREER_START_YEAR));

    if (slotData.data.teams) localStorage.setItem('teams', JSON.stringify(slotData.data.teams));
    if (slotData.data.drivers) localStorage.setItem('drivers', JSON.stringify(slotData.data.drivers));
    if (slotData.data.weatherQuali) localStorage.setItem('weatherQuali', JSON.stringify(slotData.data.weatherQuali));
    if (slotData.data.weatherRace) localStorage.setItem('weatherRace', JSON.stringify(slotData.data.weatherRace));
    applySavedChampionshipSettings(slotData);

    // Redirect to current race (resume championship)
    window.location.href = 'gp_select.html';
}

// Delete a save slot
function deleteSaveSlot(slotNumber) {
    if (confirm(`Delete save slot ${slotNumber}?`)) {
        localStorage.removeItem(`${SLOT_PREFIX}${slotNumber}`);
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
    const yearRow = modal.querySelector('.modal-year-row');
    const yearInput = modal.querySelector('.modal-year-input');

    newInput.value = currentName;
    newInput.select();

    // Starting season/year - career saves only (a one-shot Championship has no
    // notion of a real-world calendar year to track).
    yearRow.hidden = urlMode !== 'career';
    if (urlMode === 'career') yearInput.value = DEFAULT_CAREER_START_YEAR;

    const handleConfirm = () => {
        const newName = newInput.value.trim();
        if (!newName) return;
        const startYear = urlMode === 'career'
            ? (parseInt(yearInput.value, 10) || DEFAULT_CAREER_START_YEAR)
            : undefined;
        callback(newName, startYear);
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
    yearInput.onkeydown = newInput.onkeydown;

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
            <div class="modal-year-row">
                <label class="modal-label">Starting Season</label>
                <input type="number" class="modal-input modal-year-input" min="1950" max="2999" step="1">
            </div>
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

    let base;
    const currentRace = races[currentRaceIndex];
    if (races.length === 0) {
        base = 'Setup - No races added';
    } else if (!currentRace) {
        base = 'Setup complete';
    } else {
        const raceCompleted = Array.isArray(results[currentRaceIndex]);
        if (raceCompleted && currentRaceIndex < races.length - 1) {
            base = `Race ${currentRaceIndex + 1}/${races.length} completed`;
        } else if (raceCompleted) {
            base = `Championship completed!`;
        } else {
            base = `Quali - ${currentRace.grandPrix}`;
        }
    }

    if (localStorage.getItem('careerMode') === 'true') {
        const year = careerYearFor(
            parseInt(localStorage.getItem('careerStartYear') || '0', 10),
            parseInt(localStorage.getItem('careerSeasonNumber') || '1', 10)
        );
        return `${year} — ${base}`;
    }
    return base;
}

// AUTO-SAVE function to be called from other pages
window.autoSaveChampionship = function() {
    const isChamp = localStorage.getItem('championshipActive') === 'true';
    if (!isChamp) return;

    const slotNumber = parseInt(localStorage.getItem('championshipSlotNumber') || '0');
    if (slotNumber < 1 || slotNumber > 3) return;

    const prefix = activeSlotPrefix();
    const slotData = getSaveSlot(slotNumber, prefix);
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
            weatherRace: JSON.parse(localStorage.getItem('weatherRace') || 'null'),
            settings: {
                points: JSON.parse(localStorage.getItem('championshipPoints') || 'null'),
                pointsSprint: JSON.parse(localStorage.getItem('championshipPointsSprint') || 'null'),
                specialMode: localStorage.getItem('championshipSpecialMode') === 'true',
                fastestLapPoint: localStorage.getItem('championshipFastestLapPoint') === 'true',
                fastestLapTopN: parseInt(localStorage.getItem('championshipFastestLapTopN') || '10'),
                polePositionPoints: parseInt(localStorage.getItem('championshipPolePositionPoints') || '0')
            }
        }
    };

    if (prefix === 'careerSlot') {
        updatedSave.data.season = parseInt(localStorage.getItem('careerSeasonNumber') || '1');
        updatedSave.data.startYear = parseInt(localStorage.getItem('careerStartYear') || '0', 10) || slotData.data.startYear || DEFAULT_CAREER_START_YEAR;
        // Migrate any pre-existing seasonHistory entries still carrying full
        // races/results (saved before summarizeSeasonArchive existed) down to
        // the compact per-season summary - those raw entries are exactly what
        // exhausts the localStorage quota over a long career. Safe to skip
        // (leaves them as-is) on a page that doesn't load championship_common.js.
        const history = slotData.data.seasonHistory || [];
        updatedSave.data.seasonHistory = (typeof ChampionshipCommon === 'undefined') ? history :
            history.map(s => s.races
                ? Object.assign({ season: s.season }, ChampionshipCommon.summarizeSeasonArchive(s.races, s.results, s.points, s.opts))
                : s);
    }

    localStorage.setItem(`${prefix}${slotNumber}`, JSON.stringify(updatedSave));
};
