# Civilization VI Map Optimizer

A web-based visualization and optimization tool for Civilization VI maps that helps players identify optimal tile placements for cities and districts.

## Project Overview

This project provides an interactive 3D visualization of Civilization VI map data, allowing players to analyze tile values, resource placements, and terrain features to make better strategic decisions. The visualization uses a configurable scoring system to evaluate tiles and displays this information through interactive elements like tier classifications and a score heatmap.

### Features

- **3D Hexagonal Map Visualization**: Renders game maps using Three.js with a flat-topped hex layout, including terrain, features, and elevation.
- **Configurable Tile Scoring**: A Python script processes map data, calculating tile scores based on yields, resources, appeal, etc., using weights defined in `config.json`.
- **Tier Classification**: Categorizes tiles from S-tier (exceptional) to F-tier (poor) based on calculated scores.
- **Score Heatmap**: Optionally overlays a color gradient (blue-cyan-green-yellow-red) onto tiles, representing their calculated normalized score (higher scores are warmer colors).
- **Resource Markers**: Visual indicators for bonus, luxury, and strategic resources.
- **Interactive Controls**: Filter tiles by tier, toggle visual elements (labels, resources, elevation, heatmap), highlight top-tier tiles.
- **Tooltip Information**: Detailed information about each tile appears on hover.
- **Modular Codebase**: Frontend JavaScript is organized into ES6 modules for better maintainability.

## Authors
- Charlie Brunold ([@charlie-brunold](https://github.com/charlie-brunold))
- Lee Stilwell ([@lee-64](https://github.com/lee-64))

## Getting Started

### Prerequisites

- **Python 3.7+**: Required for processing map data and running the local web server.
    - **Pandas & NumPy**: Python libraries used for data manipulation. Install via pip: `pip install pandas numpy`
- **Modern Web Browser**: Chrome, Firefox, Edge, or Safari with WebGL support.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone git@github.com:charlie-brunold/Civ6-Optimizer.git
    cd Civ6-Optimizer
    ```
2.  **Install Python dependencies:**
    ```bash
    pip install pandas numpy
    ```

### Running the Application

The visualization requires two main steps: processing map data into the correct JSON format and serving the HTML/JS/CSS files via a local web server.

1.  **Configure Scoring (Optional):**
    * Edit the `config.json` file to adjust weights for food, production, resources, appeal, etc., or to change the heatmap colors or tier percentiles.

2.  **Process Map Data:**
    * Run the Python script to convert your map data CSV into the `civ_map_data.json` file used by the visualization. Replace `datasets/your_map.csv` with the path to your input file.
    ```bash
    python csv_to_three_converter.py datasets/your_map.csv civ_map_data.json
    ```
    * Make sure the `config.json` file is in the same directory when you run this script, or provide the path as a third argument:
    ```bash
    python csv_to_three_converter.py datasets/your_map.csv civ_map_data.json path/to/your/config.json
    ```
    * Sample map data is available in the `datasets/` directory (e.g., `map_tiny_1.csv`).

3.  **Start Local Web Server:**
    * From the project's root directory (where `civ-map-three.html` is located), start Python's built-in HTTP server. This is necessary for loading JavaScript modules correctly.
    ```bash
    # Make sure you are in the Civ6-Optimizer directory
    python -m http.server 8000
    ```
    * (If port 8000 is busy, you can choose another port, e.g., `python -m http.server 8080`)

4.  **View Visualization:**
    * Open your web browser and navigate to:
    ```
    http://localhost:8000/civ-map-three.html
    ```
    * (Adjust the port number if you used a different one in step 3).

### Using Your Own Map Data

Exporting map data currently requires accessing the Civ VI developer console or using community tools (like FireTuner's map export functionality, if available).

Map data should be in CSV format. Key columns used by the `csv_to_three_converter.py` script include:
- `X`, `Y`: Tile coordinates
- `Terrain`: e.g., `TERRAIN_PLAINS`, `TERRAIN_GRASS`
- `Feature`: e.g., `FEATURE_FOREST`, `FEATURE_JUNGLE`, `FEATURE_NONE` or empty
- `Resource`: e.g., `RESOURCE_IRON`, `RESOURCE_WHEAT` or empty
- `ResourceType`: `Luxury`, `Strategic`, `Bonus` or empty
- `Appeal`: Numerical appeal value
- `Rivers`: River data (presence often indicated by non-empty value)
- `Continent`: Continent identifier string
- `GoodyHut`: Boolean (`True`/`False`, `1`/`0`)

Place your CSV file (e.g., in the `datasets` directory) and run the conversion script as described in step 2 of "Running the Application".

## Project Structure

Civ6-Optimizer/├── civ-map-three.html          # Main HTML file for the visualization├── civ-map-three.css           # CSS styles for the visualization├── config.json                 # Configuration for Python script (scoring, tiers)├── csv_to_three_converter.py   # Python script to process CSV and generate JSON data├── civ_map_data.json           # Output JSON data used by the frontend (generated)├── modules/                    # Directory for JavaScript ES6 modules│   ├── main.js                 # Main JS entry point│   ├── config.js               # Frontend configuration (colors, sizes, toggles)│   ├── state.js                # Shared application state│   ├── utils.js                # Utility functions (formatting, math)│   ├── sceneSetup.js           # Three.js scene, camera, renderer setup│   ├── mapElements.js          # Creating/updating hexes, markers, labels│   ├── interaction.js          # Mouse/keyboard interaction, tooltips│   ├── uiControls.js           # HTML UI element event listeners│   ├── boatAnimation.js        # Boat animation logic│   └── animation.js            # Main animation loop├── datasets/                   # Directory for map data CSV files│   ├── map_tiny_1.csv          # Sample map data│   └── ...├── README.md                   # This file└── ... (other project files like notebooks, legacy code)
## Future Objectives

This project is being developed as part of a BUAD 313 Operations Management class with the following planned features:

### Short-term Goals
- **Gurobi Optimization Engine**: Implement mathematical optimization using Gurobi to calculate optimal district placement for cities.
- Add city placement recommendation overlays.
- City radius overlays to show workable tiles.

### Mid-term Goals
- District adjacency bonus visualization.

### Long-term Goals
- Interactive district placement tool with real-time adjacency calculations.
- Optimization for specific victory types (Science, Culture, etc.).
- Support for importing maps directly from game save files.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue to discuss potential changes or additions.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details (if one exists).

## Acknowledgments

- Professor Vishal Gupta for his support and guidance throughout the duration of our project.
