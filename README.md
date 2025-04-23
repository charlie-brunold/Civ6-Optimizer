# Civilization VI Map Optimizer

A web-based visualization and optimization tool for Civilization VI maps that helps players identify optimal tile placements for cities and districts.

## Project Overview

This project, developed for **BUAD 313 Operations Management at USC**, is a web-based tool designed to help Civilization VI players optimize their gameplay. It provides an interactive 3D map visualization with dynamically calculated tile scores, allowing users to analyze potential settlement locations and identify the most advantageous placements for cities and districts based on customizable scoring weights.

### Features

- **3D Hexagonal Map Visualization**: Renders game maps using Three.js with a flat-topped hex layout, including terrain, features, and elevation.
- **Dynamic & Configurable Tile Scoring**:
    - **Initial Data Processing**: A Python script (`csv_to_three_converter.py`) processes raw map data (CSV) using weights from `config.json` to generate the initial `civ_map_data.json`, which includes both raw tile attributes and pre-calculated scores/tiers.
    - **Live Recalculation**: The frontend JavaScript (`scoring.js`) recalculates tile scores and tiers *in the browser* whenever scoring weights are adjusted via the UI.
- **Adjustable Scoring Weights**: Interactively change the importance of food, production, gold, appeal, resources, etc., using sliders and predefined presets directly within the visualization. See score updates in real-time.
- **Tier Classification**: Categorizes tiles from S-tier (exceptional) to F-tier (poor) based on the currently calculated scores.
- **Score Heatmap**: Optionally overlays a color gradient (blue-cyan-green-yellow-red) onto tiles, representing their calculated normalized score (higher scores are warmer colors).
- **Resource Markers**: Visual indicators for bonus, luxury, and strategic resources.
- **Interactive Controls**: Filter tiles by tier, toggle visual elements (labels, resources, elevation, heatmap), highlight top-tier tiles.
- **Tooltip Information**: Detailed information about each tile appears on hover.
- **Modular Codebase**: Frontend JavaScript is organized into ES6 modules (`modules/`) for better maintainability, including dedicated modules for UI controls, scoring logic, map elements, and state management.

## Authors
- Charlie Brunold ([@charlie-brunold](https://github.com/charlie-brunold))
- Lee Stilwell ([@lee-64](https://github.com/lee-64))

## Getting Started

### Prerequisites

- **Python 3.7+**: Required for the initial map data processing script and running the local web server.
    - **Pandas & NumPy**: Python libraries used for data manipulation. Install via pip: `pip install pandas numpy`
- **Modern Web Browser**: Chrome, Firefox, Edge, or Safari with WebGL and ES6 Module support.

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

The visualization requires two main steps: processing map data into the required JSON format (which includes raw data for the frontend) and serving the HTML/JS/CSS files via a local web server.

1.  **Configure Initial Scoring (Optional - for Python Script):**
    * Edit the `config.json` file if you want to change the *initial* weights used by the Python script (`csv_to_three_converter.py`) when generating the `civ_map_data.json` file. This affects the scores loaded when the page first opens, before any UI adjustments are made. You can also configure heatmap colors and default tier percentile boundaries here.

2.  **Process Map Data (Generate `civ_map_data.json`):**
    * Run the Python script to convert your map data CSV into the `civ_map_data.json` file. This JSON file contains the necessary raw tile data (terrain, features, yields, etc.) *and* the initial scores/tiers calculated using `config.json`.
    * Replace `datasets/your_map.csv` with the path to your input file.
    ```bash
    python csv_to_three_converter.py datasets/your_map.csv civ_map_data.json
    ```
    * Make sure the `config.json` file is in the same directory when you run this script, or provide the path as a third argument:
    ```bash
    python csv_to_three_converter.py datasets/your_map.csv civ_map_data.json path/to/your/config.json
    ```
    * Sample map data is available in the `datasets/` directory (e.g., `map_tiny_1.csv`).

3.  **Start Local Web Server:**
    * From the project's root directory (where `civ-map-three.html` is located), start Python's built-in HTTP server. This is necessary for loading JavaScript modules correctly via `http://`.
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
    * Once loaded, use the "Scoring Weights" section in the controls panel to adjust weights dynamically and see the map update.

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

Place your CSV file (e.g., in the `datasets` directory) and run the conversion script (Step 2 in "Running the Application") to generate the necessary `civ_map_data.json`. Sample sample data files have been provided for you to explore if exporting your own map proves infeasible.

## Development Roadmap

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

Thank you to Professor Vishal Gupta for his support and guidance throughout the duration of our project.
