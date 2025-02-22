// Initialize Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set sky color
scene.background = new THREE.Color(0x87CEEB);

// Physics constants
const PHYSICS = {
    GROUND_FRICTION: 0.995,
    AIR_RESISTANCE: 0.995,
    GRAVITY: 0.15,
    MAX_SPEED: 200,
    ACCELERATION: 0.15,
    INITIAL_CREEP: 0.05,
    ROTATION_SPEED: 0.02,
    PITCH_SENSITIVITY: 0.03,
    ROLL_SENSITIVITY: 0.02,
    LOOK_SENSITIVITY: 0.02
};

// Create runway
const runwayGeometry = new THREE.PlaneGeometry(100, 2000);
const runwayMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
runway.rotation.x = -Math.PI / 2;
scene.add(runway);

// Create ground
const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x228B22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
scene.add(ground);

// Create airplane model
const planeGeometry = new THREE.Group();

// Fuselage
const fuselageGeometry = new THREE.BoxGeometry(1, 1, 4);
const fuselageMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
planeGeometry.add(fuselage);

// Wings
const wingGeometry = new THREE.BoxGeometry(10, 0.2, 2);
const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xCCCCCC });
const wings = new THREE.Mesh(wingGeometry, wingMaterial);
planeGeometry.add(wings);

// Tail
const tailGeometry = new THREE.BoxGeometry(2, 1, 0.2);
const tailMaterial = new THREE.MeshPhongMaterial({ color: 0xCCCCCC });
const tail = new THREE.Mesh(tailGeometry, tailMaterial);
tail.position.z = -2;
tail.position.y = 0.5;
planeGeometry.add(tail);

scene.add(planeGeometry);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
directionalLight.position.set(100, 100, 50);
scene.add(directionalLight);

// Aircraft state
const plane = {
    position: new THREE.Vector3(0, 0, 500),
    rotation: new THREE.Euler(0, 0, 0),
    speed: PHYSICS.INITIAL_CREEP,
    throttle: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    lookAngle: 0,
    altitude: 0,
    onGround: true
};

// Keyboard state
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    q: false,
    e: false
};

// Key handlers
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
        e.preventDefault();
    }
});

// Camera setup
const cameraOffset = new THREE.Vector3(0, 10, 30);

function updateCamera() {
    camera.position.copy(plane.position).add(cameraOffset);
    camera.lookAt(plane.position);
}

// Game loop
function animate() {
    requestAnimationFrame(animate);

    // Handle throttle
    if (keys.w) {
        plane.throttle = Math.min(plane.throttle + 0.01, 1);
    }
    if (keys.s) {
        plane.throttle = Math.max(plane.throttle - 0.01, 0);
    }

    // Calculate speed
    const targetSpeed = plane.throttle * PHYSICS.MAX_SPEED;
    plane.speed = plane.speed * (plane.onGround ? PHYSICS.GROUND_FRICTION : PHYSICS.AIR_RESISTANCE);
    plane.speed += (targetSpeed - plane.speed) * PHYSICS.ACCELERATION;

    // Handle pitch
    if (keys.ArrowUp) {
        plane.pitch += PHYSICS.PITCH_SENSITIVITY;
        if (plane.pitch > Math.PI/3) plane.pitch = Math.PI/3;
    }
    if (keys.ArrowDown) {
        plane.pitch -= PHYSICS.PITCH_SENSITIVITY;
        if (plane.pitch < -Math.PI/3) plane.pitch = -Math.PI/3;
    }

    // Check for takeoff
    if (plane.speed > 8 && plane.pitch > 0.1) {
        plane.onGround = false;
    }

    // Update position
    if (plane.onGround) {
        plane.position.z -= plane.speed;
        plane.position.y = 0;
    } else {
        const pitchEffect = Math.sin(plane.pitch) * plane.speed;
        plane.position.y += pitchEffect * 0.5;
        plane.position.z -= Math.cos(plane.pitch) * plane.speed;
        
        // Apply gravity
        plane.position.y -= PHYSICS.GRAVITY;
        if (plane.position.y < 0) {
            plane.position.y = 0;
            plane.onGround = true;
        }
    }

    // Update plane model
    planeGeometry.position.copy(plane.position);
    planeGeometry.rotation.x = plane.pitch;
    planeGeometry.rotation.z = plane.roll;

    // Update camera
    updateCamera();

    // Update HUD
    document.getElementById('altitude').textContent = Math.floor(plane.position.y);
    document.getElementById('speed').textContent = Math.floor(plane.speed * 3.6);
    document.getElementById('pitch').textContent = Math.floor(plane.pitch * 180 / Math.PI);
    document.getElementById('roll').textContent = Math.floor(plane.roll * 180 / Math.PI);

    // Render scene
    renderer.render(scene, camera);
}

// Start animation
animate();
