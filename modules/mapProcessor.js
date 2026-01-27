/**
 * mapProcessor.js
 *
 * This module transforms raw CSV map data into the JSON format expected by
 * the Three.js visualization. It replicates the Python csv_to_three_converter.py
 * logic in JavaScript for browser-side processing.
 */

/**
 * Default configuration used when no config is provided.
 * Mirrors the structure of config.json from the Python pipeline.
 */
export const defaultConfig = {
    yield_values: {
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
        "TERRAIN_SNOW_HILLS": [0, 1, 0],
        "FEATURE_FOREST": [0, 1, 0],
        "FEATURE_JUNGLE": [1, 0, 0],
        "FEATURE_MARSH": [1, 0, 0],
        "FEATURE_FLOODPLAINS": [3, 0, 0],
        "FEATURE_OASIS": [3, 0, 1],
        "FEATURE_REEF": [1, 1, 0]
    },
    resource_values: {
        "Luxury": {
            "RESOURCE_WINE": 3.0, "RESOURCE_FURS": 3.0, "RESOURCE_SILK": 3.0,
            "RESOURCE_SILVER": 3.0, "RESOURCE_SUGAR": 3.0, "RESOURCE_PEARLS": 3.0,
            "RESOURCE_WHALES": 3.0, "RESOURCE_TRUFFLES": 3.0, "RESOURCE_IVORY": 3.0,
            "RESOURCE_COCOA": 3.0, "RESOURCE_COFFEE": 3.0, "RESOURCE_TEA": 3.0,
            "RESOURCE_TOBACCO": 3.0, "RESOURCE_CITRUS": 3.0, "RESOURCE_SALT": 3.0,
            "RESOURCE_DYES": 3.0, "RESOURCE_SPICES": 3.0, "RESOURCE_MARBLE": 3.0,
            "RESOURCE_JADE": 3.0, "RESOURCE_AMBER": 3.0, "RESOURCE_DIAMONDS": 3.0,
            "RESOURCE_GYPSUM": 3.0, "RESOURCE_INCENSE": 3.0, "RESOURCE_COTTON": 3.0,
            "RESOURCE_MERCURY": 3.0, "RESOURCE_OLIVES": 3.0, "RESOURCE_TURTLES": 3.0
        },
        "Bonus": {
            "RESOURCE_BANANAS": 1.5, "RESOURCE_CATTLE": 1.5, "RESOURCE_COPPER": 1.5,
            "RESOURCE_CRABS": 1.5, "RESOURCE_DEER": 1.5, "RESOURCE_FISH": 1.5,
            "RESOURCE_MAIZE": 1.5, "RESOURCE_RICE": 1.5, "RESOURCE_SHEEP": 1.5,
            "RESOURCE_STONE": 1.5, "RESOURCE_WHEAT": 1.5
        },
        "Strategic": {
            "RESOURCE_HORSES": 1.0, "RESOURCE_IRON": 1.0, "RESOURCE_NITER": 0.5,
            "RESOURCE_COAL": 0.5, "RESOURCE_OIL": 0.5, "RESOURCE_ALUMINUM": 0.5,
            "RESOURCE_URANIUM": 0.5
        }
    },
    scoring_weights: {
        yields: {
            food: 2.0,
            production: 1.0,
            gold: 0.5
        },
        bonuses: {
            balance_factor: 1.5,
            resource_luxury_factor: 1.0,
            resource_bonus_factor: 1.0,
            resource_strategic_factor: 1.0,
            fresh_water: 3.0,
            appeal_positive_factor: 0.5,
            appeal_high_value: 2.0,
            goody_hut: 2.0
        }
    },
    tier_percentiles: {
        "F": 0.05,
        "E": 0.15,
        "D": 0.35,
        "C": 0.65,
        "B": 0.85,
        "A": 0.95,
        "S": 1.00
    }
};

/**
 * Maps appeal string values to numeric values (matches Python logic).
 */
const appealStringMap = {
    'Breathtaking': 4,
    'Charming': 2,
    'Average': 0,
    'Uninviting': -2,
    'Disgusting': -4
};

/**
 * Standardizes column names in the parsed CSV data.
 * Handles case-insensitive matching and common variations.
 * @param {Array<object>} csvData - Raw parsed CSV data (array of objects)
 * @returns {Array<object>} CSV data with standardized column names
 */
function standardizeColumnNames(csvData) {
    if (!csvData || csvData.length === 0) return csvData;

    const firstRow = csvData[0];
    const originalKeys = Object.keys(firstRow);

    // Build a mapping from original keys to standardized keys
    const keyMapping = {};

    // Expected standard column names
    const standardNames = {
        'x': 'X',
        'y': 'Y',
        'terrain': 'Terrain',
        'feature': 'Feature',
        'resource': 'Resource',
        'resourcetype': 'ResourceType',
        'resourceamount': 'ResourceAmount',
        'continent': 'Continent',
        'rivers': 'Rivers',
        'appeal': 'Appeal',
        'goodyhut': 'GoodyHut',
        'startingplot': 'StartingPlot',
        'cliffside': 'CliffSide',
        'owner': 'Owner',
        'cityowner': 'CityOwner',
        'district': 'District',
        'building': 'Building',
        'improvement': 'Improvement'
    };

    originalKeys.forEach(key => {
        const lowerKey = key.toLowerCase().trim().replace(/\s+/g, '');
        if (standardNames[lowerKey]) {
            keyMapping[key] = standardNames[lowerKey];
        } else {
            // Keep original key if no mapping found
            keyMapping[key] = key;
        }
    });

    // Apply mapping to all rows
    return csvData.map(row => {
        const newRow = {};
        for (const [oldKey, value] of Object.entries(row)) {
            const newKey = keyMapping[oldKey] || oldKey;
            newRow[newKey] = value;
        }
        return newRow;
    });
}

/**
 * Converts a value to boolean, handling various string representations.
 * @param {*} value - The value to convert
 * @returns {boolean} The boolean representation
 */
function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const lowerValue = value.toLowerCase().trim();
        return ['true', '1', 'yes', 't'].includes(lowerValue);
    }
    return false;
}

/**
 * Parses an appeal value, handling both numeric and string representations.
 * @param {*} value - The appeal value (numeric or string like "Breathtaking")
 * @returns {number|null} The numeric appeal value or null if invalid
 */
function parseAppeal(value) {
    if (value === null || value === undefined || value === '' || value === 'None') {
        return null;
    }

    // Check if it's a string appeal name
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (appealStringMap.hasOwnProperty(trimmed)) {
            return appealStringMap[trimmed];
        }
    }

    // Try to parse as number
    const numValue = parseFloat(value);
    return isNaN(numValue) ? null : numValue;
}

/**
 * Cleans and validates a single tile row from CSV data.
 * @param {object} row - Raw CSV row object
 * @returns {object|null} Cleaned tile object or null if invalid
 */
function cleanTileRow(row) {
    // Parse coordinates
    const x = parseInt(row.X, 10);
    const y = parseInt(row.Y, 10);

    // Skip rows with invalid coordinates
    if (isNaN(x) || isNaN(y)) {
        return null;
    }

    // Clean string values (handle None, null, empty strings)
    const cleanString = (value) => {
        if (value === null || value === undefined || value === 'None' || value === 'none') {
            return '';
        }
        return String(value).trim();
    };

    return {
        X: x,
        Y: y,
        Terrain: cleanString(row.Terrain),
        Feature: cleanString(row.Feature),
        Resource: cleanString(row.Resource),
        ResourceType: cleanString(row.ResourceType),
        Continent: cleanString(row.Continent),
        Rivers: cleanString(row.Rivers),
        Appeal: parseAppeal(row.Appeal),
        GoodyHut: toBoolean(row.GoodyHut),
        StartingPlot: toBoolean(row.StartingPlot),
        CliffSide: toBoolean(row.CliffSide)
    };
}

/**
 * Calculates base yields (food, production, gold) from terrain and features.
 * @param {object} tile - Cleaned tile object
 * @param {object} config - Configuration with yield_values
 * @returns {Array<number>} [food, production, gold]
 */
function calculateBaseYields(tile, config) {
    const yieldValues = config.yield_values || {};

    const terrainYield = yieldValues[tile.Terrain] || [0, 0, 0];
    const featureYield = yieldValues[tile.Feature] || [0, 0, 0];

    return [
        terrainYield[0] + featureYield[0], // food
        terrainYield[1] + featureYield[1], // production
        terrainYield[2] + featureYield[2]  // gold
    ];
}

/**
 * Calculates the yield score component from base yields using weights.
 * @param {number} food - Base food yield
 * @param {number} production - Base production yield
 * @param {number} gold - Base gold yield
 * @param {object} config - Configuration with scoring_weights
 * @returns {number} Yield score component
 */
function calculateYieldScore(food, production, gold, config) {
    const weights = config.scoring_weights?.yields || {};
    const foodWeight = weights.food ?? 1.0;
    const prodWeight = weights.production ?? 1.0;
    const goldWeight = weights.gold ?? 0.5;

    return (food * foodWeight) + (production * prodWeight) + (gold * goldWeight);
}

/**
 * Calculates the balance bonus for tiles with both food and production.
 * @param {number} food - Base food yield
 * @param {number} production - Base production yield
 * @param {object} config - Configuration with scoring_weights
 * @returns {number} Balance bonus
 */
function calculateBalanceBonus(food, production, config) {
    const bonusConfig = config.scoring_weights?.bonuses || {};
    const balanceFactor = bonusConfig.balance_factor ?? 1.0;

    if (food > 0 && production > 0) {
        return Math.min(food, production) * balanceFactor;
    }
    return 0;
}

/**
 * Calculates the resource bonus for a tile.
 * @param {object} tile - Tile object with Resource property
 * @param {object} config - Configuration with resource_values and scoring_weights
 * @returns {number} Resource bonus
 */
function calculateResourceBonus(tile, config) {
    const resource = tile.Resource;
    if (!resource) return 0;

    const resourceConfig = config.resource_values || {};
    const bonusConfig = config.scoring_weights?.bonuses || {};

    let value = 0;
    let factor = 1.0;

    for (const [resType, resources] of Object.entries(resourceConfig)) {
        if (resources[resource] !== undefined) {
            value = resources[resource];
            factor = bonusConfig[`resource_${resType.toLowerCase()}_factor`] ?? 1.0;
            break;
        }
    }

    return value * factor;
}

/**
 * Calculates the fresh water bonus for a tile.
 * @param {object} tile - Tile object with Rivers property
 * @param {object} config - Configuration with scoring_weights
 * @returns {number} Fresh water bonus
 */
function calculateFreshWaterBonus(tile, config) {
    const bonusConfig = config.scoring_weights?.bonuses || {};
    const freshWaterWeight = bonusConfig.fresh_water ?? 0;

    if (tile.Rivers && tile.Rivers.trim() !== '') {
        return freshWaterWeight;
    }
    return 0;
}

/**
 * Calculates the appeal bonus for a tile.
 * @param {object} tile - Tile object with Appeal property
 * @param {object} config - Configuration with scoring_weights
 * @returns {number} Appeal bonus
 */
function calculateAppealBonus(tile, config) {
    const appeal = tile.Appeal;
    if (appeal === null || appeal === undefined) return 0;

    const bonusConfig = config.scoring_weights?.bonuses || {};
    const positiveFactor = bonusConfig.appeal_positive_factor ?? 0.5;

    if (appeal > 0) {
        return appeal * positiveFactor;
    }
    return 0;
}

/**
 * Calculates the goody hut bonus for a tile.
 * @param {object} tile - Tile object with GoodyHut property
 * @param {object} config - Configuration with scoring_weights
 * @returns {number} Goody hut bonus
 */
function calculateGoodyBonus(tile, config) {
    const bonusConfig = config.scoring_weights?.bonuses || {};
    const goodyWeight = bonusConfig.goody_hut ?? 0;

    if (tile.GoodyHut === true) {
        return goodyWeight;
    }
    return 0;
}

/**
 * Calculates the weighted tile score for a single tile.
 * @param {object} tile - Cleaned tile object with base yields
 * @param {object} config - Full configuration object
 * @returns {number} Weighted score
 */
function calculateWeightedTileScore(tile, config) {
    // Skip non-workable tiles (Ocean, Ice)
    if (tile.Terrain === 'TERRAIN_OCEAN' || tile.Feature === 'FEATURE_ICE') {
        return 0;
    }

    const yieldScore = calculateYieldScore(
        tile.base_food, tile.base_production, tile.base_gold, config
    );
    const balanceBonus = calculateBalanceBonus(tile.base_food, tile.base_production, config);
    const resourceBonus = calculateResourceBonus(tile, config);
    const freshWaterBonus = calculateFreshWaterBonus(tile, config);
    const appealBonus = calculateAppealBonus(tile, config);
    const goodyBonus = calculateGoodyBonus(tile, config);

    const totalScore = yieldScore + balanceBonus + resourceBonus +
                       freshWaterBonus + appealBonus + goodyBonus;

    return Math.max(0, totalScore);
}

/**
 * Determines the resource type for a given resource.
 * @param {string} resource - Resource name
 * @param {object} config - Configuration with resource_values
 * @returns {string} Resource type (Luxury, Strategic, Bonus, or default)
 */
function getResourceType(resource, config) {
    if (!resource) return 'default';

    const resourceConfig = config.resource_values || {};

    for (const [resType, resources] of Object.entries(resourceConfig)) {
        if (resources[resource] !== undefined) {
            return resType;
        }
    }
    return 'default';
}

/**
 * Main processing function that transforms raw CSV data into the JSON structure
 * expected by createMapVisualization.
 *
 * @param {Array<object>} csvData - Raw parsed CSV data (array of row objects from PapaParse)
 * @param {object} [config] - Optional configuration object. Uses defaultConfig if not provided.
 * @returns {object} Processed map data with {metadata, tiles} structure
 */
export function processRawMapData(csvData, config = null) {
    const effectiveConfig = config || defaultConfig;

    console.log(`Processing ${csvData.length} rows of CSV data...`);

    // Step 1: Standardize column names
    const standardizedData = standardizeColumnNames(csvData);

    // Step 2: Clean and validate tile data
    const cleanedTiles = standardizedData
        .map(row => cleanTileRow(row))
        .filter(tile => tile !== null);

    console.log(`Cleaned ${cleanedTiles.length} valid tiles.`);

    if (cleanedTiles.length === 0) {
        throw new Error('No valid tiles found in CSV data. Check column names (X, Y, Terrain are required).');
    }

    // Step 3: Calculate base yields for each tile
    cleanedTiles.forEach(tile => {
        const [food, production, gold] = calculateBaseYields(tile, effectiveConfig);
        tile.base_food = food;
        tile.base_production = production;
        tile.base_gold = gold;
    });

    // Step 4: Calculate weighted scores
    cleanedTiles.forEach(tile => {
        tile.weighted_score = calculateWeightedTileScore(tile, effectiveConfig);
    });

    // Step 5: Identify workable tiles and normalize scores
    const workableTiles = cleanedTiles.filter(tile =>
        tile.Terrain !== 'TERRAIN_OCEAN' && tile.Feature !== 'FEATURE_ICE'
    );

    const totalScore = workableTiles.reduce((sum, tile) => sum + tile.weighted_score, 0);
    const avgScore = workableTiles.length > 0 ? totalScore / workableTiles.length : 0;

    console.log(`Average weighted score: ${avgScore.toFixed(2)}`);

    // Normalize scores
    cleanedTiles.forEach(tile => {
        if (tile.Terrain === 'TERRAIN_OCEAN' || tile.Feature === 'FEATURE_ICE') {
            tile.normalized_score = 0;
            tile.tier = null;
        } else if (avgScore === 0) {
            tile.normalized_score = 0;
        } else {
            tile.normalized_score = Math.round((tile.weighted_score / avgScore) * 100);
        }
    });

    // Step 6: Assign tiers based on percentiles
    const tierPercentiles = effectiveConfig.tier_percentiles || {};
    const sortedTiers = Object.entries(tierPercentiles)
        .sort(([, a], [, b]) => a - b);

    // Sort workable tiles by normalized score
    const sortedWorkable = [...workableTiles].sort((a, b) =>
        a.normalized_score - b.normalized_score
    );

    const nTiles = sortedWorkable.length;
    const scoreThresholds = {};

    if (nTiles > 0 && sortedTiers.length > 0) {
        let lastCutoffIndex = 0;

        sortedTiers.forEach(([tier, percentileLimit]) => {
            let cutoffIndex = Math.min(
                Math.ceil(nTiles * percentileLimit) - 1,
                nTiles - 1
            );
            cutoffIndex = Math.max(0, cutoffIndex);

            if (cutoffIndex >= lastCutoffIndex) {
                const scoreAtCutoff = sortedWorkable[cutoffIndex].normalized_score;
                scoreThresholds[tier] = scoreAtCutoff;

                for (let i = lastCutoffIndex; i <= cutoffIndex; i++) {
                    if (sortedWorkable[i].tier === undefined || sortedWorkable[i].tier === null) {
                        sortedWorkable[i].tier = tier;
                    }
                }

                lastCutoffIndex = cutoffIndex + 1;
            }
        });

        // Assign lowest tier to any unassigned tiles
        const lowestTier = sortedTiers[0][0];
        sortedWorkable.forEach(tile => {
            if (tile.tier === undefined || tile.tier === null) {
                tile.tier = lowestTier;
            }
        });
    }

    // Step 7: Calculate map dimensions
    const xValues = cleanedTiles.map(t => t.X);
    const yValues = cleanedTiles.map(t => t.Y);

    const metadata = {
        min_x: Math.min(...xValues),
        max_x: Math.max(...xValues),
        min_y: Math.min(...yValues),
        max_y: Math.max(...yValues),
        tier_score_thresholds: scoreThresholds
    };

    // Step 8: Convert to final output format
    const tiles = cleanedTiles.map(tile => ({
        x: tile.X,
        y: tile.Y,
        terrain: tile.Terrain || null,
        feature: tile.Feature || null,
        resource: tile.Resource || null,
        resourcetype: tile.Resource ? getResourceType(tile.Resource, effectiveConfig) : 'default',
        continent: tile.Continent || null,
        rivers: tile.Rivers || null,
        appeal: tile.Appeal,
        goodyhut: tile.GoodyHut,
        startingplot: tile.StartingPlot,
        cliffside: tile.CliffSide,
        base_food: tile.base_food,
        base_production: tile.base_production,
        base_gold: tile.base_gold,
        weighted_score: tile.weighted_score,
        normalized_score: tile.normalized_score,
        tier: tile.tier
    }));

    console.log(`Processing complete. Generated ${tiles.length} tiles.`);
    console.log(`Map dimensions: X(${metadata.min_x}-${metadata.max_x}), Y(${metadata.min_y}-${metadata.max_y})`);

    return { metadata, tiles };
}

/**
 * Validates that the processed data structure is correct.
 * @param {object} data - Processed map data
 * @returns {boolean} True if valid
 */
export function validateProcessedData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.metadata || typeof data.metadata !== 'object') return false;
    if (!Array.isArray(data.tiles) || data.tiles.length === 0) return false;

    // Check required metadata fields
    const requiredMetaFields = ['min_x', 'max_x', 'min_y', 'max_y'];
    for (const field of requiredMetaFields) {
        if (typeof data.metadata[field] !== 'number') return false;
    }

    // Check a sample tile has required fields
    const sampleTile = data.tiles[0];
    const requiredTileFields = ['x', 'y', 'terrain'];
    for (const field of requiredTileFields) {
        if (sampleTile[field] === undefined) return false;
    }

    return true;
}
