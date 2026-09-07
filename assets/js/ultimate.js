import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";

const logic = window.UltimateLogic;
const canvas = document.getElementById("ultimate-field");
const statusEl = document.getElementById("ultimate-status");
const streakEl = document.getElementById("ultimate-streak");
const root = document.getElementById("ultimate");

if (!canvas || !logic) {
    throw new Error("Ultimate game failed to initialize");
}

const UNIT = 0.42;
const DISC_RADIUS = 0.72;
const DISC_HOLD_SIDE = 6;
const BODY_CENTER = 1.28;
const game = logic.createGame();
window.ultimateGame = game;

const scene = new THREE.Scene();
const sky = 0xf4eefb;
scene.background = new THREE.Color(sky);
scene.fog = new THREE.Fog(sky, 48, 120);

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
    defaultColor: [0.35, 0.26, 0.48],
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

const hemi = new THREE.HemisphereLight(0xffffff, 0xc9b6de, 1.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xf7f2ff, 1.0);
sun.position.set(16, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.radius = 6;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xf3eafc, 0.4));

const ground = new THREE.Mesh(
    new THREE.CircleGeometry(220, 48),
    noOutline(new THREE.MeshLambertMaterial({ color: 0xf4eefb }))
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const clouds = [];

function addCloud(x, y, z, scale) {
    const group = new THREE.Group();
    const mat = noOutline(glossy(0xffffff, { shininess: 12 }));
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
    clouds.push(group);
}

addCloud(-28, 18, -22, 1.4);
addCloud(24, 16, -30, 1.1);
addCloud(8, 20, 18, 0.9);

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
    belly.position.set(0, BODY_CENTER - 0.12, 0.42);
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
        if (z > 0.42 && Math.abs(x) < 0.62 && y > -0.2 && y < 0.62) {
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
    const dark = glossy(0x4a3560);
    function eye(x) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), white);
        ball.position.set(x, BODY_CENTER + 0.18, 0.92);
        group.add(ball);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), dark);
        pupil.position.set(x, BODY_CENTER + 0.16, 1.12);
        group.add(pupil);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), noOutline(glossy(0xffffff)));
        shine.position.set(x - 0.06, BODY_CENTER + 0.24, 1.18);
        group.add(shine);
    }
    eye(-0.32);
    eye(0.32);

    const blushMat = noOutline(glossy(palette.blush, { transparent: true, opacity: 0.7 }));
    function blush(x) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), blushMat);
        mesh.position.set(x, BODY_CENTER - 0.08, 0.9);
        mesh.scale.set(1.15, 0.55, 0.4);
        group.add(mesh);
    }
    blush(-0.58);
    blush(0.58);

    const smile = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.035, 8, 14, Math.PI),
        dark
    );
    smile.position.set(0, BODY_CENTER - 0.18, 1.05);
    smile.rotation.x = Math.PI / 2.2;
    smile.rotation.z = Math.PI;
    group.add(smile);

    const armGeo = new THREE.SphereGeometry(0.28, 12, 10);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-1.18, BODY_CENTER - 0.05, 0.2);
    leftArm.castShadow = true;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(1.18, BODY_CENTER - 0.05, 0.2);
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

let throwerMesh = makeSpike({
    body: 0xb892de,
    spike: 0x8d68c4,
    belly: 0xe9ddf6,
    blush: 0xc9b0e8,
    feet: 0xa57ad4
});
let receiverMesh = makeSpike({
    body: 0xf4eefb,
    spike: 0xd4c0ea,
    belly: 0xffffff,
    blush: 0xe4d6f4,
    feet: 0xe6dcf2
});
scene.add(throwerMesh);
scene.add(receiverMesh);

const disc = new THREE.Group();
const discPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS * 0.92, 0.14, 32),
    glossy(0xffffff, { shininess: 120 })
);
discPlate.castShadow = true;
const discRim = new THREE.Mesh(
    new THREE.TorusGeometry(DISC_RADIUS * 0.92, 0.09, 12, 36),
    glossy(0xc4a6e6, { shininess: 110 })
);
discRim.rotation.x = Math.PI / 2;
discRim.castShadow = true;
const discStar = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    glossy(0xe6d8f6, { shininess: 140 })
);
discStar.scale.set(1, 0.28, 1);
disc.add(discPlate);
disc.add(discRim);
disc.add(discStar);
scene.add(disc);

function makeCrescent() {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.58, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0.2, 0.05, 0.4, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.07,
        bevelEnabled: false,
        curveSegments: 28
    });
    geo.center();
    const mesh = new THREE.Mesh(geo, glossy(0xb892de, {
        emissive: 0x9b74d0,
        emissiveIntensity: 0.16
    }));
    mesh.castShadow = true;
    return mesh;
}

const crescent = makeCrescent();
scene.add(crescent);

function blobShadow() {
    const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.95, 24),
        noOutline(new THREE.MeshBasicMaterial({
            color: 0x6b4f86,
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
discShadow.scale.setScalar(0.45);

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
const faceDummy = new THREE.Object3D();
const lookFrom = new THREE.Quaternion();
const lookTo = new THREE.Quaternion();
const downfieldPoint = new THREE.Vector3();
const interest = new THREE.Vector3();
const PARK = new THREE.Vector3(0, -80, 0);

function lookAtFlat(quat, from, toX, toZ) {
    faceDummy.position.copy(from);
    faceDummy.up.set(0, 1, 0);
    faceDummy.lookAt(toX, from.y, toZ);
    quat.copy(faceDummy.quaternion);
}

function parkActor(mesh, shadow) {
    mesh.visible = false;
    mesh.position.copy(PARK);
    if (shadow) {
        shadow.visible = false;
        shadow.position.copy(PARK);
    }
}

function showActor(mesh, shadow) {
    mesh.visible = true;
    if (shadow) {
        shadow.visible = true;
    }
}

function updateMeter() {
    statusEl.textContent = logic.statusText(game);
    streakEl.textContent = game.streak ? "Streak: " + game.streak : "";
    root.dataset.state = game.state;
    root.dataset.result = game.result || "";
}

function placeActors(elapsed) {
    const caught = game.state === "result" && game.result === "caught";
    const receiverPos = logic.receiverVisual(game);
    if (game.state === "aiming" && receiverIntro > 0) {
        receiverPos.x += 48 * receiverIntro;
    }
    const dir = logic.throwDirection(game);
    const bob = game.state === "aiming" ? Math.sin(elapsed * 2.4) * 0.08 : 0;
    const runBob = game.state === "throwing" ? Math.abs(Math.sin(elapsed * 10)) * 0.16 : 0;
    const flight = Math.max(0, Math.min(1, game.throwT || 0));
    let discLift = 1.55;
    if (game.state === "throwing") {
        discLift = 1.7 + Math.sin(flight * Math.PI) * 8.5;
    } else if (game.state === "result") {
        discLift = caught ? 1.85 : 0.28;
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

    if (caught) {
        parkActor(throwerMesh, throwerShadow);
    } else {
        showActor(throwerMesh, throwerShadow);
        throwerMesh.position.copy(throwerWorld);
        throwerMesh.position.y = bob;
        throwerMesh.lookAt(receiverWorld.x, throwerMesh.position.y, receiverWorld.z);
    }

    showActor(receiverMesh, receiverShadow);
    receiverMesh.position.copy(receiverWorld);
    receiverMesh.position.y = runBob;

    downfieldPoint.set(receiverWorld.x, receiverWorld.y, receiverWorld.z + dir * 16);
    if (game.state === "throwing") {
        receiverMesh.lookAt(cameraPos.x, receiverMesh.position.y, cameraPos.z);
        const cutFrom = logic.cutStart(game);
        const cutFromWorld = fieldToWorld(cutFrom.x, cutFrom.y, 0);
        const sideLean = THREE.MathUtils.clamp((receiverWorld.x - cutFromWorld.x) * 0.03, -0.28, 0.28);
        receiverMesh.rotateZ(-sideLean);
    } else if (caught) {
        const turn = Math.min(1, Math.max(0, (game.resultT - 0.05) / 0.85));
        const eased = turn * turn * (3 - 2 * turn);
        lookAtFlat(lookFrom, receiverWorld, cameraPos.x, cameraPos.z);
        lookAtFlat(lookTo, receiverWorld, downfieldPoint.x, downfieldPoint.z);
        receiverMesh.quaternion.slerpQuaternions(lookFrom, lookTo, eased);
    } else {
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
    } else if (caught) {
        disc.rotation.set(0.15, disc.rotation.y, 0);
        disc.position.copy(receiverWorld);
        disc.position.y = 1.55;
        disc.position.x += 0.7;
        discWorld.copy(disc.position);
    } else {
        disc.rotation.x = 0.2;
        disc.rotation.z = 0.05;
    }

    const aiming = game.state === "aiming";
    crescent.visible = aiming;
    if (aiming) {
        const range = logic.goodPowerRange(game);
        const inGood = game.power >= range.min && game.power <= range.max;
        crescent.position.copy(discWorld);
        crescent.position.x += 1.05;
        crescent.position.y += (game.power - 0.5) * 2.35;
        crescent.position.z += 0.15;
        crescent.lookAt(cameraPos.x, crescent.position.y, cameraPos.z);
        crescent.material.color.setHex(inGood ? 0xe6d8f6 : 0xb892de);
        crescent.material.emissive.setHex(inGood ? 0xc9b6e4 : 0x9b74d0);
        crescent.material.emissiveIntensity = inGood ? 0.42 : 0.14;
    }

    if (throwerMesh.visible) {
        throwerShadow.position.set(throwerWorld.x, 0.05, throwerWorld.z);
    }
    receiverShadow.position.set(receiverWorld.x, 0.05, receiverWorld.z);
    discShadow.position.set(discWorld.x, 0.06, discWorld.z);
    const shadowScale = 0.75 + game.disc.height * 0.9;
    discShadow.scale.set(shadowScale, shadowScale, shadowScale);
    discShadow.material.opacity = 0.16 - game.disc.height * 0.07;

    const anchor = caught ? receiverWorld : throwerWorld;
    ground.position.x = anchor.x;
    ground.position.z = anchor.z;

    const back = -dir * 18;
    if (caught) {
        desiredCam.set(receiverWorld.x + 6.2, 5.8, receiverWorld.z + back);
        desiredLook.set(receiverWorld.x, 1.4, receiverWorld.z + dir * 12);
    } else if (game.state === "throwing") {
        const follow = 0.2 + Math.min(1, game.throwT) * 0.55;
        interest.copy(throwerWorld).lerp(discWorld, follow);
        desiredCam.set(
            throwerWorld.x + 6.2,
            5.8 + game.disc.height * 3.2,
            interest.z + back
        );
        desiredLook.copy(discWorld);
        desiredLook.y += 0.6;
        desiredLook.z = THREE.MathUtils.lerp(discWorld.z, receiverWorld.z, 0.18);
        if (game.throwT > 0.62) {
            const settle = Math.min(1, (game.throwT - 0.62) / 0.38);
            const eased = settle * settle * (3 - 2 * settle);
            desiredCam.set(
                throwerWorld.x + 6.2 * (1 - eased) + (receiverWorld.x + 6.2) * eased,
                5.8 + game.disc.height * 3.2 * (1 - eased),
                (interest.z + back) * (1 - eased) + (receiverWorld.z + back) * eased
            );
            desiredLook.set(
                receiverWorld.x,
                1.4,
                receiverWorld.z + dir * 12
            );
        }
    } else {
        desiredCam.set(throwerWorld.x + 6.2, 5.8, throwerWorld.z + back);
        desiredLook.copy(discWorld);
        desiredLook.y += 0.6;
        desiredLook.z = THREE.MathUtils.lerp(discWorld.z, receiverWorld.z, 0.18);
    }
}

const cloudRigs = [
    { x: -22, y: 16, z: -28 },
    { x: 20, y: 15, z: -36 },
    { x: 6, y: 18, z: 12 }
];

function placeClouds() {
    clouds.forEach(function (cloud, i) {
        const rig = cloudRigs[i];
        cloud.position.set(cameraPos.x + rig.x, rig.y, cameraPos.z + rig.z);
    });
}

function updateCamera(dt) {
    const caught = game.state === "result" && game.result === "caught";
    const rate = caught ? 0.0000008 : 0.0018;
    const ease = 1 - Math.pow(rate, dt);
    cameraPos.lerp(desiredCam, ease);
    cameraLook.lerp(desiredLook, ease);
    camera.position.copy(cameraPos);
    camera.lookAt(cameraLook);
    placeClouds();
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
let holdingCatch = false;
let receiverIntro = 0;

function recycleCatcherAsThrower(catcherX, catcherY) {
    const before = fieldToWorld(catcherX, catcherY, 0);
    const after = fieldToWorld(logic.THROWER_START.x, logic.THROWER_START.y, 0);
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    cameraPos.x += dx;
    cameraPos.z += dz;
    cameraLook.x += dx;
    cameraLook.z += dz;
    desiredCam.x += dx;
    desiredCam.z += dz;
    desiredLook.x += dx;
    desiredLook.z += dz;
    const previousThrower = throwerMesh;
    throwerMesh = receiverMesh;
    receiverMesh = previousThrower;
    showActor(throwerMesh, throwerShadow);
    showActor(receiverMesh, receiverShadow);
    receiverIntro = 1;
}

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
    const catcherX = game.receiver.x;
    const catcherY = game.receiver.y;
    holdingCatch = game.state === "result" && game.result === "caught";
    logic.update(game, dt);
    if (holdingCatch && game.state === "aiming") {
        recycleCatcherAsThrower(catcherX, catcherY);
    }
    if (receiverIntro > 0) {
        receiverIntro = Math.max(0, receiverIntro - dt * 1.35);
    }
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
