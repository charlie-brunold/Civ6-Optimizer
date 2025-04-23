/**
 * sceneSetup.js
 * Initializes the Three.js scene, camera, renderer, lights, and controls.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Adjust path if needed
import * as state from './state.js'; // Import state setters
import { log } from './utils.js';

/**
 * Initializes the core Three.js components.
 * @param {HTMLElement} container - The DOM element to contain the renderer.
 * @returns {object} An object containing the initialized scene, camera, renderer, and controls.
 */
export function initScene(container) {
    log("Initializing Three.js scene...");

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd0e6f9); // Light blue background
    state.setScene(scene); // Store in shared state

    // --- Camera ---
    const aspectRatio = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
    camera.position.set(0, 20, 30); // Default position, will be adjusted later
    camera.lookAt(0, 0, 0);
    state.setCamera(camera); // Store in shared state

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        // shadowMap: true // Enable shadow mapping - enable if needed, can impact performance
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // renderer.shadowMap.enabled = true; // Enable shadows if needed
    container.appendChild(renderer.domElement);
    state.setRenderer(renderer); // Store in shared state
    log("Renderer added to DOM");

    // --- Controls ---
    let controls = null;
    try {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true; // Use false for traditional orbit
        controls.maxPolarAngle = Math.PI / 2.1; // Limit vertical rotation slightly above horizon
        controls.minDistance = 5; // Adjust min zoom distance
        controls.maxDistance = 150; // Adjust max zoom distance
        state.setControls(controls); // Store in shared state
        log("OrbitControls initialized");
    } catch (e) {
        log("Error initializing OrbitControls:", e);
        console.error("OrbitControls failed to initialize. Ensure the script is loaded correctly.", e);
    }

    // --- Lighting ---
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Slightly increased intensity
    scene.add(ambientLight);

    // Directional light for shadows and highlights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9); // Slightly increased intensity
    directionalLight.position.set(10, 15, 10); // Adjust position for desired shadow angle
    // directionalLight.castShadow = true; // Enable shadows if needed
    // directionalLight.shadow.mapSize.width = 2048; // Higher resolution shadows
    // directionalLight.shadow.mapSize.height = 2048;
    // directionalLight.shadow.camera.near = 0.5;
    // directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    // Optional: Hemisphere light for softer ambient lighting
    // const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.6);
    // scene.add(hemiLight);

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize);

    log("Scene initialization complete.");
    return { scene, camera, renderer, controls };
}

/**
 * Handles window resize events to update camera and renderer.
 */
function onWindowResize() {
    if (state.camera && state.renderer) {
        const container = state.renderer.domElement.parentElement;
        if (container) {
            state.camera.aspect = container.clientWidth / container.clientHeight;
            state.camera.updateProjectionMatrix();
            state.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
}
