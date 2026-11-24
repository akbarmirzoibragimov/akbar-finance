/* Import preview, month review, category/goal/project/asset editors */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, S = App.S, T = App.T, F = App.F, esc = App.esc;
  var fld = App.fld, inp = App.inp, sel = App.sel, chk = App.chk, group = App.group;

  /* ---------- import with validation, dedupe and confirmation ---------- */
  App.modals.importPreview = function (m) {
    var v = m.v, h = '<div class="card"><div class="b">' + esc(m.fileName || '') + '</div>';
    if (!v.ok) {
      h += '<div class="alert danger">' + I('alert') + '<div class="grow">' + T('Файл не прошёл проверку. Данные не изменены.', 'The file failed validation. Nothing was changed.') + '<br><span class="tiny">' + esc(v.errors.slice(0, 12).join('; ')) + (v.errors.length > 12 ? ' …' : '') + '</span></div></div></div>';
      return { title: T('Импорт', 'Import'), html: h };
    }
    var n = C.normalizeLedger(m.obj);
    h += App.kv(T('Счетов', 'Accounts'), String(v.stats.accounts)) + App.kv(T('Операций', 'Records'), String(v.stats.transactions)) + App.kv(T('Плановых операций', 'Planned items'), String(v.stats.planned)) + App.kv(T('Целей', 'Goals'), String(v.stats.goals)) + App.kv(T('Дата данных', 'Data as of'), (m.obj.meta && m.obj.meta.asOf) || '—');
    if (n.removed) h += '<div class="alert warn">' + I('alert') + '<div class="grow">' + T('Найдено и будет пропущено дублей операций: ', 'Duplicate records found and skipped: ') + n.removed + '</div></div>';
    if (v.warnings.length) h += '<div class="tiny muted mt8">' + esc(v.warnings.join('; ')) + '</div>';
    h += '<div class="alert ok">' + I('check') + '<div class="grow">' + T('Проверка пройдена: структура, суммы в филсах (целые), ссылки на счета.', 'Validation passed: structure, integer fils amounts, account references.') + '</div></div></div>';
    if (S.L) {
      h += '<div class="form">' + group('', fld(T('Я понимаю, что текущая книга будет заменена', 'I understand the current ledger will be replaced'), chk('agree', m.f.agree, { re: 1 }))) + '</div>';
      h += '<div class="btns"><button class="btn danger" data-a="importReplace"' + (m.f.agree ? '' : ' disabled') + '>' + T('Заменить книгу', 'Replace ledger') + '</button><button class="btn sec" data-a="importMerge">' + T('Объединить (без дублей)', 'Merge (no duplicates)') + '</button></div>';
      h += '<div class="tiny muted mt8">' + T('Перед заменой текущая книга автоматически сохраняется в резервные копии на этом устройстве.', 'Before replacing, the current ledger is saved to on-device backups automatically.') + '</div>';
    } else h += '<button class="btn block mt16" data-a="importReplace">' + I('download') + T('Загрузить книгу', 'Load ledger') + '</button>';
    return { title: T('Импорт книги', 'Import ledger'), html: h };
  };
  App.actions.importReplace = function () {
    var m = S.modal; if (S.L && !m.f.agree) return;
    var n = C.normalizeLedger(m.obj); C.log(n.ledger, 'import.replace', (m.fileName || '') + (n.removed ? ', duplicates skipped ' + n.removed : ''));
    App.closeModal(); App.setLedger(n.ledger, 'import').then(function () { App.toast(T('Книга загружена', 'Ledger loaded')); });
  };
  App.actions.importMerge = function () {
    var m = S.modal, inc = C.normalizeLedger(m.obj).ledger;
    var r = C.mergeLedger(S.L, inc);
    App.closeModal();
    AFDB.addSnapshot('before:merge', S.L).then(function () { S.L = r.ledger; App.save(); App.render(); App.toast(T('Добавлено операций: ', 'Records added: ') + r.added.transactions + T(', пропущено дублей: ', ', duplicates skipped: ') + r.skipped); });
  };

  /* ---------- month-end review ---------- */
  App.modals.review = function (m) {
    var ym = m.ym || C.ymOf(S.today), r = C.monthReview(S.L, ym, S.today), h = '';
    h += '<div class="seg"><button data-a="reviewShift" data-d="-1">‹ ' + esc(App.fym(C.addMonths(ym, -1))) + '</button><button class="on">' + esc(App.fym(ym)) + '</button><button data-a="reviewShift" data-d="1">' + esc(App.fym(C.addMonths(ym, 1))) + ' ›</button></div>';
    var q = function (qq, a) { return '<div class="kv"><span class="k">' + esc(qq) + '</span><span class="v">' + a + '</span></div>'; };
    h += '<div class="card">' +
      q(T('Сколько поступило денег?', 'How much came in?'), '<span class="pos">' + esc(F(r.received)) + '</span>') +
      q(T('Сколько потрачено?', 'How much was spent?'), '<span class="neg">' + esc(F(r.spent)) + '</span> <span class="tiny muted">+ ' + T('проценты/комиссии ', 'interest/fees ') + esc(F(r.finance)) + '</span>') +
      q(T('Сколько отправлено родителям?', 'Sent to parents?'), '<span class="sav">' + esc(F(r.family)) + '</span>') +
      q(T('Сколько накоплено?', 'How much saved?'), esc(App.FS(r.saved))) +
      q(T('Как изменился долг?', 'How did debt change?'), '<span class="' + (r.debtChange > 0 ? 'neg' : 'pos') + '">' + esc(App.FS(r.debtChange)) + '</span> <span class="tiny muted">' + esc(F(r.debtStart)) + ' → ' + esc(F(r.debtEnd)) + '</span>') +
      q(T('Прогноз следующего месяца', 'Next month forecast'), '<span class="' + (r.nextPlan.result < 0 ? 'neg' : 'pos') + '">' + esc(F(r.nextPlan.result)) + '</span>') + '</div>';
    h += '<div class="sec-h"><span class="t small">' + T('Какие платежи выполнены?', 'Which payments were made?') + '</span></div><div class="list">' + (r.payments.length ? r.payments.map(function (x) { return App.plannedRow(x.p, x.st); }).join('') : '<div class="empty">—</div>') + '</div>';
    if (r.incomes.length) h += '<div class="sec-h"><span class="t small">' + T('Подтвердите поступления', 'Confirm income') + '</span></div><div class="list">' + r.incomes.map(function (p) { return App.plannedRow(p, C.plannedState(S.L, p, S.today)); }).join('') + '</div>';
    h += '<div class="tiny muted mt8">' + T('После подтверждения поступлений план пересчитывается автоматически.', 'After confirming income the plan is recalculated automatically.') + '</div>';
    return { title: T('Финансовая сверка месяца', 'Monthly review'), html: h };
  };
  App.actions.reviewShift = function (el) { S.modal.ym = C.addMonths(S.modal.ym || C.ymOf(S.today), +el.dataset.d); App.renderModal(); };

  /* ---------- category editor ---------- */
  App.modals.category = function (m) {
    var c = m.id ? App.cat(m.id) : null, f = m.f;
    if (!m.inited) { m.inited = true; if (c) Object.assign(f, { ru: c.name.ru, en: c.name.en, icon: c.icon, color: c.color, kind: c.kind, parent: c.parent || '', limit: App.amtStr(c.limit), impulse: c.impulse }); else Object.assign(f, { ru: '', en: '', icon: 'dots', color: '#0A84FF', kind: m.kind || 'expense', parent: m.parent || '', limit: '', impulse: false }); }
    var parents = S.L.categories.filter(function (x) { return x.kind === f.kind && !x.parent && (!c || x.id !== c.id) && !x.system; }).map(function (x) { return [x.id, App.catName(x)]; });
    var x = fld(T('Название (рус.)', 'Name (RU)'), inp('ru', f.ru)) + fld(T('Название (англ.)', 'Name (EN)'), inp('en', f.en)) + (c ? '' : fld(T('Тип', 'Kind'), sel('kind', App.opts([['expense', T('Расход', 'Expense')], ['income', T('Доход', 'Income')]], f.kind), { re: 1 }))) +
      fld(T('Родительская категория', 'Parent'), sel('parent', App.opts([['', '—']].concat(parents), f.parent))) +
      (f.kind === 'expense' ? fld(T('Лимит в месяц', 'Monthly limit'), inp('limit', f.limit, { num: true, ph: T('без лимита', 'no limit') })) + fld(T('Импульсивные', 'Impulse'), chk('impulse', f.impulse)) : '');
    var h = '<div class="form">' + group('', x) + group(T('Вид', 'Look'), '<div class="fld col"><label>' + T('Иконка', 'Icon') + '</label><div class="chips">' + AFIcons.names.filter(function (n) { return ['back', 'chev', 'down', 'up', 'close', 'minus'].indexOf(n) < 0; }).map(function (ic) { return '<button class="chip' + (f.icon === ic ? ' on' : '') + '" data-a="catIcon" data-i="' + ic + '">' + I(ic, 'sm') + '</button>'; }).join('') + '</div></div><div class="fld col"><label>' + T('Цвет', 'Color') + '</label><div class="chips">' + ['#FF9F0A', '#FF453A', '#30D158', '#0A84FF', '#BF5AF2', '#64D2FF', '#FFD60A', '#FF375F', '#5E5CE6', '#8E8E93', '#AC8E68', '#30B0C7'].map(function (col) { return '<button data-a="catColor" data-c="' + col + '" style="width:30px;height:30px;border-radius:50%;background:' + col + ';outline:' + (f.color === col ? '3px solid var(--text)' : '0') + ';outline-offset:2px"></button>'; }).join('') + '</div></div>') + '</div>';
    if (c && !c.system) h += '<div class="btns"><button class="btn danger" data-a="catDelete">' + I('trash') + T('Удалить', 'Delete') + '</button></div>';
    return { title: c ? App.catName(c) : T('Новая категория', 'New category'), html: h, done: 'saveCategory', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.catIcon = function (el) { S.modal.f.icon = el.dataset.i; App.renderModal(); };
  App.actions.catColor = function (el) { S.modal.f.color = el.dataset.c; App.renderModal(); };
  App.actions.saveCategory = function () {
    var m = S.modal, f = m.f; if (!f.ru && !f.en) return;
    App.commit(T('Категория сохранена', 'Category saved'), function (L) {
      var o = { name: { ru: f.ru || f.en, en: f.en || f.ru }, icon: f.icon, color: f.color, parent: f.parent || null, limit: App.toMinor(f.limit) || 0, impulse: !!f.impulse };
      if (m.id) Object.assign(C.byId(L.categories, m.id), o); else L.categories.push(Object.assign({ id: C.uid('cat'), kind: f.kind, system: false }, o));
    });
    App.closeModal();
  };
  App.actions.catDelete = function () {
    var id = S.modal.id, used = S.L.transactions.some(function (t) { return t.categoryId === id; });
    App.confirm(T('Удалить категорию?', 'Delete category?'), used ? T('Категория используется в операциях — они будут перенесены в «Прочее».', 'The category is used — records will move to “Other”.') : T('Категория будет удалена.', 'The category will be deleted.'), function () {
      App.commit(T('Категория удалена', 'Category deleted'), function (L) { L.transactions.forEach(function (t) { if (t.categoryId === id) t.categoryId = 'misc'; }); L.categories.forEach(function (c) { if (c.parent === id) c.parent = null; }); L.categories = L.categories.filter(function (c) { return c.id !== id; }); });
    }, true);
  };

  /* ---------- goal editor & contributions ---------- */
  App.modals.goal = function (m) {
    var g = m.id ? C.byId(S.L.goals, m.id) : null, f = m.f;
    if (!m.inited) { m.inited = true; if (g) Object.assign(f, { title: g.title, target: App.amtStr(g.target), currency: g.currency || 'AED', targetDate: g.targetDate || '', note: g.note || '', accountId: g.accountId || '', type: g.type }); else Object.assign(f, { title: '', target: '', currency: 'AED', targetDate: '', note: '', accountId: '', type: 'custom' }); }
    var x = fld(T('Название', 'Title'), inp('title', f.title)) + fld(T('Целевая сумма', 'Target amount'), inp('target', f.target, { num: true })) + fld(T('Валюта', 'Currency'), sel('currency', App.opts(C.CURRENCIES.map(function (c) { return [c, c]; }), f.currency))) + fld(T('Целевая дата', 'Target date'), inp('targetDate', f.targetDate, { type: 'date' }));
    if (!g || g.type === 'custom' || g.type === 'reserve') x += fld(T('Связанный счёт', 'Linked account'), sel('accountId', App.accOpts(function (a) { return !C.isLiab(a); }, f.accountId, T('— вручную —', '— manual —'))));
    x += fld(T('Комментарий', 'Note'), inp('note', f.note), { col: 1 });
    var h = '<div class="form">' + group('', x) + '</div>';
    if (g && !['short_debt', 'reserve', 'family_monthly', 'extra_income'].indexOf) void 0;
    if (g) h += '<div class="btns"><button class="btn danger" data-a="goalDelete">' + I('trash') + T('Удалить цель', 'Delete goal') + '</button></div>';
    return { title: g ? T('Цель', 'Goal') : T('Новая цель', 'New goal'), html: h, done: 'saveGoal', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.saveGoal = function () {
    var m = S.modal, f = m.f, t = App.toMinor(f.target); if (!f.title || !t) { m.err = 'x'; return; }
    App.commit(T('Цель сохранена', 'Goal saved'), function (L) {
      var o = { title: f.title, target: t, currency: f.currency, targetDate: f.targetDate || null, note: f.note, accountId: f.accountId || null };
      if (m.id) Object.assign(C.byId(L.goals, m.id), o); else L.goals.push(Object.assign({ id: C.uid('goal'), type: 'custom', contributions: [], color: '#64D2FF', icon: 'target' }, o));
    });
    App.closeModal();
  };
  App.actions.goalDelete = function () { var id = S.modal.id; App.confirm(T('Удалить цель?', 'Delete goal?'), T('Цель будет удалена. Операции не затрагиваются.', 'The goal will be deleted. Records are not affected.'), function () { App.commit(T('Цель удалена', 'Goal deleted'), function (L) { L.goals = L.goals.filter(function (g) { return g.id !== id; }); }); App.back(); }, true); };
  App.modals.contribution = function (m) {
    var g = C.byId(S.L.goals, m.id), f = m.f;
    if (!m.inited) { m.inited = true; f.amount = ''; f.date = S.today; f.note = ''; }
    var h = '<div class="form">' + group('', fld(T('Сумма', 'Amount') + ' (' + (g.currency || 'AED') + ')', inp('amount', f.amount, { num: true })) + fld(T('Дата', 'Date'), inp('date', f.date, { type: 'date' })) + fld(T('Комментарий', 'Note'), inp('note', f.note)), T('Ручной учёт прогресса цели. Это не создаёт движения денег по счетам — для перевода денег используйте операцию.', 'Manual goal progress. It does not move money between accounts — use a record for that.')) + '</div>';
    return { title: T('Пополнение цели', 'Goal contribution'), html: h, done: 'saveContribution', doneLabel: T('Добавить', 'Add') };
  };
  App.actions.saveContribution = function () {
    var m = S.modal, v = App.toMinor(m.f.amount); if (!v) return;
    App.commit(T('Пополнение добавлено', 'Contribution added'), function (L) { var g = C.byId(L.goals, m.id); g.contributions = g.contributions || []; g.contributions.push({ id: C.uid('ctb'), date: m.f.date, amount: v, note: m.f.note }); });
    App.closeModal();
  };
  App.actions.delContribution = function (el) { var gid = el.dataset.g, cid = el.dataset.c; App.commit(T('Пополнение удалено', 'Contribution removed'), function (L) { var g = C.byId(L.goals, gid); g.contributions = g.contributions.filter(function (c) { return c.id !== cid; }); }); };

  /* ---------- projects & assets ---------- */
  App.modals.project = function (m) {
    var p = m.id ? C.byId(S.L.projects, m.id) : null, f = m.f;
    if (!m.inited) { m.inited = true; f.name = p ? p.name : ''; f.note = p ? p.note : ''; }
    var h = '<div class="form">' + group('', fld(T('Название', 'Name'), inp('name', f.name, { ph: 'YouTube' })) + fld(T('Описание', 'Description'), inp('note', f.note))) + '</div>';
    if (p) h += '<div class="btns"><button class="btn danger" data-a="projectDelete">' + I('trash') + T('Удалить проект', 'Delete project') + '</button></div>';
    return { title: p ? T('Проект', 'Project') : T('Новый проект', 'New project'), html: h, done: 'saveProject', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.saveProject = function () { var m = S.modal; if (!m.f.name) return; App.commit(T('Проект сохранён', 'Project saved'), function (L) { if (m.id) Object.assign(C.byId(L.projects, m.id), { name: m.f.name, note: m.f.note }); else L.projects.push({ id: C.uid('prj'), name: m.f.name, note: m.f.note, createdAt: S.today }); }); App.closeModal(); };
  App.actions.projectDelete = function () { var id = S.modal.id; App.confirm(T('Удалить проект?', 'Delete project?'), T('Операции останутся, но потеряют привязку к проекту.', 'Records stay but lose the project link.'), function () { App.commit(T('Проект удалён', 'Project deleted'), function (L) { L.projects = L.projects.filter(function (p) { return p.id !== id; }); L.transactions.forEach(function (t) { if (t.projectId === id) delete t.projectId; }); }); }, true); };
  App.modals.asset = function (m) {
    var a = m.id ? C.byId(S.L.assets, m.id) : null, f = m.f;
    if (!m.inited) { m.inited = true; Object.assign(f, a ? { name: a.name, kind: a.kind, qty: String(a.qty), price: App.amtStr(a.price), cost: App.amtStr(a.costBasis), currency: a.currency, note: a.note || '' } : { name: '', kind: 'stock', qty: '', price: '', cost: '', currency: 'USD', note: '' }); }
    var x = fld(T('Название / тикер', 'Name / ticker'), inp('name', f.name)) + fld(T('Тип', 'Type'), sel('kind', App.opts([['stock', T('Акции', 'Stock')], ['etf', 'ETF'], ['crypto', T('Криптовалюта', 'Crypto')], ['other', T('Другое', 'Other')]], f.kind))) + fld(T('Количество', 'Quantity'), inp('qty', f.qty, { num: true })) + fld(T('Текущая цена за ед.', 'Current price per unit'), inp('price', f.price, { num: true })) + fld(T('Сумма вложений', 'Cost basis'), inp('cost', f.cost, { num: true })) + fld(T('Валюта', 'Currency'), sel('currency', App.opts(C.CURRENCIES.map(function (c) { return [c, c]; }), f.currency))) + fld(T('Комментарий', 'Note'), inp('note', f.note));
    var h = '<div class="form">' + group('', x, T('Цены вводятся вручную — приложение не подключено к биржевым данным.', 'Prices are entered manually — no market data feed is connected.')) + '</div>';
    if (a) h += '<div class="btns"><button class="btn danger" data-a="assetDelete">' + I('trash') + T('Удалить', 'Delete') + '</button></div>';
    return { title: a ? a.name : T('Новый актив', 'New asset'), html: h, done: 'saveAsset', doneLabel: T('Сохранить', 'Save') };
  };
  App.actions.saveAsset = function () {
    var m = S.modal, f = m.f; if (!f.name) return;
    var o = { name: f.name, kind: f.kind, qty: parseFloat(String(f.qty).replace(',', '.')) || 0, price: App.toMinor(f.price) || 0, costBasis: App.toMinor(f.cost) || 0, currency: f.currency, note: f.note, updatedAt: S.today };
    App.commit(T('Актив сохранён', 'Asset saved'), function (L) { if (m.id) Object.assign(C.byId(L.assets, m.id), o); else L.assets.push(Object.assign({ id: C.uid('ast') }, o)); });
    App.closeModal();
  };
  App.actions.assetDelete = function () { var id = S.modal.id; App.closeModal(); App.commit(T('Актив удалён', 'Asset deleted'), function (L) { L.assets = L.assets.filter(function (a) { return a.id !== id; }); }); };
})();
