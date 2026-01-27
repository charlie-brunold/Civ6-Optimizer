# Civilization VI Map Optimizer

A web-based visualization and optimization tool for Civilization VI maps that helps players identify optimal tile placements for cities and districts.

## Live Demo

**[Try it now](https://civ6-optimizer.vercel.app)** - No installation required!

## Project Overview

This project, developed for **BUAD 313 Operations Management at USC**, is a web-based tool designed to help Civilization VI players optimize their gameplay. It provides an interactive 3D map visualization with dynamically calculated tile scores, allowing users to analyze potential settlement locations and identify the most advantageous placements for cities and districts based on customizable scoring weights.

### Features

- **3D Hexagonal Map Visualization**: Renders game maps using Three.js with a flat-topped hex layout, including terrain, features, and elevation.
- **Browser-Based CSV Processing**: Upload your own Civ VI map data CSV files directly in the browser - no Python required!
- **Demo Maps Included**: Try the tool immediately with included sample maps.
- **Dynamic & Configurable Tile Scoring**:
    - **Live Recalculation**: Tile scores and tiers are recalculated *in the browser* whenever scoring weights are adjusted via the UI.
    - **Customizable Weights**: Adjust the importance of food, production, gold, appeal, resources, and more.
- **Tier Classification**: Categorizes tiles from S-tier (exceptional) to F-tier (poor) based on calculated scores.
- **Score Heatmap**: Optionally overlays a color gradient (blue-cyan-green-yellow-red) onto tiles, representing their calculated normalized score.
- **Resource Markers**: Visual indicators for bonus, luxury, and strategic resources.
- **Interactive Controls**: Filter tiles by tier, toggle visual elements (labels, resources, elevation, heatmap), highlight top-tier tiles.
- **Tooltip Information**: Detailed information about each tile appears on hover.

## Authors
- Charlie Brunold ([@charlie-brunold](https://github.com/charlie-brunold))
- Lee Stilwell ([@lee-64](https://github.com/lee-64))

## Getting Started

### Quick Start (Recommended)

Simply visit the **[live demo](https://civ6-optimizer.vercel.app)** and:
1. Select a demo map from the dropdown, OR
2. Upload your own Civ VI map CSV file

### Local Development

If you want to run the project locally:

1. **Clone the repository:**
    ```bash
    git clone git@github.com:charlie-brunold/Civ6-Optimizer.git
    cd Civ6-Optimizer
    ```

2. **Start a local web server:**
    ES6 modules require serving files via HTTP. Use any local server:
    ```bash
    # Using Python
    python -m http.server 8000

    # Using Node.js (npx)
    npx serve

    # Using VS Code Live Server extension
    # Right-click on civ-map-three.html and select "Open with Live Server"
    ```

3. **Open in browser:**
    Navigate to `http://localhost:8000` (the root URL will automatically serve the visualization).

### Using Your Own Map Data

Map data should be in CSV format. Export your Civ VI map data using:
- The Civ VI developer console
- Community tools like FireTuner's map export functionality

**Required CSV columns:**
- `X`, `Y`: Tile coordinates
- `Terrain`: e.g., `TERRAIN_PLAINS`, `TERRAIN_GRASS`

**Optional columns (enhance scoring accuracy):**
- `Feature`: e.g., `FEATURE_FOREST`, `FEATURE_JUNGLE`
- `Resource`: e.g., `RESOURCE_IRON`, `RESOURCE_WHEAT`
- `ResourceType`: `Luxury`, `Strategic`, `Bonus`
- `Appeal`: Numerical appeal value
- `Rivers`: River data (presence indicated by non-empty value)
- `Continent`: Continent identifier string
- `GoodyHut`: Boolean (`True`/`False`, `1`/`0`)

Sample data files are available in the `datasets/` directory.

## Deployment

This project is configured for easy deployment to Vercel:

1. Fork/clone the repository
2. Import the project in [Vercel](https://vercel.com)
3. Deploy - no configuration needed!

The `vercel.json` file handles routing and proper MIME types for ES6 modules.

## Technical Details

### Architecture

```
Browser
  │
  ├─→ Upload CSV / Select Demo Map
  │         │
  │         ▼
  │   PapaParse (CSV parsing)
  │         │
  │         ▼
  │   mapProcessor.js (JS scoring logic)
  │         │
  │         ▼
  │   createMapVisualization()
  │         │
  │         ▼
  │   Three.js 3D Rendering
  │
  └─→ Interactive Controls (real-time updates)
```

### Key Technologies

- **Three.js**: 3D visualization and rendering
- **PapaParse**: Client-side CSV parsing
- **ES6 Modules**: Modular JavaScript architecture
- **Vercel**: Static site hosting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue to discuss potential changes or additions.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.

## Acknowledgments

Thank you to Professor Vishal Gupta for his support and guidance throughout the duration of our project.
