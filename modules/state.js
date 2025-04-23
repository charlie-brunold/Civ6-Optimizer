/**
 * state.js
 * Holds shared state variables for the visualization.
 */
import * as THREE from 'three';
import { log } from './utils.js'; // Import log if needed for debugging state changes

// --- Core Three.js Objects (initialized elsewhere) ---
export let scene = null;
export let camera = null;
export let renderer = null;
export let controls = null;
export function setScene(newScene) { scene = newScene; }
export function setCamera(newCamera) { camera = newCamera; }
export function setRenderer(newRenderer) { renderer = newRenderer; }
export function setControls(newControls) { controls = newControls; }

// --- Map Data ---
export let mapData = null; // Holds the raw data loaded from JSON { metadata: {}, tiles: [] }
export let minScore = 0;   // Current minimum normalized score across workable tiles
export let maxScore = 100; // Current maximum normalized score across workable tiles

/**
 * Stores the loaded map data and calculates the initial min/max scores.
 * @param {object} data - The map data object ({ metadata, tiles }).
 */
export function setMapData(data) {
    mapData = data;
    // Calculate initial min/max scores when data is first set
    if (mapData && mapData.tiles) {
        let initialMin = Infinity;
        let initialMax = -Infinity;
        mapData.tiles.forEach(tile => {
            // Check if tile is workable and has a valid score
            // Note: 'is_workable' might be added during the first calculation pass
            const isWorkable = tile.is_workable ?? !(tile.terrain === 'TERRAIN_OCEAN' || tile.feature === 'FEATURE_ICE');
            if (isWorkable && typeof tile.normalized_score === 'number') {
                initialMin = Math.min(initialMin, tile.normalized_score);
                initialMax = Math.max(initialMax, tile.normalized_score);
            }
        });

        minScore = initialMin === Infinity ? 0 : initialMin;
        maxScore = initialMax === -Infinity ? 100 : initialMax;

        // Avoid min === max for lerp in heatmap
        if (minScore === maxScore && scores.length > 0) {
             maxScore += 1; // Add a small buffer if all scores are identical
        }
        log(`Initial min/max scores set from data: ${minScore}/${maxScore}`);
    } else {
        // Reset if data is invalid
        minScore = 0;
        maxScore = 100;
    }
}

/**
 * Updates the global min and max normalized scores.
 * Called after recalculating scores due to weight changes.
 * @param {number} newMin - The new minimum score.
 * @param {number} newMax - The new maximum score.
 */
export function setMinMaxScores(newMin, newMax) {
    minScore = newMin;
    maxScore = newMax;
    // Avoid min === max for lerp in heatmap
    if (minScore === maxScore) {
        maxScore += 1; // Add a small buffer if all scores become identical
        log(`Adjusted maxScore to ${maxScore} because minScore === maxScore`);
    }
    // log(`State updated: minScore=${minScore}, maxScore=${maxScore}`); // Already logged in uiControls
}


// --- Map Objects ---
export let hexagons = [];
export let resourceMarkers = [];
export let tierLabels = [];
export function clearMapObjects() {
    // Consider disposing geometry/materials here if not done elsewhere
    hexagons = [];
    resourceMarkers = [];
    tierLabels = [];
}
export function addHexagon(hex) { hexagons.push(hex); }
export function addResourceMarker(marker) { resourceMarkers.push(marker); }
export function addTierLabel(label) { tierLabels.push(label); }

// --- Interaction State ---
export let raycaster = new THREE.Raycaster();
export let mouse = new THREE.Vector2();
export let hoveredHexagon = null; // The hexagon mesh currently under the mouse
export function setHoveredHexagon(hex) { hoveredHexagon = hex; }

// --- Keyboard State ---
export let keys = { w: false, a: false, s: false, d: false }; // For camera movement

// --- Animation Clock ---
export let clock = new THREE.Clock();

// --- Animation/Path State (if used) ---
export let interpolationFactor = 0;
export let currentPathPoint = new THREE.Vector3();
export let nextPathPoint = new THREE.Vector3();
export let lastWakeTime = 0;
export function setInterpolationFactor(factor) { interpolationFactor = factor; }
export function setLastWakeTime(time) { lastWakeTime = time; }

// --- UI State ---
export let allTiersSelected = true; // Tracks state of the "Select/Deselect All" tiers button
export function setAllTiersSelected(isSelected) { allTiersSelected = isSelected; }

// Add any other shared state variables needed below
