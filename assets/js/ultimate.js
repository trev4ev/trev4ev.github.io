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
const DISC_RADIUS = 1.7;
const DISC_HOLD_SIDE = 9;
const game = logic.createGame();
window.ultimateGame = game;

const scene = new THREE.Scene();
const sky = 0xd4c4f0;
scene.background = new THREE.Color(sky);
scene.fog = new THREE.Fog(sky, 55, 150);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const cameraPos = new THREE.Vector3(0, 8, 28);
const cameraLook = new THREE.Vector3(0, 2, 0);
camera.position.copy(cameraPos);
camera.lookAt(cameraLook);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: false
});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const outline = new OutlineEffect(renderer, {
    defaultThickness: 0.014,
    defaultColor: [0.23, 0.15, 0.32],
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

const hemi = new THREE.HemisphereLight(0xf4ecff, 0x7a6a9a, 1.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
sun.position.set(18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    noOutline(new THREE.MeshLambertMaterial({ color: 0xc4b3de }))
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const fieldWidth = logic.FIELD.width * UNIT;
const fieldLength = logic.FIELD.height * UNIT;

function addVoxelField() {
    const cols = 12;
    const rows = 20;
    const tileW = fieldWidth / cols;
    const tileL = fieldLength / rows;
    const geo = new THREE.BoxGeometry(tileW * 0.97, 0.18, tileL * 0.97);
    const grassA = noOutline(toon(0x6faf62));
    const grassB = noOutline(toon(0x5d9a52));
    const endA = noOutline(toon(0xa88ad4));
    const endB = noOutline(toon(0x8f6fc2));
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const endzone = j < 3 || j >= rows - 3;
            const mat = endzone
                ? ((i + j) % 2 ? endA : endB)
                : ((i + j) % 2 ? grassA : grassB);
            const tile = new THREE.Mesh(geo, mat);
            tile.position.set(
                -fieldWidth / 2 + tileW * (i + 0.5),
                0.09,
                -fieldLength / 2 + tileL * (j + 0.5)
            );
            tile.receiveShadow = true;
            scene.add(tile);
        }
    }
}

addVoxelField();

const lineMat = toon(0xf7f0ff);
function addStripe(width, length, x, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, length), lineMat);
    mesh.position.set(x, 0.22, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

addStripe(fieldWidth + 0.4, 0.4, 0, -fieldLength / 2);
addStripe(fieldWidth + 0.4, 0.4, 0, fieldLength / 2);
addStripe(0.4, fieldLength, -fieldWidth / 2, 0);
addStripe(0.4, fieldLength, fieldWidth / 2, 0);
addStripe(fieldWidth, 0.32, 0, 0);

function addPixelRing(radius, color) {
    const group = new THREE.Group();
    const brick = new THREE.BoxGeometry(0.7, 0.16, 0.7);
    const mat = toon(color);
    const count = 12;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const bit = new THREE.Mesh(brick, mat);
        bit.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
        group.add(bit);
    }
    scene.add(group);
    return group;
}

const catchRing = addPixelRing(logic.CATCH_RADIUS * UNIT * 0.85, 0xf0d56a);

function voxel(w, h, d, color, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function makePlayer(palette) {
    const group = new THREE.Group();
    group.add(voxel(0.4, 0.85, 0.4, palette.pants, -0.24, 0.42, 0));
    group.add(voxel(0.4, 0.85, 0.4, palette.pants, 0.24, 0.42, 0));
    group.add(voxel(0.96, 1.15, 0.56, palette.shirt, 0, 1.28, 0));
    group.add(voxel(0.32, 1.0, 0.32, palette.shirt, -0.68, 1.22, 0));
    group.add(voxel(0.32, 1.0, 0.32, palette.skin, 0.68, 1.22, 0));
    group.add(voxel(0.72, 0.72, 0.72, palette.skin, 0, 2.18, 0));
    group.add(voxel(0.78, 0.26, 0.78, palette.hair, 0, 2.62, 0.04));
    group.add(voxel(0.14, 0.14, 0.1, 0x1a1224, -0.16, 2.22, 0.36));
    group.add(voxel(0.14, 0.14, 0.1, 0x1a1224, 0.16, 2.22, 0.36));
    return group;
}

const throwerMesh = makePlayer({
    skin: 0xf0c4a8,
    shirt: 0x7b4bb8,
    pants: 0x3d2a54,
    hair: 0x2a1b3d
});
const receiverMesh = makePlayer({
    skin: 0xe8b898,
    shirt: 0xf2c94c,
    pants: 0x5c3d1a,
    hair: 0x4a2810
});
scene.add(throwerMesh);
scene.add(receiverMesh);

const disc = new THREE.Group();
const discPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, 0.34, 8),
    toon(0xf7f0ff)
);
discPlate.castShadow = true;
const discRim = new THREE.Mesh(
    new THREE.CylinderGeometry(DISC_RADIUS + 0.18, DISC_RADIUS + 0.18, 0.38, 8),
    toon(0x8b5cc7)
);
discRim.castShadow = true;
disc.add(discRim);
disc.add(discPlate);
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
    const flight = Math.max(0, Math.min(1, game.throwT || 0));
    let discLift = 1.9;
    if (game.state === "throwing") {
        discLift = 2.1 + Math.sin(flight * Math.PI) * 8.5;
    } else if (game.state === "result") {
        discLift = game.result === "caught" ? 2.3 : 0.35;
    }

    throwerWorld.copy(fieldToWorld(game.thrower.x, game.thrower.y, 0));
    receiverWorld.copy(fieldToWorld(receiverPos.x, receiverPos.y, 0));

    let holdSide = 0;
    if (game.state === "aiming") {
        holdSide = DISC_HOLD_SIDE;
    } else if (game.state === "throwing") {
        holdSide = DISC_HOLD_SIDE * (1 - flight);
    }
    const discField = {
        x: (game.state === "aiming" ? game.thrower.x : game.disc.x) + holdSide,
        y: game.state === "aiming" ? game.thrower.y + dir * 2.2 : game.disc.y
    };
    discWorld.copy(fieldToWorld(discField.x, discField.y, discLift));

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
        disc.rotation.x = 0.55;
        disc.rotation.z = 0.2;
        disc.rotation.y += 0.35;
    } else if (game.state === "result" && game.result === "caught") {
        disc.rotation.set(0.15, disc.rotation.y, 0);
        disc.position.y = 2.3;
    } else {
        disc.rotation.x = 0.2;
        disc.rotation.z = 0.05;
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

    const follow = game.state === "throwing" ? 0.2 + Math.min(1, game.throwT) * 0.55
        : game.state === "result" ? 0.45
        : 0.08;
    const interest = throwerWorld.clone().lerp(discWorld, follow);
    const back = -dir * 18;
    desiredCam.set(
        throwerWorld.x + 6.2,
        5.8 + (game.state === "throwing" ? game.disc.height * 3.2 : 0),
        interest.z + back
    );
    desiredLook.copy(discWorld);
    desiredLook.y += 0.6;
    desiredLook.z = THREE.MathUtils.lerp(discWorld.z, receiverWorld.z, 0.18);
}

function updateCamera(dt) {
    const ease = 1 - Math.pow(0.0018, dt);
    cameraPos.lerp(desiredCam, ease);
    cameraLook.lerp(desiredLook, ease);
    camera.position.copy(cameraPos);
    camera.lookAt(cameraLook);
}

function resize() {
    const stage = canvas.parentElement;
    const rect = stage ? stage.getBoundingClientRect() : canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
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
    new ResizeObserver(resize).observe(canvas.parentElement || canvas);
}
requestAnimationFrame(frame);
