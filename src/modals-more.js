/* Planned payments, income confirmation, accounts, reconciliation, import, review, editors */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, S = App.S, T = App.T, F = App.F, esc = App.esc;
  var fld = App.fld, inp = App.inp, sel = App.sel, chk = App.chk, group = App.group;
  function own(a) { return !C.isLiab(a); }
  function errBox(m) { return m.err ? '<div class="alert danger">' + I('alert') + '<div class="grow">' + esc(m.err) + '</div></div>' : ''; }

  /* ---------- pay a planned payment / family transfer (idempotent, partial allowed) ---------- */
  App.modals.payPlanned = function (m) {
    var p = C.byId(S.L.planned, m.id), st = C.plannedState(S.L, p, S.today), f = m.f;
    if (!m.inited) { m.inited = true; m.opKey = C.uid('pay'); f.amount = App.amtStr(st.remaining); f.date = S.today < p.date ? S.today : S.today; f.from = p.fromAccountId || ''; f.fee = ''; f.goalId = ''; if (p.interestPart) f.interest = App.amtStr(Math.round(st.remaining * p.interestPart / p.amount)); }
    var a = App.acc(p.accountId), h = '';
    h += '<div class="card"><div class="b">' + esc(p.title) + '</div><div class="small muted mt8">' + esc(App.fd(p.date, true)) + (p.dateConfirmed === false ? ' · ' + T('дата не подтверждена', 'date unconfirmed') : '') + (a ? ' · ' + esc(a.name) : '') + '</div>' +
      App.kv(T('По плану', 'Planned'), F(p.amount)) + App.kv(T('Уже оплачено', 'Already paid'), F(st.paid)) + App.kv(T('Остаток', 'Remaining'), F(st.remaining)) + '</div>';
    if (st.remaining <= 0) return { title: T('Оплата', 'Payment'), html: h + '<div class="alert ok">' + I('check') + '<div class="grow">' + T('Платёж уже полностью оплачен — повторная оплата не создаётся.', 'Already fully paid — no duplicate is created.') + '</div></div>' };
    var x = fld(T('Сумма платежа', 'Amount paid'), inp('amount', f.amount, { num: true, re: 1 })) + fld(T('Дата оплаты', 'Payment date'), inp('date', f.date, { type: 'date' })) + fld(T('Со счёта', 'From account'), sel('from', App.accOpts(own, f.from)));
    if (p.interestPart) x += fld(T('Из них проценты', 'of which interest'), inp('interest', f.interest, { num: true }));
    if (p.kind === 'family') x += fld(T('Комиссия перевода', 'Transfer fee'), inp('fee', f.fee, { num: true, ph: '0' })) + fld(T('В счёт цели «Квартира»', 'Count toward “Apartment”'), sel('goalId', App.opts([['', T('нет', 'no')]].concat((S.L.goals || []).filter(function (g) { return g.type === 'apartment'; }).map(function (g) { return [g.id, g.title]; })), f.goalId)));
    h += '<div class="form">' + group('', x, T('Меньшая сумма = частичный платёж (статус «Частично оплачено»). Ошибочную оплату можно отменить в записи — остатки восстановятся.', 'A smaller amount is a partial payment. A wrong payment can be voided from the record — balances are restored.')) + '</div>' + errBox(m);
    h += '<button class="btn block mt16" id="payBtn" data-a="payPlannedGo">' + I('check') + T('Подтвердить оплату', 'Confirm payment') + '</button>';
    return { title: T('Оплата', 'Payment'), html: h };
  };
  App.actions.payPlannedGo = function (el) {
    var m = S.modal, f = m.f, p = C.byId(S.L.planned, m.id); if (m.busy) return; m.busy = true; el.disabled = true;
    var amount = App.toMinor(f.amount);
    var o = { opKey: m.opKey, amount: amount, date: f.date, fromAccountId: f.from };
    if (p.interestPart && f.interest !== undefined) { var ip = App.toMinor(f.interest) || 0; o.principal = amount - ip; }
    if (p.kind === 'family') { o.fee = App.toMinor(f.fee) || 0; o.goalId = f.goalId || null; }
    var res = App.commit(T('Платёж подтверждён: ', 'Payment confirmed: ') + p.title, function (L) { return C.confirmPlanned(L, m.id, o); });
    if (res.ok === false) { m.busy = false; if (res.duplicate) { App.closeModal(); App.toast(T('Уже оплачено — дубль не создан', 'Already paid — no duplicate')); return; } m.err = App.errText(res.errors); App.renderModal(); return; }
    App.closeModal();
  };

  /* ---------- confirm actual income for a planned income (salary, tips, service charge, debt return…) ---------- */
  App.modals.confirmIncome = function (m) {
    var p = C.byId(S.L.planned, m.id), f = m.f;
    if (!m.inited) { m.inited = true; m.opKey = C.uid('inc'); var dr = p.debtReturnEstimate || 0; f.salary = App.amtStr(p.amount - dr); f.tips = ''; f.service = ''; f.debtReturn = dr ? App.amtStr(dr) : ''; f.extra = ''; f.other = ''; f.date = p.date <= S.today ? p.date : S.today; f.to = p.toAccountId; }
    if (p.confirmed) return { title: T('Поступление', 'Income'), html: '<div class="alert ok">' + I('check') + '<div class="grow">' + T('Уже подтверждено: ', 'Already confirmed: ') + esc(F(C.plannedState(S.L, p).paid)) + '</div></div><button class="btn block danger mt16" data-a="unconfirmIncome">' + T('Отменить подтверждение', 'Undo confirmation') + '</button>' };
    var keys = [['salary', T('Зарплата', 'Salary')], ['tips', T('Чаевые', 'Tips')], ['service', 'Service charge'], ['debtReturn', T('Возврат долга мне', 'Debt returned to me')], ['extra', T('Доп. заработок', 'Side income')], ['other', T('Прочее', 'Other')]];
    var total = keys.reduce(function (s, k) { return s + (App.toMinor(f[k[0]]) || 0); }, 0), diff = total - p.amount;
    var h = '<div class="card"><div class="b">' + esc(p.title) + '</div><div class="small muted">' + esc(App.fd(p.date, true)) + ' · ' + T('бюджетный месяц ', 'budget month ') + esc(App.fym(p.budgetMonth)) + '</div>' + App.kv(T('Ожидалось', 'Expected'), F(p.amount)) + (p.note ? '<div class="tiny muted mt8">' + esc(p.note) + '</div>' : '') + '</div>';
    h += '<div class="form">' + group(T('Фактически получено', 'Actually received'), keys.map(function (k) { return fld(k[1], inp(k[0], f[k[0]], { num: true, ph: '0', re: 1 })); }).join('') + fld(T('Дата поступления', 'Date received'), inp('date', f.date, { type: 'date' })) + fld(T('На счёт', 'To account'), sel('to', App.accOpts(own, f.to))), T('Возврат долга учитывается как возврат собственных средств, а не как зарплата. Суммы уже входят в план — не добавляйте их повторно.', 'Debt returned is a return of own funds, not salary. These amounts are already part of the plan — do not add them twice.')) + '</div>';
    h += '<div id="incTot" class="card">' + App.kv(T('Итого', 'Total'), F(total)) + App.kv(T('Отклонение от плана', 'Deviation from plan'), '<span class="' + (diff < 0 ? 'neg' : 'pos') + '">' + esc(App.FS(diff)) + ' (' + App.pct(p.amount ? diff / p.amount : null) + ')</span>', true) + '</div>' + errBox(m);
    h += '<button class="btn block mt16" data-a="confirmIncomeGo">' + I('check') + T('Подтвердить поступление', 'Confirm income') + '</button>';
    m.liveFn = function () { var tot = keys.reduce(function (s, k) { return s + (App.toMinor(S.modal.f[k[0]]) || 0); }, 0), d = tot - p.amount; var el = document.getElementById('incTot'); if (el) el.innerHTML = App.kv(T('Итого', 'Total'), F(tot)) + App.kv(T('Отклонение от плана', 'Deviation from plan'), '<span class="' + (d < 0 ? 'neg' : 'pos') + '">' + esc(App.FS(d)) + ' (' + App.pct(p.amount ? d / p.amount : null) + ')</span>', true); };
    return { title: T('Подтвердить поступление', 'Confirm income'), html: h };
  };
  App.actions.confirmIncomeGo = function (el) {
    var m = S.modal, f = m.f; if (m.busy) return; m.busy = true; el.disabled = true;
    var parts = {}; ['salary', 'tips', 'service', 'debtReturn', 'extra', 'other'].forEach(function (k) { var v = App.toMinor(f[k]); if (v > 0) parts[k] = v; });
    var res = App.commit(T('Поступление подтверждено', 'Income confirmed'), function (L) { return C.confirmPlanned(L, m.id, { opKey: m.opKey, parts: parts, date: f.date, toAccountId: f.to }); });
    if (res.ok === false) { m.busy = false; m.err = App.errText(res.errors); App.renderModal(); return; }
    App.closeModal();
  };
  App.actions.unconfirmIncome = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Подтверждение отменено', 'Confirmation undone'), function (L) { return C.unconfirmPlanned(L, id); }); };

  /* ---------- add / edit planned item (payment, income, family, recurring) ---------- */
  App.modals.editPlanned = function (m) {
    var L = S.L, p = m.id ? C.byId(L.planned, m.id) : null, f = m.f;
    if (!m.inited) {
      m.inited = true;
      if (p) Object.assign(f, { kind: p.kind, title: p.title, amount: App.amtStr(p.amount), date: p.date, dateConfirmed: p.dateConfirmed !== false, budgetMonth: p.budgetMonth, accountId: p.accountId || '', from: p.fromAccountId || '', to: p.toAccountId || '', interest: App.amtStr(p.interestPart), note: p.note || '', series: false, debtAmount: App.amtStr(p.debtAmount), category: p.categoryId || '' });
      else Object.assign(f, { kind: m.kind || 'payment', title: '', amount: '', date: S.today, dateConfirmed: true, budgetMonth: C.ymOf(S.today), accountId: m.acc || '', from: (L.accounts.filter(function (a) { return own(a) && !a.role; })[0] || {}).id || '', to: (L.accounts.filter(function (a) { return own(a) && !a.role; })[0] || {}).id || '', interest: '', note: '', repeat: false, count: '12', bmShift: m.kind === 'income' || m.kind === 'family' ? '1' : '0', category: 'misc' });
    }
    var kinds = [['payment', T('Платёж', 'Payment')], ['income', T('Доход', 'Income')], ['family', T('Родителям', 'Parents')]];
    var x = '';
    if (!p) x += fld(T('Вид', 'Kind'), sel('kind', App.opts(kinds, f.kind), { re: 1 }));
    x += fld(T('Название', 'Title'), inp('title', f.title, { ph: T('например, Аренда', 'e.g. Rent') }));
    x += fld(T('Сумма', 'Amount') + ' (AED)', inp('amount', f.amount, { num: true }));
    x += fld(T('Дата', 'Date'), inp('date', f.date, { type: 'date' }));
    x += fld(T('Дата подтверждена', 'Date confirmed'), chk('dateConfirmed', f.dateConfirmed));
    x += fld(T('Бюджетный месяц', 'Budget month'), inp('budgetMonth', f.budgetMonth, { type: 'month' }));
    if (f.kind === 'payment') {
      x += fld(T('Кредит / долг', 'Credit / loan'), sel('accountId', App.accOpts(C.isLiab, f.accountId, T('— обычный платёж —', '— regular bill —')), { re: 1 }));
      if (!f.accountId) x += fld(T('Категория', 'Category'), sel('category', App.catOpts('expense', f.category)));
      x += fld(T('Со счёта', 'From account'), sel('from', App.accOpts(own, f.from)));
      if (f.accountId) x += fld(T('Из них проценты', 'of which interest'), inp('interest', f.interest, { num: true, ph: T('если известно', 'if known') }));
    }
    if (f.kind === 'family') x += fld(T('Со счёта', 'From account'), sel('from', App.accOpts(own, f.from)));
    if (f.kind === 'income') x += fld(T('На счёт', 'To account'), sel('to', App.accOpts(own, f.to)));
    if (f.kind === 'borrow') x += fld(T('К погашению', 'Total to repay'), inp('debtAmount', f.debtAmount, { num: true }));
    x += fld(T('Комментарий', 'Note'), inp('note', f.note));
    var rep = '';
    if (!p) rep = fld(T('Повторять ежемесячно', 'Repeat monthly'), chk('repeat', f.repeat, { re: 1 })) + (f.repeat ? fld(T('Количество месяцев', 'Number of months'), inp('count', f.count, { num: true })) + fld(T('Сдвиг бюджетного месяца', 'Budget month shift'), sel('bmShift', App.opts([['0', T('тот же месяц', 'same month')], ['1', T('следующий месяц', 'next month')]], f.bmShift))) : '');
    else if (p.seriesId) rep = fld(T('Этот и все следующие месяцы', 'This and all following months'), chk('series', f.series)) + '<div class="note">' + T('Без галочки меняется только этот месяц. Серия — в «Доходы и расходы».', 'Unchecked: only this month changes. The series lives in Income & expenses.') + '</div>';
    var h = '<div class="form">' + group('', x + rep) + '</div>';
    if (p) {
      var st = C.plannedState(L, p, S.today);
      h += '<div class="card">' + App.kv(T('Статус', 'Status'), App.pTag(st.status), true) + App.kv(T('Оплачено/получено', 'Paid/received'), F(st.paid)) + (p.scenario ? '<div class="tiny muted mt8">' + T('Сценарий: не входит в фактические операции и базовый план, пока не подтверждён отдельно.', 'Scenario: not part of actual records or the base plan until separately confirmed.') + '</div>' : '') + (p.splitEstimated ? '<div class="tiny unconf mt8">' + T('Разделение на основной долг и проценты — расчётное', 'Principal/interest split is estimated') + '</div>' : '') + '</div>';
      if (st.txs.length) h += '<div class="sec-h"><span class="t small">' + T('Связанные операции', 'Linked records') + '</span></div><div class="list">' + st.txs.map(function (t) { return App.txRow(t); }).join('') + '</div>';
      h += '<div class="btns">';
      if ((p.kind === 'payment' || p.kind === 'family') && st.open) h += '<button class="btn" data-a="modal" data-m="payPlanned" data-id="' + p.id + '">' + T('Оплатить', 'Pay') + '</button>';
      if (p.kind === 'income' && !p.confirmed) h += '<button class="btn" data-a="modal" data-m="confirmIncome" data-id="' + p.id + '">' + T('Подтвердить', 'Confirm') + '</button>';
      if (p.kind === 'borrow' && !p.confirmed) h += '<button class="btn sec" data-a="modal" data-m="record" data-type="loan_receipt" data-from="' + p.accountId + '">' + T('Записать фактический заём', 'Record actual loan') + '</button>';
      if ((p.kind === 'income' || p.kind === 'borrow') && p.confirmed) h += '<button class="btn sec" data-a="unconfirmPlanned">' + T('Отменить подтверждение', 'Undo confirmation') + '</button>';
      h += '<button class="btn sec" data-a="skipPlanned">' + (p.status === 'skipped' ? T('Вернуть в план', 'Restore') : T('Пропустить', 'Skip')) + '</button></div>';
      if (!st.txs.length) h += '<div class="btns"><button class="btn danger" data-a="deletePlanned">' + I('trash') + T('Удалить из плана', 'Delete from plan') + '</button></div>';
    }
    h += errBox(m);
    return { title: p ? T('Плановая операция', 'Planned item') : T('Новая плановая операция', 'New planned item'), html: h, done: 'savePlanned', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.savePlanned = function () {
    var m = S.modal, f = m.f, amt = App.toMinor(f.amount);
    if (amt == null || amt < 0) { m.err = T('Введите сумму', 'Enter an amount'); App.renderModal(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) { m.err = T('Укажите дату', 'Set a date'); App.renderModal(); return; }
    var base = { title: f.title || (f.kind === 'income' ? T('Доход', 'Income') : f.kind === 'family' ? T('Перевод родителям', 'Transfer to parents') : T('Платёж', 'Payment')), amount: amt, date: f.date, dateConfirmed: !!f.dateConfirmed, budgetMonth: f.budgetMonth || C.ymOf(f.date), note: f.note || '' };
    if (f.kind === 'payment') { base.accountId = f.accountId || null; base.fromAccountId = f.from; base.categoryId = f.accountId ? null : f.category; var ip = App.toMinor(f.interest); base.interestPart = f.accountId && ip ? ip : null; base.principalPart = base.interestPart ? amt - ip : null; }
    if (f.kind === 'family') base.fromAccountId = f.from;
    if (f.kind === 'income') base.toAccountId = f.to;
    if (f.kind === 'borrow') base.debtAmount = App.toMinor(f.debtAmount) || amt;
    App.commit(m.id ? T('План изменён', 'Plan updated') : T('Добавлено в план', 'Added to plan'), function (L) {
      if (m.id) {
        var p = C.byId(L.planned, m.id), oldDay = p.date.slice(8, 10);
        Object.assign(p, base);
        var ser = p.seriesId && C.byId(L.series || [], p.seriesId);
        if (ser) { var oym = p.occYm || C.ymOf(p.date); C.setSeriesAmount(ser, oym, amt, f.series ? 'following' : 'only', false); if (f.series) { ser.title = base.title; ser.day = +f.date.slice(8, 10); } return; }
        if (f.series && p.seriesId) L.planned.forEach(function (q) { if (q.seriesId === p.seriesId && q.date > p.date && !C.plannedState(L, q).txs.length) { q.amount = amt; q.interestPart = base.interestPart ? Math.round(amt * base.interestPart / amt) : q.interestPart; var ym = q.date.slice(0, 7); q.date = ym + '-' + ('0' + Math.min(+f.date.slice(8, 10), C.daysInMonth(ym))).slice(-2); } });
        void oldDay;
      } else {
        var tpl = Object.assign({ kind: f.kind, currency: 'AED', scenario: null, confirmed: false }, base);
        if (f.repeat && C.newSeries) { var ns = C.newSeries({ kind: f.kind, title: base.title, amount: amt, freq: 'monthly', start: C.ymOf(f.date), count: Math.max(1, Math.min(120, parseInt(f.count, 10) || 1)), day: +f.date.slice(8, 10), budgetShift: +f.bmShift, accountId: base.accountId, fromAccountId: base.fromAccountId, toAccountId: base.toAccountId, categoryId: base.categoryId, note: base.note }); L.series = L.series || []; L.series.push(ns); }
        else if (f.repeat) C.makeSeries({ startDate: f.date, count: Math.max(1, Math.min(120, parseInt(f.count, 10) || 1)), budgetShift: +f.bmShift, template: tpl }).forEach(function (q) { q.dateConfirmed = base.dateConfirmed; L.planned.push(q); });
        else L.planned.push(Object.assign({ id: C.uid('pl') }, tpl));
      }
    });
    App.closeModal();
  };
  App.actions.skipPlanned = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Статус плана изменён', 'Plan status changed'), function (L) { var p = C.byId(L.planned, id); p.status = p.status === 'skipped' ? null : 'skipped'; }); };
  App.actions.deletePlanned = function () { var id = S.modal.id; App.confirm(T('Удалить из плана?', 'Delete from plan?'), T('Плановая операция будет удалена.', 'The planned item will be removed.'), function () { App.commit(T('Удалено из плана', 'Removed from plan'), function (L) { var dp = C.byId(L.planned, id), ds = dp && dp.seriesId && C.byId(L.series || [], dp.seriesId); if (ds) { ds.removed = ds.removed || {}; ds.removed[dp.occYm || C.ymOf(dp.date)] = 1; } L.planned = L.planned.filter(function (p) { return p.id !== id; }); }); }, true, T('Удалить', 'Delete')); };
  App.actions.unconfirmPlanned = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Подтверждение отменено', 'Confirmation undone'), function (L) { return C.unconfirmPlanned(L, id); }); };

  /* ---------- reconcile with a bank statement ---------- */
  App.modals.reconcile = function (m) {
    var a = App.acc(m.id), bal = C.balances(S.L)[a.id], f = m.f, liab = C.isLiab(a);
    if (!m.inited) { m.inited = true; f.stmt = App.amtStr(bal); f.date = S.today; }
    var stmt = App.toMinor(f.stmt), diff = stmt == null ? 0 : stmt - bal;
    var h = '<div class="card">' + App.kv(liab ? T('Долг в приложении', 'Debt in app') : T('Баланс в приложении', 'Balance in app'), F(bal, a.currency)) + '</div>';
    h += '<div class="form">' + group(T('Банковская выписка', 'Bank statement'), fld(liab ? T('Долг по выписке', 'Debt per statement') : T('Баланс по выписке', 'Balance per statement'), inp('stmt', f.stmt, { num: true, re: 1 })) + fld(T('Дата выписки', 'Statement date'), inp('date', f.date, { type: 'date' }))) + '</div>';
    h += '<div class="card" id="recDiff">' + App.kv(T('Расхождение', 'Difference'), '<span class="' + (diff ? 'neg' : 'pos') + '">' + esc(F(diff, a.currency, { plus: true })) + '</span>', true) + '</div>';
    h += '<div class="tiny muted mt8">' + T('Если есть расхождение, будет создана операция «Корректировка баланса» (не доход и не расход). Остаток будет отмечен как подтверждённый.', 'If there is a difference, a “Balance adjustment” record is created (neither income nor expense). The balance is marked as confirmed.') + '</div>';
    h += '<button class="btn block mt16" data-a="reconcileGo">' + I('check') + (diff ? T('Создать корректировку и подтвердить', 'Adjust and confirm') : T('Подтвердить остаток', 'Confirm balance')) + '</button>';
    m.liveFn = function () { var s = App.toMinor(S.modal.f.stmt), d = s == null ? 0 : s - bal; var el = document.getElementById('recDiff'); if (el) el.innerHTML = App.kv(T('Расхождение', 'Difference'), '<span class="' + (d ? 'neg' : 'pos') + '">' + esc(F(d, a.currency, { plus: true })) + '</span>', true); };
    return { title: T('Сверка: ', 'Reconcile: ') + a.name, html: h };
  };
  App.actions.reconcileGo = function () {
    var m = S.modal, a = App.acc(m.id), bal = C.balances(S.L)[a.id], stmt = App.toMinor(m.f.stmt);
    if (stmt == null) return;
    var diff = stmt - bal;
    App.commit(T('Сверка выполнена', 'Reconciled'), function (L) {
      var acc = C.byId(L.accounts, a.id);
      if (diff) { var r = C.addTx(L, { type: 'adjustment', amount: diff, fromAccountId: a.id, date: (m.f.date || S.today) + 'T23:59', note: T('Сверка с выпиской', 'Statement reconciliation') }); if (!r.ok) return r; }
      acc.reconciledAt = (m.f.date || S.today) + 'T23:59'; acc.reconciledBalance = stmt; acc.balanceConfirmed = true;
    });
    App.closeModal();
  };

  /* ---------- account create / edit (Wallet "New account" logic) ---------- */
  var COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#64D2FF', '#FFD60A', '#FF375F', '#5E5CE6', '#0E7C66', '#E5484D', '#2EC4B6', '#3BFFC1', '#8E8E93', '#AC8E68', '#1C1C1E'];
  var ICONS = ['bank', 'cash', 'card', 'piggy', 'shield', 'loan', 'invest', 'wallet', 'calendar', 'bolt', 'home', 'briefcase', 'globe', 'target'];
  App.modals.account = function (m) {
    var a = m.id ? App.acc(m.id) : null, f = m.f;
    if (!m.inited) {
      m.inited = true;
      if (a) { Object.assign(f, { name: a.name, type: a.type, currency: a.currency, initial: App.amtStr(a.initialBalance), color: a.color, icon: a.icon, note: a.note, role: a.role || '', term: a.term || 'short', institution: a.institution || '', balanceConfirmed: a.balanceConfirmed !== false }); if (a.credit) Object.keys(a.credit).forEach(function (k) { f['c_' + k] = a.credit[k]; }); if (a.loan) Object.keys(a.loan).forEach(function (k) { f['l_' + k] = a.loan[k]; }); ['c_limit', 'c_statementBalance', 'c_minPayment', 'l_monthlyPayment'].forEach(function (k) { if (f[k] != null) f[k] = App.amtStr(f[k]); }); }
      else Object.assign(f, { name: '', type: m.type || 'checking', currency: 'AED', initial: '', color: '#0A84FF', icon: 'bank', note: '', role: '', term: 'short', institution: '', balanceConfirmed: true });
    }
    var h = '';
    if (!a) h += '<div class="acc-grid" style="margin-bottom:12px">' + C.ACCOUNT_TYPES.map(function (t) { var ic = { cash: 'cash', checking: 'bank', credit_card: 'card', savings: 'piggy', investment: 'invest', loan: 'loan', other: 'wallet' }[t]; return '<button class="acc-tile" style="background:' + (f.type === t ? 'var(--accent)' : 'var(--card2)') + ';color:' + (f.type === t ? '#fff' : 'var(--text)') + ';min-height:56px" data-a="accType" data-t="' + t + '"><div class="n">' + I(ic, 'sm') + '<span>' + esc(App.ACC_TYPES()[t]) + '</span></div></button>'; }).join('') + '</div>';
    var liab = f.type === 'credit_card' || f.type === 'loan';
    var x = fld(T('Название', 'Name'), inp('name', f.name, { ph: T('например, Основная карта', 'e.g. Main card') })) + (a ? fld(T('Тип', 'Type'), sel('type', App.opts(C.ACCOUNT_TYPES.map(function (t) { return [t, App.ACC_TYPES()[t]]; }), f.type), { re: 1 })) : '') +
      fld(T('Валюта', 'Currency'), sel('currency', App.opts(C.CURRENCIES.concat(Object.keys(S.L.rates).filter(function (c) { return C.CURRENCIES.indexOf(c) < 0; })).map(function (c) { return [c, c]; }), f.currency))) +
      fld(liab ? T('Начальный долг', 'Opening debt') : T('Начальный баланс', 'Opening balance'), inp('initial', f.initial, { num: true, ph: '0' })) +
      fld(T('Банк / организация', 'Institution'), inp('institution', f.institution)) +
      fld(T('Остаток подтверждён', 'Balance confirmed'), chk('balanceConfirmed', f.balanceConfirmed));
    if (a) x += fld(liab ? T('Текущий долг', 'Current debt') : T('Текущий баланс', 'Current balance'), '<span class="num">' + esc(F(C.balances(S.L)[a.id], a.currency)) + '</span>');
    if (f.type === 'savings' || f.type === 'other' || f.type === 'cash' || f.type === 'checking') x += fld(T('Назначение', 'Role'), sel('role', App.opts([['', T('свободные деньги', 'spendable')], ['reserve', T('резерв', 'reserve')], ['savings', T('накопления', 'savings')]], f.role)));
    if (liab) x += fld(T('Срок', 'Term'), sel('term', App.opts([['short', T('краткосрочный', 'short-term')], ['long', T('долгосрочный', 'long-term')]], f.term)));
    var c = '';
    if (f.type === 'credit_card') c = group(T('Кредитная карта', 'Credit card'), fld(T('Кредитный лимит', 'Credit limit'), inp('c_limit', f.c_limit, { num: true })) + fld(T('Сумма выписки', 'Statement balance'), inp('c_statementBalance', f.c_statementBalance, { num: true })) + fld(T('Минимальный платёж', 'Minimum payment'), inp('c_minPayment', f.c_minPayment, { num: true })) + fld(T('Дата платежа', 'Due date'), inp('c_dueDate', f.c_dueDate, { type: 'date' })) + fld(T('Дата платежа подтверждена', 'Due date confirmed'), chk('c_dueDateConfirmed', f.c_dueDateConfirmed !== false)) + fld(T('Дата выписки', 'Statement date'), inp('c_statementDate', f.c_statementDate, { type: 'date' })) + fld(T('Расчётный период', 'Billing cycle'), inp('c_billingCycle', f.c_billingCycle, { ph: T('напр. 5–4 число', 'e.g. 5th–4th') })) + fld(T('Ставка, % годовых', 'APR, %'), inp('c_apr', f.c_apr, { num: true, ph: T('не подтверждена', 'unconfirmed') })) + fld(T('Ставка подтверждена', 'Rate confirmed'), chk('c_aprConfirmed', f.c_aprConfirmed)) + fld(T('Комиссии', 'Fees'), inp('c_fees', f.c_fees)) + fld(T('Комиссии подтверждены', 'Fees confirmed'), chk('c_feesConfirmed', f.c_feesConfirmed)), T('Неизвестные ставки и даты не заменяются нулём — они помечаются как неподтверждённые.', 'Unknown rates and dates are never assumed to be zero — they are marked unconfirmed.'));
    if (f.type === 'loan') c = group(T('Кредит', 'Loan'), fld(T('Ежемесячный платёж', 'Monthly payment'), inp('l_monthlyPayment', f.l_monthlyPayment, { num: true })) + fld(T('Плановое завершение', 'Planned end'), inp('l_endDate', f.l_endDate, { type: 'month' })) + fld(T('День списания', 'Payment day'), inp('l_paymentDay', f.l_paymentDay, { num: true })) + fld(T('День подтверждён', 'Day confirmed'), chk('l_paymentDayConfirmed', f.l_paymentDayConfirmed)) + fld(T('Ставка, % годовых', 'APR, %'), inp('l_apr', f.l_apr, { num: true, ph: T('не подтверждена', 'unconfirmed') })) + fld(T('Ставка подтверждена', 'Rate confirmed'), chk('l_aprConfirmed', f.l_aprConfirmed)) + fld(T('Комиссии', 'Fees'), inp('l_fees', f.l_fees)));
    h += '<div class="form">' + group('', x) + c + group(T('Вид', 'Look'), '<div class="fld col"><label>' + T('Цвет', 'Color') + '</label><div class="chips">' + COLORS.map(function (col) { return '<button data-a="accColor" data-c="' + col + '" style="width:30px;height:30px;border-radius:50%;background:' + col + ';outline:' + (f.color === col ? '3px solid var(--text)' : '0') + ';outline-offset:2px"></button>'; }).join('') + '</div></div><div class="fld col"><label>' + T('Иконка', 'Icon') + '</label><div class="chips">' + ICONS.map(function (ic) { return '<button class="chip' + (f.icon === ic ? ' on' : '') + '" data-a="accIcon" data-i="' + ic + '">' + I(ic, 'sm') + '</button>'; }).join('') + '</div></div>' + fld(T('Комментарий', 'Note'), inp('note', f.note), { col: 1 })) + '</div>';
    if (a) {
      var used = S.L.transactions.some(function (t) { return t.fromAccountId === a.id || t.toAccountId === a.id; }) || S.L.planned.some(function (p) { return p.accountId === a.id || p.fromAccountId === a.id || p.toAccountId === a.id; });
      h += '<div class="btns"><button class="btn sec" data-a="accArchive">' + (a.archived ? T('Вернуть из архива', 'Unarchive') : T('В архив', 'Archive')) + '</button><button class="btn sec" data-a="accClose">' + (a.closed ? T('Открыть снова', 'Reopen') : C.isLiab(a) ? T('Закрыть кредитную линию', 'Close credit line') : T('Закрыть счёт', 'Close account')) + '</button></div>';
      if (!used) h += '<div class="btns"><button class="btn danger" data-a="accDelete">' + I('trash') + T('Удалить счёт', 'Delete account') + '</button></div>';
      else h += '<div class="tiny muted mt8">' + T('Счёт с операциями нельзя удалить — его можно архивировать или закрыть. Полное погашение не закрывает кредитную линию автоматически.', 'An account with records cannot be deleted — archive or close it. Full repayment does not close a credit line automatically.') + '</div>';
    }
    h += errBox(m);
    return { title: a ? T('Настройки счёта', 'Account settings') : T('Новый счёт', 'New account'), html: h, done: 'saveAccount', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.accType = function (el) { S.modal.f.type = el.dataset.t; var ic = { cash: 'cash', checking: 'bank', credit_card: 'card', savings: 'piggy', investment: 'invest', loan: 'loan', other: 'wallet' }[el.dataset.t]; S.modal.f.icon = ic; App.renderModal(); };
  App.actions.accColor = function (el) { S.modal.f.color = el.dataset.c; App.renderModal(); };
  App.actions.accIcon = function (el) { S.modal.f.icon = el.dataset.i; App.renderModal(); };
  App.actions.saveAccount = function () {
    var m = S.modal, f = m.f;
    if (!f.name) { m.err = T('Введите название', 'Enter a name'); App.renderModal(); return; }
    var init = App.toMinor(f.initial || '0'); if (init == null) { m.err = T('Неверная сумма', 'Invalid amount'); App.renderModal(); return; }
    var num = function (k) { var v = App.toMinor(f[k]); return v == null || f[k] === '' || f[k] == null ? null : v; };
    var fl = function (k) { return f[k] === '' || f[k] == null ? null : parseFloat(String(f[k]).replace(',', '.')); };
    var o = { name: f.name, type: f.type, currency: f.currency, initialBalance: init, color: f.color, icon: f.icon, note: f.note || '', role: f.role || null, institution: f.institution || '', balanceConfirmed: !!f.balanceConfirmed };
    if (f.type === 'credit_card' || f.type === 'loan') { o.term = f.term || 'short'; o.role = null; }
    if (f.type === 'credit_card') o.credit = { limit: num('c_limit') || 0, statementBalance: num('c_statementBalance'), minPayment: num('c_minPayment'), dueDate: f.c_dueDate || null, dueDateConfirmed: f.c_dueDateConfirmed !== false, statementDate: f.c_statementDate || null, billingCycle: f.c_billingCycle || '', apr: fl('c_apr'), aprConfirmed: !!f.c_aprConfirmed, fees: f.c_fees || '', feesConfirmed: !!f.c_feesConfirmed };
    if (f.type === 'loan') { var prev = m.id ? (App.acc(m.id).loan || {}) : {}; o.loan = Object.assign({}, prev, { monthlyPayment: num('l_monthlyPayment'), endDate: f.l_endDate || null, paymentDay: f.l_paymentDay || null, paymentDayConfirmed: !!f.l_paymentDayConfirmed, apr: fl('l_apr'), aprConfirmed: !!f.l_aprConfirmed, fees: f.l_fees || '', principal: prev.principal != null ? prev.principal : init }); }
    App.commit(m.id ? T('Счёт изменён', 'Account updated') : T('Счёт создан', 'Account created'), function (L) {
      if (m.id) { var a = C.byId(L.accounts, m.id); Object.assign(a, o); if (o.type !== 'credit_card') delete a.credit; if (o.type !== 'loan') delete a.loan; }
      else L.accounts.push(C.makeAccount(Object.assign(o, { openedAt: S.today })));
    });
    App.closeModal();
  };
  App.actions.accArchive = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Архив обновлён', 'Archive updated'), function (L) { var a = C.byId(L.accounts, id); a.archived = !a.archived; }); };
  App.actions.accClose = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Статус счёта изменён', 'Account status changed'), function (L) { var a = C.byId(L.accounts, id); a.closed = !a.closed; a.closedAt = a.closed ? new Date().toISOString() : null; }); };
  App.actions.accDelete = function () { var id = S.modal.id; App.confirm(T('Удалить счёт?', 'Delete account?'), T('Счёт без операций будет удалён.', 'The account (no records) will be deleted.'), function () { App.commit(T('Счёт удалён', 'Account deleted'), function (L) { L.accounts = L.accounts.filter(function (a) { return a.id !== id; }); }); App.setTab('home'); }, true, T('Удалить', 'Delete')); };
})();
