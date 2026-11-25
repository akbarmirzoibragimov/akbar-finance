/* Akbar Finance — Академия: урок дня (10 минут + тест), задания по понедельникам и вторникам (~1 час),
   XP, уровни, серия дней, карта года, «Для свободного времени». Прогресс хранится в книге (IndexedDB) и попадает в резервную копию JSON. */
(function () {
  'use strict';
  var App = window.App, C = App.C, I = App.I, S = App.S, T = App.T, esc = App.esc, A = window.AFAcademy;
  var TASK_XP = 50;

  function st() { var a = S.L.academy || {}; return { start: a.start || null, lessons: a.lessons || {}, tasks: a.tasks || {}, reached: a.reached || {} }; }
  function mutate(label, fn) { return App.commit(label, function (L) { L.academy = L.academy || {}; ['lessons', 'tasks', 'reached'].forEach(function (k) { L.academy[k] = L.academy[k] || {}; }); if (!L.academy.start) L.academy.start = S.today; fn(L.academy); }, { nolog: true }); }
  function xp(s) { var x = 0; Object.keys(s.lessons).forEach(function (k) { x += s.lessons[k].xp || 0; }); Object.keys(s.tasks).forEach(function (k) { x += s.tasks[k].xp || 0; }); return x; }
  function activityDates(s) { var d = []; Object.keys(s.lessons).forEach(function (k) { d.push(s.lessons[k].date); }); Object.keys(s.tasks).forEach(function (k) { d.push(s.tasks[k].date); }); return d; }
  function weekDone(s, n) { var w = A.content[n]; return !!w && w.lessons.every(function (l) { return s.lessons[l.id]; }); }
  function levelOf(n) { return A.LEVELS.filter(function (l) { return n >= l.weeks[0] && n <= l.weeks[1]; })[0]; }
  /* the next lesson (sequential). One new lesson per day; finished lessons can be reviewed any time. */
  function nextLesson(s) {
    var all = A.lessons(), i = 0; while (i < all.length && s.lessons[all[i].id]) i++;
    var nxt = all[i] || null, doneToday = Object.keys(s.lessons).some(function (k) { return s.lessons[k].date === S.today && !s.lessons[k].review; });
    return { lesson: nxt, index: i, total: all.length, doneToday: doneToday, available: !!nxt && !doneToday };
  }
  function lessonState(s, id) {
    var all = A.lessons(), i = all.map(function (l) { return l.id; }).indexOf(id), n = nextLesson(s);
    if (s.lessons[id]) return 'done'; if (i === n.index && n.available) return 'open'; return 'locked';
  }
  function openTasks(s) {
    var out = [];
    Object.keys(A.content).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      (A.content[n].tasks || []).forEach(function (t) { var open = C.academyTaskOpen(s.reached[n], S.today, t.slot); out.push({ week: n, task: t, open: open, done: !!s.tasks[t.id] }); });
    });
    return out;
  }
  function curWeek(s) { var n = nextLesson(s); return n.lesson ? n.lesson.week : (Object.keys(A.content).map(Number).sort(function (a, b) { return b - a; })[0] || 1); }

  /* ---------- hub ---------- */
  App.screens.academy = function () {
    var s = st(), x = xp(s), rk = C.academyRank(x), streak = C.academyStreak(activityDates(s), S.today), n = nextLesson(s), day = C.academyDay(s.start || S.today, S.today), cw = curWeek(s), wk = A.WEEKS[cw - 1], lv = levelOf(cw);
    var h = '<div class="card acad-hero"><div class="split"><div><div class="tiny muted">' + T('Уровень ', 'Level ') + lv.n + ' · ' + esc(lv.title) + '</div><div class="b" style="font-size:20px">' + T('Неделя ', 'Week ') + cw + '. ' + esc(wk.title) + '</div></div><div class="acad-streak" title="streak">' + I('flame') + '<b class="num">' + streak + '</b></div></div>' +
      '<div class="small muted mt8">' + esc(wk.goal) + '</div><div class="split mt12 small"><span>' + T('Ранг ', 'Rank ') + rk.rank + ' · <b class="num">' + x + ' XP</b></span><span class="muted num">' + (rk.next ? rk.next - x + T(' XP до ранга ', ' XP to rank ') + (rk.rank + 1) : T('максимум', 'max')) + '</span></div><div class="bar mt8"><i style="width:' + rk.pct * 100 + '%;background:' + lv.color + '"></i></div></div>';
    // today's lesson
    h += '<div class="sec-h"><span class="t">' + T('Урок дня · 10 минут', 'Lesson of the day · 10 min') + '</span><span class="tiny muted">' + Math.min(n.index, n.total) + ' / ' + n.total + '</span></div>';
    if (n.lesson && n.available) h += '<button class="card tap acad-lesson" data-a="go" data-s="academyLesson" data-id="' + n.lesson.id + '"><span class="cat-ic" style="background:' + lv.color + '">' + I('book') + '</span><div class="grow"><div class="tiny muted">' + T('Неделя ', 'Week ') + n.lesson.week + T(' · день ', ' · day ') + n.lesson.day + '</div><div class="b">' + esc(n.lesson.title) + '</div><div class="tiny muted">' + T('чтение + тест из ', 'reading + quiz of ') + n.lesson.quiz.length + T(' вопросов', ' questions') + '</div></div>' + I('chev', 'sm') + '</button>';
    else if (n.lesson) h += '<div class="card"><div class="alert ok">' + I('check') + '<div class="grow">' + T('Урок дня пройден. Следующий — «', 'Today\'s lesson is done. Next — “') + esc(n.lesson.title) + T('» — откроется завтра. Пройденные уроки можно повторять.', '” — opens tomorrow. You can review finished lessons.') + '</div></div></div>';
    else h += '<div class="card"><div class="alert info">' + I('info') + '<div class="grow">' + T('Ты прошёл все опубликованные уроки. Новые недели добавляются по одной — следи за картой года.', 'You finished all published lessons. New weeks are added one at a time — see the roadmap.') + '</div></div></div>';
    // assignments
    var ts = openTasks(s), pend = ts.filter(function (t) { return t.open && !t.done; }), wd = day.weekday;
    h += '<div class="sec-h"><span class="t">' + T('Задания · пн и вт · ~1 час', 'Assignments · Mon & Tue · ~1 h') + '</span></div>';
    if (pend.length) h += pend.map(function (t) { return taskRow(t); }).join('');
    else h += '<div class="card small muted">' + (wd === 0 || wd === 1 ? T('Задание этой недели откроется, когда ты начнёшь неделю (первый урок недели).', 'This week\'s assignment opens once you start the week (its first lesson).') : T('Следующее задание — в понедельник. По понедельникам кейс или расчёт, по вторникам — расчёт на твоих данных или план.', 'Next assignment on Monday. Mondays: case or calculation; Tuesdays: work on your own data or a plan.')) + '</div>';
    h += '<div class="list mt12">' +
      '<button class="row tap" data-a="go" data-s="academyRoadmap"><span class="cat-ic" style="background:#5E5CE6">' + I('flag') + '</span><div class="main-t"><div class="t1">' + T('Карта года · 52 недели', 'Year roadmap · 52 weeks') + '</div><div class="t2">' + T('5 уровней, темы каждой недели', '5 levels, topics per week') + '</div></div>' + I('chev', 'sm') + '</button>' +
      '<button class="row tap" data-a="go" data-s="academyDone"><span class="cat-ic" style="background:#30D158">' + I('check') + '</span><div class="main-t"><div class="t1">' + T('Пройденное и задания', 'Completed & assignments') + '</div><div class="t2">' + Object.keys(s.lessons).length + T(' уроков · ', ' lessons · ') + Object.keys(s.tasks).length + T(' заданий', ' assignments') + '</div></div>' + I('chev', 'sm') + '</button>' +
      '<button class="row tap" data-a="go" data-s="academyLibrary"><span class="cat-ic" style="background:#FF9F0A">' + I('heart') + '</span><div class="main-t"><div class="t1">' + T('Для свободного времени', 'For your free time') + '</div><div class="t2">' + T('Курсы MIT и Yale, книги, аудиокниги, подкасты', 'MIT & Yale courses, books, audiobooks, podcasts') + '</div></div>' + I('chev', 'sm') + '</button></div>';
    h += '<div class="dashed-note">' + T('Академия — авторская программа приложения в формате кейс-метода. Это не официальный курс какого-либо университета. Примеры в уроках подставляются из твоей книги прямо на устройстве.', 'The Academy is the app\'s own case-method programme, not an official course of any university. Examples use numbers from your ledger, computed on this device.') + '</div>';
    return { title: T('Академия', 'Academy'), html: h };
  };
  function taskRow(t) {
    return '<button class="card tap acad-lesson" data-a="go" data-s="academyTask" data-id="' + t.task.id + '"><span class="cat-ic" style="background:' + (t.task.slot === 1 ? '#0A84FF' : '#BF5AF2') + '">' + I(t.task.kind === 'case' ? 'briefcase' : t.task.kind === 'calc' ? 'percent' : 'target') + '</span><div class="grow"><div class="tiny muted">' + (t.task.slot === 1 ? T('Понедельник', 'Monday') : T('Вторник', 'Tuesday')) + ' · ' + T('неделя ', 'week ') + t.week + ' · ' + ({ case: T('кейс', 'case'), calc: T('расчёт на твоих данных', 'your numbers'), plan: T('план', 'plan') }[t.task.kind]) + '</div><div class="b">' + esc(t.task.title) + '</div><div class="tiny muted">~' + t.task.min + T(' мин · +', ' min · +') + TASK_XP + ' XP' + (t.done ? ' · ' + T('выполнено', 'done') : '') + '</div></div>' + I('chev', 'sm') + '</button>';
  }
  function renderBody(lines, ctx) {
    var h = '', inList = false;
    lines.forEach(function (raw) {
      var s0 = App.fillCtx(raw, ctx);
      if (s0.indexOf('- ') === 0) { if (!inList) { h += '<ul>'; inList = true; } h += '<li>' + esc(s0.slice(2)) + '</li>'; return; }
      if (inList) { h += '</ul>'; inList = false; }
      if (s0.indexOf('## ') === 0) h += '<h3>' + esc(s0.slice(3)) + '</h3>';
      else if (s0.indexOf('> ') === 0) h += '<div class="acad-callout">' + I('info', 'sm') + '<span>' + esc(s0.slice(2)) + '</span></div>';
      else h += '<p>' + esc(s0) + '</p>';
    });
    if (inList) h += '</ul>';
    return h;
  }
  function findLesson(id) { return A.lessons().filter(function (l) { return l.id === id; })[0]; }
  function findTask(id) { var r = null; Object.keys(A.content).forEach(function (n) { (A.content[n].tasks || []).forEach(function (t) { if (t.id === id) r = Object.assign({ week: +n }, t); }); }); return r; }

  /* ---------- lesson + quiz ---------- */
  App.screens.academyLesson = function (p) {
    var s = st(), l = findLesson(p.id); if (!l) return { title: T('Урок', 'Lesson'), html: '<div class="empty">—</div>' };
    var state = lessonState(s, l.id);
    if (state === 'locked') return { title: l.title, html: '<div class="card"><div class="alert info">' + I('info') + '<div class="grow">' + T('Этот урок откроется по порядку: один новый урок в день.', 'This lesson unlocks in order: one new lesson per day.') + '</div></div></div>' };
    var q = S.ui.quiz && S.ui.quiz.id === l.id ? S.ui.quiz : (S.ui.quiz = { id: l.id, ans: {}, checked: false });
    var h = '<div class="tiny muted">' + T('Неделя ', 'Week ') + l.week + T(' · день ', ' · day ') + l.day + ' · ~' + l.min + T(' мин', ' min') + (state === 'done' ? ' · ' + T('пройден', 'done') : '') + '</div><article class="acad-body card mt8">' + renderBody(l.body, App.finCtx()) + '</article>';
    h += '<div class="sec-h"><span class="t">' + T('Тест', 'Quiz') + '</span></div>';
    h += l.quiz.map(function (qq, qi) {
      return '<div class="card acad-q"><div class="b">' + (qi + 1) + '. ' + esc(qq.q) + '</div>' + qq.a.map(function (a, ai) {
        var sel = q.ans[qi] === ai, cls = q.checked ? (ai === qq.ok ? ' ok' : sel ? ' bad' : '') : sel ? ' sel' : '';
        return '<button class="acad-opt' + cls + '" data-a="acadAns" data-q="' + qi + '" data-v="' + ai + '"' + (q.checked ? ' disabled' : '') + '>' + esc(a) + '</button>';
      }).join('') + (q.checked ? '<div class="tiny muted mt8">' + esc(qq.why) + '</div>' : '') + '</div>';
    }).join('');
    var all = l.quiz.every(function (qq, qi) { return q.ans[qi] != null; });
    if (!q.checked) h += '<div class="btns"><button class="btn block" data-a="acadCheck" data-id="' + l.id + '"' + (all ? '' : ' disabled style="opacity:.45"') + '>' + T('Проверить ответы', 'Check answers') + '</button></div>';
    else {
      var correct = l.quiz.filter(function (qq, qi) { return q.ans[qi] === qq.ok; }).length;
      h += '<div class="card center"><div class="b" style="font-size:20px">' + correct + ' / ' + l.quiz.length + '</div><div class="small muted">' + (state === 'done' ? T('Повторение — XP не начисляется повторно.', 'Review — XP is not awarded again.') : '+' + C.lessonXP(correct, l.quiz.length) + ' XP') + '</div></div>';
      h += '<div class="btns"><button class="btn sec" data-a="acadRetry">' + T('Ещё раз', 'Retry') + '</button><button class="btn" data-a="go" data-s="academy">' + T('К Академии', 'To Academy') + '</button></div>';
    }
    return { title: l.title, html: h };
  };
  App.actions.acadAns = function (el) { S.ui.quiz.ans[+el.dataset.q] = +el.dataset.v; App.render(); };
  App.actions.acadRetry = function () { S.ui.quiz = { id: S.ui.quiz.id, ans: {}, checked: false }; App.render(); };
  App.actions.acadCheck = function (el) {
    var l = findLesson(el.dataset.id), q = S.ui.quiz, s = st();
    if (!l.quiz.every(function (qq, qi) { return q.ans[qi] != null; })) return;
    q.checked = true;
    var correct = l.quiz.filter(function (qq, qi) { return q.ans[qi] === qq.ok; }).length;
    if (s.lessons[l.id]) { App.render(); return; }
    mutate(T('Урок пройден: +', 'Lesson done: +') + C.lessonXP(correct, l.quiz.length) + ' XP', function (a) {
      a.lessons[l.id] = { date: S.today, correct: correct, total: l.quiz.length, xp: C.lessonXP(correct, l.quiz.length) };
      if (!a.reached[l.week]) a.reached[l.week] = S.today;
    });
  };

  /* ---------- assignment ---------- */
  App.screens.academyTask = function (p) {
    var s = st(), t = findTask(p.id); if (!t) return { title: '—', html: '' };
    var open = C.academyTaskOpen(s.reached[t.week], S.today, t.slot), done = s.tasks[t.id];
    var h = '<div class="tiny muted">' + (t.slot === 1 ? T('Понедельник', 'Monday') : T('Вторник', 'Tuesday')) + ' · ' + T('неделя ', 'week ') + t.week + ' · ~' + t.min + T(' мин', ' min') + '</div>';
    if (!open && !done) return { title: t.title, html: h + '<div class="card mt8"><div class="alert info">' + I('calendar') + '<div class="grow">' + T('Задание откроется в ближайший ', 'Opens on the next ') + (t.slot === 1 ? T('понедельник', 'Monday') : T('вторник', 'Tuesday')) + T(' после начала недели ', ' after you start week ') + t.week + '.</div></div></div>' };
    h += '<article class="acad-body card mt8">' + renderBody(t.body, App.finCtx()) + (t.hint ? '<details class="mt12"><summary class="small b">' + T('Подсказка', 'Hint') + '</summary><p class="small">' + esc(t.hint) + '</p></details>' : '') + '</article>';
    var note = S.ui.taskNote && S.ui.taskNote.id === t.id ? S.ui.taskNote.v : (done && done.note) || '';
    h += '<div class="form"><div class="group"><div class="fld col"><label>' + T('Твой результат (заметка, хранится только на устройстве)', 'Your result (note, stays on this device)') + '</label><textarea class="in" rows="8" data-live="acadNote" data-id="' + t.id + '">' + esc(note) + '</textarea></div></div></div>';
    h += '<div class="btns"><button class="btn block" data-a="acadTaskDone" data-id="' + t.id + '">' + (done ? T('Сохранить заметку', 'Save note') : T('Отметить выполненным · +', 'Mark done · +') + TASK_XP + ' XP') + '</button></div>';
    return { title: t.title, html: h };
  };
  App.live.acadNote = function (el) { S.ui.taskNote = { id: el.dataset.id, v: el.value }; };
  App.actions.acadTaskDone = function (el) {
    var id = el.dataset.id, s = st(), note = S.ui.taskNote && S.ui.taskNote.id === id ? S.ui.taskNote.v : (s.tasks[id] && s.tasks[id].note) || '';
    mutate(s.tasks[id] ? T('Заметка сохранена', 'Note saved') : T('Задание выполнено: +', 'Assignment done: +') + TASK_XP + ' XP', function (a) { a.tasks[id] = Object.assign({ date: S.today, xp: TASK_XP }, a.tasks[id] || {}, { note: note }); });
  };

  /* ---------- roadmap ---------- */
  App.screens.academyRoadmap = function () {
    var s = st(), cw = curWeek(s), h = '<div class="dashed-note">' + T('Годовая программа из 52 недель. Уроки публикуются по одной неделе; недели без материалов отмечены «скоро».', '52-week programme. Lessons are published one week at a time; weeks without material are marked “soon”.') + '</div>';
    A.LEVELS.forEach(function (lv) {
      var weeks = A.WEEKS.filter(function (w) { return w.level === lv.n; });
      var prevDone = lv.n === 1 || A.WEEKS.filter(function (w) { return w.level === lv.n - 1; }).every(function (w) { return weekDone(s, w.n); });
      h += '<div class="sec-h"><span class="t"><span class="lvl-dot" style="background:' + lv.color + '"></span>' + T('Уровень ', 'Level ') + lv.n + ' · ' + esc(lv.title) + '</span><span class="tiny muted">' + T('нед. ', 'wk ') + lv.weeks[0] + '–' + lv.weeks[1] + (prevDone ? '' : ' · ' + I('shield', 'sm') + T(' закрыт', ' locked')) + '</span></div>';
      h += '<div class="tiny muted" style="margin:-4px 4px 8px">' + esc(lv.about) + '</div><div class="list">' + weeks.map(function (w) {
        var has = A.hasWeek(w.n), done = has && weekDone(s, w.n), tag = done ? '<span class="tag ok">' + T('пройдено', 'done') + '</span>' : w.n === cw && has ? '<span class="tag info">' + T('сейчас', 'now') + '</span>' : has ? '<span class="tag">' + T('доступно', 'available') + '</span>' : '<span class="tag">' + T('скоро', 'soon') + '</span>';
        return '<div class="row' + (has ? '' : ' dim') + '"><span class="wk-n num">' + w.n + '</span><div class="main-t"><div class="t1">' + esc(w.title) + ' ' + tag + '</div><div class="t2">' + esc(w.goal) + '</div><div class="t2">' + esc(w.topics.join(' · ')) + '</div></div></div>';
      }).join('') + '</div>';
    });
    h += '<div class="tiny muted mt8">' + T('Кварталы: Q1 — недели 1–13, Q2 — 14–26, Q3 — 27–39, Q4 — 40–52.', 'Quarters: Q1 weeks 1–13, Q2 14–26, Q3 27–39, Q4 40–52.') + '</div>';
    return { title: T('Карта года', 'Year roadmap'), html: h };
  };

  /* ---------- completed ---------- */
  App.screens.academyDone = function () {
    var s = st(), h = '';
    Object.keys(A.content).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      var w = A.content[n];
      h += '<div class="sec-h"><span class="t">' + T('Неделя ', 'Week ') + n + ' · ' + esc(A.WEEKS[n - 1].title) + '</span></div><div class="list">' + w.lessons.map(function (l, i) {
        var d = s.lessons[l.id], ls = lessonState(s, l.id);
        return '<button class="row tap" data-a="go" data-s="academyLesson" data-id="' + l.id + '"' + (ls === 'locked' ? ' disabled style="opacity:.5"' : '') + '><span class="wk-n num">' + (i + 1) + '</span><div class="main-t"><div class="t1">' + esc(l.title) + '</div><div class="t2">' + (d ? d.correct + '/' + d.total + ' · +' + d.xp + ' XP · ' + App.fd(d.date) : ls === 'open' ? T('урок дня', 'lesson of the day') : T('закрыт', 'locked')) + '</div></div>' + (d ? I('check', 'sm') : '') + '</button>';
      }).join('') + (w.tasks || []).map(function (t) { var d = s.tasks[t.id], open = C.academyTaskOpen(s.reached[n], S.today, t.slot); return '<button class="row tap" data-a="go" data-s="academyTask" data-id="' + t.id + '"><span class="cat-ic" style="background:' + (t.slot === 1 ? '#0A84FF' : '#BF5AF2') + '">' + I('briefcase') + '</span><div class="main-t"><div class="t1">' + esc(t.title) + '</div><div class="t2">' + (d ? T('выполнено ', 'done ') + App.fd(d.date) : open ? T('открыто', 'open') : (t.slot === 1 ? T('откроется в понедельник', 'opens Monday') : T('откроется во вторник', 'opens Tuesday'))) + '</div></div></button>'; }).join('') + '</div>';
    });
    return { title: T('Пройденное', 'Completed'), html: h };
  };

  /* ---------- library ---------- */
  App.screens.academyLibrary = function () {
    var h = '<div class="dashed-note">' + T('Необязательные материалы. Бесплатные, если не указано иное. Ссылки открываются на внешних сайтах; ссылки проверены 25.11.2026.', 'Optional. Free unless noted. Links open external sites; checked on 25.11.2026.') + '</div>';
    (A.LIBRARY || []).forEach(function (g) {
      h += '<div class="sec-h"><span class="t">' + esc(g.group) + '</span></div><div class="list">' + g.items.map(function (it) {
        var inner = '<div class="main-t"><div class="t1">' + esc(it.t) + ' <span class="tag">' + esc(it.lang) + '</span></div><div class="t2">' + esc(it.d) + '</div></div>';
        return it.url ? '<a class="row tap" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">' + inner + I('chev', 'sm') + '</a>' : '<div class="row">' + inner + '</div>';
      }).join('') + '</div>';
    });
    h += '<div class="sec-h"><span class="t">' + T('Цитаты', 'Quotes') + '</span></div><div class="list">' + C.QUOTES.filter(function (q) { return q.a !== 'Совет дня'; }).map(function (q) { return '<div class="row"><div class="main-t"><div class="t1" style="white-space:normal">«' + esc(q.ru) + '»</div><div class="t2">' + esc(q.a) + '</div></div></div>'; }).join('') + '</div>';
    return { title: T('Для свободного времени', 'For your free time'), html: h };
  };

  /* ---------- entry points ---------- */
  App.academyTeaser = function () {
    var s = st(), n = nextLesson(s), streak = C.academyStreak(activityDates(s), S.today), pend = openTasks(s).filter(function (t) { return t.open && !t.done; }).length;
    var sub = n.lesson ? (n.available ? T('Урок дня: ', 'Today: ') + n.lesson.title : T('Урок дня пройден ✓', 'Today\'s lesson done ✓')) : T('Все опубликованные уроки пройдены', 'All published lessons done');
    return '<button class="card tap acad-teaser" data-a="go" data-s="academy"><span class="cat-ic" style="background:#5E5CE6">' + I('book') + '</span><div class="grow"><div class="b">' + T('Академия', 'Academy') + '</div><div class="small muted ellipsis">' + esc(sub) + (pend ? ' · ' + T('задание ждёт', 'assignment waiting') : '') + '</div></div><span class="acad-streak">' + I('flame') + '<b class="num">' + streak + '</b></span></button>';
  };
  var moreHub = App.screens.more;
  App.screens.more = function () {
    var out = moreHub(), s = st(), x = xp(s);
    var row = '<div class="list"><button class="row tap" data-a="go" data-s="academy"><span class="cat-ic" style="background:#5E5CE6">' + I('book') + '</span><div class="main-t"><div class="t1">' + T('Академия', 'Academy') + '</div><div class="t2">' + T('Урок дня 10 мин · задания пн/вт · ', 'Daily 10-min lesson · Mon/Tue tasks · ') + x + ' XP</div></div>' + I('chev', 'sm') + '</button>' +
      '<button class="row tap" data-a="go" data-s="incomeYear"><span class="cat-ic" style="background:#30D158">' + I('arrowIn') + '</span><div class="main-t"><div class="t1">' + T('План доходов на год', 'Yearly income plan') + '</div><div class="t2">' + T('месяц · квартал · год, факт и отклонение', 'month · quarter · year, actual & variance') + '</div></div>' + I('chev', 'sm') + '</button></div>';
    var i = out.html.indexOf('<div class="list">');
    out.html = i >= 0 ? out.html.slice(0, i) + row + out.html.slice(i) : row + out.html;
    return out;
  };
  App.academyInternals = { nextLesson: nextLesson, openTasks: openTasks, xp: xp };
})();
