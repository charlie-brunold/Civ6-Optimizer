/**
 * modules/dataLoader.js
 *
 * Handles loading and parsing map data from various sources:
 * - JSON files (legacy support)
 * - CSV files (via PapaParse)
 * - User file uploads
 * - Demo maps from the datasets directory
 */

import { processRawMapData, validateProcessedData, defaultConfig } from './mapProcessor.js';

/**
 * Parses a CSV file using PapaParse (loaded via CDN in HTML).
 * @param {File} file - The File object from an input[type="file"] element
 * @returns {Promise<Array<object>>} Promise resolving to array of row objects
 */
export function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        // Check if PapaParse is available
        if (typeof Papa === 'undefined') {
            reject(new Error('PapaParse library not loaded. Ensure it is included via CDN.'));
            return;
        }

        Papa.parse(file, {
            header: true,           // Use first row as headers
            skipEmptyLines: true,   // Skip empty rows
            dynamicTyping: true,    // Auto-convert numbers
            transformHeader: (header) => header.trim(), // Clean whitespace from headers
            complete: (results) => {
                if (results.errors && results.errors.length > 0) {
                    console.warn('CSV parsing warnings:', results.errors);
                }
                console.log(`Parsed ${results.data.length} rows from CSV file.`);
                resolve(results.data);
            },
            error: (error) => {
                console.error('CSV parsing error:', error);
                reject(new Error(`Failed to parse CSV: ${error.message}`));
            }
        });
    });
}

/**
 * Parses CSV text content using PapaParse.
 * @param {string} csvText - Raw CSV text content
 * @returns {Array<object>} Array of row objects
 */
export function parseCSVText(csvText) {
    if (typeof Papa === 'undefined') {
        throw new Error('PapaParse library not loaded. Ensure it is included via CDN.');
    }

    const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim()
    });

    if (results.errors && results.errors.length > 0) {
        console.warn('CSV parsing warnings:', results.errors);
    }

    console.log(`Parsed ${results.data.length} rows from CSV text.`);
    return results.data;
}

/**
 * Loads and processes a demo map from the datasets directory.
 * @param {string} mapName - Name of the demo map file (e.g., 'map_tiny_1.csv')
 * @param {object} [config] - Optional configuration object for processing
 * @returns {Promise<object>} Promise resolving to processed map data {metadata, tiles}
 */
export async function loadDemoMap(mapName, config = null) {
    const url = `datasets/${mapName}`;
    console.log(`Loading demo map from: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
        }

        const csvText = await response.text();
        console.log(`Fetched CSV data (${csvText.length} characters)`);

        // Parse the CSV text
        const rawData = parseCSVText(csvText);

        // Process into the required format
        const processedData = processRawMapData(rawData, config);

        if (!validateProcessedData(processedData)) {
            throw new Error('Processed data validation failed.');
        }

        console.log(`Demo map '${mapName}' loaded successfully.`);
        return processedData;

    } catch (error) {
        console.error(`Failed to load demo map '${mapName}':`, error);
        throw error;
    }
}

/**
 * Loads and processes a user-uploaded CSV file.
 * @param {File} file - The File object from file input
 * @param {object} [config] - Optional configuration object for processing
 * @returns {Promise<object>} Promise resolving to processed map data {metadata, tiles}
 */
export async function loadUploadedMap(file, config = null) {
    console.log(`Processing uploaded file: ${file.name}`);

    try {
        // Parse the CSV file
        const rawData = await parseCSVFile(file);

        // Process into the required format
        const processedData = processRawMapData(rawData, config);

        if (!validateProcessedData(processedData)) {
            throw new Error('Processed data validation failed.');
        }

        console.log(`Uploaded map '${file.name}' processed successfully.`);
        return processedData;

    } catch (error) {
        console.error(`Failed to process uploaded file '${file.name}':`, error);
        throw error;
    }
}

/**
 * Asynchronously loads map data from a JSON file (legacy support).
 * The JSON file is expected to contain both pre-calculated scores/tiers
 * and the raw tile attributes needed for potential frontend calculations.
 *
 * @param {string} url - The URL or path to the map data JSON file (e.g., 'civ_map_data.json').
 * @returns {Promise<object|null>} A promise that resolves with the parsed map data object
 * (containing 'metadata' and 'tiles' keys), or null if an error occurs.
 */
export async function loadMapData(url) {
    console.log(`Attempting to load map data from: ${url}`);
    const loadingIndicator = document.getElementById('loading-indicator');

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Map data fetched successfully. Validating structure...");

        if (!data || typeof data !== 'object' || !data.metadata || !Array.isArray(data.tiles)) {
            throw new Error("Invalid map data format: Missing 'metadata' or 'tiles' array.");
        }

        console.log(`Map data loaded and validated successfully. Found ${data.tiles.length} tiles.`);

        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        return data;

    } catch (error) {
        console.error("Failed to load or parse map data:", error);

        if (loadingIndicator) {
            loadingIndicator.textContent = `Error loading map: ${error.message}`;
            loadingIndicator.style.color = "red";
            loadingIndicator.style.display = 'block';
        }
        return null;
    }
}

/**
 * Gets the list of available demo maps.
 * @returns {Array<object>} Array of {name, filename} objects
 */
export function getAvailableDemoMaps() {
    return [
        { name: 'Tiny Map 1', filename: 'map_tiny_1.csv' },
        { name: 'Tiny Map 2', filename: 'map_tiny_2_copy.csv' },
        { name: 'Cleaned Map Data', filename: 'cleaned_map_data.csv' }
    ];
}

/**
 * Fetches the configuration from a JSON file or returns default config.
 * @param {string} [url='config.json'] - URL to config file
 * @returns {Promise<object>} Configuration object
 */
export async function loadConfig(url = 'config.json') {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Could not load config from ${url}, using defaults.`);
            return defaultConfig;
        }
        const config = await response.json();
        console.log('Configuration loaded from file.');
        return config;
    } catch (error) {
        console.warn('Error loading config, using defaults:', error.message);
        return defaultConfig;
    }
}
