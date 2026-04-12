// REPLAY_ANIMATION.JS
// Reprend les positions enregistrées de race.js
// Pas de recalcul, juste de l'affichage des positions

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
        loadDriverImages(metadata); // Charge les images au premier appel
        
        const Y_COEFFICIENT = 0.5; // Adapter à 75% de hauteur
        
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

            // Update tire display
            const driverState = RaceReplay.getDriverStateAtFrame(i, frameIndex);
            if (driverState && tyElem) {
                tyElem.textContent = driverState.tire;
                tyElem.style.color = TIRES[driverState.tire]?.color || '#fff';
                tyElem.style.fontWeight = "bold";
                tyElem.style.fontSize = "18px";
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