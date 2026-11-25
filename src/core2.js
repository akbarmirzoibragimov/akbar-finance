/* Akbar Finance 3.1 — core extensions: spaces (personal/business), portfolio & debt rings, yearly income plan,
   personal-budget remainder → savings, expense summaries, goal templates/stages, daily quotes, academy schedule.
   Pure functions on the ledger (amounts in integer fils). Works in the browser (extends AFCore) and in Node. */
(function (root, factory) {
  var C = (typeof module === 'object' && module.exports) ? require('./core.js') : root.AFCore;
  var ext = factory(C);
  Object.keys(ext).forEach(function (k) { C[k] = ext[k]; });
  if (typeof module === 'object' && module.exports) module.exports = C;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  var sum = C.sum, byId = C.byId, toBase = C.toBase;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseD(s) { return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); }

  /* ---------- spaces ---------- */
  function spaceOf(a) { return (a && a.space) || 'personal'; }
  /* Read-only view of the ledger limited to one space. Mutations must always go to the real ledger. */
  function spaceView(L, space) {
    space = space || 'personal';
    var ids = {}; L.accounts.forEach(function (a) { if (spaceOf(a) === space) ids[a.id] = 1; });
    var has = function (id) { return !!id && !!ids[id]; };
    return Object.assign({}, L, {
      accounts: L.accounts.filter(function (a) { return ids[a.id]; }),
      transactions: L.transactions.filter(function (t) { return has(t.fromAccountId) || has(t.toAccountId); }),
      planned: L.planned.filter(function (p) {
        if (p.accountId || p.fromAccountId || p.toAccountId) return has(p.accountId) || has(p.fromAccountId) || has(p.toAccountId);
        return space === 'personal';
      }),
      goals: (L.goals || []).filter(function (g) { return ((g.space || 'personal') === space); }),
      budgetPlan: space === 'personal' ? L.budgetPlan : { total: 0 },
      __space: space
    });
  }

  /* ---------- portfolio "All finance" ---------- */
  function portfolio(L, today) {
    var m = C.metrics(L, today), ds = C.debtSummary(L, today), bal = m.balances;
    var debtRows = ds.rows.filter(function (r) { return r.debt > 0 && !r.acc.archived; }).map(function (r) {
      return { id: r.acc.id, name: r.acc.name, value: toBase(L, r.debt, r.acc.currency) || 0, color: r.acc.color, term: r.acc.term === 'long' ? 'long' : 'short' };
    }).sort(function (a, b) { return b.value - a.value; });
    var ownRows = L.accounts.filter(function (a) { return !C.isLiab(a) && !a.archived; }).map(function (a) {
      return { id: a.id, name: a.name, value: toBase(L, bal[a.id], a.currency) || 0, color: a.color, role: a.role || null };
    }).filter(function (r) { return r.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    var debt = sum(debtRows, function (r) { return r.value; });
    var net = m.own - debt, mode = net < 0 ? 'debt' : 'assets';
    var segs = mode === 'debt' ? debtRows : ownRows, tot = sum(segs, function (r) { return r.value; });
    segs.forEach(function (r) { r.pct = tot ? r.value / tot : 0; });
    var shortD = sum(debtRows.filter(function (r) { return r.term === 'short'; }), function (r) { return r.value; });
    return { own: m.own, debt: debt, net: net, mode: mode, segments: segs, short: shortD, long: debt - shortD,
      shortPct: debt ? shortD / debt : 0, longPct: debt ? (debt - shortD) / debt : 0, netWorth: m.netWorth, unconvertible: m.unconvertible };
  }
  /* AED minor → other currency minor using the user's manual rates (null if no rate) */
  function convert(L, minorAED, cur) { return C.fromBase(L, minorAED, cur); }

  /* ---------- debt ring: outer short/long, inner per creditor ---------- */
  function debtRing(L, today) {
    today = today || C.todayISO();
    var ds = C.debtSummary(L, today);
    var inner = ds.rows.filter(function (r) { return r.debt > 0; }).map(function (r) {
      var next = L.planned.filter(function (p) { return p.accountId === r.acc.id && p.kind === 'payment' && C.plannedIncluded(p) && C.plannedState(L, p, today).open; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0] || null;
      return { id: r.acc.id, name: r.acc.name, value: toBase(L, r.debt, r.acc.currency) || 0, color: r.acc.color, term: r.acc.term === 'long' ? 'long' : 'short',
        next: next ? { date: next.date, amount: C.plannedState(L, next, today).remaining, title: next.title } : null };
    }).sort(function (a, b) { return (a.term === b.term ? b.value - a.value : (a.term === 'short' ? -1 : 1)); });
    var total = sum(inner, function (r) { return r.value; });
    inner.forEach(function (r) { r.pct = total ? r.value / total : 0; });
    var shortV = sum(inner.filter(function (r) { return r.term === 'short'; }), function (r) { return r.value; });
    var base = ds.initialTotal, repaid = ds.repaidTotal;
    return { total: total, short: shortV, long: total - shortV, shortPct: total ? shortV / total : 0, longPct: total ? (total - shortV) / total : 0,
      outer: [{ id: 'short', value: shortV, pct: total ? shortV / total : 0 }, { id: 'long', value: total - shortV, pct: total ? (total - shortV) / total : 0 }],
      inner: inner, repaid: repaid, repaidPct: base > 0 ? Math.max(0, Math.min(1, repaid / base)) : 0 };
  }

  /* ---------- yearly expected-income plan (by month of receipt) ----------
     L.incomePlan = { lines:[{id,title,type}], months:{ym:{lineId:{exp,low,high}}}, actuals:{ym:{lineId:amount}} } */
  function ensureIncomePlan(L) { if (!L.incomePlan) L.incomePlan = { lines: [], months: {}, actuals: {} }; ['lines'].forEach(function (k) { if (!Array.isArray(L.incomePlan[k])) L.incomePlan[k] = []; }); ['months', 'actuals'].forEach(function (k) { if (!L.incomePlan[k] || typeof L.incomePlan[k] !== 'object') L.incomePlan[k] = {}; }); return L.incomePlan; }
  function incomeMonth(L, ym) {
    var ip = L.incomePlan || { lines: [], months: {}, actuals: {} }, mo = ip.months[ym] || {}, ac = ip.actuals[ym] || null;
    var lines = (ip.lines || []).map(function (l) {
      var e = mo[l.id] || null, a = ac && ac[l.id] != null ? ac[l.id] : null;
      return { id: l.id, title: l.title, type: l.type, exp: e ? e.exp : 0, low: e ? (e.low != null ? e.low : e.exp) : 0, high: e ? (e.high != null ? e.high : e.exp) : 0, actual: a, variance: a == null ? null : a - (e ? e.exp : 0), planned: !!e };
    });
    var exp = sum(lines, function (l) { return l.exp; }), entered = ac != null && lines.some(function (l) { return l.actual != null; });
    var actual = entered ? sum(lines, function (l) { return l.actual || 0; }) : null;
    var rec = C.flows(L, ym + '-01', C.lastDay(ym));
    return { ym: ym, lines: lines, exp: exp, low: sum(lines, function (l) { return l.low; }), high: sum(lines, function (l) { return l.high; }),
      actual: actual, variance: actual == null ? null : actual - exp, variancePct: actual == null || !exp ? null : (actual - exp) / exp, recorded: rec.earned + rec.returnFunds };
  }
  function incomePlanView(L, year, mode) {
    var months = []; for (var i = 1; i <= 12; i++) months.push(incomeMonth(L, year + '-' + pad(i)));
    var agg = function (list, key, label) {
      var withActual = list.filter(function (x) { return x.actual != null; });
      var a = withActual.length ? sum(withActual, function (x) { return x.actual; }) : null, eA = sum(withActual, function (x) { return x.exp; });
      return { key: key, label: label, months: list.map(function (x) { return x.ym; }), exp: sum(list, function (x) { return x.exp; }), low: sum(list, function (x) { return x.low; }), high: sum(list, function (x) { return x.high; }),
        actual: a, expForActual: eA, variance: a == null ? null : a - eA, recorded: sum(list, function (x) { return x.recorded; }), filled: withActual.length, planned: list.filter(function (x) { return x.exp > 0; }).length };
    };
    if (mode === 'quarter') return [0, 1, 2, 3].map(function (q) { return agg(months.slice(q * 3, q * 3 + 3), year + '-Q' + (q + 1), 'Q' + (q + 1)); });
    if (mode === 'year') return [agg(months, String(year), String(year))];
    return months.map(function (x) { var r = agg([x], x.ym, x.ym); r.detail = x; return r; });
  }
  function setIncomeActual(L, ym, lineId, amount) {
    var ip = ensureIncomePlan(L); ip.actuals[ym] = ip.actuals[ym] || {};
    if (amount == null || amount === '') delete ip.actuals[ym][lineId]; else { if (!C.isInt(amount) || amount < 0) return { ok: false, errors: ['amount'] }; ip.actuals[ym][lineId] = amount; }
    if (!Object.keys(ip.actuals[ym]).length) delete ip.actuals[ym];
    return { ok: true };
  }
  function setIncomeExpected(L, ym, lineId, o) {
    var ip = ensureIncomePlan(L); ip.months[ym] = ip.months[ym] || {};
    if (!o || !(o.exp > 0)) delete ip.months[ym][lineId]; else ip.months[ym][lineId] = { exp: o.exp, low: o.low != null ? o.low : o.exp, high: o.high != null ? o.high : o.exp };
    if (!Object.keys(ip.months[ym]).length) delete ip.months[ym];
    return { ok: true };
  }

  /* ---------- personal budget: obligation + spend budget + remainder → savings ---------- */
  function budgetRemainder(L, ym, today) {
    today = today || C.todayISO();
    var bs = C.budgetStatus(L, ym, today), limit = L.budgetPlan && L.budgetPlan.total || 0;
    var sw = (L.budgetSweeps || {})[ym] || null, tx = sw ? byId(L.transactions, sw.txId) : null;
    if (tx && tx.status === 'void') { sw = null; tx = null; }
    var last = C.lastDay(ym);
    return { ym: ym, limit: limit, spent: bs.total.spent, remainder: Math.max(0, limit - bs.total.spent), over: Math.max(0, bs.total.spent - limit),
      swept: !!tx, sweptAmount: tx ? tx.amount : 0, ended: today >= last, due: today >= C.addDays(last, -2) && !tx, lastDay: last };
  }
  function sweepBudget(L, ym, fromId, toId, today, amount) {
    var r = budgetRemainder(L, ym, today);
    if (r.swept) return { ok: false, duplicate: true, errors: ['alreadySwept'] };
    var amt = amount != null ? amount : r.remainder;
    if (!(amt > 0)) return { ok: false, errors: ['nothingLeft'] };
    var date = (today < r.lastDay ? today : r.lastDay) + 'T23:00';
    var res = C.addTx(L, { type: 'savings_topup', amount: amt, fromAccountId: fromId, toAccountId: toId, date: date, opKey: 'sweep:' + ym, note: 'Остаток личного бюджета ' + ym + ' → накопления', budgetMonth: ym });
    if (!res.ok) return res;
    L.budgetSweeps = L.budgetSweeps || {}; L.budgetSweeps[ym] = { txId: res.tx.id, amount: amt };
    return { ok: true, tx: res.tx };
  }

  /* ---------- expense summaries (actual records) ---------- */
  function expenseSummary(L, from, to) {
    var sp = C.spendByCategory(L, from, to), top = {};
    Object.keys(sp).forEach(function (id) { var c = byId(L.categories, id), t = c && c.parent ? c.parent : id; top[t] = (top[t] || 0) + sp[id]; });
    var f = C.flows(L, from, to);
    var cats = Object.keys(top).map(function (id) { return { id: id, value: top[id] }; }).sort(function (a, b) { return b.value - a.value; });
    var consumer = sum(cats, function (c) { return c.value; });
    return { from: from, to: to, categories: cats, consumer: consumer, debtPrincipal: f.principal, finance: f.finance, family: f.family,
      total: consumer + f.principal + f.finance + f.family, earned: f.earned };
  }
  function quarterRange(ym) { var y = +ym.slice(0, 4), q = Math.floor((+ym.slice(5, 7) - 1) / 3); return { from: y + '-' + pad(q * 3 + 1) + '-01', to: C.lastDay(y + '-' + pad(q * 3 + 3)), label: 'Q' + (q + 1) + ' ' + y, q: q + 1, y: y }; }

  /* ---------- goals: templates & stages ---------- */
  var GOAL_TEMPLATES = [
    { id: 'emergency', ru: 'Резервный фонд', en: 'Emergency fund', type: 'reserve', target: 500000, color: '#FF9F0A', icon: 'shield', hint: { ru: '3–6 месячных обязательных расходов', en: '3–6 months of essential costs' } },
    { id: 'vacation', ru: 'Отпуск', en: 'Vacation', type: 'custom', target: 600000, color: '#64D2FF', icon: 'globe', hint: { ru: 'Билеты, жильё, питание, запас 10%', en: 'Tickets, stay, food, 10% buffer' } },
    { id: 'trip_home', ru: 'Поездка домой', en: 'Trip home', type: 'custom', target: 300000, color: '#5E5CE6', icon: 'globe', hint: { ru: 'Билеты и подарки родным', en: 'Tickets and gifts' } },
    { id: 'car', ru: 'Машина', en: 'Car', type: 'custom', target: 3000000, color: '#30D158', icon: 'car', hint: { ru: 'Первый взнос + страховка + регистрация', en: 'Down payment + insurance + registration' } },
    { id: 'wedding', ru: 'Свадьба', en: 'Wedding', type: 'custom', target: 4000000, color: '#FF375F', icon: 'heart', hint: { ru: 'Разбей на зал, одежду, подарки, поездку', en: 'Split into venue, clothes, gifts, trip' } },
    { id: 'education', ru: 'Обучение / курс', en: 'Education / course', type: 'custom', target: 500000, color: '#AC8E68', icon: 'book', hint: { ru: 'Инвестиция в доход — считай окупаемость', en: 'An investment in income — estimate payback' } },
    { id: 'gadget', ru: 'Техника', en: 'Gadget', type: 'custom', target: 400000, color: '#8E8E93', icon: 'laptop', hint: { ru: 'Копи заранее, без рассрочки', en: 'Save first, no instalments' } },
    { id: 'home', ru: 'Жильё / первый взнос', en: 'Home / down payment', type: 'apartment', target: 10000000, color: '#BF5AF2', icon: 'home', hint: { ru: 'Долгая цель — разбей на этапы', en: 'Long goal — split into stages' } },
    { id: 'debt_free', ru: 'Жизнь без долгов', en: 'Debt-free', type: 'short_debt', target: 0, color: '#FF453A', icon: 'target', hint: { ru: 'Сумма = текущий краткосрочный долг', en: 'Amount = current short-term debt' } },
    { id: 'invest_start', ru: 'Стартовый капитал для инвестиций', en: 'Investing starter capital', type: 'custom', target: 1000000, color: '#0A84FF', icon: 'invest', hint: { ru: 'Только после резерва и без долгов под проценты', en: 'Only after the reserve and no interest-bearing debt' } }
  ];
  var BUDGET_TEMPLATES = [
    { id: 'b503020', ru: '50/30/20', en: '50/30/20', split: { needs: .5, wants: .3, save: .2 } },
    { id: 'b702010', ru: '70/20/10 (при долгах)', en: '70/20/10 (with debts)', split: { needs: .7, wants: .1, save: .2 } },
    { id: 'zero', ru: 'Бюджет с нуля (каждый дирхам распределён)', en: 'Zero-based', split: null }
  ];
  function goalStage(pct) {
    if (pct == null || isNaN(pct)) pct = 0;
    if (pct >= 1) return { id: 'done', ru: 'Цель достигнута', en: 'Achieved' };
    if (pct >= .75) return { id: 'final', ru: 'Финишная прямая', en: 'Final stretch' };
    if (pct >= .5) return { id: 'half', ru: 'Больше половины', en: 'Past halfway' };
    if (pct >= .25) return { id: 'momentum', ru: 'Набираю обороты', en: 'Building momentum' };
    if (pct > 0) return { id: 'started', ru: 'Первые шаги', en: 'First steps' };
    return { id: 'start', ru: 'Старт', en: 'Start' };
  }

  /* ---------- daily quote (real, verifiable attributions; tips are unattributed) ---------- */
  var QUOTES = [
    { ru: 'Цена — это то, что ты платишь. Ценность — то, что ты получаешь.', a: 'Уоррен Баффетт со ссылкой на Бенджамина Грэма, письмо акционерам Berkshire Hathaway за 2008 год' },
    { ru: 'Остерегайся мелких расходов: маленькая течь потопит большой корабль.', a: 'Бенджамин Франклин, «Путь к богатству» (1758)' },
    { ru: 'Покупай то, что тебе не нужно, — и скоро продашь то, что необходимо.', a: 'Бенджамин Франклин, «Путь к богатству» (1758)' },
    { ru: 'Лучше лечь спать без ужина, чем проснуться в долгах.', a: 'Бенджамин Франклин, «Путь к богатству» (1758)' },
    { ru: 'Годовой доход двадцать фунтов, годовой расход девятнадцать фунтов девятнадцать шиллингов и шесть пенсов — итог: счастье. Годовой доход двадцать фунтов, годовой расход двадцать фунтов и шесть пенсов — итог: несчастье.', a: 'Чарльз Диккенс, «Дэвид Копперфилд» (мистер Микобер)' },
    { ru: 'Главная проблема инвестора — и даже его злейший враг — скорее всего, он сам.', a: 'Бенджамин Грэм, «Разумный инвестор»' },
    { ru: 'Не ищи иголку в стоге сена. Просто купи весь стог.', a: 'Джон Богл, «The Little Book of Common Sense Investing»' },
    { ru: 'Заработать деньги — одно. Удержать их — совсем другое.', a: 'Морган Хаусел, «Психология денег»' },
    { ru: 'Богатство — это то, чего не видно: машины, которые не купили, часы, от которых отказались.', a: 'Морган Хаусел, «Психология денег» (пересказ)' },
    { ru: 'Сначала заплати себе: часть каждого дохода — в накопления, до любых трат.', a: 'Совет дня' },
    { ru: 'Кредитный лимит — это не твои деньги, а чужие деньги под процент.', a: 'Совет дня' },
    { ru: 'Покупка дороже 200 AED, которая не нужна сегодня, подождёт 24 часа.', a: 'Совет дня' },
    { ru: 'Самый дорогой долг закрывай первым — это гарантированная «доходность», равная его ставке.', a: 'Совет дня' },
    { ru: 'Комиссия 10% за месяц — это больше 100% годовых. Считай стоимость денег в годовых.', a: 'Совет дня' },
    { ru: 'Бюджет — это не запреты, а решение заранее, куда пойдут деньги.', a: 'Совет дня' },
    { ru: 'Резерв на чёрный день превращает кризис в неудобство.', a: 'Совет дня' },
    { ru: 'Записывай каждую трату неделю — и ты увидишь, где утекают деньги.', a: 'Совет дня' },
    { ru: 'Остаток бюджета в конце месяца — не «можно потратить», а «уже накоплено».', a: 'Совет дня' }
  ];
  function quoteOfDay(dateISO) { var d = parseD(dateISO), n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length]; }

  /* ---------- academy schedule & gamification ---------- */
  function weekdayOf(iso) { return (parseD(iso).getDay() + 6) % 7; } // 0 = Monday … 6 = Sunday
  function academyDay(startISO, todayISO) {
    var idx = Math.max(0, C.diffDays(startISO, todayISO)), wd = weekdayOf(todayISO);
    return { dayIndex: idx, week: Math.floor(idx / 7) + 1, dayInWeek: idx % 7 + 1, weekday: wd, assignmentDay: wd === 0 || wd === 1, assignmentSlot: wd === 0 ? 1 : wd === 1 ? 2 : null };
  }
  function academyStreak(doneDates, todayISO) {
    var set = {}; (doneDates || []).forEach(function (d) { set[d] = 1; });
    var d = set[todayISO] ? todayISO : C.addDays(todayISO, -1), n = 0;
    while (set[d]) { n++; d = C.addDays(d, -1); }
    return n;
  }
  var XP_LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
  function academyRank(xp) {
    var i = 0; while (i + 1 < XP_LEVELS.length && xp >= XP_LEVELS[i + 1]) i++;
    var next = XP_LEVELS[i + 1] || null;
    return { rank: i + 1, xp: xp, from: XP_LEVELS[i], next: next, pct: next ? (xp - XP_LEVELS[i]) / (next - XP_LEVELS[i]) : 1 };
  }
  /* assignment slot 1 = Monday, 2 = Tuesday: open once that weekday has come on/after the day the week was reached */
  function academyTaskOpen(reachedISO, todayISO, slot) {
    if (!reachedISO || todayISO < reachedISO) return false;
    var need = slot === 1 ? 0 : 1, wd = weekdayOf(reachedISO), wait = (need - wd + 7) % 7;
    return C.diffDays(reachedISO, todayISO) >= wait;
  }
  function lessonXP(correct, total) { return 10 + 5 * (correct || 0) + (total && correct === total ? 5 : 0); }

  return { spaceOf: spaceOf, spaceView: spaceView, portfolio: portfolio, convert: convert, debtRing: debtRing,
    ensureIncomePlan: ensureIncomePlan, incomeMonth: incomeMonth, incomePlanView: incomePlanView, setIncomeActual: setIncomeActual, setIncomeExpected: setIncomeExpected,
    budgetRemainder: budgetRemainder, sweepBudget: sweepBudget, expenseSummary: expenseSummary, quarterRange: quarterRange,
    GOAL_TEMPLATES: GOAL_TEMPLATES, BUDGET_TEMPLATES: BUDGET_TEMPLATES, goalStage: goalStage, QUOTES: QUOTES, quoteOfDay: quoteOfDay,
    weekdayOf: weekdayOf, academyDay: academyDay, academyStreak: academyStreak, academyRank: academyRank, academyTaskOpen: academyTaskOpen, lessonXP: lessonXP, XP_LEVELS: XP_LEVELS };
});
