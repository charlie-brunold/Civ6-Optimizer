// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Configuration for our hexagon grid
    const config = {
        width: document.getElementById('hex-grid').clientWidth,
        height: document.getElementById('hex-grid').clientHeight,
        hexRadius: 30,      // Size of each hexagon
        gridWidth: 10,      // Number of hexagons horizontally
        gridHeight: 10,     // Number of hexagons vertically
        margin: 50          // Margin around the grid
    };

    // Initialize the SVG container
    const svg = d3.select('#hex-grid')
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height)
        .attr('viewBox', [0, 0, config.width, config.height])
        .attr('style', 'max-width: 100%; height: auto;');

    // Create a group for panning and zooming
    const g = svg.append('g');

    // Define color scale for different terrain types
    const terrainTypes = [
        'GRASS', 'PLAINS', 'DESERT', 'TUNDRA', 
        'SNOW', 'COAST', 'OCEAN', 'MOUNTAIN'
    ];
    
    const colorScale = d3.scaleOrdinal()
        .domain(terrainTypes)
        .range([
            '#7cbb58', // GRASS (green)
            '#e0c88a', // PLAINS (tan)
            '#e8d06c', // DESERT (yellow)
            '#d0d0d0', // TUNDRA (light gray)
            '#ffffff', // SNOW (white)
            '#2389da', // COAST (light blue)
            '#0a5d9a', // OCEAN (dark blue)
            '#8c5e3b'  // MOUNTAIN (brown)
        ]);

    // Create a function to generate hexagon vertices
    function hexagonPoints(d) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = 2 * Math.PI / 6 * i;
            points.push([
                d.x + config.hexRadius * Math.cos(angle),
                d.y + config.hexRadius * Math.sin(angle)
            ]);
        }
        return points.map(p => p.join(',')).join(' ');
    }

    // Generate hexagon grid data
    function generateHexGrid() {
        const hexagons = [];
        // We need to offset every other row to create the hexagon pattern
        const rowOffset = config.hexRadius * Math.cos(Math.PI/6);
        const colHeight = config.hexRadius * 1.5; // Vertical distance between rows
        
        for (let row = 0; row < config.gridHeight; row++) {
            for (let col = 0; col < config.gridWidth; col++) {
                // Position each hexagon
                const x = config.margin + col * (config.hexRadius * 1.75);
                const y = config.margin + row * colHeight;
                
                // Offset every other row
                const xPos = x + (row % 2 === 1 ? config.hexRadius * 0.875 : 0);
                
                // Randomly assign a terrain type
                const terrain = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
                
                hexagons.push({
                    x: xPos,
                    y: y,
                    terrain: terrain,
                    row: row,
                    col: col
                });
            }
        }
        return hexagons;
    }

    // Generate our grid data
    const hexagons = generateHexGrid();

    // Draw the hexagons
    g.selectAll('.hexagon')
        .data(hexagons)
        .enter()
        .append('polygon')
        .attr('class', 'hexagon')
        .attr('points', hexagonPoints)
        .attr('fill', d => colorScale(d.terrain))
        .on('mouseover', function(event, d) {
            // Show tooltip or highlight on mouseover
            d3.select(this).attr('stroke-width', 2);
            
            // You could add a tooltip here
            console.log(`Hex at (${d.col}, ${d.row}): ${d.terrain}`);
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', 0.5);
        });

    // Define zoom behavior that maintains hexagon size
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5])  // Limit zoom level between 0.5x and 5x
        .on('zoom', zoomed);

    // Apply zoom behavior to the SVG
    svg.call(zoom);

    // Zoom function that handles the transformation
    function zoomed(event) {
        g.attr('transform', event.transform);
    }

    // Set up button controls
    document.getElementById('zoom-in').addEventListener('click', function() {
        svg.transition().call(zoom.scaleBy, 1.3);
    });

    document.getElementById('zoom-out').addEventListener('click', function() {
        svg.transition().call(zoom.scaleBy, 0.7);
    });

    document.getElementById('reset').addEventListener('click', function() {
        svg.transition().call(zoom.transform, d3.zoomIdentity);
    });
});
