/**
 * scoring.js
 *
 * This module replicates the tile scoring, normalization, and tier assignment
 * logic from the Python 'csv_to_three_converter.py' script.
 *
 * It takes raw tile data and a configuration object as input and calculates
 * weighted scores, normalized scores, and tiers for each tile based on the
 * provided configuration weights and thresholds.
 */

// --- Calculation Functions (calculateYieldScore, etc.) ---
// These functions remain the same as in the previous version.
// Assume they are correctly defined above this point.
// ... (calculateYieldScore, calculateBalanceBonus, calculateResourceBonus, etc.) ...

/**
 * Calculates the score component derived from base yields using configured weights.
 * @param {number} food - Base food yield of the tile.
 * @param {number} production - Base production yield of the tile.
 * @param {number} gold - Base gold yield of the tile.
 * @param {object} config - The configuration object containing scoring weights.
 * @returns {number} The calculated yield score component.
 */
function calculateYieldScore(food, production, gold, config) {
    // Ensure config and necessary sub-objects/values exist, providing defaults
    const weights = config?.scoring_weights?.yields ?? {};
    const food_w = weights.food ?? 1.0;
    const prod_w = weights.production ?? 1.0;
    const gold_w = weights.gold ?? 0.5;

    // Use || 0 to handle potential null/undefined yields passed in
    return ((food || 0) * food_w) + ((production || 0) * prod_w) + ((gold || 0) * gold_w);
}

/**
 * Calculates the bonus score for balanced food and production yields.
 * @param {number} food - Base food yield of the tile.
 * @param {number} production - Base production yield of the tile.
 * @param {object} config - The configuration object containing scoring weights.
 * @returns {number} The calculated balance bonus.
 */
function calculateBalanceBonus(food, production, config) {
    const bonusConfig = config?.scoring_weights?.bonuses ?? {};
    const balanceFactor = bonusConfig.balance_factor ?? 1.0;

    // Ensure both yields are positive numbers
    if ((food || 0) > 0 && (production || 0) > 0) {
        return Math.min(food, production) * balanceFactor;
    }
    return 0;
}

/**
 * Calculates the bonus score derived from the tile's resource.
 * @param {object} tile - The tile data object. Must contain 'resource'.
 * @param {object} config - The configuration object containing resource values and scoring weights.
 * @returns {number} The calculated resource bonus.
 */
function calculateResourceBonus(tile, config) {
    const resource = tile?.resource; // e.g., "RESOURCE_IRON"
    if (!resource) { // Handles null, undefined, empty string
        return 0;
    }

    const resourceConfig = config?.resource_values ?? {}; // e.g., { "strategic": { "RESOURCE_IRON": 5 }, ... }
    const bonusConfig = config?.scoring_weights?.bonuses ?? {}; // e.g., { "resource_strategic_factor": 1.5, ... }

    let value = 0;
    let factor = 1.0;

    // Iterate through resource types (e.g., "strategic", "luxury") in the config
    for (const resType in resourceConfig) {
        if (Object.hasOwnProperty.call(resourceConfig, resType)) {
            const resourcesOfType = resourceConfig[resType];
            // Check if the tile's resource exists within this type's definition
            if (Object.hasOwnProperty.call(resourcesOfType, resource)) {
                value = resourcesOfType[resource] ?? 0; // Get the base value for the resource
                // Get the corresponding factor from the bonus weights
                factor = bonusConfig[`resource_${resType.toLowerCase()}_factor`] ?? 1.0;
                break; // Found the resource type, no need to check others
            }
        }
    }

    return value * factor;
}

/**
 * Calculates the bonus score for having fresh water access (river).
 * @param {object} tile - The tile data object. Must contain 'rivers'.
 * @param {object} config - The configuration object containing scoring weights.
 * @returns {number} The calculated fresh water bonus.
 */
function calculateFreshWaterBonus(tile, config) {
    const bonusConfig = config?.scoring_weights?.bonuses ?? {};
    const freshWaterWeight = bonusConfig.fresh_water ?? 0;

    // Check if 'rivers' property exists and is truthy (not null, undefined, empty string, 0, false)
    // Adjust this check if 'rivers' uses a different representation (e.g., specific string, boolean)
    if (tile?.rivers) {
        return freshWaterWeight;
    }
    return 0;
}

/**
 * Calculates the bonus score derived from the tile's appeal.
 * @param {object} tile - The tile data object. Must contain 'appeal'.
 * @param {object} config - The configuration object containing scoring weights.
 * @returns {number} The calculated appeal bonus.
 */
function calculateAppealBonus(tile, config) {
    // Appeal should be a number (e.g., -4 to 4) or null
    const appealValue = tile?.appeal;
    if (appealValue === null || appealValue === undefined) {
        return 0;
    }

    const bonusConfig = config?.scoring_weights?.bonuses ?? {};
    const positiveFactor = bonusConfig.appeal_positive_factor ?? 0.5;
    // const negativeFactor = bonusConfig.appeal_negative_factor ?? 0.1; // Optional negative penalty

    if (appealValue > 0) {
        return appealValue * positiveFactor;
    }
    // Optional: Add penalty for negative appeal
    // else if (appealValue < 0) {
    //     // Note: appealValue is negative, so multiplying by a positive factor results in a negative bonus (penalty)
    //     return appealValue * negativeFactor;
    // }
    return 0;
}

/**
 * Calculates the bonus score for the presence of a goody hut.
 * @param {object} tile - The tile data object. Must contain 'goodyhut'.
 * @param {object} config - The configuration object containing scoring weights.
 * @returns {number} The calculated goody hut bonus.
 */
function calculateGoodyBonus(tile, config) {
    const bonusConfig = config?.scoring_weights?.bonuses ?? {};
    const goodyWeight = bonusConfig.goody_hut ?? 0;

    // Check if 'goodyhut' property exists and is true
    if (tile?.goodyhut === true) {
        return goodyWeight;
    }
    return 0;
}

/**
 * Calculates the overall weighted desirability score for a single tile using config weights.
 * @param {object} tile - The tile data object. Should contain base yields and other attributes.
 * @param {object} config - The configuration object containing all weights and values.
 * @returns {number} The calculated weighted score for the tile.
 */
function calculateWeightedTileScore(tile, config) {
    // Skip non-workable tiles (Oceans, Ice) based on terrain/feature strings
    const terrain = tile?.terrain ?? '';
    const feature = tile?.feature ?? '';
    if (terrain === 'TERRAIN_OCEAN' || feature === 'FEATURE_ICE') {
        return 0;
    }

    // 1. Get Base Yields from the tile object
    const food = tile?.base_food ?? 0;
    const production = tile?.base_production ?? 0;
    const gold = tile?.base_gold ?? 0;

    // 2. Calculate Score Components using weights
    const yieldScore = calculateYieldScore(food, production, gold, config);
    const balanceBonus = calculateBalanceBonus(food, production, config);
    const resourceBonus = calculateResourceBonus(tile, config);
    const freshWaterBonus = calculateFreshWaterBonus(tile, config);
    const appealBonus = calculateAppealBonus(tile, config);
    const goodyBonus = calculateGoodyBonus(tile, config);

    // 3. Total Weighted Score
    const totalScore = yieldScore + balanceBonus + resourceBonus + freshWaterBonus + appealBonus + goodyBonus;

    return Math.max(0, totalScore); // Ensure score is not negative
}


/**
 * Normalizes weighted scores for workable tiles and assigns tiers based on config percentiles.
 * Modifies the input tile objects by adding/updating 'normalized_score' and 'tier'.
 * @param {Array<object>} tiles - An array of tile data objects. Each object will be modified.
 * @param {object} config - The configuration object containing tier percentiles.
 * @returns {{scoreThresholds: object}} An object containing the calculated score thresholds for each tier.
 */
function normalizeAndAssignTiers(tiles, config) {
    // 1. Identify workable tiles and calculate their weighted scores
    const workableTiles = [];
    tiles.forEach(tile => {
        tile.weighted_score = calculateWeightedTileScore(tile, config);
        const terrain = tile?.terrain ?? '';
        const feature = tile?.feature ?? '';
        tile.is_workable = !(terrain === 'TERRAIN_OCEAN' || feature === 'FEATURE_ICE');

        // *** Initialize tier to null before assignment ***
        tile.tier = null;

        if (tile.is_workable) {
            workableTiles.push(tile);
        } else {
            tile.normalized_score = 0;
            // tile.tier remains null for non-workable
        }
    });

    if (workableTiles.length === 0) {
        console.warn("No workable tiles found for normalization and tier assignment.");
        return { scoreThresholds: {} };
    }

    // 2. --- Normalization ---
    const totalWeightedScore = workableTiles.reduce((sum, tile) => sum + (tile.weighted_score ?? 0), 0);
    const avgScore = workableTiles.length > 0 ? totalWeightedScore / workableTiles.length : 0;

    if (avgScore === 0) {
        console.warn("Average weighted score of workable tiles is 0. Setting normalized scores to 0.");
        workableTiles.forEach(tile => {
            tile.normalized_score = 0;
        });
    } else {
        workableTiles.forEach(tile => {
            tile.normalized_score = Math.round(((tile.weighted_score ?? 0) / avgScore) * 100);
        });
    }
     // Add check for NaN scores after normalization
     const nanScores = workableTiles.filter(tile => isNaN(tile.normalized_score));
     if (nanScores.length > 0) {
         console.warn(`${nanScores.length} workable tiles have NaN normalized_score after normalization. Setting to 0. Check weighted_score calculation.`);
         nanScores.forEach(tile => tile.normalized_score = 0);
     }


    // 3. --- Tier Assignment ---
    const tierPercentiles = config?.tier_percentiles ?? {};
    if (Object.keys(tierPercentiles).length === 0) {
        console.warn("'tier_percentiles' not found in config. Skipping tier assignment.");
        // workableTiles already have tier = null from initialization
        return { scoreThresholds: {} };
    }

    // Sort workable tiles by their *normalized* score (ascending)
    const sortedWorkable = [...workableTiles].sort((a, b) => (a.normalized_score ?? 0) - (b.normalized_score ?? 0));
    const nTiles = sortedWorkable.length;

    if (nTiles === 0) {
        console.warn("No workable tiles with valid scores for tier assignment after sorting.");
         return { scoreThresholds: {} };
    }

    // Sort tiers by their percentile value (ascending) to process F -> S
    const sortedTiersConfig = Object.entries(tierPercentiles).sort(([, percentileA], [, percentileB]) => percentileA - percentileB);
    // Example: [ ['F', 0.1], ['D', 0.25], ..., ['S', 1.0] ]

    const scoreThresholds = {}; // Store the max score for each tier
    let lastCutoffIndex = 0; // Start index for the current tier's range

    console.log(`Assigning tiers to ${nTiles} workable tiles.`); // Log start

    sortedTiersConfig.forEach(([tier, percentileLimit], tierIndex) => {
        // Calculate the *end* index for this tier's percentile range (inclusive)
        // Use Math.ceil to ensure the top percentile reaches the last element
        let cutoffIndex = Math.ceil(nTiles * percentileLimit) - 1;
        // Clamp index to valid range [0, nTiles - 1]
        cutoffIndex = Math.max(0, Math.min(cutoffIndex, nTiles - 1));

        // Ensure cutoff index is not before the start of the range
        // This can happen if percentileLimit is 0 or very small
        if (cutoffIndex < lastCutoffIndex && tierIndex > 0) {
             console.warn(`Skipping tier '${tier}' assignment due to calculated index range (${lastCutoffIndex} to ${cutoffIndex}).`);
             // Don't update lastCutoffIndex here, let the next tier handle these tiles
             return; // Skip to next tier
        }

        // Get the normalized score at this cutoff index (max score for this tier)
        const scoreAtCutoff = sortedWorkable[cutoffIndex]?.normalized_score ?? 0;
        scoreThresholds[tier] = scoreAtCutoff; // Store threshold

        // Assign this tier to all workable tiles from the last cutoff up to the current one
        // console.log(`Assigning tier '${tier}' to indices [${lastCutoffIndex}..${cutoffIndex}] (Score <= ${scoreAtCutoff})`);
        for (let i = lastCutoffIndex; i <= cutoffIndex; i++) {
             // Add safety check for index bounds
             if (i < nTiles && sortedWorkable[i]) {
                // Only assign if the tile doesn't already have a tier (handles potential overlaps better)
                if (sortedWorkable[i].tier === null) {
                    sortedWorkable[i].tier = tier;
                } else {
                     // This case should ideally not happen with correct non-overlapping percentiles
                     // console.warn(`Tile at index ${i} already has tier ${sortedWorkable[i].tier}, not overwriting with ${tier}`);
                }
             } else {
                 console.warn(`Attempted to access invalid index ${i} while assigning tier ${tier}`);
             }
        }

        // Update the starting index for the next tier's range
        lastCutoffIndex = cutoffIndex + 1;
    });

    // --- Final Check for Unassigned Tiles ---
    // Any workable tiles still having tier === null after the loop?
    const unassignedTiles = sortedWorkable.filter(tile => tile.tier === null);
    if (unassignedTiles.length > 0) {
        // Assign the LOWEST tier to any remaining unassigned workable tiles
        const lowestTier = sortedTiersConfig.length > 0 ? sortedTiersConfig[0][0] : 'F'; // Default to 'F'
        console.warn(`${unassignedTiles.length} workable tiles remained unassigned after percentile loop. Assigning lowest tier '${lowestTier}'. Scores:`, unassignedTiles.map(t=>t.normalized_score));
        unassignedTiles.forEach(tile => {
            tile.tier = lowestTier;
        });
    }

    // Log final distribution (optional)
    const tierCounts = workableTiles.reduce((acc, tile) => {
        acc[tile.tier] = (acc[tile.tier] || 0) + 1;
        return acc;
    }, {});
    console.log("Final Tier Distribution:", tierCounts);


    // The original 'tiles' array (passed by reference) has been modified in place.
    return { scoreThresholds };
}

/**
 * Main function to recalculate scores and tiers for all tiles based on a new configuration.
 * Modifies the input tiles array directly.
 * @param {Array<object>} tiles - Array of tile objects (will be modified).
 * @param {object} config - The configuration object with weights and thresholds.
 * @returns {{scoreThresholds: object}} An object containing the calculated score thresholds for each tier.
 */
export function recalculateScoresAndTiers(tiles, config) {
    if (!tiles || !Array.isArray(tiles)) {
        console.error("Invalid input: 'tiles' must be an array.");
        return { scoreThresholds: {} };
    }
    if (!config) {
        console.error("Invalid input: 'config' object is required.");
        return { scoreThresholds: {} };
    }

    console.log("Recalculating scores and tiers with new config...");
    // The normalizeAndAssignTiers function handles both calculation and assignment
    const results = normalizeAndAssignTiers(tiles, config);
    // console.log("Recalculation complete. Tier thresholds:", results.scoreThresholds); // Logged in uiControls now

    // The 'tiles' array is modified in place by normalizeAndAssignTiers
    return results; // Return the thresholds
}

// Example config structure comment remains the same
/*
const defaultConfig = { ... };
*/
