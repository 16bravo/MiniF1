// Load circuits and initialize default selection
let allCircuits = [];
let selectedRaces = [];

// Points configuration - up to 22 positions
const DEFAULT_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const DEFAULT_POINTS_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const SPECIAL_CHAMPIONSHIP_POINTS = Array.from({length: 22}, (_, i) => 22 - i);
let currentPoints = [...DEFAULT_POINTS];
let currentPointsSprint = [...DEFAULT_POINTS_SPRINT];
let specialChampionshipMode = false;

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

    selectedRaces = await buildDefaultCalendar();

    renderSelectedRaces();
    renderRaceOptions();
}

// Build the starting race list for a new championship.
// Order + sprint flags come from data/default_championship.json (easy to hand-edit);
// every other circuit property is hydrated from circuits.json.
// A sprint weekend expands to two entries: the sprint race then the Grand Prix
// (same layout the "sprint" toggle produces).
async function buildDefaultCalendar() {
    let calendar = null;
    try {
        const res = await fetch('data/default_championship.json');
        if (res.ok) {
            const parsed = await res.json();
            if (parsed && Array.isArray(parsed.races)) calendar = parsed.races;
        }
    } catch (e) {
        console.warn('Could not load data/default_championship.json:', e);
    }

    // Fallback: first 24 circuits from circuits.json, in file order, no sprints.
    if (!calendar || !calendar.length) {
        console.warn('Default championship calendar missing or empty — falling back to the first 24 circuits.');
        return allCircuits.filter(c => c.grandPrix && c.country).slice(0, 24);
    }

    const races = [];
    calendar.forEach(entry => {
        const code = typeof entry === 'string' ? entry : entry && entry.circuit;
        const base = allCircuits.find(c => c.circuit === code);
        if (!base) {
            console.warn('default_championship.json: unknown circuit code, skipped:', code);
            return;
        }
        // Display-only overrides from the calendar file (fall back to circuits.json)
        const displayName = (entry && typeof entry.name === 'string' && entry.name.trim()) || base.grandPrix;
        const displayCode = (entry && typeof entry.code === 'string' && entry.code.trim())
            || (base.circuit || '').slice(0, 3).toUpperCase();

        const makeRace = isSprint => {
            const r = JSON.parse(JSON.stringify(base));
            r.grandPrix = displayName;   // display name (never used to pick the track)
            r.displayCode = displayCode; // 3-ish letter tag for standings / archive
            r.isSprintRace = isSprint;
            return r;
        };

        if (entry && entry.sprint) races.push(makeRace(true));
        races.push(makeRace(false));
    });
    return races;
}

let dragSrcIdx = null;

// Apply a display-only change (grandPrix name / short code) to a feature race
// and, if it has one, its sprint counterpart — then persist. No re-render, so
// the input keeps focus while typing.
function applyRaceDisplay(idx, patch) {
    const race = selectedRaces[idx];
    if (!race) return;
    Object.assign(race, patch);
    const prev = selectedRaces[idx - 1];
    if (prev && prev.isSprintRace && prev.circuit === race.circuit) {
        Object.assign(prev, patch);
    }
    autoSaveRaces();
}

function renderSelectedRaces() {
    const ul = document.getElementById('selected-races');
    ul.innerHTML = '';
    
    // Track displayed race index (sprint races are hidden but still in selectedRaces)
    let displayedIndex = 0;
    
    selectedRaces.forEach((circuit, actualIdx) => {
        // Skip sprint races - they're managed internally and not displayed
        if (circuit.isSprintRace) return;
        
        displayedIndex++;
        const li = document.createElement('li');
        li.className = 'race-row';
        li.draggable = true;
        li.dataset.idx = actualIdx;

        // ---- Drag handle ----
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '⠿';
        handle.title = 'Drag to reorder';

        const num = document.createElement('span');
        num.className = 'race-num';
        num.textContent = displayedIndex;

        // Editable display name (does not change which track is raced)
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'race-name-input';
        nameInput.value = circuit.grandPrix || '';
        nameInput.title = 'Display name for this Grand Prix';
        nameInput.addEventListener('input', () => {
            applyRaceDisplay(actualIdx, { grandPrix: nameInput.value });
        });

        // Editable short tag shown in standings / archive
        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.className = 'race-code-input';
        codeInput.maxLength = 5;
        codeInput.value = circuit.displayCode || (circuit.circuit || '').slice(0, 3).toUpperCase();
        codeInput.title = 'Short tag shown in standings and the archive (display only)';
        codeInput.addEventListener('input', () => {
            applyRaceDisplay(actualIdx, { displayCode: codeInput.value });
        });

        const country = document.createElement('img');
        country.className = 'race-country';
        country.src = `img/flags/${circuit.country.toLowerCase().replace(/ /g, '_')}.png`;
        country.alt = circuit.country;
        country.title = circuit.country;

        const actions = document.createElement('span');
        actions.className = 'race-actions';

        // Move up button
        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.className = 'btn-move';
        upBtn.disabled = actualIdx === 0;
        upBtn.onclick = () => {
            [selectedRaces[actualIdx - 1], selectedRaces[actualIdx]] = [selectedRaces[actualIdx], selectedRaces[actualIdx - 1]];
            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        };

        // Move down button
        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.className = 'btn-move';
        downBtn.disabled = actualIdx === selectedRaces.length - 1;
        downBtn.onclick = () => {
            [selectedRaces[actualIdx], selectedRaces[actualIdx + 1]] = [selectedRaces[actualIdx + 1], selectedRaces[actualIdx]];
            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        };

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.className = 'btn-del';
        delBtn.onclick = () => {
            // If this race has a sprint race before it, remove the sprint too
            if (actualIdx > 0 && selectedRaces[actualIdx - 1].circuit === circuit.circuit && selectedRaces[actualIdx - 1].isSprintRace) {
                selectedRaces.splice(actualIdx - 1, 2);
            } else {
                selectedRaces.splice(actualIdx, 1);
            }
            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        };

        // ---- Sprint toggle ----
        // Check if sprint race already exists for this race
        const hasSprintRace = actualIdx > 0 && selectedRaces[actualIdx - 1].circuit === circuit.circuit && selectedRaces[actualIdx - 1].isSprintRace;
        const sprintToggleLabel = document.createElement('label');
        sprintToggleLabel.className = 'sprint-toggle-small';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = hasSprintRace;
        checkbox.title = 'Add/remove sprint race (positioned before this GP)';
        checkbox.onchange = () => {
            // When checked: insert sprint race before this one
            if (checkbox.checked) {
                const sprintRace = JSON.parse(JSON.stringify(circuit));
                sprintRace.isSprintRace = true;
                selectedRaces.splice(actualIdx, 0, sprintRace);
            } else {
                // If unchecking, remove the sprint version if it exists
                if (actualIdx > 0 && selectedRaces[actualIdx - 1].circuit === circuit.circuit && selectedRaces[actualIdx - 1].isSprintRace) {
                    selectedRaces.splice(actualIdx - 1, 1);
                }
            }
            renderSelectedRaces();
            renderRaceOptions();
            autoSaveRaces();
        };
        
        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider-small';
        
        sprintToggleLabel.appendChild(checkbox);
        sprintToggleLabel.appendChild(toggleSlider);
        actions.appendChild(sprintToggleLabel);

        // ---- Drag & drop events ----
        li.addEventListener('dragstart', (e) => {
            dragSrcIdx = actualIdx;
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
            const destIdx = actualIdx;
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
        actions.appendChild(sprintToggleLabel);
        actions.appendChild(delBtn);
        li.appendChild(handle);
        li.appendChild(num);
        li.appendChild(nameInput);
        li.appendChild(codeInput);
        li.appendChild(country);
        li.appendChild(actions);
        ul.appendChild(li);
    });

    // Update race count badge - count only feature races (not sprint races)
    const featureRaceCount = selectedRaces.filter(r => !r.isSprintRace).length;
    const badge = document.getElementById('race-count-badge');
    if (badge) badge.textContent = `${featureRaceCount} race${featureRaceCount !== 1 ? 's' : ''}`;
}

function renderRaceOptions() {
    const select = document.getElementById('race-select');
    select.innerHTML = '';
    allCircuits.forEach(circuit => {
        // Check if circuit is already added (as normal or sprint race)
        const isAlreadyAdded = selectedRaces.some(r => r.circuit === circuit.circuit && !r.isSprintRace);
        if (!isAlreadyAdded && circuit.grandPrix && circuit.country) {
            const option = document.createElement('option');
            option.value = circuit.circuit;
            option.textContent = `${circuit.grandPrix} (${circuit.country})`;
            select.appendChild(option);
        }
    });
}

// Load points from localStorage or use defaults
function loadPointsConfiguration() {
    const saved = localStorage.getItem('championshipPoints');
    const savedSprint = localStorage.getItem('championshipPointsSprint');
    const savedSpecialMode = localStorage.getItem('championshipSpecialMode');
    
    if (saved) {
        try {
            currentPoints = JSON.parse(saved);
            // Ensure we have 22 positions (handle migration from old 10-position system)
            while (currentPoints.length < DEFAULT_POINTS.length) {
                currentPoints.push(0);
            }
        } catch(e) {
            currentPoints = [...DEFAULT_POINTS];
        }
    }
    
    // Load special championship mode setting
    // NOTE: Special Championship Mode is temporarily disabled (pending reimplementation).
    // We ignore any saved 'true' value and force it off so users can no longer enable it.
    // The branches below are kept intact so the feature can be re-enabled later.
    specialChampionshipMode = false; // was: savedSpecialMode === 'true';
    void savedSpecialMode;

    if (specialChampionshipMode) {
        // Apply special championship sprint races to all feature races
        applySpecialChampionshipRaces();
        // Use special championship points for sprint races
        currentPointsSprint = [...SPECIAL_CHAMPIONSHIP_POINTS];
    }

    // Sprint race points are fixed for now: 8,7,6,5,4,3,2,1 then 0 for every other position.
    // Not user-configurable until the feature is revisited. Any previously saved sprint scale
    // (including the old Special Championship 22→1 scale) is deliberately ignored here.
    currentPointsSprint = [...DEFAULT_POINTS_SPRINT];
    void savedSprint;

    renderPointsConfiguration();
    setupToggleListener();
}

// Render the points configuration UI - one line per position
function renderPointsConfiguration() {
    const container = document.getElementById('points-container');
    container.innerHTML = '';
    
    // Table-like structure
    const table = document.createElement('div');
    table.className = 'points-table';
    
    // Header
    const header = document.createElement('div');
    header.className = 'points-table-header';
    header.innerHTML = `
        <div class="points-col-position">Position</div>
        <div class="points-col-feature">Feature Race</div>
        <div class="points-col-sprint">Sprint Race</div>
    `;
    table.appendChild(header);
    
    // Rows
    for (let idx = 0; idx < currentPoints.length; idx++) {
        const row = document.createElement('div');
        row.className = 'points-table-row';
        
        // Position
        const posCol = document.createElement('div');
        posCol.className = 'points-col-position';
        posCol.textContent = idx + 1;
        
        // Feature input
        const featureCol = document.createElement('div');
        featureCol.className = 'points-col-feature';
        const featureInput = document.createElement('input');
        featureInput.type = 'number';
        featureInput.min = '0';
        featureInput.value = currentPoints[idx];
        featureInput.onchange = () => {
            currentPoints[idx] = Math.max(0, parseInt(featureInput.value) || 0);
        };
        featureCol.appendChild(featureInput);
        
        // Sprint input
        const sprintCol = document.createElement('div');
        sprintCol.className = 'points-col-sprint';
        const sprintInput = document.createElement('input');
        sprintInput.type = 'number';
        sprintInput.min = '0';
        sprintInput.value = currentPointsSprint[idx];
        // Sprint points are fixed (8,7,6,5,4,3,2,1 then 0) and not editable for now.
        sprintInput.disabled = true;
        sprintInput.title = 'Sprint points are fixed for now';
        sprintCol.appendChild(sprintInput);
        
        row.appendChild(posCol);
        row.appendChild(featureCol);
        row.appendChild(sprintCol);
        table.appendChild(row);
    }
    
    container.appendChild(table);
}

// Apply special championship sprint races to all feature races
function applySpecialChampionshipRaces() {
    const newRaces = [];
    selectedRaces.forEach(race => {
        if (!race.isSprintRace) {
            // Add sprint race before each feature race
            const sprintRace = JSON.parse(JSON.stringify(race));
            sprintRace.isSprintRace = true;
            newRaces.push(sprintRace);
            newRaces.push(race);
        }
    });
    selectedRaces = newRaces;
}

// Remove automatically added sprint races (keep only feature races)
function removeSpecialChampionshipRaces() {
    selectedRaces = selectedRaces.filter(race => !race.isSprintRace);
}

// Setup toggle listener for Special Championship Mode
function setupToggleListener() {
    const toggle = document.getElementById('special-championship-toggle');
    if (!toggle) return;

    // Special Championship Mode is temporarily disabled: keep the control forced off
    // and do not wire the change handler. Remove this block to re-enable the feature.
    specialChampionshipMode = false;
    toggle.checked = false;
    return;

    // Set checkbox state
    toggle.checked = specialChampionshipMode;
    
    // Handle toggle change
    toggle.addEventListener('change', () => {
        specialChampionshipMode = toggle.checked;
        
        if (specialChampionshipMode) {
            // Apply special championship sprint races
            applySpecialChampionshipRaces();
            // Switch to special championship sprint points
            currentPointsSprint = [...SPECIAL_CHAMPIONSHIP_POINTS];
        } else {
            // Remove special championship sprint races
            removeSpecialChampionshipRaces();
            // Switch back to default/custom sprint points
            const savedSprint = localStorage.getItem('championshipPointsSprint');
            if (savedSprint) {
                try {
                    currentPointsSprint = JSON.parse(savedSprint);
                    while (currentPointsSprint.length < DEFAULT_POINTS_SPRINT.length) {
                        currentPointsSprint.push(0);
                    }
                } catch(e) {
                    currentPointsSprint = [...DEFAULT_POINTS_SPRINT];
                }
            } else {
                currentPointsSprint = [...DEFAULT_POINTS_SPRINT];
            }
        }
        
        // Update UI
        renderSelectedRaces();
        renderRaceOptions();
        renderPointsConfiguration();
        autoSaveRaces();
    });
}

// Tab switching
function setupTabSwitching() {
    document.querySelectorAll('.setup-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Deactivate all tabs and buttons
            document.querySelectorAll('.setup-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.setup-tab-content').forEach(t => t.classList.remove('active'));
            
            // Activate selected tab and button
            btn.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadCircuits();
    loadPointsConfiguration();
    setupTabSwitching();
});

document.getElementById('add-race-btn').onclick = function() {
    const select = document.getElementById('race-select');
    const selectedCircuitId = select.value;
    const circuitToAdd = allCircuits.find(c => c.circuit === selectedCircuitId);
    if (circuitToAdd) {
        // Add isSprintRace flag (default false) to distinguish sprint races
        const raceToAdd = JSON.parse(JSON.stringify(circuitToAdd));
        raceToAdd.isSprintRace = false;
        raceToAdd.displayCode = (raceToAdd.circuit || '').slice(0, 3).toUpperCase();
        selectedRaces.push(raceToAdd);
        renderSelectedRaces();
        renderRaceOptions();
        autoSaveRaces();
    }
;}

document.getElementById('reset-championship-btn').onclick = function() {
    console.log('Resetting championship data...');
    // Reset all championship data
    localStorage.removeItem('championshipRaces');
    localStorage.removeItem('championshipCurrentRace');
    localStorage.removeItem('championshipResults');
    localStorage.removeItem('championshipActive');
    localStorage.removeItem('championshipSpecialMode');
    console.log(localStorage.getItem('drivers'));
    localStorage.removeItem('drivers');
    localStorage.removeItem('teams');
    console.log(localStorage.getItem('drivers'));
    // Also remove any other championship grid keys:
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('championshipGrid_')) localStorage.removeItem(key);
    });
    window.location.reload();
};

document.getElementById('start-championship-btn').onclick = function() {
    // Save race list to localStorage
    localStorage.setItem('championshipRaces', JSON.stringify(selectedRaces));
    localStorage.setItem('championshipCurrentRace', '0');
    localStorage.setItem('championshipResults', JSON.stringify([])); // Empty at start
    localStorage.setItem('championshipActive', 'true');
    
    // Save points configuration
    localStorage.setItem('championshipPoints', JSON.stringify(currentPoints));
    localStorage.setItem('championshipPointsSprint', JSON.stringify(currentPointsSprint));
    localStorage.setItem('championshipSpecialMode', specialChampionshipMode.toString());
    
    localStorage.removeItem('teams'); // Force reload from default JSON on first GP
    localStorage.removeItem('drivers');  // Force reload from default JSON on first GP
    
    // Auto-save to slot if active
    if (window.autoSaveChampionship) {
        window.autoSaveChampionship();
    }
    
    // Redirect to driver/team selection for the first race
    window.location.href = 'gp_select.html';
};

document.getElementById('reset-points-btn').onclick = function() {
    currentPoints = [...DEFAULT_POINTS];
    currentPointsSprint = [...DEFAULT_POINTS_SPRINT];
    specialChampionshipMode = false;
    renderPointsConfiguration();
    setupToggleListener();
};