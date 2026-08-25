/**
 * RiskEngine -- pure, DOM-free simulation engine for the Risk-Adjusted Scheduler.
 * Distributions, dependency graph (Kahn topo sort + CPM), and the Monte Carlo
 * loop live here so they stay independently testable from app.js.
 */
(function (global) {
    'use strict';

    // ---------- Samplers / distributions ----------

    function gaussian() {
        var u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // Marsaglia-Tsang for k >= 1; boosts k < 1 via gamma(k) = gamma(k+1) * U^(1/k).
    function gammaSample(k) {
        if (k < 1) {
            var u0 = Math.random();
            return gammaSample(1 + k) * Math.pow(u0, 1 / k);
        }
        var d = k - 1 / 3;
        var c = 1 / Math.sqrt(9 * d);
        for (;;) {
            var x, v;
            do {
                x = gaussian();
                v = 1 + c * x;
            } while (v <= 0);
            v = v * v * v;
            var u = Math.random();
            if (u < 1 - 0.0331 * x * x * x * x) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
    }

    function betaSample(a, b) {
        var ga = gammaSample(a);
        var gb = gammaSample(b);
        return ga / (ga + gb);
    }

    // PERT-Beta: a = 1 + 4(m-o)/(l-o), b = 1 + 4(l-m)/(l-o), scaled beta onto [o, l].
    function pertSample(o, m, l) {
        if (l <= o) return o;
        var a = Math.max(1 + 4 * (m - o) / (l - o), 1e-6);
        var b = Math.max(1 + 4 * (l - m) / (l - o), 1e-6);
        return o + betaSample(a, b) * (l - o);
    }

    // Inverse-CDF triangular sampling.
    function triSample(o, m, l) {
        if (l <= o) return o;
        var u = Math.random();
        var fc = (m - o) / (l - o);
        if (u < fc) return o + Math.sqrt(u * (l - o) * (m - o));
        return l - Math.sqrt((1 - u) * (l - o) * (l - m));
    }

    function pertMean(o, m, l) {
        return (o + 4 * m + l) / 6;
    }

    var SAMPLERS = { pert: pertSample, triangular: triSample };

    // ---------- Dependency graph ----------

    // Kahn's algorithm. Returns { order, cycle }. `cycle: true` means order is null.
    function topoOrder(tasks) {
        var ids = tasks.map(function (t) { return t.id; });
        var idSet = {};
        ids.forEach(function (id) { idSet[id] = true; });

        var inDegree = {}, successors = {};
        ids.forEach(function (id) { inDegree[id] = 0; successors[id] = []; });

        tasks.forEach(function (t) {
            (t.deps || []).forEach(function (depId) {
                if (!idSet[depId]) return; // dangling ref -- ignored, cleaned up on delete elsewhere
                successors[depId].push(t.id);
                inDegree[t.id]++;
            });
        });

        var queue = ids.filter(function (id) { return inDegree[id] === 0; });
        var order = [];
        while (queue.length) {
            var id = queue.shift();
            order.push(id);
            successors[id].forEach(function (sid) {
                inDegree[sid]--;
                if (inDegree[sid] === 0) queue.push(sid);
            });
        }

        if (order.length !== ids.length) return { order: null, cycle: true };
        return { order: order, cycle: false };
    }

    // Deterministic forward/backward CPM pass using PERT-expected (mean) durations.
    function criticalPath(tasksById, order) {
        var ES = {}, EF = {}, LS = {}, LF = {};
        var successors = {};
        order.forEach(function (id) { successors[id] = []; });
        order.forEach(function (id) {
            (tasksById[id].deps || []).forEach(function (d) {
                if (successors[d]) successors[d].push(id);
            });
        });

        order.forEach(function (id) {
            var t = tasksById[id];
            var es = 0;
            (t.deps || []).forEach(function (d) {
                if (EF[d] !== undefined) es = Math.max(es, EF[d]);
            });
            var dur = pertMean(t.dO, t.dM, t.dP);
            ES[id] = es;
            EF[id] = es + dur;
        });

        var baseFinish = 0;
        order.forEach(function (id) { baseFinish = Math.max(baseFinish, EF[id]); });

        for (var i = order.length - 1; i >= 0; i--) {
            var id = order[i];
            var succs = successors[id];
            var lf = baseFinish;
            if (succs.length) {
                lf = Math.min.apply(null, succs.map(function (s) { return LS[s]; }));
            }
            var dur = pertMean(tasksById[id].dO, tasksById[id].dM, tasksById[id].dP);
            LF[id] = lf;
            LS[id] = lf - dur;
        }

        var EPS = 1e-6;
        var criticalSet = {};
        order.forEach(function (id) {
            if (Math.abs(LS[id] - ES[id]) < EPS) criticalSet[id] = true;
        });

        return { baseFinish: baseFinish, ES: ES, EF: EF, LS: LS, LF: LF, criticalSet: criticalSet };
    }

    // ---------- Percentiles ----------

    function percentile(sorted, p) {
        var n = sorted.length;
        if (!n) return 0;
        var idx = (p / 100) * (n - 1);
        var lo = Math.floor(idx), hi = Math.ceil(idx);
        if (lo === hi) return sorted[lo];
        var frac = idx - lo;
        return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
    }

    // ---------- Validation ----------

    function validateProject(project) {
        var errors = [];
        var tasks = project.tasks || [];

        if (tasks.length === 0) {
            errors.push('Add at least one activity before running the simulation.');
        }

        tasks.forEach(function (t) {
            var label = (t.name && t.name.trim()) ? t.name.trim() : '(unnamed activity)';
            if (!t.name || !t.name.trim()) errors.push(label + ': name is required.');
            [t.dO, t.dM, t.dP, t.cO, t.cM, t.cP].forEach(function (v) {
                if (typeof v !== 'number' || isNaN(v) || v < 0) {
                    errors.push(label + ': all six estimates must be numbers >= 0.');
                }
            });
            if (!(t.dO <= t.dM && t.dM <= t.dP)) {
                errors.push(label + ': duration must satisfy Optimistic <= Most Likely <= Pessimistic.');
            }
            if (!(t.cO <= t.cM && t.cM <= t.cP)) {
                errors.push(label + ': cost must satisfy Optimistic <= Most Likely <= Pessimistic.');
            }
        });

        if (tasks.length > 0) {
            var topo = topoOrder(tasks);
            if (topo.cycle) errors.push('Dependencies contain a cycle.');
        }

        return { valid: errors.length === 0, errors: errors };
    }

    // ---------- Monte Carlo ----------

    // Chunked so the UI thread stays responsive; reports progress via options.onProgress(0..1).
    function runSimulation(project, options) {
        return new Promise(function (resolve, reject) {
            var tasks = project.tasks || [];
            var byId = {};
            tasks.forEach(function (t) { byId[t.id] = t; });

            var topo = topoOrder(tasks);
            if (topo.cycle) {
                reject(new Error('Dependencies contain a cycle.'));
                return;
            }
            var order = topo.order;
            var cp = criticalPath(byId, order);

            var iterations = options.iterations;
            var sampler = SAMPLERS[options.distribution] || pertSample;

            var finish = new Float64Array(iterations);
            var cost = new Float64Array(iterations);
            var taskES = {}, taskEF = {};
            order.forEach(function (id) {
                taskES[id] = new Float64Array(iterations);
                taskEF[id] = new Float64Array(iterations);
            });

            var baseCost = 0;
            tasks.forEach(function (t) { baseCost += pertMean(t.cO, t.cM, t.cP); });

            var CHUNK = 400;
            var i = 0;

            function step() {
                var end = Math.min(i + CHUNK, iterations);
                for (; i < end; i++) {
                    var EF = {};
                    var iterCost = 0;
                    for (var k = 0; k < order.length; k++) {
                        var id = order[k];
                        var t = byId[id];
                        var es = 0;
                        var deps = t.deps || [];
                        for (var d = 0; d < deps.length; d++) {
                            var depId = deps[d];
                            if (EF[depId] !== undefined) es = Math.max(es, EF[depId]);
                        }
                        var dur = Math.max(0, sampler(t.dO, t.dM, t.dP));
                        var ef = es + dur;
                        EF[id] = ef;
                        taskES[id][i] = es;
                        taskEF[id][i] = ef;
                        iterCost += Math.max(0, sampler(t.cO, t.cM, t.cP));
                    }
                    var projFinish = 0;
                    for (var k2 = 0; k2 < order.length; k2++) {
                        projFinish = Math.max(projFinish, EF[order[k2]]);
                    }
                    finish[i] = projFinish;
                    cost[i] = iterCost;
                }

                if (options.onProgress) options.onProgress(i / iterations);

                if (i < iterations) {
                    setTimeout(step, 0);
                } else {
                    finish.sort();
                    cost.sort();
                    order.forEach(function (id) { taskES[id].sort(); taskEF[id].sort(); });
                    resolve({
                        finish: finish,
                        cost: cost,
                        taskES: taskES,
                        taskEF: taskEF,
                        baseFinish: cp.baseFinish,
                        baseCost: baseCost,
                        criticalSet: cp.criticalSet,
                        order: order
                    });
                }
            }

            step();
        });
    }

    global.RiskEngine = {
        gaussian: gaussian,
        gammaSample: gammaSample,
        betaSample: betaSample,
        pertSample: pertSample,
        triSample: triSample,
        pertMean: pertMean,
        topoOrder: topoOrder,
        criticalPath: criticalPath,
        percentile: percentile,
        validateProject: validateProject,
        runSimulation: runSimulation
    };
})(window);
