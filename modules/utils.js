/**
 * utils.js
 * Utility functions for the Civilization Map Visualization.
 */
import { config } from './config.js';

/**
 * Calculates the elevation offset for a tile based on terrain and features.
 * @param {object} tile - The tile data object.
 * @returns {number} The calculated elevation offset.
 */
export function calculateElevation(tile) {
    let elevation = 0;
    const terrain = tile.terrain || '';
    const feature = tile.feature || '';

    // Base elevation for terrain types
    if (terrain === 'TERRAIN_OCEAN') {
        elevation = -0.2 - (Math.random() * 0.12); // Random depth variation
    } else if (terrain === 'TERRAIN_COAST') {
        elevation = -0.1;
    } else if (terrain.includes('HILLS')) {
        elevation = 0.5;
    } else if (terrain.includes('MOUNTAIN')) {
        elevation = 1.0;
    }

    // Adjust for features
    if (feature === 'FEATURE_FOREST' || feature === 'FEATURE_JUNGLE') {
        elevation += 0.25;
    } else if (feature === 'FEATURE_ICE') {
        elevation = 0; // Ice is flat, regardless of underlying terrain
    }

    return elevation * config.elevationFactor;
}

/**
 * Formats a terrain type string for display (e.g., "TERRAIN_GRASS_HILLS" -> "Grass Hills").
 * @param {string} terrain - The terrain type string.
 * @returns {string} The formatted terrain name.
 */
export function formatTerrainName(terrain) {
    if (!terrain) return 'Unknown';
    return terrain
        .replace('TERRAIN_', '')
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Formats a feature type string for display (e.g., "FEATURE_FOREST" -> "Forest").
 * @param {string} feature - The feature type string.
 * @returns {string} The formatted feature name.
 */
export function formatFeatureName(feature) {
    if (!feature) return 'None';
    return feature
        .replace('FEATURE_', '')
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Formats a resource type string for display (e.g., "RESOURCE_IRON" -> "Iron").
 * @param {string} resource - The resource type string.
 * @returns {string} The formatted resource name.
 */
export function formatResourceName(resource) {
    if (!resource) return 'None';
    return resource
        .replace('RESOURCE_', '')
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Quadratic easing out function.
 * @param {number} t - Progress value (0 to 1).
 * @returns {number} Eased value.
 */
export function easeOutQuad(t) {
    return t * (2 - t);
}

/**
 * Smoothstep interpolation function.
 * @param {number} x - Value to smooth.
 * @returns {number} Smoothed value.
 */
export function smoothStep(x) {
    return x * x * (3 - 2 * x);
}

/**
 * Linearly interpolates between two angles, handling wrapping.
 * @param {number} start - Start angle (radians).
 * @param {number} end - End angle (radians).
 * @param {number} t - Interpolation factor (0 to 1).
 * @returns {number} Interpolated angle.
 */
export function lerpAngle(start, end, t) {
    const shortestAngle = ((((end - start) % (2 * Math.PI)) + (3 * Math.PI)) % (2 * Math.PI)) - Math.PI;
    return start + shortestAngle * Math.min(1, t);
}

/**
 * Logs messages to the console, optionally including an object.
 * Also updates the debug overlay if enabled.
 * @param {string} message - The message to log.
 * @param {object} [obj] - Optional object to log alongside the message.
 */
export function log(message, obj) {
    console.log(message, obj !== undefined ? obj : '');

    if (config.debug) {
        const debugContent = document.getElementById('debug-content');
        const debugInfo = document.getElementById('debug-info');

        if (debugContent && debugInfo) {
            debugInfo.style.display = 'block';

            const line = document.createElement('div');
            line.textContent = typeof obj !== 'undefined'
                ? `${message} ${typeof obj === 'object' ? JSON.stringify(obj).substring(0, 100) + '...' : obj}`
                : message;

            // Limit number of lines
            if (debugContent.children.length > 20) {
                debugContent.removeChild(debugContent.firstChild);
            }

            debugContent.appendChild(line);
        }
    }
}

/**
 * Debounces a function, ensuring it's only called after a certain period of inactivity.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait) { // Add the 'export' keyword here
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}