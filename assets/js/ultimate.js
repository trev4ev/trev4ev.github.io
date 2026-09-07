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
const DISC_RADIUS = 1.55;
const DISC_HOLD_SIDE = 9;
const BODY_CENTER = 1.28;
const game = logic.createGame();
window.ultimateGame = game;

const scene = new THREE.Scene();
const sky = 0xffe8f4;
scene.background = new THREE.Color(sky);
scene.fog = new THREE.Fog(sky, 70, 170);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const cameraPos = new THREE.Vector3(0, 8, 28);
const cameraLook = new THREE.Vector3(0, 2, 0);
camera.position.copy(cameraPos);
camera.lookAt(cameraLook);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const outline = new OutlineEffect(renderer, {
    defaultThickness: 0.0075,
    defaultColor: [0.45, 0.28, 0.4],
    defaultAlpha: 0.85
});

function noOutline(material) {
    material.userData.outlineParameters = { visible: false };
    return material;
}

function glossy(color, extra) {
    return new THREE.MeshPhongMaterial(Object.assign({
        color: color,
        shininess: 90,
        specular: 0xffffff,
        emissive: new THREE.Color(color).multiplyScalar(0.08)
    }, extra || {}));
}

const hemi = new THREE.HemisphereLight(0xfff0fb, 0xc9a8d8, 1.15);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff6e8, 1.05);
sun.position.set(16, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.radius = 6;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffe4f4, 0.35));

const ground = new THREE.Mesh(
    new THREE.CircleGeometry(130, 48),
    noOutline(new THREE.MeshLambertMaterial({ color: 0xf6d7ea }))
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const fieldWidth = logic.FIELD.width * UNIT;
const fieldLength = logic.FIELD.height * UNIT;

function addSoftField() {
    const grass = new THREE.Mesh(
        new THREE.PlaneGeometry(fieldWidth + 1.6, fieldLength + 1.6, 1, 1),
        noOutline(glossy(0x9ed9a0, { shininess: 18, specular: 0xc8f0cc }))
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.02;
    grass.receiveShadow = true;
    scene.add(grass);

    function endzone(z) {
        const zone = new THREE.Mesh(
            new THREE.PlaneGeometry(fieldWidth + 0.4, fieldLength / 6.5),
            noOutline(glossy(0xe7c4ff, { shininess: 22, specular: 0xf6e8ff }))
        );
        zone.rotation.x = -Math.PI / 2;
        zone.position.set(0, 0.04, z);
        zone.receiveShadow = true;
        scene.add(zone);
    }
    endzone(-fieldLength / 2 + fieldLength / 13);
    endzone(fieldLength / 2 - fieldLength / 13);

    const line = noOutline(glossy(0xfff7ff, { shininess: 40 }));
    function stripe(width, length, x, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, length), line);
        mesh.position.set(x, 0.08, z);
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
    stripe(fieldWidth + 0.5, 0.28, 0, -fieldLength / 2);
    stripe(fieldWidth + 0.5, 0.28, 0, fieldLength / 2);
    stripe(0.28, fieldLength, -fieldWidth / 2, 0);
    stripe(0.28, fieldLength, fieldWidth / 2, 0);
    stripe(fieldWidth, 0.2, 0, 0);
}

addSoftField();

function addCloud(x, y, z, scale) {
    const group = new THREE.Group();
    const mat = noOutline(glossy(0xfff8fd, { shininess: 12 }));
    const puffs = [
        [0, 0, 0, 1.6],
        [1.4, 0.15, 0.2, 1.15],
        [-1.35, 0.1, -0.15, 1.2],
        [0.2, 0.55, 0, 1.05]
    ];
    puffs.forEach(function (puff) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(puff[3], 16, 12), mat);
        ball.position.set(puff[0], puff[1], puff[2]);
        group.add(ball);
    });
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    scene.add(group);
}

addCloud(-28, 18, -22, 1.4);
addCloud(24, 16, -30, 1.1);
addCloud(8, 20, 18, 0.9);

function addFlower(x, z, petalColor) {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.7, 8),
        glossy(0x6fbf78)
    );
    stem.position.y = 0.35;
    group.add(stem);
    for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glossy(petalColor));
        const angle = (i / 5) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.28, 0.78, Math.sin(angle) * 0.28);
        petal.scale.set(1, 0.55, 1);
        group.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glossy(0xfff1a8));
    center.position.y = 0.8;
    group.add(center);
    group.position.set(x, 0, z);
    scene.add(group);
}

addFlower(-fieldWidth / 2 - 3.2, 8, 0xff9ec8);
addFlower(fieldWidth / 2 + 3.4, -6, 0xffc56e);
addFlower(-fieldWidth / 2 - 4.4, -16, 0xc9b4ff);
addFlower(fieldWidth / 2 + 4.1, 18, 0xff9ec8);

const catchRing = new THREE.Mesh(
    new THREE.TorusGeometry(logic.CATCH_RADIUS * UNIT * 0.82, 0.12, 10, 36),
    glossy(0xffe27a, { emissive: 0xffd56a, emissiveIntensity: 0.25 })
);
catchRing.rotation.x = Math.PI / 2;
catchRing.position.y = 0.1;
scene.add(catchRing);

function makeSpike(palette) {
    const group = new THREE.Group();
    const bodyMat = glossy(palette.body);
    const spikeMat = glossy(palette.spike);

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.12, 28, 22), bodyMat);
    body.position.y = BODY_CENTER;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const belly = new THREE.Mesh(
        new THREE.SphereGeometry(0.78, 18, 14),
        glossy(palette.belly)
    );
    belly.position.set(0, BODY_CENTER - 0.12, -0.42);
    belly.scale.set(1.05, 0.9, 0.55);
    group.add(belly);

    const spikeGeo = new THREE.ConeGeometry(0.24, 0.62, 7);
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const pos = ico.getAttribute("position");
    const used = {};
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const key = x.toFixed(2) + "," + y.toFixed(2) + "," + z.toFixed(2);
        if (used[key]) {
            continue;
        }
        used[key] = true;
        if (z < -0.42 && Math.abs(x) < 0.62 && y > -0.2 && y < 0.62) {
            continue;
        }
        if (y < -0.78) {
            continue;
        }
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const outward = new THREE.Vector3(x, y, z).normalize();
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
        spike.position.copy(outward.multiplyScalar(1.05)).add(new THREE.Vector3(0, BODY_CENTER, 0));
        spike.castShadow = true;
        group.add(spike);
    }

    const white = glossy(0xffffff);
    const dark = glossy(0x3a2438);
    function eye(x) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), white);
        ball.position.set(x, BODY_CENTER + 0.18, -0.92);
        group.add(ball);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), dark);
        pupil.position.set(x, BODY_CENTER + 0.16, -1.12);
        group.add(pupil);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), noOutline(glossy(0xffffff)));
        shine.position.set(x - 0.06, BODY_CENTER + 0.24, -1.18);
        group.add(shine);
    }
    eye(-0.32);
    eye(0.32);

    const blushMat = noOutline(glossy(palette.blush, { transparent: true, opacity: 0.7 }));
    function blush(x) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), blushMat);
        mesh.position.set(x, BODY_CENTER - 0.08, -0.9);
        mesh.scale.set(1.15, 0.55, 0.4);
        group.add(mesh);
    }
    blush(-0.58);
    blush(0.58);

    const smile = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.035, 8, 14, Math.PI),
        dark
    );
    smile.position.set(0, BODY_CENTER - 0.18, -1.05);
    smile.rotation.x = Math.PI / 2.2;
    smile.rotation.z = Math.PI;
    group.add(smile);

    const armGeo = new THREE.SphereGeometry(0.28, 12, 10);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-1.18, BODY_CENTER - 0.05, -0.15);
    leftArm.castShadow = true;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(1.18, BODY_CENTER - 0.05, -0.15);
    rightArm.castShadow = true;
    group.add(rightArm);

    const footGeo = new THREE.SphereGeometry(0.32, 12, 10);
    const leftFoot = new THREE.Mesh(footGeo, glossy(palette.feet));
    leftFoot.position.set(-0.42, 0.22, 0.05);
    leftFoot.scale.set(1, 0.55, 1.15);
    leftFoot.castShadow = true;
    group.add(leftFoot);
    const rightFoot = new THREE.Mesh(footGeo, glossy(palette.feet));
    rightFoot.position.set(0.42, 0.22, 0.05);
    rightFoot.scale.set(1, 0.55, 1.15);
    rightFoot.castShadow = true;
    group.add(rightFoot);

    group.userData.leftArm = leftArm;
    group.userData.rightArm = rightArm;
    return group;
}

const throwerMesh = makeSpike({
    body: 0xff8eb8,
    spike: 0xf25a9a,
    belly: 0xffd0e6,
    blush: 0xff6fa5,
    feet: 0xe86aa0
});
const receiverMesh = makeSpike({
    body: 0xffd56f,
    spike: 0xf0a63a,
    belly: 0xffefc2,
    blush: 0xff9eb0,
    feet: 0xe8b04a
});
scene.add(throwerMesh);
scene.add(receiverMesh);

const disc = new THREE.Group();
const discPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS * 0.92, 0.22, 32),
    glossy(0xfff7fb, { shininess: 120 })
);
discPlate.castShadow = true;
const discRim = new THREE.Mesh(
    new THREE.TorusGeometry(DISC_RADIUS * 0.92, 0.16, 12, 36),
    glossy(0xd7a6ff, { shininess: 110 })
);
discRim.rotation.x = Math.PI / 2;
discRim.castShadow = true;
const discStar = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    glossy(0xff9ec8, { shininess: 140 })
);
discStar.scale.set(1, 0.28, 1);
disc.add(discPlate);
disc.add(discRim);
disc.add(discStar);
scene.add(disc);

function blobShadow() {
    const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.95, 24),
        noOutline(new THREE.MeshBasicMaterial({
            color: 0x7a4d72,
            transparent: true,
            opacity: 0.18
        }))
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    scene.add(mesh);
    return mesh;
}

const throwerShadow = blobShadow();
const receiverShadow = blobShadow();
const discShadow = blobShadow();
discShadow.scale.setScalar(0.75);

function fieldToWorld(x, y, height) {
    return new THREE.Vector3(
        (x - logic.FIELD.width / 2) * UNIT,
        height || 0,
        (y - logic.FIELD.height / 2) * UNIT
    );
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
    const bob = game.state === "aiming" ? Math.sin(elapsed * 2.4) * 0.08 : 0;
    const runBob = game.state === "throwing" ? Math.abs(Math.sin(elapsed * 10)) * 0.16 : 0;
    const flight = Math.max(0, Math.min(1, game.throwT || 0));
    let discLift = 1.55;
    if (game.state === "throwing") {
        discLift = 1.7 + Math.sin(flight * Math.PI) * 8.5;
    } else if (game.state === "result") {
        discLift = game.result === "caught" ? 1.85 : 0.28;
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
    receiverMesh.position.y = runBob;
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

    const armWave = Math.sin(elapsed * 2.2) * 0.18;
    throwerMesh.userData.rightArm.position.y = BODY_CENTER - 0.05 + (game.state === "aiming" ? 0.22 : armWave);
    throwerMesh.userData.leftArm.position.y = BODY_CENTER - 0.05 - armWave * 0.4;
    receiverMesh.userData.leftArm.position.y = BODY_CENTER - 0.05 + runBob * 0.8;
    receiverMesh.userData.rightArm.position.y = BODY_CENTER - 0.05 + Math.abs(Math.sin(elapsed * 9)) * 0.2;

    disc.position.copy(discWorld);
    if (game.state === "throwing") {
        disc.rotation.x = 0.55;
        disc.rotation.z = 0.2;
        disc.rotation.y += 0.35;
    } else if (game.state === "result" && game.result === "caught") {
        disc.rotation.set(0.15, disc.rotation.y, 0);
        disc.position.y = 1.85;
    } else {
        disc.rotation.x = 0.2;
        disc.rotation.z = 0.05;
    }

    const catchPoint = fieldToWorld(game.receiver.x, game.receiver.y, 0.08);
    catchRing.position.x = catchPoint.x;
    catchRing.position.z = catchPoint.z;
    catchRing.rotation.z = elapsed * 0.4;

    throwerShadow.position.set(throwerWorld.x, 0.05, throwerWorld.z);
    receiverShadow.position.set(receiverWorld.x, 0.05, receiverWorld.z);
    discShadow.position.set(discWorld.x, 0.06, discWorld.z);
    const shadowScale = 0.75 + game.disc.height * 0.9;
    discShadow.scale.set(shadowScale, shadowScale, shadowScale);
    discShadow.material.opacity = 0.16 - game.disc.height * 0.07;

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
