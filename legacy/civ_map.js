// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const config = {
        width: document.getElementById('hex-grid').clientWidth,
        height: document.getElementById('hex-grid').clientHeight,
        hexRadius: 20,      // Base size of each hexagon
        margin: 50,         // Margin around the grid
        dataFile: 'civ_map_data.json'  // Path to your JSON data file
    };

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
        'Luxury': { color: '#9c27b0', radius: 4 },
        'Strategic': { color: '#f44336', radius: 4 },
        'Bonus': { color: '#4caf50', radius: 4 },
        'default': { color: '#ff9800', radius: 4 }
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

    // Create canvas and interaction layer
    // Create a canvas element for rendering
    const canvas = d3.select('#hex-grid')
        .append('canvas')
        .attr('width', config.width)
        .attr('height', config.height)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .node();

    const ctx = canvas.getContext('2d');

    // Create an invisible SVG layer on top for interactions
    const svg = d3.select('#hex-grid')
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .style('pointer-events', 'none') // Initially disable pointer events on SVG
        .attr('viewBox', [0, 0, config.width, config.height]);

    // Create interaction group for invisible interactive elements
    const interactionGroup = svg.append('g').attr('class', 'interaction-group');
    
    // Create group for tier labels
    const labelGroup = svg.append('g').attr('class', 'label-group');

    // Tooltip element
    const tooltip = d3.select('#tooltip');

    // State variables
    let mapData = null;
    let selectedTiers = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
    let showTierLabels = true;
    let highlightTopTiles = false;
    let currentTransform = d3.zoomIdentity;

    // Function to calculate hexagon points for flat-topped hexagons (Civilization style)
    function hexagonPoints(d) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            // Start at 30° to create flat-topped hexagons
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            points.push([
                d.x + config.hexRadius * Math.cos(angle),
                d.y + config.hexRadius * Math.sin(angle)
            ]);
        }
        return points.map(p => p.join(',')).join(' ');
    }
    
    // Function to draw a hexagon on canvas
    function drawHexagon(ctx, x, y, radius, fillColor, strokeColor, strokeWidth, transform) {
        ctx.save();
        
        // Apply transformations if needed
        if (transform) {
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.k, transform.k);
            ctx.translate(-transform.x, -transform.y);
        }
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            // Flat-topped hexagons (Civilization style) - start at 30°
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            const hx = x + radius * Math.cos(angle);
            const hy = y + radius * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(hx, hy);
            } else {
                ctx.lineTo(hx, hy);
            }
        }
        ctx.closePath();
        
        // Fill
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // Stroke
        if (strokeColor && strokeWidth) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // Function to draw a circle on canvas (for resource markers)
    function drawCircle(ctx, x, y, radius, fillColor, strokeColor, strokeWidth, transform) {
        ctx.save();
        
        // Apply transformations if needed
        if (transform) {
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.k, transform.k);
            ctx.translate(-transform.x, -transform.y);
        }
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        
        // Fill
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // Stroke
        if (strokeColor && strokeWidth) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // Function to calculate hexagon position for perfect grid layout
    function calculateHexPosition(tile, metadata) {
        // Calculate hex grid coordinates
        // For flat-topped hexagons with perfect alignment
        const hexWidth = config.hexRadius * 2;
        // The height of a hexagon is distance from center to opposite center
        const hexHeight = Math.sqrt(3) * config.hexRadius;
        // The vertical distance between rows (center-to-center)
        const rowHeight = hexHeight * 0.85; // This makes rows touch properly
        
        // Calculate row and column based on coordinates
        const col = tile.x - metadata.min_x;
        const row = tile.y - metadata.min_y;
        
        // Calculate base position for the tile
        // Horizontal spacing is 3/4 of the hex width to create perfect alignment
        const xPos = config.margin + col * (hexWidth * 0.85);
        // Apply precise vertical spacing to ensure rows touch without gaps
        const yPos = config.margin + row * rowHeight;
        
        // Apply offset for every even row to create interlocking pattern
        const offset = (row % 2 === 0) ? hexWidth * 0.420 : 0;
        
        return {
            x: xPos + offset,
            y: yPos
        };
    }

    // Load data and initialize the visualization
    d3.json(config.dataFile).then(data => {
        console.log('Loaded map data:', data);
        mapData = data;
        
        // Process the tiles to add position information
        mapData.tiles.forEach(tile => {
            const position = calculateHexPosition(tile, mapData.metadata);
            tile.displayX = position.x;
            tile.displayY = position.y;
        });
        
        // Now initialize the visualization
        initializeVisualization();
        
        // Create legends
        createTerrainLegend();
        createResourceLegend();
        createTierLegend();
    }).catch(error => {
        console.error('Error loading map data:', error);
        // Display error message on the page
        d3.select('#hex-grid')
            .append('div')
            .attr('class', 'error-message')
            .html(`<h3>Error Loading Map Data</h3>
                   <p>${error.message}</p>
                   <p>Please ensure that ${config.dataFile} exists and is valid JSON.</p>`);
    });

    // Initialize the visualization with the loaded data
    function initializeVisualization() {
        // Add a mouse move listener to the entire canvas container
        d3.select('#hex-grid').on('mousemove', function(event) {
            // Get mouse position relative to the canvas
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            // Convert screen coordinates to canvas coordinates
            const [canvasX, canvasY] = screenToCanvasCoordinates(mouseX, mouseY);
            
            // Find the tile at this position
            const hoveredTile = findTileAtCanvasCoordinates(canvasX, canvasY);
            
            if (hoveredTile) {
                // Redraw the entire view
                drawCurrentView();
                
                // Draw highlight for the hovered tile
                ctx.save();
                ctx.translate(currentTransform.x, currentTransform.y);
                ctx.scale(currentTransform.k, currentTransform.k);
                
                // Draw highlight
                drawHexagon(
                    ctx, 
                    hoveredTile.displayX, 
                    hoveredTile.displayY, 
                    config.hexRadius, 
                    terrainColors[hoveredTile.terrain] || defaultColor,
                    '#fff', // Highlight color
                    2 / currentTransform.k, // Thinner stroke at higher zoom levels
                    null // No additional transform needed
                );
                
                ctx.restore();
                
                // Show tooltip
                showTooltip(event, hoveredTile);
            } else {
                // No tile under cursor, redraw without highlight
                drawCurrentView();
                hideTooltip();
            }
        });

        // Add mouseout handler to clear highlight when mouse leaves
        d3.select('#hex-grid').on('mouseout', function() {
            drawCurrentView();
            hideTooltip();
        });

        // Add tier labels
        labelGroup.selectAll('.tier-label')
            .data(mapData.tiles.filter(d => d.tier))
            .enter()
            .append('text')
            .attr('class', 'tier-label')
            .attr('data-tier', d => d.tier)
            .attr('x', d => d.displayX)
            .attr('y', d => d.displayY)
            .attr('fill', d => tierStyles[d.tier]?.textColor || 'black')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .style('pointer-events', 'none')
            .text(d => d.tier);

        // Set up zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 5])  // Limit zoom level
            .on('zoom', zoomed);

        d3.select('#hex-grid').call(zoom);

        // Initial draw of the visualization
        drawCurrentView();
        updateVisualization();
    }

    // Function to find the tile at specific canvas coordinates
    function findTileAtCanvasCoordinates(x, y) {
        if (!mapData || !mapData.tiles) return null;
        
        // Find the closest tile to these coordinates
        let closestTile = null;
        let minDistance = Infinity;
        
        mapData.tiles.forEach(tile => {
            const dx = tile.displayX - x;
            const dy = tile.displayY - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Consider a tile "hit" if mouse is within a certain distance of center
            // Using a slightly smaller radius than the actual hexagon for better precision
            if (distance < config.hexRadius * 0.8 && distance < minDistance) {
                minDistance = distance;
                closestTile = tile;
            }
        });
        
        return closestTile;
    }

    // Add this function to convert screen coordinates to untransformed canvas coordinates
    function screenToCanvasCoordinates(screenX, screenY) {
        // Invert the current transformation to get the original canvas coordinates
        return currentTransform.invert([screenX, screenY]);
    }

    // Function to find the tile at a specific position considering the current transform
    function findTileAtPosition(x, y, transform) {
        // Invert the transform to get the coordinates in the original space
        const [origX, origY] = transform.invert([x, y]);
        
        // Find the tile closest to this position
        let closestTile = null;
        let minDistance = Infinity;
        
        mapData.tiles.forEach(tile => {
            const dx = tile.displayX - origX;
            const dy = tile.displayY - origY;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Only consider tiles within the hexagon radius
            if (distance < config.hexRadius && distance < minDistance) {
                minDistance = distance;
                closestTile = tile;
            }
        });
        
        return closestTile;
    }

    // Add this function to find the tile at mouse position
    function findTileAtCoordinates(mouseX, mouseY) {
        if (!mapData || !mapData.tiles) return null;
        
        // Convert mouse coordinates back to untransformed space
        const [x, y] = currentTransform.invert([mouseX, mouseY]);
        
        // Find the closest tile
        let closestTile = null;
        let minDistance = Infinity;
        
        mapData.tiles.forEach(tile => {
            const dx = tile.displayX - x;
            const dy = tile.displayY - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < config.hexRadius * 1.2 && distance < minDistance) {
                minDistance = distance;
                closestTile = tile;
            }
        });
        
        return closestTile;
    }

    // Function to draw the current view based on state
    function drawCurrentView() {
        // Clear the canvas
        ctx.clearRect(0, 0, config.width, config.height);
        
        // Apply the current transform
        ctx.save();
        ctx.translate(currentTransform.x, currentTransform.y);
        ctx.scale(currentTransform.k, currentTransform.k);
        
        // Draw all hexagons
        mapData.tiles.forEach(tile => {
            // Determine opacity based on tier filtering
        let opacity = 1;
        // Check if any tiers are selected at all
        const anyTierSelected = selectedTiers.length > 0;
        // If it's an ocean tile and we're filtering (some tiers not selected), make it transparent
        const isOcean = tile.terrain === 'TERRAIN_OCEAN' || tile.feature === 'FEATURE_ICE';
        if (tile.tier && !selectedTiers.includes(tile.tier)) {
            opacity = 0.2;
        } else if (!tile.tier) {
            // For tiles without tiers (like ocean)
            // If we're filtering by tiers and this is an ocean, reduce opacity
            if (anyTierSelected && isOcean && selectedTiers.length < 7) {
                opacity = 0.2;
            } else {
                opacity = 0.5;
            }
        }
            
            // Determine if this is a highlighted top-tier tile
            const isHighlighted = highlightTopTiles && (tile.tier === 'S' || tile.tier === 'A');
            
            // Determine fill color with opacity
            const baseColor = terrainColors[tile.terrain] || defaultColor;
            const fillColor = adjustColorOpacity(baseColor, opacity);
            
            // Draw the hexagon
            drawHexagon(
                ctx,
                tile.displayX,
                tile.displayY,
                config.hexRadius,
                fillColor,
                isHighlighted ? '#ffcc00' : '#444',
                isHighlighted ? 2 / currentTransform.k : 0.5 / currentTransform.k
            );
            
            // Draw resource marker if present
            if (tile.resource) {
                const style = resourceStyles[tile.resourcetype] || resourceStyles.default;
                drawCircle(
                    ctx,
                    tile.displayX,
                    tile.displayY,
                    style.radius / currentTransform.k,
                    style.color,
                    '#fff',
                    1 / currentTransform.k
                );
            }
        });
        
        ctx.restore();
    }
    
    // Function to adjust color opacity
    function adjustColorOpacity(color, opacity) {
        // Handle hex colors
        if (color.startsWith('#')) {
            // Convert hex to rgba
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r},${g},${b},${opacity})`;
        }
        // Handle rgb/rgba colors
        else if (color.startsWith('rgb')) {
            if (color.startsWith('rgba')) {
                // Already has alpha channel, replace it
                return color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d\.]+\)/, `rgba($1,$2,$3,${opacity})`);
            } else {
                // Convert rgb to rgba
                return color.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, `rgba($1,$2,$3,${opacity})`);
            }
        }
        return color; // Return unchanged if format not recognized
    }

    // Set up zoom behavior
    const zoom = d3.zoom()
    .scaleExtent([0.5, 5])  // Limit zoom level
    .on('zoom', zoomed);

    // Apply zoom behavior to the entire container
    d3.select('#hex-grid').call(zoom);

    // Zoom behavior
    function zoomed(event) {
    // Store the current transform
    currentTransform = event.transform;

    // Update SVG transform for labels (no longer need interaction group)
    labelGroup.attr('transform', event.transform);

    // Update label font size based on zoom
    labelGroup.selectAll('.tier-label')
        .style('font-size', `${12 / event.transform.k}px`);

    // Redraw the canvas with the new transform
    drawCurrentView();
    }

    // Show tooltip with tile information
    function showTooltip(event, d) {
        let html = `
            <h4>Tile (${d.x}, ${d.y})</h4>
            <p><strong>Terrain:</strong> ${formatTerrainName(d.terrain)}</p>
        `;

        if (d.feature) {
            html += `<p><strong>Feature:</strong> ${formatFeatureName(d.feature)}</p>`;
        }

        if (d.resource) {
            html += `<p><strong>Resource:</strong> ${formatResourceName(d.resource)}</p>`;
        }

        if (d.continent) {
            html += `<p><strong>Continent:</strong> ${d.continent}</p>`;
        }

        if (d.appeal !== undefined) {
            html += `<p><strong>Appeal:</strong> ${d.appeal}</p>`;
        }

        if (d.normalized_score !== undefined) {
            html += `<p><strong>Score:</strong> ${d.normalized_score.toFixed(1)}</p>`;
        }

        if (d.tier) {
            html += `<p><strong>Tier:</strong> ${d.tier}</p>`;
        }

        tooltip
            .html(html)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px')
            .style('visibility', 'visible');
    }

    // Hide tooltip
    function hideTooltip() {
        tooltip.style('visibility', 'hidden');
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

    // Create terrain legend
    function createTerrainLegend() {
        const legendContainer = d3.select('#terrain-legend');
        const terrainEntries = Object.entries(terrainColors);
        
        // Sort terrain types alphabetically
        terrainEntries.sort((a, b) => {
            return formatTerrainName(a[0]).localeCompare(formatTerrainName(b[0]));
        });
        
        terrainEntries.forEach(([terrain, color]) => {
            const item = legendContainer.append('div')
                .attr('class', 'legend-item');
                
            item.append('div')
                .attr('class', 'legend-color')
                .style('background-color', color);
                
            item.append('span')
                .text(formatTerrainName(terrain));
        });
    }

    // Create resource legend
    function createResourceLegend() {
        const legendContainer = d3.select('#resource-legend');
        
        // Create legend items for each resource type
        Object.entries(resourceStyles).forEach(([type, style]) => {
            if (type === 'default') return; // Skip the default entry
            
            const item = legendContainer.append('div')
                .attr('class', 'legend-item');
                
            item.append('div')
                .attr('class', 'legend-color')
                .style('background-color', style.color)
                .style('border-radius', '50%')
                .style('width', '15px')
                .style('height', '15px');
                
            item.append('span')
                .text(type);
        });
    }

    // Create tier legend
    function createTierLegend() {
        const legendContainer = d3.select('#tier-legend');
        
        // Create legend items for each tier
        Object.entries(tierStyles).forEach(([tier, style]) => {
            const item = legendContainer.append('div')
                .attr('class', 'tier-legend-item');
                
            item.append('div')
                .attr('class', `tier-symbol tier-${tier}`)
                .text(tier);
                
            // Add tier description with threshold if available
            let description = `Tier ${tier}`;
            if (mapData.metadata.tier_thresholds) {
                const thresholds = mapData.metadata.tier_thresholds;
                
                if (tier === 'S') {
                    description += ` (${thresholds[6]}+ points)`;
                } else if (tier === 'A') {
                    description += ` (${thresholds[5]}-${thresholds[6]-1} points)`;
                } else if (tier === 'B') {
                    description += ` (${thresholds[4]}-${thresholds[5]-1} points)`;
                } else if (tier === 'C') {
                    description += ` (${thresholds[3]}-${thresholds[4]-1} points)`;
                } else if (tier === 'D') {
                    description += ` (${thresholds[2]}-${thresholds[3]-1} points)`;
                } else if (tier === 'E') {
                    description += ` (${thresholds[1]}-${thresholds[2]-1} points)`;
                } else if (tier === 'F') {
                    description += ` (0-${thresholds[1]-1} points)`;
                }
            }
            
            item.append('span')
                .text(description);
        });
    }

    // Update visualization based on current state
    function updateVisualization() {
        // Update tier label visibility
        labelGroup.selectAll('.tier-label')
            .style('visibility', d => {
                if (!showTierLabels) return 'hidden';
                return selectedTiers.includes(d.tier) ? 'visible' : 'hidden';
            });
        
        // Redraw the canvas with current settings
        drawCurrentView();
    }

    // Set up event listeners for controls
    document.getElementById('zoom-in').addEventListener('click', function() {
        svg.transition().call(svg.zoom().scaleBy, 1.3);
    });

    document.getElementById('zoom-out').addEventListener('click', function() {
        svg.transition().call(svg.zoom().scaleBy, 0.7);
    });

    document.getElementById('reset').addEventListener('click', function() {
        svg.transition().call(svg.zoom().transform, d3.zoomIdentity);
    });

    document.getElementById('toggle-tier-labels').addEventListener('change', function() {
        showTierLabels = this.checked;
        updateVisualization();
    });

    document.getElementById('highlight-top-tiles').addEventListener('click', function() {
        highlightTopTiles = !highlightTopTiles;
        this.textContent = highlightTopTiles ? 'Reset Highlighting' : 'Highlight Top Tiles';
        this.classList.toggle('inactive', highlightTopTiles);
        updateVisualization();
    });

    // Set up event listeners for tier checkboxes
    document.querySelectorAll('.tier-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Update the selected tiers based on checkboxes
            selectedTiers = Array.from(document.querySelectorAll('.tier-checkbox:checked'))
                .map(cb => cb.value);
            
            updateVisualization();
        });
    });
});