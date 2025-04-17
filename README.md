# Civilization VI Map Optimizer

A web-based visualization and optimization tool for Civilization VI maps that helps players identify optimal tile placements for cities and districts.

![Civ Map Visualization](https://via.placeholder.com/800x400?text=Civilization+Map+Visualization)

## Project Overview

This project provides an interactive 3D visualization of Civilization VI map data, allowing players to analyze tile values, resource placements, and terrain features to make better strategic decisions. The visualization shows tile "tiers" based on calculated desirability scores, helping identify optimal locations for city placement.

### Features

- **3D Hexagonal Map Visualization**: Renders game maps with proper terrain, features and elevation
- **Resource Markers**: Visual indicators for bonus, luxury, and strategic resources
- **Tile Scoring System**: Algorithm that evaluates tiles based on yields, features, and appeal
- **Tier Classification**: Categorizes tiles from S-tier (exceptional) to F-tier (poor)
- **Score Histogram**: Visualizes the normalized score distribution across the map
- **Interactive Controls**: Filter tiles by tier, toggle visual elements, and highlight top tiles
- **Tooltip Information**: Detailed information about each tile on hover

## Authors
- Charlie Brunold ([@charlie-brunold](https://github.com/charlie-brunold))
- Lee Stilwell ([@lee-64](https://github.com/lee-64))

## Getting Started

### Prerequisites

- Python 3.7+ (for data processing and local server)
- Modern web browser with WebGL support (Chrome, Firefox, Edge recommended)

### Installation

1. Clone the repository:
```bash
git clone git@github.com:charlie-brunold/Civ6-Optimizer.git
cd civ-map-optimizer
```

2. Install required Python packages:
```bash
pip install pandas numpy
```

### Running the Application

This application uses a simple Python HTTP server to serve the visualization locally. Follow these steps to run it:

1. Process your map data (if needed):
```bash
python csv_to_three_converter.py datasets/your_map.csv civ_map_data.json
```
Alternatively, use one of the sample data files provided in the datasets sub-directory as an example.

2. Start a local HTTP server:
```bash
# Python 3
python -m http.server

# OR Python 2
# python -m SimpleHTTPServer
```

3. Open your browser and navigate to:
```
http://localhost:8000/civ-map-three.html
```

### Using Your Own Map Data

Currently, exporting map data is an complicated and poorly implemented process that requires accessing the Civ VI developer console. We're actively exploring solutions to streamline uploading your own map files to the server, but in the meantime feel free to explore creating your own CSV files for the service. 

Map data should be placed in the `datasets` directory in CSV format with the following columns:
- X, Y: Tile coordinates
- Terrain: Terrain type (e.g., TERRAIN_PLAINS, TERRAIN_GRASS)
- Feature: Natural features (e.g., FEATURE_FOREST, FEATURE_JUNGLE)
- Resource: Resources on the tile (e.g., RESOURCE_IRON, RESOURCE_WHEAT)
- ResourceType: Category (Luxury, Strategic, Bonus)
- Appeal: Tile appeal value
- Rivers: River data (if applicable)
- Continent: Continent identifier
- GoodyHut: Boolean indicating tribal village presence

As mentioned above, to convert a valid map data csv file to the required format, use the command:
```bash
python csv_to_three_converter.py datasets/your_map.csv civ_map_data.json
```

## Project Structure

- `civ-map-three.html`: Main HTML file for the web based visualization
- `civ-map-three.js`: Core Three.js implementation
- `civ_map.css`: Styling for the visualization
- `csv_to_three_converter.py`: Python script to convert CSV map data to compatible JSON
- `datasets/`: Directory containing sample and user map data

## Future Objectives

This project is being developed as part of a BUAD 313 Operations Management class with the following planned features:

### Short-term Goals
- **Gurobi Optimization Engine**: Implement mathematical optimization using Gurobi to calculate optimal district placement for cities
- Add city placement recommendation overlays
- City radius overlays to show workable tiles

### Mid-term Goals
- District adjacency bonus visualization

### Long-term Goals
- Interactive district placement tool with real-time adjacency calculations
- Optimization for specific victory types (Science, Culture, etc.)
- Support for importing maps directly from game save files

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue to discuss potential changes or additions.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Professor Vishal Gupta for his support and guidance throughout the duration of our project