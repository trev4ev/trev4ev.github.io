(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.UltimateScores = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    var SUPABASE_URL = "https://uflotzowsomdshuhvgzy.supabase.co";
    var SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbG90em93c29tZHNodWh2Z3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTE1NTgsImV4cCI6MjEwMzE2NzU1OH0.FoUHHi9B5C0OKkU5R3DW7-138VItQCFwywsbXiGJtPE";
    var NAME_KEY = "ultimatePlayerName";
    var MAX_NAME_LEN = 12;

    var client = null;
    var runId = null;
    var runPromise = null;

    function getClient() {
        if (client) {
            return client;
        }
        var supabaseGlobal =
            (typeof globalThis !== "undefined" && globalThis.supabase) ||
            (typeof self !== "undefined" && self.supabase) ||
            (typeof window !== "undefined" && window.supabase) ||
            null;
        if (!supabaseGlobal || typeof supabaseGlobal.createClient !== "function") {
            return null;
        }
        client = supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return client;
    }

    function getStoredName() {
        try {
            var value = window.localStorage.getItem(NAME_KEY);
            return value ? String(value).trim() : "";
        } catch (err) {
            return "";
        }
    }

    function setStoredName(name) {
        var cleaned = String(name || "").trim().replace(/\s+/g, " ");
        if (!cleaned) {
            return "";
        }
        try {
            window.localStorage.setItem(NAME_KEY, cleaned);
        } catch (err) {
            // Ignore quota / private-mode failures.
        }
        return cleaned;
    }

    function mapTopRows(rows) {
        return (rows || []).map(function (row, index) {
            return {
                rank: index + 1,
                id: row.id,
                playerName: row.player_name,
                score: row.score,
                isPlayer: false
            };
        });
    }

    function fetchTopScores() {
        var sb = getClient();
        if (!sb) {
            return Promise.resolve([]);
        }
        return sb
            .from("ultimate_scores")
            .select("id, player_name, score, created_at")
            .order("score", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(3)
            .then(function (result) {
                if (result.error) {
                    console.warn("ultimate scores fetch failed", result.error);
                    return [];
                }
                return mapTopRows(result.data);
            })
            .catch(function (err) {
                console.warn("ultimate scores fetch failed", err);
                return [];
            });
    }

    function startRun() {
        var sb = getClient();
        if (!sb) {
            return Promise.resolve(null);
        }
        if (runPromise) {
            return runPromise;
        }
        runPromise = sb.functions
            .invoke("ultimate-start-run", { body: {} })
            .then(function (result) {
                runPromise = null;
                if (result.error) {
                    console.warn("ultimate start-run failed", result.error);
                    runId = null;
                    return null;
                }
                runId = result.data && result.data.runId ? result.data.runId : null;
                return runId;
            })
            .catch(function (err) {
                runPromise = null;
                console.warn("ultimate start-run failed", err);
                runId = null;
                return null;
            });
        return runPromise;
    }

    function ensureRun() {
        if (runId) {
            return Promise.resolve(runId);
        }
        return startRun();
    }

    function clearRun() {
        runId = null;
        runPromise = null;
    }

    function submitScore(score, playerName) {
        var sb = getClient();
        var name = setStoredName(playerName);
        if (!sb) {
            return Promise.reject(new Error("Scores unavailable"));
        }
        if (!Number.isInteger(score) || score < 1) {
            return Promise.reject(new Error("Invalid score"));
        }
        if (!name) {
            return Promise.reject(new Error("Name required"));
        }

        return ensureRun().then(function (id) {
            if (!id) {
                throw new Error("Could not start score run");
            }
            return sb.functions.invoke("ultimate-submit-score", {
                body: {
                    runId: id,
                    score: score,
                    playerName: name
                }
            });
        }).then(function (result) {
            clearRun();
            if (result.error) {
                var message = result.error.message || "Submit failed";
                if (result.data && result.data.error) {
                    message = result.data.error;
                }
                throw new Error(message);
            }
            if (result.data && result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        });
    }

    return {
        MAX_NAME_LEN: MAX_NAME_LEN,
        NAME_KEY: NAME_KEY,
        getStoredName: getStoredName,
        setStoredName: setStoredName,
        fetchTopScores: fetchTopScores,
        ensureRun: ensureRun,
        clearRun: clearRun,
        submitScore: submitScore
    };
});
