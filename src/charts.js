/* SVG charts with tap/hover tooltips. Planned/forecast series are dashed & lighter. */
(function (g) {
  var REG = {};
  var W = 340;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dnum(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +(s.slice(8, 10) || 1)) / 86400000; }
  function niceRange(min, max) { if (min === max) { min -= 100; max += 100; } var pad = (max - min) * 0.08; return [min - pad, max + pad]; }

  function line(o) {
    var H = o.height || 170, padL = 4, padR = 4, padT = 10, padB = 22;
    var all = []; o.series.forEach(function (s) { s.points.forEach(function (p) { all.push(p); }); });
    if (!all.length) return '<div class="empty">' + esc(o.empty || '—') + '</div>';
    var xs = all.map(function (p) { return dnum(p.x); }), ys = all.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs); if (x0 === x1) x1 = x0 + 1;
    var yr = niceRange(Math.min.apply(null, ys.concat(o.zero ? [0] : [])), Math.max.apply(null, ys.concat(o.zero ? [0] : [])));
    var sx = function (d) { return padL + (dnum(d) - x0) / (x1 - x0) * (W - padL - padR); };
    var sy = function (v) { return padT + (1 - (v - yr[0]) / (yr[1] - yr[0])) * (H - padT - padB); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img">';
    for (var i = 0; i <= 3; i++) { var gy = padT + i * (H - padT - padB) / 3; svg += '<line class="gridl" x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '"/>'; }
    if (yr[0] < 0 && yr[1] > 0) svg += '<line x1="0" x2="' + W + '" y1="' + sy(0) + '" y2="' + sy(0) + '" stroke="var(--text2)" stroke-width=".8" stroke-dasharray="2 3"/>';
    (o.bands || []).forEach(function (b) { var a = sx(b.from), c = sx(b.to); svg += '<rect x="' + a + '" y="' + padT + '" width="' + Math.max(1, c - a) + '" height="' + (H - padT - padB) + '" fill="' + b.color + '" opacity=".10"/>'; });
    o.series.forEach(function (s) {
      if (!s.points.length) return;
      var d = s.points.map(function (p, i) { return (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join(' ');
      if (s.fill) svg += '<path d="' + d + ' L' + sx(s.points[s.points.length - 1].x).toFixed(1) + ' ' + (H - padB) + ' L' + sx(s.points[0].x).toFixed(1) + ' ' + (H - padB) + 'Z" fill="' + s.color + '" opacity="' + (s.dashed ? .06 : .14) + '"/>';
      svg += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 2.2) + '" stroke-linejoin="round" stroke-linecap="round"' + (s.dashed ? ' stroke-dasharray="5 4" opacity=".85"' : '') + ' vector-effect="non-scaling-stroke"/>';
      if (s.points.length === 1) svg += '<circle cx="' + sx(s.points[0].x) + '" cy="' + sy(s.points[0].y) + '" r="3.5" fill="' + s.color + '"/>';
    });
    (o.markers || []).forEach(function (m) { var mx = sx(m.x); svg += '<line x1="' + mx + '" x2="' + mx + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="' + m.color + '" stroke-width="1.2" stroke-dasharray="3 3"/>'; if (m.label) svg += '<text class="axis" x="' + Math.min(W - 40, mx + 3) + '" y="' + (padT + 9) + '" fill="' + m.color + '" style="fill:' + m.color + '">' + esc(m.label) + '</text>'; });
    var lab = function (d) { return o.fmtX ? o.fmtX(d) : d.slice(5); };
    var dates = all.map(function (p) { return p.x; }).sort();
    svg += '<text class="axis" x="2" y="' + (H - 6) + '">' + esc(lab(dates[0])) + '</text>';
    svg += '<text class="axis" x="' + (W - 2) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(lab(dates[dates.length - 1])) + '</text>';
    if (o.fmtY) { svg += '<text class="axis" x="' + (W - 2) + '" y="' + (padT + 9) + '" text-anchor="end">' + esc(o.fmtY(yr[1])) + '</text><text class="axis" x="' + (W - 2) + '" y="' + (H - padB - 3) + '" text-anchor="end">' + esc(o.fmtY(yr[0])) + '</text>'; }
    svg += '<line class="cursor" x1="0" x2="0" y1="' + padT + '" y2="' + (H - padB) + '" stroke="var(--text)" stroke-width=".8" opacity="0"/></svg>';
    var uniq = Array.from(new Set(dates));
    REG[o.id] = { type: 'line', W: W, dates: uniq, xs: uniq.map(sx), series: o.series, fmt: o.fmtTip, fmtX: o.fmtX };
    return '<div class="chart" data-chart="' + o.id + '">' + svg + '<div class="tip hidden"></div></div>' + legend(o.series);
  }
  function legend(series) {
    return '<div class="legend">' + series.filter(function (s) { return s.name; }).map(function (s) { return '<span><i class="' + (s.dashed ? 'dash' : '') + '" style="' + (s.dashed ? 'border-color:' : 'background:') + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
  }
  function bars(o) {
    var H = o.height || 160, padT = 10, padB = 22, n = o.groups.length;
    if (!n) return '<div class="empty">' + esc(o.empty || '—') + '</div>';
    var vals = []; o.groups.forEach(function (gr) { gr.values.forEach(function (v) { vals.push(v.v); }); });
    var max = Math.max.apply(null, vals.concat([0])), min = Math.min.apply(null, vals.concat([0])); if (max === min) max = min + 1;
    var sy = function (v) { return padT + (1 - (v - min) / (max - min)) * (H - padT - padB); };
    var gw = W / n, svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    svg += '<line x1="0" x2="' + W + '" y1="' + sy(0) + '" y2="' + sy(0) + '" stroke="var(--sep)"/>';
    o.groups.forEach(function (gr, i) {
      var k = gr.values.length, bw = Math.max(2.5, Math.min(26, (gw - Math.min(8, gw * .3)) / k));
      var start = i * gw + (gw - bw * k) / 2;
      gr.values.forEach(function (v, j) {
        var y = sy(Math.max(0, v.v)), h = Math.abs(sy(v.v) - sy(0));
        svg += '<rect x="' + (start + j * bw + (bw > 6 ? 1 : .3)) + '" y="' + (v.v >= 0 ? y : sy(0)) + '" width="' + Math.max(1, bw - (bw > 6 ? 2 : .6)) + '" height="' + Math.max(1, h) + '" rx="3" fill="' + v.color + '"' + (v.planned ? ' fill-opacity=".28" stroke="' + v.color + '" stroke-dasharray="3 2"' : '') + '/>';
      });
      if (n <= 14 || i % Math.ceil(n / 8) === 0) svg += '<text class="axis" x="' + (i * gw + gw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(gr.label) + '</text>';
    });
    svg += '</svg>';
    REG[o.id] = { type: 'bars', W: W, groups: o.groups, gw: gw, fmt: o.fmtTip };
    var lg = (o.legend || []).map(function (l) { return '<span><i style="background:' + l.color + (l.planned ? ';opacity:.35' : '') + '"></i>' + esc(l.name) + '</span>'; }).join('');
    return '<div class="chart" data-chart="' + o.id + '">' + svg + '<div class="tip hidden"></div></div>' + (lg ? '<div class="legend">' + lg + '</div>' : '');
  }
  function donut(o) {
    var items = o.items.filter(function (i) { return i.v > 0; }), total = items.reduce(function (s, i) { return s + i.v; }, 0);
    var size = o.size || 180, r = size / 2 - 14, c = 2 * Math.PI * r, off = 0;
    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:' + size + 'px;max-width:100%;margin:0 auto">';
    svg += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--card2)" stroke-width="22"/>';
    items.forEach(function (it, i) {
      var len = total ? it.v / total * c : 0;
      svg += '<circle data-seg="' + i + '" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + it.color + '" stroke-width="22" stroke-dasharray="' + Math.max(0, len - 1.5) + ' ' + (c - len + 1.5) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" style="cursor:pointer;transition:stroke-width .15s"/>';
      off += len;
    });
    svg += '</svg>';
    REG[o.id] = { type: 'donut', items: items, total: total, fmt: o.fmtTip, center: o.center };
    return '<div class="chart" data-chart="' + o.id + '" style="display:grid;place-items:center">' + svg + '<div class="ring-c" style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;text-align:center"><div><div class="small muted dc-l">' + esc(o.centerLabel || '') + '</div><div class="b dc-v" style="font-size:18px">' + esc(o.center || '') + '</div></div></div></div>';
  }
  function ring(pct, color, size, inner) {
    size = size || 64; var r = size / 2 - 5, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px"><svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--card2)" stroke-width="7"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (c * p) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg><div class="in">' + (inner || '') + '</div></div>';
  }
  function handle(ev) {
    var el = ev.target.closest && ev.target.closest('.chart[data-chart]'); if (!el) return;
    var R = REG[el.getAttribute('data-chart')]; if (!R) return;
    var tip = el.querySelector('.tip'), svg = el.querySelector('svg'), rect = svg.getBoundingClientRect();
    var px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left) / rect.width * (R.W || rect.width);
    var html = '', left = 0;
    if (R.type === 'line') {
      var best = 0; for (var i = 1; i < R.xs.length; i++) if (Math.abs(R.xs[i] - px) < Math.abs(R.xs[best] - px)) best = i;
      var d = R.dates[best]; left = R.xs[best] / R.W * rect.width;
      html = '<b>' + esc(R.fmtX ? R.fmtX(d, true) : d) + '</b>';
      R.series.forEach(function (s) { var p = s.points.filter(function (q) { return q.x === d; })[0]; if (p) html += '<br><span style="color:' + s.color + '">●</span> ' + esc(s.name || '') + ' ' + esc(R.fmt ? R.fmt(p.y) : p.y); });
      var cur = svg.querySelector('.cursor'); if (cur) { cur.setAttribute('x1', R.xs[best]); cur.setAttribute('x2', R.xs[best]); cur.setAttribute('opacity', '.5'); }
    } else if (R.type === 'bars') {
      var gi = Math.max(0, Math.min(R.groups.length - 1, Math.floor(px / R.gw))), gr = R.groups[gi];
      left = (gi + .5) * R.gw / R.W * rect.width;
      html = '<b>' + esc(gr.tip || gr.label) + '</b>' + gr.values.map(function (v) { return '<br><span style="color:' + v.color + '">●</span> ' + esc(v.name || '') + ' ' + esc(R.fmt ? R.fmt(v.v) : v.v); }).join('');
    } else if (R.type === 'donut') {
      var seg = ev.target.getAttribute && ev.target.getAttribute('data-seg');
      if (seg == null) return;
      var it = R.items[+seg];
      el.querySelectorAll('[data-seg]').forEach(function (c) { c.style.strokeWidth = c === ev.target ? 28 : 22; });
      el.querySelector('.dc-l').textContent = it.label;
      el.querySelector('.dc-v').textContent = (R.fmt ? R.fmt(it.v) : it.v) + ' · ' + Math.round(it.v / R.total * 100) + '%';
      return;
    }
    tip.innerHTML = html; tip.classList.remove('hidden');
    var tw = tip.offsetWidth; left = Math.max(tw / 2, Math.min(rect.width - tw / 2, left));
    tip.style.left = left + 'px'; tip.style.top = '-8px'; tip.style.transform = 'translate(-50%,-100%)';
  }
  function leave(ev) {
    var el = ev.target.closest && ev.target.closest('.chart[data-chart]'); if (!el) return;
    var tip = el.querySelector('.tip'); if (tip) tip.classList.add('hidden');
    var cur = el.querySelector('.cursor'); if (cur) cur.setAttribute('opacity', '0');
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') handle(e); });
    document.addEventListener('pointerdown', handle);
    document.addEventListener('pointerout', function (e) { if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('.chart') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.chart') === e.target.closest('.chart'))) leave(e); });
  }
  g.AFCharts = { line: line, bars: bars, donut: donut, ring: ring, REG: REG };
})(typeof self !== 'undefined' ? self : this);
