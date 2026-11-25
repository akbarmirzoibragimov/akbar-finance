/* Akbar Finance 3.0 — app shell, state, router, persistence glue */
(function () {
  'use strict';
  var C = AFCore, I = AFIcons.icon;
  var App = window.App = { screens: {}, modals: {}, actions: {}, live: {}, C: C, I: I, CH: AFCharts };
  function qs(k) { var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1]) : null; }
  var S = App.S = {
    L: null, tab: 'home', stack: [], modal: null, toastT: null, undo: [], ready: false,
    today: qs('today') || C.todayISO(),
    ui: { scen: { reborrow: false }, stats: { period: 'month', from: null, to: null, accounts: [], categories: [] }, recQ: '', recType: '', recAcc: '', recStatus: '', calYm: null, calSel: null, planYm: null, budYm: null, strategy: 'snowball', strategyAmt: '', customOrder: [], chat: [], sim: null, pc: { amount: '', categoryId: 'misc', accountId: '', essential: false } }
  };
  App.prefs = { lang: 'ru', theme: 'dark' };
  try { var pr = JSON.parse(localStorage.getItem('akbar-finance:prefs') || '{}'); Object.assign(App.prefs, pr); } catch (e) { }

  /* ---------- i18n & format helpers ---------- */
  var lang = function () { return (S.L && S.L.settings.lang) || App.prefs.lang || 'ru'; };
  var T = App.T = function (ru, en) { return lang() === 'en' ? en : ru; };
  App.lang = lang;
  var esc = App.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var F = App.F = function (minor, cur, o) { o = o || {}; o.lang = lang(); o.cur = cur || 'AED'; return C.fmt(minor, o); };
  App.F0 = function (minor, cur) { return F(minor, cur, { dec: Math.abs(minor) >= 100000000 ? 0 : 2 }); };
  App.FS = function (minor) { return F(minor, 'AED', { plus: true }); };
  App.fd = function (d, withYear) {
    if (!d) return '—';
    var dt = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
    var o = { day: 'numeric', month: 'short' }; if (withYear !== false && d.slice(0, 4) !== S.today.slice(0, 4)) o.year = 'numeric'; if (withYear === true) o.year = 'numeric';
    return dt.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'ru-RU', o);
  };
  App.fym = function (ym) { var dt = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1); var s = dt.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'ru-RU', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1).replace(' г.', ''); };
  App.fymShort = function (ym) { var dt = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1); return dt.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'ru-RU', { month: 'short' }).replace('.', '') + (ym.slice(2, 4) !== S.today.slice(2, 4) ? ' ' + ym.slice(2, 4) : ''); };
  App.fymTiny = function (ym) { var dt = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1); return dt.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'ru-RU', { month: 'short' }).replace('.', '') + ' ' + ym.slice(2, 4); };
  App.pct = function (x, d) { return x == null || !isFinite(x) ? '—' : (x * 100).toFixed(d == null ? 1 : d).replace('.', lang() === 'en' ? '.' : ',') + '%'; };
  App.acc = function (id) { return S.L && C.byId(S.L.accounts, id); };
  App.cat = function (id) { return S.L && C.byId(S.L.categories, id); };
  App.catName = function (c) { if (typeof c === 'string') c = App.cat(c); return c ? (c.name[lang()] || c.name.ru) : T('Без категории', 'Uncategorized'); };
  App.ACC_TYPES = function () { return { cash: T('Наличные', 'Cash'), checking: T('Текущий счёт', 'Checking account'), credit_card: T('Кредитная карта', 'Credit card'), savings: T('Накопительный счёт', 'Savings account'), investment: T('Инвестиции', 'Investments'), loan: T('Кредиты и ипотека', 'Loans & mortgage'), other: T('Другое', 'Other') }; };
  App.TX_TYPES = function () { return { expense: T('Расход', 'Expense'), card_purchase: T('Покупка кредитной картой', 'Credit card purchase'), salary: T('Зарплата', 'Salary'), income: T('Другой доход', 'Other income'), debt_return: T('Возврат долга мне', 'Loan returned to me'), transfer: T('Перевод между счетами', 'Transfer'), reserve_topup: T('Пополнение резерва', 'Reserve top-up'), savings_topup: T('Пополнение накоплений', 'Savings top-up'), loan_receipt: T('Получение кредита / займа', 'Loan received'), repayment: T('Погашение долга', 'Debt repayment'), interest: T('Проценты', 'Interest'), fee: T('Комиссия', 'Fee'), family: T('Перевод родителям', 'Transfer to parents'), adjustment: T('Корректировка баланса', 'Balance adjustment') }; };
  App.PSTAT = function () { return { planned: T('Запланировано', 'Planned'), partial: T('Частично оплачено', 'Partially paid'), paid: T('Оплачено', 'Paid'), overdue: T('Просрочено', 'Overdue'), skipped: T('Пропущено', 'Skipped'), received: T('Получено', 'Received'), zero: T('0 по плану', '0 planned') }; };
  App.CSTAT = function () { return { active: T('Активный кредит', 'Active'), partial: T('Частично погашен', 'Partially repaid'), paid: T('Полностью погашен', 'Paid off'), closed: T('Кредитная линия закрыта', 'Line closed'), overdue: T('Просрочен', 'Overdue') }; };
  App.pTag = function (st) { var cls = { planned: 'warn', partial: 'info', paid: 'ok', overdue: 'danger', skipped: '', received: 'ok', zero: '' }[st] || ''; return '<span class="tag ' + cls + '">' + esc(App.PSTAT()[st] || st) + '</span>'; };
  App.cTag = function (st) { var cls = { active: 'danger', partial: 'warn', paid: 'ok', closed: '', overdue: 'danger' }[st] || ''; return '<span class="tag ' + cls + '">' + esc(App.CSTAT()[st] || st) + '</span>'; };
  App.unconf = function (flag, txt) { return flag === false ? ' <span class="unconf">' + esc(txt || T('не подтверждено', 'unconfirmed')) + '</span>' : ''; };
  App.money = function (minor, cls, cur) { return '<span class="num ' + (cls || '') + '">' + esc(F(minor, cur)) + '</span>'; };
  App.catIcon = function (c, sq) { c = typeof c === 'string' ? App.cat(c) : c; return '<span class="cat-ic' + (sq ? ' sq' : '') + '" style="background:' + ((c && c.color) || '#8E8E93') + '">' + I((c && c.icon) || 'dots') + '</span>'; };
  App.accIcon = function (a) { return '<span class="cat-ic sq" style="background:' + (a ? a.color : '#8E8E93') + '">' + I((a && a.icon) || 'bank') + '</span>'; };
  App.isDarkColor = function (hex) { var h = (hex || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (r * 299 + g * 587 + b * 114) / 1000 < 170; };
  App.opts = function (list, val) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val == null ? '' : val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
  App.accOpts = function (filter, val, empty) {
    var list = S.L.accounts.filter(function (a) { return !a.closed && !a.archived && (!filter || filter(a)); }).map(function (a) { return [a.id, a.name + ' · ' + a.currency]; });
    if (empty) list.unshift(['', empty]);
    return App.opts(list, val);
  };
  App.catOpts = function (kind, val, empty) {
    var out = []; S.L.categories.filter(function (c) { return c.kind === kind && !c.parent && (!c.system || c.id === val); }).forEach(function (c) {
      out.push([c.id, App.catName(c)]);
      S.L.categories.filter(function (s) { return s.parent === c.id; }).forEach(function (s) { out.push([s.id, '   ↳ ' + App.catName(s)]); });
    });
    if (empty) out.unshift(['', empty]);
    return App.opts(out, val);
  };
  App.toMinor = function (v) { var m = C.toMinor(v); return isNaN(m) ? null : m; };
  App.amtStr = function (minor) { return minor == null ? '' : (minor / 100).toFixed(2).replace(/\.00$/, ''); };

  /* ---------- persistence ---------- */
  App.save = function () { if (!S.L) return Promise.resolve(); S.L.meta.savedAt = new Date().toISOString(); return AFDB.set('ledger', S.L).catch(function (e) { App.toast(T('Ошибка сохранения: ', 'Save error: ') + e); }); };
  App.savePrefs = function () { try { localStorage.setItem('akbar-finance:prefs', JSON.stringify(App.prefs)); } catch (e) { } };
  /* every mutation goes through commit: keeps an undo snapshot, writes a change-log entry, saves, re-renders */
  App.commit = function (label, fn, opts) {
    var before = JSON.stringify(S.L);
    var res;
    try { res = fn(S.L); if (!(res && res.ok === false) && C.syncSeries) C.syncSeries(S.L, S.today); } catch (e) { S.L = JSON.parse(before); App.toast(T('Ошибка: ', 'Error: ') + e.message); return { ok: false }; }
    if (res && res.ok === false) { S.L = JSON.parse(before); return res; }
    if (!(opts && opts.nolog)) C.log(S.L, 'ui', label);
    S.undo.push({ label: label, data: before }); if (S.undo.length > 30) S.undo.shift();
    App.save(); App.render();
    if (!(opts && opts.silent)) App.toast(label, true);
    return res || { ok: true };
  };
  App.undoLast = function () {
    var u = S.undo.pop(); if (!u) return;
    S.L = JSON.parse(u.data); C.log(S.L, 'undo', u.label);
    App.save(); App.render(); App.toast(T('Отменено: ', 'Undone: ') + u.label);
  };

  /* ---------- toast ---------- */
  App.toast = function (msg, undo) {
    var el = document.getElementById('toast');
    el.innerHTML = '<span class="ellipsis">' + esc(msg) + '</span>' + (undo ? '<button data-a="undo">' + T('Отменить', 'Undo') + '</button>' : '');
    el.classList.remove('hidden'); clearTimeout(S.toastT);
    S.toastT = setTimeout(function () { el.classList.add('hidden'); }, undo ? 5000 : 3200);
  };
  App.actions.undo = function () { document.getElementById('toast').classList.add('hidden'); App.undoLast(); };

  /* ---------- navigation ---------- */
  App.go = function (name, params) { S.stack.push({ name: name, p: params || {}, y: window.scrollY }); try { history.pushState({ d: S.stack.length }, ''); } catch (e) { } App.render(true); window.scrollTo(0, 0); };
  App.back = function () { var top = S.stack.pop(); App.render(); window.scrollTo(0, top ? top.y || 0 : 0); };
  App.setTab = function (t) { S.tab = t; S.stack = []; App.render(); window.scrollTo(0, 0); };
  window.addEventListener('popstate', function () { if (S.modal) { App.closeModal(); return; } if (S.stack.length) App.back(); });
  App.actions.tab = function (el) { App.setTab(el.dataset.t); };
  App.actions.go = function (el) { var p = {}; Object.keys(el.dataset).forEach(function (k) { if (k !== 'a' && k !== 's') p[k] = el.dataset[k]; }); App.go(el.dataset.s, p); };
  App.actions.back = function () { try { history.back(); } catch (e) { App.back(); } };

  /* ---------- modals (bottom sheets) ---------- */
  App.openModal = function (name, data) { S.modal = Object.assign({ name: name, f: {} }, data || {}); App.renderModal(); };
  App.closeModal = function () { S.modal = null; App.renderModal(); };
  App.actions.closeModal = function () { App.closeModal(); };
  App.actions.modal = function (el) { var d = {}; Object.keys(el.dataset).forEach(function (k) { if (k !== 'a' && k !== 'm') d[k] = el.dataset[k]; }); App.openModal(el.dataset.m, d); };
  var rendering = false;
  App.renderModal = function () { if (rendering) return; rendering = true; try { renderModal0(); } finally { rendering = false; } };
  function renderModal0() {
    var host = document.getElementById('sheet');
    if (!S.modal) { host.innerHTML = ''; host.classList.add('hidden'); document.body.style.overflow = ''; return; }
    var m = S.modal, def = App.modals[m.name];
    var out = def(m);
    var keep = host.querySelector('.sheet-b'), st = keep ? keep.scrollTop : 0, same = host.dataset.name === m.name;
    host.dataset.name = m.name;
    host.innerHTML = '<div class="sheet-wrap" data-a="sheetBg"><div class="sheet" role="dialog" aria-modal="true">' +
      (out.raw ? out.html : '<div class="sheet-h"><button data-a="closeModal">' + T('Отмена', 'Cancel') + '</button><div class="t">' + esc(out.title || '') + '</div>' +
        (out.done ? '<button class="done" data-a="' + out.done + '"' + (out.doneDisabled ? ' disabled style="opacity:.4"' : '') + '>' + esc(out.doneLabel || T('Готово', 'Done')) + '</button>' : '<button></button>') + '</div>' +
        '<div class="sheet-b">' + out.html + '</div>') + '</div></div>';
    host.classList.remove('hidden'); document.body.style.overflow = 'hidden';
    if (same) { var b = host.querySelector('.sheet-b'); if (b) b.scrollTop = st; } else host.querySelector('.sheet').style.animation = '';
    if (!same) host.querySelector('.sheet').style.animation = 'up .28s cubic-bezier(.2,.9,.25,1)'; else host.querySelector('.sheet').style.animation = 'none';
    if (out.after) out.after(host);
  }
  App.actions.sheetBg = function (el, ev) { if (ev.target === el) App.closeModal(); };
  App.confirm = function (title, text, onOk, danger, okLabel) { App.openModal('confirm', { title: title, text: text, onOk: onOk, danger: danger, okLabel: okLabel }); };
  App.modals.confirm = function (m) {
    return { title: m.title, html: '<div class="card"><div style="white-space:pre-line">' + esc(m.text) + '</div></div>' + (m.requireCheck ? '' : '') +
      '<div class="btns"><button class="btn sec" data-a="closeModal">' + T('Отмена', 'Cancel') + '</button><button class="btn ' + (m.danger ? 'danger' : '') + '" data-a="confirmOk">' + esc(m.okLabel || T('Подтвердить', 'Confirm')) + '</button></div>' };
  };
  App.actions.confirmOk = function () { var fn = S.modal.onOk; App.closeModal(); fn && fn(); };

  /* ---------- form helpers (modal state lives in S.modal.f) ---------- */
  App.fld = function (label, ctl, o) { o = o || {}; return '<div class="fld' + (o.col ? ' col' : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><label>' + label + '</label><div class="ctl">' + ctl + '</div></div>'; };
  App.inp = function (f, val, o) { o = o || {}; return '<input class="in" data-f="' + f + '" value="' + esc(val == null ? '' : val) + '"' + (o.type ? ' type="' + o.type + '"' : '') + (o.num ? ' inputmode="decimal"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.re ? ' data-re="1"' : '') + '>'; };
  App.sel = function (f, optsHtml, o) { o = o || {}; return '<select class="in" data-f="' + f + '"' + (o.re ? ' data-re="1"' : '') + '>' + optsHtml + '</select>'; };
  App.chk = function (f, val, o) { o = o || {}; return '<input type="checkbox" class="sw" data-f="' + f + '"' + (val ? ' checked' : '') + (o.re ? ' data-re="1"' : '') + '>'; };
  App.group = function (title, inner, note) { return (title ? '<div class="gh">' + title + '</div>' : '') + '<div class="group">' + inner + '</div>' + (note ? '<div class="note">' + note + '</div>' : ''); };
  function readField(el) { return el.type === 'checkbox' ? el.checked : el.value; }
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.f && S.modal) { S.modal.f[el.dataset.f] = readField(el); if (el.dataset.re && el.type !== 'checkbox' && el.tagName !== 'SELECT') { if (S.modal.liveFn) S.modal.liveFn(); } }
    if (el.dataset && el.dataset.live) { App.live[el.dataset.live](el, e); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.f && S.modal) {
      S.modal.f[el.dataset.f] = readField(el);
      if (el.dataset.re) {
        // selects/toggles re-render now; text fields re-render after the tap that blurred them has finished (so that tap is not lost)
        if (el.tagName === 'SELECT' || el.type === 'checkbox') App.renderModal();
        else if (S.modal.liveFn) S.modal.liveFn();
        else { pendingRender = true; if (!pointerDown) setTimeout(flushRender, 0); }
      }
    }
    if (el.dataset && el.dataset.ch) App.actions[el.dataset.ch](el, e);
  });
  var pointerDown = false, pendingRender = false;
  function flushRender() { if (!pendingRender || pointerDown) return; pendingRender = false; if (S.modal && !rendering) App.renderModal(); }
  document.addEventListener('pointerdown', function () { pointerDown = true; }, true);
  document.addEventListener('pointerup', function () { pointerDown = false; setTimeout(flushRender, 60); }, true);
  document.addEventListener('pointercancel', function () { pointerDown = false; setTimeout(flushRender, 60); }, true);
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]'); if (!el) return;
    if (el.disabled) return;
    var fn = App.actions[el.dataset.a]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.modal) App.closeModal();
    if (S.modal && S.modal.name === 'record' && App.recordKey && !/INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ''))) App.recordKey(e);
  });

  /* ---------- downloads & files ---------- */
  App.download = function (name, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };
  App.readFile = function (file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(file); }); };
  App.importFile = function (file) {
    return App.readFile(file).then(function (text) {
      var obj; try { obj = JSON.parse(text); } catch (e) { App.openModal('importPreview', { v: { ok: false, errors: [T('Файл не является корректным JSON', 'File is not valid JSON')], warnings: [] }, fileName: file.name }); return; }
      if (obj && obj.kind === 'akbar-finance-backup' && obj.ledger) obj = obj.ledger;
      var v = C.validateLedger(obj);
      App.openModal('importPreview', { v: v, obj: obj, fileName: file.name });
    });
  };
  App.setLedger = function (L, reason) {
    var prev = S.L; if (C.prepareLedger && L) C.prepareLedger(L, S.today);
    var p = prev ? AFDB.addSnapshot('before:' + reason, prev) : Promise.resolve();
    return p.then(function () {
      S.L = L; S.undo = []; S.stack = []; S.tab = 'home';
      App.applyTheme(); return App.save();
    }).then(function () { App.render(); });
  };

  /* ---------- theme ---------- */
  App.applyTheme = function () {
    var th = (S.L && S.L.settings.theme) || App.prefs.theme || 'dark';
    if (th === 'auto') th = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', th);
    document.documentElement.lang = lang();
    var meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', th === 'light' ? '#F2F2F7' : '#000000');
  };

  /* ---------- shell ---------- */
  var TABS = function () { return [['home', 'home', T('Главная', 'Dashboard')], ['planning', 'plan', T('Планирование', 'Planning')], ['stats', 'stats', T('Статистика', 'Statistics')], ['more', 'grid', T('Ещё', 'More')]]; };
  App.badgeCount = function () { return C.notifications(S.L, S.today).filter(function (n) { return !n.dismissed && n.level !== 'ok' && n.level !== 'info'; }).length; };
  App.render = function (pushed) {
    var root = document.getElementById('app');
    App.applyTheme();
    if (!S.L) { root.innerHTML = '<main class="main" style="padding-bottom:40px">' + App.screens.onboarding() + '</main>'; document.getElementById('tabbar').innerHTML = ''; document.getElementById('fab').classList.add('hidden'); return; }
    var top = S.stack[S.stack.length - 1];
    var name = top ? top.name : S.tab, scr = App.screens[name] || App.screens.home;
    var out;
    try { out = scr(top ? top.p : {}); } catch (e) { console.error(e); out = { title: 'Error', html: '<div class="alert danger">' + esc(e.stack || e) + '</div>' }; }
    var bc = App.badgeCount();
    var bell = '<button class="iconbtn" data-a="go" data-s="notifications" aria-label="notifications">' + I('bell') + (bc ? '<span class="badge">' + bc + '</span>' : '') + '</button>';
    var head = top
      ? '<div class="topbar solid"><button class="back" data-a="back">' + I('back') + '<span>' + T('Назад', 'Back') + '</span></button><div class="tb-title ellipsis">' + esc(out.title || '') + '</div><div class="spacer"></div>' + (out.right || '') + '</div>'
      : '<div class="topbar"><div class="spacer"></div>' + (out.right || '') + bell + '</div><h1 class="large">' + esc(out.title || '') + '</h1>';
    var side = '<nav class="sidebar"><div class="brand"><span class="logo">' + I('wallet') + '</span>Akbar Finance</div>' +
      TABS().map(function (t) { return '<button class="side-item' + (S.tab === t[0] ? ' on' : '') + '" data-a="tab" data-t="' + t[0] + '">' + I(t[1]) + t[2] + '</button>'; }).join('') +
      '<button class="side-item side-add" data-a="modal" data-m="record">' + I('plus') + T('Добавить запись', 'Add record') + '</button>' +
      '<div class="side-sub">' + T('Быстрый доступ', 'Shortcuts') + '</div>' +
      [['notifications', 'bell', T('Уведомления', 'Notifications') + (bc ? ' (' + bc + ')' : '')], ['records', 'log', T('Все записи', 'All records')], ['debts', 'loan', 'Debt Freedom'], ['family', 'family', 'Family Support'], ['purchase', 'scale', T('Проверка покупки', 'Purchase check')], ['assistant', 'chat', T('Помощник', 'Assistant')], ['data', 'download', T('Данные и резервные копии', 'Data & backups')]].map(function (x) { return '<button class="side-item" data-a="go" data-s="' + x[0] + '">' + I(x[1]) + esc(x[2]) + '</button>'; }).join('') +
      '<div style="flex:1"></div><div class="tiny muted" style="padding:8px 12px">' + T('Локальное хранение · без облака', 'Local storage · no cloud') + '</div></nav>';
    root.innerHTML = side + '<main class="main"><div class="screen' + (pushed ? ' pushed' : '') + '">' + head + out.html + '</div></main>';
    document.getElementById('tabbar').innerHTML = TABS().map(function (t) { return '<button class="tab' + (S.tab === t[0] ? ' on' : '') + '" data-a="tab" data-t="' + t[0] + '">' + I(t[1]) + '<span>' + t[2] + '</span></button>'; }).join('');
    document.getElementById('fab').classList.toggle('hidden', !!top);
    if (out.after) out.after(root);
    if (S.modal) App.renderModal();
  };

  /* ---------- boot ---------- */
  App.boot = function () {
    App.applyTheme();
    AFDB.open().then(function () { return AFDB.get('ledger'); }).then(function (L) {
      if (L) {
        var n = C.normalizeLedger(L, { today: S.today }); S.L = n.ledger; if (C.prepareLedger) C.prepareLedger(S.L, S.today);
        // daily automatic snapshot
        var key = 'snap:' + S.today;
        return AFDB.get('lastSnap').then(function (ls) { if (ls !== key) return AFDB.addSnapshot('auto', S.L).then(function () { return AFDB.set('lastSnap', key); }); });
      }
    }).then(function () {
      S.ready = true; App.render();
      AFDB.persist().then(function (p) { S.persisted = p; });
      // month-end / income reminders are shown in-app (no push notifications)
    }).catch(function (e) { console.error(e); S.ready = true; App.render(); App.toast('Storage error: ' + e); });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.AF_STANDALONE) {
      navigator.serviceWorker.register('service-worker.js').catch(function () { });
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !qs('today')) { var t = C.todayISO(); if (t !== S.today) { S.today = t; App.render(); } } });
  };
})();
