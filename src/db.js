/* Local persistence: IndexedDB with localStorage fallback. No network, no cloud. */
(function (g) {
  var NAME = 'akbar-finance', VER = 1, LS = 'akbar-finance:';
  var db = null, mode = 'memory', mem = {};
  function open() {
    return new Promise(function (resolve) {
      try {
        if (!g.indexedDB) throw new Error('no idb');
        var req = g.indexedDB.open(NAME, VER);
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
          if (!d.objectStoreNames.contains('snapshots')) d.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = function () { db = req.result; mode = 'indexeddb'; resolve(mode); };
        req.onerror = function () { fallback(); resolve(mode); };
        req.onblocked = function () { fallback(); resolve(mode); };
      } catch (e) { fallback(); resolve(mode); }
    });
  }
  function fallback() { try { g.localStorage.setItem(LS + 'test', '1'); g.localStorage.removeItem(LS + 'test'); mode = 'localstorage'; } catch (e) { mode = 'memory'; } }
  function tx(store, rw, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(store, rw), s = t.objectStore(store), r = fn(s);
      t.oncomplete = function () { resolve(r && r.result); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error); };
    });
  }
  function get(key) {
    if (mode === 'indexeddb') return tx('kv', 'readonly', function (s) { return s.get(key); });
    if (mode === 'localstorage') { var v = g.localStorage.getItem(LS + key); return Promise.resolve(v ? JSON.parse(v) : undefined); }
    return Promise.resolve(mem[key]);
  }
  function set(key, val) {
    if (mode === 'indexeddb') return tx('kv', 'readwrite', function (s) { return s.put(val, key); });
    if (mode === 'localstorage') { g.localStorage.setItem(LS + key, JSON.stringify(val)); return Promise.resolve(); }
    mem[key] = val; return Promise.resolve();
  }
  function del(key) {
    if (mode === 'indexeddb') return tx('kv', 'readwrite', function (s) { return s.delete(key); });
    if (mode === 'localstorage') { g.localStorage.removeItem(LS + key); return Promise.resolve(); }
    delete mem[key]; return Promise.resolve();
  }
  function addSnapshot(reason, data) {
    var snap = { ts: new Date().toISOString(), reason: reason, data: data };
    if (mode === 'indexeddb') return tx('snapshots', 'readwrite', function (s) { return s.add(snap); }).then(pruneSnapshots);
    var list = (mode === 'localstorage' ? JSON.parse(g.localStorage.getItem(LS + 'snapshots') || '[]') : (mem.snapshots || []));
    snap.id = Date.now(); list.push(snap); while (list.length > 8) list.shift();
    try { if (mode === 'localstorage') g.localStorage.setItem(LS + 'snapshots', JSON.stringify(list)); else mem.snapshots = list; } catch (e) { /* quota */ }
    return Promise.resolve();
  }
  function listSnapshots() {
    if (mode === 'indexeddb') return tx('snapshots', 'readonly', function (s) { return s.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return b.id - a.id; }); });
    var list = mode === 'localstorage' ? JSON.parse(g.localStorage.getItem(LS + 'snapshots') || '[]') : (mem.snapshots || []);
    return Promise.resolve(list.slice().reverse());
  }
  function pruneSnapshots() {
    return listSnapshots().then(function (l) { var old = l.slice(15); return Promise.all(old.map(function (s) { return tx('snapshots', 'readwrite', function (st) { return st.delete(s.id); }); })); });
  }
  function clearAll() {
    if (mode === 'indexeddb') return Promise.all([tx('kv', 'readwrite', function (s) { return s.clear(); }), tx('snapshots', 'readwrite', function (s) { return s.clear(); })]);
    if (mode === 'localstorage') { Object.keys(g.localStorage).forEach(function (k) { if (k.indexOf(LS) === 0) g.localStorage.removeItem(k); }); }
    mem = {}; return Promise.resolve();
  }
  function persist() {
    try { if (g.navigator && navigator.storage && navigator.storage.persist) return navigator.storage.persist(); } catch (e) { }
    return Promise.resolve(false);
  }
  g.AFDB = { open: open, get: get, set: set, del: del, addSnapshot: addSnapshot, listSnapshots: listSnapshots, clearAll: clearAll, persist: persist, mode: function () { return mode; } };
})(typeof self !== 'undefined' ? self : this);
