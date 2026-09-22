/* presets.js — saved stroke looks.

   Published on claude.ai the presets live in the artifact's shared database, so
   everyone in the team sees everyone's. Opened as a local file there is no such
   store, so they fall back to this browser's localStorage and the UI says so
   rather than pretending they are shared.

   Only ids are stored against a preset, never names: a name differs per viewer,
   freezes at write time and outlives people. Names are resolved at render.
*/
(function (g) {
  'use strict';

  const COLLECTION = 'presets';
  const LOCAL_KEY = 'offset.presets';
  const MAX = 100;

  const P = {
    mode: 'loading',   // loading | shared | local | readonly
    items: [],
    uid: null,
    canWrite: true,
    _db: null,
    _user: null,
    _cbs: [],
    _unsub: null
  };

  function emit() { P._cbs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

  function onChange(fn) { P._cbs.push(fn); }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function writeLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (e) { /* full */ }
  }

  function goLocal() {
    P.mode = 'local';
    P.items = readLocal();
    emit();
  }

  async function init() {
    // window.claude only exists inside the claude.ai viewer, and the namespace
    // never arrives during this first synchronous run — so render local, then
    // light up if the promise delivers.
    if (!g.claude || typeof g.claude.use !== 'function') { goLocal(); return; }

    let db = null, user = null;
    try { db = await g.claude.use('db'); } catch (e) { db = null; }
    if (!db) { goLocal(); return; }
    try { user = await g.claude.use('user'); } catch (e) { user = null; }

    P._db = db;
    P._user = user;
    P.uid = user ? await user.id() : null;
    const may = user ? await user.can('data.write') : null;
    P.canWrite = may !== false;          // null means "not told": keep the controls
    P.mode = 'shared';

    // subscribe once, for the life of the page
    P._unsub = db.collection(COLLECTION)
      .orderBy('at', 'desc')
      .limit(MAX)
      .onSnapshot(
        (snap) => {
          P.items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
          emit();
        },
        () => { /* terminal: keep whatever we last showed */ }
      );
    emit();
  }

  async function save(name, settings) {
    const row = {
      name: String(name || '').slice(0, 60) || 'Untitled',
      settings: settings,
      by: P.uid || null,
      at: new Date().toISOString()
    };
    if (P.mode === 'shared') {
      await P._db.collection(COLLECTION).add(row);
      return;                             // the snapshot brings it back
    }
    const list = readLocal();
    list.unshift(Object.assign({ id: 'l' + Date.now().toString(36) }, row));
    writeLocal(list.slice(0, MAX));
    P.items = readLocal();
    emit();
  }

  async function remove(id) {
    if (P.mode === 'shared') {
      await P._db.collection(COLLECTION).doc(id).delete();
      return;
    }
    writeLocal(readLocal().filter(p => p.id !== id));
    P.items = readLocal();
    emit();
  }

  /* ids -> display names, resolved fresh on every render (cached by the host) */
  async function names(ids) {
    if (P.mode !== 'shared' || !P._user || !ids.length) return {};
    try { return await P._user.profiles(ids); } catch (e) { return {}; }
  }

  g.Presets = {
    init: init,
    onChange: onChange,
    save: save,
    remove: remove,
    names: names,
    get mode() { return P.mode; },
    get items() { return P.items; },
    get uid() { return P.uid; },
    get canWrite() { return P.canWrite; }
  };
})(window);
