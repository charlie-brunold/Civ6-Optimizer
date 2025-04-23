/**
 * Civilization Map Visualization using Three.js
 * This implementation creates a hexagonal grid visualization with:
 * - Consistent hexagon sizes during zoom
 * - Terrain color mapping
 * - Resource and tier indicators
 * - Interactive controls
 */

// Main Three.js components
let scene, camera, renderer, controls;

// Map data and configuration
let mapData = null;
let config = {
    hexRadius: 1.0,        // Base size of hexagons
    hexHeight: 0.5,         // Height of hexagon (for elevation)
    verticalSpacing: 0.866, // Spacing between rows (√3/2)
    horizontalSpacing: 1.5, // Spacing between columns
    elevationFactor: 0.4,   // How much elevation affects tile height
    showResources: true,    // Whether to show resource markers
    showTierLabels: true,   // Whether to show tier labels
    highlightTopTiles: false, // Whether to highlight S and A tier tiles
    selectedTiers: ['S', 'A', 'B', 'C', 'D', 'E', 'F'], // Which tiers to display
    showHistogram: false,      // Toggle for histogram visibility
    histogramHeightScale: 0.05 // Controls how tall the bars will be
};

// Objects for raycasting and interaction
let hexagons = [];
let resourceMarkers = [];
let tierLabels = [];
let raycaster, mouse;
let hoveredHexagon = null;

let keys = {
    w: false,
    a: false,
    s: false,
    d: false
};
let panSpeed = 0.5; // Adjust this to control panning speed

// histogram bars for normalized scores visualization
let histogramBars = [];

// cute boat animation variables
let boat = null;
let boatWake = null;
let boatPath = [];
let boatTargetIndex = 0;
let boatSpeed = 0.02;
let lastWakeTime = 0;
let interpolationFactor = 0; // For smooth path transitions
let currentPathPoint = new THREE.Vector3();
let nextPathPoint = new THREE.Vector3();

// Track the current state (true = all selected, false = none selected)
let allTiersSelected = true;  // Start with all tiers selected

// Get the toggle button element
const toggleAllTiersBtn = document.getElementById('toggle-all-tiers');

// Define terrain colors (matching your Python implementation)
const terrainColors = {
    'TERRAIN_OCEAN': '#1a5f9e',       // Deeper blue
    'TERRAIN_COAST': '#4da6ff',       // Brighter blue
    'TERRAIN_PLAINS': '#e8d292',      // Slightly lighter tan
    'TERRAIN_GRASS': '#8bc34a',       // Modern green
    'TERRAIN_GRASS_HILLS': '#689f38', // Darker green
    'TERRAIN_DESERT_HILLS': '#ffd54f', // Warmer yellow
    'TERRAIN_TUNDRA': '#e0e0e0',      // Lighter gray
    'TERRAIN_TUNDRA_HILLS': '#bdbdbd', // Medium gray
    'TERRAIN_SNOW': '#f5f5f5',        // Off-white
    'TERRAIN_GRASS_MOUNTAIN': '#795548', // Rich brown
    'TERRAIN_PLAINS_MOUNTAIN': '#6d4c41', // Slightly darker brown
    'TERRAIN_DESERT_MOUNTAIN': '#5d4037', // Even darker brown
    'TERRAIN_TUNDRA_MOUNTAIN': '#4e342e', // Very dark brown
    'TERRAIN_SNOW_MOUNTAIN': '#3e2723', // Almost black brown
    'TERRAIN_PLAINS_HILLS': '#dbc773', // Lighter tan
    'TERRAIN_DESERT': '#ffc107'        // Amber
};

// Default color for unknown terrain
const defaultColor = '#a9a9a9';

// Resource marker styles
const resourceStyles = {
    'Luxury': { color: '#9c27b0', size: 0.2 },
    'Strategic': { color: '#f44336', size: 0.2 },
    'Bonus': { color: '#4caf50', size: 0.2 },
    'default': { color: '#ff9800', size: 0.2 }
};

// Tier styles
const tierStyles = {
    'S': { color: '#ffcc00', textColor: 'black' },
    'A': { color: '#ff8800', textColor: 'black' },
    'B': { color: '#66cc66', textColor: 'black' },
    'C': { color: '#6699cc', textColor: 'black' },
    'D': { color: '#cccccc', textColor: 'black' },
    'E': { color: '#999999', textColor: 'black' },
    'F': { color: '#666666', textColor: 'white' }
};

const clock = new THREE.Clock();

// Calculate elevation value based on terrain and feature
function calculateElevation(tile) {
    let elevation = 0;
    
    // Set ocean tiles to be lowest (below ground level)
    // Add truly random height variations for ocean tiles
    if (tile.terrain === 'TERRAIN_OCEAN') {
        // Create a base negative elevation for ocean
        elevation = -0.2;
        
        // Add a completely random variation on each reload
        const randomVariation = Math.random() * 0.12; // Random variation of up to 0.08 units
        
        elevation -= randomVariation; // Subtract to make deeper in places
    }
    // Coast tiles are just slightly below ground level
    else if (tile.terrain === 'TERRAIN_COAST') {
        elevation = -0.1; // Higher than ocean but still below normal ground
    }
    // Base elevation for terrain types
    else if (tile.terrain && tile.terrain.includes('HILLS')) {
        elevation = 0.5;
    } else if (tile.terrain && tile.terrain.includes('MOUNTAIN')) {
        elevation = 1.0;
    }
    
    // Adjust for features
    if (tile.feature === 'FEATURE_FOREST' || tile.feature === 'FEATURE_JUNGLE') {
        elevation += 0.25;
    }
    
    return elevation * config.elevationFactor;
}

// Initialize the Three.js scene
function init() {
    console.log("Initializing Three.js visualization...");
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd0e6f9); // Light blue background
    
    // Create camera
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        shadowMap: true // Enable shadow mapping
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Get the container and append the renderer
    const container = document.getElementById('map-container');
    if (!container) {
        console.error("Could not find map-container element");
        return;
    }
    container.appendChild(renderer.domElement);
    
    console.log("Renderer added to DOM");
    
    // // Create a test cube to verify rendering is working
    // const cubeGeometry = new THREE.BoxGeometry(5, 5, 5);
    // const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    // const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    // scene.add(cube);
    // console.log("Added test cube to scene");
    
    // Add orbit controls
    try {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true;
        controls.maxPolarAngle = Math.PI / 2.2; // Limit to prevent going below the ground plane

        // Add this line to limit how far the user can zoom out
        controls.minDistance = 15; // Adjust this value to set your minimum zoom distance
        
        // You can also set a maximum zoom distance if needed
        controls.maxDistance = 100; // Adjust this value to set your maximum zoom distance

        console.log("OrbitControls initialized");
    } catch (e) {
        console.error("Error initializing OrbitControls:", e);
    }
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    // Make your directional light cast shadows
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // // Add a simple grid for reference
    // const gridHelper = new THREE.GridHelper(50, 50, 0x666666, 0x444444);
    // gridHelper.position.y = -0.02; // Slightly below the map
    // scene.add(gridHelper);
    
    // Add raycaster and mouse for interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // Add event listener to the toggle button
    if (toggleAllTiersBtn) {
        toggleAllTiersBtn.addEventListener('click', function() {
            // Toggle the state
            allTiersSelected = !allTiersSelected;
            
            // Update button text
            this.textContent = allTiersSelected ? 'Deselect All Tiers' : 'Select All Tiers';
            
            // Optional: toggle button style
            this.classList.toggle('inactive', !allTiersSelected);
            
            // Get all tier checkboxes
            const tierCheckboxes = document.querySelectorAll('.tier-checkbox');
            
            // Update all checkboxes
            tierCheckboxes.forEach(checkbox => {
                checkbox.checked = allTiersSelected;
            });
            
            // Update the selected tiers configuration
            config.selectedTiers = allTiersSelected 
                ? ['S', 'A', 'B', 'C', 'D', 'E', 'F']  // All tiers
                : [];  // No tiers
            
            // Update the map display
            updateMapDisplay();
        });
    }

    // Call this during your initialization
    initializeToggleButtonState();
    
    // Add controls event listeners
    const tierLabelsToggle = document.getElementById('toggle-tier-labels');
    const resourcesToggle = document.getElementById('toggle-resources');
    const elevationToggle = document.getElementById('toggle-elevation');
    const highlightButton = document.getElementById('highlight-top-tiles');

    // Set up keyboard controls
    setupKeyboardControls();
    
    if (tierLabelsToggle) {
        tierLabelsToggle.addEventListener('change', function() {
            config.showTierLabels = this.checked;
            updateMapDisplay();
        });
    }
    
    if (resourcesToggle) {
        resourcesToggle.addEventListener('change', function() {
            config.showResources = this.checked;
            updateMapDisplay();
        });
    }
    
    if (elevationToggle) {
        elevationToggle.addEventListener('change', function() {
            config.elevationFactor = this.checked ? 0.2 : 0;
            updateMapDisplay();
        });
    }
    
    if (highlightButton) {
        highlightButton.addEventListener('click', function() {
            config.highlightTopTiles = !config.highlightTopTiles;
            this.textContent = config.highlightTopTiles ? 'Reset Highlighting' : 'Highlight Top Tiles';
            this.classList.toggle('inactive', config.highlightTopTiles);
            updateMapDisplay();
        });
    }
    
    // Setup tier checkboxes
    document.querySelectorAll('.tier-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Update the selected tiers based on checkboxes
            config.selectedTiers = Array.from(document.querySelectorAll('.tier-checkbox:checked'))
                .map(cb => cb.value);
            
            // Update toggle button state based on current selections
            const tierCheckboxes = document.querySelectorAll('.tier-checkbox');
            const checkedCount = Array.from(tierCheckboxes).filter(cb => cb.checked).length;
            
            allTiersSelected = (checkedCount === tierCheckboxes.length);
            
            // Update toggle button text and style
            if (toggleAllTiersBtn) {
                toggleAllTiersBtn.textContent = allTiersSelected ? 'Deselect All Tiers' : 'Select All Tiers';
                toggleAllTiersBtn.classList.toggle('inactive', !allTiersSelected);
            }
            
            // Update the map display
            updateMapDisplay();
        });
    });

    const histogramToggle = document.getElementById('toggle-histogram');
    if (histogramToggle) {
        histogramToggle.addEventListener('change', function() {
            config.showHistogram = this.checked;
            
            // If toggling on and no bars exist, create them
            if (config.showHistogram && histogramBars.length === 0) {
                hexagons.forEach(hex => {
                    const tile = hex.userData.tile;
                    if (tile.normalized_score) {
                        const bar = createHistogramBar(tile, hex.position);
                        if (bar) {
                            scene.add(bar);
                            histogramBars.push(bar);
                        }
                    }
                });
            }
            
            // Update visibility
            updateMapDisplay();
        });
    }

    const histogramScaleSlider = document.getElementById('histogram-scale');
    if (histogramScaleSlider) {
        histogramScaleSlider.addEventListener('input', function() {
            config.histogramHeightScale = parseFloat(this.value);
            
            // Update existing bars
            if (histogramBars.length > 0) {
                // Remove old bars
                histogramBars.forEach(bar => {
                    scene.remove(bar);
                    if (bar.geometry) bar.geometry.dispose();
                    if (bar.material) bar.material.dispose();
                });
                histogramBars = [];
                
                // Create new bars with updated scale
                hexagons.forEach(hex => {
                    const tile = hex.userData.tile;
                    if (tile.normalized_score) {
                        const bar = createHistogramBar(tile, hex.position);
                        if (bar) {
                            scene.add(bar);
                            histogramBars.push(bar);
                        }
                    }
                });
                
                updateMapDisplay();
            }
        });
    }

    config.showBoat = true; // Toggle for boat visibility
    
    // Start animation loop
    console.log("Starting animation loop");
    animate();
    
    // Test render a single frame to check if it works
    renderer.render(scene, camera);
    console.log("Test render completed");
}

// Initialize toggle button state based on actual checkbox state
function initializeToggleButtonState() {
    const tierCheckboxes = document.querySelectorAll('.tier-checkbox');
    const checkedCount = Array.from(tierCheckboxes).filter(cb => cb.checked).length;
    
    // If all checkboxes are checked, set state to all selected
    allTiersSelected = (checkedCount === tierCheckboxes.length);
    
    // Update button text
    if (toggleAllTiersBtn) {
        toggleAllTiersBtn.textContent = allTiersSelected ? 'Deselect All Tiers' : 'Select All Tiers';
        toggleAllTiersBtn.classList.toggle('inactive', !allTiersSelected);
    }
}

function createBeveledHexagonGeometry(radius, height, bevelSize = 0.1) {
    // Create a 2D hexagon shape
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
        // Start at 90 degrees (π/2) to point the first vertex upward
        const angle = (Math.PI / 3) * i + Math.PI / 2;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        
        if (i === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
    }
    shape.closePath();
    
    // Extrude the shape with beveled edges
    const extrudeSettings = {
        steps: 1,
        depth: height,
        bevelEnabled: true,
        bevelThickness: bevelSize,
        bevelSize: bevelSize,
        bevelOffset: 0,
        bevelSegments: 2
    };
    
    // Create the geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Rotate to the correct orientation
    geometry.rotateX(-Math.PI / 2);
    
    return geometry;
}

// Update the hexagon positioning in createHexagonMesh function
function createHexagonMesh(tile) {
    const elevation = calculateElevation(tile);
    const geometry = createBeveledHexagonGeometry(config.hexRadius, config.hexHeight + elevation);
    
    // Determine the color based on terrain
    const color = terrainColors[tile.terrain] || defaultColor;
    const material = new THREE.MeshLambertMaterial({ color: color });
    
    // MODIFIED POSITIONING CODE:
    // Calculate grid width and height
    const gridWidth = mapData.metadata.max_x - mapData.metadata.min_x;
    const gridHeight = mapData.metadata.max_y - mapData.metadata.min_y;
    
    // Invert the row position to start from bottom instead of top
    const col = tile.x - mapData.metadata.min_x;
    const row = gridHeight - (tile.y - mapData.metadata.min_y);

    // Create the mesh
    const mesh = new THREE.Mesh(geometry, material);
    // Make your hexagon meshes cast and receive shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Calculate the inner radius for proper spacing
    const innerRadius = config.hexRadius * 0.866;
    
    // Calculate position with proper honeycomb offset for pointy-topped hexagons:
    // For pointy-topped hexagons, the x and z axes are switched compared to flat-topped
    let xPos = col * (innerRadius * 2);
    let zPos = row * (config.hexRadius * 1.5);
    
    // Offset every other column for honeycomb pattern with pointy tops
    if (row % 2 === 1) {
        xPos += config.hexRadius * 0.85;
    }
    
    // For ocean tiles, position them below ground level based on their elevation
    const yPos = (tile.terrain === 'TERRAIN_OCEAN' || tile.terrain === 'TERRAIN_COAST') 
    ? elevation 
    : 0;
    mesh.position.set(xPos, yPos, zPos);

    // Store the original y position for hover animation
    mesh.userData.originalY = yPos;
    mesh.userData.tile = tile;

    return mesh;
}

// Create a sphere for resource markers
function createResourceMarker(tile, position) {
    const resourceType = tile.resourcetype || 'default';
    const style = resourceStyles[resourceType] || resourceStyles.default;
    
    const geometry = new THREE.SphereGeometry(style.size, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: style.color });
    const marker = new THREE.Mesh(geometry, material);
    
    // Position higher above the thicker tile
    marker.position.set(
        position.x, 
        position.y + config.hexHeight + 0.5, // Increase this offset
        position.z
    );
    
    // Store reference to the tile
    marker.userData.tile = tile;
    
    return marker;
}

// Create a tier label (text sprite that always faces the camera)
function createTierLabel(tile, position) {
    // Create a canvas for the text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    
    // Get tier style
    const style = tierStyles[tile.tier];
    
    // Draw background circle
    context.beginPath();
    context.arc(32, 32, 24, 0, 2 * Math.PI);
    context.fillStyle = style.color;
    context.fill();
    
    // Draw text
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = style.textColor;
    context.fillText(tile.tier, 32, 32);
    
    // Create a texture
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create a sprite material using the texture
    const material = new THREE.SpriteMaterial({ map: texture });
    
    // Create the sprite
    const sprite = new THREE.Sprite(material);
    
    // Calculate the actual elevation for this tile
    const elevation = calculateElevation(tile);
    
    // Position the sprite above the tile, accounting for elevation
    sprite.position.set(
        position.x, 
        position.y + config.hexHeight + elevation + 0.6, // Add elevation to y-position
        position.z
    );
    
    // Scale the sprite
    sprite.scale.set(0.7, 0.7, 1);
    
    // Store reference to the tile
    sprite.userData.tile = tile;
    sprite.userData.tier = tile.tier;
    
    // Add this line to store coordinates for easier lookup
    sprite.userData.tileX = tile.x;
    sprite.userData.tileY = tile.y;
    
    return sprite;
}

// Create visualization from map data
function createMapVisualization(data) {
    console.log("Creating map visualization with data:", data);
    
    // Clear any existing map elements
    clearMapElements();
    
    // Store the data
    mapData = data;
    
    // Remove test cube if it exists
    scene.children.forEach(child => {
        if (child.geometry && child.geometry.type === "BoxGeometry") {
            scene.remove(child);
        }
    });
    
    // Calculate center of the map for camera positioning
    const centerX = ((mapData.metadata.max_x - mapData.metadata.min_x) / 2) * (config.hexRadius * 1.732);
    const centerZ = ((mapData.metadata.max_y - mapData.metadata.min_y) / 2) * (config.hexRadius * 1.5);

    // Position camera to view the center of the map
    camera.position.set(centerX, 20, centerZ + 30);
    controls.target.set(centerX, 0, centerZ);
    
    console.log("Creating tiles...");
    // Create hexagons for each tile
    mapData.tiles.forEach((tile, index) => {
        if (index % 100 === 0) {
            console.log(`Processing tile ${index} of ${mapData.tiles.length}`);
        }
        
        try {
            // Create hexagon mesh
            const hexMesh = createHexagonMesh(tile);
            scene.add(hexMesh);
            hexagons.push(hexMesh);
            
            // Create resource marker if tile has a resource
            if (tile.resource && config.showResources) {
                const marker = createResourceMarker(tile, hexMesh.position);
                scene.add(marker);
                resourceMarkers.push(marker);
            }
            
            // Create tier label if tile has a tier
            if (tile.tier && config.showTierLabels) {
                const label = createTierLabel(tile, hexMesh.position);
                scene.add(label);
                tierLabels.push(label);
            }
        } catch (e) {
            console.error("Error creating tile:", e, tile);
        }
    });
    
    console.log(`Created ${hexagons.length} hexagons, ${resourceMarkers.length} resource markers, and ${tierLabels.length} tier labels`);

    // Create histogram bars if enabled
    if (config.showHistogram) {
        mapData.tiles.forEach(tile => {
            if (tile.normalized_score) {
                // Find the corresponding hexagon
                const hexMesh = hexagons.find(h => 
                    h.userData.tile.x === tile.x && h.userData.tile.y === tile.y);
                    
                if (hexMesh) {
                    const bar = createHistogramBar(tile, hexMesh.position);
                    if (bar) {
                        scene.add(bar);
                        histogramBars.push(bar);
                    }
                }
            }
        });
    }

    // Add this after creating all hexagons and labels
    hexagons.forEach(hex => {
        const tile = hex.userData.tile;
        // Find and link the corresponding label
        const matchingLabel = tierLabels.find(label => 
            label.userData.tileX === tile.x && 
            label.userData.tileY === tile.y);
        
        if (matchingLabel) {
            hex.userData.tierLabel = matchingLabel;
            matchingLabel.userData.hexagon = hex;
        }
    });

    initBoat();
    
    // Update visibility based on current filters
    updateMapDisplay();
}

// Clear all map elements from the scene
function clearMapElements() {
    console.log("Clearing map elements...");
    
    // Remove and dispose hexagons
    hexagons.forEach(hex => {
        scene.remove(hex);
        if (hex.geometry) hex.geometry.dispose();
        if (hex.material) hex.material.dispose();
    });
    hexagons = [];
    
    // Remove and dispose resource markers
    resourceMarkers.forEach(marker => {
        scene.remove(marker);
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) marker.material.dispose();
    });
    resourceMarkers = [];
    
    // Remove and dispose tier labels
    tierLabels.forEach(label => {
        scene.remove(label);
        if (label.material && label.material.map) label.material.map.dispose();
        if (label.material) label.material.dispose();
    });
    tierLabels = [];

    // Remove histogram bars
    histogramBars.forEach(bar => {
        scene.remove(bar);
        if (bar.geometry) bar.geometry.dispose();
        if (bar.material) bar.material.dispose();
    });
    histogramBars = [];
}

// Update the display based on current configuration
function updateMapDisplay() {
    console.log("Updating map display...");

    // Check if ANY tier is unselected by comparing the length of selected tiers
    // to the total number of possible tiers (7 tiers: S, A, B, C, D, E, F)
    const anyTierUnselected = config.selectedTiers.length < 7;
    
    // Force a complete update of ALL hexagons
    hexagons.forEach((hex, index) => {
        if (!hex || !hex.material) {
            console.warn(`Skipping invalid hexagon at index ${index}`);
            return; // Skip invalid hexagons
        }
        
        const tile = hex.userData.tile;
        if (!tile) {
            console.warn(`Hexagon at index ${index} has no tile data`);
            return; // Skip tiles with missing data
        }
        
        // Determine if this is an ocean or ice tile
        const isOceanOrIce = (tile.terrain === 'TERRAIN_OCEAN' || 
                              tile.feature === 'FEATURE_ICE');
        
        // Default to full opacity
        let opacity = 1.0;
        
        // Apply opacity based on tier selection
        if (tile.tier && !config.selectedTiers.includes(tile.tier)) {
            // Tier exists but is not selected
            opacity = 0.15;
        } 
        else if (isOceanOrIce && anyTierUnselected) {
            // Ocean or ice tile when any tier is filtered
            opacity = 0.2;
            
            // Debug logging for ocean tiles
            if (index % 100 === 0) {
                console.log(`Setting ocean/ice tile (${tile.x},${tile.y}) opacity to ${opacity}`);
            }
        }
        
        // Highlighting logic for top tiles
        if (config.highlightTopTiles && (tile.tier === 'S' || tile.tier === 'A')) {
            hex.material.emissive = new THREE.Color(0xffff00);
            hex.material.emissiveIntensity = 0.3;
            
            // Keep highlighted tiles more visible
            if (!config.selectedTiers.includes(tile.tier)) {
                opacity = 0.4;
            }
        } else {
            hex.material.emissive = new THREE.Color(0x000000);
            hex.material.emissiveIntensity = 0;
        }
        
        // Explicitly set material properties for ALL tiles to ensure updates
        hex.material.opacity = opacity;
        hex.material.transparent = opacity < 1.0;
        
        // Force material update
        hex.material.needsUpdate = true;
    });
    
    // Update resource marker visibility
    resourceMarkers.forEach(marker => {
        const tile = marker.userData.tile;
        
        // Only show if resources are enabled and tile's tier is selected
        let visible = config.showResources;
        
        if (tile.tier && !config.selectedTiers.includes(tile.tier)) {
            visible = false;
        }
        
        marker.visible = visible;
    });
    
    // Update tier label visibility
    tierLabels.forEach(label => {
        const tier = label.userData.tier;
        
        // Only show if labels are enabled and this tier is selected
        label.visible = config.showTierLabels && config.selectedTiers.includes(tier);
    });

    // Update histogram bar visibility
    histogramBars.forEach(bar => {
        const tile = bar.userData.tile;
        
        // Only show if histogram is enabled and tile's tier is selected
        let visible = config.showHistogram;
        
        if (tile.tier && !config.selectedTiers.includes(tile.tier)) {
            visible = false;
        }
        
        bar.visible = visible;
    });
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handle mouse movement for raycasting and tooltips
function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Only perform raycasting if we have hexagons to check against
    if (hexagons.length === 0) return;
    
    // Perform raycasting
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(hexagons);
    
    // If we were previously hovering over a hexagon, animate it back down
    if (hoveredHexagon && (!intersects.length || intersects[0].object !== hoveredHexagon)) {
        // Reset emissive color if it wasn't already highlighted
        if (!config.highlightTopTiles || 
            (hoveredHexagon.userData.tile.tier !== 'S' && 
                hoveredHexagon.userData.tile.tier !== 'A')) {
            hoveredHexagon.material.emissive = new THREE.Color(0x000000);
        }
        
        // Start animation to move back to original position
        hoveredHexagon.userData.animating = true;
        hoveredHexagon.userData.animationStart = performance.now();
        hoveredHexagon.userData.animationTarget = hoveredHexagon.userData.originalY;
        hoveredHexagon.userData.animationStartY = hoveredHexagon.position.y;
    }
    
    // Hide tooltip if no intersection
    const tooltipElement = document.getElementById('tooltip');
    
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const newHoveredHexagon = intersection.object;
        
        // If this is a new hexagon, start animation
        if (newHoveredHexagon !== hoveredHexagon) {
            newHoveredHexagon.userData.animating = true;
            newHoveredHexagon.userData.animationStart = performance.now();
            newHoveredHexagon.userData.animationStartY = newHoveredHexagon.position.y;
            newHoveredHexagon.userData.animationTarget = newHoveredHexagon.userData.originalY + 0.5; // Lift by 0.5 units
        }
        
        hoveredHexagon = newHoveredHexagon;
        const tile = hoveredHexagon.userData.tile;
        
        // Set hover emissive color unless it's already highlighted
        if (!config.highlightTopTiles || 
            (tile.tier !== 'S' && tile.tier !== 'A')) {
            hoveredHexagon.material.emissive = new THREE.Color(0x555555);
        }
        
        // Show tooltip (existing code)...
        // Update tooltip position to account for tile elevation
        if (tooltipElement) {
            tooltipElement.style.left = (event.clientX + 10) + 'px';
            tooltipElement.style.top = (event.clientY + 10) + 'px';
            tooltipElement.style.visibility = 'visible';
            
            tooltipElement.innerHTML = createTooltipContent(tile);
        }
    } else {
        hoveredHexagon = null;
        if (tooltipElement) {
            tooltipElement.style.visibility = 'hidden';
        }
    }
}

// Add this function to set up keyboard controls
function setupKeyboardControls() {
    // Keydown event listener
    window.addEventListener('keydown', function(event) {
        switch(event.key.toLowerCase()) {
            case 'w': keys.w = true; break;
            case 'a': keys.a = true; break;
            case 's': keys.s = true; break;
            case 'd': keys.d = true; break;
        }
    });
    
    // Keyup event listener
    window.addEventListener('keyup', function(event) {
        switch(event.key.toLowerCase()) {
            case 'w': keys.w = false; break;
            case 'a': keys.a = false; break;
            case 's': keys.s = false; break;
            case 'd': keys.d = false; break;
        }
    });
}

// Add this function to handle camera panning
function updateCameraPan() {
    // Get the camera's forward and right vectors
    let forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement on the horizontal plane
    forward.normalize();
    
    let right = new THREE.Vector3(forward.z, 0, -forward.x);
    
    // Calculate movement direction
    let moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (keys.w) moveDirection.add(forward);
    if (keys.s) moveDirection.sub(forward);
    if (keys.a) moveDirection.add(right);
    if (keys.d) moveDirection.sub(right);
    
    moveDirection.normalize();
    moveDirection.multiplyScalar(panSpeed);
    
    // Move both the camera and controls target
    if (moveDirection.length() > 0) {
        camera.position.add(moveDirection);
        controls.target.add(moveDirection);
    }
}

// Function to create a visually distinct histogram bar
function createHistogramBar(tile, position) {
    if (!tile.normalized_score) return null;
    
    // Scale the height based on the normalized score
    const height = tile.normalized_score * config.histogramHeightScale;
    
    // Create a thinner rectangular bar
    const geometry = new THREE.BoxGeometry(0.4, height, 0.4);
    
    // Get base color based on tier
    let baseColor;
    if (tile.tier && tierStyles[tile.tier]) {
        baseColor = new THREE.Color(tierStyles[tile.tier].color);
    } else {
        baseColor = new THREE.Color(defaultColor);
    }
    
    // Create a darker color for gradient base
    const darkColor = baseColor.clone().multiplyScalar(0.7);
    
    // Create a custom shader material with gradient
    const material = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            color1: { value: darkColor },
            color2: { value: baseColor },
            opacity: { value: 0.8 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float opacity;
            varying vec2 vUv;
            void main() {
                vec3 finalColor = mix(color1, color2, vUv.y);
                float edgeGlow = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
                finalColor = mix(finalColor, color2, 0.2 * edgeGlow);
                gl_FragColor = vec4(finalColor, opacity);
            }
        `
    });
    
    const bar = new THREE.Mesh(geometry, material);
    
    // Add glow effect with outer mesh
    const glowGeometry = new THREE.BoxGeometry(0.5, height * 1.02, 0.5);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    bar.add(glow);
    
    // Position bar above the tile
    const tileElevation = calculateElevation(tile);
    bar.position.set(
        position.x, 
        position.y + config.hexHeight + tileElevation + (height / 2), 
        position.z
    );
    
    // Store reference to the tile
    bar.userData.tile = tile;
    bar.userData.originalY = bar.position.y;
    
    // Add animation properties for top-tier tiles
    if (tile.tier === 'S' || tile.tier === 'A') {
        bar.userData.animate = true;
        bar.userData.animationPhase = Math.random() * Math.PI * 2; // Random start phase
    }
    
    return bar;
}

// Create tooltip content HTML
function createTooltipContent(tile) {
    let html = `
        <h4>Tile (${tile.x}, ${tile.y})</h4>
        <p><strong>Terrain:</strong> ${formatTerrainName(tile.terrain)}</p>
    `;
    
    if (tile.feature) {
        html += `<p><strong>Feature:</strong> ${formatFeatureName(tile.feature)}</p>`;
    }
    
    if (tile.resource) {
        html += `<p><strong>Resource:</strong> ${formatResourceName(tile.resource)}</p>`;
    }
    
    if (tile.continent) {
        html += `<p><strong>Continent:</strong> ${tile.continent}</p>`;
    }
    
    if (tile.appeal !== undefined) {
        html += `<p><strong>Appeal:</strong> ${tile.appeal}</p>`;
    }
    
    if (tile.normalized_score !== undefined) {
        html += `<p><strong>Score:</strong> ${tile.normalized_score.toFixed(1)}</p>`;
    }
    
    if (tile.tier) {
        html += `<p><strong>Tier:</strong> ${tile.tier}</p>`;
    }
    
    return html;
}

// Format terrain name for display (remove prefix and convert to title case)
function formatTerrainName(terrain) {
    if (!terrain) return 'Unknown';
    return terrain
        .replace('TERRAIN_', '')
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

// Format feature name for display
function formatFeatureName(feature) {
    if (!feature) return 'None';
    return feature
        .replace('FEATURE_', '')
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

// Format resource name for display
function formatResourceName(resource) {
    if (!resource) return 'None';
    return resource
        .replace('RESOURCE_', '')
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update camera position based on keyboard input
    updateCameraPan();

    // Animate histogram bars
    if (config.showHistogram) {
        const time = performance.now() * 0.001; // Time in seconds
        histogramBars.forEach(bar => {
            if (bar.userData.animate) {
                // Subtle floating animation for top tiers
                bar.position.y = bar.userData.originalY + Math.sin(time + bar.userData.animationPhase) * 0.1;
                
                // Pulse glow effect
                if (bar.children.length > 0) {
                    const glow = bar.children[0];
                    const pulseScale = 1 + Math.sin(time * 2 + bar.userData.animationPhase) * 0.05;
                    glow.scale.set(pulseScale, 1, pulseScale);
                    
                    // Adjust glow opacity
                    glow.material.opacity = 0.3 + Math.sin(time * 3 + bar.userData.animationPhase) * 0.1;
                }
            }
        });
    }
    const deltaTime = clock.getDelta();
    
    // Update boat animation
    updateBoat(deltaTime);

        
    // Update hexagon hover animations
    const currentTime = performance.now();
    hexagons.forEach(hex => {
        if (hex.userData.animating) {
            // Calculate animation progress (500ms duration)
            const elapsed = currentTime - hex.userData.animationStart;
            const duration = 500; // 500ms for the animation
            const progress = Math.min(elapsed / duration, 1.0);
            
            if (progress < 1.0) {
                // Use an easing function for smoother motion
                const eased = easeOutQuad(progress);
                
                // Get previous position for calculating change
                const previousY = hex.position.y;
                
                // Interpolate between start and target positions
                hex.position.y = hex.userData.animationStartY + 
                    (hex.userData.animationTarget - hex.userData.animationStartY) * eased;
                
                // Calculate how much the position changed
                const deltaY = hex.position.y - previousY;
                
                // Update the tier label position if it exists
                if (hex.userData.tierLabel) {
                    hex.userData.tierLabel.position.y += deltaY;
                }
            } else {
                // Animation complete
                hex.position.y = hex.userData.animationTarget;
                hex.userData.animating = false;
            }
        }
    });
    
    if (controls) controls.update();
    renderer.render(scene, camera);
}

// Add a simple easing function
function easeOutQuad(t) {
    return t * (2 - t);
}

// Load map data from server
function loadMapData(url) {
    console.log("Loading map data from:", url);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Loaded map data successfully, sample tile:', data.tiles[0]);
            createMapVisualization(data);
        })
        .catch(error => {
            console.error('Error loading map data:', error);
            // Display error message
            document.getElementById('map-container').innerHTML += `
                <div class="error-message">
                    <h3>Error Loading Map Data</h3>
                    <p>${error.message}</p>
                    <p>Please ensure that the data file exists and is valid JSON.</p>
                </div>
            `;
        });
}

// Initialize when the window loads
window.addEventListener('load', function() {
    console.log("Window loaded, initializing Three.js");
    init();
    
    // Use a small timeout to ensure the DOM is fully ready
    setTimeout(function() {
        // Try to load the data from the JSON file
        console.log("Attempting to load map data...");
        loadMapData('civ_map_data.json');
    }, 500);
});

// BOAT FUNCTIONS
// Function to create a cute boat model
function createBoat() {
    // Create boat container
    const boatGroup = new THREE.Group();
    
    // Create boat hull (tapered box)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-0.4, -0.75);
    hullShape.lineTo(0.4, -0.75);
    hullShape.lineTo(0.3, 0.75);
    hullShape.lineTo(-0.3, 0.75);
    hullShape.lineTo(-0.4, -0.75);
    
    const extrudeSettings = {
        steps: 1,
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 3
    };
    
    const hullGeometry = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
    hullGeometry.rotateX(Math.PI / 2);
    
    const hullMaterial = new THREE.MeshLambertMaterial({ color: 0x3366cc });
    const hull = new THREE.Mesh(hullGeometry, hullMaterial);
    boatGroup.add(hull);
    
    // Add cabin
    const cabinGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.3);
    const cabinMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(0, 0.15, 0);
    boatGroup.add(cabin);
    
    // Add smokestack
    const stackGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8);
    const stackMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const smokestack = new THREE.Mesh(stackGeometry, stackMaterial);
    smokestack.position.set(0, 0.25, -0.1);
    boatGroup.add(smokestack);
    
    // Create sail
    const sailGeometry = new THREE.ConeGeometry(0.3, 0.6, 32);
    sailGeometry.rotateX(Math.PI / 2);
    const sailMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xffffff,
        side: THREE.DoubleSide
    });
    const sail = new THREE.Mesh(sailGeometry, sailMaterial);
    sail.position.set(0, 0.3, 0.1);
    sail.rotation.x = Math.PI / 8;
    boatGroup.add(sail);
    
    // Create wake particles
    const wakeGeometry = new THREE.BufferGeometry();
    const wakeVertices = [];
    const wakeColors = [];
    
    // Create wake particle system
    for (let i = 0; i < 30; i++) {
        wakeVertices.push(0, 0, 0); // Initial positions will be updated
        // Slightly blue-tinted white color with alpha
        wakeColors.push(0.9, 0.95, 1, 1);
    }
    
    wakeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wakeVertices, 3));
    wakeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(wakeColors, 4));
    
    const wakeMaterial = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        depthWrite: false
    });
    
    boatWake = new THREE.Points(wakeGeometry, wakeMaterial);
    scene.add(boatWake); // Add directly to scene for easier management
    
    return boatGroup;
}

function findOceanTiles() {
    const oceanTiles = hexagons.filter(hex => {
        const tile = hex.userData.tile;
        return tile && (tile.terrain === 'TERRAIN_OCEAN' || tile.terrain === 'TERRAIN_COAST');
    });
    
    console.log(`Found ${oceanTiles.length} ocean tiles out of ${hexagons.length} total tiles`);
    
    if (oceanTiles.length === 0) {
        // Check why no ocean tiles are found
        console.log("Terrain types in map:");
        const terrainTypes = {};
        hexagons.forEach(hex => {
            const terrain = hex.userData.tile.terrain;
            terrainTypes[terrain] = (terrainTypes[terrain] || 0) + 1;
        });
        console.log(terrainTypes);
    }
    
    return oceanTiles;
}

// Function to find neighboring ocean tiles
function findNearestOceanTiles(position, exclude = []) {
    const oceanTiles = findOceanTiles();
    console.log("Found", oceanTiles.length, "ocean tiles");
    
    // First try with exclusion
    let candidates = oceanTiles
        .filter(hex => !exclude.includes(hex))
        .sort((a, b) => {
            const distA = position.distanceTo(a.position);
            const distB = position.distanceTo(b.position);
            return distA - distB;
        });
    
    // If we got zero candidates, ignore the exclusion
    if (candidates.length === 0) {
        console.log("No candidates with exclusion, taking any ocean tile");
        candidates = oceanTiles.sort((a, b) => {
            const distA = position.distanceTo(a.position);
            const distB = position.distanceTo(b.position);
            return distA - distB;
        });
    }
    
    return candidates;
}

// Find a path for the boat to follow
function generateBoatPath(startTile = null) {
    const oceanTiles = findOceanTiles();
    if (oceanTiles.length === 0) return [];
    
    // Start from a random ocean tile if none specified
    if (!startTile) {
        startTile = oceanTiles[Math.floor(Math.random() * oceanTiles.length)];
    }
    
    const path = [startTile];
    const pathLength = 15 + Math.floor(Math.random() * 10); // Path of 15-25 points
    
    for (let i = 1; i < pathLength; i++) {
        const lastTile = path[path.length - 1];
        // Find the 5 nearest ocean tiles not in recent path
        const recentPath = path.slice(Math.max(0, path.length - 5));
        const candidates = findNearestOceanTiles(lastTile.position, recentPath).slice(0, 5);
        
        if (candidates.length === 0) break;
        
        // Choose a random tile from candidates
        const nextTile = candidates[Math.floor(Math.random() * candidates.length)];
        path.push(nextTile);
    }
    
    return path;
}

// Initialize the boat
function initBoat() {
    // Create and add boat to scene
    boat = createBoat();
    scene.add(boat);
    
    // Generate initial path
    boatPath = generateBoatPath();
    if (boatPath.length === 0) {
        console.warn("No ocean tiles found for boat path");
        return;
    }
    
    // Position boat at first path point
    const startTile = boatPath[0];
    boat.position.copy(startTile.position);
    boat.position.y += 0.6; // Increased from 0.2 for better visibility
    boatTargetIndex = 1; // Start moving to the second point
}

// Then modify the updateBoat function:
function updateBoat(deltaTime) {
    if (!boat || !config.showBoat || boatPath.length <= 1) return;
    
    // Current target position
    if (boatTargetIndex >= boatPath.length) {
        // Generate new path from last position
        const lastTile = boatPath[boatPath.length - 1];
        boatPath = generateBoatPath(lastTile);
        boatTargetIndex = 0;
        interpolationFactor = 0; // Reset interpolation
        
        if (boatPath.length <= 1) return;
    }
    
    // Get current and next path points
    const currentIndex = Math.max(0, boatTargetIndex - 1);
    currentPathPoint.copy(boatPath[currentIndex].position);
    currentPathPoint.y = 0.6; // Keep consistent height
    
    nextPathPoint.copy(boatPath[boatTargetIndex].position);
    nextPathPoint.y = 0.6;
    
    // Interpolate position for smoother movement
    interpolationFactor += deltaTime * 0.2; // Slow interpolation speed
    if (interpolationFactor > 1) {
        interpolationFactor = 0;
        boatTargetIndex++;
        return; // Skip this frame to reset interpolation
    }
    
    // Use smooth easing function for more natural movement
    const ease = smoothStep(interpolationFactor);
    
    // Interpolate position
    const targetPosition = new THREE.Vector3();
    targetPosition.lerpVectors(currentPathPoint, nextPathPoint, ease);
    
    // Calculate direction to face
    const direction = new THREE.Vector3().subVectors(nextPathPoint, currentPathPoint);
    
    // Make boat face direction of travel
    if (direction.length() > 0.01) {
        const angle = Math.atan2(direction.x, direction.z);
        // Smooth rotation
        const currentRotation = boat.rotation.y;
        const targetRotation = angle;
        boat.rotation.y = lerpAngle(currentRotation, targetRotation, deltaTime * 2);
    }
    
    // Set boat position
    boat.position.copy(targetPosition);
    
    // Add bobbing animation
    const time = performance.now() * 0.001;
    boat.position.y = 0.6 + Math.sin(time * 0.8) * 0.08;
    boat.rotation.z = Math.sin(time * 0.4) * 0.06;
    boat.rotation.x = Math.sin(time * 0.6) * 0.04;
    
    // Update wake particles
    if (time - lastWakeTime > 0.2) {
        updateWake(time);
        lastWakeTime = time;
    }
}

// Update wake particles
function updateWake(time) {
    if (!boatWake || !boat) return;
    
    // Only add wake particles periodically
    if (time - lastWakeTime > 0.1) {
        lastWakeTime = time;
        
        // Get positions attribute
        const positions = boatWake.geometry.attributes.position;
        const colors = boatWake.geometry.attributes.color;
        
        // Shift all existing particles back
        for (let i = positions.count - 1; i > 0; i--) {
            // Move back one position
            positions.setXYZ(
                i,
                positions.getX(i-1),
                positions.getY(i-1),
                positions.getZ(i-1)
            );
            
            // Fade color over time
            const alpha = Math.max(0, colors.getW(i) - 0.03);
            colors.setW(i, alpha);
        }
        
        // Add new particle at boat position
        const boatPos = boat.position.clone();
        // Slightly below boat and offset back
        boatPos.y -= 0.1;
        
        // Get direction boat is facing
        const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(boat.quaternion);
        boatPos.add(backward.multiplyScalar(0.5));
        
        // Set first particle to boat position with small random offsets
        positions.setXYZ(
            0, 
            boatPos.x + (Math.random() - 0.5) * 0.1,
            boatPos.y,
            boatPos.z + (Math.random() - 0.5) * 0.1
        );
        colors.setW(0, 1); // Full opacity for new particles
        
        // Mark attributes for update
        positions.needsUpdate = true;
        colors.needsUpdate = true;
    }
}

function smoothStep(x) {
    // Smoother transition with cubic easing
    return x * x * (3 - 2 * x);
}

function lerpAngle(start, end, t) {
    // Handle angle interpolation properly
    const shortestAngle = ((((end - start) % (2 * Math.PI)) + (3 * Math.PI)) % (2 * Math.PI)) - Math.PI;
    return start + shortestAngle * Math.min(1, t);
}