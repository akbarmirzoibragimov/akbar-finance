/* Akbar Finance 3.0 — core finance engine (pure JS, no dependencies).
   All money is stored as integer minor units (fils for AED). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AFCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SCHEMA = 'akbar-finance-ledger';
  var VERSION = 1;
  var ACCOUNT_TYPES = ['cash', 'checking', 'credit_card', 'savings', 'investment', 'loan', 'other'];
  var LIAB_TYPES = ['credit_card', 'loan'];
  var TX_TYPES = ['salary', 'income', 'expense', 'transfer', 'debt_return', 'loan_receipt', 'card_purchase',
    'repayment', 'interest', 'fee', 'family', 'reserve_topup', 'savings_topup', 'adjustment'];
  var CURRENCIES = ['AED', 'USD', 'EUR', 'TRY', 'UZS', 'RUB', 'GBP', 'KZT', 'SAR', 'INR'];

  /* ---------- helpers ---------- */
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function toMinor(v) {
    if (typeof v === 'number') return Math.round(v * 100);
    var s = String(v == null ? '' : v).replace(/\s|\u00a0/g, '').replace(',', '.');
    if (!s || isNaN(Number(s))) return NaN;
    return Math.round(Number(s) * 100);
  }
  function fromMinor(m) { return m / 100; }
  function fmt(minor, opts) {
    opts = opts || {};
    var lang = opts.lang || 'ru';
    var v = (minor || 0) / 100;
    var s = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
      minimumFractionDigits: opts.dec === 0 ? 0 : 2, maximumFractionDigits: opts.dec === 0 ? 0 : 2
    }).format(Math.abs(v)).replace(/\u202f/g, '\u00a0');
    var sign = v < 0 ? '−' : (opts.plus && v > 0 ? '+' : '');
    return sign + s + (opts.cur === false ? '' : '\u00a0' + (opts.cur || 'AED'));
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowISO(d) { d = d || new Date(); return todayISO(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ymOf(date) { return String(date).slice(0, 7); }
  function addMonths(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function daysInMonth(ym) { return new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(); }
  function lastDay(ym) { return ym + '-' + pad(daysInMonth(ym)); }
  function parseD(s) { return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); }
  function addDays(s, n) { var d = parseD(s); d.setDate(d.getDate() + n); return todayISO(d); }
  function diffDays(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sum(arr, f) { var s = 0; for (var i = 0; i < arr.length; i++) s += f ? (f(arr[i]) || 0) : (arr[i] || 0); return s; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function L2(lang, ru, en) { return lang === 'en' ? en : ru; }

  /* ---------- defaults ---------- */
  function defaultCategories() {
    var c = function (id, ru, en, icon, color, kind, parent, limit, flags) {
      return { id: id, name: { ru: ru, en: en }, icon: icon, color: color, kind: kind, parent: parent || null, limit: limit || 0, system: !!(flags && flags.system), impulse: !!(flags && flags.impulse) };
    };
    return [
      c('food', 'Продукты и питание', 'Food & groceries', 'cart', '#FF9F0A', 'expense', null, 22000),
      c('groceries', 'Продукты', 'Groceries', 'cart', '#FFB340', 'expense', 'food'),
      c('restaurants', 'Рестораны', 'Restaurants', 'food', '#FF9F0A', 'expense', 'food'),
      c('cafe', 'Кафе', 'Cafe', 'coffee', '#D08A3A', 'expense', 'food'),
      c('delivery', 'Доставка еды', 'Food delivery', 'bag', '#FF7A45', 'expense', 'food'),
      c('subscriptions', 'Подписки', 'Subscriptions', 'repeat', '#5E5CE6', 'expense'),
      c('chatgpt', 'ChatGPT Plus', 'ChatGPT Plus', 'sparkle', '#64D2FF', 'expense', 'subscriptions', 8000),
      c('cigarettes', 'Сигареты', 'Cigarettes', 'flame', '#8E8E93', 'expense', null, 10000),
      c('misc', 'Прочее', 'Other', 'dots', '#98989D', 'expense', null, 10000),
      c('transport', 'Транспорт', 'Transport', 'bus', '#0A84FF', 'expense'),
      c('taxi', 'Такси', 'Taxi', 'car', '#FFD60A', 'expense', 'transport'),
      c('alcohol', 'Алкоголь', 'Alcohol', 'wine', '#BF5AF2', 'expense'),
      c('entertainment', 'Развлечения', 'Entertainment', 'film', '#FF375F', 'expense'),
      c('dates', 'Свидания', 'Dates', 'heart', '#FF2D55', 'expense'),
      c('electronics', 'Электроника', 'Electronics', 'laptop', '#64D2FF', 'expense'),
      c('clothes', 'Одежда', 'Clothes', 'shirt', '#AC8E68', 'expense'),
      c('health', 'Здоровье', 'Health', 'pulse', '#30D158', 'expense'),
      c('education', 'Образование', 'Education', 'book', '#0A84FF', 'expense'),
      c('gifts', 'Подарки', 'Gifts', 'gift', '#FF453A', 'expense'),
      c('business', 'Бизнес', 'Business', 'briefcase', '#30B0C7', 'expense'),
      c('impulse', 'Импульсивные покупки', 'Impulse buys', 'bolt', '#FF453A', 'expense', null, 0, { impulse: true }),
      c('finance', 'Проценты и комиссии', 'Interest & fees', 'percent', '#FF453A', 'expense', null, 0, { system: true }),
      c('family', 'Родителям', 'Parents', 'home', '#BF5AF2', 'expense', null, 0, { system: true }),
      c('salary', 'Зарплата', 'Salary', 'wallet', '#30D158', 'income'),
      c('tips', 'Чаевые', 'Tips', 'coins', '#34C759', 'income'),
      c('service', 'Service charge', 'Service charge', 'receipt', '#32D74B', 'income'),
      c('debt_return', 'Возврат долга', 'Loan returned to me', 'undo', '#66D4CF', 'income', null, 0, { system: true }),
      c('extra', 'Доп. заработок', 'Side income', 'rocket', '#BF5AF2', 'income'),
      c('other_income', 'Прочий доход', 'Other income', 'plus', '#30D158', 'income')
    ];
  }
  function defaultScenarios() {
    return [
      { id: 'neg', name: { ru: 'Негативный', en: 'Negative' }, income: 0, parents: 0, loans: 0, expenses: 0, months: 5 },
      { id: 'base', name: { ru: 'Базовый', en: 'Base' }, income: 0, parents: 0, loans: 0, expenses: 0, months: 5 },
      { id: 'opt', name: { ru: 'Оптимистичный', en: 'Optimistic' }, income: 0, parents: 0, loans: 0, expenses: 0, months: 5 }
    ];
  }
  function newLedger(opts) {
    opts = opts || {};
    var t = opts.today || todayISO();
    return {
      schema: SCHEMA, version: VERSION,
      meta: { id: uid('ledger'), name: opts.name || 'Akbar Finance', createdAt: new Date().toISOString(), asOf: t, baseCurrency: 'AED' },
      settings: { lang: opts.lang || 'ru', theme: 'dark', obligationsHorizonDays: 30, upcomingDays: 7 },
      rates: { AED: 1, USD: 3.6725, UZS: 1 / 3264.51 },
      rateMeta: { USD: { source: 'AED/USD peg 3.6725', confirmed: true }, UZS: { source: 'manual', confirmed: false } },
      rateDates: { USD: '2026-11-25', UZS: '2026-11-25' },
      incomePlan: { lines: [], months: {}, actuals: {} }, budgetSweeps: {},
      accounts: [], transactions: [], planned: [], categories: defaultCategories(),
      budgetPlan: { total: 50000 },
      goals: [], projects: [], assets: [],
      family: { apartmentGoalId: null },
      scenarios: defaultScenarios(),
      dismissed: {}, changelog: []
    };
  }

  /* ---------- currencies ---------- */
  function rate(L, cur) { if (!cur || cur === 'AED') return 1; var r = L.rates && L.rates[cur]; return r ? Number(r) : null; }
  function toBase(L, minor, cur) { var r = rate(L, cur); return r == null ? null : Math.round(minor * r); }
  function fromBase(L, minor, cur) { var r = rate(L, cur); return r == null ? null : Math.round(minor / r); }

  /* ---------- accounts ---------- */
  function isLiab(acc) { return !!acc && LIAB_TYPES.indexOf(acc.type) >= 0; }
  function makeAccount(o) {
    var a = {
      id: o.id || uid('acc'), name: o.name || 'Account', type: o.type || 'checking', currency: o.currency || 'AED',
      initialBalance: o.initialBalance || 0, color: o.color || '#0A84FF', icon: o.icon || 'bank', note: o.note || '',
      role: o.role || null, term: o.term || null, institution: o.institution || '', archived: false, closed: false,
      balanceConfirmed: o.balanceConfirmed !== false, openedAt: o.openedAt || null, createdAt: new Date().toISOString()
    };
    if (a.type === 'credit_card') a.credit = Object.assign({ limit: 0, statementBalance: null, minPayment: null, dueDate: null, dueDateConfirmed: true, statementDate: null, billingCycle: '', apr: null, aprConfirmed: false, fees: '', feesConfirmed: false }, o.credit || {});
    if (a.type === 'loan') a.loan = Object.assign({ kind: 'personal', principal: a.initialBalance, monthlyPayment: null, endDate: null, apr: null, aprConfirmed: false, aprEstimated: null, paymentDay: null, paymentDayConfirmed: false, fees: '', feesConfirmed: false }, o.loan || {});
    for (var k in o) if (!(k in a)) a[k] = o[k];
    return a;
  }

  /* effects of a transaction: list of {acc, delta}. For liabilities delta changes the DEBT. */
  function txEffects(L, tx) {
    var out = [];
    if (!tx || tx.status === 'void') return out;
    var from = tx.fromAccountId ? byId(L.accounts, tx.fromAccountId) : null;
    var to = tx.toAccountId ? byId(L.accounts, tx.toAccountId) : null;
    var A = tx.amount || 0;
    var outOf = function (acc, amt) { if (acc) out.push({ acc: acc.id, delta: isLiab(acc) ? amt : -amt }); };
    var into = function (acc, amt) { if (acc) out.push({ acc: acc.id, delta: isLiab(acc) ? -amt : amt }); };
    switch (tx.type) {
      case 'salary': case 'income': case 'debt_return':
        into(to, A); break;
      case 'expense': case 'card_purchase': case 'interest': case 'fee':
        outOf(from, A); break;
      case 'family':
        outOf(from, A + (tx.fee || 0)); break;
      case 'transfer': case 'reserve_topup': case 'savings_topup':
        outOf(from, A + (tx.fee || 0));
        into(to, tx.toAmount != null ? tx.toAmount : A); break;
      case 'loan_receipt':
        // amount = actually received cash; debtAmount = total owed added to the liability (contract + interest/fees)
        if (to) out.push({ acc: to.id, delta: isLiab(to) ? -A : A });
        if (from) out.push({ acc: from.id, delta: tx.debtAmount != null ? tx.debtAmount : A });
        break;
      case 'repayment':
        // amount = total paid; principal part reduces the debt; the rest is interest/fees (finance cost)
        if (from) out.push({ acc: from.id, delta: isLiab(from) ? A : -A });
        if (to) out.push({ acc: to.id, delta: -(tx.principal != null ? tx.principal : A) });
        break;
      case 'adjustment':
        if (from) out.push({ acc: from.id, delta: A }); // signed; for a liability +A means more debt
        break;
    }
    return out;
  }
  /* classification for statistics (amounts in tx currency) */
  function txClass(L, tx) {
    var r = { earned: 0, returnFunds: 0, consumer: 0, finance: 0, family: 0, borrowed: 0, principal: 0 };
    if (tx.status === 'void') return r;
    var A = tx.amount || 0;
    switch (tx.type) {
      case 'salary': case 'income': r.earned = A; break;
      case 'debt_return': r.returnFunds = A; break;
      case 'expense': case 'card_purchase': r.consumer = A; break;
      case 'interest': case 'fee': r.finance = A; break;
      case 'family': r.family = A; r.finance = tx.fee || 0; break;
      case 'transfer': case 'reserve_topup': case 'savings_topup': r.finance = tx.fee || 0; break;
      case 'loan_receipt': r.borrowed = A; r.finance = Math.max(0, (tx.debtAmount != null ? tx.debtAmount : A) - A); break;
      case 'repayment':
        var p = tx.principal != null ? tx.principal : A;
        r.principal = p; r.finance = Math.max(0, A - p); break;
    }
    return r;
  }
  function txCurrency(L, tx) {
    if (tx.currency) return tx.currency;
    var a = byId(L.accounts, tx.fromAccountId) || byId(L.accounts, tx.toAccountId);
    return a ? a.currency : 'AED';
  }
  function balances(L, until) {
    var m = {};
    L.accounts.forEach(function (a) { m[a.id] = a.initialBalance || 0; });
    L.transactions.forEach(function (tx) {
      if (tx.status === 'void') return;
      if (until && tx.date.slice(0, 10) > until) return;
      txEffects(L, tx).forEach(function (e) { if (e.acc in m) m[e.acc] += e.delta; });
    });
    return m;
  }
  function creditInfo(L, acc, bal, today) {
    bal = bal || balances(L);
    var debt = bal[acc.id] || 0;
    var info = { debt: debt };
    if (acc.type === 'credit_card') {
      var lim = acc.credit.limit || 0;
      info.limit = lim; info.used = debt; info.available = Math.max(0, lim - debt);
      info.overLimit = Math.max(0, debt - lim);
      info.utilization = lim ? debt / lim : null;
      info.afterMin = acc.credit.minPayment != null ? Math.max(0, debt - acc.credit.minPayment) : null;
    }
    info.status = creditStatus(L, acc, debt, today);
    return info;
  }
  function creditStatus(L, acc, debt, today) {
    if (acc.closed) return 'closed';
    today = today || todayISO();
    var overdue = L.planned.some(function (p) { return p.accountId === acc.id && p.kind === 'payment' && !p.scenario && plannedState(L, p, today).status === 'overdue'; });
    if (overdue) return 'overdue';
    if (debt <= 0) return 'paid';
    var repaid = L.transactions.some(function (t) { return t.status !== 'void' && t.type === 'repayment' && t.toAccountId === acc.id; });
    return repaid ? 'partial' : 'active';
  }

  /* ---------- transactions ---------- */
  function budgetMonthFor(tx) {
    var d = tx.date.slice(0, 10);
    if ((tx.type === 'salary' || tx.type === 'income' || tx.type === 'debt_return') && +d.slice(8, 10) >= 25) return addMonths(ymOf(d), 1);
    return ymOf(d);
  }
  function validateTx(L, tx) {
    var e = [];
    if (TX_TYPES.indexOf(tx.type) < 0) e.push('type');
    if (!isInt(tx.amount)) e.push('amount');
    if (tx.type !== 'adjustment' && tx.amount <= 0) e.push('amount>0');
    if (!/^\d{4}-\d{2}-\d{2}/.test(tx.date || '')) e.push('date');
    var need = { salary: ['to'], income: ['to'], debt_return: ['to'], expense: ['from'], card_purchase: ['from'], interest: ['from'], fee: ['from'], family: ['from'], transfer: ['from', 'to'], reserve_topup: ['from', 'to'], savings_topup: ['from', 'to'], loan_receipt: ['from', 'to'], repayment: ['from', 'to'], adjustment: ['from'] }[tx.type] || [];
    need.forEach(function (k) {
      var id = k === 'from' ? tx.fromAccountId : tx.toAccountId;
      if (!id || !byId(L.accounts, id)) e.push(k + 'Account');
    });
    var fa = byId(L.accounts, tx.fromAccountId), ta = byId(L.accounts, tx.toAccountId);
    if (tx.type === 'card_purchase' && fa && fa.type !== 'credit_card') e.push('card');
    if (tx.type === 'loan_receipt' && fa && !isLiab(fa)) e.push('liability');
    if (tx.type === 'repayment') {
      if (ta && !isLiab(ta)) e.push('liability');
      if (tx.principal != null && (tx.principal < 0 || tx.principal > tx.amount)) e.push('principal');
    }
    if (['transfer', 'reserve_topup', 'savings_topup'].indexOf(tx.type) >= 0) {
      if (tx.fromAccountId === tx.toAccountId) e.push('sameAccount');
      if ((fa && isLiab(fa)) || (ta && isLiab(ta))) e.push('useRepaymentOrLoan');
    }
    if (['salary', 'income', 'debt_return'].indexOf(tx.type) >= 0 && ta && isLiab(ta)) e.push('incomeToLiability');
    return e;
  }
  function log(L, action, summary, ref) {
    L.changelog = L.changelog || [];
    L.changelog.unshift({ id: uid('log'), ts: new Date().toISOString(), action: action, summary: summary, ref: ref || null });
    if (L.changelog.length > 2000) L.changelog.length = 2000;
  }
  function addTx(L, input) {
    var tx = Object.assign({ id: uid('tx'), status: 'cleared', tags: [], note: '', createdAt: new Date().toISOString() }, input);
    if (tx.opKey === undefined) delete tx.opKey;
    if (!tx.currency) tx.currency = txCurrency(L, tx);
    if (tx.opKey && L.transactions.some(function (t) { return t.opKey === tx.opKey; })) return { ok: false, duplicate: true, errors: ['duplicate'] };
    if (L.transactions.some(function (t) { return t.id === tx.id; })) return { ok: false, duplicate: true, errors: ['duplicateId'] };
    var errs = validateTx(L, tx);
    if (errs.length) return { ok: false, errors: errs };
    if (!tx.budgetMonth) tx.budgetMonth = budgetMonthFor(tx);
    L.transactions.push(tx);
    log(L, 'tx.add', tx.type + ' ' + fmt(tx.amount, { cur: tx.currency }), tx.id);
    return { ok: true, tx: tx };
  }
  function updateTx(L, id, patch) {
    var tx = byId(L.transactions, id); if (!tx) return { ok: false, errors: ['notFound'] };
    var next = Object.assign({}, tx, patch, { updatedAt: new Date().toISOString() });
    var errs = validateTx(L, next); if (errs.length) return { ok: false, errors: errs };
    Object.assign(tx, next);
    log(L, 'tx.edit', tx.type + ' ' + fmt(tx.amount, { cur: tx.currency }), id);
    return { ok: true, tx: tx };
  }
  function voidTx(L, id) {
    var tx = byId(L.transactions, id); if (!tx || tx.status === 'void') return { ok: false };
    tx.status = 'void'; tx.voidedAt = new Date().toISOString();
    log(L, 'tx.void', tx.type + ' ' + fmt(tx.amount, { cur: tx.currency }), id);
    return { ok: true, tx: tx };
  }
  function restoreTx(L, id) {
    var tx = byId(L.transactions, id); if (!tx || tx.status !== 'void') return { ok: false };
    if (tx.opKey && L.transactions.some(function (t) { return t !== tx && t.opKey === tx.opKey && t.status !== 'void'; })) return { ok: false };
    tx.status = 'cleared'; delete tx.voidedAt;
    log(L, 'tx.restore', tx.type + ' ' + fmt(tx.amount, { cur: tx.currency }), id);
    return { ok: true };
  }
  function deleteTx(L, id) {
    var i = -1; L.transactions.forEach(function (t, k) { if (t.id === id) i = k; }); if (i < 0) return { ok: false };
    var tx = L.transactions.splice(i, 1)[0];
    log(L, 'tx.delete', tx.type + ' ' + fmt(tx.amount, { cur: tx.currency }), id);
    return { ok: true };
  }

  /* ---------- planned items ---------- */
  function plannedTxs(L, p) { return L.transactions.filter(function (t) { return t.plannedId === p.id && t.status !== 'void'; }); }
  function plannedState(L, p, today) {
    today = today || todayISO();
    var txs = plannedTxs(L, p);
    var paid = sum(txs, function (t) { return t.amount; });
    var remaining = Math.max(0, p.amount - paid);
    var status;
    if (p.status === 'skipped') status = 'skipped';
    else if ((p.kind === 'income' || p.kind === 'borrow') && p.confirmed) status = 'received';
    else if (p.amount > 0 && paid >= p.amount) status = p.kind === 'income' ? 'received' : 'paid';
    else if (p.amount === 0) status = 'zero';
    else if (p.date < today) status = 'overdue';
    else status = paid > 0 ? 'partial' : 'planned';
    var open = ['planned', 'partial', 'overdue'].indexOf(status) >= 0;
    return { paid: paid, remaining: (status === 'received' || status === 'skipped' || status === 'zero') ? 0 : remaining, status: status, partial: paid > 0 && remaining > 0, open: open, txs: txs };
  }
  /* Confirm a planned item -> creates real transactions. Idempotent (opKey + remaining check). */
  function confirmPlanned(L, pid, o) {
    o = o || {};
    var p = byId(L.planned, pid); if (!p) return { ok: false, errors: ['notFound'] };
    if (o.opKey && L.transactions.some(function (t) { return t.opKey === o.opKey || (t.opKey && t.opKey.indexOf(o.opKey + ':') === 0); })) return { ok: false, duplicate: true, errors: ['duplicate'] };
    var st = plannedState(L, p);
    if ((p.kind === 'payment' || p.kind === 'family') && st.remaining <= 0) return { ok: false, duplicate: true, errors: ['alreadyPaid'] };
    if ((p.kind === 'income' || p.kind === 'borrow') && p.confirmed) return { ok: false, duplicate: true, errors: ['alreadyConfirmed'] };
    var date = (o.date || p.date) + 'T' + (o.time || '12:00');
    var created = [];
    var push = function (tx) { var r = addTx(L, tx); if (!r.ok) throw new Error(r.errors.join(',')); created.push(r.tx); };
    try {
      if (p.kind === 'payment' || p.kind === 'family') {
        var amount = o.amount != null ? o.amount : st.remaining;
        if (!(amount > 0)) return { ok: false, errors: ['amount'] };
        if (amount > st.remaining) return { ok: false, errors: ['overpay'] };
        var from = o.fromAccountId || p.fromAccountId;
        if (p.kind === 'family') {
          push({ type: 'family', amount: amount, fee: o.fee || 0, fromAccountId: from, categoryId: 'family', date: date, plannedId: p.id, budgetMonth: p.budgetMonth, opKey: o.opKey, note: o.note || p.title, goalId: o.goalId || null, recipientCurrency: o.recipientCurrency || null, recipientAmount: o.recipientAmount || null });
        } else if (p.accountId && isLiab(byId(L.accounts, p.accountId))) {
          var principal = o.principal;
          if (principal == null) principal = p.interestPart ? amount - Math.round(amount * p.interestPart / p.amount) : amount;
          push({ type: 'repayment', amount: amount, principal: principal, fromAccountId: from, toAccountId: p.accountId, categoryId: principal < amount ? 'finance' : null, date: date, plannedId: p.id, budgetMonth: p.budgetMonth, opKey: o.opKey, note: o.note || p.title, loanAccountId: p.accountId });
        } else {
          push({ type: 'expense', amount: amount, fromAccountId: from, categoryId: p.categoryId || 'misc', date: date, plannedId: p.id, budgetMonth: p.budgetMonth, opKey: o.opKey, note: o.note || p.title });
        }
      } else if (p.kind === 'income') {
        var parts = o.parts || { salary: p.amount };
        var map = { salary: ['salary', 'salary'], tips: ['income', 'tips'], service: ['income', 'service'], debtReturn: ['debt_return', 'debt_return'], extra: ['income', 'extra'], other: ['income', 'other_income'] };
        Object.keys(parts).forEach(function (k, i) {
          var v = parts[k]; if (!(v > 0)) return;
          var m = map[k] || ['income', 'other_income'];
          push({ type: m[0], amount: v, toAccountId: o.toAccountId || p.toAccountId, categoryId: m[1], date: date, plannedId: p.id, budgetMonth: p.budgetMonth, opKey: o.opKey ? o.opKey + ':' + i : undefined, note: o.note || p.title });
        });
        p.confirmed = true; p.confirmedAt = new Date().toISOString();
      } else if (p.kind === 'borrow') {
        var received = o.amount != null ? o.amount : p.amount;
        push({ type: 'loan_receipt', amount: received, debtAmount: o.debtAmount != null ? o.debtAmount : p.debtAmount, fromAccountId: p.accountId, toAccountId: o.toAccountId || p.toAccountId, date: date, plannedId: p.id, budgetMonth: p.budgetMonth, opKey: o.opKey, note: o.note || p.title, loanAccountId: p.accountId });
        p.confirmed = true; p.confirmedAt = new Date().toISOString();
      }
    } catch (err) {
      created.forEach(function (t) { var i = L.transactions.indexOf(t); if (i >= 0) L.transactions.splice(i, 1); });
      return { ok: false, errors: [String(err.message)] };
    }
    log(L, 'planned.confirm', p.title, p.id);
    return { ok: true, txs: created, state: plannedState(L, p) };
  }
  /* undo a confirmation of income/borrow: voids the created txs and re-opens the plan item */
  function unconfirmPlanned(L, pid) {
    var p = byId(L.planned, pid); if (!p) return { ok: false };
    plannedTxs(L, p).forEach(function (t) { t.status = 'void'; t.voidedAt = new Date().toISOString(); });
    p.confirmed = false;
    log(L, 'planned.unconfirm', p.title, p.id);
    return { ok: true };
  }
  function makeSeries(o) {
    var out = [], sid = o.seriesId || uid('series');
    var day = +o.startDate.slice(8, 10);
    var ym = ymOf(o.startDate), n = 0;
    while (n < 600) {
      if (o.count != null && n >= o.count) break;
      if (o.until && ym > o.until) break;
      var d = ym + '-' + pad(Math.min(day, daysInMonth(ym)));
      out.push(Object.assign({}, o.template, { id: sid + '_' + ym, seriesId: sid, date: d, budgetMonth: o.budgetShift ? addMonths(ym, o.budgetShift) : ym }));
      ym = addMonths(ym, 1); n++;
    }
    return out;
  }
  /* amortization with a monthly rate; rows {n, principal, interest, payment, balance} */
  function amortize(principal, monthlyRate, payment, maxN) {
    var rows = [], bal = principal, n = 0;
    while (bal > 0 && n < (maxN || 600)) {
      n++;
      var interest = Math.round(bal * monthlyRate);
      var pay = Math.min(payment, bal + interest);
      var pr = pay - interest;
      if (pr <= 0) break;
      bal -= pr;
      rows.push({ n: n, payment: pay, principal: pr, interest: interest, balance: bal });
    }
    return rows;
  }

  /* ---------- metrics ---------- */
  function ownAccounts(L) { return L.accounts.filter(function (a) { return !isLiab(a) && !a.closed; }); }
  function liabAccounts(L) { return L.accounts.filter(function (a) { return isLiab(a) && !a.closed; }); }
  function plannedIncluded(p, opts) { return !p.scenario || !!(opts && opts.scenarios && opts.scenarios.indexOf(p.scenario) >= 0); }

  function metrics(L, today) {
    today = today || todayISO();
    var bal = balances(L);
    var own = 0, reserved = 0, savings = 0, liquid = 0, confirmedAssets = 0, unconvertible = [];
    ownAccounts(L).forEach(function (a) {
      var v = toBase(L, bal[a.id], a.currency);
      if (v == null) { unconvertible.push(a.name); return; }
      own += v;
      if (a.balanceConfirmed !== false) confirmedAssets += v;
      if (a.role === 'reserve') reserved += v;
      else if (a.role === 'savings' || a.type === 'investment') savings += v;
      else liquid += v;
    });
    var debt = 0, shortDebt = 0, longDebt = 0;
    liabAccounts(L).forEach(function (a) {
      var v = toBase(L, bal[a.id], a.currency); if (v == null) { unconvertible.push(a.name); return; }
      debt += v; if (a.term === 'long') longDebt += v; else shortDebt += v;
    });
    var horizon = addDays(today, L.settings.obligationsHorizonDays || 30);
    var obligations = 0;
    L.planned.forEach(function (p) {
      if (!plannedIncluded(p) || (p.kind !== 'payment' && p.kind !== 'family')) return;
      var st = plannedState(L, p, today); if (!st.open) return;
      if (p.date <= horizon) obligations += toBase(L, st.remaining, p.currency || 'AED') || 0;
    });
    // reserve and savings accounts are already excluded from `liquid`, so nothing is reserved twice
    var free = liquid - obligations;
    var ym = ymOf(today);
    var monthIncome = 0, monthExpense = 0, monthEarned = 0, monthFamily = 0, monthFinance = 0;
    L.transactions.forEach(function (t) {
      if (t.status === 'void' || ymOf(t.date) !== ym) return;
      var c = txClass(L, t), cur = txCurrency(L, t);
      monthEarned += toBase(L, c.earned, cur) || 0;
      monthIncome += toBase(L, c.earned + c.returnFunds, cur) || 0;
      monthExpense += toBase(L, c.consumer, cur) || 0;
      monthFamily += toBase(L, c.family, cur) || 0;
      monthFinance += toBase(L, c.finance, cur) || 0;
    });
    var bm = ym, plannedIncome = 0, actualIncome = 0;
    L.planned.forEach(function (p) { if (p.kind === 'income' && !p.scenario && p.budgetMonth === bm) plannedIncome += p.amount; });
    L.transactions.forEach(function (t) {
      if (t.status === 'void' || t.budgetMonth !== bm) return;
      if (t.type === 'salary' || t.type === 'income' || t.type === 'debt_return') actualIncome += toBase(L, t.amount, txCurrency(L, t)) || 0;
    });
    var familySent = 0;
    L.transactions.forEach(function (t) { if (t.status !== 'void' && t.type === 'family') familySent += toBase(L, t.amount, txCurrency(L, t)) || 0; });
    return {
      own: own, liquid: liquid, reserved: reserved, savings: savings, confirmedAssets: confirmedAssets,
      debt: debt, shortDebt: shortDebt, longDebt: longDebt, netWorth: confirmedAssets - debt,
      obligations: obligations, horizon: horizon, free: free,
      monthIncome: monthIncome, monthEarned: monthEarned, monthExpense: monthExpense, monthFamily: monthFamily, monthFinance: monthFinance,
      budgetMonth: bm, plannedIncome: plannedIncome, actualIncome: actualIncome, incomeDeviation: actualIncome - plannedIncome,
      incomeDeviationPct: plannedIncome ? (actualIncome - plannedIncome) / plannedIncome : null,
      familySent: familySent, unconvertible: unconvertible, balances: bal
    };
  }
  function upcoming(L, today, days, opts) {
    today = today || todayISO();
    var until = days != null ? addDays(today, days) : '9999-12-31';
    return L.planned.filter(function (p) { return plannedIncluded(p, opts) && p.date <= until; })
      .map(function (p) { return { p: p, st: plannedState(L, p, today) }; })
      .filter(function (x) { return x.st.open || ((x.p.kind === 'income' || x.p.kind === 'borrow') && !x.p.confirmed && x.st.status !== 'skipped'); })
      .sort(function (a, b) { return a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : 0; });
  }

  /* ---------- budget-month plan (end-of-month income funds the next month) ---------- */
  function monthPlan(L, ym, opts) {
    opts = opts || {}; var today = opts.today || todayISO();
    var items = [], income = 0, out = 0;
    L.planned.forEach(function (p) {
      if (p.budgetMonth !== ym || !plannedIncluded(p, opts)) return;
      var st = plannedState(L, p, today), v;
      if (p.kind === 'income' || p.kind === 'borrow') {
        v = st.status === 'skipped' ? 0 : p.confirmed ? st.paid : p.amount;
        income += v; items.push({ id: p.id, kind: p.kind, title: p.title, amount: v, planned: p.amount, actual: st.paid, status: st.status, date: p.date, scenario: p.scenario || null });
      } else {
        v = st.status === 'skipped' ? st.paid : st.paid + st.remaining;
        out += v; items.push({ id: p.id, kind: p.kind, title: p.title, amount: -v, planned: p.amount, actual: st.paid, status: st.status, date: p.date, accountId: p.accountId, scenario: p.scenario || null });
      }
    });
    var unplannedIn = 0, unplannedOut = 0, consumer = 0;
    L.transactions.forEach(function (t) {
      if (t.status === 'void' || t.budgetMonth !== ym || t.plannedId) return;
      var c = txClass(L, t), cur = txCurrency(L, t);
      var fromAcc = byId(L.accounts, t.fromAccountId);
      unplannedIn += toBase(L, c.earned + c.returnFunds, cur) || 0;
      if (t.type === 'loan_receipt') unplannedIn += toBase(L, t.amount, cur) || 0;
      consumer += toBase(L, c.consumer, cur) || 0;
      if (t.type === 'family') unplannedOut += toBase(L, t.amount + (t.fee || 0), cur) || 0;
      else if (t.type === 'repayment' && fromAcc && !isLiab(fromAcc)) unplannedOut += toBase(L, t.amount, cur) || 0;
      else if ((t.type === 'fee' || t.type === 'interest') && fromAcc && !isLiab(fromAcc)) unplannedOut += toBase(L, t.amount, cur) || 0;
    });
    // consumer spending is counted once here (card purchases at purchase time); card repayments appear only as planned/unplanned repayments
    var personal = Math.max(L.budgetPlan.total || 0, consumer);
    income += unplannedIn; out += unplannedOut + personal;
    if (unplannedIn) items.push({ kind: 'unplannedIn', amount: unplannedIn });
    if (unplannedOut) items.push({ kind: 'unplannedOut', amount: -unplannedOut });
    items.push({ kind: 'personal', amount: -personal, planned: L.budgetPlan.total || 0, actual: consumer });
    return { ym: ym, income: income, out: out, result: income - out, items: items, personalActual: consumer };
  }
  function planSeries(L, fromYm, n, opts) {
    var rows = [], carry = (opts && opts.startCarry) || 0;
    for (var i = 0; i < n; i++) {
      var ym = addMonths(fromYm, i), mp = monthPlan(L, ym, opts);
      carry += mp.result;
      rows.push({ ym: ym, income: mp.income, out: mp.out, result: mp.result, cumulative: carry, plan: mp });
    }
    return rows;
  }
  function firstPlanMonth(L) {
    var ms = L.planned.map(function (p) { return p.budgetMonth; }).filter(Boolean).sort();
    return ms[0] || ymOf(todayISO());
  }
  function lastPlanMonth(L) {
    var ms = L.planned.filter(function (p) { return p.kind === 'income'; }).map(function (p) { return p.budgetMonth; }).sort();
    return ms[ms.length - 1] || ymOf(todayISO());
  }
  /* ways to cover a deficit without new borrowing */
  function deficitAlternatives(L, ym, opts) {
    var mp = monthPlan(L, ym, opts), deficit = -mp.result, alts = [];
    if (deficit <= 0) return { deficit: 0, alts: alts };
    var fam = mp.items.filter(function (i) { return i.kind === 'family' && i.amount < 0 && ['planned', 'partial', 'overdue'].indexOf(i.status) >= 0; });
    var famTotal = -sum(fam, function (i) { return i.amount; });
    var next = monthPlan(L, addMonths(ym, 1), opts);
    if (famTotal > 0) {
      var cut = Math.min(deficit, famTotal);
      alts.push({ id: 'reduceFamily', amount: cut, newValue: famTotal - cut, covers: famTotal >= deficit });
      alts.push({ id: 'shiftFamily', amount: cut, nextYm: addMonths(ym, 1), nextResultAfter: next.result - cut, feasible: next.result - cut >= 0 });
    }
    var personal = mp.items.filter(function (i) { return i.kind === 'personal'; })[0];
    if (personal) alts.push({ id: 'cutPersonal', amount: Math.min(deficit, -personal.amount), covers: -personal.amount >= deficit });
    alts.push({ id: 'minPayments' });
    alts.push({ id: 'askDates' });
    return { deficit: deficit, alts: alts };
  }

  /* ---------- daily cash forecast of own liquid money ---------- */
  function dailyForecast(L, today, days, opts) {
    today = today || todayISO(); opts = opts || {};
    var m = metrics(L, today), start = m.liquid, events = {};
    var add = function (d, v, label) { if (d < today) d = today; (events[d] = events[d] || []).push({ v: v, label: label }); };
    L.planned.forEach(function (p) {
      if (!plannedIncluded(p, opts)) return;
      var st = plannedState(L, p, today);
      if (p.kind === 'income' || p.kind === 'borrow') { if (!p.confirmed && st.status !== 'skipped') add(p.date, p.amount, p.title); }
      else if (st.open) add(p.date, -(toBase(L, st.remaining, p.currency || 'AED') || 0), p.title);
    });
    var points = [], cur = start, firstDeficit = null, minV = start, minD = today, curYm = ymOf(today);
    for (var i = 0; i <= days; i++) {
      var d = addDays(today, i);
      (events[d] || []).forEach(function (e) { cur += e.v; });
      // personal budget is spread daily from the next month on (current month spending is already in actual balances)
      if (ymOf(d) !== curYm) cur -= (L.budgetPlan.total || 0) / daysInMonth(ymOf(d));
      var v = Math.round(cur);
      points.push({ date: d, value: v, events: events[d] || [] });
      if (v < minV) { minV = v; minD = d; }
      if (v < 0 && !firstDeficit) firstDeficit = d;
    }
    return { start: start, points: points, firstDeficit: firstDeficit, min: minV, minDate: minD };
  }

  /* ---------- budgets ---------- */
  function catChildren(L, id) { return L.categories.filter(function (c) { return c.parent === id; }).map(function (c) { return c.id; }); }
  function spendByCategory(L, from, to, accountIds) {
    var m = {};
    L.transactions.forEach(function (t) {
      if (t.status === 'void') return;
      var d = t.date.slice(0, 10); if (d < from || d > to) return;
      if (accountIds && accountIds.length && accountIds.indexOf(t.fromAccountId) < 0) return;
      var c = txClass(L, t); if (!c.consumer) return;
      var v = toBase(L, c.consumer, txCurrency(L, t)) || 0;
      var k = t.categoryId || 'misc';
      m[k] = (m[k] || 0) + v;
    });
    return m;
  }
  function budgetStatus(L, ym, today) {
    today = today || todayISO();
    var from = ym + '-01', to = lastDay(ym);
    var spent = spendByCategory(L, from, to);
    var dim = daysInMonth(ym);
    var inMonth = today >= from && today <= to;
    var elapsed = today < from ? 0 : today > to ? dim : +today.slice(8, 10);
    var left = inMonth ? dim - elapsed + 1 : (today < from ? dim : 1);
    function mk(id, limit, s) {
      var forecast = inMonth && elapsed > 0 ? Math.round(s / elapsed * dim) : s;
      return { id: id, limit: limit, spent: s, remaining: limit - s, pct: limit ? s / limit : 0, daily: Math.max(0, Math.floor((limit - s) / left)), forecast: forecast, overrun: Math.max(0, forecast - limit), exceeded: limit > 0 && s > limit };
    }
    var rows = L.categories.filter(function (c) { return c.kind === 'expense' && c.limit > 0; }).map(function (c) {
      var ids = [c.id].concat(catChildren(L, c.id));
      return mk(c.id, c.limit, sum(ids, function (id) { return spent[id] || 0; }));
    });
    var total = sum(Object.keys(spent), function (k) { var c = byId(L.categories, k); return c && c.system ? 0 : spent[k]; });
    return { ym: ym, rows: rows, total: mk('__total', L.budgetPlan.total || 0, total), spent: spent, daysLeft: left };
  }

  /* ---------- debt ---------- */
  function debtSummary(L, today) {
    today = today || todayISO();
    var bal = balances(L);
    var live = function (t) { return t.status !== 'void'; };
    var rows = L.accounts.filter(isLiab).map(function (a) {
      var debt = bal[a.id] || 0;
      var borrowedTx = L.transactions.filter(function (t) { return live(t) && t.fromAccountId === a.id && ['loan_receipt', 'card_purchase', 'expense', 'interest', 'fee', 'family'].indexOf(t.type) >= 0; });
      var borrowed = sum(borrowedTx, function (t) { return t.type === 'loan_receipt' ? (t.debtAmount != null ? t.debtAmount : t.amount) : t.amount + (t.type === 'family' ? (t.fee || 0) : 0); });
      var repayTx = L.transactions.filter(function (t) { return live(t) && t.type === 'repayment' && t.toAccountId === a.id; });
      var repaid = sum(repayTx, function (t) { return t.principal != null ? t.principal : t.amount; });
      var financeTx = L.transactions.filter(function (t) { return live(t) && ((t.type === 'repayment' && t.toAccountId === a.id) || ((t.type === 'interest' || t.type === 'fee') && t.fromAccountId === a.id) || (t.type === 'loan_receipt' && t.fromAccountId === a.id)); });
      var interestPaid = sum(financeTx, function (t) { return txClass(L, t).finance; });
      var plans = L.planned.filter(function (p) { return p.accountId === a.id && p.kind === 'payment' && !p.scenario; });
      var open = plans.filter(function (p) { return plannedState(L, p, today).open; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
      var lastPlan = open.length ? open[open.length - 1].date : null;
      var plannedInterest = sum(open, function (p) { return p.interestPart ? Math.round(plannedState(L, p, today).remaining * p.interestPart / p.amount) : 0; });
      var plannedTotal = sum(open, function (p) { return plannedState(L, p, today).remaining; });
      var totalBase = (a.initialBalance || 0) + borrowed;
      var rateKnown = !!((a.credit && a.credit.aprConfirmed && a.credit.apr != null) || (a.loan && a.loan.aprConfirmed && a.loan.apr != null));
      var rateEstimated = !rateKnown && !!(a.loan && a.loan.aprEstimated != null);
      return {
        acc: a, debt: debt, initial: a.initialBalance || 0, borrowed: borrowed, repaid: repaid,
        progress: totalBase > 0 ? clamp(1 - debt / totalBase, 0, 1) : 1, interestPaid: interestPaid, plannedInterest: plannedInterest,
        plannedTotal: plannedTotal, coveredByPlan: plannedTotal >= debt, rateKnown: rateKnown, rateEstimated: rateEstimated,
        closeDate: debt <= 0 ? 'done' : (plannedTotal >= debt - (plannedInterest ? 0 : 0) && lastPlan ? lastPlan : null),
        lastPlannedDate: lastPlan, openPlans: open.length, term: a.term, status: creditStatus(L, a, debt, today), info: creditInfo(L, a, bal, today),
        purchases: borrowedTx, repayments: repayTx, reborrows: borrowedTx.filter(function (t) { return t.type === 'loan_receipt'; })
      };
    });
    var conv = function (r, v) { return toBase(L, v, r.acc.currency) || 0; };
    var total = sum(rows, function (r) { return conv(r, r.debt); });
    var short = sum(rows.filter(function (r) { return r.term !== 'long'; }), function (r) { return conv(r, r.debt); });
    var allPlanned = rows.every(function (r) { return r.debt <= 0 || r.closeDate; });
    var free = allPlanned ? rows.reduce(function (mx, r) { return r.closeDate && r.closeDate !== 'done' && r.closeDate > mx ? r.closeDate : mx; }, '') : null;
    return { rows: rows, total: total, short: short, long: total - short, repaidTotal: sum(rows, function (r) { return conv(r, r.repaid); }), initialTotal: sum(rows, function (r) { return conv(r, r.initial + r.borrowed); }), debtFreeDate: free || null };
  }
  /* repayment of SHORT-TERM debts with a fixed monthly amount; interest only where a confirmed rate exists */
  function payoffPlan(L, strategy, monthly, order) {
    var bal = balances(L);
    var debts = L.accounts.filter(function (a) { return isLiab(a) && a.term !== 'long' && (bal[a.id] || 0) > 0 && !a.closed; }).map(function (a) {
      var apr = a.credit && a.credit.aprConfirmed ? a.credit.apr : (a.loan && a.loan.aprConfirmed ? a.loan.apr : null);
      return { id: a.id, name: a.name, debt: bal[a.id], apr: apr };
    });
    var unknownRates = debts.filter(function (d) { return d.apr == null; }).map(function (d) { return d.name; });
    if (strategy === 'snowball') debts.sort(function (a, b) { return a.debt - b.debt; });
    else if (strategy === 'avalanche') debts.sort(function (a, b) { return ((b.apr == null ? -1 : b.apr) - (a.apr == null ? -1 : a.apr)) || a.debt - b.debt; });
    else if (order && order.length) debts.sort(function (a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
    var month = 0, steps = [], left = debts.map(function (d) { return Object.assign({}, d); });
    if (!(monthly > 0) || !debts.length) return { order: debts, steps: [], months: debts.length ? null : 0, unknownRates: unknownRates };
    while (left.some(function (d) { return d.debt > 0; }) && month < 240) {
      month++;
      left.forEach(function (d) { if (d.debt > 0 && d.apr != null) d.debt += Math.round(d.debt * d.apr / 100 / 12); });
      var budget = monthly;
      for (var i = 0; i < left.length && budget > 0; i++) {
        var d = left[i]; if (d.debt <= 0) continue;
        var pay = Math.min(budget, d.debt); d.debt -= pay; budget -= pay;
        if (d.debt === 0) steps.push({ id: d.id, name: d.name, month: month });
      }
    }
    return { order: debts, steps: steps, months: month >= 240 ? null : month, unknownRates: unknownRates };
  }
  function earlyPayoffImpact(L, accId, extra) {
    var a = byId(L.accounts, accId); if (!a || !a.loan || !a.loan.monthlyPayment) return null;
    var r = a.loan.aprConfirmed && a.loan.apr != null ? a.loan.apr / 100 / 12 : a.loan.aprEstimated;
    if (r == null) return { unknownRate: true };
    var bal = balances(L)[a.id];
    var base = amortize(bal, r, a.loan.monthlyPayment);
    var early = amortize(Math.max(0, bal - extra), r, a.loan.monthlyPayment);
    var bi = sum(base, function (x) { return x.interest; }), ni = sum(early, function (x) { return x.interest; });
    return { estimated: !a.loan.aprConfirmed, baseMonths: base.length, newMonths: early.length, monthsSaved: base.length - early.length, baseInterest: bi, newInterest: ni, interestSaved: bi - ni };
  }

  /* ---------- scenario simulator ---------- */
  var HORIZON_MIN = 1, HORIZON_MAX = 36, HORIZON_DEFAULT = 5;
  function clampHorizon(n) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n < HORIZON_MIN) return HORIZON_DEFAULT;
    return Math.max(HORIZON_MIN, Math.min(HORIZON_MAX, n));
  }
  /* First budget month still relevant today: roll with the calendar, but if the plan
     starts later (income at month-end funds the next month), start there. */
  function simStartYm(L, today) {
    today = today || todayISO();
    var cur = ymOf(today), first = L ? firstPlanMonth(L) : cur;
    return (first && first > cur) ? first : cur;
  }
  function scenarioLineInMonth(line, ym) {
    if (!line || !line.start || !(line.amount > 0) || !ym || ym < line.start) return 0;
    var n = 0, x = line.start;
    while (x < ym && n < 240) { x = addMonths(x, 1); n++; }
    if (line.repeat === 'monthly') return n < Math.max(1, parseInt(line.count, 10) || 1) ? (line.amount || 0) : 0;
    return n === 0 ? (line.amount || 0) : 0;
  }
  function scenarioLinesInMonth(lines, ym) {
    var income = 0, expense = 0;
    (lines || []).forEach(function (ln) {
      var v = scenarioLineInMonth(ln, ym);
      if (ln.kind === 'expense') expense += v; else income += v;
    });
    return { income: income, expense: expense };
  }
  function planParts(mp) {
    var income = 0, borrow = 0, parents = 0, loans = 0, expenses = 0, other = 0;
    (mp.items || []).forEach(function (it) {
      if (it.kind === 'income' || it.kind === 'unplannedIn') income += it.amount;
      else if (it.kind === 'borrow') borrow += it.amount;
      else if (it.kind === 'family') parents += -it.amount;
      else if (it.kind === 'payment') loans += -it.amount;
      else if (it.kind === 'personal') expenses += -it.amount;
      else other += -it.amount;
    });
    return { income: income, borrow: borrow, parents: parents, loans: loans, expenses: expenses, other: other };
  }
  /* Flat calc when no ledger is passed (legacy). With a ledger, each month equals
     monthPlan (бюджетные периоды / плановые платежи) plus what-if extra lines. */
  function scenarioCalc(s, L, today, opts) {
    s = s || {}; opts = opts || {};
    today = today || opts.today || todayISO();
    var months = clampHorizon(s.months), lines = Array.isArray(s.lines) ? s.lines : [];
    var startYm = s.startYm || (L ? simStartYm(L, today) : ymOf(today));
    var ov = s.overrides || {};
    var usePlan = !!(L && s.usePlan !== false);
    var rows = [], cum = 0, i, ym, extra, result, parts, income, out, mon, saved = 0;
    if (usePlan) {
      for (i = 0; i < months; i++) {
        ym = addMonths(startYm, i);
        var mp = monthPlan(L, ym, opts);
        parts = planParts(mp);
        income = parts.income + parts.borrow;
        if (ov.income) income = (s.income || 0) + parts.borrow;
        out = mp.out;
        if (ov.parents) out = out - parts.parents + (s.parents || 0);
        if (ov.loans) out = out - parts.loans + (s.loans || 0);
        if (ov.expenses) out = out - parts.expenses + (s.expenses || 0);
        if (ov.other) out = out - parts.other + (s.other || 0);
        extra = scenarioLinesInMonth(lines, ym);
        result = income - out + extra.income - extra.expense;
        if (ov.savings) result -= (s.savings || 0);
        cum += result;
        rows.push({ n: i + 1, ym: ym, income: income, out: out, extraIn: extra.income, extraOut: extra.expense, result: result, free: cum, cumulative: cum, parts: parts });
      }
      return { monthly: rows[0] ? rows[0].result : 0, total: cum, savedTotal: cum, startYm: startYm, months: months, rows: rows, fromPlan: true };
    }
    mon = (s.income || 0) - (s.parents || 0) - (s.loans || 0) - (s.expenses || 0) - (s.savings || 0) - (s.other || 0);
    saved = s.savings || 0;
    for (i = 1; i <= months; i++) {
      ym = addMonths(startYm, i - 1);
      extra = scenarioLinesInMonth(lines, ym);
      result = mon + extra.income - extra.expense;
      cum += result;
      rows.push({ n: i, ym: ym, result: result, free: cum, cumulative: cum + saved * i, extraIn: extra.income, extraOut: extra.expense });
    }
    return { monthly: rows[0] ? rows[0].result : mon, total: cum, savedTotal: cum + saved * months, startYm: startYm, months: months, rows: rows, fromPlan: false };
  }
  function scenarioLinesTotal(lines, startYm, months, mode) {
    var t = 0, i, e;
    for (i = 0; i < months; i++) {
      e = scenarioLinesInMonth(lines, addMonths(startYm, i));
      t += mode === 'in' ? e.income : mode === 'out' ? e.expense : (e.income - e.expense);
    }
    return t;
  }

  /* ---------- goals ---------- */
  function goalStatus(L, g, today) {
    today = today || todayISO();
    var bal = balances(L), cur = 0, history = [], gc = g.currency || 'AED';
    var live = function (t) { return t.status !== 'void'; };
    var contrib = (g.contributions || []).map(function (c) { return { date: c.date, amount: c.amount, note: c.note, id: c.id, manual: true }; });
    if (g.type === 'short_debt') {
      var ds = debtSummary(L, today);
      cur = Math.max(0, g.target - ds.short);
      history = L.transactions.filter(function (t) { return live(t) && t.type === 'repayment' && (byId(L.accounts, t.toAccountId) || {}).term !== 'long'; }).map(function (t) { return { date: t.date, amount: t.principal != null ? t.principal : t.amount }; });
    } else if (g.type === 'family_monthly') {
      var ym = ymOf(today);
      cur = sum(L.transactions.filter(function (t) { return live(t) && t.type === 'family' && ymOf(t.date) === ym; }), function (t) { return toBase(L, t.amount, txCurrency(L, t)); });
      history = L.transactions.filter(function (t) { return live(t) && t.type === 'family'; }).map(function (t) { return { date: t.date, amount: t.amount }; });
    } else if (g.type === 'extra_income') {
      var from = addDays(today, -30);
      var isExtra = function (t) { return live(t) && t.type === 'income' && (t.categoryId === 'extra' || t.projectId); };
      var inc = sum(L.transactions.filter(function (t) { return isExtra(t) && t.date.slice(0, 10) >= from; }), function (t) { return toBase(L, t.amount, txCurrency(L, t)); });
      cur = fromBase(L, inc, gc) || 0;
      history = L.transactions.filter(isExtra).map(function (t) { return { date: t.date, amount: t.amount }; });
    } else if (g.accountId) {
      var acc = byId(L.accounts, g.accountId);
      cur = acc ? (bal[acc.id] || 0) : 0;
      if (acc && acc.currency !== gc) cur = fromBase(L, toBase(L, cur, acc.currency), gc) || 0;
      cur += sum(contrib, function (c) { return c.amount; });
      history = L.transactions.filter(function (t) { return live(t) && acc && t.toAccountId === acc.id; }).map(function (t) { return { date: t.date, amount: t.toAmount != null ? t.toAmount : t.amount }; }).concat(contrib);
    } else {
      cur = sum(contrib, function (c) { return c.amount; });
      var tagged = L.transactions.filter(function (t) { return live(t) && t.goalId === g.id; });
      cur += sum(tagged, function (t) { return t.recipientCurrency === gc && t.recipientAmount ? t.recipientAmount : (fromBase(L, toBase(L, t.amount, txCurrency(L, t)), gc) || 0); });
      history = tagged.map(function (t) { return { date: t.date, amount: t.amount }; }).concat(contrib);
    }
    history.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var pct = g.target ? clamp(cur / g.target, 0, 1) : 0;
    var forecast = null, forecastBasis = null;
    if (g.target > 0 && cur >= g.target) forecast = 'done';
    else if (g.type === 'short_debt') {
      var ds2 = debtSummary(L, today), last = '', ok = true;
      ds2.rows.forEach(function (r) { if (r.term !== 'long' && r.debt > 0) { if (!r.closeDate) ok = false; else if (r.closeDate > last) last = r.closeDate; } });
      forecast = ok ? last || null : null; forecastBasis = 'plannedPayments';
    } else if (g.type === 'reserve') {
      var series = planSeries(L, simStartYm(L, today), 36, { today: today });
      var need = (toBase(L, g.target, gc) || 0) - (toBase(L, cur, gc) || 0), acc2 = 0;
      for (var i = 0; i < series.length; i++) {
        // only surpluses of periods after all deficits are covered (cumulative > 0) can go to the reserve
        if (series[i].cumulative > 0) acc2 = Math.max(acc2, series[i].cumulative);
        if (acc2 >= need) { forecast = lastDay(series[i].ym); break; }
      }
      forecastBasis = 'planSurplus';
    } else if (history.length >= 2) {
      var first = history[history.length - 1].date.slice(0, 10), span = Math.max(30, diffDays(first, today));
      var r = cur / span; if (r > 0) { forecast = addDays(today, Math.ceil((g.target - cur) / r)); forecastBasis = 'pace'; }
    }
    return { goal: g, current: cur, target: g.target, pct: pct, remaining: Math.max(0, g.target - cur), forecast: forecast, forecastBasis: forecastBasis, history: history, done: g.target > 0 && cur >= g.target };
  }

  /* ---------- family support ---------- */
  function familyStatus(L, today) {
    var plans = L.planned.filter(function (p) { return p.kind === 'family'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var planTotal = sum(plans, function (p) { return p.amount; });
    var sentPlanned = sum(plans, function (p) { return plannedState(L, p, today).paid; });
    var txs = L.transactions.filter(function (t) { return t.status !== 'void' && t.type === 'family'; });
    var sentTotal = sum(txs, function (t) { return toBase(L, t.amount, txCurrency(L, t)) || 0; });
    var fees = sum(txs, function (t) { return toBase(L, t.fee || 0, txCurrency(L, t)) || 0; });
    return { plans: plans.map(function (p) { return { p: p, st: plannedState(L, p, today) }; }), planTotal: planTotal, sentPlanned: sentPlanned, sentTotal: sentTotal, remaining: Math.max(0, planTotal - sentPlanned), fees: fees, txs: txs };
  }

  /* ---------- financial health score (transparent, internal, NOT a credit rating) ---------- */
  function healthScore(L, today) {
    today = today || todayISO();
    var m = metrics(L, today), parts = [];
    var incPlans = L.planned.filter(function (p) { return p.kind === 'income' && !p.scenario; });
    var monthlyIncome = incPlans.length ? Math.round(sum(incPlans, function (p) { return p.amount; }) / incPlans.length) : 0;
    var nextYm = addMonths(ymOf(today), 1);
    var mp = monthPlan(L, nextYm, { today: today });
    var debtPay = -sum(mp.items.filter(function (i) { return i.kind === 'payment'; }), function (i) { return i.amount; });
    var add = function (id, max, score, value) { parts.push({ id: id, max: max, score: Math.round(clamp(score, 0, max) * 10) / 10, value: value }); };
    add('reserve', 20, 20 * Math.min(1, m.reserved / 500000), m.reserved);
    add('shortDebt', 15, monthlyIncome ? 15 * (1 - Math.min(1, m.shortDebt / (3 * monthlyIncome))) : (m.shortDebt ? 0 : 15), m.shortDebt);
    var dsr = monthlyIncome ? debtPay / monthlyIncome : null;
    add('debtService', 15, dsr == null ? 0 : 15 * clamp((0.6 - dsr) / 0.4, 0, 1), dsr);
    var overdue = L.planned.filter(function (p) { return !p.scenario && plannedState(L, p, today).status === 'overdue'; }).length;
    add('overdue', 15, 15 - 5 * overdue, overdue);
    var ratio = mp.income ? (mp.income - mp.out) / mp.income : null;
    add('incomeVsObligations', 10, ratio == null ? 0 : 10 * clamp(ratio / 0.2, 0, 1), ratio);
    var bs = budgetStatus(L, ymOf(today), today);
    var used = bs.total.limit ? bs.total.spent / bs.total.limit : 0;
    add('budget', 10, used <= 1 ? 10 : 10 * clamp(2 - used, 0, 1), used);
    var spentAll = sum(Object.keys(bs.spent), function (k) { return bs.spent[k]; });
    var imp = sum(L.categories.filter(function (c) { return c.impulse; }), function (c) { return bs.spent[c.id] || 0; });
    var impShare = spentAll ? imp / spentAll : 0;
    add('impulse', 5, 5 * clamp((0.25 - impShare) / 0.2, 0, 1), impShare);
    var confirmed = incPlans.filter(function (p) { return p.confirmed; });
    var stab = confirmed.length ? sum(confirmed, function (p) { return Math.min(1, plannedState(L, p, today).paid / (p.amount || 1)); }) / confirmed.length : null;
    add('incomeStability', 5, stab == null ? 2.5 : 5 * stab, stab);
    var past = balances(L, addDays(today, -30)), now = 0, then = 0;
    ownAccounts(L).forEach(function (a) { if (a.role === 'reserve' || a.role === 'savings') { then += toBase(L, past[a.id], a.currency) || 0; now += toBase(L, m.balances[a.id], a.currency) || 0; } });
    add('savingsTrend', 5, now > then ? 5 : now === then ? 2.5 : 0, now - then);
    return { score: Math.round(sum(parts, function (p) { return p.score; })), parts: parts };
  }

  /* ---------- "Can I afford it?" ---------- */
  function purchaseCheck(L, q, today) {
    today = today || todayISO();
    var amount = q.amount || 0, acc = byId(L.accounts, q.accountId), cat = byId(L.categories, q.categoryId);
    var m = metrics(L, today), bal = m.balances, res = { amount: amount, flags: [] };
    var essential = q.essential != null ? q.essential : !!(cat && ['groceries', 'food', 'health', 'transport'].indexOf(cat.id) >= 0);
    res.essential = essential;
    if (acc && isLiab(acc)) {
      var ci = creditInfo(L, acc, bal, today);
      res.viaCredit = true; res.creditAvailableAfter = (ci.available || 0) - amount; res.debtAfter = ci.debt + amount;
      if (acc.type === 'credit_card' && amount > (ci.available || 0)) res.flags.push('overLimit');
      res.flags.push('creditNotReserve');
    } else if (acc) {
      res.accountAfter = (bal[acc.id] || 0) - amount;
      if (res.accountAfter < 0) res.flags.push('insufficient');
    }
    res.freeAfter = m.free - amount;
    res.liquidAfter = m.liquid - (res.viaCredit ? 0 : amount);
    var bs = budgetStatus(L, ymOf(today), today);
    var top = cat ? (cat.parent ? byId(L.categories, cat.parent) : cat) : null;
    var row = bs.rows.filter(function (r) { return (cat && r.id === cat.id) || (top && r.id === top.id); })[0] || null;
    res.categoryRemainingAfter = row ? row.remaining - amount : null;
    res.budgetRemainingAfter = bs.total.remaining - amount;
    if (res.budgetRemainingAfter < 0) res.flags.push('budget');
    if (row && res.categoryRemainingAfter < 0) res.flags.push('categoryBudget');
    var fc = dailyForecast(L, today, 45);
    res.forecastMinBefore = fc.min;
    res.forecastMinAfter = fc.min - (res.viaCredit ? 0 : amount);
    if (res.forecastMinAfter < 0) res.flags.push('cashGap');
    res.obligations = m.obligations;
    if (!res.viaCredit && res.freeAfter < 0) res.flags.push('obligations');
    var famOpen = L.planned.filter(function (p) { return p.kind === 'family' && !p.scenario && plannedState(L, p, today).open && p.date <= addDays(today, 45); });
    res.familyAtRisk = !res.viaCredit && famOpen.length > 0 && res.forecastMinAfter < 0;
    if (res.familyAtRisk) res.flags.push('family');
    res.reserveTouched = !res.viaCredit && amount > m.liquid && m.reserved > 0;
    if (res.reserveTouched) res.flags.push('reserve');
    res.bigNonEssential = !essential && amount > 20000;
    if (res.bigNonEssential) res.flags.push('big');
    var severe = res.flags.filter(function (f) { return ['insufficient', 'obligations', 'cashGap', 'overLimit', 'family', 'reserve'].indexOf(f) >= 0; }).length;
    var mild = res.flags.filter(function (f) { return ['budget', 'categoryBudget', 'big', 'creditNotReserve'].indexOf(f) >= 0; }).length;
    res.verdict = severe ? 'violates' : mild ? 'risk' : 'ok';
    return res;
  }

  /* ---------- in-app notifications ---------- */
  function notifications(L, today) {
    today = today || todayISO();
    var out = [], m = metrics(L, today), soon = addDays(today, 3);
    L.planned.forEach(function (p) {
      if (p.scenario) return;
      var st = plannedState(L, p, today);
      if (p.kind === 'income') {
        if (!p.confirmed && st.status !== 'skipped' && p.date <= today) out.push({ id: 'inc:' + p.id, type: 'confirmIncome', level: 'warn', ref: p.id, date: p.date, title: p.title, amount: p.amount });
        return;
      }
      if (!st.open) return;
      if (st.status === 'overdue') out.push({ id: 'over:' + p.id, type: 'overdue', level: 'danger', ref: p.id, date: p.date, title: p.title, amount: st.remaining });
      else if (p.date <= soon) out.push({ id: 'due:' + p.id + ':' + p.date, type: 'dueSoon', level: 'warn', ref: p.id, date: p.date, title: p.title, amount: st.remaining });
    });
    var bs = budgetStatus(L, ymOf(today), today);
    bs.rows.forEach(function (r) { if (r.exceeded) out.push({ id: 'bud:' + r.id + ':' + bs.ym + ':' + r.spent, type: 'budget', level: 'danger', ref: r.id, amount: r.spent - r.limit }); });
    if (bs.total.exceeded) out.push({ id: 'budtot:' + bs.ym + ':' + bs.total.spent, type: 'budgetTotal', level: 'danger', amount: bs.total.spent - bs.total.limit });
    var up14 = upcoming(L, today, 14);
    var need14 = sum(up14.filter(function (x) { return x.p.kind === 'payment' || x.p.kind === 'family'; }), function (x) { return x.st.remaining; });
    var inc14 = sum(up14.filter(function (x) { return x.p.kind === 'income' && !x.p.confirmed; }), function (x) { return x.p.amount; });
    if (need14 > m.liquid + inc14) out.push({ id: 'low:' + today, type: 'lowFunds', level: 'danger', amount: need14 - m.liquid - inc14 });
    var fc = dailyForecast(L, today, 62);
    if (fc.firstDeficit) out.push({ id: 'gap:' + fc.firstDeficit + ':' + fc.min, type: 'cashGap', level: 'danger', date: fc.firstDeficit, amount: fc.min });
    (L.goals || []).forEach(function (g) { var gs = goalStatus(L, g, today); if (gs.done) out.push({ id: 'goal:' + g.id, type: 'goalDone', level: 'ok', ref: g.id, title: g.title }); });
    L.accounts.forEach(function (a) { if (a.type === 'credit_card' && !a.closed) { var ci = creditInfo(L, a, m.balances, today); if (ci.overLimit > 0) out.push({ id: 'ol:' + a.id + ':' + ci.debt, type: 'overLimit', level: 'danger', ref: a.id, title: a.name, amount: ci.overLimit }); } });
    var ym = ymOf(today), ld = lastDay(ym);
    if (diffDays(today, ld) <= 1) out.push({ id: 'month:' + ym, type: 'monthEnd', level: 'info', ref: ym, date: ld });
    var dismissed = L.dismissed || {};
    return out.map(function (n) { n.dismissed = !!dismissed[n.id]; return n; });
  }
  /* month-end reconciliation answers */
  function monthReview(L, ym, today) {
    var from = ym + '-01', to = lastDay(ym);
    var txs = L.transactions.filter(function (t) { var d = t.date.slice(0, 10); return t.status !== 'void' && d >= from && d <= to; });
    var received = 0, spent = 0, family = 0, finance = 0;
    txs.forEach(function (t) { var c = txClass(L, t), cur = txCurrency(L, t); received += toBase(L, c.earned + c.returnFunds, cur) || 0; spent += toBase(L, c.consumer, cur) || 0; family += toBase(L, c.family, cur) || 0; finance += toBase(L, c.finance, cur) || 0; });
    var payments = L.planned.filter(function (p) { return (p.kind === 'payment' || p.kind === 'family') && !p.scenario && ymOf(p.date) === ym; }).map(function (p) { return { p: p, st: plannedState(L, p, to < (today || todayISO()) ? (today || todayISO()) : to) }; });
    var startB = balances(L, addDays(from, -1)), endB = balances(L, to), dS = 0, dE = 0, sS = 0, sE = 0;
    L.accounts.forEach(function (a) {
      if (isLiab(a)) { dS += toBase(L, startB[a.id], a.currency) || 0; dE += toBase(L, endB[a.id], a.currency) || 0; }
      else if (a.role === 'reserve' || a.role === 'savings') { sS += toBase(L, startB[a.id], a.currency) || 0; sE += toBase(L, endB[a.id], a.currency) || 0; }
    });
    var incomes = L.planned.filter(function (p) { return p.kind === 'income' && ymOf(p.date) === ym && !p.scenario; });
    return { ym: ym, received: received, spent: spent, finance: finance, family: family, payments: payments, incomes: incomes, saved: sE - sS, debtStart: dS, debtEnd: dE, debtChange: dE - dS, nextPlan: monthPlan(L, addMonths(ym, 1), { today: today }) };
  }

  /* ---------- business & investments ---------- */
  function projectStats(L, pid) {
    var txs = L.transactions.filter(function (t) { return t.status !== 'void' && t.projectId === pid; });
    var inc = 0, exp = 0, inv = 0, months = {};
    txs.forEach(function (t) {
      var v = toBase(L, t.amount, txCurrency(L, t)) || 0, ym = ymOf(t.date);
      months[ym] = months[ym] || { income: 0, out: 0 };
      if (t.type === 'income' || t.type === 'salary') { inc += v; months[ym].income += v; }
      else if (t.projectFlow === 'investment') { inv += v; months[ym].out += v; }
      else { exp += v; months[ym].out += v; }
    });
    var net = inc - exp - inv, mk = Object.keys(months).sort(), avg = mk.length ? (inc - exp) / mk.length : 0;
    return { income: inc, expenses: exp, invested: inv, net: net, roi: (exp + inv) ? net / (exp + inv) : null, margin: inc ? (inc - exp) / inc : null, paybackMonths: inv > 0 && avg > 0 ? Math.ceil(inv / avg) : null, months: months, txs: txs };
  }
  function assetValue(L, a) {
    var value = Math.round((a.qty || 0) * (a.price || 0)), cost = a.costBasis || 0;
    return { value: value, valueBase: toBase(L, value, a.currency), cost: cost, pl: value - cost, plPct: cost ? (value - cost) / cost : null };
  }

  /* ---------- statistics ---------- */
  function periodRange(kind, today, custom) {
    today = today || todayISO();
    var d = parseD(today), from, to = today;
    if (kind === 'day') from = today;
    else if (kind === 'week') { var wd = (d.getDay() + 6) % 7; from = addDays(today, -wd); to = addDays(from, 6); }
    else if (kind === 'month') { from = ymOf(today) + '-01'; to = lastDay(ymOf(today)); }
    else if (kind === 'quarter') { var q = Math.floor(d.getMonth() / 3) * 3; from = d.getFullYear() + '-' + pad(q + 1) + '-01'; to = lastDay(d.getFullYear() + '-' + pad(q + 3)); }
    else if (kind === 'year') { from = d.getFullYear() + '-01-01'; to = d.getFullYear() + '-12-31'; }
    else { from = (custom && custom.from) || addDays(today, -30); to = (custom && custom.to) || today; }
    return { from: from, to: to };
  }
  function flows(L, from, to, f) {
    f = f || {};
    var r = { earned: 0, returnFunds: 0, consumer: 0, finance: 0, family: 0, borrowed: 0, principal: 0, txs: [], cashOut: 0 };
    L.transactions.forEach(function (t) {
      if (t.status === 'void') return;
      var d = t.date.slice(0, 10); if (d < from || d > to) return;
      if (f.accounts && f.accounts.length && f.accounts.indexOf(t.fromAccountId) < 0 && f.accounts.indexOf(t.toAccountId) < 0) return;
      if (f.categories && f.categories.length) { var c0 = byId(L.categories, t.categoryId); if (!c0 || (f.categories.indexOf(c0.id) < 0 && f.categories.indexOf(c0.parent) < 0)) return; }
      var c = txClass(L, t), cur = txCurrency(L, t);
      Object.keys(c).forEach(function (k) { r[k] += toBase(L, c[k], cur) || 0; });
      r.txs.push(t);
      var fromA = byId(L.accounts, t.fromAccountId);
      if (fromA && !isLiab(fromA)) {
        if (['expense', 'repayment', 'fee', 'interest'].indexOf(t.type) >= 0) r.cashOut += toBase(L, t.amount, cur) || 0;
        else if (t.type === 'family') r.cashOut += toBase(L, t.amount + (t.fee || 0), cur) || 0;
        else if (['transfer', 'reserve_topup', 'savings_topup'].indexOf(t.type) >= 0) r.cashOut += toBase(L, t.fee || 0, cur) || 0;
      }
    });
    r.cashIn = r.earned + r.returnFunds + r.borrowed;
    r.net = r.cashIn - r.cashOut;
    return r;
  }
  function balanceHistory(L, from, to, step, accountIds) {
    step = step || 1;
    var out = [];
    for (var d = from; d <= to; d = addDays(d, step)) {
      var b = balances(L, d), own = 0, debt = 0;
      L.accounts.forEach(function (a) {
        if (accountIds && accountIds.length && accountIds.indexOf(a.id) < 0) return;
        var v = toBase(L, b[a.id], a.currency) || 0; if (isLiab(a)) debt += v; else own += v;
      });
      out.push({ date: d, own: own, debt: debt, net: own - debt, per: b });
    }
    return out;
  }
  /* projected total debt by month from open planned payments (principal parts only) */
  function debtProjection(L, today, months) {
    today = today || todayISO();
    var ds = debtSummary(L, today), cur = ds.total, out = [{ ym: ymOf(today), debt: cur }];
    for (var i = 1; i <= months; i++) {
      var ym = addMonths(ymOf(today), i - 1);
      L.planned.forEach(function (p) {
        if (p.kind !== 'payment' || p.scenario || !p.accountId || ymOf(p.date) !== ym) return;
        var st = plannedState(L, p, today); if (!st.open) return;
        var princ = p.interestPart ? st.remaining - Math.round(st.remaining * p.interestPart / p.amount) : st.remaining;
        cur -= toBase(L, princ, p.currency || 'AED') || 0;
      });
      out.push({ ym: addMonths(ymOf(today), i), debt: Math.max(0, cur) });
    }
    return out;
  }

  /* ---------- rule-based analytics assistant (NOT AI) ---------- */
  var ASSIST_RULES = [
    ['spendToday', /потрат\S*\s.*сегодня|сегодня.*потрат|spend.*today|today.*spend/],
    ['upcoming', /платеж\S*\s.*прибл|ближайш|upcoming|payments? (due|coming)/],
    ['untilSalary', /хватит|до зарплат|until pay|enough money|last until/],
    ['shortDebt', /кратк|short.?term/],
    ['reserve5000', /5\s?000|резерв|reserve/],
    ['incomeDrop', /доход\S*\s.*(умень|сниз|упад)|income.*(drop|fall|decreas|lower)/],
    ['parents', /родител|parents/],
    ['cut', /сократ|cut|reduce/],
    ['interest', /процент|interest/]
  ];
  function assistant(L, q, today, lang) {
    today = today || todayISO(); lang = lang || 'ru';
    var s = String(q || '').toLowerCase(), F = function (v) { return fmt(v, { lang: lang }); };
    var id = null;
    for (var i = 0; i < ASSIST_RULES.length; i++) if (ASSIST_RULES[i][1].test(s)) { id = ASSIST_RULES[i][0]; break; }
    var m = metrics(L, today), bs = budgetStatus(L, ymOf(today), today), lines = [];
    switch (id) {
      case 'spendToday':
        var safe = Math.max(0, Math.min(bs.total.daily, m.free));
        lines.push(L2(lang, 'Личный бюджет месяца: осталось ' + F(bs.total.remaining) + ' — это ' + F(bs.total.daily) + ' в день на ' + bs.daysLeft + ' дн.', 'Monthly personal budget left: ' + F(bs.total.remaining) + ' — ' + F(bs.total.daily) + '/day for ' + bs.daysLeft + ' days.'));
        lines.push(L2(lang, 'Свободные собственные деньги после обязательств ближайших ' + (L.settings.obligationsHorizonDays || 30) + ' дн.: ' + F(m.free) + '.', 'Own free money after obligations of the next ' + (L.settings.obligationsHorizonDays || 30) + ' days: ' + F(m.free) + '.'));
        lines.push(L2(lang, 'Безопасная сумма на сегодня: ' + F(safe) + (m.free <= 0 ? ' — обязательства уже превышают собственные деньги, кредитный лимит не считается.' : '.'), 'Safe amount for today: ' + F(safe) + (m.free <= 0 ? ' — obligations already exceed own money; credit limits are not counted.' : '.')));
        break;
      case 'upcoming':
        var up = upcoming(L, today, 30).filter(function (x) { return x.p.kind === 'payment' || x.p.kind === 'family'; });
        if (!up.length) lines.push(L2(lang, 'В ближайшие 30 дней обязательных платежей нет.', 'No obligations in the next 30 days.'));
        up.slice(0, 10).forEach(function (x) { lines.push(x.p.date + ' · ' + x.p.title + ' · ' + F(x.st.remaining) + (x.p.dateConfirmed === false ? L2(lang, ' (дата не подтверждена)', ' (date unconfirmed)') : '')); });
        break;
      case 'untilSalary':
        var nextInc = L.planned.filter(function (p) { return p.kind === 'income' && !p.confirmed && !p.scenario && p.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
        var until = nextInc ? nextInc.date : addDays(today, 30);
        var need = sum(upcoming(L, today, Math.max(0, diffDays(today, until) - 1)).filter(function (x) { return x.p.kind === 'payment' || x.p.kind === 'family'; }), function (x) { return x.st.remaining; });
        lines.push(L2(lang, 'Следующее плановое поступление: ' + (nextInc ? nextInc.date + ', ' + F(nextInc.amount) : 'нет в плане') + '.', 'Next planned income: ' + (nextInc ? nextInc.date + ', ' + F(nextInc.amount) : 'none planned') + '.'));
        lines.push(L2(lang, 'Собственные свободные деньги: ' + F(m.liquid) + '; обязательства до этой даты: ' + F(need) + '.', 'Own liquid money: ' + F(m.liquid) + '; obligations before then: ' + F(need) + '.'));
        lines.push(m.liquid >= need ? L2(lang, 'Да, до поступления хватает (без учёта незапланированных трат).', 'Yes, it lasts until then (excluding unplanned spending).') : L2(lang, 'Не хватает ' + F(need - m.liquid) + '. Кредитный лимит не считается собственными деньгами.', 'Short by ' + F(need - m.liquid) + '. Credit limits are not own money.'));
        var fc = dailyForecast(L, today, 62);
        if (fc.firstDeficit) lines.push(L2(lang, 'Прогноз кассового разрыва: ' + fc.firstDeficit + ' (минимум ' + F(fc.min) + ' на ' + fc.minDate + ').', 'Projected cash gap: ' + fc.firstDeficit + ' (low ' + F(fc.min) + ' on ' + fc.minDate + ').'));
        break;
      case 'shortDebt':
        var gsd = (L.goals || []).filter(function (g) { return g.type === 'short_debt'; })[0];
        var ds = debtSummary(L, today);
        lines.push(L2(lang, 'Краткосрочный долг сейчас: ' + F(ds.short) + '.', 'Short-term debt now: ' + F(ds.short) + '.'));
        if (ds.short <= 0) lines.push(L2(lang, 'Краткосрочных долгов нет.', 'No short-term debt.'));
        else {
          var st = gsd ? goalStatus(L, gsd, today) : null;
          if (st && st.forecast && st.forecast !== 'done') lines.push(L2(lang, 'По запланированным платежам последний краткосрочный платёж — ' + st.forecast + '. Это зависит от фактических поступлений и сценария повторного займа.', 'Per planned payments the last short-term payment is on ' + st.forecast + '. Depends on actual income and the re-borrow scenario.'));
          else lines.push(L2(lang, 'Не для всех краткосрочных долгов есть план полного погашения — дату закрытия рассчитать нельзя. Добавьте платежи в Планировании.', 'Not every short-term debt has a full repayment plan, so a payoff date cannot be computed. Add payments in Planning.'));
          var unplanned = ds.rows.filter(function (r) { return r.term !== 'long' && r.debt > 0 && !r.closeDate; }).map(function (r) { return r.acc.name + ' (' + F(r.debt - r.plannedTotal) + L2(lang, ' без плана', ' unplanned') + ')'; });
          if (unplanned.length) lines.push(unplanned.join(', '));
        }
        break;
      case 'reserve5000':
        var g = (L.goals || []).filter(function (x) { return x.type === 'reserve'; })[0];
        if (g) {
          var gs = goalStatus(L, g, today);
          lines.push(L2(lang, 'Резерв: ' + F(gs.current) + ' из ' + F(gs.target) + '.', 'Reserve: ' + F(gs.current) + ' of ' + F(gs.target) + '.'));
          lines.push(gs.forecast ? L2(lang, 'Прогноз по плану бюджетных периодов: ' + (gs.forecast === 'done' ? 'цель достигнута' : 'к ' + gs.forecast) + ' — если весь остаток периодов направлять в резерв. Это не гарантия.', 'Plan-based forecast: ' + (gs.forecast === 'done' ? 'achieved' : 'by ' + gs.forecast) + ' — if every period surplus goes to the reserve. Not guaranteed.') : L2(lang, 'По текущему плану положительного остатка недостаточно для прогноза.', 'The current plan surplus is not enough for a forecast.'));
        } else lines.push(L2(lang, 'Цель «Резерв» не создана.', 'No reserve goal yet.'));
        break;
      case 'incomeDrop':
        (L.scenarios || []).forEach(function (sc) { var r = scenarioCalc(sc); lines.push((sc.name[lang] || sc.name.ru) + ': ' + L2(lang, 'доход ', 'income ') + F(sc.income) + ' → ' + F(r.monthly) + L2(lang, '/мес, за ', '/mo, over ') + sc.months + L2(lang, ' мес.: ', ' mo: ') + F(r.total)); });
        var bsc = byId(L.scenarios || [], 'base') || (L.scenarios || [])[0] || {}, need = (bsc.parents || 0) + (bsc.loans || 0) + (bsc.expenses || 0) + (bsc.savings || 0) + (bsc.other || 0);
        lines.push(L2(lang, 'При доходе ниже ' + F(need) + ' в месяц базовый план (родители + кредиты + личные) не покрывается. Параметры меняются в сценарном симуляторе.', 'Below ' + F(need) + ' per month the base plan (parents + loans + personal) is not covered. Adjust in the scenario simulator.'));
        break;
      case 'parents':
        var fs = familyStatus(L, today);
        lines.push(L2(lang, 'Отправлено родителям всего: ' + F(fs.sentTotal) + ' (комиссии ' + F(fs.fees) + ').', 'Sent to parents in total: ' + F(fs.sentTotal) + ' (fees ' + F(fs.fees) + ').'));
        lines.push(L2(lang, 'План: ' + F(fs.planTotal) + ', выполнено ' + F(fs.sentPlanned) + ', осталось ' + F(fs.remaining) + '.', 'Plan: ' + F(fs.planTotal) + ', done ' + F(fs.sentPlanned) + ', remaining ' + F(fs.remaining) + '.'));
        break;
      case 'cut':
        var ranked = Object.keys(bs.spent).filter(function (k) { var c = byId(L.categories, k); return c && !c.system; }).sort(function (a, b) { return bs.spent[b] - bs.spent[a]; });
        if (!ranked.length) lines.push(L2(lang, 'В этом месяце ещё нет записанных расходов — сравнивать нечего.', 'No spending recorded this month — nothing to compare yet.'));
        ranked.slice(0, 6).forEach(function (k) { var c = byId(L.categories, k); lines.push((c.name[lang] || c.name.ru) + ': ' + F(bs.spent[k]) + (c.impulse ? L2(lang, ' — импульсивные, сокращать первыми', ' — impulse, cut first') : '')); });
        bs.rows.filter(function (r) { return r.overrun > 0; }).forEach(function (r) { var c = byId(L.categories, r.id); lines.push(L2(lang, 'Прогноз перерасхода «' + c.name.ru + '»: ' + F(r.overrun), 'Projected overrun "' + c.name.en + '": ' + F(r.overrun))); });
        break;
      case 'interest':
        var ds3 = debtSummary(L, today), paidI = sum(ds3.rows, function (r) { return toBase(L, r.interestPaid, r.acc.currency) || 0; }), planI = sum(ds3.rows, function (r) { return r.plannedInterest; });
        lines.push(L2(lang, 'Фактически уплачено процентов и комиссий по записанным операциям: ' + F(paidI) + '.', 'Interest & fees actually paid (recorded): ' + F(paidI) + '.'));
        if (planI) lines.push(L2(lang, 'Расчётная процентная часть будущих платежей по кредитам (где известно разделение): ' + F(planI) + ' — оценка.', 'Estimated interest in future payments (where the split is known): ' + F(planI) + ' — estimate.'));
        var unk = ds3.rows.filter(function (r) { return !r.rateKnown && r.debt > 0; }).map(function (r) { return r.acc.name; });
        if (unk.length) lines.push(L2(lang, 'Ставки не подтверждены: ' + unk.join(', ') + ' — проценты по ним не рассчитываются.', 'Rates unconfirmed: ' + unk.join(', ') + ' — no interest is computed for them.'));
        break;
      default:
        lines.push(L2(lang, 'Это модуль на правилах, а не ИИ. Он отвечает на вопросы о: тратах на сегодня, ближайших платежах, хватит ли до зарплаты, закрытии краткосрочных кредитов, резерве 5 000 AED, снижении дохода, переводах родителям, сокращении расходов и процентах.', 'This is a rule-based module, not AI. It answers questions about: spending today, upcoming payments, money until payday, short-term debt payoff, the 5,000 AED reserve, income drops, transfers to parents, cutting spending and interest.'));
    }
    return { id: id, lines: lines };
  }

  /* ---------- import / export ---------- */
  function fingerprint(t) { return [t.type, t.amount, t.date && t.date.slice(0, 16), t.fromAccountId || '', t.toAccountId || '', t.plannedId || ''].join('|'); }
  function validateLedger(obj) {
    var errors = [], warnings = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['notObject'], warnings: [] };
    if (obj.schema !== SCHEMA) errors.push('schema');
    if (!isInt(obj.version) || obj.version > VERSION || obj.version < 1) errors.push('version');
    ['accounts', 'transactions', 'planned', 'categories'].forEach(function (k) { if (!Array.isArray(obj[k])) errors.push(k + ':missing'); });
    if (errors.length) return { ok: false, errors: errors, warnings: warnings };
    var ids = {};
    obj.accounts.forEach(function (a, i) {
      if (!a || !a.id || ids[a.id]) errors.push('account#' + i + ':id');
      else ids[a.id] = 1;
      if (ACCOUNT_TYPES.indexOf(a.type) < 0) errors.push('account:' + a.id + ':type');
      if (!isInt(a.initialBalance)) errors.push('account:' + a.id + ':initialBalance');
      if (!a.currency) errors.push('account:' + a.id + ':currency');
      if (a.credit && a.credit.limit != null && !isInt(a.credit.limit)) errors.push('account:' + a.id + ':limit');
    });
    var tids = {}, fps = {}, dupIds = 0, dupFp = 0;
    obj.transactions.forEach(function (t, i) {
      if (!t || !t.id) { errors.push('tx#' + i + ':id'); return; }
      if (tids[t.id]) dupIds++;
      tids[t.id] = 1;
      if (!isInt(t.amount)) errors.push('tx:' + t.id + ':amount');
      if (TX_TYPES.indexOf(t.type) < 0) errors.push('tx:' + t.id + ':type');
      if (!/^\d{4}-\d{2}-\d{2}/.test(t.date || '')) errors.push('tx:' + t.id + ':date');
      if (t.fromAccountId && !ids[t.fromAccountId]) errors.push('tx:' + t.id + ':fromAccount');
      if (t.toAccountId && !ids[t.toAccountId]) errors.push('tx:' + t.id + ':toAccount');
      if (t.status !== 'void') { var f = fingerprint(t); if (fps[f]) dupFp++; fps[f] = 1; }
    });
    var pids = {};
    obj.planned.forEach(function (p, i) {
      if (!p || !p.id || pids[p.id]) { errors.push('planned#' + i + ':id'); return; }
      pids[p.id] = 1;
      if (!isInt(p.amount)) errors.push('planned:' + p.id + ':amount');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) errors.push('planned:' + p.id + ':date');
      if (['payment', 'income', 'family', 'borrow'].indexOf(p.kind) < 0) errors.push('planned:' + p.id + ':kind');
      if (p.accountId && !ids[p.accountId]) errors.push('planned:' + p.id + ':account');
    });
    if (dupIds) warnings.push('duplicateTxIds:' + dupIds);
    if (dupFp) warnings.push('possibleDuplicateTx:' + dupFp);
    return { ok: errors.length === 0, errors: errors, warnings: warnings, stats: { accounts: obj.accounts.length, transactions: obj.transactions.length, planned: obj.planned.length, goals: (obj.goals || []).length } };
  }
  function normalizeLedger(obj) {
    var base = newLedger({});
    var L = Object.assign(base, clone(obj));
    ['goals', 'projects', 'assets', 'changelog'].forEach(function (k) { if (!Array.isArray(L[k])) L[k] = []; });
    if (!Array.isArray(L.scenarios) || !L.scenarios.length) L.scenarios = defaultScenarios();
    L.scenarios.forEach(function (sc) { if (!Array.isArray(sc.lines)) sc.lines = []; if (sc.months == null || sc.months === '') sc.months = HORIZON_DEFAULT; });
    L.settings = Object.assign(newLedger({}).settings, obj.settings || {});
    L.rates = Object.assign({ AED: 1 }, obj.rates || {});
    if (L.rates.UZS == null) { L.rates.UZS = 1 / 3264.51; L.rateDates = Object.assign({}, L.rateDates, { UZS: '2026-11-25' }); }
    if (!L.rateDates || typeof L.rateDates !== 'object') L.rateDates = { USD: '2026-11-25', UZS: '2026-11-25' };
    if (!L.incomePlan || typeof L.incomePlan !== 'object') L.incomePlan = { lines: [], months: {}, actuals: {} };
    if (!L.budgetSweeps || typeof L.budgetSweeps !== 'object') L.budgetSweeps = {};
    L.dismissed = obj.dismissed || {};
    L.budgetPlan = obj.budgetPlan || { total: 50000 };
    L.family = obj.family || { apartmentGoalId: null };
    var seen = {}, seenFp = {}, removed = 0;
    L.transactions = L.transactions.filter(function (t) {
      if (seen[t.id]) { removed++; return false; }
      seen[t.id] = 1;
      if (t.status !== 'void') { var f = fingerprint(t); if (seenFp[f] && !t.allowDuplicate) { removed++; return false; } seenFp[f] = 1; }
      return true;
    });
    L.version = VERSION;
    return { ledger: L, removed: removed };
  }
  function mergeLedger(cur, inc) {
    var L = clone(cur), added = { accounts: 0, transactions: 0, planned: 0 }, skipped = 0;
    var fps = {}; L.transactions.forEach(function (t) { if (t.status !== 'void') fps[fingerprint(t)] = 1; });
    inc.accounts.forEach(function (a) { if (!byId(L.accounts, a.id)) { L.accounts.push(a); added.accounts++; } });
    inc.planned.forEach(function (p) { if (!byId(L.planned, p.id)) { L.planned.push(p); added.planned++; } });
    inc.transactions.forEach(function (t) {
      if (byId(L.transactions, t.id) || (t.status !== 'void' && fps[fingerprint(t)])) { skipped++; return; }
      L.transactions.push(t); if (t.status !== 'void') fps[fingerprint(t)] = 1; added.transactions++;
    });
    log(L, 'import.merge', 'accounts +' + added.accounts + ', tx +' + added.transactions + ', planned +' + added.planned + ', skipped ' + skipped, null);
    return { ledger: L, added: added, skipped: skipped };
  }
  function csvEscape(v) { v = v == null ? '' : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV(L, lang) {
    lang = lang || 'ru';
    var head = ['id', 'date', 'type', 'status', 'amount', 'currency', 'principal', 'fee', 'debtAmount', 'from', 'to', 'category', 'subcategory', 'budgetMonth', 'plannedId', 'loanAccount', 'tags', 'note'];
    var name = function (id) { var a = byId(L.accounts, id); return a ? a.name : ''; };
    var cat = function (id) { var c = byId(L.categories, id); return c ? (c.name[lang] || c.name.ru) : ''; };
    var d2 = function (v) { return v == null ? '' : (v / 100).toFixed(2); };
    var rows = L.transactions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (t) {
      var c = byId(L.categories, t.categoryId);
      return [t.id, t.date, t.type, t.status, d2(t.amount), txCurrency(L, t), d2(t.principal), t.fee ? d2(t.fee) : '', d2(t.debtAmount), name(t.fromAccountId), name(t.toAccountId), c && c.parent ? cat(c.parent) : cat(t.categoryId), c && c.parent ? cat(t.categoryId) : (t.subcategory || ''), t.budgetMonth || '', t.plannedId || '', name(t.loanAccountId), (t.tags || []).join(' '), t.note || ''].map(csvEscape).join(',');
    });
    return '\ufeff' + head.join(',') + '\n' + rows.join('\n') + (rows.length ? '\n' : '');
  }

  return {
    SCHEMA: SCHEMA, VERSION: VERSION, ACCOUNT_TYPES: ACCOUNT_TYPES, TX_TYPES: TX_TYPES, CURRENCIES: CURRENCIES,
    uid: uid, isInt: isInt, toMinor: toMinor, fromMinor: fromMinor, fmt: fmt, todayISO: todayISO, nowISO: nowISO, ymOf: ymOf, addMonths: addMonths,
    daysInMonth: daysInMonth, lastDay: lastDay, addDays: addDays, diffDays: diffDays, sum: sum, clone: clone, byId: byId, clamp: clamp,
    defaultCategories: defaultCategories, newLedger: newLedger, defaultScenarios: defaultScenarios, rate: rate, toBase: toBase, fromBase: fromBase,
    isLiab: isLiab, makeAccount: makeAccount, txEffects: txEffects, txClass: txClass, txCurrency: txCurrency, balances: balances,
    creditInfo: creditInfo, creditStatus: creditStatus, budgetMonthFor: budgetMonthFor, validateTx: validateTx, addTx: addTx, updateTx: updateTx, voidTx: voidTx,
    restoreTx: restoreTx, deleteTx: deleteTx, log: log, plannedState: plannedState, plannedTxs: plannedTxs, confirmPlanned: confirmPlanned,
    unconfirmPlanned: unconfirmPlanned, makeSeries: makeSeries, amortize: amortize, metrics: metrics, upcoming: upcoming, monthPlan: monthPlan,
    planSeries: planSeries, firstPlanMonth: firstPlanMonth, lastPlanMonth: lastPlanMonth, deficitAlternatives: deficitAlternatives, dailyForecast: dailyForecast,
    spendByCategory: spendByCategory, budgetStatus: budgetStatus, debtSummary: debtSummary, payoffPlan: payoffPlan, debtProjection: debtProjection,
    earlyPayoffImpact: earlyPayoffImpact, clampHorizon: clampHorizon, simStartYm: simStartYm, scenarioLineInMonth: scenarioLineInMonth, scenarioLinesInMonth: scenarioLinesInMonth, planParts: planParts, scenarioCalc: scenarioCalc, HORIZON_MIN: HORIZON_MIN, HORIZON_MAX: HORIZON_MAX, HORIZON_DEFAULT: HORIZON_DEFAULT, goalStatus: goalStatus, familyStatus: familyStatus,
    healthScore: healthScore, purchaseCheck: purchaseCheck, notifications: notifications, monthReview: monthReview,
    projectStats: projectStats, assetValue: assetValue, periodRange: periodRange, flows: flows, balanceHistory: balanceHistory,
    assistant: assistant, fingerprint: fingerprint, validateLedger: validateLedger, normalizeLedger: normalizeLedger,
    mergeLedger: mergeLedger, exportCSV: exportCSV, catChildren: catChildren, plannedIncluded: plannedIncluded
  };
});
