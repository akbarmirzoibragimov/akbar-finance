/* 3.3 — «Доходы и расходы» (series = single source of the plan), series editor, FAB chooser, Planning blocks */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, CH = App.CH, S = App.S, T = App.T, F = App.F, esc = App.esc;
  var fld = App.fld, inp = App.inp, sel = App.sel, group = App.group;
  function own(a) { return !C.isLiab(a); }
  function errBox(m) { return m.err ? '<div class="alert danger">' + I('alert') + '<div class="grow">' + esc(m.err) + '</div></div>' : ''; }
  function curYm() { return C.ymOf(S.today); }
  function ser(id) { return C.byId(S.L.series || [], id); }
  function kindName(k) { return k === 'income' ? T('Доход', 'Income') : k === 'family' ? T('Родителям', 'Parents') : T('Платёж', 'Payment'); }
  function isIncome(s) { return s.kind === 'income'; }
  App.serFreqLabel = function (s) {
    if (s.freq === 'once') return T('Разово', 'One-off') + ' · ' + App.fymTiny(s.start);
    if (!s.end) return T('Ежемесячно', 'Monthly') + ' · ' + T('с ', 'from ') + App.fymTiny(s.start) + ' · ' + T('бессрочно', 'open-ended');
    var n = C.seriesMonths(s, S.today).length;
    return T('Ежемесячно', 'Monthly') + ' · ' + App.fymTiny(s.start) + ' – ' + App.fymTiny(s.end) + ' · ' + n + T(' мес.', ' mo');
  };
  function amtHtml(s, ym) {
    if (C.seriesAmountUnset(s)) return '<span class="muted small">' + T('сумма не задана', 'amount not set') + '</span>';
    var v = C.seriesAmountFor(s, ym || (s.start > curYm() ? s.start : curYm()));
    return '<span class="num ' + (isIncome(s) ? 'pos' : '') + '">' + (isIncome(s) ? '+' : '−') + esc(F(v)) + '</span>';
  }
  function serRow(s) {
    var acc = s.accountId && C.byId(S.L.accounts, s.accountId);
    var sub = App.serFreqLabel(s) + (s.kind !== 'income' ? ' · ' + (acc ? esc(acc.name) : kindName(s.kind)) : '');
    var ov = Object.keys(s.overrides || {}).length;
    return '<button class="row tap ser-row" data-a="go" data-s="seriesEdit" data-id="' + s.id + '"><div class="main-t"><div class="t1">' + esc(s.title || kindName(s.kind)) + '</div><div class="t2">' + sub + (ov ? ' · ' + ov + T(' изм.', ' edits') : '') + '</div></div><div class="amt">' + amtHtml(s) + '</div></button>';
  }

  /* ---------- list screen ---------- */
  App.screens.series = function () {
    var L = S.L, tab = S.ui.serTab || 'income', list = (L.series || []).filter(function (s) { return tab === 'income' ? isIncome(s) : !isIncome(s); });
    var ym = C.simStartYm(L, S.today), cym = curYm(), done = function (s) { return s.freq === 'once' ? s.start < cym : (s.end && s.end < cym); };
    var h = '<div class="seg">' + [['income', T('Доходы', 'Income')], ['expense', T('Расходы', 'Expenses')]].map(function (x) { return '<button class="' + (tab === x[0] ? 'on' : '') + '" data-a="serTab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var tot = 0; list.forEach(function (s) { if (C.seriesMonths(s, S.today).indexOf(ym) >= 0) tot += C.seriesAmountFor(s, ym); });
    h += '<div class="card"><div class="split"><span class="muted small">' + (tab === 'income' ? T('Доходы в ', 'Income in ') : T('Расходы в ', 'Expenses in ')) + esc(App.fym(ym)) + '</span><span class="num b">' + esc(F(tot)) + '</span></div><div class="tiny muted mt8">' + T('Один список для всего плана: Плановые платежи, бюджетные периоды, симулятор, главная и Debt Freedom берут цифры отсюда.', 'One list for the whole plan: planned payments, budget periods, simulator, dashboard and Debt Freedom read from here.') + '</div></div>';
    var sec = function (title, items, freq) {
      return '<div class="sec-h"><span class="t small">' + title + '</span><button class="link" data-a="modal" data-m="serNew" data-kind="' + (tab === 'income' ? 'income' : 'payment') + '" data-freq="' + freq + '">' + I('plus', 'sm') + T('Добавить', 'Add') + '</button></div>' +
        (items.length ? '<div class="list">' + items.map(serRow).join('') + '</div>' : '<div class="card empty small">' + T('Пока пусто', 'Nothing yet') + '</div>');
    };
    var act = list.filter(function (s) { return !done(s); }), old = list.filter(done);
    h += sec(T('Ежемесячные', 'Monthly'), act.filter(function (s) { return s.freq !== 'once'; }), 'open');
    h += sec(tab === 'income' ? T('Разовые (бонус, непредвиденный доход)', 'One-off (bonus, unexpected income)') : T('Разовые и непредвиденные', 'One-off & unexpected'), act.filter(function (s) { return s.freq === 'once'; }), 'once');
    if (old.length) h += '<div class="sec-h"><span class="t small muted">' + T('Завершённые', 'Finished') + '</span></div><div class="list">' + old.map(serRow).join('') + '</div>';
    var loose = L.planned.filter(function (p) { return !p.seriesId && !p.scenario; }).length;
    if (loose) h += '<div class="tiny muted mt8">' + loose + T(' плановых операций вне серий (займы) — см. «Плановые платежи».', ' planned items outside series (loans) — see Planned payments.') + '</div>';
    return { title: T('Доходы и расходы', 'Income & expenses'), html: h, right: '<button class="iconbtn" data-a="modal" data-m="serNew" data-kind="' + (tab === 'income' ? 'income' : 'payment') + '" aria-label="add">' + I('plus') + '</button>' };
  };
  App.actions.serTab = function (el) { S.ui.serTab = el.dataset.v; App.render(); };

  /* ---------- series editor screen ---------- */
  App.screens.seriesEdit = function (p) {
    var L = S.L, s = ser(p.id);
    if (!s) return { title: T('Серия', 'Series'), html: '<div class="card empty">' + T('Серия удалена', 'Series deleted') + '</div>' };
    var occ = {}; L.planned.forEach(function (q) { if (q.seriesId === s.id) occ[q.occYm || C.ymOf(q.date)] = q; });
    var h = '<div class="card"><div class="split"><div><div class="b">' + esc(s.title || kindName(s.kind)) + '</div><div class="tiny muted">' + kindName(s.kind) + ' · ' + esc(App.serFreqLabel(s)) + '</div></div><div class="right">' + amtHtml(s) + '</div></div>';
    h += '<div class="tiny muted mt8">' + T('Базовая сумма: ', 'Base amount: ') + (s.steps || []).map(function (x) { return esc(App.fymTiny(x.from)) + ' → ' + (x.amount ? esc(F(x.amount)) : T('не задана', 'not set')); }).join(' · ') + '</div>';
    h += '<div class="btns"><button class="btn sec" data-a="modal" data-m="serNew" data-id="' + s.id + '">' + I('edit') + T('Параметры', 'Settings') + '</button>' + (s.freq !== 'once' && s.end ? '<button class="btn sec" data-a="serExtend" data-id="' + s.id + '">' + T('+12 мес.', '+12 mo') + '</button>' : '') + '</div></div>';
    h += '<div class="sec-h"><span class="t small">' + T('Месяцы', 'Months') + '</span><span class="tiny muted">' + T('нажми месяц, чтобы изменить', 'tap a month to edit') + '</span></div>';
    var months = C.seriesMonths(s, S.today), ym0 = C.addMonths(curYm(), -2), ym1 = C.addMonths(curYm(), 12);
    var shown = months.filter(function (ym) { return (ym >= ym0 && ym <= ym1) || (ym < ym0 && occ[ym] && C.plannedState(L, occ[ym], S.today).open); });
    if (S.ui.serPast) shown = months;
    var removed = Object.keys(s.removed || {}).filter(function (k) { return k >= s.start && k <= C.seriesEnd(s, S.today); });
    h += '<div class="list" data-ser-months="1">' + shown.map(function (ym) {
      var q = occ[ym], st = q ? C.plannedState(L, q, S.today) : null, ovr = C.seriesIsOverridden(s, ym);
      var tags = (ovr ? '<span class="tag info">' + T('изменено', 'edited') + '</span> ' : '') + (st && !st.open && st.status !== 'planned' ? App.pTag(st.status) : '');
      return '<button class="row tap" data-a="modal" data-m="serMonth" data-id="' + s.id + '" data-ym="' + ym + '"><div class="main-t"><div class="t1">' + esc(App.fym(ym)) + '</div><div class="t2">' + (q ? esc(App.fd(q.date, true)) + (q.budgetMonth && q.budgetMonth !== ym ? ' → ' + esc(App.fymShort(q.budgetMonth)) : '') : '') + ' ' + tags + '</div></div><div class="amt"><div class="num' + (ovr ? ' b' : '') + '">' + (C.seriesAmountFor(s, ym) ? esc(F(C.seriesAmountFor(s, ym))) : '<span class="muted small">' + T('сумма не задана', 'amount not set') + '</span>') + '</div></div></button>';
    }).join('') + '</div>';
    if (shown.length < months.length || S.ui.serPast) h += '<div class="btns"><button class="btn sec" data-a="serPast">' + T('Показать все месяцы', 'Show all months') + ' (' + months.length + ')' + '</button></div>';
    if (removed.length) h += '<div class="tiny muted mt8">' + T('Пропущены: ', 'Skipped: ') + removed.map(function (k) { return '<button class="link" data-a="serUnskip" data-id="' + s.id + '" data-ym="' + k + '">' + esc(App.fymTiny(k)) + '</button>'; }).join(', ') + '</div>';
    if (!s.end && s.freq !== 'once') h += '<div class="tiny muted mt8">' + T('Бессрочная серия продлевается сама: в плане всегда ', 'Open-ended: the plan always holds ') + C.SERIES_HORIZON + T(' мес. от текущего месяца.', ' months from the current month.') + '</div>';
    h += '<div class="btns"><button class="btn danger" data-a="serDelete" data-id="' + s.id + '">' + I('trash') + T('Удалить серию', 'Delete series') + '</button></div>';
    return { title: s.title || kindName(s.kind), html: h };
  };
  App.actions.serPast = function () { S.ui.serPast = !S.ui.serPast; App.render(); };
  App.actions.serExtend = function (el) { var id = el.dataset.id; App.commit(T('Серия продлена', 'Series extended'), function (L) { var s = C.byId(L.series, id); s.end = C.addMonths(s.end, 12); }); };
  App.actions.serUnskip = function (el) { var id = el.dataset.id, ym = el.dataset.ym; App.commit(T('Месяц возвращён', 'Month restored'), function (L) { var s = C.byId(L.series, id); delete s.removed[ym]; }); };
  App.actions.serDelete = function (el) {
    var id = el.dataset.id;
    App.confirm(T('Удалить серию?', 'Delete series?'), T('Будущие плановые месяцы удалятся. Уже подтверждённые и оплаченные операции останутся.', 'Future planned months are removed. Confirmed and paid items stay.'), function () {
      App.commit(T('Серия удалена', 'Series deleted'), function (L) {
        var locked = {}; L.transactions.forEach(function (t) { if (t.status !== 'void' && t.plannedId) locked[t.plannedId] = 1; });
        L.planned = L.planned.filter(function (p) { if (p.seriesId !== id) return true; if (locked[p.id] || p.confirmed) { p.seriesId = null; return true; } return false; });
        L.series = L.series.filter(function (s) { return s.id !== id; });
      });
      App.back ? App.back() : null;
    }, true, T('Удалить', 'Delete'));
  };

  /* ---------- month edit: только этот / этот и все следующие / сбросить ---------- */
  App.modals.serMonth = function (m) {
    var s = ser(m.id), f = m.f; if (!s) return { title: '', html: '' };
    var q = S.L.planned.filter(function (p) { return p.seriesId === s.id && (p.occYm || C.ymOf(p.date)) === m.ym; })[0];
    var st = q ? C.plannedState(S.L, q, S.today) : null;
    if (!m.inited) { m.inited = true; f.amount = App.amtStr(C.seriesAmountFor(s, m.ym)); }
    var base = C.seriesBaseAmount(s, m.ym), ovr = C.seriesIsOverridden(s, m.ym);
    var h = '<div class="form">' + group('', fld(T('Сумма', 'Amount') + ' (AED)', inp('amount', f.amount, { num: true, ph: T('не задана', 'not set') }))) + '</div>';
    h += '<div class="card small">' + App.kv(T('Базовая сумма', 'Base amount'), base ? F(base) : T('не задана', 'not set')) + (ovr ? '<div class="tiny info mt8">' + T('Этот месяц изменён отдельно', 'This month is edited separately') + '</div>' : '') + (st && !st.open && st.status !== 'planned' ? '<div class="tiny unconf mt8">' + T('Месяц уже подтверждён/оплачен — сумма этой операции не изменится.', 'Month already confirmed/paid — that item keeps its amount.') + '</div>' : '') + '</div>';
    h += '<div class="btns col"><button class="btn" data-a="serSetOnly">' + T('Изменить только этот месяц', 'Change only this month') + '</button><button class="btn sec" data-a="serSetFollowing">' + T('Этот и все следующие', 'This and all following') + '</button>' + (ovr ? '<button class="btn sec" data-a="serReset">' + T('Сбросить к базовой', 'Reset to base') + '</button>' : '') + '</div>';
    h += '<div class="btns">' + (q ? '<button class="btn sec" data-a="modal" data-m="editPlanned" data-id="' + q.id + '">' + (q.kind === 'income' ? T('Подтвердить / открыть', 'Confirm / open') : T('Оплатить / открыть', 'Pay / open')) + '</button>' : '') + '<button class="btn sec" data-a="serSkip">' + T('Пропустить месяц', 'Skip month') + '</button></div>';
    h += errBox(m);
    return { title: App.fym(m.ym) + ' · ' + esc(s.title), html: h };
  };
  function monthAmt(m) { var a = String(m.f.amount || '').trim() === '' ? 0 : App.toMinor(m.f.amount); if (a == null || a < 0) { m.err = T('Введите сумму', 'Enter an amount'); App.renderModal(); return null; } return a; }
  App.actions.serSetOnly = function () { var m = S.modal, a = monthAmt(m); if (a == null) return; App.closeModal(); App.commit(T('Изменён один месяц', 'One month changed'), function (L) { C.setSeriesAmount(C.byId(L.series, m.id), m.ym, a, 'only'); }); };
  App.actions.serSetFollowing = function () {
    var m = S.modal, a = monthAmt(m); if (a == null) return;
    var s = ser(m.id), later = C.seriesLaterOverrides(s, m.ym);
    var apply = function (clear) { App.commit(T('Изменено с ', 'Changed from ') + App.fymTiny(m.ym), function (L) { C.setSeriesAmount(C.byId(L.series, m.id), m.ym, a, 'following', clear); }); };
    if (!later.length) { App.closeModal(); apply(false); return; }
    App.openModal('serLater', { id: m.id, ym: m.ym, later: later, apply: apply });
  };
  App.modals.serLater = function (m) {
    return { title: T('Отдельные изменения дальше', 'Later per-month edits'), html: '<div class="card">' + T('После ', 'After ') + esc(App.fym(m.ym)) + T(' есть месяцы, изменённые отдельно: ', ' some months were edited separately: ') + m.later.map(function (k) { return esc(App.fymTiny(k)); }).join(', ') + '.<div class="tiny muted mt8">' + T('Сбросить их к новой базовой сумме или оставить как есть?', 'Reset them to the new base or keep them?') + '</div></div>' +
      '<div class="btns col"><button class="btn" data-a="serLaterKeep">' + T('Оставить отдельные изменения', 'Keep them') + '</button><button class="btn danger" data-a="serLaterClear">' + T('Сбросить их', 'Reset them') + ' (' + m.later.length + ')</button></div>' };
  };
  App.actions.serLaterKeep = function () { var fn = S.modal.apply; App.closeModal(); fn(false); };
  App.actions.serLaterClear = function () { var fn = S.modal.apply; App.closeModal(); fn(true); };
  App.actions.serReset = function () { var m = S.modal; App.closeModal(); App.commit(T('Сброшено к базовой', 'Reset to base'), function (L) { C.resetSeriesMonth(C.byId(L.series, m.id), m.ym); }); };
  App.actions.serSkip = function () { var m = S.modal; App.closeModal(); App.commit(T('Месяц пропущен', 'Month skipped'), function (L) { var s = C.byId(L.series, m.id); s.removed = s.removed || {}; s.removed[m.ym] = 1; }); };

  /* ---------- create / edit series ---------- */
  App.modals.serNew = function (m) {
    var L = S.L, s = m.id ? ser(m.id) : null, f = m.f;
    if (!m.inited) {
      m.inited = true;
      if (s) Object.assign(f, { kind: s.kind, title: s.title, amount: App.amtStr((s.steps || [])[0] ? s.steps[0].amount : 0), freq: s.freq === 'once' ? 'once' : (s.end ? 'until' : 'open'), start: s.start, end: s.end || C.addMonths(s.start, 11), count: '', day: String(s.day || 1), shift: String(s.budgetShift || 0), accountId: s.accountId || '', from: s.fromAccountId || '', to: s.toAccountId || '', category: s.categoryId || 'misc', note: s.note || '' });
      else {
        var k = m.kind || 'payment', fr = m.freq || 'open', acc0 = (L.accounts.filter(function (a) { return own(a) && !a.role; })[0] || {}).id || '';
        Object.assign(f, { kind: k, title: '', amount: '', freq: fr, start: curYm(), end: C.addMonths(curYm(), 11), count: '6', day: fr === 'once' ? '15' : (k === 'income' ? '31' : '1'), shift: k === 'income' && fr !== 'once' ? '1' : '0', accountId: m.acc || '', from: acc0, to: acc0, category: 'misc', note: '' });
      }
    }
    var x = '';
    if (!s) x += fld(T('Тип', 'Type'), sel('kind', App.opts([['income', T('Доход', 'Income')], ['payment', T('Расход / платёж', 'Expense / payment')], ['family', T('Родителям', 'Parents')]], f.kind), { re: 1 }));
    x += fld(T('Название', 'Title'), inp('title', f.title, { ph: f.kind === 'income' ? T('например, Зарплата', 'e.g. Salary') : T('например, Аренда', 'e.g. Rent') }));
    var multi = s && (s.steps || []).length > 1;
    if (!multi) x += fld(T('Сумма', 'Amount') + ' (AED)', inp('amount', f.amount, { num: true, ph: T('можно оставить пустой', 'may be empty') }));
    x += fld(T('Частота', 'Frequency'), sel('freq', App.opts([['open', T('Ежемесячно, бессрочно', 'Monthly, open-ended')], ['until', T('Ежемесячно, до месяца', 'Monthly, until month')], ['n', T('На N месяцев', 'For N months')], ['once', T('Разово', 'One-off')]], f.freq), { re: 1 }));
    x += fld(f.freq === 'once' ? T('Месяц', 'Month') : T('С месяца', 'From month'), inp('start', f.start, { type: 'month' }));
    if (f.freq === 'until') x += fld(T('По месяц', 'Until month'), inp('end', f.end, { type: 'month' }));
    if (f.freq === 'n') x += fld(T('Сколько месяцев', 'How many months'), inp('count', f.count, { num: true }));
    x += fld(T('День месяца', 'Day of month'), inp('day', f.day, { num: true, ph: '31 = ' + T('последний', 'last') }));
    x += fld(T('Бюджетный месяц', 'Budget month'), sel('shift', App.opts([['0', T('тот же месяц', 'same month')], ['1', T('следующий (доход конца месяца)', 'next (end-of-month income)')]], f.shift)));
    if (f.kind === 'payment') {
      x += fld(T('Кредит / долг', 'Credit / loan'), sel('accountId', App.accOpts(C.isLiab, f.accountId, T('— обычный расход —', '— regular expense —')), { re: 1 }));
      if (!f.accountId) x += fld(T('Категория', 'Category'), sel('category', App.catOpts('expense', f.category)));
      x += fld(T('Со счёта', 'From account'), sel('from', App.accOpts(own, f.from)));
    }
    if (f.kind === 'family') x += fld(T('Со счёта', 'From account'), sel('from', App.accOpts(own, f.from)));
    if (f.kind === 'income') x += fld(T('На счёт', 'To account'), sel('to', App.accOpts(own, f.to)));
    x += fld(T('Комментарий', 'Note'), inp('note', f.note));
    var h = '<div class="form">' + group('', x, multi ? T('Сумма меняется по месяцам — открой месяц в списке.', 'The amount changes by month — open a month in the list.') : (s ? '' : T('Плановые месяцы появятся в «Плановых платежах», бюджетных периодах и симуляторе. Фактические балансы не меняются, пока не подтвердишь.', 'Planned months appear in planned payments, budget periods and the simulator. Actual balances do not change until you confirm.'))) + '</div>' + errBox(m);
    return { title: s ? T('Параметры серии', 'Series settings') : (f.freq === 'once' ? T('Новая разовая запись', 'New one-off entry') : T('Новая серия', 'New series')), html: h, done: 'serSave', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.serSave = function () {
    var m = S.modal, f = m.f, amt = String(f.amount || '').trim() === '' ? 0 : App.toMinor(f.amount);
    if (amt == null || amt < 0) { m.err = T('Неверная сумма', 'Invalid amount'); App.renderModal(); return; }
    if (!/^\d{4}-\d{2}$/.test(f.start || '')) { m.err = T('Укажите месяц', 'Set a month'); App.renderModal(); return; }
    var end = f.freq === 'once' ? f.start : f.freq === 'until' ? f.end : f.freq === 'n' ? C.addMonths(f.start, Math.max(1, Math.min(120, parseInt(f.count, 10) || 1)) - 1) : null;
    if (end && end < f.start) { m.err = T('Конец раньше начала', 'End is before start'); App.renderModal(); return; }
    var day = Math.max(1, Math.min(31, parseInt(f.day, 10) || 1));
    var title = f.title || (f.kind === 'income' ? T('Доход', 'Income') : f.kind === 'family' ? T('Перевод родителям', 'Transfer to parents') : T('Расход', 'Expense'));
    var fields = { title: title, freq: f.freq === 'once' ? 'once' : 'monthly', start: f.start, end: end, day: day, budgetShift: +f.shift || 0, accountId: f.kind === 'payment' ? (f.accountId || null) : null, fromAccountId: f.kind !== 'income' ? (f.from || null) : null, toAccountId: f.kind === 'income' ? (f.to || null) : null, categoryId: f.kind === 'payment' && !f.accountId ? f.category : null, note: f.note || '' };
    var id = m.id, newId = null;
    App.commit(id ? T('Серия изменена', 'Series updated') : T('Добавлено в план', 'Added to plan'), function (L) {
      L.series = L.series || [];
      if (id) {
        var s = C.byId(L.series, id), dayChanged = s.day !== day || (s.budgetShift || 0) !== fields.budgetShift;
        Object.assign(s, fields);
        if ((s.steps || []).length <= 1) s.steps = [{ from: f.start, amount: amt }];
        if (dayChanged) L.planned.forEach(function (p) { if (p.seriesId === id && !p.confirmed && !C.plannedState(L, p).txs.length) { var ym = p.occYm || C.ymOf(p.date); p.date = ym + '-' + ('0' + Math.min(day, C.daysInMonth(ym))).slice(-2); p.budgetMonth = C.addMonths(ym, fields.budgetShift); } });
      } else {
        var ns = C.newSeries(Object.assign({ kind: f.kind, amount: amt }, fields)); ns.end = end; newId = ns.id; L.series.push(ns);
      }
    });
    App.closeModal();
    void newId;
  };

  /* ---------- FAB: type chooser ---------- */
  App.modals.fabChooser = function () {
    var b = function (icon, title, sub, attrs) { return '<button class="row tap" ' + attrs + '>' + '<span class="ic">' + I(icon) + '</span><div class="main-t"><div class="t1">' + title + '</div><div class="t2">' + sub + '</div></div></button>'; };
    return { title: T('Добавить', 'Add'), html: '<div class="list">' +
      b('receipt', T('Операция (факт)', 'Record (actual)'), T('расход, доход, перевод — меняет баланс', 'expense, income, transfer — changes balance'), 'data-a="modal" data-m="record" data-fab="1"') +
      b('arrowIn', T('Ежемесячный доход', 'Monthly income'), T('зарплата и другие постоянные поступления', 'salary and other recurring income'), 'data-a="modal" data-m="serNew" data-kind="income" data-freq="open"') +
      b('arrowOut', T('Ежемесячный расход', 'Monthly expense'), T('аренда, кредит, родителям…', 'rent, loan, parents…'), 'data-a="modal" data-m="serNew" data-kind="payment" data-freq="open"') +
      b('gift', T('Разовый доход', 'One-off income'), T('бонус, непредвиденный доход', 'bonus, unexpected income'), 'data-a="modal" data-m="serNew" data-kind="income" data-freq="once"') +
      b('alert', T('Непредвиденный расход', 'Unexpected expense'), T('разовый расход в плане', 'one-off planned expense'), 'data-a="modal" data-m="serNew" data-kind="payment" data-freq="once"') +
      '</div>' };
  };

  /* ---------- Planning blocks ---------- */
  var CORE_NAMES = function () { return { series: T('Доходы и расходы', 'Income & expenses'), planned: 'Planned Payments', budgets: 'Budgets', income: 'Income Plan', calendar: T('Календарь', 'Calendar'), goals: T('Цели', 'Goals'), debts: 'Debt Repayment', family: 'Family Support', monthplan: T('Бюджетные периоды', 'Budget periods'), simulator: T('Симулятор', 'Simulator'), purchase: T('Проверка покупки', 'Purchase check') }; };
  var TPL = function () { return { goal: T('Накопления на цель', 'Saving for a goal'), income2: T('Второй доход', 'Second income'), debt: T('Отдельный долг', 'Single debt'), custom: T('Свой блок', 'Custom block') }; };
  function blockName(b) { return b.title || CORE_NAMES()[b.type] || TPL()[b.type] || b.type; }
  function seriesCard(L) {
    var ym = C.simStartYm(L, S.today), inc = 0, out = 0, n = (L.series || []).length;
    (L.series || []).forEach(function (s) { if (C.seriesMonths(s, S.today).indexOf(ym) < 0) return; if (isIncome(s)) inc += C.seriesAmountFor(s, ym); else out += C.seriesAmountFor(s, ym); });
    return App.planCard(T('Доходы и расходы', 'Income & expenses'), '<div class="kpis">' + App.kpi(T('Доходы в ', 'Income in ') + App.fymShort(ym), F(inc), 'pos') + App.kpi(T('Расходы', 'Expenses'), F(out), 'neg') + '</div><div class="tiny muted mt8">' + n + T(' серий · единый список для всего плана', ' series · one list for the whole plan') + '</div>', 'series');
  }
  function customCard(L, b) {
    var ym = curYm();
    if (b.type === 'goal') {
      var g = C.byId(L.goals || [], b.ref); if (!g) return missing(b);
      var gs = C.goalStatus(L, g, S.today);
      return App.planCard(esc(blockName(b)), '<div style="display:flex;gap:12px;align-items:center">' + CH.ring(gs.pct, g.color || 'var(--savings)', 54, '<span class="tiny b">' + Math.round(gs.pct * 100) + '%</span>') + '<div class="small"><div class="b">' + esc(g.title) + '</div><div class="muted">' + esc(F(gs.current || 0, g.currency)) + ' / ' + esc(F(g.target, g.currency)) + '</div></div></div>', 'goals');
    }
    if (b.type === 'income2') {
      var s = ser(b.ref); if (!s) return missing(b);
      var ms = C.seriesMonths(s, S.today).filter(function (x) { return x >= ym; }).slice(0, 3);
      return App.planCard(esc(blockName(b)), '<div class="tiny muted">' + esc(s.title) + ' · ' + esc(App.serFreqLabel(s)) + '</div>' + ms.map(function (x) { return '<div class="split small mt8"><span>' + esc(App.fym(x)) + '</span><span class="num pos">' + (C.seriesAmountFor(s, x) ? esc(F(C.seriesAmountFor(s, x))) : T('сумма не задана', 'amount not set')) + '</span></div>'; }).join(''), 'seriesEdit', ' data-id="' + s.id + '"');
    }
    if (b.type === 'debt') {
      var a = C.byId(L.accounts, b.ref); if (!a) return missing(b);
      var bal = C.balances ? (C.balances(L, S.today)[a.id] || 0) : 0;
      var nxt = L.planned.filter(function (p) { return p.accountId === a.id && p.kind === 'payment' && C.plannedState(L, p, S.today).open; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; })[0];
      return App.planCard(esc(blockName(b)), '<div class="kpis">' + App.kpi(T('Остаток', 'Balance'), F(Math.abs(bal), a.currency), 'neg') + App.kpi(T('Следующий платёж', 'Next payment'), nxt ? F(nxt.amount) : '—', 'plan', nxt ? App.fd(nxt.date, true) : '') + '</div>', 'account', ' data-id="' + a.id + '"');
    }
    var refs = (b.refs || []).map(ser).filter(Boolean), tot = 0;
    refs.forEach(function (s) { if (C.seriesMonths(s, S.today).indexOf(ym) >= 0) tot += (isIncome(s) ? 1 : -1) * C.seriesAmountFor(s, ym); });
    return App.planCard(esc(blockName(b)), '<div class="split small"><span class="muted">' + esc(App.fym(ym)) + '</span><span class="num ' + (tot < 0 ? 'neg' : 'pos') + '">' + esc(F(tot, 'AED', { plus: true })) + '</span></div>' + refs.slice(0, 4).map(function (s) { return '<div class="split tiny mt8"><span class="ellipsis">' + esc(s.title) + '</span>' + amtHtml(s) + '</div>'; }).join('') + (refs.length ? '' : '<div class="tiny muted mt8">' + T('Нет выбранных серий', 'No series selected') + '</div>'), 'series');
  }
  function missing(b) { return '<div class="card"><div class="card-h"><span class="t">' + esc(blockName(b)) + '</span></div><div class="tiny muted">' + T('Источник удалён — удали или замени блок.', 'Source deleted — remove or replace the block.') + '</div></div>'; }
  App.planHub = function (B) {
    var L = S.L, blocks = C.ensureBlocks(L);
    B.series = seriesCard(L);
    if (S.ui.planEdit) {
      var h = '<div class="tiny muted mb8">' + T('Стрелками меняй порядок, «Скрыть» убирает блок с экрана. Блоки только показывают данные из общего плана.', 'Arrows reorder, “Hide” removes a block from the screen. Blocks only display data from the shared plan.') + '</div><div class="list" data-blocks="1">';
      h += blocks.map(function (b, i) {
        return '<div class="row blk' + (b.hidden ? ' off' : '') + '" data-blk="' + b.id + '"><div class="main-t"><div class="t1">' + esc(blockName(b)) + '</div><div class="t2">' + (b.hidden ? T('скрыт', 'hidden') : (C.CORE_BLOCKS.indexOf(b.type) >= 0 ? T('стандартный', 'built-in') : TPL()[b.type])) + '</div></div>' +
          '<button class="iconbtn sm" data-a="blkMove" data-id="' + b.id + '" data-d="-1" aria-label="up"' + (i === 0 ? ' disabled' : '') + '>' + I('up', 'sm') + '</button><button class="iconbtn sm" data-a="blkMove" data-id="' + b.id + '" data-d="1" aria-label="down"' + (i === blocks.length - 1 ? ' disabled' : '') + '>' + I('down', 'sm') + '</button>' +
          '<button class="chip' + (b.hidden ? '' : ' on') + '" data-a="blkHide" data-id="' + b.id + '">' + (b.hidden ? T('Показать', 'Show') : T('Скрыть', 'Hide')) + '</button>' +
          (C.CORE_BLOCKS.indexOf(b.type) < 0 ? '<button class="iconbtn sm" data-a="blkDel" data-id="' + b.id + '" aria-label="delete">' + I('trash', 'sm') + '</button>' : '') + '</div>';
      }).join('') + '</div><div class="btns"><button class="btn" data-a="modal" data-m="blockAdd">' + I('plus') + T('Добавить блок', 'Add block') + '</button></div>';
      return { title: T('Планирование', 'Planning'), html: h, right: '<button class="link b" data-a="planEdit">' + T('Готово', 'Done') + '</button>' };
    }
    var html = '<div class="grid2">' + blocks.filter(function (b) { return !b.hidden; }).map(function (b) { return C.CORE_BLOCKS.indexOf(b.type) >= 0 ? (B[b.type] || '') : customCard(L, b); }).join('') + '</div>';
    var hid = blocks.filter(function (b) { return b.hidden; }).length;
    if (hid) html += '<div class="tiny muted mt8">' + T('Скрыто блоков: ', 'Hidden blocks: ') + hid + '</div>';
    return { title: T('Планирование', 'Planning'), html: html, right: '<button class="link" data-a="planEdit">' + T('Изменить', 'Edit') + '</button>' };
  };
  App.actions.planEdit = function () { S.ui.planEdit = !S.ui.planEdit; App.render(); };
  App.actions.blkMove = function (el) { var id = el.dataset.id, d = +el.dataset.d; App.commit(T('Порядок изменён', 'Order changed'), function (L) { if (!C.moveBlock(L, id, d)) return { ok: false }; }, { silent: true }); };
  App.actions.blkHide = function (el) {
    var id = el.dataset.id, b = C.ensureBlocks(S.L).filter(function (x) { return x.id === id; })[0]; if (!b) return;
    var go = function () { App.commit(b.hidden ? T('Блок показан', 'Block shown') : T('Блок скрыт', 'Block hidden'), function (L) { C.setBlockHidden(L, id, !b.hidden); }, { silent: true }); };
    if (!b.hidden && C.GUARDED_BLOCKS.indexOf(b.type) >= 0) App.confirm(T('Скрыть «', 'Hide “') + blockName(b) + T('»?', '”?'), T('Данные не удаляются — блок просто пропадёт с экрана «Планирование». Вернуть можно здесь же.', 'No data is deleted — the block just disappears from Planning. You can show it again here.'), go, false, T('Скрыть', 'Hide'));
    else go();
  };
  App.actions.blkDel = function (el) { var id = el.dataset.id; App.confirm(T('Удалить блок?', 'Delete block?'), T('Удаляется только блок, данные плана остаются.', 'Only the block is removed; plan data stays.'), function () { App.commit(T('Блок удалён', 'Block deleted'), function (L) { C.removeBlock(L, id); }); }, true, T('Удалить', 'Delete')); };
  App.modals.blockAdd = function (m) {
    var L = S.L, f = m.f; if (!m.inited) { m.inited = true; f.type = 'goal'; f.title = ''; f.ref = ''; }
    var x = fld(T('Шаблон', 'Template'), sel('type', App.opts(Object.keys(TPL()).map(function (k) { return [k, TPL()[k]]; }), f.type), { re: 1 }));
    x += fld(T('Название', 'Title'), inp('title', f.title, { ph: TPL()[f.type] }));
    if (f.type === 'goal') x += fld(T('Цель', 'Goal'), sel('ref', App.opts([['', '—']].concat((L.goals || []).map(function (g) { return [g.id, g.title]; })), f.ref)));
    if (f.type === 'income2') x += fld(T('Доход из списка', 'Income from the list'), sel('ref', App.opts([['', '—']].concat((L.series || []).filter(isIncome).map(function (s) { return [s.id, s.title]; })), f.ref)));
    if (f.type === 'debt') x += fld(T('Долг', 'Debt'), sel('ref', App.accOpts(C.isLiab, f.ref, '—')));
    var extra = '';
    if (f.type === 'custom') extra = App.group(T('Показывать серии', 'Show series'), (L.series || []).map(function (s) { return fld(esc(s.title) + ' <span class="tiny muted">' + kindName(s.kind) + '</span>', App.chk('s_' + s.id, f['s_' + s.id])); }).join('') || '<div class="tiny muted" style="padding:10px">' + T('Список пуст', 'List is empty') + '</div>');
    var note = f.type === 'income2' ? T('Второй доход — это строка в «Доходы и расходы». Блок только показывает её; если её ещё нет, добавь через «+».', 'A second income is a line in Income & expenses. The block only displays it; add it via “+” first if needed.') : T('Блок не хранит своих цифр — только показывает данные из плана.', 'A block stores no numbers of its own — it shows plan data.');
    return { title: T('Добавить блок', 'Add block'), html: '<div class="form">' + group('', x, note) + extra + '</div>' + errBox(m), done: 'blockSave', doneLabel: T('Добавить', 'Add') };
  };
  App.actions.blockSave = function () {
    var m = S.modal, f = m.f, refs = Object.keys(f).filter(function (k) { return k.indexOf('s_') === 0 && f[k]; }).map(function (k) { return k.slice(2); });
    if (f.type !== 'custom' && !f.ref) { m.err = T('Выберите источник', 'Pick a source'); App.renderModal(); return; }
    if (f.type === 'custom' && !f.title) { m.err = T('Введите название', 'Enter a title'); App.renderModal(); return; }
    App.closeModal();
    App.commit(T('Блок добавлен', 'Block added'), function (L) { C.addBlock(L, { type: f.type, title: f.title, ref: f.ref || null, refs: refs }); });
  };
})();
