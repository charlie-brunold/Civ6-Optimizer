/**
 * main.js
 * Entry point for the Civilization Map Visualization.
 * Loads data, initializes modules, and starts the application.
 */
import * as THREE from 'three'; // Still needed if used directly here, otherwise remove
import { config } from './config.js';
import { initScene } from './sceneSetup.js';
import { createMapVisualization } from './mapElements.js';
import { initInteraction } from './interaction.js';
import { initUIControls } from './uiControls.js';
import { startAnimationLoop } from './animation.js';
import { log } from './utils.js';

// --- Constants ---
const MAP_DATA_URL = 'civ_map_data.json'; // Path to your generated JSON data

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM content loaded. Initializing application...");

    const mapContainer = document.getElementById('map-container');

    if (!mapContainer) {
        console.error("Fatal Error: Map container element not found.");
        log("Error: #map-container not found in the DOM.");
        // Display error message to the user
        document.body.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Error: Could not find the map container element (#map-container). The visualization cannot start.</div>';
        return;
    }

    // 1. Initialize Scene, Camera, Renderer, Controls
    initScene(mapContainer);

    // 2. Initialize UI Controls (reads initial config state)
    initUIControls();

    // 3. Initialize Interaction Handlers
    initInteraction();

    // 4. Load Map Data and Create Visualization
    loadMapData(MAP_DATA_URL)
        .then(mapData => {
            if (mapData) {
                createMapVisualization(mapData); // Creates hexes, labels, etc.
                startAnimationLoop(); // Start rendering loop only after data is loaded
                log("Application initialized successfully.");
            } else {
                throw new Error("Map data processing failed."); // Throw error if data is null/undefined
            }
        })
        .catch(error => {
            log('Error during application initialization:', error);
            console.error('Initialization failed:', error);
            // Display error message in the container
             mapContainer.innerHTML = `
                <div class="error-message" style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); text-align: center;">
                    <h3>Initialization Error</h3>
                    <p>Could not load or process map data:</p>
                    <p style="color: red; font-family: monospace; font-size: 12px; margin-top: 10px;">${error.message}</p>
                    <p style="margin-top: 15px;">Please ensure '${MAP_DATA_URL}' exists, is valid JSON, and the server is running if applicable.</p>
                </div>`;
        });

     // 5. Initial Legend Setup (if needed beyond UI controls)
     setupLegend(); // Populate dynamic parts of the legend

});


/**
 * Loads map data from the specified URL.
 * @param {string} url - The URL of the map data JSON file.
 * @returns {Promise<object|null>} A promise that resolves with the map data object, or null on error.
 */
async function loadMapData(url) {
    log(`Loading map data from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Try to get more specific error text if available
            let errorText = response.statusText;
            try {
                const errorData = await response.json(); // Or response.text()
                errorText = errorData.message || errorData.error || JSON.stringify(errorData);
            } catch (e) { /* Ignore if response body isn't helpful JSON/text */ }
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        log('Map data loaded successfully:', { tiles: data?.tiles?.length, metadata: data?.metadata });
        // Basic validation
        if (!data || !data.tiles || !data.metadata) {
             throw new Error("Invalid map data format received.");
        }
        return data;
    } catch (error) {
        log('Error loading map data:', error);
        console.error('Failed to load map data:', error);
        // Propagate error to be caught by the main initialization catch block
        throw error; // Re-throw the error
    }
}

/**
 * Populates the legend with dynamic content (like terrain types).
 * ***** Added async keyword here *****
 */
async function setupLegend() { // <--- Added async
     const terrainLegend = document.getElementById('terrain-legend');
     if (!terrainLegend) {
         log("Warning: Terrain legend container not found.");
         return;
     }

     // Clear existing items
     terrainLegend.innerHTML = '';

     try {
         // Get terrain colors from config using await
         // Ensure paths are correct relative to main.js if using relative paths
         const { terrainColors } = await import('./config.js');
         const { formatTerrainName } = await import('./utils.js');


         Object.entries(terrainColors).forEach(([terrain, color]) => {
             const item = document.createElement('div');
             item.className = 'legend-item';

             const colorBox = document.createElement('div');
             colorBox.className = 'legend-color';
             colorBox.style.backgroundColor = color;

             const label = document.createElement('span');
             label.textContent = formatTerrainName(terrain);

             item.appendChild(colorBox);
             item.appendChild(label);
             terrainLegend.appendChild(item);
         });
         log("Terrain legend populated.");
     } catch (error) {
         log("Error dynamically importing modules for legend setup:", error);
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
      event.filename.includes('/modules/')) { // Check if error originates from modules

    console.error('Module Loading/Execution Error:', event.message, event.filename, event.lineno);
    log(`Critical Error: Failed to load/execute script module: ${event.filename || event.message}. Check paths, syntax, and server configuration.`);

    // Try to display an error message overlay if the body hasn't been replaced
    const existingError = document.getElementById('critical-error-overlay');
    if (!existingError) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'critical-error-overlay';
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '0';
        errorDiv.style.left = '0';
        errorDiv.style.width = '100%';
        errorDiv.style.height = '100%';
        errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.zIndex = '2000';
        errorDiv.style.display = 'flex';
        errorDiv.style.justifyContent = 'center';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.padding = '20px';
        errorDiv.innerHTML = `<h2>Application Error</h2><p>Failed to load or run essential scripts.</p><p>Please check the browser's developer console (F12) for details.</p><p style="font-size: 0.8em; margin-top: 10px;">(${event.message})</p>`;
        document.body.appendChild(errorDiv);
    }
  }
});
