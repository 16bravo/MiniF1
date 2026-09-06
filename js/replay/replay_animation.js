// REPLAY_ANIMATION.JS
// Reads back positions recorded by race.js
// No recalculation, just displays recorded positions

const ReplayAnimation = (() => {
    const TIRES = {
        S: { name: "Soft", color: "#f00" },
        M: { name: "Medium", color: "#ff0" },
        H: { name: "Hard", color: "#fff" },
        I: { name: "Intermediate", color: "#0f0" },
        W: { name: "Wet", color: "#00f" }
    };
    
    let imagesLoaded = false;

    function loadDriverImages(metadata) {
        if (imagesLoaded) return;
        
        for (let i = 0; i < metadata.di.length; i++) {
            const pLElem = document.getElementById("pL" + (i + 1));
            if (pLElem) {
                const imgElement = pLElem.querySelector('img');
                if (imgElement && metadata.di[i].image) {
                    imgElement.src = metadata.di[i].image;
                }
            }
        }
        
        imagesLoaded = true;
    }

    function updateAllPositions(frameIndex) {
        const positions = RaceReplay.getPositionsAtFrame(frameIndex);
        if (!positions) return;

        const metadata = RaceReplay.getMetadata();
        loadDriverImages(metadata); // Load images on first call
        
        const Y_COEFFICIENT = 0.5; // Adjusted to 75% height
        
        for (let i = 0; i < metadata.di.length; i++) {
            // Apply recorded positions directly
            const pLElem = document.getElementById("pL" + (i + 1));
            const pXElem = document.getElementById("pX" + (i + 1));
            const tElem = document.getElementById("t" + (i + 1));
            const tyElem = document.getElementById("ty" + (i + 1));
            
            if (pLElem && positions.pLx[i] !== undefined) {
                pLElem.style.right = positions.pLx[i] + 'px';
                pLElem.style.top = (positions.pLy[i] * Y_COEFFICIENT) + 'px';
            }
            
            if (pXElem && positions.pXx[i] !== undefined) {
                pXElem.style.left = positions.pXx[i] + 'px';
                pXElem.style.top = (positions.pXy[i] * Y_COEFFICIENT) + 'px';
            }
            
            if (tElem && positions.tpx[i] !== undefined) {
                tElem.style.left = positions.tpx[i] + 'px';
                tElem.style.top = (positions.tpy[i] * Y_COEFFICIENT) + 'px';
            }
            
            if (tyElem && positions.typx[i] !== undefined) {
                tyElem.style.left = positions.typx[i] + 'px';
                tyElem.style.top = (positions.typy[i] * Y_COEFFICIENT) + 'px';
            }

            // Update tire / state display.
            // The recorder stores tire and state as numbers (see state_mappings.js) so they
            // graph nicely in the debug charts; for the on-screen replay we convert them back
            // to their letter / label form here.
            const driverState = RaceReplay.getDriverStateAtFrame(i, frameIndex);
            if (driverState) {
                const tireLetter = typeof driverState.tire === 'number' && typeof unmapTire === 'function'
                    ? unmapTire(driverState.tire)
                    : driverState.tire;
                if (tyElem) {
                    tyElem.textContent = tireLetter;
                    tyElem.style.color = TIRES[tireLetter]?.color || '#fff';
                    tyElem.style.fontWeight = "bold";
                    tyElem.style.fontSize = "18px";
                }

                // Dim retired cars, like the live race view does
                const stateLabel = typeof driverState.state === 'number' && typeof unmapState === 'function'
                    ? unmapState(driverState.state)
                    : driverState.state;
                const opacity = stateLabel === 'out' ? '0.4' : '1';
                [pLElem, pXElem, tElem, tyElem].forEach(el => { if (el) el.style.opacity = opacity; });
            }

            // Update driver code color
            if (pXElem && metadata.di[i]) {
                pXElem.textContent = metadata.di[i].code;
                pXElem.style.borderColor = metadata.di[i].color;
                pXElem.style.color = metadata.di[i].color;
            }
        }
    }

    function updateGlobalInfo(frameIndex, metadata) {
        const globalState = RaceReplay.getGlobalStateAtFrame(frameIndex);
        if (!globalState) return;

        document.getElementById('ind').textContent = `LAP ${globalState.currentLap} | Frame ${frameIndex}`;
    }

    return {
        updateAllPositions,
        updateGlobalInfo,
        loadDriverImages
    };
})();