/* Akbar Finance 3.1 — v3 dashboard (Личное/Бизнес, All finance ring, debt ring), income year plan, personal budget sweep,
   credit/card create & close flow, rates editor, goal templates, expense summaries. Loaded after the 3.0 screens. */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, CH = App.CH, S = App.S, T = App.T, F = App.F, esc = App.esc;
  var ACC_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#64D2FF', '#FF375F', '#5E5CE6', '#12A07A', '#E5484D', '#AC8E68', '#8E8E93'];

  /* ---------- spaces ---------- */
  App.space = function () { return App.prefs.space === 'business' ? 'business' : 'personal'; };
  App.V = function () { return C.spaceView(S.L, App.space()); };
  App.actions.setSpace = function (el) { App.prefs.space = el.dataset.v; App.savePrefs(); App.render(); };
  App.spaceSeg = function () {
    return '<div class="seg space-seg"><button class="' + (App.space() === 'personal' ? 'on' : '') + '" data-a="setSpace" data-v="personal">' + T('Личное', 'Personal') + '</button><button class="' + (App.space() === 'business' ? 'on' : '') + '" data-a="setSpace" data-v="business">' + T('Бизнес', 'Business') + '</button></div>';
  };

  /* ---------- collapsible sections ---------- */
  App.isCollapsed = function (k) { return !!(App.prefs.collapsed || {})[k]; };
  App.actions.secToggle = function (el) { var k = el.dataset.k; App.prefs.collapsed = App.prefs.collapsed || {}; App.prefs.collapsed[k] = !App.prefs.collapsed[k]; App.savePrefs(); App.render(); };
  function sec(k, title, body, right) {
    var col = App.isCollapsed(k);
    return '<section class="v3sec' + (col ? ' col' : '') + '"><div class="v3sec-h"><button class="v3sec-t" data-a="secToggle" data-k="' + k + '" aria-expanded="' + (!col) + '">' + I('down', 'sm') + '<span>' + esc(title) + '</span></button>' + (right || '') + '</div>' + (col ? '' : '<div class="v3sec-b">' + body + '</div>') + '</section>';
  }
  App.sec = sec;
  function more(screen, extra) { return '<button class="more" data-a="go" data-s="' + screen + '"' + (extra || '') + '>' + T('Все', 'All') + I('chev', 'sm') + '</button>'; }

  /* ---------- rates ---------- */
  App.uzsPerAed = function (L) { var r = (L || S.L).rates.UZS; return r ? 1 / r : null; };
  App.rateCaption = function (L) {
    L = L || S.L; var d = L.rateDates || {}, u = App.uzsPerAed(L), dt = d.UZS || d.USD;
    return T('курс на ', 'rate as of ') + (dt ? App.fd(dt, true) : '—') + T(', вручную', ', manual') + '<br>1&nbsp;USD = ' + esc(String(L.rates.USD || '—').replace('.', ',')) + '&nbsp;AED' + (u ? '<br>1&nbsp;AED = ' + esc(C.fmt(Math.round(u * 100), { lang: App.lang(), cur: 'UZS' })).replace(/\s/g, '&nbsp;') : '');
  };
  function conv(L, v, cur) { var x = C.convert(L, v, cur); return x == null ? '—' : F(x, cur, { dec: cur === 'UZS' ? 0 : 2 }); }

  /* ---------- context for academy & lessons (real numbers, computed at runtime) ---------- */
  App.finCtx = function () {
    var L = S.L, V = C.spaceView(L, 'personal'), m = C.metrics(V, S.today), ds = C.debtSummary(V, S.today);
    var nextYm = C.addMonths(C.ymOf(S.today), 1), mp = C.monthPlan(V, nextYm, { today: S.today });
    var ip = C.incomeMonth(L, nextYm), sal = ip.lines.filter(function (l) { return l.type === 'salary'; })[0];
    var salary = sal ? sal.exp : mp.income, low = sal ? sal.low : salary;
    var debtPay = 0; mp.items.forEach(function (it) { if (it.kind === 'payment') debtPay += -it.amount; });
    var bs = C.budgetStatus(V, C.ymOf(S.today), S.today);
    var f = function (v) { return F(v); };
    return { own: f(m.own), debt: f(ds.total), short: f(ds.short), long: f(ds.long), shortPct: App.pct(ds.total ? ds.short / ds.total : 0), netWorth: f(m.netWorth),
      salary: f(salary), salaryLow: f(low), s50: f(Math.round(salary * .5)), s30: f(Math.round(salary * .3)), s20: f(Math.round(salary * .2)),
      nextIncome: f(mp.income), nextOut: f(mp.out), nextResult: App.FS(mp.result), budget: f(L.budgetPlan.total || 0), budgetSpent: f(bs.total.spent),
      saved: f(m.reserved + m.savings), dti: App.pct(mp.income ? debtPay / mp.income : 0) };
  };
  App.fillCtx = function (s, ctx) { return String(s).replace(/\{(\w+)\}/g, function (m0, k) { return ctx[k] != null ? ctx[k] : m0; }); };

  /* active budget month: the current month while it still has open planned payments, otherwise the next one
     (end-of-month salary funds the next month) */
  App.activeBudgetMonth = function (V) {
    var ym = C.ymOf(S.today), open = V.planned.some(function (p) { return p.budgetMonth === ym && (p.kind === 'payment' || p.kind === 'family') && C.plannedIncluded(p) && C.plannedState(V, p, S.today).open; });
    return open ? ym : C.addMonths(ym, 1);
  };
  /* ---------- dashboard v3 ---------- */
  App.screens.home = function () {
    var L = S.L, V = App.V(), sp = App.space(), m = C.metrics(V, S.today), bal = m.balances;
    var h = App.spaceSeg();
    var own = V.accounts.filter(function (a) { return !C.isLiab(a) && !a.archived && !a.closed; });
    var liabs = V.accounts.filter(function (a) { return C.isLiab(a) && !a.archived && !a.closed; });
    if (sp === 'business' && !V.accounts.length) {
      h += '<div class="card v3empty">' + I('briefcase') + '<div class="b">' + T('Бизнес — отдельное пространство', 'Business is a separate space') + '</div><div class="small muted">' + T('Свои счета, записи и итоги. Личные деньги и долги сюда не попадают — и наоборот.', 'Its own accounts, records and totals. Personal money and debt stay out — and vice versa.') + '</div>' +
        '<button class="btn" data-a="modal" data-m="account" data-space="business">' + I('plus') + T('Создать бизнес-счёт', 'Create a business account') + '</button></div>';
      return { title: T('Главная', 'Dashboard'), html: h };
    }
    if (m.unconvertible.length) h += '<div class="alert warn">' + I('alert') + '<div class="grow">' + T('Нет курса для: ', 'No rate for: ') + esc(m.unconvertible.join(', ')) + '. <a href="#" data-a="go" data-s="currencies">' + T('Указать курс', 'Set rate') + '</a></div></div>';
    // 1. portfolio: All finance
    var pf = C.portfolio(V, S.today);
    var segs = pf.segments.map(function (s) { return { v: s.value, color: s.color, info: '<b>' + esc(s.name) + '</b> · ' + App.pct(s.pct) + '<br>' + esc(F(s.value)) + (pf.mode === 'debt' ? ' · ' + (s.term === 'long' ? T('долгосрочный', 'long-term') : T('краткосрочный', 'short-term')) : '') }; });
    var netCls = pf.net < 0 ? 'neg' : 'pos';
    var center = '<div><div class="rc-k">All finance</div><div class="rc-v num ' + netCls + '">' + esc(F(pf.net, 'AED', { dec: Math.abs(pf.net) >= 10000000 ? 0 : 2 }).replace(/\s?AED$/, '')) + '</div><div class="rc-u">AED</div></div>';
    h += '<div class="v3top"><div class="card v3pf"><div class="v3ring-row">' + CH.rings({ id: 'pfRing', size: 168, rings: [{ w: 16, items: segs.length ? segs : [{ v: 1, color: 'var(--card2)' }] }], centerHtml: center }) +
      '<div class="v3side"><div class="v3lbl">' + T('Общий баланс', 'Total balance') + '</div><div class="v3big num ' + netCls + '">' + esc(F(pf.net).replace(/\s?AED$/, '')) + ' <small>AED</small></div>' +
      '<div class="small muted num">≈ ' + esc(conv(V, pf.net, 'USD')) + '<br>≈ ' + esc(conv(V, pf.net, 'UZS')) + '</div>' +
      (pf.debt ? '<div class="small b mt8">' + T('Краткосрочные ', 'Short-term ') + App.pct(pf.shortPct) + '<br>' + T('Долгосрочные ', 'Long-term ') + App.pct(pf.longPct) + '</div>' : '') +
      '<button class="v3rate" data-a="go" data-s="currencies">' + App.rateCaption(V) + '</button></div></div>' +
      '<div id="pfRing-info" class="ring-info hidden"></div>' +
      '<div class="tiny muted mt8">' + (pf.mode === 'debt' ? T('Баланс отрицательный: кольцо показывает доли кредиторов в долге. Нажми на сегмент.', 'Balance is negative: the ring shows each creditor\'s share of debt. Tap a segment.') : T('Кольцо — доли счетов в собственных средствах. Нажми на сегмент.', 'The ring shows each account\'s share of own money. Tap a segment.')) + ' ' + T('Общий баланс = собственные средства − все долги.', 'Total balance = own money − all debt.') + '</div>' +
      '<div class="v3legend">' + pf.segments.map(function (s) { return '<div class="leg"><i style="background:' + s.color + '"></i><span class="leg-n ellipsis">' + esc(s.name) + '</span><span class="leg-p num">' + App.pct(s.pct) + '</span><span class="leg-v num">' + esc(F(s.value)) + '</span></div>'; }).join('') + '</div></div>';
    // 2. debt ring
    var dr = C.debtRing(V, S.today);
    if (dr.total > 0) {
      var outer = [{ v: dr.short, color: '#FF9F0A', pctLabel: App.pct(dr.shortPct), info: '<b>' + T('Краткосрочные', 'Short-term') + '</b> · ' + App.pct(dr.shortPct) + '<br>' + esc(F(dr.short)) }, { v: dr.long, color: '#FF453A', pctLabel: App.pct(dr.longPct), info: '<b>' + T('Долгосрочные', 'Long-term') + '</b> · ' + App.pct(dr.longPct) + '<br>' + esc(F(dr.long)) }];
      var inner = dr.inner.map(function (r) { return { v: r.value, color: r.color, info: '<b>' + esc(r.name) + '</b> · ' + App.pct(r.pct) + T(' долга', ' of debt') + '<br>' + T('Долг ', 'Debt ') + esc(F(r.value)) + '<br>' + (r.next ? T('Следующий платёж: ', 'Next payment: ') + esc(F(r.next.amount)) + T(' до ', ' by ') + esc(App.fd(r.next.date, true)) : T('Платёж не запланирован', 'No payment planned')) }; });
      var dc = '<div><div class="rc-k">' + T('100% долга', '100% of debt') + '</div><div class="rc-v num neg">' + esc(F(-dr.total, 'AED', { dec: 0 }).replace(/\s?AED$/, '')) + '</div><div class="rc-u">' + T('погашено ', 'repaid ') + App.pct(dr.repaidPct, 0) + '</div></div>';
      h += sec('debt', T('Долг', 'Debt'), '<div class="card v3debt"><div class="v3ring-row">' + CH.rings({ id: 'debtRing', size: 176, gap: 3, rings: [{ w: 20, items: outer, labels: true, labelSize: 10 }, { w: 12, items: inner }], centerHtml: dc }) +
        '<div class="v3boxes"><div class="box"><div class="p" style="color:#FF9F0A">' + App.pct(dr.shortPct) + '</div><div class="l">' + T('Краткосрочные', 'Short-term') + '<br><span class="num">' + esc(F(dr.short)) + '</span></div></div><div class="box"><div class="p" style="color:#FF453A">' + App.pct(dr.longPct) + '</div><div class="l">' + T('Долгосрочные', 'Long-term') + '<br><span class="num">' + esc(F(dr.long)) + '</span></div></div></div></div>' +
        '<div id="debtRing-info" class="ring-info hidden"></div><div class="tiny muted mt8">' + T('Внешнее кольцо — краткосрочные и долгосрочные (100%). Внутреннее — кредиторы. Нажми на сегмент: сумма и следующий платёж.', 'Outer ring: short vs long-term (100%). Inner ring: creditors. Tap a segment for amount and next payment.') + '</div></div>',
        '<button class="more" data-a="go" data-s="debts">Debt Freedom' + I('chev', 'sm') + '</button>');
    }
    h += '</div>';
    // warnings (top 2)
    var notes = C.notifications(V, S.today).filter(function (n) { return !n.dismissed && (n.level === 'danger' || n.level === 'warn'); });
    if (notes.length) h += notes.slice(0, 2).map(App.noteHtml).join('') + (notes.length > 2 ? '<button class="linkbtn" data-a="go" data-s="notifications">' + T('Ещё предупреждения: ', 'More warnings: ') + (notes.length - 2) + '</button>' : '');
    // KPI strip
    var bym = App.activeBudgetMonth(V), mp = C.monthPlan(V, bym, { today: S.today, scenarios: S.ui.scen.reborrow ? ['reborrow'] : [] });
    h += '<div class="v3kpis">' + App.kpi(T('Собственные средства', 'Own money'), F(m.own), m.own < 0 ? 'neg' : '') + App.kpi(T('Обязательства · ', 'Obligations · ') + App.fymShort(bym), F(-mp.out), 'neg') + App.kpi(T('Итог месяца по плану', 'Month result (plan)'), App.FS(mp.result), mp.result < 0 ? 'neg' : 'pos') + App.kpi(T('Чистый капитал', 'Net worth'), F(m.netWorth), m.netWorth < 0 ? 'neg' : 'pos') + '</div>';
    // quote of the day
    var q = C.quoteOfDay(S.today);
    if (!App.isCollapsed('quote')) h += '<div class="card v3quote"><span class="qmark">«</span><div class="grow"><p>' + esc(q.ru) + '</p><div class="who">' + esc(q.a) + '</div></div><button class="iconbtn sm" data-a="secToggle" data-k="quote" aria-label="hide">' + I('close', 'sm') + '</button></div>';
    // obligations of the budget month (personal budget included)
    if (sp === 'personal') h += sec('oblig', T('Обязательные · ', 'Obligations · ') + App.fym(bym).replace(/\s\d{4}$/, ''), obligations(V, mp, bym), more('monthplan'));
    // personal budget envelope & remainder → savings
    if (sp === 'personal' && (L.budgetPlan.total || 0) > 0) h += sec('budget', T('Личный бюджет', 'Personal budget'), budgetCard(V), more('budgets'));
    // charts
    h += sec('charts', T('Графики', 'Charts'), chartsCard(V, m));
    // accounts
    h += sec('accounts', T('Мои счета', 'My accounts'), '<div class="acc-grid">' + own.map(function (a) { return App.accTile(a, bal); }).join('') + '<button class="acc-tile add" data-a="modal" data-m="account" data-space="' + sp + '">' + I('plus', 'sm') + T('Счёт', 'Account') + '</button></div>', more('accounts'));
    h += sec('credits', T('Кредиты и карты', 'Loans & cards'), '<div class="acc-grid">' + liabs.map(function (a) { return App.accTile(a, bal); }).join('') + '<button class="acc-tile add" data-a="modal" data-m="newCredit" data-space="' + sp + '">' + I('plus', 'sm') + T('Кредит / карта', 'Loan / card') + '</button></div>', '<button class="more" data-a="go" data-s="debts">Debt Freedom' + I('chev', 'sm') + '</button>');
    // goals
    var goals = (V.goals || []).map(function (g) { return C.goalStatus(L, g, S.today); });
    h += sec('goals', T('Цели', 'Goals'), '<div class="v3goals">' + goals.slice(0, 6).map(goalCard).join('') + '<button class="gcard add" data-a="modal" data-m="goalTpl">' + I('plus') + '<span>' + T('Новая цель', 'New goal') + '</span></button></div>', more('goals'));
    // academy teaser
    if (sp === 'personal' && App.academyTeaser) h += App.academyTeaser();
    // upcoming & recent
    var up = C.upcoming(V, S.today, 21).slice(0, 6);
    h += sec('upcoming', T('Ближайшие 3 недели', 'Next 3 weeks'), '<div class="list">' + (up.length ? up.map(function (x) { return App.plannedRow(x.p, x.st); }).join('') : '<div class="empty">' + T('Платежей нет', 'Nothing due') + '</div>') + '</div>', more('planned'));
    var recent = App.sortTx(V.transactions).slice(0, 5);
    h += sec('recent', T('Последние записи', 'Last records'), recent.length ? '<div class="list">' + recent.map(function (t) { return App.txRow(t); }).join('') + '</div>' : '<div class="list"><div class="empty">' + T('Записей пока нет. Нажми «+», чтобы добавить.', 'No records yet. Tap “+”.') + '</div></div>', more('records'));
    return { title: T('Главная', 'Dashboard'), html: h };
  };

  function obligations(V, mp, ym) {
    var rows = mp.items.filter(function (it) { return it.amount < 0; }).map(function (it) {
      if (it.kind === 'personal') return '<div class="row"><span class="cat-ic" style="background:#FF9F0A">' + I('cart') + '</span><div class="main-t"><div class="t1">' + T('Личный бюджет', 'Personal budget') + '</div><div class="t2">' + T('потрачено ', 'spent ') + esc(F(it.actual)) + T(' · остаток в конце месяца → накопления (по подтверждению)', ' · month-end remainder → savings (on confirmation)') + '</div></div><div class="amt num">' + esc(F(it.amount)) + '</div></div>';
      if (it.kind === 'unplannedOut') return '<div class="row"><span class="cat-ic" style="background:#8E8E93">' + I('receipt') + '</span><div class="main-t"><div class="t1">' + T('Внеплановые платежи', 'Unplanned payments') + '</div></div><div class="amt num">' + esc(F(it.amount)) + '</div></div>';
      var a = it.accountId && App.acc(it.accountId);
      return '<button class="row tap" data-a="modal" data-m="editPlanned" data-id="' + it.id + '"><span class="cat-ic" style="background:' + (a ? a.color : it.kind === 'family' ? 'var(--savings)' : 'var(--planned)') + '">' + I(a ? a.icon || 'card' : it.kind === 'family' ? 'family' : 'calendar') + '</span><div class="main-t"><div class="t1">' + esc(it.title) + (it.scenario ? ' <span class="tag">' + T('сценарий', 'scenario') + '</span>' : '') + '</div><div class="t2">' + esc(App.fd(it.date)) + ' · ' + App.pTag(it.status) + '</div></div><div class="amt num">' + esc(F(it.amount)) + '</div></button>';
    });
    var inc = mp.items.filter(function (it) { return it.amount > 0 && it.kind !== 'unplannedIn'; });
    return '<div class="list">' + rows.join('') + '<div class="row total"><div class="main-t"><div class="t1">' + T('Итого обязательств', 'Total obligations') + '</div><div class="t2">' + T('поступления по плану ', 'planned inflows ') + esc(F(mp.income)) + (inc.some(function (i) { return i.kind === 'borrow'; }) ? T(' (включая займы — это не доход)', ' (incl. loans — not income)') : '') + '</div></div><div class="amt num neg">' + esc(F(-mp.out)) + '</div></div>' +
      '<div class="row total"><div class="main-t"><div class="t1">' + T('Остаток по плану', 'Planned remainder') + '</div></div><div class="amt num ' + (mp.result < 0 ? 'neg' : 'pos') + '">' + esc(App.FS(mp.result)) + '</div></div></div>';
  }

  function budgetCard(V) {
    var ym = C.ymOf(S.today), br = C.budgetRemainder(V, ym, S.today), prev = C.addMonths(ym, -1), bp = C.budgetRemainder(S.L, prev, S.today);
    var pct = br.limit ? Math.min(1, br.spent / br.limit) : 0, h = '<div class="card">';
    h += '<div class="split"><span class="small muted">' + esc(App.fym(ym)) + '</span><span class="num b">' + esc(F(br.spent)) + ' / ' + esc(F(br.limit)) + '</span></div><div class="bar mt8"><i style="width:' + pct * 100 + '%;background:' + (br.over ? 'var(--expense)' : 'var(--accent)') + '"></i></div>';
    h += '<div class="split mt8 small"><span class="muted">' + (br.over ? T('Перерасход', 'Over budget') : T('Осталось', 'Left')) + '</span><span class="num ' + (br.over ? 'neg' : 'pos') + '">' + esc(F(br.over || br.remainder)) + '</span></div>';
    var showSweep = function (r, label) { return '<div class="alert info mt8">' + I('piggy') + '<div class="grow">' + label + '</div><button class="act" data-a="modal" data-m="sweep" data-ym="' + r.ym + '">' + T('Перевести', 'Transfer') + '</button></div>'; };
    if (bp.limit && bp.ended && !bp.swept && bp.remainder > 0 && prev >= C.ymOf(S.L.meta.asOf || S.today)) h += showSweep(bp, T('Остаток бюджета за ', 'Budget remainder for ') + esc(App.fym(prev)) + ': ' + esc(F(bp.remainder)) + T(' → в накопления?', ' → to savings?'));
    if (br.swept) h += '<div class="tiny muted mt8">' + I('check', 'sm') + T(' Остаток переведён в накопления: ', ' Remainder moved to savings: ') + esc(F(br.sweptAmount)) + '</div>';
    else if (br.due && br.remainder > 0) h += showSweep(br, T('Конец месяца: остаток ', 'Month end: remainder ') + esc(F(br.remainder)) + T(' → в накопления?', ' → to savings?'));
    else h += '<div class="tiny muted mt8">' + T('В последние дни месяца здесь появится предложение перевести остаток в накопления. Перевод создаётся только после твоего подтверждения — автоматически приложение деньги не двигает.', 'In the last days of the month you will be offered to move the remainder to savings. The transfer is created only after you confirm — the app never moves money automatically.') + '</div>';
    return h + '</div>';
  }

  function goalCard(gs) {
    var g = gs.goal, st = C.goalStage(gs.pct);
    return '<button class="gcard" data-a="go" data-s="goals"><div class="gt ellipsis2">' + esc(g.title) + '</div><div class="gp num" style="color:' + (g.color || 'var(--accent)') + '">' + App.pct(gs.pct, 0) + '</div><div class="gs">' + esc(T(st.ru, st.en)) + '</div><div class="bar thin"><i style="width:' + Math.min(100, gs.pct * 100) + '%;background:' + (g.color || 'var(--accent)') + '"></i></div></button>';
  }

  function chartsCard(V, m) {
    var ym0 = C.ymOf(S.today), rows = C.planSeries(V, ym0, 6, { today: S.today, scenarios: S.ui.scen.reborrow ? ['reborrow'] : [] });
    var bars = CH.bars({ id: 'v3flow', height: 150, groups: rows.map(function (r) { return { label: App.fymShort(r.ym), tip: App.fym(r.ym) + ' · ' + T('итог ', 'result ') + App.FS(r.result), values: [{ v: r.income, color: 'var(--income)', name: T('Поступления', 'Inflows') }, { v: r.out, color: 'var(--expense)', name: T('Обязательства', 'Obligations') }] }; }),
      fmtTip: function (v) { return F(v); }, legend: [{ name: T('Поступления', 'Inflows'), color: 'var(--income)' }, { name: T('Обязательства', 'Obligations'), color: 'var(--expense)' }] });
    // debt & net worth projection by plan (no new events assumed)
    var proj = debtProjection(V, 12), pts = proj.map(function (p) { return { x: p.ym + '-01', y: -p.debt + m.own }; });
    var line = CH.line({ id: 'v3nw', height: 150, zero: true, series: [{ name: T('Общий баланс по плану', 'Total balance by plan'), color: 'var(--accent)', fill: true, points: pts }], fmtTip: function (v) { return F(v); }, fmtX: function (d) { return App.fymShort(d.slice(0, 7)); } });
    return '<div class="v3charts"><div class="card"><div class="card-h"><span class="t small">' + T('Денежный поток по бюджетным месяцам (план)', 'Cash flow by budget month (plan)') + '</span></div>' + bars + '</div>' +
      '<div class="card"><div class="card-h"><span class="t small">' + T('Общий баланс: прогноз по плану платежей', 'Total balance: projection by payment plan') + '</span></div>' + line + '<div class="tiny muted mt8">' + T('Долг уменьшается на плановые погашения тела и растёт на плановые займы. Собственные средства взяты на сегодня — без будущих накоплений. Это ориентир, а не факт.', 'Debt drops by planned principal repayments and grows by planned borrowing. Own money is today\'s — future savings not included. An estimate, not a fact.') + '</div></div></div>';
  }
  function debtProjection(V, n) {
    var ds = C.debtSummary(V, S.today), debt = ds.total, ym0 = C.ymOf(S.today), out = [], rows = V.planned.filter(function (p) { return C.plannedIncluded(p, { scenarios: S.ui.scen.reborrow ? ['reborrow'] : [] }); });
    for (var i = 0; i < n; i++) {
      var ym = C.addMonths(ym0, i);
      rows.forEach(function (p) {
        if (p.date.slice(0, 7) !== ym) return; var st = C.plannedState(V, p, S.today);
        var a = p.accountId && C.byId(V.accounts, p.accountId); if (!a || !C.isLiab(a)) return;
        if (p.kind === 'payment' && st.open) debt -= C.toBase(V, p.interestPart ? Math.round(st.remaining * (1 - p.interestPart / p.amount)) : st.remaining, p.currency) || 0;
        if (p.kind === 'borrow' && !p.confirmed) debt += C.toBase(V, p.debtAmount || p.amount, p.currency) || 0;
      });
      out.push({ ym: ym, debt: Math.max(0, debt) });
    }
    return out;
  }
  App.debtProjection = debtProjection;
})();
