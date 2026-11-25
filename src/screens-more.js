/* More: hub, purchase check, simulator, health, business, assistant, change log, currencies, categories, data, settings, about */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, CH = App.CH, S = App.S, T = App.T, F = App.F, esc = App.esc, kpi = App.kpi, kv = App.kv;
  function row(icon, color, title, sub, attrs, right) {
    return '<button class="row tap" ' + attrs + '><span class="cat-ic sq" style="background:' + color + '">' + I(icon) + '</span><div class="main-t"><div class="t1">' + title + '</div>' + (sub ? '<div class="t2">' + sub + '</div>' : '') + '</div>' + (right || '') + '<span class="chev">' + I('chev', 'sm') + '</span></button>';
  }
  function go(s) { return 'data-a="go" data-s="' + s + '"'; }

  App.screens.more = function () {
    var L = S.L, bc = App.badgeCount(), h = '';
    h += '<div class="card profile"><span class="logo-lg">' + I('wallet') + '</span><div class="grow"><div class="b">' + esc(L.meta.name) + '</div><div class="small muted">' + T('Локальная книга · ', 'Local ledger · ') + esc(AFDB.mode()) + '</div></div></div>';
    h += '<div class="list">' +
      row('bell', '#FF453A', T('Уведомления', 'Notifications'), '', go('notifications'), bc ? '<span class="badge-in">' + bc + '</span>' : '') +
      row('log', '#0A84FF', T('Все записи', 'All records'), L.transactions.filter(function (t) { return t.status !== 'void'; }).length + T(' записей', ' records'), go('records')) +
      row('bank', '#30D158', T('Счета', 'Accounts'), L.accounts.length + T(' счетов', ' accounts'), go('accounts')) + '</div>';
    h += '<div class="gh">' + T('Инструменты', 'Tools') + '</div><div class="list">' +
      row('scale', '#FF9F0A', T('Могу ли я себе это позволить?', 'Can I afford it?'), T('Проверка покупки', 'Purchase check'), go('purchase')) +
      row('chat', '#5E5CE6', T('Финансовый помощник', 'Financial assistant'), T('На правилах, не ИИ', 'Rule-based, not AI'), go('assistant')) +
      row('pulse', '#FF375F', T('Финансовое здоровье', 'Financial health'), String(C.healthScore(L, S.today).score) + ' / 100', go('health')) +
      row('flag', '#BF5AF2', T('Сценарный симулятор', 'Scenario simulator'), '', go('simulator')) +
      row('briefcase', '#AC8E68', T('Бизнес и инвестиции', 'Business & investments'), (L.projects || []).length + T(' проектов · ', ' projects · ') + (L.assets || []).length + T(' активов', ' assets'), go('business')) +
      row('calendar', '#64D2FF', T('Итоги месяца', 'Month review'), T('Сверка на конец месяца', 'Month-end reconciliation'), 'data-a="modal" data-m="review"') + '</div>';
    h += '<div class="gh">' + T('Настройки', 'Settings') + '</div><div class="list">' +
      row('dots', '#FF9F0A', T('Категории', 'Categories'), '', go('categories')) +
      row('coins', '#30D158', T('Валюты и курсы', 'Currencies & rates'), Object.keys(L.rates).join(', '), go('currencies')) +
      row('download', '#0A84FF', T('Данные, импорт и резервные копии', 'Data, import & backups'), T('JSON, CSV, снимки', 'JSON, CSV, snapshots'), go('data')) +
      row('edit', '#8E8E93', T('Журнал изменений', 'Change log'), (L.changelog || []).length + T(' записей', ' entries'), go('changelog')) +
      row('settings', '#8E8E93', T('Настройки', 'Settings'), (App.lang() === 'en' ? 'English' : 'Русский') + ' · ' + T({ dark: 'тёмная', light: 'светлая', auto: 'авто' }[L.settings.theme] || 'тёмная', L.settings.theme), go('settings')) +
      row('info', '#8E8E93', T('О приложении и ограничения', 'About & limitations'), 'Akbar Finance 3.0 · v3.4', go('about')) + '</div>';
    return { title: T('Ещё', 'More'), html: h };
  };

  /* ---------- purchase check ---------- */
  function pcResult() {
    var q = S.ui.pc, amt = App.toMinor(q.amount);
    if (!amt || amt <= 0) return '<div class="card empty">' + T('Введите сумму покупки', 'Enter the purchase amount') + '</div>';
    var r = C.purchaseCheck(S.L, { amount: amt, categoryId: q.categoryId, accountId: q.accountId, essential: q.essential }, S.today);
    var V = { ok: ['ok', 'check', T('Покупка допустима', 'Purchase is fine')], risk: ['warn', 'alert', T('Покупка рискованна', 'Purchase is risky')], violates: ['danger', 'close', T('Покупка нарушает финансовый план', 'Purchase breaks the financial plan')] }[r.verdict];
    var FL = { insufficient: T('На выбранном счёте недостаточно средств', 'Not enough money on the selected account'), obligations: T('После покупки собственных денег не хватит на обязательства ближайших дней', 'After the purchase own money will not cover upcoming obligations'), cashGap: T('Появится или углубится кассовый разрыв в ближайшие 45 дней', 'A cash gap appears or deepens within 45 days'), overLimit: T('Сумма превышает доступный кредитный лимит', 'Amount exceeds available credit'), family: T('Под угрозой плановые переводы родителям', 'Planned transfers to parents are at risk'), reserve: T('Придётся тронуть резерв', 'The reserve would be touched'), budget: T('Будет превышен личный бюджет месяца', 'Monthly personal budget would be exceeded'), categoryBudget: T('Будет превышен лимит категории', 'Category limit would be exceeded'), big: T('Несущественная покупка дороже 200 AED — подумайте 24 часа', 'Non-essential purchase over 200 AED — wait 24 hours'), creditNotReserve: T('Кредитный лимит — это долг, а не резерв', 'Credit limit is debt, not a reserve') };
    var h = '<div class="alert ' + V[0] + ' big">' + I(V[1]) + '<div class="grow b">' + V[2] + '</div></div>';
    h += r.flags.map(function (f) { return '<div class="small mt8">• ' + esc(FL[f] || f) + '</div>'; }).join('');
    h += '<div class="card mt12">' + (r.viaCredit ? kv(T('Долг после покупки', 'Debt after purchase'), F(r.debtAfter)) + kv(T('Доступный лимит после', 'Available credit after'), F(r.creditAvailableAfter)) : kv(T('Остаток на счёте после', 'Account balance after'), F(r.accountAfter))) +
      kv(T('Свободные деньги после обязательств', 'Free money after obligations'), F(r.freeAfter)) +
      kv(T('Остаток личного бюджета', 'Personal budget left'), F(r.budgetRemainingAfter)) +
      (r.categoryRemainingAfter != null ? kv(T('Остаток лимита категории', 'Category limit left'), F(r.categoryRemainingAfter)) : '') +
      kv(T('Минимум прогноза 45 дней', '45-day forecast low'), F(r.forecastMinAfter)) + kv(T('Обязательства горизонта', 'Obligations in horizon'), F(r.obligations)) + '</div>';
    return h;
  }
  App.screens.purchase = function () {
    var q = S.ui.pc, h = '<div class="form"><div class="group">' +
      App.fld(T('Сумма, AED', 'Amount, AED'), '<input class="in" inputmode="decimal" data-live="pc" data-k="amount" value="' + esc(q.amount) + '" placeholder="0">') +
      App.fld(T('Категория', 'Category'), '<select class="in" data-live="pc" data-k="categoryId">' + App.catOpts('expense', q.categoryId) + '</select>') +
      App.fld(T('Счёт', 'Account'), '<select class="in" data-live="pc" data-k="accountId">' + App.accOpts(null, q.accountId, T('Любой собственный', 'Any own money')) + '</select>') +
      App.fld(T('Необходимая покупка', 'Essential'), '<input type="checkbox" class="sw" data-live="pc" data-k="essential"' + (q.essential ? ' checked' : '') + '>') +
      '</div></div><div id="pcOut" class="mt12">' + pcResult() + '</div>';
    h += '<div class="note">' + T('Проверка учитывает баланс счёта, обязательства, личный бюджет и лимит категории, кассовые разрывы, переводы родителям и резерв. Кредитный лимит не считается собственными деньгами.', 'Checks account balance, obligations, personal budget and category limit, cash gaps, transfers to parents and reserve. Credit limits are not counted as own money.') + '</div>';
    return { title: T('Проверка покупки', 'Purchase check'), html: h };
  };
  App.live.pc = function (el) { S.ui.pc[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; var o = document.getElementById('pcOut'); if (o) o.innerHTML = pcResult(); };
  document.addEventListener('change', function (e) { var el = e.target; if (el.dataset && el.dataset.live === 'pc' && (el.tagName === 'SELECT' || el.type === 'checkbox')) App.live.pc(el); });

  /* ---------- simulator ---------- */
  function SIMF() { return [['income', T('Доход', 'Income')], ['parents', T('Родителям', 'Parents')], ['loans', T('Кредиты', 'Loans')], ['expenses', T('Личные расходы', 'Personal spending')], ['savings', T('Сбережения', 'Savings')], ['other', T('Другие платежи', 'Other payments')]]; }
  function simOpts() { return { today: S.today, scenarios: App.scen ? App.scen() : [] }; }
  function simInit(id, keepHorizon) {
    var s = C.byId(S.L.scenarios, id) || S.L.scenarios[1] || S.L.scenarios[0];
    var months = keepHorizon && S.ui.sim && S.ui.sim.months != null ? S.ui.sim.months : (s.months != null ? C.clampHorizon(s.months) : C.HORIZON_DEFAULT);
    var mode = (S.ui.sim && S.ui.sim.mode) || 'total';
    S.ui.sim = { id: s.id, months: String(months), mode: mode, overrides: Object.assign({}, s.overrides || {}), lines: (s.lines || []).map(function (l) { return Object.assign({}, l); }), params: C.normalizeSimParams(s.id, s.params), startYm: C.simStartYm(S.L, S.today) };
    ['income', 'parents', 'loans', 'expenses', 'savings', 'other'].forEach(function (k) { S.ui.sim[k] = ''; });
  }
  function simObj() {
    var u = S.ui.sim, o = { id: u.id, months: C.clampHorizon(u.months), lines: u.lines || [], overrides: u.overrides || {}, usePlan: true, startYm: u.startYm || C.simStartYm(S.L, S.today), params: C.normalizeSimParams(u.id, u.params) };
    ['income', 'parents', 'loans', 'expenses', 'savings', 'other'].forEach(function (k) { o[k] = App.toMinor(u[k] || '0') || 0; });
    return o;
  }
  function simRun() { return C.scenarioCalc(simObj(), S.L, S.today, simOpts()); }
  function simFieldVal(r, key) {
    var u = S.ui.sim, n = r.months || 1, sum = (r.sums && r.sums[key]) || 0;
    return u.mode === 'avg' ? Math.round(sum / n) : sum;
  }
  function simPresetBlurb(id, params) {
    params = C.normalizeSimParams(id, params);
    var hasLow = C.hasSalaryBand(S.L, 'low'), hasHigh = C.hasSalaryBand(S.L, 'high');
    if (id === 'neg') {
      var sal = hasLow ? T('зарплата по нижней оценке из плана доходов', 'salary at the plan’s pessimistic estimate') : (T('зарплата ', 'salary ') + (params.salaryPct || 0) + '%');
      return T('Пессимистичный: ', 'Pessimistic: ') + sal + T(', личные расходы ', ', personal spending ') + (params.expensesPct > 0 ? '+' : '') + params.expensesPct + '%.';
    }
    if (id === 'opt') {
      var bits = [];
      if (params.incomePct) bits.push(T('доход ', 'income ') + (params.incomePct > 0 ? '+' : '') + params.incomePct + '%');
      if (hasHigh && params.salaryBand === 'high') bits.push(T('зарплата по верхней оценке плана', 'salary at the plan’s optimistic estimate'));
      if (params.bonus) bits.push(T('бонус ', 'bonus ') + F(params.bonus) + T('/мес.', '/mo'));
      return T('Оптимистичный: ', 'Optimistic: ') + (bits.join(T(', ', ', ')) || T('без дополнительных допущений', 'no extra assumptions')) + '.';
    }
    return T('Базовый: как в бюджетных периодах, без изменений. Цифры совпадают с «Бюджетными периодами» и «Плановыми платежами».', 'Base: the live plan, unchanged. Figures match Budget periods and Planned payments.');
  }
  function simParamsForm() {
    var u = S.ui.sim, p = C.normalizeSimParams(u.id, u.params), h = '', band;
    if (u.id === 'neg') {
      var hasLow = C.hasSalaryBand(S.L, 'low');
      band = p.salaryBand === 'low' && hasLow ? 'low' : (p.salaryBand === 'exp' ? 'exp' : 'pct');
      h += App.fld(T('Зарплата', 'Salary'), '<select class="in" data-ch="simBandChange">' + App.opts([['low', T('Нижняя оценка из плана', 'Plan pessimistic estimate')], ['exp', T('Как в плане (база)', 'As in the plan (base)')], ['pct', T('Процент от плана', '% of the plan')]], band) + '</select>');
      if (band === 'pct') h += App.fld(T('Изменение зарплаты, %', 'Salary change, %'), '<input class="in" inputmode="decimal" data-live="simP" data-k="salaryPct" value="' + esc(p.salaryPct) + '">');
      if (p.salaryBand === 'low' && !hasLow) h += '<div class="note">' + T('В плане доходов нет нижней оценки — используется процент.', 'The income plan has no pessimistic estimate — a percentage is used.') + '</div>';
      h += App.fld(T('Личные расходы, %', 'Personal spending, %'), '<input class="in" inputmode="decimal" data-live="simP" data-k="expensesPct" value="' + esc(p.expensesPct) + '">');
    }
    if (u.id === 'opt') {
      h += App.fld(T('Доход, %', 'Income, %'), '<input class="in" inputmode="decimal" data-live="simP" data-k="incomePct" value="' + esc(p.incomePct) + '">');
      h += App.fld(T('Бонус в месяц, AED', 'Monthly bonus, AED'), '<input class="in" inputmode="decimal" data-live="simP" data-k="bonus" value="' + esc(App.amtStr(p.bonus || 0)) + '">');
    }
    return h ? '<div class="form">' + App.group(T('Допущения сценария', 'Scenario assumptions'), h) + '</div>' : '';
  }
  function simTable(r) {
    var rows = r.rows || [];
    if (!rows.length) return '';
    var th = [T('Месяц', 'Month'), T('Доход', 'Income'), T('Родителям', 'Parents'), T('Кредиты', 'Credits'), T('Личные', 'Personal'), T('Остаток', 'Result'), T('Накопительно', 'Cumulative')];
    var cell = function (c, i, tag) { tag = tag || (i ? 'td' : 'th'); return '<' + tag + (i ? ' class="num"' : '') + '>' + c + '</' + tag + '>'; };
    var tr = function (cells, cls, head) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map(function (c, i) { return cell(c, i, head || (i ? 'td' : 'th')); }).join('') + '</tr>'; };
    var body = rows.map(function (x) {
      var inc = x.income + x.borrow + (x.extraIn || 0);
      var resCls = x.result < 0 ? 'neg' : 'pos';
      return tr([esc(App.fymTiny(x.ym)), esc(F(inc)), esc(F(x.parents)), esc(F(x.loans)), esc(F(x.expenses)), '<span class="' + resCls + '">' + esc(App.FS(x.result)) + '</span>', esc(App.FS(x.cumulative))], '', 'td');
    }).join('');
    var tot = tr([T('Итого', 'Total'), esc(F(r.sums.income + r.sums.borrow + r.sums.extraIn)), esc(F(r.sums.parents)), esc(F(r.sums.loans)), esc(F(r.sums.expenses)), '<span class="' + (r.total < 0 ? 'neg' : 'pos') + '">' + esc(App.FS(r.total)) + '</span>', esc(App.FS(r.total))], 'tot', 'td');
    return '<div class="card mt12 sim-table-wrap"><div class="card-h"><span class="t">' + T('По месяцам', 'By month') + '</span></div><div class="table-scroll"><table class="sim-table"><thead>' + tr(th.map(esc), 'hd', 'th') + '</thead><tbody>' + body + tot + '</tbody></table></div></div>';
  }
  function simOut() {
    var o = simObj(), r = C.scenarioCalc(o, S.L, S.today, simOpts()), first = r.rows[0], last = r.rows[r.rows.length - 1];
    var fmt0 = function (v) { return F(v, 'AED', { dec: 0 }); };
    var kpis = kpi(T('Остаток ', 'Result ') + (first ? App.fymShort(first.ym) : ''), App.FS(r.monthly), r.monthly < 0 ? 'neg' : 'pos', T('первый месяц горизонта', 'first month of the horizon')) +
      kpi(T('За ', 'Over ') + r.months + T(' мес.', ' mo'), App.FS(r.total), r.total < 0 ? 'neg' : 'pos', first && last ? App.fymTiny(first.ym) + ' – ' + App.fymTiny(last.ym) : '');
    if (r.delta) kpis += kpi(T('К базе', 'Vs base'), App.FS(r.delta), r.delta < 0 ? 'neg' : 'pos', T('разница за горизонт', 'difference over the horizon'));
    var chartId = 'simBars-' + (o.id || 'base') + '-' + r.months + '-' + (r.total || 0);
    var groups = r.rows.map(function (x) {
      return { label: App.fymTiny(x.ym), valueLabel: fmt0(x.result), tip: App.fym(x.ym) + (x.extraIn || x.extraOut ? ' · ' + T('сценарий ', 'scenario ') + F(x.extraIn - x.extraOut) : ''),
        values: [{ v: x.result, color: x.result < 0 ? 'var(--expense)' : 'var(--income)', name: T('Остаток месяца', 'Month result') }, { v: x.cumulative, color: 'var(--savings)', name: T('Накопительно', 'Cumulative') }] };
    });
    return '<div class="kpis">' + kpis + '</div><div class="card mt12 chart-card" data-sim-chart="' + esc(chartId) + '">' + CH.bars({ id: chartId, height: 160, valueLabels: true, minGroup: 48, groups: groups, fmtTip: function (v) { return F(v); }, legend: [{ name: T('Остаток месяца', 'Month result'), color: 'var(--income)' }, { name: T('Накопительно', 'Cumulative'), color: 'var(--savings)' }] }) + '</div>' + simTable(r);
  }
  function simLineSub(ln) {
    if (ln.repeat === 'monthly') { var n = Math.max(1, parseInt(ln.count, 10) || 1); return App.fymTiny(ln.start) + ' – ' + App.fymTiny(C.addMonths(ln.start, n - 1)) + ' · ' + n + T(' мес.', ' mo'); }
    return T('разово · ', 'one-off · ') + App.fymTiny(ln.start);
  }
  function simLinesBlock() {
    var lines = (S.ui.sim && S.ui.sim.lines) || [], inc = lines.filter(function (l) { return l.kind !== 'expense'; }), exp = lines.filter(function (l) { return l.kind === 'expense'; });
    var row = function (ln) { return '<button type="button" class="row tap" data-a="simLineEdit" data-id="' + esc(ln.id) + '"><div class="main-t"><div class="t1">' + esc(ln.title || (ln.kind === 'expense' ? T('Расход', 'Expense') : T('Доход', 'Income'))) + '</div><div class="t2">' + esc(simLineSub(ln)) + '</div></div><div class="amt num ' + (ln.kind === 'expense' ? 'neg' : 'pos') + '">' + (ln.kind === 'expense' ? '−' : '+') + esc(F(ln.amount)) + '</div></button>'; };
    var h = '<div class="sec-h"><span class="t">' + T('Доп. доходы (сценарий)', 'Extra income (scenario)') + '</span><button type="button" class="more" data-a="simLineNew" data-kind="income">' + I('plus', 'sm') + T('Добавить', 'Add') + '</button></div>';
    h += inc.length ? '<div class="list">' + inc.map(row).join('') + '</div>' : '<div class="card empty">' + T('Нет дополнительных доходов. Эти строки не записываются в плановые платежи — только расчёт сценария.', 'No extra income lines. They are not written to planned payments — scenario only.') + '</div>';
    h += '<div class="sec-h"><span class="t">' + T('Доп. расходы (сценарий)', 'Extra expenses (scenario)') + '</span><button type="button" class="more" data-a="simLineNew" data-kind="expense">' + I('plus', 'sm') + T('Добавить', 'Add') + '</button></div>';
    h += exp.length ? '<div class="list">' + exp.map(row).join('') + '</div>' : '<div class="card empty">' + T('Нет дополнительных расходов.', 'No extra expense lines.') + '</div>';
    return h;
  }
  App.screens.simulator = function () {
    if (!S.ui.sim) simInit('base');
    S.ui.sim.startYm = C.simStartYm(S.L, S.today);
    S.ui.sim.params = C.normalizeSimParams(S.ui.sim.id, S.ui.sim.params);
    var u = S.ui.sim, r = simRun(), n = r.months, mode = u.mode === 'avg' ? 'avg' : 'total';
    var h = '<div class="seg">' + S.L.scenarios.map(function (s) { return '<button class="' + (u.id === s.id ? 'on' : '') + '" data-a="simPreset" data-id="' + s.id + '">' + esc(s.name[App.lang()] || s.name.ru) + '</button>'; }).join('') + '</div>';
    h += '<div class="note mt8" id="simBlurb">' + esc(simPresetBlurb(u.id, u.params)) + (r.delta ? ' ' + T('За ', 'Over ') + n + T(' мес. к базовому: ', ' mo vs base: ') + App.FS(r.delta) + '.' : ' ' + T('За ', 'Over ') + n + T(' мес. совпадает с планом.', ' mo matches the plan.')) + '</div>';
    h += simParamsForm();
    h += '<div class="seg mt12" id="simModeSeg">' + [['total', T('Итого за ', 'Total for ') + n + T(' мес.', ' mo')], ['avg', T('В среднем за месяц', 'Monthly average')]].map(function (x) { return '<button class="' + (mode === x[0] ? 'on' : '') + '" data-a="simMode" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="form mt8">';
    SIMF().forEach(function (x) {
      var locked = !(u.overrides && u.overrides[x[0]]);
      var monthly = locked ? null : (App.toMinor(u[x[0]]) || 0);
      var val = locked ? simFieldVal(r, x[0]) : (mode === 'avg' ? monthly : monthly * n);
      var cap = locked ? T('из плана', 'from plan') : T('изменено', 'edited');
      h += App.fld(x[1] + ' <span class="tiny muted">' + cap + '</span>', '<input class="in" inputmode="decimal" data-live="sim" data-k="' + x[0] + '" value="' + esc(App.amtStr(val)) + '">');
    });
    h += App.fld(T('Месяцев', 'Months'), '<div class="stepper"><button type="button" data-a="simMonths" data-d="-1" aria-label="−">−</button><input class="in" id="simMonths" type="number" min="1" max="36" inputmode="numeric" pattern="[0-9]*" data-live="sim" data-k="months" value="' + esc(u.months) + '"><button type="button" data-a="simMonths" data-d="1" aria-label="+">+</button></div>');
    h += '</div>';
    h += '<div class="note">' + T('Если изменить поле, сумма применяется к каждому месяцу горизонта (займы из плана сохраняются в доходе).', 'If you edit a field, that amount is applied to every month of the horizon (plan borrowings stay in income).') + '</div>';
    h += '<div id="simOut" class="mt12">' + simOut() + '</div>';
    h += simLinesBlock();
    h += '<div class="btns"><button class="btn sec" data-a="simSave">' + T('Сохранить сценарий', 'Save scenario') + '</button><button class="btn" data-a="simApply">' + T('Применить бюджет к плану', 'Apply budget to plan') + '</button></div>';
    h += '<div class="note">' + T('Симулятор не меняет фактические операции. «Применить» меняет только общий личный бюджет месяца (после подтверждения).', 'The simulator never changes actual records. "Apply" only changes the monthly personal budget (after confirmation).') + '</div>';
    return { title: T('Симулятор', 'Simulator'), html: h };
  };
  function simPaint() {
    var o = document.getElementById('simOut'), b = document.getElementById('simBlurb'), u = S.ui.sim;
    if (o) o.innerHTML = simOut();
    if (b && u) {
      var r = simRun(), n = r.months;
      b.textContent = simPresetBlurb(u.id, u.params) + (r.delta ? ' ' + T('За ', 'Over ') + n + T(' мес. к базовому: ', ' mo vs base: ') + App.FS(r.delta) + '.' : ' ' + T('За ', 'Over ') + n + T(' мес. совпадает с планом.', ' mo matches the plan.'));
    }
  }
  App.live.sim = function (el) {
    var u = S.ui.sim; if (!u) return;
    var k = el.dataset.k, r, n, monthly, cap;
    if (k === 'months') {
      var raw = parseInt(el.value, 10);
      if (isFinite(raw) && raw >= 1) { u.months = String(C.clampHorizon(raw)); simPaint(); }
      return;
    }
    r = simRun(); n = r.months || 1;
    monthly = App.toMinor(el.value);
    if (monthly == null || monthly < 0) return;
    if (u.mode !== 'avg') monthly = Math.round(monthly / n);
    u[k] = App.amtStr(monthly);
    u.overrides = u.overrides || {}; u.overrides[k] = true;
    cap = el.closest && el.closest('.fld') && el.closest('.fld').querySelector('.tiny.muted');
    if (cap) cap.textContent = T('изменено', 'edited');
    simPaint();
  };
  App.live.simP = function (el) {
    var u = S.ui.sim, k = el.dataset.k; if (!u) return;
    u.params = u.params || C.normalizeSimParams(u.id);
    if (k === 'bonus') u.params.bonus = App.toMinor(el.value) || 0;
    else u.params[k] = parseFloat(String(el.value).replace(',', '.')) || 0;
    simPaint();
  };
  App.actions.simMonths = function (el) { var u = S.ui.sim, n = C.clampHorizon((parseInt(u.months, 10) || C.HORIZON_DEFAULT) + (+el.dataset.d)); u.months = String(n); App.render(); };
  App.actions.simPreset = function (el) { simInit(el.dataset.id, true); App.render(); };
  App.actions.simMode = function (el) { S.ui.sim.mode = el.dataset.v; App.render(); };
  App.actions.simBandChange = function (el) {
    var u = S.ui.sim, v = el.value;
    u.params = u.params || C.normalizeSimParams(u.id);
    u.params.salaryBand = v;
    App.render();
  };
  App.actions.simSave = function () { var u = S.ui.sim, o = simObj(); App.commit(T('Сценарий сохранён', 'Scenario saved'), function (L) { var s = C.byId(L.scenarios, u.id); Object.assign(s, { months: o.months, lines: o.lines, overrides: o.overrides, usePlan: true, params: o.params, income: o.income, parents: o.parents, loans: o.loans, expenses: o.expenses, savings: o.savings, other: o.other }); }); };
  App.actions.simApply = function () {
    var r = simRun(), monthly = r.avgs ? r.avgs.expenses : (simObj().expenses);
    if (S.ui.sim.overrides && S.ui.sim.overrides.expenses) monthly = App.toMinor(S.ui.sim.expenses) || 0;
    App.confirm(T('Применить к плану?', 'Apply to plan?'), T('Общий личный бюджет месяца станет ', 'The monthly personal budget becomes ') + F(monthly) + T('. Фактические операции не изменятся.', '. Actual records stay unchanged.'), function () { App.commit(T('Личный бюджет обновлён', 'Personal budget updated'), function (L) { L.budgetPlan.total = monthly; }); });
  };
  App.actions.simLineNew = function (el) { App.openModal('simLine', { kind: el.dataset.kind }); };
  App.actions.simLineEdit = function (el) { App.openModal('simLine', { id: el.dataset.id }); };
  App.modals.simLine = function (m) {
    var u = S.ui.sim, f = m.f, cur = m.id ? (u.lines || []).filter(function (l) { return l.id === m.id; })[0] : null;
    var fld = App.fld, inp = App.inp, sel = App.sel;
    if (!m.inited) {
      m.inited = true;
      if (cur) Object.assign(f, { title: cur.title, amount: App.amtStr(cur.amount), start: cur.start, repeat: cur.repeat || 'once', count: String(cur.count || 1), kind: cur.kind || 'income' });
      else Object.assign(f, { title: '', amount: '', start: (u && u.startYm) || C.simStartYm(S.L, S.today), repeat: 'once', count: '1', kind: m.kind || 'income' });
    }
    var h = '<div class="form">' + fld(T('Название', 'Title'), inp('title', f.title)) + fld(T('Сумма, AED', 'Amount, AED'), inp('amount', f.amount, { num: true })) +
      fld(T('С месяца', 'From month'), inp('start', f.start, { type: 'month' })) +
      fld(T('Повтор', 'Repeat'), sel('repeat', App.opts([['once', T('Разово', 'One-off')], ['monthly', T('Ежемесячно', 'Monthly')]], f.repeat), { re: 1 }));
    if (f.repeat === 'monthly') h += fld(T('Сколько месяцев', 'How many months'), inp('count', f.count, { num: true }));
    h += '</div><div class="note">' + T('Строка влияет только на этот сценарий симулятора. Плановые платежи и бюджетные периоды не изменятся.', 'This line affects only this simulator scenario. Planned payments and budget periods stay unchanged.') + '</div>';
    if (cur) h += '<div class="btns"><button class="btn danger" data-a="simLineDelete">' + I('trash') + T('Удалить строку', 'Delete line') + '</button></div>';
    return { title: cur ? T('Строка сценария', 'Scenario line') : (f.kind === 'expense' ? T('Доп. расход', 'Extra expense') : T('Доп. доход', 'Extra income')), html: h, done: 'simLineSave', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.simLineSave = function () {
    var m = S.modal, f = m.f, amt = App.toMinor(f.amount), u = S.ui.sim;
    if (amt == null || amt < 0) { m.err = T('Введите сумму', 'Enter an amount'); App.renderModal(); return; }
    if (!/^\d{4}-\d{2}$/.test(f.start || '')) { m.err = T('Укажите месяц', 'Set a month'); App.renderModal(); return; }
    var line = { id: m.id || C.uid('sln'), kind: f.kind || 'income', title: f.title || (f.kind === 'expense' ? T('Расход', 'Expense') : T('Доход', 'Income')), amount: amt, start: f.start, repeat: f.repeat || 'once', count: Math.max(1, parseInt(f.count, 10) || 1) };
    u.lines = u.lines || [];
    if (m.id) { var i; for (i = 0; i < u.lines.length; i++) if (u.lines[i].id === m.id) { u.lines[i] = line; break; } }
    else u.lines.push(line);
    App.closeModal(); App.render();
  };
  App.actions.simLineDelete = function () { var id = S.modal.id; S.ui.sim.lines = (S.ui.sim.lines || []).filter(function (l) { return l.id !== id; }); App.closeModal(); App.render(); };

  /* ---------- health ---------- */
  /* ---------- health ---------- */
  App.screens.health = function () {
    var hs = C.healthScore(S.L, S.today), col = hs.score >= 70 ? 'var(--income)' : hs.score >= 45 ? 'var(--planned)' : 'var(--expense)';
    var N = { reserve: [T('Резерв 5 000 AED', 'Reserve 5,000 AED'), function (v) { return F(v); }], shortDebt: [T('Краткосрочный долг', 'Short-term debt'), function (v) { return F(v); }], debtService: [T('Платежи по долгам / доход', 'Debt payments / income'), function (v) { return App.pct(v, 0); }], overdue: [T('Просроченные платежи', 'Overdue payments'), function (v) { return String(v); }], incomeVsObligations: [T('Доход против обязательств', 'Income vs obligations'), function (v) { return App.pct(v, 0); }], budget: [T('Соблюдение бюджета', 'Budget adherence'), function (v) { return App.pct(v, 0) + T(' использовано', ' used'); }], impulse: [T('Импульсивные расходы', 'Impulse spending'), function (v) { return App.pct(v, 0); }], incomeStability: [T('Стабильность дохода', 'Income stability'), function (v) { return v == null ? T('нет данных', 'no data') : App.pct(v, 0); }], savingsTrend: [T('Динамика накоплений (30 дн.)', 'Savings trend (30d)'), function (v) { return F(v, 'AED', { plus: true }); }] };
    var h = '<div class="card center">' + CH.ring(hs.score / 100, col, 140, '<div class="b" style="font-size:36px">' + hs.score + '</div><div class="tiny muted">/ 100</div>') + '<div class="small muted mt8">' + T('Прозрачная оценка: 9 факторов, вес указан справа', 'Transparent score: 9 factors, weight on the right') + '</div></div>';
    h += '<div class="list">' + hs.parts.map(function (p) { var n = N[p.id] || [p.id, String]; return '<div class="row"><div class="main-t"><div class="t1">' + esc(n[0]) + '</div><div class="t2">' + esc(n[1](p.value)) + '</div><div class="bar thin mt8"><i style="width:' + (p.score / p.max * 100) + '%;background:' + (p.score / p.max >= .7 ? 'var(--income)' : p.score / p.max >= .4 ? 'var(--planned)' : 'var(--expense)') + '"></i></div></div><div class="amt"><div class="num b">' + p.score + '</div><div class="t2">/ ' + p.max + '</div></div></div>'; }).join('') + '</div>';
    return { title: T('Финансовое здоровье', 'Financial health'), html: h };
  };

  /* ---------- business & investments ---------- */
  App.screens.business = function () {
    var L = S.L, h = '<div class="sec-h"><span class="t">' + T('Проекты', 'Projects') + '</span><button class="more" data-a="modal" data-m="project">' + I('plus', 'sm') + T('Добавить', 'Add') + '</button></div>';
    h += (L.projects || []).length ? '<div class="list">' + L.projects.map(function (p) { var st = C.projectStats(L, p.id); return '<button class="row tap" data-a="go" data-s="project" data-id="' + p.id + '"><span class="cat-ic sq" style="background:#AC8E68">' + I('briefcase') + '</span><div class="main-t"><div class="t1">' + esc(p.name) + '</div><div class="t2">' + T('доход ', 'income ') + esc(F(st.income)) + ' · ' + T('расходы ', 'costs ') + esc(F(st.expenses + st.invested)) + '</div></div><div class="amt"><div class="num ' + (st.net < 0 ? 'neg' : 'pos') + '">' + esc(App.FS(st.net)) + '</div></div></button>'; }).join('') + '</div>' : '<div class="card empty">' + T('Проектов пока нет. Добавьте проект и привязывайте к нему записи (поле «Проект» в форме записи).', 'No projects yet. Add one and link records to it (the "Project" field of a record).') + '</div>';
    var tot = 0, unconv = false;
    h += '<div class="sec-h"><span class="t">' + T('Инвестиционные активы', 'Investment assets') + '</span><button class="more" data-a="modal" data-m="asset">' + I('plus', 'sm') + T('Добавить', 'Add') + '</button></div>';
    h += (L.assets || []).length ? '<div class="list">' + L.assets.map(function (a) { var v = C.assetValue(L, a); if (v.valueBase == null) unconv = true; else tot += v.valueBase; return '<button class="row tap" data-a="modal" data-m="asset" data-id="' + a.id + '"><span class="cat-ic sq" style="background:#5E5CE6">' + I('invest') + '</span><div class="main-t"><div class="t1">' + esc(a.name) + '</div><div class="t2">' + esc(String(a.qty)) + ' × ' + esc(F(a.price, a.currency)) + '</div></div><div class="amt"><div class="num">' + esc(F(v.value, a.currency)) + '</div><div class="t2 num ' + (v.pl < 0 ? 'neg' : 'pos') + '">' + esc(F(v.pl, a.currency, { plus: true })) + (v.plPct != null ? ' · ' + App.pct(v.plPct, 1) : '') + '</div></div></button>'; }).join('') + '</div>' + '<div class="card">' + kv(T('Итого в AED', 'Total in AED'), F(tot)) + (unconv ? '<div class="tiny unconf">' + T('Есть активы без курса валюты', 'Some assets have no currency rate') + '</div>' : '') + '<div class="tiny muted mt8">' + T('Цены вводятся вручную — котировки из интернета не загружаются. Инвестиции не входят в свободные деньги.', 'Prices are entered manually — no online quotes. Investments are not part of free money.') + '</div></div>' : '<div class="card empty">' + T('Активов пока нет', 'No assets yet') + '</div>';
    return { title: T('Бизнес и инвестиции', 'Business & investments'), html: h };
  };
  App.screens.project = function (p) {
    var L = S.L, pr = C.byId(L.projects, p.id); if (!pr) return { title: '—', html: '<div class="empty">—</div>' };
    var st = C.projectStats(L, pr.id), mk = Object.keys(st.months).sort();
    var h = '<div class="kpis">' + kpi(T('Доход', 'Income'), F(st.income), 'pos') + kpi(T('Расходы', 'Costs'), F(st.expenses), 'neg') + kpi(T('Вложено', 'Invested'), F(st.invested), 'plan') + kpi(T('Чистый результат', 'Net result'), App.FS(st.net), st.net < 0 ? 'neg' : 'pos') + '</div>';
    h += '<div class="card mt12">' + kv('ROI', App.pct(st.roi, 1)) + kv(T('Маржа', 'Margin'), App.pct(st.margin, 1)) + kv(T('Окупаемость', 'Payback'), st.paybackMonths ? st.paybackMonths + T(' мес.', ' mo') : '—') + '</div>';
    if (mk.length) h += '<div class="card">' + CH.bars({ id: 'prjBars', groups: mk.map(function (ym) { return { label: App.fymShort(ym), values: [{ v: st.months[ym].income, color: 'var(--income)', name: T('доход', 'income') }, { v: -st.months[ym].out, color: 'var(--expense)', name: T('расходы', 'costs') }] }; }), fmtTip: function (v) { return F(v); } }) + '</div>';
    h += '<div class="sec-h"><span class="t">' + T('Записи проекта', 'Project records') + '</span></div>' + App.txList(st.txs);
    h += '<div class="btns"><button class="btn sec" data-a="modal" data-m="project" data-id="' + pr.id + '">' + I('edit') + T('Изменить', 'Edit') + '</button></div>';
    return { title: pr.name, html: h };
  };

  /* ---------- assistant (rule-based) ---------- */
  function chips() { return [T('Сколько я могу потратить сегодня?', 'How much can I spend today?'), T('Какие ближайшие платежи?', 'What payments are upcoming?'), T('Хватит ли денег до зарплаты?', 'Will money last until payday?'), T('Когда я закрою краткосрочные кредиты?', 'When will I close short-term debt?'), T('Когда я накоплю резерв 5000 AED?', 'When will I reach the 5000 AED reserve?'), T('Что будет, если доход уменьшится?', 'What if income drops?'), T('Сколько я отправил родителям?', 'How much did I send to parents?'), T('Где сократить расходы?', 'Where can I cut spending?'), T('Сколько я плачу процентов?', 'How much interest do I pay?')]; }
  App.screens.assistant = function () {
    var h = '<div class="alert info">' + I('info') + '<div class="grow small">' + T('Помощник работает на правилах и ваших данных, без ИИ и без интернета. Ответы — расчёт по книге, а не совет.', 'The assistant is rule-based on your data — no AI, no internet. Answers are calculations from the ledger, not advice.') + '</div></div>';
    h += '<div class="chat">' + S.ui.chat.map(function (m) { return '<div class="msg ' + m.who + '">' + (m.who === 'me' ? esc(m.text) : m.lines.map(esc).join('<br>')) + '</div>'; }).join('') + '</div>';
    h += '<div class="chips wrap">' + chips().map(function (c) { return '<button class="chip" data-a="ask" data-q="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
    h += '<form class="ask-bar" onsubmit="return false"><input class="in" id="askIn" placeholder="' + T('Ваш вопрос…', 'Your question…') + '"><button class="btn" data-a="askSend">' + I('arrowIn') + '</button></form>';
    if (S.ui.chat.length) h += '<div class="btns"><button class="btn sec" data-a="askClear">' + T('Очистить', 'Clear') + '</button></div>';
    return { title: T('Помощник', 'Assistant'), html: h, after: function () { var c = document.querySelector('.chat .msg:last-child'); if (c) c.scrollIntoView({ block: 'nearest' }); } };
  };
  function ask(q) { if (!q || !q.trim()) return; var r = C.assistant(S.L, q, S.today, App.lang()); S.ui.chat.push({ who: 'me', text: q }, { who: 'bot', lines: r.lines.length ? r.lines : [T('Нет данных для ответа.', 'No data to answer.')] }); App.render(); }
  App.actions.ask = function (el) { ask(el.dataset.q); };
  App.actions.askSend = function () { var i = document.getElementById('askIn'); ask(i && i.value); };
  App.actions.askClear = function () { S.ui.chat = []; App.render(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'askIn') { e.preventDefault(); ask(e.target.value); } });

  /* ---------- change log ---------- */
  App.screens.changelog = function () {
    var L = S.L, list = (L.changelog || []).slice(0, 300);
    var h = list.length ? '<div class="list">' + list.map(function (c) { var d = new Date(c.ts); return '<div class="row"><span class="cat-ic sq" style="background:' + (c.action === 'undo' ? '#FF9F0A' : '#636366') + '">' + I(c.action === 'undo' ? 'undo' : 'edit') + '</span><div class="main-t"><div class="t1">' + esc(c.summary) + '</div><div class="t2">' + esc(d.toLocaleString(App.lang() === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'medium', timeStyle: 'short' })) + ' · ' + esc(c.action) + '</div></div></div>'; }).join('') + '</div>' : '<div class="card empty">' + T('Изменений пока нет', 'No changes yet') + '</div>';
    return { title: T('Журнал изменений', 'Change log'), html: h };
  };

  /* ---------- currencies ---------- */
  App.screens.currencies = function () {
    var L = S.L, h = '<div class="form"><div class="group">' + Object.keys(L.rates).map(function (c) { return App.fld(c + (c === 'AED' ? T(' (базовая)', ' (base)') : ' → AED'), c === 'AED' ? '<span class="muted">1</span>' : '<input class="in" inputmode="decimal" data-ch="rateSet" data-c="' + c + '" value="' + esc(String(L.rates[c])) + '">'); }).join('') + '</div></div>';
    var rest = C.CURRENCIES.filter(function (c) { return !(c in L.rates); });
    if (rest.length) h += '<div class="form mt12"><div class="group">' + App.fld(T('Добавить валюту', 'Add currency'), '<select class="in" data-ch="rateAdd"><option value="">—</option>' + rest.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>') + '</div></div>';
    h += '<div class="note">' + T('Курсы вводятся вручную: сколько AED стоит 1 единица валюты. Автоматическая загрузка курсов не используется. Суммы в валютах без курса не конвертируются и помечаются отдельно.', 'Rates are entered manually: AED per 1 unit. No automatic rate download. Amounts in currencies without a rate are not converted and are flagged.') + '</div>';
    return { title: T('Валюты и курсы', 'Currencies & rates'), html: h };
  };
  App.actions.rateSet = function (el) { var v = parseFloat(String(el.value).replace(',', '.')); if (!(v > 0)) { App.toast(T('Неверный курс', 'Invalid rate')); App.render(); return; } App.commit(T('Курс ', 'Rate ') + el.dataset.c + ' = ' + v, function (L) { L.rates[el.dataset.c] = v; }); };
  App.actions.rateAdd = function (el) { if (!el.value) return; var c = el.value; var v = parseFloat(String(window.prompt(T('Сколько AED за 1 ', 'AED per 1 ') + c + '?', '') || '').replace(',', '.')); if (!(v > 0)) { App.render(); return; } App.commit(T('Добавлена валюта ', 'Currency added ') + c, function (L) { L.rates[c] = v; }); };

  /* ---------- categories ---------- */
  App.screens.categories = function () {
    var L = S.L, h = '';
    [['expense', T('Расходы', 'Expenses')], ['income', T('Доходы', 'Income')]].forEach(function (k) {
      h += '<div class="sec-h"><span class="t">' + k[1] + '</span><button class="more" data-a="modal" data-m="category" data-kind="' + k[0] + '">' + I('plus', 'sm') + T('Добавить', 'Add') + '</button></div><div class="list">';
      L.categories.filter(function (c) { return c.kind === k[0] && !c.parent; }).forEach(function (c) {
        h += '<button class="row tap" data-a="modal" data-m="category" data-id="' + c.id + '">' + App.catIcon(c) + '<div class="main-t"><div class="t1">' + esc(App.catName(c)) + (c.system ? ' <span class="tag">' + T('системная', 'system') + '</span>' : '') + (c.impulse ? ' <span class="tag warn">' + T('импульс', 'impulse') + '</span>' : '') + '</div>' + (c.limit ? '<div class="t2">' + T('лимит ', 'limit ') + esc(F(c.limit)) + '</div>' : '') + '</div><span class="chev">' + I('chev', 'sm') + '</span></button>';
        L.categories.filter(function (s) { return s.parent === c.id; }).forEach(function (s) { h += '<button class="row tap sub" data-a="modal" data-m="category" data-id="' + s.id + '">' + App.catIcon(s) + '<div class="main-t"><div class="t1">' + esc(App.catName(s)) + '</div>' + (s.limit ? '<div class="t2">' + T('лимит ', 'limit ') + esc(F(s.limit)) + '</div>' : '') + '</div><span class="chev">' + I('chev', 'sm') + '</span></button>'; });
      });
      h += '</div>';
    });
    return { title: T('Категории', 'Categories'), html: h };
  };

  /* ---------- data, import, backups ---------- */
  App.screens.data = function () {
    var L = S.L, mode = AFDB.mode();
    var ML = { indexeddb: T('IndexedDB (локально в этом браузере)', 'IndexedDB (local to this browser)'), localstorage: T('localStorage (резервный режим, лимит ~5 МБ)', 'localStorage (fallback, ~5 MB limit)'), memory: T('Только память — данные НЕ сохранятся после закрытия!', 'Memory only — data will NOT survive closing!') }[mode];
    var h = '<div class="alert ' + (mode === 'memory' ? 'danger' : 'info') + '">' + I(mode === 'memory' ? 'alert' : 'info') + '<div class="grow small"><b>' + T('Хранилище: ', 'Storage: ') + esc(ML) + '</b><br>' + T('Облачной синхронизации нет. Данные хранятся только на этом устройстве и в этом браузере. Для переноса между iPhone и Windows используйте экспорт/импорт JSON.', 'There is no cloud sync. Data lives only on this device and in this browser. Use JSON export/import to move it between iPhone and Windows.') + (S.persisted === true ? '<br>' + T('Браузер разрешил постоянное хранение.', 'The browser granted persistent storage.') : S.persisted === false ? '<br>' + T('Браузер не гарантирует постоянное хранение — регулярно делайте резервную копию.', 'The browser does not guarantee persistence — export backups regularly.') : '') + '</div></div>';
    h += '<div class="gh">' + T('Экспорт', 'Export') + '</div><div class="list">' +
      row('download', '#0A84FF', T('Резервная копия JSON', 'JSON backup'), T('Полная книга: счета, записи, планы, цели', 'Full ledger: accounts, records, plans, goals'), 'data-a="expJson"') +
      row('download', '#30D158', T('Экспорт записей CSV', 'Export records CSV'), T('Для Excel / Numbers', 'For Excel / Numbers'), 'data-a="expCsv"') + '</div>';
    h += '<div class="gh">' + T('Импорт', 'Import') + '</div><div class="list"><label class="row tap" style="cursor:pointer"><span class="cat-ic sq" style="background:#FF9F0A">' + I('upload') + '</span><div class="main-t"><div class="t1">' + T('Импортировать файл книги / резервной копии', 'Import ledger / backup file') + '</div><div class="t2">' + T('Проверка, предпросмотр, замена или объединение без дублей', 'Validation, preview, replace or merge without duplicates') + '</div></div><input type="file" accept=".json,application/json" data-ch="importPick" style="display:none"></label></div>';
    h += '<div class="gh">' + T('Снимки (автоматические резервные копии)', 'Snapshots (automatic backups)') + '</div><div id="snapList" class="list"><div class="row"><div class="main-t muted">…</div></div></div>';
    h += '<div class="note">' + T('Снимок создаётся раз в день при открытии и перед каждой заменой книги. Хранятся последние 15.', 'A snapshot is made daily on open and before every ledger replacement. The last 15 are kept.') + '</div>';
    h += '<div class="gh">' + T('Опасная зона', 'Danger zone') + '</div><div class="list">' +
      row('plus', '#636366', T('Начать новую пустую книгу', 'Start a new empty ledger'), T('Текущая сохранится в снимке', 'Current one is kept in a snapshot'), 'data-a="dataNew"') +
      row('trash', '#FF453A', T('Удалить все данные на этом устройстве', 'Delete all data on this device'), T('Включая снимки. Необратимо.', 'Including snapshots. Irreversible.'), 'data-a="dataWipe"') + '</div>';
    h += '<div class="small muted mt12 center">' + L.accounts.length + T(' счетов · ', ' accounts · ') + L.transactions.length + T(' записей · ', ' records · ') + L.planned.length + T(' плановых · ', ' planned · ') + (L.goals || []).length + T(' целей', ' goals') + (L.meta.savedAt ? '<br>' + T('Сохранено: ', 'Saved: ') + esc(new Date(L.meta.savedAt).toLocaleString(App.lang() === 'en' ? 'en-GB' : 'ru-RU')) : '') + '</div>';
    return { title: T('Данные', 'Data'), html: h, after: function () {
      AFDB.listSnapshots().then(function (list) {
        var el = document.getElementById('snapList'); if (!el) return;
        App._snaps = list;
        el.innerHTML = list.length ? list.map(function (s, i) { var n = s.data && s.data.transactions ? s.data.transactions.length : 0; return '<div class="row"><span class="cat-ic sq" style="background:#636366">' + I('shield') + '</span><div class="main-t"><div class="t1">' + esc(new Date(s.ts).toLocaleString(App.lang() === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'medium', timeStyle: 'short' })) + '</div><div class="t2">' + esc(s.reason) + ' · ' + n + T(' записей', ' records') + '</div></div><button class="act" data-a="snapRestore" data-i="' + i + '">' + T('Восстановить', 'Restore') + '</button></div>'; }).join('') : '<div class="row"><div class="main-t muted">' + T('Снимков пока нет', 'No snapshots yet') + '</div></div>';
      });
    } };
  };
  function stamp() { return S.today + '-' + new Date().toTimeString().slice(0, 5).replace(':', ''); }
  App.actions.expJson = function () { App.download('akbar-finance-backup-' + stamp() + '.json', JSON.stringify({ kind: 'akbar-finance-backup', exportedAt: new Date().toISOString(), app: 'Akbar Finance 3.0', ledger: S.L }, null, 1)); C.log(S.L, 'export', 'JSON backup'); App.save(); App.toast(T('Резервная копия скачана', 'Backup downloaded')); };
  App.actions.expCsv = function () { App.download('akbar-finance-records-' + stamp() + '.csv', '\ufeff' + C.exportCSV(S.L, App.lang()), 'text/csv;charset=utf-8'); App.toast(T('CSV скачан', 'CSV downloaded')); };
  App.actions.snapRestore = function (el) { var s = App._snaps && App._snaps[+el.dataset.i]; if (!s) return; App.confirm(T('Восстановить снимок?', 'Restore snapshot?'), T('Текущая книга будет заменена снимком от ', 'The current ledger will be replaced by the snapshot from ') + new Date(s.ts).toLocaleString() + T('. Перед заменой текущая книга сохранится в новом снимке.', '. The current ledger is snapshotted first.'), function () { var L = C.normalizeLedger(s.data).ledger; C.log(L, 'restore', 'snapshot ' + s.ts); App.setLedger(L, 'restore').then(function () { App.toast(T('Снимок восстановлен', 'Snapshot restored')); }); }); };
  App.actions.dataNew = function () { App.confirm(T('Новая книга?', 'New ledger?'), T('Будет создана пустая книга. Текущая сохранится в снимке, и её можно восстановить в разделе «Данные».', 'An empty ledger is created. The current one is kept as a snapshot and can be restored under Data.'), function () { var L = C.newLedger({ lang: App.lang(), today: S.today }); C.log(L, 'create', 'new ledger'); App.setLedger(L, 'new'); }, true); };
  App.actions.dataWipe = function () { App.confirm(T('Удалить всё?', 'Delete everything?'), T('Книга и все снимки будут удалены с этого устройства без возможности восстановления. Сначала скачайте резервную копию JSON.', 'The ledger and all snapshots will be removed from this device permanently. Download a JSON backup first.'), function () { AFDB.clearAll().then(function () { S.L = null; S.stack = []; S.undo = []; S.tab = 'home'; App.render(); App.toast(T('Данные удалены', 'Data deleted')); }); }, true, T('Удалить', 'Delete')); };

  /* ---------- settings ---------- */
  App.screens.settings = function () {
    var L = S.L, st = L.settings;
    var h = '<div class="form"><div class="group">' +
      App.fld(T('Язык', 'Language'), '<select class="in" data-ch="setLang">' + App.opts([['ru', 'Русский'], ['en', 'English']], st.lang) + '</select>') +
      App.fld(T('Тема', 'Theme'), '<select class="in" data-ch="setTheme">' + App.opts([['dark', T('Тёмная', 'Dark')], ['light', T('Светлая', 'Light')], ['auto', T('Как в системе', 'System')]], st.theme) + '</select>') +
      App.fld(T('Название книги', 'Ledger name'), '<input class="in" data-ch="setName" value="' + esc(L.meta.name) + '">') +
      '</div></div><div class="form mt12"><div class="group">' +
      App.fld(T('Горизонт обязательств, дней', 'Obligations horizon, days'), '<input class="in" inputmode="numeric" data-ch="setNum" data-k="obligationsHorizonDays" value="' + (st.obligationsHorizonDays || 30) + '">') +
      App.fld(T('Напоминать о платежах за, дней', 'Remind about payments, days ahead'), '<input class="in" inputmode="numeric" data-ch="setNum" data-k="upcomingDays" value="' + (st.upcomingDays || 7) + '">') +
      App.fld(T('Личный бюджет в месяц, AED', 'Personal budget per month, AED'), '<input class="in" inputmode="decimal" data-ch="setBudget" value="' + App.amtStr(L.budgetPlan.total) + '">') +
      '</div><div class="note">' + T('Свободные деньги = собственные деньги (без резерва и накоплений) минус обязательства в пределах горизонта.', 'Free money = own money (excluding reserve and savings) minus obligations within the horizon.') + '</div></div>';
    h += '<div class="list mt12">' + row('info', '#8E8E93', T('Уведомления', 'Notifications'), T('Только внутри приложения: push-уведомления не используются', 'In-app only: push notifications are not used'), go('notifications')) + '</div>';
    return { title: T('Настройки', 'Settings'), html: h };
  };
  App.actions.setLang = function (el) { App.prefs.lang = el.value; App.savePrefs(); App.commit(el.value === 'en' ? 'Language: English' : 'Язык: русский', function (L) { L.settings.lang = el.value; }, { silent: true }); };
  App.actions.setTheme = function (el) { App.prefs.theme = el.value; App.savePrefs(); App.commit(T('Тема изменена', 'Theme changed'), function (L) { L.settings.theme = el.value; }, { silent: true }); };
  App.actions.setName = function (el) { var v = el.value.trim(); if (!v) return; App.commit(T('Название книги изменено', 'Ledger renamed'), function (L) { L.meta.name = v; }, { silent: true }); };
  App.actions.setNum = function (el) { var v = parseInt(el.value, 10); if (!(v >= 1 && v <= 365)) { App.toast(T('Введите от 1 до 365', 'Enter 1–365')); App.render(); return; } App.commit(T('Настройка сохранена', 'Setting saved'), function (L) { L.settings[el.dataset.k] = v; }, { silent: true }); };
  App.actions.setBudget = function (el) { var v = App.toMinor(el.value); if (v == null || v < 0) { App.render(); return; } App.commit(T('Личный бюджет обновлён', 'Personal budget updated'), function (L) { L.budgetPlan.total = v; }); };

  /* ---------- about & limitations ---------- */
  App.screens.about = function () {
    var li = function (a) { return '<li>' + a + '</li>'; };
    var h = '<div class="card"><div class="b">Akbar Finance 3.0 · v3.4</div><div class="small muted mt8">' + T('Личное приложение учёта финансов. Интерфейс вдохновлён структурой Wallet by BudgetBakers, собственная реализация без чужих логотипов и ресурсов.', 'Personal finance ledger. Interface inspired by the Wallet by BudgetBakers layout; own implementation, no third-party logos or assets.') + '</div></div>';
    h += '<div class="card"><div class="card-h"><span class="t">' + T('Честные ограничения', 'Honest limitations') + '</span></div><ul class="small ul">' +
      li(T('Нет облачной синхронизации и аккаунтов. Данные — только в этом браузере на этом устройстве.', 'No cloud sync or accounts. Data stays in this browser on this device.')) +
      li(T('Перенос между iPhone и Windows — вручную через экспорт/импорт JSON.', 'Moving between iPhone and Windows is manual via JSON export/import.')) +
      li(T('Нет подключения к банкам: все операции вводятся вручную.', 'No bank connections: all records are entered manually.')) +
      li(T('Уведомления только внутри приложения; push-уведомлений нет.', 'In-app notifications only; no push.')) +
      li(T('Помощник работает по правилам, это не ИИ.', 'The assistant is rule-based, not AI.')) +
      li(T('Курсы валют и цены активов вводятся вручную.', 'Currency rates and asset prices are entered manually.')) +
      li(T('Неподтверждённые ставки по кредитам не используются для начисления процентов; расчётные ставки явно помечены как оценка.', 'Unconfirmed loan rates are never used to accrue interest; estimated rates are clearly marked as estimates.')) +
      li(T('Safari может удалить данные сайта, если им долго не пользоваться (особенно при открытии не с экрана «Домой») — регулярно делайте резервную копию.', 'Safari may evict site data after long inactivity (especially when not opened from the Home Screen) — back up regularly.')) +
      li(T('Офлайн-режим (service worker) работает только при открытии по http(s); у автономного HTML-файла офлайн-кэша нет, но он сам по себе не требует сети.', 'Offline mode (service worker) works only over http(s); the standalone HTML file has no offline cache but needs no network anyway.')) +
      '</ul></div>';
    h += '<div class="small muted center">' + T('Хранилище: ', 'Storage: ') + esc(AFDB.mode()) + ' · ' + (window.AF_STANDALONE ? T('автономный файл', 'standalone file') : location.protocol.replace(':', '')) + '</div>';
    return { title: T('О приложении', 'About'), html: h };
  };
})();
