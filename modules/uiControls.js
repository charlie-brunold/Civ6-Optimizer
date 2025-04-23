/**
 * uiControls.js
 * Sets up event listeners for UI controls (buttons, checkboxes, sliders),
 * including scoring weight adjustments.
 */
import * as THREE from 'three'; // Import THREE for color manipulation if needed
// Import config and state management
import { config, updateConfig, tierStyles, heatmapColors, getDefaultWeights } from './config.js';
import * as state from './state.js'; // Import state module
// Import map update function
import { updateMapDisplay } from './mapElements.js';
// Import the recalculation function
import { recalculateScoresAndTiers } from './scoring.js';
// Import utilities
import { log, debounce } from './utils.js';

// --- Preset Weight Configurations ---
// Define different weight profiles users can select
const scoringPresets = {
    balanced: { // Default values (should match config.js initial state)
        yields: { food: 1.0, production: 1.0, gold: 0.5 },
        bonuses: {
            balance_factor: 0.5, resource_strategic_factor: 1.0, resource_luxury_factor: 1.0,
            fresh_water: 10.0, appeal_positive_factor: 0.5, goody_hut: 15.0
        }
    },
    production: {
        yields: { food: 0.8, production: 1.8, gold: 0.4 },
        bonuses: {
            balance_factor: 0.3, resource_strategic_factor: 1.8, resource_luxury_factor: 0.8,
            fresh_water: 8.0, appeal_positive_factor: 0.3, goody_hut: 10.0
        }
    },
    food_growth: {
        yields: { food: 1.8, production: 0.8, gold: 0.4 },
        bonuses: {
            balance_factor: 0.6, resource_strategic_factor: 0.8, resource_luxury_factor: 1.2,
            fresh_water: 15.0, appeal_positive_factor: 0.6, goody_hut: 15.0
        }
    },
    gold: {
        yields: { food: 0.7, production: 0.7, gold: 2.0 },
        bonuses: {
            balance_factor: 0.2, resource_strategic_factor: 1.0, resource_luxury_factor: 1.5,
            fresh_water: 5.0, appeal_positive_factor: 0.4, goody_hut: 10.0
        }
    },
    science: { // Focus on appeal for potential high-adjacency districts
        yields: { food: 0.9, production: 0.9, gold: 0.6 },
        bonuses: {
            balance_factor: 0.4, resource_strategic_factor: 1.2, resource_luxury_factor: 1.2,
            fresh_water: 12.0, appeal_positive_factor: 2.0, goody_hut: 10.0
        }
    }
    // Add more presets as desired
};

/**
 * Helper function to recalculate scores, update state, and refresh display.
 * @param {string} triggerSource - Description of what triggered the update (e.g., "slider", "preset").
 */
function handleRecalculation(triggerSource) {
    // *** FIX: Check state.mapData instead of state.fullMapData ***
    if (state.mapData && state.mapData.tiles) {
        log(`Triggering recalculation due to ${triggerSource}...`);

        // 1. Recalculate scores based on the *current* config.scoring_weights
        // This modifies tiles in state.mapData.tiles directly
        const { scoreThresholds } = recalculateScoresAndTiers(state.mapData.tiles, config);

        // 2. Update global min/max scores in state for heatmap
        let min = Infinity;
        let max = -Infinity;
        state.mapData.tiles.forEach(tile => {
            // Only consider workable tiles for min/max range
            if (tile.is_workable && typeof tile.normalized_score === 'number') {
                min = Math.min(min, tile.normalized_score);
                max = Math.max(max, tile.normalized_score);
            }
        });
        // Handle case where no workable tiles exist or scores are invalid
        state.setMinMaxScores(
            min === Infinity ? 0 : min,
            max === -Infinity ? 100 : max
        );
        log(`Recalculation complete. New Min/Max Scores: ${state.minScore}/${state.maxScore}`);

        // 3. Update state with new thresholds if needed (optional, depends on legend usage)
        // state.setTierThresholds(scoreThresholds); // Uncomment if legend needs dynamic thresholds

        // 4. Update the visuals
        updateMapDisplay();

        // 5. Update heatmap legend (since min/max might have changed)
        updateHeatmapLegend(config.showScoreHeatmap); // Pass current heatmap visibility state

    } else {
        // This warning should now only appear if mapData hasn't loaded yet
        log("Warning: Cannot recalculate, map data not available in state.");
    }
}


// Debounce the recalculation function for sliders
const debouncedRecalculate = debounce(() => handleRecalculation("weight slider change"), 300); // 300ms delay

/**
 * Initializes all UI control event listeners.
 */
export function initUIControls() {
    log("Initializing UI controls...");

    // --- Existing Toggle Buttons ---
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
        updateMapDisplay();
    });
    setupCheckboxListener('toggle-heatmap', (checked) => {
        updateConfig('showScoreHeatmap', checked);
        updateHeatmapLegend(checked);
        // Trigger display update to apply/remove heatmap colors
        updateMapDisplay();
    });

    // --- Existing Action Buttons ---
    setupButtonListener('highlight-top-tiles', (button) => {
        updateConfig('highlightTopTiles', !config.highlightTopTiles);
        button.textContent = config.highlightTopTiles ? 'Reset Highlighting' : 'Highlight Top Tiles';
        button.classList.toggle('inactive', config.highlightTopTiles);
        updateMapDisplay();
    });

    // --- Existing Tier Filtering ---
    const tierCheckboxes = document.querySelectorAll('.tier-checkbox');
    tierCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleTierFilterChange);
    });
    setupButtonListener('toggle-all-tiers', (button) => {
        const newState = !state.allTiersSelected;
        state.setAllTiersSelected(newState);
        button.textContent = newState ? 'Deselect All Tiers' : 'Select All Tiers';
        button.classList.toggle('inactive', !newState);
        tierCheckboxes.forEach(cb => cb.checked = newState);
        handleTierFilterChange();
    });
    initializeToggleButtonState();

    // --- Existing Legend Toggle ---
    setupLegendToggle();

    // --- Scoring Weight Controls ---
    setupWeightControls();

    log("UI controls initialization complete.");
}

/**
 * Helper to set up checkbox event listeners.
 */
function setupCheckboxListener(id, callback) {
    const element = document.getElementById(id);
    if (element) {
        // Initialize based on current state before adding listener
        callback(element.checked);
        element.addEventListener('change', (event) => {
            callback(event.target.checked);
        });
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
    initializeToggleButtonState(); // Update the toggle all button state
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

    state.setAllTiersSelected(allSelected); // Update shared state if needed

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
    const legendContainer = document.querySelector('.legend'); // Get the main legend container

    if (legendToggle && legendContent && legendContainer) {
        // Initial state based on CSS or default behavior (assume expanded)
        let isHidden = legendContent.style.display === 'none';
        legendToggle.textContent = isHidden ? 'Show' : 'Hide';
        legendContainer.classList.toggle('collapsed', isHidden); // Add class to container

        legendToggle.addEventListener('click', function() {
            isHidden = !isHidden; // Toggle state
            legendContent.style.display = isHidden ? 'none' : 'block';
            legendToggle.textContent = isHidden ? 'Show' : 'Hide';
            legendContainer.classList.toggle('collapsed', isHidden); // Toggle class on container
        });
    } else {
        log("Warning: Legend toggle elements not found.");
    }
}


/**
 * Shows or hides the heatmap legend section and updates its content.
 * Now reads min/max directly from state.
 */
function updateHeatmapLegend(show) {
    const section = document.getElementById('heatmap-legend-section');
    const gradientBar = section?.querySelector('.heatmap-gradient');
    const minLabel = section?.querySelector('#heatmap-min-label');
    const maxLabel = section?.querySelector('#heatmap-max-label');

    if (section && gradientBar && minLabel && maxLabel) {
        if (show && heatmapColors && heatmapColors.length > 0) {
            const gradientColors = heatmapColors.map(color => color.getStyle()).join(', ');
            gradientBar.style.background = `linear-gradient(to right, ${gradientColors})`;

            // Update min/max labels directly from state
            minLabel.textContent = state.minScore?.toFixed(0) ?? 'N/A';
            maxLabel.textContent = state.maxScore?.toFixed(0) ?? 'N/A';
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    } else {
        // This might happen initially before state is populated, so make it less alarming
        // log("Warning: Heatmap legend elements not found or color stops missing.");
    }
}


// --- Functions for Scoring Weight Controls ---

/**
 * Sets up event listeners for the scoring weight controls (presets, sliders, collapse toggle).
 */
function setupWeightControls() {
    log("Setting up weight controls...");
    const weightsHeader = document.getElementById('weights-header');
    const weightsContent = document.getElementById('weights-content');
    const presetButtonContainer = document.getElementById('preset-buttons');
    const resetButton = document.getElementById('reset-weights');
    const sliders = document.querySelectorAll('.weight-slider');

    // 1. Collapsible Section Toggle
    if (weightsHeader && weightsContent) {
        weightsHeader.addEventListener('click', () => {
            weightsContent.classList.toggle('hidden');
            weightsHeader.classList.toggle('collapsed');
        });
        weightsContent.classList.remove('hidden');
        weightsHeader.classList.remove('collapsed');
    } else {
        log("Warning: Weights header or content element not found.");
    }

    // 2. Preset Buttons
    if (presetButtonContainer) {
        presetButtonContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('preset-button') && event.target.dataset.preset) {
                const presetName = event.target.dataset.preset;
                log(`Applying preset: ${presetName}`);
                applyWeightPreset(presetName); // This now calls handleRecalculation
                presetButtonContainer.querySelectorAll('.preset-button').forEach(btn => {
                    btn.classList.toggle('active', btn === event.target);
                });
            }
        });
    } else {
         log("Warning: Preset button container not found.");
    }

    // 3. Reset Button
     if (resetButton) {
        resetButton.addEventListener('click', () => {
            log("Resetting weights to default.");
            const defaultPresetName = 'balanced';
            applyWeightPreset(defaultPresetName);
            presetButtonContainer?.querySelectorAll('.preset-button.active').forEach(btn => btn.classList.remove('active'));
            const balancedBtn = presetButtonContainer?.querySelector(`[data-preset="${defaultPresetName}"]`);
            if (balancedBtn) balancedBtn.classList.add('active');

        });
    } else {
        log("Warning: Reset weights button not found.");
    }


    // 4. Sliders
    if (sliders.length > 0) {
        initializeSliderValues(); // Set initial values from config

        sliders.forEach(slider => {
            const valueDisplay = document.getElementById(`${slider.id}-value`);
            const weightKey = slider.dataset.weightKey;

            if (!valueDisplay || !weightKey) {
                log(`Warning: Missing value display or data-weight-key for slider ${slider.id}`);
                return;
            }

            slider.addEventListener('input', () => {
                const newValue = parseFloat(slider.value);
                valueDisplay.textContent = newValue.toFixed(slider.step.includes('.') ? slider.step.split('.')[1].length : 0);

                // Update the specific weight in the config
                updateConfig(`scoring_weights.${weightKey}`, newValue);

                // Trigger the debounced recalculation
                debouncedRecalculate(); // Calls handleRecalculation after delay
            });
        });
    } else {
        log("Warning: No weight sliders found.");
    }
}

/**
 * Applies a scoring weight preset to the configuration and updates sliders.
 * @param {string} presetName - The name of the preset (key in scoringPresets).
 */
function applyWeightPreset(presetName) {
    // Use getDefaultWeights for 'balanced' to ensure it aligns with config.js
    const preset = presetName === 'balanced' ? getDefaultWeights() : scoringPresets[presetName];

    if (!preset) {
        log(`Error: Preset "${presetName}" not found.`);
        return;
    }

    // Update the entire scoring_weights object in the config
    updateConfig('scoring_weights', JSON.parse(JSON.stringify(preset))); // Deep copy

    log(`Applied preset "${presetName}". New weights:`, JSON.stringify(config.scoring_weights));

    // Update slider positions and readouts to match the new preset
    initializeSliderValues();

    // Trigger recalculation immediately after applying preset
    handleRecalculation(`preset apply (${presetName})`); // Use the common handler
}

/**
 * Sets the initial values of the weight sliders and their readouts based on the current config.
 */
function initializeSliderValues() {
    const sliders = document.querySelectorAll('.weight-slider');
    sliders.forEach(slider => {
        const weightKey = slider.dataset.weightKey;
        const valueDisplay = document.getElementById(`${slider.id}-value`);

        if (!weightKey || !valueDisplay) return;

        const getNestedValue = (obj, path) => {
            try {
                // Make sure obj is not null/undefined before starting reduce
                return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
            } catch (e) {
                return undefined;
            }
        };

        const currentValue = getNestedValue(config.scoring_weights, weightKey);

        if (currentValue !== undefined) {
            const numValue = parseFloat(currentValue);
            slider.value = numValue;
            const decimalPlaces = slider.step.includes('.') ? slider.step.split('.')[1].length : 0;
            valueDisplay.textContent = numValue.toFixed(decimalPlaces);
        } else {
            log(`Warning: Weight key "${weightKey}" not found in config for slider ${slider.id}. Using slider default.`);
             const numValue = parseFloat(slider.value);
             const decimalPlaces = slider.step.includes('.') ? slider.step.split('.')[1].length : 0;
            valueDisplay.textContent = numValue.toFixed(decimalPlaces);
        }
    });
     log("Slider values initialized from config.");
}
