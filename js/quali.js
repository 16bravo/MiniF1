document.addEventListener("DOMContentLoaded", function() {
    const selectedCircuit = JSON.parse(localStorage.getItem('selectedCircuit'));
    let baseLapTime, country, grandPrix, rain, overtaking, difficulty, fastSpeed, fastCorners, slowCorners;
    if (selectedCircuit) {
        baseLapTime = selectedCircuit.length / (( selectedCircuit.speed * 1015 ) / 3600);
        country = selectedCircuit.country;
        grandPrix = selectedCircuit.grandPrix;
        rain = selectedCircuit.rain;
        overtaking = selectedCircuit.overtaking;
        difficulty = selectedCircuit.difficulty;
        fastSpeed = selectedCircuit.fastSpeed / 100;
        fastCorners = selectedCircuit.fastCorners / 100;
        slowCorners = selectedCircuit.slowCorners / 100;
        totalCircuit = fastSpeed + fastCorners + slowCorners;

        console.log('Selected Circuit:', selectedCircuit.circuit);
        console.log('Grand Prix:', grandPrix);
        console.log('Country:', country);
        console.log('Lap Time:', baseLapTime);
        console.log('Rain:', rain);

        document.getElementById("GPName").textContent = grandPrix + " Grand Prix";
        document.getElementById("GPFlag").src = "img/flags/" + country.toLowerCase().replace(/ /g, "_") + ".png";
    } else {
        alert('No Grand Prix selected.');
    };

    const drivers = JSON.parse(localStorage.getItem('selectedDrivers'));
    const sessionDurations = [18, 15, 12];
    let currentSession = 0;
    let timer = sessionDurations[currentSession] * 60;
    let ranking = drivers.map(driver => ({
        name: driver.name,
        code: driver.code,
        team: driver.team,
        color: driver.color,
        image: driver.image,
        driverLevel: driver.driverLevel,
        teamStratLevel: driver.teamSPD, // We take team speed as a level, but we'll need to add a strategy level.
        teamSPD: driver.teamSPD,
        teamFS: driver.teamFS,
        teamSS: driver.teamSS,
        reliability: driver.teamFB,
        level: (driver.driverLevel/100) * ((fastSpeed*driver.teamSPD + fastCorners*driver.teamFS + slowCorners*driver.teamSS)/totalCircuit),
        lastTime: null,
        bestTime: 1000,
        displayBestTime: null,
        eliminated: false,
        lapTime: 0,
        distance: 0,
        currentSpeed: 0,
        runLaps: 0, // Total laps in the entire qualification
        sessionLaps: 0, // Laps in the current session
        currentTire: "S", // Default tire
        currentState: "PIT" // Default state
    }));
    const baseSpeed = 230;
    let maxLapsPerSession = 3; // Default value for testing
    let currentRain = 0; // Initial rain intensity
    let forecastRain = 0; // Forecast rain intensity
    let currentTrackWater = 0; // Initial track water level
    let forecastTrackWater = 0; // Forecast track water level
    let currentFrame = 0; // Frame counter
    //console.log(ranking);

    // Function to generate a random number according to a normal distribution
    function randn_bm() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // Function to generate a random number according to a normal distribution with a given mean and standard deviation
    function generateNormalRandom(mean, stddev) {
        return mean + stddev * randn_bm();
    }

    // Formatting functions
    // Function to format session time
    function formatSessionTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Function to generate the rainfall curve
    function generateRainCurve(rainProbability, totalFrames = 5000) {
        const rainCurve = new Array(totalFrames).fill(0);
        const trackWaterCurve = new Array(totalFrames).fill(0);
    
        // Generate two random peaks
        const peak1 = Math.floor(Math.random() * (totalFrames)) - 500;
        const peak2 = Math.floor(Math.random() * (totalFrames)) - 500;
    
        // Define standard deviation as a function of rain probability
        const stddev = Math.max(50, 600 * (rainProbability / 100)); // Plus la probabilité est élevée, plus l'écart-type est large
    
        // Generate peak intensities
        const amplitude1 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));
        const amplitude2 = Math.min(1, Math.max(0, generateNormalRandom(rainProbability / 100, 0.1)));
    
        // Add the two peaks to the curve
        for (let i = 0; i < totalFrames; i++) {
            const intensity1 = amplitude1 * Math.exp(-Math.pow(i - peak1, 2) / (2 * Math.pow(stddev, 2)));
            const intensity2 = amplitude2 * Math.exp(-Math.pow(i - peak2, 2) / (2 * Math.pow(stddev, 2)));
            rainCurve[i] = Math.min(1, rainCurve[i] + intensity1 + intensity2) * 1.5 - 0.5; // Limiter à 1
            trackWaterCurve[i+1] = Math.max(0, Math.min(1, trackWaterCurve[i] + (rainCurve[i]/100 - 0.0005))); // Limiter entre 0 et 1
        }
    
        return [rainCurve, trackWaterCurve];
    }

    // Variable for rain curve
    let [rainCurve, trackWaterCurve] = generateRainCurve(rain);
    //console.log(rainCurve); // Check rain curve
    //console.log(trackWaterCurve); // Check water curve on track
    let grip = 0.75-rainCurve[0]*0.75; // Initial grip value
    //console.log("Grip: " + grip); // Check grip value
    let trackState = "green"; // Initial track state

    // Function to format driver time
    function formatDriverTime(seconds) {
        // Extract minutes
        const minutes = Math.floor(seconds / 60);
        
        // Extract seconds and milliseconds
        const remainingSeconds = seconds % 60;
        const formattedSeconds = remainingSeconds.toFixed(3);
    
        // Add a zero before the seconds if necessary
        const [wholeSeconds, milliseconds] = formattedSeconds.split('.');
        const paddedSeconds = wholeSeconds.padStart(2, '0');
    
        // Build the result chain
        return `${minutes > 0 ? minutes + ":" : ''}${paddedSeconds}.${milliseconds}`;
    }

    // Weather update function
    function updateWeather() {
        if (currentFrame < rainCurve.length) {
            currentRain = rainCurve[currentFrame]; // Collect rain for current frame
            forecastRain = rainCurve[Math.min(4000,currentFrame + Math.floor(baseLapTime * 1.5))]; // Forecast rain in 1. 5 normal laps
            currentTrackWater = trackWaterCurve[currentFrame]; // Collect water on track for current frame
            forecastTrackWater = trackWaterCurve[Math.min(4000,currentFrame + Math.floor(baseLapTime * 1.5))]; // Forecast water on track in 1.5 normal laps
            currentFrame++;
        } else {
            currentRain = 0; // After 4000 frames, rain is set to 0
        }
    }

    // Function to update the weather display
    function updateWeatherDisplay() {
        const weatherElement = document.getElementById('weather-info');
        if (currentRain > 0.5) {
            weatherElement.textContent = "Weather: 🌧️ Heavy Rain";
        } else if (currentRain > 0) {
            weatherElement.textContent = "Weather: 🌦️ Light Rain";
        } else if (currentRain > -0.3) {
            weatherElement.textContent = "Weather: ☁️ Cloudy";
        } else {
            weatherElement.textContent = "Weather: ☀️ Sunny";
        }
    }

    // Function to obtain the driver rankings
    function getDriverRank(targetDriver) {
        const sortedRanking = [...ranking].sort((a, b) => {
            if (a.bestTime != null && b.bestTime != null) {
                if (a.bestTime !== b.bestTime) {
                    return a.bestTime - b.bestTime;
                }
            } else if (a.bestTime != null) {
                return -1;
            } else if (b.bestTime != null) {
                return 1;
            }
            return a.defaultOrder - b.defaultOrder;
        });

        const index = sortedRanking.findIndex(d => d === targetDriver);
        return index >= 0 ? index + 1 : null;
    }

    // Function to calculate lap time as a function of speed and distance
    function determineTireType(currentTrackWater, forecastTrackWater, driver) {
        // Simulate judgment error with a normal distribution
        //const adjustedRain = generateNormalRandom(rainIntensity, 0.05);
        //console.log(driver.name + " Current Rain: " + currentRain); // Check current rain value
        //console.log(driver.name + " Forecast Rain: " + forecastRain); // Check forecast rain value
        //console.log(driver.name + " Team Strategy Level: " + driver. teamStratLevel); // Check team strategy level
        const adjustedRain = generateNormalRandom(currentTrackWater * (1 - driver.teamStratLevel/100) + forecastTrackWater * (driver.teamStratLevel/100), 0.05); // Adjusted for team strategy level and forecast
        //console.log(driver.name + " Adjusted Rain: " + adjustedRain); // Check adjusted rain value
        if (adjustedRain < 0.3) {
            return "S"; // Soft
        } else if (adjustedRain < 0.8) {
            return "I"; // Intermediate
        } else {
            return "W"; // Wet
        }
    }

    // Function to determine whether the driver should leave the pits
    function shouldExitPit(driver) {
        const timeRemaining = timer; // Temps restant dans la session
        const criticalTime = baseLapTime * 1.25; // Temps critique pour sortir
    
        if (trackState === 'red') {
            return false; // Ne pas sortir si le drapeau rouge est affiché
        } else if (driver.sessionLaps === 0) {
            // Premier tour : attendre une fenêtre libre
            const isWindowFree = ranking.every(otherDriver => 
                (otherDriver.distance > 0.05 && otherDriver.distance < 0.95) || otherDriver.currentState === "PIT" || otherDriver.currentState === "OUT"
            );
            //console.log(driver.name + " isWindowFree: " + isWindowFree);
            return isWindowFree;
        } else if (driver.sessionLaps < (maxLapsPerSession - 1) && getDriverRank(driver) > 10 - currentSession * 5) {
            const isWindowFree = ranking.every(otherDriver => 
                (otherDriver.distance > 0.05 && otherDriver.distance < 0.95) || otherDriver.currentState === "PIT" || otherDriver.currentState === "OUT"
            );
            return isWindowFree;
        } else if (driver.sessionLaps < maxLapsPerSession) {
            const isWindowFree = ranking.every(otherDriver => 
                (otherDriver.distance > 0.02 && otherDriver.distance < 0.98) || otherDriver.currentState === "PIT" || otherDriver.currentState === "OUT"
            );
            // Dernier tour : attendre la fin de la session ou sortir immédiatement s'il pleut
            return isWindowFree && (currentRain > 0.2 || timeRemaining < criticalTime - Math.floor(Math.random() * 10));
        } else {
            // Pas de tours supplémentaires
            return false;
        }
    }

    // Fonction pour déterminer le facteur de grip en fonction de la pluie et des pneus
    function getGripFactor(currentTire) {
        const tireInfluence = currentTire === "S" ? [1, -0.75] :
                            currentTire === "I" ? [0.85, -0.25] :
                            currentTire === "W" ? [0.5, 0.2] : [0, 0];
        //console.log(tireInfluence[0]);
        const tireFactor = Math.min(1,Math.max(0,tireInfluence[0] + tireInfluence[1] * currentTrackWater))*0.25 + 0.75; // Facteur de grip des pneus
        //console.log("Tire Factor: " + tireFactor); // Vérification du facteur de grip des pneus
        const gripFactor = (1 / (1 + Math.exp(-10 * (grip - 0.5))) * 0.2 ) + 0.8;
        return gripFactor * tireFactor;
    }

    // Fonction pour mettre à jour l'état de la piste
    function updateTrackState(state) {
        trackState = state;
        updateFlagMessage(state);
        
        if (state === 'yellow') {
            flagTimer = 60; // 60 frames pour le drapeau jaune
        } else if (state === 'red') {
            flagTimer = 300; // 300 frames pour le drapeau rouge
        } else if (state === 'green') {
            flagTimer = 0; // Pas de timer pour le drapeau vert
        }
    }

    // Fonction pour déterminer la probabilité de crash
    function checkForCrash(driver) {
        const crashProbability = ((1 - driver.driverLevel/100) * 0.02 + ((1 - grip) * 0.02 + Math.max(0,currentRain) * 0.02 + (difficulty/100) * 0.01))/80;
        //console.log(driver.name + " Level: " + driver.driverLevel);
        //console.log(driver.name + " Grip: " + grip); // Vérification de la valeur de grip
        //console.log(driver.name + " Rain: " + currentRain); // Vérification de la valeur de pluie
        //console.log(driver.name + " Difficulty: " + difficulty); // Vérification de la difficulté
        //console.log(driver.name + " Crash probability: " + crashProbability); // Vérification de la probabilité de crash
        const crashGravity = Math.abs(generateNormalRandom(0,0.5)); // Gravité de l'accident (0 à 1)
        if (Math.random() < crashProbability) {
            if (crashGravity > 0.5) {
                driver.currentState = "OUT";
                updateTrackState('red'); // Déclencher un drapeau rouge
            } else {
                driver.currentState = "<<<";
                updateTrackState('yellow'); // Déclencher un drapeau jaune
            };
        }
    }

    // Fonction pour mettre à jour les états des pilotes
    function updateDriverStates() {
        ranking.forEach(driver => {
            if (driver.eliminated) return;
            
            switch (driver.currentState) {
                case "PIT":
                    //console.log(timer);
                    //console.log("Should exit? " + driver.name + " : " + shouldExitPit(driver));
                    if (shouldExitPit(driver) && timer < Math.floor(Math.random() * 1000) && timer >= 0) {
                        driver.currentTire = determineTireType(currentTrackWater, forecastTrackWater, driver); // Update tire based on rain intensity
                        driver.currentState = ">>>";
                        driver.distance = 0;
                        const outLapTime = calculateLapTime(driver, 0.9); // tour lent
                        driver.targetLapTime = outLapTime;
                        driver.currentSpeed = 1 / outLapTime; // Speed in % circuit
                        driver.lapTimer = 0; // chrono cumulé du tour

                        /*console.log("Track Water = " + currentTrackWater);
                        console.log("S = " + (getGripFactor("S")));
                        console.log("I = " + (getGripFactor("I")));
                        console.log("W = " + (getGripFactor("W")));*/

                        if (!window.gripAnalysis) window.gripAnalysis = [];
                        window.gripAnalysis.push({
                            frame: currentFrame,
                            trackWater: currentTrackWater,
                            grip_S: getGripFactor("S"),
                            grip_I: getGripFactor("I"),
                            grip_W: getGripFactor("W")
                        });
                    }
                    break;
    
                case ">>>":
                    driver.distance += driver.currentSpeed * getGripFactor(driver.currentTire);
                    if (timer <= 0 || trackState === 'red') {
                        driver.currentState = "<<<";
                    }
                    else if (driver.distance >= 1) {
                        driver.currentState = "LAP";
                        driver.distance = 0;
                        const fastLapTime = calculateLapTime(driver, 1.0); // tour rapide
                        driver.targetLapTime = fastLapTime;
                        driver.currentSpeed = 1 / fastLapTime;
                        driver.lapTimer = 0;
                    }
                    break;
    
                case "LAP":
                    const distanceBefore = driver.distance;
                    driver.distance += (driver.currentSpeed * getGripFactor(driver.currentTire));
                    driver.lapTimer += 1;

                    if (trackState === 'red') {
                        // Le pilote retourne aux stands
                        driver.currentState = "<<<";
                        const inLapTime = calculateLapTime(driver, 0.8); // tour très lent
                        driver.targetLapTime = inLapTime;
                        driver.currentSpeed = 1 / inLapTime; // Speed in % circuit
                        driver.lapTimer = 0; // chrono cumulé du tour
                    }
                    else if (driver.distance >= 1) {
                        const remainingDistance = 1 - distanceBefore;
                        const extraTime = remainingDistance / driver.currentSpeed;
                        const lapTime = driver.lapTimer - 1 + extraTime;
                
                        driver.lastTime = lapTime;
                
                        if (!driver.bestTime || lapTime < driver.bestTime) {
                            driver.bestTime = lapTime;
                            driver.displayBestTime = lapTime;
                        }
                
                        driver.sessionLaps ++;
                        driver.runLaps ++;
                        grip += 0.003; // Augmenter le grip à chaque tour
                        updateTable();
                
                        // Passage à l'état suivant
                        driver.currentState = "<<<";
                        driver.distance = 0;
                        const inLapTime = calculateLapTime(driver, 0.9); // tour lent
                        driver.targetLapTime = inLapTime;
                        driver.currentSpeed = 1 / inLapTime; // Speed in % circuit
                        driver.lapTimer = 0; // chrono cumulé du tour
                    }
                    else {
                        checkForCrash(driver); // Vérifier si le pilote a eu un accident
                    }
                    break;
                    
                case "<<<":
                    driver.distance += driver.currentSpeed * getGripFactor(driver.currentTire);
                    if (driver.distance >= 1) {
                        driver.currentState = "PIT";
                        driver.distance = 0;
                    }
                    break;
            }
        });
    }
    
    // Fonction pour calculer le temps de tour en fonction de la vitesse et de la distance
    function calculateLapTime(driver, speedFactor) {
        driver.level = (driver.driverLevel/100) * ((fastSpeed*driver.teamSPD*((1-currentTrackWater)*0.1+0.9) + fastCorners*driver.teamFS + slowCorners*driver.teamSS)/totalCircuit); // Niveau du pilote recalculé
        console.log(currentTrackWater);
        console.log(driver.level);
        const baseTime = baseLapTime - driver.level /10 + 9; // Adjusted for driver level
        return generateNormalRandom(baseTime/speedFactor, baseLapTime/400); // Convert to milliseconds
    }

    // Fonction pour mettre à jour le tableau de classement
    function updateTable() {
        const tableBody = document.getElementById('ranking-table');
        tableBody.innerHTML = "";

        // Tri des pilotes : bestTime croissant, puis ordre par défaut
        const sortedRanking = [...ranking].sort((a, b) => {
            const aTime = a.bestTime != null ? a.bestTime : Infinity;
            const bTime = b.bestTime != null ? b.bestTime : Infinity;
            if (aTime !== bTime) {
                return aTime - bTime;
            }
            return a.defaultOrder - b.defaultOrder;
        });

        sortedRanking.forEach((driver, index) => {
            const tireColor = driver.currentTire === "S" ? "red" :
                            driver.currentTire === "I" ? "#21b946" :
                            driver.currentTire === "W" ? "#3b9add" : "black";

            const row = document.createElement('tr');
            if (driver.eliminated) {
                row.classList.add('eliminated');
            }

            row.innerHTML = `
                <td><b>${index + 1}</b></td>
                <td style="border-left: 3px solid ${driver.color}; width: 10px;"><b>${driver.name}</b></td>
                <td>${driver.team}</td>
                <td style="color: ${tireColor}; font-weight: bold;">${driver.currentTire}</td>
                <td>${driver.currentState}</td>
                <td>${driver.lastTime ? formatDriverTime(driver.lastTime) : ''}</td>
                <td>${driver.displayBestTime ? formatDriverTime(driver.displayBestTime) : ''}</td>
                <td>${driver.runLaps}</td>
            `;

            tableBody.appendChild(row);
        });
    }


    // Fonction pour mettre à jour le message de drapeau
    function updateFlagMessage(type) {
        const flagMessage = document.getElementById('flag-message');
        const flagColor = document.getElementById('flag-color');
        const flagText = document.getElementById('flag-text');
    
        if (type === 'red') {
            flagColor.style.backgroundColor = 'red';
            flagText.style.color = 'red';
            flagText.textContent = 'RED FLAG';
            flagMessage.style.display = 'block';
            flagMessage.style.visibility = 'visible';
        } else if (type === 'yellow') {
            flagColor.style.backgroundColor = 'yellow';
            flagText.style.color = 'yellow';
            flagText.textContent = 'YELLOW FLAG';
            flagMessage.style.display = 'block';
            flagMessage.style.visibility = 'visible';
        } else if (type === 'green') {
            flagColor.style.backgroundColor = 'green';
            flagText.style.color = 'green';
            flagText.textContent = 'GREEN FLAG';
            flagMessage.style.display = 'block';
            flagMessage.style.visibility = 'visible';
    
            // Hide the green flag after 60 frames (1 second at 60 FPS)
            setTimeout(() => {
                flagMessage.style.visibility = 'hidden';
            }, 1000);
        } else {
            // Hide the message for any other type
            flagMessage.style.visibility = 'hidden';
        }
    }
    
    // Example usage (for testing purposes)
    //updateFlagMessage('red'); // Display a red flag
    //setTimeout(() => updateFlagMessage('yellow'), 3000); // Switch to yellow after 3 seconds
    //setTimeout(() => updateFlagMessage('green'), 6000); // Switch to green after 6 seconds

    // Fonction pour réinitialiser les temps de qualification
    function resetQualifiers() {
        ranking.forEach(driver => {
            if (!driver.eliminated) {
                driver.lastTime = null;
                driver.bestTime = 1000;
                driver.displayBestTime = null;
                driver.sessionLaps = 0;
            }
        });
    }

    // Fonction pour avancer à la session suivante
    function advanceSession() {
        if (currentSession === 0) {
            ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
            for (let i = 15; i < 20; i++) {
                ranking[i].eliminated = true;
                ranking[i].bestTime += 2000;
            }
        } else if (currentSession === 1) {
            ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
            for (let i = 10; i < 15; i++) {
                ranking[i].eliminated = true;
                ranking[i].bestTime += 1000;
            }
        }
        if (currentSession < 2) {
            currentSession++;
            resetQualifiers();
            timer = sessionDurations[currentSession] * 60;
            document.getElementById('session-info').innerText = `Q${currentSession + 1}`;
        } else {
            clearInterval(intervalId);
            document.getElementById('session-info').innerText = "Fin de la qualification";
            // Attendre 0.5 secondes avant d'exécuter showRaceButton
            setTimeout(showRaceButton, 500);
            //console.log(window.gripAnalysis);
        }
    }

    // Fonction pour mettre à jour le timer
    function updateTimer() {
        //console.log("trackState : " + trackState); // Vérification de l'état de la piste
        if (timer > -300) { //Le timer continue à défiler même après la fin de la session
            if (trackState === 'red') {
                // Stopper le timer principal en cas de drapeau rouge
                if (flagTimer > 0) {
                    flagTimer--;
                } else if (currentRain > 0.5) {
                    // Si la pluie est forte, le drapeau rouge reste affiché
                } else {
                    updateTrackState('green'); // Retour au drapeau vert après 300 frames
                }
            } else if (trackState === 'yellow') {
                // Ralentir les pilotes en cas de drapeau jaune
                if (flagTimer > 0) {
                    flagTimer--;
                    timer--;
                } else {
                    updateTrackState('green'); // Retour au drapeau vert après 60 frames
                }
            } else {
                timer--;
            };
            document.getElementById('timer').innerText = formatSessionTime(Math.max(0,timer)); // Afficher le temps restant, en évitant les valeurs négatives
            grip = Math.max(0,Math.min(1,grip-((rainCurve[currentFrame] ** 3 ) * 0.02))); // Diminuer le grip en fonction de la pluie
            //console.log("Grip: " + grip); // Vérification de la valeur de grip
            //console.log("Grip Factor: " + (2 / (1 + Math.exp(-10 * (grip - 0.5)))/2) + 0.5); // Vérification du facteur de grip
    
            // Mettre à jour la météo
            updateWeather();
            updateWeatherDisplay();
    
            // Mettre à jour les états des pilotes
            updateDriverStates();
    
            // Mettre à jour les pneus des pilotes
            //updateTiresForDrivers();
    
            // Mettre à jour le tableau
            updateTable();
        } else {
            // Annuler les tours en cours (in lap) des pilotes
            ranking.forEach(driver => {
                if (driver.inLap) {
                    driver.inLap = false;
                }
            });
            advanceSession();
        }
    }
    
    // Fonction pour créer et afficher le bouton après 5 secondes
    function showRaceButton() {
        // Les résultats ne sont enregistrés que lorsque le bouton est affiché
        // Final sort of all 20 drivers based on their best time
        ranking.sort((a, b) => (a.bestTime || Infinity) - (b.bestTime || Infinity));
        localStorage.setItem('drivers', JSON.stringify(ranking));

        // Créer le bouton
        const button = document.createElement('button');
        button.id = 'raceButton';
        button.innerText = 'Go to Race';

        // Ajouter un événement click pour rediriger vers race.html
        button.addEventListener('click', () => {
            window.location.href = 'race.html';
        });

        // Ajouter le bouton au body
        document.body.appendChild(button);

        // Afficher le bouton
        button.style.display = 'block';
    }

    const intervalId = setInterval(updateTimer, 1000 / 60);
    updateTable();
});
