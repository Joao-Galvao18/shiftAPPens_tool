/* presets.js — saved stroke looks.

   Published on claude.ai the presets live in the artifact's shared database, so
   everyone in the team sees everyone's. Opened as a local file there is no such
   store, so they fall back to this browser's localStorage and the UI says so
   rather than pretending they are shared.

   LAYOUT. One document per person — `presets/<their id>` — holding that person's
   whole list. Paired with the published rules

       { path: "presets",        read: "view",  write: "admin" }
       { path: "presets/{self}", write: "interact" }

   that means everyone reads every list while nobody can touch anyone else's:
   ownership is enforced by the store, not merely hidden in the interface. It is
   also still ONE subscription over ONE collection, because those per-person
   documents sit directly in `presets` — nesting each person's presets in a
   subcollection instead is what would force a roster and a subscription each.

   A list is a few hundred bytes per preset against a 256 KiB document cap, so
   the array has room for far more than anyone will save.

   Only ids are stored against a preset, never names: a name differs per viewer,
   freezes at write time and outlives people. Names are resolved at render.
*/
(function (g) {
  'use strict';

  const COLLECTION = 'presets';
  const LOCAL_KEY = 'offset.presets';
  const MAX_PER_PERSON = 60;

  const P = {
    mode: 'loading',   // loading | shared | local
    items: [],
    uid: null,
    canWrite: true,
    _db: null,
    _user: null,
    _mine: [],         // my own list, as last seen in the store
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

  function newId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  async function init() {
    // window.claude exists only inside the claude.ai viewer, and the namespace
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
    // no id means no document of one's own to write; null "may" means the
    // platform said nothing, so keep the control and let a refused write decide
    P.canWrite = !!P.uid && may !== false;
    P.mode = 'shared';

    // one subscription over everyone's lists
    P._unsub = db.collection(COLLECTION).onSnapshot(
      (snap) => {
        const all = [];
        snap.docs.forEach(d => {
          const body = d.data() || {};
          const items = Array.isArray(body.items) ? body.items : [];
          items.forEach(it => {
            if (it && it.settings) all.push({ id: it.id, name: it.name, at: it.at, settings: it.settings, by: d.id });
          });
          if (d.id === P.uid) P._mine = items.slice();
        });
        all.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
        P.items = all;
        emit();
      },
      () => { /* terminal: keep whatever we last showed */ }
    );
    emit();
  }

  async function save(name, settings) {
    const row = {
      id: newId(),
      name: String(name || '').slice(0, 60) || 'Untitled',
      settings: settings,
      at: new Date().toISOString()
    };

    if (P.mode === 'shared') {
      if (!P.uid) throw new Error('no identity');
      const next = [row].concat(P._mine).slice(0, MAX_PER_PERSON);
      await P._db.collection(COLLECTION).doc(P.uid).set({ items: next });
      P._mine = next;                    // the snapshot confirms it shortly
      return;
    }

    const list = [row].concat(readLocal()).slice(0, MAX_PER_PERSON);
    writeLocal(list);
    P.items = list;
    emit();
  }

  async function remove(id) {
    if (P.mode === 'shared') {
      if (!P.uid) return;
      const next = P._mine.filter(it => it && it.id !== id);
      await P._db.collection(COLLECTION).doc(P.uid).set({ items: next });
      P._mine = next;
      return;
    }
    const list = readLocal().filter(p => p.id !== id);
    writeLocal(list);
    P.items = list;
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
