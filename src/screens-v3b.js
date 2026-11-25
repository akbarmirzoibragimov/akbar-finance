/* Akbar Finance 3.1 — credits/cards create & close, budget sweep, goal templates, income year plan, rates, expense summaries */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, CH = App.CH, S = App.S, T = App.T, F = App.F, esc = App.esc;

  /* ---------- new credit / card (pick type → account modal) ---------- */
  App.modals.newCredit = function (m) {
    var h = '<div class="list">' + [['credit_card', 'card', T('Кредитная карта', 'Credit card'), T('Лимит, выписка, минимальный платёж, срок', 'Limit, statement, minimum payment, due date')], ['loan', 'loan', T('Кредит / заём / рассрочка', 'Loan / instalments'), T('Сумма долга, ежемесячный платёж, срок', 'Balance, monthly payment, end date')]].map(function (x) {
      return '<button class="row tap" data-a="newCreditPick" data-t="' + x[0] + '"><span class="cat-ic" style="background:var(--expense)">' + I(x[1]) + '</span><div class="main-t"><div class="t1">' + x[2] + '</div><div class="t2">' + x[3] + '</div></div>' + I('chev', 'sm') + '</button>';
    }).join('') + '</div><div class="dashed-note">' + T('Новый кредит добавляет долг в общий баланс. Если деньги по нему пришли на твой счёт — запиши отдельно «Получение кредита», это не доход.', 'A new loan adds debt to the total balance. If its money reached your account, also record “Loan received” — it is not income.') + '</div>';
    return { title: T('Новый кредит или карта', 'New loan or card'), html: h };
  };
  App.actions.newCreditPick = function (el) { var sp = S.modal.space; App.openModal('account', { type: el.dataset.t, space: sp }); };

  /* account modal: add space selector (personal/business) */
  var accModal = App.modals.account;
  App.modals.account = function (m) {
    var a = m.id ? App.acc(m.id) : null;
    if (!m.inited) m.f.space = a ? (a.space || 'personal') : (m.space || App.space());
    var out = accModal(m);
    var spSel = '<div class="form"><div class="group">' + App.fld(T('Пространство', 'Space'), '<select class="in" data-ch="accSpace">' + App.opts([['personal', T('Личное', 'Personal')], ['business', T('Бизнес', 'Business')]], m.f.space) + '</select>') + '</div></div>';
    out.html = out.html.replace('<div class="form">', spSel + '<div class="form">');
    return out;
  };
  App.actions.accSpace = function (el) { S.modal.f.space = el.value; };
  var saveAcc = App.actions.saveAccount;
  App.actions.saveAccount = function () {
    var m = S.modal, sp = m.f.space || 'personal', id = m.id, before = S.L.accounts.map(function (a) { return a.id; });
    saveAcc();
    var a = id ? App.acc(id) : S.L.accounts.filter(function (x) { return before.indexOf(x.id) < 0; })[0];
    if (a && (a.space || 'personal') !== sp) { a.space = sp; App.save(); App.render(); }
  };

  /* ---------- close / liquidate with confirmation (history is kept) ---------- */
  App.actions.accClose = function () {
    var id = S.modal.id, a = App.acc(id), bal = C.balances(S.L)[id] || 0, liab = C.isLiab(a);
    if (a.closed) { App.confirm(T('Открыть снова?', 'Reopen?'), T('Счёт «', 'Account “') + a.name + T('» снова появится в списках и расчётах.', '” will return to lists and totals.'), function () { App.commit(T('Счёт открыт снова', 'Account reopened'), function (L) { var x = C.byId(L.accounts, id); x.closed = false; x.closedAt = null; }); }); return; }
    App.openModal('closeAcc', { id: id, bal: bal, liab: liab });
  };
  App.modals.closeAcc = function (m) {
    var a = App.acc(m.id), bal = C.balances(S.L)[m.id] || 0, liab = C.isLiab(a), h = '<div class="card">';
    var open = S.L.planned.filter(function (p) { return (p.accountId === m.id || p.fromAccountId === m.id || p.toAccountId === m.id) && C.plannedState(S.L, p, S.today).open; });
    if (liab && bal > 0) {
      h += '<div class="alert danger">' + I('alert') + '<div class="grow">' + T('По «', '“') + esc(a.name) + T('» остаётся долг ', '” still has debt of ') + '<b class="num">' + esc(F(bal, a.currency)) + '</b>. ' + T('Банк не закроет кредит с долгом. Сначала запиши погашение, затем закрой.', 'A lender will not close a line with debt. Record the repayment first, then close.') + '</div></div>' +
        '<div class="btns"><button class="btn" data-a="modal" data-m="record" data-type="repayment" data-to="' + m.id + '">' + I('check') + T('Записать погашение', 'Record repayment') + '</button></div>';
    } else if (!liab && bal !== 0) {
      h += '<div class="alert warn">' + I('alert') + '<div class="grow">' + T('На счёте ещё ', 'The account still holds ') + '<b class="num">' + esc(F(bal, a.currency)) + '</b>. ' + T('Переведи остаток на другой счёт, чтобы деньги не «пропали» из баланса.', 'Move the remainder to another account so the money stays in your balance.') + '</div></div>' +
        '<div class="btns"><button class="btn" data-a="modal" data-m="record" data-type="transfer" data-from="' + m.id + '">' + I('swap') + T('Перевести остаток', 'Transfer remainder') + '</button></div>';
    } else {
      h += '<div>' + (liab ? T('Долг по «', 'Debt on “') + esc(a.name) + T('» равен нулю. Закрыть кредитную линию?', '” is zero. Close the credit line?') : T('Закрыть счёт «', 'Close account “') + esc(a.name) + '»?') + '</div>' +
        '<ul class="small muted"><li>' + T('Вся история операций сохранится и останется в отчётах.', 'All history stays and remains in reports.') + '</li><li>' + T('Счёт исчезнет из списков выбора и с главной.', 'It disappears from pickers and the dashboard.') + '</li><li>' + T('Его можно открыть снова в настройках счёта.', 'You can reopen it in account settings.') + '</li>' + (open.length ? '<li>' + T('Будущих плановых платежей: ', 'Open planned items: ') + open.length + T(' — они будут помечены как пропущенные.', ' — they will be marked skipped.') + '</li>' : '') + '</ul>' +
        '<div class="btns"><button class="btn sec" data-a="closeModal">' + T('Отмена', 'Cancel') + '</button><button class="btn danger" data-a="accCloseOk" data-id="' + m.id + '">' + (liab ? T('Закрыть кредит', 'Close credit') : T('Закрыть счёт', 'Close account')) + '</button></div>';
    }
    return { title: liab ? T('Закрыть / ликвидировать кредит', 'Close / liquidate credit') : T('Закрыть счёт', 'Close account'), html: h + '</div>' };
  };
  App.actions.accCloseOk = function (el) {
    var id = el.dataset.id; App.closeModal();
    App.commit(T('Счёт закрыт, история сохранена', 'Account closed, history kept'), function (L) {
      var a = C.byId(L.accounts, id); if (C.isLiab(a) && (C.balances(L)[id] || 0) > 0) return { ok: false };
      a.closed = true; a.closedAt = new Date().toISOString();
      L.planned.forEach(function (p) { if ((p.accountId === id || p.fromAccountId === id || p.toAccountId === id) && C.plannedState(L, p, S.today).open) p.status = 'skipped'; });
    });
  };

  /* ---------- personal budget remainder → savings (explicit confirmation) ---------- */
  App.modals.sweep = function (m) {
    var f = m.f, ym = m.ym, br = C.budgetRemainder(S.L, ym, S.today);
    if (!m.inited) { m.inited = true; var sav = S.L.accounts.filter(function (a) { return !a.closed && !a.archived && a.role === 'savings' && (a.space || 'personal') === 'personal'; })[0]; f.to = sav ? sav.id : ''; f.from = (S.L.accounts.filter(function (a) { return !a.closed && !C.isLiab(a) && !a.role && (a.space || 'personal') === 'personal'; })[0] || {}).id || ''; f.amount = App.amtStr(br.remainder); }
    var h = '<div class="card"><div class="split"><span>' + T('Бюджет ', 'Budget ') + esc(App.fym(ym)) + '</span><span class="num">' + esc(F(br.spent)) + ' / ' + esc(F(br.limit)) + '</span></div><div class="split mt8 b"><span>' + T('Остаток', 'Remainder') + '</span><span class="num pos">' + esc(F(br.remainder)) + '</span></div></div>' +
      '<div class="form"><div class="group">' + App.fld(T('Откуда', 'From'), '<select class="in" data-ch="fset" data-k="from">' + App.accOpts(function (a) { return !C.isLiab(a) && (a.space || 'personal') === 'personal'; }, f.from) + '</select>') +
      App.fld(T('Куда (накопления)', 'To (savings)'), '<select class="in" data-ch="fset" data-k="to">' + App.accOpts(function (a) { return !C.isLiab(a) && (a.space || 'personal') === 'personal'; }, f.to, '—') + '</select>') +
      App.fld(T('Сумма', 'Amount'), '<input class="in num" inputmode="decimal" data-ch="fset" data-k="amount" value="' + esc(f.amount) + '">') + '</div></div>' +
      '<div class="dashed-note">' + T('Создастся запись «Пополнение накоплений» — перевод между твоими счетами (не расход). Сделай такой же перевод в банке, если накопления на отдельном счёте. Повторно за этот месяц перевод не создаётся.', 'Creates a “Savings top-up” record — a transfer between your accounts (not spending). Make the same transfer in your bank if savings sit in a separate account. Only one per month.') + '</div>' + (m.err ? '<div class="alert danger">' + esc(m.err) + '</div>' : '');
    return { title: T('Остаток → накопления', 'Remainder → savings'), html: h, done: 'sweepOk', doneLabel: T('Перевести', 'Transfer') };
  };
  App.actions.fset = function (el) { S.modal.f[el.dataset.k] = el.value; };
  App.actions.sweepOk = function () {
    var m = S.modal, f = m.f, amt = App.toMinor(f.amount);
    if (!f.from || !f.to || f.from === f.to) { m.err = T('Выбери два разных счёта', 'Pick two different accounts'); App.renderModal(); return; }
    if (!(amt > 0)) { m.err = T('Неверная сумма', 'Invalid amount'); App.renderModal(); return; }
    var r = App.commit(T('Остаток бюджета переведён в накопления', 'Budget remainder moved to savings'), function (L) { return C.sweepBudget(L, m.ym, f.from, f.to, S.today, amt); });
    if (r && r.ok === false) { m.err = (r.errors || []).join(', '); App.renderModal(); return; }
    App.closeModal();
  };

  /* ---------- goal templates & stages ---------- */
  App.modals.goalTpl = function () {
    var h = '<div class="tpl-grid">' + C.GOAL_TEMPLATES.map(function (t) { return '<button class="tpl" data-a="goalTplPick" data-id="' + t.id + '"><span class="cat-ic" style="background:' + t.color + '">' + I(t.icon) + '</span><b>' + esc(T(t.ru, t.en)) + '</b><span class="tiny muted">' + esc(T(t.hint.ru, t.hint.en)) + '</span></button>'; }).join('') +
      '<button class="tpl" data-a="goalTplPick" data-id=""><span class="cat-ic" style="background:#8E8E93">' + I('target') + '</span><b>' + T('Своя цель', 'Custom goal') + '</b><span class="tiny muted">' + T('С нуля', 'From scratch') + '</span></button></div>';
    h += '<div class="dashed-note">' + T('Суммы в шаблонах — стартовые ориентиры, поменяй под себя. Этапы цели: Старт → Первые шаги → Набираю обороты → Больше половины → Финишная прямая → Цель достигнута.', 'Template amounts are starting points — adjust. Stages: Start → First steps → Building momentum → Past halfway → Final stretch → Achieved.') + '</div>';
    return { title: T('Шаблон цели', 'Goal template'), html: h };
  };
  App.actions.goalTplPick = function (el) {
    var t = C.GOAL_TEMPLATES.filter(function (x) { return x.id === el.dataset.id; })[0];
    App.openModal('goal', {}); var f = S.modal.f; App.modals.goal(S.modal);
    if (t) { var tgt = t.type === 'short_debt' ? C.debtSummary(C.spaceView(S.L, 'personal'), S.today).short : t.target; Object.assign(f, { title: T(t.ru, t.en), target: App.amtStr(tgt), type: t.type, tplColor: t.color, tplIcon: t.icon, note: T(t.hint.ru, t.hint.en) }); }
    App.renderModal();
  };
  App.actions.saveGoal = function () {
    var m = S.modal, f = m.f, t = App.toMinor(f.target); if (!f.title || !t) { m.err = 'x'; App.toast(T('Укажи название и сумму', 'Enter a title and amount')); return; }
    App.commit(T('Цель сохранена', 'Goal saved'), function (L) {
      var o = { title: f.title, target: t, currency: f.currency, targetDate: f.targetDate || null, note: f.note, accountId: f.accountId || null };
      if (m.id) Object.assign(C.byId(L.goals, m.id), o);
      else L.goals.push(Object.assign({ id: C.uid('goal'), type: f.type && f.type !== 'apartment' ? f.type : 'custom', contributions: [], color: f.tplColor || '#64D2FF', icon: f.tplIcon || 'target', space: App.space() }, o));
    });
    App.closeModal();
  };

  /* ---------- yearly income plan: month / quarter / year, manual actuals, variance ---------- */
  App.screens.incomeYear = function () {
    var L = S.L; S.ui.incY = S.ui.incY || +S.today.slice(0, 4); S.ui.incMode = S.ui.incMode || 'month';
    var y = S.ui.incY, mode = S.ui.incMode, rows = C.incomePlanView(L, y, mode), ip = L.incomePlan || { lines: [] };
    var h = '<div class="split"><button class="iconbtn" data-a="incYear" data-d="-1">' + I('back') + '</button><b>' + y + '</b><button class="iconbtn" data-a="incYear" data-d="1" style="transform:scaleX(-1)">' + I('back') + '</button></div>';
    h += '<div class="seg mt8">' + [['month', T('Месяцы', 'Months')], ['quarter', T('Кварталы', 'Quarters')], ['year', T('Год', 'Year')]].map(function (x) { return '<button class="' + (mode === x[0] ? 'on' : '') + '" data-a="incMode" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var tot = C.incomePlanView(L, y, 'year')[0];
    h += '<div class="v3kpis mt12">' + App.kpi(T('Ожидается за год', 'Expected this year'), F(tot.exp), 'plan', T('диапазон ', 'range ') + F(tot.low, 'AED', { dec: 0 }) + ' – ' + F(tot.high, 'AED', { dec: 0 })) + App.kpi(T('Факт введён', 'Actual entered'), tot.actual == null ? '—' : F(tot.actual), 'pos', tot.filled + T(' мес. из ', ' of ') + tot.planned) + App.kpi(T('Отклонение', 'Variance'), tot.variance == null ? '—' : App.FS(tot.variance), tot.variance < 0 ? 'neg' : 'pos', T('по месяцам с фактом', 'months with actuals')) + '</div>';
    h += CH.bars({ id: 'incBars', height: 140, groups: rows.map(function (r) { return { label: mode === 'month' ? App.fymShort(r.key) : r.label, tip: (mode === 'month' ? App.fym(r.key) : r.label), values: [{ v: r.exp, color: 'var(--planned)', name: T('План', 'Plan') }, { v: r.actual || 0, color: 'var(--income)', name: T('Факт', 'Actual') }] }; }), fmtTip: function (v) { return F(v); }, legend: [{ name: T('План', 'Plan'), color: 'var(--planned)' }, { name: T('Факт (введён вручную)', 'Actual (entered)'), color: 'var(--income)' }] });
    h += '<div class="list mt12">' + rows.map(function (r) {
      var lbl = mode === 'month' ? App.fym(r.key) : r.label + ' ' + y, d = r.detail, sub = '';
      if (d) sub = d.lines.filter(function (l) { return l.exp || l.actual != null; }).map(function (l) { return esc(l.title) + ': ' + esc(F(l.exp, 'AED', { dec: 0 })) + (l.low !== l.exp ? ' (' + T('мин ', 'min ') + esc(F(l.low, 'AED', { dec: 0 })) + ')' : '') + (l.actual != null ? ' → ' + esc(F(l.actual, 'AED', { dec: 0 })) : ''); }).join('<br>');
      var varTxt = r.variance == null ? '<span class="tiny muted">' + T('факт не введён', 'no actual') + '</span>' : '<span class="num small ' + (r.variance < 0 ? 'neg' : 'pos') + '">' + esc(App.FS(r.variance)) + (r.expForActual ? ' · ' + App.pct(r.variance / r.expForActual) : '') + '</span>';
      return '<' + (d ? 'button class="row tap" data-a="modal" data-m="incActual" data-ym="' + r.key + '"' : 'div class="row"') + '><div class="main-t"><div class="t1">' + esc(lbl) + '</div><div class="t2">' + (sub || T('план ', 'plan ') + esc(F(r.exp))) + '</div><div class="t2">' + T('записано в учёте: ', 'recorded: ') + esc(F(r.recorded)) + '</div></div><div class="amt" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="num">' + esc(r.actual == null ? F(r.exp) : F(r.actual)) + '</span>' + varTxt + '</div></' + (d ? 'button' : 'div') + '>';
    }).join('') + '</div>';
    h += '<div class="sec-h"><span class="t small">' + T('Строки дохода', 'Income lines') + '</span><button class="more" data-a="modal" data-m="incLine">' + I('plus', 'sm') + T('Строка', 'Line') + '</button></div><div class="list">' + (ip.lines.length ? ip.lines.map(function (l) { return '<button class="row tap" data-a="modal" data-m="incLine" data-id="' + l.id + '"><span class="cat-ic" style="background:' + (l.type === 'salary' ? 'var(--income)' : l.type === 'debt_return' ? '#66D4CF' : '#8E8E93') + '">' + I(l.type === 'debt_return' ? 'undo' : 'wallet') + '</span><div class="main-t"><div class="t1">' + esc(l.title) + '</div><div class="t2">' + esc({ salary: T('зарплата', 'salary'), debt_return: T('возврат долга мне — не доход', 'loan returned — not income'), other: T('прочее', 'other') }[l.type] || l.type) + '</div></div>' + I('chev', 'sm') + '</button>'; }).join('') : '<div class="empty">' + T('Добавь строку дохода: зарплата, подработка, возврат долга.', 'Add an income line: salary, side income, loan returned.') + '</div>') + '</div>';
    h += '<div class="dashed-note">' + T('План — по месяцу поступления денег. Факт вводишь сам в конце месяца (нажми на месяц). «Записано в учёте» — сумма доходов и возвратов из записей за месяц, для сверки. Отклонение = факт − план.', 'Plan is by month of receipt. Enter actuals yourself at month end (tap a month). “Recorded” = income and returns from records that month, for reconciliation. Variance = actual − plan.') + '</div>';
    return { title: T('План доходов на год', 'Yearly income plan'), html: h };
  };
  App.actions.incYear = function (el) { S.ui.incY += +el.dataset.d; App.render(); };
  App.actions.incMode = function (el) { S.ui.incMode = el.dataset.v; App.render(); };
  App.modals.incActual = function (m) {
    var L = S.L, ym = m.ym, d = C.incomeMonth(L, ym), f = m.f;
    if (!m.inited) { m.inited = true; d.lines.forEach(function (l) { f['a_' + l.id] = l.actual == null ? '' : App.amtStr(l.actual); f['e_' + l.id] = App.amtStr(l.exp); f['l_' + l.id] = App.amtStr(l.low); }); }
    var h = '<div class="form">' + d.lines.map(function (l) {
      return '<div class="group"><div class="group-t">' + esc(l.title) + '</div>' + App.fld(T('План', 'Plan'), '<input class="in num" inputmode="decimal" data-ch="fset" data-k="e_' + l.id + '" value="' + esc(f['e_' + l.id]) + '">') + (l.type === 'salary' ? App.fld(T('Пессимистично', 'Pessimistic'), '<input class="in num" inputmode="decimal" data-ch="fset" data-k="l_' + l.id + '" value="' + esc(f['l_' + l.id]) + '">') : '') + App.fld(T('Факт', 'Actual'), '<input class="in num" inputmode="decimal" placeholder="' + T('не введён', 'not entered') + '" data-ch="fset" data-k="a_' + l.id + '" value="' + esc(f['a_' + l.id]) + '">') + '</div>';
    }).join('') + '</div><div class="dashed-note">' + T('Записано в учёте за месяц: ', 'Recorded this month: ') + esc(F(d.recorded)) + T('. Пустое поле факта = факт не введён.', '. Empty actual = not entered.') + '</div>';
    return { title: App.fym(ym), html: h, done: 'incActualOk', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.incActualOk = function () {
    var m = S.modal, f = m.f, d = C.incomeMonth(S.L, m.ym);
    App.commit(T('План доходов обновлён', 'Income plan updated'), function (L) {
      d.lines.forEach(function (l) {
        var e = App.toMinor(f['e_' + l.id] || '0') || 0, lo = f['l_' + l.id] != null && f['l_' + l.id] !== '' ? App.toMinor(f['l_' + l.id]) : e;
        C.setIncomeExpected(L, m.ym, l.id, { exp: e, low: Math.min(lo, e), high: e });
        var a = f['a_' + l.id]; C.setIncomeActual(L, m.ym, l.id, a === '' || a == null ? null : App.toMinor(a));
      });
    });
    App.closeModal();
  };
  App.modals.incLine = function (m) {
    var ip = C.ensureIncomePlan(JSON.parse(JSON.stringify({ incomePlan: S.L.incomePlan }))), l = m.id ? C.byId(ip.lines, m.id) : null, f = m.f;
    if (!m.inited) { m.inited = true; Object.assign(f, l ? { title: l.title, type: l.type, exp: '', low: '' } : { title: '', type: 'salary', exp: '', low: '', from: C.ymOf(S.today), n: '12' }); }
    var x = App.fld(T('Название', 'Title'), '<input class="in" data-ch="fset" data-k="title" value="' + esc(f.title) + '">') + App.fld(T('Тип', 'Type'), '<select class="in" data-ch="fset" data-k="type">' + App.opts([['salary', T('Зарплата', 'Salary')], ['debt_return', T('Возврат долга мне', 'Loan returned to me')], ['other', T('Прочее', 'Other')]], f.type) + '</select>');
    if (!l) x += App.fld(T('Сумма в месяц (план)', 'Monthly amount (plan)'), '<input class="in num" inputmode="decimal" data-ch="fset" data-k="exp" value="' + esc(f.exp) + '">') + App.fld(T('Пессимистично', 'Pessimistic'), '<input class="in num" inputmode="decimal" data-ch="fset" data-k="low" value="' + esc(f.low) + '">') + App.fld(T('С месяца', 'From month'), '<input class="in" type="month" data-ch="fset" data-k="from" value="' + esc(f.from) + '">') + App.fld(T('Месяцев', 'Months'), '<input class="in num" inputmode="numeric" data-ch="fset" data-k="n" value="' + esc(f.n) + '">');
    var h = '<div class="form"><div class="group">' + x + '</div></div>' + (l ? '<div class="btns"><button class="btn danger" data-a="incLineDel" data-id="' + l.id + '">' + I('trash') + T('Удалить строку', 'Delete line') + '</button></div><div class="dashed-note">' + T('Суммы по месяцам меняются в самом месяце (нажми на месяц в списке).', 'Change monthly amounts inside each month.') + '</div>' : '');
    return { title: l ? T('Строка дохода', 'Income line') : T('Новая строка дохода', 'New income line'), html: h, done: 'incLineOk', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.incLineOk = function () {
    var m = S.modal, f = m.f; if (!f.title) { App.toast(T('Укажи название', 'Enter a title')); return; }
    App.commit(T('Строка дохода сохранена', 'Income line saved'), function (L) {
      var ip = C.ensureIncomePlan(L);
      if (m.id) { var l = C.byId(ip.lines, m.id); l.title = f.title; l.type = f.type; return; }
      var id = C.uid('inc'), e = App.toMinor(f.exp || '0') || 0, lo = f.low ? App.toMinor(f.low) : e;
      ip.lines.push({ id: id, title: f.title, type: f.type });
      for (var i = 0; i < Math.min(60, +f.n || 0); i++) if (e > 0) C.setIncomeExpected(L, C.addMonths(f.from || C.ymOf(S.today), i), id, { exp: e, low: Math.min(lo, e), high: e });
    });
    App.closeModal();
  };
  App.actions.incLineDel = function (el) {
    var id = el.dataset.id; App.confirm(T('Удалить строку?', 'Delete line?'), T('План и введённые факты по этой строке будут удалены (можно отменить).', 'Plan and actuals for this line will be removed (undo available).'), function () {
      App.commit(T('Строка удалена', 'Line deleted'), function (L) { var ip = C.ensureIncomePlan(L); ip.lines = ip.lines.filter(function (l) { return l.id !== id; }); ['months', 'actuals'].forEach(function (k) { Object.keys(ip[k]).forEach(function (ym) { delete ip[k][ym][id]; if (!Object.keys(ip[k][ym]).length) delete ip[k][ym]; }); }); });
    }, true, T('Удалить', 'Delete'));
  };

  function incYearCard() {
    var y = +S.today.slice(0, 4), ym = C.ymOf(S.today), cur = C.incomeMonth(S.L, ym), tot = C.incomePlanView(S.L, y, 'year')[0];
    return '<div class="card tap" data-a="go" data-s="incomeYear"><div class="card-h"><span class="t">' + T('План доходов на год', 'Yearly income plan') + '</span><span class="more">' + I('chev', 'sm') + '</span></div><div class="kpis">' + App.kpi(App.fym(ym), F(cur.exp), 'plan', cur.actual == null ? T('факт не введён', 'no actual yet') : T('факт ', 'actual ') + F(cur.actual)) + App.kpi(String(y), F(tot.exp), 'pos', tot.variance == null ? T('месяц · квартал · год', 'month · quarter · year') : T('отклонение ', 'variance ') + App.FS(tot.variance)) + '</div></div>';
  }
  var planHub = App.screens.planning;
  App.screens.planning = function () { var out = planHub(); out.html = incYearCard() + out.html; return out; };
  var incScreen = App.screens.income;
  App.screens.income = function (p) { var out = incScreen(p); out.html = incYearCard() + out.html; return out; };

  /* ---------- rates: AED per USD, UZS per AED (inverse input), date caption ---------- */
  App.screens.currencies = function () {
    var L = S.L, d = L.rateDates || {};
    var row = function (c) {
      if (c === 'AED') return App.fld('AED' + T(' (базовая)', ' (base)'), '<span class="muted">1</span>');
      if (c === 'UZS') return App.fld('1 AED = ? UZS', '<input class="in num" inputmode="decimal" data-ch="rateSetInv" data-c="UZS" value="' + esc(L.rates.UZS ? String(Math.round(1 / L.rates.UZS * 100) / 100) : '') + '">') + '<div class="tiny muted" style="padding:0 14px 8px">' + T('обновлён ', 'updated ') + esc(d.UZS ? App.fd(d.UZS, true) : '—') + '</div>';
      return App.fld('1 ' + c + ' = ? AED', '<input class="in num" inputmode="decimal" data-ch="rateSet" data-c="' + c + '" value="' + esc(String(L.rates[c])) + '">') + '<div class="tiny muted" style="padding:0 14px 8px">' + T('обновлён ', 'updated ') + esc(d[c] ? App.fd(d[c], true) : '—') + '</div>';
    };
    var h = '<div class="form"><div class="group">' + Object.keys(L.rates).map(row).join('') + '</div></div>';
    var rest = C.CURRENCIES.filter(function (c) { return !(c in L.rates); });
    if (rest.length) h += '<div class="form mt12"><div class="group">' + App.fld(T('Добавить валюту', 'Add currency'), '<select class="in" data-ch="rateAdd"><option value="">—</option>' + rest.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>') + '</div></div>';
    h += '<div class="dashed-note">' + T('Курсы вводятся вручную и не загружаются из интернета. Дата обновления ставится автоматически при изменении. UZS вводится как «сколько сумов за 1 AED». На главной под общим балансом показаны пересчёты в USD и UZS.', 'Rates are manual, never downloaded. The update date is set when you change a rate. UZS is entered as “UZS per 1 AED”. The dashboard shows USD and UZS equivalents.') + '</div>';
    return { title: T('Валюты и курсы', 'Currencies & rates'), html: h };
  };
  App.actions.rateSet = function (el) { var v = parseFloat(String(el.value).replace(',', '.').replace(/\s/g, '')); if (!(v > 0)) { App.toast(T('Неверный курс', 'Invalid rate')); App.render(); return; } App.commit(T('Курс ', 'Rate ') + el.dataset.c + ' = ' + v, function (L) { L.rates[el.dataset.c] = v; L.rateDates = L.rateDates || {}; L.rateDates[el.dataset.c] = S.today; }); };
  App.actions.rateSetInv = function (el) { var v = parseFloat(String(el.value).replace(',', '.').replace(/\s/g, '')); if (!(v > 0)) { App.toast(T('Неверный курс', 'Invalid rate')); App.render(); return; } App.commit('1 AED = ' + v + ' ' + el.dataset.c, function (L) { L.rates[el.dataset.c] = 1 / v; L.rateDates = L.rateDates || {}; L.rateDates[el.dataset.c] = S.today; }); };

  /* ---------- statistics: monthly / quarterly expense summary ---------- */
  function summaryHtml(kind, ym) {
    var L = C.spaceView(S.L, App.space()), r = kind === 'quarter' ? C.quarterRange(ym) : { from: ym + '-01', to: C.lastDay(ym), label: App.fym(ym) };
    var s = C.expenseSummary(L, r.from, r.to), prevYm = kind === 'quarter' ? C.addMonths(ym, -3) : C.addMonths(ym, -1);
    var pr = kind === 'quarter' ? C.quarterRange(prevYm) : { from: prevYm + '-01', to: C.lastDay(prevYm) }, ps = C.expenseSummary(L, pr.from, pr.to);
    var diff = s.total - ps.total;
    var h = '<div class="kpis">' + App.kpi(T('Всего выплат', 'Total outflows'), F(s.total), 'neg', T('к прошлому периоду ', 'vs previous ') + App.FS(diff)) + App.kpi(T('Расходы на жизнь', 'Living costs'), F(s.consumer), '') + App.kpi(T('Погашение долгов (тело)', 'Debt principal'), F(s.debtPrincipal), 'plan') + App.kpi(T('Проценты и комиссии', 'Interest & fees'), F(s.finance), 'neg') + App.kpi(T('Семье', 'Family'), F(s.family), 'sav') + App.kpi(T('Заработано', 'Earned'), F(s.earned), 'pos') + '</div>';
    if (s.categories.length) h += '<div class="mt12">' + s.categories.slice(0, 8).map(function (c) { var cat = App.cat(c.id); return '<div class="split small mt8"><span>' + App.catIcon(cat) + ' ' + esc(App.catName(cat)) + '</span><span class="num">' + esc(F(c.value)) + ' · ' + App.pct(s.consumer ? c.value / s.consumer : 0, 0) + '</span></div>'; }).join('') + '</div>';
    else h += '<div class="tiny muted mt8">' + T('Расходов на жизнь в записях за период нет.', 'No living costs recorded in this period.') + '</div>';
    if (kind === 'month') { var br = C.budgetRemainder(S.L, ym, S.today); if (br.limit) h += '<div class="tiny muted mt8">' + T('Личный бюджет: ', 'Personal budget: ') + esc(F(br.spent)) + ' / ' + esc(F(br.limit)) + (br.swept ? T(' · остаток переведён в накопления', ' · remainder moved to savings') : '') + '</div>'; }
    return { label: r.label, html: h };
  }
  var statsHub = App.screens.stats;
  App.screens.stats = function () {
    var out = statsHub(), ym = C.ymOf(S.today), mo = summaryHtml('month', ym), q = summaryHtml('quarter', ym);
    out.html = '<div class="card tap" data-a="go" data-s="stat" data-k="summary"><div class="card-h"><span class="t">' + T('Сводка расходов', 'Expense summary') + '</span><span class="more">' + T('месяц · квартал', 'month · quarter') + I('chev', 'sm') + '</span></div><div class="small muted">' + esc(mo.label) + '</div>' + mo.html + '</div>' + out.html;
    return out;
  };
  var statDetail = App.screens.stat;
  App.screens.stat = function (p) {
    if (p.k !== 'summary') return statDetail(p);
    S.ui.sumKind = S.ui.sumKind || 'month'; S.ui.sumYm = S.ui.sumYm || C.ymOf(S.today);
    var kind = S.ui.sumKind, ym = S.ui.sumYm, step = kind === 'quarter' ? 3 : 1, s = summaryHtml(kind, ym);
    var h = '<div class="seg">' + [['month', T('Месяц', 'Month')], ['quarter', T('Квартал', 'Quarter')]].map(function (x) { return '<button class="' + (kind === x[0] ? 'on' : '') + '" data-a="sumKind" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="split mt12"><button class="iconbtn" data-a="sumShift" data-d="' + (-step) + '">' + I('back') + '</button><b>' + esc(s.label) + '</b><button class="iconbtn" data-a="sumShift" data-d="' + step + '" style="transform:scaleX(-1)">' + I('back') + '</button></div>';
    h += '<div class="card mt12">' + s.html + '</div>';
    var months = []; for (var i = 5; i >= 0; i--) months.push(C.addMonths(ym, -i * step));
    h += '<div class="card">' + CH.bars({ id: 'sumBars', height: 150, groups: months.map(function (x) { var r = kind === 'quarter' ? C.quarterRange(x) : { from: x + '-01', to: C.lastDay(x), label: App.fymShort(x) }, e = C.expenseSummary(C.spaceView(S.L, App.space()), r.from, r.to); return { label: kind === 'quarter' ? 'Q' + r.q + ' ' + String(r.y).slice(2) : r.label, values: [{ v: e.consumer, color: 'var(--expense)', name: T('Жизнь', 'Living') }, { v: e.debtPrincipal, color: 'var(--planned)', name: T('Долги', 'Debt') }, { v: e.finance, color: '#FF9F0A', name: T('Проценты', 'Interest') }, { v: e.family, color: 'var(--savings)', name: T('Семья', 'Family') }] }; }), fmtTip: function (v) { return F(v); }, legend: [{ name: T('Жизнь', 'Living'), color: 'var(--expense)' }, { name: T('Долги', 'Debt'), color: 'var(--planned)' }, { name: T('Проценты', 'Interest'), color: '#FF9F0A' }, { name: T('Семья', 'Family'), color: 'var(--savings)' }] }) + '</div>';
    h += '<div class="dashed-note">' + T('Сводка строится по фактическим записям. Погашение тела долга и переводы семье показаны отдельно от расходов на жизнь; полученные займы не считаются доходом.', 'Built from actual records. Debt principal and family transfers are shown apart from living costs; loans received are not income.') + '</div>';
    return { title: T('Сводка расходов', 'Expense summary'), html: h };
  };
  App.actions.sumKind = function (el) { S.ui.sumKind = el.dataset.v; App.render(); };
  App.actions.sumShift = function (el) { S.ui.sumYm = C.addMonths(S.ui.sumYm, +el.dataset.d); App.render(); };
})();
