/**
 * interaction.js
 * Handles user interactions like mouse hover, tooltips, and keyboard panning.
 */
import * as THREE from 'three';
import * as state from './state.js';
import { config } from './config.js';
// ***** Import calculateElevation from utils *****
import { formatTerrainName, formatFeatureName, formatResourceName, easeOutQuad, log, calculateElevation } from './utils.js'; // <--- Added calculateElevation here

let tooltipElement = null; // Reference to the tooltip DOM element

/**
 * Initializes interaction handlers.
 */
export function initInteraction() {
    tooltipElement = document.getElementById('tooltip'); // Get tooltip element once
    if (!tooltipElement) {
        log("Warning: Tooltip element not found in DOM.");
    }

    if (state.renderer && state.renderer.domElement) {
        state.renderer.domElement.addEventListener('mousemove', onMouseMove);
        // Add touch event listeners for mobile support (optional but recommended)
        state.renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
        state.renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
        state.renderer.domElement.addEventListener('touchend', onTouchEnd);
    } else {
        log("Error: Renderer not available for attaching interaction listeners.");
    }
    setupKeyboardControls();
}

/**
 * Creates the HTML content for the tooltip based on tile data.
 * @param {object} tile - The tile data object.
 * @returns {string} HTML string for the tooltip.
 */
function createTooltipContent(tile) {
    let html = `<h4>Tile (${tile.x}, ${tile.y})</h4>`;
    html += `<p><strong>Terrain:</strong> ${formatTerrainName(tile.terrain)}</p>`;
    if (tile.feature && tile.feature !== 'FEATURE_NONE') { // Assuming FEATURE_NONE or '' means no feature
        html += `<p><strong>Feature:</strong> ${formatFeatureName(tile.feature)}</p>`;
    }
    if (tile.resource) {
        html += `<p><strong>Resource:</strong> ${formatResourceName(tile.resource)} (${tile.resourcetype || 'Bonus'})</p>`;
    }
    if (tile.continent) {
        html += `<p><strong>Continent:</strong> ${tile.continent}</p>`;
    }
    if (tile.appeal !== null) {
        html += `<p><strong>Appeal:</strong> ${tile.appeal}</p>`;
    }
    if (tile.normalized_score !== null) {
        html += `<p><strong>Score:</strong> ${tile.normalized_score.toFixed(0)}</p>`; // Use toFixed(0) for integer display
    }
    if (tile.tier) {
        html += `<p><strong>Tier:</strong> ${tile.tier}</p>`;
    }
    return html;
}

/**
 * Handles mouse movement events for raycasting and hover effects.
 * @param {MouseEvent} event - The mouse event object.
 */
function onMouseMove(event) {
    updateMousePosition(event.clientX, event.clientY);
    handleRaycast();
}

// --- Touch Event Handlers ---
let lastTouch = null;

function onTouchStart(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        lastTouch = { x: touch.clientX, y: touch.clientY };
        updateMousePosition(touch.clientX, touch.clientY);
        handleRaycast(true); // Indicate it's a touch event start
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        // Optional: Implement drag/pan logic here if needed, instead of OrbitControls default
        lastTouch = { x: touch.clientX, y: touch.clientY };
        // Don't raycast on move for touch to avoid performance issues and accidental hovers
        // updateMousePosition(touch.clientX, touch.clientY);
        // handleRaycast();
    }
}

function onTouchEnd(event) {
     // If the touch didn't move much, treat it as a tap (optional, for selecting tiles)
     // For now, just clear the hover effect when touch ends
    if (state.hoveredHexagon) {
        resetHoveredHexagon();
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
}

/**
 * Performs raycasting and handles hover effects and tooltips.
 * @param {boolean} isTouchEvent - Flag to indicate if triggered by touch.
 */
function handleRaycast(isTouchEvent = false) {
    if (!state.camera || !state.raycaster || state.hexagons.length === 0) return;

    state.raycaster.setFromCamera(state.mouse, state.camera);
    // Only intersect with hexagon meshes
    const intersects = state.raycaster.intersectObjects(state.hexagons, false); // Non-recursive check

    let newHoverTarget = null;
    if (intersects.length > 0 && intersects[0].object.userData.isHexagon) {
        newHoverTarget = intersects[0].object;
    }

    // --- Handle Hover State Change ---
    if (newHoverTarget !== state.hoveredHexagon) {
        // Reset the previously hovered hexagon
        if (state.hoveredHexagon) {
            resetHoveredHexagon();
        }

        // Set the new hovered hexagon
        state.setHoveredHexagon(newHoverTarget);

        // Apply hover effect to the new hexagon
        if (state.hoveredHexagon) {
            applyHoverEffect(state.hoveredHexagon);
            showTooltip(state.hoveredHexagon);
        } else {
            hideTooltip();
        }
    }
}

/**
 * Applies visual hover effect (raise, emissive color) to a hexagon.
 * @param {THREE.Mesh} hex - The hexagon mesh to apply the effect to.
 */
function applyHoverEffect(hex) {
    if (!hex || !hex.userData) return;

    // Start animation to lift the tile
    hex.userData.animating = true;
    hex.userData.animationStart = performance.now();
    hex.userData.animationStartY = hex.position.y;
    // Lift slightly higher than original position
    hex.userData.animationTarget = hex.userData.originalY + 0.3; // Reduced lift amount

    // Set emissive color unless it's already highlighted by tier
    const tile = hex.userData.tile;
    const isTopTierHighlighted = config.highlightTopTiles && (tile.tier === 'S' || tile.tier === 'A');
    if (!isTopTierHighlighted) {
        hex.material.emissive.setHex(0x555555); // Subtle grey emissive
        hex.material.emissiveIntensity = 0.5;
    }
    hex.material.needsUpdate = true;
}

/**
 * Resets the visual state of a previously hovered hexagon.
 * @param {THREE.Mesh} [hex=state.hoveredHexagon] - The hexagon mesh to reset. Defaults to the currently hovered one.
 */
function resetHoveredHexagon(hex = state.hoveredHexagon) {
    if (!hex || !hex.userData) return;

    // Start animation to lower the tile back to original position
    hex.userData.animating = true;
    hex.userData.animationStart = performance.now();
    hex.userData.animationStartY = hex.position.y;
    hex.userData.animationTarget = hex.userData.originalY;

    // Reset emissive color only if it wasn't highlighted by tier
    const tile = hex.userData.tile;
    const isTopTierHighlighted = config.highlightTopTiles && (tile.tier === 'S' || tile.tier === 'A');
     if (!isTopTierHighlighted) {
        hex.material.emissive.setHex(0x000000);
        hex.material.emissiveIntensity = 0;
    }
    hex.material.needsUpdate = true;
}


/**
 * Shows and positions the tooltip for the hovered hexagon.
 * @param {THREE.Mesh} hex - The hovered hexagon mesh.
 */
function showTooltip(hex) {
    if (!tooltipElement || !hex || !hex.userData || !hex.userData.tile) return;

    tooltipElement.innerHTML = createTooltipContent(hex.userData.tile);

    // Convert 3D position to 2D screen coordinates
    const screenPos = hex.position.clone();
    screenPos.project(state.camera); // Project 3D point to NDC

    const rect = state.renderer.domElement.getBoundingClientRect();

    // Convert NDC (-1 to +1) to screen coordinates (pixels)
    const screenX = ((screenPos.x + 1) / 2) * rect.width + rect.left;
    const screenY = (-(screenPos.y - 1) / 2) * rect.height + rect.top;

    // Position tooltip slightly offset from the screen position
    tooltipElement.style.left = `${screenX + 15}px`;
    tooltipElement.style.top = `${screenY + 15}px`;
    tooltipElement.style.visibility = 'visible';
}

/**
 * Hides the tooltip.
 */
function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.visibility = 'hidden';
    }
}

/**
 * Sets up keyboard event listeners for WASD panning.
 */
function setupKeyboardControls() {
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (key in state.keys) state.keys[key] = true;
    });

    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (key in state.keys) state.keys[key] = false;
    });
    log("Keyboard controls (WASD) set up.");
}

/**
 * Updates camera position based on currently pressed WASD keys.
 * Should be called within the animation loop.
 */
export function updateCameraPan() {
    if (!state.camera || !state.controls) return;

    // Get camera's forward and right vectors, projected onto the XZ plane
    let forward = new THREE.Vector3();
    state.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // Calculate right vector based on the flattened forward vector
    let right = new THREE.Vector3().crossVectors(state.camera.up, forward).normalize();
     // Ensure right is also flat on XZ plane if up vector is standard (0,1,0)
     right.y = 0;
     right.normalize();


    // Calculate movement direction based on pressed keys
    let moveDirection = new THREE.Vector3(0, 0, 0);
    if (state.keys.w) moveDirection.add(forward);
    if (state.keys.s) moveDirection.sub(forward);
    if (state.keys.a) moveDirection.add(right); // Corrected: A moves left (negative right)
    if (state.keys.d) moveDirection.sub(right);  // Corrected: D moves right (positive right)

    if (moveDirection.lengthSq() > 0) { // Use lengthSq for efficiency
        moveDirection.normalize();
        moveDirection.multiplyScalar(config.panSpeed); // Use panSpeed from config

        // Apply movement to both camera position and controls target
        state.camera.position.add(moveDirection);
        state.controls.target.add(moveDirection);
        state.controls.update(); // Required after manually changing target
    }
}

/**
 * Animates the hover effect (raising/lowering tiles).
 * Should be called within the animation loop.
 */
export function updateHoverAnimation() {
     const currentTime = performance.now();
     state.hexagons.forEach(hex => {
         if (hex.userData?.animating) {
             const elapsed = currentTime - hex.userData.animationStart;
             const duration = 300; // Faster animation (300ms)
             const progress = Math.min(elapsed / duration, 1.0);
             const easedProgress = easeOutQuad(progress); // Use easing

             const previousY = hex.position.y;
             const newY = hex.userData.animationStartY +
                          (hex.userData.animationTarget - hex.userData.animationStartY) * easedProgress;
             hex.position.y = newY;
             const deltaY = newY - previousY;

             // Update associated label/bar positions if they exist
             if (hex.userData.tierLabel) hex.userData.tierLabel.position.y += deltaY;
             if (hex.userData.histogramBar) hex.userData.histogramBar.position.y += deltaY;


             if (progress >= 1.0) {
                 hex.userData.animating = false;
                 // Ensure final position is exact
                 hex.position.y = hex.userData.animationTarget;
                  // Recalculate final positions using calculateElevation now that it's imported
                  const elevation = calculateElevation(hex.userData.tile); // Use imported function
                  if (hex.userData.tierLabel) hex.userData.tierLabel.position.y = hex.userData.animationTarget + config.hexHeight + elevation + 0.6;
                  if (hex.userData.histogramBar) {
                       const barHeight = hex.userData.histogramBar.geometry.parameters.height;
                       hex.userData.histogramBar.position.y = hex.userData.animationTarget + config.hexHeight + elevation + (barHeight / 2);
                  }

                 // If the animation finished and it's no longer the hovered hex, ensure emissive is off
                 if (hex !== state.hoveredHexagon) {
                      resetHoveredHexagon(hex); // Call reset again to ensure emissive is correct
                 }
             }
         }
     });
 }
