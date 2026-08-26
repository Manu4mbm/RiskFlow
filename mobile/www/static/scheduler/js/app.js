(function () {
    'use strict';

    // ---------- Constants ----------

    var LEGACY_STORAGE_KEY = 'riskflow_project'; // pre-multi-project single-project store; migrated on first load
    var PROJECTS_KEY = 'riskflow_projects';
    var ACTIVE_PROJECT_KEY = 'riskflow_active_project_id';
    var THEME_KEY = 'riskflow_theme';
    var LABEL_W = 96;
    var MIN_PX_PER_DAY = 12;

    var CONFIDENCE_LEVELS = { p50: 50, p80: 80, p90: 90 };

    function emptyProject() {
        return {
            id: newId(),
            version: 1,
            name: 'Untitled Project',
            currency: 'INR',
            iterations: 5000,
            distribution: 'pert',
            ganttConfidence: 'p80',
            tasks: []
        };
    }

    function newId() {
        return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    // ---------- Formatting ----------

    function formatDays(v) {
        if (v === null || v === undefined || isNaN(v)) return '—';
        return (Math.round(v * 10) / 10).toFixed(1) + 'd';
    }

    function currencySymbol(code) {
        var map = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
        code = (code || 'INR').toUpperCase();
        return map[code] || (code + ' ');
    }

    function formatCurrency(v, code) {
        if (v === null || v === undefined || isNaN(v)) return '—';
        code = (code || 'INR').toUpperCase();
        var symbol = currencySymbol(code);
        var abs = Math.abs(v);
        if (code === 'INR') {
            if (abs >= 1e7) return symbol + (v / 1e7).toFixed(2) + 'Cr';
            if (abs >= 1e5) return symbol + (v / 1e5).toFixed(2) + 'L';
            return symbol + Math.round(v).toLocaleString('en-IN');
        }
        if (abs >= 1e6) return symbol + (v / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return symbol + (v / 1e3).toFixed(1) + 'k';
        return symbol + Math.round(v).toLocaleString('en-US');
    }

    function formatCompact(v) {
        var abs = Math.abs(v);
        if (abs >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
        if (abs >= 1e5) return (v / 1e5).toFixed(1) + 'L';
        if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'k';
        return String(Math.round(v));
    }

    // ---------- DOM cache ----------

    var el = {
        projectNameLabel: document.getElementById('project-name-label'),
        projectNameSub: document.getElementById('project-name-sub'),
        btnTheme: document.getElementById('btn-theme'),

        tabButtons: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view'),

        activityList: document.getElementById('activity-list'),
        activitiesEmpty: document.getElementById('activities-empty'),
        btnAddActivity: document.getElementById('btn-add-activity'),
        btnEmptyAdd: document.getElementById('btn-empty-add'),
        btnEmptySample: document.getElementById('btn-empty-sample'),
        miniGanttPane: document.getElementById('mini-gantt-pane'),
        miniGanttCanvas: document.getElementById('mini-gantt-canvas'),
        miniGanttScroll: document.getElementById('mini-gantt-scroll'),

        iterationsSelect: document.getElementById('iterations-select'),
        distributionSelect: document.getElementById('distribution-select'),
        confidenceSelect: document.getElementById('confidence-select'),
        currencyInput: document.getElementById('currency-input'),
        btnRun: document.getElementById('btn-run'),
        runProgressFill: document.getElementById('run-progress-fill'),
        runButtonLabel: document.getElementById('run-button-label'),
        runStatus: document.getElementById('run-status'),

        kpiSchedDet: document.getElementById('kpi-sched-det'),
        kpiSchedP50: document.getElementById('kpi-sched-p50'),
        kpiSchedP80: document.getElementById('kpi-sched-p80'),
        kpiSchedP90: document.getElementById('kpi-sched-p90'),
        contingencySchedule: document.getElementById('contingency-schedule'),

        kpiCostDet: document.getElementById('kpi-cost-det'),
        kpiCostP50: document.getElementById('kpi-cost-p50'),
        kpiCostP80: document.getElementById('kpi-cost-p80'),
        kpiCostP90: document.getElementById('kpi-cost-p90'),
        contingencyCost: document.getElementById('contingency-cost'),

        ganttConfidenceToggle: document.getElementById('gantt-confidence-toggle'),
        ganttScroll: document.getElementById('gantt-scroll'),
        ganttCanvas: document.getElementById('gantt-canvas'),
        ganttEmpty: document.getElementById('gantt-empty'),

        scurveMetricToggle: document.getElementById('scurve-metric-toggle'),
        scurveScroll: document.getElementById('scurve-scroll'),
        scurveCanvas: document.getElementById('scurve-canvas'),
        scurveEmpty: document.getElementById('scurve-empty'),

        btnRenameProject: document.getElementById('btn-rename-project'),
        projectCountSub: document.getElementById('project-count-sub'),
        btnManageProjects: document.getElementById('btn-manage-projects'),
        btnLoadSample: document.getElementById('btn-load-sample'),
        btnExport: document.getElementById('btn-export'),
        btnImport: document.getElementById('btn-import'),
        importFile: document.getElementById('import-file'),
        btnClear: document.getElementById('btn-clear'),

        projectSheetBackdrop: document.getElementById('project-sheet-backdrop'),
        btnCloseProjectSheet: document.getElementById('btn-close-project-sheet'),
        btnNewProject: document.getElementById('btn-new-project'),
        projectPickerList: document.getElementById('project-picker-list'),

        btnExportExcel: document.getElementById('btn-export-excel'),
        exportProgressFill: document.getElementById('export-progress-fill'),
        exportButtonLabel: document.getElementById('export-button-label'),
        exportStatus: document.getElementById('export-status'),

        sheetBackdrop: document.getElementById('activity-sheet-backdrop'),
        sheetTitle: document.getElementById('activity-sheet-title'),
        btnCloseSheet: document.getElementById('btn-close-sheet'),
        formErrors: document.getElementById('activity-form-errors'),
        fieldName: document.getElementById('field-name'),
        fieldDO: document.getElementById('field-dO'),
        fieldDM: document.getElementById('field-dM'),
        fieldDP: document.getElementById('field-dP'),
        fieldCO: document.getElementById('field-cO'),
        fieldCM: document.getElementById('field-cM'),
        fieldCP: document.getElementById('field-cP'),
        fieldDeps: document.getElementById('field-deps'),
        fieldDepsEmpty: document.getElementById('field-deps-empty'),
        btnSaveActivity: document.getElementById('btn-save-activity'),
        btnDeleteActivity: document.getElementById('btn-delete-activity'),

        toast: document.getElementById('toast')
    };

    // ---------- State ----------

    var state = {
        projects: loadProjects(),
        activeProjectId: null,
        project: null,
        result: null,
        activeTab: 'activities',
        editingId: null,
        editingDeps: [],
        scurveMetric: 'schedule'
    };
    setActiveProject(loadActiveProjectId(state.projects));
    saveProject(); // commits a first-run migration from the legacy single-project store, if any

    function loadProjects() {
        try {
            var raw = localStorage.getItem(PROJECTS_KEY);
            if (raw) {
                var arr = JSON.parse(raw);
                if (Array.isArray(arr) && arr.length) {
                    return arr.map(function (p) { return Object.assign(emptyProject(), p); });
                }
            }
        } catch (e) { /* fall through to migration / default below */ }

        // Migrate the pre-multi-project single-project store, if present.
        try {
            var legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy) {
                var parsed = JSON.parse(legacy);
                if (parsed && Array.isArray(parsed.tasks)) {
                    return [Object.assign(emptyProject(), parsed, { id: newId() })];
                }
            }
        } catch (e) { /* fall through to default below */ }

        return [emptyProject()];
    }

    function loadActiveProjectId(projects) {
        var saved = localStorage.getItem(ACTIVE_PROJECT_KEY);
        if (saved && projects.some(function (p) { return p.id === saved; })) return saved;
        return projects[0].id;
    }

    function setActiveProject(id) {
        state.activeProjectId = id;
        state.project = state.projects.find(function (p) { return p.id === id; });
        state.result = null;
    }

    function saveProject() {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(state.projects));
        localStorage.setItem(ACTIVE_PROJECT_KEY, state.activeProjectId);
    }

    // ---------- Toast ----------

    var toastTimer = null;
    function showToast(msg) {
        el.toast.textContent = msg;
        el.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
    }

    // ---------- Theme ----------

    function applyTheme() {
        var theme = localStorage.getItem(THEME_KEY) || 'system';
        if (theme === 'system') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', theme);
    }

    el.btnTheme.addEventListener('click', function () {
        var theme = localStorage.getItem(THEME_KEY) || 'system';
        var next = theme === 'system' ? 'light' : (theme === 'light' ? 'dark' : 'system');
        localStorage.setItem(THEME_KEY, next);
        applyTheme();
        showToast('Theme: ' + next);
    });

    applyTheme();

    // ---------- Tabs ----------

    function switchTab(tab) {
        state.activeTab = tab;
        el.tabButtons.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });
        el.views.forEach(function (view) {
            view.classList.toggle('active', view.getAttribute('data-view') === tab);
        });
        if (tab === 'gantt') renderGantt();
        if (tab === 'scurve') renderSCurve();
    }

    el.tabButtons.forEach(function (btn) {
        btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
    });

    // ---------- Segmented control helper ----------

    function wireSegmented(container, onChange) {
        container.querySelectorAll('button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                container.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                onChange(btn.getAttribute('data-value'));
            });
        });
    }

    function setSegmentedValue(container, value) {
        container.querySelectorAll('button').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-value') === value);
        });
    }

    wireSegmented(el.iterationsSelect, function (v) {
        state.project.iterations = parseInt(v, 10);
        saveProject();
    });

    wireSegmented(el.distributionSelect, function (v) {
        state.project.distribution = v;
        saveProject();
    });

    wireSegmented(el.confidenceSelect, function (v) {
        state.project.ganttConfidence = v;
        saveProject();
        setSegmentedValue(el.ganttConfidenceToggle, v);
        if (state.activeTab === 'gantt') renderGantt();
    });

    wireSegmented(el.ganttConfidenceToggle, function (v) {
        state.project.ganttConfidence = v;
        saveProject();
        setSegmentedValue(el.confidenceSelect, v);
        renderGantt();
    });

    wireSegmented(el.scurveMetricToggle, function (v) {
        state.scurveMetric = v;
        renderSCurve();
    });

    el.currencyInput.addEventListener('change', function () {
        state.project.currency = (el.currencyInput.value || 'INR').trim() || 'INR';
        saveProject();
        renderResults();
    });

    // ---------- Static critical path (before any simulation run) ----------

    function computeStaticCriticalSet(tasks) {
        if (!tasks.length) return {};
        var topo = RiskEngine.topoOrder(tasks);
        if (topo.cycle) return {};
        var byId = {};
        tasks.forEach(function (t) { byId[t.id] = t; });
        return RiskEngine.criticalPath(byId, topo.order).criticalSet;
    }

    // ---------- Activities ----------

    function renderActivities() {
        var tasks = state.project.tasks;
        el.activitiesEmpty.classList.toggle('hidden', tasks.length > 0);
        el.activityList.classList.toggle('hidden', tasks.length === 0);
        el.activityList.innerHTML = '';

        var idLabel = {};
        tasks.forEach(function (t, i) { idLabel[t.id] = 'A' + (i + 1); });
        var criticalSet = computeStaticCriticalSet(tasks);

        tasks.forEach(function (t) {
            var row = document.createElement('div');
            row.className = 'activity-row' + (criticalSet[t.id] ? ' is-critical' : '');
            row.addEventListener('click', function () { openActivitySheet(t.id); });

            var crit = document.createElement('span');
            crit.className = 'act-crit';

            var main = document.createElement('div');
            main.className = 'act-main';
            var name = document.createElement('div');
            name.className = 'act-name';
            name.textContent = t.name || '(unnamed)';
            var deps = document.createElement('div');
            deps.className = 'act-deps';
            if (t.deps && t.deps.length) {
                t.deps.forEach(function (depId) {
                    var chip = document.createElement('span');
                    chip.className = 'dep-chip';
                    chip.textContent = idLabel[depId] || '?';
                    deps.appendChild(chip);
                });
            } else {
                deps.textContent = 'No dependencies';
            }
            main.appendChild(name);
            main.appendChild(deps);

            var durFig = document.createElement('div');
            durFig.className = 'act-figures';
            var durLabel = document.createElement('span');
            durLabel.className = 'act-figures-label';
            durLabel.textContent = t.dO + '–' + t.dP;
            var durValue = document.createElement('span');
            durValue.className = 'act-figures-value';
            durValue.textContent = t.dM + 'd';
            durFig.appendChild(durLabel);
            durFig.appendChild(durValue);

            var costFig = document.createElement('div');
            costFig.className = 'act-figures';
            var costLabel = document.createElement('span');
            costLabel.className = 'act-figures-label';
            costLabel.textContent = formatCompact(t.cO) + '–' + formatCompact(t.cP);
            var costValue = document.createElement('span');
            costValue.className = 'act-figures-value';
            costValue.textContent = formatCompact(t.cM);
            costFig.appendChild(costLabel);
            costFig.appendChild(costValue);

            var chevron = document.createElement('span');
            chevron.className = 'act-chevron';
            chevron.textContent = '›';

            row.appendChild(crit);
            row.appendChild(main);
            row.appendChild(durFig);
            row.appendChild(costFig);
            row.appendChild(chevron);
            el.activityList.appendChild(row);
        });
    }

    function openActivitySheet(id) {
        state.editingId = id;
        var task = id ? state.project.tasks.find(function (t) { return t.id === id; }) : null;
        state.editingDeps = task ? task.deps.slice() : [];

        el.sheetTitle.textContent = task ? 'Edit Activity' : 'Add Activity';
        el.formErrors.classList.add('hidden');
        el.formErrors.innerHTML = '';

        el.fieldName.value = task ? task.name : '';
        el.fieldDO.value = task ? task.dO : '';
        el.fieldDM.value = task ? task.dM : '';
        el.fieldDP.value = task ? task.dP : '';
        el.fieldCO.value = task ? task.cO : '';
        el.fieldCM.value = task ? task.cM : '';
        el.fieldCP.value = task ? task.cP : '';

        el.btnDeleteActivity.classList.toggle('hidden', !task);

        renderDepChips();

        el.sheetBackdrop.classList.add('open');
    }

    function renderDepChips() {
        var others = state.project.tasks.filter(function (t) { return t.id !== state.editingId; });
        el.fieldDeps.innerHTML = '';
        el.fieldDepsEmpty.classList.toggle('hidden', others.length > 0);
        others.forEach(function (t, i) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chip' + (state.editingDeps.indexOf(t.id) !== -1 ? ' selected' : '');
            chip.textContent = t.name || ('Activity ' + (i + 1));
            chip.addEventListener('click', function () {
                var pos = state.editingDeps.indexOf(t.id);
                if (pos === -1) state.editingDeps.push(t.id);
                else state.editingDeps.splice(pos, 1);
                chip.classList.toggle('selected');
            });
            el.fieldDeps.appendChild(chip);
        });
    }

    function closeSheet() {
        el.sheetBackdrop.classList.remove('open');
        state.editingId = null;
        state.editingDeps = [];
    }

    function invalidateResults() {
        state.result = null;
        renderResultsEmpty();
    }

    function saveActivityFromForm() {
        var task = {
            id: state.editingId || newId(),
            name: el.fieldName.value,
            deps: state.editingDeps.slice(),
            dO: parseFloat(el.fieldDO.value),
            dM: parseFloat(el.fieldDM.value),
            dP: parseFloat(el.fieldDP.value),
            cO: parseFloat(el.fieldCO.value),
            cM: parseFloat(el.fieldCM.value),
            cP: parseFloat(el.fieldCP.value)
        };

        var draftTasks = state.project.tasks.filter(function (t) { return t.id !== task.id; }).concat([task]);
        var check = RiskEngine.validateProject({ tasks: draftTasks });
        if (!check.valid) {
            el.formErrors.classList.remove('hidden');
            el.formErrors.innerHTML = '<strong>Fix the following:</strong><ul>' +
                check.errors.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') +
                '</ul>';
            return;
        }

        var idx = state.project.tasks.findIndex(function (t) { return t.id === task.id; });
        if (idx === -1) state.project.tasks.push(task);
        else state.project.tasks[idx] = task;

        saveProject();
        invalidateResults();
        renderActivities();
        closeSheet();
        showToast('Activity saved');
    }

    function deleteActivity() {
        if (!state.editingId) return;
        if (!window.confirm('Delete this activity?')) return;
        var id = state.editingId;
        state.project.tasks = state.project.tasks.filter(function (t) { return t.id !== id; });
        state.project.tasks.forEach(function (t) {
            t.deps = t.deps.filter(function (depId) { return depId !== id; });
        });
        saveProject();
        invalidateResults();
        renderActivities();
        closeSheet();
        showToast('Activity deleted');
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    el.btnAddActivity.addEventListener('click', function () { openActivitySheet(null); });
    el.btnEmptyAdd.addEventListener('click', function () { openActivitySheet(null); });
    el.btnCloseSheet.addEventListener('click', closeSheet);
    el.btnSaveActivity.addEventListener('click', saveActivityFromForm);
    el.btnDeleteActivity.addEventListener('click', deleteActivity);
    el.sheetBackdrop.addEventListener('click', function (e) {
        if (e.target === el.sheetBackdrop) closeSheet();
    });

    el.btnEmptySample.addEventListener('click', function () { loadSample(); });

    // ---------- Run ----------

    function renderResultsEmpty() {
        [el.kpiSchedDet, el.kpiSchedP50, el.kpiSchedP80, el.kpiSchedP90,
         el.kpiCostDet, el.kpiCostP50, el.kpiCostP80, el.kpiCostP90].forEach(function (n) { n.textContent = '—'; });
        el.contingencySchedule.textContent = '—';
        el.contingencyCost.textContent = '—';
        el.ganttEmpty.classList.remove('hidden');
        el.ganttCanvas.classList.add('hidden');
        el.scurveEmpty.classList.remove('hidden');
        el.scurveCanvas.classList.add('hidden');
    }

    function renderResults() {
        var result = state.result;
        if (!result) { renderResultsEmpty(); return; }
        var currency = state.project.currency;

        var schedP50 = RiskEngine.percentile(result.finish, 50);
        var schedP80 = RiskEngine.percentile(result.finish, 80);
        var schedP90 = RiskEngine.percentile(result.finish, 90);
        var costP50 = RiskEngine.percentile(result.cost, 50);
        var costP80 = RiskEngine.percentile(result.cost, 80);
        var costP90 = RiskEngine.percentile(result.cost, 90);

        el.kpiSchedDet.textContent = formatDays(result.baseFinish);
        el.kpiSchedP50.textContent = formatDays(schedP50);
        el.kpiSchedP80.textContent = formatDays(schedP80);
        el.kpiSchedP90.textContent = formatDays(schedP90);

        var schedContingency = schedP80 - result.baseFinish;
        var schedPct = result.baseFinish > 0 ? (schedContingency / result.baseFinish * 100) : 0;
        el.contingencySchedule.textContent = formatDays(schedContingency) + ' (+' + schedPct.toFixed(0) + '%)';

        el.kpiCostDet.textContent = formatCurrency(result.baseCost, currency);
        el.kpiCostP50.textContent = formatCurrency(costP50, currency);
        el.kpiCostP80.textContent = formatCurrency(costP80, currency);
        el.kpiCostP90.textContent = formatCurrency(costP90, currency);

        var costContingency = costP80 - result.baseCost;
        var costPct = result.baseCost > 0 ? (costContingency / result.baseCost * 100) : 0;
        el.contingencyCost.textContent = formatCurrency(costContingency, currency) + ' (+' + costPct.toFixed(0) + '%)';

        renderGantt();
        renderSCurve();
    }

    function runSimulationNow() {
        var check = RiskEngine.validateProject(state.project);
        if (!check.valid) {
            el.runStatus.classList.remove('hidden');
            el.runStatus.innerHTML = check.errors.map(escapeHtml).join('<br>');
            el.runStatus.style.color = 'var(--danger)';
            return;
        }

        el.runStatus.classList.add('hidden');
        el.btnRun.disabled = true;
        el.runProgressFill.style.width = '0%';
        el.runButtonLabel.textContent = 'Running… 0%';

        RiskEngine.runSimulation(state.project, {
            iterations: state.project.iterations,
            distribution: state.project.distribution,
            onProgress: function (frac) {
                var pct = Math.round(frac * 100);
                el.runProgressFill.style.width = pct + '%';
                el.runButtonLabel.textContent = 'Running… ' + pct + '%';
            }
        }).then(function (result) {
            state.result = result;
            el.btnRun.disabled = false;
            el.runProgressFill.style.width = '0%';
            el.runButtonLabel.textContent = 'Run Simulation';
            renderResults();
            renderActivities();
            showToast('Simulation complete — ' + state.project.iterations.toLocaleString('en-IN') + ' iterations');
        }).catch(function (err) {
            el.btnRun.disabled = false;
            el.runProgressFill.style.width = '0%';
            el.runButtonLabel.textContent = 'Run Simulation';
            el.runStatus.classList.remove('hidden');
            el.runStatus.style.color = 'var(--danger)';
            el.runStatus.textContent = err.message || 'Simulation failed.';
        });
    }

    el.btnRun.addEventListener('click', runSimulationNow);

    // ---------- Gantt (shared renderer, used by main view + landscape mini pane) ----------

    function drawGanttChart(canvas, scrollContainer) {
        var result = state.result;
        var tasks = state.project.tasks;
        var containerWidth = scrollContainer.clientWidth;
        var containerHeight = scrollContainer.clientHeight;
        if (!result || tasks.length === 0 || containerWidth === 0) return false;

        var order = result.order;
        var byId = {};
        tasks.forEach(function (t) { byId[t.id] = t; });
        var idLabel = {};
        tasks.forEach(function (t, i) { idLabel[t.id] = 'A' + (i + 1); });

        var p = CONFIDENCE_LEVELS[state.project.ganttConfidence] || 80;
        var projFinishP = RiskEngine.percentile(result.finish, p);
        var totalDays = Math.max(result.baseFinish, projFinishP) * 1.08 + 1;

        var rowH = 30;
        var headerH = 26;
        var pxPerDay = Math.max((containerWidth - LABEL_W) / totalDays, MIN_PX_PER_DAY);
        var chartWidth = Math.max(containerWidth, LABEL_W + pxPerDay * totalDays);
        var chartHeight = Math.max(containerHeight, headerH + order.length * rowH + 8);

        var dpr = window.devicePixelRatio || 1;
        canvas.width = chartWidth * dpr;
        canvas.height = chartHeight * dpr;
        canvas.style.width = chartWidth + 'px';
        canvas.style.height = chartHeight + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var css = getComputedStyle(document.documentElement);
        var inkColor = css.getPropertyValue('--ink').trim();
        var inkSoft = css.getPropertyValue('--ink-soft').trim();
        var hairline = css.getPropertyValue('--hairline').trim();
        var blue = css.getPropertyValue('--blue').trim();
        var amber = css.getPropertyValue('--amber').trim();
        var teal = css.getPropertyValue('--teal').trim();
        var surface = css.getPropertyValue('--surface').trim();

        ctx.clearRect(0, 0, chartWidth, chartHeight);
        ctx.fillStyle = surface;
        ctx.fillRect(0, 0, chartWidth, chartHeight);

        function dayX(d) { return LABEL_W + d * pxPerDay; }

        // day gridlines
        var step = Math.max(1, Math.round(totalDays / 10));
        ctx.font = '9px ' + getComputedStyle(document.body).fontFamily;
        for (var d = 0; d <= totalDays; d += step) {
            var x = dayX(d);
            ctx.strokeStyle = hairline;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, headerH);
            ctx.lineTo(x, chartHeight);
            ctx.stroke();
            ctx.fillStyle = inkSoft;
            ctx.textAlign = 'center';
            ctx.fillText(String(Math.round(d)), x, headerH - 8);
        }

        // contingency band (deterministic finish -> risk-adjusted finish)
        var bandX1 = dayX(result.baseFinish);
        var bandX2 = dayX(projFinishP);
        ctx.fillStyle = teal;
        ctx.globalAlpha = 0.16;
        ctx.fillRect(Math.min(bandX1, bandX2), headerH, Math.abs(bandX2 - bandX1), chartHeight - headerH);
        ctx.globalAlpha = 1;

        // rows
        order.forEach(function (id, i) {
            var y = headerH + i * rowH;
            var esP = RiskEngine.percentile(result.taskES[id], p);
            var efP = RiskEngine.percentile(result.taskEF[id], p);
            var x1 = dayX(esP);
            var x2 = dayX(efP);
            var barW = Math.max(x2 - x1, 3);
            var isCritical = !!result.criticalSet[id];

            ctx.fillStyle = inkColor;
            ctx.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
            ctx.textAlign = 'left';
            var label = idLabel[id] + ' ' + (byId[id].name || '');
            var maxChars = Math.floor((LABEL_W - 8) / 5.6);
            if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
            ctx.fillText(label, 4, y + rowH / 2 + 4);

            ctx.fillStyle = isCritical ? amber : blue;
            var barY = y + 6;
            var barH = rowH - 12;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x1, barY, barW, barH, 3);
                ctx.fill();
            } else {
                ctx.fillRect(x1, barY, barW, barH);
            }
        });

        // deterministic finish marker (dashed)
        ctx.strokeStyle = inkSoft;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(bandX1, headerH);
        ctx.lineTo(bandX1, chartHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // selected confidence marker (solid, amber)
        ctx.strokeStyle = amber;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bandX2, headerH);
        ctx.lineTo(bandX2, chartHeight);
        ctx.stroke();

        return true;
    }

    // A tab switch (or the mini-Gantt pane toggling on) can fire before the browser has
    // finished laying out the newly-visible container, so a single clientWidth/Height
    // read right after can under-measure. Re-drawing once more a couple of frames later
    // is cheap and makes the chart self-correct instead of staying stuck at a stale size.
    function settleThenRedraw(fn) {
        requestAnimationFrame(function () {
            requestAnimationFrame(fn);
        });
    }

    function renderGantt(_settled) {
        var ok = drawGanttChart(el.ganttCanvas, el.ganttScroll);
        el.ganttEmpty.classList.toggle('hidden', !!ok);
        el.ganttCanvas.classList.toggle('hidden', !ok);
        if (!_settled) settleThenRedraw(function () { renderGantt(true); });
    }

    function renderMiniGantt(_settled) {
        if (el.miniGanttPane.classList.contains('hidden')) return;
        drawGanttChart(el.miniGanttCanvas, el.miniGanttScroll);
        if (!_settled) settleThenRedraw(function () { renderMiniGantt(true); });
    }

    // ---------- S-Curve ----------

    // Shared by the live S-Curve view and the fixed-size offscreen snapshot used for
    // Excel export -- `container` only ever needs .clientWidth/.clientHeight, so export
    // passes a plain {clientWidth, clientHeight} object instead of a real DOM node.
    function drawSCurveChart(canvas, container, metric) {
        var result = state.result;
        var containerWidth = container.clientWidth;
        var containerHeight = container.clientHeight || 320;

        if (!result || containerWidth === 0) return false;

        var arr = metric === 'schedule' ? result.finish : result.cost;
        var currency = state.project.currency;
        var fmt = function (v) { return metric === 'schedule' ? formatDays(v) : formatCurrency(v, currency); };

        var n = arr.length;
        var THIN = 120;
        var points = [];
        for (var k = 0; k <= THIN; k++) {
            var idx = Math.min(n - 1, Math.round((k / THIN) * (n - 1)));
            points.push({ x: arr[idx], y: k / THIN });
        }

        var minX = arr[0], maxX = arr[n - 1];
        if (maxX === minX) maxX = minX + 1;

        var dpr = window.devicePixelRatio || 1;
        var padL = 8, padR = 8, padT = 56, padB = 26;
        canvas.width = containerWidth * dpr;
        canvas.height = containerHeight * dpr;
        canvas.style.width = containerWidth + 'px';
        canvas.style.height = containerHeight + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var css = getComputedStyle(document.documentElement);
        var inkColor = css.getPropertyValue('--ink').trim();
        var inkSoft = css.getPropertyValue('--ink-soft').trim();
        var hairline = css.getPropertyValue('--hairline').trim();
        var teal = css.getPropertyValue('--teal').trim();
        var amber = css.getPropertyValue('--amber').trim();
        var blue = css.getPropertyValue('--blue').trim();
        var surface = css.getPropertyValue('--surface').trim();

        ctx.clearRect(0, 0, containerWidth, containerHeight);
        ctx.fillStyle = surface;
        ctx.fillRect(0, 0, containerWidth, containerHeight);

        var plotW = containerWidth - padL - padR;
        var plotH = containerHeight - padT - padB;

        function px(x) { return padL + ((x - minX) / (maxX - minX)) * plotW; }
        function py(y) { return padT + plotH - y * plotH; }

        // gridlines (0/25/50/75/100%)
        ctx.font = '9px ' + getComputedStyle(document.body).fontFamily;
        [0, 25, 50, 75, 100].forEach(function (pct) {
            var y = py(pct / 100);
            ctx.strokeStyle = hairline;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + plotW, y);
            ctx.stroke();
            ctx.fillStyle = inkSoft;
            ctx.textAlign = 'left';
            ctx.fillText(pct + '%', 2, y - 2);
        });

        // area + line
        var grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        grad.addColorStop(0, teal);
        grad.addColorStop(1, surface);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px(points[0].x), py(0));
        points.forEach(function (pt) { ctx.lineTo(px(pt.x), py(pt.y)); });
        ctx.lineTo(px(points[points.length - 1].x), py(0));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = teal;
        ctx.lineWidth = 2;
        ctx.beginPath();
        points.forEach(function (pt, i) {
            var X = px(pt.x), Y = py(pt.y);
            if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        });
        ctx.stroke();

        // P50/P80/P90 markers
        var markers = [
            { p: 50, color: blue },
            { p: 80, color: amber },
            { p: 90, color: inkColor }
        ];
        markers.forEach(function (m, mi) {
            var v = RiskEngine.percentile(arr, m.p);
            var X = px(v);
            ctx.strokeStyle = m.color;
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(X, padT);
            ctx.lineTo(X, padT + plotH);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = m.color;
            ctx.font = '700 10px ' + getComputedStyle(document.body).fontFamily;
            ctx.textAlign = mi === 2 ? 'right' : 'left';
            var labelX = mi === 2 ? X - 4 : X + 4;
            ctx.fillText('P' + m.p + ' ' + fmt(v), labelX, padT - 8 - mi * 13);
        });

        return true;
    }

    function renderSCurve(_settled) {
        var ok = drawSCurveChart(el.scurveCanvas, el.scurveScroll, state.scurveMetric);
        el.scurveEmpty.classList.toggle('hidden', !!ok);
        el.scurveCanvas.classList.toggle('hidden', !ok);
        if (!_settled) settleThenRedraw(function () { renderSCurve(true); });
    }

    // ---------- Project actions ----------

    function loadSample() {
        if (state.project.tasks.length > 0 &&
            !window.confirm('This replaces your current activities with the sample project. Continue?')) {
            return;
        }
        var sample = JSON.parse(JSON.stringify(window.SAMPLE_PROJECT));
        sample.id = state.project.id; // replace the current project's data in place, keep its slot/id
        var idx = state.projects.findIndex(function (p) { return p.id === state.project.id; });
        state.projects[idx] = sample;
        state.project = sample;
        state.result = null;
        saveProject();
        renderAll();
        showToast('Sample project loaded');
    }

    // ---------- Multi-project switcher ----------

    function createProject() {
        var name = window.prompt('New project name', 'Untitled Project');
        if (name === null) return;
        name = name.trim() || 'Untitled Project';
        var project = emptyProject();
        project.name = name;
        state.projects.push(project);
        setActiveProject(project.id);
        saveProject();
        renderAll();
        renderProjectSheetList();
        closeProjectSheet();
        showToast('Created "' + name + '"');
    }

    function switchProject(id) {
        if (id !== state.activeProjectId) {
            setActiveProject(id);
            saveProject();
            renderAll();
            showToast('Switched to "' + state.project.name + '"');
        }
        closeProjectSheet();
    }

    function deleteProjectById(id) {
        if (state.projects.length <= 1) {
            window.alert("You can't delete your only project.");
            return;
        }
        var project = state.projects.find(function (p) { return p.id === id; });
        if (!project) return;
        if (!window.confirm('Delete "' + (project.name || 'Untitled Project') + '"? This cannot be undone.')) return;

        state.projects = state.projects.filter(function (p) { return p.id !== id; });
        if (state.activeProjectId === id) setActiveProject(state.projects[0].id);
        saveProject();
        renderAll();
        renderProjectSheetList();
        showToast('Project deleted');
    }

    function renderProjectSheetList() {
        el.projectPickerList.innerHTML = '';
        state.projects.forEach(function (p) {
            var isActive = p.id === state.activeProjectId;
            var row = document.createElement('div');
            row.className = 'project-picker-row' + (isActive ? ' is-active' : '');

            var info = document.createElement('div');
            info.className = 'project-picker-info';
            var name = document.createElement('div');
            name.className = 'project-picker-name';
            if (isActive) {
                var mark = document.createElement('span');
                mark.className = 'active-mark';
                mark.textContent = '✓';
                name.appendChild(mark);
            }
            name.appendChild(document.createTextNode(p.name || 'Untitled Project'));
            var sub = document.createElement('div');
            sub.className = 'project-picker-sub';
            sub.textContent = p.tasks.length + (p.tasks.length === 1 ? ' activity' : ' activities');
            info.appendChild(name);
            info.appendChild(sub);

            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn btn-icon btn-danger';
            del.textContent = '🗑';
            del.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteProjectById(p.id);
            });

            row.appendChild(info);
            row.appendChild(del);
            row.addEventListener('click', function () { switchProject(p.id); });
            el.projectPickerList.appendChild(row);
        });
    }

    function openProjectSheet() {
        renderProjectSheetList();
        el.projectSheetBackdrop.classList.add('open');
    }

    function closeProjectSheet() {
        el.projectSheetBackdrop.classList.remove('open');
    }

    // ---------- Excel export ----------

    function round1(v) { return Math.round(v * 10) / 10; }

    // Renders into a detached, fixed-size canvas rather than the live view --
    // drawGanttChart/drawSCurveChart only ever read .clientWidth/.clientHeight off
    // whatever "container" they're given, so a plain object stands in for a real one.
    // This lets export produce a good chart image regardless of which tab is open,
    // without flashing the UI over to Gantt/S-Curve to size off the visible canvas.
    function captureGanttImage(width, height) {
        var canvas = document.createElement('canvas');
        var ok = drawGanttChart(canvas, { clientWidth: width, clientHeight: height });
        return ok ? canvas.toDataURL('image/png') : null;
    }

    function captureSCurveImage(metric, width, height) {
        var canvas = document.createElement('canvas');
        var ok = drawSCurveChart(canvas, { clientWidth: width, clientHeight: height }, metric);
        return ok ? canvas.toDataURL('image/png') : null;
    }

    function addActivitiesSheet(workbook, project, result) {
        var sheet = workbook.addWorksheet('Activities');
        var idLabel = {};
        project.tasks.forEach(function (t, i) { idLabel[t.id] = 'A' + (i + 1); });
        var criticalSet = result ? result.criticalSet : computeStaticCriticalSet(project.tasks);

        sheet.columns = [
            { header: 'ID', key: 'id', width: 6 },
            { header: 'Activity', key: 'name', width: 34 },
            { header: 'Depends On', key: 'deps', width: 16 },
            { header: 'Duration O', key: 'dO', width: 12 },
            { header: 'Duration M', key: 'dM', width: 12 },
            { header: 'Duration P', key: 'dP', width: 12 },
            { header: 'Cost O', key: 'cO', width: 14 },
            { header: 'Cost M', key: 'cM', width: 14 },
            { header: 'Cost P', key: 'cP', width: 14 },
            { header: 'Critical Path', key: 'critical', width: 13 }
        ];
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).eachCell(function (cell) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EDF3' } }; });

        project.tasks.forEach(function (t) {
            var row = sheet.addRow({
                id: idLabel[t.id],
                name: t.name,
                deps: (t.deps || []).map(function (d) { return idLabel[d] || '?'; }).join(', '),
                dO: t.dO, dM: t.dM, dP: t.dP,
                cO: t.cO, cM: t.cM, cP: t.cP,
                critical: criticalSet[t.id] ? 'Yes' : 'No'
            });
            if (criticalSet[t.id]) row.getCell('critical').font = { bold: true, color: { argb: 'FFE07B2C' } };
        });

        ['dO', 'dM', 'dP'].forEach(function (key) { sheet.getColumn(key).numFmt = '0.0'; });
        ['cO', 'cM', 'cP'].forEach(function (key) { sheet.getColumn(key).numFmt = '#,##0'; });
    }

    function addSummarySheet(workbook, project, result) {
        var sheet = workbook.addWorksheet('Summary');
        sheet.getColumn(1).width = 30;
        sheet.getColumn(2).width = 16;
        sheet.getColumn(3).width = 16;
        sheet.getColumn(4).width = 16;
        sheet.getColumn(5).width = 16;

        sheet.addRow(['Project', project.name]);
        sheet.addRow(['Currency', project.currency]);
        sheet.addRow(['Activities', project.tasks.length]);
        sheet.addRow(['Generated', new Date().toLocaleString()]);

        if (!result) {
            sheet.addRow([]);
            sheet.addRow(['Run a simulation in the app to include schedule/cost risk figures.']);
            return;
        }

        sheet.addRow(['Iterations', project.iterations]);
        sheet.addRow(['Distribution', project.distribution === 'triangular' ? 'Triangular' : 'PERT-Beta']);
        sheet.addRow([]);

        var schedP50 = RiskEngine.percentile(result.finish, 50);
        var schedP80 = RiskEngine.percentile(result.finish, 80);
        var schedP90 = RiskEngine.percentile(result.finish, 90);
        var costP50 = RiskEngine.percentile(result.cost, 50);
        var costP80 = RiskEngine.percentile(result.cost, 80);
        var costP90 = RiskEngine.percentile(result.cost, 90);

        var schedHeader = sheet.addRow(['Schedule (days)', 'Deterministic', 'P50', 'P80', 'P90']);
        schedHeader.font = { bold: true };
        sheet.addRow(['Project finish', round1(result.baseFinish), round1(schedP50), round1(schedP80), round1(schedP90)]);
        sheet.addRow(['Contingency vs deterministic (P80)', null, null, round1(schedP80 - result.baseFinish), null]);
        sheet.addRow([]);

        var costHeader = sheet.addRow(['Cost', 'Deterministic', 'P50', 'P80', 'P90']);
        costHeader.font = { bold: true };
        sheet.addRow(['Total cost', Math.round(result.baseCost), Math.round(costP50), Math.round(costP80), Math.round(costP90)]);
        sheet.addRow(['Contingency vs deterministic (P80)', null, null, Math.round(costP80 - result.baseCost), null]);
    }

    function addGanttSheet(workbook, project, result) {
        var sheet = workbook.addWorksheet('Gantt');
        var idLabel = {};
        project.tasks.forEach(function (t, i) { idLabel[t.id] = 'A' + (i + 1); });
        var byId = {};
        project.tasks.forEach(function (t) { byId[t.id] = t; });

        var captureW = 1400, captureH = Math.max(360, 40 + result.order.length * 30);
        var image = captureGanttImage(captureW, captureH);
        var tableStartRow = 1;
        if (image) {
            var imageId = workbook.addImage({ base64: image, extension: 'png' });
            var displayW = 700, displayH = captureH * (displayW / captureW);
            sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: displayW, height: displayH } });
            tableStartRow = Math.ceil(displayH / 20) + 2;
        }

        sheet.getRow(tableStartRow).values = ['ID', 'Activity', 'Critical', 'ES (P50)', 'EF (P50)', 'ES (P80)', 'EF (P80)', 'ES (P90)', 'EF (P90)'];
        sheet.getRow(tableStartRow).font = { bold: true };
        [10, 30, 10, 12, 12, 12, 12, 12, 12].forEach(function (w, i) { sheet.getColumn(i + 1).width = w; });

        result.order.forEach(function (id, i) {
            var rowValues = [idLabel[id], byId[id].name, result.criticalSet[id] ? 'Yes' : 'No'];
            [50, 80, 90].forEach(function (p) {
                rowValues.push(round1(RiskEngine.percentile(result.taskES[id], p)));
                rowValues.push(round1(RiskEngine.percentile(result.taskEF[id], p)));
            });
            sheet.getRow(tableStartRow + 1 + i).values = rowValues;
        });
    }

    function addSCurveSheet(workbook, project, result) {
        var sheet = workbook.addWorksheet('S-Curve');
        var currency = project.currency;

        var schedImage = captureSCurveImage('schedule', 900, 420);
        var costImage = captureSCurveImage('cost', 900, 420);
        var row = 1;
        if (schedImage) {
            var schedImageId = workbook.addImage({ base64: schedImage, extension: 'png' });
            sheet.addImage(schedImageId, { tl: { col: 0, row: 0 }, ext: { width: 620, height: 290 } });
        }
        if (costImage) {
            var costImageId = workbook.addImage({ base64: costImage, extension: 'png' });
            sheet.addImage(costImageId, { tl: { col: 8, row: 0 }, ext: { width: 620, height: 290 } });
        }
        row = 18;

        [1, 9].forEach(function (col) { sheet.getColumn(col).width = 16; sheet.getColumn(col + 1).width = 14; });

        var scheduleHeaderRow = sheet.getRow(row);
        scheduleHeaderRow.getCell(1).value = 'Cumulative % — Schedule (days)';
        scheduleHeaderRow.getCell(1).font = { bold: true };
        var costHeaderRow = sheet.getRow(row);
        costHeaderRow.getCell(9).value = 'Cumulative % — Cost';
        costHeaderRow.getCell(9).font = { bold: true };

        var headRow = sheet.getRow(row + 1);
        headRow.getCell(1).value = 'Days';
        headRow.getCell(2).value = 'Cumulative %';
        headRow.getCell(9).value = 'Cost';
        headRow.getCell(10).value = 'Cumulative %';
        headRow.font = { bold: true };

        var THIN = 60;
        var finishSorted = result.finish, costSorted = result.cost;
        for (var k = 0; k <= THIN; k++) {
            var fi = Math.min(finishSorted.length - 1, Math.round((k / THIN) * (finishSorted.length - 1)));
            var ci = Math.min(costSorted.length - 1, Math.round((k / THIN) * (costSorted.length - 1)));
            var r = sheet.getRow(row + 2 + k);
            r.getCell(1).value = round1(finishSorted[fi]);
            r.getCell(2).value = round1((k / THIN) * 100);
            r.getCell(9).value = Math.round(costSorted[ci]);
            r.getCell(10).value = round1((k / THIN) * 100);
        }
    }

    function excelExportFailed(err) {
        el.exportProgressFill.style.width = '0%';
        el.exportButtonLabel.textContent = 'Export to Excel (.xlsx)';
        el.btnExportExcel.disabled = false;
        el.exportStatus.classList.remove('hidden');
        el.exportStatus.style.color = 'var(--danger)';
        el.exportStatus.textContent = 'Export failed: ' + ((err && err.message) || String(err));
    }

    function exportExcel() {
        if (!state.project.tasks.length) {
            el.exportStatus.classList.remove('hidden');
            el.exportStatus.style.color = 'var(--danger)';
            el.exportStatus.textContent = 'Add at least one activity first.';
            return;
        }

        el.btnExportExcel.disabled = true;
        el.exportButtonLabel.textContent = 'Building…';
        el.exportProgressFill.style.width = '35%';
        el.exportStatus.classList.add('hidden');

        // Yield one tick so the disabled/progress state actually paints before the
        // (synchronous) workbook build + canvas rendering work runs.
        setTimeout(function () {
            try {
                var project = state.project;
                var result = state.result;

                var workbook = new window.ExcelJS.Workbook();
                workbook.creator = 'RiskFlow';
                workbook.created = new Date();

                addActivitiesSheet(workbook, project, result);
                addSummarySheet(workbook, project, result);
                if (result) {
                    addGanttSheet(workbook, project, result);
                    addSCurveSheet(workbook, project, result);
                }

                el.exportProgressFill.style.width = '75%';

                workbook.xlsx.writeBuffer().then(function (buffer) {
                    var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    var url = URL.createObjectURL(blob);
                    var filename = (project.name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = filename + '.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

                    el.exportProgressFill.style.width = '0%';
                    el.exportButtonLabel.textContent = 'Export to Excel (.xlsx)';
                    el.btnExportExcel.disabled = false;
                    showToast('Exported ' + filename + '.xlsx');
                }).catch(excelExportFailed);
            } catch (err) {
                excelExportFailed(err);
            }
        }, 30);
    }

    el.btnExportExcel.addEventListener('click', exportExcel);

    function renameProject() {
        var name = window.prompt('Project name', state.project.name || 'Untitled Project');
        if (name === null) return;
        name = name.trim();
        if (!name) return;
        state.project.name = name;
        saveProject();
        renderHeader();
    }

    function exportProject() {
        var payload = {
            version: state.project.version || 1,
            currency: state.project.currency,
            tasks: state.project.tasks
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var filename = (state.project.name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
        var a = document.createElement('a');
        a.href = url;
        a.download = filename + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        showToast('Exported ' + filename + '.json');
    }

    function importProject(file) {
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var parsed = JSON.parse(reader.result);
                if (!parsed || !Array.isArray(parsed.tasks)) throw new Error('Missing "tasks" array.');
                if (state.project.tasks.length > 0 &&
                    !window.confirm('This replaces your current activities. Continue?')) {
                    return;
                }
                state.project.currency = parsed.currency || state.project.currency;
                state.project.tasks = parsed.tasks;
                state.result = null;
                saveProject();
                renderAll();
                showToast('Project imported');
            } catch (e) {
                window.alert('Could not import file: ' + e.message);
            }
        };
        reader.readAsText(file);
    }

    function clearProject() {
        if (!window.confirm('Remove all activities from this project?')) return;
        state.project.tasks = [];
        state.result = null;
        saveProject();
        renderAll();
        showToast('Project cleared');
    }

    el.btnRenameProject.addEventListener('click', renameProject);
    el.btnLoadSample.addEventListener('click', loadSample);
    el.btnExport.addEventListener('click', exportProject);
    el.btnImport.addEventListener('click', function () { el.importFile.click(); });
    el.importFile.addEventListener('change', function () {
        if (el.importFile.files && el.importFile.files[0]) importProject(el.importFile.files[0]);
        el.importFile.value = '';
    });
    el.btnClear.addEventListener('click', clearProject);

    el.btnManageProjects.addEventListener('click', openProjectSheet);
    el.btnNewProject.addEventListener('click', createProject);
    el.btnCloseProjectSheet.addEventListener('click', closeProjectSheet);
    el.projectSheetBackdrop.addEventListener('click', function (e) {
        if (e.target === el.projectSheetBackdrop) closeProjectSheet();
    });

    // ---------- Header / full render ----------

    function renderHeader() {
        el.projectNameLabel.textContent = state.project.name || 'Untitled Project';
        el.projectNameSub.textContent = state.project.name || 'Untitled Project';
        var n = state.projects.length;
        el.projectCountSub.textContent = n + (n === 1 ? ' project' : ' projects');
    }

    function renderRunControls() {
        setSegmentedValue(el.iterationsSelect, String(state.project.iterations));
        setSegmentedValue(el.distributionSelect, state.project.distribution);
        setSegmentedValue(el.confidenceSelect, state.project.ganttConfidence);
        setSegmentedValue(el.ganttConfidenceToggle, state.project.ganttConfidence);
        el.currencyInput.value = state.project.currency;
    }

    function renderAll() {
        renderHeader();
        renderRunControls();
        renderActivities();
        renderResultsEmpty();
        if (state.activeTab === 'gantt') renderGantt();
        if (state.activeTab === 'scurve') renderSCurve();
    }

    // ---------- Landscape split (Activities + mini-Gantt) ----------

    var landscapeMQ = window.matchMedia('(orientation: landscape) and (min-width: 700px)');
    function handleLandscapeChange(e) {
        if (e.matches) {
            el.miniGanttPane.classList.remove('hidden');
            renderMiniGantt();
        } else {
            el.miniGanttPane.classList.add('hidden');
        }
    }
    if (landscapeMQ.addEventListener) landscapeMQ.addEventListener('change', handleLandscapeChange);
    else landscapeMQ.addListener(handleLandscapeChange);
    handleLandscapeChange(landscapeMQ);

    window.addEventListener('resize', function () {
        if (state.activeTab === 'gantt') renderGantt();
        if (state.activeTab === 'scurve') renderSCurve();
        renderMiniGantt();
    });

    // Layout can settle a tick after a view becomes visible (tab switch, keyboard
    // dismiss, orientation change); ResizeObserver catches that instead of relying
    // on a single synchronous measurement right after toggling display.
    if (window.ResizeObserver) {
        new ResizeObserver(function () {
            if (state.activeTab === 'gantt') renderGantt();
        }).observe(el.ganttScroll);
        new ResizeObserver(function () {
            if (state.activeTab === 'scurve') renderSCurve();
        }).observe(el.scurveScroll);
        new ResizeObserver(function () { renderMiniGantt(); }).observe(el.miniGanttScroll);
    }

    // ---------- Service worker ----------

    // Skip inside the Capacitor native shell -- it bundles the app locally
    // (no network round-trip to cache against), and window.Capacitor is how
    // Capacitor identifies itself to web code running inside it.
    if ('serviceWorker' in navigator && !window.Capacitor) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
    }

    // ---------- Init ----------

    renderAll();
})();
