// Sync-Schicht für die Einkaufsliste: Firebase Firestore (geteilt) oder localStorage (nur dieses Gerät).
// State pro Woche: { checked: {itemKey: true}, custom: [{key, name}] }
(function () {
  const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  const subs = {};          // weekId -> [cb]
  const states = {};        // weekId -> state
  let mode = "local";
  let fs = null, db = null, unsubs = {};

  const empty = () => ({ checked: {}, custom: [] });
  const norm = (s) => ({ checked: (s && s.checked) || {}, custom: (s && s.custom) || [] });
  const lsKey = (w) => "einkauf:" + w;

  function lsRead(w) {
    try { return norm(JSON.parse(localStorage.getItem(lsKey(w)) || "null")); } catch (e) { return empty(); }
  }
  function lsWrite(w, s) {
    try { localStorage.setItem(lsKey(w), JSON.stringify(s)); } catch (e) {}
  }
  function emit(w) { (subs[w] || []).forEach((cb) => cb(states[w])); }

  function slug(s) {
    return String(s).toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function init() {
    const cfg = window.FIREBASE_CONFIG, hid = window.HOUSEHOLD_ID;
    if (!cfg || !hid) { mode = "local"; return mode; }
    try {
      const appMod = await import(FB + "firebase-app.js");
      const authMod = await import(FB + "firebase-auth.js");
      fs = await import(FB + "firebase-firestore.js");
      const app = appMod.initializeApp(cfg);
      await authMod.signInAnonymously(authMod.getAuth(app));
      try {
        db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
      } catch (e) { db = fs.getFirestore(app); }
      mode = "firebase";
    } catch (e) {
      console.warn("Firebase nicht verfügbar, nutze lokalen Speicher:", e);
      mode = "local";
    }
    return mode;
  }

  const ref = (w) => fs.doc(db, "households", window.HOUSEHOLD_ID, "weeks", w);

  function subscribe(w, cb) {
    (subs[w] = subs[w] || []).push(cb);
    if (mode === "firebase") {
      if (!unsubs[w]) {
        states[w] = states[w] || empty();
        unsubs[w] = fs.onSnapshot(ref(w), (snap) => {
          states[w] = norm(snap.exists() ? snap.data() : null);
          emit(w);
        }, (err) => console.warn("Sync-Fehler:", err));
      }
      cb(states[w]);
    } else {
      states[w] = lsRead(w);
      cb(states[w]);
    }
    return () => { subs[w] = (subs[w] || []).filter((f) => f !== cb); };
  }

  function localUpdate(w, fn) {
    const s = norm(states[w] || lsRead(w));
    fn(s);
    states[w] = s; lsWrite(w, s); emit(w);
  }

  async function setChecked(w, key, val) {
    if (mode === "firebase") {
      // optimistic
      const s = norm(states[w]); if (val) s.checked[key] = true; else delete s.checked[key];
      states[w] = s; emit(w);
      const upd = {}; upd["checked." + key] = val ? true : fs.deleteField();
      try { await fs.updateDoc(ref(w), upd); }
      catch (e) { await fs.setDoc(ref(w), { checked: val ? { [key]: true } : {} }, { merge: true }); }
    } else localUpdate(w, (s) => { if (val) s.checked[key] = true; else delete s.checked[key]; });
  }

  async function addItem(w, name) {
    name = String(name || "").trim(); if (!name) return;
    const item = { key: "eigen-" + slug(name) + "-" + Date.now().toString(36), name };
    if (mode === "firebase") {
      await fs.setDoc(ref(w), { custom: fs.arrayUnion(item) }, { merge: true });
    } else localUpdate(w, (s) => { s.custom.push(item); });
  }

  async function removeItem(w, key) {
    if (mode === "firebase") {
      const s = norm(states[w]);
      const custom = s.custom.filter((c) => c.key !== key);
      const checked = Object.assign({}, s.checked); delete checked[key];
      await fs.setDoc(ref(w), { custom, checked });
    } else localUpdate(w, (s) => { s.custom = s.custom.filter((c) => c.key !== key); delete s.checked[key]; });
  }

  async function reset(w) {
    if (mode === "firebase") {
      const s = norm(states[w]);
      await fs.setDoc(ref(w), { checked: {}, custom: s.custom });
    } else localUpdate(w, (s) => { s.checked = {}; });
  }

  window.Sync = { init, subscribe, setChecked, addItem, removeItem, reset, slug, get mode() { return mode; } };
})();
