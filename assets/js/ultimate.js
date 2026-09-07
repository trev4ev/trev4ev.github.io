(function () {
    var logic = window.UltimateLogic;
    var canvas = document.getElementById("ultimate-field");
    var statusEl = document.getElementById("ultimate-status");
    var streakEl = document.getElementById("ultimate-streak");
    var meterGood = document.getElementById("power-good");
    var meterDial = document.getElementById("power-dial");
    var root = document.getElementById("ultimate");

    if (!canvas || !logic) {
        return;
    }

    var ctx = canvas.getContext("2d");
    var game = logic.createGame();
    var lastTime = 0;
    var logicalWidth = 300;
    var logicalHeight = 420;

    function resize() {
        var ratio = window.devicePixelRatio || 1;
        var cssWidth = canvas.clientWidth || logicalWidth;
        canvas.style.height = (cssWidth * (logicalHeight / logicalWidth)) + "px";
        canvas.width = logicalWidth * ratio;
        canvas.height = logicalHeight * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function fieldToCanvas(point) {
        var paddingX = 28;
        var paddingTop = 24;
        var paddingBottom = 36;
        var playWidth = logicalWidth - paddingX * 2;
        var playHeight = logicalHeight - paddingTop - paddingBottom;
        return {
            x: paddingX + (point.x / logic.FIELD.width) * playWidth,
            y: paddingTop + (point.y / logic.FIELD.height) * playHeight
        };
    }

    function worldRadius(radius) {
        var playHeight = logicalHeight - 24 - 36;
        return (radius / logic.FIELD.height) * playHeight;
    }

    function updateMeter() {
        var range = logic.goodPowerRange(game);
        meterGood.style.left = range.min * 100 + "%";
        meterGood.style.width = (range.max - range.min) * 100 + "%";
        meterDial.style.left = game.power * 100 + "%";
        statusEl.textContent = logic.statusText(game);
        streakEl.textContent = game.streak ? "Streak: " + game.streak : "";
        root.dataset.state = game.state;
        root.dataset.result = game.result || "";
    }

    function draw() {
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        ctx.fillStyle = "#7aa35a";
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        var top = fieldToCanvas({ x: 0, y: 0 });
        var bottom = fieldToCanvas({ x: logic.FIELD.width, y: logic.FIELD.height });
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(top.x, top.y, bottom.x - top.x, bottom.y - top.y);

        var catchCenter = fieldToCanvas(game.receiver);
        ctx.beginPath();
        ctx.arc(catchCenter.x, catchCenter.y, worldRadius(logic.CATCH_RADIUS), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 237, 79, 0.35)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 237, 79, 0.9)";
        ctx.stroke();

        var thrower = fieldToCanvas(game.thrower);
        var receiver = fieldToCanvas(game.receiver);

        ctx.fillStyle = "#2c4a7c";
        ctx.beginPath();
        ctx.arc(thrower.x, thrower.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "10px Noto Sans, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("T", thrower.x, thrower.y);

        ctx.fillStyle = "#c45c26";
        ctx.beginPath();
        ctx.arc(receiver.x, receiver.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText("R", receiver.x, receiver.y);

        var disc = fieldToCanvas(game.disc);
        var discScale = 1 + game.disc.height * 0.45;
        ctx.fillStyle = "#f4f4f4";
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(disc.x, disc.y, 8 * discScale, 4 * discScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    function frame(now) {
        if (!lastTime) {
            lastTime = now;
        }
        var dt = (now - lastTime) / 1000;
        lastTime = now;
        if (dt > 0.05) {
            dt = 0.05;
        }
        logic.update(game, dt);
        updateMeter();
        draw();
        requestAnimationFrame(frame);
    }

    function tryThrow(event) {
        if (event.target.closest && event.target.closest("a")) {
            return;
        }
        event.preventDefault();
        logic.startThrow(game);
    }

    resize();
    updateMeter();
    draw();
    root.addEventListener("pointerdown", tryThrow);
    window.addEventListener("resize", resize);
    requestAnimationFrame(frame);
})();
