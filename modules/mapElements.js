/**
 * mapElements.js
 * Functions for creating and managing map visualization elements (hexagons, markers, labels).
 */
import * as THREE from 'three';
import * as state from './state.js';
import { config, terrainColors, resourceStyles, tierStyles, defaultColor, heatmapColors, heatmapNeutralColor } from './config.js';
import { calculateElevation, log } from './utils.js';

/**
 * Creates a beveled hexagon geometry.
 * (No changes needed)
 */
function createBeveledHexagonGeometry(radius, height, bevelSize = 0.02) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 2;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    shape.closePath();
    const extrudeSettings = { steps: 1, depth: height, bevelEnabled: true, bevelThickness: bevelSize, bevelSize: bevelSize, bevelOffset: 0, bevelSegments: 1 };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
}

/**
 * Creates a mesh for a single hexagon tile using FLAT-TOPPED layout.
 * (No changes needed)
 */
function createHexagonMesh(tile) {
    const elevation = calculateElevation(tile);
    const hexHeightWithElevation = Math.max(0.05, config.hexHeight + elevation);
    const visualRadiusScale = 0.98;
    const visualRadius = config.hexRadius * visualRadiusScale;
    const visualBevelSize = 0.02 * visualRadiusScale;
    const geometry = createBeveledHexagonGeometry(visualRadius, hexHeightWithElevation, visualBevelSize);
    const terrainColor = terrainColors[tile.terrain] || defaultColor;
    const originalColor = new THREE.Color(terrainColor);
    const material = new THREE.MeshStandardMaterial({
        color: originalColor,
        metalness: 0.1,
        roughness: 0.8,
        flatShading: false,
        transparent: true, // Enable transparency for opacity changes
        opacity: 1.0
     });
    const mesh = new THREE.Mesh(geometry, material);

    // Positioning logic...
    const gridWidth = state.mapData.metadata.max_x - state.mapData.metadata.min_x;
    const gridHeight = state.mapData.metadata.max_y - state.mapData.metadata.min_y;
    const col = tile.x - state.mapData.metadata.min_x;
    const row = gridHeight - (tile.y - state.mapData.metadata.min_y);
    const hexWidth = Math.sqrt(3) * config.hexRadius;
    const hexHeight = 2 * config.hexRadius;
    let xPos = col * hexWidth;
    let zPos = row * (hexHeight * 0.75);
    if (row % 2 !== 0) xPos += hexWidth / 2;
    const totalWidth = gridWidth * hexWidth;
    const totalHeight = gridHeight * (hexHeight * 0.75);
    xPos -= totalWidth / 2;
    zPos -= totalHeight / 2;
    const yPos = isOceanOrCoast(tile) ? elevation : 0; // Use helper
    mesh.position.set(xPos, yPos, zPos);

    // Store reference to tile, original color, and initial Y position
    mesh.userData = {
        tile: tile, // Reference to the tile data object (which will be updated)
        originalY: yPos,
        originalColor: originalColor, // Store the base terrain color
        isHexagon: true,
        tierLabel: null // Placeholder for label reference
    };
    return mesh;
}


/**
 * Creates a sphere mesh to mark a resource on a tile.
 * (No changes needed)
 */
function createResourceMarker(tile, position) {
    const resourceType = tile.resourcetype || 'default';
    const style = resourceStyles[resourceType] || resourceStyles.default;
    const geometry = new THREE.SphereGeometry(style.size, 12, 12);
    const material = new THREE.MeshBasicMaterial({ color: style.color });
    const marker = new THREE.Mesh(geometry, material);
    const elevation = calculateElevation(tile);
    marker.position.set(position.x, position.y + config.hexHeight + elevation + 0.3, position.z);
    marker.userData = { tile: tile, isMarker: true }; // Link marker to tile data
    return marker;
}

/**
 * Creates the texture for a tier label sprite based on the current tier.
 * @param {string | null} tier - The tier ('S', 'A', etc.) or null.
 * @returns {THREE.CanvasTexture | null} The generated texture or null if no tier/style.
 */
function createTierLabelTexture(tier) {
    if (!tier) return null; // No tier, no texture

    const style = tierStyles[tier];
    if (!style) {
        log(`Warning: No style defined for tier "${tier}"`);
        return null; // No style defined for this tier
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const size = 64; // Texture size
    canvas.width = size;
    canvas.height = size;

    // Draw background circle
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.4, 0, 2 * Math.PI); // Slightly smaller radius
    context.fillStyle = style.color; // Use color from config
    context.fill();

    // Draw tier text
    context.font = `bold ${size * 0.5}px Arial`; // Adjust font size if needed
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = style.textColor; // Use text color from config
    context.fillText(tier, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}


/**
 * Creates or updates a text sprite label for the tile's tier.
 * If a sprite is passed, it updates its material. Otherwise, it creates a new sprite.
 * @param {object} tile - The tile data object containing the tier.
 * @param {THREE.Vector3} position - The base position for the label.
 * @param {THREE.Sprite | null} existingSprite - Optional existing sprite to update.
 * @returns {THREE.Sprite | null} The created or updated sprite, or null if no tier/style.
 */
function createOrUpdateTierLabel(tile, position, existingSprite = null) {
    const newTexture = createTierLabelTexture(tile.tier); // Use the updated tier from the tile object

    if (!newTexture) {
        // If there's no new texture (e.g., tier became null or invalid)
        // and an old sprite exists, make it invisible or remove it.
        if (existingSprite) {
            existingSprite.visible = false;
            // Optionally dispose old texture/material here if removing permanently
            // if (existingSprite.material.map) existingSprite.material.map.dispose();
            // if (existingSprite.material) existingSprite.material.dispose();
        }
        return null; // No label to show/create
    }

    const elevation = calculateElevation(tile);
    const labelY = position.y + config.hexHeight + elevation + 0.6; // Calculate Y based on current elevation

    if (existingSprite) {
        // Update existing sprite
        // Dispose the old map texture before assigning the new one
        if (existingSprite.material.map) {
            existingSprite.material.map.dispose();
        }
        existingSprite.material.map = newTexture;
        existingSprite.material.needsUpdate = true;
        existingSprite.position.y = labelY; // Update position in case elevation changed
        existingSprite.userData.tier = tile.tier; // Update stored tier
        existingSprite.visible = true; // Ensure it's visible
        return existingSprite;
    } else {
        // Create new sprite
        const material = new THREE.SpriteMaterial({ map: newTexture, sizeAttenuation: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(position.x, labelY, position.z);
        sprite.scale.set(0.6, 0.6, 1); // Set desired scale
        sprite.userData = {
            tile: tile, // Link back to the tile data
            tier: tile.tier, // Store the current tier
            tileX: tile.x,
            tileY: tile.y,
            isLabel: true
        };
        return sprite;
    }
}


/**
 * Removes all map-related objects from the scene and clears state arrays.
 * (No changes needed)
 */
export function clearMapElements() {
    log("Clearing map elements...");
    if (!state.scene) return;
    // Include potential labels associated with hexagons in removal
    const objectsToRemove = [ ...state.hexagons, ...state.resourceMarkers, ...state.tierLabels ];
    objectsToRemove.forEach(obj => {
        if (obj) {
            // If it's a hexagon, also remove its associated label if it exists
             if (obj.userData.isHexagon && obj.userData.tierLabel) {
                 const label = obj.userData.tierLabel;
                 state.scene.remove(label);
                 if (label.material) {
                     if (label.material.map) label.material.map.dispose();
                     label.material.dispose();
                 }
                 // Remove from state.tierLabels if it's tracked there separately
                 const labelIndex = state.tierLabels.indexOf(label);
                 if (labelIndex > -1) state.tierLabels.splice(labelIndex, 1);
             }

            // Remove the main object
            state.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                // Check if material has a map texture to dispose
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        }
     });
    state.clearMapObjects(); // Clears hexagons, resourceMarkers, tierLabels arrays in state
    log("Map elements cleared.");
}

/**
 * Creates the entire map visualization from loaded data.
 */
export function createMapVisualization(data) {
    log("Creating map visualization with data:", data);
    state.setMapData(data); // Store the data (including tiles array) in state
    clearMapElements(); // Clear any previous elements
    if (!state.scene || !state.mapData || !state.mapData.tiles) {
         log("Error: Scene or map data not available for visualization creation.");
         return;
    }

    // --- Initial Min/Max Score Calculation ---
    // Calculate once after data load for initial heatmap setup
    let initialMin = Infinity;
    let initialMax = -Infinity;
    state.mapData.tiles.forEach(tile => {
        if (tile.is_workable !== false && typeof tile.normalized_score === 'number') { // Check if workable (or assume workable if property missing)
            initialMin = Math.min(initialMin, tile.normalized_score);
            initialMax = Math.max(initialMax, tile.normalized_score);
        }
    });
    state.setMinMaxScores(
        initialMin === Infinity ? 0 : initialMin,
        initialMax === -Infinity ? 100 : initialMax
    );
    log(`Initial Min/Max Scores set: ${state.minScore}/${state.maxScore}`);


    // Center camera view logic... (remains the same)
    if (state.camera && state.controls && state.mapData.metadata) {
        const meta = state.mapData.metadata;
        const gridWidth = meta.max_x - meta.min_x;
        const gridHeight = meta.max_y - meta.min_y;
        const hexWidth = Math.sqrt(3) * config.hexRadius;
        const hexHeight = 2 * config.hexRadius;
        const totalWidth = gridWidth * hexWidth;
        const totalHeight = gridHeight * (hexHeight * 0.75);
        const targetX = 0; const targetZ = 0;
        const mapSpan = Math.max(totalWidth, totalHeight);
        const cameraDist = mapSpan * 1.2;
        state.camera.position.set(targetX, Math.max(20, cameraDist * 0.8), targetZ + cameraDist);
        state.controls.target.set(targetX, 0, targetZ);
        state.controls.update();
    }

    // Create elements for each tile
    state.mapData.tiles.forEach((tile, index) => {
        // Basic check for valid tile data
        if (!tile || typeof tile.x === 'undefined' || typeof tile.y === 'undefined') {
            log(`Warning: Skipping invalid tile data at index ${index}`);
            return;
        }
        try {
            // 1. Create Hexagon Mesh
            const hexMesh = createHexagonMesh(tile);
            state.scene.add(hexMesh);
            state.addHexagon(hexMesh); // Add to state tracking array

            // 2. Create Initial Tier Label (if applicable)
            // Use createOrUpdateTierLabel which handles texture creation
            const label = createOrUpdateTierLabel(tile, hexMesh.position);
            if (label) {
                state.scene.add(label);
                state.addTierLabel(label); // Add to state tracking array
                hexMesh.userData.tierLabel = label; // Link hex to its label
                label.userData.hexagon = hexMesh; // Link label back to hex
            }

            // 3. Create Resource Marker (if applicable)
            if (tile.resource) {
                const marker = createResourceMarker(tile, hexMesh.position);
                state.scene.add(marker);
                state.addResourceMarker(marker); // Add to state tracking array
                // Optional: Link marker to hex? hexMesh.userData.resourceMarker = marker;
            }
        } catch (e) {
            log(`Error creating elements for tile (${tile.x}, ${tile.y}):`, e);
            console.error("Tile creation error:", e, tile);
        }
    });
    log(`Created ${state.hexagons.length} hexagons, ${state.resourceMarkers.length} markers, ${state.tierLabels.length} labels.`);

    // Perform initial display update based on loaded data and default config
    updateMapDisplay();
}

/**
 * Calculates the heatmap color for a given score using multi-stop gradient.
 * Reads min/max from state.
 * @param {number} score - The normalized score of the tile.
 * @returns {THREE.Color} The calculated heatmap color.
 */
function getHeatmapColor(score) {
    // Use state.minScore and state.maxScore
    const minScore = state.minScore ?? 0;
    const maxScore = state.maxScore ?? 100;

    if (score === null || score === undefined || maxScore === minScore || heatmapColors.length < 2) {
        return heatmapNeutralColor; // Use neutral for unscored/invalid cases
    }

    // Normalize score to 0-1 range using state min/max
    const t = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)));

    // Determine which segment of the gradient `t` falls into
    const numSegments = heatmapColors.length - 1;
    const segmentIndex = Math.min(Math.floor(t * numSegments), numSegments - 1);
    const segmentT = (t * numSegments) - segmentIndex; // Local t within this segment

    // Get the start and end colors for this segment
    const colorStart = heatmapColors[segmentIndex];
    const colorEnd = heatmapColors[segmentIndex + 1];

    // Interpolate
    const color = new THREE.Color();
    color.lerpColors(colorStart, colorEnd, segmentT);

    return color;
}

/** Helper function to check if a tile is ocean or coast */
function isOceanOrCoast(tile) {
    return tile?.terrain === 'TERRAIN_OCEAN' || tile?.terrain === 'TERRAIN_COAST';
}


/**
 * Updates the visibility and appearance of ALL map elements based on current config and tile data.
 * This function now reads the potentially updated tile.tier and tile.normalized_score.
 */
export function updateMapDisplay() {
    // log("Updating map display based on config:", config); // Reduce logging frequency
    if (!state.mapData || !state.hexagons) {
        log("Warning: Cannot update display, map data or hexagons not ready.");
        return;
    }

    // Check if any tier filter is active (i.e., not all tiers are selected)
    // Assumes tierStyles contains all possible tiers ('S', 'A', 'B', etc.)
    const allPossibleTiers = Object.keys(tierStyles);
    const anyTierUnselected = config.selectedTiers.length < allPossibleTiers.length;

    // Iterate through each hexagon mesh stored in the state
    state.hexagons.forEach(hex => {
        if (!hex || !hex.userData || !hex.userData.tile) {
            log("Warning: Skipping hexagon with missing userData or tile reference.");
            return;
        }

        // Get the tile data associated with this hexagon.
        // This tile object is the one updated by recalculateScoresAndTiers.
        const tile = hex.userData.tile;
        const isOcean = isOceanOrCoast(tile); // Use helper
        const isWorkable = tile.is_workable ?? !isOcean; // Use pre-calculated flag or derive

        let targetColor = hex.userData.originalColor; // Default to original terrain color
        let opacity = 1.0;
        let isVisible = true; // Assume visible unless filtered out

        // --- Determine Target Color ---
        if (config.showScoreHeatmap && isWorkable) {
            // Use heatmap color for workable tiles if heatmap is on
            targetColor = getHeatmapColor(tile.normalized_score); // Reads updated score
        } else if (config.showScoreHeatmap && !isWorkable) {
            // Use neutral color for non-workable tiles if heatmap is on
            targetColor = heatmapNeutralColor;
        }
        // If heatmap is off, targetColor remains the original terrain color

        // --- Determine Opacity based on Tier Filtering ---
        const tileTier = tile.tier; // Reads updated tier
        const isSelectedTier = tileTier && config.selectedTiers.includes(tileTier);

        if (!isWorkable && anyTierUnselected && !config.showScoreHeatmap) {
            // Fade non-workable tiles slightly only if filtering is active AND heatmap is OFF
            opacity = 0.3;
        } else if (isWorkable && !isSelectedTier) {
            // Fade workable tiles significantly if their tier is not selected
            opacity = 0.15;
            isVisible = false; // Also mark as logically invisible for interactions if needed
        }
        // Otherwise, opacity remains 1.0

        // --- Apply Highlighting (Overrides color if active, unless heatmap is on) ---
        const isTopTier = tileTier === 'S' || tileTier === 'A';
        // Reset emissive first
        if (hex !== state.hoveredHexagon) { // Don't reset if currently hovered
             hex.material.emissive.setHex(0x000000);
             hex.material.emissiveIntensity = 0;
        }
        // Apply highlight if conditions met
        if (config.highlightTopTiles && isTopTier && !config.showScoreHeatmap && isSelectedTier) {
             hex.material.emissive.setHex(0xAAAA00); // Highlight color
             hex.material.emissiveIntensity = 0.5;  // Highlight intensity
             // Make slightly more opaque if filtered but highlighted
             if (!isSelectedTier) { // This condition seems contradictory now, maybe remove?
                 opacity = Math.max(opacity, 0.4);
             }
        }


        // --- Apply Elevation changes ---
        // Elevation calculation might depend on features/terrain, ensure it's consistent
        const elevation = calculateElevation(tile);
        // Determine base Y position (0 for land, elevation for water)
        const yPos = isOcean ? elevation : 0;
        // Update position only if not currently animating (if animations are added later)
        if (!hex.userData.animating) {
             hex.position.y = yPos;
             hex.userData.originalY = yPos; // Update original Y in case elevation logic changes
        }

        // --- Apply Final Color and Opacity to Hexagon ---
        // Use copy to avoid creating new Color objects repeatedly
        if (!hex.material.color.equals(targetColor)) {
             hex.material.color.copy(targetColor);
        }
        // Only set transparent flag if opacity is actually less than 1
        hex.material.transparent = opacity < 1.0;
        if (hex.material.opacity !== opacity) {
            hex.material.opacity = opacity;
        }
        hex.material.needsUpdate = true; // Needed if color, opacity, or transparency changes
        hex.visible = isVisible; // Set mesh visibility

        // --- Update Associated Tier Label ---
        const label = hex.userData.tierLabel;
        if (label) {
            // Check if the label's stored tier matches the tile's current tier
            if (label.userData.tier !== tileTier) {
                // Tier has changed, update the label's texture
                log(`Updating label for tile (${tile.x}, ${tile.y}) from ${label.userData.tier} to ${tileTier}`);
                createOrUpdateTierLabel(tile, hex.position, label); // This updates texture & stored tier
            }

            // Update label visibility based on config and filtering
            label.visible = isVisible && isSelectedTier && config.showTierLabels && !config.showScoreHeatmap;

            // Update label position if hex position changed (due to elevation)
             if (!hex.userData.animating) { // Check animation flag if needed
                label.position.y = yPos + config.hexHeight + elevation + 0.6;
             }
        } else if (tileTier) {
             // If a label *should* exist now but doesn't, create it
             log(`Creating new label for tile (${tile.x}, ${tile.y}) with tier ${tileTier}`);
             const newLabel = createOrUpdateTierLabel(tile, hex.position);
             if (newLabel) {
                 state.scene.add(newLabel);
                 state.addTierLabel(newLabel);
                 hex.userData.tierLabel = newLabel;
                 newLabel.userData.hexagon = hex;
                 // Set initial visibility correctly
                 newLabel.visible = isVisible && isSelectedTier && config.showTierLabels && !config.showScoreHeatmap;
             }
        }
    }); // End of state.hexagons.forEach

    // --- Update Resource Markers ---
    state.resourceMarkers.forEach(marker => {
        if (!marker || !marker.userData || !marker.userData.tile) return;
        const tile = marker.userData.tile;
        const parentHex = state.hexagons.find(h => h.userData.tile === tile); // Find corresponding hex

        // Visibility depends on config, heatmap status, and if the parent hex's tier is selected
        const isParentTierSelected = tile.tier && config.selectedTiers.includes(tile.tier);
        marker.visible = config.showResources && !config.showScoreHeatmap && isParentTierSelected && parentHex?.visible; // Also check parent visibility

        // Update position based on parent hex's current position and elevation
         if (parentHex && !parentHex.userData.animating) { // Check animation flag if needed
             const elevation = calculateElevation(tile);
             // Use parentHex.position.y which reflects current elevation adjustment
             marker.position.y = parentHex.position.y + config.hexHeight + elevation + 0.3;
         }
    });

    // log("Map display updated."); // Reduce logging frequency
}
