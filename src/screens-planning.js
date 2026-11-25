/* Planning: planned payments, budgets, income plan, calendar, goals, debt freedom, family, budget periods */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, CH = App.CH, S = App.S, T = App.T, F = App.F, esc = App.esc, kpi = App.kpi, kv = App.kv;
  App.scenLabel = function () { var b = (S.L.planned || []).filter(function (p) { return p.scenario === 'reborrow' && p.kind === 'borrow'; })[0]; return T('Сценарий: ', 'Scenario: ') + (b ? b.title.replace(/\s*\((сценарий|scenario)\)\s*$/i, '') + ' · ' + F(b.amount) : T('повторный заём', 're-borrowing')); };
  function scen() { return S.ui.scen.reborrow ? ['reborrow'] : []; }
  App.scen = scen;
  App.planCard = function (title, body, go, extra) { return card(title, body, go, extra); };
  function card(title, body, go, extra) { return '<div class="card tap" data-a="go" data-s="' + go + '"' + (extra || '') + '><div class="card-h"><span class="t">' + title + '</span><span class="more">' + I('chev', 'sm') + '</span></div>' + body + '</div>'; }

  App.screens.planning = function () {
    var L = S.L, B = {};
    var up = C.upcoming(L, S.today, 45).filter(function (x) { return x.p.kind === 'payment' || x.p.kind === 'family'; });
    B.planned = card('Planned Payments · ' + T('Платежи', 'Payments'), '<div class="kpis">' + kpi(T('В ближайшие 45 дней', 'Next 45 days'), F(C.sum(up, function (x) { return x.st.remaining; })), 'plan', up.length + T(' платежей', ' items')) + kpi(T('Просрочено', 'Overdue'), String(up.filter(function (x) { return x.st.status === 'overdue'; }).length), 'neg') + '</div>' + up.slice(0, 3).map(function (x) { return '<div class="split small mt8"><span class="ellipsis">' + esc(App.fd(x.p.date)) + ' · ' + esc(x.p.title) + '</span><span class="num plan">' + esc(F(x.st.remaining)) + '</span></div>'; }).join(''), 'planned');
    var bs = C.budgetStatus(L, C.ymOf(S.today), S.today);
    B.budgets = card('Budgets · ' + T('Бюджеты', 'Budgets'), '<div class="split small"><span class="muted">' + T('Личные расходы', 'Personal spending') + '</span><span class="num">' + esc(F(bs.total.spent)) + ' / ' + esc(F(bs.total.limit)) + '</span></div><div class="bar mt8"><i style="width:' + Math.min(100, bs.total.pct * 100) + '%;background:' + (bs.total.exceeded ? 'var(--expense)' : 'var(--income)') + '"></i></div><div class="tiny muted mt8">' + T('Можно тратить в день: ', 'Daily allowance: ') + esc(F(bs.total.daily)) + '</div>', 'budgets');
    var nextInc = L.planned.filter(function (p) { return p.kind === 'income' && !p.confirmed && !p.scenario; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    var end12 = C.addMonths(C.ymOf(S.today), 11), incPlan = C.sum(L.planned.filter(function (p) { return p.kind === 'income' && !p.scenario && C.ymOf(p.date) >= C.ymOf(S.today) && C.ymOf(p.date) <= end12; }), function (p) { return p.amount; });
    B.income = card('Income Plan · ' + T('Доходы', 'Income'), '<div class="kpis">' + kpi(T('Ожидается за 12 мес.', 'Expected in 12 mo'), F(incPlan), 'pos') + kpi(T('Следующее', 'Next'), nextInc ? F(nextInc.amount) : '—', 'plan', nextInc ? App.fd(nextInc.date, true) + ' → ' + App.fymShort(nextInc.budgetMonth) : '') + '</div>', 'income');
    var fc = C.dailyForecast(L, S.today, 62, { scenarios: scen() });
    B.calendar = card('Financial Calendar · ' + T('Календарь', 'Calendar'), fc.firstDeficit ? '<div class="alert danger">' + I('alert') + '<div class="grow">' + T('Возможный дефицит с ', 'Possible deficit from ') + esc(App.fd(fc.firstDeficit, true)) + ' (' + esc(F(fc.min)) + ')</div></div>' : '<div class="alert ok">' + I('check') + '<div class="grow">' + T('Дефицит в ближайшие 2 месяца не прогнозируется', 'No deficit projected in the next 2 months') + '</div></div>', 'calendar');
    var goals = (L.goals || []).map(function (g) { return C.goalStatus(L, g, S.today); });
    B.goals = card('Financial Goals · ' + T('Цели', 'Goals'), '<div style="display:flex;gap:10px;overflow:hidden">' + goals.slice(0, 5).map(function (gs) { return '<div class="center" style="flex:1;min-width:0">' + CH.ring(gs.pct, gs.goal.color || 'var(--savings)', 54, '<span class="tiny b">' + Math.round(gs.pct * 100) + '%</span>') + '<div class="tiny muted ellipsis mt8">#' + (gs.goal.n || '') + ' ' + esc(gs.goal.title) + '</div></div>'; }).join('') + '</div>', 'goals');
    var ds = C.debtSummary(L, S.today);
    B.debts = card('Debt Repayment · ' + T('Долги', 'Debts'), '<div class="kpis">' + kpi(T('Общий долг', 'Total debt'), F(ds.total), 'neg') + kpi(T('Краткосрочный', 'Short-term'), F(ds.short), 'neg') + '</div><div class="bar mt12"><i style="width:' + (ds.initialTotal ? (1 - ds.total / ds.initialTotal) * 100 : 0) + '%;background:var(--income)"></i></div><div class="tiny muted mt8">' + T('Погашено основного долга: ', 'Principal repaid: ') + esc(F(ds.repaidTotal)) + '</div>', 'debts');
    var fs = C.familyStatus(L, S.today);
    B.family = card('Family Support · ' + T('Родителям', 'Parents'), '<div class="kpis">' + kpi(T('План', 'Plan'), F(fs.planTotal), 'sav') + kpi(T('Отправлено', 'Sent'), F(fs.sentTotal), 'sav') + '</div>', 'family');
    var first = C.simStartYm(L, S.today), mp1 = C.monthPlan(L, first, { today: S.today, scenarios: scen() }), mp2 = C.monthPlan(L, C.addMonths(first, 1), { today: S.today, scenarios: scen() });
    B.monthplan = card(T('Бюджетные периоды', 'Budget periods'), '<div class="kpis">' + kpi(App.fym(first), F(mp1.result), mp1.result < 0 ? 'neg' : 'pos') + kpi(App.fym(C.addMonths(first, 1)), F(mp2.result), mp2.result < 0 ? 'neg' : 'pos') + '</div><div class="tiny muted mt8">' + T('Доход конца месяца финансирует следующий месяц', 'End-of-month income funds the next month') + (S.ui.scen.reborrow ? ' · ' + T('со сценарием займа', 'with loan scenario') : '') + '</div>', 'monthplan');
    B.simulator = card(T('Сценарный симулятор', 'Scenario simulator'), '<div class="small muted">' + T('Негативный / базовый / оптимистичный — без изменения реальных данных', 'Negative / base / optimistic — without touching real data') + '</div>', 'simulator');
    B.purchase = card(T('Могу ли я позволить себе покупку?', 'Can I afford it?'), '<div class="small muted">' + T('Проверка влияния покупки на план', 'Check a purchase against the plan') + '</div>', 'purchase');
    return App.planHub ? App.planHub(B) : { title: T('Планирование', 'Planning'), html: '<div class="grid2">' + Object.keys(B).map(function (k) { return B[k]; }).join('') + '</div>' };
  };

  /* ---------- planned payments list ---------- */
  App.screens.planned = function () {
    var L = S.L, flt = S.ui.plFlt || 'open', kind = S.ui.plKind || '';
    var list = L.planned.filter(function (p) {
      if (kind && p.kind !== kind && !(kind === 'scenario' && p.scenario)) return false;
      if (kind !== 'scenario' && p.scenario && !S.ui.scen.reborrow) return false;
      var st = C.plannedState(L, p, S.today);
      if (flt === 'open') return st.open || ((p.kind === 'income' || p.kind === 'borrow') && !p.confirmed && st.status !== 'skipped');
      if (flt === 'done') return !st.open;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var h = '<div class="seg">' + [['open', T('Предстоящие', 'Upcoming')], ['done', T('Выполненные', 'Done')], ['all', T('Все', 'All')]].map(function (x) { return '<button class="' + (flt === x[0] ? 'on' : '') + '" data-a="plFlt" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="chips">' + [['', T('Все типы', 'All kinds')], ['payment', T('Платежи', 'Payments')], ['income', T('Доходы', 'Income')], ['family', T('Родителям', 'Parents')], ['scenario', T('Сценарии', 'Scenarios')]].map(function (x) { return '<button class="chip' + (kind === x[0] ? ' on' : '') + '" data-a="plKind" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var byM = {}, order = [];
    list.forEach(function (p) { var ym = C.ymOf(p.date); if (!byM[ym]) { byM[ym] = []; order.push(ym); } byM[ym].push(p); });
    h += order.length ? order.map(function (ym) {
      var tot = C.sum(byM[ym].filter(function (p) { return p.kind === 'payment' || p.kind === 'family'; }), function (p) { var st = C.plannedState(L, p, S.today); return st.open ? st.remaining : 0; });
      return '<div class="group-h"><span>' + esc(App.fym(ym)) + '</span><span class="num">' + (tot ? '−' + esc(F(tot)) : '') + '</span></div><div class="list" style="margin-top:0">' + byM[ym].map(function (p) { return App.plannedRow(p, C.plannedState(L, p, S.today)); }).join('') + '</div>';
    }).join('') : '<div class="card empty">' + T('Нет плановых операций', 'No planned items') + '</div>';
    h += '<div class="btns"><button class="btn" data-a="modal" data-m="editPlanned" data-kind="payment">' + I('plus') + T('Платёж', 'Payment') + '</button><button class="btn sec" data-a="modal" data-m="editPlanned" data-kind="income">' + I('plus') + T('Доход', 'Income') + '</button></div>';
    h += '<div class="tiny muted mt8">' + T('Плановые операции не меняют фактические балансы, пока вы не подтвердите оплату или поступление. Повторное подтверждение не создаёт дубль.', 'Planned items do not change actual balances until you confirm them. Re-confirming never creates a duplicate.') + '</div>';
    return { title: T('Плановые платежи', 'Planned payments'), html: h, right: '<button class="iconbtn" data-a="modal" data-m="editPlanned" data-kind="payment">' + I('plus') + '</button>' };
  };
  App.actions.plFlt = function (el) { S.ui.plFlt = el.dataset.v; App.render(); };
  App.actions.plKind = function (el) { S.ui.plKind = el.dataset.v; App.render(); };

  /* ---------- budgets ---------- */
  App.screens.budgets = function () {
    var L = S.L, ym = S.ui.budYm || C.ymOf(S.today), bs = C.budgetStatus(L, ym, S.today), h = '';
    h += monthNav('budYm', ym);
    var t = bs.total;
    h += '<div class="card"><div class="split"><span class="b">' + T('Личный бюджет', 'Personal budget') + '</span><button class="small acc" data-a="modal" data-m="budgetTotal">' + I('edit', 'sm') + '</button></div><div class="num" style="font-size:28px;font-weight:700;margin-top:6px">' + esc(F(t.spent)) + ' <span class="muted" style="font-size:16px">/ ' + esc(F(t.limit)) + '</span></div>' +
      '<div class="bar mt8"><i style="width:' + Math.min(100, t.pct * 100) + '%;background:' + (t.exceeded ? 'var(--expense)' : t.pct > .8 ? 'var(--planned)' : 'var(--income)') + '"></i></div><div class="kpis mt12">' + kpi(T('Остаток', 'Remaining'), F(t.remaining), t.remaining < 0 ? 'neg' : 'pos') + kpi(T('Использовано', 'Used'), App.pct(t.pct, 0)) + kpi(T('Можно в день', 'Per day'), F(t.daily), '', bs.daysLeft + T(' дн. осталось', ' days left')) + kpi(T('Прогноз перерасхода', 'Projected overrun'), F(t.overrun), t.overrun ? 'neg' : '', T('прогноз ', 'forecast ') + F(t.forecast)) + '</div>' +
      '<div class="tiny muted mt8">' + esc(L.budgetPlan.note || '') + ' ' + T('Это план, а не совершённые расходы.', 'This is a plan, not actual spending.') + '</div></div>';
    h += '<div class="sec-h"><span class="t">' + T('Категории с лимитом', 'Category limits') + '</span><button data-a="go" data-s="categories">' + T('Все категории', 'All categories') + '</button></div><div class="list">';
    h += bs.rows.map(function (r) {
      var c = App.cat(r.id);
      return '<button class="row tap" data-a="modal" data-m="category" data-id="' + r.id + '">' + App.catIcon(c) + '<div class="main-t"><div class="split"><span class="t1">' + esc(App.catName(c)) + '</span><span class="num small">' + esc(F(r.spent)) + ' / ' + esc(F(r.limit)) + '</span></div><div class="bar thin mt8"><i style="width:' + Math.min(100, r.pct * 100) + '%;background:' + (r.exceeded ? 'var(--expense)' : c.color) + '"></i></div><div class="t2">' + T('осталось ', 'left ') + esc(F(r.remaining)) + ' · ' + App.pct(r.pct, 0) + ' · ' + T('в день ', 'per day ') + esc(F(r.daily)) + (r.overrun ? ' · <span class="neg">' + T('перерасход ~', 'overrun ~') + esc(F(r.overrun)) + '</span>' : '') + '</div></div></button>';
    }).join('') + '</div>';
    var sumLim = C.sum(bs.rows, function (r) { return r.limit; });
    if (sumLim !== L.budgetPlan.total) h += '<div class="alert info">' + I('info') + '<div class="grow">' + T('Сумма лимитов категорий ', 'Sum of category limits ') + esc(F(sumLim)) + T(' отличается от общего плана ', ' differs from the total plan ') + esc(F(L.budgetPlan.total)) + '</div></div>';
    var other = Object.keys(bs.spent).filter(function (k) { var c = App.cat(k); return c && !c.limit && !(c.parent && (App.cat(c.parent) || {}).limit); });
    if (other.length) h += '<div class="sec-h"><span class="t small">' + T('Без лимита', 'Without limit') + '</span></div><div class="list">' + other.map(function (k) { return '<div class="row">' + App.catIcon(k) + '<div class="main-t t1">' + esc(App.catName(k)) + '</div><div class="amt num">' + esc(F(bs.spent[k])) + '</div></div>'; }).join('') + '</div>';
    return { title: 'Budgets', html: h };
  };
  function monthNav(key, ym) { return '<div class="seg" style="margin-bottom:6px"><button data-a="monthNav" data-k="' + key + '" data-d="-1">‹</button><button class="on" style="flex:4">' + esc(App.fym(ym)) + '</button><button data-a="monthNav" data-k="' + key + '" data-d="1">›</button></div>'; }
  App.monthNav = monthNav;
  App.actions.monthNav = function (el) { var k = el.dataset.k; S.ui[k] = C.addMonths(S.ui[k] || (k === 'planYm' ? C.simStartYm(S.L, S.today) : C.ymOf(S.today)), +el.dataset.d); App.render(); };
  App.modals.budgetTotal = function (m) { if (!m.inited) { m.inited = true; m.f.total = App.amtStr(S.L.budgetPlan.total); } return { title: T('Личный бюджет в месяц', 'Monthly personal budget'), html: '<div class="form">' + App.group('', App.fld(T('Сумма', 'Amount') + ' (AED)', App.inp('total', m.f.total, { num: true }))) + '</div>', done: 'saveBudgetTotal', doneLabel: T('Сохранить', 'Save') }; };
  App.actions.saveBudgetTotal = function () { var v = App.toMinor(S.modal.f.total); if (v == null) return; App.commit(T('Бюджет изменён', 'Budget updated'), function (L) { L.budgetPlan.total = v; }); App.closeModal(); };

  /* ---------- income plan ---------- */
  App.screens.income = function () {
    var L = S.L, incEnd = C.addMonths(C.ymOf(S.today), 11), incs = L.planned.filter(function (p) { return p.kind === 'income' && !p.scenario && C.ymOf(p.date) <= incEnd; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }), h = '';
    var totP = C.sum(incs, function (p) { return p.amount; }), totA = C.sum(incs, function (p) { return C.plannedState(L, p, S.today).paid; });
    h += '<div class="kpis">' + kpi(T('Ожидаемые поступления', 'Expected income'), F(totP), 'plan') + kpi(T('Фактически подтверждено', 'Confirmed actual'), F(totA), 'pos') + '</div>';
    h += '<div class="dashed-note">' + T('Все будущие поступления — прогноз. Поступление конца месяца финансирует бюджет следующего месяца, но фактически зачисляется на счёт в день получения. Возврат долга тебе учитывается как возврат собственных средств, а не доход.', 'All future income is a forecast. End-of-month income funds the next budget month but is credited on the day received. Loans returned to you count as your own money coming back, not income.') + '</div>';
    var bars = incs.map(function (p) { var st = C.plannedState(L, p, S.today); return { label: App.fymShort(p.budgetMonth), tip: App.fym(p.budgetMonth), values: [{ v: p.amount, color: 'var(--income)', planned: true, name: T('план', 'plan') }, { v: st.paid, color: 'var(--income)', name: T('факт', 'actual') }] }; });
    h += '<div class="card"><div class="card-h"><span class="t">' + T('План и факт по бюджетным месяцам', 'Plan vs actual by budget month') + '</span></div>' + CH.bars({ id: 'incBars', groups: bars, fmtTip: function (v) { return F(v); }, legend: [{ name: T('План', 'Plan'), color: 'var(--income)', planned: true }, { name: T('Факт', 'Actual'), color: 'var(--income)' }] }) + '</div>';
    h += incs.map(function (p) {
      var st = C.plannedState(L, p, S.today), diff = p.confirmed ? st.paid - p.amount : null;
      var srcs = {}; st.txs.forEach(function (t) { var n = App.catName(t.categoryId); srcs[n] = (srcs[n] || 0) + t.amount; });
      var openOb = C.sum(L.planned.filter(function (q) { return q.budgetMonth === p.budgetMonth && (q.kind === 'payment' || q.kind === 'family') && !q.scenario; }), function (q) { return C.plannedState(L, q, S.today).remaining; });
      return '<div class="card"><div class="split"><div><div class="b">' + T('Бюджет: ', 'Budget: ') + esc(App.fym(p.budgetMonth)) + '</div><div class="small muted">' + T('поступление ', 'received ') + esc(App.fd(p.date, true)) + ' · ' + esc(p.employer || p.title) + '</div></div>' + App.pTag(st.status) + '</div>' +
        kv(T('Ожидается', 'Expected'), F(p.amount)) + kv(T('Фактически', 'Actual'), p.confirmed ? F(st.paid) : '—') + kv(T('Разница', 'Difference'), diff == null ? '—' : '<span class="' + (diff < 0 ? 'neg' : 'pos') + '">' + esc(App.FS(diff)) + ' (' + App.pct(p.amount ? diff / p.amount : null) + ')</span>', true) +
        (Object.keys(srcs).length ? kv(T('Источники', 'Sources'), Object.keys(srcs).map(function (k) { return esc(k) + ' ' + esc(F(srcs[k])); }).join('<br>'), true) : '') +
        (p.debtReturnEstimate ? kv(T('В т.ч. возврат долга (оценка)', 'incl. debt returned (est.)'), F(p.debtReturnRange ? p.debtReturnRange[0] : p.debtReturnEstimate) + '–' + F(p.debtReturnRange ? p.debtReturnRange[1] : p.debtReturnEstimate)) : '') +
        kv(T('Неисполненные обязательства месяца', 'Open obligations of the month'), '<span class="plan">' + esc(F(openOb)) + '</span>', true) +
        (p.note ? '<div class="tiny muted mt8">' + esc(p.note) + '</div>' : '') +
        '<div class="btns">' + (!p.confirmed ? '<button class="btn sm" data-a="modal" data-m="confirmIncome" data-id="' + p.id + '">' + T('Подтвердить факт', 'Confirm actual') + '</button>' : '<button class="btn sm sec" data-a="modal" data-m="confirmIncome" data-id="' + p.id + '">' + T('Подробнее', 'Details') + '</button>') + '<button class="btn sm sec" data-a="modal" data-m="editPlanned" data-id="' + p.id + '">' + T('Изменить', 'Edit') + '</button></div></div>';
    }).join('');
    h += '<div class="btns"><button class="btn" data-a="modal" data-m="editPlanned" data-kind="income">' + I('plus') + T('Добавить поступление в план', 'Add planned income') + '</button></div>';
    return { title: 'Income Plan', html: h };
  };

  /* ---------- financial calendar ---------- */
  App.screens.calendar = function () {
    var L = S.L, ym = S.ui.calYm || C.ymOf(S.today), h = monthNav('calYm', ym);
    var days = Math.max(0, C.diffDays(S.today, C.lastDay(C.addMonths(ym, 0)))) + 1;
    var fc = C.dailyForecast(L, S.today, Math.max(days, 62), { scenarios: scen() }), fmap = {};
    fc.points.forEach(function (p) { fmap[p.date] = p; });
    var ev = {}; L.planned.forEach(function (p) { if (!C.plannedIncluded(p, { scenarios: scen() })) return; (ev[p.date] = ev[p.date] || []).push(p); });
    var act = {}; L.transactions.forEach(function (t) { if (t.status === 'void') return; var d = t.date.slice(0, 10); act[d] = (act[d] || 0) + 1; });
    var first = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1), off = (first.getDay() + 6) % 7, dim = C.daysInMonth(ym);
    var wd = App.lang() === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    var sel = S.ui.calSel && S.ui.calSel.slice(0, 7) === ym ? S.ui.calSel : (C.ymOf(S.today) === ym ? S.today : ym + '-01');
    h += '<div class="card"><div class="cal">' + wd.map(function (w) { return '<div class="wd">' + w + '</div>'; }).join('');
    for (var i = 0; i < off; i++) h += '<div></div>';
    for (var d = 1; d <= dim; d++) {
      var ds = ym + '-' + (d < 10 ? '0' : '') + d, e = ev[ds] || [], fp = fmap[ds];
      var dots = e.map(function (p) { return '<i style="background:' + (p.kind === 'income' ? 'var(--income)' : p.kind === 'family' ? 'var(--savings)' : p.kind === 'borrow' ? 'var(--text2)' : 'var(--planned)') + '"></i>'; }).join('') + (act[ds] ? '<i style="background:var(--accent)"></i>' : '');
      h += '<button class="d' + (ds === S.today ? ' today' : '') + (ds === sel ? ' sel' : '') + (fp && fp.value < 0 ? ' neg' : '') + '" data-a="calSel" data-d="' + ds + '"><span>' + d + '</span><span class="dots">' + dots + '</span></button>';
    }
    h += '</div><div class="legend"><span><i style="background:var(--income)"></i>' + T('доход', 'income') + '</span><span><i style="background:var(--planned)"></i>' + T('платёж', 'payment') + '</span><span><i style="background:var(--savings)"></i>' + T('родителям', 'parents') + '</span><span><i style="background:var(--accent)"></i>' + T('факт. операции', 'actual records') + '</span><span><i style="background:var(--expense)"></i>' + T('прогноз < 0', 'forecast < 0') + '</span></div></div>';
    var se = ev[sel] || [], sp = fmap[sel];
    h += '<div class="sec-h"><span class="t">' + esc(App.fd(sel, true)) + '</span>' + (sp ? '<span class="num small ' + (sp.value < 0 ? 'neg' : 'muted') + '">' + T('прогноз остатка ', 'projected ') + esc(F(sp.value)) + '</span>' : '') + '</div>';
    h += '<div class="list">' + (se.length ? se.map(function (p) { return App.plannedRow(p, C.plannedState(L, p, S.today)); }).join('') : '<div class="empty">' + T('Нет плановых операций', 'No planned items') + '</div>') + '</div>';
    var txs = App.sortTx(L.transactions.filter(function (t) { return t.date.slice(0, 10) === sel; }));
    if (txs.length) h += '<div class="list">' + txs.map(function (t) { return App.txRow(t); }).join('') + '</div>';
    var pts = fc.points.filter(function (p) { return p.date.slice(0, 7) === ym; });
    h += '<div class="card"><div class="card-h"><span class="t">' + T('Денежный поток по дням (прогноз)', 'Daily cash flow (forecast)') + '</span></div>' + CH.line({ id: 'calLine', series: [{ name: T('Прогноз собственных свободных денег', 'Projected own liquid money'), color: 'var(--planned)', dashed: true, fill: true, points: pts.map(function (p) { return { x: p.date, y: p.value }; }) }], fmtTip: function (v) { return F(v); }, fmtX: function (x) { return App.fd(x, false); }, zero: true, markers: fc.firstDeficit && fc.firstDeficit.slice(0, 7) === ym ? [{ x: fc.firstDeficit, color: 'var(--expense)', label: T('дефицит', 'deficit') }] : [], empty: T('Прогноз строится от сегодняшнего дня', 'The forecast starts today') }) +
      '<div class="tiny muted mt8">' + T('Старт — фактические свободные собственные деньги сегодня; далее плановые поступления и платежи; личный бюджет распределяется по дням со следующего месяца. ', 'Starts from actual own liquid money today; then planned income and payments; the personal budget is spread daily from next month. ') + (fc.firstDeficit ? '<span class="neg">' + T('Первая дата дефицита: ', 'First deficit date: ') + esc(App.fd(fc.firstDeficit, true)) + '</span>' : '') + '</div>' +
      '<div class="form mt12"><div class="group">' + App.fld(App.scenLabel(), '<input type="checkbox" class="sw" data-ch="toggleScen"' + (S.ui.scen.reborrow ? ' checked' : '') + '>') + '</div></div></div>';
    h += '<div class="btns"><button class="btn sec" data-a="modal" data-m="editPlanned" data-kind="payment">' + I('plus') + T('Повторяющееся обязательство', 'Recurring obligation') + '</button></div>';
    return { title: 'Financial Calendar', html: h };
  };
  App.actions.calSel = function (el) { S.ui.calSel = el.dataset.d; App.render(); };
  App.actions.toggleScen = function (el) { S.ui.scen.reborrow = el.checked; App.render(); };

  /* ---------- goals ---------- */
  App.screens.goals = function () {
    var L = S.L, h = '';
    h += (L.goals || []).map(function (g) {
      var gs = C.goalStatus(L, g, S.today), cur = g.currency || 'AED';
      return '<div class="card tap" data-a="go" data-s="goal" data-id="' + g.id + '"><div style="display:flex;gap:14px;align-items:center">' + CH.ring(gs.pct, g.color || 'var(--savings)', 64, '<span class="small b">' + Math.round(gs.pct * 100) + '%</span>') + '<div style="flex:1;min-width:0"><div class="b">' + (g.n ? '#' + g.n + ' ' : '') + esc(g.title) + '</div><div class="small muted num">' + esc(F(gs.current, cur)) + ' / ' + esc(F(g.target, cur)) + (g.type === 'family_monthly' ? T(' в этом месяце', ' this month') : g.type === 'extra_income' ? T(' за 30 дней', ' last 30 days') : '') + '</div><div class="tiny muted">' + T('Осталось ', 'Left ') + esc(F(gs.remaining, cur)) + (g.targetDate ? ' · ' + T('цель к ', 'by ') + esc(App.fd(g.targetDate, true)) : '') + (gs.forecast ? ' · ' + T('прогноз: ', 'forecast: ') + (gs.forecast === 'done' ? T('выполнено', 'done') : esc(App.fd(gs.forecast, true))) : '') + '</div></div>' + I('chev', 'sm') + '</div></div>';
    }).join('') || '<div class="card empty">' + T('Целей нет', 'No goals') + '</div>';
    h += '<div class="btns"><button class="btn" data-a="modal" data-m="goal">' + I('plus') + T('Новая цель', 'New goal') + '</button></div>';
    return { title: 'Financial Goals', html: h };
  };
  App.screens.goal = function (p) {
    var L = S.L, g = C.byId(L.goals, p.id); if (!g) return { title: '—', html: '' };
    var gs = C.goalStatus(L, g, S.today), cur = g.currency || 'AED', h = '';
    h += '<div class="card center">' + '<div style="display:grid;place-items:center">' + CH.ring(gs.pct, g.color || 'var(--savings)', 120, '<div class="b" style="font-size:24px">' + Math.round(gs.pct * 100) + '%</div>') + '</div><div class="b mt12" style="font-size:20px">' + esc(g.title) + '</div>' + (g.note ? '<div class="small muted mt8">' + esc(g.note) + '</div>' : '') + '</div>';
    var basis = { plannedPayments: T('по запланированным платежам', 'from planned payments'), planSurplus: T('по остаткам бюджетных периодов (если направлять их в резерв)', 'from budget-period surpluses (if routed to the reserve)'), pace: T('по текущему темпу пополнений', 'from current contribution pace') }[gs.forecastBasis] || '';
    h += '<div class="card">' + kv(T('Целевая сумма', 'Target'), F(g.target, cur)) + (cur !== 'AED' && C.toBase(L, g.target, cur) != null ? kv('≈ AED', F(C.toBase(L, g.target, cur))) : '') + kv(T('Текущая сумма', 'Current'), F(gs.current, cur)) + kv(T('Выполнено', 'Progress'), App.pct(gs.pct)) + kv(T('Осталось', 'Remaining'), F(gs.remaining, cur)) + kv(T('Целевая дата', 'Target date'), g.targetDate ? App.fd(g.targetDate, true) : '—') + kv(T('Прогноз достижения', 'Forecast'), gs.forecast === 'done' ? T('выполнено', 'done') : gs.forecast ? App.fd(gs.forecast, true) + ' <span class="tiny muted">' + esc(basis) + '</span>' : '<span class="muted">' + T('недостаточно данных', 'not enough data') + '</span>', true) + '</div>';
    var src = { short_debt: T('Прогресс считается автоматически: исходный краткосрочный долг минус текущий.', 'Progress is automatic: initial short-term debt minus current.'), reserve: T('Прогресс = баланс счёта «Резерв» + ручные пополнения.', 'Progress = Reserve account balance + manual contributions.'), family_monthly: T('Прогресс = переводы родителям в текущем месяце.', 'Progress = transfers to parents this month.'), extra_income: T('Прогресс = доп. доход за последние 30 дней. Не входит в базовый прогноз до фактического получения.', 'Progress = side income over the last 30 days. Not in the base forecast until received.'), apartment: T('Прогресс = ручные пополнения + переводы родителям, отмеченные для этой цели. Переводы родителям не являются вашими накоплениями.', 'Progress = manual contributions + parent transfers tagged to this goal. Transfers to parents are not your savings.') }[g.type];
    if (src) h += '<div class="dashed-note">' + esc(src) + '</div>';
    h += '<div class="btns">' + (['custom', 'apartment', 'reserve'].indexOf(g.type) >= 0 ? '<button class="btn" data-a="modal" data-m="contribution" data-id="' + g.id + '">' + I('plus') + T('Пополнение', 'Contribution') + '</button>' : '') + '<button class="btn sec" data-a="modal" data-m="goal" data-id="' + g.id + '">' + I('edit') + T('Изменить', 'Edit') + '</button></div>';
    h += '<div class="sec-h"><span class="t">' + T('История пополнений', 'Contribution history') + '</span></div><div class="list">' + (gs.history.length ? gs.history.slice(0, 50).map(function (x) { return '<div class="row"><div class="main-t"><div class="t1">' + esc(App.fd(x.date.slice(0, 10), true)) + '</div>' + (x.note ? '<div class="t2">' + esc(x.note) + '</div>' : '') + '</div><div class="amt num pos">' + esc(F(x.amount, x.manual ? cur : 'AED')) + '</div>' + (x.manual ? '<button class="iconbtn" data-a="delContribution" data-g="' + g.id + '" data-c="' + x.id + '">' + I('trash', 'sm') + '</button>' : '') + '</div>'; }).join('') : '<div class="empty">' + T('Пополнений пока нет', 'No contributions yet') + '</div>') + '</div>';
    return { title: T('Цель', 'Goal'), html: h };
  };

  /* ---------- debt freedom ---------- */
  App.screens.debts = function () {
    var L = S.L, ds = C.debtSummary(L, S.today), h = '';
    h += '<div class="card hero"><div class="lbl">' + T('Общая задолженность', 'Total debt') + '</div><div class="big num neg">' + esc(F(ds.total)) + '</div><div class="kpis">' + kpi(T('Краткосрочная', 'Short-term'), F(ds.short), 'neg') + kpi(T('Долгосрочная', 'Long-term'), F(ds.long), 'neg') + kpi(T('Уже погашено (осн. долг)', 'Repaid (principal)'), F(ds.repaidTotal), 'pos') + kpi(T('Свобода от долгов', 'Debt-free'), ds.debtFreeDate ? App.fym(ds.debtFreeDate.slice(0, 7)) : '—', 'acc', ds.debtFreeDate ? T('по плановым платежам', 'per planned payments') : T('не все долги имеют план', 'not all debts have a plan')) + '</div></div>';
    var proj = C.debtProjection(L, S.today, 36);
    h += '<div class="card"><div class="card-h"><span class="t">' + T('График погашения (план)', 'Repayment schedule (plan)') + '</span></div>' + CH.line({ id: 'debtProj', series: [{ name: T('Прогноз общего долга по плану', 'Projected total debt per plan'), color: 'var(--expense)', dashed: true, fill: true, points: proj.map(function (p) { return { x: p.ym + '-01', y: p.debt }; }) }], fmtTip: function (v) { return F(v); }, fmtX: function (d) { return App.fymShort(d.slice(0, 7)); } }) + '<div class="tiny muted mt8">' + T('Уменьшение только на основной долг; процентная часть долгосрочного кредита — расчётная. Сценарий повторного займа не включён.', 'Only principal reduces the debt; long-term loan interest split is estimated. Re-borrow scenario excluded.') + '</div></div>';
    h += '<div class="sec-h"><span class="t">' + T('Прогресс по кредитам', 'Progress by debt') + '</span></div>';
    h += ds.rows.map(function (r) {
      var a = r.acc, ci = r.info;
      return '<div class="card tap" data-a="go" data-s="account" data-id="' + a.id + '"><div class="split"><div style="display:flex;gap:10px;align-items:center;min-width:0">' + App.accIcon(a) + '<div style="min-width:0"><div class="b ellipsis">' + esc(a.name) + '</div><div class="tiny muted">' + esc(App.ACC_TYPES()[a.type]) + ' · ' + (a.term === 'long' ? T('долгосрочный', 'long-term') : T('краткосрочный', 'short-term')) + '</div></div></div>' + App.cTag(r.status) + '</div>' +
        '<div class="split mt12"><span class="num neg b">' + esc(F(r.debt, a.currency)) + '</span><span class="small muted">' + App.pct(r.progress, 0) + T(' погашено', ' repaid') + '</span></div><div class="bar mt8"><i style="width:' + r.progress * 100 + '%;background:var(--income)"></i></div>' +
        (a.type === 'credit_card' ? '<div class="tiny muted mt8">' + T('Лимит ', 'Limit ') + esc(F(ci.limit, a.currency)) + ' · ' + T('доступно ', 'available ') + esc(F(ci.available, a.currency)) + ' · ' + App.pct(ci.utilization, 2) + (ci.overLimit ? ' · <span class="neg">' + T('превышение ', 'over ') + esc(F(ci.overLimit, a.currency)) + '</span>' : '') + '</div>' : '') +
        '<div class="tiny muted mt8">' + T('Плановое закрытие: ', 'Planned payoff: ') + (r.closeDate === 'done' ? T('погашен', 'paid off') : r.closeDate ? esc(App.fd(r.closeDate, true)) : '<span class="unconf">' + T('план покрывает ', 'plan covers ') + esc(F(r.plannedTotal, a.currency)) + T(' из долга', ' of the debt') + '</span>') + ' · ' + T('проценты: ', 'interest: ') + (r.rateKnown ? T('ставка подтверждена', 'rate confirmed') : r.rateEstimated ? T('расчётно ', 'estimated ') + esc(F(r.plannedInterest, a.currency)) : '<span class="unconf">' + T('ставка неизвестна', 'rate unknown') + '</span>') + '</div></div>';
    }).join('');
    var paidI = C.sum(ds.rows, function (r) { return r.interestPaid; }), planI = C.sum(ds.rows, function (r) { return r.plannedInterest; });
    h += '<div class="card"><div class="card-h"><span class="t">' + T('Стоимость процентов', 'Cost of interest') + '</span></div>' + kv(T('Уплачено (по записям)', 'Paid (recorded)'), F(paidI)) + kv(T('Будущие проценты (расчётно, где известно разделение)', 'Future interest (estimated, where split is known)'), F(planI)) + kv(T('По картам и займам', 'Cards & short loans'), '<span class="unconf">' + T('не рассчитывается — ставки не подтверждены', 'not computed — rates unconfirmed') + '</span>', true) + '</div>';
    // early payment impact
    var rak = L.accounts.filter(function (a) { return a.type === 'loan' && a.loan && a.loan.monthlyPayment && a.term === 'long'; });
    if (rak.length) {
      var extra = App.toMinor(S.ui.earlyAmt || '5000') || 0, imp = C.earlyPayoffImpact(L, rak[0].id, extra);
      h += '<div class="card"><div class="card-h"><span class="t">' + T('Влияние досрочного платежа', 'Early payment impact') + ' · ' + esc(rak[0].name) + '</span></div><div class="search"><input value="' + esc(S.ui.earlyAmt || '5000') + '" inputmode="decimal" data-live="earlyAmt" aria-label="extra"><span>AED</span></div><div id="earlyRes">' + earlyHtml(imp) + '</div></div>';
    }
    // strategies
    var strat = S.ui.strategy, amt = App.toMinor(S.ui.strategyAmt || '') || 0, pp = C.payoffPlan(L, strat, amt, S.ui.customOrder);
    h += '<div class="card"><div class="card-h"><span class="t">' + T('Стратегия погашения', 'Payoff strategy') + '</span></div><div class="seg">' + [['snowball', 'Debt Snowball'], ['avalanche', 'Debt Avalanche'], ['custom', T('Своя', 'Custom')]].map(function (x) { return '<button class="' + (strat === x[0] ? 'on' : '') + '" data-a="strategy" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="small muted mt8">' + (strat === 'snowball' ? T('Сначала самый маленький долг — быстрые победы.', 'Smallest balance first — quick wins.') : strat === 'avalanche' ? T('Сначала самая высокая ставка — меньше процентов. Требует подтверждённых ставок.', 'Highest rate first — less interest. Needs confirmed rates.') : T('Ваш порядок — меняйте стрелками.', 'Your own order — use the arrows.')) + '</div>' +
      '<div class="search mt8"><span class="small">' + T('В месяц на краткосрочные долги', 'Monthly for short-term debts') + '</span><input value="' + esc(S.ui.strategyAmt || '') + '" placeholder="0" inputmode="decimal" data-ch="strategyAmt" style="text-align:right"><span>AED</span></div>' +
      '<div class="list inset mt8">' + pp.order.map(function (d, i) { var st = pp.steps.filter(function (s) { return s.id === d.id; })[0]; return '<div class="row noicon"><div class="main-t"><div class="t1">' + (i + 1) + '. ' + esc(d.name) + '</div><div class="t2">' + esc(F(d.debt)) + (d.apr != null ? ' · ' + d.apr + '%' : ' · ' + T('ставка не подтверждена', 'rate unconfirmed')) + (st ? ' · ' + T('закрыт через ', 'paid in ') + st.month + T(' мес.', ' mo') : '') + '</div></div>' + (strat === 'custom' ? '<button class="iconbtn" data-a="orderMove" data-id="' + d.id + '" data-d="-1">' + I('up', 'sm') + '</button><button class="iconbtn" data-a="orderMove" data-id="' + d.id + '" data-d="1">' + I('down', 'sm') + '</button>' : '') + '</div>'; }).join('') + '</div>' +
      (amt ? '<div class="small mt8">' + (pp.months != null ? T('Все краткосрочные долги закрываются за ', 'All short-term debts cleared in ') + pp.months + T(' мес.', ' months') : '—') + '</div>' : '<div class="tiny muted mt8">' + T('Введите сумму, чтобы рассчитать срок.', 'Enter an amount to compute the timeline.') + '</div>') +
      (pp.unknownRates.length ? '<div class="tiny unconf mt8">' + T('Без подтверждённых ставок проценты не начисляются в расчёте, экономия на процентах не считается: ', 'Without confirmed rates no interest is applied and no savings are claimed: ') + esc(pp.unknownRates.join(', ')) + '</div>' : '') + '</div>';
    return { title: 'Debt Freedom', html: h };
  };
  function earlyHtml(imp) {
    if (!imp) return '';
    if (imp.unknownRate) return '<div class="small unconf mt8">' + T('Ставка неизвестна — экономию рассчитать нельзя.', 'Rate unknown — savings cannot be computed.') + '</div>';
    return '<div class="kpis mt8">' + kpi(T('Сокращение срока', 'Months saved'), String(imp.monthsSaved), 'pos', imp.baseMonths + ' → ' + imp.newMonths) + kpi(T('Экономия процентов', 'Interest saved'), F(imp.interestSaved), 'pos', imp.estimated ? T('по расчётной ставке', 'at estimated rate') : '') + '</div>';
  }
  App.live.earlyAmt = function (el) { S.ui.earlyAmt = el.value; var rak = S.L.accounts.filter(function (a) { return a.type === 'loan' && a.loan && a.loan.monthlyPayment && a.term === 'long'; })[0]; var r = document.getElementById('earlyRes'); if (r && rak) r.innerHTML = earlyHtml(C.earlyPayoffImpact(S.L, rak.id, App.toMinor(el.value) || 0)); };
  App.actions.strategy = function (el) { S.ui.strategy = el.dataset.v; if (el.dataset.v === 'custom' && !S.ui.customOrder.length) S.ui.customOrder = C.payoffPlan(S.L, 'snowball', 0).order.map(function (d) { return d.id; }); App.render(); };
  App.actions.strategyAmt = function (el) { S.ui.strategyAmt = el.value; App.render(); };
  App.actions.orderMove = function (el) { var o = S.ui.customOrder, i = o.indexOf(el.dataset.id), j = i + (+el.dataset.d); if (i < 0 || j < 0 || j >= o.length) return; o.splice(j, 0, o.splice(i, 1)[0]); App.render(); };

  /* ---------- family support ---------- */
  App.screens.family = function () {
    var L = S.L, fs = C.familyStatus(L, S.today), h = '';
    h += '<div class="kpis">' + kpi(T('План переводов', 'Transfer plan'), F(fs.planTotal), 'sav') + kpi(T('Фактически отправлено', 'Actually sent'), F(fs.sentTotal), 'sav') + kpi(T('Осталось до выполнения плана', 'Left to complete plan'), F(fs.remaining), 'plan') + kpi(T('Комиссии', 'Fees'), F(fs.fees), 'neg') + '</div>';
    h += '<div class="card"><div class="bar"><i style="width:' + (fs.planTotal ? fs.sentPlanned / fs.planTotal * 100 : 0) + '%;background:var(--savings)"></i></div><div class="tiny muted mt8">' + T('Переводы родителям не являются вашими накоплениями и не считаются потребительскими расходами в личном бюджете.', 'Transfers to parents are not your savings and are not counted as personal budget spending.') + '</div></div>';
    h += '<div class="sec-h"><span class="t">' + T('План', 'Plan') + '</span><button data-a="modal" data-m="editPlanned" data-kind="family">' + T('Добавить', 'Add') + '</button></div><div class="list">' + fs.plans.map(function (x) { return App.plannedRow(x.p, x.st); }).join('') + '</div>';
    var ag = (L.goals || []).filter(function (g) { return g.type === 'apartment'; })[0];
    if (ag) {
      var gs = C.goalStatus(L, ag, S.today);
      h += '<div class="card tap" data-a="go" data-s="goal" data-id="' + ag.id + '"><div class="card-h"><span class="t">' + T('Квартира для родителей', 'Apartment for parents') + '</span><span class="more">' + I('chev', 'sm') + '</span></div><div class="split"><span class="num b">' + esc(F(gs.current, ag.currency)) + '</span><span class="muted num">' + esc(F(ag.target, ag.currency)) + '</span></div><div class="bar mt8"><i style="width:' + gs.pct * 100 + '%;background:var(--teal)"></i></div><div class="tiny muted mt8">' + T('Ориентир редактируется. ≈ ', 'Editable target. ≈ ') + esc(F(C.toBase(L, ag.target, ag.currency) || 0)) + '</div></div>';
    }
    var txs = App.sortTx(fs.txs);
    h += '<div class="sec-h"><span class="t">' + T('История переводов', 'Transfer history') + '</span><button data-a="modal" data-m="record" data-type="family">' + T('Записать перевод', 'Record transfer') + '</button></div>' + App.txList(txs, null, T('Переводов пока не было', 'No transfers yet'));
    if (txs.length) h += '<div class="card">' + txs.map(function (t) { return kv(App.fd(t.date.slice(0, 10), true), F(t.amount, C.txCurrency(L, t)) + (t.fee ? ' + ' + T('комиссия ', 'fee ') + F(t.fee, C.txCurrency(L, t)) : '') + (t.recipientAmount ? ' → ' + F(t.recipientAmount, t.recipientCurrency || C.txCurrency(L, t)) : '')); }).join('') + '</div>';
    return { title: 'Family Support', html: h };
  };

  /* ---------- budget periods (December / January plans etc.) ---------- */
  App.screens.monthplan = function () {
    var L = S.L, ym = S.ui.planYm || C.simStartYm(L, S.today), opts = { today: S.today, scenarios: scen() };
    var mp = C.monthPlan(L, ym, opts), h = monthNav('planYm', ym);
    h += '<div class="form"><div class="group">' + App.fld(App.scenLabel(), '<input type="checkbox" class="sw" data-ch="toggleScen"' + (S.ui.scen.reborrow ? ' checked' : '') + '>') + '</div><div class="note">' + T('Сценарий не создаёт фактических операций. Повторное финансирование не гарантировано.', 'The scenario never creates actual records. Refinancing is not guaranteed.') + '</div></div>';
    var rows = mp.items.map(function (i) {
      var title = i.kind === 'personal' ? T('Личные расходы', 'Personal spending') + (i.actual ? ' <span class="tiny muted">(' + T('факт ', 'actual ') + esc(F(i.actual)) + ')</span>' : '') : i.kind === 'unplannedIn' ? T('Внеплановые поступления (факт)', 'Unplanned income (actual)') : i.kind === 'unplannedOut' ? T('Внеплановые выплаты (факт)', 'Unplanned payments (actual)') : esc(i.title) + (i.kind === 'income' ? ' <span class="tiny muted">' + esc(App.fd(i.date, true)) + '</span>' : '') + (i.scenario ? ' <span class="tag">' + T('сценарий', 'scenario') + '</span>' : '') + (i.status ? ' ' + App.pTag(i.status) : '');
      return '<tr><td>' + title + '</td><td class="r num ' + (i.amount < 0 ? 'neg' : 'pos') + '">' + esc(F(i.amount, 'AED', { plus: i.amount > 0 })) + '</td></tr>';
    }).join('');
    h += '<div class="card"><div class="card-h"><span class="t">' + T('Финансовый план: ', 'Financial plan: ') + esc(App.fym(ym)) + '</span></div><div class="tbl-wrap"><table class="tbl"><tr><th>' + T('Статья', 'Item') + '</th><th class="r">AED</th></tr>' + rows + '<tr class="total"><td>' + (mp.result < 0 ? T('Дефицит', 'Deficit') : T('Прогнозный остаток', 'Projected surplus')) + '</td><td class="r num ' + (mp.result < 0 ? 'neg' : 'pos') + '">' + esc(F(mp.result)) + '</td></tr></table></div>' + (function () { var cp = mp.items.filter(function (i) { return i.kind === 'payment'; }); var tot = -cp.reduce(function (s, i) { return s + i.amount; }, 0); return cp.length ? '<div class="kv mt8"><span class="k">' + T('Итого платежей по кредитам за период', 'Total credit payments this period') + '</span><span class="v num neg">' + esc(F(tot)) + '</span></div>' : ''; })() + '</div>';
    if (mp.result < 0) {
      var alt = C.deficitAlternatives(L, ym, opts);
      h += '<div class="alert danger">' + I('alert') + '<div class="grow"><b>' + T('Кассовый разрыв ', 'Cash gap ') + esc(F(alt.deficit)) + '</b>. ' + T('Альтернативы без нового заимствования:', 'Alternatives without new borrowing:') + '<ul style="margin:6px 0 0;padding-left:18px">' + alt.alts.map(function (a) {
        if (a.id === 'reduceFamily') return '<li>' + T('Уменьшить перевод родителям на ', 'Reduce the parents transfer by ') + esc(F(a.amount)) + T(' (до ', ' (to ') + esc(F(a.newValue)) + ')' + (a.covers ? '' : T(' — покрывает частично', ' — partial')) + '</li>';
        if (a.id === 'shiftFamily') return '<li>' + T('Перенести ', 'Move ') + esc(F(a.amount)) + T(' перевода родителям на ', ' of the parents transfer to ') + esc(App.fym(a.nextYm)) + ': ' + T('остаток следующего периода станет ', 'next period becomes ') + '<span class="' + (a.feasible ? 'pos' : 'neg') + '">' + esc(F(a.nextResultAfter)) + '</span></li>';
        if (a.id === 'cutPersonal') return '<li>' + T('Сократить личные расходы (максимум ', 'Cut personal spending (max ') + esc(F(a.amount)) + ')' + (a.covers ? '' : T(' — недостаточно одного этого', ' — not enough alone')) + '</li>';
        if (a.id === 'minPayments') return '<li>' + T('Платить по кредитным картам только минимальные платежи (если это ещё не заложено в план)', 'Pay only credit card minimums (if not already planned)') + '</li>';
        return '<li>' + T('Договориться о переносе дат необязательных выплат (рассрочки, перевод родителям) после поступления', 'Negotiate moving non-mandatory payments (instalments, parents) after payday') + '</li>';
      }).join('') + '</ul></div></div>';
    }
    // multi-period table
    var first = C.simStartYm(L, S.today), last = C.lastPlanMonth(L);
    L.planned.forEach(function (p) { if (p.budgetMonth && p.budgetMonth > last) last = p.budgetMonth; });
    var n = Math.max(1, Math.min(36, (+last.slice(0, 4) - +first.slice(0, 4)) * 12 + (+last.slice(5, 7) - +first.slice(5, 7)) + 1));
    if (n < 1) n = 12;
    var ser = C.planSeries(L, first, n, opts);
    h += '<div class="card"><div class="card-h"><span class="t">' + T('Все бюджетные периоды', 'All budget periods') + '</span></div><div class="tbl-wrap"><table class="tbl"><tr><th>' + T('Месяц', 'Month') + '</th><th class="r">' + T('Поступления', 'Income') + '</th><th class="r">' + T('Выплаты', 'Out') + '</th><th class="r">' + T('Остаток', 'Result') + '</th><th class="r">' + T('Накопительно', 'Cumulative') + '</th></tr>' +
      ser.map(function (r) { return '<tr' + (r.ym === ym ? ' style="background:var(--card2)"' : '') + '><td>' + esc(App.fymShort(r.ym)) + '</td><td class="r num">' + esc(F(r.income, 'AED', { dec: 0 })) + '</td><td class="r num">' + esc(F(-r.out, 'AED', { dec: 0 })) + '</td><td class="r num ' + (r.result < 0 ? 'neg' : 'pos') + '">' + esc(F(r.result)) + '</td><td class="r num ' + (r.cumulative < 0 ? 'neg' : '') + '">' + esc(F(r.cumulative)) + '</td></tr>'; }).join('') + '</table></div>' +
      CH.bars({ id: 'serBars', groups: ser.map(function (r) { return { label: App.fymShort(r.ym), tip: App.fym(r.ym), values: [{ v: r.result, color: r.result < 0 ? 'var(--expense)' : 'var(--income)', planned: true, name: T('остаток', 'result') }] }; }), fmtTip: function (v) { return F(v); } }) + '</div>';
    var pot = App.potentialSavings(L, opts);
    if (pot) h += '<div class="card"><div class="card-h"><span class="t">' + T('После закрытия краткосрочных долгов', 'After short-term debts are closed') + '</span></div>' + kv(T('Потенциальный ежемесячный остаток', 'Potential monthly surplus'), F(pot.monthly)) + pot.rows.map(function (r) { return kv(T('Конец ', 'End of ') + App.fym(C.addMonths(r.ym, -1)) + ' → ' + App.fymShort(r.ym), F(r.cum)); }).join('') + kv(T('Потенциальные накопления за ', 'Potential savings over ') + pot.rows.length + T(' бюджетных периодов', ' budget periods'), '<b class="sav">' + esc(F(pot.total)) + '</b>', true) + '<div class="tiny muted mt8">' + T('Это потенциально зарезервированные остатки бюджетных периодов, а не гарантированные фактические накопления.', 'These are potential reserved period surpluses, not guaranteed actual savings.') + '</div></div>';
    return { title: T('Бюджетные периоды', 'Budget periods'), html: h };
  };
  /* potential savings: periods after the last planned short-term debt payment, up to 12 */
  App.potentialSavings = function (L, opts) {
    var lastShort = ''; L.planned.forEach(function (p) { var a = C.byId(L.accounts, p.accountId); if (p.kind === 'payment' && a && a.term !== 'long' && C.plannedIncluded(p, opts) && p.budgetMonth > lastShort) lastShort = p.budgetMonth; });
    if (!lastShort) return null;
    var start = C.addMonths(lastShort, 1), last = C.lastPlanMonth(L), rows = [], cum = 0;
    for (var ym = start; ym <= last && rows.length < 12; ym = C.addMonths(ym, 1)) { var r = C.monthPlan(L, ym, opts).result; cum += r; rows.push({ ym: ym, result: r, cum: cum }); }
    if (!rows.length) return null;
    return { monthly: rows[0].result, rows: rows, total: cum };
  };
})();
