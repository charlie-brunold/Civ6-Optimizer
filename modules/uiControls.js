/**
 * uiControls.js
 * Sets up event listeners for UI controls (buttons, checkboxes, sliders),
 * including scoring weight adjustments, hover radius, and debug mode toggle.
 */
import * as THREE from 'three';
// Import config and state management
import { config, updateConfig, tierStyles, heatmapColors, getDefaultWeights } from './config.js';
import * as state from './state.js'; // Import state module
// Import map update function
import { updateMapDisplay } from './mapElements.js';
// Import the recalculation function
import { recalculateScoresAndTiers } from './scoring.js';
// Import utilities
import { log, debounce } from './utils.js';
// Import interaction functions needed if debug mode affects interactions directly from UI
// import { exitDebugMode } from './interaction.js'; // Example if needed

// --- Preset Weight Configurations ---
const scoringPresets = {
    balanced: { /* ... */ },
    production: { /* ... */ },
    food_growth: { /* ... */ },
    gold: { /* ... */ },
    science: { /* ... */ }
};
scoringPresets.balanced = getDefaultWeights();


/**
 * Helper function to recalculate scores, update state, and refresh display.
 */
function handleRecalculation(triggerSource) {
    // (Function remains the same)
    if (state.mapData && state.mapData.tiles) {
        log(`Triggering recalculation due to ${triggerSource}...`);
        const { scoreThresholds } = recalculateScoresAndTiers(state.mapData.tiles, config);
        let min = Infinity;
        let max = -Infinity;
        state.mapData.tiles.forEach(tile => {
            if (tile.is_workable && typeof tile.normalized_score === 'number') {
                min = Math.min(min, tile.normalized_score);
                max = Math.max(max, tile.normalized_score);
            }
        });
        state.setMinMaxScores(min === Infinity ? 0 : min, max === -Infinity ? 100 : max);
        log(`Recalculation complete. New Min/Max Scores: ${state.minScore}/${state.maxScore}`);
        updateMapDisplay();
        updateHeatmapLegend(config.showScoreHeatmap);
    } else {
        log("Warning: Cannot recalculate, map data not available in state.");
    }
}

const debouncedRecalculate = debounce(() => handleRecalculation("weight slider change"), 300);

/**
 * Initializes all UI control event listeners.
 */
export function initUIControls() {
    log("Initializing UI controls...");

    // --- Standard Toggle Buttons ---
    setupCheckboxListener('toggle-tier-labels', (checked) => {
        updateConfig('showTierLabels', checked);
        updateMapDisplay();
    }, 'showTierLabels');

    setupCheckboxListener('toggle-resources', (checked) => {
        updateConfig('showResources', checked);
        updateMapDisplay();
    }, 'showResources');

    // **** ADDED: Listener for District Icons Toggle ****
    setupCheckboxListener('toggle-district-icons', (checked) => {
        updateConfig('showRecommendedDistrictIcons', checked);
        updateMapDisplay(); // This will trigger showing/hiding the icons
    }, 'showRecommendedDistrictIcons'); // Initialize from config
    // ************************************************

    setupCheckboxListener('toggle-elevation', (checked) => {
        updateConfig('elevationFactor', checked ? 0.4 : 0);
        log(`Elevation toggled. New factor: ${config.elevationFactor}.`);
        updateMapDisplay();
    }, 'elevationFactor', (value) => value > 0);

    setupCheckboxListener('toggle-heatmap', (checked) => {
        updateConfig('showScoreHeatmap', checked);
        updateHeatmapLegend(checked);
        updateMapDisplay();
    }, 'showScoreHeatmap');

    setupCheckboxListener('toggle-debug-mode', (checked) => {
        updateConfig('isDebugModeEnabled', checked);
        log(`Debug Mode ${checked ? 'Enabled' : 'Disabled'}.`);
        if (!checked && state.isDebugModeActive) {
             if (typeof state.exitDebugMode === 'function') {
                 state.exitDebugMode();
             } else {
                 console.warn("Cannot automatically exit debug mode - exit function not found.");
             }
        }
    }, 'isDebugModeEnabled');

    // --- Action Buttons ---
    setupButtonListener('highlight-top-tiles', (button) => {
        updateConfig('highlightTopTiles', !config.highlightTopTiles);
        button.textContent = config.highlightTopTiles ? 'Reset Highlighting' : 'Highlight Top Tiles';
        button.classList.toggle('inactive', config.highlightTopTiles); // Assuming 'inactive' means highlighting is ON
        updateMapDisplay();
    });


    // --- Tier Filtering ---
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

    // --- Legend Toggle ---
    setupLegendToggle();

    // --- Scoring Weight Controls ---
    setupWeightControls();

    // --- Hover Radius Control ---
    setupNumberInputListener('hover-radius-input', (value) => {
        updateConfig('hoverRadius', value);
        log(`Hover radius updated to: ${value}`);
    }, 'hoverRadius');

    log("UI controls initialization complete.");
}

/**
 * Helper to set up checkbox event listeners, including initialization from config.
 * @param {string} id - The ID of the checkbox element.
 * @param {function} callback - Function to call on change (receives checked state).
 * @param {string} [configKey] - The corresponding key in the config object for initialization.
 * @param {function} [initCheckFn] - Optional function to determine checked state from config value.
 */
function setupCheckboxListener(id, callback, configKey = null, initCheckFn = null) {
    const element = document.getElementById(id);
    if (element) {
        if (configKey && config[configKey] !== undefined) {
            if (initCheckFn) {
                element.checked = initCheckFn(config[configKey]);
            } else {
                element.checked = Boolean(config[configKey]);
            }
        }
        element.addEventListener('change', (event) => {
            callback(event.target.checked);
        });
    } else {
        log(`Warning: Checkbox element with ID "${id}" not found.`);
    }
}

/**
 * Helper to set up number input event listeners, including initialization from config.
 * @param {string} id - The ID of the number input element.
 * @param {function} callback - Function to call on input (receives validated number value).
 * @param {string} [configKey] - The corresponding key in the config object for initialization.
 */
function setupNumberInputListener(id, callback, configKey = null) {
    const element = document.getElementById(id);
    if (element) {
        if (configKey && config[configKey] !== undefined) {
            element.value = config[configKey];
        } else {
             log(`Warning: Config key "${configKey}" not found for input ${id}. Using default value.`);
        }
        element.addEventListener('input', (event) => {
            const rawValue = event.target.value;
            const intValue = parseInt(rawValue, 10);
            const min = parseInt(element.min, 10);
            const max = parseInt(element.max, 10);

            if (!isNaN(intValue)) {
                const clampedValue = Math.max(isNaN(min) ? -Infinity : min, Math.min(isNaN(max) ? Infinity : max, intValue));
                 if (clampedValue !== intValue) {
                    event.target.value = clampedValue;
                 }
                callback(clampedValue);
            } else {
                 log(`Warning: Invalid input "${rawValue}" for ${id}. Ignoring.`);
            }
        });
    } else {
        log(`Warning: Number input element with ID "${id}" not found.`);
    }
}


/** Helper to set up button event listeners. */
function setupButtonListener(id, callback) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', () => { callback(element); });
    } else {
        log(`Warning: Button element with ID "${id}" not found.`);
    }
}

/** Handles changes to the tier filter checkboxes. */
function handleTierFilterChange() {
    const checkedTiers = Array.from(document.querySelectorAll('.tier-checkbox:checked')).map(cb => cb.value);
    updateConfig('selectedTiers', checkedTiers);
    initializeToggleButtonState();
    updateMapDisplay();
}

/** Updates the state and appearance of the "Select/Deselect All" tiers button. */
function initializeToggleButtonState() {
    const tierCheckboxes = document.querySelectorAll('.tier-checkbox');
    const toggleAllBtn = document.getElementById('toggle-all-tiers');
    if (!toggleAllBtn || tierCheckboxes.length === 0) return;
    const checkedCount = Array.from(tierCheckboxes).filter(cb => cb.checked).length;
    const allSelected = checkedCount === tierCheckboxes.length;
    const noneSelected = checkedCount === 0;
    state.setAllTiersSelected(allSelected);
    toggleAllBtn.textContent = allSelected ? 'Deselect All Tiers' : 'Select All Tiers';
    toggleAllBtn.classList.toggle('inactive', noneSelected); // 'inactive' if none are selected
}

/** Sets up the legend toggle functionality. */
function setupLegendToggle() {
    const legendToggle = document.getElementById('legend-toggle');
    const legendContent = document.querySelector('.legend-content');
    const legendContainer = document.querySelector('.legend');
    if (legendToggle && legendContent && legendContainer) {
        let isHidden = legendContent.style.display === 'none'; // Check initial state
        legendToggle.textContent = isHidden ? 'Show' : 'Hide';
        legendContainer.classList.toggle('collapsed', isHidden);

        legendToggle.addEventListener('click', function() {
            isHidden = !isHidden;
            legendContent.style.display = isHidden ? 'none' : 'block';
            legendToggle.textContent = isHidden ? 'Show' : 'Hide';
            legendContainer.classList.toggle('collapsed', isHidden);
        });
    } else { log("Warning: Legend toggle elements not found."); }
}

/** Shows or hides the heatmap legend section and updates its content. */
function updateHeatmapLegend(show) {
    const section = document.getElementById('heatmap-legend-section');
    const gradientBar = section?.querySelector('.heatmap-gradient');
    const minLabel = section?.querySelector('#heatmap-min-label');
    const maxLabel = section?.querySelector('#heatmap-max-label');
    if (section && gradientBar && minLabel && maxLabel) {
        if (show && heatmapColors && heatmapColors.length > 0) {
            const gradientColors = heatmapColors.map(color => color.getStyle()).join(', ');
            gradientBar.style.background = `linear-gradient(to right, ${gradientColors})`;
            minLabel.textContent = state.minScore?.toFixed(0) ?? 'N/A';
            maxLabel.textContent = state.maxScore?.toFixed(0) ?? 'N/A';
            section.style.display = 'block';
        } else { section.style.display = 'none'; }
    }
}

// --- Functions for Scoring Weight Controls ---

/** Sets up event listeners for the scoring weight controls. */
function setupWeightControls() {
    log("Setting up weight controls...");
    const weightsHeader = document.getElementById('weights-header');
    const weightsContent = document.getElementById('weights-content');
    const presetButtonContainer = document.getElementById('preset-buttons');
    const resetButton = document.getElementById('reset-weights');
    const sliders = document.querySelectorAll('.weight-slider');

    if (weightsHeader && weightsContent) {
        weightsHeader.addEventListener('click', () => {
            weightsContent.classList.toggle('hidden');
            weightsHeader.classList.toggle('collapsed');
        });
        // Start with weights expanded by default
        weightsContent.classList.remove('hidden');
        weightsHeader.classList.remove('collapsed');
    }

    if (presetButtonContainer) {
         presetButtonContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('preset-button') && event.target.dataset.preset) {
                const presetName = event.target.dataset.preset;
                log(`Applying preset: ${presetName}`);
                applyWeightPreset(presetName);
                // Update active state for preset buttons
                presetButtonContainer.querySelectorAll('.preset-button').forEach(btn => {
                    btn.classList.toggle('active', btn === event.target);
                });
            }
        });
    }

     if (resetButton) {
         resetButton.addEventListener('click', () => {
             log("Resetting weights to default.");
             const defaultPresetName = 'balanced'; // Or your actual default preset key
             applyWeightPreset(defaultPresetName);
             // Clear active state from other preset buttons and set default as active
             presetButtonContainer?.querySelectorAll('.preset-button.active').forEach(btn => btn.classList.remove('active'));
             const balancedBtn = presetButtonContainer?.querySelector(`[data-preset="${defaultPresetName}"]`);
             if (balancedBtn) balancedBtn.classList.add('active');
         });
     }

    if (sliders.length > 0) {
        initializeSliderValues(); // Set initial slider positions from config
        sliders.forEach(slider => {
            const valueDisplay = document.getElementById(`${slider.id}-value`);
            const weightKey = slider.dataset.weightKey;
            if (!valueDisplay || !weightKey) {
                log(`Warning: Missing value display or weight key for slider ${slider.id}`);
                return;
            }
            slider.addEventListener('input', () => {
                const newValue = parseFloat(slider.value);
                // Format the displayed value based on the slider's step attribute
                const decimalPlaces = slider.step.includes('.') ? slider.step.split('.')[1].length : 0;
                valueDisplay.textContent = newValue.toFixed(decimalPlaces);
                updateConfig(`scoring_weights.${weightKey}`, newValue);
                debouncedRecalculate(); // Use debounced recalculation
            });
        });
    }
}

/** Applies a scoring weight preset. */
function applyWeightPreset(presetName) {
    const preset = presetName === 'balanced' ? getDefaultWeights() : scoringPresets[presetName];
    if (!preset) {
        log(`Error: Preset "${presetName}" not found.`);
        return;
    }
    // Deep copy the preset to avoid modifying the original preset object
    updateConfig('scoring_weights', JSON.parse(JSON.stringify(preset)));
    log(`Applied preset "${presetName}". New weights:`, JSON.stringify(config.scoring_weights));
    initializeSliderValues(); // Update sliders to reflect new preset
    handleRecalculation(`preset apply (${presetName})`); // Recalculate scores immediately
}

/** Sets the initial values of the weight sliders based on the current config. */
function initializeSliderValues() {
    const sliders = document.querySelectorAll('.weight-slider');
    sliders.forEach(slider => {
        const weightKey = slider.dataset.weightKey;
        const valueDisplay = document.getElementById(`${slider.id}-value`);
        if (!weightKey || !valueDisplay) return;

        // Helper to get nested value from config.scoring_weights
        const getNestedValue = (obj, path) => path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
        const currentValue = getNestedValue(config.scoring_weights, weightKey);

        if (currentValue !== undefined) {
            const numValue = parseFloat(currentValue);
            slider.value = numValue;
            const decimalPlaces = slider.step.includes('.') ? slider.step.split('.')[1].length : 0;
            valueDisplay.textContent = numValue.toFixed(decimalPlaces);
        } else {
            log(`Warning: Weight key "${weightKey}" not found in config for slider ${slider.id}. Using slider default.`);
            // If not found in config, display the slider's current default value
            const numValue = parseFloat(slider.value);
            const decimalPlaces = slider.step.includes('.') ? slider.step.split('.')[1].length : 0;
            valueDisplay.textContent = numValue.toFixed(decimalPlaces);
        }
    });
     log("Slider values initialized from config.");
}
