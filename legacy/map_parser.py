#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
map_parser.py: A module for parsing and processing map data from csv files.

Author(s): Charlie Brunold
Date: 2025-04-04
Version: 1.0.0
"""

__author__ = "Charlie Brunold"
__date__ = "2025-04-04"
__version__ = "1.0.0"

import logging
import pandas as pd

logger = logging.getLogger(__name__)

class MapParser:
    def __init__(self, filename=None):
        """
        Initializes the MapParser with a given filename.

        Args:
            filename (str): The name of the CSV file to parse.
        """
        self.filename = filename
        self.map_df = None

        logger.info(f"MapParser object initalized with filename: {filename}")
    
    def load_map_data(self):
        """
        Loads map data from a CSV file, handling various formats and errors.
        """
        try:
            # First try to read CSV with standard pandas approach
            self.map_df = pd.read_csv(self.filename)
            logger.debug(f"CSV successfully loaded with headers: {', '.join(df.columns)}")
        except Exception as e:
            logger.warning(f"Standard loading failed ({e}), trying alternative loading method...")
            
            # Manually define the column names in our CSV file format
            column_names = [
                'X', 'Y', 'Terrain', 'Feature', 'Resource', 'ResourceType', 'Continent', 
                'Rivers', 'Appeal', 'GoodyHut', 'StartingPlot'
            ]

            # Try to read the CSV with different options
            try:
                # Try with header=0 (first row is header)
                self.map_df = pd.read_csv(self.filename, header=0)
                logger.debug("CSV successfully loaded with header=0")
            except:
                try:
                    # Try with no header and specified column names
                    self.map_df = pd.read_csv(self.filename, header=None, names=column_names)
                    logger.debug("CSV successfully loaded with header=None and custom column names")
                except Exception as e2:
                    # Try with different delimiters
                    try:
                        self.map_df = pd.read_csv(self.filename, sep=';')
                        logger.debug("CSV successfully loaded with semicolon delimiter")
                    except:
                        # Last resort - try to load as text and parse manually
                        logger.warning(f"All loading methods failed ({e2}), trying to load as text...")
                        with open(self.filename, 'r') as f:
                            lines = f.readlines()
                        
                        logger.debug(f"First few lines of the file:")
                        for i in range(min(5, len(lines))):
                            logger.debug(f"Line {i+1}: {lines[i].strip()}")
                        
                        raise ValueError(f"Could not load CSV file: {e2}")

        # Identify which columns might contain X and Y coordinates
        potential_x_cols = [col for col in self.map_df.columns if 'x' in col.lower()]
        potential_y_cols = [col for col in self.map_df.columns if 'y' in col.lower()]
        
        # Print the first few rows of data to help diagnose issues
        logger.debug("First 3 rows of the loaded data:")
        print(self.map_df.head(3))
        
        # If X/Y aren't in the dataframe, look for closest matches
        if 'X' not in self.map_df.columns and potential_x_cols:
            print(f"Renaming '{potential_x_cols[0]}' to 'X'")
            self.map_df['X'] = self.map_df[potential_x_cols[0]]
        if 'Y' not in self.map_df.columns and potential_y_cols:
            print(f"Renaming '{potential_y_cols[0]}' to 'Y'")
            self.map_df['Y'] = self.map_df[potential_y_cols[0]]
        
        # Ensure all required columns exist
        required_cols = ['X', 'Y', 'Terrain']
        missing_cols = [col for col in required_cols if col not in self.map_df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {', '.join(missing_cols)}")
        
        # Convert coordinate columns to numeric, with proper error handling
        try:
            self.map_df['X'] = pd.to_numeric(self.map_df['X'])
            print(f"Successfully converted X to numeric")
        except Exception as e:
            print(f"Error converting X to numeric: {e}")
            print(f"X column unique values: {self.map_df['X'].unique()[:10]}")
            
        try:
            self.map_df['Y'] = pd.to_numeric(self.map_df['Y'])
            print(f"Successfully converted Y to numeric")
        except Exception as e:
            print(f"Error converting Y to numeric: {e}")
            print(f"Y column unique values: {self.map_df['Y'].unique()[:10]}")
        
        # Future-proof way to convert Appeal to numeric
        if 'Appeal' in self.map_df.columns:
            try:
                self.map_df['Appeal'] = pd.to_numeric(self.map_df['Appeal'])
            except:
                # Leave as is if conversion fails
                pass
        
        # Convert boolean columns
        bool_columns = ['GoodyHut', 'StartingPlot', 'Forest', 'Jungle', 'Hills']
        for col in bool_columns:
            if col in self.map_df.columns:
                try:
                    self.map_df[col] = self.map_df[col].map({'TRUE': True, 'True': True, 'true': True, '1': True,
                                        'FALSE': False, 'False': False, 'false': False, '0': False})
                    # Convert any remaining non-NaN values to bool
                    mask = pd.notna(self.map_df[col])
                    if mask.any():
                        self.map_df.loc[mask, col] = self.map_df.loc[mask, col].astype(bool)
                except Exception as e:
                    print(f"Warning: Could not convert {col} to boolean: {e}")
        
        # Print final summary of data
        logger.info(f"Final data summary:")
        logger.info(f"- Total rows: {len(self.map_df)}")
        logger.info(f"- X range: {self.map_df['X'].min()} to {self.map_df['X'].max()}, {self.map_df['X'].isna().sum()} NaN values")
        logger.info(f"- Y range: {self.map_df['Y'].min()} to {self.map_df['Y'].max()}, {self.map_df['Y'].isna().sum()} NaN values")
        
        return self.map_df