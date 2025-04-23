/**
 * state.js
 * Holds shared state variables for the visualization.
 */
import * as THREE from 'three';

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
export let mapData = null;
export let minScore = 0; // Store min/max scores for heatmap scaling
export let maxScore = 100; // Default max
export function setMapData(data) {
    mapData = data;
    // Calculate min/max scores when data is set
    if (mapData && mapData.tiles) {
        const scores = mapData.tiles
            .map(t => t.normalized_score)
            .filter(s => s !== null && s !== undefined); // Filter out null/undefined scores
        minScore = scores.length > 0 ? Math.min(...scores) : 0;
        maxScore = scores.length > 0 ? Math.max(...scores) : 100;
        // Avoid min === max for lerp
        if (minScore === maxScore) maxScore += 1;
    }
}


// --- Map Objects ---
export let hexagons = [];
export let resourceMarkers = [];
export let tierLabels = [];
// *** Removed histogramBars ***
export function clearMapObjects() {
    hexagons = [];
    resourceMarkers = [];
    tierLabels = [];
    // *** Removed histogramBars = [] ***
}
export function addHexagon(hex) { hexagons.push(hex); }
export function addResourceMarker(marker) { resourceMarkers.push(marker); }
export function addTierLabel(label) { tierLabels.push(label); }
// *** Removed addHistogramBar ***

// --- Interaction State ---
export let raycaster = new THREE.Raycaster();
export let mouse = new THREE.Vector2();
export let hoveredHexagon = null;
export function setHoveredHexagon(hex) { hoveredHexagon = hex; }

// --- Keyboard State ---
export let keys = { w: false, a: false, s: false, d: false };

// --- Animation Clock ---
export let clock = new THREE.Clock();

export let interpolationFactor = 0; // For smooth path transitions
export let currentPathPoint = new THREE.Vector3();
export let nextPathPoint = new THREE.Vector3();
export let lastWakeTime = 0;
export function setInterpolationFactor(factor) { interpolationFactor = factor; }
export function setLastWakeTime(time) { lastWakeTime = time; }

// --- UI State ---
export let allTiersSelected = true; // Start with all tiers selected
export function setAllTiersSelected(isSelected) { allTiersSelected = isSelected; }
