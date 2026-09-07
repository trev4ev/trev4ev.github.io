import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";

const logic = window.UltimateLogic;
const canvas = document.getElementById("ultimate-field");
const statusEl = document.getElementById("ultimate-status");
const streakEl = document.getElementById("ultimate-streak");
const meterGood = document.getElementById("power-good");
const meterDial = document.getElementById("power-dial");
const root = document.getElementById("ultimate");

if (!canvas || !logic) {
    throw new Error("Ultimate game failed to initialize");
}

const UNIT = 0.42;
const PLAYER_HEIGHT = 3.2;
const DISC_RADIUS = 0.95;
const game = logic.createGame();
window.ultimateGame = game;

const scene = new THREE.Scene();
const sky = 0xb9d4ea;
scene.background = new THREE.Color(sky);
scene.fog = new THREE.Fog(sky, 70, 180);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const cameraPos = new THREE.Vector3(0, 8, 28);
const cameraLook = new THREE.Vector3(0, 2, 0);
camera.position.copy(cameraPos);
camera.lookAt(cameraLook);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const outline = new OutlineEffect(renderer, {
    defaultThickness: 0.011,
    defaultColor: [0.04, 0.04, 0.06],
    defaultAlpha: 1
});

function noOutline(material) {
    material.userData.outlineParameters = { visible: false };
    return material;
}

function toon(color) {
    return new THREE.MeshLambertMaterial({
        color: color,
        emissive: new THREE.Color(color).multiplyScalar(0.12)
    });
}

const hemi = new THREE.HemisphereLight(0xf2f6ff, 0x6d8a4e, 1.15);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4dd, 1.35);
sun.position.set(18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    noOutline(new THREE.MeshLambertMaterial({ color: 0x7aa35c }))
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const fieldWidth = logic.FIELD.width * UNIT;
const fieldLength = logic.FIELD.height * UNIT;
const field = new THREE.Mesh(
    new THREE.PlaneGeometry(fieldWidth, fieldLength),
    noOutline(new THREE.MeshLambertMaterial({ color: 0x6f9b4f }))
);
field.rotation.x = -Math.PI / 2;
field.position.y = 0.02;
field.receiveShadow = true;
scene.add(field);

const lineMat = toon(0xf4f4f4);
function addStripe(width, length, x, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, length), lineMat);
    mesh.position.set(x, 0.07, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

addStripe(fieldWidth, 0.22, 0, -fieldLength / 2);
addStripe(fieldWidth, 0.22, 0, fieldLength / 2);
addStripe(0.22, fieldLength, -fieldWidth / 2, 0);
addStripe(0.22, fieldLength, fieldWidth / 2, 0);
addStripe(fieldWidth, 0.16, 0, 0);

const catchRing = new THREE.Mesh(
    new THREE.RingGeometry(logic.CATCH_RADIUS * UNIT * 0.72, logic.CATCH_RADIUS * UNIT, 48),
    noOutline(new THREE.MeshBasicMaterial({
        color: 0xffed4f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    }))
);
catchRing.rotation.x = -Math.PI / 2;
catchRing.position.y = 0.06;
scene.add(catchRing);

function makePlayer(color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.62, 1.9, 4, 12),
        toon(color)
    );
    body.position.y = 1.7;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), toon(color));
    head.position.y = 3.05;
    head.castShadow = true;
    group.add(body);
    group.add(head);
    group.userData.body = body;
    return group;
}

const throwerMesh = makePlayer(0x3b6cc4);
const receiverMesh = makePlayer(0xe06728);
scene.add(throwerMesh);
scene.add(receiverMesh);

const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, 0.14, 32),
    toon(0xf3f3f3)
);
disc.castShadow = true;
scene.add(disc);

function blobShadow() {
    const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 20),
        noOutline(new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.22
        }))
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04;
    scene.add(mesh);
    return mesh;
}

const throwerShadow = blobShadow();
const receiverShadow = blobShadow();
const discShadow = blobShadow();
discShadow.scale.setScalar(0.85);

function fieldToWorld(x, y, height) {
    return new THREE.Vector3(
        (x - logic.FIELD.width / 2) * UNIT,
        height || 0,
        (y - logic.FIELD.height / 2) * UNIT
    );
}

function setGroundItem(mesh, fieldPoint, height, extraScale) {
    const pos = fieldToWorld(fieldPoint.x, fieldPoint.y, height || 0);
    mesh.position.copy(pos);
    if (extraScale) {
        mesh.scale.setScalar(extraScale);
    }
}

const desiredCam = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const throwerWorld = new THREE.Vector3();
const receiverWorld = new THREE.Vector3();
const discWorld = new THREE.Vector3();

function updateMeter() {
    const range = logic.goodPowerRange(game);
    meterGood.style.left = range.min * 100 + "%";
    meterGood.style.width = (range.max - range.min) * 100 + "%";
    meterDial.style.left = game.power * 100 + "%";
    statusEl.textContent = logic.statusText(game);
    streakEl.textContent = game.streak ? "Streak: " + game.streak : "";
    root.dataset.state = game.state;
    root.dataset.result = game.result || "";
}

function placeActors(elapsed) {
    const receiverPos = logic.receiverVisual(game);
    const dir = logic.throwDirection(game);
    const bob = game.state === "aiming" ? Math.sin(elapsed * 3) * 0.05 : 0;
    const discLift = 0.28 + game.disc.height * 6.2;
    const catchLift = game.state === "result" && game.result === "caught" ? 2.15 : discLift;

    throwerWorld.copy(fieldToWorld(game.thrower.x, game.thrower.y, 0));
    receiverWorld.copy(fieldToWorld(receiverPos.x, receiverPos.y, 0));

    let discField = { x: game.disc.x, y: game.disc.y };
    let discHeight = catchLift;
    if (game.state === "aiming") {
        discField = {
            x: game.thrower.x,
            y: game.thrower.y + dir * 3.2
        };
        discHeight = 1.35;
    }
    discWorld.copy(fieldToWorld(discField.x, discField.y, discHeight));

    throwerMesh.position.copy(throwerWorld);
    throwerMesh.position.y = bob;
    receiverMesh.position.copy(receiverWorld);
    throwerMesh.lookAt(receiverWorld.x, throwerMesh.position.y, receiverWorld.z);

    const cutFrom = logic.cutStart(game);
    const cutFromWorld = fieldToWorld(cutFrom.x, cutFrom.y, 0);
    const cutDelta = receiverWorld.clone().sub(cutFromWorld);
    if (game.state === "throwing" && cutDelta.lengthSq() > 0.01) {
        const ahead = receiverWorld.clone().add(cutDelta.normalize());
        receiverMesh.lookAt(ahead.x, receiverMesh.position.y, ahead.z);
        receiverMesh.rotation.z = THREE.MathUtils.clamp(-(ahead.x - receiverWorld.x) * 0.25, -0.35, 0.35);
    } else {
        receiverMesh.rotation.z = 0;
        receiverMesh.lookAt(throwerWorld.x, receiverMesh.position.y, throwerWorld.z);
    }

    disc.position.copy(discWorld);
    if (game.state === "throwing") {
        disc.rotation.x = 0.35;
        disc.rotation.y += 0.45;
    } else if (game.state === "result" && game.result === "caught") {
        disc.rotation.x = 0;
        disc.position.y = 2.15;
    } else {
        disc.rotation.x = 0;
        disc.rotation.y *= 0.85;
    }

    const catchPoint = fieldToWorld(game.receiver.x, game.receiver.y, 0.06);
    catchRing.position.x = catchPoint.x;
    catchRing.position.z = catchPoint.z;

    throwerShadow.position.set(throwerWorld.x, 0.04, throwerWorld.z);
    receiverShadow.position.set(receiverWorld.x, 0.04, receiverWorld.z);
    discShadow.position.set(discWorld.x, 0.05, discWorld.z);
    const shadowScale = 0.7 + game.disc.height * 0.9;
    discShadow.scale.set(shadowScale, shadowScale, shadowScale);
    discShadow.material.opacity = 0.2 - game.disc.height * 0.08;

    const follow = game.state === "throwing" ? Math.min(1, game.throwT) * 0.42
        : game.state === "result" ? 0.28
        : 0;
    const interest = throwerWorld.clone().lerp(discWorld, follow);
    const back = -dir * 24;
    desiredCam.set(
        throwerWorld.x * 0.15,
        8.6 + game.disc.height * 1.3,
        interest.z + back
    );
    desiredLook.set(
        catchPoint.x * 0.15 + discWorld.x * 0.2,
        1.5 + game.disc.height * 1.05,
        THREE.MathUtils.lerp(throwerWorld.z, catchPoint.z, 0.55)
    );
}

function updateCamera(dt) {
    const ease = 1 - Math.pow(0.0018, dt);
    cameraPos.lerp(desiredCam, ease);
    cameraLook.lerp(desiredLook, ease);
    camera.position.copy(cameraPos);
    camera.lookAt(cameraLook);
}

function resize() {
    const width = Math.max(1, canvas.clientWidth || 560);
    const height = Math.max(1, canvas.clientHeight || 400);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    outline.setSize(width, height);
}

let lastTime = 0;
let elapsed = 0;

function frame(now) {
    if (!lastTime) {
        lastTime = now;
    }
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) {
        dt = 0.05;
    }
    elapsed += dt;
    logic.update(game, dt);
    updateMeter();
    placeActors(elapsed);
    updateCamera(dt);
    outline.render(scene, camera);
    requestAnimationFrame(frame);
}

function tryThrow(event) {
    if (event.target.closest && event.target.closest("a")) {
        return;
    }
    if (logic.startThrow(game)) {
        event.preventDefault();
    }
}

resize();
updateMeter();
placeActors(0);
cameraPos.copy(desiredCam);
cameraLook.copy(desiredLook);
camera.position.copy(cameraPos);
camera.lookAt(cameraLook);
root.addEventListener("pointerdown", tryThrow);
window.addEventListener("resize", resize);
if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(canvas);
}
requestAnimationFrame(frame);
