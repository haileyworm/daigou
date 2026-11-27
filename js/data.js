// ============================================================
//  資料層：Firebase（正式）或 localStorage（示範模式）
//  所有 Firestore 錯誤都會丟給 onError，額度用完會被 app.js 攔下來顯示提示
// ============================================================
import { FIREBASE_CONFIG, OWNER_EMAIL } from './config.js';

export const DEMO = String(FIREBASE_CONFIG.apiKey || '').startsWith('YOUR');

let onError = (e) => console.error(e);
export function setErrorHandler(fn) { onError = fn; }

const uid8 = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------
//  示範模式
// ---------------------------------------------------------------
function makeLocal() {
  const KEY = 'daigou-demo-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { projects: {} }; } catch { return { projects: {} }; } };
  let db = load();
  const listeners = new Set();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('示範模式儲存失敗（圖片可能太大）', e); }
    listeners.forEach((fn) => fn());
  };
  const sub = (fn) => { listeners.add(fn); fn(); return () => listeners.delete(fn); };
  const P = (pid) => db.projects[pid];
  const strip = (p) => { const { products, orders, ...rest } = p; return rest; };
  const user = { uid: 'demo-user', email: OWNER_EMAIL, isOwner: true, demo: true };

  return {
    onAuth(cb) { setTimeout(() => cb(user), 0); },
    async loginOwner() {}, async logout() {},
    watchProjects(_isOwner, cb) {
      return sub(() => cb(Object.values(db.projects).map(strip)));
    },
    watchProject(pid, cb) { return sub(() => cb(P(pid) ? strip(P(pid)) : null)); },
    watchProducts(pid, cb) { return sub(() => cb(P(pid) ? Object.values(P(pid).products || {}) : [])); },
    watchOrders(pid, cb) { return sub(() => cb(P(pid) ? Object.values(P(pid).orders || {}) : [])); },
    async createProject(data) { const id = uid8(); db.projects[id] = { ...data, id, products: {}, orders: {} }; save(); return id; },
    async updateProject(pid, patch) { Object.assign(P(pid), patch); save(); },
    async deleteProject(pid) { delete db.projects[pid]; save(); },
    async saveProduct(pid, id, data) { id = id || uid8(); P(pid).products[id] = { ...data, id }; save(); return id; },
    async deleteProduct(pid, id) { delete P(pid).products[id]; save(); },
    async createOrder(pid, data) { const id = uid8(); P(pid).orders[id] = { ...data, id, uid: user.uid }; save(); return id; },
    async updateOrder(pid, oid, patch) { Object.assign(P(pid).orders[oid], patch); save(); },
    async deleteOrder(pid, oid) { delete P(pid).orders[oid]; save(); },
    async setReview(pid, oid, review) { P(pid).orders[oid].review = review; save(); },
    async clearReview(pid, oid) { delete P(pid).orders[oid].review; save(); },
  };
}

// ---------------------------------------------------------------
//  Firebase 正式模式
// ---------------------------------------------------------------
async function makeFirebase() {
  const V = '10.12.2';
  const [{ initializeApp }, authM, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = authM.getAuth(app);
  const db = fs.getFirestore(app);
  const { collection, doc, onSnapshot, query, where, addDoc, setDoc, updateDoc, deleteDoc, deleteField, getDocs, writeBatch } = fs;

  const wrap = (p) => p.catch((e) => { onError(e); throw e; });
  const watchErr = (e) => onError(e, 'watch');
  const list = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  const isOwnerUser = (u) => !!u && !u.isAnonymous && u.emailVerified &&
    (u.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase();

  return {
    onAuth(cb) {
      authM.onAuthStateChanged(auth, (u) => {
        if (!u) { // 客人不用登入：自動用匿名身分
          authM.signInAnonymously(auth).catch(onError);
          return;
        }
        cb({ uid: u.uid, email: u.email, isOwner: isOwnerUser(u), anonymous: u.isAnonymous });
      });
    },
    async loginOwner() {
      const provider = new authM.GoogleAuthProvider();
      try { await authM.signInWithPopup(auth, provider); }
      catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
          await authM.signInWithRedirect(auth, provider);
        } else { onError(e); throw e; }
      }
    },
    async logout() { await authM.signOut(auth); },

    watchProjects(isOwner, cb) {
      const ref = isOwner ? collection(db, 'projects') : query(collection(db, 'projects'), where('hidden', '==', false));
      return onSnapshot(ref, (s) => cb(list(s)), watchErr);
    },
    watchProject(pid, cb) {
      return onSnapshot(doc(db, 'projects', pid), (d) => cb(d.exists() ? { ...d.data(), id: d.id } : null), watchErr);
    },
    watchProducts(pid, cb) { return onSnapshot(collection(db, 'projects', pid, 'products'), (s) => cb(list(s)), watchErr); },
    watchOrders(pid, cb) { return onSnapshot(collection(db, 'projects', pid, 'orders'), (s) => cb(list(s)), watchErr); },

    createProject: (data) => wrap(addDoc(collection(db, 'projects'), data).then((r) => r.id)),
    updateProject: (pid, patch) => wrap(updateDoc(doc(db, 'projects', pid), patch)),
    async deleteProject(pid) {
      // 先刪子集合，再刪本體
      const batch = writeBatch(db);
      for (const sub of ['products', 'orders']) {
        const s = await wrap(getDocs(collection(db, 'projects', pid, sub)));
        s.docs.forEach((d) => batch.delete(d.ref));
      }
      batch.delete(doc(db, 'projects', pid));
      return wrap(batch.commit());
    },
    saveProduct(pid, id, data) {
      if (id) return wrap(setDoc(doc(db, 'projects', pid, 'products', id), data).then(() => id));
      return wrap(addDoc(collection(db, 'projects', pid, 'products'), data).then((r) => r.id));
    },
    deleteProduct: (pid, id) => wrap(deleteDoc(doc(db, 'projects', pid, 'products', id))),
    createOrder: (pid, data) => wrap(addDoc(collection(db, 'projects', pid, 'orders'), { ...data, uid: auth.currentUser.uid }).then((r) => r.id)),
    updateOrder: (pid, oid, patch) => wrap(updateDoc(doc(db, 'projects', pid, 'orders', oid), patch)),
    deleteOrder: (pid, oid) => wrap(deleteDoc(doc(db, 'projects', pid, 'orders', oid))),
    setReview: (pid, oid, review) => wrap(updateDoc(doc(db, 'projects', pid, 'orders', oid), { review })),
    clearReview: (pid, oid) => wrap(updateDoc(doc(db, 'projects', pid, 'orders', oid), { review: deleteField() })),
  };
}

export async function createStore() {
  if (DEMO) return makeLocal();
  try { return await makeFirebase(); }
  catch (e) { onError(e); throw e; }
}
