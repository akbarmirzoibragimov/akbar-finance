/* Akbar Finance 3.3 — income/expense series (single source of truth for planned items) and Planning blocks.
   A series generates planned occurrences in L.planned (ids `${seriesId}_${ym}`), so every existing view
   (Плановые платежи, бюджетные периоды, симулятор, главная, Debt Freedom) reads the same numbers.
   Pure functions; works in the browser (extends AFCore) and in Node. Amounts in integer fils. */
(function (root, factory) {
  var C = (typeof module === 'object' && module.exports) ? require('./core2.js') : root.AFCore;
  var ext = factory(C);
  Object.keys(ext).forEach(function (k) { C[k] = ext[k]; });
  if (typeof module === 'object' && module.exports) module.exports = C;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  var byId = C.byId, addMonths = C.addMonths, ymOf = C.ymOf;
  var SERIES_KINDS = ['income', 'payment', 'family'];
  var HORIZON = 36; // open-ended series are materialised this many months ahead of today (rolling)
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function monthsBetween(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
  function occYm(p) { return p.occYm || ymOf(p.date); }

  /* ---------- amounts ---------- */
  function baseAmount(s, ym) {
    var st = (s.steps || []).slice().sort(function (a, b) { return a.from < b.from ? -1 : 1; }), v = null;
    for (var i = 0; i < st.length; i++) { if (st[i].from <= ym) v = st[i].amount; }
    if (v == null) v = st.length ? st[0].amount : 0;
    return v == null ? 0 : v;
  }
  function amountFor(s, ym) {
    if (s.overrides && Object.prototype.hasOwnProperty.call(s.overrides, ym)) return s.overrides[ym] || 0;
    return baseAmount(s, ym);
  }
  function isOverridden(s, ym) { return !!(s.overrides && Object.prototype.hasOwnProperty.call(s.overrides, ym)); }
  function amountUnset(s) { return !(s.steps || []).some(function (x) { return x.amount > 0; }) && !Object.keys(s.overrides || {}).some(function (k) { return s.overrides[k] > 0; }); }
  function seriesEnd(s, today) {
    if (s.freq === 'once') return s.start;
    if (s.end) return s.end;
    var h = addMonths(ymOf(today || C.todayISO()), HORIZON - 1);
    return h < s.start ? s.start : h;
  }
  function seriesMonths(s, today) {
    var out = [], end = seriesEnd(s, today), ym = s.start, n = 0;
    while (ym <= end && n < 600) { if (!(s.removed && s.removed[ym])) out.push(ym); ym = addMonths(ym, 1); n++; }
    return out;
  }
  function occDate(s, ym) { var day = Math.max(1, Math.min(31, s.day || 1)); return ym + '-' + pad(Math.min(day, C.daysInMonth(ym))); }

  /* ---------- sync series -> planned occurrences ---------- */
  function lockedMap(L) {
    var m = {};
    L.transactions.forEach(function (t) { if (t.status !== 'void' && t.plannedId) m[t.plannedId] = 1; });
    return m;
  }
  function isLocked(p, locked) { return !!(locked[p.id] || p.confirmed || p.status === 'skipped'); }
  function syncSeries(L, today) {
    if (!Array.isArray(L.series)) L.series = [];
    today = today || C.todayISO();
    var locked = lockedMap(L), sMap = {}, byOcc = {};
    L.series.forEach(function (s) { sMap[s.id] = s; });
    L.planned.forEach(function (p) { if (p.seriesId && sMap[p.seriesId]) byOcc[p.seriesId + '|' + occYm(p)] = p; });
    var keep = {};
    L.series.forEach(function (s) {
      seriesMonths(s, today).forEach(function (ym) {
        var k = s.id + '|' + ym, p = byOcc[k], amt = amountFor(s, ym);
        if (p) {
          keep[p.id] = 1;
          if (!isLocked(p, locked)) {
            p.amount = amt; p.title = s.title;
            if (s.accountId !== undefined && p.kind === 'payment') p.accountId = s.accountId || null;
          }
          return;
        }
        var np = { id: s.id + '_' + ym, seriesId: s.id, occYm: ym, kind: s.kind, title: s.title, amount: amt, date: occDate(s, ym), budgetMonth: addMonths(ym, s.budgetShift || 0), currency: s.currency || 'AED', scenario: null, confirmed: false, dateConfirmed: s.dateConfirmed !== false, note: s.note || '' };
        if (s.kind === 'payment') { np.accountId = s.accountId || null; np.fromAccountId = s.fromAccountId || null; np.categoryId = s.accountId ? null : (s.categoryId || 'misc'); }
        if (s.kind === 'family') np.fromAccountId = s.fromAccountId || null;
        if (s.kind === 'income') { np.toAccountId = s.toAccountId || null; if (s.categoryId) np.categoryId = s.categoryId; }
        while (byId(L.planned, np.id)) np.id += 'x';
        L.planned.push(np); keep[np.id] = 1;
      });
    });
    // drop occurrences that no series wants any more, unless they carry real money
    L.planned = L.planned.filter(function (p) { return !p.seriesId || !sMap[p.seriesId] || keep[p.id] || isLocked(p, locked); });
    return L;
  }

  /* ---------- migration of an existing ledger (old planned items -> series), no data loss ---------- */
  function normTitle(t) { return String(t || '').trim().toLowerCase(); }
  function migrateSeries(L, today) {
    if (!Array.isArray(L.series)) L.series = [];
    if (L.seriesVersion >= 1) return { migrated: 0 };
    var known = {}; L.series.forEach(function (s) { known[s.id] = 1; });
    var groups = {}, order = [];
    L.planned.forEach(function (p) {
      if (p.scenario || SERIES_KINDS.indexOf(p.kind) < 0) return;
      if (p.seriesId && known[p.seriesId]) return;
      var k = p.kind + '|' + (p.accountId || '') + '|' + normTitle(p.title);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(p);
    });
    var made = 0, lastIncomeYm = '';
    L.planned.forEach(function (p) { if (p.kind === 'income' && !p.scenario && ymOf(p.date) > lastIncomeYm) lastIncomeYm = ymOf(p.date); });
    order.forEach(function (k) {
      var items = groups[k].slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      // one occurrence per calendar month; extra items in the same month become their own one-off series
      var main = [], extra = [], seen = {};
      items.forEach(function (p) { var ym = ymOf(p.date); if (seen[ym]) extra.push(p); else { seen[ym] = 1; main.push(p); } });
      var mk = function (list) {
        var first = list[0], last = list[list.length - 1], start = ymOf(first.date), end = ymOf(last.date);
        var contiguous = monthsBetween(start, end) === list.length - 1;
        var shifts = {}; list.forEach(function (p) { var d = monthsBetween(ymOf(p.date), p.budgetMonth || ymOf(p.date)); shifts[d] = (shifts[d] || 0) + 1; });
        var shift = +Object.keys(shifts).sort(function (a, b) { return shifts[b] - shifts[a]; })[0] || 0;
        var lastDay = +last.date.slice(8, 10), day = lastDay >= C.daysInMonth(ymOf(last.date)) ? 31 : lastDay;
        var openEnded = list.length >= 3 && contiguous && (first.kind === 'income' || first.kind === 'family') && end >= lastIncomeYm && !!lastIncomeYm;
        var steps = [], prev = null;
        list.forEach(function (p) { if (p.amount !== prev) { steps.push({ from: ymOf(p.date), amount: p.amount }); prev = p.amount; } });
        var removed = {};
        if (list.length > 1) { var have = {}; list.forEach(function (p) { have[ymOf(p.date)] = 1; }); for (var ym = start; ym <= end; ym = addMonths(ym, 1)) if (!have[ym]) removed[ym] = 1; }
        var sid = first.seriesId && !known[first.seriesId] ? first.seriesId : C.uid('ser');
        var s = { id: sid, kind: first.kind, title: first.title, currency: first.currency || 'AED', freq: list.length === 1 ? 'once' : 'monthly', start: start, end: list.length === 1 ? start : (openEnded ? null : end),
          day: day, budgetShift: shift, steps: steps, overrides: {}, removed: removed, accountId: first.accountId || null, fromAccountId: first.fromAccountId || null, toAccountId: first.toAccountId || null,
          categoryId: first.categoryId || null, note: first.note || '', dateConfirmed: first.dateConfirmed !== false, migrated: true };
        known[sid] = 1; L.series.push(s); made++;
        list.forEach(function (p) { p.seriesId = sid; p.occYm = ymOf(p.date); });
      };
      if (main.length) mk(main);
      extra.forEach(function (p) { mk([p]); });
    });
    L.seriesVersion = 1;
    return { migrated: made };
  }

  /* ---------- edits ---------- */
  function newSeries(o) {
    var s = { id: o.id || C.uid('ser'), kind: SERIES_KINDS.indexOf(o.kind) >= 0 ? o.kind : 'payment', title: o.title || '', currency: o.currency || 'AED', freq: o.freq === 'once' ? 'once' : 'monthly',
      start: o.start, end: o.freq === 'once' ? o.start : (o.end || null), day: o.day || (o.kind === 'income' ? 31 : 1), budgetShift: o.budgetShift != null ? o.budgetShift : (o.kind === 'income' && (o.day || 31) >= 25 ? 1 : 0),
      steps: [{ from: o.start, amount: o.amount == null ? 0 : o.amount }], overrides: {}, removed: {}, accountId: o.accountId || null, fromAccountId: o.fromAccountId || null, toAccountId: o.toAccountId || null,
      categoryId: o.categoryId || null, note: o.note || '', dateConfirmed: true };
    if (s.freq === 'monthly' && o.count) s.end = addMonths(o.start, Math.max(1, o.count) - 1);
    return s;
  }
  function laterOverrides(s, ym) { return Object.keys(s.overrides || {}).filter(function (k) { return k > ym; }).sort(); }
  /* mode: 'only' | 'following'. For 'following' later per-month overrides are cleared only when clearLater is true. */
  function setSeriesAmount(s, ym, amount, mode, clearLater) {
    s.overrides = s.overrides || {};
    if (mode === 'only') { if (amount === baseAmount(s, ym)) delete s.overrides[ym]; else s.overrides[ym] = amount; return s; }
    s.steps = (s.steps || []).filter(function (x) { return x.from < ym; });
    s.steps.push({ from: ym, amount: amount });
    delete s.overrides[ym];
    if (clearLater) laterOverrides(s, ym).forEach(function (k) { delete s.overrides[k]; });
    return s;
  }
  function resetSeriesMonth(s, ym) { if (s.overrides) delete s.overrides[ym]; return s; }
  function seriesSummary(L, s, today) {
    var months = seriesMonths(s, today);
    return { months: months, next: months.filter(function (ym) { return ym >= ymOf(today || C.todayISO()); })[0] || null, unset: amountUnset(s), current: amountFor(s, ymOf(today || C.todayISO())) };
  }

  /* ---------- Planning blocks (display/compose only; never own numbers) ---------- */
  var CORE_BLOCKS = ['series', 'planned', 'budgets', 'income', 'calendar', 'goals', 'debts', 'family', 'monthplan', 'simulator', 'purchase'];
  var GUARDED = ['debts', 'family'];
  function ensureBlocks(L) {
    L.settings = L.settings || {};
    var b = Array.isArray(L.settings.planBlocks) ? L.settings.planBlocks : [];
    var have = {}; b.forEach(function (x) { have[x.id] = 1; });
    CORE_BLOCKS.forEach(function (id) { if (!have[id]) b.push({ id: id, type: id, hidden: false }); });
    L.settings.planBlocks = b;
    return b;
  }
  function moveBlock(L, id, d) {
    var b = ensureBlocks(L), i = b.map(function (x) { return x.id; }).indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= b.length) return false;
    var t = b[i]; b[i] = b[j]; b[j] = t; return true;
  }
  function setBlockHidden(L, id, hidden) { var x = ensureBlocks(L).filter(function (q) { return q.id === id; })[0]; if (!x) return false; x.hidden = !!hidden; return true; }
  function addBlock(L, o) { var b = ensureBlocks(L), x = { id: C.uid('blk'), type: o.type, hidden: false, title: o.title || '', ref: o.ref || null, refs: o.refs || [] }; b.push(x); return x; }
  function removeBlock(L, id) { var b = ensureBlocks(L), x = b.filter(function (q) { return q.id === id; })[0]; if (!x || CORE_BLOCKS.indexOf(x.type) >= 0) return false; L.settings.planBlocks = b.filter(function (q) { return q.id !== id; }); return true; }


  /* ---------- simulator presets (no private amounts in code; salary low/high come from L.incomePlan) ---------- */
  function defaultSimParams(id) {
    if (id === 'neg') return { salaryBand: 'low', salaryPct: -20, expensesPct: 20, incomePct: 0, bonus: 0 };
    if (id === 'opt') return { salaryBand: 'exp', salaryPct: 0, expensesPct: 0, incomePct: 10, bonus: 0 };
    return { salaryBand: 'exp', salaryPct: 0, expensesPct: 0, incomePct: 0, bonus: 0 };
  }
  function normalizeSimParams(id, params) {
    var d = defaultSimParams(id), p = params ? Object.assign({}, params) : {};
    if (!p.salaryBand) p.salaryBand = d.salaryBand;
    if (p.salaryPct == null || p.salaryPct === '') p.salaryPct = d.salaryPct;
    if (p.expensesPct == null || p.expensesPct === '') p.expensesPct = d.expensesPct;
    if (p.incomePct == null || p.incomePct === '') p.incomePct = d.incomePct;
    if (p.bonus == null || p.bonus === '') p.bonus = d.bonus;
    p.salaryPct = isFinite(+p.salaryPct) ? +p.salaryPct : d.salaryPct;
    p.expensesPct = isFinite(+p.expensesPct) ? +p.expensesPct : d.expensesPct;
    p.incomePct = isFinite(+p.incomePct) ? +p.incomePct : d.incomePct;
    p.bonus = isFinite(+p.bonus) ? Math.max(0, Math.round(+p.bonus)) : 0;
    return p;
  }
  function incomePlanLineForItem(L, item) {
    var lines = (L && L.incomePlan && L.incomePlan.lines) || [], i, t = normTitle(item && item.title);
    if (!item) return null;
    for (i = 0; i < lines.length; i++) if (normTitle(lines[i].title) === t && t) return lines[i];
    if (item.categoryId === 'salary' || item.type === 'salary') {
      for (i = 0; i < lines.length; i++) if (lines[i].type === 'salary') return lines[i];
    }
    return null;
  }
  function isSalaryItem(L, item) {
    if (!item || (item.kind !== 'income' && item.kind !== 'unplannedIn')) return false;
    if (item.categoryId === 'salary' || item.type === 'salary') return true;
    var line = incomePlanLineForItem(L, item);
    return !!(line && line.type === 'salary');
  }
  /* Look up low/exp/high for this planned item in the payment month (date), not the budget month. */
  function incomePlanBandForItem(L, item, band) {
    var line = incomePlanLineForItem(L, item), ym, mo, v;
    if (!line || !item || !item.date) return null;
    ym = ymOf(item.date);
    mo = L.incomePlan && L.incomePlan.months && L.incomePlan.months[ym] && L.incomePlan.months[ym][line.id];
    if (!mo) return null;
    v = band === 'low' ? mo.low : band === 'high' ? mo.high : mo.exp;
    if (v == null) v = mo.exp;
    return v == null ? null : v;
  }
  function hasSalaryBand(L, band) {
    var ip = L && L.incomePlan, id, ym, mo, lines, i;
    if (!ip || !ip.months) return false;
    lines = (ip.lines || []).filter(function (l) { return l.type === 'salary'; });
    if (!lines.length) return false;
    for (ym in ip.months) if (Object.prototype.hasOwnProperty.call(ip.months, ym)) {
      mo = ip.months[ym];
      for (i = 0; i < lines.length; i++) {
        id = lines[i].id;
        if (mo[id] && mo[id][band] != null && mo[id][band] !== mo[id].exp) return true;
      }
    }
    return false;
  }
  function adjustPlanParts(L, mp, params) {
    params = normalizeSimParams(null, params);
    var parts = C.planParts(mp), income = parts.income, foundSalary = false;
    (mp.items || []).forEach(function (it) {
      if (!isSalaryItem(L, it)) return;
      foundSalary = true;
      var cur = it.amount || 0, next = null;
      if (params.salaryBand && params.salaryBand !== 'exp') next = incomePlanBandForItem(L, it, params.salaryBand);
      if (next == null && params.salaryPct) next = Math.round(cur * (1 + params.salaryPct / 100));
      if (next != null) income += next - cur;
    });
    if (!foundSalary && params.salaryPct && params.salaryBand !== 'exp') {
      (mp.items || []).forEach(function (it) {
        if (it.kind !== 'income' && it.kind !== 'unplannedIn') return;
        var cur = it.amount || 0;
        income += Math.round(cur * (1 + params.salaryPct / 100)) - cur;
      });
    }
    if (params.incomePct) income += Math.round(income * params.incomePct / 100);
    if (params.bonus) income += params.bonus;
    var expenses = parts.expenses;
    if (params.expensesPct) expenses = Math.round(expenses * (1 + params.expensesPct / 100));
    return { income: income, borrow: parts.borrow, parents: parts.parents, loans: parts.loans, expenses: expenses, other: parts.other, raw: parts };
  }
  function emptySums() { return { income: 0, borrow: 0, parents: 0, loans: 0, expenses: 0, other: 0, savings: 0, extraIn: 0, extraOut: 0, result: 0 }; }
  function addSums(a, row) {
    a.income += row.income; a.borrow += row.borrow; a.parents += row.parents; a.loans += row.loans;
    a.expenses += row.expenses; a.other += row.other; a.savings += row.savings || 0;
    a.extraIn += row.extraIn || 0; a.extraOut += row.extraOut || 0; a.result += row.result;
  }
  function avgSums(sums, n) {
    var o = {}, k; n = n || 1;
    for (k in sums) if (Object.prototype.hasOwnProperty.call(sums, k)) o[k] = Math.round(sums[k] / n);
    return o;
  }
  var origScenarioCalc = C.scenarioCalc;
  function paramsActive(p) {
    p = p || {};
    return (p.salaryBand && p.salaryBand !== 'exp') || !!p.salaryPct || !!p.expensesPct || !!p.incomePct || !!p.bonus;
  }
  function scenarioCalc(s, L, today, opts) {
    s = s || {}; opts = opts || {};
    if (!(L && s.usePlan !== false)) return origScenarioCalc(s, L, today, opts);
    today = today || opts.today || C.todayISO();
    var months = C.clampHorizon(s.months), lines = Array.isArray(s.lines) ? s.lines : [];
    var startYm = s.startYm || C.simStartYm(L, today);
    var ov = s.overrides || {};
    var params = normalizeSimParams(s.id, s.params);
    var rows = [], cum = 0, i, ym, extra, result, adj, income, out, savings, sums = emptySums();
    for (i = 0; i < months; i++) {
      ym = addMonths(startYm, i);
      adj = adjustPlanParts(L, C.monthPlan(L, ym, opts), params);
      income = adj.income + adj.borrow;
      if (ov.income) income = (s.income || 0) + adj.borrow;
      out = adj.parents + adj.loans + adj.expenses + adj.other;
      if (ov.parents) out = out - adj.parents + (s.parents || 0);
      if (ov.loans) out = out - adj.loans + (s.loans || 0);
      if (ov.expenses) out = out - adj.expenses + (s.expenses || 0);
      if (ov.other) out = out - adj.other + (s.other || 0);
      savings = ov.savings ? (s.savings || 0) : 0;
      extra = C.scenarioLinesInMonth(lines, ym);
      result = income - out - savings + extra.income - extra.expense;
      cum += result;
      var row = {
        n: i + 1, ym: ym,
        income: ov.income ? (s.income || 0) : adj.income, borrow: adj.borrow,
        parents: ov.parents ? (s.parents || 0) : adj.parents,
        loans: ov.loans ? (s.loans || 0) : adj.loans,
        expenses: ov.expenses ? (s.expenses || 0) : adj.expenses,
        other: ov.other ? (s.other || 0) : adj.other,
        savings: savings,
        out: out + savings, extraIn: extra.income, extraOut: extra.expense,
        result: result, free: cum, cumulative: cum, parts: adj
      };
      rows.push(row); addSums(sums, row);
    }
    var base = origScenarioCalc({ months: months, usePlan: true, startYm: startYm, lines: [], overrides: {} }, L, today, opts);
    return {
      monthly: rows[0] ? rows[0].result : 0, total: cum, savedTotal: cum, startYm: startYm, months: months, rows: rows, fromPlan: true,
      sums: sums, avgs: avgSums(sums, months || 1), baseTotal: base.total, delta: cum - base.total,
      params: params, adjusted: paramsActive(params) || !!(ov.income || ov.parents || ov.loans || ov.expenses || ov.other || ov.savings)
    };
  }
  function ensureScenarioParams(L) {
    if (!Array.isArray(L.scenarios)) return;
    L.scenarios.forEach(function (sc) { sc.params = normalizeSimParams(sc.id, sc.params); });
  }

  return { SERIES_KINDS: SERIES_KINDS, SERIES_HORIZON: HORIZON, seriesBaseAmount: baseAmount, seriesAmountFor: amountFor, seriesIsOverridden: isOverridden, seriesAmountUnset: amountUnset,
    seriesMonths: seriesMonths, seriesEnd: seriesEnd, syncSeries: syncSeries, migrateSeries: migrateSeries, newSeries: newSeries, setSeriesAmount: setSeriesAmount, resetSeriesMonth: resetSeriesMonth,
    seriesLaterOverrides: laterOverrides, seriesSummary: seriesSummary, CORE_BLOCKS: CORE_BLOCKS, GUARDED_BLOCKS: GUARDED, ensureBlocks: ensureBlocks, moveBlock: moveBlock,
    setBlockHidden: setBlockHidden, addBlock: addBlock, removeBlock: removeBlock, defaultSimParams: defaultSimParams, normalizeSimParams: normalizeSimParams, incomePlanLineForItem: incomePlanLineForItem, isSalaryItem: isSalaryItem, incomePlanBandForItem: incomePlanBandForItem, hasSalaryBand: hasSalaryBand, adjustPlanParts: adjustPlanParts, scenarioCalc: scenarioCalc, ensureScenarioParams: ensureScenarioParams, prepareLedger: function (L, today) { migrateSeries(L, today); syncSeries(L, today); ensureBlocks(L); ensureScenarioParams(L); return L; } };
});
/* hook: every load/import path goes through normalizeLedger, so migration happens there too */
(function (C) {
  if (!C || C._seriesHooked) return;
  var orig = C.normalizeLedger;
  C.normalizeLedger = function (obj, opts) {
    var r = orig.apply(this, arguments);
    if (r && r.ledger) C.prepareLedger(r.ledger, (opts && opts.today) || C.todayISO());
    return r;
  };
  C._seriesHooked = true;
})(typeof module === 'object' && module.exports ? module.exports : (typeof self !== 'undefined' ? self : this).AFCore);
