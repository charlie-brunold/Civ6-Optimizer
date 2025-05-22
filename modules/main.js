/**
 * main.js
 * Entry point for the Civilization Map Visualization.
 * Loads data, initializes modules, and starts the application.
 */
import * as THREE from 'three'; // Import THREE itself
// Note: OrbitControls is loaded via import map in HTML, but THREE needs direct import

// Import necessary modules
import { config, tierConfig } from './config.js'; // tierConfig is directly used by setupLegend
import { initScene } from './sceneSetup.js';
import { createMapVisualization } from './mapElements.js';
import { initInteraction } from './interaction.js';
import { initUIControls } from './uiControls.js';
import { startAnimationLoop } from './animation.js';
import { log, formatTerrainName } from './utils.js'; // Import formatTerrainName
import { loadMapData as fetchData } from './dataLoader.js'; // Rename imported function

// --- Constants ---
const MAP_DATA_URL = 'civ_map_data.json'; // Path to your generated JSON data

// --- DOM Elements (for loading bar) ---
let loadingOverlay, progressBar, loadingText, loadingError;

// --- Loading Manager ---
const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
    log('Loading started...');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden'); // Ensure visible
    if (progressBar) progressBar.style.width = '0%';
    if (loadingText) loadingText.textContent = 'Loading Map Data... 0%';
    if (loadingError) loadingError.style.display = 'none';
};

loadingManager.onLoad = function () {
    log('Loading complete!');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
};

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const progress = itemsTotal > 0 ? Math.round((itemsLoaded / itemsTotal) * 100) : 0;
    log(`Loading progress: ${progress}% (${itemsLoaded}/${itemsTotal})`);
    if (progressBar) progressBar.style.width = progress + '%';
    if (loadingText) loadingText.textContent = `Loading Map Data... ${progress}%`;
};

loadingManager.onError = function (url) {
    log(`Error loading: ${url}`);
    if (loadingText) loadingText.textContent = 'Error loading map data!';
    if (loadingError) {
        loadingError.textContent = `Failed to load resource: ${url}. Please check the file path and network connection.`;
        loadingError.style.display = 'block';
    }
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => { // Make this async
    log("DOM content loaded. Initializing application...");

    loadingOverlay = document.getElementById('loading-overlay');
    progressBar = document.getElementById('progress-bar');
    loadingText = document.getElementById('loading-text');
    loadingError = document.getElementById('loading-error');

    const mapContainer = document.getElementById('map-container');

    if (!mapContainer) {
        console.error("Fatal Error: Map container element not found.");
        log("Error: #map-container not found in the DOM.");
        document.body.innerHTML = '<div class="error-message">Error: Could not find the map container element (#map-container).</div>';
        if(loadingOverlay) loadingOverlay.style.display = 'none';
        return;
    }

    loadingManager.itemStart(MAP_DATA_URL);

    try {
        initScene(mapContainer);
        initUIControls();
        initInteraction();

        // Fetch and process map data first
        const mapData = await fetchData(MAP_DATA_URL);
        if (mapData) {
            if (!mapData.tiles || !mapData.metadata) {
                throw new Error("Invalid map data format received (missing tiles or metadata).");
            }
            log('Map data loaded successfully:', { tiles: mapData.tiles.length, metadata: mapData.metadata });
            createMapVisualization(mapData);
            startAnimationLoop();
            log("Application initialized successfully.");
            loadingManager.itemEnd(MAP_DATA_URL);
        } else {
            throw new Error("Map data processing failed (loader returned null).");
        }

        // Now that map data is processed and other UI might be ready, setup legend
        await setupLegend(); // Wait for legend content to be populated
        setupLegendToggle(); // THEN set up the toggle logic

    } catch (error) { // Catch errors from fetchData or other init steps
        log('Error during initialization or data loading:', error);
        console.error('Initialization failed:', error);
        loadingManager.itemError(MAP_DATA_URL); // Signal error to loading manager
        if (loadingText) loadingText.textContent = 'Initialization Error!';
        if (loadingError) {
            loadingError.textContent = `Failed to load or process map data: ${error.message}`;
            loadingError.style.display = 'block';
        }
        if (loadingOverlay) loadingOverlay.classList.remove('hidden'); // Keep overlay to show error
    }
});


/**
 * Populates the legend with dynamic content (terrain types and tiers).
 * Uses imported config data.
 */
async function setupLegend() { // This is already async
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
             const minScore = tierData.min ?? '-∞';
             const maxScore = tierData.max ?? '∞';
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

// --- UPDATED: Function to handle Legend Hide/Show ---
function setupLegendToggle() {
    const legend = document.querySelector('.legend');
    const legendToggle = document.getElementById('legend-toggle');
    const showLegendButton = document.getElementById('show-legend-button');
    const legendContent = document.querySelector('.legend .legend-content');

    if (!legend || !legendToggle || !showLegendButton || !legendContent) {
        console.error("Legend toggle elements not found! Could not initialize. Check IDs and classes.");
        log("Error: Legend toggle elements not found (legend, legend-toggle, show-legend-button, .legend-content).");
        return;
    }

    let calculatedScrollHeight = 0; // To store the actual height of the legend content

    const showLegendAction = () => {
        legend.classList.remove('hidden'); // Make the main legend container visible
        showLegendButton.classList.remove('visible'); // Hide the "Show Legend" button
        legendToggle.textContent = 'Hide';

        // If scrollHeight hasn't been calculated yet, or if it was 0 (e.g. content not ready on first try)
        if (calculatedScrollHeight === 0) {
            // Temporarily remove transition and max-height to measure the true scrollHeight
            const originalTransition = legendContent.style.transition;
            legendContent.style.transition = 'none';
            legendContent.style.maxHeight = 'none'; // Allow content to take its full height

            // Force reflow to get correct measurement
            // Reading offsetHeight is a common way to trigger this.
            // Using requestAnimationFrame ensures styles are applied before measurement.
            requestAnimationFrame(() => {
                calculatedScrollHeight = legendContent.scrollHeight;

                // Immediately set maxHeight to 0px (without transition) to prepare for animation
                legendContent.style.maxHeight = '0px';

                // Restore transition
                legendContent.style.transition = originalTransition; // Or set to 'max-height 0.3s ease-in-out'

                if (calculatedScrollHeight > 0) {
                    log(`Legend content scrollHeight calculated: ${calculatedScrollHeight}px`);
                } else {
                    // Fallback if scrollHeight is still 0 (e.g., content is genuinely empty or still not rendered)
                    calculatedScrollHeight = 500; // Default fallback height
                    log("Warning: legendContent.scrollHeight was 0. Using fallback height: " + calculatedScrollHeight + "px");
                }

                // Use another requestAnimationFrame to apply the target maxHeight, triggering the animation
                requestAnimationFrame(() => {
                    legendContent.style.maxHeight = calculatedScrollHeight + 'px';
                });
            });
        } else {
            // If scrollHeight is already known, just animate to it
            requestAnimationFrame(() => {
                legendContent.style.maxHeight = calculatedScrollHeight + 'px';
            });
            log("Legend shown (using cached scrollHeight), max-height set for content: " + calculatedScrollHeight + "px");
        }
    };

    const hideLegendAction = () => {
        legendContent.style.maxHeight = '0px'; // Start the collapse animation
        log("Legend collapsing, max-height set to 0 for content.");
        legendToggle.textContent = 'Show'; // Change toggle text immediately

        // Function to run when the collapse transition ends
        const onCollapseEnd = (event) => {
            // Ensure the event is for max-height and from the legendContent itself
            if (event.target === legendContent && event.propertyName === 'max-height') {
                legend.classList.add('hidden'); // Hide the main legend container
                showLegendButton.classList.add('visible'); // Show the "Show Legend" button
                legendContent.removeEventListener('transitionend', onCollapseEnd); // Clean up listener
                log("Legend fully hidden after transition.");
            }
        };
        legendContent.addEventListener('transitionend', onCollapseEnd);

        // Fallback: If transitionend doesn't fire (e.g., no transition, or display:none interrupts)
        // This timeout should be slightly longer than the CSS transition duration.
        setTimeout(() => {
            if (legendContent.style.maxHeight === '0px' && !legend.classList.contains('hidden')) {
                log("Legend hide fallback: transitionend didn't fire or was too slow. Forcing hide.");
                legend.classList.add('hidden');
                showLegendButton.classList.add('visible');
                if (legendContent.removeEventListener) { // Check if still exists
                    legendContent.removeEventListener('transitionend', onCollapseEnd);
                }
            }
        }, 350); // CSS transition is 0.3s (300ms)
    };

    // Attach event listeners
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

    // Initial state: Legend is hidden, content is collapsed.
    legend.classList.add('hidden'); // Hide the main legend box
    showLegendButton.classList.add('visible'); // Show the "Show Legend" button
    legendToggle.textContent = 'Show';
    legendContent.style.maxHeight = '0px'; // Ensure it's collapsed by default
    log("Legend toggle initialized. Legend hidden by default, content max-height set to 0.");
}
// --------------------------------------------------------------------


// Add basic error handling for module loading itself
window.addEventListener('error', function (event) {
  if (event.message.includes('Failed to fetch dynamically imported module') ||
      event.message.includes('Error loading script') ||
      event.message.includes('SyntaxError') ||
      event.filename?.includes('/modules/')) {

    console.error('Module Loading/Execution Error:', event.message, event.filename, event.lineno);
    log(`Critical Error: Failed to load/execute script module: ${event.filename || event.message}. Check paths, syntax, and server configuration.`);

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
        if(loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }
});
