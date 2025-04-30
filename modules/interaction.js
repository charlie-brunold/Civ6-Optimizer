/**
 * interaction.js
 * Handles user interactions like mouse hover, tooltips, and keyboard panning.
 * Modified to include hovering effects on adjacent tiles based on row parity offset coordinates.
 * Map building moved to a separate function to be called after hexagons are created.
 */
import * as THREE from 'three';
import * as state from './state.js'; // Assuming state.js exports hexagons, camera, raycaster, mouse, controls, keys, setHoveredHexagon, hoveredHexagon, renderer
import { config } from './config.js'; // Assuming config.js exports panSpeed, hexHeight, highlightTopTiles etc.
import { formatTerrainName, formatFeatureName, formatResourceName, easeOutQuad, log, calculateElevation } from './utils.js'; // Assuming utils.js provides these

let tooltipElement = null; // Reference to the tooltip DOM element
let hexagonCoordMap = new Map(); // Map "x,y" string to hexagon mesh for quick lookup

// Store the currently affected hexagons (center + neighbors)
let currentlyAffectedHexagons = [];

/**
 * Initializes interaction handlers (attaches listeners).
 * Does NOT build the coordinate map anymore.
 */
export function initInteraction() {
    console.log("initInteraction: Attaching event listeners..."); // Use console.log for basic check
    tooltipElement = document.getElementById('tooltip');
    if (!tooltipElement) {
        console.warn("Tooltip element not found in DOM."); // Use console.warn
    }

    // --- Coordinate Map creation REMOVED from here ---

    if (state.renderer && state.renderer.domElement) {
        state.renderer.domElement.addEventListener('mousemove', onMouseMove);
        state.renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
        state.renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
        state.renderer.domElement.addEventListener('touchend', onTouchEnd);
        console.log("initInteraction: Mouse/Touch listeners attached."); // Use console.log
    } else {
        console.error("Error: Renderer not available for attaching interaction listeners."); // Use console.error
    }
    setupKeyboardControls();
}

/**
 * Builds the hexagon coordinate map.
 * MUST be called AFTER state.hexagons is populated.
 */
export function buildHexagonCoordMap() {
    console.log(`buildHexagonCoordMap: Building map from ${state.hexagons?.length ?? 0} hexagons...`); // Use console.log
    hexagonCoordMap.clear(); // Clear previous map if rebuilt

    if (!state.hexagons || state.hexagons.length === 0) {
        console.warn("buildHexagonCoordMap: Called with no hexagons in state.");
        return;
    }

    state.hexagons.forEach(hex => {
        if (hex.userData && hex.userData.tile) {
            const x = Number(hex.userData.tile.x);
            const y = Number(hex.userData.tile.y);
            if (!isNaN(x) && !isNaN(y)) {
                const coordString = `${x},${y}`;
                hexagonCoordMap.set(coordString, hex);
                hex.userData.coord = { q: x, r: y };
                // Initialize originalY here now that hexagons exist and positions should be set
                if (typeof hex.userData.originalY === 'undefined') {
                     hex.userData.originalY = hex.position.y;
                }
            } else {
                 console.warn("buildHexagonCoordMap: Hexagon found with invalid non-numeric tile coordinates.", hex.userData.tile);
            }
        } else {
             console.warn("buildHexagonCoordMap: Hexagon found without userData.tile during map creation.", hex);
        }
    });
    console.log(`buildHexagonCoordMap: Map created with ${hexagonCoordMap.size} entries.`); // Use console.log
}


// --- Helper Functions for Neighbors ---

/**
 * interaction.js (Partial - getNeighborCoords function updated)
 * Calculates the coordinates of all tiles within a dynamic radius
 * read from config, using offset coordinates based on row parity.
 * Excludes the center tile itself.
 */

/**
 * Calculates the coordinates of all tiles within a dynamic radius
 * (read from config.hoverRadius) from the center tile (q, r),
 * using offset coordinates based on row parity.
 * Excludes the center tile itself.
 *
 * @param {number} q - The column (x) coordinate of the center tile.
 * @param {number} r - The row (y) coordinate of the center tile.
 * @returns {Array<Array<number>>} An array of [q, r] coordinate pairs for tiles
 * within the configured radius (excluding the center).
 */
function getNeighborCoords(q, r) {
    q = Number(q);
    r = Number(r);
    if (isNaN(q) || isNaN(r)) {
        console.error("Error: Invalid center coordinates passed to getNeighborCoords", {q, r});
        return [];
    }

    const centerCoordString = `${q},${r}`;
    // **** Read radius from config ****
    const radius = config.hoverRadius;
    // ********************************

    // If radius is 0, return immediately (no neighbors needed)
    if (radius <= 0) {
        return [];
    }

    const queue = [[q, r, 0]]; // Queue stores [coord_q, coord_r, current_distance]
    const visited = new Set([centerCoordString]); // Keep track of visited coordinates as strings "q,r"
    const neighborsWithinRadius = []; // Store the coordinates [q, r] of neighbors found

    // Helper function to get direct neighbors based on row parity (using the fixed version)
    const getDirectNeighbors = (cq, cr) => {
        let direct_offsets;
        const isEvenRow = Number(cr) % 2 === 0;

        // Offsets based on the fixed row parity logic (swapped from original attempt)
        if (isEvenRow) {
             // Offsets for EVEN rows
            direct_offsets = [ [+1,  0], [+1, +1], [ 0, +1], [-1,  0], [ 0, -1], [+1, -1] ];
        } else {
            // Offsets for ODD rows
            direct_offsets = [ [+1,  0], [ 0, +1], [-1, +1], [-1,  0], [-1, -1], [ 0, -1] ];
        }

        const directNeighbors = [];
        direct_offsets.forEach(offset => {
            directNeighbors.push([Number(cq) + offset[0], Number(cr) + offset[1]]);
        });
        return directNeighbors;
    };

    // Breadth-First Search (BFS) up to the specified radius
    while (queue.length > 0) {
        const [currentQ, currentR, currentDist] = queue.shift(); // Get tile from the front of the queue

        // If we haven't reached the desired radius yet, explore neighbors
        if (currentDist < radius) {
            const directNeighbors = getDirectNeighbors(currentQ, currentR);

            directNeighbors.forEach(([neighborQ, neighborR]) => {
                const neighborCoordString = `${neighborQ},${neighborR}`;
                // If this neighbor hasn't been visited yet
                if (!visited.has(neighborCoordString)) {
                    visited.add(neighborCoordString); // Mark as visited
                    neighborsWithinRadius.push([neighborQ, neighborR]); // Add to results
                    queue.push([neighborQ, neighborR, currentDist + 1]); // Add to queue for further exploration
                }
            });
        }
    }

    // console.log(`Returning ${neighborsWithinRadius.length} neighbors within radius ${radius} for (${q}, ${r})`); // Optional debug log
    return neighborsWithinRadius; // Return all unique neighbors found within the radius (excluding center)
}

/**
 * Finds the hexagon mesh objects corresponding to neighbor coordinates.
 * Uses the pre-built hexagonCoordMap.
 * @param {THREE.Mesh} centerHex - The hexagon mesh whose neighbors are sought.
 * @returns {Array<THREE.Mesh>} An array of neighbor hexagon meshes.
 */
function getNeighborHexagons(centerHex) {
    const coords = centerHex?.userData?.coord;
    const tile = centerHex?.userData?.tile;

    if (!coords && !(tile && typeof tile.x !== 'undefined' && typeof tile.y !== 'undefined')) {
         console.warn("Warning: Cannot get neighbors for hex without coordinates.", centerHex); // Use console.warn
        return [];
    }

    const q = coords ? coords.q : Number(tile.x);
    const r = coords ? coords.r : Number(tile.y);

     if (isNaN(q) || isNaN(r)) {
        console.warn("Warning: Invalid coordinates found when getting neighbors.", {tile, coords}); // Use console.warn
        return [];
    }

    const neighborCoords = getNeighborCoords(q, r);
    const neighborHexes = [];

    neighborCoords.forEach(([nq, nr]) => {
        const coordString = `${nq},${nr}`;
        const neighborHex = hexagonCoordMap.get(coordString);
        if (neighborHex) {
            neighborHexes.push(neighborHex);
        }
    });
    return neighborHexes;
}

// --- End Helper Functions ---


/**
 * Creates the HTML content for the tooltip based on tile data.
 * @param {object} tile - The tile data object.
 * @returns {string} HTML string for the tooltip.
 */
function createTooltipContent(tile) {
    // (Content remains the same - ensure properties exist)
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

/**
 * Handles mouse movement events for raycasting and hover effects.
 * @param {MouseEvent} event - The mouse event object.
 */
function onMouseMove(event) {
    // console.log("onMouseMove triggered"); // Basic check that listener works
    updateMousePosition(event.clientX, event.clientY);
    handleRaycast();
}

// --- Touch Event Handlers (remain the same) ---
let lastTouch = null;

function onTouchStart(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        lastTouch = { x: touch.clientX, y: touch.clientY };
        updateMousePosition(touch.clientX, touch.clientY);
        handleRaycast(true);
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        lastTouch = { x: touch.clientX, y: touch.clientY };
    }
}

function onTouchEnd(event) {
    if (currentlyAffectedHexagons.length > 0) {
        currentlyAffectedHexagons.forEach(hex => resetHoveredHexagon(hex));
        currentlyAffectedHexagons = [];
        state.setHoveredHexagon(null);
        hideTooltip();
    }
    lastTouch = null;
}


/**
 * Updates the normalized mouse coordinates based on clientX/clientY.
 * @param {number} clientX - The client X coordinate.
 * @param {number} clientY - The client Y coordinate.
 */
function updateMousePosition(clientX, clientY) {
    if (!state.renderer || !state.renderer.domElement) return;
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    // console.log(`Mouse coords: (${state.mouse.x.toFixed(2)}, ${state.mouse.y.toFixed(2)})`); // Check mouse coords
}

/**
 * Performs raycasting and handles hover effects (center + neighbors) and tooltips.
 * @param {boolean} isTouchEvent - Flag to indicate if triggered by touch.
 */
function handleRaycast(isTouchEvent = false) {
    // Check if map is ready before raycasting
    if (!state.camera || !state.raycaster || !state.hexagons || state.hexagons.length === 0 || hexagonCoordMap.size === 0) {
        // console.log("handleRaycast: Skipping, prerequisites not met (camera, raycaster, hexagons, or coordMap missing/empty).");
        return;
    }
    // console.log(`handleRaycast: Running. Hexagons: ${state.hexagons.length}, Map Entries: ${hexagonCoordMap.size}`); // Check state before raycast

    state.raycaster.setFromCamera(state.mouse, state.camera);
    const intersects = state.raycaster.intersectObjects(state.hexagons, false);

    let newHoverTarget = null;
    if (intersects.length > 0 && intersects[0].object.userData?.isHexagon) {
        newHoverTarget = intersects[0].object;
    }

    // console.log(`Raycast hit: ${newHoverTarget ? `Hex (${newHoverTarget.userData?.tile?.x}, ${newHoverTarget.userData?.tile?.y})` : 'None'}`); // Use console.log

    if (newHoverTarget !== state.hoveredHexagon) {
        // console.log("Hover target changed."); // Use console.log

        currentlyAffectedHexagons.forEach(hex => {
            resetHoveredHexagon(hex);
        });
        currentlyAffectedHexagons = [];

        state.setHoveredHexagon(newHoverTarget);

        if (newHoverTarget) {
            // console.log(`Applying effect to target: (${newHoverTarget.userData?.tile?.x}, ${newHoverTarget.userData?.tile?.y})`); // Use console.log
            applyHoverEffect(newHoverTarget);
            currentlyAffectedHexagons.push(newHoverTarget);

            const neighbors = getNeighborHexagons(newHoverTarget);
            // console.log(`Found ${neighbors.length} neighbors.`); // Use console.log
            neighbors.forEach(neighbor => {
                // console.log(`Applying effect to neighbor: (${neighbor.userData?.tile?.x}, ${neighbor.userData?.tile?.y})`); // Use console.log
                if (neighbor !== newHoverTarget && !currentlyAffectedHexagons.includes(neighbor)) {
                     applyHoverEffect(neighbor);
                     currentlyAffectedHexagons.push(neighbor);
                }
            });

            showTooltip(newHoverTarget);

        } else {
            hideTooltip();
        }
    }
}


/**
 * Applies visual hover effect (raise, emissive color) to a SINGLE hexagon.
 * @param {THREE.Mesh} hex - The hexagon mesh to apply the effect to.
 */
function applyHoverEffect(hex) {
    if (!hex || !hex.userData) return;

    // OriginalY should be set by buildHexagonCoordMap now, but keep check as fallback.
    if (typeof hex.userData.originalY === 'undefined') {
        hex.userData.originalY = hex.position.y;
        console.warn(`Stored originalY=${hex.userData.originalY} late in applyHoverEffect for hex (${hex.userData.tile?.x}, ${hex.userData.tile?.y})`); // Use console.warn
    }

    if (isNaN(hex.userData.originalY) || (hex.userData.animating && hex.userData.animationTarget > hex.userData.originalY)) return;

    hex.userData.animating = true;
    hex.userData.animationStart = performance.now();
    hex.userData.animationStartY = hex.position.y;
    hex.userData.animationTarget = hex.userData.originalY + 0.3;

    const tile = hex.userData.tile;
    const isTopTierHighlighted = config.highlightTopTiles && tile && (tile.tier === 'S' || tile.tier === 'A');
    if (!isTopTierHighlighted) {
         if (hex.material && typeof hex.material.emissive?.setHex === 'function') {
            hex.material.emissive.setHex(0x555555);
            hex.material.emissiveIntensity = 0.5;
            hex.material.needsUpdate = true;
        }
    }
}

/**
 * Resets the visual state of a SINGLE previously hovered hexagon.
 * @param {THREE.Mesh} hex - The hexagon mesh to reset.
 */
function resetHoveredHexagon(hex) {
    if (!hex || !hex.userData) return;

    if (typeof hex.userData.originalY === 'undefined') {
        hex.userData.originalY = hex.position.y;
         console.warn(`Stored originalY=${hex.userData.originalY} late in resetHoveredHexagon for hex (${hex.userData.tile?.x}, ${hex.userData.tile?.y})`); // Use console.warn
    }

    if (isNaN(hex.userData.originalY) || (hex.userData.animating && hex.userData.animationTarget === hex.userData.originalY)) return;

    hex.userData.animating = true;
    hex.userData.animationStart = performance.now();
    hex.userData.animationStartY = hex.position.y;
    hex.userData.animationTarget = hex.userData.originalY;

    const tile = hex.userData.tile;
    const isTopTierHighlighted = config.highlightTopTiles && tile && (tile.tier === 'S' || tile.tier === 'A');
     if (!isTopTierHighlighted) {
        if (hex.material && typeof hex.material.emissive?.setHex === 'function') {
            hex.material.emissive.setHex(0x000000);
            hex.material.emissiveIntensity = 0;
            hex.material.needsUpdate = true;
        }
    }
}


/**
 * Shows and positions the tooltip for the hovered hexagon.
 * @param {THREE.Mesh} hex - The hovered hexagon mesh.
 */
function showTooltip(hex) {
    // (Function remains the same)
    if (!tooltipElement || !hex || !hex.userData || !hex.userData.tile) return;
    tooltipElement.innerHTML = createTooltipContent(hex.userData.tile);
    if (!state.camera || !state.renderer?.domElement) return;
    const screenPos = hex.position.clone();
    screenPos.project(state.camera);
    const rect = state.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const screenX = ((screenPos.x + 1) / 2) * rect.width + rect.left;
    const screenY = (-(screenPos.y - 1) / 2) * rect.height + rect.top;
    tooltipElement.style.left = `${screenX + 15}px`;
    tooltipElement.style.top = `${screenY + 15}px`;
    tooltipElement.style.visibility = 'visible';
    tooltipElement.style.opacity = '1';
}

/**
 * Hides the tooltip.
 */
function hideTooltip() {
    // (Function remains the same)
    if (tooltipElement) {
        tooltipElement.style.visibility = 'hidden';
        tooltipElement.style.opacity = '0';
    }
}

/**
 * Sets up keyboard event listeners for WASD panning.
 */
function setupKeyboardControls() {
    // (Function remains the same, but log uses console)
     window.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        const key = event.key.toLowerCase();
        if (key in state.keys) state.keys[key] = true;
    });

    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (key in state.keys) state.keys[key] = false;
    });
    console.log("Keyboard controls (WASD) set up."); // Use console.log
}

/**
 * Updates camera position based on currently pressed WASD keys.
 * Should be called within the animation loop.
 */
export function updateCameraPan() {
    // (Function remains the same)
    if (!state.camera || !state.controls) return;
    const isMoving = state.keys.w || state.keys.s || state.keys.a || state.keys.d;
    if (!isMoving) return;
    let forward = new THREE.Vector3();
    state.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    let moveDirection = new THREE.Vector3(0, 0, 0);
    if (state.keys.w) moveDirection.add(forward);
    if (state.keys.s) moveDirection.sub(forward);
    if (state.keys.a) moveDirection.sub(right);
    if (state.keys.d) moveDirection.add(right);
    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
        const speed = (config && typeof config.panSpeed === 'number') ? config.panSpeed : 0.1;
        moveDirection.multiplyScalar(speed);
        state.camera.position.add(moveDirection);
        state.controls.target.add(moveDirection);
    }
}

/**
 * Animates the hover effect (raising/lowering tiles).
 * Should be called within the animation loop.
 */
export function updateHoverAnimation() {
    // (Function remains largely the same, but log uses console)
     const currentTime = performance.now();
     state.hexagons.forEach(hex => {
         if (hex.userData?.animating) {
             const elapsed = currentTime - hex.userData.animationStart;
             const duration = 300;
             if (duration <= 0) { hex.userData.animating = false; return; }
             const progress = Math.min(elapsed / duration, 1.0);
             const easedProgress = easeOutQuad(progress);
             const startY = Number(hex.userData.animationStartY);
             const targetY = Number(hex.userData.animationTarget);
             const originalY = Number(hex.userData.originalY);

             if (isNaN(startY) || isNaN(targetY) || isNaN(originalY)) {
                 console.warn("Warning: Invalid animation Y values for hex.", hex.userData); // Use console.warn
                 hex.userData.animating = false;
                 return;
             }

             const previousY = hex.position.y;
             const newY = startY + (targetY - startY) * easedProgress;
             hex.position.y = newY;
             const deltaY = newY - previousY;

             if (hex.userData.tierLabel?.position) hex.userData.tierLabel.position.y += deltaY;
             if (hex.userData.histogramBar?.position) hex.userData.histogramBar.position.y += deltaY;

             if (progress >= 1.0) {
                 hex.userData.animating = false;
                 hex.position.y = targetY;
                 const elevation = (typeof calculateElevation === 'function' && hex.userData.tile) ? calculateElevation(hex.userData.tile) : 0;
                 const baseHeight = (config && typeof config.hexHeight === 'number') ? config.hexHeight : 0;
                 if (hex.userData.tierLabel?.position) hex.userData.tierLabel.position.y = targetY + baseHeight + elevation + 0.6;
                 if (hex.userData.histogramBar?.position) {
                      const barHeight = hex.userData.histogramBar.geometry?.parameters?.height || 0;
                      hex.userData.histogramBar.position.y = targetY + baseHeight + elevation + (barHeight / 2);
                 }
                 if (targetY === originalY && !currentlyAffectedHexagons.includes(hex)) {
                      resetHoveredHexagon(hex);
                 }
             }
         }
     });
 }
