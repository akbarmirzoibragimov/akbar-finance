/* Dashboard, accounts, records, notifications, onboarding */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, CH = App.CH, S = App.S, T = App.T, F = App.F, esc = App.esc;

  /* ---------- shared row renderers ---------- */
  var TX_ICON = { salary: 'wallet', income: 'arrowIn', debt_return: 'undo', expense: 'cart', card_purchase: 'card', transfer: 'swap', reserve_topup: 'shield', savings_topup: 'piggy', loan_receipt: 'loan', repayment: 'check', interest: 'percent', fee: 'receipt', family: 'family', adjustment: 'edit' };
  var TX_COLOR = { salary: '#30D158', income: '#30D158', debt_return: '#66D4CF', transfer: '#0A84FF', reserve_topup: '#FF9F0A', savings_topup: '#BF5AF2', loan_receipt: '#8E8E93', repayment: '#0A84FF', interest: '#FF453A', fee: '#FF453A', family: '#BF5AF2', adjustment: '#8E8E93' };
  App.txSign = function (t) {
    var c = { salary: 1, income: 1, debt_return: 1, loan_receipt: 1, expense: -1, card_purchase: -1, family: -1, interest: -1, fee: -1, repayment: -1, transfer: 0, reserve_topup: 0, savings_topup: 0, adjustment: 0 }[t.type];
    return c;
  };
  App.txRow = function (t, accCtx) {
    var cat = t.categoryId && App.cat(t.categoryId);
    var useCat = cat && ['expense', 'card_purchase', 'salary', 'income'].indexOf(t.type) >= 0;
    var icon = useCat ? App.catIcon(cat) : '<span class="cat-ic" style="background:' + (TX_COLOR[t.type] || '#8E8E93') + '">' + I(TX_ICON[t.type] || 'dots') + '</span>';
    var title = useCat ? App.catName(cat) : App.TX_TYPES()[t.type];
    var from = App.acc(t.fromAccountId), to = App.acc(t.toAccountId);
    var sub = [from && from.name, to && to.name].filter(Boolean).join(' → ');
    if (t.note) sub += (sub ? ' · ' : '') + t.note;
    var amt, cls = '', cur = C.txCurrency(S.L, t);
    if (accCtx) {
      var eff = C.txEffects(S.L, Object.assign({}, t, { status: 'cleared' })).filter(function (e) { return e.acc === accCtx.id; }).reduce(function (s, e) { return s + e.delta; }, 0);
      if (C.isLiab(accCtx)) { amt = F(eff, accCtx.currency, { plus: true }); cls = eff > 0 ? 'neg' : 'pos'; }
      else { amt = F(eff, accCtx.currency, { plus: true }); cls = eff > 0 ? 'pos' : eff < 0 ? 'neg' : ''; }
    } else {
      var sg = App.txSign(t);
      var v = t.type === 'adjustment' ? t.amount : sg === -1 ? -t.amount : t.amount;
      amt = F(v, cur, { plus: sg === 1 }); cls = sg === 1 && (t.type !== 'loan_receipt') ? 'pos' : (t.type === 'expense' || t.type === 'card_purchase' || t.type === 'interest' || t.type === 'fee') ? 'neg' : '';
    }
    var tags = '';
    if (t.status === 'void') tags += ' <span class="tag">' + T('отменена', 'voided') + '</span>';
    if (t.type === 'loan_receipt') tags += ' <span class="tag">' + T('не доход', 'not income') + '</span>';
    if (t.plannedId) tags += ' <span class="tag warn">' + T('по плану', 'planned') + '</span>';
    var extra = '';
    if (t.type === 'repayment' && t.principal != null && t.principal !== t.amount) extra = T('осн. долг ', 'principal ') + F(t.principal, cur) + ' · ' + T('проценты/комиссии ', 'interest/fees ') + F(t.amount - t.principal, cur);
    return '<button class="row tap" data-a="modal" data-m="record" data-id="' + t.id + '"' + (t.status === 'void' ? ' style="opacity:.5"' : '') + '>' + icon +
      '<div class="main-t"><div class="t1">' + esc(title) + tags + '</div><div class="t2">' + esc(sub || '') + '</div>' + (extra ? '<div class="t2">' + esc(extra) + '</div>' : '') + '</div>' +
      '<div class="amt"><div class="num ' + cls + '"' + (t.status === 'void' ? ' style="text-decoration:line-through"' : '') + '>' + esc(amt) + '</div><div class="t2">' + esc(App.fd(t.date.slice(0, 10))) + '</div></div></button>';
  };
  App.txList = function (txs, accCtx, emptyText) {
    if (!txs.length) return '<div class="list"><div class="empty">' + I('log') + (emptyText || T('Записей пока нет. Нажмите «+», чтобы добавить операцию.', 'No records yet. Tap “+” to add one.')) + '</div></div>';
    var groups = {}, order = [];
    txs.forEach(function (t) { var d = t.date.slice(0, 10); if (!groups[d]) { groups[d] = []; order.push(d); } groups[d].push(t); });
    return order.map(function (d) { return '<div class="group-h"><span>' + esc(App.fd(d, true)) + '</span></div><div class="list" style="margin-top:0">' + groups[d].map(function (t) { return App.txRow(t, accCtx); }).join('') + '</div>'; }).join('');
  };
  App.sortTx = function (list) { return list.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1); }); };
  App.plannedRow = function (p, st, o) {
    o = o || {};
    var a = App.acc(p.accountId);
    var color = p.kind === 'income' ? 'var(--income)' : p.kind === 'family' ? 'var(--savings)' : p.kind === 'borrow' ? 'var(--text2)' : 'var(--planned)';
    var icon = p.kind === 'income' ? 'arrowIn' : p.kind === 'family' ? 'family' : p.kind === 'borrow' ? 'loan' : 'calendar';
    var amt = p.kind === 'income' || p.kind === 'borrow' ? (p.confirmed ? st.paid : p.amount) : st.open ? st.remaining : st.paid || p.amount;
    var sub = App.fd(p.date) + (p.dateConfirmed === false ? ' · ' + T('дата уточняется', 'date TBC') : '') + (a ? ' · ' + a.name : '') + ' · ' + T('бюдж. мес. ', 'budget ') + App.fymShort(p.budgetMonth);
    var btn = '';
    if (!o.noBtn) {
      if ((p.kind === 'payment' || p.kind === 'family') && st.open) btn = '<button class="btn sm' + (st.status === 'overdue' ? '' : ' sec') + '" data-a="modal" data-m="payPlanned" data-id="' + p.id + '">' + T('Оплатить', 'Pay') + '</button>';
      if (p.kind === 'income' && !p.confirmed && st.status !== 'skipped') btn = '<button class="btn sm sec" data-a="modal" data-m="confirmIncome" data-id="' + p.id + '">' + T('Подтвердить', 'Confirm') + '</button>';
      if (p.kind === 'borrow' && !p.confirmed) btn = '<span class="tag">' + T('сценарий', 'scenario') + '</span>';
    }
    return '<div class="row"><span class="cat-ic" style="background:' + color + '">' + I(icon) + '</span><div class="main-t tap" data-a="modal" data-m="editPlanned" data-id="' + p.id + '" style="cursor:pointer"><div class="t1">' + esc(p.title) + (p.scenario ? ' <span class="tag">' + T('сценарий', 'scenario') + '</span>' : '') + '</div><div class="t2">' + esc(sub) + '</div><div class="t2">' + App.pTag(st.status) + (st.partial ? ' <span class="tiny muted">' + T('оплачено ', 'paid ') + esc(F(st.paid)) + '</span>' : '') + '</div></div>' +
      '<div class="amt" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="num" style="color:' + color + '">' + esc(F(amt, p.currency)) + '</span>' + btn + '</div></div>';
  };
  App.accTile = function (a, bal) {
    var liab = C.isLiab(a), v = bal[a.id] || 0, sub = '';
    if (a.type === 'credit_card') { var ci = C.creditInfo(S.L, a, bal, S.today); sub = T('доступно ', 'avail. ') + F(ci.available, a.currency, { dec: 0 }); }
    else if (liab) sub = T('долг', 'debt');
    else if (a.balanceConfirmed === false) sub = T('предварительно', 'tentative');
    else sub = App.ACC_TYPES()[a.type];
    var dark = !App.isDarkColor(a.color);
    return '<button class="acc-tile' + (dark ? ' dark-text' : '') + '" style="background:' + a.color + '" data-a="go" data-s="account" data-id="' + a.id + '"><span class="shine"></span><div class="n">' + I(a.icon || 'bank', 'sm') + '<span>' + esc(a.name) + '</span></div><div><div class="v num">' + (liab && v > 0 ? '−' : '') + esc(F(Math.abs(v), a.currency)) + '</div><div class="s">' + esc(sub) + '</div></div></button>';
  };

  /* ---------- onboarding ---------- */
  App.screens.onboarding = function () {
    var L = App.lang();
    return '<div class="onb"><div class="logo">' + I('wallet') + '</div><h1>Akbar Finance 3.0</h1><p>' + T('Личные финансы: счета, кредиты, планирование, статистика. Данные хранятся только на этом устройстве.', 'Personal finance: accounts, credit, planning, statistics. Data stays on this device only.') + '</p>' +
      '<label class="btn block" style="cursor:pointer">' + I('upload') + T('Импортировать файл книги', 'Import ledger file') + '<input type="file" accept=".json,application/json" id="onbFile" data-ch="importPick" style="display:none"></label>' +
      '<button class="btn block sec" data-a="newLedger">' + I('plus') + T('Начать новую книгу', 'Start a new ledger') + '</button>' +
      '<div class="seg" style="margin-top:22px"><button class="' + (L === 'ru' ? 'on' : '') + '" data-a="setLangPre" data-l="ru">Русский</button><button class="' + (L === 'en' ? 'on' : '') + '" data-a="setLangPre" data-l="en">English</button></div>' +
      '<div class="dashed-note" style="text-align:left">' + T('Ваша личная книга (файл akbar-ledger-….json) не входит в код приложения. Импорт проверяет файл, защищает от дублей и всегда спрашивает подтверждение. Синхронизации между устройствами нет — переносите данные через экспорт/импорт JSON.', 'Your personal ledger (akbar-ledger-….json) is not part of the app code. Import validates the file, prevents duplicates and always asks for confirmation. There is no sync between devices — move data via JSON export/import.') + '</div></div>';
  };
  App.actions.setLangPre = function (el) { App.prefs.lang = el.dataset.l; App.savePrefs(); App.render(); };
  App.actions.importPick = function (el) { var f = el.files && el.files[0]; if (f) App.importFile(f); el.value = ''; };
  App.actions.newLedger = function () {
    var go = function () {
      var L = C.newLedger({ lang: App.lang(), today: S.today });
      L.accounts.push(C.makeAccount({ name: T('Наличные', 'Cash'), type: 'cash', color: '#30D158', icon: 'cash', openedAt: S.today }));
      C.log(L, 'ledger.new', 'New ledger');
      App.setLedger(L, 'new').then(function () { App.toast(T('Создана новая книга', 'New ledger created')); });
    };
    if (S.L) App.confirm(T('Новая книга', 'New ledger'), T('Текущая книга будет заменена пустой. Перед заменой сохранится автоматическая копия (Данные → Резервные копии). Продолжить?', 'The current ledger will be replaced with an empty one. An automatic snapshot is kept (Data → Backups). Continue?'), go, true);
    else go();
  };

  /* ---------- dashboard ---------- */
  App.screens.home = function () {
    var L = S.L, m = C.metrics(L, S.today), bal = m.balances;
    var own = L.accounts.filter(function (a) { return !C.isLiab(a) && !a.archived && !a.closed; });
    var liabs = L.accounts.filter(function (a) { return C.isLiab(a) && !a.archived && !a.closed; });
    var h = '';
    // accounts (own money and credit are shown separately)
    h += '<div class="sec-h" style="margin-top:0"><span class="t">' + T('Мои счета', 'My accounts') + '</span><button data-a="go" data-s="accounts">' + T('Все', 'All') + '</button></div>';
    h += '<div class="acc-grid">' + own.map(function (a) { return App.accTile(a, bal); }).join('') + '<button class="acc-tile add" data-a="modal" data-m="account">' + I('plus', 'sm') + T('Счёт', 'Account') + '</button></div>';
    if (liabs.length) h += '<div class="sec-h"><span class="t">' + T('Кредиты и долги', 'Credit & debts') + '</span><button data-a="go" data-s="debts">Debt Freedom</button></div><div class="acc-grid">' + liabs.map(function (a) { return App.accTile(a, bal); }).join('') + '</div>';
    if (m.unconvertible.length) h += '<div class="alert warn">' + I('alert') + '<div class="grow">' + T('Нет курса для: ', 'No rate for: ') + esc(m.unconvertible.join(', ')) + '. <a href="#" data-a="go" data-s="currencies">' + T('Указать курс', 'Set rate') + '</a></div></div>';
    // main balance card
    h += '<div class="grid2">';
    h += '<div class="card hero span2"><div class="lbl">' + T('Собственные средства', 'Own money') + '</div><div class="big num">' + esc(F(m.own)) + '</div><div class="kpis">' +
      kpi(T('Свободно после обязательств', 'Free after obligations'), F(m.free), m.free < 0 ? 'neg' : 'pos', T('обязательства до ', 'obligations until ') + App.fd(m.horizon) + ': ' + F(m.obligations)) +
      kpi(T('Зарезервировано', 'Reserved'), F(m.reserved + m.savings), 'sav', T('резерв ', 'reserve ') + F(m.reserved) + ' · ' + T('накопл. ', 'savings ') + F(m.savings)) +
      kpi(T('Общая задолженность', 'Total debt'), F(m.debt), 'neg', T('краткосрочная ', 'short-term ') + F(m.shortDebt)) +
      kpi(T('Чистый капитал', 'Net worth'), F(m.netWorth), m.netWorth < 0 ? 'neg' : 'pos', T('подтверждённые активы − долги', 'confirmed assets − debts')) +
      '</div><div class="tiny muted mt8">' + T('Кредитные лимиты не включены в собственные средства.', 'Credit limits are not included in own money.') + '</div></div>';
    // month card
    var dev = m.incomeDeviation, devPct = m.incomeDeviationPct;
    h += '<div class="card tap" data-a="go" data-s="income"><div class="card-h"><span class="t">' + esc(App.fym(C.ymOf(S.today))) + '</span><span class="more">' + T('План доходов', 'Income plan') + I('chev', 'sm') + '</span></div><div class="kpis">' +
      kpi(T('Доход месяца', 'Income this month'), F(m.monthIncome), 'pos', T('заработано ', 'earned ') + F(m.monthEarned)) +
      kpi(T('Расход месяца', 'Spending this month'), F(m.monthExpense), 'neg', T('проценты/комиссии ', 'interest/fees ') + F(m.monthFinance)) +
      kpi(T('Плановый доход', 'Planned income'), F(m.plannedIncome), 'plan', T('бюджетный месяц ', 'budget month ') + App.fymShort(m.budgetMonth)) +
      kpi(T('Фактический доход', 'Actual income'), F(m.actualIncome), 'pos', T('отклонение ', 'deviation ') + App.FS(dev) + (devPct != null ? ' (' + App.pct(devPct) + ')' : '')) +
      '</div></div>';
    // warnings
    var notes = C.notifications(L, S.today).filter(function (n) { return !n.dismissed && n.level !== 'ok'; });
    h += '<div class="card"><div class="card-h"><span class="t">' + T('Финансовые риски', 'Financial risks') + '</span><button class="more" data-a="go" data-s="notifications">' + T('Все', 'All') + I('chev', 'sm') + '</button></div>' +
      (notes.length ? notes.slice(0, 4).map(App.noteHtml).join('') : '<div class="alert ok">' + I('check') + '<div class="grow">' + T('Активных предупреждений нет', 'No active warnings') + '</div></div>') + '</div>';
    // upcoming payments
    var up = C.upcoming(L, S.today, 21).filter(function (x) { return x.p.kind !== 'borrow'; }).slice(0, 6);
    h += '<div class="card" style="padding-bottom:0"><div class="card-h"><span class="t">' + T('Ближайшие платежи', 'Upcoming payments') + '</span><button class="more" data-a="go" data-s="planned">' + T('Все', 'All') + I('chev', 'sm') + '</button></div><div class="list inset" style="margin:0 -16px">' +
      (up.length ? up.map(function (x) { return App.plannedRow(x.p, x.st); }).join('') : '<div class="empty">' + T('В ближайшие 3 недели платежей нет', 'Nothing due in the next 3 weeks') + '</div>') + '</div></div>';
    // balance trend
    var from = C.addDays(S.today, -30), hist = C.balanceHistory(L, from < L.meta.asOf ? L.meta.asOf : from, S.today, 1);
    var fc = C.dailyForecast(L, S.today, 45, { scenarios: S.ui.scen.reborrow ? ['reborrow'] : [] });
    h += '<div class="card tap" data-a="go" data-s="stat" data-k="balance"><div class="card-h"><span class="t">' + T('Тренд баланса', 'Balance trend') + '</span><span class="more">' + I('chev', 'sm') + '</span></div>' +
      CH.line({ id: 'homeTrend', height: 150, series: [
        { name: T('Факт: собственные свободные', 'Actual: own liquid'), color: 'var(--accent)', fill: true, points: hist.map(function (p) { var liq = 0; L.accounts.forEach(function (a) { if (!C.isLiab(a) && a.role !== 'reserve' && a.role !== 'savings' && a.type !== 'investment') liq += C.toBase(L, p.per[a.id], a.currency) || 0; }); return { x: p.date, y: liq }; }) },
        { name: T('Прогноз по плану', 'Plan forecast'), color: 'var(--planned)', dashed: true, points: fc.points.map(function (p) { return { x: p.date, y: p.value }; }) }],
        fmtTip: function (v) { return F(v); }, fmtX: function (d) { return App.fd(d, false); }, zero: true,
        markers: fc.firstDeficit ? [{ x: fc.firstDeficit, color: 'var(--expense)', label: T('разрыв', 'gap') }] : [] }) + '</div>';
    // recent records
    var recent = App.sortTx(L.transactions).slice(0, 5);
    h += '<div class="card" style="padding-bottom:0"><div class="card-h"><span class="t">' + T('Последние записи', 'Last records') + '</span></div><div class="list inset" style="margin:0 -16px">' + (recent.length ? recent.map(function (t) { return App.txRow(t); }).join('') : '<div class="empty">' + T('Фактических операций пока нет. Плановые платежи и доходы не показываются здесь, пока вы их не подтвердите.', 'No actual records yet. Planned items appear here only after you confirm them.') + '</div>') + '</div><div class="card-f"><button data-a="go" data-s="records">' + T('Показать все', 'Show more') + '</button></div></div>';
    // savings & goals
    var goals = (L.goals || []).slice(0, 5).map(function (g) { return C.goalStatus(L, g, S.today); });
    h += '<div class="card tap" data-a="go" data-s="goals"><div class="card-h"><span class="t">' + T('Накопления и цели', 'Savings & goals') + '</span><span class="more">' + I('chev', 'sm') + '</span></div>' +
      '<div class="kpis" style="margin-bottom:10px">' + kpi(T('Резерв', 'Reserve'), F(m.reserved), 'plan') + kpi(T('Накопления', 'Savings'), F(m.savings), 'sav') + '</div>' +
      goals.map(function (gs) { return '<div class="mt8"><div class="split small"><span class="ellipsis">' + esc(gs.goal.title) + '</span><span class="num muted">' + App.pct(gs.pct, 0) + '</span></div><div class="bar thin mt8"><i style="width:' + gs.pct * 100 + '%;background:' + (gs.goal.color || 'var(--savings)') + '"></i></div></div>'; }).join('') + '</div>';
    // family
    var fs = C.familyStatus(L, S.today);
    h += '<div class="card tap" data-a="go" data-s="family"><div class="card-h"><span class="t">' + T('Переводы родителям', 'Transfers to parents') + '</span><span class="more">' + I('chev', 'sm') + '</span></div><div class="kpis">' +
      kpi(T('Отправлено', 'Sent'), F(fs.sentTotal), 'sav') + kpi(T('Осталось по плану', 'Plan remaining'), F(fs.remaining), 'plan', T('план ', 'plan ') + F(fs.planTotal)) + '</div>' +
      '<div class="bar mt12"><i style="width:' + (fs.planTotal ? fs.sentPlanned / fs.planTotal * 100 : 0) + '%;background:var(--savings)"></i></div></div>';
    // spending donut
    var bs = C.budgetStatus(L, C.ymOf(S.today), S.today);
    var items = Object.keys(bs.spent).map(function (k) { var c = App.cat(k); return { label: App.catName(c), v: bs.spent[k], color: c ? c.color : '#888' }; });
    h += '<div class="card tap" data-a="go" data-s="stat" data-k="spending"><div class="card-h"><span class="t">' + T('Расходы месяца', 'Spending this month') + '</span><span class="more">' + I('chev', 'sm') + '</span></div>' +
      (items.length ? CH.donut({ id: 'homeDonut', items: items, center: F(bs.total.spent), centerLabel: T('всего', 'total'), fmtTip: function (v) { return F(v); } }) : '<div class="empty">' + T('Расходов в этом месяце нет', 'No spending this month') + '</div>') +
      '<div class="mt12 small"><div class="split"><span class="muted">' + T('Личный бюджет', 'Personal budget') + '</span><span class="num">' + esc(F(bs.total.spent)) + ' / ' + esc(F(bs.total.limit)) + '</span></div><div class="bar thin mt8"><i style="width:' + Math.min(100, bs.total.pct * 100) + '%;background:' + (bs.total.exceeded ? 'var(--expense)' : 'var(--income)') + '"></i></div></div></div>';
    h += '</div>';
    return { title: T('Главная', 'Dashboard'), html: h };
  };
  function kpi(k, v, cls, s) { return '<div class="kpi"><div class="k">' + esc(k) + '</div><div class="v num ' + (cls || '') + '">' + esc(v) + '</div>' + (s ? '<div class="s">' + esc(s) + '</div>' : '') + '</div>'; }
  App.kpi = kpi;

  /* ---------- notifications ---------- */
  App.noteText = function (n) {
    var p = n.ref && C.byId(S.L.planned, n.ref);
    switch (n.type) {
      case 'dueSoon': return [T('Скоро платёж: ', 'Payment due soon: ') + n.title + ' — ' + F(n.amount) + ', ' + App.fd(n.date), 'payPlanned', T('Оплатить', 'Pay')];
      case 'overdue': return [T('Просрочен платёж: ', 'Overdue: ') + n.title + ' — ' + F(n.amount) + T(' (срок ', ' (due ') + App.fd(n.date) + ')', 'payPlanned', T('Оплатить', 'Pay')];
      case 'confirmIncome': return [T('Подтвердите фактическое поступление (зарплата, чаевые, прочее) от ', 'Confirm actual income (salary, tips, other) from ') + App.fd(n.date) + ': ' + T('план ', 'plan ') + F(n.amount), 'confirmIncome', T('Подтвердить', 'Confirm')];
      case 'budget': return [T('Превышен бюджет «', 'Budget exceeded “') + App.catName(n.ref) + T('» на ', '” by ') + F(n.amount), null];
      case 'budgetTotal': return [T('Превышен личный бюджет месяца на ', 'Monthly personal budget exceeded by ') + F(n.amount), null];
      case 'lowFunds': return [T('Недостаточно собственных средств для платежей ближайших 14 дней: не хватает ', 'Not enough own money for the next 14 days of payments: short by ') + F(n.amount), null];
      case 'cashGap': return [T('Прогноз кассового разрыва с ', 'Projected cash gap from ') + App.fd(n.date) + T('. Минимум ', '. Low point ') + F(n.amount) + T('. Смотрите альтернативы без нового займа.', '. See alternatives without new borrowing.'), 'monthplan', T('План', 'Plan')];
      case 'goalDone': return [T('Цель выполнена: ', 'Goal reached: ') + n.title, null];
      case 'overLimit': return [n.title + T(': превышение кредитного лимита ', ': over credit limit by ') + F(n.amount), null];
      case 'monthEnd': return [T('Конец месяца — проведите финансовую сверку', 'Month end — run the monthly review'), 'review', T('Сверка', 'Review')];
    }
    return [n.type, null];
  };
  App.noteHtml = function (n) {
    var t = App.noteText(n), icon = n.level === 'danger' ? 'alert' : n.level === 'ok' ? 'check' : 'info';
    var act = '';
    if (t[1] === 'payPlanned' || t[1] === 'confirmIncome') act = '<button class="act" data-a="modal" data-m="' + t[1] + '" data-id="' + n.ref + '">' + t[2] + '</button>';
    else if (t[1] === 'monthplan') act = '<button class="act" data-a="go" data-s="monthplan">' + t[2] + '</button>';
    else if (t[1] === 'review') act = '<button class="act" data-a="modal" data-m="review" data-ym="' + n.ref + '">' + t[2] + '</button>';
    return '<div class="alert ' + n.level + '">' + I(icon) + '<div class="grow">' + esc(t[0]) + '</div>' + act + '</div>';
  };
  App.screens.notifications = function () {
    var ns = C.notifications(S.L, S.today), act = ns.filter(function (n) { return !n.dismissed; }), dis = ns.filter(function (n) { return n.dismissed; });
    var h = '<div class="dashed-note">' + T('Push-уведомления в веб-приложении без сервера недоступны, поэтому напоминания показываются внутри приложения: значок на колокольчике и этот список. Они пересчитываются при каждом открытии.', 'Push notifications are not available for a server-less web app, so reminders are shown in-app: the bell badge and this list. They are recalculated on every launch.') + '</div>';
    h += act.length ? act.map(function (n) { return '<div style="position:relative">' + App.noteHtml(n) + '<button class="tiny muted" style="position:absolute;right:10px;bottom:4px" data-a="dismiss" data-id="' + esc(n.id) + '">' + T('скрыть', 'dismiss') + '</button></div>'; }).join('') : '<div class="card empty">' + T('Новых уведомлений нет', 'No new notifications') + '</div>';
    h += '<div class="btns"><button class="btn sec" data-a="modal" data-m="review" data-ym="' + C.ymOf(S.today) + '">' + I('check') + T('Сверка месяца', 'Month review') + '</button></div>';
    if (dis.length) h += '<div class="sec-h"><span class="t small">' + T('Скрытые', 'Dismissed') + '</span><button data-a="undismissAll">' + T('Вернуть', 'Restore') + '</button></div>' + dis.map(function (n) { return '<div style="opacity:.55">' + App.noteHtml(n) + '</div>'; }).join('');
    return { title: T('Уведомления', 'Notifications'), html: h };
  };
  App.actions.dismiss = function (el) { App.commit(T('Уведомление скрыто', 'Notification dismissed'), function (L) { L.dismissed[el.dataset.id] = new Date().toISOString(); }, { silent: true, nolog: true }); };
  App.actions.undismissAll = function () { App.commit(T('Уведомления возвращены', 'Notifications restored'), function (L) { L.dismissed = {}; }, { nolog: true }); };

  /* ---------- accounts ---------- */
  App.screens.accounts = function () {
    var L = S.L, bal = C.balances(L), types = C.ACCOUNT_TYPES, h = '';
    var show = function (list) { return '<div class="list">' + list.map(function (a) {
      var v = bal[a.id] || 0, liab = C.isLiab(a);
      return '<button class="row tap" data-a="go" data-s="account" data-id="' + a.id + '">' + App.accIcon(a) + '<div class="main-t"><div class="t1">' + esc(a.name) + (a.archived ? ' <span class="tag">' + T('архив', 'archived') + '</span>' : '') + (a.closed ? ' <span class="tag">' + T('закрыт', 'closed') + '</span>' : '') + '</div><div class="t2">' + esc(App.ACC_TYPES()[a.type]) + ' · ' + a.currency + (liab ? ' · ' + App.CSTAT()[C.creditStatus(L, a, v, S.today)] : '') + '</div></div><div class="amt num ' + (liab && v > 0 ? 'neg' : '') + '">' + (liab && v > 0 ? '−' : '') + esc(F(Math.abs(v), a.currency)) + '</div></button>';
    }).join('') + '</div>'; };
    types.forEach(function (t) { var list = L.accounts.filter(function (a) { return a.type === t; }); if (list.length) h += '<div class="group-h"><span>' + esc(App.ACC_TYPES()[t]) + '</span></div>' + show(list); });
    if (!L.accounts.length) h += '<div class="card empty">' + T('Счетов нет', 'No accounts') + '</div>';
    h += '<div class="btns"><button class="btn" data-a="modal" data-m="account">' + I('plus') + T('Новый счёт', 'New account') + '</button></div>';
    return { title: T('Счета', 'Accounts'), html: h };
  };
  App.screens.account = function (p) {
    var L = S.L, a = App.acc(p.id); if (!a) return { title: '—', html: '<div class="empty">' + T('Счёт не найден', 'Account not found') + '</div>' };
    var bal = C.balances(L), v = bal[a.id] || 0, liab = C.isLiab(a), h = '';
    var txs = App.sortTx(L.transactions.filter(function (t) { return t.fromAccountId === a.id || t.toAccountId === a.id; }));
    var live = txs.filter(function (t) { return t.status !== 'void'; });
    var inSum = 0, outSum = 0;
    live.forEach(function (t) { C.txEffects(L, t).forEach(function (e) { if (e.acc !== a.id) return; var d = liab ? -e.delta : e.delta; if (d > 0) inSum += d; else outSum -= d; }); });
    var dark = !App.isDarkColor(a.color);
    h += '<div class="card" style="background:' + a.color + ';color:' + (dark ? '#000' : '#fff') + '"><div class="split"><div class="small" style="opacity:.85">' + esc(App.ACC_TYPES()[a.type]) + (a.institution ? ' · ' + esc(a.institution) : '') + '</div>' + (liab ? App.cTag(C.creditStatus(L, a, v, S.today)) : '') + '</div>' +
      '<div class="small" style="opacity:.85;margin-top:12px">' + (liab ? T('Текущая задолженность', 'Current debt') : T('Баланс', 'Balance')) + '</div><div class="num" style="font-size:36px;font-weight:700">' + esc(F(v, a.currency)) + '</div>' +
      (a.currency !== 'AED' && C.toBase(L, v, a.currency) != null ? '<div class="small" style="opacity:.85">≈ ' + esc(F(C.toBase(L, v, a.currency))) + '</div>' : '') +
      (a.balanceConfirmed === false ? '<div class="small" style="margin-top:6px">' + T('Остаток предварительный — подтвердите сверкой.', 'Tentative balance — confirm via reconciliation.') + '</div>' : '') + '</div>';
    if (a.type === 'credit_card') {
      var ci = C.creditInfo(L, a, bal, S.today), cr = a.credit;
      h += '<div class="card"><div class="card-h"><span class="t">' + T('Кредитная линия', 'Credit line') + '</span><span class="small muted">' + App.pct(ci.utilization, 2) + T(' использовано', ' used') + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.min(100, (ci.utilization || 0) * 100) + '%;background:' + (ci.overLimit ? 'var(--expense)' : ci.utilization > .7 ? 'var(--planned)' : 'var(--accent)') + '"></i></div>' +
        '<div class="mt12">' + kv(T('Общий лимит', 'Credit limit'), F(cr.limit, a.currency)) + kv(T('Использовано', 'Used'), F(ci.used, a.currency)) + kv(T('Доступно', 'Available'), F(ci.available, a.currency)) +
        (ci.overLimit ? kv(T('Превышение лимита', 'Over limit'), '<span class="neg">' + esc(F(ci.overLimit, a.currency)) + '</span>', true) : '') +
        kv(T('Использование / доступно', 'Utilization / available'), App.pct(ci.utilization, 2) + ' / ' + App.pct(cr.limit ? ci.available / cr.limit : null, 2)) +
        kv(T('Сумма выписки', 'Statement balance'), cr.statementBalance != null ? F(cr.statementBalance, a.currency) + ' <span class="tiny muted">' + T('(часть долга)', '(part of debt)') + '</span>' : '—', true) +
        kv(T('Минимальный платёж', 'Minimum payment'), cr.minPayment != null ? F(cr.minPayment, a.currency) : '—') +
        kv(T('Дата платежа', 'Due date'), (cr.dueDate ? App.fd(cr.dueDate, true) : '—') + App.unconf(cr.dueDateConfirmed), true) +
        kv(T('Долг после мин. платежа', 'Debt after min. payment'), ci.afterMin != null ? F(ci.afterMin, a.currency) + ' <span class="tiny muted">' + T('без новых начислений', 'w/o new charges') + '</span>' : '—', true) +
        kv(T('Дата выписки', 'Statement date'), cr.statementDate ? App.fd(cr.statementDate, true) : '<span class="unconf">' + T('не указана', 'not set') + '</span>', true) +
        kv(T('Расчётный период', 'Billing cycle'), cr.billingCycle || '<span class="unconf">' + T('не указан', 'not set') + '</span>', true) +
        kv(T('Процентная ставка', 'Interest rate'), cr.apr != null ? cr.apr + '% ' + T('годовых', 'APR') + App.unconf(cr.aprConfirmed) : '<span class="unconf">' + T('требует подтверждения', 'needs confirmation') + '</span>', true) +
        kv(T('Комиссии', 'Fees'), (cr.fees ? esc(cr.fees) : '—') + App.unconf(cr.feesConfirmed), true) + '</div></div>';
    }
    if (a.type === 'loan') {
      var ln = a.loan, eps = C.earlyPayoffImpact(L, a.id, 0);
      h += '<div class="card"><div class="card-h"><span class="t">' + T('Кредит', 'Loan') + '</span></div>' +
        kv(T('Остаток основного долга', 'Principal outstanding'), F(v, a.currency)) +
        kv(T('Ежемесячный платёж', 'Monthly payment'), ln.monthlyPayment ? F(ln.monthlyPayment, a.currency) : '—') +
        kv(T('Плановое завершение', 'Planned end'), ln.endDate ? App.fym(ln.endDate) : (ln.dueDate ? App.fd(ln.dueDate, true) : '—')) +
        kv(T('День списания', 'Payment day'), (ln.paymentDay || '—') + App.unconf(ln.paymentDayConfirmed, T('требует подтверждения', 'needs confirmation')), true) +
        kv(T('Ставка', 'Rate'), ln.apr != null ? ln.apr + '%' + App.unconf(ln.aprConfirmed) : ln.aprEstimated != null ? '≈ ' + (ln.aprEstimated * 1200).toFixed(2).replace('.', ',') + '% <span class="unconf">' + T('расчётно из декабрьского платежа', 'estimated from December payment') + '</span>' : '<span class="unconf">' + T('неизвестна', 'unknown') + '</span>', true) +
        kv(T('Комиссии', 'Fees'), (ln.fees ? esc(ln.fees) : '—') + App.unconf(ln.feesConfirmed), true) +
        (eps && !eps.unknownRate ? kv(T('Осталось платежей (расчёт)', 'Payments left (est.)'), eps.baseMonths + ' · ' + T('проценты ≈ ', 'interest ≈ ') + F(eps.baseInterest, a.currency)) : '') + '</div>';
    }
    if (a.note) h += '<div class="dashed-note">' + esc(a.note) + '</div>';
    h += '<div class="kpis mt12">' + kpi(liab ? T('Погашено / уменьшение', 'Repaid / decrease') : T('Поступления', 'Inflows'), F(inSum, a.currency), 'pos') + kpi(liab ? T('Покупки / рост долга', 'Purchases / increase') : T('Списания', 'Outflows'), F(outSum, a.currency), 'neg') + '</div>';
    // balance chart: actual (solid) + planned (dashed) for liabilities with schedules
    var from = a.openedAt || L.meta.asOf, to = S.today, step = Math.max(1, Math.ceil(C.diffDays(from, to) / 60));
    var hist = from <= to ? C.balanceHistory(L, from, to, step).map(function (p) { return { x: p.date, y: p.per[a.id] }; }) : [];
    if (hist.length && hist[hist.length - 1].x !== to) hist.push({ x: to, y: v });
    var plan = [];
    if (liab) {
      var cur = v; plan.push({ x: S.today, y: cur });
      L.planned.filter(function (q) { return q.accountId === a.id && q.kind === 'payment' && !q.scenario && q.date >= S.today; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; }).forEach(function (q) {
        var st = C.plannedState(L, q, S.today); if (!st.open) return;
        cur -= q.interestPart ? st.remaining - Math.round(st.remaining * q.interestPart / q.amount) : st.remaining; plan.push({ x: q.date, y: Math.max(0, cur) });
      });
    }
    h += '<div class="card"><div class="card-h"><span class="t">' + (liab ? T('Изменение задолженности', 'Debt over time') : T('Изменение баланса', 'Balance over time')) + '</span></div>' +
      CH.line({ id: 'accChart', series: [{ name: T('Факт', 'Actual'), color: a.color, fill: true, points: hist }].concat(plan.length > 1 ? [{ name: T('План погашения', 'Repayment plan'), color: 'var(--planned)', dashed: true, points: plan }] : []), fmtTip: function (x) { return F(x, a.currency); }, fmtX: function (d) { return App.fd(d); } }) + '</div>';
    // actions
    h += '<div class="btns">';
    if (a.type === 'credit_card') h += '<button class="btn sec" data-a="modal" data-m="record" data-type="card_purchase" data-from="' + a.id + '">' + I('cart') + T('Покупка', 'Purchase') + '</button>';
    if (liab) h += '<button class="btn sec" data-a="modal" data-m="record" data-type="repayment" data-to="' + a.id + '">' + I('check') + T('Погасить', 'Repay') + '</button><button class="btn sec" data-a="modal" data-m="record" data-type="loan_receipt" data-from="' + a.id + '">' + I('loan') + T('Заём / снятие', 'Borrow / cash') + '</button><button class="btn sec" data-a="modal" data-m="record" data-type="interest" data-from="' + a.id + '">' + I('percent') + T('Проценты', 'Interest') + '</button>';
    else h += '<button class="btn sec" data-a="modal" data-m="record" data-type="expense" data-from="' + a.id + '">' + I('arrowOut') + T('Расход', 'Expense') + '</button><button class="btn sec" data-a="modal" data-m="record" data-type="income" data-to="' + a.id + '">' + I('arrowIn') + T('Доход', 'Income') + '</button>';
    h += '</div><div class="btns"><button class="btn sec" data-a="modal" data-m="reconcile" data-id="' + a.id + '">' + I('check') + T('Сверка с выпиской', 'Reconcile') + '</button><button class="btn sec" data-a="modal" data-m="account" data-id="' + a.id + '">' + I('settings') + T('Настройки', 'Settings') + '</button></div>';
    if (a.reconciledAt) h += '<div class="tiny muted mt8 center">' + T('Последняя сверка: ', 'Last reconciled: ') + esc(App.fd(a.reconciledAt.slice(0, 10), true)) + ' · ' + esc(F(a.reconciledBalance, a.currency)) + '</div>';
    if (liab) {
      var ds = C.debtSummary(L, S.today).rows.filter(function (r) { return r.acc.id === a.id; })[0];
      h += '<div class="sec-h"><span class="t">' + T('Плановые платежи', 'Planned payments') + '</span></div><div class="list">' + (L.planned.filter(function (q) { return q.accountId === a.id; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; }).slice(0, 30).map(function (q) { return App.plannedRow(q, C.plannedState(L, q, S.today)); }).join('') || '<div class="empty">—</div>') + '</div>';
      h += '<div class="kpis mt12">' + kpi(T('Покупки / заимствования', 'Purchases / borrowing'), String(ds.purchases.length)) + kpi(T('Погашений', 'Repayments'), String(ds.repayments.length)) + kpi(T('Повторных займов', 'Re-borrowings'), String(ds.reborrows.length)) + kpi(T('Проценты и комиссии', 'Interest & fees'), F(ds.interestPaid, a.currency), 'neg') + '</div>';
    }
    h += '<div class="sec-h"><span class="t">' + T('История операций', 'Records') + '</span></div>' + App.txList(txs, a);
    return { title: a.name, html: h };
  };
  function kv(k, v, raw) { return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + (raw ? v : esc(v)) + '</span></div>'; }
  App.kv = kv;

  /* ---------- records ---------- */
  App.screens.records = function () {
    var L = S.L, q = S.ui.recQ.toLowerCase(), h = '';
    var list = L.transactions.filter(function (t) {
      if (S.ui.recType && t.type !== S.ui.recType) return false;
      if (S.ui.recAcc && t.fromAccountId !== S.ui.recAcc && t.toAccountId !== S.ui.recAcc) return false;
      if (S.ui.recStatus === 'void' && t.status !== 'void') return false;
      if (S.ui.recStatus === 'cleared' && t.status === 'void') return false;
      if (q) { var hay = [t.note, (t.tags || []).join(' '), App.catName(t.categoryId), App.TX_TYPES()[t.type], (App.acc(t.fromAccountId) || {}).name, (App.acc(t.toAccountId) || {}).name, (t.amount / 100).toFixed(2)].join(' ').toLowerCase(); if (hay.indexOf(q) < 0) return false; }
      return true;
    });
    h += '<div class="search">' + I('search', 'sm') + '<input id="recSearch" placeholder="' + T('Поиск: сумма, заметка, категория, тег', 'Search: amount, note, category, tag') + '" value="' + esc(S.ui.recQ) + '" data-live="recSearch"></div>';
    h += '<div class="list form mt8" style="background:transparent"><div class="group">' +
      App.fld(T('Тип', 'Type'), '<select class="in" data-ch="recFilter" data-k="recType">' + App.opts([['', T('Все', 'All')]].concat(Object.keys(App.TX_TYPES()).map(function (k) { return [k, App.TX_TYPES()[k]]; })), S.ui.recType) + '</select>') +
      App.fld(T('Счёт', 'Account'), '<select class="in" data-ch="recFilter" data-k="recAcc">' + App.opts([['', T('Все', 'All')]].concat(L.accounts.map(function (a) { return [a.id, a.name]; })), S.ui.recAcc) + '</select>') +
      App.fld(T('Статус', 'Status'), '<select class="in" data-ch="recFilter" data-k="recStatus">' + App.opts([['', T('Все', 'All')], ['cleared', T('Действующие', 'Active')], ['void', T('Отменённые', 'Voided')]], S.ui.recStatus) + '</select>') + '</div></div>';
    h += '<div class="tiny muted mt8">' + list.length + T(' записей', ' records') + '</div><div id="recList">' + App.txList(App.sortTx(list)) + '</div>';
    return { title: T('Записи', 'Records'), html: h, right: '<button class="iconbtn" data-a="modal" data-m="record">' + I('plus') + '</button>' };
  };
  App.live.recSearch = function (el) { S.ui.recQ = el.value; clearTimeout(App._rs); App._rs = setTimeout(function () { var pos = el.selectionStart; App.render(); var n = document.getElementById('recSearch'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }, 250); };
  App.actions.recFilter = function (el) { S.ui[el.dataset.k] = el.value; App.render(); };
})();
