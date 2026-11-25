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
      row('info', '#8E8E93', T('О приложении и ограничения', 'About & limitations'), 'Akbar Finance 3.0 · v3.1', go('about')) + '</div>';
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
  function SIMF() { return [['income', T('Доход в месяц', 'Monthly income')], ['parents', T('Родителям', 'Parents')], ['loans', T('Кредиты', 'Loans')], ['expenses', T('Личные расходы', 'Personal spending')], ['savings', T('Сбережения', 'Savings')], ['other', T('Прочие обязательства', 'Other obligations')]]; }
  function simInit(id) { var s = C.byId(S.L.scenarios, id) || S.L.scenarios[1] || S.L.scenarios[0]; S.ui.sim = { id: s.id, income: App.amtStr(s.income), parents: App.amtStr(s.parents), loans: App.amtStr(s.loans), expenses: App.amtStr(s.expenses), savings: App.amtStr(s.savings || 0), other: App.amtStr(s.other || 0), months: String(s.months || 5) }; }
  function simObj() { var u = S.ui.sim, o = { months: Math.max(1, Math.min(60, parseInt(u.months, 10) || 5)) }; ['income', 'parents', 'loans', 'expenses', 'savings', 'other'].forEach(function (k) { o[k] = App.toMinor(u[k] || '0') || 0; }); return o; }
  function simOut() {
    var o = simObj(), r = C.scenarioCalc(o);
    return '<div class="kpis">' + kpi(T('Остаток в месяц', 'Monthly result'), App.FS(r.monthly), r.monthly < 0 ? 'neg' : 'pos') + kpi(T('За ', 'Over ') + o.months + T(' мес.', ' mo'), App.FS(r.total), r.total < 0 ? 'neg' : 'pos', T('с учётом сбережений ', 'incl. savings ') + F(r.savedTotal)) + '</div>' +
      '<div class="card mt12">' + CH.bars({ id: 'simBars', groups: r.rows.map(function (x) { return { label: String(x.n), tip: T('Месяц ', 'Month ') + x.n, values: [{ v: x.free, color: x.free < 0 ? 'var(--expense)' : 'var(--income)', planned: true, name: T('свободно накопительно', 'free cumulative') }, { v: x.cumulative, color: 'var(--savings)', planned: true, name: T('с накоплениями', 'with savings') }] }; }), fmtTip: function (v) { return F(v); } }) + '</div>';
  }
  App.screens.simulator = function () {
    if (!S.ui.sim) simInit('base');
    var u = S.ui.sim, h = '<div class="seg">' + S.L.scenarios.map(function (s) { return '<button class="' + (u.id === s.id ? 'on' : '') + '" data-a="simPreset" data-id="' + s.id + '">' + esc(s.name[App.lang()] || s.name.ru) + '</button>'; }).join('') + '</div>';
    h += '<div class="form mt12"><div class="group">' + SIMF().map(function (x) { return App.fld(x[1] + ', AED', '<input class="in" inputmode="decimal" data-live="sim" data-k="' + x[0] + '" value="' + esc(u[x[0]]) + '">'); }).join('') + App.fld(T('Месяцев', 'Months'), '<input class="in" inputmode="numeric" data-live="sim" data-k="months" value="' + esc(u.months) + '">') + '</div></div>';
    h += '<div id="simOut" class="mt12">' + simOut() + '</div>';
    h += '<div class="btns"><button class="btn sec" data-a="simSave">' + T('Сохранить сценарий', 'Save scenario') + '</button><button class="btn" data-a="simApply">' + T('Применить бюджет к плану', 'Apply budget to plan') + '</button></div>';
    h += '<div class="note">' + T('Симулятор не меняет фактические операции. «Применить» меняет только общий личный бюджет месяца (после подтверждения).', 'The simulator never changes actual records. "Apply" only changes the monthly personal budget (after confirmation).') + '</div>';
    return { title: T('Симулятор', 'Simulator'), html: h };
  };
  App.live.sim = function (el) { S.ui.sim[el.dataset.k] = el.value; var o = document.getElementById('simOut'); if (o) o.innerHTML = simOut(); };
  App.actions.simPreset = function (el) { simInit(el.dataset.id); App.render(); };
  App.actions.simSave = function () { var u = S.ui.sim, o = simObj(); App.commit(T('Сценарий сохранён', 'Scenario saved'), function (L) { var s = C.byId(L.scenarios, u.id); Object.assign(s, o); }); };
  App.actions.simApply = function () { var o = simObj(); App.confirm(T('Применить к плану?', 'Apply to plan?'), T('Общий личный бюджет месяца станет ', 'The monthly personal budget becomes ') + F(o.expenses) + T('. Фактические операции не изменятся.', '. Actual records stay unchanged.'), function () { App.commit(T('Личный бюджет обновлён', 'Personal budget updated'), function (L) { L.budgetPlan.total = o.expenses; }); }); };

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
    var h = '<div class="card"><div class="b">Akbar Finance 3.0 · v3.1</div><div class="small muted mt8">' + T('Личное приложение учёта финансов. Интерфейс вдохновлён структурой Wallet by BudgetBakers, собственная реализация без чужих логотипов и ресурсов.', 'Personal finance ledger. Interface inspired by the Wallet by BudgetBakers layout; own implementation, no third-party logos or assets.') + '</div></div>';
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
