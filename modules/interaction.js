/**
 * interaction.js
 * Handles user interactions like mouse hover, tooltips, keyboard panning,
 * and the Debug Mode functionality with opacity differentiation for outer ring.
 */
import * as THREE from 'three';
import * as state from './state.js'; // Assuming state.js exports hexagons, camera, raycaster, mouse, controls, keys, setHoveredHexagon, hoveredHexagon, renderer, resourceMarkers
import { config, DEBUG_CENTER_HIGHLIGHT_COLOR, DEBUG_CENTER_HIGHLIGHT_INTENSITY } from './config.js'; // Import new debug constants
import { formatTerrainName, formatFeatureName, formatResourceName, easeOutQuad, log, calculateElevation } from './utils.js';
// Import mapElements update function to restore view on exit
import { updateMapDisplay } from './mapElements.js';

let tooltipElement = null;
let hexagonCoordMap = new Map();
let currentlyAffectedHexagons = []; // For hover effect

// --- Debug Mode State ---
let isDebugModeActive = false; // Is the mode currently active (tile clicked)?
let debugModeCenterHex = null; // The hexagon mesh that was clicked to enter debug mode
let debugModeVisibleSet = new Set(); // Set of hexagon meshes visible in debug mode (all rings)
let debugModeWorkableSet = new Set(); // Set of hexagon meshes in the inner (workable) rings
let debugModeOuterRingSet = new Set(); // Set of hexagon meshes ONLY in the outer ring
let debugModeOverlayElement = null; // Reference to the overlay DOM element
const DEBUG_OUTER_RING_OPACITY = 0.4; // Opacity for the outer ring tiles
const DEBUG_WORKABLE_RADIUS = 3; // Standard Civ workable radius
// ------------------------

/**
 * Initializes interaction handlers (attaches listeners).
 */
export function initInteraction() {
    // (Function remains the same as previous version)
    console.log("initInteraction: Attaching event listeners...");
    tooltipElement = document.getElementById('tooltip');
    debugModeOverlayElement = document.getElementById('debug-mode-overlay');
    if (!tooltipElement) console.warn("Tooltip element not found in DOM.");
    if (!debugModeOverlayElement) console.warn("Debug mode overlay element not found in DOM.");
    if (state.renderer && state.renderer.domElement) {
        const canvas = state.renderer.domElement;
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd);
        canvas.addEventListener('click', onCanvasClick);
        console.log("initInteraction: Mouse/Touch/Click listeners attached.");
    } else { console.error("Error: Renderer not available for attaching interaction listeners."); }
    setupKeyboardControls();
}

/**
 * Builds the hexagon coordinate map.
 */
export function buildHexagonCoordMap() {
    // (Function remains the same as previous version)
    console.log(`buildHexagonCoordMap: Building map from ${state.hexagons?.length ?? 0} hexagons...`);
    hexagonCoordMap.clear();
    if (!state.hexagons || state.hexagons.length === 0) { console.warn("buildHexagonCoordMap: Called with no hexagons in state."); return; }
    state.hexagons.forEach(hex => {
        if (hex.userData && hex.userData.tile) {
            const x = Number(hex.userData.tile.x);
            const y = Number(hex.userData.tile.y);
            if (!isNaN(x) && !isNaN(y)) {
                const coordString = `${x},${y}`;
                hexagonCoordMap.set(coordString, hex);
                hex.userData.coord = { q: x, r: y };
                if (typeof hex.userData.originalY === 'undefined') { hex.userData.originalY = hex.position.y; }
            } else { console.warn("buildHexagonCoordMap: Hexagon found with invalid non-numeric tile coordinates.", hex.userData.tile); }
        } else { console.warn("buildHexagonCoordMap: Hexagon found without userData.tile during map creation.", hex); }
    });
    console.log(`buildHexagonCoordMap: Map created with ${hexagonCoordMap.size} entries.`);
}


// --- Helper Functions ---

/**
 * Calculates the coordinates of all tiles within a given radius
 * from the center tile (q, r), using offset coordinates based on row parity.
 * Includes the center tile itself.
 */
function getCoordsWithinRadius(q, r, radius) {
    // (Function remains the same as previous version)
    q = Number(q); r = Number(r);
    if (isNaN(q) || isNaN(r)) { console.error("Error: Invalid center coordinates passed to getCoordsWithinRadius", {q, r}); return []; }
    const centerCoordString = `${q},${r}`;
    const results = [[q, r]];
    if (radius <= 0) return results;
    const queue = [[q, r, 0]];
    const visited = new Set([centerCoordString]);
    const getDirectNeighbors = (cq, cr) => {
        let direct_offsets; const isEvenRow = Number(cr) % 2 === 0;
        if (isEvenRow) { direct_offsets = [ [+1,  0], [+1, +1], [ 0, +1], [-1,  0], [ 0, -1], [+1, -1] ]; }
        else { direct_offsets = [ [+1,  0], [ 0, +1], [-1, +1], [-1,  0], [-1, -1], [ 0, -1] ]; }
        const directNeighbors = []; direct_offsets.forEach(offset => { directNeighbors.push([Number(cq) + offset[0], Number(cr) + offset[1]]); }); return directNeighbors;
    };
    while (queue.length > 0) {
        const [currentQ, currentR, currentDist] = queue.shift();
        if (currentDist < radius) {
            const directNeighbors = getDirectNeighbors(currentQ, currentR);
            directNeighbors.forEach(([neighborQ, neighborR]) => {
                const neighborCoordString = `${neighborQ},${neighborR}`;
                if (!visited.has(neighborCoordString)) { visited.add(neighborCoordString); results.push([neighborQ, neighborR]); queue.push([neighborQ, neighborR, currentDist + 1]); }
            });
        }
    }
    return results;
}


/**
 * Calculates neighbor coordinates for the hover effect based on config.hoverRadius.
 * Excludes the center tile.
 * **MODIFIED:** Returns empty array if in debug mode (hover radius becomes 0).
 */
function getNeighborCoords(q, r) {
    // **** If debug mode is active, force hover radius 0 ****
    if (isDebugModeActive) {
        return [];
    }
    // ******************************************************

    // Normal operation: use configured hover radius
    const radius = config.hoverRadius;
    const coordsWithCenter = getCoordsWithinRadius(q, r, radius);
    // Filter out the center coordinate
    return coordsWithCenter.filter(([nq, nr]) => !(nq === q && nr === r));
}

/**
 * Finds the hexagon mesh objects corresponding to neighbor coordinates for hover.
 * Uses the updated getNeighborCoords function.
 */
function getNeighborHexagons(centerHex) {
    // (Function remains the same as previous version - uses updated getNeighborCoords)
    const coords = centerHex?.userData?.coord; const tile = centerHex?.userData?.tile;
    if (!coords && !(tile && typeof tile.x !== 'undefined' && typeof tile.y !== 'undefined')) { console.warn("Warning: Cannot get neighbors for hex without coordinates.", centerHex); return []; }
    const q = coords ? coords.q : Number(tile.x); const r = coords ? coords.r : Number(tile.y);
     if (isNaN(q) || isNaN(r)) { console.warn("Warning: Invalid coordinates found when getting neighbors.", {tile, coords}); return []; }
    const neighborCoords = getNeighborCoords(q, r); // This now returns [] in debug mode
    const neighborHexes = [];
    neighborCoords.forEach(([nq, nr]) => { const coordString = `${nq},${nr}`; const neighborHex = hexagonCoordMap.get(coordString); if (neighborHex) { neighborHexes.push(neighborHex); } });
    return neighborHexes;
}


/**
 * Finds hexagon meshes within a specific radius.
 */
function getHexagonsWithinRadius(centerHex, radius) {
    // (Function remains the same as previous version)
    const results = new Set();
    if (!centerHex || !centerHex.userData?.coord) { console.warn("Cannot get hexagons in radius: Invalid centerHex."); return results; }
    const { q, r } = centerHex.userData.coord;
    const coordsToFind = getCoordsWithinRadius(q, r, radius);
    coordsToFind.forEach(([nq, nr]) => { const coordString = `${nq},${nr}`; const hex = hexagonCoordMap.get(coordString); if (hex) { results.add(hex); } });
    return results;
}

// --- End Helper Functions ---


/** Creates the HTML content for the tooltip. */
function createTooltipContent(tile) {
    // (Function remains the same as previous version)
    if (!tile) return '<span>No tile data</span>';
    let html = `<h4>Tile (${tile.x ?? 'N/A'}, ${tile.y ?? 'N/A'})</h4>`;
    if (tile.terrain) html += `<p><strong>Terrain:</strong> ${formatTerrainName(tile.terrain)}</p>`;
    if (tile.feature && tile.feature !== 'FEATURE_NONE') html += `<p><strong>Feature:</strong> ${formatFeatureName(tile.feature)}</p>`;
    if (tile.resource) html += `<p><strong>Resource:</strong> ${formatResourceName(tile.resource)} (${tile.resourcetype || 'Bonus'})</p>`;
    if (tile.continent) html += `<p><strong>Continent:</strong> ${tile.continent}</p>`;
    if (tile.appeal !== null && typeof tile.appeal !== 'undefined') html += `<p><strong>Appeal:</strong> ${tile.appeal}</p>`;
    if (tile.normalized_score !== null && typeof tile.normalized_score !== 'undefined') html += `<p><strong>Score:</strong> ${Number(tile.normalized_score).toFixed(0)}</p>`;
    if (tile.tier) html += `<p><strong>Tier:</strong> ${tile.tier}</p>`;
    return html;
}

/** Handles mouse movement events for raycasting and hover effects. */
function onMouseMove(event) {
    // (Function remains the same as previous version)
    updateMousePosition(event.clientX, event.clientY);
    handleRaycast();
}

// --- Touch Event Handlers ---
let lastTouch = null;
function onTouchStart(event) {
    // (Function remains the same as previous version)
    if (event.touches.length === 1) { const touch = event.touches[0]; lastTouch = { x: touch.clientX, y: touch.clientY }; updateMousePosition(touch.clientX, touch.clientY); handleRaycast(true); }
}
function onTouchMove(event) {
    // (Function remains the same as previous version)
    if (event.touches.length === 1) { const touch = event.touches[0]; lastTouch = { x: touch.clientX, y: touch.clientY }; updateMousePosition(touch.clientX, touch.clientY); handleRaycast(true); }
}
function onTouchEnd(event) {
    // (Function remains the same as previous version)
    if (currentlyAffectedHexagons.length > 0) { currentlyAffectedHexagons.forEach(hex => resetHoveredHexagon(hex)); currentlyAffectedHexagons = []; state.setHoveredHexagon(null); hideTooltip(); }
    lastTouch = null;
}


/** Updates the normalized mouse coordinates. */
function updateMousePosition(clientX, clientY) {
    // (Function remains the same as previous version)
    if (!state.renderer || !state.renderer.domElement) return;
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

// --- Debug Mode Logic ---

/** Handles clicks on the canvas, potentially entering Debug Mode. */
function onCanvasClick(event) {
    // (Function remains the same as previous version)
    if (!config.isDebugModeEnabled || isDebugModeActive) return;
    if (!state.camera || !state.raycaster || !state.hexagons || state.hexagons.length === 0) return;
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const intersects = state.raycaster.intersectObjects(state.hexagons, false);
    let clickedHex = null;
    if (intersects.length > 0 && intersects[0].object.userData?.isHexagon) { clickedHex = intersects[0].object; }
    if (clickedHex) { enterDebugMode(clickedHex); }
}

/** Enters Debug Mode, focusing on the clicked hexagon. */
function enterDebugMode(centerHex) {
    console.log(`Entering Debug Mode, centered on (${centerHex.userData?.coord?.q}, ${centerHex.userData?.coord?.r})`);
    isDebugModeActive = true;
    debugModeCenterHex = centerHex;

    // **** MODIFIED: Calculate full radius based on WORKABLE radius + 1 ****
    const fullRadius = DEBUG_WORKABLE_RADIUS + 1; // Always show workable + 1 outer ring
    // *********************************************************************
    debugModeVisibleSet = getHexagonsWithinRadius(centerHex, fullRadius);

    // Calculate hexagons for the inner "workable" radius (still hardcoded)
    debugModeWorkableSet = getHexagonsWithinRadius(centerHex, DEBUG_WORKABLE_RADIUS);

    // Calculate the outer ring set (in full radius but not in workable radius)
    debugModeOuterRingSet = new Set([...debugModeVisibleSet].filter(hex => !debugModeWorkableSet.has(hex)));

    // Hide all elements initially
    state.hexagons.forEach(hex => {
        hex.visible = false;
        if (hex.material) { // Reset opacity/transparency before setting visibility
             hex.material.opacity = 1.0;
             hex.material.transparent = false;
             hex.material.needsUpdate = true;
        }
        if (hex.userData.tierLabel) hex.userData.tierLabel.visible = false;
    });
    if (state.resourceMarkers) {
        state.resourceMarkers.forEach(marker => { marker.visible = false; });
    }

    // Set visibility and opacity for the debug sets
    debugModeWorkableSet.forEach(hex => {
        hex.visible = true;
        if (hex.material) {
            hex.material.opacity = 1.0;
            hex.material.transparent = false;
            hex.material.needsUpdate = true;
        }
        // Show label only for workable set (respecting config)
        if (hex.userData.tierLabel && config.showTierLabels) {
            hex.userData.tierLabel.visible = true;
        }
    });

    debugModeOuterRingSet.forEach(hex => {
        hex.visible = true;
        if (hex.material) {
            hex.material.opacity = DEBUG_OUTER_RING_OPACITY;
            hex.material.transparent = true; // Outer ring is transparent
            hex.material.needsUpdate = true;
        }
        // Labels remain hidden for the outer ring
        if (hex.userData.tierLabel) {
             hex.userData.tierLabel.visible = false;
        }
    });

    // Apply special highlight to the center tile
    if (debugModeCenterHex.material && typeof debugModeCenterHex.material.emissive?.setHex === 'function') {
        debugModeCenterHex.userData.wasDebugHighlighted = true;
        debugModeCenterHex.material.emissive.setHex(DEBUG_CENTER_HIGHLIGHT_COLOR);
        debugModeCenterHex.material.emissiveIntensity = DEBUG_CENTER_HIGHLIGHT_INTENSITY;
        // Ensure center is fully opaque even if it falls in outer ring logic somehow
        debugModeCenterHex.material.opacity = 1.0;
        debugModeCenterHex.material.transparent = false;
        debugModeCenterHex.material.needsUpdate = true;
    }

    // Show the overlay message
    if (debugModeOverlayElement) {
        debugModeOverlayElement.style.display = 'block';
    }

    // Reset any active hover effects
    if (currentlyAffectedHexagons.length > 0) {
        currentlyAffectedHexagons.forEach(hex => resetHoveredHexagon(hex));
        currentlyAffectedHexagons = [];
        state.setHoveredHexagon(null);
        hideTooltip();
    }
}

/** Exits Debug Mode and restores the normal view. */
export function exitDebugMode() {
    // (Function remains the same as previous version)
    if (!isDebugModeActive) return;
    console.log("Exiting Debug Mode.");
    isDebugModeActive = false;
    if (debugModeCenterHex && debugModeCenterHex.userData.wasDebugHighlighted) {
         if (debugModeCenterHex.material && typeof debugModeCenterHex.material.emissive?.setHex === 'function') {
            debugModeCenterHex.material.emissive.setHex(0x000000);
            debugModeCenterHex.material.emissiveIntensity = 0;
        }
        delete debugModeCenterHex.userData.wasDebugHighlighted;
    }
    if (debugModeOverlayElement) { debugModeOverlayElement.style.display = 'none'; }
    debugModeCenterHex = null;
    debugModeVisibleSet.clear();
    debugModeWorkableSet.clear();
    debugModeOuterRingSet.clear();
    console.log("Restoring map display...");
    updateMapDisplay();
     if (currentlyAffectedHexagons.length > 0) {
        currentlyAffectedHexagons.forEach(hex => resetHoveredHexagon(hex));
        currentlyAffectedHexagons = [];
        state.setHoveredHexagon(null);
        hideTooltip();
    }
}

/** Handles the Escape key press to exit Debug Mode. */
function onEscapeKey(event) {
    // (Function remains the same as previous version)
    if (event.key === 'Escape' && isDebugModeActive) {
        exitDebugMode();
    }
}

// --- End Debug Mode Logic ---


/**
 * Performs raycasting and handles hover effects.
 * Modified to respect Debug Mode visibility.
 */
function handleRaycast(isTouchEvent = false) {
    // (Function remains the same as previous version)
    if (!state.camera || !state.raycaster || !state.hexagons || state.hexagons.length === 0 || hexagonCoordMap.size === 0) return;
    state.raycaster.setFromCamera(state.mouse, state.camera);
    let objectsToIntersect = isDebugModeActive ? Array.from(debugModeVisibleSet) : state.hexagons;
    if (objectsToIntersect.length === 0) {
         if (state.hoveredHexagon) { currentlyAffectedHexagons.forEach(hex => resetHoveredHexagon(hex)); currentlyAffectedHexagons = []; state.setHoveredHexagon(null); hideTooltip(); }
        return;
    }
    const intersects = state.raycaster.intersectObjects(objectsToIntersect, false);
    let newHoverTarget = null;
    if (intersects.length > 0 && intersects[0].object.userData?.isHexagon && intersects[0].object.visible) {
         newHoverTarget = intersects[0].object;
    }
    if (newHoverTarget !== state.hoveredHexagon) {
        currentlyAffectedHexagons.forEach(hex => { if (!isDebugModeActive || hex !== debugModeCenterHex) { resetHoveredHexagon(hex); } });
        currentlyAffectedHexagons = [];
        state.setHoveredHexagon(newHoverTarget);
        if (newHoverTarget) {
             if (!isDebugModeActive || newHoverTarget !== debugModeCenterHex) { applyHoverEffect(newHoverTarget); }
            currentlyAffectedHexagons.push(newHoverTarget);
            // getNeighborHexagons now returns [] in debug mode, so loop is skipped
            const neighbors = getNeighborHexagons(newHoverTarget);
            neighbors.forEach(neighbor => {
                 if (neighbor.visible && neighbor !== newHoverTarget && !currentlyAffectedHexagons.includes(neighbor)) {
                    if (!isDebugModeActive || neighbor !== debugModeCenterHex) { applyHoverEffect(neighbor); }
                    currentlyAffectedHexagons.push(neighbor);
                }
            });
            showTooltip(newHoverTarget);
        } else { hideTooltip(); }
    }
}


/** Applies visual hover effect (raise, emissive color). */
function applyHoverEffect(hex) {
    // (Function remains the same as previous version)
    if (!hex || !hex.userData) return;
    if (typeof hex.userData.originalY === 'undefined') { hex.userData.originalY = hex.position.y; console.warn(`Stored originalY=${hex.userData.originalY} late in applyHoverEffect for hex (${hex.userData.tile?.x}, ${hex.userData.tile?.y})`); }
    if (isNaN(hex.userData.originalY) || (hex.userData.animating && hex.userData.animationTarget > hex.userData.originalY)) return;
    hex.userData.animating = true;
    hex.userData.animationStart = performance.now();
    hex.userData.animationStartY = hex.position.y;
    hex.userData.animationTarget = hex.userData.originalY + 0.3;
    const tile = hex.userData.tile;
    const isTopTierHighlighted = config.highlightTopTiles && tile && (tile.tier === 'S' || tile.tier === 'A');
    const isDebugCenter = isDebugModeActive && hex === debugModeCenterHex;
    if (!isTopTierHighlighted && !isDebugCenter) {
         if (hex.material && typeof hex.material.emissive?.setHex === 'function') { hex.material.emissive.setHex(0x555555); hex.material.emissiveIntensity = 0.5; hex.material.needsUpdate = true; }
    }
}

/** Resets the visual state of a previously hovered hexagon. */
function resetHoveredHexagon(hex) {
    // (Function remains the same as previous version)
    if (!hex || !hex.userData) return;
    if (typeof hex.userData.originalY === 'undefined') { hex.userData.originalY = hex.position.y; console.warn(`Stored originalY=${hex.userData.originalY} late in resetHoveredHexagon for hex (${hex.userData.tile?.x}, ${hex.userData.tile?.y})`); }
    if (isNaN(hex.userData.originalY) || (hex.userData.animating && hex.userData.animationTarget === hex.userData.originalY)) return;
    hex.userData.animating = true;
    hex.userData.animationStart = performance.now();
    hex.userData.animationStartY = hex.position.y;
    hex.userData.animationTarget = hex.userData.originalY;
    const tile = hex.userData.tile;
    const isTopTierHighlighted = config.highlightTopTiles && tile && (tile.tier === 'S' || tile.tier === 'A');
    const isDebugCenter = isDebugModeActive && hex === debugModeCenterHex;
    if (!isTopTierHighlighted && !isDebugCenter) {
        if (hex.material && typeof hex.material.emissive?.setHex === 'function') { hex.material.emissive.setHex(0x000000); hex.material.emissiveIntensity = 0; hex.material.needsUpdate = true; }
    } else if (isDebugCenter) {
         if (hex.material && typeof hex.material.emissive?.setHex === 'function') { hex.material.emissive.setHex(DEBUG_CENTER_HIGHLIGHT_COLOR); hex.material.emissiveIntensity = DEBUG_CENTER_HIGHLIGHT_INTENSITY; hex.material.needsUpdate = true; }
    }
}


/** Shows and positions the tooltip. */
function showTooltip(hex) {
    // (Function remains the same as previous version)
    if (!tooltipElement || !hex || !hex.userData || !hex.userData.tile) return;
    tooltipElement.innerHTML = createTooltipContent(hex.userData.tile);
    if (!state.camera || !state.renderer?.domElement) return;
    const screenPos = hex.position.clone(); screenPos.project(state.camera);
    const rect = state.renderer.domElement.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return;
    const screenX = ((screenPos.x + 1) / 2) * rect.width + rect.left; const screenY = (-(screenPos.y - 1) / 2) * rect.height + rect.top;
    tooltipElement.style.left = `${screenX + 15}px`; tooltipElement.style.top = `${screenY + 15}px`;
    tooltipElement.style.visibility = 'visible'; tooltipElement.style.opacity = '1';
}

/** Hides the tooltip. */
function hideTooltip() {
    // (Function remains the same as previous version)
    if (tooltipElement) { tooltipElement.style.visibility = 'hidden'; tooltipElement.style.opacity = '0'; }
}

/** Sets up keyboard event listeners (WASD and ESC). */
function setupKeyboardControls() {
    // (Function remains the same as previous version)
    window.addEventListener('keydown', onEscapeKey);
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape') return; if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return; const key = event.key.toLowerCase(); if (key in state.keys) state.keys[key] = true; });
    window.addEventListener('keyup', (event) => { if (event.key === 'Escape') return; const key = event.key.toLowerCase(); if (key in state.keys) state.keys[key] = false; });
    console.log("Keyboard controls (WASD & ESC) set up.");
}

/** Updates camera position based on WASD keys. */
export function updateCameraPan() {
    // (Function remains the same as previous version - camera movement allowed)
    if (!state.camera || !state.controls) return;
    const isMoving = state.keys.w || state.keys.s || state.keys.a || state.keys.d; if (!isMoving) return;
    let forward = new THREE.Vector3(); state.camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const worldUp = new THREE.Vector3(0, 1, 0); let right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    let moveDirection = new THREE.Vector3(0, 0, 0);
    if (state.keys.w) moveDirection.add(forward); if (state.keys.s) moveDirection.sub(forward);
    if (state.keys.a) moveDirection.sub(right); if (state.keys.d) moveDirection.add(right);
    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize(); const speed = (config && typeof config.panSpeed === 'number') ? config.panSpeed : 0.1;
        moveDirection.multiplyScalar(speed); state.camera.position.add(moveDirection); state.controls.target.add(moveDirection);
    }
}

/** Animates the hover effect (raising/lowering tiles). */
export function updateHoverAnimation() {
    // (Function remains the same as previous version)
     const currentTime = performance.now(); const hexesToCheck = isDebugModeActive ? Array.from(debugModeVisibleSet) : state.hexagons;
     hexesToCheck.forEach(hex => {
         if (hex.userData?.animating) {
             const elapsed = currentTime - hex.userData.animationStart; const duration = 300; if (duration <= 0) { hex.userData.animating = false; return; }
             const progress = Math.min(elapsed / duration, 1.0); const easedProgress = easeOutQuad(progress);
             const startY = Number(hex.userData.animationStartY); const targetY = Number(hex.userData.animationTarget); const originalY = Number(hex.userData.originalY);
             if (isNaN(startY) || isNaN(targetY) || isNaN(originalY)) { console.warn("Warning: Invalid animation Y values for hex.", hex.userData); hex.userData.animating = false; return; }
             const previousY = hex.position.y; const newY = startY + (targetY - startY) * easedProgress; hex.position.y = newY; const deltaY = newY - previousY;
             if (hex.userData.tierLabel?.position) hex.userData.tierLabel.position.y += deltaY; if (hex.userData.histogramBar?.position) hex.userData.histogramBar.position.y += deltaY;
             if (progress >= 1.0) {
                 hex.userData.animating = false; hex.position.y = targetY;
                 const elevation = (typeof calculateElevation === 'function' && hex.userData.tile) ? calculateElevation(hex.userData.tile) : 0; const baseHeight = (config && typeof config.hexHeight === 'number') ? config.hexHeight : 0;
                 if (hex.userData.tierLabel?.position) hex.userData.tierLabel.position.y = targetY + baseHeight + elevation + 0.6;
                 if (hex.userData.histogramBar?.position) { const barHeight = hex.userData.histogramBar.geometry?.parameters?.height || 0; hex.userData.histogramBar.position.y = targetY + baseHeight + elevation + (barHeight / 2); }
                 if (targetY === originalY && !currentlyAffectedHexagons.includes(hex)) { if (!isDebugModeActive || hex !== debugModeCenterHex) { resetHoveredHexagon(hex); } }
             }
         }
     });
 }
