import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
import folium
# import braca.colormap as cm
import webbrowser

def create_custom_civ_map(df):
    # First, make a copy of the dataframe to avoid modifying the original
    df_map = df.copy()
    
    # Remove any rows with NaN coordinates
    df_map = df_map.dropna(subset=['X', 'Y'])
    
    # Ensure we have data to work with
    if len(df_map) == 0:
        raise ValueError("No valid coordinate data found in the DataFrame")
    
    # Create a base map with no tiles
    m = folium.Map(
        location=[df['Y'].mean(), df['X'].mean()], 
        zoom_start=4,
        tiles=None,  # No background map
        control_scale=True
    )
    
    # Define more modern terrain colors with better contrast
    terrain_colors = {
        'TERRAIN_OCEAN': '#1a5f9e',       # Deeper blue
        'TERRAIN_COAST': '#4da6ff',       # Brighter blue
        'TERRAIN_PLAINS': '#e8d292',      # Slightly lighter tan
        'TERRAIN_GRASS': '#8bc34a',       # Modern green
        'TERRAIN_GRASS_HILLS': '#689f38', # Darker green
        'TERRAIN_DESERT_HILLS': '#ffd54f', # Warmer yellow
        'TERRAIN_TUNDRA': '#e0e0e0',      # Lighter gray
        'TERRAIN_TUNDRA_HILLS': '#bdbdbd', # Medium gray
        'TERRAIN_SNOW': '#f5f5f5',        # Off-white
        'TERRAIN_GRASS_MOUNTAIN': '#795548', # Rich brown
        'TERRAIN_PLAINS_MOUNTAIN': '#6d4c41', # Slightly darker brown
        'TERRAIN_DESERT_MOUNTAIN': '#5d4037', # Even darker brown
        'TERRAIN_TUNDRA_MOUNTAIN': '#4e342e', # Very dark brown
        'TERRAIN_SNOW_MOUNTAIN': '#3e2723', # Almost black brown
        'TERRAIN_PLAINS_HILLS': '#dbc773', # Lighter tan
        'TERRAIN_DESERT': '#ffc107'        # Amber
    }
    
    # Default color for unknown terrain
    default_color = '#a9a9a9'
    
    # Resource icon styles (adjust these as needed)
    # Update resource marker styles for more modern look
    resource_styles = {
        'Luxury': {'color': '#9c27b0', 'radius': 3, 'border_color': 'white', 'border_width': 1.5},
        'Strategic': {'color': '#f44336', 'radius': 3, 'border_color': 'white', 'border_width': 1.5},
        'Bonus': {'color': '#4caf50', 'radius': 3, 'border_color': 'white', 'border_width': 1.5},
        'default': {'color': '#ff9800', 'radius': 3, 'border_color': 'white', 'border_width': 1.5}
    }
    
    # Define tier border colors and styles
    tier_styles = {
        'S': {'border_color': '#ffcc00', 'border_width': 3, 'label_bg': '#ffcc00', 'label_color': 'black'},
        'A': {'border_color': '#ff8800', 'border_width': 3, 'label_bg': '#ff8800', 'label_color': 'black'},
        'B': {'border_color': '#66cc66', 'border_width': 2, 'label_bg': '#66cc66', 'label_color': 'black'},
        'C': {'border_color': '#6699cc', 'border_width': 2, 'label_bg': '#6699cc', 'label_color': 'black'},
        'D': {'border_color': '#cccccc', 'border_width': 1, 'label_bg': '#cccccc', 'label_color': 'black'},
        'E': {'border_color': '#999999', 'border_width': 1, 'label_bg': '#999999', 'label_color': 'black'},
        'F': {'border_color': '#666666', 'border_width': 1, 'label_bg': '#666666', 'label_color': 'white'}
    }
    
    # Determine tile size and offset parameters
    tile_size = 1
    hex_radius = tile_size * 13
    offset_amount = hex_radius * 0.04  # This creates the proper offset for hexagons
    row_spacing = 0.78  # Uniform spacing between rows (smaller = more squished)
    
    # Group data by Y coordinates to identify rows
    grouped_by_y = df.groupby('Y')
    unique_y_values = sorted(df['Y'].unique())

    # Create a mapping from original Y values to compressed Y positions
    # This ensures uniform spacing regardless of original Y values
    y_mapping = {y_val: i * row_spacing for i, y_val in enumerate(unique_y_values)}
    
    # Create hexagonal tiles with proper offset for every other row
    for i, y_value in enumerate(unique_y_values):
        row_data = df[df['Y'] == y_value]
        
        # Get the compressed Y position for this row
        compressed_y = y_mapping[y_value]

        # Determine if this row should be offset
        is_offset_row = i % 2 == 1
        
        for _, row in row_data.iterrows():
            # Calculate position with offset for odd-numbered rows
            x_pos = row['X']
            y_pos = compressed_y
            
            if is_offset_row:
                x_pos += offset_amount
            
            # Determine the terrain color
            terrain = row.get('Terrain', None)
            color = terrain_colors.get(terrain, default_color) if terrain else default_color
            
            # Get tile score and tier information if available
            normalized_score = row.get('normalized_score', None)
            tier = row.get('tier', None)
            
            # Set border style based on tile tier
            border_color = '#000'  # Default black border
            border_weight = 1      # Default border weight
            
            if tier is not None and tier in tier_styles:
                border_color = tier_styles[tier]['border_color']
                border_weight = tier_styles[tier]['border_width']
            
            # Create a tile at the specified coordinates
            folium.RegularPolygonMarker(
                location=[y_pos, x_pos],
                number_of_sides=6,
                radius=hex_radius,
                color=border_color,  # Border color based on tier
                weight=border_weight,  # Border weight based on tier
                fill_color=color,
                fill_opacity=0.85,
                rotation=28,
                popup=folium.Popup(
                    f"""
                    <b>Position:</b> ({row['X']}, {row['Y']})<br>
                    <b>Continent:</b> {row['Continent'] if pd.notna(row['Continent']) else 'None'}<br>
                    <b>Terrain:</b> {terrain}<br>
                    <b>Resource:</b> {row['Resource'] if pd.notna(row['Resource']) else 'None'}<br>
                    <b>Features:</b> {', '.join([feat for feat in ['Forest', 'Jungle', 'Hills'] 
                                               if feat in row and row[feat]])}<br>
                    <b>Score:</b> {normalized_score if normalized_score is not None else 'N/A'}<br>
                    <b>Tier:</b> {tier if tier is not None else 'N/A'}
                    """,
                    max_width=200
                ),
                tooltip=f"({row['X']}, {row['Y']}) - {tier if tier else 'No tier'}"  # Add tooltips for easier inspection
            ).add_to(m)
            
            # Add resource marker if present
            if pd.notna(row['Resource']):
                resource = row['Resource']
                
                # Determine resource category
                resource_type = row.get('ResourceType', None)
                if resource_type == 'Luxury':
                    style = resource_styles['Luxury']
                elif resource_type == 'Strategic':
                    style = resource_styles['Strategic']
                elif resource_type == 'Bonus':
                    style = resource_styles['Bonus']
                else:
                    style = resource_styles['default']
                
                # Add resource marker with the same offset
                folium.CircleMarker(
                    location=[y_pos, x_pos],
                    radius=style['radius'],
                    color=style['border_color'],
                    weight=style['border_width'],
                    fill=True,
                    fill_color=style['color'],
                    fill_opacity=1.0,
                    opacity=1.0
                ).add_to(m)
            
            # Modify existing tier label creation to add a class
            # In your loop where you create tier labels:
            if tier in ['S', 'A', 'B', 'C', 'D', 'E', 'F']:
                # Create a score label for high-tier tiles
                label_style = tier_styles[tier]
                # Update the tier label code to make it more modern
                folium.Marker(
                    location=[y_pos, x_pos],
                    icon=folium.DivIcon(
                        html=f"""
                        <div class="tier-label" data-tier="{tier}" style="
                            background-color: {label_style['label_bg']}; 
                            color: {label_style['label_color']};
                            border-radius: 50%;
                            width: 20px;
                            height: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: bold;
                            font-size: 12px;
                            border: 1px solid rgba(0,0,0,0.2);
                            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                            font-family: 'Arial', sans-serif;
                        ">{tier}</div>
                        """,
                        icon_size=(20, 20),
                        icon_anchor=(10, 10),
                    )
                ).add_to(m)
    
    # Update control panel HTML with checkboxes for tiers
    control_panel_html = """
    <div class="control-panel">
        <div class="control-title">Map Controls</div>
        
        <button id="toggle-tier-labels" class="control-button">Hide Tier Labels</button>
        
        <button id="toggle-resources" class="control-button">Hide Resources</button>
        
        <button id="highlight-top-tiles" class="control-button">Highlight Top Tiles</button>
        
        <div style="font-size: 12px; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Filter Tiers:</div>
        <div class="tier-checkboxes">
            <label><input type="checkbox" class="tier-checkbox" value="S" checked> S Tier</label>
            <label><input type="checkbox" class="tier-checkbox" value="A" checked> A Tier</label>
            <label><input type="checkbox" class="tier-checkbox" value="B" checked> B Tier</label>
            <label><input type="checkbox" class="tier-checkbox" value="C" checked> C Tier</label>
            <label><input type="checkbox" class="tier-checkbox" value="D" checked> D Tier</label>
            <label><input type="checkbox" class="tier-checkbox" value="E" checked> E Tier</label>
            <label><input type="checkbox" class="tier-checkbox" value="F" checked> F Tier</label>
        </div>
        <div style="margin-top: 5px;">
            <button id="select-all-tiers" class="mini-button">Select All</button>
            <button id="deselect-all-tiers" class="mini-button">Deselect All</button>
        </div>
    </div>
    """

    # Update your control_panel_css to include styles for checkboxes
    control_panel_css = """
    <style>
    .control-panel {
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 1000;
        background-color: white;
        padding: 10px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        max-width: 200px;
    }
    .control-title {
        font-weight: bold;
        text-align: center;
        margin-bottom: 8px;
        font-size: 14px;
    }
    .control-button {
        padding: 6px;
        margin: 3px 0;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        width: 100%;
        transition: background-color 0.3s;
        font-size: 12px;
    }
    .control-button:hover {
        background-color: #45a049;
    }
    .control-button.inactive {
        background-color: #f44336;
    }
    .control-button.inactive:hover {
        background-color: #d32f2f;
    }
    .tier-checkboxes {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
        margin-bottom: 5px;
    }
    .tier-checkboxes label {
        font-size: 12px;
        display: flex;
        align-items: center;
    }
    .tier-checkboxes input[type="checkbox"] {
        margin-right: 5px;
    }
    .mini-button {
        padding: 3px 6px;
        font-size: 11px;
        background-color: #e0e0e0;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
        margin-right: 5px;
    }
    .mini-button:hover {
        background-color: #d0d0d0;
    }
    </style>
    """

    # Update JavaScript to handle checkbox-based tier filtering
    control_panel_js = """
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Get references to buttons and controls
        var toggleTierLabelsBtn = document.getElementById('toggle-tier-labels');
        var toggleResourcesBtn = document.getElementById('toggle-resources');
        var highlightTopTilesBtn = document.getElementById('highlight-top-tiles');
        var tierCheckboxes = document.querySelectorAll('.tier-checkbox');
        var selectAllBtn = document.getElementById('select-all-tiers');
        var deselectAllBtn = document.getElementById('deselect-all-tiers');
        
        // State tracking variables
        var tierLabelsVisible = true;
        var resourcesVisible = true;
        var topTilesHighlighted = false;
        var currentlySelectedTiers = []; // Default to no tiers selected
        
        // Function to update currently selected tiers based on checkboxes
        function updateSelectedTiers() {
            currentlySelectedTiers = [];
            tierCheckboxes.forEach(function(checkbox) {
                if (checkbox.checked) {
                    currentlySelectedTiers.push(checkbox.value);
                }
            });
            
            // Update the map based on new tier selection
            updateTierLabelVisibility();
            updateTileVisibility();
        }
        
        // Function to update tier label visibility
        function updateTierLabelVisibility() {
            document.querySelectorAll('.tier-label').forEach(function(el) {
                var tier = el.getAttribute('data-tier');
                var isSelectedTier = currentlySelectedTiers.includes(tier);
                // Only show if labels are toggled on AND the tier is selected
                el.style.display = (tierLabelsVisible && isSelectedTier) ? 'flex' : 'none';
            });
        }
        
        // Function to update tile visibility based on selected tiers
        function updateTileVisibility() {
            document.querySelectorAll('.leaflet-pane.leaflet-overlay-pane svg path').forEach(function(el) {
                var tier = el.getAttribute('data-tier');
                
                if (currentlySelectedTiers.includes(tier)) {
                    el.style.opacity = '1';
                } else {
                    el.style.opacity = '0.3';
                }
            });
        }
        
        // Add event listeners to all tier checkboxes
        tierCheckboxes.forEach(function(checkbox) {
            checkbox.addEventListener('change', updateSelectedTiers);
        });
        
        // Select All button
        selectAllBtn.addEventListener('click', function() {
            tierCheckboxes.forEach(function(checkbox) {
                checkbox.checked = true;
            });
            updateSelectedTiers();
        });
        
        // Deselect All button
        deselectAllBtn.addEventListener('click', function() {
            tierCheckboxes.forEach(function(checkbox) {
                checkbox.checked = false;
            });
            updateSelectedTiers();
        });
        
        // Toggle tier labels
        toggleTierLabelsBtn.addEventListener('click', function() {
            tierLabelsVisible = !tierLabelsVisible;
            
            // Update visibility based on current filter selection
            updateTierLabelVisibility();
            
            // Update button state
            toggleTierLabelsBtn.textContent = tierLabelsVisible ? 'Hide Tier Labels' : 'Show Tier Labels';
            toggleTierLabelsBtn.classList.toggle('inactive', !tierLabelsVisible);
        });
        
        // Toggle resource markers
        toggleResourcesBtn.addEventListener('click', function() {
            resourcesVisible = !resourcesVisible;
            
            // Apply a CSS rule to show/hide all resource markers
            var style = document.createElement('style');
            style.id = 'resource-visibility-style';
            
            // Remove any existing style element first
            var existingStyle = document.getElementById('resource-visibility-style');
            if (existingStyle) {
                existingStyle.remove();
            }
            
            if (!resourcesVisible) {
                // This CSS will hide all resource markers
                style.textContent = `
                    .leaflet-marker-pane .leaflet-interactive[class*="circle"],
                    .resource-marker,
                    .leaflet-marker-pane circle.leaflet-interactive {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Update button state
            toggleResourcesBtn.textContent = resourcesVisible ? 'Hide Resources' : 'Show Resources';
            toggleResourcesBtn.classList.toggle('inactive', !resourcesVisible);
        });
        
        // Highlight top tiles
        highlightTopTilesBtn.addEventListener('click', function() {
            topTilesHighlighted = !topTilesHighlighted;
            
            // Loop through all hexagon tiles
            document.querySelectorAll('.leaflet-pane.leaflet-overlay-pane svg path').forEach(function(el) {
                // Reset styles
                el.style.filter = 'none';
                
                // Get tile data
                var tier = el.getAttribute('data-tier');
                
                // First check if the tile should be visible based on tier selection
                var isVisible = currentlySelectedTiers.includes(tier);
                
                // Apply highlighting if needed
                if (topTilesHighlighted) {
                    if (tier === 'S' || tier === 'A') {
                        el.style.filter = 'drop-shadow(0px 0px 5px yellow)';
                        el.style.opacity = '1'; // Always show top tiles at full opacity
                    } else {
                        if (isVisible) {
                            el.style.opacity = '0.6'; // Dim other visible tiles
                        } else {
                            el.style.opacity = '0.3'; // Keep hidden tiles hidden
                        }
                    }
                } else {
                    // If not highlighting, respect the tier visibility
                    el.style.opacity = isVisible ? '1' : '0.3';
                }
            });
            
            // Update button state
            highlightTopTilesBtn.textContent = topTilesHighlighted ? 'Reset Highlighting' : 'Highlight Top Tiles';
            highlightTopTilesBtn.classList.toggle('inactive', !topTilesHighlighted);
        });
        
        // Process tier labels and resource markers with improved selector specificity
        function processMapElements() {
            console.log("Processing map elements...");
            
            // Process tier labels
            document.querySelectorAll('.leaflet-marker-pane .leaflet-marker-icon').forEach(function(el) {
                var html = el.innerHTML;
                if (html && (html.includes('S') || html.includes('A') || html.includes('B') || 
                            html.includes('C') || html.includes('D') || html.includes('E') || 
                            html.includes('F'))) {
                    el.classList.add('tier-label');
                    // Extract the tier from the HTML and add as data attribute
                    var tierMatch = html.match(/>([SABCDEF])</);
                    if (tierMatch && tierMatch[1]) {
                        el.setAttribute('data-tier', tierMatch[1]);
                    }
                }
            });
            
            // Add class to resource markers if not already added during creation
            document.querySelectorAll('.leaflet-pane.leaflet-marker-pane .leaflet-interactive').forEach(function(el) {
                // Circle elements are typically resources in Leaflet
                if (el.tagName === 'circle' || 
                    (el.tagName === 'path' && !el.innerHTML && !el.classList.contains('tier-label'))) {
                    el.classList.add('resource-marker');
                }
            });
            
            // Add data-tier attributes to hexagon tiles
            document.querySelectorAll('.leaflet-pane.leaflet-overlay-pane svg path').forEach(function(el) {
                var color = el.getAttribute('stroke');
                if (color) {
                    // Match color to tier
                    var tier = 'C';  // Default tier
                    if (color === '#ffcc00') tier = 'S';
                    else if (color === '#ff8800') tier = 'A';
                    else if (color === '#66cc66') tier = 'B';
                    else if (color === '#6699cc') tier = 'C';
                    else if (color === '#cccccc') tier = 'D';
                    else if (color === '#999999') tier = 'E';
                    else if (color === '#666666') tier = 'F';
                    
                    el.setAttribute('data-tier', tier);
                }
            });
            
            console.log("Map elements processed.");
        }
        
        // Process initially and then periodically to catch any dynamically loaded elements
        processMapElements();
        
        // Also process after a delay to catch elements that might be loaded later
        setTimeout(processMapElements, 1000);
        
        // Set up a mutation observer to detect when new map elements are added
        var mapContainer = document.querySelector('.leaflet-container');
        if (mapContainer) {
            var observer = new MutationObserver(function(mutations) {
                processMapElements();
            });
            
            observer.observe(mapContainer, { 
                childList: true, 
                subtree: true 
            });
        }
    });
    </script>
    """
    
    # Add the control panel elements to the map
    m.get_root().html.add_child(folium.Element(control_panel_css))
    m.get_root().html.add_child(folium.Element(control_panel_html))
    m.get_root().html.add_child(folium.Element(control_panel_js))
    
    # Add legend
    legend_html = """
    <div style="position: fixed; bottom: 50px; right: 50px; z-index: 1000; background-color: white; 
                padding: 10px; border: 2px solid grey; border-radius: 5px">
        <p style="text-align: center"><b>Terrain Types</b></p>
    """
    
    # Add terrain types to legend
    for terrain, color in terrain_colors.items():
        legend_html += f"""
        <div>
            <span style="background-color: {color}; width: 15px; height: 15px; display: inline-block; margin-right: 5px"></span>
            {terrain}
        </div>
        """
    
    # Add resource types to legend
    legend_html += "<p style='text-align: center; margin-top: 10px'><b>Resource Types</b></p>"
    for res_type, style in resource_styles.items():
        legend_html += f"""
        <div>
            <span style="background-color: {style['color']}; width: 15px; height: 15px; 
                  display: inline-block; margin-right: 5px; border-radius: 50%"></span>
            {res_type}
        </div>
        """
    
    # Add tile score tiers to legend
    legend_html += "<p style='text-align: center; margin-top: 10px'><b>Tile Score Tiers</b></p>"

    # Get the tier thresholds if available
    if hasattr(df, 'attrs') and 'tier_thresholds' in df.attrs:
        thresholds = df.attrs['tier_thresholds']
        tier_descriptions = {
            'S': f'{thresholds[6]}+ points (Top 5%)',
            'A': f'{thresholds[5]}-{thresholds[6]-1} points (85%-95%)',
            'B': f'{thresholds[4]}-{thresholds[5]-1} points (65%-85%)',
            'C': f'{thresholds[3]}-{thresholds[4]-1} points (35%-65%)',
            'D': f'{thresholds[2]}-{thresholds[3]-1} points (15%-35%)',
            'E': f'{thresholds[1]}-{thresholds[2]-1} points (5%-15%)',
            'F': f'0-{thresholds[1]-1} points (Bottom 5%)'
        }
    else:
        # Fallback to original tier descriptions if thresholds aren't available
        tier_descriptions = {
            'S': '150+ points',
            'A': '125-149 points',
            'B': '100-124 points',
            'C': '75-99 points',
            'D': '50-74 points',
            'E': '25-49 points',
            'F': '0-24 points'
        }

    for tier, style in tier_styles.items():
        legend_html += f"""
        <div>
            <span style="
                background-color: {style['label_bg']}; 
                color: {style['label_color']};
                width: 15px; 
                height: 15px; 
                display: inline-block; 
                margin-right: 5px; 
                border-radius: 3px;
                text-align: center;
                font-weight: bold;
                border: {style['border_width']}px solid {style['border_color']};
            ">{tier}</span>
            Tier {tier} ({tier_descriptions[tier]})
        </div>
        """
    
    legend_html += "</div>"

    # Add JavaScript for legend toggle
    legend_toggle_js = """
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Create a toggle button for the legend
        const legendContainer = document.querySelector('div[style*="position: fixed; bottom: 50px; right: 50px;"]');
        
        if (legendContainer) {
            // Create legend toggle button
            const toggleButton = document.createElement('button');
            toggleButton.id = 'toggle-legend-btn';
            toggleButton.textContent = 'Hide Legend';
            toggleButton.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 50px;
                z-index: 1001;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                padding: 5px 10px;
                font-family: Arial, sans-serif;
                font-size: 12px;
                box-shadow: 0 0 5px rgba(0,0,0,0.2);
            `;
            
            // Add the button to the document body
            document.body.appendChild(toggleButton);
            
            // Set initial state
            let legendVisible = true;
            
            // Add click event listener
            toggleButton.addEventListener('click', function() {
                legendVisible = !legendVisible;
                
                // Toggle legend visibility
                legendContainer.style.display = legendVisible ? 'block' : 'none';
                
                // Update button text
                toggleButton.textContent = legendVisible ? 'Hide Legend' : 'Show Legend';
                
                // Update button style
                toggleButton.style.backgroundColor = legendVisible ? '#4CAF50' : '#f44336';
            });
            
            // Add a title to the legend
            const legendHeader = document.createElement('div');
            legendHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                border-bottom: 1px solid #ccc;
                padding-bottom: 5px;
            `;
            
            const legendTitle = document.createElement('span');
            legendTitle.textContent = 'Legend';
            legendTitle.style.fontWeight = 'bold';
            
            // Add the header to the legend container at the top
            legendHeader.appendChild(legendTitle);
            
            // Insert header at the beginning of the legend container
            if (legendContainer.firstChild) {
                legendContainer.insertBefore(legendHeader, legendContainer.firstChild);
            } else {
                legendContainer.appendChild(legendHeader);
            }
        }
    });
    </script>
    """

    # Add the legend to the map
    m.get_root().html.add_child(folium.Element(legend_html))

    # Add the legend toggle functionality
    m.get_root().html.add_child(folium.Element(legend_toggle_js))

    # Add this fixed-size hexagons with anchored labels handler
    fixed_size_with_anchored_labels = r"""
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Wait for map to fully load
        setTimeout(function() {
            console.log('Initializing hexagon size preservation with anchored labels');
            
            // Find the map
            const mapContainer = document.querySelector('.leaflet-container');
            if (!mapContainer) return;
            
            let map = null;
            if (window.L && window.L.map && window.L.map._instances) {
                map = window.L.map._instances[0];
            } else {
                for (let key in window) {
                    if (window[key] && window[key]._container === mapContainer) {
                        map = window[key];
                        break;
                    }
                }
            }
            
            if (!map) {
                console.error('Map not found');
                return;
            }
            
            // Get panes
            const overlayPane = document.querySelector('.leaflet-overlay-pane');
            const markerPane = document.querySelector('.leaflet-marker-pane');
            
            if (!overlayPane || !markerPane) {
                console.error('Required panes not found');
                return;
            }
            
            // Store hexagon-label relationships
            const relationships = [];
            
            // Initial mapping of hexagons to labels
            function mapHexagonsToLabels() {
                // Find SVG element
                const svg = overlayPane.querySelector('svg');
                if (!svg) return;
                
                // Get all hexagons (paths)
                const hexagons = Array.from(svg.querySelectorAll('path'));
                if (hexagons.length === 0) return;
                
                console.log('Found', hexagons.length, 'hexagons');
                
                // Get all tier labels
                const tierLabels = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
                if (tierLabels.length === 0) {
                    console.log('No tier labels found');
                    return;
                }
                
                console.log('Found', tierLabels.length, 'possible tier labels');
                
                // Clear existing relationships
                relationships.length = 0;
                
                // Map each hexagon to the nearest label
                hexagons.forEach(function(hexagon) {
                    try {
                        // Get hexagon center
                        const hexBBox = hexagon.getBBox();
                        const hexCenterX = hexBBox.x + hexBBox.width/2;
                        const hexCenterY = hexBBox.y + hexBBox.height/2;
                        
                        // Convert to screen coordinates
                        const hexagonCTM = hexagon.getScreenCTM();
                        const hexScreenX = hexCenterX * hexagonCTM.a + hexCenterY * hexagonCTM.c + hexagonCTM.e;
                        const hexScreenY = hexCenterX * hexagonCTM.b + hexCenterY * hexagonCTM.d + hexagonCTM.f;
                        
                        // Find closest label
                        let closestLabel = null;
                        let minDistance = Infinity;
                        
                        tierLabels.forEach(function(label) {
                            const labelRect = label.getBoundingClientRect();
                            const labelX = labelRect.left + labelRect.width/2;
                            const labelY = labelRect.top + labelRect.height/2;
                            
                            const distance = Math.sqrt(
                                Math.pow(hexScreenX - labelX, 2) + 
                                Math.pow(hexScreenY - labelY, 2)
                            );
                            
                            if (distance < minDistance && distance < 20) { // 20px threshold
                                minDistance = distance;
                                closestLabel = label;
                            }
                        });
                        
                        if (closestLabel) {
                            // Check if it's a tier label
                            const labelHtml = closestLabel.innerHTML || '';
                            const tierMatch = labelHtml.match(/>([SABCDEF])</);
                            
                            if (tierMatch && tierMatch[1]) {
                                // It's a tier label, store the relationship
                                relationships.push({
                                    hexagon: hexagon,
                                    label: closestLabel,
                                    tier: tierMatch[1],
                                    offset: {
                                        x: 0,
                                        y: 0
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Error mapping hexagon to label:', e);
                    }
                });
                
                console.log('Mapped', relationships.length, 'hexagon-label relationships');
            }
            
            // Function to update label positions based on hexagons
            function updateLabelPositions() {
                relationships.forEach(function(rel) {
                    try {
                        // Get current hexagon position
                        const hexBBox = rel.hexagon.getBBox();
                        const hexCenterX = hexBBox.x + hexBBox.width/2;
                        const hexCenterY = hexBBox.y + hexBBox.height/2;
                        
                        // Convert to screen coordinates
                        const hexagonCTM = rel.hexagon.getScreenCTM();
                        if (!hexagonCTM) return;
                        
                        const hexScreenX = hexCenterX * hexagonCTM.a + hexCenterY * hexagonCTM.c + hexagonCTM.e;
                        const hexScreenY = hexCenterX * hexagonCTM.b + hexCenterY * hexagonCTM.d + hexagonCTM.f;
                        
                        // Apply offset to center label on hex
                        const labelRect = rel.label.getBoundingClientRect();
                        const offsetX = hexScreenX - (labelRect.left + labelRect.width/2);
                        const offsetY = hexScreenY - (labelRect.top + labelRect.height/2);
                        
                        // Get current transform if any
                        const currentTransform = rel.label.style.transform || '';
                        let translatePart = '';
                        
                        // Extract existing translate parts if any
                        const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
                        if (translateMatch && translateMatch[1]) {
                            const parts = translateMatch[1].split(',');
                            const existingX = parseFloat(parts[0]) || 0;
                            const existingY = parseFloat(parts[1]) || 0;
                            
                            // Add to our offset
                            rel.offset.x = existingX + offsetX;
                            rel.offset.y = existingY + offsetY;
                        } else {
                            rel.offset.x = offsetX;
                            rel.offset.y = offsetY;
                        }
                        
                        // Apply new transform with updated translate
                        translatePart = `translate(${rel.offset.x}px, ${rel.offset.y}px)`;
                        
                        // Keep any other transforms like scale
                        let finalTransform = currentTransform;
                        if (translateMatch) {
                            finalTransform = finalTransform.replace(translateMatch[0], translatePart);
                        } else {
                            finalTransform = translatePart + ' ' + finalTransform;
                        }
                        
                        // Apply transform
                        rel.label.style.transform = finalTransform;
                    } catch (e) {
                        console.error('Error updating label position:', e);
                    }
                });
            }
            
            // Function to preserve hexagon size
            function preserveHexagonSize() {
                // Find the SVG element
                const svg = overlayPane.querySelector('svg');
                if (!svg) return;
                
                // Disable transforms on the SVG
                svg.style.transform = 'none';
                
                // Flag that we've modified the SVG
                svg.setAttribute('data-fixed-size', 'true');
                
                // Update label positions based on fixed hexagons
                updateLabelPositions();
            }
            
            // Map hexagons to labels initially
            mapHexagonsToLabels();
            
            // Add event handlers
            map.on('zoomend', function() {
                setTimeout(function() {
                    preserveHexagonSize();
                }, 50);
            });
            
            map.on('moveend', function() {
                setTimeout(function() {
                    preserveHexagonSize();
                }, 50);
            });
            
            // Create a mutation observer to detect when the transform gets applied
            const observer = new MutationObserver(function(mutations) {
                let needsUpdate = false;
                
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'style' || 
                        mutation.attributeName === 'transform')) {
                        needsUpdate = true;
                    }
                });
                
                if (needsUpdate) {
                    preserveHexagonSize();
                }
            });
            
            // Start observing
            observer.observe(overlayPane, {
                attributes: true,
                childList: false,
                subtree: true,
                attributeFilter: ['style', 'transform']
            });
            
            // Apply immediately
            preserveHexagonSize();
            
            console.log('Fixed-size hexagons with anchored labels initialized');
        }, 1500);
    });
    </script>
    """

    # Add the script to the map
    m.get_root().html.add_child(folium.Element(fixed_size_with_anchored_labels))
    
    return m

def load_map_data(filename):
    """
    Load map data from a CSV file.
    """
    try:
        # First try standard CSV loading
        df = pd.read_csv(filename)
        print(f"Successfully loaded with default comma delimiter")
    except Exception as e:
        print(f"Standard loading failed ({str(e)}), trying alternative loading method...")
        try:
            # Try different delimiters if default doesn't work
            for sep in [',', ';', '\t']:
                try:
                    df = pd.read_csv(filename, sep=sep)
                    print(f"Loaded CSV with {sep} delimiter")
                    break
                except:
                    continue
            else:
                raise ValueError("Could not determine correct delimiter")
        except Exception as e:
            raise ValueError(f"All loading methods failed: {str(e)}")
    
    # Print first few rows to diagnose issues
    print("\nFirst 3 rows of the loaded data:")
    print(df.head(3))
    
    # Check for expected columns and fix column naming
    required_cols = ['X', 'Y', 'Terrain']
    
    # Check if X and Y columns exist or need extraction
    if 'X' not in df.columns:
        # Look for columns that might contain X values in combined format
        for col in df.columns:
            if col.startswith('MapExport:') or ',' in col:
                print(f"Found possibly combined column: {col}")
                # Try to extract X,Y coordinates from combined column
                try:
                    # Extract first value from each cell as X coordinate
                    coords_series = df[col].str.extract(r'(\d+),(\d+)', expand=True)
                    if not coords_series.empty and not coords_series[0].isna().all():
                        df['X'] = pd.to_numeric(coords_series[0])
                        df['Y'] = pd.to_numeric(coords_series[1])
                        print("Extracted X,Y coordinates from combined column")
                        
                        # Extract other values
                        all_data_series = df[col].str.split(',', expand=True)
                        if not all_data_series.empty and all_data_series.shape[1] > 2:
                            df['Terrain'] = all_data_series[2]
                            if all_data_series.shape[1] > 3:
                                df['Feature'] = all_data_series[3]
                            if all_data_series.shape[1] > 4:
                                df['Resource'] = all_data_series[4]
                            print("Extracted additional data from combined column")
                        
                        break
                except Exception as extract_err:
                    print(f"Failed to extract coordinates: {extract_err}")
    
    # Check if we have the required columns
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {', '.join(missing_cols)}")
    
    # Convert coordinate columns to numeric
    for col in ['X', 'Y']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Replace 'None' strings with actual None values
    for col in df.columns:
        if df[col].dtype == 'object':
            df[col] = df[col].replace('None', None)
            df[col] = df[col].replace('FALSE', False)
            df[col] = df[col].replace('TRUE', True)
    
    print(f"Successfully loaded map data with {len(df)} tiles")
    return df

def calculate_base_yields(tile):
    """
    Calculate the base yields (food, production, gold) for a single tile based on its terrain and feature data.
    """

    # Get terrain yields
    terrain_yield = terrain_yields.get(tile['Terrain'], [0, 0, 0]) # return [0, 0, 0] if terrain does not exist in terrain_yields dictionary

    # Get feature yields
    feature_yield = [0, 0, 0]
    if pd.notna(tile['Feature']):
        feature_yield = feature_yields.get(tile['Feature'], [0, 0, 0]) # return [0, 0, 0] if feature does not exist in feature_yields dictionary

    # sum the two yields together (additive)
    total_food = terrain_yield[0] + feature_yield[0] # terrainFood + featureFood
    total_production = terrain_yield[1] + feature_yield[1] # terrainProduction + featureProduction
    total_gold = terrain_yield[2] + feature_yield[2] # terrainGold + featureGold

    return [total_food, total_production, total_gold]

def calculate_tile_score(tile):
    """
    Calculate the desirability score for a single tile.
    """
    # skip ocean and ice tiles since these cannot be settled on
    if tile['Terrain'] == 'TERRAIN_OCEAN' or ((pd.notna(tile['Feature']) and tile['Feature'] == 'FEATURE_ICE')):
        return 0
    
    # calculate the base yields for the tile
    yields = calculate_base_yields(tile)
    total_food = yields[0]
    total_production = yields[1]
    total_gold = yields[2]

    # calculate the base score based on the yields
    # for early game, food is the most important growth factor, and then production.
    yield_score = (total_food * 2) + (total_production * 1) + (total_gold * 0.5)

    # add some notion of balance: i.e. a tile should have a bonus for having both food and production
    balance_bonus = 0
    if total_food > 0 and total_production > 0:
        balance_bonus = min(total_food, total_production) * 1.5 # 150% of the smaller yield
    
    # resource value
    resource_bonus = 0
    if (pd.notna(tile['Resource'])):
        resource_bonus = resource_values.get(tile['Resource'], 0) # return 0 if resource does not exist in resource_values dictionary, otherwise return the value corresponding to that resource
    
    # fresh water bonus (from rivers), esentially, just check if the tile has access to any type of river
    fresh_water_bonus = 0
    if pd.notna(tile['Rivers']):
        fresh_water_bonus = 3 # add 3 points for access to this river

    # appeal bonus (not as important in the early game but still can play a factor)
    appeal_bonus = 0
    if pd.notna(tile['Appeal']):
        try:
            # Try to convert Appeal to numeric value and check if it's positive
            appeal_value = float(tile['Appeal'])
            if appeal_value > 0:
                appeal_bonus = appeal_value * 0.5  # 50% of the appeal value
        except (ValueError, TypeError):
            # If conversion fails, check if it's a string that can be interpreted as positive
            if isinstance(tile['Appeal'], str) and tile['Appeal'].lower() in ['good', 'high', 'positive', 'breathtaking']:
                appeal_bonus = 2  # Default positive value
    
    # goody hut bonus (add this on just because)
    goody_bonus = 0
    if pd.notna(tile['GoodyHut']) and (tile['GoodyHut'] is True or str(tile['GoodyHut']).lower() in ['true', '1', 'yes']):
        goody_bonus = 2 # add 2 points for this tile being a goody hut

    # calculate total score
    total_score = (
        yield_score +
        balance_bonus +
        resource_bonus +
        fresh_water_bonus +
        appeal_bonus +
        goody_bonus
    )

    return (max(0, total_score)) # return 0 if the score is negative, although I'm not entirely sure if this is possible in the first place...?

def load_map_data(filename):
    """
    Load map data from a CSV file.
    """
    try:
        # First try to read CSV with standard pandas approach
        df = pd.read_csv(filename)
        print(f"CSV loaded with headers: {', '.join(df.columns)}")
    except Exception as e:
        print(f"Standard loading failed ({e}), trying alternative loading method...")
        
        # Define the column names for your CSV file
        column_names = [
            'X', 'Y', 'Terrain', 'Feature', 'Resource', 'ResourceType', 'Continent', 
            'Rivers', 'Appeal', 'GoodyHut', 'StartingPlot'
            # Add any additional columns that your CSV contains
        ]

        # Try to read the CSV with different options
        try:
            # Try with header=0 (first row is header)
            df = pd.read_csv(filename, header=0)
            print("Loaded CSV with first row as header")
        except:
            try:
                # Try with no header and specified column names
                df = pd.read_csv(filename, header=None, names=column_names)
                print("Loaded CSV with no header, using specified column names")
            except Exception as e2:
                # Try with different delimiters
                try:
                    df = pd.read_csv(filename, sep=';')
                    print("Loaded CSV with semicolon delimiter")
                except:
                    # Last resort - try to load as text and parse manually
                    with open(filename, 'r') as f:
                        lines = f.readlines()
                    
                    print(f"First few lines of the file:")
                    for i in range(min(5, len(lines))):
                        print(f"Line {i+1}: {lines[i].strip()}")
                    
                    raise ValueError(f"Could not load CSV file: {e2}")

    # Identify which columns might contain X and Y coordinates
    potential_x_cols = [col for col in df.columns if 'x' in col.lower()]
    potential_y_cols = [col for col in df.columns if 'y' in col.lower()]
    
    # Print the first few rows of data to help diagnose issues
    print("First 3 rows of the loaded data:")
    print(df.head(3))
    
    # If X/Y aren't in the dataframe, look for closest matches
    if 'X' not in df.columns and potential_x_cols:
        print(f"Renaming '{potential_x_cols[0]}' to 'X'")
        df['X'] = df[potential_x_cols[0]]
    if 'Y' not in df.columns and potential_y_cols:
        print(f"Renaming '{potential_y_cols[0]}' to 'Y'")
        df['Y'] = df[potential_y_cols[0]]
    
    # Ensure all required columns exist
    required_cols = ['X', 'Y', 'Terrain']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {', '.join(missing_cols)}")
    
    # Convert coordinate columns to numeric, with proper error handling
    try:
        df['X'] = pd.to_numeric(df['X'])
        print(f"Successfully converted X to numeric")
    except Exception as e:
        print(f"Error converting X to numeric: {e}")
        print(f"X column unique values: {df['X'].unique()[:10]}")
        
    try:
        df['Y'] = pd.to_numeric(df['Y'])
        print(f"Successfully converted Y to numeric")
    except Exception as e:
        print(f"Error converting Y to numeric: {e}")
        print(f"Y column unique values: {df['Y'].unique()[:10]}")
    
    # Future-proof way to convert Appeal to numeric
    if 'Appeal' in df.columns:
        try:
            df['Appeal'] = pd.to_numeric(df['Appeal'])
        except:
            # Leave as is if conversion fails
            pass
    
    # Convert boolean columns
    bool_columns = ['GoodyHut', 'StartingPlot', 'Forest', 'Jungle', 'Hills']
    for col in bool_columns:
        if col in df.columns:
            try:
                df[col] = df[col].map({'TRUE': True, 'True': True, 'true': True, '1': True,
                                      'FALSE': False, 'False': False, 'false': False, '0': False})
                # Convert any remaining non-NaN values to bool
                mask = pd.notna(df[col])
                if mask.any():
                    df.loc[mask, col] = df.loc[mask, col].astype(bool)
            except Exception as e:
                print(f"Warning: Could not convert {col} to boolean: {e}")
    
    # Print final summary of data
    print(f"\nFinal data summary:")
    print(f"- Total rows: {len(df)}")
    print(f"- X range: {df['X'].min()} to {df['X'].max()}, {df['X'].isna().sum()} NaN values")
    print(f"- Y range: {df['Y'].min()} to {df['Y'].max()}, {df['Y'].isna().sum()} NaN values")
    
    return df

def analyze_map(filename):
    """Analyze the entire map and calculate the desirability scores per tile."""
    # load the map data
    df = load_map_data(filename)

    # calculate the base yields for each tile
    df['raw_score'] = df.apply(calculate_tile_score, axis=1)

    # normalize the scores
    df = normalize_scores(df)

    # sort the df by the normalized score, (descending)
    df_sorted = df.sort_values(by='normalized_score', ascending=False)

    return (df_sorted)

def normalize_scores(df):
    """
    Normalize tile scores and divide into data-driven tiers based on septiles
    """
    # Filter to only include the workable tiles
    workable_tiles = df[
        (df['Terrain'] != 'TERRAIN_OCEAN') &
        ((df['Feature'].isna()) | (df['Feature'] != 'FEATURE_ICE'))
    ]

    # Calculate statistics about the distribution
    avg_score = workable_tiles['raw_score'].mean()
    median_score = workable_tiles['raw_score'].median()
    
    print(f"Average score of workable tiles: {avg_score:.2f}")
    print(f"Median score of workable tiles: {median_score:.2f}")
    
    # Normalize all scores
    df['normalized_score'] = np.round((df['raw_score'] / avg_score) * 100)
    
    # Update workable_tiles to include the normalized score we just calculated
    workable_tiles = df[
        (df['Terrain'] != 'TERRAIN_OCEAN') &
        ((df['Feature'].isna()) | (df['Feature'] != 'FEATURE_ICE'))
    ]
    
    # Instead of using percentiles, let's use rank-based tiers
    # Sort workable tiles by score
    sorted_tiles = workable_tiles.sort_values('normalized_score')
    
    # Get total number of workable tiles
    n_tiles = len(sorted_tiles)
    
    # Determine the rank cutoffs for each tier (based on the percentiles you want)
    # Percentiles: 0, 5%, 15%, 35%, 65%, 85%, 95%, 100%
    cutoffs = [
        0,                  # Minimum rank (0th percentile)
        int(n_tiles * 0.05),  # F tier cutoff (5th percentile)
        int(n_tiles * 0.15),  # E tier cutoff (15th percentile)
        int(n_tiles * 0.35),  # D tier cutoff (35th percentile) 
        int(n_tiles * 0.65),  # C tier cutoff (65th percentile)
        int(n_tiles * 0.85),  # B tier cutoff (85th percentile)
        int(n_tiles * 0.95),  # A tier cutoff (95th percentile)
        n_tiles              # Maximum rank (100th percentile)
    ]
    
    # Get the score values at each cutoff rank
    thresholds = []
    for cutoff in cutoffs:
        if cutoff == 0:
            # For the lowest cutoff, use the minimum score
            thresholds.append(sorted_tiles['normalized_score'].min())
        else:
            # For all other cutoffs, get the score at that rank
            # Subtract 1 from cutoff because ranks are 0-indexed
            idx = min(cutoff - 1, len(sorted_tiles) - 1)  # Ensure we don't go out of bounds
            thresholds.append(sorted_tiles['normalized_score'].iloc[idx])
    
    # Store these thresholds
    septile_thresholds = thresholds
    
    # Initialize tier column with None
    df['tier'] = None
    
    # Only assign tiers to workable tiles
    workable_mask = (df['Terrain'] != 'TERRAIN_OCEAN') & ((df['Feature'].isna()) | (df['Feature'] != 'FEATURE_ICE'))
    
    # Create a tier assignment based on rank rather than raw score
    # This ensures we get exactly the percentages we want in each tier
    sorted_indices = workable_tiles.sort_values('normalized_score').index
    
    # Assign tiers based on rank
    # F tier: bottom 5%
    f_indices = sorted_indices[:cutoffs[1]]
    df.loc[f_indices, 'tier'] = 'F'
    
    # E tier: 5-15%
    e_indices = sorted_indices[cutoffs[1]:cutoffs[2]]
    df.loc[e_indices, 'tier'] = 'E'
    
    # D tier: 15-35%
    d_indices = sorted_indices[cutoffs[2]:cutoffs[3]]
    df.loc[d_indices, 'tier'] = 'D'
    
    # C tier: 35-65%
    c_indices = sorted_indices[cutoffs[3]:cutoffs[4]]
    df.loc[c_indices, 'tier'] = 'C'
    
    # B tier: 65-85%
    b_indices = sorted_indices[cutoffs[4]:cutoffs[5]]
    df.loc[b_indices, 'tier'] = 'B'
    
    # A tier: 85-95%
    a_indices = sorted_indices[cutoffs[5]:cutoffs[6]]
    df.loc[a_indices, 'tier'] = 'A'
    
    # S tier: top 5%
    s_indices = sorted_indices[cutoffs[6]:]
    df.loc[s_indices, 'tier'] = 'S'
    
    # Print information about the distribution
    print("\nTier Distribution (Septile-based):")
    for i, tier in enumerate(['S', 'A', 'B', 'C', 'D', 'E', 'F']):
        count = len(df[df['tier'] == tier])
        percent = (count / len(workable_tiles)) * 100 if len(workable_tiles) > 0 else 0
        
        # For the threshold display, use the appropriate threshold
        if tier == 'S':
            threshold = septile_thresholds[6]  # S tier: 95-100%
            range_text = f"{threshold}+"
        elif tier == 'A':
            threshold_lower = septile_thresholds[5]  # A tier: 85-95%
            threshold_upper = septile_thresholds[6] - 1
            range_text = f"{threshold_lower}-{threshold_upper}"
        elif tier == 'B':
            threshold_lower = septile_thresholds[4]  # B tier: 65-85%
            threshold_upper = septile_thresholds[5] - 1
            range_text = f"{threshold_lower}-{threshold_upper}"
        elif tier == 'C':
            threshold_lower = septile_thresholds[3]  # C tier: 35-65%
            threshold_upper = septile_thresholds[4] - 1
            range_text = f"{threshold_lower}-{threshold_upper}"
        elif tier == 'D':
            threshold_lower = septile_thresholds[2]  # D tier: 15-35%
            threshold_upper = septile_thresholds[3] - 1
            range_text = f"{threshold_lower}-{threshold_upper}"
        elif tier == 'E':
            threshold_lower = septile_thresholds[1]  # E tier: 5-15%
            threshold_upper = septile_thresholds[2] - 1
            range_text = f"{threshold_lower}-{threshold_upper}"
        else:  # F tier
            threshold_upper = septile_thresholds[1] - 1  # F tier: 0-5%
            range_text = f"0-{threshold_upper}"
        
        print(f"Tier {tier}: {count} tiles ({percent:.1f}%), score range: {range_text}")
    
    # Store the thresholds for legend display
    df.attrs['tier_thresholds'] = septile_thresholds
    
    return df

def visualize_top_tiles(df, n=20):
    """
    Visualize the top n tiles based on their desirability scores.
    """
    # Get the top n tiles
    top_tiles = df.head(n).copy()
    
    # Create a readable label for each tile
    top_tiles['label'] = top_tiles.apply(lambda row: f"({row['X']}, {row['Y']})", axis=1)
    
    # Reset the index so we use the created label instead of the MultiIndex
    top_tiles = top_tiles.reset_index()
    
    plt.figure(figsize=(12, 8))
    
    # Use the created label instead of the index
    sns.barplot(x='label', y='normalized_score', hue='tier', data=top_tiles, palette='viridis')
    
    plt.title(f'Top {n} Tiles by Desirability Score')
    plt.xlabel('Normalized Score (100 = Average)')
    plt.ylabel('Tile Coordinates (X, Y)')
    plt.tight_layout()
    plt.show()

# base yields for different terrain types
terrain_yields = {
    # Format: "TERRAIN_<terrain_name>": [food, production, gold]
    "TERRAIN_GRASS": [2, 0, 0],
    "TERRAIN_GRASS_HILLS": [2, 1, 0],
    "TERRAIN_PLAINS": [1, 1, 0],
    "TERRAIN_PLAINS_HILLS": [1, 2, 0],
    "TERRAIN_DESERT": [0, 0, 0],
    "TERRAIN_DESERT_HILLS": [0, 1, 0],
    "TERRAIN_TUNDRA": [1, 0, 0],
    "TERRAIN_TUNDRA_HILLS": [1, 1, 0],
    "TERRAIN_COAST": [1, 0, 1],
    "TERRAIN_OCEAN": [1, 0, 0],
    "TERRAIN_SNOW": [0, 0, 0],
    "TERRAIN_SNOW_HILLS": [0, 1, 0]
}

# feature modifiers: additive to terrain yields
feature_yields = {
    # Format: "FEATURE_<feature_name>": [food, production, gold]
    "FEATURE_FOREST": [0, 1, 0], 
    "FEATURE_JUNGLE": [1, 0, 0],
    "FEATURE_MARSH": [1, 0, 0],
    "FEATURE_FLOODPLAINS": [3, 0, 0],
    "FEATURE_OASIS": [3, 0, 1],
    "FEATURE_REEF": [1, 1, 0]
}

# define resource value bonuses (which prioritize luxury resources early on)
resource_values = {
    # luxury resources
    'RESOURCE_WINE': 3.0,
    'RESOURCE_FURS': 3.0,
    'RESOURCE_SILK': 3.0,
    'RESOURCE_SILVER': 3.0,
    'RESOURCE_SUGAR': 3.0,
    'RESOURCE_PEARLS': 3.0,
    'RESOURCE_WHALES': 3.0,
    'RESOURCE_TRUFFLES': 3.0,
    'RESOURCE_IVORY': 3.0,
    'RESOURCE_COCOA': 3.0,
    'RESOURCE_COFFEE': 3.0,
    'RESOURCE_TEA': 3.0,
    'RESOURCE_TOBACCO': 3.0,
    'RESOURCE_CITRUS': 3.0,
    'RESOURCE_SALT': 3.0,

    # bonus resources (valuable for early game but not as critical as luxury resources)
    'RESOURCE_BANANAS': 1.5,
    'RESOURCE_CATTLE': 1.5,
    'RESOURCE_COPPER': 1.5,
    'RESOURCE_CRABS': 1.5,
    'RESOURCE_DEER': 1.5,
    'RESOURCE_FISH': 1.5,
    'RESOURCE_MAIZE': 1.5,
    'RESOURCE_RICE': 1.5,
    'RESOURCE_SHEEP': 1.5,
    'RESOURCE_STONE': 1.5,
    'RESOURCE_WHEAT': 1.5,

    # strategic resources (nice to have but not crticial at all. also place less weight on later game strategic resources)
    'RESOURCE_HORSES': 1.0,
    'RESOURCE_IRON': 1.0,
    'RESOURCE_NITER': 0.5,
    'RESOURCE_COAL': 0.5,
    'RESOURCE_OIL': 0.5,
    'RESOURCE_ALUMINUM': 0.5,
    'RESOURCE_URANIUM': 0.5,
}

def main():
    # analyze the map
    filename = "cleaned_map_data.csv"
    
    try:
        # First load the data to check it
        df = load_map_data(filename)
        
        # Print some debug info
        print(f"Loaded {len(df)} tiles")
        print(f"X coordinate range: {df['X'].min()} to {df['X'].max()}, {df['X'].isna().sum()} NaN values")
        print(f"Y coordinate range: {df['Y'].min()} to {df['Y'].max()}, {df['Y'].isna().sum()} NaN values")
        
        # Analyze the map
        results = analyze_map(filename)
        # results.head(10)
        
        # # create the map (with clean data)
        # civ_map = create_custom_civ_map(results)
        
        # # Save the map to an HTML file
        # civ_map.save("civ_map.html")
        
        # # Open the map in a web browser
        # webbrowser.open("civ_map.html")
        
    except Exception as e:
        print(f"Error processing map data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()