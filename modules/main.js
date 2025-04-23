/**
 * main.js
 * Entry point for the Civilization Map Visualization.
 * Loads data, initializes modules, and starts the application.
 */
import * as THREE from 'three'; // Import THREE itself
// Note: OrbitControls is loaded via import map in HTML, but THREE needs direct import

// Import necessary modules
import { config } from './config.js';
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
        // Add 'hidden' class to trigger fade-out transition
        loadingOverlay.classList.add('hidden');
        // Optional: Set display none after transition completes, though opacity 0 might be enough
        // setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500); // Match CSS transition duration
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
    // Keep overlay visible to show the error
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%'; // Reset progress bar on error
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM content loaded. Initializing application...");

    // Get loading bar elements
    loadingOverlay = document.getElementById('loading-overlay');
    progressBar = document.getElementById('progress-bar');
    loadingText = document.getElementById('loading-text');
    loadingError = document.getElementById('loading-error');

    const mapContainer = document.getElementById('map-container');

    if (!mapContainer) {
        console.error("Fatal Error: Map container element not found.");
        log("Error: #map-container not found in the DOM.");
        document.body.innerHTML = '<div class="error-message">Error: Could not find the map container element (#map-container).</div>';
        if(loadingOverlay) loadingOverlay.style.display = 'none'; // Hide loading if container fails
        return;
    }

    // --- Start Loading Process ---
    // Manually signal the start to the LoadingManager because we are using fetch externally
    loadingManager.itemStart(MAP_DATA_URL);

    try {
        // 1. Initialize Scene, Camera, Renderer, Controls
        // These don't depend on map data, so initialize early
        initScene(mapContainer);

        // 2. Initialize UI Controls (reads initial config state)
        initUIControls();

        // 3. Initialize Interaction Handlers
        initInteraction();

        // 4. Fetch Map Data (using external dataLoader) and Create Visualization
        fetchData(MAP_DATA_URL)
            .then(mapData => {
                if (mapData) {
                    // Basic validation
                    if (!mapData.tiles || !mapData.metadata) {
                        throw new Error("Invalid map data format received (missing tiles or metadata).");
                    }
                    log('Map data loaded successfully:', { tiles: mapData.tiles.length, metadata: mapData.metadata });
                    createMapVisualization(mapData); // Creates hexes, labels, etc.
                    startAnimationLoop(); // Start rendering loop
                    log("Application initialized successfully.");
                    // Manually signal the end of loading for this item
                    loadingManager.itemEnd(MAP_DATA_URL);
                } else {
                    // If fetchData returns null, treat it as an error
                    throw new Error("Map data processing failed (loader returned null).");
                }
            })
            .catch(error => {
                // Handle errors during fetch or processing
                log('Error during data loading or visualization creation:', error);
                console.error('Initialization failed:', error);
                // Manually signal an error to the LoadingManager
                loadingManager.itemError(MAP_DATA_URL);
                // Display error message in the loading overlay
                if (loadingText) loadingText.textContent = 'Initialization Error!';
                if (loadingError) {
                    loadingError.textContent = `Failed to load or process map data: ${error.message}`;
                    loadingError.style.display = 'block';
                }
                // Keep the loading overlay visible
                if (loadingOverlay) loadingOverlay.classList.remove('hidden');
            });

        // 5. Initial Legend Setup (can run concurrently or after data load)
        setupLegend(); // Populate dynamic parts of the legend

    } catch (initError) {
        // Catch synchronous errors during initialization (e.g., in initScene)
        log('Critical initialization error:', initError);
        console.error('Critical Initialization Error:', initError);
        loadingManager.itemError(MAP_DATA_URL); // Signal error if loading was started
         if (loadingText) loadingText.textContent = 'Critical Error!';
         if (loadingError) {
            loadingError.textContent = `Failed to initialize viewer: ${initError.message}`;
            loadingError.style.display = 'block';
         }
         if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }
});


/**
 * Populates the legend with dynamic content (like terrain types).
 * Uses dynamic import for config and utils.
 */
async function setupLegend() {
     const terrainLegend = document.getElementById('terrain-legend');
     if (!terrainLegend) {
         log("Warning: Terrain legend container not found.");
         return;
     }

     // Clear existing items
     terrainLegend.innerHTML = '';

     try {
         // Dynamically import config to get colors
         // Ensure paths are correct relative to main.js if using relative paths
         const { terrainColors } = await import('./config.js');
         // formatTerrainName is already imported at the top

         if (!terrainColors) {
            throw new Error("Terrain colors not found in config module.");
         }

         Object.entries(terrainColors).forEach(([terrain, color]) => {
             const item = document.createElement('div');
             item.className = 'legend-item';

             const colorBox = document.createElement('div');
             colorBox.className = 'legend-color';
             // Ensure color is a valid CSS color string
             colorBox.style.backgroundColor = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;

             const label = document.createElement('span');
             label.textContent = formatTerrainName(terrain); // Use imported function

             item.appendChild(colorBox);
             item.appendChild(label);
             terrainLegend.appendChild(item);
         });
         log("Terrain legend populated.");
     } catch (error) {
         log("Error dynamically importing modules or populating legend:", error);
         console.error("Failed to setup legend:", error);
         // Optionally display a message in the legend area
         terrainLegend.innerHTML = '<p style="color: red; font-size: 11px;">Error loading legend data.</p>';
     }
}

// Add basic error handling for module loading itself
window.addEventListener('error', function (event) {
  // Check if the error is related to module loading
  if (event.message.includes('Failed to fetch dynamically imported module') ||
      event.message.includes('Error loading script') ||
      event.message.includes('SyntaxError') || // Catch general syntax errors during load
      event.filename?.includes('/modules/')) { // Check if error originates from modules (optional chaining for filename)

    console.error('Module Loading/Execution Error:', event.message, event.filename, event.lineno);
    log(`Critical Error: Failed to load/execute script module: ${event.filename || event.message}. Check paths, syntax, and server configuration.`);

    // Try to display an error message overlay if the body hasn't been replaced
    const existingError = document.getElementById('critical-error-overlay');
    if (!existingError && document.body) { // Check if body exists
        const errorDiv = document.createElement('div');
        errorDiv.id = 'critical-error-overlay';
        // Apply similar styles as .error-message but full screen overlay
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
        // Hide loading overlay if it exists
        if(loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }
});