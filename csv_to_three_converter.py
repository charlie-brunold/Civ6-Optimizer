"""
CSV to Three.js Map Data Converter (Refactored with Logging)

This script converts Civilization map data from CSV format to JSON format
compatible with the Three.js visualization. It loads configuration from
'config.json', calculates tile scores based on configurable weights,
assigns tiers, outputs a JSON file, and logs runtime status to a log file.

Usage:
    python csv_to_three_converter_refactored_logged.py <input_csv> <output_json> [config_json] [log_file]

Arguments:
    input_csv: Path to the input CSV map data file.
    output_json: Path where the output JSON file will be saved.
    config_json (optional): Path to the configuration JSON file.
                              Defaults to 'config.json' in the same directory.
    log_file (optional): Path to the log file. Defaults to 'converter.log'.
"""

import pandas as pd
import numpy as np
import json
import sys
import os
import logging # Import the logging module
import traceback

# --- Configuration Loading ---

DEFAULT_CONFIG_FILENAME = 'config.json'
DEFAULT_LOG_FILENAME = 'converter.log'

def setup_logging(log_file_path):
    """Configures the logging module."""
    logging.basicConfig(
        level=logging.INFO, # Set the minimum logging level
        format='%(asctime)s - %(levelname)s - %(message)s', # Define log message format
        filename=log_file_path, # Specify the log file
        filemode='w' # Overwrite the log file each time ('a' to append)
    )
    # Optional: Add a handler to also print logs to console (for debugging)
    # console_handler = logging.StreamHandler(sys.stdout)
    # console_handler.setLevel(logging.INFO)
    # formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    # console_handler.setFormatter(formatter)
    # logging.getLogger('').addHandler(console_handler)
    logging.info("Logging setup complete. Outputting to %s", log_file_path)


def load_config(config_path):
    """Loads the configuration file."""
    if not os.path.isfile(config_path):
        logging.error("Configuration file not found: %s", config_path)
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        logging.info("Configuration loaded successfully from %s", config_path)
        # Basic validation (can be expanded)
        if 'scoring_weights' not in config or 'yield_values' not in config:
            logging.error("Config file missing essential keys like 'scoring_weights' or 'yield_values'")
            raise ValueError("Config file missing essential keys like 'scoring_weights' or 'yield_values'")
        return config
    except json.JSONDecodeError as e:
        logging.error("Error decoding JSON from %s: %s", config_path, e)
        raise ValueError(f"Error decoding JSON from {config_path}: {e}")
    except Exception as e:
        logging.exception("Failed to load or parse config file %s", config_path)
        raise RuntimeError(f"Failed to load or parse config file {config_path}: {e}")

# --- Data Loading ---

def load_map_data(filename):
    """
    Load map data from a CSV file, attempting various parsing strategies.
    """
    try:
        # Try standard loading
        df = pd.read_csv(filename)
        logging.info("CSV loaded with standard method. Headers: %s", ', '.join(df.columns))
    except Exception as e:
        logging.warning("Standard loading failed (%s), trying alternative loading methods...", e)
        # Define expected columns (can be adjusted)
        column_names = [
            'X', 'Y', 'Terrain', 'Feature', 'Resource', 'ResourceType', 'Continent',
            'Rivers', 'Appeal', 'GoodyHut', 'StartingPlot'
        ]
        load_attempts = [
            lambda f: pd.read_csv(f, header=0),
            lambda f: pd.read_csv(f, header=None, names=column_names, skiprows=1), # Skip header if names provided
            lambda f: pd.read_csv(f, sep=';', header=0),
            lambda f: pd.read_csv(f, sep='\t', header=0)
        ]
        df = None
        for i, attempt in enumerate(load_attempts):
            try:
                df = attempt(filename)
                logging.info("Loaded CSV successfully using attempt %d", i+1)
                break
            except Exception as e_att:
                logging.warning("Attempt %d failed: %s", i+1, e_att)

        if df is None:
            try:
                with open(filename, 'r') as f:
                    lines = f.readlines()
                logging.error("Could not load CSV file '%s' after multiple attempts. First 5 lines:", filename)
                for i in range(min(5, len(lines))):
                    logging.error("Line %d: %s", i+1, lines[i].strip())
            except Exception as read_err:
                 logging.error("Could not read file '%s' to show first lines: %s", filename, read_err)
            raise ValueError(f"Could not load CSV file '{filename}' after multiple attempts.")

    # --- Column Renaming and Type Conversion ---
    # Standardize coordinate columns
    potential_x_cols = [col for col in df.columns if 'x' in col.lower()]
    potential_y_cols = [col for col in df.columns if 'y' in col.lower()]

    if 'X' not in df.columns and potential_x_cols:
        logging.info("Renaming '%s' to 'X'", potential_x_cols[0])
        df.rename(columns={potential_x_cols[0]: 'X'}, inplace=True)
    if 'Y' not in df.columns and potential_y_cols:
        logging.info("Renaming '%s' to 'Y'", potential_y_cols[0])
        df.rename(columns={potential_y_cols[0]: 'Y'}, inplace=True)

    # Ensure required columns exist
    required_cols = ['X', 'Y', 'Terrain']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        logging.error("Missing required columns after loading/renaming: %s", ', '.join(missing_cols))
        raise ValueError(f"Missing required columns after loading/renaming: {', '.join(missing_cols)}")

    # Convert types
    df['X'] = pd.to_numeric(df['X'], errors='coerce')
    df['Y'] = pd.to_numeric(df['Y'], errors='coerce')
    df.dropna(subset=['X', 'Y'], inplace=True) # Drop rows where coordinates couldn't be parsed
    df['X'] = df['X'].astype(int)
    df['Y'] = df['Y'].astype(int)

    # Convert Appeal to numeric if it exists
    if 'Appeal' in df.columns:
        # Handle potential string representations before converting
        df['Appeal'] = df['Appeal'].replace({'Breathtaking': 4, 'Charming': 2, 'Average': 0, 'Uninviting': -2, 'Disgusting': -4}, regex=False)
        df['Appeal'] = pd.to_numeric(df['Appeal'], errors='coerce') # Coerce remaining non-numeric to NaN

    # Convert boolean columns (handle various string/numeric representations)
    bool_columns = ['GoodyHut', 'StartingPlot', 'CliffSide']
    for col in bool_columns:
        if col in df.columns:
            # Map common true/false representations to boolean
            true_values = ['TRUE', 'True', 'true', '1', 1, 'YES', 'Yes', 'yes', 'T', 't']
            false_values = ['FALSE', 'False', 'false', '0', 0, 'NO', 'No', 'no', 'F', 'f']
            # Use .loc to avoid SettingWithCopyWarning
            df.loc[:, col] = df[col].apply(lambda x: True if str(x).strip() in true_values else (False if str(x).strip() in false_values else None))
            # Fill remaining NaNs with False (or choose appropriate default)
            # Use .loc here as well
            df.loc[:, col] = df[col].fillna(False)
            df.loc[:, col] = df[col].astype(bool)


    # Fill NA for other potentially missing string columns
    str_cols = ['Terrain', 'Feature', 'Resource', 'ResourceType', 'Continent', 'Rivers']
    for col in str_cols:
        if col in df.columns:
             # Use .loc to avoid SettingWithCopyWarning
            df.loc[:, col] = df[col].fillna('') # Use empty string for missing text data
        else:
            df[col] = '' # Add column if it doesn't exist

    logging.info("Data loaded and cleaned. Shape: %s", df.shape)
    return df

# --- Scoring Calculations (No logging needed within these pure functions unless debugging) ---

def calculate_base_yields(tile, config):
    """Calculates base yields from terrain and features."""
    yield_values = config.get('yield_values', {})
    terrain_yield = yield_values.get(tile.get('Terrain', ''), [0, 0, 0])
    feature_yield = yield_values.get(tile.get('Feature', ''), [0, 0, 0])

    total_food = terrain_yield[0] + feature_yield[0]
    total_production = terrain_yield[1] + feature_yield[1]
    total_gold = terrain_yield[2] + feature_yield[2]

    return total_food, total_production, total_gold

def calculate_yield_score(food, production, gold, config):
    """Calculates the score component from base yields."""
    weights = config.get('scoring_weights', {}).get('yields', {})
    food_w = weights.get('food', 1.0)
    prod_w = weights.get('production', 1.0)
    gold_w = weights.get('gold', 0.5)
    return (food * food_w) + (production * prod_w) + (gold * gold_w)

def calculate_balance_bonus(food, production, config):
    """Calculates the bonus for balanced food and production."""
    bonus_config = config.get('scoring_weights', {}).get('bonuses', {})
    balance_factor = bonus_config.get('balance_factor', 1.0)
    if food > 0 and production > 0:
        return min(food, production) * balance_factor
    return 0

def calculate_resource_bonus(tile, config):
    """Calculates the bonus from resources."""
    resource = tile.get('Resource', '')
    if not resource or resource == '':
        return 0

    resource_config = config.get('resource_values', {})
    bonus_config = config.get('scoring_weights', {}).get('bonuses', {})

    value = 0
    factor = 1.0

    for res_type, resources in resource_config.items():
        if resource in resources:
            value = resources[resource]
            factor = bonus_config.get(f'resource_{res_type.lower()}_factor', 1.0)
            break # Found the resource type

    return value * factor

def calculate_fresh_water_bonus(tile, config):
    """Calculates the bonus for fresh water access."""
    bonus_config = config.get('scoring_weights', {}).get('bonuses', {})
    fresh_water_weight = bonus_config.get('fresh_water', 0)
    # Check if 'Rivers' column exists and is not empty/NaN
    if 'Rivers' in tile and pd.notna(tile['Rivers']) and tile['Rivers'] != '':
         # Could add more sophisticated checks here (e.g., specific river names)
        return fresh_water_weight
    return 0

def calculate_appeal_bonus(tile, config):
    """Calculates the bonus from tile appeal."""
    if 'Appeal' not in tile or pd.isna(tile['Appeal']):
        return 0

    bonus_config = config.get('scoring_weights', {}).get('bonuses', {})
    positive_factor = bonus_config.get('appeal_positive_factor', 0.5)
    high_value = bonus_config.get('appeal_high_value', 2.0) # Value for string representations

    try:
        appeal_value = float(tile['Appeal'])
        if appeal_value > 0:
            return appeal_value * positive_factor
        # Can add penalties for negative appeal if desired
        # elif appeal_value < 0:
        #     return appeal_value * negative_factor
    except (ValueError, TypeError):
         # Handle potential string values if conversion failed earlier
         appeal_str = str(tile['Appeal']).lower()
         if appeal_str in ['good', 'high', 'positive', 'breathtaking', 'charming']:
             return high_value
    return 0


def calculate_goody_bonus(tile, config):
    """Calculates the bonus for goody huts."""
    bonus_config = config.get('scoring_weights', {}).get('bonuses', {})
    goody_weight = bonus_config.get('goody_hut', 0)
    if 'GoodyHut' in tile and tile['GoodyHut'] is True:
        return goody_weight
    return 0

def calculate_tile_score(tile, config):
    """
    Calculates the overall desirability score for a single tile using config weights.
    Input 'tile' is expected to be a Pandas Series or dictionary-like object.
    """
    # Skip non-workable tiles (Oceans, Ice)
    terrain = tile.get('Terrain', '')
    feature = tile.get('Feature', '')
    if terrain == 'TERRAIN_OCEAN' or feature == 'FEATURE_ICE':
        return 0

    # 1. Base Yields
    food, production, gold = calculate_base_yields(tile, config)

    # 2. Score Components
    yield_score = calculate_yield_score(food, production, gold, config)
    balance_bonus = calculate_balance_bonus(food, production, config)
    resource_bonus = calculate_resource_bonus(tile, config)
    fresh_water_bonus = calculate_fresh_water_bonus(tile, config)
    appeal_bonus = calculate_appeal_bonus(tile, config)
    goody_bonus = calculate_goody_bonus(tile, config)

    # 3. Total Score
    total_score = (
        yield_score +
        balance_bonus +
        resource_bonus +
        fresh_water_bonus +
        appeal_bonus +
        goody_bonus
    )

    return max(0, total_score) # Ensure score is not negative

# --- Normalization and Tier Assignment ---

def normalize_scores_and_assign_tiers(df, config):
    """
    Normalizes scores for workable tiles and assigns tiers based on config percentiles.
    """
    # Identify workable tiles (exclude Ocean and Ice)
    workable_mask = (
        (df['Terrain'] != 'TERRAIN_OCEAN') &
        (df['Feature'] != 'FEATURE_ICE')
    )
    # Initial filter to calculate average score
    initial_workable_tiles = df.loc[workable_mask]

    if initial_workable_tiles.empty:
        logging.warning("No workable tiles found for normalization and tier assignment.")
        df['normalized_score'] = 0.0
        df['tier'] = None
        return df, {} # Return empty thresholds

    # Calculate raw scores if not already present (e.g., if called independently)
    if 'raw_score' not in df.columns:
         logging.info("Calculating raw scores before normalization...")
         # Use .loc to assign to the original DataFrame
         df.loc[:, 'raw_score'] = df.apply(lambda row: calculate_tile_score(row, config), axis=1)
         # Re-filter after calculating scores
         initial_workable_tiles = df.loc[workable_mask]


    # --- Normalization ---
    # Normalize based on the average score of *workable* tiles
    avg_score = initial_workable_tiles['raw_score'].mean()
    if avg_score == 0: # Avoid division by zero if all workable scores are 0
        logging.warning("Average score of workable tiles is 0. Setting normalized scores to 0.")
        df.loc[:, 'normalized_score'] = 0.0
    else:
        # Apply normalization to the entire DataFrame, but based on workable average
        # Use .loc for assignment
        df.loc[:, 'normalized_score'] = np.round((df['raw_score'] / avg_score) * 100)

    # Ensure non-workable tiles have a normalized score of 0 or NaN (optional, 0 might be simpler)
    df.loc[~workable_mask, 'normalized_score'] = 0.0 # Or np.nan

    # --- Tier Assignment ---
    tier_percentiles = config.get('tier_percentiles', {})
    if not tier_percentiles:
        logging.warning("'tier_percentiles' not found in config. Skipping tier assignment.")
        df['tier'] = None
        return df, {}

    # ***** FIX: Re-filter workable_tiles *after* normalized_score is calculated *****
    workable_tiles = df.loc[workable_mask].copy() # Use .copy() to avoid potential SettingWithCopyWarning later

    # Sort workable tiles by normalized score to determine ranks
    # Use dropna() in case normalization resulted in NaN for some workable tiles (shouldn't happen with current logic)
    # Now 'normalized_score' exists in workable_tiles
    sorted_workable = workable_tiles.dropna(subset=['normalized_score']).sort_values('normalized_score')
    n_tiles = len(sorted_workable)

    if n_tiles == 0:
        logging.warning("No workable tiles with valid scores for tier assignment.")
        df['tier'] = None
        return df, {}

    # Define tier boundaries based on percentiles
    # Ensure tiers are processed in a logical order (e.g., F to S)
    # Sort by percentile value
    sorted_tiers = sorted(tier_percentiles.items(), key=lambda item: item[1])

    # Calculate score thresholds for each tier boundary
    score_thresholds = {} # Store the score value at each percentile boundary
    last_cutoff_index = 0

    for tier, percentile_limit in sorted_tiers:
        # Ensure cutoff_index is calculated based on the actual number of sorted workable tiles
        cutoff_index = min(int(n_tiles * percentile_limit), n_tiles - 1) # Ensure index is within bounds

        # Check if cutoff_index is valid (it might be negative if n_tiles is 0, handled above)
        if cutoff_index < last_cutoff_index:
            # This can happen if percentiles are very close and n_tiles is small
            # or if percentile_limit is 0. Skip assigning this tier range.
            logging.warning("Skipping tier '%s' assignment due to index range (%d to %d)",
                            tier, last_cutoff_index, cutoff_index)
            continue

        # Get the score at this percentile cutoff
        # Ensure we access iloc using a valid index relative to sorted_workable
        score_at_cutoff = sorted_workable['normalized_score'].iloc[cutoff_index]


        # Assign tier to tiles within the percentile range [last_cutoff, current_cutoff]
        # Get the original indices from the sorted workable DataFrame
        indices_in_tier = sorted_workable.index[last_cutoff_index : cutoff_index + 1] # Inclusive slice

        # Use .loc on the main DataFrame 'df' to assign the tier
        df.loc[indices_in_tier, 'tier'] = tier

        # Store threshold information (useful for legend)
        # Threshold is the *minimum* score required to *enter* the next tier (or max of current)
        # Convert numpy float types to standard Python float for JSON compatibility
        score_thresholds[tier] = float(score_at_cutoff) if not pd.isna(score_at_cutoff) else None


        last_cutoff_index = cutoff_index + 1 # Move to the start of the next range

    # Handle potential edge cases (e.g., all scores are the same)
    # Ensure all workable tiles got a tier assigned
    unassigned_mask = workable_mask & df['tier'].isna()
    if unassigned_mask.any():
        num_unassigned = unassigned_mask.sum()
        logging.warning("%d workable tiles were not assigned a tier. Assigning lowest tier.", num_unassigned)
        lowest_tier = sorted_tiers[0][0] if sorted_tiers else 'F'
        df.loc[unassigned_mask, 'tier'] = lowest_tier

    # Log tier distribution using logging
    tier_counts = df[workable_mask]['tier'].value_counts(dropna=False)
    logging.info("Tier distribution:\n%s", tier_counts.to_string()) # Log the distribution

    # Return the DataFrame and the calculated score thresholds per tier
    return df, score_thresholds


# --- Output Formatting ---

def convert_to_three_js_format(df, score_thresholds):
    """
    Convert the DataFrame to the Three.js JSON format, handling NaN values.
    """
    if df.empty:
        logging.warning("DataFrame is empty. Cannot generate JSON output.")
        return {"metadata": {}, "tiles": []}

    # Determine map dimensions
    min_x = int(df['X'].min())
    max_x = int(df['X'].max())
    min_y = int(df['Y'].min())
    max_y = int(df['Y'].max())

    # Create metadata - Ensure thresholds are JSON serializable (handle potential numpy types)
    serializable_thresholds = {k: (float(v) if pd.notna(v) else None) for k, v in score_thresholds.items()}
    metadata = {
        'min_x': min_x,
        'max_x': max_x,
        'min_y': min_y,
        'max_y': max_y,
        'tier_score_thresholds': serializable_thresholds
    }

    # Create tiles list
    tiles_list = []
    # Use to_dict('records') for efficiency
    for record in df.to_dict('records'):
        # Helper function to convert value to JSON-safe format (handle NaN -> None)
        def safe_json_value(value, target_type=None):
            if pd.isna(value):
                return None
            if target_type == float:
                return float(value)
            if target_type == int:
                return int(value)
            if target_type == bool:
                return bool(value)
            # For strings, ensure empty strings become None if desired, else return as is
            if isinstance(value, str) and value == '':
                 return None # Represent empty strings as null
            return value # Return other types (like strings) as is

        tile_data = {
            'x': safe_json_value(record['X'], int),
            'y': safe_json_value(record['Y'], int),
            'terrain': safe_json_value(record.get('Terrain')),
            'feature': safe_json_value(record.get('Feature')),
            'resource': safe_json_value(record.get('Resource')),
            'resourcetype': safe_json_value(record.get('ResourceType')),
            'continent': safe_json_value(record.get('Continent')),
            'rivers': safe_json_value(record.get('Rivers')),
            'appeal': safe_json_value(record.get('Appeal'), float),
            'goodyhut': safe_json_value(record.get('GoodyHut', False), bool),
            'normalized_score': safe_json_value(record.get('normalized_score'), float),
            'tier': safe_json_value(record.get('tier'))
        }

        tiles_list.append(tile_data)

    # Create the final structure
    result = {
        'metadata': metadata,
        'tiles': tiles_list
    }

    return result

# --- Main Execution ---

def main():
    # --- Argument Parsing ---
    if len(sys.argv) < 3:
        # Cannot log here yet as logging is not setup
        print("Usage: python csv_to_three_converter_refactored_logged.py <input_csv> <output_json> [config_json] [log_file]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    config_file = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_CONFIG_FILENAME
    log_file = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_LOG_FILENAME

    # --- Setup Logging ---
    setup_logging(log_file)

    # Check if input file exists
    if not os.path.isfile(input_file):
        logging.error("Input file '%s' not found.", input_file)
        sys.exit(1)

    try:
        # --- Load Configuration ---
        logging.info("Attempting to load configuration from '%s'...", config_file)
        config = load_config(config_file)

        # --- Load Data ---
        logging.info("Loading map data from '%s'...", input_file)
        df = load_map_data(input_file)

        # --- Calculate Scores ---
        logging.info("Calculating tile scores...")
        # Apply the scoring function row by row
        df['raw_score'] = df.apply(lambda row: calculate_tile_score(row, config), axis=1)
        # Log head of scores for debugging if needed (using DEBUG level)
        logging.debug("Raw score calculation complete. Example scores:\n%s", df['raw_score'].head().to_string())

        # --- Normalize and Assign Tiers ---
        logging.info("Normalizing scores and assigning tiers...")
        df, score_thresholds = normalize_scores_and_assign_tiers(df, config)
        logging.info("Normalization and tier assignment complete. Tier thresholds: %s", score_thresholds)

        # --- Convert to Output Format ---
        logging.info("Converting data to Three.js JSON format...")
        result_json = convert_to_three_js_format(df, score_thresholds)

        # --- Save Output ---
        logging.info("Saving JSON data to '%s'...", output_file)
        output_dir = os.path.dirname(output_file)
        if output_dir and not os.path.exists(output_dir):
             logging.info("Creating output directory: %s", output_dir)
             os.makedirs(output_dir) # Create output directory if it doesn't exist

        # Use default_handler to convert potential numpy types during dump
        def default_serializer(obj):
            if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                                np.int16, np.int32, np.int64, np.uint8,
                                np.uint16, np.uint32, np.uint64)):
                return int(obj)
            elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
                 # Check for NaN specifically here before converting
                 if np.isnan(obj):
                     return None # Convert NaN to None (JSON null)
                 return float(obj)
            elif isinstance(obj, (np.ndarray,)): # Handle arrays if any slip through
                return obj.tolist()
            elif isinstance(obj, (np.bool_)):
                return bool(obj)
            elif pd.isna(obj): # Catch pandas NaT or other NA types
                return None
            # Let the base default method raise the TypeError
            raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


        with open(output_file, 'w') as f:
            # Pass allow_nan=False to enforce standard JSON compliance
            # The conversion logic should handle NaNs before they reach dump
            json.dump(result_json, f, indent=2, allow_nan=False, default=default_serializer)


        logging.info("----------------------------------------")
        logging.info("Conversion complete!")
        logging.info("Output saved to: %s", output_file)
        logging.info("Total tiles processed: %d", len(df))
        logging.info("Map dimensions (X): %d to %d", result_json['metadata']['min_x'], result_json['metadata']['max_x'])
        logging.info("Map dimensions (Y): %d to %d", result_json['metadata']['min_y'], result_json['metadata']['max_y'])
        logging.info("----------------------------------------")

    except FileNotFoundError as e:
        logging.error("Error: %s", e)
        sys.exit(1)
    except ValueError as e:
        # Catch the specific JSON compliance error if it still occurs
        if "not JSON compliant" in str(e):
             logging.error("JSON Compliance Error: %s", e)
             logging.error("This usually means a NaN, Infinity, or -Infinity value was not properly converted to null.")
             # Add more debugging here if needed, e.g., inspect result_json
        else:
             logging.error("Data Error: %s", e)
        # logging.exception("ValueError occurred:") # Uncomment for full traceback in log
        sys.exit(1)
    except KeyError as e:
        logging.exception("Key Error: Missing expected column or key: %s", e) # Log with traceback
        sys.exit(1)
    except Exception as e:
        logging.exception("An unexpected error occurred:") # Log exception with traceback
        sys.exit(1)

if __name__ == "__main__":
    main()