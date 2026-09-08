(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.UltimateLogic = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    var FIELD = {
        width: 100,
        height: 160
    };

    var THROWER_START = { x: 50, y: 128 };
    var RECEIVER_START = { x: 50, y: 32 };
    var MAX_THROW = 150;
    var CATCH_RADIUS = 14;
    var GOOD_RANGE_VARY_STREAK = 2;
    var GOOD_WIDTH_MIN = 0.09;
    var GOOD_WIDTH_MAX = 0.18;
    var GOOD_CENTER_MIN = 0.3;
    var GOOD_CENTER_MAX = 0.78;
    var POWER_SPEED = 0.85;
    var POWER_SPEED_MIN = 0.7;
    var POWER_SPEED_MAX = 1.5;
    var FIRST_THROW_POWER_SPEED = 0.8;
    var THROW_DURATION = 1.8;
    // Miss recovery should end when the camera pan finishes (see MISS_PAUSE + MISS_PAN).
    var RESULT_DURATION = 1.6;
    var AIM_COOLDOWN = 0.4;
    var CUT_SIDE_OFFSET = 38;
    var CUT_DOWNFIELD_OFFSET = 20;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function samplePowerSpeed(game) {
        if (!game || game.streak === 0) {
            return FIRST_THROW_POWER_SPEED;
        }
        if (POWER_SPEED_MAX <= POWER_SPEED_MIN) {
            return POWER_SPEED_MIN;
        }
        return POWER_SPEED_MIN + Math.random() * (POWER_SPEED_MAX - POWER_SPEED_MIN);
    }

    function copyPoint(point) {
        return { x: point.x, y: point.y };
    }

    function lerpPoint(a, b, t) {
        return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t
        };
    }

    function cutStart(game) {
        var dir = throwDirection(game);
        var side = 1;
        return {
            x: game.receiver.x + side * CUT_SIDE_OFFSET,
            y: game.receiver.y + dir * CUT_DOWNFIELD_OFFSET
        };
    }

    function receiverVisual(game) {
        var start = cutStart(game);
        var end = game.receiver;
        if (game.state === "throwing") {
            var t = Math.min(1, Math.max(0, game.throwT));
            var eased = t * t * (3 - 2 * t);
            return lerpPoint(start, end, eased);
        }
        if (game.state === "result") {
            return copyPoint(end);
        }
        return copyPoint(start);
    }

    function throwDirection(game) {
        var delta = game.receiver.y - game.thrower.y;
        if (delta === 0) {
            return -1;
        }
        return delta > 0 ? 1 : -1;
    }

    function targetDistance(game) {
        return Math.abs(game.receiver.y - game.thrower.y);
    }

    function catchRadiusFor(game) {
        return game.catchRadius != null ? game.catchRadius : CATCH_RADIUS;
    }

    function goodPowerRange(game) {
        var target = targetDistance(game);
        var radius = catchRadiusFor(game);
        return {
            min: Math.max(0, (target - radius) / MAX_THROW),
            max: Math.min(1, (target + radius) / MAX_THROW)
        };
    }

    function defaultCatchWindow() {
        return {
            receiver: copyPoint(RECEIVER_START),
            catchRadius: CATCH_RADIUS
        };
    }

    function sampleCatchWindow() {
        var width = GOOD_WIDTH_MIN + Math.random() * (GOOD_WIDTH_MAX - GOOD_WIDTH_MIN);
        var center = GOOD_CENTER_MIN + Math.random() * (GOOD_CENTER_MAX - GOOD_CENTER_MIN);
        var half = width / 2;
        // Keep the window on the meter with room to miss short or long.
        center = clamp(center, half + 0.04, 1 - half - 0.04);
        var target = center * MAX_THROW;
        return {
            receiver: {
                x: RECEIVER_START.x,
                y: THROWER_START.y - target
            },
            catchRadius: half * MAX_THROW
        };
    }

    function applyCatchWindow(game) {
        var window = game.varyGoodRange
            ? sampleCatchWindow()
            : defaultCatchWindow();
        game.receiver = window.receiver;
        game.catchRadius = window.catchRadius;
    }

    function landingForPower(game, power) {
        var dir = throwDirection(game);
        return {
            x: game.thrower.x,
            y: game.thrower.y + dir * power * MAX_THROW
        };
    }

    function judgeLanding(game, landing) {
        var dir = throwDirection(game);
        var along = (landing.y - game.thrower.y) * dir;
        var target = targetDistance(game);
        if (Math.abs(along - target) <= catchRadiusFor(game)) {
            return "caught";
        }
        if (along < target) {
            return "short";
        }
        return "long";
    }

    function statusText(game) {
        if (game.state === "throwing") {
            return "Throwing...";
        }
        if (game.state === "result") {
            if (game.result === "caught") {
                return "Caught!";
            }
            if (game.result === "short") {
                return "Too short \u2014 turnover";
            }
            return "Too long \u2014 turnover";
        }
        if (game.charging) {
            return "Release to throw";
        }
        return "Hold to power up";
    }

    function createGame() {
        return {
            state: "aiming",
            power: 0,
            powerSpeed: POWER_SPEED,
            catchRadius: CATCH_RADIUS,
            charging: false,
            thrower: copyPoint(THROWER_START),
            receiver: copyPoint(RECEIVER_START),
            disc: {
                x: THROWER_START.x,
                y: THROWER_START.y,
                height: 0
            },
            lockedPower: null,
            landing: null,
            throwT: 0,
            result: null,
            resultT: 0,
            streak: 0,
            varyGoodRange: false,
            aimCooldown: 0,
            cutSide: 1
        };
    }

    function updateAiming(game, dt) {
        if (game.state !== "aiming") {
            return;
        }
        if (game.aimCooldown > 0) {
            game.aimCooldown -= dt;
        }
        if (game.charging) {
            var speed = game.powerSpeed || POWER_SPEED;
            game.power = Math.min(1, game.power + speed * dt);
            if (game.power >= 1) {
                startThrow(game);
            }
        }
    }

    function beginCharge(game) {
        if (game.state !== "aiming" || game.aimCooldown > 0 || game.charging) {
            return false;
        }
        game.charging = true;
        game.power = 0;
        game.powerSpeed = samplePowerSpeed(game);
        return true;
    }

    function cancelCharge(game) {
        if (!game.charging || game.state !== "aiming") {
            return false;
        }
        game.charging = false;
        game.power = 0;
        return true;
    }

    function startThrow(game) {
        if (game.state !== "aiming" || game.aimCooldown > 0 || !game.charging) {
            return false;
        }
        game.charging = false;
        game.lockedPower = game.power;
        game.landing = landingForPower(game, game.lockedPower);
        game.throwT = 0;
        game.disc.x = game.thrower.x;
        game.disc.y = game.thrower.y;
        game.disc.height = 0;
        game.state = "throwing";
        return true;
    }

    function updateThrowing(game, dt) {
        if (game.state !== "throwing") {
            return;
        }
        game.throwT += dt / THROW_DURATION;
        var t = Math.min(1, game.throwT);
        var eased = 1 - (1 - t) * (1 - t);
        game.disc.x = game.thrower.x + (game.landing.x - game.thrower.x) * eased;
        game.disc.y = game.thrower.y + (game.landing.y - game.thrower.y) * eased;
        game.disc.height = Math.sin(t * Math.PI);
        if (t >= 1) {
            finishThrow(game);
        }
    }

    function finishThrow(game) {
        game.result = judgeLanding(game, game.landing);
        game.resultT = 0;
        game.state = "result";
        game.disc.height = 0;
        if (game.result === "caught") {
            game.streak += 1;
            if (game.streak >= GOOD_RANGE_VARY_STREAK) {
                game.varyGoodRange = true;
            }
            game.disc.x = game.receiver.x;
            game.disc.y = game.receiver.y;
        } else {
            game.streak = 0;
            game.disc.x = game.landing.x;
            game.disc.y = game.landing.y;
        }
    }

    function continueFromCatch(game) {
        game.thrower = copyPoint(THROWER_START);
        game.disc.x = game.thrower.x;
        game.disc.y = game.thrower.y;
        game.disc.height = 0;
        game.power = 0;
        game.charging = false;
        game.lockedPower = null;
        game.landing = null;
        game.throwT = 0;
        game.result = null;
        game.resultT = 0;
        game.aimCooldown = AIM_COOLDOWN;
        game.cutSide = 1;
        game.state = "aiming";
        applyCatchWindow(game);
    }

    function restart(game) {
        var savedReceiver = copyPoint(game.receiver);
        var savedCatchRadius = game.catchRadius;
        var savedVaryGoodRange = !!game.varyGoodRange;
        game.state = "aiming";
        game.power = 0;
        game.powerSpeed = POWER_SPEED;
        game.catchRadius = savedCatchRadius;
        game.charging = false;
        game.thrower = copyPoint(THROWER_START);
        game.receiver = savedReceiver;
        game.disc = {
            x: THROWER_START.x,
            y: THROWER_START.y,
            height: 0
        };
        game.lockedPower = null;
        game.landing = null;
        game.throwT = 0;
        game.result = null;
        game.resultT = 0;
        game.streak = 0;
        game.varyGoodRange = savedVaryGoodRange;
        // Miss retry should be immediate once the camera is back.
        game.aimCooldown = 0;
        game.cutSide = 1;
    }

    function updateResult(game, dt) {
        if (game.state !== "result") {
            return;
        }
        game.resultT += dt;
        if (game.resultT >= RESULT_DURATION) {
            if (game.result === "caught") {
                continueFromCatch(game);
            } else {
                restart(game);
            }
        }
    }

    function update(game, dt) {
        updateAiming(game, dt);
        updateThrowing(game, dt);
        updateResult(game, dt);
    }

    return {
        FIELD: FIELD,
        THROWER_START: THROWER_START,
        RECEIVER_START: RECEIVER_START,
        MAX_THROW: MAX_THROW,
        CATCH_RADIUS: CATCH_RADIUS,
        GOOD_RANGE_VARY_STREAK: GOOD_RANGE_VARY_STREAK,
        GOOD_WIDTH_MIN: GOOD_WIDTH_MIN,
        GOOD_WIDTH_MAX: GOOD_WIDTH_MAX,
        GOOD_CENTER_MIN: GOOD_CENTER_MIN,
        GOOD_CENTER_MAX: GOOD_CENTER_MAX,
        POWER_SPEED: POWER_SPEED,
        POWER_SPEED_MIN: POWER_SPEED_MIN,
        POWER_SPEED_MAX: POWER_SPEED_MAX,
        FIRST_THROW_POWER_SPEED: FIRST_THROW_POWER_SPEED,
        THROW_DURATION: THROW_DURATION,
        RESULT_DURATION: RESULT_DURATION,
        AIM_COOLDOWN: AIM_COOLDOWN,
        CUT_SIDE_OFFSET: CUT_SIDE_OFFSET,
        CUT_DOWNFIELD_OFFSET: CUT_DOWNFIELD_OFFSET,
        createGame: createGame,
        update: update,
        beginCharge: beginCharge,
        cancelCharge: cancelCharge,
        startThrow: startThrow,
        goodPowerRange: goodPowerRange,
        landingForPower: landingForPower,
        judgeLanding: judgeLanding,
        statusText: statusText,
        throwDirection: throwDirection,
        continueFromCatch: continueFromCatch,
        restart: restart,
        cutStart: cutStart,
        receiverVisual: receiverVisual,
        samplePowerSpeed: samplePowerSpeed,
        applyCatchWindow: applyCatchWindow
    };
});
