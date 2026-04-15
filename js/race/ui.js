// UI.JS
// User interface management for race display
// Handles dynamic element generation and container sizing

/**
 * Generate driver UI elements dynamically based on number of drivers
 * Creates all visual elements for ranking display, driver codes, car images, times, and tires
 */
function generateDriverUIElements() {
    const numDrivers = drivers.length;
    const ranksContainer = document.getElementById('driver-ranks');
    const iconsContainer = document.getElementById('driver-icons');
    const codesContainer = document.getElementById('driver-codes');
    const carsContainer = document.getElementById('driver-cars');
    const timesContainer = document.getElementById('driver-times');
    const tyresContainer = document.getElementById('driver-tyres');

    for (let i = 1; i <= numDrivers; i++) {
        // Rank number
        const rankDiv = document.createElement('div');
        rankDiv.id = 'rank';
        rankDiv.style.top = (i * 35 + 40) + 'px';
        rankDiv.textContent = i;
        ranksContainer.appendChild(rankDiv);

        // Driver icon (circle/dot alternating)
        const icon = document.createElement('i');
        icon.id = 'p' + i;
        icon.className = i % 2 === 1 ? 'fas fa-circle' : 'fas fa-dot-circle';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'names';
        nameSpan.id = 'names' + i;
        nameSpan.innerHTML = '<br>Driver' + i;
        icon.appendChild(nameSpan);
        iconsContainer.appendChild(icon);

        // Driver code
        const codeDiv = document.createElement('div');
        codeDiv.id = 'pX' + i;
        codeDiv.style.top = (i * 35 + 40) + 'px'; // Initial position
        codeDiv.textContent = 'DRV';
        codesContainer.appendChild(codeDiv);

        // Car image
        const carDiv = document.createElement('div');
        carDiv.id = 'pL' + i;
        carDiv.style.top = (i * 35 + 40) + 'px'; // Initial position
        const img = document.createElement('img');
        img.style.height = '35px';
        img.style.width = 'auto';
        img.src = 'img/cars/MER24.png';
        carDiv.appendChild(img);
        carsContainer.appendChild(carDiv);

        // Time display
        const timeDiv = document.createElement('div');
        timeDiv.className = 'time';
        timeDiv.id = 't' + i;
        timeDiv.style.top = (i * 35 + 40) + 'px'; // Initial position
        timesContainer.appendChild(timeDiv);

        // Tire display
        const tyreDiv = document.createElement('div');
        tyreDiv.className = 'tyre';
        tyreDiv.id = 'ty' + i;
        tyreDiv.style.top = (i * 35 + 40) + 'px'; // Initial position
        tyresContainer.appendChild(tyreDiv);
    }
    console.log('Generated UI elements for', numDrivers, 'drivers');
}

/**
 * Update dynamic container heights based on number of drivers
 * #tts height = nb_driver * 35 + 3
 * #ind height = nb_driver * 35 + 35
 */
function updateDynamicContainerHeights() {
    const ttsElement = document.getElementById('tts');
    const indElement = document.getElementById('ind');
    
    if (ttsElement) {
        const ttsDynamicHeight = nb_driver * 35 + 3;
        ttsElement.style.height = ttsDynamicHeight + 'px';
        console.log('Set #tts height to', ttsDynamicHeight, 'px');
    }
    
    if (indElement) {
        const indDynamicHeight = nb_driver * 35 + 42;
        indElement.style.height = indDynamicHeight + 'px';
        console.log('Set #ind height to', indDynamicHeight, 'px');
    }
}
