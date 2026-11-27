// ============================================================
//  代購商品登記單 — 主程式
// ============================================================
import { SITE } from './config.js';
import { createStore, setErrorHandler, DEMO } from './data.js';
import { ILLUSTRATIONS, illustration, DEFAULT_ILLUSTRATION } from './illustrations.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const layer = $('#layer');

// ------------------------------------------------------------
//  狀態
// ------------------------------------------------------------
const S = {
  store: null,
  user: null,
  guestView: false,
  projects: null,
  unsubProjects: null,
  cur: { pid: null, project: undefined, products: [], orders: [], unsubs: [], denied: false },
  ui: {
    overviewSeg: 'reg', sort: 'time-asc', fieldsSeg: 'review', reviewFilter: 'pending',
    editingOrder: null, rows: null, fieldsDraft: null, fieldsDirty: false,
  },
  quota: false,
  lastKey: '',
};
const isOwner = () => !!S.user?.isOwner && !S.guestView;

// ------------------------------------------------------------
//  小工具
// ------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeImg = (u) => (typeof u === 'string' && (/^data:image\//.test(u) || /^https:\/\//.test(u))) ? u : '';
const newId = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

const CURRENCIES = [
  ['JPY', '日圓', '¥'], ['KRW', '韓元', '₩'], ['USD', '美元', 'US$'], ['EUR', '歐元', '€'],
  ['GBP', '英鎊', '£'], ['CNY', '人民幣', 'CN¥'], ['HKD', '港幣', 'HK$'], ['THB', '泰銖', '฿'],
  ['AUD', '澳幣', 'A$'], ['SGD', '新加坡幣', 'S$'],
];
const cur = (code) => CURRENCIES.find((c) => c[0] === code) || [code, code, code];
const fmtNum = (n, d = 0) => Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: d });
const fmtTWD = (n) => `NT$ ${fmtNum(n)}`;
const fmtFX = (n, code) => `${cur(code)[2]} ${fmtNum(n, 2)}`;
const twdOf = (product, project) => Math.round(num(product?.foreignPrice) * num(project?.rate));
const fmtTime = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const STATUS = {
  open: { label: '代購進行中', cls: 'open', desc: '開放登記中' },
  view: { label: '純檢視中', cls: 'view', desc: '只能看，不能登記' },
  locked: { label: '已結束・鎖定', cls: 'locked', desc: '已結單，卡片無法點進去' },
};
const REVIEW = { pending: '待審核', approved: '已通過', rejected: '被拒絕' };
const statusChip = (st) => st.s === 'rejected'
  ? `<span class="chip rejected chip-wrap">✕ 被拒絕${st.reason ? `；${esc(st.reason)}` : ''}</span>`
  : `<span class="chip ${st.s}">${REVIEW[st.s]}</span>`;
const itemName = (it, st) => `<span class="${st.s === 'rejected' ? 'struck' : ''}">${esc(productNameOf(it))}</span>`;

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg; el.setAttribute('role', 'status');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ------------------------------------------------------------
//  額度用完（resource-exhausted）：全螢幕、不能關閉、只能重新整理
// ------------------------------------------------------------
function nextQuotaReset() {
  // Firebase 免費方案的每日額度在「美國太平洋時間」午夜重置
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = wall - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1, 0, 0, 0) - offset);
}
function showQuota() {
  if (S.quota) return;
  S.quota = true;
  const reset = nextQuotaReset();
  const wk = '日一二三四五六'[reset.getDay()];
  const p = (x) => String(x).padStart(2, '0');
  const when = `${reset.getMonth() + 1}/${reset.getDate()}（${wk}）${p(reset.getHours())}:${p(reset.getMinutes())}`;
  const el = document.createElement('div');
  el.className = 'quota'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="card stack">
      <div class="big" aria-hidden="true">🌙</div>
      <h2>今天的免費用量已滿</h2>
      <p>預計 <b>${when}</b> 後恢復，請到時重新整理。</p>
      <p class="muted small" id="quota-left"></p>
      <button class="btn primary block" onclick="location.reload()">重新整理</button>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
  const tick = () => {
    const m = Math.max(0, Math.round((reset - Date.now()) / 60000));
    $('#quota-left').textContent = m > 0 ? `大約還要 ${Math.floor(m / 60)} 小時 ${m % 60} 分鐘` : '應該已經恢復了，請按重新整理';
  };
  tick(); setInterval(tick, 30000);
}

function handleError(e, src) {
  const code = e?.code || '';
  console.error(e);
  if (code === 'resource-exhausted' || code === 'auth/quota-exceeded') return showQuota();
  if (src === 'watch' && !S.cur.pid) { // 首頁讀不到資料：顯示原因，不要一直轉圈
    S.homeError = code || 'unknown'; if (!S.projects) S.projects = []; render(true); return;
  }
  if (code === 'permission-denied') {
    if (src === 'watch') { if (S.cur.pid) { S.cur.denied = true; render(true); } return; }
    return toast('沒有權限執行這個動作（可能已被審核或已結單）');
  }
  if (code === 'unavailable') return toast('網路好像斷了，恢復後會自動同步');
  toast('發生錯誤：' + (e?.message || code || '未知錯誤'));
}
setErrorHandler(handleError);

// ------------------------------------------------------------
//  彈出視窗
// ------------------------------------------------------------
let modalResolve = null;
function openModal(html, { noBgClose = false } = {}) {
  layer.innerHTML = `<div class="modal-bg" ${noBgClose ? '' : 'data-action="modal-bg"'}><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $('.modal [autofocus]', layer) || $('.modal input, .modal textarea, .modal select', layer);
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal(val = null) {
  layer.innerHTML = '';
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(val); }
}
function askText(title, { placeholder = '', okText = '確定', value = '' } = {}) {
  openModal(`<h2>${esc(title)}</h2>
    <textarea class="in" id="ask-in" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    <div class="row" style="justify-content:flex-end;margin-top:12px">
      <button class="btn ghost" data-action="modal-cancel">取消</button>
      <button class="btn primary" data-action="modal-ok-text">${esc(okText)}</button></div>`);
  return new Promise((r) => { modalResolve = r; });
}
function askConfirm(msg, okText = '確定') {
  openModal(`<h2>${esc(msg)}</h2>
    <div class="row" style="justify-content:flex-end">
      <button class="btn ghost" data-action="modal-cancel">取消</button>
      <button class="btn primary" data-action="modal-ok">${esc(okText)}</button></div>`);
  return new Promise((r) => { modalResolve = r; });
}

// 圖片：壓縮後存成文字放進 Firestore（免費方案不用開 Storage）
function fileToDataURL(file, max = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const enc = (m, q) => {
        const s = Math.min(1, m / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const g = c.getContext('2d'); g.fillStyle = '#FFFCF6'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', q);
      };
      let out = enc(max, 0.78);
      if (out.length > 300000) out = enc(600, 0.65);
      if (out.length > 300000) out = enc(480, 0.55);
      URL.revokeObjectURL(img.src);
      resolve(out);
    };
    img.onerror = () => reject(new Error('圖片讀取失敗'));
    img.src = URL.createObjectURL(file);
  });
}
function pickFile() {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*';
    i.onchange = async () => { if (!i.files[0]) return resolve(null); try { resolve(await fileToDataURL(i.files[0])); } catch (e) { toast(e.message); resolve(null); } };
    i.click();
  });
}

// ------------------------------------------------------------
//  資料計算
// ------------------------------------------------------------
const DEFAULT_FIELDS = () => [
  { id: 'f_prod', label: '商品', type: 'select', source: 'name', required: true },
  { id: 'f_qty', label: '數量', type: 'number', required: true },
  { id: 'f_amt', label: '金額', type: 'amount', selectId: 'f_prod', qtyId: 'f_qty' },
];
// 固定欄位（每筆登記只填一次）：第一個一定是「登記人」，名稱可改、不能刪
const NAME_FIELD_ID = 'o_name';
const DEFAULT_ORDER_FIELDS = () => [{ id: NAME_FIELD_ID, label: '登記人', type: 'text', required: true, fixed: true, public: true }];
function orderFieldsOf(p) {
  const list = Array.isArray(p?.orderFields) && p.orderFields.length ? p.orderFields : DEFAULT_ORDER_FIELDS();
  return list.some((f) => f.id === NAME_FIELD_ID) ? list : [...DEFAULT_ORDER_FIELDS(), ...list];
}
const ORDER_FIELD_TYPES = { text: '輸入欄（文字）', number: '輸入欄（數字）', date: '日期' };
const fieldsOf = (p) => (Array.isArray(p?.fields) && p.fields.length ? p.fields : DEFAULT_FIELDS());
const mainSelect = (fields) => fields.find((f) => f.type === 'select');
function qtyFieldOf(fields) {
  const amt = fields.find((f) => f.type === 'amount' && f.qtyId);
  return fields.find((f) => f.id === amt?.qtyId) || fields.find((f) => f.type === 'number');
}
const sortedProducts = () => [...S.cur.products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(b.name, 'zh-Hant'));
const productById = (id) => S.cur.products.find((p) => p.id === id);

function itemStatus(order, item) {
  const r = order.review;
  if (!r) return { s: 'pending' };
  if (r.order === 'rejected') return { s: 'rejected', reason: r.orderReason };
  const it = r.items?.[item.id];
  if (it) return { s: it.status, reason: it.reason };
  if (r.order === 'approved') return { s: 'approved' };
  return { s: 'pending' };
}
function orderStatus(order) {
  if (order.cancelled) return 'cancelled';
  const st = (order.items || []).map((it) => itemStatus(order, it).s);
  if (!st.length || st.every((s) => s === 'pending')) return 'pending';
  if (st.some((s) => s === 'pending')) return 'partial';
  if (st.every((s) => s === 'rejected')) return 'rejected';
  if (st.every((s) => s === 'approved')) return 'approved';
  return 'mixed';
}
// 每個商品被登記多少（未通過的不算）
function countsByProduct(exceptOrderId = null) {
  const m = {};
  for (const o of S.cur.orders) {
    if (o.id === exceptOrderId || o.cancelled) continue;
    for (const it of o.items || []) {
      if (itemStatus(o, it).s === 'rejected') continue;
      m[it.productId] = (m[it.productId] || 0) + (num(it.qty) || 1);
    }
  }
  return m;
}
function stockInfo(product, counts) {
  const used = counts[product.id] || 0;
  const qty = num(product.qty);
  // 候補最高總數：空白＝不限，填 0＝不開放候補
  const wlRaw = product.waitlistMax;
  const wl = (wlRaw === null || wlRaw === undefined || wlRaw === '') ? Infinity : num(wlRaw);
  return {
    used, qty, wl,
    left: Math.max(0, qty - used),
    waitUsed: Math.max(0, used - qty),
    waitLeft: Math.max(0, wl - Math.max(0, used - qty)),
    full: used >= qty + wl,
  };
}

// ------------------------------------------------------------
//  路由：#/  首頁   #/p/<id>/<tab>  清單頁
// ------------------------------------------------------------
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'p' && parts[1]) return { name: 'project', pid: parts[1], tab: parts[2] || '' };
  return { name: 'home' };
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function subscribeProject(pid) {
  if (S.cur.pid === pid) return;
  S.cur.unsubs.forEach((u) => u && u());
  S.cur = { pid, project: undefined, products: [], orders: [], unsubs: [], denied: false };
  S.ui.fieldsDraft = null; S.ui.orderDraft = null; S.ui.fieldsDirty = false; S.ui.editingOrder = null; S.ui.rows = null;
  if (!pid) return;
  const st = S.store;
  S.cur.unsubs.push(st.watchProject(pid, (p) => {
    S.cur.project = p;
    if (!S.ui.fieldsDirty) { S.ui.fieldsDraft = null; S.ui.orderDraft = null; }
    if (p && (p.status !== 'locked' && !p.hidden || S.user?.isOwner)) ensureSubs();
    render();
  }));
}
function ensureSubs() {
  if (S.cur.unsubs.length > 1) return;
  const pid = S.cur.pid;
  S.cur.unsubs.push(S.store.watchProducts(pid, (list) => { S.cur.products = list; render(); }));
  S.cur.unsubs.push(S.store.watchOrders(pid, (list) => { S.cur.orders = list; render(); }));
}
function subscribeProjects() {
  if (S.unsubProjects) S.unsubProjects();
  S.homeError = '';
  S.unsubProjects = S.store.watchProjects(!!S.user?.isOwner, (list) => { S.projects = list; S.homeError = ''; render(); });
}

// ------------------------------------------------------------
//  畫面
// ------------------------------------------------------------
let pendingRender = false;
function render(force = false) {
  if (!S.store) return;
  // 正在輸入時，先不要重畫（避免打字被清掉），離開輸入框後再畫
  const a = document.activeElement;
  if (!force && a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { pendingRender = true; return; }
  pendingRender = false;
  if (!force && $('#reg-form', app)) readRows();
  const kept = $$('input[id],textarea[id],select[id]', app).map((el) => [el.id, el.value]);
  const r = parseRoute();
  let html, key;
  if (r.name === 'project') {
    subscribeProject(r.pid);
    const v = viewProject(r);
    html = v.html; key = `p/${r.pid}/${v.tab}/${v.seg || ''}`;
  } else {
    subscribeProject(null);
    html = viewHome(); key = 'home';
  }
  const y = window.scrollY;
  app.innerHTML = html;
  if (key === S.lastKey) kept.forEach(([id, v]) => { const el = document.getElementById(id); if (el && app.contains(el) && !el.readOnly) el.value = v; });
  if (key !== S.lastKey) {
    const pg = $('.page', app);
    if (pg) pg.classList.add('page-enter');
    if (S.lastKey.split('/')[1] !== key.split('/')[1]) window.scrollTo(0, 0);
    S.lastKey = key;
  } else window.scrollTo(0, y);
  renderMenu();
}
document.addEventListener('focusout', () => setTimeout(() => {
  if (pendingRender && !(document.activeElement && app.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) render();
}, 0));

function coverHTML(p) {
  const c = p.cover || {};
  if (c.type === 'image' && safeImg(c.src)) return `<img src="${esc(c.src)}" alt="">`;
  return illustration(c.key || DEFAULT_ILLUSTRATION);
}

// ---------- 首頁 ----------
function viewHome() {
  const owner = isOwner();
  const tpl = $('#hero-art-template');
  const heroSvg = tpl && tpl.innerHTML.includes('<svg') ? tpl.innerHTML : '';
  const demo = DEMO ? `<div class="demo-banner">🧪 示範模式：還沒填 Firebase 設定，資料只存在這台裝置。照 README 設定好就會變成正式版。</div>` : '';
  let list = S.projects || [];
  if (!owner) list = list.filter((p) => !p.hidden);
  list = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const sections = Object.entries(STATUS).map(([k, s]) => {
    const items = list.filter((p) => (p.status || 'open') === k);
    return `
      <h2 class="section-title"><span class="dot" style="background:var(--${k === 'open' ? 'coral' : k === 'view' ? 'water' : 'lock'})"></span>${s.label}<span class="count">${items.length}</span></h2>
      ${items.length ? `<div class="grid">${items.map(projectCard).join('')}</div>` : `<div class="empty">${k === 'open' ? '目前沒有進行中的代購' : '目前沒有'}</div>`}`;
  }).join('');

  return `<div class="page">
    ${demo}
    <section class="hero">
      <div>
        <h1>${esc(SITE.name)}</h1>
        <p>${esc(SITE.tagline)}</p>
        ${owner ? `<div class="row" style="margin-top:14px"><button class="btn primary" data-action="new-project">＋ 新增代購</button></div>` : ''}
      </div>
      <div class="hero-art" id="hero-art">${heroSvg || '<span class="small">首頁插圖預留區（SVG）</span>'}</div>
    </section>
    ${S.homeError ? `<div class="demo-banner" style="margin-top:16px;background:var(--coral-pale)">⚠️ ${S.homeError === 'permission-denied'
      ? '資料庫拒絕讀取：請到 Firebase 主控台 → Firestore Database → 規則，貼上 firestore.rules 的內容（Email 換成你的）並按「發布」。'
      : `讀取資料失敗（${esc(S.homeError)}）：請確認 Firebase 已建立 Firestore 資料庫。`}</div>` : ''}
    ${S.projects === null ? '<p class="center muted">載入中…</p>' : sections}
  </div>`;
}

function projectCard(p) {
  const owner = isOwner();
  const st = STATUS[p.status || 'open'];
  const locked = p.status === 'locked' && !owner;
  return `<article class="card p-card ${locked ? 'locked' : ''}" data-action="open-project" data-pid="${esc(p.id)}" tabindex="0" aria-label="${esc(p.title)}">
    <div class="cover">${coverHTML(p)}<span class="chip ${st.cls}">${st.label}</span>${locked ? '<span class="lock-mark" aria-hidden="true">🔒</span>' : ''}</div>
    <div class="body">
      <h3>${esc(p.title || '未命名代購')}</h3>
      ${p.description ? `<p class="muted small" style="margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.description)}</p>` : ''}
      ${owner ? `<div class="owner-ctrl">
        <select class="in" style="min-height:36px;width:auto;padding:2px 8px;font-size:14px" data-change="project-status" data-pid="${esc(p.id)}" aria-label="狀態">
          ${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
        <button class="btn sm ${p.hidden ? '' : 'green'}" data-action="toggle-hidden" data-pid="${esc(p.id)}">${p.hidden ? '🙈 不公開' : '👀 公開中'}</button>
      </div>` : ''}
    </div>
  </article>`;
}

// ---------- 清單頁 ----------
function viewProject(r) {
  const p = S.cur.project;
  const owner = isOwner();
  if (p === undefined && !S.cur.denied) return { html: '<p class="center muted">載入中…</p>', tab: '' };
  if (p && !owner && p.status === 'locked') return { html: `<div class="page empty">🔒 這個代購已結束並鎖定囉。<br><br><a class="btn" href="#/">回首頁</a></div>`, tab: 'locked' };
  if (!p || (!owner && p.hidden)) return { html: `<div class="page empty">找不到這個代購，或目前沒有公開。<br><br><a class="btn" href="#/">回首頁</a></div>`, tab: 'none' };

  const tabs = owner
    ? [['products', '商品清單'], ['fields', '登記清單'], ['overview', '商品&登記總覽']]
    : [['form', '登記表'], ['overview', '商品&登記總覽']];
  let tab = r.tab;
  if (!tabs.some((t) => t[0] === tab)) tab = owner ? 'products' : (p.status === 'open' ? 'form' : 'overview');

  const st = STATUS[p.status || 'open'];
  const head = `<div class="p-head">
    <div class="row" style="margin-bottom:6px"><span class="chip ${st.cls}">${st.label}</span>${p.hidden ? '<span class="chip hidden-chip">不公開</span>' : ''}</div>
    <h1>${esc(p.title || '未命名代購')}</h1>
  </div>
  <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<a class="tab ${k === tab ? 'active' : ''}" role="tab" aria-selected="${k === tab}" href="#/p/${esc(p.id)}/${k}">${l}</a>`).join('')}</nav>`;

  let body = '', seg = '';
  if (tab === 'products') body = tabProducts(p);
  if (tab === 'fields') { body = tabFields(p); seg = S.ui.fieldsSeg; }
  if (tab === 'form') body = tabForm(p);
  if (tab === 'overview') { body = tabOverview(p); seg = S.ui.overviewSeg; }
  return { html: `${head}<div class="page">${body}</div>`, tab, seg };
}

function infoBlock(p) {
  const [code, cname] = cur(p.currency || 'JPY');
  return `<section class="card stack">
    ${p.description ? `<p style="margin:0;white-space:pre-wrap">${esc(p.description)}</p>` : ''}
    <div class="rate-badge" role="note" aria-label="匯率：1 ${cname} 等於 ${fmtNum(p.rate, 4)} 台幣">
      <span class="rate-tag">匯率</span>
      <span class="rate-pair">${cname} <b aria-hidden="true">→</b> 台幣</span>
      <span class="rate-num">${fmtNum(p.rate, 4)}</span>
    </div>
  </section>`;
}

// ===== 賣家：商品清單 =====
function tabProducts(p) {
  const code = p.currency || 'JPY';
  const cover = p.cover || {};
  const list = sortedProducts();
  const counts = countsByProduct();
  return `
  <section class="card stack" aria-label="代購基本設定">
    <label class="f"><span>標題 <b class="req">*</b></span><input class="in" id="pj-title" value="${esc(p.title)}" maxlength="60"></label>
    <label class="f"><span>代購說明（非必填）</span><textarea class="in" id="pj-desc" placeholder="例如：結單日、付款方式、預計到貨時間…">${esc(p.description)}</textarea></label>
    <div class="f-grid">
      <label class="f"><span>外幣幣別</span><select class="in" id="pj-cur" data-change="rate-preview">${CURRENCIES.map(([c, n]) => `<option value="${c}" ${c === code ? 'selected' : ''}>${n} ${c}</option>`).join('')}</select></label>
      <label class="f"><span>匯率（1 外幣 = ? 台幣）</span><input class="in" id="pj-rate" type="number" step="0.0001" min="0" inputmode="decimal" value="${esc(p.rate)}" data-input="rate-preview"></label>
    </div>
    <div class="calc small" id="rate-preview">${ratePreview(code, p.rate)}</div>
    <div>
      <div class="small" style="font-weight:700;margin-bottom:6px">卡片封面</div>
      <div class="img-pick">${Object.entries(ILLUSTRATIONS).map(([k, v]) => `<button type="button" class="${cover.type !== 'image' && (cover.key || DEFAULT_ILLUSTRATION) === k ? 'sel' : ''}" data-action="cover-svg" data-key="${k}" aria-label="${v.label}">${v.svg}</button>`).join('')}</div>
      <div class="row" style="margin-top:8px">
        <button class="btn sm" data-action="cover-upload">📷 上傳圖片當封面</button>
        ${cover.type === 'image' ? '<span class="chip approved">目前使用上傳圖片</span>' : ''}
      </div>
    </div>
    <div class="field-cfg stack">
      <div class="small" style="font-weight:700">📣 客人送出登記後的提示視窗（全部空白就不跳）</div>
      <label class="f"><span>說明文字</span><textarea class="in" id="pj-pop-text" placeholder="例如：登記完成！請加入 LINE 群組，之後會在群組通知下單與付款～">${esc(p.popup?.text)}</textarea></label>
      <label class="f"><span>LINE 群組邀請連結（非必填）</span><input class="in" id="pj-pop-link" inputmode="url" placeholder="https://line.me/R/ti/g/…" value="${esc(p.popup?.link)}"></label>
      <div class="row">
        <div class="thumb">${safeImg(p.popup?.qr) ? `<img src="${esc(p.popup.qr)}" alt="QR code" style="object-fit:contain;background:#fff">` : '<span class="small muted">QR</span>'}</div>
        <div class="stack grow">
          <div class="row"><button class="btn sm" data-action="qr-upload">📷 上傳 QR Code</button><button class="btn sm" data-action="qr-paste">📋 貼上</button></div>
          ${p.popup?.qr ? '<button class="btn sm ghost" data-action="qr-clear">移除 QR Code</button>' : ''}
        </div>
      </div>
      <button class="btn sm water" data-action="popup-preview">👀 預覽提示視窗</button>
    </div>
    <div class="row between">
      <button class="btn sm ghost" data-action="copy-link">🔗 複製分享連結</button>
      <button class="btn primary" data-action="save-project">儲存設定</button>
    </div>
  </section>

  <div class="row between"><h2 class="section-title">商品<span class="count">${list.length}</span></h2>
    <button class="btn yellow" data-action="edit-product">＋ 新增商品</button></div>
  ${list.length ? list.map((pr, i) => {
    const s = stockInfo(pr, counts);
    return `<article class="card prod">
      <div class="thumb">${safeImg(pr.image) ? `<img src="${esc(pr.image)}" alt="">` : '🛍️'}</div>
      <div class="stack" style="min-width:0">
        <div><h4>${esc(pr.name)}</h4>
          <div class="price">${fmtTWD(twdOf(pr, p))} <span class="muted small">（${fmtFX(pr.foreignPrice, code)}）</span></div></div>
        <div class="kv"><span>可登記 <b>${s.qty}</b></span><span>候補上限 <b>${wlText(s.wl)}</b></span><span>已登記 <b>${s.used}</b></span></div>
        <div class="row">
          <button class="btn sm" data-action="edit-product" data-id="${esc(pr.id)}">編輯</button>
          <button class="btn sm ghost icon-btn" data-action="move-product" data-id="${esc(pr.id)}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="往上">↑</button>
          <button class="btn sm ghost icon-btn" data-action="move-product" data-id="${esc(pr.id)}" data-dir="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="往下">↓</button>
          <span class="grow"></span>
          <button class="btn sm ghost" data-action="delete-product" data-id="${esc(pr.id)}">刪除</button>
        </div>
      </div>
    </article>`;
  }).join('') : '<div class="empty">還沒有商品，按「新增商品」開始吧</div>'}

  <div class="row" style="margin-top:32px;justify-content:center"><button class="btn sm ghost" data-action="delete-project">🗑 刪除整個代購</button></div>`;
}
function ratePreview(code, rate) {
  const r = num(rate);
  const base = code === 'KRW' ? 10000 : code === 'JPY' || code === 'THB' ? 1000 : 100;
  return `1 ${code} ≈ NT$ ${fmtNum(r, 4)} ・ ${fmtNum(base)} ${code} ≈ NT$ ${fmtNum(base * r)}`;
}

function setModalImage(src, isUrl = false) {
  if (!$('#pm-thumb')) return;
  S.ui.modalImage = src;
  $('#pm-url').value = isUrl ? src : '';
  $('#pm-thumb').innerHTML = `<img src="${esc(src)}" alt="">`;
  toast('圖片已放上 ✓');
}
async function imageFromTransfer(dt) {
  const file = [...(dt?.files || [])].find((f) => f.type.startsWith('image/'))
    || [...(dt?.items || [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile();
  if (file) { try { setModalImage(await fileToDataURL(file)); } catch (e) { toast(e.message); } return true; }
  return false;
}
// 商品視窗開著時：Ctrl+V 貼圖、拖曳圖片
document.addEventListener('paste', async (e) => {
  if (!$('#pm-thumb')) return;
  if (await imageFromTransfer(e.clipboardData)) { e.preventDefault(); return; }
  const txt = e.clipboardData?.getData('text/plain')?.trim() || '';
  if (e.target.id !== 'pm-url' && /^https:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i.test(txt)) { e.preventDefault(); setModalImage(txt, true); }
});
document.addEventListener('dragover', (e) => { if ($('#pm-thumb') && e.target.closest('.modal')) e.preventDefault(); });
document.addEventListener('drop', async (e) => {
  if (!$('#pm-thumb') || !e.target.closest('.modal')) return;
  e.preventDefault();
  if (!(await imageFromTransfer(e.dataTransfer))) toast('請拖曳圖片檔');
});
const popupLinkInput = () => { const v = $('#pj-pop-link')?.value.trim() || ''; return /^https:\/\//.test(v) ? v : ''; };
async function clipboardImage() {
  if (!navigator.clipboard?.read) { toast('這個瀏覽器不支援按鈕貼上，請改用上傳'); return null; }
  try {
    for (const item of await navigator.clipboard.read()) {
      const t = item.types.find((x) => x.startsWith('image/'));
      if (t) return await fileToDataURL(await item.getType(t), 700);
    }
    toast('剪貼簿裡沒有圖片');
  } catch { toast('沒有權限讀取剪貼簿，請改用上傳'); }
  return null;
}
// 客人送出後跳出的提示視窗（不能點背景關，要按按鈕）
function showSubmitPopup(p, preview = false) {
  const pop = p.popup || {};
  if (!preview && !pop.text && !pop.qr && !pop.link) return false;
  openModal(`<div class="stack center">
      <div style="font-size:40px;line-height:1" aria-hidden="true">🎉</div>
      <h2 style="margin:0">${preview ? '（預覽）' : ''}登記送出囉！</h2>
      ${pop.text ? `<p style="margin:0;white-space:pre-wrap;text-align:left">${esc(pop.text)}</p>` : ''}
      ${safeImg(pop.qr) ? `<img src="${esc(pop.qr)}" alt="LINE 群組 QR Code" style="width:min(240px,70vw);margin:0 auto;border:var(--line) solid var(--ink);border-radius:var(--r-md);background:#fff">` : ''}
      ${pop.link ? `<a class="btn green block" href="${esc(pop.link)}" target="_blank" rel="noopener">💬 加入 LINE 群組</a>` : ''}
      <button class="btn primary block" data-action="modal-cancel">我知道了</button>
    </div>`, { noBgClose: true });
  return true;
}
function productModal(pr) {
  const p = S.cur.project;
  const code = p.currency || 'JPY';
  S.ui.modalImage = pr?.image || '';
  openModal(`<h2>${pr ? '編輯商品' : '新增商品'}</h2>
    <div class="stack">
      <div class="row">
        <div class="thumb" id="pm-thumb">${safeImg(pr?.image) ? `<img src="${esc(pr.image)}" alt="">` : '🛍️'}</div>
        <div class="stack grow">
          <div class="row"><button class="btn sm" data-action="pm-upload">📷 上傳圖片</button><button class="btn sm" data-action="pm-paste">📋 貼上圖片</button></div>
          <p class="small muted" style="margin:0">複製圖片後，在這個視窗直接按 Ctrl+V（Mac：⌘V）也可以；或把圖片拖到左邊方框。</p>
          <input class="in" id="pm-url" placeholder="或貼上圖片網址 https://…" value="${pr?.image && !pr.image.startsWith('data:') ? esc(pr.image) : ''}" data-input="pm-url">
          <button class="btn sm ghost" data-action="pm-clear-img">移除圖片</button>
        </div>
      </div>
      <label class="f"><span>商品名稱 <b class="req">*</b></span><input class="in" id="pm-name" value="${esc(pr?.name)}" maxlength="80" autofocus></label>
      <div class="f-grid">
        <label class="f"><span>可登記數量 <b class="req">*</b></span><input class="in" id="pm-qty" type="number" min="0" inputmode="numeric" value="${esc(pr?.qty ?? 1)}"></label>
        <label class="f"><span>候補最高總數</span><input class="in" id="pm-wl" type="number" min="0" inputmode="numeric" placeholder="空白＝不限" value="${esc(pr ? (pr.waitlistMax ?? '') : '')}"></label>
        <label class="f"><span>外幣金額（${code}） <b class="req">*</b></span><input class="in" id="pm-fx" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(pr?.foreignPrice ?? '')}" data-input="pm-fx"></label>
        <label class="f"><span>台幣金額（自動）</span><input class="in" id="pm-twd" readonly value="${pr ? fmtTWD(twdOf(pr, p)) : ''}"></label>
      </div>
      <p class="small muted" style="margin:0">台幣＝外幣 × 匯率 ${fmtNum(p.rate, 4)}（四捨五入）</p>
      <div class="row" style="justify-content:flex-end">
        <button class="btn ghost" data-action="modal-cancel">取消</button>
        <button class="btn primary" data-action="pm-save" data-id="${esc(pr?.id || '')}">儲存</button>
      </div>
    </div>`);
}

// ===== 賣家：登記清單（審核＋欄位設定） =====
function tabFields(p) {
  const pendingN = S.cur.orders.filter((o) => ['pending', 'partial', 'cancelled'].includes(orderStatus(o))).length;
  const seg = `<div class="seg" role="tablist">
    <button class="${S.ui.fieldsSeg === 'review' ? 'active' : ''}" data-action="fields-seg" data-seg="review">審核登記${pendingN ? `（${pendingN}）` : ''}</button>
    <button class="${S.ui.fieldsSeg === 'config' ? 'active' : ''}" data-action="fields-seg" data-seg="config">登記欄位設定</button></div>`;
  return seg + (S.ui.fieldsSeg === 'config' ? fieldsConfig(p) : reviewList(p));
}

const FIELD_TYPES = { text: '輸入欄（文字）', number: '輸入欄（數字）', select: '下拉選單（讀商品）', date: '日期', amount: '金額（自動抓台幣）' };
const SELECT_SOURCES = { name: '商品名稱', twd: '台幣金額', foreignPrice: '外幣金額' };

function fieldsConfig(p) {
  if (!S.ui.fieldsDraft) S.ui.fieldsDraft = JSON.parse(JSON.stringify(fieldsOf(p)));
  if (!S.ui.orderDraft) S.ui.orderDraft = JSON.parse(JSON.stringify(orderFieldsOf(p)));
  const F = S.ui.fieldsDraft, O = S.ui.orderDraft;
  const selects = F.filter((f) => f.type === 'select');
  const numbers = F.filter((f) => f.type === 'number');
  const moveDel = (g, i, n, fixed) => `
      <button class="btn sm ghost icon-btn" data-action="fd-move" data-g="${g}" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="往上">↑</button>
      <button class="btn sm ghost icon-btn" data-action="fd-move" data-g="${g}" data-i="${i}" data-dir="1" ${i === n - 1 ? 'disabled' : ''} aria-label="往下">↓</button>
      ${fixed ? '<span class="icon-btn" style="display:inline-grid;place-items:center" title="固定欄位不能刪除">🔒</span>' : `<button class="btn sm ghost icon-btn" data-action="fd-del" data-g="${g}" data-i="${i}" aria-label="刪除">✕</button>`}`;
  const reqSel = (g, i, f) => f.fixed ? '<label class="f"><span>必填</span><input class="in" readonly value="一定要填"></label>'
    : `<label class="f"><span>必填</span><select class="in" data-change="fd" data-g="${g}" data-i="${i}" data-k="required"><option value="1" ${f.required ? 'selected' : ''}>必填</option><option value="" ${!f.required ? 'selected' : ''}>選填</option></select></label>`;

  const orderHTML = O.map((f, i) => `<div class="field-cfg stack">
    <div class="row">
      <input class="in grow" value="${esc(f.label)}" placeholder="欄位名稱" data-input="fd" data-g="order" data-i="${i}" data-k="label" maxlength="20" aria-label="欄位名稱">
      ${moveDel('order', i, O.length, f.fixed)}
    </div>
    <div class="f-grid">
      ${f.fixed ? '<label class="f"><span>格式</span><input class="in" readonly value="輸入欄（文字）"></label>'
        : `<label class="f"><span>格式</span><select class="in" data-change="fd" data-g="order" data-i="${i}" data-k="type">${Object.entries(ORDER_FIELD_TYPES).map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
      ${reqSel('order', i, f)}
      ${f.fixed ? '<p class="small muted full" style="margin:0">這一欄是登記人的名字，總覽上會顯示給大家看；欄位名稱可以自己改。</p>'
        : `<label class="f full"><span>總覽要不要給大家看</span><select class="in" data-change="fd" data-g="order" data-i="${i}" data-k="public"><option value="" ${!f.public ? 'selected' : ''}>不公開（只有我看得到，適合聯絡方式）</option><option value="1" ${f.public ? 'selected' : ''}>公開顯示在登記總覽</option></select></label>`}
    </div>
  </div>`).join('');

  const itemHTML = F.map((f, i) => `<div class="field-cfg stack">
    <div class="row">
      <input class="in grow" value="${esc(f.label)}" placeholder="欄位名稱" data-input="fd" data-g="item" data-i="${i}" data-k="label" maxlength="20" aria-label="欄位名稱">
      ${moveDel('item', i, F.length, false)}
    </div>
    <div class="f-grid">
      <label class="f"><span>格式</span><select class="in" data-change="fd" data-g="item" data-i="${i}" data-k="type">${Object.entries(FIELD_TYPES).map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${f.type === 'amount' ? '<label class="f"><span>必填</span><input class="in" readonly value="自動帶入，客人不能改"></label>' : reqSel('item', i, f)}
      ${f.type === 'select' ? `<label class="f full"><span>下拉選單要顯示商品清單的哪一欄</span><select class="in" data-change="fd" data-g="item" data-i="${i}" data-k="source">${Object.entries(SELECT_SOURCES).map(([k, l]) => `<option value="${k}" ${(f.source || 'name') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      ${f.type === 'amount' ? `
        <label class="f"><span>依哪個下拉選單的商品</span><select class="in" data-change="fd" data-g="item" data-i="${i}" data-k="selectId">${selects.map((x) => `<option value="${x.id}" ${f.selectId === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('') || '<option value="">（請先新增下拉選單）</option>'}</select></label>
        <label class="f"><span>乘上數量欄</span><select class="in" data-change="fd" data-g="item" data-i="${i}" data-k="qtyId"><option value="">不乘（單價）</option>${numbers.map((x) => `<option value="${x.id}" ${f.qtyId === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>` : ''}
    </div>
  </div>`).join('');

  return `
  <h2 class="section-title" style="margin-top:4px"><span class="dot" style="background:var(--coral)"></span>固定欄位</h2>
  <p class="small muted" style="margin-top:0">每筆登記只填一次，出現在登記表最上面（例如登記人、LINE 名稱、聯絡電話）。</p>
  ${orderHTML}
  <div class="row" style="margin-top:12px">
    <select class="in" id="fd-new-type-order" style="width:auto">${Object.entries(ORDER_FIELD_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <button class="btn yellow" data-action="fd-add" data-g="order">＋ 新增固定欄位</button>
  </div>

  <h2 class="section-title"><span class="dot" style="background:var(--yellow)"></span>每項欄位（可重複）</h2>
  <p class="small muted" style="margin-top:0">客人每按一次「＋ 再登記一項」，就會多一組這些欄位。</p>
  ${itemHTML}
  <div class="row" style="margin-top:12px">
    <select class="in" id="fd-new-type-item" style="width:auto">${Object.entries(FIELD_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <button class="btn yellow" data-action="fd-add" data-g="item">＋ 新增每項欄位</button>
  </div>
  <div class="row" style="margin-top:20px;justify-content:flex-end">
    ${S.ui.fieldsDirty ? '<span class="small muted grow">有尚未儲存的變更</span><button class="btn ghost" data-action="fd-reset">還原</button>' : ''}
    <button class="btn primary" data-action="fd-save">儲存欄位設定</button>
  </div>`;
}

function itemSummary(p, item, fields, { skipMain = true } = {}) {
  const ms = mainSelect(fields);
  return fields.filter((f) => !(skipMain && ms && f.id === ms.id)).map((f) => {
    let v = item.values?.[f.id];
    if (f.type === 'amount') v = fmtTWD(amountFor(p, f, item.values || {}));
    else if (f.type === 'select') { const pr = productById(v); v = pr ? selectText(f, pr, p) : (v === item.productId ? item.productName : v); }
    if (v === undefined || v === '') return '';
    return `<span><span class="muted">${esc(f.label)}：</span>${esc(v)}</span>`;
  }).join('');
}
function amountFor(p, f, values) {
  const pr = productById(values[f.selectId]);
  if (!pr) return 0;
  const q = f.qtyId ? (num(values[f.qtyId]) || 0) : 1;
  return twdOf(pr, p) * q;
}
const selectText = (f, pr, p) => {
  const s = f.source || 'name';
  if (s === 'twd') return `${fmtTWD(twdOf(pr, p))}（${pr.name}）`;
  if (s === 'foreignPrice') return `${fmtFX(pr.foreignPrice, p.currency)}（${pr.name}）`;
  return pr.name;
};
const productNameOf = (item) => productById(item.productId)?.name || item.productName || '（商品已刪除）';

function orderExtras(p, o, onlyPublic) {
  const html = orderFieldsOf(p).filter((f) => f.id !== NAME_FIELD_ID && (!onlyPublic || f.public))
    .map((f) => { const v = o.orderValues?.[f.id]; return v ? `<span><span class="muted">${esc(f.label)}：</span>${esc(v)}</span>` : ''; }).join('');
  return html ? `<div class="fields">${html}</div>` : '';
}
// 審核時：同一個人（名字相同）之前送出的登記
function historyOf(p, o, names, fields) {
  const key = personKey(o.buyerName);
  const t = (x) => x.createdAt || x.updatedAt || 0;
  const prev = S.cur.orders.filter((x) => x.id !== o.id && personKey(x.buyerName) === key && t(x) < t(o)).sort((a, b) => t(a) - t(b));
  if (!prev.length) return '';
  return `<details class="history">
    <summary>📜 ${esc(String(o.buyerName).trim())} 之前的登記（${prev.length} 筆）</summary>
    ${prev.map((x) => `<div class="history-order">
      <div class="small muted"><b style="color:var(--ink)">${esc(names[x.id])}</b>・${fmtTime(t(x))} 送出${orderExtras(p, x, false)}</div>
      ${(x.items || []).map((it) => { const st = itemStatus(x, it); return `<div class="row between" style="align-items:flex-start;margin-top:4px">
        <div class="grow">${itemName(it, st)}<div class="fields" style="margin-top:0">${itemSummary(p, it, fields)}</div></div>${statusChip(st)}</div>`; }).join('')}
    </div>`).join('')}
  </details>`;
}
function reviewList(p) {
  const fields = fieldsOf(p);
  const f = S.ui.reviewFilter;
  let orders = [...S.cur.orders].sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
  const needs = (o) => ['pending', 'partial', 'cancelled'].includes(orderStatus(o));
  if (f === 'pending') orders = orders.filter(needs);
  if (f === 'done') orders = orders.filter((o) => !needs(o));
  const filt = [['pending', '待審核'], ['done', '已處理'], ['all', '全部']];
  const names = displayNames();
  return `<div class="row" style="margin-bottom:12px">${filt.map(([k, l]) => `<button class="btn sm ${f === k ? 'yellow' : ''}" data-action="review-filter" data-f="${k}">${l}</button>`).join('')}</div>
  ${orders.length ? orders.map((o) => reviewCard(p, o, names, fields)).join('') : `<div class="empty">${f === 'pending' ? '沒有待審核的登記 🎉' : '沒有資料'}</div>`}`;
}
// 一個欄位的值，轉成看得懂的文字（比對修改前後用）
function valueText(p, f, values) {
  const v = values?.[f.id];
  if (f.type === 'amount') return fmtTWD(amountFor(p, f, values || {}));
  if (f.type === 'select') { const pr = productById(v); return pr ? pr.name : (v ? '（商品已刪除）' : ''); }
  return v ?? '';
}
// 和修改前比：哪些欄位變了
function diffFields(p, fields, before, after) {
  return fields.filter((f) => f.type !== 'amount').map((f) => {
    const a = valueText(p, f, before.values), b = valueText(p, f, after.values);
    return String(a) === String(b) ? '' : `<span class="diff"><span class="muted">${esc(f.label)}：</span><s>${esc(a || '（空白）')}</s> → <b>${esc(b || '（空白）')}</b></span>`;
  }).join('');
}
const prevStatusText = (prevReview, item) => {
  if (!prevReview) return '';
  const st = itemStatus({ review: prevReview }, item);
  return `<span class="muted small">原本：${st.s === 'rejected' ? `被拒絕${st.reason ? `（${esc(st.reason)}）` : ''}` : REVIEW[st.s]}</span>`;
};
function reviewCard(p, o, names, fields) {
  const edited = Array.isArray(o.prevItems);
  const prevMap = new Map((o.prevItems || []).map((it) => [it.id, it]));
  const nowIds = new Set((o.items || []).map((it) => it.id));
  const removed = (o.prevItems || []).filter((it) => !nowIds.has(it.id));
  const oid = esc(o.id);
  const head = `<div class="row between"><div><b style="font-size:18px">${esc(names[o.id])}</b> <span class="muted small">・${o.items?.length || 0} 項・最後編輯 ${fmtTime(o.updatedAt)}</span>${orderExtras(p, o, false)}</div>
      ${o.review?.order === 'rejected' ? `<span class="chip rejected">✕ 整筆拒絕</span>` : ''}</div>`;

  if (o.cancelled) {
    return `<article class="card order cancelled-card">
      ${head}
      <div class="edit-note">🚫 客人在 ${fmtTime(o.cancelledAt || o.updatedAt)} <b>取消了這筆登記</b>，請確認</div>
      <div class="order-items" style="margin-top:8px">${(o.items || []).map((it) => `<div>
        <div class="row between" style="align-items:flex-start"><b class="struck">${esc(productNameOf(it))}</b>${prevStatusText(o.prevReview, it)}</div>
        <div class="fields">${itemSummary(p, it, fields)}</div></div>`).join('')}</div>
      <div class="row" style="border-top:var(--line) solid var(--ink);padding-top:10px;margin-top:4px">
        <button class="btn sm primary" data-action="rv-delete" data-oid="${oid}">確認取消並刪除</button>
      </div>
      ${historyOf(p, o, names, fields)}
    </article>`;
  }

  return `<article class="card order">
    ${head}
    ${edited ? `<div class="edit-note">✏️ 客人在 ${fmtTime(o.editedAt || o.updatedAt)} <b>修改過</b>這筆登記，請重新審核（下面標出修改前後的差異）</div>` : ''}
    ${o.review?.order === 'rejected' && o.review.orderReason ? `<div class="reason">整筆拒絕原因：${esc(o.review.orderReason)}</div>` : ''}
    <div class="order-items" style="margin-top:8px">${(o.items || []).map((it) => {
      const s = itemStatus(o, it);
      const before = prevMap.get(it.id);
      const tag = !edited ? '' : !before ? '<span class="chip tag-new">＋ 新增</span>' : diffFields(p, fields, before, it) ? '<span class="chip tag-edit">✏️ 有修改</span>' : '';
      return `<div>
        <div class="row between" style="align-items:flex-start"><b>${itemName(it, s)} ${tag}</b>${statusChip(s)}</div>
        <div class="fields">${itemSummary(p, it, fields)}</div>
        ${before ? `<div class="fields">${diffFields(p, fields, before, it)}</div>${diffFields(p, fields, before, it) ? prevStatusText(o.prevReview, it) : ''}` : ''}
        <div class="row" style="margin-top:6px">
          <button class="btn sm green" data-action="rv-item" data-oid="${oid}" data-iid="${esc(it.id)}" data-s="approved">通過</button>
          <button class="btn sm" data-action="rv-item" data-oid="${oid}" data-iid="${esc(it.id)}" data-s="rejected">拒絕</button>
        </div></div>`;
    }).join('')}
    ${removed.map((it) => `<div class="removed-item">
        <div class="row between" style="align-items:flex-start"><b class="struck">${esc(productNameOf(it))}</b><span class="chip tag-del">🗑 客人刪除</span></div>
        <div class="fields">${itemSummary(p, it, fields)}</div>
        ${prevStatusText(o.prevReview, it)}
      </div>`).join('')}
    </div>
    <div class="row" style="border-top:var(--line) solid var(--ink);padding-top:10px;margin-top:4px">
      <button class="btn sm green" data-action="rv-order" data-oid="${oid}" data-s="approved">整筆通過</button>
      <button class="btn sm primary" data-action="rv-order" data-oid="${oid}" data-s="rejected">整筆拒絕</button>
      ${o.review ? `<button class="btn sm ghost" data-action="rv-reset" data-oid="${oid}">重設為待審核</button>` : ''}
      <span class="grow"></span>
      <button class="btn sm ghost" data-action="rv-delete" data-oid="${oid}">刪除</button>
    </div>
    ${historyOf(p, o, names, fields)}
  </article>`;
}

// ===== 客人：登記表 =====
function tabForm(p) {
  if (p.status !== 'open') return `${infoBlock(p)}<div class="empty" style="margin-top:16px">這個代購目前只開放檢視，暫時不能登記。</div>`;
  const fields = fieldsOf(p);
  const editing = S.ui.editingOrder ? S.cur.orders.find((o) => o.id === S.ui.editingOrder) : null;
  if (!S.ui.rows) {
    S.ui.rows = editing ? editing.items.map((it) => ({ id: it.id, values: { ...it.values } })) : [{ id: newId(), values: {} }];
    S.ui.orderValues = editing ? { ...(editing.orderValues || {}), [NAME_FIELD_ID]: editing.buyerName } : { [NAME_FIELD_ID]: '' };
  }
  if (!S.cur.products.length) return `${infoBlock(p)}<div class="empty" style="margin-top:16px">賣家還沒放商品喔，晚點再來看看～</div>`;
  const counts = countsByProduct(editing?.id);
  return `${infoBlock(p)}
  <form id="reg-form" class="stack" style="margin-top:16px" novalidate>
    ${editing ? `<div class="edit-banner" role="alert">
      <div><b>✏️ 你正在「修改」${fmtTime(editing.updatedAt)} 送出的舊登記</b><br><span class="small">送出後會<b>取代</b>原本的內容（不是新增一筆），並<b>回到待審核</b>，賣家會看到你改了什麼。想新增請按「改成新增一筆」。</span></div>
      <button type="button" class="btn sm" data-action="cancel-edit">改成新增一筆</button></div>` : ''}
    <div class="card stack">${orderFieldsOf(p).map((f) => orderInput(f, S.ui.orderValues[f.id] ?? '', !!editing)).join('')}${editing ? '<p class="small muted" style="margin:0">修改時不能改這些固定欄位，只能改下面的項目。</p>' : ''}</div>
    ${regTable(p, fields, counts)}
    <button type="submit" class="btn primary block" style="min-height:52px;font-size:18px">${editing ? '送出修改（重新審核）' : '送出登記'}</button>
    <p class="small muted center" style="margin:0">送出後需等賣家審核，審核結果會顯示在「商品&登記總覽」。</p>
  </form>`;
}
function orderInput(f, v, ro = false) {
  const req = f.required || f.fixed;
  const label = `<span>${esc(f.label)}${req ? ' <b class="req">*</b>' : ''}</span>`;
  const type = f.type === 'number' ? 'type="number" inputmode="decimal"' : f.type === 'date' ? 'type="date"' : '';
  const extra = f.id === NAME_FIELD_ID ? 'maxlength="40" autocomplete="nickname"' : 'maxlength="200"';
  return `<label class="f">${label}<input class="in" name="o:${esc(f.id)}" ${type} value="${esc(v)}" ${extra} ${req ? 'required' : ''} ${ro ? 'readonly' : ''}></label>`;
}
// 橫式登記表：每一項一列，欄位名稱只在最上面出現一次
const COL_W = { select: 'minmax(150px,2fr)', number: '64px', amount: '112px', date: '150px', text: 'minmax(110px,1.4fr)' };
function regTable(p, fields, counts) {
  const cols = `28px 52px ${fields.map((f) => COL_W[f.type] || COL_W.text).join(' ')} 36px`;
  const minW = 28 + 52 + 36 + fields.reduce((n, f) => n + ({ select: 150, number: 64, amount: 112, date: 150 }[f.type] || 110), 0) + (fields.length + 2) * 6;
  const head = `<div class="rt-head" style="grid-template-columns:${cols}"><span>#</span><span>圖片</span>${fields.map((f) => `<span>${esc(f.label)}${f.required && f.type !== 'amount' ? '<b class="req">*</b>' : ''}</span>`).join('')}<span></span></div>`;
  return `<div class="card" style="padding:10px">
    <div class="rt-scroll"><div style="min-width:${minW}px">
      ${head}
      <div id="rows">${S.ui.rows.map((row, i) => formRow(p, fields, row, i, counts, cols)).join('')}</div>
    </div></div>
    <div class="row between" style="margin-top:8px">
      <button type="button" class="btn sm" data-action="add-row">＋ 再登記一項</button>
      <span class="small" id="reg-total">${regTotalText(p, fields)}</span>
    </div>
  </div>`;
}
function regTotalText(p, fields, rows = S.ui.rows) {
  const amt = fields.find((f) => f.type === 'amount');
  const sum = amt ? rows.reduce((n, r) => n + amountFor(p, amt, r.values), 0) : 0;
  return `共 <b>${rows.length}</b> 項${amt ? `・合計 <b>${fmtTWD(sum)}</b>` : ''}`;
}
const thumbCell = (pr) => {
  const src = safeImg(pr?.image);
  return src
    ? `<button type="button" class="rt-thumb" data-action="zoom-img" data-src="${esc(src)}" data-name="${esc(pr.name)}" aria-label="放大看 ${esc(pr.name)} 的圖片"><img src="${esc(src)}" alt=""></button>`
    : `<span class="rt-thumb" aria-hidden="true">${pr ? '🛍️' : ''}</span>`;
};
function formRow(p, fields, row, i, counts, cols) {
  const ms = mainSelect(fields);
  const prods = sortedProducts();
  const cells = fields.map((f) => {
    const v = row.values[f.id] ?? '';
    const req = f.required && f.type !== 'amount';
    const nm = `name="f:${esc(f.id)}" aria-label="${esc(f.label)}"`;
    if (f.type === 'select') {
      return `<div><select class="in" ${nm} data-change="row-calc" ${req ? 'required' : ''}>
        <option value="">請選擇</option>
        ${prods.map((pr) => { const s = stockInfo(pr, counts); const dis = s.full && v !== pr.id; return `<option value="${esc(pr.id)}" ${v === pr.id ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(selectText(f, pr, p))}${s.full ? '（已額滿）' : ''}</option>`; }).join('')}
      </select>${ms && f.id === ms.id ? `<small class="muted stock-hint">${stockHint(productById(v), counts)}</small>` : ''}</div>`;
    }
    if (f.type === 'amount') return `<div><input class="in" readonly data-amount="${esc(f.id)}" value="${fmtTWD(amountFor(p, f, row.values))}" tabindex="-1" aria-label="${esc(f.label)}"></div>`;
    if (f.type === 'number') return `<div><input class="in" type="number" min="1" step="1" inputmode="numeric" ${nm} value="${esc(v || (req ? 1 : ''))}" data-input="row-calc" ${req ? 'required' : ''}></div>`;
    if (f.type === 'date') return `<div><input class="in" type="date" ${nm} value="${esc(v)}" ${req ? 'required' : ''}></div>`;
    return `<div><input class="in" ${nm} value="${esc(v)}" maxlength="200" ${req ? 'required' : ''}></div>`;
  }).join('');
  return `<div class="item-row rt-row" data-row="${esc(row.id)}" style="grid-template-columns:${cols}">
    <span class="rt-no">${i + 1}</span>${thumbCell(productById(ms ? row.values[ms.id] : ''))}${cells}
    ${S.ui.rows.length > 1 ? `<button type="button" class="btn sm ghost icon-btn" data-action="del-row" data-row="${esc(row.id)}" aria-label="移除第 ${i + 1} 項">✕</button>` : '<span></span>'}
  </div>`;
}
const wlText = (wl) => (wl === Infinity ? '不限' : wl === 0 ? '不開放' : wl);
function stockHint(pr, counts) {
  if (!pr) return '';
  const s = stockInfo(pr, counts);
  if (s.full) return '已額滿';
  return s.left > 0 ? `還可登記 ${s.left} 個` : '目前已滿，登記後依順序遞補';
}
function readRows() {
  const form = $('#reg-form');
  if (!form) return;
  S.ui.orderValues = {};
  $$('[name^="o:"]', form).forEach((i) => { S.ui.orderValues[i.name.slice(2)] = i.value.trim(); });
  S.ui.rows = $$('.item-row', form).map((el) => {
    const values = {};
    $$('[name^="f:"]', el).forEach((i) => { values[i.name.slice(2)] = i.value.trim(); });
    return { id: el.dataset.row, values };
  });
}
function updateRowCalc(rowEl) {
  const p = S.cur.project;
  const fields = fieldsOf(p);
  const values = {};
  $$('[name^="f:"]', rowEl).forEach((i) => { values[i.name.slice(2)] = i.value; });
  $$('[data-amount]', rowEl).forEach((el) => {
    const f = fields.find((x) => x.id === el.dataset.amount);
    if (f) el.value = fmtTWD(amountFor(p, f, values));
  });
  const tot = $('#reg-total');
  if (tot) {
    const rows = $$('.item-row').map((el) => { const v = {}; $$('[name^="f:"]', el).forEach((i) => { v[i.name.slice(2)] = i.value; }); return { values: v }; });
    tot.innerHTML = regTotalText(p, fields, rows);
  }
  const ms = mainSelect(fields);
  const th = $('.rt-thumb', rowEl);
  if (th && ms) th.outerHTML = thumbCell(productById(values[ms.id]));
  const hint = $('.stock-hint', rowEl);
  if (hint && ms) hint.textContent = stockHint(productById(values[ms.id]), countsByProduct(S.ui.editingOrder));
}

async function submitForm() {
  readRows();
  const p = S.cur.project;
  const fields = fieldsOf(p);
  const ms = mainSelect(fields);
  const qf = qtyFieldOf(fields);
  const ofs = orderFieldsOf(p);
  for (const f of ofs) if ((f.required || f.fixed) && !S.ui.orderValues[f.id]) return toast(`請填「${f.label}」`);
  const name = (S.ui.orderValues[NAME_FIELD_ID] || '').trim();
  const orderValues = Object.fromEntries(ofs.filter((f) => f.id !== NAME_FIELD_ID).map((f) => [f.id, S.ui.orderValues[f.id] || '']));
  const need = {};
  for (const [i, row] of S.ui.rows.entries()) {
    for (const f of fields) {
      if (f.required && f.type !== 'amount' && !row.values[f.id]) return toast(`第 ${i + 1} 項：請填「${f.label}」`);
    }
    if (qf && row.values[qf.id] && num(row.values[qf.id]) < 1) return toast(`第 ${i + 1} 項：數量至少 1`);
    if (ms && row.values[ms.id]) need[row.values[ms.id]] = (need[row.values[ms.id]] || 0) + (qf ? num(row.values[qf.id]) || 1 : 1);
  }
  const counts = countsByProduct(S.ui.editingOrder);
  for (const [pid, n] of Object.entries(need)) {
    const pr = productById(pid); if (!pr) continue;
    const s = stockInfo(pr, counts);
    const room = s.qty + s.wl - s.used;
    if (n > room) return toast(`「${pr.name}」只剩 ${Math.max(0, room)} 個可登記（含候補）`);
  }
  const now = Date.now();
  const items = S.ui.rows.map((row) => {
    const pr = ms ? productById(row.values[ms.id]) : null;
    const amtF = fields.find((f) => f.type === 'amount');
    return {
      id: row.id, values: row.values,
      productId: pr?.id || '', productName: pr?.name || '',
      qty: qf ? num(row.values[qf.id]) || 1 : 1,
      amount: amtF ? amountFor(p, amtF, row.values) : (pr ? twdOf(pr, p) : 0),
    };
  });
  if (S.ui.editingOrder && !(await askConfirm('確定要修改原本的登記嗎？送出後會回到「待審核」，等賣家重新確認。', '確定修改'))) return;
  const btn = $('#reg-form [type=submit]'); if (btn) btn.disabled = true;
  try {
    if (S.ui.editingOrder) {
      const o = S.cur.orders.find((x) => x.id === S.ui.editingOrder);
      const patch = { items, updatedAt: now, editedAt: now };
      // 第一次修改（或審核完後再修改）才記下「修改前」；還沒審核又改第二次，就保留最早的版本
      if (!Array.isArray(o.prevItems)) { patch.prevItems = o.items; patch.prevReview = o.review || null; }
      await S.store.updateOrder(p.id, o.id, patch, o.review ? ['review'] : []);
    }
    else await S.store.createOrder(p.id, { buyerName: name, orderValues, items, createdAt: now, updatedAt: now });
    const wasEdit = !!S.ui.editingOrder;
    if (wasEdit || !showSubmitPopup(p)) toast(wasEdit ? '已更新登記！' : '登記成功！等賣家審核喔');
    S.ui.editingOrder = null; S.ui.rows = null; S.ui.overviewSeg = 'reg';
    go(`#/p/${p.id}/overview`);
  } catch { if (btn) btn.disabled = false; }
}

// ===== 商品&登記總覽（大家看到的都一樣） =====
function tabOverview(p) {
  const seg = `<div class="seg" role="tablist">
    <button class="${S.ui.overviewSeg === 'reg' ? 'active' : ''}" data-action="ov-seg" data-seg="reg">登記總覽</button>
    <button class="${S.ui.overviewSeg === 'prod' ? 'active' : ''}" data-action="ov-seg" data-seg="prod">商品總覽</button></div>`;
  return seg + (S.ui.overviewSeg === 'prod' ? productOverview(p) : regOverview(p));
}
// 正取／備取：依「第一次送出的時間」先後分配名額（被拒絕、已取消的不算）
function allocation() {
  const t = (o) => o.createdAt || o.updatedAt || 0;
  const used = {}, out = {}, mainNo = {}, waitNo = {};
  S.cur.orders.filter((o) => !o.cancelled).sort((a, b) => t(a) - t(b)).forEach((o) => (o.items || []).forEach((it) => {
    if (itemStatus(o, it).s === 'rejected') return;
    const pr = productById(it.productId);
    const q = num(it.qty) || 1;
    const cap = pr ? num(pr.qty) : Infinity;
    const u = used[it.productId] || 0;
    const main = Math.max(0, Math.min(q, cap - u));
    used[it.productId] = u + q;
    const wait = q - main;
    // 順序：這個商品的第幾位正取／第幾位備取
    out[`${o.id}/${it.id}`] = {
      main, wait,
      mainRank: main ? (mainNo[it.productId] = (mainNo[it.productId] || 0) + 1) : 0,
      waitRank: wait ? (waitNo[it.productId] = (waitNo[it.productId] || 0) + 1) : 0,
    };
  }));
  return out;
}
// 數量：直接顯示登記的數量（正取／備取改看「順序」欄）
function qtyCell(alloc, o, it, st) {
  const q = num(it.qty) || 1;
  return st.s === 'rejected' ? `<s class="muted">${q}</s>` : `<b>${q}</b>`;
}
function rankCell(alloc, o, it, st) {
  if (st.s === 'rejected') return '<span class="muted">—</span>';
  const a = alloc[`${o.id}/${it.id}`];
  if (!a) return '';
  return [a.mainRank ? `<span class="rank-main">正取第 ${a.mainRank} 位</span>` : '', a.waitRank ? `<span class="rank-wait">備取第 ${a.waitRank} 位</span>` : ''].filter(Boolean).join('<br>');
}
const OV_FILTERS = [['all', '全部'], ['pending', '待審核'], ['approved', '已通過'], ['rejected', '被拒絕']];
function regOverview(p) {
  const fields = fieldsOf(p);
  const ms = mainSelect(fields), qf = qtyFieldOf(fields), amtF = fields.find((f) => f.type === 'amount');
  const extraItemCols = fields.filter((f) => f !== ms && f !== qf && f.type !== 'amount');
  const extraOrderCols = orderFieldsOf(p).filter((f) => f.id !== NAME_FIELD_ID && f.public);
  const live = S.cur.orders.filter((o) => !o.cancelled);
  const all = [];
  for (const o of live) (o.items || []).forEach((it, idx) => all.push({ o, it, idx, st: itemStatus(o, it) }));
  const filter = S.ui.ovFilter || 'all';
  const rows = filter === 'all' ? all : all.filter((r) => r.st.s === filter);
  const [k, dir] = S.ui.sort.split('-');
  const sgn = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => k === 'name'
    ? sgn * productNameOf(a.it).localeCompare(productNameOf(b.it), 'zh-Hant') || ((a.o.updatedAt || 0) - (b.o.updatedAt || 0))
    : sgn * ((a.o.updatedAt || 0) - (b.o.updatedAt || 0)) || (a.idx - b.idx));
  const people = new Set(live.map((o) => personKey(o.buyerName))).size;
  const names = displayNames();
  const alloc = allocation();
  const myUid = S.user?.uid;
  const canEdit = (o) => !isOwner() && p.status === 'open' && o.uid === myUid && !o.cancelled;
  const showAct = rows.some((r) => canEdit(r.o));
  const count = (f) => (f === 'all' ? all.length : all.filter((r) => r.st.s === f).length);
  const sorts = [['time-asc', '時間：舊→新'], ['time-desc', '時間：新→舊'], ['name-asc', '商品名稱：A→Z'], ['name-desc', '商品名稱：Z→A']];

  // 同一筆登記連在一起的列，登記人／日期等欄位合併成一格（像 Excel 的合併儲存格）
  const runLen = new Map();
  rows.forEach((r, i) => {
    r.first = !(i && rows[i - 1].o.id === r.o.id);
    r.run = r.first ? i : rows[i - 1].run;
    runLen.set(r.run, (runLen.get(r.run) || 0) + 1);
  });
  let g = -1;
  const body = rows.map((r) => {
    const { o, it, st } = r;
    if (r.first) g++;
    const span = runLen.get(r.run);
    const rs = span > 1 ? ` rowspan="${span}"` : '';
    const pr = productById(it.productId);
    const img = safeImg(pr?.image);
    return `<tr class="${r.first ? 'grp' : ''} ${g % 2 ? 'g-odd' : ''} ${st.s === 'rejected' ? 'row-rej' : ''}">
      ${r.first ? `<td class="sticky-col name-cell"${rs}><b>${esc(names[o.id])}</b>${span > 1 ? `<div class="muted small">${span} 項</div>` : ''}</td>` : ''}
      ${r.first ? extraOrderCols.map((f) => `<td${rs}>${esc(o.orderValues?.[f.id] || '')}</td>`).join('') : ''}
      <td><div class="ov-prod">${img ? `<button type="button" class="ov-thumb" data-action="zoom-img" data-src="${esc(img)}" data-name="${esc(pr.name)}" aria-label="放大看 ${esc(pr.name)}"><img src="${esc(img)}" alt=""></button>` : ''}${itemName(it, st)}</div></td>
      <td class="nowrap qty">${qtyCell(alloc, o, it, st)}</td>
      <td class="nowrap small">${rankCell(alloc, o, it, st)}</td>
      ${amtF ? `<td class="num nowrap">${st.s === 'rejected' ? `<s class="muted">${fmtTWD(amountFor(p, amtF, it.values || {}))}</s>` : fmtTWD(amountFor(p, amtF, it.values || {}))}</td>` : ''}
      ${extraItemCols.map((f) => `<td>${esc(valueText(p, f, it.values))}</td>`).join('')}
      <td>${statusChip(st)}</td>
      ${r.first ? `<td class="nowrap muted small"${rs}>${fmtTime(o.updatedAt)}</td>` : ''}
      ${showAct && r.first ? `<td class="nowrap"${rs}>${canEdit(o) ? `<button class="btn sm" data-action="edit-order" data-oid="${esc(o.id)}">修改</button> <button class="btn sm ghost" data-action="cancel-order" data-oid="${esc(o.id)}">取消</button>` : ''}</td>` : ''}
    </tr>`;
  }).join('');

  return `<div class="row between" style="margin-bottom:10px">
      <span class="muted small">共 ${people} 人・${live.length} 筆・${all.length} 項</span>
      <select class="in" style="width:auto;min-height:40px" data-change="sort" aria-label="排序">${sorts.map(([v, l]) => `<option value="${v}" ${S.ui.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="row" style="margin-bottom:12px" role="group" aria-label="依審核狀態篩選">
      ${OV_FILTERS.map(([v, l]) => `<button class="btn sm ${filter === v ? 'yellow' : ''}" data-action="ov-filter" data-f="${v}">${l}（${count(v)}）</button>`).join('')}
    </div>
    ${rows.length ? `<div class="ov-wrap"><table class="ov-table">
      <thead><tr>
        <th class="sticky-col">登記人</th>
        ${extraOrderCols.map((f) => `<th>${esc(f.label)}</th>`).join('')}
        <th>商品</th><th class="qty">${esc(qf?.label || '數量')}</th><th>順序</th>${amtF ? `<th>${esc(amtF.label)}</th>` : ''}
        ${extraItemCols.map((f) => `<th>${esc(f.label)}</th>`).join('')}
        <th>狀態</th><th>最後編輯</th>${showAct ? '<th></th>' : ''}
      </tr></thead>
      <tbody>${body}</tbody></table></div>` : `<div class="empty">${filter === 'all' ? '還沒有人登記' : '沒有符合的登記'}</div>`}`;
}
// 同一個登記人（名字相同）的多次登記，合併在同一張卡片
// 同名的人第 2 次以後送出的登記，顯示成「名字_2」「名字_3」…
function displayNames() {
  const byKey = {}, out = {};
  [...S.cur.orders].sort((a, b) => (a.createdAt || a.updatedAt || 0) - (b.createdAt || b.updatedAt || 0)).forEach((o) => {
    const k = personKey(o.buyerName);
    byKey[k] = (byKey[k] || 0) + 1;
    out[o.id] = byKey[k] > 1 ? `${String(o.buyerName).trim()}_${byKey[k]}` : String(o.buyerName).trim();
  });
  return out;
}
const personKey = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
function productOverview(p) {
  const counts = countsByProduct();
  const list = sortedProducts();
  const code = p.currency || 'JPY';
  return infoBlock(p) + '<div style="height:16px"></div>' + (list.length ? list.map((pr) => {
    const s = stockInfo(pr, counts);
    const main = Math.min(s.used, s.qty), wait = Math.min(s.waitUsed, s.wl);
    const total = Math.max(1, s.qty + (s.wl === Infinity ? wait : s.wl));
    return `<article class="card prod">
      <div class="thumb">${safeImg(pr.image) ? `<img src="${esc(pr.image)}" alt="" loading="lazy">` : '🛍️'}</div>
      <div style="min-width:0">
        <h4>${esc(pr.name)}</h4>
        <div class="price">${fmtTWD(twdOf(pr, p))} <span class="muted small">（${fmtFX(pr.foreignPrice, code)}）</span></div>
        <div class="kv"><span>可登記 <b>${s.qty}</b></span><span>已登記 <b>${s.used}</b></span><span>剩餘 <b>${s.left}</b></span>${s.wl === Infinity ? (wait ? `<span>候補 <b>${wait}</b></span>` : '') : s.wl ? `<span>候補 <b>${wait}/${s.wl}</b></span>` : ''}</div>
        <div class="meter" aria-hidden="true"><i style="width:${main / total * 100}%;background:var(--coral)"></i><i style="width:${wait / total * 100}%;background:var(--yellow)"></i></div>
        ${s.full ? '<span class="chip rejected" style="margin-top:6px">已額滿</span>' : s.left === 0 ? '<span class="chip pending" style="margin-top:6px">只剩候補</span>' : ''}
      </div>
    </article>`;
  }).join('') : '<div class="empty">還沒有商品</div>');
}

// ------------------------------------------------------------
//  選單
// ------------------------------------------------------------
function renderMenu() {
  const m = $('#menu');
  const u = S.user;
  const rm = document.documentElement.classList.contains('reduce-motion');
  m.innerHTML = `
    <a href="#/" data-action="menu-close">🏠 首頁</a>
    ${u?.isOwner ? `<button data-action="toggle-guest">👀 用客人視角預覽 <span class="switch ${S.guestView ? 'on' : ''}"></span></button>` : ''}
    <button data-action="toggle-motion">🐢 減少動態效果 <span class="switch ${rm ? 'on' : ''}"></span></button>
    <hr>
    ${DEMO ? '<div class="small muted" style="padding:6px 12px">示範模式：你目前是賣家</div>'
      : u?.isOwner ? `<div class="small muted" style="padding:6px 12px">賣家：${esc(u.email)}</div><button data-action="logout">登出</button>`
      : `<button data-action="login">🔑 賣家登入</button>`}`;
  $('#brand-name').textContent = SITE.name;
}

// ------------------------------------------------------------
//  動作
// ------------------------------------------------------------
const draftOf = (el) => (el.dataset.g === 'order' ? S.ui.orderDraft : S.ui.fieldsDraft);
async function saveQr(src) {
  await S.store.updateProject(S.cur.pid, { popup: { ...(S.cur.project.popup || {}), qr: src } });
  toast('QR Code 已更新 ✓');
}
const actions = {
  'menu': () => $('#menu').classList.toggle('hidden'),
  'menu-close': () => $('#menu').classList.add('hidden'),
  'toggle-guest': () => { S.guestView = !S.guestView; S.ui.rows = null; render(true); toast(S.guestView ? '現在是客人視角' : '回到賣家視角'); },
  'toggle-motion': () => {
    const on = document.documentElement.classList.toggle('reduce-motion');
    localStorage.setItem('daigou-reduce-motion', on ? '1' : '');
    renderMenu();
  },
  async 'login'() {
    if (/Line\//i.test(navigator.userAgent)) {
      toast('LINE 裡無法用 Google 登入，幫你改用瀏覽器開啟');
      location.href = `${location.origin}${location.pathname}?openExternalBrowser=1${location.hash}`;
      return;
    }
    await S.store.loginOwner();
  },
  async 'logout'() { await S.store.logout(); S.guestView = false; toast('已登出'); },

  'open-project': (el) => {
    const p = (S.projects || []).find((x) => x.id === el.dataset.pid);
    if (p?.status === 'locked' && !isOwner()) return toast('🔒 這個代購已結束鎖定，無法進入');
    go(`#/p/${el.dataset.pid}`);
  },
  async 'new-project'() {
    const title = (await askText('新代購的標題', { placeholder: '例如：12 月 東京寶可夢中心代購', okText: '建立' }))?.trim();
    if (!title) return;
    const now = Date.now();
    const id = await S.store.createProject({
      title, description: '', currency: 'JPY', rate: 0.21, status: 'open', hidden: true,
      cover: { type: 'svg', key: DEFAULT_ILLUSTRATION }, fields: DEFAULT_FIELDS(), orderFields: DEFAULT_ORDER_FIELDS(), createdAt: now, updatedAt: now,
    });
    toast('已建立（目前不公開，準備好再到首頁打開「公開」）');
    go(`#/p/${id}/products`);
  },
  async 'toggle-hidden'(el) {
    const p = S.projects.find((x) => x.id === el.dataset.pid);
    await S.store.updateProject(p.id, { hidden: !p.hidden, updatedAt: Date.now() });
  },
  async 'save-project'() {
    const title = $('#pj-title').value.trim();
    if (!title) return toast('標題不能空白');
    const rate = num($('#pj-rate').value);
    if (rate <= 0) return toast('匯率要大於 0');
    if ($('#pj-pop-link').value.trim() && !popupLinkInput()) return toast('LINE 連結要是 https:// 開頭');
    await S.store.updateProject(S.cur.pid, {
      title, description: $('#pj-desc').value.trim(), currency: $('#pj-cur').value, rate, updatedAt: Date.now(),
      popup: { ...(S.cur.project.popup || {}), text: $('#pj-pop-text').value.trim(), link: popupLinkInput() },
    });
    toast('已儲存 ✓');
  },
  async 'qr-upload'() { const src = await pickFile(); if (src) await saveQr(src); },
  async 'qr-paste'() { const src = await clipboardImage(); if (src) await saveQr(src); },
  async 'qr-clear'() { await S.store.updateProject(S.cur.pid, { popup: { ...(S.cur.project.popup || {}), qr: '' } }); },
  'popup-preview': () => showSubmitPopup({ popup: { ...(S.cur.project.popup || {}), text: $('#pj-pop-text').value.trim(), link: popupLinkInput() } }, true),
  async 'cover-svg'(el) { await S.store.updateProject(S.cur.pid, { cover: { type: 'svg', key: el.dataset.key } }); },
  async 'cover-upload'() {
    const src = await pickFile(); if (!src) return;
    await S.store.updateProject(S.cur.pid, { cover: { type: 'image', src } });
    toast('封面已更新');
  },
  async 'copy-link'() {
    const url = `${location.origin}${location.pathname}#/p/${S.cur.pid}`;
    try { await navigator.clipboard.writeText(url); toast('連結已複製，可以貼到 LINE 了'); }
    catch { askText('複製這個連結', { value: url, okText: '關閉' }); }
  },
  async 'delete-project'() {
    if (!(await askConfirm('確定刪除整個代購？商品與所有登記都會一起刪掉，無法復原。', '刪除'))) return;
    await S.store.deleteProject(S.cur.pid);
    toast('已刪除'); go('#/');
  },

  'edit-product': (el) => productModal(el.dataset.id ? productById(el.dataset.id) : null),
  async 'pm-upload'() {
    const src = await pickFile(); if (!src) return;
    S.ui.modalImage = src; $('#pm-url').value = '';
    $('#pm-thumb').innerHTML = `<img src="${esc(src)}" alt="">`;
  },
  async 'pm-paste'() {
    if (!navigator.clipboard?.read) return toast('這個瀏覽器不支援按鈕貼上，請直接按 Ctrl+V');
    try {
      for (const item of await navigator.clipboard.read()) {
        const t = item.types.find((x) => x.startsWith('image/'));
        if (t) return setModalImage(await fileToDataURL(await item.getType(t)));
        if (item.types.includes('text/plain')) {
          const txt = (await (await item.getType('text/plain')).text()).trim();
          if (/^https:\/\//.test(txt)) return setModalImage(txt, true);
        }
      }
      toast('剪貼簿裡沒有圖片');
    } catch { toast('沒有權限讀取剪貼簿，請直接按 Ctrl+V'); }
  },
  'pm-clear-img': () => { S.ui.modalImage = ''; $('#pm-url').value = ''; $('#pm-thumb').innerHTML = '🛍️'; },
  async 'pm-save'(el) {
    const name = $('#pm-name').value.trim();
    const qty = Math.floor(num($('#pm-qty').value));
    const fx = num($('#pm-fx').value);
    if (!name) return toast('請填商品名稱');
    if ($('#pm-fx').value === '') return toast('請填外幣金額');
    const old = el.dataset.id ? productById(el.dataset.id) : null;
    const data = {
      name, image: S.ui.modalImage || '', qty: Math.max(0, qty), waitlistMax: $('#pm-wl').value.trim() === '' ? null : Math.max(0, Math.floor(num($('#pm-wl').value))),
      foreignPrice: fx, order: old?.order ?? Date.now(), updatedAt: Date.now(),
    };
    await S.store.saveProduct(S.cur.pid, el.dataset.id || null, data);
    closeModal(); toast('商品已儲存 ✓');
  },
  async 'move-product'(el) {
    const list = sortedProducts();
    const i = list.findIndex((x) => x.id === el.dataset.id);
    const j = i + Number(el.dataset.dir);
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    let oa = a.order ?? i, ob = b.order ?? j;
    if (oa === ob) { oa = i; ob = j; }
    const { id: ida, ...ra } = a; const { id: idb, ...rb } = b;
    await Promise.all([S.store.saveProduct(S.cur.pid, ida, { ...ra, order: ob }), S.store.saveProduct(S.cur.pid, idb, { ...rb, order: oa })]);
  },
  async 'delete-product'(el) {
    const pr = productById(el.dataset.id);
    if (!(await askConfirm(`刪除「${pr.name}」？已登記的資料會保留商品名稱。`, '刪除'))) return;
    await S.store.deleteProduct(S.cur.pid, pr.id);
  },

  'fields-seg': (el) => { S.ui.fieldsSeg = el.dataset.seg; render(true); },
  'review-filter': (el) => { S.ui.reviewFilter = el.dataset.f; render(true); },
  'fd-add': (el) => {
    const g = el.dataset.g;
    const type = $(`#fd-new-type-${g}`).value;
    const F = draftOf(el);
    const f = { id: (g === 'order' ? 'o_' : 'f_') + newId(), label: { text: g === 'order' ? 'LINE 名稱' : '新欄位', number: '數量', select: '商品', date: '日期', amount: '金額' }[type], type, required: false };
    if (type === 'select') f.source = 'name';
    if (type === 'amount') { f.selectId = F.find((x) => x.type === 'select')?.id || ''; f.qtyId = F.find((x) => x.type === 'number')?.id || ''; }
    F.push(f); S.ui.fieldsDirty = true; render(true);
  },
  'fd-del': (el) => { const F = draftOf(el); if (F[+el.dataset.i]?.fixed) return; F.splice(+el.dataset.i, 1); S.ui.fieldsDirty = true; render(true); },
  'fd-move': (el) => {
    const F = draftOf(el), i = +el.dataset.i, j = i + Number(el.dataset.dir);
    [F[i], F[j]] = [F[j], F[i]]; S.ui.fieldsDirty = true; render(true);
  },
  'fd-reset': () => { S.ui.fieldsDraft = null; S.ui.orderDraft = null; S.ui.fieldsDirty = false; render(true); },
  async 'fd-save'() {
    const F = S.ui.fieldsDraft, O = S.ui.orderDraft;
    if (!F.length) return toast('至少要有一個每項欄位');
    if ([...F, ...O].some((f) => !String(f.label).trim())) return toast('有欄位沒有名稱');
    if (!F.some((f) => f.type === 'select')) return toast('至少要有一個「下拉選單」讓客人選商品');
    for (const f of F) if (f.type === 'amount' && !F.some((s) => s.id === f.selectId)) f.selectId = F.find((s) => s.type === 'select').id;
    await S.store.updateProject(S.cur.pid, { fields: F, orderFields: O, updatedAt: Date.now() });
    S.ui.fieldsDirty = false; S.ui.fieldsDraft = null; S.ui.orderDraft = null; toast('欄位設定已儲存 ✓'); render(true);
  },

  async 'rv-item'(el) {
    const o = S.cur.orders.find((x) => x.id === el.dataset.oid);
    let reason = '';
    if (el.dataset.s === 'rejected') { reason = await askText('不通過的原因（客人看得到）', { placeholder: '例如：已售完、超過限購數量…', okText: '確定拒絕' }); if (reason === null) return; }
    const r = o.review ? JSON.parse(JSON.stringify(o.review)) : { order: null, orderReason: '', items: {} };
    r.items = r.items || {};
    if (r.order === 'rejected') { // 原本整筆拒絕 → 改成逐項
      for (const it of o.items) r.items[it.id] = { status: 'rejected', reason: r.orderReason || '' };
      r.order = null; r.orderReason = '';
    } else if (r.order === 'approved') {
      for (const it of o.items) if (!r.items[it.id]) r.items[it.id] = { status: 'approved' };
      r.order = null;
    }
    r.items[el.dataset.iid] = el.dataset.s === 'rejected' ? { status: 'rejected', reason: reason.trim() } : { status: 'approved' };
    r.at = Date.now();
    const done = (o.items || []).every((it) => itemStatus({ review: r }, it).s !== 'pending');
    await S.store.setReview(S.cur.pid, o.id, r, done);
  },
  async 'rv-order'(el) {
    let reason = '';
    if (el.dataset.s === 'rejected') { reason = await askText('整筆不通過的原因（客人看得到）', { placeholder: '例如：未依規定付款…', okText: '確定拒絕' }); if (reason === null) return; }
    await S.store.setReview(S.cur.pid, el.dataset.oid, { order: el.dataset.s, orderReason: reason.trim(), items: {}, at: Date.now() }, true);
    toast(el.dataset.s === 'approved' ? '整筆通過 ✓' : '已整筆拒絕');
  },
  async 'rv-reset'(el) { await S.store.clearReview(S.cur.pid, el.dataset.oid); },
  async 'rv-delete'(el) {
    if (!(await askConfirm('刪除這筆登記？無法復原。', '刪除'))) return;
    await S.store.deleteOrder(S.cur.pid, el.dataset.oid);
  },

  'add-row': () => { readRows(); S.ui.rows.push({ id: newId(), values: {} }); render(true); },
  'del-row': (el) => { readRows(); S.ui.rows = S.ui.rows.filter((r) => r.id !== el.dataset.row); render(true); },
  'cancel-edit': () => { S.ui.editingOrder = null; S.ui.rows = null; render(true); toast('已改成新增一筆登記'); },
  'edit-order': (el) => { S.ui.editingOrder = el.dataset.oid; S.ui.rows = null; go(`#/p/${S.cur.pid}/form`); },
  async 'cancel-order'(el) {
    if (!(await askConfirm('確定取消這筆登記？', '取消登記'))) return;
    const o = S.cur.orders.find((x) => x.id === el.dataset.oid);
    const now = Date.now();
    const patch = { cancelled: true, cancelledAt: now, updatedAt: now };
    if (!Array.isArray(o.prevItems)) { patch.prevItems = o.items; patch.prevReview = o.review || null; }
    await S.store.updateOrder(S.cur.pid, o.id, patch, o.review ? ['review'] : []);
    toast('已取消，賣家會收到通知');
  },
  'ov-filter': (el) => { S.ui.ovFilter = el.dataset.f; render(true); },
  'ov-seg': (el) => { S.ui.overviewSeg = el.dataset.seg; render(true); },

  'zoom-img': (el) => openModal(`<h2>${esc(el.dataset.name)}</h2>
    <img src="${esc(el.dataset.src)}" alt="${esc(el.dataset.name)}" style="width:100%;max-height:60vh;object-fit:contain;border:var(--line) solid var(--ink);border-radius:var(--r-md);background:#fff">
    <button class="btn primary block" style="margin-top:12px" data-action="modal-cancel">關閉</button>`),
  'modal-bg': (el, e) => { if (e.target === el) closeModal(null); },
  'modal-cancel': () => closeModal(null),
  'modal-ok': () => closeModal(true),
  'modal-ok-text': () => closeModal($('#ask-in').value),
};
const changes = {
  async 'project-status'(el) { await S.store.updateProject(el.dataset.pid, { status: el.value, updatedAt: Date.now() }); toast(`已改為「${STATUS[el.value].label}」`); },
  'rate-preview': () => { $('#rate-preview').innerHTML = ratePreview($('#pj-cur').value, $('#pj-rate').value); },
  'sort': (el) => { S.ui.sort = el.value; render(true); },
  'row-calc': (el) => updateRowCalc(el.closest('.item-row')),
  'fd': (el) => {
    const f = draftOf(el)[+el.dataset.i];
    const k = el.dataset.k;
    f[k] = (k === 'required' || k === 'public') ? !!el.value : el.value;
    if (k === 'type') {
      if (f.type === 'select' && !f.source) f.source = 'name';
      if (f.type === 'amount') { f.selectId = S.ui.fieldsDraft.find((x) => x.type === 'select')?.id || ''; f.qtyId = ''; f.required = false; }
    }
    S.ui.fieldsDirty = true; render(true);
  },
};
const inputs = {
  'rate-preview': () => changes['rate-preview'](),
  'row-calc': (el) => updateRowCalc(el.closest('.item-row')),
  'fd': (el) => { draftOf(el)[+el.dataset.i][el.dataset.k] = el.value; S.ui.fieldsDirty = true; },
  'pm-fx': () => { $('#pm-twd').value = fmtTWD(Math.round(num($('#pm-fx').value) * num(S.cur.project.rate))); },
  'pm-url': (el) => {
    const u = el.value.trim();
    S.ui.modalImage = safeImg(u);
    $('#pm-thumb').innerHTML = S.ui.modalImage ? `<img src="${esc(u)}" alt="">` : '🛍️';
  },
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  const menu = $('#menu');
  if (!menu.classList.contains('hidden') && !e.target.closest('#menu') && el?.dataset.action !== 'menu') menu.classList.add('hidden');
  if (!el || el.disabled) return;
  if (el.tagName === 'SELECT') return;
  // 點在下拉選單、輸入框或卡片上的賣家控制區時，不要當成點卡片
  const field = e.target.closest('select, input, textarea, option');
  if (field && field !== el) return;
  if (el.dataset.action === 'open-project' && e.target.closest('.owner-ctrl')) return;
  if (el.closest('#menu') && el.dataset.action !== 'toggle-guest' && el.dataset.action !== 'toggle-motion') menu.classList.add('hidden');
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'A' && el.dataset.action !== 'menu-close') e.preventDefault();
  try { await fn(el, e); } catch (err) { if (!err?.code) handleError(err); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.p-card')) actions['open-project'](e.target);
  if (e.key === 'Escape' && layer.innerHTML) closeModal(null);
});
document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) { try { await changes[el.dataset.change](el, e); } catch (err) { if (!err?.code) handleError(err); } }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el, e);
});
document.addEventListener('submit', (e) => {
  if (e.target.id === 'reg-form') { e.preventDefault(); submitForm(); }
});
window.addEventListener('hashchange', () => {
  $('#menu').classList.add('hidden');
  // 離開登記表就結束「修改」狀態，回來時一定是新的登記
  const r = parseRoute();
  if (S.ui.editingOrder && !(r.name === 'project' && r.tab === 'form')) { S.ui.editingOrder = null; S.ui.rows = null; }
  render(true);
});

// ------------------------------------------------------------
//  啟動
// ------------------------------------------------------------
(async function boot() {
  if (localStorage.getItem('daigou-reduce-motion') === '1') document.documentElement.classList.add('reduce-motion');
  document.title = SITE.name;
  if (new URLSearchParams(location.search).has('quota-test')) showQuota(); // 預覽額度用完畫面
  try { S.store = await createStore(); }
  catch { app.innerHTML = '<div class="empty">連不上資料庫，請確認網路或 Firebase 設定（見 README）。</div>'; return; }
  let wasOwner = null;
  S.store.onAuth((u) => {
    S.user = u;
    if (wasOwner !== u.isOwner) { wasOwner = u.isOwner; subscribeProjects(); const pid = S.cur.pid; if (pid) { S.cur.pid = null; subscribeProject(pid); } }
    render(true);
  });
})();
