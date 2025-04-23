/**
 * animation.js
 * Contains the main animation loop for the visualization.
 */
import * as THREE from 'three';
import * as state from './state.js';
import { updateCameraPan, updateHoverAnimation } from './interaction.js';
import { config } from './config.js'; // Import config if needed for animation logic

let animationFrameId = null; // To store the requestAnimationFrame ID

/**
 * Starts the main animation loop.
 */
export function startAnimationLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // Cancel previous loop if any
    }
    animate();
}

/**
 * Stops the main animation loop.
 */
export function stopAnimationLoop() {
     if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}


/**
 * The main animation loop function.
 */
function animate() {
    // Schedule the next frame
    animationFrameId = requestAnimationFrame(animate);

    // Get time delta for frame-rate independent animation
    const deltaTime = state.clock.getDelta();

    // --- Update Components ---
    // Update camera panning based on keyboard input
    updateCameraPan();

    // Update hover animations for hexagons
    updateHoverAnimation();

    // *** Removed histogram bar animations ***


    // Update OrbitControls damping
    if (state.controls) {
        state.controls.update();
    }

    // --- Render Scene ---
    if (state.renderer && state.scene && state.camera) {
        state.renderer.render(state.scene, state.camera);
    }
}

// *** Removed updateHistogramAnimation function ***
