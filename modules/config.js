/**
 * config.js
 * Configuration constants and state for the Civilization Map Visualization.
 */
import * as THREE from 'three'; // Import THREE for Color objects
import { log } from './utils.js'; // Import log for debugging updates

// --- Default Scoring Weights ---
// Define the default 'balanced' weights separately so they are immutable
const defaultScoringWeights = {
    yields: {
        food: 1.0,
        production: 1.0,
        gold: 0.5
    },
    bonuses: {
        balance_factor: 0.5,
        resource_strategic_factor: 1.0,
        resource_luxury_factor: 1.0,
        fresh_water: 10.0,
        appeal_positive_factor: 0.5,
        goody_hut: 15.0
        // Add other default bonus weights here if needed
    }
};

// --- Tier Percentile Definitions ---
// Defines the *upper* boundary (inclusive) for each tier based on normalized score percentile.
// Example: F includes scores up to the 10th percentile, D up to the 25th, etc.
// Processed F -> S. Ensure the highest tier goes up to 1.0 (100%).
const defaultTierPercentiles = {
    "F": 0.05, // 5%
    "E": 0.15, // 10%
    "D": 0.35, // 20%
    "C": 0.65, // 30%
    "B": 0.85, // 20%
    "A": 0.95, // 10%
    "S": 1.00  // 5%
};


// --- Base Configuration State ---
// This object holds the *current* configuration, which can be modified
export const config = {
    hexRadius: 1.0,
    hexHeight: 0.5,
    verticalSpacing: 0.866, // Will be recalculated
    horizontalSpacing: 1.5, // Will be recalculated
    elevationFactor: 0.4,
    showResources: true,
    showTierLabels: true,
    highlightTopTiles: false,
    selectedTiers: ['S', 'A', 'B', 'C', 'D', 'E', 'F'],
    showScoreHeatmap: false,
    showBoat: true, // Assuming this is still used elsewhere
    panSpeed: 0.5,
    debug: false,
    // Add the scoring_weights property, initializing with a *copy* of the defaults
    scoring_weights: JSON.parse(JSON.stringify(defaultScoringWeights)),
    // *** ADD tier_percentiles to the config object ***
    tier_percentiles: JSON.parse(JSON.stringify(defaultTierPercentiles)) // Use a copy
};

// --- Heatmap Configuration ---
export const heatmapColors = [
    new THREE.Color(0x0000ff), // Blue (Low)
    new THREE.Color(0x00ffff), // Cyan
    new THREE.Color(0x00ff00), // Green
    new THREE.Color(0xffff00), // Yellow
    new THREE.Color(0xff0000)  // Red (High)
];
export const heatmapNeutralColor = new THREE.Color(0x444455); // Dark blue/grey for non-scored tiles

// --- Static Styles & Colors ---
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
    // Add other terrains as needed
};
export const defaultColor = '#a9a9a9'; // Fallback terrain color

export const resourceStyles = {
    'Luxury': { color: '#9c27b0', size: 0.2 },
    'Strategic': { color: '#f44336', size: 0.2 },
    'Bonus': { color: '#4caf50', size: 0.2 },
    'default': { color: '#ff9800', size: 0.2 }
};

// Tier styles (used for label appearance)
export const tierStyles = {
    'S': { color: '#ffcc00', textColor: 'black' },
    'A': { color: '#ff8800', textColor: 'black' },
    'B': { color: '#66cc66', textColor: 'black' },
    'C': { color: '#6699cc', textColor: 'black' },
    'D': { color: '#cccccc', textColor: 'black' },
    'E': { color: '#999999', textColor: 'black' },
    'F': { color: '#666666', textColor: 'white' }
    // Add 'N/A' or null style if needed for non-tiered tiles
};

// --- Functions ---

/**
 * Updates a configuration value, supporting nested keys.
 * @param {string} key - The configuration key (e.g., 'showResources', 'scoring_weights.yields.food').
 * @param {*} value - The new value.
 */
export function updateConfig(key, value) {
    const keys = key.split('.');
    let current = config;
    try {
        // Traverse object structure except for the last key
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) {
                log(`Warning: Intermediate key "${keys[i]}" not found in config path "${key}". Cannot update.`);
                return; // Stop if path doesn't exist
            }
            current = current[keys[i]];
        }

        // Set the value on the final key
        const finalKey = keys[keys.length - 1];
        if (typeof current === 'object' && current !== null) {
            current[finalKey] = value;
            // log(`Config updated: ${key} = ${value}`); // Optional: Log successful update

            // Recalculate derived values if necessary
            if (key === 'hexRadius') {
                config.verticalSpacing = config.hexRadius * Math.sqrt(3) / 2;
                config.horizontalSpacing = config.hexRadius * 1.5;
                log(`Recalculated spacing: V=${config.verticalSpacing.toFixed(3)}, H=${config.horizontalSpacing.toFixed(2)}`);
            }
        } else {
             log(`Warning: Cannot set property "${finalKey}" on non-object in config path "${key}".`);
        }

    } catch (error) {
        log(`Error updating config key "${key}":`, error);
        console.error(`Error updating config key "${key}":`, error);
    }
}

/**
 * Returns a deep copy of the default scoring weights.
 * @returns {object} A deep copy of the default scoring weights.
 */
export function getDefaultWeights() {
    // Use JSON stringify/parse for a simple deep copy
    return JSON.parse(JSON.stringify(defaultScoringWeights));
}

// --- Initial Calculations ---
// Calculate initial spacing based on default radius
updateConfig('hexRadius', config.hexRadius);

log("Config module initialized.");

