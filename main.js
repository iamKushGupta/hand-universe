// ============================================================
// Hand Universe — Interactive 3D Particle Experience
// Three.js + MediaPipe Hands
// ============================================================

// ---- Wait for dependencies ----
function waitForGlobal(name, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (window[name]) return resolve(window[name]);
            if (Date.now() - start > timeout) return reject(new Error(`${name} not loaded`));
            requestAnimationFrame(check);
        };
        check();
    });
}

// ============================================================
// CONSTANTS
// ============================================================
const PARTICLE_COUNT = 5000;
const IDLE_RADIUS = 5;
const FOLLOW_RADIUS = 2.5;
const EXPLODE_SPEED = 0.15;
const IMPLODE_SPEED = 0.08;
const LERP_SPEED = 0.04;
const TEXT_LERP_SPEED = 0.03;

// Gesture states
const STATE = {
    IDLE: 'IDLE',
    FOLLOW: 'FOLLOW',
    EXPLODE: 'EXPLODE',
    IMPLODE: 'IMPLODE',
    TEXT_FORM: 'TEXT_FORM'
};

// Colors for each state (HSL-based)
const STATE_COLORS = {
    IDLE: { h: 230, s: 0.6, l: 0.65 },
    FOLLOW: { h: 250, s: 0.7, l: 0.7 },
    EXPLODE: { h: 35, s: 0.9, l: 0.65 },
    IMPLODE: { h: 250, s: 0.6, l: 0.65 },
    TEXT_FORM: { h: 340, s: 0.95, l: 0.8 }
};

// ============================================================
// GLOBAL STATE
// ============================================================
let currentState = STATE.IDLE;
let previousState = STATE.IDLE;
let handPosition = { x: 0, y: 0, z: 0 };
let handDetected = false;
let currentGesture = 'none';
let gestureHoldTime = 0;
const GESTURE_THRESHOLD = 300; // ms to hold gesture before triggering
let lastGestureTime = 0;
let lastDetectedGesture = 'none';

// Three.js
let scene, camera, renderer;
let particleSystem, particleGeometry;
let particlePositions, particleVelocities, particleTargets, particleOriginals;
let particleColors, particleAlphas, particleSizes;
let colorAttr, alphaAttr, sizeAttr;

// Animation
let clock;
let stateTransition = 0; // 0..1 for smooth transitions
let currentHue = STATE_COLORS.IDLE.h;

// Text targets
let textTargetPositions = null;

// UI elements
let gestureIconEl, gestureLabelEl, stateTextEl, stateDotEl;
let instructionsEl, startBtn, webcamPreview, stateIndicator, gestureHud;

// ============================================================
// INITIALIZATION
// ============================================================
async function init() {
    // Cache UI elements
    gestureIconEl = document.getElementById('gesture-icon');
    gestureLabelEl = document.getElementById('gesture-label');
    stateTextEl = document.getElementById('state-text');
    stateDotEl = document.getElementById('state-dot');
    instructionsEl = document.getElementById('instructions');
    startBtn = document.getElementById('start-btn');
    webcamPreview = document.getElementById('webcam-preview');
    stateIndicator = document.getElementById('state-indicator');
    gestureHud = document.getElementById('gesture-hud');

    // Setup Three.js
    initThree();
    generateTextTargets();

    // Start render loop
    clock = new THREE.Clock();
    animate();

    // Start button handler
    startBtn.addEventListener('click', startExperience);
}

// ============================================================
// THREE.JS SETUP
// ============================================================
function initThree() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060f, 0.035);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 12);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x05060f);
    container.appendChild(renderer.domElement);

    // Particles
    createParticles();

    // Background stars (static, far away)
    createBackgroundStars();

    // Handle resize
    window.addEventListener('resize', onResize);
}

function createParticles() {
    particleGeometry = new THREE.BufferGeometry();

    particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
    particleTargets = new Float32Array(PARTICLE_COUNT * 3);
    particleOriginals = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const alphas = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Distribute in a sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = IDLE_RADIUS * Math.cbrt(Math.random());

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        particlePositions[i * 3] = x;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = z;

        particleOriginals[i * 3] = x;
        particleOriginals[i * 3 + 1] = y;
        particleOriginals[i * 3 + 2] = z;

        particleTargets[i * 3] = x;
        particleTargets[i * 3 + 1] = y;
        particleTargets[i * 3 + 2] = z;

        particleVelocities[i * 3] = 0;
        particleVelocities[i * 3 + 1] = 0;
        particleVelocities[i * 3 + 2] = 0;

        // Initial color — soft blue
        const hsl = STATE_COLORS.IDLE;
        const rgb = hslToRgb(hsl.h / 360, hsl.s, hsl.l);
        colors[i * 3] = rgb.r;
        colors[i * 3 + 1] = rgb.g;
        colors[i * 3 + 2] = rgb.b;

        alphas[i] = 0.4 + Math.random() * 0.6;
        sizes[i] = 2 + Math.random() * 4;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    colorAttr = particleGeometry.getAttribute('color');
    alphaAttr = particleGeometry.getAttribute('alpha');
    sizeAttr = particleGeometry.getAttribute('size');

    // Custom shader material for glow
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
        },
        vertexShader: `
      attribute float alpha;
      attribute float size;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uPixelRatio;
      
      void main() {
        vColor = color;
        vAlpha = alpha;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = length(mvPosition.xyz);
        gl_PointSize = size * uPixelRatio * (8.0 / dist);
        gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        // Circular particle with soft glow
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        glow = pow(glow, 1.5);
        
        gl_FragColor = vec4(vColor, vAlpha * glow);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });

    particleSystem = new THREE.Points(particleGeometry, material);
    scene.add(particleSystem);
}

function createBackgroundStars() {
    const geo = new THREE.BufferGeometry();
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 80;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 20;
        sizes[i] = Math.random() * 1.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
      attribute float size;
      varying float vSize;
      uniform float uTime;
      void main() {
        vSize = size;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (5.0 / length(mv.xyz));
        gl_Position = projectionMatrix * mv;
      }
    `,
        fragmentShader: `
      varying float vSize;
      uniform float uTime;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = (1.0 - d * 2.0) * 0.3;
        gl_FragColor = vec4(0.6, 0.65, 0.85, alpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
}

// ============================================================
// 3D TEXT TARGET GENERATION
// ============================================================
function generateTextTargets() {
    // Use a high-res 2D canvas to render the message and sample points densely
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';

    // Line 1: "I LOVE YOU, ANANYA" — big and bold
    ctx.font = 'bold 80px Inter, Arial, sans-serif';
    ctx.fillText('I LOVE YOU, ANANYA', canvas.width / 2, 100);

    // Line 2: "from Kush ;)" — small, centered below
    ctx.font = 'bold 80px Inter, Arial, sans-serif';
    ctx.fillText('from Kush ;)', canvas.width / 2, 200);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Collect white pixel positions — sample EVERY pixel for maximum density
    const whitePixels = [];
    for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
            const idx = (y * canvas.width + x) * 4;
            if (pixels[idx] > 100) {
                whitePixels.push({ x, y });
            }
        }
    }

    // Shuffle for better distribution when wrapping
    for (let i = whitePixels.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [whitePixels[i], whitePixels[j]] = [whitePixels[j], whitePixels[i]];
    }

    // Map to 3D positions and assign to particles
    textTargetPositions = new Float32Array(PARTICLE_COUNT * 3);
    const scaleX = 18 / canvas.width;
    const scaleY = 5 / canvas.height;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (whitePixels.length > 0) {
            const pixel = whitePixels[i % whitePixels.length];
            // Tight randomness for crisp text with subtle 3D depth
            textTargetPositions[i * 3] = (pixel.x - canvas.width / 2) * scaleX + (Math.random() - 0.5) * 0.06;
            textTargetPositions[i * 3 + 1] = -(pixel.y - canvas.height / 2) * scaleY + (Math.random() - 0.5) * 0.06;
            textTargetPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        } else {
            textTargetPositions[i * 3] = (Math.random() - 0.5) * 10;
            textTargetPositions[i * 3 + 1] = (Math.random() - 0.5) * 4;
            textTargetPositions[i * 3 + 2] = (Math.random() - 0.5) * 1;
        }
    }
}

// ============================================================
// MEDIAPIPE HANDS — CAMERA START
// ============================================================
async function startExperience() {
    startBtn.textContent = 'Loading hand tracking...';
    startBtn.classList.add('loading');

    try {
        await waitForGlobal('Hands');
        await waitForGlobal('Camera');

        const videoEl = document.getElementById('webcam');
        const webcamCanvas = document.getElementById('webcam-canvas');
        const webcamCtx = webcamCanvas.getContext('2d');

        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
            // Draw webcam preview
            webcamCanvas.width = webcamCanvas.clientWidth * 2;
            webcamCanvas.height = webcamCanvas.clientHeight * 2;
            webcamCtx.save();
            webcamCtx.scale(-1, 1);
            webcamCtx.drawImage(results.image, -webcamCanvas.width, 0, webcamCanvas.width, webcamCanvas.height);
            webcamCtx.restore();

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                handDetected = true;

                // Map hand center (wrist = landmark 0) to 3D space
                const wrist = landmarks[0];
                const middleMCP = landmarks[9];
                const cx = (wrist.x + middleMCP.x) / 2;
                const cy = (wrist.y + middleMCP.y) / 2;

                // Map normalized coords to 3D space (flipped X for mirror)
                handPosition.x = -(cx - 0.5) * 16;
                handPosition.y = -(cy - 0.5) * 10;
                handPosition.z = 0;

                // Detect gesture
                const gesture = detectGesture(landmarks);
                processGesture(gesture);

                // Draw hand landmarks on preview
                drawHandLandmarks(webcamCtx, landmarks, webcamCanvas.width, webcamCanvas.height);
            } else {
                handDetected = false;
                updateGestureUI('none');
            }
        });

        const cam = new Camera(videoEl, {
            onFrame: async () => {
                await hands.send({ image: videoEl });
            },
            width: 640,
            height: 480
        });

        await cam.start();

        // Show UI
        instructionsEl.classList.add('hidden');
        webcamPreview.classList.add('visible');
        stateIndicator.classList.add('visible');
        gestureHud.classList.add('visible');

    } catch (err) {
        console.error('Failed to start:', err);
        startBtn.textContent = 'Error — check console';
        startBtn.classList.remove('loading');
    }
}

function drawHandLandmarks(ctx, landmarks, w, h) {
    ctx.save();
    ctx.scale(-1, 1);

    // Draw connections
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [17, 18], [18, 19], [19, 20],
        [0, 17]
    ];

    ctx.strokeStyle = 'rgba(108, 99, 255, 0.6)';
    ctx.lineWidth = 2;
    connections.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(-landmarks[a].x * w, landmarks[a].y * h);
        ctx.lineTo(-landmarks[b].x * w, landmarks[b].y * h);
        ctx.stroke();
    });

    // Draw points
    landmarks.forEach((lm, i) => {
        ctx.beginPath();
        ctx.arc(-lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#ff6b9d' : '#6c63ff';
        ctx.fill();
    });

    ctx.restore();
}

// ============================================================
// GESTURE DETECTION
// ============================================================
function detectGesture(landmarks) {
    // Landmark indices:
    // 0: wrist
    // 4: thumb tip, 3: thumb IP, 2: thumb MCP
    // 8: index tip, 7: index DIP, 6: index PIP, 5: index MCP
    // 12: middle tip, 11: middle DIP, 10: middle PIP, 9: middle MCP
    // 16: ring tip, 15: ring DIP, 14: ring PIP, 13: ring MCP
    // 20: pinky tip, 19: pinky DIP, 18: pinky PIP, 17: pinky MCP

    const thumbExtended = isThumbExtended(landmarks);
    const indexExtended = isFingerExtended(landmarks, 5, 6, 7, 8);
    const middleExtended = isFingerExtended(landmarks, 9, 10, 11, 12);
    const ringExtended = isFingerExtended(landmarks, 13, 14, 15, 16);
    const pinkyExtended = isFingerExtended(landmarks, 17, 18, 19, 20);

    // ILU: thumb + index + pinky extended, middle + ring curled
    if (thumbExtended && indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
        return 'ilu';
    }

    // Open palm: all fingers extended
    if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
        return 'palm';
    }

    // Fist: all fingers curled (or nearly so)
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'fist';
    }

    return 'other';
}

function isFingerExtended(landmarks, mcpIdx, pipIdx, dipIdx, tipIdx) {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];

    // Finger is extended if tip is farther from wrist than PIP
    // Using Y-axis (tip.y < pip.y means tip is above PIP in image coords)
    const tipDist = Math.sqrt(
        Math.pow(tip.x - landmarks[0].x, 2) + Math.pow(tip.y - landmarks[0].y, 2)
    );
    const pipDist = Math.sqrt(
        Math.pow(pip.x - landmarks[0].x, 2) + Math.pow(pip.y - landmarks[0].y, 2)
    );

    return tipDist > pipDist * 1.05;
}

function isThumbExtended(landmarks) {
    const tip = landmarks[4];
    const ip = landmarks[3];
    const mcp = landmarks[2];

    // Thumb extended if tip is farther from palm center than IP joint
    const palmCenter = {
        x: (landmarks[0].x + landmarks[9].x) / 2,
        y: (landmarks[0].y + landmarks[9].y) / 2
    };

    const tipDist = Math.sqrt(
        Math.pow(tip.x - palmCenter.x, 2) + Math.pow(tip.y - palmCenter.y, 2)
    );
    const ipDist = Math.sqrt(
        Math.pow(ip.x - palmCenter.x, 2) + Math.pow(ip.y - palmCenter.y, 2)
    );

    return tipDist > ipDist;
}

// ============================================================
// GESTURE PROCESSING & STATE MACHINE
// ============================================================
function processGesture(gesture) {
    const now = Date.now();

    if (gesture !== lastDetectedGesture) {
        lastDetectedGesture = gesture;
        lastGestureTime = now;
        gestureHoldTime = 0;
    } else {
        gestureHoldTime = now - lastGestureTime;
    }

    updateGestureUI(gesture);

    // Only trigger state change after holding gesture
    if (gestureHoldTime < GESTURE_THRESHOLD) return;

    switch (currentState) {
        case STATE.IDLE:
            if (gesture === 'fist') transition(STATE.FOLLOW);
            break;
        case STATE.FOLLOW:
            if (gesture === 'palm') transition(STATE.EXPLODE);
            else if (gesture === 'ilu') transition(STATE.TEXT_FORM);
            break;
        case STATE.EXPLODE:
            if (gesture === 'fist') transition(STATE.IMPLODE);
            break;
        case STATE.IMPLODE:
            if (gesture === 'ilu') transition(STATE.TEXT_FORM);
            else if (gesture === 'palm') transition(STATE.EXPLODE);
            else if (gesture === 'fist' && stateTransition > 0.9) transition(STATE.FOLLOW);
            break;
        case STATE.TEXT_FORM:
            if (gesture === 'fist') transition(STATE.FOLLOW);
            else if (gesture === 'palm') transition(STATE.EXPLODE);
            break;
    }
}

function transition(newState) {
    previousState = currentState;
    currentState = newState;
    stateTransition = 0;

    // Update state UI
    stateTextEl.textContent = newState.replace('_', ' ');
    document.body.className = `state-${newState.toLowerCase().replace('_', '-')}`;

    // If transitioning to EXPLODE, give particles velocity
    if (newState === STATE.EXPLODE) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const dx = particlePositions[i * 3] - handPosition.x;
            const dy = particlePositions[i * 3 + 1] - handPosition.y;
            const dz = particlePositions[i * 3 + 2] - handPosition.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;

            particleVelocities[i * 3] = (dx / dist) * EXPLODE_SPEED * (0.5 + Math.random());
            particleVelocities[i * 3 + 1] = (dy / dist) * EXPLODE_SPEED * (0.5 + Math.random());
            particleVelocities[i * 3 + 2] = (dz / dist) * EXPLODE_SPEED * (0.3 + Math.random() * 0.5);
        }
    }
}

function updateGestureUI(gesture) {
    const icons = { fist: '✊', palm: '🖐️', ilu: '🤟', other: '🤚', none: '👋' };
    const labels = {
        fist: 'Fist detected',
        palm: 'Open palm detected',
        ilu: 'I Love You sign!',
        other: 'Hand detected',
        none: 'Waiting for hand...'
    };

    gestureIconEl.textContent = icons[gesture] || '❓';
    gestureLabelEl.textContent = labels[gesture] || 'Unknown gesture';
}

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Update particle material time
    particleSystem.material.uniforms.uTime.value = elapsed;

    // State transition progress
    stateTransition = Math.min(stateTransition + delta * 0.8, 1);

    // Update particles based on state
    updateParticles(delta, elapsed);

    // Update colors
    updateParticleColors(delta);

    // Subtle camera movement
    camera.position.x = Math.sin(elapsed * 0.1) * 0.5;
    camera.position.y = Math.cos(elapsed * 0.15) * 0.3;
    camera.lookAt(0, 0, 0);

    // Mark buffers for update
    particleGeometry.attributes.position.needsUpdate = true;
    colorAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    renderer.render(scene, camera);
}

function updateParticles(delta, elapsed) {
    const ease = easeOutCubic(stateTransition);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        switch (currentState) {
            case STATE.IDLE:
                // Gentle drift in sphere formation
                const idleAngle = elapsed * 0.2 + i * 0.01;
                particleTargets[i3] = particleOriginals[i3] + Math.sin(idleAngle) * 0.3;
                particleTargets[i3 + 1] = particleOriginals[i3 + 1] + Math.cos(idleAngle * 0.7) * 0.3;
                particleTargets[i3 + 2] = particleOriginals[i3 + 2] + Math.sin(idleAngle * 0.5) * 0.2;

                particlePositions[i3] += (particleTargets[i3] - particlePositions[i3]) * LERP_SPEED;
                particlePositions[i3 + 1] += (particleTargets[i3 + 1] - particlePositions[i3 + 1]) * LERP_SPEED;
                particlePositions[i3 + 2] += (particleTargets[i3 + 2] - particlePositions[i3 + 2]) * LERP_SPEED;

                alphaAttr.array[i] = 0.3 + Math.sin(elapsed + i) * 0.15;
                sizeAttr.array[i] = 2 + Math.sin(elapsed * 0.5 + i * 0.1) * 1;
                break;

            case STATE.FOLLOW:
                // Move toward hand position in a cluster
                const followOffset = {
                    x: (particleOriginals[i3] / IDLE_RADIUS) * FOLLOW_RADIUS,
                    y: (particleOriginals[i3 + 1] / IDLE_RADIUS) * FOLLOW_RADIUS,
                    z: (particleOriginals[i3 + 2] / IDLE_RADIUS) * FOLLOW_RADIUS * 0.5
                };

                const breathe = Math.sin(elapsed * 2 + i * 0.05) * 0.15;

                particleTargets[i3] = handPosition.x + followOffset.x + breathe;
                particleTargets[i3 + 1] = handPosition.y + followOffset.y + breathe * 0.7;
                particleTargets[i3 + 2] = handPosition.z + followOffset.z;

                const followLerp = LERP_SPEED * 1.5;
                particlePositions[i3] += (particleTargets[i3] - particlePositions[i3]) * followLerp;
                particlePositions[i3 + 1] += (particleTargets[i3 + 1] - particlePositions[i3 + 1]) * followLerp;
                particlePositions[i3 + 2] += (particleTargets[i3 + 2] - particlePositions[i3 + 2]) * followLerp;

                alphaAttr.array[i] = 0.5 + Math.sin(elapsed * 3 + i * 0.3) * 0.2;
                sizeAttr.array[i] = 2.5 + Math.sin(elapsed + i * 0.2) * 1.5;
                break;

            case STATE.EXPLODE:
                // Apply velocity outward
                particlePositions[i3] += particleVelocities[i3];
                particlePositions[i3 + 1] += particleVelocities[i3 + 1];
                particlePositions[i3 + 2] += particleVelocities[i3 + 2];

                // Slowly decelerate
                particleVelocities[i3] *= 0.995;
                particleVelocities[i3 + 1] *= 0.995;
                particleVelocities[i3 + 2] *= 0.995;

                // Add slight spin
                const angle = elapsed * 0.3;
                particlePositions[i3] += Math.sin(angle + i) * 0.002;
                particlePositions[i3 + 1] += Math.cos(angle + i * 0.7) * 0.002;

                // Particles get brighter during explosion
                alphaAttr.array[i] = Math.min(alphaAttr.array[i] + delta * 0.5, 0.9);
                sizeAttr.array[i] = 3 + Math.random() * 3;
                break;

            case STATE.IMPLODE:
                // Pull back toward center/hand
                const implodeTarget = handDetected ? handPosition : { x: 0, y: 0, z: 0 };
                const targetX = implodeTarget.x + (particleOriginals[i3] / IDLE_RADIUS) * FOLLOW_RADIUS;
                const targetY = implodeTarget.y + (particleOriginals[i3 + 1] / IDLE_RADIUS) * FOLLOW_RADIUS;
                const targetZ = implodeTarget.z + (particleOriginals[i3 + 2] / IDLE_RADIUS) * FOLLOW_RADIUS * 0.5;

                particlePositions[i3] += (targetX - particlePositions[i3]) * IMPLODE_SPEED;
                particlePositions[i3 + 1] += (targetY - particlePositions[i3 + 1]) * IMPLODE_SPEED;
                particlePositions[i3 + 2] += (targetZ - particlePositions[i3 + 2]) * IMPLODE_SPEED;

                // Reset velocities
                particleVelocities[i3] *= 0.9;
                particleVelocities[i3 + 1] *= 0.9;
                particleVelocities[i3 + 2] *= 0.9;

                alphaAttr.array[i] = 0.4 + stateTransition * 0.3;
                sizeAttr.array[i] = 2 + stateTransition * 2;
                break;

            case STATE.TEXT_FORM:
                // Lerp to text target positions + hand offset
                if (textTargetPositions) {
                    const offsetX = handDetected ? handPosition.x * 0.3 : 0;
                    const offsetY = handDetected ? handPosition.y * 0.3 : 0;

                    const tx = textTargetPositions[i3] + offsetX;
                    const ty = textTargetPositions[i3 + 1] + offsetY;
                    const tz = textTargetPositions[i3 + 2];

                    particlePositions[i3] += (tx - particlePositions[i3]) * TEXT_LERP_SPEED;
                    particlePositions[i3 + 1] += (ty - particlePositions[i3 + 1]) * TEXT_LERP_SPEED;
                    particlePositions[i3 + 2] += (tz - particlePositions[i3 + 2]) * TEXT_LERP_SPEED;
                }

                // BRIGHT and dense — high alpha, bigger particles, vivid sparkle
                alphaAttr.array[i] = 0.85 + Math.sin(elapsed * 5 + i * 0.4) * 0.15;
                sizeAttr.array[i] = 4 + Math.sin(elapsed * 3 + i * 0.2) * 2;
                break;
        }
    }
}

function updateParticleColors(delta) {
    const target = STATE_COLORS[currentState];
    currentHue += (target.h - currentHue) * 0.02;

    const hNorm = currentHue / 360;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // Per-particle slight hue variation
        const hueVar = (Math.sin(i * 0.1) * 0.05);
        const rgb = hslToRgb(
            ((hNorm + hueVar) % 1 + 1) % 1,
            target.s + Math.sin(i * 0.2) * 0.1,
            target.l + Math.sin(i * 0.3) * 0.1
        );

        colorAttr.array[i3] += (rgb.r - colorAttr.array[i3]) * 0.03;
        colorAttr.array[i3 + 1] += (rgb.g - colorAttr.array[i3 + 1]) * 0.03;
        colorAttr.array[i3 + 2] += (rgb.b - colorAttr.array[i3 + 2]) * 0.03;
    }
}

// ============================================================
// UTILITIES
// ============================================================
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r, g, b };
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    particleSystem.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
}

// ============================================================
// START
// ============================================================
init();
