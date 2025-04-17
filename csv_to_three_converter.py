"""
CSV to Three.js Map Data Converter

This script converts Civilization map data from CSV format to JSON format compatible with the Three.js visualization.
It reads the map data, calculates tile scores, assigns tiers, and outputs a JSON file that can be loaded
by the Three.js visualization.

Usage:
    python csv_to_three_converter.py <input_csv> <output_json>
"""

import pandas as pd
import numpy as np
import json
import sys
import os

# Define terrain yields for scoring - same as in analyzer.py
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

# Feature modifiers: additive to terrain yields
feature_yields = {
    # Format: "FEATURE_<feature_name>": [food, production, gold]
    "FEATURE_FOREST": [0, 1, 0], 
    "FEATURE_JUNGLE": [1, 0, 0],
    "FEATURE_MARSH": [1, 0, 0],
    "FEATURE_FLOODPLAINS": [3, 0, 0],
    "FEATURE_OASIS": [3, 0, 1],
    "FEATURE_REEF": [1, 1, 0]
}

# Resource value bonuses
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

    # bonus resources
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

    # strategic resources
    'RESOURCE_HORSES': 1.0,
    'RESOURCE_IRON': 1.0,
    'RESOURCE_NITER': 0.5,
    'RESOURCE_COAL': 0.5,
    'RESOURCE_OIL': 0.5,
    'RESOURCE_ALUMINUM': 0.5,
    'RESOURCE_URANIUM': 0.5,
}

def calculate_base_yields(tile):
    """
    Calculate the base yields (food, production, gold) for a single tile based on its terrain and feature.
    """
    # Get terrain yields
    terrain_yield = terrain_yields.get(tile['Terrain'], [0, 0, 0])

    # Get feature yields
    feature_yield = [0, 0, 0]
    if pd.notna(tile['Feature']):
        feature_yield = feature_yields.get(tile['Feature'], [0, 0, 0])

    # Sum the yields
    total_food = terrain_yield[0] + feature_yield[0]
    total_production = terrain_yield[1] + feature_yield[1]
    total_gold = terrain_yield[2] + feature_yield[2]

    return [total_food, total_production, total_gold]

def calculate_tile_score(tile):
    """
    Calculate the desirability score for a single tile.
    """
    # Skip ocean and ice tiles
    if tile['Terrain'] == 'TERRAIN_OCEAN' or (pd.notna(tile['Feature']) and tile['Feature'] == 'FEATURE_ICE'):
        return 0
    
    # Calculate base yields
    yields = calculate_base_yields(tile)
    total_food = yields[0]
    total_production = yields[1]
    total_gold = yields[2]

    # Calculate score based on yields
    yield_score = (total_food * 2) + (total_production * 1) + (total_gold * 0.5)

    # Balance bonus for tiles with both food and production
    balance_bonus = 0
    if total_food > 0 and total_production > 0:
        balance_bonus = min(total_food, total_production) * 1.5
    
    # Resource bonus
    resource_bonus = 0
    if pd.notna(tile['Resource']):
        resource_bonus = resource_values.get(tile['Resource'], 0)
    
    # Fresh water bonus
    fresh_water_bonus = 0
    if pd.notna(tile['Rivers']):
        fresh_water_bonus = 3
    
    # Appeal bonus
    appeal_bonus = 0
    if pd.notna(tile['Appeal']):
        try:
            appeal_value = float(tile['Appeal'])
            if appeal_value > 0:
                appeal_bonus = appeal_value * 0.5
        except (ValueError, TypeError):
            if isinstance(tile['Appeal'], str) and tile['Appeal'].lower() in ['good', 'high', 'positive', 'breathtaking']:
                appeal_bonus = 2
    
    # Goody hut bonus
    goody_bonus = 0
    if pd.notna(tile['GoodyHut']) and (tile['GoodyHut'] is True or str(tile['GoodyHut']).lower() in ['true', '1', 'yes']):
        goody_bonus = 2

    # Calculate total score
    total_score = (
        yield_score +
        balance_bonus +
        resource_bonus +
        fresh_water_bonus +
        appeal_bonus +
        goody_bonus
    )

    return max(0, total_score)

def normalize_scores(df):
    """
    Normalize tile scores and divide into data-driven tiers based on septiles
    """
    # Filter to only include workable tiles
    workable_tiles = df[
        (df['Terrain'] != 'TERRAIN_OCEAN') &
        ((df['Feature'].isna()) | (df['Feature'] != 'FEATURE_ICE'))
    ]

    # Calculate statistics
    avg_score = workable_tiles['raw_score'].mean()
    
    # Normalize scores
    df['normalized_score'] = np.round((df['raw_score'] / avg_score) * 100)
    
    # Update workable tiles
    workable_tiles = df[
        (df['Terrain'] != 'TERRAIN_OCEAN') &
        ((df['Feature'].isna()) | (df['Feature'] != 'FEATURE_ICE'))
    ]
    
    # Sort tiles by score
    sorted_tiles = workable_tiles.sort_values('normalized_score')
    
    # Get total number of workable tiles
    n_tiles = len(sorted_tiles)
    
    # Determine rank cutoffs
    cutoffs = [
        0,                    # 0th percentile
        int(n_tiles * 0.05),  # 5th percentile
        int(n_tiles * 0.15),  # 15th percentile
        int(n_tiles * 0.35),  # 35th percentile
        int(n_tiles * 0.65),  # 65th percentile
        int(n_tiles * 0.85),  # 85th percentile
        int(n_tiles * 0.95),  # 95th percentile
        n_tiles                # 100th percentile
    ]
    
    # Get score thresholds at each cutoff
    thresholds = []
    for cutoff in cutoffs:
        if cutoff == 0:
            thresholds.append(sorted_tiles['normalized_score'].min())
        else:
            idx = min(cutoff - 1, len(sorted_tiles) - 1)
            thresholds.append(sorted_tiles['normalized_score'].iloc[idx])
    
    # Initialize tier column
    df['tier'] = None
    
    # Define workable mask
    workable_mask = (
        (df['Terrain'] != 'TERRAIN_OCEAN') & 
        ((df['Feature'].isna()) | (df['Feature'] != 'FEATURE_ICE'))
    )
    
    # Assign tiers based on rank
    sorted_indices = workable_tiles.sort_values('normalized_score').index
    
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
    
    # Return the dataframe and thresholds
    return df, thresholds

def load_map_data(filename):
    """
    Load map data from a CSV file.
    """
    try:
        # Try standard loading
        df = pd.read_csv(filename)
        print(f"CSV loaded with headers: {', '.join(df.columns)}")
    except Exception as e:
        print(f"Standard loading failed ({e}), trying alternative loading method...")
        
        # Define expected columns
        column_names = [
            'X', 'Y', 'Terrain', 'Feature', 'Resource', 'ResourceType', 'Continent', 
            'Rivers', 'Appeal', 'GoodyHut', 'StartingPlot'
        ]

        # Try different loading options
        try:
            df = pd.read_csv(filename, header=0)
            print("Loaded CSV with first row as header")
        except:
            try:
                df = pd.read_csv(filename, header=None, names=column_names)
                print("Loaded CSV with no header, using specified column names")
            except Exception as e2:
                try:
                    df = pd.read_csv(filename, sep=';')
                    print("Loaded CSV with semicolon delimiter")
                except:
                    with open(filename, 'r') as f:
                        lines = f.readlines()
                    
                    print("First few lines of the file:")
                    for i in range(min(5, len(lines))):
                        print(f"Line {i+1}: {lines[i].strip()}")
                    
                    raise ValueError(f"Could not load CSV file: {e2}")

    # Identify potential coordinate columns
    potential_x_cols = [col for col in df.columns if 'x' in col.lower()]
    potential_y_cols = [col for col in df.columns if 'y' in col.lower()]
    
    # If X/Y aren't in the dataframe, look for closest matches
    if 'X' not in df.columns and potential_x_cols:
        print(f"Renaming '{potential_x_cols[0]}' to 'X'")
        df['X'] = df[potential_x_cols[0]]
    if 'Y' not in df.columns and potential_y_cols:
        print(f"Renaming '{potential_y_cols[0]}' to 'Y'")
        df['Y'] = df[potential_y_cols[0]]
    
    # Ensure required columns exist
    required_cols = ['X', 'Y', 'Terrain']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {', '.join(missing_cols)}")
    
    # Convert coordinate columns to numeric
    df['X'] = pd.to_numeric(df['X'], errors='coerce')
    df['Y'] = pd.to_numeric(df['Y'], errors='coerce')
    
    # Convert Appeal to numeric if it exists
    if 'Appeal' in df.columns:
        df['Appeal'] = pd.to_numeric(df['Appeal'], errors='coerce')
    
    # Convert boolean columns
    bool_columns = ['GoodyHut', 'StartingPlot', 'CliffSide']
    for col in bool_columns:
        if col in df.columns:
            df[col] = df[col].map(
                {'TRUE': True, 'True': True, 'true': True, '1': True,
                 'FALSE': False, 'False': False, 'false': False, '0': False}
            )
    
    return df

def analyze_map(filename):
    """
    Analyze the map and calculate desirability scores.
    """
    # Load the map data
    df = load_map_data(filename)
    
    # Calculate scores
    df['raw_score'] = df.apply(calculate_tile_score, axis=1)
    
    # Normalize scores and assign tiers
    df, thresholds = normalize_scores(df)
    
    # Sort by score (descending)
    df_sorted = df.sort_values(by='normalized_score', ascending=False)
    
    return df_sorted, thresholds

def convert_to_three_js_format(df, thresholds):
    """
    Convert the DataFrame to the Three.js JSON format.
    """
    # Determine map dimensions
    min_x = df['X'].min()
    max_x = df['X'].max()
    min_y = df['Y'].min()
    max_y = df['Y'].max()
    
    # Create metadata
    metadata = {
        'min_x': int(min_x),
        'max_x': int(max_x),
        'min_y': int(min_y),
        'max_y': int(max_y),
        'tier_thresholds': thresholds
    }
    
    # Create tiles list
    tiles = []
    
    for _, row in df.iterrows():
        # Create tile object
        tile = {
            'x': int(row['X']),
            'y': int(row['Y']),
            'terrain': row['Terrain'] if pd.notna(row['Terrain']) else None,
            'feature': row['Feature'] if pd.notna(row['Feature']) else None,
            'resource': row['Resource'] if pd.notna(row['Resource']) else None,
            'resourcetype': row['ResourceType'] if pd.notna(row.get('ResourceType', None)) else None,
            'continent': row['Continent'] if pd.notna(row.get('Continent', None)) else None,
            'rivers': row['Rivers'] if pd.notna(row.get('Rivers', None)) else None,
            'appeal': float(row['Appeal']) if pd.notna(row.get('Appeal', None)) else None,
            'goodyhut': bool(row['GoodyHut']) if pd.notna(row.get('GoodyHut', None)) else False,
            'normalized_score': float(row['normalized_score']) if pd.notna(row['normalized_score']) else None,
            'tier': row['tier'] if pd.notna(row['tier']) else None
        }
        
        # Add the tile to the list
        tiles.append(tile)
    
    # Create the final structure
    result = {
        'metadata': metadata,
        'tiles': tiles
    }
    
    return result

def main():
    # Check arguments
    if len(sys.argv) < 3:
        print("Usage: python csv_to_three_converter.py <input_csv> <output_json>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # Check if input file exists
    if not os.path.isfile(input_file):
        print(f"Error: Input file '{input_file}' not found")
        sys.exit(1)
    
    try:
        # Process the map
        print(f"Processing map data from {input_file}...")
        df, thresholds = analyze_map(input_file)
        
        # Convert to Three.js format
        print("Converting to Three.js format...")
        result = convert_to_three_js_format(df, thresholds)
        
        # Save to JSON
        print(f"Saving to {output_file}...")
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"Conversion complete! Data saved to {output_file}")
        print(f"Total tiles processed: {len(df)}")
        print(f"Map dimensions: {result['metadata']['min_x']},{result['metadata']['min_y']} to {result['metadata']['max_x']},{result['metadata']['max_y']}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
