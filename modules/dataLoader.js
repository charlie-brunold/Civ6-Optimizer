/**
 * modules/dataLoader.js
 * Handles fetching and parsing map data.
 */

/**
 * Asynchronously loads map data from a JSON file.
 * @param {string} url - The URL or path to the map data JSON file.
 * @returns {Promise<object|null>} A promise that resolves with the parsed map data object, or null if an error occurs.
 */
export async function loadMapData(url) {
    console.log(`Attempting to load map data from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // response.ok is true if status is 200-299
            throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Map data loaded and parsed successfully.");
        return data;
    } catch (error) {
        console.error("Failed to load or parse map data:", error);
        // Optionally, display a user-friendly error message on the page
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.textContent = `Error loading map: ${error.message}`;
            loadingIndicator.style.color = "red";
        }
        return null; // Indicate failure
    }
}
