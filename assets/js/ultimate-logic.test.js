var assert = require("assert");
var logic = require("./ultimate-logic.js");

function step(game, seconds) {
    var remaining = seconds;
    var dt = 1 / 60;
    while (remaining > 0) {
        logic.update(game, Math.min(dt, remaining));
        remaining -= dt;
    }
}

function throwWithPower(power) {
    var game = logic.createGame();
    game.power = power;
    assert.strictEqual(logic.startThrow(game), true);
    step(game, logic.THROW_DURATION + 0.001);
    return game;
}

var shortGame = throwWithPower(0.15);
assert.strictEqual(shortGame.result, "short");
assert.strictEqual(shortGame.state, "result");
assert.strictEqual(shortGame.streak, 0);

var longGame = throwWithPower(0.95);
assert.strictEqual(longGame.result, "long");
assert.strictEqual(longGame.streak, 0);

var range = logic.goodPowerRange(logic.createGame());
var perfect = (range.min + range.max) / 2;
var caughtGame = throwWithPower(perfect);
assert.strictEqual(caughtGame.result, "caught");
assert.strictEqual(caughtGame.streak, 1);
assert.strictEqual(caughtGame.disc.x, caughtGame.receiver.x);
assert.strictEqual(caughtGame.disc.y, caughtGame.receiver.y);

step(caughtGame, logic.RESULT_DURATION + 0.001);
assert.strictEqual(caughtGame.state, "aiming");
assert.strictEqual(caughtGame.thrower.x, logic.RECEIVER_START.x);
assert.strictEqual(caughtGame.thrower.y, logic.RECEIVER_START.y);
assert.strictEqual(caughtGame.receiver.x, logic.THROWER_START.x);
assert.strictEqual(caughtGame.receiver.y, logic.THROWER_START.y);
assert.strictEqual(caughtGame.disc.y, caughtGame.thrower.y);

step(shortGame, logic.RESULT_DURATION + 0.001);
assert.strictEqual(shortGame.state, "aiming");
assert.strictEqual(shortGame.thrower.y, logic.THROWER_START.y);
assert.strictEqual(shortGame.receiver.y, logic.RECEIVER_START.y);
assert.ok(shortGame.power < 0.05);

var aiming = logic.createGame();
logic.update(aiming, 0.1);
assert.ok(aiming.power > 0);
assert.ok(aiming.power < 1);

var bounce = logic.createGame();
bounce.power = 0.99;
bounce.powerDir = 1;
logic.update(bounce, 0.1);
assert.strictEqual(bounce.powerDir, -1);

assert.strictEqual(logic.startThrow(throwWithPower(0.2)), false);

var cooling = logic.createGame();
cooling.aimCooldown = logic.AIM_COOLDOWN;
cooling.power = 0.5;
assert.strictEqual(logic.startThrow(cooling), false);
step(cooling, logic.AIM_COOLDOWN + 0.01);
cooling.power = 0.5;
assert.strictEqual(logic.startThrow(cooling), true);

var edges = logic.createGame();
assert.strictEqual(logic.judgeLanding(edges, logic.landingForPower(edges, range.min)), "caught");
assert.strictEqual(logic.judgeLanding(edges, logic.landingForPower(edges, range.max)), "caught");
assert.strictEqual(logic.judgeLanding(edges, logic.landingForPower(edges, Math.max(0, range.min - 0.05))), "short");
assert.strictEqual(logic.judgeLanding(edges, logic.landingForPower(edges, Math.min(1, range.max + 0.05))), "long");

var reverse = throwWithPower(perfect);
step(reverse, logic.RESULT_DURATION + logic.AIM_COOLDOWN + 0.02);
assert.strictEqual(reverse.thrower.y, logic.RECEIVER_START.y);
reverse.power = (logic.goodPowerRange(reverse).min + logic.goodPowerRange(reverse).max) / 2;
assert.strictEqual(logic.startThrow(reverse), true);
step(reverse, logic.THROW_DURATION + 0.001);
assert.strictEqual(reverse.result, "caught");

var reverseShort = throwWithPower(perfect);
step(reverseShort, logic.RESULT_DURATION + logic.AIM_COOLDOWN + 0.02);
reverseShort.power = 0.1;
assert.strictEqual(logic.startThrow(reverseShort), true);
step(reverseShort, logic.THROW_DURATION + 0.001);
assert.strictEqual(reverseShort.result, "short");

console.log("ultimate-logic tests passed");
