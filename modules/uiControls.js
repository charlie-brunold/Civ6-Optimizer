/**
 * uiControls.js
 * Sets up event listeners for UI controls (buttons, checkboxes, sliders).
 */
import * as THREE from 'three'; // Import THREE for color manipulation if needed
// *** Import heatmapColors instead of heatmapColors ***
import { config, updateConfig, tierStyles, heatmapColors } from './config.js';
import * as state from './state.js';
import { updateMapDisplay } from './mapElements.js';
import { log } from './utils.js';

/**
 * Initializes all UI control event listeners.
 */
export function initUIControls() {
    log("Initializing UI controls...");

    // --- Toggle Buttons ---
    setupCheckboxListener('toggle-tier-labels', (checked) => {
        updateConfig('showTierLabels', checked);
        updateMapDisplay();
    });

    setupCheckboxListener('toggle-resources', (checked) => {
        updateConfig('showResources', checked);
        updateMapDisplay();
    });

    setupCheckboxListener('toggle-elevation', (checked) => {
        updateConfig('elevationFactor', checked ? 0.4 : 0);
        log(`Elevation toggled. New factor: ${config.elevationFactor}.`);
        updateMapDisplay(); // Update positions based on new factor
    });

    // *** Updated listener for Heatmap toggle ***
    setupCheckboxListener('toggle-heatmap', (checked) => {
        updateConfig('showScoreHeatmap', checked);
        updateMapDisplay(); // Update colors
        updateHeatmapLegend(checked); // Show/hide heatmap legend
    });

    // --- Action Buttons ---
    setupButtonListener('highlight-top-tiles', (button) => {
        updateConfig('highlightTopTiles', !config.highlightTopTiles); // Toggle the state
        button.textContent = config.highlightTopTiles ? 'Reset Highlighting' : 'Highlight Top Tiles';
        button.classList.toggle('inactive', config.highlightTopTiles);
        updateMapDisplay();
    });

    // --- Tier Filtering ---
    const tierCheckboxes = document.querySelectorAll('.tier-checkbox');
    tierCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleTierFilterChange);
    });

    // Tier "Select/Deselect All" Button
    setupButtonListener('toggle-all-tiers', (button) => {
        const newState = !state.allTiersSelected; // Determine the new state
        state.setAllTiersSelected(newState); // Update the shared state

        button.textContent = newState ? 'Deselect All Tiers' : 'Select All Tiers';
        button.classList.toggle('inactive', !newState);

        tierCheckboxes.forEach(cb => {
            cb.checked = newState;
        });

        // Trigger the filter change handler to update config and display
        handleTierFilterChange();
    });

    // Initialize the "Select/Deselect All" button state based on initial checkbox states
    initializeToggleButtonState();

    // --- Legend Toggle ---
     setupLegendToggle();

    log("UI controls initialized.");
}

/**
 * Helper to set up checkbox event listeners.
 */
function setupCheckboxListener(id, callback) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('change', (event) => {
            callback(event.target.checked);
        });
        callback(element.checked);
    } else {
        log(`Warning: Checkbox element with ID "${id}" not found.`);
    }
}

/**
 * Helper to set up button event listeners.
 */
function setupButtonListener(id, callback) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', () => {
            callback(element);
        });
    } else {
        log(`Warning: Button element with ID "${id}" not found.`);
    }
}

/**
 * Handles changes to the tier filter checkboxes.
 */
function handleTierFilterChange() {
    const checkedTiers = Array.from(document.querySelectorAll('.tier-checkbox:checked'))
        .map(cb => cb.value);
    updateConfig('selectedTiers', checkedTiers);
    initializeToggleButtonState();
    updateMapDisplay();
}

/**
 * Updates the state and appearance of the "Select/Deselect All" tiers button.
 */
function initializeToggleButtonState() {
    const tierCheckboxes = document.querySelectorAll('.tier-checkbox');
    const toggleAllBtn = document.getElementById('toggle-all-tiers');
    if (!toggleAllBtn || tierCheckboxes.length === 0) return;

    const checkedCount = Array.from(tierCheckboxes).filter(cb => cb.checked).length;
    const allSelected = checkedCount === tierCheckboxes.length;
    const noneSelected = checkedCount === 0;

    state.setAllTiersSelected(allSelected);

    if (allSelected) {
        toggleAllBtn.textContent = 'Deselect All Tiers';
        toggleAllBtn.classList.remove('inactive');
    } else {
        toggleAllBtn.textContent = 'Select All Tiers';
        toggleAllBtn.classList.toggle('inactive', noneSelected);
    }
}

/**
 * Sets up the legend toggle functionality.
 */
function setupLegendToggle() {
    const legendToggle = document.getElementById('legend-toggle');
    const legendContent = document.querySelector('.legend-content');

    if (legendToggle && legendContent) {
        legendToggle.addEventListener('click', function() {
            const isHidden = legendContent.style.display === 'none';
            legendContent.style.display = isHidden ? 'block' : 'none';
            legendToggle.textContent = isHidden ? 'Show' : 'Hide';
        });
         legendContent.style.display = 'block';
         legendToggle.textContent = 'Hide';
    } else {
        log("Warning: Legend toggle elements not found.");
    }
}

/**
 * Shows or hides the heatmap legend section and updates its content.
 * @param {boolean} show - Whether to show the heatmap legend.
 */
function updateHeatmapLegend(show) {
    const section = document.getElementById('heatmap-legend-section');
    const gradientBar = section?.querySelector('.heatmap-gradient');
    const minLabel = section?.querySelector('#heatmap-min-label');
    const maxLabel = section?.querySelector('#heatmap-max-label');

    if (section && gradientBar && minLabel && maxLabel) {
        if (show && heatmapColors && heatmapColors.length > 0) { // Check if stops exist
            // *** Construct gradient string from heatmapColors ***
            const gradientColors = heatmapColors.map(color => color.getStyle()).join(', ');
            gradientBar.style.background = `linear-gradient(to right, ${gradientColors})`;

            // Update min/max labels from state
            minLabel.textContent = state.minScore.toFixed(0);
            maxLabel.textContent = state.maxScore.toFixed(0);
            section.style.display = 'block'; // Show the section
        } else {
            section.style.display = 'none'; // Hide the section
        }
    } else {
        log("Warning: Heatmap legend elements not found or color stops missing.");
    }
}
