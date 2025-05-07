/**
 * mapElements.js
 * Functions for creating and managing map visualization elements (hexagons, markers, labels, district icons).
 */
import * as THREE from 'three';
import * as state from './state.js';
import { config, terrainColors, resourceStyles, tierStyles, defaultColor, heatmapColors, heatmapNeutralColor, districtIconPaths } from './config.js';
import { calculateElevation, log } from './utils.js';
import { buildHexagonCoordMap } from './interaction.js';

const textureLoader = new THREE.TextureLoader(); // Instantiate the loader once

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
    const material = new THREE.MeshStandardMaterial({
        color: originalColor.clone(),
        metalness: 0.1,
        roughness: 0.8,
        flatShading: false,
        transparent: true,
        opacity: 1.0
     });
    const mesh = new THREE.Mesh(geometry, material);

    const gridWidth = state.mapData.metadata.max_x - state.mapData.metadata.min_x;
    const gridHeight = state.mapData.metadata.max_y - state.mapData.metadata.min_y;
    const col = tile.x - state.mapData.metadata.min_x;
    const row = gridHeight - (tile.y - state.mapData.metadata.min_y);
    const hexWidth = Math.sqrt(3) * config.hexRadius;
    const hexLayoutHeight = 2 * config.hexRadius;
    let xPos = col * hexWidth;
    let zPos = row * (hexLayoutHeight * 0.75);
    if (row % 2 !== 0) xPos += hexWidth / 2;
    const totalWidth = gridWidth * hexWidth;
    const totalHeight = gridHeight * (hexLayoutHeight * 0.75);
    xPos -= totalWidth / 2;
    zPos -= totalHeight / 2;
    const yPos = isOceanOrCoast(tile) ? elevation : 0;
    mesh.position.set(xPos, yPos, zPos);

    mesh.userData = {
        tile: tile,
        originalY: yPos,
        originalColor: originalColor,
        isHexagon: true,
        tierLabel: null,
        districtIcon: null
    };
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
    marker.position.set(position.x, position.y + (config.hexHeight + elevation) + 0.3, position.z);
    marker.userData = { tile: tile, isMarker: true };
    return marker;
}

/**
 * Creates the texture for a tier label sprite based on the current tier.
 */
function createTierLabelTexture(tier) {
    if (!tier) return null;
    const style = tierStyles[tier];
    if (!style) {
        log(`Warning: No style defined for tier "${tier}"`);
        return null;
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.4, 0, 2 * Math.PI);
    context.fillStyle = style.color;
    context.fill();
    context.font = `bold ${size * 0.5}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = style.textColor;
    context.fillText(tier, size / 2, size / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}


/**
 * Creates or updates a text sprite label for the tile's tier.
 */
function createOrUpdateTierLabel(tile, position, existingSprite = null) {
    const newTexture = createTierLabelTexture(tile.tier);
    if (!newTexture) {
        if (existingSprite) {
            existingSprite.visible = false;
        }
        return null;
    }
    const elevation = calculateElevation(tile);
    const labelY = position.y + (config.hexHeight + elevation) + 0.6;

    if (existingSprite) {
        if (existingSprite.material.map) {
            existingSprite.material.map.dispose();
        }
        existingSprite.material.map = newTexture;
        existingSprite.material.needsUpdate = true;
        existingSprite.position.y = labelY;
        existingSprite.userData.tier = tile.tier;
        existingSprite.visible = true;
        return existingSprite;
    } else {
        const material = new THREE.SpriteMaterial({ map: newTexture, sizeAttenuation: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(position.x, labelY, position.z);
        sprite.scale.set(0.6, 0.6, 1);
        sprite.userData = {
            tile: tile,
            tier: tile.tier,
            tileX: tile.x,
            tileY: tile.y,
            isLabel: true
        };
        return sprite;
    }
}

/**
 * Creates a sprite for a recommended district icon or city center.
 * @param {string} iconKey - The key for the icon (e.g., "entertainmentcomplex", "citycenter").
 * @param {THREE.Vector3} hexWorldPosition - The world position of the hexagon mesh.
 * @param {object} tileData - The data object for the tile.
 * @returns {THREE.Sprite | null} The created sprite or null if path not found.
 */
export function createDistrictIconSprite(iconKey, hexWorldPosition, tileData) {
    const iconPath = districtIconPaths[iconKey]; // Uses the already formatted key

    if (!iconPath) {
         log(`Warning: Icon path for key "${iconKey}" not found in districtIconPaths. Check config.js.`);
         return null;
    }

    try {
        const texture = textureLoader.load(
            iconPath,
            function (loadedTexture) {
                log(`Successfully loaded icon texture: ${iconPath}`);
            },
            undefined,
            function (err) {
                log(`Error loading icon texture ${iconPath}:`, err);
            }
        );

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            depthTest: true,
            depthWrite: true,
        });

        const sprite = new THREE.Sprite(material);
        const elevation = calculateElevation(tileData);
        // Position slightly above the center of the hex's top face.
        const yPosition = hexWorldPosition.y + (config.hexHeight + elevation) * 0.5 + config.districtIconYOffset;

        sprite.position.set(
            hexWorldPosition.x,
            yPosition,
            hexWorldPosition.z
        );

        sprite.scale.set(config.districtIconScale, config.districtIconScale, 1.0);

        sprite.userData = {
            tile: tileData,
            districtType: iconKey, // Store the key used (e.g., "citycenter" or "campus")
            isDistrictIcon: true
        };
        return sprite;
    } catch (error) {
        log(`Generic error creating icon sprite for ${iconKey} at ${iconPath}:`, error);
        return null;
    }
}


/**
 * Removes all map-related objects from the scene and clears state arrays.
 */
export function clearMapElements() {
    log("Clearing map elements...");
    if (!state.scene) return;

    const objectsToRemove = [ ...state.hexagons, ...state.resourceMarkers, ...state.tierLabels, ...state.districtIcons ];
    objectsToRemove.forEach(obj => {
        if (obj) {
             if (obj.userData.isHexagon) {
                 if (obj.userData.tierLabel) {
                     const label = obj.userData.tierLabel;
                     state.scene.remove(label);
                     if (label.material) {
                         if (label.material.map) label.material.map.dispose();
                         label.material.dispose();
                     }
                 }
                 if (obj.userData.districtIcon) { // This will remove either city center or district icon
                    const districtIcon = obj.userData.districtIcon;
                    state.scene.remove(districtIcon);
                    if (districtIcon.material) {
                        if (districtIcon.material.map) districtIcon.material.map.dispose();
                        districtIcon.material.dispose();
                    }
                 }
             }

            state.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        }
     });
    state.clearMapObjects();
    log("Map elements cleared.");
}

/**
 * Creates the entire map visualization from loaded data.
 */
export function createMapVisualization(data) {
    log("Creating map visualization with data:", data);
    state.setMapData(data);
    clearMapElements();
    if (!state.scene || !state.mapData || !state.mapData.tiles) {
         log("Error: Scene or map data not available for visualization creation.");
         return;
    }

    let initialMin = Infinity;
    let initialMax = -Infinity;
    state.mapData.tiles.forEach(tile => {
        if (tile.is_workable !== false && typeof tile.normalized_score === 'number') {
            initialMin = Math.min(initialMin, tile.normalized_score);
            initialMax = Math.max(initialMax, tile.normalized_score);
        }
    });
    state.setMinMaxScores(
        initialMin === Infinity ? 0 : initialMin,
        initialMax === -Infinity ? 100 : initialMax
    );
    log(`Initial Min/Max Scores set: ${state.minScore}/${state.maxScore}`);

    if (state.camera && state.controls && state.mapData.metadata) {
        const meta = state.mapData.metadata;
        const gridWidth = meta.max_x - meta.min_x;
        const gridHeight = meta.max_y - meta.min_y;
        const hexWidth = Math.sqrt(3) * config.hexRadius;
        const hexLayoutHeight = 2 * config.hexRadius;
        const totalWidth = gridWidth * hexWidth;
        const totalHeight = gridHeight * (hexLayoutHeight * 0.75);
        const targetX = 0; const targetZ = 0;
        const mapSpan = Math.max(totalWidth, totalHeight);
        const cameraDist = mapSpan * 1.2;
        state.camera.position.set(targetX, Math.max(20, cameraDist * 0.8), targetZ + cameraDist);
        state.controls.target.set(targetX, 0, targetZ);
        state.controls.update();
    }

    // REMOVED: Explicit fetching of city_center_x, city_center_y from metadata for icon placement.
    // The city center icon will now be placed if a tile has `recommended_district: "citycenter"`.

    state.mapData.tiles.forEach((tile, index) => {
        if (!tile || typeof tile.x === 'undefined' || typeof tile.y === 'undefined') {
            log(`Warning: Skipping invalid tile data at index ${index}`);
            return;
        }
        try {
            const hexMesh = createHexagonMesh(tile);
            state.scene.add(hexMesh);
            state.addHexagon(hexMesh);

            const label = createOrUpdateTierLabel(tile, hexMesh.position);
            if (label) {
                state.scene.add(label);
                state.addTierLabel(label);
                hexMesh.userData.tierLabel = label;
                label.userData.hexagon = hexMesh;
            }

            if (tile.resource) {
                const marker = createResourceMarker(tile, hexMesh.position);
                state.scene.add(marker);
                state.addResourceMarker(marker);
            }

            // Create District/City Center Icon if recommended_district field is present
            if (tile.recommended_district) {
                // tile.recommended_district will contain the formatted name (e.g., "citycenter", "campus")
                const iconSprite = createDistrictIconSprite(tile.recommended_district, hexMesh.position, tile);
                if (iconSprite) {
                    state.scene.add(iconSprite);
                    state.addDistrictIcon(iconSprite);
                    hexMesh.userData.districtIcon = iconSprite; // Store reference on the hex
                    iconSprite.userData.hexagon = hexMesh; // Link icon back to hex
                    if (tile.recommended_district === "citycenter") {
                        log(`City Center icon placed at (${tile.x}, ${tile.y}) via recommended_district field.`);
                    }
                }
            }

        } catch (e) {
            log(`Error creating elements for tile (${tile.x}, ${tile.y}):`, e);
            console.error("Tile creation error:", e, tile);
        }
    });
    log(`Created ${state.hexagons.length} hexagons, ${state.resourceMarkers.length} markers, ${state.tierLabels.length} labels, and ${state.districtIcons.length} district/city icons.`);

    buildHexagonCoordMap();
    updateMapDisplay();
}

/**
 * Calculates the heatmap color for a given score using multi-stop gradient.
 */
function getHeatmapColor(score) {
    const minScore = state.minScore ?? 0;
    const maxScore = state.maxScore ?? 100;
    if (score === null || score === undefined || maxScore === minScore || heatmapColors.length < 2) {
        return heatmapNeutralColor;
    }
    const t = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)));
    const numSegments = heatmapColors.length - 1;
    const segmentIndex = Math.min(Math.floor(t * numSegments), numSegments - 1);
    const segmentT = (t * numSegments) - segmentIndex;
    const colorStart = heatmapColors[segmentIndex];
    const colorEnd = heatmapColors[segmentIndex + 1];
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
 */
export function updateMapDisplay() {
    if (!state.mapData || !state.hexagons) {
        log("Warning: Cannot update display, map data or hexagons not ready.");
        return;
    }

    const allPossibleTiers = Object.keys(tierStyles);
    const anyTierUnselected = config.selectedTiers.length < allPossibleTiers.length;

    state.hexagons.forEach(hex => {
        if (!hex || !hex.userData || !hex.userData.tile) {
            log("Warning: Skipping hexagon with missing userData or tile reference.");
            return;
        }
        const tile = hex.userData.tile;
        const isOcean = isOceanOrCoast(tile);
        const isWorkable = tile.is_workable ?? !isOcean;
        let targetColor = hex.userData.originalColor.clone();
        let opacity = 1.0;
        let isVisible = true;

        if (config.showScoreHeatmap && isWorkable) {
            targetColor = getHeatmapColor(tile.normalized_score);
        } else if (config.showScoreHeatmap && !isWorkable) {
            targetColor = heatmapNeutralColor.clone();
        }

        const tileTier = tile.tier;
        const isSelectedTier = tileTier && config.selectedTiers.includes(tileTier);

        if (!isWorkable && anyTierUnselected && !config.showScoreHeatmap) {
            opacity = 0.3;
        } else if (isWorkable && !isSelectedTier) {
            opacity = 0.15;
            isVisible = false;
        }
        
        if (hex !== state.hoveredHexagon) {
             hex.material.emissive.setHex(0x000000);
             hex.material.emissiveIntensity = 0;
        }
        const isTopTier = tileTier === 'S' || tileTier === 'A';
        if (config.highlightTopTiles && isTopTier && !config.showScoreHeatmap && isSelectedTier) {
             hex.material.emissive.setHex(0xAAAA00);
             hex.material.emissiveIntensity = 0.5;
             if (!isSelectedTier) { 
                 opacity = Math.max(opacity, 0.4);
             }
        }

        const elevation = calculateElevation(tile);
        const yPos = isOcean ? elevation : 0;
        if (!hex.userData.animating) {
             hex.position.y = yPos;
             hex.userData.originalY = yPos;
        }

        if (!hex.material.color.equals(targetColor)) {
             hex.material.color.copy(targetColor);
        }
        hex.material.transparent = opacity < 1.0;
        if (hex.material.opacity !== opacity) {
            hex.material.opacity = opacity;
        }
        hex.material.needsUpdate = true;
        hex.visible = isVisible;

        const label = hex.userData.tierLabel;
        if (label) {
            if (label.userData.tier !== tileTier) {
                createOrUpdateTierLabel(tile, hex.position, label);
            }
            label.visible = isVisible && isSelectedTier && config.showTierLabels && !config.showScoreHeatmap;
            if (!hex.userData.animating) {
                label.position.y = yPos + (config.hexHeight + elevation) + 0.6;
            }
        } else if (tileTier) {
             const newLabel = createOrUpdateTierLabel(tile, hex.position);
             if (newLabel) {
                 state.scene.add(newLabel);
                 state.addTierLabel(newLabel);
                 hex.userData.tierLabel = newLabel;
                 newLabel.userData.hexagon = hex;
                 newLabel.visible = isVisible && isSelectedTier && config.showTierLabels && !config.showScoreHeatmap;
             }
        }

        const districtIcon = hex.userData.districtIcon;
        if (districtIcon) {
            // District icons (including city center if it's handled this way) are visible if:
            // 1. The main toggle for district icons is ON.
            // 2. The hexagon itself is visible (not filtered out by tier, etc.).
            districtIcon.visible = isVisible && config.showRecommendedDistrictIcons;
            
            if (!hex.userData.animating) { 
                const iconYPosition = yPos + (config.hexHeight + elevation) * 0.5 + config.districtIconYOffset;
                districtIcon.position.y = iconYPosition;
            }
        }
    });

    state.resourceMarkers.forEach(marker => {
        if (!marker || !marker.userData || !marker.userData.tile) return;
        const tile = marker.userData.tile;
        const parentHex = state.hexagons.find(h => h.userData.tile === tile);
        const isParentTierSelected = tile.tier && config.selectedTiers.includes(tile.tier);
        marker.visible = config.showResources && !config.showScoreHeatmap && isParentTierSelected && parentHex?.visible;
         if (parentHex && !parentHex.userData.animating) {
             const elevation = calculateElevation(tile);
             marker.position.y = parentHex.position.y + (config.hexHeight + elevation) + 0.3;
         }
    });
}
