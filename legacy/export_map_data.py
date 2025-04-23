import pandas as pd
import json
import os

def export_map_data_to_json(df, output_file="map_data.json"):
    """
    Export processed map data to a JSON file for use with D3.js visualization.
    
    Parameters:
    df (pandas.DataFrame): The processed DataFrame containing map data
    output_file (str): Path to save the JSON output
    """
    # Create a copy of the DataFrame to avoid modifying the original
    export_df = df.copy()
    
    # Convert NaN values to None for proper JSON serialization
    export_df = export_df.where(pd.notnull(df), None)
    
    # Get tier thresholds if available
    tier_thresholds = df.attrs.get('tier_thresholds', None)
    
    # Create the map metadata
    metadata = {
        "dimensions": {
            "width": int(export_df['X'].max() - export_df['X'].min() + 1),
            "height": int(export_df['Y'].max() - export_df['Y'].min() + 1)
        },
        "tier_thresholds": tier_thresholds,
        "min_x": int(export_df['X'].min()),
        "min_y": int(export_df['Y'].min())
    }
    
    # Create a list of tile data
    tiles = []
    for _, row in export_df.iterrows():
        # Extract relevant columns and convert to appropriate types
        tile = {
            "x": int(row['X']),
            "y": int(row['Y']),
            "terrain": row['Terrain'],
            "normalized_score": float(row['normalized_score']) if pd.notnull(row['normalized_score']) else 0,
            "tier": row['tier']
        }
        
        # Add optional columns if they exist and aren't NaN
        optional_columns = ['Feature', 'Resource', 'ResourceType', 'Continent', 
                           'Rivers', 'Appeal', 'CliffSide', 'GoodyHut']
        
        for col in optional_columns:
            if col in row and pd.notnull(row[col]):
                tile[col.lower()] = row[col]
        
        tiles.append(tile)
    
    # Create the final data structure
    map_data = {
        "metadata": metadata,
        "tiles": tiles
    }
    
    # Write to JSON file
    with open(output_file, 'w') as f:
        json.dump(map_data, f, indent=2)
    
    print(f"Map data exported to {os.path.abspath(output_file)}")
    return os.path.abspath(output_file)

# Example usage (can be added to your main function)
# if __name__ == "__main__":
#     filename = "map_tiny_1_copy.csv"
#     results = analyze_map(filename)
#     export_map_data_to_json(results, "civ_map_data.json")
