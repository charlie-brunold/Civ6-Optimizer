/**
 * config.js
 * Configuration constants for the Civilization Map Visualization.
 */
import * as THREE from 'three'; // Import THREE for Color objects

// Base configuration for the visualization
export const config = {
    hexRadius: 1.0,        // Base size of hexagons
    hexHeight: 0.5,         // Base height of hexagon (before elevation)
    verticalSpacing: 0.866, // Spacing between rows (√3/2 * hexRadius) - Calculated dynamically now
    horizontalSpacing: 1.5, // Spacing between columns (1.5 * hexRadius) - Calculated dynamically now
    elevationFactor: 0.4,   // How much elevation affects tile height
    showResources: true,    // Whether to show resource markers
    showTierLabels: true,   // Whether to show tier labels
    highlightTopTiles: false, // Whether to highlight S and A tier tiles
    selectedTiers: ['S', 'A', 'B', 'C', 'D', 'E', 'F'], // Which tiers to display initially
    showScoreHeatmap: false,  // Toggle for heatmap visibility
    showBoat: true,           // Toggle for boat visibility
    panSpeed: 0.5,            // Camera panning speed with WASD keys
    debug: false              // Enable debug logging
};

// --- Heatmap Configuration ---
// *** Define a multi-stop gradient ***
export const heatmapColors = [
    new THREE.Color(0x0000ff), // Blue (Low) - Stop 0
    new THREE.Color(0x00ffff), // Cyan       - Stop 1
    new THREE.Color(0x00ff00), // Green      - Stop 2
    new THREE.Color(0xffff00), // Yellow     - Stop 3
    new THREE.Color(0xff0000)  // Red (High) - Stop 4
];
// Optional: Define a neutral color for tiles with no score (e.g., ocean) when heatmap is active
export const heatmapNeutralColor = new THREE.Color(0x444455); // Dark blue/grey


// Define terrain colors
export const terrainColors = {
    'TERRAIN_OCEAN': '#1a5f9e',
    'TERRAIN_COAST': '#4da6ff',
    'TERRAIN_PLAINS': '#e8d292',
    'TERRAIN_GRASS': '#8bc34a',
    'TERRAIN_GRASS_HILLS': '#689f38',
    'TERRAIN_DESERT_HILLS': '#ffd54f',
    'TERRAIN_TUNDRA': '#e0e0e0',
    'TERRAIN_TUNDRA_HILLS': '#bdbdbd',
    'TERRAIN_SNOW': '#f5f5f5',
    'TERRAIN_GRASS_MOUNTAIN': '#795548',
    'TERRAIN_PLAINS_MOUNTAIN': '#6d4c41',
    'TERRAIN_DESERT_MOUNTAIN': '#5d4037',
    'TERRAIN_TUNDRA_MOUNTAIN': '#4e342e',
    'TERRAIN_SNOW_MOUNTAIN': '#3e2723',
    'TERRAIN_PLAINS_HILLS': '#dbc773',
    'TERRAIN_DESERT': '#ffc107'
};

// Default color for unknown terrain
export const defaultColor = '#a9a9a9';

// Resource marker styles
export const resourceStyles = {
    'Luxury': { color: '#9c27b0', size: 0.2 },
    'Strategic': { color: '#f44336', size: 0.2 },
    'Bonus': { color: '#4caf50', size: 0.2 },
    'default': { color: '#ff9800', size: 0.2 } // Default if type is unknown/missing
};

// Tier styles
export const tierStyles = {
    'S': { color: '#ffcc00', textColor: 'black' },
    'A': { color: '#ff8800', textColor: 'black' },
    'B': { color: '#66cc66', textColor: 'black' },
    'C': { color: '#6699cc', textColor: 'black' },
    'D': { color: '#cccccc', textColor: 'black' },
    'E': { color: '#999999', textColor: 'black' },
    'F': { color: '#666666', textColor: 'white' }
};

// Function to update config value (e.g., from UI controls)
export function updateConfig(key, value) {
    if (key in config) {
        config[key] = value;
        // Recalculate derived values if necessary
        if (key === 'hexRadius') {
            config.verticalSpacing = config.hexRadius * Math.sqrt(3) / 2;
            config.horizontalSpacing = config.hexRadius * 1.5;
        }
    } else {
        console.warn(`Config key "${key}" not found.`);
    }
}

// Initialize derived values
updateConfig('hexRadius', config.hexRadius);
