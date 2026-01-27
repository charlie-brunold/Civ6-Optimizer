/**
 * main.js
 * Entry point for the Civilization Map Visualization.
 * Initializes modules and handles dynamic map loading from uploads or demo maps.
 */
import * as THREE from 'three';

// Import necessary modules
import { config, tierConfig } from './config.js';
import { initScene, getScene, getRenderer, getCamera } from './sceneSetup.js';
import { createMapVisualization, clearMapVisualization } from './mapElements.js';
import { initInteraction } from './interaction.js';
import { initUIControls } from './uiControls.js';
import { startAnimationLoop, stopAnimationLoop } from './animation.js';
import { log, formatTerrainName } from './utils.js';
import {
    loadDemoMap,
    loadUploadedMap,
    loadConfig,
    getAvailableDemoMaps
} from './dataLoader.js';

// --- State ---
let currentMapData = null;
let isVisualizationActive = false;

// --- DOM Elements ---
let loadingOverlay, progressBar, loadingText, loadingError;
let mapUploadInput, demoMapsSelect, resetButton, currentMapNameSpan;

// --- Loading Manager ---
const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
    log('Loading started...');
    showLoading('Loading map data...');
};

loadingManager.onLoad = function () {
    log('Loading complete!');
    hideLoading();
};

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const progress = itemsTotal > 0 ? Math.round((itemsLoaded / itemsTotal) * 100) : 0;
    log(`Loading progress: ${progress}% (${itemsLoaded}/${itemsTotal})`);
    updateLoadingProgress(progress);
};

loadingManager.onError = function (url) {
    log(`Error loading: ${url}`);
    showError(`Failed to load resource: ${url}`);
};

// --- Loading UI Functions ---
function showLoading(message = 'Loading...') {
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (loadingText) loadingText.textContent = message;
    if (loadingError) loadingError.style.display = 'none';
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

function updateLoadingProgress(percent, message = null) {
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (message && loadingText) loadingText.textContent = message;
}

function showError(message) {
    if (loadingText) loadingText.textContent = 'Error!';
    if (loadingError) {
        loadingError.textContent = message;
        loadingError.style.display = 'block';
    }
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';
}

function showWelcome() {
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (loadingText) loadingText.textContent = 'Select or upload a map to begin';
    if (loadingError) loadingError.style.display = 'none';
}

function updateCurrentMapName(name) {
    if (currentMapNameSpan) {
        currentMapNameSpan.textContent = name ? `Current: ${name}` : 'No map loaded';
    }
}

// --- Map Loading Functions ---

/**
 * Loads processed map data into the Three.js scene.
 * @param {object} processedData - Map data with {metadata, tiles} structure
 * @param {string} [mapName] - Optional name to display
 */
async function loadMapIntoScene(processedData, mapName = 'Custom Map') {
    if (!processedData || !processedData.tiles || !processedData.metadata) {
        throw new Error("Invalid map data format (missing tiles or metadata).");
    }

    // Clear existing visualization if active
    if (isVisualizationActive) {
        clearCurrentVisualization();
    }

    log(`Loading map into scene: ${mapName}`);
    currentMapData = processedData;

    // Create the visualization
    createMapVisualization(processedData);

    // Start animation loop if not already running
    if (!isVisualizationActive) {
        startAnimationLoop();
        isVisualizationActive = true;
    }

    updateCurrentMapName(mapName);
    log(`Map "${mapName}" loaded successfully with ${processedData.tiles.length} tiles.`);

    // Refresh legend
    await setupLegend();
}

/**
 * Clears the current visualization from the scene.
 */
function clearCurrentVisualization() {
    log('Clearing current visualization...');

    // Clear map elements
    if (typeof clearMapVisualization === 'function') {
        clearMapVisualization();
    }

    currentMapData = null;
    updateCurrentMapName(null);
    log('Visualization cleared.');
}

/**
 * Resets the entire visualization state.
 */
function resetVisualization() {
    clearCurrentVisualization();

    // Reset UI elements
    if (demoMapsSelect) demoMapsSelect.value = '';
    if (mapUploadInput) mapUploadInput.value = '';

    // Show welcome screen
    showWelcome();
    log('Visualization reset complete.');
}

/**
 * Handles demo map selection from dropdown.
 */
async function handleDemoMapSelect(event) {
    const mapFilename = event.target.value;
    if (!mapFilename) return;

    log(`Demo map selected: ${mapFilename}`);
    showLoading(`Loading ${mapFilename}...`);

    try {
        updateLoadingProgress(10, 'Fetching map data...');

        // Load the configuration
        const config = await loadConfig();
        updateLoadingProgress(30, 'Processing map data...');

        // Load and process the demo map
        const processedData = await loadDemoMap(mapFilename, config);
        updateLoadingProgress(80, 'Building visualization...');

        // Load into scene
        await loadMapIntoScene(processedData, mapFilename);
        updateLoadingProgress(100, 'Complete!');

        // Hide loading after a brief delay
        setTimeout(hideLoading, 300);

    } catch (error) {
        console.error('Error loading demo map:', error);
        showError(`Failed to load demo map: ${error.message}`);
    }
}

/**
 * Handles file upload from the file input.
 */
async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    log(`File uploaded: ${file.name}`);
    showLoading(`Processing ${file.name}...`);

    try {
        updateLoadingProgress(10, 'Reading file...');

        // Load the configuration
        const config = await loadConfig();
        updateLoadingProgress(30, 'Parsing CSV data...');

        // Process the uploaded file
        const processedData = await loadUploadedMap(file, config);
        updateLoadingProgress(80, 'Building visualization...');

        // Clear demo map selection since we're using custom data
        if (demoMapsSelect) demoMapsSelect.value = '';

        // Load into scene
        await loadMapIntoScene(processedData, file.name);
        updateLoadingProgress(100, 'Complete!');

        // Hide loading after a brief delay
        setTimeout(hideLoading, 300);

    } catch (error) {
        console.error('Error processing uploaded file:', error);
        showError(`Failed to process file: ${error.message}`);
    }
}

/**
 * Handles the reset visualization button click.
 */
function handleResetClick() {
    resetVisualization();
}

// --- Legend Setup (copied from original main.js) ---

/**
 * Populates the legend with dynamic content (terrain types and tiers).
 */
async function setupLegend() {
    const terrainLegend = document.getElementById('terrain-legend');
    const tierLegend = document.getElementById('tier-legend');

    if (!terrainLegend || !tierLegend) {
        log("Warning: Legend containers (terrain or tier) not found.");
        return;
    }

    terrainLegend.innerHTML = '';
    tierLegend.innerHTML = '';

    try {
        const { terrainColors: importedTerrainColors, tierConfig: importedTierConfig } = await import('./config.js');

        if (!importedTerrainColors) {
            throw new Error("Terrain colors not found in config module.");
        }
        if (!importedTierConfig || !importedTierConfig.tiers) {
            throw new Error("Tier config or tiers object not found in config module.");
        }

        Object.entries(importedTerrainColors).forEach(([terrain, color]) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
            const label = document.createElement('span');
            label.textContent = formatTerrainName(terrain);
            item.appendChild(colorBox);
            item.appendChild(label);
            terrainLegend.appendChild(item);
        });
        log("Terrain legend populated.");

        Object.entries(importedTierConfig.tiers).forEach(([tier, tierData]) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const tierSymbol = document.createElement('div');
            tierSymbol.className = `tier-symbol tier-${tier}`;
            tierSymbol.textContent = tier;
            const label = document.createElement('span');
            const minScore = tierData.min ?? '-\u221E';
            const maxScore = tierData.max ?? '\u221E';
            label.textContent = `(Score ${minScore} to ${maxScore})`;
            label.title = `Tier ${tier}: Minimum Score ${minScore}, Maximum Score ${maxScore}`;
            item.appendChild(tierSymbol);
            item.appendChild(label);
            tierLegend.appendChild(item);
        });
        log("Tier legend populated.");

    } catch (error) {
        log("Error populating legend:", error);
        console.error("Failed to setup legend:", error);
        if (terrainLegend) terrainLegend.innerHTML = '<p style="color: red; font-size: 11px;">Error loading terrain legend.</p>';
        if (tierLegend) tierLegend.innerHTML = '<p style="color: red; font-size: 11px;">Error loading tier legend.</p>';
    }
}

// --- Legend Toggle (copied from original main.js) ---

function setupLegendToggle() {
    const legend = document.querySelector('.legend');
    const legendToggle = document.getElementById('legend-toggle');
    const showLegendButton = document.getElementById('show-legend-button');
    const legendContent = document.querySelector('.legend .legend-content');

    if (!legend || !legendToggle || !showLegendButton || !legendContent) {
        console.error("Legend toggle elements not found!");
        log("Error: Legend toggle elements not found.");
        return;
    }

    let calculatedScrollHeight = 0;

    const showLegendAction = () => {
        legend.classList.remove('hidden');
        showLegendButton.classList.remove('visible');
        legendToggle.textContent = 'Hide';

        if (calculatedScrollHeight === 0) {
            const originalTransition = legendContent.style.transition;
            legendContent.style.transition = 'none';
            legendContent.style.maxHeight = 'none';

            requestAnimationFrame(() => {
                calculatedScrollHeight = legendContent.scrollHeight;
                legendContent.style.maxHeight = '0px';
                legendContent.style.transition = originalTransition;

                if (calculatedScrollHeight <= 0) {
                    calculatedScrollHeight = 500;
                    log("Warning: legendContent.scrollHeight was 0. Using fallback height.");
                }

                requestAnimationFrame(() => {
                    legendContent.style.maxHeight = calculatedScrollHeight + 'px';
                });
            });
        } else {
            requestAnimationFrame(() => {
                legendContent.style.maxHeight = calculatedScrollHeight + 'px';
            });
        }
    };

    const hideLegendAction = () => {
        legendContent.style.maxHeight = '0px';
        legendToggle.textContent = 'Show';

        const onCollapseEnd = (event) => {
            if (event.target === legendContent && event.propertyName === 'max-height') {
                legend.classList.add('hidden');
                showLegendButton.classList.add('visible');
                legendContent.removeEventListener('transitionend', onCollapseEnd);
            }
        };
        legendContent.addEventListener('transitionend', onCollapseEnd);

        setTimeout(() => {
            if (legendContent.style.maxHeight === '0px' && !legend.classList.contains('hidden')) {
                legend.classList.add('hidden');
                showLegendButton.classList.add('visible');
                legendContent.removeEventListener('transitionend', onCollapseEnd);
            }
        }, 350);
    };

    legendToggle.addEventListener('click', () => {
        if (legend.classList.contains('hidden')) {
            showLegendAction();
        } else {
            hideLegendAction();
        }
    });

    showLegendButton.addEventListener('click', () => {
        showLegendAction();
    });

    // Initial state: Legend is hidden
    legend.classList.add('hidden');
    showLegendButton.classList.add('visible');
    legendToggle.textContent = 'Show';
    legendContent.style.maxHeight = '0px';
    log("Legend toggle initialized.");
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    log("DOM content loaded. Initializing application...");

    // Cache DOM elements
    loadingOverlay = document.getElementById('loading-overlay');
    progressBar = document.getElementById('progress-bar');
    loadingText = document.getElementById('loading-text');
    loadingError = document.getElementById('loading-error');
    mapUploadInput = document.getElementById('map-upload');
    demoMapsSelect = document.getElementById('demo-maps');
    resetButton = document.getElementById('reset-visualization');
    currentMapNameSpan = document.getElementById('current-map-name');

    const mapContainer = document.getElementById('map-container');

    if (!mapContainer) {
        console.error("Fatal Error: Map container element not found.");
        log("Error: #map-container not found in the DOM.");
        document.body.innerHTML = '<div class="error-message">Error: Could not find the map container element (#map-container).</div>';
        return;
    }

    try {
        // Initialize Three.js scene
        initScene(mapContainer);
        initUIControls();
        initInteraction();

        // Set up event listeners for data management controls
        if (demoMapsSelect) {
            demoMapsSelect.addEventListener('change', handleDemoMapSelect);
        }

        if (mapUploadInput) {
            mapUploadInput.addEventListener('change', handleFileUpload);
        }

        if (resetButton) {
            resetButton.addEventListener('click', handleResetClick);
        }

        // Show welcome screen (no auto-loading of map data)
        showWelcome();

        // Set up legend
        await setupLegend();
        setupLegendToggle();

        log("Application initialized successfully. Waiting for user to load a map.");

    } catch (error) {
        log('Error during initialization:', error);
        console.error('Initialization failed:', error);
        showError(`Initialization failed: ${error.message}`);
    }
});

// --- Error Handling ---

window.addEventListener('error', function (event) {
    if (event.message.includes('Failed to fetch dynamically imported module') ||
        event.message.includes('Error loading script') ||
        event.message.includes('SyntaxError') ||
        event.filename?.includes('/modules/')) {

        console.error('Module Loading/Execution Error:', event.message, event.filename, event.lineno);
        log(`Critical Error: Failed to load/execute script module: ${event.filename || event.message}`);

        const existingError = document.getElementById('critical-error-overlay');
        if (!existingError && document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.id = 'critical-error-overlay';
            errorDiv.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(200, 0, 0, 0.85); color: white;
                z-index: 2000; display: flex; flex-direction: column;
                justify-content: center; align-items: center; text-align: center;
                padding: 20px; font-family: Arial, sans-serif;
            `;
            errorDiv.innerHTML = `
                <h2 style="margin-bottom: 15px;">Application Error</h2>
                <p>Failed to load or run essential scripts.</p>
                <p>Please check the browser's developer console (F12) for details.</p>
                <p style="font-size: 0.8em; margin-top: 10px; font-family: monospace; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 3px;">(${event.message})</p>
            `;
            document.body.appendChild(errorDiv);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }
});

// --- Export for external access if needed ---
export { currentMapData, loadMapIntoScene, resetVisualization };
