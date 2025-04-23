/**
 * mapElements.js
 * Functions for creating and managing map visualization elements (hexagons, markers, labels).
 */
import * as THREE from 'three';
import * as state from './state.js';
// *** Import heatmapColorStops instead of heatmapColors ***
import { config, terrainColors, resourceStyles, tierStyles, defaultColor, heatmapColors, heatmapNeutralColor } from './config.js';
import { calculateElevation, log } from './utils.js';

/**
 * Creates a beveled hexagon geometry.
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
    const material = new THREE.MeshStandardMaterial({ color: originalColor, metalness: 0.1, roughness: 0.8, flatShading: false });
    const mesh = new THREE.Mesh(geometry, material);

    // Positioning logic... (remains the same)
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
    const yPos = (tile.terrain === 'TERRAIN_OCEAN' || tile.terrain === 'TERRAIN_COAST') ? elevation : 0;
    mesh.position.set(xPos, yPos, zPos);

    mesh.userData = { tile: tile, originalY: yPos, originalColor: originalColor, isHexagon: true };
    return mesh;
}

/**
 * Creates a sphere mesh to mark a resource on a tile.
 */
function createResourceMarker(tile, position) {
    const resourceType = tile.resourcetype || 'default';
    const style = resourceStyles[resourceType] || resourceStyles.default;
    const geometry = new THREE.SphereGeometry(style.size, 12, 12);
    const material = new THREE.MeshBasicMaterial({ color: style.color });
    const marker = new THREE.Mesh(geometry, material);
    const elevation = calculateElevation(tile);
    marker.position.set(position.x, position.y + config.hexHeight + elevation + 0.3, position.z);
    marker.userData = { tile: tile, isMarker: true };
    return marker;
}

/**
 * Creates a text sprite label for the tile's tier.
 */
function createTierLabel(tile, position) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const size = 64; canvas.width = size; canvas.height = size;
    const style = tierStyles[tile.tier];
    if (!style) return null;
    context.beginPath(); context.arc(size / 2, size / 2, size * 0.4, 0, 2 * Math.PI);
    context.fillStyle = style.color; context.fill();
    context.font = `bold ${size * 0.5}px Arial`; context.textAlign = 'center';
    context.textBaseline = 'middle'; context.fillStyle = style.textColor;
    context.fillText(tile.tier, size / 2, size / 2);
    const texture = new THREE.CanvasTexture(canvas); texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, sizeAttenuation: true });
    const sprite = new THREE.Sprite(material);
    const elevation = calculateElevation(tile);
    sprite.position.set(position.x, position.y + config.hexHeight + elevation + 0.6, position.z);
    sprite.scale.set(0.6, 0.6, 1);
    sprite.userData = { tile: tile, tier: tile.tier, tileX: tile.x, tileY: tile.y, isLabel: true };
    return sprite;
}

/**
 * Removes all map-related objects from the scene and clears state arrays.
 */
export function clearMapElements() {
    log("Clearing map elements...");
    if (!state.scene) return;
    const objectsToRemove = [ ...state.hexagons, ...state.resourceMarkers, ...state.tierLabels ];
    objectsToRemove.forEach(obj => {
        if (obj) {
            state.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        }
     });
    state.clearMapObjects();
}

/**
 * Creates the entire map visualization from loaded data.
 */
export function createMapVisualization(data) {
    log("Creating map visualization with data:", data);
    state.setMapData(data);
    clearMapElements();
    if (!state.scene || !state.mapData || !state.mapData.tiles) return;

    // Center camera view logic...
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
        if (!tile || typeof tile.x === 'undefined' || typeof tile.y === 'undefined') return;
        try {
            const hexMesh = createHexagonMesh(tile);
            state.scene.add(hexMesh);
            state.addHexagon(hexMesh);
            let label = null;
            if (tile.tier) {
                label = createTierLabel(tile, hexMesh.position);
                if (label) {
                    state.scene.add(label); state.addTierLabel(label);
                    hexMesh.userData.tierLabel = label; label.userData.hexagon = hexMesh;
                }
            }
            if (tile.resource) {
                const marker = createResourceMarker(tile, hexMesh.position);
                state.scene.add(marker); state.addResourceMarker(marker);
            }
        } catch (e) {
            log(`Error creating elements for tile (${tile.x}, ${tile.y}):`, e);
            console.error("Tile creation error:", e, tile);
        }
    });
    log(`Created ${state.hexagons.length} hexagons, ${state.resourceMarkers.length} markers, ${state.tierLabels.length} labels.`);
    updateMapDisplay();
}

/**
 * Calculates the heatmap color for a given score using multi-stop gradient.
 * @param {number} score - The normalized score of the tile.
 * @returns {THREE.Color} The calculated heatmap color.
 */
function getHeatmapColor(score) {
    if (score === null || score === undefined || state.maxScore === state.minScore || heatmapColors.length < 2) {
        return heatmapNeutralColor; // Use neutral for unscored/invalid cases
    }

    // Normalize score to 0-1 range
    const t = Math.max(0, Math.min(1, (score - state.minScore) / (state.maxScore - state.minScore)));

    // Determine which segment of the gradient `t` falls into
    const numSegments = heatmapColors.length - 1;
    const segmentIndex = Math.min(Math.floor(t * numSegments), numSegments - 1); // Find the starting color index
    const segmentT = (t * numSegments) - segmentIndex; // Calculate local t within this segment (0-1)

    // Get the start and end colors for this segment
    const colorStart = heatmapColors[segmentIndex];
    const colorEnd = heatmapColors[segmentIndex + 1];

    // Interpolate between the two colors of the current segment
    const color = new THREE.Color();
    color.lerpColors(colorStart, colorEnd, segmentT);

    return color;
}


/**
 * Updates the visibility and appearance of map elements based on config.
 */
export function updateMapDisplay() {
    log("Updating map display based on config:", config);
    if (!state.mapData || !state.hexagons) return;

    const anyTierUnselected = config.selectedTiers.length < Object.keys(tierStyles).length;

    state.hexagons.forEach(hex => {
        if (!hex || !hex.userData || !hex.userData.tile) return;
        const tile = hex.userData.tile;
        const isOceanOrIce = tile.terrain === 'TERRAIN_OCEAN' || tile.feature === 'FEATURE_ICE';
        let opacity = 1.0;
        let visible = true;
        let targetColor = hex.userData.originalColor; // Default to original terrain color

        // --- Apply Heatmap Color ---
        if (config.showScoreHeatmap) {
            targetColor = getHeatmapColor(tile.normalized_score);
             // If heatmap is on, use neutral color for ocean/ice
             if (isOceanOrIce) {
                 targetColor = heatmapNeutralColor;
             }
        }

        // --- Tier Filtering (Affects Opacity) ---
        if (tile.tier && !config.selectedTiers.includes(tile.tier)) {
            opacity = 0.15;
        } else if (isOceanOrIce && anyTierUnselected && !config.showScoreHeatmap) {
            // Only fade ocean/ice if filtering and heatmap is OFF
            opacity = 0.2;
        }
        // Note: Ocean/Ice color handled in heatmap section now


        // --- Highlighting (Overrides color if active, unless heatmap is on) ---
        const isTopTier = tile.tier === 'S' || tile.tier === 'A';
        if (config.highlightTopTiles && isTopTier && !config.showScoreHeatmap) {
            hex.material.emissive.setHex(0xAAAA00);
            hex.material.emissiveIntensity = 0.4;
            if (!config.selectedTiers.includes(tile.tier)) {
                opacity = Math.max(opacity, 0.4);
            }
        } else if (hex !== state.hoveredHexagon) {
             hex.material.emissive.setHex(0x000000);
             hex.material.emissiveIntensity = 0;
        }

        // --- Apply Elevation changes ---
        const elevation = calculateElevation(tile);
        const yPos = (tile.terrain === 'TERRAIN_OCEAN' || tile.terrain === 'TERRAIN_COAST') ? elevation : 0;
        if (!hex.userData.animating) {
             hex.position.y = yPos;
             hex.userData.originalY = yPos;
        }

        // --- Apply Final Color and Opacity ---
        if (!hex.material.color.equals(targetColor)) {
             hex.material.color.copy(targetColor);
        }
        hex.material.opacity = opacity;
        hex.material.transparent = opacity < 1.0;
        hex.material.needsUpdate = true;
        hex.visible = visible;

        // --- Update Associated Elements ---
        if (hex.userData.tierLabel) {
            // Hide tier labels when heatmap is active for less clutter? (User preference)
            hex.userData.tierLabel.visible = visible && config.showTierLabels && !config.showScoreHeatmap && config.selectedTiers.includes(tile.tier);
             if (!hex.userData.animating) {
                hex.userData.tierLabel.position.y = yPos + config.hexHeight + elevation + 0.6;
             }
        }
    });

    // Update Resource Markers
    state.resourceMarkers.forEach(marker => {
        const tile = marker.userData.tile;
        // Hide markers when heatmap is active? (User preference)
        marker.visible = config.showResources && !config.showScoreHeatmap && config.selectedTiers.includes(tile.tier);
         const parentHex = state.hexagons.find(h => h.userData.tile === tile);
         if (parentHex && !parentHex.userData.animating) {
             const elevation = calculateElevation(tile);
             marker.position.y = parentHex.position.y + config.hexHeight + elevation + 0.3;
         }
    });

    log("Map display updated.");
}
