/* Record (transaction) form — Wallet-like: type segments, big amount, keypad, account/category */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, S = App.S, T = App.T, F = App.F, esc = App.esc;
  var MODE_OF = { expense: 'expense', card_purchase: 'expense', salary: 'income', income: 'income', debt_return: 'income', transfer: 'transfer', reserve_topup: 'transfer', savings_topup: 'transfer', repayment: 'transfer', loan_receipt: 'transfer', interest: 'other', fee: 'other', family: 'other', adjustment: 'other' };
  function defOwn() { var a = S.L.accounts.filter(function (x) { return !C.isLiab(x) && !x.closed && !x.archived && !x.role; })[0] || S.L.accounts.filter(function (x) { return !C.isLiab(x); })[0]; return a ? a.id : ''; }
  function initState(m) {
    var f = m.f, now = C.nowISO();
    if (m.id) {
      var t = C.byId(S.L.transactions, m.id);
      Object.assign(f, { type: t.type, mode: MODE_OF[t.type], typeLocked: true, amount: App.amtStr(Math.abs(t.amount)), from: t.fromAccountId || '', to: t.toAccountId || '', cat: t.categoryId || '', date: t.date.slice(0, 10), time: t.date.slice(11, 16) || '12:00', note: t.note || '', tags: (t.tags || []).join(', '), budgetMonth: t.budgetMonth || '', interest: '', feePart: '', fee: App.amtStr(t.fee), toAmount: App.amtStr(t.toAmount), contract: App.amtStr(t.contractAmount), withheld: App.amtStr(t.withheldFee), added: App.amtStr(t.addedCharges), projectId: t.projectId || '', projectFlow: t.projectFlow || 'expense', goalId: t.goalId || '', recAmt: App.amtStr(t.recipientAmount), recCur: t.recipientCurrency || '', adjNeg: t.type === 'adjustment' && t.amount < 0, impulse: (t.tags || []).indexOf('impulse') >= 0 });
      if (t.type === 'repayment') { f.interest = App.amtStr(t.interestPart != null ? t.interestPart : (t.amount - (t.principal != null ? t.principal : t.amount))); f.feePart = App.amtStr(t.feePart || 0); if (t.interestPart != null) f.interest = App.amtStr(t.interestPart); }
      if (t.type === 'loan_receipt' && t.addedCharges == null && t.debtAmount != null) f.added = App.amtStr(t.debtAmount - t.amount);
      m.tx = t;
    } else {
      var type = m.type || 'expense';
      Object.assign(f, { type: type, mode: MODE_OF[type] || 'expense', typeLocked: MODE_OF[type] === 'other' || !!m.type, amount: '', from: m.from || defOwn(), to: m.to || '', cat: m.cat || '', date: now.slice(0, 10), time: now.slice(11, 16), note: '', tags: '', budgetMonth: '', interest: '', feePart: '', fee: '', toAmount: '', contract: '', withheld: '', added: '', projectId: m.project || '', projectFlow: m.flow || 'expense', goalId: '', recAmt: '', recCur: '', adjNeg: false, impulse: false });
      if (['income', 'salary', 'debt_return'].indexOf(type) >= 0) { f.to = m.to || defOwn(); f.cat = f.cat || (type === 'debt_return' ? 'debt_return' : type === 'salary' ? 'salary' : 'other_income'); }
      if (type === 'expense' || type === 'card_purchase') f.cat = f.cat || 'misc';
      if (type === 'repayment') { f.from = defOwn(); f.to = m.to || ''; }
      if (type === 'loan_receipt') { f.from = m.from || ''; f.to = defOwn(); }
      if (type === 'transfer') f.to = m.to || '';
      m.opKey = C.uid('op');
    }
    m.inited = true;
  }
  function derive(f) {
    var from = App.acc(f.from), to = App.acc(f.to);
    if (f.typeLocked && MODE_OF[f.type] === f.mode) return f.type;
    if (f.mode === 'expense') return f.cat === 'family' ? 'family' : from && from.type === 'credit_card' ? 'card_purchase' : 'expense';
    if (f.mode === 'income') return f.cat === 'salary' ? 'salary' : f.cat === 'debt_return' ? 'debt_return' : 'income';
    if (f.mode === 'transfer') { if (to && C.isLiab(to)) return 'repayment'; if (from && C.isLiab(from)) return 'loan_receipt'; if (to && to.role === 'reserve') return 'reserve_topup'; if (to && to.role === 'savings') return 'savings_topup'; return 'transfer'; }
    return f.type && MODE_OF[f.type] === 'other' ? f.type : 'interest';
  }
  App.modals.record = function (m) {
    if (!m.inited) initState(m);
    var f = m.f; f.type = derive(f);
    var L = S.L, type = f.type, cls = { expense: 'expense', income: 'income', transfer: 'transfer', other: 'other' }[f.mode];
    var fromAcc = App.acc(f.from), toAcc = App.acc(f.to);
    var cur = (['salary', 'income', 'debt_return'].indexOf(type) >= 0 ? toAcc : fromAcc || toAcc || {}).currency || 'AED';
    var sign = { expense: '−', income: '+', transfer: '', other: '' }[f.mode];
    if (type === 'adjustment') sign = f.adjNeg ? '−' : '+';
    var segs = [['expense', T('Расход', 'Expense')], ['income', T('Доход', 'Income')], ['transfer', T('Перевод', 'Transfer')], ['other', T('Ещё', 'More')]];
    var h = '<div class="rec-top ' + cls + '"><div class="split" style="margin-bottom:12px"><button data-a="closeModal" style="color:#fff">' + I('close') + '</button><span class="b">' + esc(m.id ? T('Редактировать запись', 'Edit record') : T('Новая запись', 'New record')) + '</span><button data-a="saveRecord" id="saveRec" style="color:#fff">' + I('check') + '</button></div>' +
      '<div class="seg">' + segs.map(function (s) { return '<button class="' + (f.mode === s[0] ? 'on' : '') + '" data-a="recMode" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (f.mode === 'other') h += '<div class="chips" style="margin-top:10px">' + [['interest', T('Проценты', 'Interest')], ['fee', T('Комиссия', 'Fee')], ['family', T('Родителям', 'Parents')], ['adjustment', T('Корректировка', 'Adjustment')]].map(function (o) { return '<button class="chip' + (type === o[0] ? ' on' : '') + '" style="' + (type === o[0] ? '' : 'background:rgba(0,0,0,.22);color:#fff') + '" data-a="recType" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="small" style="opacity:.9;margin-top:10px">' + esc(App.TX_TYPES()[type]) + (type === 'loan_receipt' ? ' · ' + T('не является доходом', 'not income') : '') + (type === 'repayment' ? ' · ' + T('не потребительский расход', 'not consumer spending') : '') + (type === 'card_purchase' ? ' · ' + T('расход сейчас, долг растёт', 'expense now, debt grows') : '') + '</div>';
    h += '<div class="rec-amount">' + (type === 'adjustment' ? '<button class="sign" data-a="recAdjSign" style="color:#fff">' + sign + '</button>' : '<span class="sign">' + sign + '</span>') + '<span class="val num" id="recAmt">' + esc(f.amount || '0') + '</span><span class="cur">' + esc(cur) + '</span></div>';
    // account / category selectors
    var own = function (a) { return !C.isLiab(a); }, liab = function (a) { return C.isLiab(a); };
    var sel = function (label, field, opts) { return '<label>' + label + '<select data-f="' + field + '" data-re="1">' + opts + '</select></label>'; };
    var row = '';
    if (f.mode === 'expense') row = sel(T('Счёт / карта', 'Account / card'), 'from', App.accOpts(null, f.from)) + sel(T('Категория', 'Category'), 'cat', App.catOpts('expense', f.cat));
    else if (f.mode === 'income') row = sel(T('На счёт', 'To account'), 'to', App.accOpts(own, f.to)) + sel(T('Категория', 'Category'), 'cat', App.catOpts('income', f.cat));
    else if (f.mode === 'transfer') row = sel(T('Откуда', 'From'), 'from', App.accOpts(null, f.from, T('— выберите —', '— choose —'))) + sel(T('Куда', 'To'), 'to', App.accOpts(function (a) { return a.id !== f.from; }, f.to, T('— выберите —', '— choose —')));
    else if (type === 'family') row = sel(T('Со счёта', 'From'), 'from', App.accOpts(null, f.from)) + sel(T('Цель', 'Goal'), 'goalId', App.opts([['', T('без привязки', 'none')]].concat((L.goals || []).filter(function (g) { return g.type === 'apartment'; }).map(function (g) { return [g.id, g.title]; })), f.goalId));
    else row = sel(T('Счёт', 'Account'), 'from', App.accOpts(null, f.from, T('— выберите —', '— choose —'))) + '<label>' + T('Тип', 'Type') + '<select disabled><option>' + esc(App.TX_TYPES()[type]) + '</option></select></label>';
    h += '<div class="rec-sel">' + row + '</div></div>';
    h += '<div class="sheet-b" style="padding-top:0">';
    h += '<div class="keypad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map(function (k) { return '<button data-a="recKey" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div>';
    // details
    var d = '';
    d += App.fld(T('Дата', 'Date'), App.inp('date', f.date, { type: 'date' })) + App.fld(T('Время', 'Time'), App.inp('time', f.time, { type: 'time' }));
    d += App.fld(T('Заметка', 'Note'), App.inp('note', f.note, { ph: T('необязательно', 'optional') }));
    d += App.fld(T('Теги', 'Tags'), App.inp('tags', f.tags, { ph: T('через запятую', 'comma separated') }));
    var bmDef = C.budgetMonthFor({ type: type, date: f.date || S.today });
    d += App.fld(T('Бюджетный месяц', 'Budget month'), App.inp('budgetMonth', f.budgetMonth || bmDef, { type: 'month' }));
    var x = '';
    if (type === 'expense' || type === 'card_purchase') x += App.fld(T('Импульсивная покупка', 'Impulse purchase'), App.chk('impulse', f.impulse));
    if (type === 'repayment') {
      x += App.fld(T('Из них проценты', 'of which interest'), App.inp('interest', f.interest, { num: true, ph: '0' })) + App.fld(T('Из них комиссии', 'of which fees'), App.inp('feePart', f.feePart, { num: true, ph: '0' }));
      var A = App.toMinor(f.amount) || 0, pr = A - (App.toMinor(f.interest) || 0) - (App.toMinor(f.feePart) || 0);
      x += App.fld(T('Основной долг', 'Principal'), '<span class="num">' + esc(F(pr, cur)) + '</span>');
    }
    if (type === 'loan_receipt') {
      x += App.fld(T('Договорная сумма займа', 'Contract amount'), App.inp('contract', f.contract, { num: true, ph: T('= полученной', '= received') }));
      x += App.fld(T('Удержанная комиссия', 'Fee withheld'), App.inp('withheld', f.withheld, { num: true, ph: '0' }));
      x += App.fld(T('Проценты/комиссии сверху', 'Interest/fees added'), App.inp('added', f.added, { num: true, ph: '0' }));
      var rec = App.toMinor(f.amount) || 0, ctr = App.toMinor(f.contract) || rec, tot = ctr + (App.toMinor(f.added) || 0);
      x += App.fld(T('Итог к погашению', 'Total to repay'), '<span class="num neg">' + esc(F(tot, cur)) + '</span>');
    }
    if (['transfer', 'reserve_topup', 'savings_topup', 'family'].indexOf(type) >= 0) x += App.fld(T('Комиссия перевода', 'Transfer fee'), App.inp('fee', f.fee, { num: true, ph: '0' }));
    if (['transfer', 'reserve_topup', 'savings_topup'].indexOf(type) >= 0 && fromAcc && toAcc && fromAcc.currency !== toAcc.currency) x += App.fld(T('Зачислено', 'Received') + ' (' + toAcc.currency + ')', App.inp('toAmount', f.toAmount, { num: true, ph: T('по курсу', 'by rate') }));
    if (type === 'family') x += App.fld(T('Получено родителями', 'Received by parents'), App.inp('recAmt', f.recAmt, { num: true, ph: T('сумма', 'amount') })) + App.fld(T('Валюта получения', 'Received currency'), App.sel('recCur', App.opts([['', '—']].concat(C.CURRENCIES.map(function (c) { return [c, c]; })), f.recCur)));
    if ((L.projects || []).length && ['expense', 'card_purchase', 'income'].indexOf(type) >= 0) x += App.fld(T('Проект', 'Project'), App.sel('projectId', App.opts([['', '—']].concat(L.projects.map(function (p) { return [p.id, p.name]; })), f.projectId), { re: 1 })) + (f.projectId ? App.fld(T('Вид', 'Kind'), App.sel('projectFlow', App.opts([['expense', T('Расход проекта', 'Project expense')], ['investment', T('Вложение', 'Investment')]], f.projectFlow))) : '');
    h += '<div class="form">' + App.group(T('Подробности', 'Details'), d + x) + '</div>';
    if (m.tx && m.tx.plannedId) h += '<div class="dashed-note">' + T('Связано с плановым платежом: ', 'Linked to planned item: ') + esc((C.byId(L.planned, m.tx.plannedId) || {}).title || m.tx.plannedId) + '</div>';
    if (m.err) h += '<div class="alert danger">' + I('alert') + '<div class="grow">' + esc(m.err) + '</div></div>';
    h += '<button class="btn block mt16" data-a="saveRecord">' + I('check') + T('Сохранить', 'Save') + '</button>';
    if (m.id) {
      var t = m.tx;
      h += '<div class="btns">' + (t.status === 'void' ? '<button class="btn sec" data-a="txRestore">' + I('undo') + T('Восстановить', 'Restore') + '</button>' : '<button class="btn sec" data-a="txVoid">' + I('undo') + T('Отменить операцию', 'Void record') + '</button>') + '<button class="btn sec" data-a="txDup">' + I('repeat') + T('Дублировать', 'Duplicate') + '</button></div><div class="btns"><button class="btn danger" data-a="txDelete">' + I('trash') + T('Удалить навсегда', 'Delete permanently') + '</button></div>';
      h += '<div class="tiny muted mt8">ID: ' + esc(t.id) + ' · ' + T('статус: ', 'status: ') + esc(t.status) + (t.updatedAt ? ' · ' + T('изменено ', 'edited ') + esc(t.updatedAt.slice(0, 16).replace('T', ' ')) : '') + '</div>';
    }
    h += '</div>';
    return { raw: true, html: h };
  };
  App.actions.recMode = function (el) { var f = S.modal.f; f.mode = el.dataset.v; f.typeLocked = false; if (f.mode === 'income') { if (!f.to || C.isLiab(App.acc(f.to))) f.to = defOwn(); if (!f.cat || (App.cat(f.cat) || {}).kind !== 'income') f.cat = 'salary'; } if (f.mode === 'expense' && (!f.cat || (App.cat(f.cat) || {}).kind !== 'expense')) f.cat = 'misc'; if (f.mode === 'other') { f.type = 'interest'; f.typeLocked = true; } App.renderModal(); };
  App.actions.recType = function (el) { var f = S.modal.f; f.type = el.dataset.v; f.typeLocked = true; if (f.type === 'family' && (!f.from || C.isLiab(App.acc(f.from)))) f.from = defOwn(); App.renderModal(); };
  App.actions.recAdjSign = function () { S.modal.f.adjNeg = !S.modal.f.adjNeg; App.renderModal(); };
  function key(k) {
    var f = S.modal.f, s = f.amount || '';
    if (k === '⌫') s = s.slice(0, -1);
    else if (k === ',' || k === '.') { if (s.indexOf(',') < 0) s = (s || '0') + ','; }
    else { if (/,\d\d$/.test(s)) return; if (s === '0') s = ''; if (s.replace(',', '').length < 10) s += k; }
    f.amount = s;
    var el = document.getElementById('recAmt'); if (el) el.textContent = s || '0';
    if (['repayment', 'loan_receipt'].indexOf(f.type) >= 0) App.renderModal();
  }
  App.actions.recKey = function (el) { key(el.dataset.k); };
  App.recordKey = function (e) { if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === ',' || e.key === '.') key(','); else if (e.key === 'Backspace') key('⌫'); else if (e.key === 'Enter') App.actions.saveRecord(); else return; e.preventDefault(); };
  App.modals.record.build = function (m) {
    var f = m.f, type = derive(f), amt = App.toMinor((f.amount || '').replace(',', '.'));
    if (!amt || amt <= 0) return { err: T('Введите сумму больше нуля', 'Enter an amount greater than zero') };
    var tags = (f.tags || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (f.impulse && tags.indexOf('impulse') < 0) tags.push('impulse');
    if (!f.impulse) tags = tags.filter(function (t) { return t !== 'impulse'; });
    var tx = { type: type, amount: amt, date: (f.date || S.today) + 'T' + (f.time || '12:00'), note: f.note || '', tags: tags, budgetMonth: f.budgetMonth || C.budgetMonthFor({ type: type, date: f.date || S.today }) };
    var inc = ['salary', 'income', 'debt_return'].indexOf(type) >= 0;
    tx.fromAccountId = inc ? null : f.from || null;
    tx.toAccountId = ['transfer', 'reserve_topup', 'savings_topup', 'repayment', 'loan_receipt'].indexOf(type) >= 0 || inc ? f.to || null : null;
    if (['expense', 'card_purchase', 'salary', 'income', 'debt_return'].indexOf(type) >= 0) tx.categoryId = f.cat || null;
    if (type === 'family') { tx.categoryId = 'family'; tx.fee = App.toMinor(f.fee) || 0; tx.goalId = f.goalId || null; tx.recipientAmount = App.toMinor(f.recAmt) || null; tx.recipientCurrency = f.recCur || null; }
    if (['transfer', 'reserve_topup', 'savings_topup'].indexOf(type) >= 0) {
      tx.fee = App.toMinor(f.fee) || 0;
      var fa = App.acc(f.from), ta = App.acc(f.to);
      if (fa && ta && fa.currency !== ta.currency) { var conv = App.toMinor(f.toAmount); if (!conv) { var b = C.toBase(S.L, amt, fa.currency); conv = b == null ? null : C.fromBase(S.L, b, ta.currency); } if (!conv) return { err: T('Укажите сумму зачисления или курс валюты', 'Enter received amount or set a currency rate') }; tx.toAmount = conv; }
    }
    if (type === 'repayment') {
      var ip = App.toMinor(f.interest) || 0, fp = App.toMinor(f.feePart) || 0;
      tx.principal = amt - ip - fp; tx.interestPart = ip; tx.feePart = fp; tx.loanAccountId = f.to;
      if (tx.principal < 0) return { err: T('Проценты и комиссии больше суммы платежа', 'Interest and fees exceed the payment') };
      if (ip + fp > 0) tx.categoryId = 'finance';
    }
    if (type === 'loan_receipt') {
      var contract = App.toMinor(f.contract) || amt, withheld = App.toMinor(f.withheld) || 0, added = App.toMinor(f.added) || 0;
      tx.contractAmount = contract; tx.withheldFee = withheld; tx.addedCharges = added; tx.debtAmount = contract + added; tx.loanAccountId = f.from;
      if (contract - withheld !== amt) return { err: T('Получено должно равняться договорной сумме минус удержанная комиссия (', 'Received must equal contract amount minus withheld fee (') + F(contract - withheld) + ')' };
    }
    if (type === 'interest' || type === 'fee') tx.categoryId = 'finance';
    if (type === 'adjustment') tx.amount = f.adjNeg ? -amt : amt;
    if (f.projectId && ['expense', 'card_purchase', 'income'].indexOf(type) >= 0) { tx.projectId = f.projectId; tx.projectFlow = type === 'income' ? 'income' : (f.projectFlow || 'expense'); }
    return { tx: tx };
  };
  var ERR = function (e) {
    var map = { fromAccount: T('Выберите счёт списания', 'Choose source account'), toAccount: T('Выберите счёт зачисления', 'Choose destination account'), card: T('Покупка кредитной картой возможна только с кредитной карты', 'Card purchase requires a credit card'), liability: T('Нужен кредитный счёт', 'A credit/loan account is required'), sameAccount: T('Счета должны различаться', 'Accounts must differ'), useRepaymentOrLoan: T('Для кредитных счетов используйте погашение или получение кредита', 'Use repayment or loan receipt for credit accounts'), incomeToLiability: T('Доход нельзя зачислить на кредитный счёт', 'Income cannot go to a credit account'), duplicate: T('Эта операция уже сохранена', 'This record is already saved'), principal: T('Неверная сумма основного долга', 'Invalid principal') };
    return (e || []).map(function (x) { return map[x] || x; }).join('; ');
  };
  App.errText = ERR;
  App.actions.saveRecord = function () {
    var m = S.modal; if (!m || m.saving) return;
    var b = App.modals.record.build(m);
    if (b.err) { m.err = b.err; App.renderModal(); return; }
    m.saving = true;
    var res;
    if (m.id) res = App.commit(T('Запись изменена', 'Record updated'), function (L) { return C.updateTx(L, m.id, b.tx); });
    else res = App.commit(T('Запись добавлена', 'Record added'), function (L) { b.tx.opKey = m.opKey; return C.addTx(L, b.tx); });
    if (res && res.ok === false) { m.saving = false; if (res.duplicate) { App.closeModal(); return; } m.err = ERR(res.errors); App.renderModal(); return; }
    App.closeModal();
  };
  App.actions.txVoid = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Операция отменена, остатки восстановлены', 'Record voided, balances restored'), function (L) { return C.voidTx(L, id); }); };
  App.actions.txRestore = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Операция восстановлена', 'Record restored'), function (L) { var r = C.restoreTx(L, id); if (!r.ok) App.toast(T('Нельзя восстановить: есть дубликат', 'Cannot restore: duplicate exists')); return r; }); };
  App.actions.txDelete = function () { var id = S.modal.id; App.confirm(T('Удалить запись?', 'Delete record?'), T('Запись будет удалена без возможности восстановления (кроме кнопки «Отменить» сразу после удаления). Для обычной отмены используйте «Отменить операцию».', 'The record will be deleted permanently (except the immediate Undo). To simply cancel it use “Void”.'), function () { App.commit(T('Запись удалена', 'Record deleted'), function (L) { return C.deleteTx(L, id); }); }, true, T('Удалить', 'Delete')); };
  App.actions.txDup = function () { var t = S.modal.tx; App.closeModal(); App.openModal('record', { type: t.type, from: t.fromAccountId, to: t.toAccountId, cat: t.categoryId }); var f = S.modal.f; if (!S.modal.inited) App.modals.record(S.modal); f.amount = App.amtStr(Math.abs(t.amount)); f.note = t.note; App.renderModal(); };
})();
