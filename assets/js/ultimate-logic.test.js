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
assert.strictEqual(caughtGame.thrower.x, logic.THROWER_START.x);
assert.strictEqual(caughtGame.thrower.y, logic.THROWER_START.y);
assert.strictEqual(caughtGame.receiver.x, logic.RECEIVER_START.x);
assert.strictEqual(caughtGame.receiver.y, logic.RECEIVER_START.y);
assert.strictEqual(caughtGame.disc.y, caughtGame.thrower.y);

step(shortGame, logic.RESULT_DURATION + 0.001);
assert.strictEqual(shortGame.state, "aiming");
assert.strictEqual(shortGame.thrower.y, logic.THROWER_START.y);
assert.strictEqual(shortGame.receiver.y, logic.RECEIVER_START.y);
assert.ok(Math.abs(shortGame.power - 0.15) < 0.08);

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

var nextThrow = throwWithPower(perfect);
step(nextThrow, logic.RESULT_DURATION + logic.AIM_COOLDOWN + 0.02);
assert.strictEqual(nextThrow.thrower.y, logic.THROWER_START.y);
assert.strictEqual(nextThrow.receiver.y, logic.RECEIVER_START.y);
nextThrow.power = (logic.goodPowerRange(nextThrow).min + logic.goodPowerRange(nextThrow).max) / 2;
assert.strictEqual(logic.startThrow(nextThrow), true);
step(nextThrow, logic.THROW_DURATION + 0.001);
assert.strictEqual(nextThrow.result, "caught");
assert.strictEqual(nextThrow.streak, 2);

step(nextThrow, logic.RESULT_DURATION + logic.AIM_COOLDOWN + 0.02);
assert.strictEqual(nextThrow.state, "aiming");
assert.strictEqual(nextThrow.thrower.y, logic.THROWER_START.y);
assert.strictEqual(nextThrow.receiver.y, logic.RECEIVER_START.y);

var afterCatchShort = throwWithPower(perfect);
step(afterCatchShort, logic.RESULT_DURATION + logic.AIM_COOLDOWN + 0.02);
afterCatchShort.power = 0.1;
assert.strictEqual(logic.startThrow(afterCatchShort), true);
step(afterCatchShort, logic.THROW_DURATION + 0.001);
assert.strictEqual(afterCatchShort.result, "short");

var cutGame = logic.createGame();
var startCut = logic.cutStart(cutGame);
assert.ok(startCut.x > cutGame.receiver.x);
assert.ok(startCut.y < cutGame.receiver.y);
var idlePos = logic.receiverVisual(cutGame);
assert.strictEqual(idlePos.x, startCut.x);
assert.strictEqual(idlePos.y, startCut.y);
cutGame.state = "throwing";
cutGame.throwT = 1;
var arrived = logic.receiverVisual(cutGame);
assert.strictEqual(arrived.x, cutGame.receiver.x);
assert.strictEqual(arrived.y, cutGame.receiver.y);

console.log("ultimate-logic tests passed");
