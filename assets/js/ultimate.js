import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";

const logic = window.UltimateLogic;
const canvas = document.getElementById("ultimate-field");
const root = document.getElementById("ultimate");

if (!canvas || !logic) {
    throw new Error("Ultimate game failed to initialize");
}

const UNIT = 0.42;
const DISC_RADIUS = 0.5;
const BODY_CENTER = 1.28;
const ACTOR_HOVER = 0.16;
const ARM_REST = {
    // lookAt mirrors local +X, so anatomical right lives on -X.
    left: new THREE.Vector3(1.18, BODY_CENTER - 0.05, 0.2),
    right: new THREE.Vector3(-1.18, BODY_CENTER - 0.05, 0.2)
};
const ARM_HOLD_RIGHT = new THREE.Vector3(-1.15, BODY_CENTER + 0.16, 0.78);
const DISC_HAND_LOCAL = new THREE.Vector3(-1.38, BODY_CENTER + 0.18, 0.92);
const handScratch = new THREE.Vector3();
const releaseOrigin = new THREE.Vector3();
const landingWorld = new THREE.Vector3();
let releaseReady = false;
const game = logic.createGame();
window.ultimateGame = game;

const scene = new THREE.Scene();
const sky = 0xf0eefb;
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

const OUTLINE_NEAR = 0.0075;
const OUTLINE_FAR = 0.0032;

function outlineApproach() {
    if (game.state === "result" && game.result === "caught") {
        return 1;
    }
    if (game.state !== "throwing") {
        return 0;
    }
    const t = Math.max(0, Math.min(1, game.throwT || 0));
    if (t <= 0.62) {
        return t * 0.22;
    }
    const settle = (t - 0.62) / 0.38;
    const eased = settle * settle * (3 - 2 * settle);
    return 0.136 + eased * 0.864;
}

function outlineThickness(nearToFar) {
    return OUTLINE_NEAR + (OUTLINE_FAR - OUTLINE_NEAR) * nearToFar;
}

const outline = new OutlineEffect(renderer, {
    defaultThickness: OUTLINE_NEAR,
    defaultColor: [0.32, 0.26, 0.48],
    defaultAlpha: 0.85
});

function noOutline(material) {
    material.userData.outlineParameters = { visible: false };
    return material;
}

function setOutlineThickness(root, thickness) {
    root.traverse(function (obj) {
        if (!obj.isMesh || !obj.material) {
            return;
        }
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function (mat) {
            if (!mat.userData.outlineParameters) {
                mat.userData.outlineParameters = {};
            }
            if (mat.userData.outlineParameters.visible === false) {
                return;
            }
            mat.userData.outlineParameters.thickness = thickness;
        });
    });
}

function glossy(color, extra) {
    const mat = new THREE.MeshPhongMaterial(Object.assign({
        color: color,
        shininess: 42,
        specular: 0xc8c0d8,
        emissive: new THREE.Color(color).multiplyScalar(0.08)
    }, extra || {}));
    mat.userData.baseOpacity = mat.opacity;
    return mat;
}

function blinkOutOpacity(t) {
    const p = Math.max(0, Math.min(1, t));
    if (p < 0.72) {
        return Math.floor(p * 7) % 2 === 0 ? 1 : 0.08;
    }
    return Math.max(0, 1 - (p - 0.72) / 0.28);
}

function blinkInOpacity(t) {
    const p = Math.max(0, Math.min(1, t));
    if (p <= 0) {
        return 0;
    }
    if (p < 0.55) {
        return Math.floor(p * 8) % 2 === 0 ? 0.08 : 1;
    }
    return 1;
}

function setMaterialOpacity(root, alpha) {
    root.traverse(function (obj) {
        if (!obj.isMesh || !obj.material) {
            return;
        }
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function (mat) {
            const base = mat.userData.baseOpacity != null ? mat.userData.baseOpacity : 1;
            mat.transparent = alpha < 0.999 || base < 0.999;
            mat.opacity = base * alpha;
            // Keep depth writes on so eyes/mouth stay in front of the body while fading.
            mat.depthWrite = alpha > 0.02;
            if (!mat.userData.outlineParameters) {
                mat.userData.outlineParameters = {};
            }
            if (mat.userData.outlineParameters.visible !== false) {
                mat.userData.outlineParameters.alpha = alpha;
            }
        });
    });
}

function setDiscOpacity(alpha) {
    setMaterialOpacity(disc, alpha);
    disc.visible = alpha > 0.02;
}

function setActorOpacity(mesh, alpha) {
    setMaterialOpacity(mesh, alpha);
}

const hemi = new THREE.HemisphereLight(0xffffff, 0xc4b6e8, 1.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xf6f2ff, 0.55);
sun.position.set(16, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.radius = 10;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xf0eafc, 0.75));

const ground = new THREE.Mesh(
    new THREE.CircleGeometry(220, 48),
    noOutline(new THREE.MeshLambertMaterial({ color: 0xf0eefb }))
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const CHAR_PALETTES = [
    {
        body: 0xa892de,
        spike: 0x6b7fc4,
        belly: 0xdde4f6,
        blush: 0xc4b0e8,
        feet: 0x7a8fd4
    },
    {
        body: 0x8fa0de,
        spike: 0xa892de,
        belly: 0xe8eefb,
        blush: 0xb8c8f0,
        feet: 0x9b74d0
    },
    {
        body: 0xb892de,
        spike: 0x7a8fd4,
        belly: 0xf0eefb,
        blush: 0xd4c4f2,
        feet: 0x6b7fc4
    },
    {
        body: 0x7a8fd4,
        spike: 0xc4a6e6,
        belly: 0xdde4f6,
        blush: 0xa8c0f0,
        feet: 0xa892de
    },
    {
        body: 0xc4a6e6,
        spike: 0x6b7fc4,
        belly: 0xffffff,
        blush: 0xe0d4f4,
        feet: 0x8fa0de
    },
    {
        body: 0xe8eefb,
        spike: 0xa892de,
        belly: 0xffffff,
        blush: 0xb8c8f0,
        feet: 0xc4a6e6
    }
];

function pickPalette(exclude) {
    const options = CHAR_PALETTES.filter(function (palette) {
        return palette !== exclude;
    });
    return options[Math.floor(Math.random() * options.length)];
}

function tintMaterial(mat, hex) {
    mat.color.setHex(hex);
    mat.emissive.copy(new THREE.Color(hex).multiplyScalar(0.08));
}

function applyPalette(mesh, palette) {
    const mats = mesh.userData.mats;
    tintMaterial(mats.body, palette.body);
    tintMaterial(mats.spike, palette.spike);
    tintMaterial(mats.belly, palette.belly);
    tintMaterial(mats.blush, palette.blush);
    tintMaterial(mats.leftFoot, palette.feet);
    tintMaterial(mats.rightFoot, palette.feet);
    mesh.userData.palette = palette;
}

function makeSpike(palette) {
    const group = new THREE.Group();
    const bodyMat = glossy(palette.body);
    const spikeMat = glossy(palette.spike);
    const bellyMat = glossy(palette.belly);
    const leftFootMat = glossy(palette.feet);
    const rightFootMat = glossy(palette.feet);

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.12, 28, 22), bodyMat);
    body.position.y = BODY_CENTER;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const belly = new THREE.Mesh(
        new THREE.SphereGeometry(0.78, 18, 14),
        bellyMat
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
    const dark = glossy(0x4a3a68);
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
    leftArm.position.copy(ARM_REST.left);
    leftArm.castShadow = true;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.copy(ARM_REST.right);
    rightArm.castShadow = true;
    group.add(rightArm);

    const footGeo = new THREE.SphereGeometry(0.32, 12, 10);
    const leftFoot = new THREE.Mesh(footGeo, leftFootMat);
    leftFoot.position.set(-0.42, 0.22, 0.05);
    leftFoot.scale.set(1, 0.55, 1.15);
    leftFoot.castShadow = true;
    group.add(leftFoot);
    const rightFoot = new THREE.Mesh(footGeo, rightFootMat);
    rightFoot.position.set(0.42, 0.22, 0.05);
    rightFoot.scale.set(1, 0.55, 1.15);
    rightFoot.castShadow = true;
    group.add(rightFoot);

    group.userData.leftArm = leftArm;
    group.userData.rightArm = rightArm;
    group.userData.mats = {
        body: bodyMat,
        spike: spikeMat,
        belly: bellyMat,
        blush: blushMat,
        leftFoot: leftFootMat,
        rightFoot: rightFootMat
    };
    group.userData.palette = palette;
    return group;
}

const throwerPalette = pickPalette(null);
const receiverPalette = pickPalette(throwerPalette);
let throwerMesh = makeSpike(throwerPalette);
let receiverMesh = makeSpike(receiverPalette);
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
    glossy(0x8fa0de, { shininess: 110 })
);
discRim.rotation.x = Math.PI / 2;
discRim.castShadow = true;
const discStar = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    glossy(0xd4c4f2, { shininess: 140 })
);
discStar.scale.set(1, 0.28, 1);
disc.add(discPlate);
disc.add(discRim);
disc.add(discStar);
scene.add(disc);

const METER_LENGTH = 3.4;
const METER_WIDTH = 0.34;
const METER_BACK = 1.15;
const METER_RIGHT = 0.28;
const METER_YAW = 0.42;
const CAM_SIDE = 1;
const LOOK_X = 1;
let camSide = CAM_SIDE;
let lookX = LOOK_X;
let camBack = 20;

const meterGroup = new THREE.Group();
scene.add(meterGroup);

const meterTray = new THREE.Mesh(
    new THREE.BoxGeometry(METER_LENGTH + 0.3, 0.04, METER_WIDTH + 0.3),
    noOutline(glossy(0xc4b6e8, { shininess: 8 }))
);
meterTray.receiveShadow = true;
meterTray.position.y = 0.02;
meterGroup.add(meterTray);

const meterTrack = new THREE.Mesh(
    new THREE.BoxGeometry(METER_LENGTH, 0.05, METER_WIDTH),
    noOutline(glossy(0xffffff, { shininess: 18 }))
);
meterTrack.receiveShadow = true;
meterTrack.position.y = 0.05;
meterGroup.add(meterTrack);

const meterGood = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.07, METER_WIDTH * 0.78),
    noOutline(glossy(0xa8c0f0, { emissive: 0x8fa0de, emissiveIntensity: 0.28 }))
);
meterGood.position.y = 0.075;
meterGroup.add(meterGood);

const meterDial = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.1, METER_WIDTH * 1.35),
    glossy(0xa892de, { emissive: 0x8f74d0, emissiveIntensity: 0.28 })
);
meterDial.castShadow = true;
meterDial.position.y = 0.08;
const meterNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.52, 0.1),
    glossy(0x7a8fd4, { emissive: 0x6b7fc4, emissiveIntensity: 0.2 })
);
meterNeedle.position.y = 0.28;
meterDial.add(meterNeedle);
meterGroup.add(meterDial);

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
const missHoldCam = new THREE.Vector3();
const missHoldLook = new THREE.Vector3();
const resetCam = new THREE.Vector3();
const resetLook = new THREE.Vector3();
const PARK = new THREE.Vector3(0, -80, 0);
const MISS_PAUSE = 0.5;
const MISS_PAN = 1.1;
const MISS_DISC_OUT_END = 0.55;
const MISS_DISC_IN_START = 0.7;
const MISS_DISC_IN_END = 1.35;
const MISS_RECEIVER_RETURN_START = 0.2;
const MISS_RECEIVER_RETURN_END = 1.25;

function lookAtFlat(quat, from, toX, toZ) {
    faceDummy.position.copy(from);
    faceDummy.up.set(0, 1, 0);
    faceDummy.lookAt(toX, from.y, toZ);
    quat.copy(faceDummy.quaternion);
}

function poseArm(arm, rest, hold, amount) {
    arm.position.lerpVectors(rest, hold, amount);
}

function placeDiscInRightHand(mesh, target) {
    mesh.updateMatrixWorld(true);
    target.copy(DISC_HAND_LOCAL);
    mesh.localToWorld(target);
}

function orientHeldDisc(mesh) {
    disc.quaternion.copy(mesh.quaternion);
    disc.rotateX(0.22);
    disc.rotateZ(-0.04);
}

function parkActor(mesh) {
    mesh.visible = false;
    mesh.position.copy(PARK);
}

function showActor(mesh) {
    mesh.visible = true;
}

function updateMeter() {
    root.dataset.state = game.state;
    root.dataset.result = game.result || "";
}

function placeActors(elapsed) {
    const approach = outlineApproach();
    setOutlineThickness(throwerMesh, outlineThickness(approach));
    setOutlineThickness(receiverMesh, outlineThickness(1 - approach));
    const caught = game.state === "result" && game.result === "caught";
    const miss = game.state === "result" && game.result !== "caught";
    const aiming = game.state === "aiming";
    const throwing = game.state === "throwing";
    const receiverPos = logic.receiverVisual(game);
    if (aiming && receiverIntro > 0) {
        receiverPos.x += 48 * receiverIntro;
    } else if (miss) {
        const home = logic.cutStart(game);
        const returnT = Math.max(
            0,
            Math.min(
                1,
                (game.resultT - MISS_RECEIVER_RETURN_START) /
                    (MISS_RECEIVER_RETURN_END - MISS_RECEIVER_RETURN_START)
            )
        );
        const returnEase = returnT * returnT * (3 - 2 * returnT);
        receiverPos.x = game.receiver.x + (home.x - game.receiver.x) * returnEase;
        receiverPos.y = game.receiver.y + (home.y - game.receiver.y) * returnEase;
    }
    const dir = logic.throwDirection(game);
    const missDiscIn = miss && game.resultT >= MISS_DISC_IN_START;
    const bob = aiming || missDiscIn ? Math.sin(elapsed * 2.4) * 0.08 : 0;
    const runBob = throwing ? Math.abs(Math.sin(elapsed * 10)) * 0.16 : 0;
    const flight = Math.max(0, Math.min(1, game.throwT || 0));
    let discLift = 1.78;
    if (throwing) {
        discLift = 1.7 + Math.sin(flight * Math.PI) * 8.5;
    } else if (game.state === "result") {
        discLift = caught ? 1.85 : 0.28;
    }

    throwerWorld.copy(fieldToWorld(game.thrower.x, game.thrower.y, 0));
    receiverWorld.copy(fieldToWorld(receiverPos.x, receiverPos.y, 0));

    if (caught) {
        parkActor(throwerMesh);
    } else {
        showActor(throwerMesh);
        throwerMesh.position.copy(throwerWorld);
        throwerMesh.position.y = ACTOR_HOVER + bob;
        if (catchTurn > 0) {
            const turnProgress = 1 - catchTurn;
            const eased = turnProgress * turnProgress * (3 - 2 * turnProgress);
            lookAtFlat(lookFrom, throwerWorld, cameraPos.x, cameraPos.z);
            lookAtFlat(lookTo, throwerWorld, receiverWorld.x, receiverWorld.z);
            throwerMesh.quaternion.slerpQuaternions(lookFrom, lookTo, eased);
        } else {
            throwerMesh.lookAt(receiverWorld.x, throwerMesh.position.y, receiverWorld.z);
        }
    }

    showActor(receiverMesh);
    receiverMesh.position.copy(receiverWorld);
    receiverMesh.position.y = ACTOR_HOVER + runBob + (aiming && receiverIntro > 0 ? (1 - receiverIntro) * 0.08 : 0);

    downfieldPoint.set(receiverWorld.x, receiverWorld.y, receiverWorld.z + dir * 16);
    if (throwing) {
        receiverMesh.lookAt(cameraPos.x, receiverMesh.position.y, cameraPos.z);
        const cutFrom = logic.cutStart(game);
        const cutFromWorld = fieldToWorld(cutFrom.x, cutFrom.y, 0);
        const sideLean = THREE.MathUtils.clamp((receiverWorld.x - cutFromWorld.x) * 0.03, -0.28, 0.28);
        receiverMesh.rotateZ(-sideLean);
    } else {
        receiverMesh.lookAt(throwerWorld.x, receiverMesh.position.y, throwerWorld.z);
    }

    const armWave = Math.sin(elapsed * 2.2) * 0.18;
    const catchReach = throwing ? Math.max(0, Math.min(1, (flight - 0.62) / 0.38)) : 0;
    let throwArm = 0;
    if (aiming || missDiscIn || catchTurn > 0) {
        poseArm(throwerMesh.userData.rightArm, ARM_REST.right, ARM_HOLD_RIGHT, 1);
        throwerMesh.userData.leftArm.position.copy(ARM_REST.left);
        throwerMesh.userData.leftArm.position.y = ARM_REST.left.y - armWave * 0.4;
        poseArm(receiverMesh.userData.rightArm, ARM_REST.right, ARM_REST.right, 0);
        poseArm(receiverMesh.userData.leftArm, ARM_REST.left, ARM_REST.left, 0);
    } else if (throwing) {
        // Hold through a short whip, then follow through / retract.
        if (flight < 0.05) {
            throwArm = 1;
        } else if (flight < 0.22) {
            throwArm = 1 - (flight - 0.05) / 0.17;
        } else {
            throwArm = 0;
        }
        poseArm(throwerMesh.userData.rightArm, ARM_REST.right, ARM_HOLD_RIGHT, throwArm);
        throwerMesh.userData.leftArm.position.copy(ARM_REST.left);
        throwerMesh.userData.leftArm.position.y = ARM_REST.left.y - armWave * 0.4;
        poseArm(receiverMesh.userData.rightArm, ARM_REST.right, ARM_HOLD_RIGHT, catchReach);
        receiverMesh.userData.leftArm.position.copy(ARM_REST.left);
        receiverMesh.userData.leftArm.position.y = ARM_REST.left.y + runBob * 0.8;
    } else {
        if (throwerMesh.visible) {
            poseArm(throwerMesh.userData.rightArm, ARM_REST.right, ARM_REST.right, 0);
            poseArm(throwerMesh.userData.leftArm, ARM_REST.left, ARM_REST.left, 0);
        }
        poseArm(receiverMesh.userData.rightArm, ARM_REST.right, ARM_REST.right, 0);
        poseArm(receiverMesh.userData.leftArm, ARM_REST.left, ARM_REST.left, 0);
    }

    if (aiming || caught) {
        const holder = caught ? receiverMesh : throwerMesh;
        placeDiscInRightHand(holder, discWorld);
        disc.position.copy(discWorld);
        orientHeldDisc(holder);
        setDiscOpacity(1);
        releaseReady = false;
    } else if (miss) {
        if (!missDiscIn) {
            discWorld.copy(fieldToWorld(game.disc.x, game.disc.y, 0.28));
            disc.position.copy(discWorld);
            disc.rotation.x = 0.2;
            disc.rotation.z = 0.05;
            setDiscOpacity(blinkOutOpacity(game.resultT / MISS_DISC_OUT_END));
        } else {
            placeDiscInRightHand(throwerMesh, discWorld);
            disc.position.copy(discWorld);
            orientHeldDisc(throwerMesh);
            setDiscOpacity(
                blinkInOpacity(
                    (game.resultT - MISS_DISC_IN_START) /
                        (MISS_DISC_IN_END - MISS_DISC_IN_START)
                )
            );
        }
        releaseReady = false;
    } else if (throwing && game.landing) {
        landingWorld.copy(fieldToWorld(game.landing.x, game.landing.y, 0));
        if (!releaseReady || flight < 0.05) {
            placeDiscInRightHand(throwerMesh, releaseOrigin);
            releaseReady = true;
        }
        if (flight < 0.05) {
            disc.position.copy(releaseOrigin);
            orientHeldDisc(throwerMesh);
        } else {
            const pathT = (flight - 0.05) / 0.95;
            const pathEase = 1 - Math.pow(1 - pathT, 2);
            disc.position.set(
                THREE.MathUtils.lerp(releaseOrigin.x, landingWorld.x, pathEase),
                THREE.MathUtils.lerp(releaseOrigin.y, 0.28, pathEase) + Math.sin(pathT * Math.PI) * 8.5,
                THREE.MathUtils.lerp(releaseOrigin.z, landingWorld.z, pathEase)
            );
            if (
                flight > 0.8 &&
                logic.judgeLanding(game, game.landing) === "caught"
            ) {
                placeDiscInRightHand(receiverMesh, handScratch);
                const catchBlend = (flight - 0.8) / 0.2;
                disc.position.lerp(handScratch, catchBlend);
                disc.rotation.set(
                    THREE.MathUtils.lerp(0.55, 0.22, catchBlend),
                    disc.rotation.y + 0.25 * (1 - catchBlend),
                    THREE.MathUtils.lerp(-0.04, -0.04, catchBlend)
                );
            } else {
                disc.rotation.x = 0.55;
                disc.rotation.z = 0.12;
                disc.rotation.y += 0.45;
            }
        }
        discWorld.copy(disc.position);
        setDiscOpacity(1);
    } else {
        releaseReady = false;
        discWorld.copy(fieldToWorld(game.disc.x, game.disc.y, discLift));
        disc.position.copy(discWorld);
        disc.rotation.x = 0.2;
        disc.rotation.z = 0.05;
        setDiscOpacity(1);
    }

    if (aiming && receiverIntro > 0) {
        // Fade up quickly so the face is readable for most of the run-on.
        setActorOpacity(receiverMesh, Math.min(1, (1 - receiverIntro) * 2.4));
    } else {
        setActorOpacity(receiverMesh, receiverMesh.visible ? 1 : 0);
    }
    if (throwerMesh.visible) {
        setActorOpacity(throwerMesh, 1);
    }

    const range = logic.goodPowerRange(game);
    if (aiming) {
        meterGroup.visible = true;
        const grow = meterIntro * meterIntro * (3 - 2 * meterIntro);
        const meterLen = METER_LENGTH * Math.max(0.001, grow);
        meterGroup.scale.set(Math.max(0.001, grow), 1, 1);
        meterGroup.position.set(
            throwerWorld.x + METER_RIGHT + meterLen / 2,
            0,
            throwerWorld.z - dir * METER_BACK
        );
        meterGroup.rotation.y = -dir * METER_YAW;
        const goodLen = Math.max(0.2, (range.max - range.min) * METER_LENGTH);
        meterGood.scale.x = goodLen;
        meterGood.position.x = ((range.min + range.max) / 2 - 0.5) * METER_LENGTH;
        meterDial.position.x = (game.power - 0.5) * METER_LENGTH;
    } else if (throwing || miss) {
        // Keep the previous meter in world space and keep the dial moving on misses.
        meterGroup.visible = true;
        if (miss) {
            meterDial.position.x = (game.power - 0.5) * METER_LENGTH;
        }
    } else {
        meterGroup.visible = false;
    }

    const anchor = caught ? receiverWorld : throwerWorld;
    ground.position.x = anchor.x;
    ground.position.z = anchor.z;

    const back = -dir * camBack;
    resetCam.set(throwerWorld.x + camSide, 6.2, throwerWorld.z + back);
    // Same thrower framing for miss pan-end and aiming so the handoff doesn't dip.
    placeDiscInRightHand(throwerMesh, handScratch);
    resetLook.copy(handScratch);
    resetLook.y += 0.5;
    resetLook.x = throwerWorld.x + lookX;
    resetLook.z = THREE.MathUtils.lerp(handScratch.z, receiverWorld.z, 0.22);

    if (caught) {
        desiredCam.set(receiverWorld.x + camSide, 6.2, receiverWorld.z + back);
        desiredLook.set(receiverWorld.x + lookX, 1.4, receiverWorld.z + dir * 12);
    } else if (throwing) {
        const follow = 0.2 + Math.min(1, game.throwT) * 0.55;
        interest.copy(throwerWorld).lerp(discWorld, follow);
        desiredCam.set(
            throwerWorld.x + camSide,
            6.2 + game.disc.height * 3.2,
            interest.z + back
        );
        desiredLook.copy(discWorld);
        desiredLook.y += 0.6;
        desiredLook.x = throwerWorld.x + lookX;
        desiredLook.z = THREE.MathUtils.lerp(discWorld.z, receiverWorld.z, 0.18);
        if (game.throwT > 0.62 && game.landing) {
            landingWorld.copy(fieldToWorld(game.landing.x, game.landing.y, 0));
            const fullDist = Math.max(1, Math.abs(receiverWorld.z - throwerWorld.z));
            const throwDist = Math.abs(landingWorld.z - throwerWorld.z);
            const reach = THREE.MathUtils.clamp(throwDist / fullDist, 0, 1);
            // Short throws barely commit to the receiver; full throws settle normally.
            const settleWeight = THREE.MathUtils.smoothstep(reach, 0.4, 0.92);
            const settle = Math.min(1, (game.throwT - 0.62) / 0.38);
            const eased = settle * settle * (3 - 2 * settle) * settleWeight;
            const settleX = THREE.MathUtils.lerp(throwerWorld.x, landingWorld.x, reach);
            const settleZ = THREE.MathUtils.lerp(landingWorld.z, receiverWorld.z, reach);
            desiredCam.set(
                throwerWorld.x + camSide * (1 - eased) + (settleX + camSide) * eased,
                6.2 + game.disc.height * 3.2 * (1 - eased),
                (interest.z + back) * (1 - eased) + (settleZ + back) * eased
            );
            desiredLook.set(
                THREE.MathUtils.lerp(desiredLook.x, settleX + lookX, eased),
                THREE.MathUtils.lerp(desiredLook.y, 1.4, eased),
                THREE.MathUtils.lerp(desiredLook.z, settleZ + dir * (4 + 8 * reach), eased)
            );
        }
    } else if (miss) {
        // Miss: hold the end-of-throw framing, then pan back to thrower aiming framing.
        if (game.resultT < MISS_PAUSE) {
            desiredCam.copy(missHoldCam);
            desiredLook.copy(missHoldLook);
        } else {
            const panT = Math.min(1, (game.resultT - MISS_PAUSE) / MISS_PAN);
            const eased = panT * panT * (3 - 2 * panT);
            desiredCam.lerpVectors(missHoldCam, resetCam, eased);
            desiredLook.lerpVectors(missHoldLook, resetLook, eased);
        }
    } else {
        desiredCam.copy(resetCam);
        desiredLook.copy(resetLook);
    }
}

function updateCamera(dt) {
    const miss = game.state === "result" && game.result !== "caught";
    const missHold = miss && game.resultT < MISS_PAUSE;
    const missPan = miss && game.resultT >= MISS_PAUSE;
    // Follow miss pan keyframes directly so we don't lag then catch-up/dip at the end.
    if (missHold || missPan) {
        cameraPos.copy(desiredCam);
        cameraLook.copy(desiredLook);
    } else {
        const rate = catchTurn > 0.55 ? 0.0000008 : 0.0018;
        const ease = 1 - Math.pow(rate, dt);
        cameraPos.lerp(desiredCam, ease);
        cameraLook.lerp(desiredLook, ease);
    }
    camera.position.copy(cameraPos);
    camera.lookAt(cameraLook);
}

function resize() {
    const stage = canvas.parentElement;
    const rect = stage ? stage.getBoundingClientRect() : canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const portrait = width / height < 0.78;
    camSide = portrait ? 0 : CAM_SIDE;
    lookX = portrait ? 0 : LOOK_X;
    camBack = portrait ? 23 : 20;
    camera.fov = portrait ? 50 : 42;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    outline.setSize(width, height);
    if (elapsed) {
        placeActors(elapsed);
        cameraPos.copy(desiredCam);
        cameraLook.copy(desiredLook);
        camera.position.copy(cameraPos);
        camera.lookAt(cameraLook);
    }
}

let lastTime = 0;
let elapsed = 0;
let receiverIntro = 0;
let meterIntro = 1;
let catchTurn = 0;
let prevGameState = game.state;

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
    missHoldCam.x += dx;
    missHoldCam.z += dz;
    missHoldLook.x += dx;
    missHoldLook.z += dz;
    const previousThrower = throwerMesh;
    throwerMesh = receiverMesh;
    receiverMesh = previousThrower;
    applyPalette(receiverMesh, pickPalette(throwerMesh.userData.palette));
    showActor(throwerMesh);
    showActor(receiverMesh);
    setActorOpacity(throwerMesh, 1);
    setActorOpacity(receiverMesh, 0);
    setDiscOpacity(1);
    receiverIntro = 1;
    meterIntro = 0;
    catchTurn = 1;
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
    logic.update(game, dt);
    if (
        prevGameState === "throwing" &&
        game.state === "result" &&
        game.result === "caught"
    ) {
        // Start the next throw setup immediately so the turn, meter, and
        // new receiver intro all run together.
        logic.continueFromCatch(game);
        recycleCatcherAsThrower(catcherX, catcherY);
    } else if (
        prevGameState === "throwing" &&
        game.state === "result" &&
        game.result !== "caught"
    ) {
        missHoldCam.copy(cameraPos);
        missHoldLook.copy(cameraLook);
    }
    prevGameState = game.state;
    if (catchTurn > 0) {
        catchTurn = Math.max(0, catchTurn - dt * 1.15);
        const turnProgress = 1 - catchTurn;
        const eased = turnProgress * turnProgress * (3 - 2 * turnProgress);
        meterIntro = eased;
        receiverIntro = 1 - eased;
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
    if (catchTurn > 0) {
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
