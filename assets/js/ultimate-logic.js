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
    var POWER_SPEED = 0.85;
    var THROW_DURATION = 1.8;
    var RESULT_DURATION = 1.5;
    var AIM_COOLDOWN = 0.4;
    var CUT_SIDE_OFFSET = 38;
    var CUT_DOWNFIELD_OFFSET = 20;

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
        var side = game.cutSide || 1;
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

    function goodPowerRange(game) {
        var target = targetDistance(game);
        return {
            min: Math.max(0, (target - CATCH_RADIUS) / MAX_THROW),
            max: Math.min(1, (target + CATCH_RADIUS) / MAX_THROW)
        };
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
        if (Math.abs(along - target) <= CATCH_RADIUS) {
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
        return "Click to throw";
    }

    function createGame() {
        return {
            state: "aiming",
            power: 0,
            powerDir: 1,
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
        game.power += game.powerDir * POWER_SPEED * dt;
        if (game.power >= 1) {
            game.power = 1;
            game.powerDir = -1;
        } else if (game.power <= 0) {
            game.power = 0;
            game.powerDir = 1;
        }
    }

    function startThrow(game) {
        if (game.state !== "aiming" || game.aimCooldown > 0) {
            return false;
        }
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
        game.receiver = copyPoint(RECEIVER_START);
        game.disc.x = game.thrower.x;
        game.disc.y = game.thrower.y;
        game.disc.height = 0;
        game.power = 0;
        game.powerDir = 1;
        game.lockedPower = null;
        game.landing = null;
        game.throwT = 0;
        game.result = null;
        game.resultT = 0;
        game.aimCooldown = AIM_COOLDOWN;
        game.cutSide = -(game.cutSide || 1);
        game.state = "aiming";
    }

    function restart(game) {
        var next = createGame();
        game.state = next.state;
        game.power = next.power;
        game.powerDir = next.powerDir;
        game.thrower = next.thrower;
        game.receiver = next.receiver;
        game.disc = next.disc;
        game.lockedPower = next.lockedPower;
        game.landing = next.landing;
        game.throwT = next.throwT;
        game.result = next.result;
        game.resultT = next.resultT;
        game.streak = 0;
        game.aimCooldown = AIM_COOLDOWN;
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
        POWER_SPEED: POWER_SPEED,
        THROW_DURATION: THROW_DURATION,
        RESULT_DURATION: RESULT_DURATION,
        AIM_COOLDOWN: AIM_COOLDOWN,
        CUT_SIDE_OFFSET: CUT_SIDE_OFFSET,
        CUT_DOWNFIELD_OFFSET: CUT_DOWNFIELD_OFFSET,
        createGame: createGame,
        update: update,
        startThrow: startThrow,
        goodPowerRange: goodPowerRange,
        landingForPower: landingForPower,
        judgeLanding: judgeLanding,
        statusText: statusText,
        throwDirection: throwDirection,
        continueFromCatch: continueFromCatch,
        restart: restart,
        cutStart: cutStart,
        receiverVisual: receiverVisual
    };
});
