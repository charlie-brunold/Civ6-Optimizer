/**
 * config.js
 * Configuration constants and state for the Civilization Map Visualization.
 */
import * as THREE from 'three'; // Import THREE for Color objects
import { log } from './utils.js'; // Import log for debugging updates

// --- Default Scoring Weights ---
const defaultScoringWeights = {
    yields: { food: 1.0, production: 1.0, gold: 0.5 },
    bonuses: {
        balance_factor: 0.5, resource_strategic_factor: 1.0, resource_luxury_factor: 1.0,
        fresh_water: 10.0, appeal_positive_factor: 0.5, goody_hut: 15.0
    }
};

// --- Tier Percentile Definitions ---
const defaultTierPercentiles = {
    "F": 0.05, "E": 0.15, "D": 0.35, "C": 0.65, "B": 0.85, "A": 0.95, "S": 1.00
};


// --- Base Configuration State ---
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
    showBoat: true,
    panSpeed: 0.5,
    debug: false, // General debug flag (if used elsewhere)
    hoverRadius: 1, // Default radius for hover effect
    isDebugModeEnabled: false, // Is the debug mode available to be triggered? (Controlled by UI toggle)
    showRecommendedDistrictIcons: true, // Toggle for district icon visibility
    districtIconScale: 0.95, // Default scale for district icons (adjust as needed)
    districtIconYOffset: 1.45, // Offset above the hex surface (adjust as needed)
    scoring_weights: JSON.parse(JSON.stringify(defaultScoringWeights)),
    tier_percentiles: JSON.parse(JSON.stringify(defaultTierPercentiles))
};

// --- Debug Mode Specific Constants ---
export const DEBUG_CENTER_HIGHLIGHT_COLOR = 0xff00ff; // Magenta highlight for the clicked center
export const DEBUG_CENTER_HIGHLIGHT_INTENSITY = 0.7;

// --- Heatmap Configuration ---
export const heatmapColors = [
    new THREE.Color(0x0000ff), new THREE.Color(0x00ffff), new THREE.Color(0x00ff00),
    new THREE.Color(0xffff00), new THREE.Color(0xff0000)
];
export const heatmapNeutralColor = new THREE.Color(0x444455);

// --- Static Styles & Colors ---
export const terrainColors = {
    'TERRAIN_OCEAN': '#1a5f9e', 'TERRAIN_COAST': '#4da6ff', 'TERRAIN_PLAINS': '#e8d292',
    'TERRAIN_GRASS': '#8bc34a', 'TERRAIN_GRASS_HILLS': '#689f38', 'TERRAIN_DESERT_HILLS': '#ffd54f',
    'TERRAIN_TUNDRA': '#e0e0e0', 'TERRAIN_TUNDRA_HILLS': '#bdbdbd', 'TERRAIN_SNOW': '#f5f5f5',
    'TERRAIN_GRASS_MOUNTAIN': '#795548', 'TERRAIN_PLAINS_MOUNTAIN': '#6d4c41', 'TERRAIN_DESERT_MOUNTAIN': '#5d4037',
    'TERRAIN_TUNDRA_MOUNTAIN': '#4e342e', 'TERRAIN_SNOW_MOUNTAIN': '#3e2723', 'TERRAIN_PLAINS_HILLS': '#dbc773',
    'TERRAIN_DESERT': '#ffc107'
};
export const defaultColor = '#a9a9a9';

export const resourceStyles = {
    'Luxury': { color: '#9c27b0', size: 0.2 }, 'Strategic': { color: '#f44336', size: 0.2 },
    'Bonus': { color: '#4caf50', size: 0.2 }, 'default': { color: '#ff9800', size: 0.2 }
};

export const tierStyles = {
    'S': { color: '#ffcc00', textColor: 'black' }, 'A': { color: '#ff8800', textColor: 'black' },
    'B': { color: '#66cc66', textColor: 'black' }, 'C': { color: '#6699cc', textColor: 'black' },
    'D': { color: '#cccccc', textColor: 'black' }, 'E': { color: '#999999', textColor: 'black' },
    'F': { color: '#666666', textColor: 'white' }
};

export const tierConfig = {
    tiers: {
        'S': { min: 300 }, 'A': { min: 250, max: 299.99 }, 'B': { min: 200, max: 249.99 },
        'C': { min: 150, max: 199.99 }, 'D': { min: 100, max: 149.99 }, 'E': { min: 50, max: 99.99 },
        'F': { max: 49.99 }
    }
};

// **** UPDATED: District Icon Paths with lowercase, no-space keys ****
// These keys should now match the `formatted_district` string from your Python script
export const districtIconPaths = {
    "campus": "assets/icons/campus.png",
    "holysite": "assets/icons/holysite.png",
    "harbor": "assets/icons/harbor.png",
    "governmentplaza": "assets/icons/governmentplaza.png",
    "theatersquare": "assets/icons/theatersquare.png",
    "entertainmentcomplex": "assets/icons/entertainmentcomplex.png",
    "commercialhub": "assets/icons/commercialhub.png",
    "industrialzone": "assets/icons/industrialzone.png",
    "aqueduct": "assets/icons/aqueduct.png",
    "waterpark": "assets/icons/waterpark.png",
    "dam": "assets/icons/dam.png",
    "canal": "assets/icons/canal.png"
    // Add any other districts your optimizer might recommend, using their lowercase, no-space names as keys
};
// ***********************************


// --- Functions ---
/**
 * Updates a configuration value, supporting nested keys.
 */
export function updateConfig(key, value) {
    const keys = key.split('.');
    let current = config;
    try {
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) {
                log(`Warning: Intermediate key "${keys[i]}" not found in config path "${key}". Cannot update.`);
                return;
            }
            current = current[keys[i]];
        }
        const finalKey = keys[keys.length - 1];
        if (typeof current === 'object' && current !== null) {
            current[finalKey] = value;
            // log(`Config updated: ${key} = ${JSON.stringify(value)}`); // Log successful update
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
 */
export function getDefaultWeights() {
    return JSON.parse(JSON.stringify(defaultScoringWeights));
}

// --- Initial Calculations ---
updateConfig('hexRadius', config.hexRadius);

log("Config module initialized.");
