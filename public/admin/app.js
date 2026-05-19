// ── Config ──────────────────────────────────────────────────
const API = window.location.origin;

const ALLERGEN_LABELS = {
  gluten: 'Gluten', dairy: 'Milch', eggs: 'Eier', fish: 'Fisch',
  shellfish: 'Schalentiere', nuts: 'Nüsse', peanuts: 'Erdnüsse',
  celery: 'Sellerie', mustard: 'Senf', sesame: 'Sesam',
  soy: 'Soja', sulphur: 'Sulfit', lupin: 'Lupinen', molluscs: 'Weichtiere',
};

const PAGE_TITLES = {
  dashboard: 'Dashboard', menu: 'Speisen',
  drinks: 'Getränke', wines: 'Weine', users: 'Benutzer', settings: 'Einstellungen',
};

// ── State ────────────────────────────────────────────────────
let state = {
  menu:   { sections: [], items: [] },
  drinks: { sections: [], items: [] },
  wines:  { sections: [], items: [] },
  users:  [],
};
let session = { token: null, username: null, role: null };
let activeFilter = { menu: null, drinks: null, wines: null };
let itemCtx = null;
let importCtx = null;
let sectionCtx = null;
let userCtx = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('campedel_token');
  const username = sessionStorage.getItem('campedel_user');
  const role = sessionStorage.getItem('campedel_role');
  if (token) {
    try {
      const r = await apiFetch('/api/auth/verify', { auth: token });
      if (r.ok) {
        session = { token, username: r.username || username, role: r.role || role };
        showApp();
        return;
      }
    } catch (_) {}
  }
  showLogin();
});

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  setTimeout(() => document.getElementById('login-user')?.focus(), 80);
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const u = session.username || 'Admin';
  document.getElementById('sidebar-avatar').textContent = u.charAt(0).toUpperCase();
  document.getElementById('dash-username').textContent = u.charAt(0).toUpperCase() + u.slice(1);
  // Init pill to dashboard position
  setTimeout(() => {
    const first = document.querySelector('.nav-item');
    const pill = document.getElementById('nav-pill');
    if (first && pill) {
      const rect = first.getBoundingClientRect();
      const inner = document.querySelector('.sidebar-inner');
      const innerRect = inner.getBoundingClientRect();
      pill.style.top = (rect.top - innerRect.top + rect.height / 2 - 16) + 'px';
    }
  }, 50);
  loadAll();
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Bitte alle Felder ausfüllen'; return; }
  try {
    const r = await apiFetch('/api/auth/login', { method: 'POST', body: { username, password } });
    session = { token: r.token, username: r.username, role: r.role };
    sessionStorage.setItem('campedel_token', r.token);
    sessionStorage.setItem('campedel_user', r.username);
    sessionStorage.setItem('campedel_role', r.role);
    showApp();
  } catch (e) {
    errEl.textContent = 'Ungültige Anmeldedaten';
    document.getElementById('login-pw').value = '';
    document.getElementById('login-pw').focus();
  }
}

function doLogout() {
  sessionStorage.clear();
  session = { token: null, username: null, role: null };
  showLogin();
}

// ── Navigation ───────────────────────────────────────────────
function showPage(page, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  const activeNav = navEl || document.querySelector(`[data-page="${page}"]`);
  if (activeNav) {
    activeNav.classList.add('active');
    // Burst animation
    activeNav.classList.remove('pop');
    void activeNav.offsetWidth;
    activeNav.classList.add('pop');
    // Move pill indicator
    const pill = document.getElementById('nav-pill');
    if (pill) {
      const idx = parseInt(activeNav.dataset.index || '0');
      const navItems = document.querySelectorAll('.nav-item');
      if (navItems[idx]) {
        const rect = navItems[idx].getBoundingClientRect();
        const inner = document.querySelector('.sidebar-inner');
        const innerRect = inner.getBoundingClientRect();
        pill.style.top = (rect.top - innerRect.top + rect.height / 2 - 16) + 'px';
      }
    }
  }
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  if (page === 'users') loadUsers();
  if (page === 'dashboard') {
    loadDashboard();
  }
  if (page === 'settings') loadSettings();
}

// ── Data Loading ─────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadDashboard(), loadMenu(), loadDrinks(), loadWines()]);
}

async function loadDashboard() {
  const images = ['image.jpeg', 'image2.jpg', 'image3.jpg', 'image4.jpg'];
  const randomImg = images[Math.floor(Math.random() * images.length)];
  const dashWelcome = document.querySelector('.dash-welcome');
  if (dashWelcome) {
    dashWelcome.style.background = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('../img/${randomImg}') center/cover no-repeat`;
  }
  
  try {
    const stats = await apiFetch('/api/stats');
    renderDashboard(stats);
  } catch (_) {}
}

async function loadMenu() {
  const [sections, items] = await Promise.all([
    apiFetch('/api/menu/sections'),
    apiFetch('/api/menu/items'),
  ]);
  state.menu = { sections, items };
  renderStats('menu-stats', [
    { v: items.length, l: 'Gerichte' },
    { v: sections.length, l: 'Kategorien' },
    { v: items.filter(i => i.is_vegetarian).length, l: 'Vegetarisch' },
  ]);
  renderSectionTabs('menu', sections, s => s.category_key);
  renderMenuTable();
}

async function loadDrinks() {
  const [sections, items] = await Promise.all([
    apiFetch('/api/drinks/sections'),
    apiFetch('/api/drinks/items'),
  ]);
  state.drinks = { sections, items };
  renderStats('drinks-stats', [
    { v: items.length, l: 'Getränke' },
    { v: sections.length, l: 'Kategorien' },
  ]);
  renderSectionTabs('drinks', sections, s => s.category_key);
  renderDrinksTable();
}

async function loadWines() {
  const [sections, items] = await Promise.all([
    apiFetch('/api/wines/sections'),
    apiFetch('/api/wines/items'),
  ]);
  state.wines = { sections, items };
  renderStats('wines-stats', [
    { v: items.length, l: 'Weine' },
    { v: sections.length, l: 'Kategorien' },
  ]);
  renderSectionTabs('wines', sections, s => s.category);
  renderWinesTable();
}

async function loadUsers() {
  try {
    const users = await apiFetch('/api/users');
    state.users = users;
    renderUsersStats();
    renderUsersTable();
  } catch (e) {
    toast('Fehler beim Laden der Benutzer', 'err');
  }
}

// ── Dashboard ─────────────────────────────────────────────────
const DASH_ICONS = {
  menu:   `<svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  drinks: `<svg viewBox="0 0 24 24"><path d="M8 2h8l1 7H7L8 2Z"/><path d="M7 9c0 5.5 3 9 5 9s5-3.5 5-9"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
  wines:  `<svg viewBox="0 0 24 24"><path d="M8 2h8l2 9a6 6 0 0 1-12 0L8 2Z"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
  leaf:   `<svg viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  image:  `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  user:   `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  folder: `<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  list:   `<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
};

function renderDashboard(stats) {
  const grid = document.getElementById('dash-grid');
  if (!grid) return;
  grid.innerHTML = [
    { icon: DASH_ICONS.menu,   num: stats.menu.items,   label: 'Gerichte',        sub: `${stats.menu.sections} Kategorien`,   cls: 'blue' },
    { icon: DASH_ICONS.drinks, num: stats.drinks.items, label: 'Getränke',         sub: `${stats.drinks.sections} Kategorien`, cls: 'green' },
    { icon: DASH_ICONS.wines,  num: stats.wines.items,  label: 'Weine',            sub: `${stats.wines.sections} Kategorien`,  cls: 'rose' },
    { icon: DASH_ICONS.leaf,   num: stats.menu.vegetarian, label: 'Vegetarisch',   sub: `${stats.menu.vegan} vegan`,           cls: 'amber' },
    { icon: DASH_ICONS.image,  num: stats.menu.withImage + stats.drinks.withImage + stats.wines.withImage, label: 'Mit Bild', sub: 'Einträge mit Foto', cls: 'cyan' },
    { icon: DASH_ICONS.user,   num: stats.users,        label: 'Benutzer',         sub: 'Admin-Accounts',                      cls: 'purple' },
    { icon: DASH_ICONS.folder, num: stats.menu.sections + stats.drinks.sections + stats.wines.sections, label: 'Kategorien', sub: 'Gesamt', cls: 'amber' },
    { icon: DASH_ICONS.list,   num: stats.menu.items + stats.drinks.items + stats.wines.items, label: 'Einträge gesamt', sub: 'Alle Karten', cls: 'blue' },
  ].map(c => `
    <div class="dash-card ${c.cls}">
      <div class="dash-card-icon">${c.icon}</div>
      <div class="dash-card-num">${c.num}</div>
      <div class="dash-card-label">${c.label}</div>
      <div class="dash-card-sub">${c.sub}</div>
    </div>`).join('');
}

// ── Stats Row ────────────────────────────────────────────────
function renderStats(id, items) {
  document.getElementById(id).innerHTML = items.map(s =>
    `<div class="stat-card"><div class="stat-value">${s.v}</div><div class="stat-label">${s.l}</div></div>`
  ).join('');
}

// ── Section Tabs ─────────────────────────────────────────────
function renderSectionTabs(type, sections, labelFn) {
  const el = document.getElementById(`${type}-section-tabs`);
  el.innerHTML =
    `<div class="section-tab active" onclick="filterSection('${type}',null,this)">Alle</div>` +
    sections.map(s => `<div class="section-tab" onclick="filterSection('${type}','${s.id}',this)">${labelFn(s)}</div>`).join('');
}

function filterSection(type, id, el) {
  document.querySelectorAll(`#${type}-section-tabs .section-tab`).forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  activeFilter[type] = id;
  if (type === 'menu') renderMenuTable();
  else if (type === 'drinks') renderDrinksTable();
  else renderWinesTable();
}

// ── Menu Table ───────────────────────────────────────────────
function renderMenuTable() {
  const f = activeFilter.menu;
  const items = f ? state.menu.items.filter(i => i.section_id === f) : state.menu.items;
  const tbody = document.getElementById('menu-tbody');
  if (!items.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Keine Gerichte</td></tr>`; return; }
  tbody.innerHTML = items.map(item => {
    const section = state.menu.sections.find(s => s.id === item.section_id);
    const allergens = Array.isArray(item.allergens) ? item.allergens : [];
    return `<tr>
      <td><div class="item-cell">
        ${item.image_url ? `<img src="${item.image_url}" class="thumb">` : `<div class="thumb-placeholder"><svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`}
        <div><div class="item-name">${esc(item.name_de)}</div></div>
      </div></td>
      <td><span class="tag">${esc(section?.category_key||item.section_id)}</span></td>
      <td class="price">€ ${Number(item.price).toFixed(2)}</td>
      <td>${allergens.map(a=>`<span class="tag">${ALLERGEN_LABELS[a]||a}</span>`).join('')}</td>
      <td>
        ${item.is_vegetarian?'<span class="tag tag-green" title="Vegetarisch"><svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></span>':''}
        ${item.is_vegan?'<span class="tag tag-green" title="Vegan"><svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 1 1.8 8 10 10 0 0 1-3.1.9 7.7 7.7 0 0 1-.9-6.1 8 8 0 0 1 2.2-2.8z"/></svg></span>':''}
      </td>
      <td><div class="btn-actions">
        <button class="btn btn-sm btn-ghost" onclick="editItem('menu','${item.id}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('menu','items','${item.id}',loadMenu)"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── Drinks Table ─────────────────────────────────────────────
function renderDrinksTable() {
  const f = activeFilter.drinks;
  const items = f ? state.drinks.items.filter(i => i.section_id === f) : state.drinks.items;
  const tbody = document.getElementById('drinks-tbody');
  if (!items.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Keine Getränke</td></tr>`; return; }
  tbody.innerHTML = items.map(item => {
    const section = state.drinks.sections.find(s => s.id === item.section_id);
    const prices = Array.isArray(item.prices) ? item.prices : [];
    const priceStr = prices.map(p => p.amount ? `${p.amount} €${Number(p.price).toFixed(2)}` : `€${Number(p.price).toFixed(2)}`).join(' · ');
    return `<tr>
      <td><div class="item-cell">
        ${item.image_url ? `<img src="${item.image_url}" class="thumb">` : `<div class="thumb-placeholder"><svg viewBox="0 0 24 24"><path d="M8 2h8l1 7H7L8 2Z"/><path d="M7 9c0 5.5 3 9 5 9s5-3.5 5-9"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg></div>`}
        <div><div class="item-name">${esc(item.name_de)}</div></div>
      </div></td>
      <td><span class="tag">${esc(section?.category_key||item.section_id)}</span></td>
      <td class="price" style="font-size:12px">${priceStr}</td>
      <td><div class="btn-actions">
        <button class="btn btn-sm btn-ghost" onclick="editItem('drinks','${item.id}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('drinks','items','${item.id}',loadDrinks)"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── Wines Table ──────────────────────────────────────────────
function renderWinesTable() {
  const f = activeFilter.wines;
  const items = f ? state.wines.items.filter(i => i.section_id === f) : state.wines.items;
  const tbody = document.getElementById('wines-tbody');
  if (!items.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Keine Weine</td></tr>`; return; }
  tbody.innerHTML = items.map(item => {
    const section = state.wines.sections.find(s => s.id === item.section_id);
    return `<tr>
      <td><div class="item-cell">
        ${item.image_url ? `<img src="${item.image_url}" class="thumb">` : `<div class="thumb-placeholder"><svg viewBox="0 0 24 24"><path d="M8 2h8l2 9a6 6 0 0 1-12 0L8 2Z"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg></div>`}
        <div><div class="item-name">${esc(item.name)}</div><div class="item-sub">${esc(item.region||'')}</div></div>
      </div></td>
      <td style="color:var(--text2)">${esc(item.winery||'')}</td>
      <td><span class="tag">${esc(section?.category||item.section_id)}</span></td>
      <td class="price">${item.price_bottle!=null ? '€ '+Number(item.price_bottle).toFixed(2) : '—'}</td>
      <td class="price">${item.price_glass!=null ? '€ '+Number(item.price_glass).toFixed(2) : '—'}</td>
      <td><div class="btn-actions">
        <button class="btn btn-sm btn-ghost" onclick="editItem('wines','${item.id}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('wines','items','${item.id}',loadWines)"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── Users Table ──────────────────────────────────────────────
function renderUsersStats() {
  document.getElementById('users-stats').innerHTML =
    `<div class="stat-card"><div class="stat-value">${state.users.length}</div><div class="stat-label">Benutzer</div></div>`;
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!state.users.length) { tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Keine Benutzer</td></tr>`; return; }
  tbody.innerHTML = state.users.map(u => {
    const isSelf = u.username === session.username;
    const created = u.created_at ? u.created_at.slice(0, 10) : '—';
    return `<tr>
      <td><div class="item-cell">
        <div class="user-table-avatar">${u.username.charAt(0).toUpperCase()}</div>
        <div><div class="item-name">${esc(u.username)}${isSelf ? ' <span class="tag" style="font-size:10px">Ich</span>' : ''}</div></div>
      </div></td>
      <td><span class="role-badge">${esc(u.role)}</span></td>
      <td style="color:var(--text2);font-size:13px">${created}</td>
      <td><div class="btn-actions">
        <button class="btn btn-sm btn-ghost" onclick="openChangePasswordModal(${u.id},'${esc(u.username)}')"><svg viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg></button>
        ${!isSelf ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id},'${esc(u.username)}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

// ── Users CRUD ───────────────────────────────────────────────
function openUserModal() {
  userCtx = { mode: 'create' };
  document.getElementById('user-modal-title').textContent = '+ Neuer Benutzer';
  document.getElementById('user-modal-body').innerHTML = `
    <div class="form-group">
      <label>Benutzername</label>
      <input type="text" id="u-username" placeholder="z.B. maria" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Passwort (mind. 6 Zeichen)</label>
      <input type="password" id="u-password" placeholder="••••••••" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label>Passwort bestätigen</label>
      <input type="password" id="u-password2" placeholder="••••••••" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label>Rolle</label>
      <select id="u-role">
        <option value="admin">admin</option>
        <option value="editor">editor</option>
      </select>
    </div>`;
  document.getElementById('user-modal-save').textContent = 'Erstellen';
  document.getElementById('user-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('u-username')?.focus(), 80);
}

function openChangePasswordModal(id, username) {
  userCtx = { mode: 'password', id };
  document.getElementById('user-modal-title').innerHTML = `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:text-bottom;margin-right:5px"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>Passwort — ${esc(username)}`;
  document.getElementById('user-modal-body').innerHTML = `
    <div class="form-group">
      <label>Neues Passwort (mind. 6 Zeichen)</label>
      <input type="password" id="u-password" placeholder="••••••••" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label>Passwort bestätigen</label>
      <input type="password" id="u-password2" placeholder="••••••••" autocomplete="new-password">
    </div>`;
  document.getElementById('user-modal-save').textContent = 'Speichern';
  document.getElementById('user-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('u-password')?.focus(), 80);
}

function closeUserModal() {
  document.getElementById('user-modal-overlay').classList.remove('open');
  userCtx = null;
}

async function saveUser() {
  const pw = document.getElementById('u-password')?.value || '';
  const pw2 = document.getElementById('u-password2')?.value || '';

  if (pw !== pw2) return toast('Passwörter stimmen nicht überein', 'err');
  if (pw.length < 6) return toast('Passwort mindestens 6 Zeichen', 'err');

  if (userCtx.mode === 'create') {
    const username = document.getElementById('u-username')?.value?.trim() || '';
    const role = document.getElementById('u-role')?.value || 'admin';
    if (!username) return toast('Benutzername erforderlich', 'err');
    try {
      await apiFetch('/api/users', { method: 'POST', body: { username, password: pw, role } });
      toast(`Benutzer "${username}" erstellt`, 'ok');
      closeUserModal();
      loadUsers();
    } catch (e) { toast('Fehler: ' + e.message, 'err'); }

  } else if (userCtx.mode === 'password') {
    try {
      await apiFetch(`/api/users/${userCtx.id}/password`, { method: 'PUT', body: { password: pw } });
      toast('Passwort geändert', 'ok');
      closeUserModal();
    } catch (e) { toast('Fehler: ' + e.message, 'err'); }
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
  try {
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    toast(`Benutzer "${username}" gelöscht`, 'ok');
    loadUsers();
  } catch (e) { toast('Fehler: ' + e.message, 'err'); }
}

// ── Search ───────────────────────────────────────────────────
function filterTable(tableId, q) {
  q = q.toLowerCase();
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Item Modal ───────────────────────────────────────────────
function openItemModal(type, existing = null) {
  itemCtx = { type, existing };
  const label = type === 'menu' ? 'Gericht' : type === 'drinks' ? 'Getränk' : 'Wein';
  const name = existing ? (type === 'wines' ? existing.name : existing.name_de) : null;
  document.getElementById('item-modal-title').innerHTML = name
    ? `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:text-bottom;margin-right:5px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>${esc(name)}`
    : `+ Neues ${label}`;

  let html = '';
  if (type === 'menu') html = buildMenuForm(existing);
  else if (type === 'drinks') html = buildDrinksForm(existing);
  else html = buildWinesForm(existing);

  document.getElementById('item-modal-body').innerHTML = html;
  document.getElementById('item-modal-overlay').classList.add('open');

  if (type === 'menu') {
    const allergens = existing && Array.isArray(existing.allergens) ? existing.allergens : [];
    document.querySelectorAll('.allergen-chip').forEach(chip => {
      if (allergens.includes(chip.dataset.code)) chip.classList.add('selected');
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });
  }
}

function editItem(type, id) {
  const list = type === 'menu' ? state.menu.items : type === 'drinks' ? state.drinks.items : state.wines.items;
  const item = list.find(i => i.id === id);
  if (item) openItemModal(type, item);
}

function closeItemModal() {
  document.getElementById('item-modal-overlay').classList.remove('open');
  itemCtx = null;
}

function buildMenuForm(item) {
  const sectionOpts = state.menu.sections.map(s =>
    `<option value="${s.id}" ${item?.section_id===s.id?'selected':''}>${s.category_key}</option>`
  ).join('');
  return `
    <div class="form-row">
      <div class="form-group"><label>ID</label>
        <input type="text" id="f-id" value="${esc(item?.id||'')}" placeholder="z.B. schnitzel" ${item?'readonly style="opacity:.5"':''}>
      </div>
      <div class="form-group"><label>Kategorie</label><select id="f-section">${sectionOpts}</select></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Name DE</label><input type="text" id="f-name-de" value="${esc(item?.name_de||'')}"></div>
      <div class="form-group"><label>Name IT</label><input type="text" id="f-name-it" value="${esc(item?.name_it||'')}"></div>
      <div class="form-group"><label>Name EN</label><input type="text" id="f-name-en" value="${esc(item?.name_en||'')}"></div>
    </div>
    <div class="form-group"><label>Beschreibung DE</label><textarea id="f-desc-de">${esc(item?.description_de||'')}</textarea></div>
    <div class="form-group"><label>Beschreibung IT</label><textarea id="f-desc-it">${esc(item?.description_it||'')}</textarea></div>
    <div class="form-group"><label>Beschreibung EN</label><textarea id="f-desc-en">${esc(item?.description_en||'')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Preis (€)</label><input type="number" id="f-price" value="${item?.price??''}" step="0.10" min="0"></div>
      <div class="form-group"><label>Flags</label>
        <div style="display:flex;gap:14px;margin-top:7px">
          <label class="checkbox-group"><input type="checkbox" id="f-veg" ${item?.is_vegetarian?'checked':''}> Vegetarisch</label>
          <label class="checkbox-group"><input type="checkbox" id="f-vegan" ${item?.is_vegan?'checked':''}> Vegan</label>
        </div>
      </div>
    </div>
    <div class="form-group"><label>Allergene</label>
      <div class="allergen-grid">
        ${Object.entries(ALLERGEN_LABELS).map(([code,label])=>`<div class="allergen-chip" data-code="${code}">${label}</div>`).join('')}
      </div>
    </div>
    ${buildImageField(item?.image_url)}`;
}

function buildDrinksForm(item) {
  const sectionOpts = state.drinks.sections.map(s =>
    `<option value="${s.id}" ${item?.section_id===s.id?'selected':''}>${s.category_key}</option>`
  ).join('');
  const prices = item && Array.isArray(item.prices) && item.prices.length ? item.prices : [{amount:'',price:''}];
  const priceRows = prices.map((p,i) => `
    <div class="price-row">
      <input type="text" placeholder="Menge (z.B. 0,25l)" value="${esc(p.amount||'')}" class="price-amount">
      <input type="number" placeholder="€" value="${p.price||''}" step="0.10" min="0" class="price-val">
      <button type="button" class="remove-price" onclick="removePriceRow(this)"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`).join('');
  return `
    <div class="form-row">
      <div class="form-group"><label>ID</label>
        <input type="text" id="f-id" value="${esc(item?.id||'')}" placeholder="z.B. espresso" ${item?'readonly style="opacity:.5"':''}>
      </div>
      <div class="form-group"><label>Kategorie</label><select id="f-section">${sectionOpts}</select></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Name DE</label><input type="text" id="f-name-de" value="${esc(item?.name_de||'')}"></div>
      <div class="form-group"><label>Name IT</label><input type="text" id="f-name-it" value="${esc(item?.name_it||'')}"></div>
      <div class="form-group"><label>Name EN</label><input type="text" id="f-name-en" value="${esc(item?.name_en||'')}"></div>
    </div>
    <div class="form-group"><label>Preise</label>
      <div id="prices-list">${priceRows}</div>
      <button type="button" class="btn btn-sm btn-ghost" style="margin-top:6px;align-self:flex-start" onclick="addPriceRow()">+ Preis</button>
    </div>
    ${buildImageField(item?.image_url)}`;
}

function buildWinesForm(item) {
  const sectionOpts = state.wines.sections.map(s =>
    `<option value="${s.id}" ${item?.section_id===s.id?'selected':''}>${s.category}</option>`
  ).join('');
  const grapes = item && Array.isArray(item.grapes) ? item.grapes.join(', ') : '';
  return `
    <div class="form-row">
      <div class="form-group"><label>ID</label>
        <input type="text" id="f-id" value="${esc(item?.id||'')}" placeholder="z.B. arunda-brut" ${item?'readonly style="opacity:.5"':''}>
      </div>
      <div class="form-group"><label>Kategorie</label><select id="f-section">${sectionOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Name</label><input type="text" id="f-name" value="${esc(item?.name||'')}"></div>
      <div class="form-group"><label>Weingut</label><input type="text" id="f-winery" value="${esc(item?.winery||'')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Region</label><input type="text" id="f-region" value="${esc(item?.region||'')}"></div>
      <div class="form-group"><label>DOC</label><input type="text" id="f-doc" value="${esc(item?.doc||'')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Geschmack</label><input type="text" id="f-dryness" value="${esc(item?.dryness||'')}"></div>
      <div class="form-group"><label>Rebsorten (Komma)</label><input type="text" id="f-grapes" value="${esc(grapes)}"></div>
    </div>
    <div class="form-group"><label>Beschreibung DE</label><textarea id="f-desc-de">${esc(item?.description_de||'')}</textarea></div>
    <div class="form-group"><label>Beschreibung IT</label><textarea id="f-desc-it">${esc(item?.description_it||'')}</textarea></div>
    <div class="form-row-3">
      <div class="form-group"><label>Flasche €</label><input type="number" id="f-bottle" value="${item?.price_bottle??''}" step="0.50"></div>
      <div class="form-group"><label>Glas €</label><input type="number" id="f-glass" value="${item?.price_glass??''}" step="0.50"></div>
      <div class="form-group"><label>Karaffe €</label><input type="number" id="f-carafe" value="${item?.price_carafe??''}" step="0.50"></div>
    </div>
    ${buildImageField(item?.image_url)}`;
}

function buildImageField(imageUrl) {
  const preview = imageUrl
    ? `<img src="${imageUrl}" class="modal-img-preview" id="img-preview">`
    : `<div class="modal-img-placeholder" id="img-preview"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
  return `
    <div class="form-group img-upload-section"><label>Bild</label>
      <div class="img-preview-row">
        ${preview}
        <div class="img-url-group">
          <input type="text" id="f-image-url" value="${imageUrl||''}" placeholder="https://...">
          <label class="upload-btn-label"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Hochladen
            <input type="file" accept="image/*" hidden onchange="uploadImageInModal(this)">
          </label>
          <span class="upload-progress-text" id="upload-status"></span>
        </div>
      </div>
    </div>`;
}

// ── Save Item ────────────────────────────────────────────────
async function saveItem() {
  const { type, existing } = itemCtx;
  const isEdit = !!existing;
  const v = id => document.getElementById(id)?.value?.trim() || '';
  const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };

  let payload = {};
  if (type === 'menu') {
    payload = {
      id: v('f-id'), section_id: v('f-section'),
      name_de: v('f-name-de'), name_it: v('f-name-it'), name_en: v('f-name-en'),
      description_de: v('f-desc-de'), description_it: v('f-desc-it'), description_en: v('f-desc-en'),
      price: num('f-price') ?? 0,
      allergens: [...document.querySelectorAll('.allergen-chip.selected')].map(c => c.dataset.code),
      is_vegetarian: document.getElementById('f-veg')?.checked ? 1 : 0,
      is_vegan: document.getElementById('f-vegan')?.checked ? 1 : 0,
      image_url: v('f-image-url') || null,
    };
    if (!payload.id || !payload.section_id || !payload.name_de) return toast('ID, Kategorie und Name DE erforderlich', 'err');
  } else if (type === 'drinks') {
    const prices = [...document.querySelectorAll('#prices-list .price-row')]
      .map(r => ({ amount: r.querySelector('.price-amount')?.value?.trim()||'', price: parseFloat(r.querySelector('.price-val')?.value)||0 }))
      .filter(p => p.price > 0);
    payload = {
      id: v('f-id'), section_id: v('f-section'),
      name_de: v('f-name-de'), name_it: v('f-name-it'), name_en: v('f-name-en'),
      prices, image_url: v('f-image-url') || null,
    };
    if (!payload.id || !payload.section_id || !payload.name_de) return toast('ID, Kategorie und Name DE erforderlich', 'err');
  } else {
    const gStr = v('f-grapes');
    payload = {
      id: v('f-id'), section_id: v('f-section'),
      name: v('f-name'), winery: v('f-winery'), region: v('f-region'),
      doc: v('f-doc'), dryness: v('f-dryness'),
      grapes: gStr ? gStr.split(',').map(g=>g.trim()).filter(Boolean) : [],
      description_de: v('f-desc-de'), description_it: v('f-desc-it'),
      price_bottle: num('f-bottle'), price_glass: num('f-glass'), price_carafe: num('f-carafe'),
      image_url: v('f-image-url') || null,
    };
    if (!payload.id || !payload.section_id || !payload.name) return toast('ID, Kategorie und Name erforderlich', 'err');
  }

  try {
    await apiFetch(
      isEdit ? `/api/${type}/items/${payload.id}` : `/api/${type}/items`,
      { method: isEdit ? 'PUT' : 'POST', body: payload }
    );
    closeItemModal();
    toast('Gespeichert!', 'ok');
    if (type === 'menu') loadMenu();
    else if (type === 'drinks') loadDrinks();
    else loadWines();
    loadDashboard();
  } catch (e) { toast('Fehler: ' + e.message, 'err'); }
}

// ── Image Upload ─────────────────────────────────────────────
async function uploadImageInModal(input) {
  if (!input.files[0]) return;
  const statusEl = document.getElementById('upload-status');
  statusEl.textContent = 'Lädt...';
  const fd = new FormData();
  fd.append('image', input.files[0]);
  try {
    const r = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
    const data = await r.json();
    document.getElementById('f-image-url').value = data.url;
    const preview = document.getElementById('img-preview');
    if (preview.tagName === 'IMG') { preview.src = data.url; }
    else {
      const img = document.createElement('img');
      img.src = data.url; img.className = 'modal-img-preview'; img.id = 'img-preview';
      preview.replaceWith(img);
    }
    statusEl.textContent = '✓ Hochgeladen';
    toast('Bild hochgeladen!', 'ok');
  } catch (_) { statusEl.textContent = '✗ Fehler'; toast('Upload fehlgeschlagen', 'err'); }
}

// ── Prices ───────────────────────────────────────────────────
function addPriceRow() {
  const div = document.createElement('div');
  div.className = 'price-row';
  div.innerHTML = `<input type="text" placeholder="Menge" class="price-amount"><input type="number" placeholder="€" step="0.10" min="0" class="price-val"><button type="button" class="remove-price" onclick="removePriceRow(this)"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  document.getElementById('prices-list').appendChild(div);
}

function removePriceRow(btn) {
  const list = document.getElementById('prices-list');
  if (list.children.length > 1) btn.closest('.price-row').remove();
}

// ── Delete ───────────────────────────────────────────────────
async function deleteItem(type, collection, id, reload) {
  if (!confirm('Wirklich löschen?')) return;
  try {
    await apiFetch(`/api/${type}/${collection}/${id}`, { method: 'DELETE' });
    toast('Gelöscht', 'ok');
    reload();
    loadDashboard();
  } catch (e) { toast('Fehler: ' + e.message, 'err'); }
}

// ── Import Modal ─────────────────────────────────────────────
function openImportModal(type) {
  importCtx = { type };
  document.getElementById('import-modal-title').innerHTML =
    `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:text-bottom;margin-right:5px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Import — ${{menu:'Speisen',drinks:'Getränke',wines:'Weine'}[type]}`;
  document.getElementById('import-file-name').textContent = 'Keine Datei gewählt';
  document.getElementById('import-json-text').value = '';
  document.getElementById('import-modal-status').textContent = '';
  document.getElementById('import-modal-status').className = 'import-status';
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-modal-overlay').classList.add('open');
}

function closeImportModal() {
  document.getElementById('import-modal-overlay').classList.remove('open');
  importCtx = null;
}

function onImportFileChange(input) {
  const file = input.files[0];
  document.getElementById('import-file-name').textContent = file ? file.name : 'Keine Datei gewählt';
  if (file) file.text().then(t => { document.getElementById('import-json-text').value = t; });
}

async function doImport() {
  const { type } = importCtx;
  const text = document.getElementById('import-json-text').value.trim();
  const statusEl = document.getElementById('import-modal-status');
  if (!text) { statusEl.textContent = 'Kein JSON eingegeben'; statusEl.className = 'import-status err'; return; }
  let json;
  try { json = JSON.parse(text); }
  catch (e) { statusEl.textContent = '✗ JSON-Fehler: ' + e.message; statusEl.className = 'import-status err'; return; }
  try {
    const r = await apiFetch(`/api/import/${type}`, { method: 'POST', body: json });
    statusEl.textContent = `✓ ${r.sectionCount} Kategorien, ${r.itemCount} Einträge`;
    statusEl.className = 'import-status ok';
    toast('Import erfolgreich!', 'ok');
    if (type === 'menu') loadMenu();
    else if (type === 'drinks') loadDrinks();
    else loadWines();
    loadDashboard();
  } catch (e) { statusEl.textContent = '✗ ' + e.message; statusEl.className = 'import-status err'; }
}

// ── Section Modal ────────────────────────────────────────────
function openSectionModal(type) {
  sectionCtx = { type };
  document.getElementById('section-modal-title').textContent =
    `+ Kategorie — ${{menu:'Speisen',drinks:'Getränke',wines:'Weine'}[type]}`;
  let html = `
    <div class="form-row">
      <div class="form-group"><label>ID</label><input type="text" id="sec-id" placeholder="z.B. starters"></div>
      <div class="form-group"><label>Reihenfolge</label><input type="number" id="sec-order" value="0"></div>
    </div>`;
  if (type === 'menu' || type === 'drinks')
    html += `<div class="form-group"><label>Category Key</label><input type="text" id="sec-key" placeholder="z.B. starters"></div>`;
  if (type === 'menu')
    html += `
      <div class="form-row">
        <div class="form-group"><label>Icon (Ionicon)</label><input type="text" id="sec-icon" value="restaurant-outline"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Gradient Start</label><input type="text" id="sec-g1" value="#FFF0CC"></div>
        <div class="form-group"><label>Gradient End</label><input type="text" id="sec-g2" value="#FFD580"></div>
      </div>`;
  if (type === 'wines')
    html += `<div class="form-group"><label>Kategorie (sparkling / white / red)</label><input type="text" id="sec-key" placeholder="z.B. white"></div>`;
  document.getElementById('section-modal-body').innerHTML = html;
  document.getElementById('section-modal-overlay').classList.add('open');
}

function closeSectionModal() {
  document.getElementById('section-modal-overlay').classList.remove('open');
  sectionCtx = null;
}

async function saveSection() {
  const { type } = sectionCtx;
  const v = id => document.getElementById(id)?.value?.trim() || '';
  const id = v('sec-id');
  if (!id) return toast('ID erforderlich', 'err');
  let payload = {}, url = '';
  if (type === 'menu') {
    payload = { id, category_key: v('sec-key')||id, icon: v('sec-icon')||'restaurant-outline', gradient_start: v('sec-g1'), gradient_end: v('sec-g2'), sort_order: parseInt(v('sec-order'))||0 };
    url = '/api/menu/sections';
  } else if (type === 'drinks') {
    payload = { id, category_key: v('sec-key')||id, sort_order: parseInt(v('sec-order'))||0 };
    url = '/api/drinks/sections';
  } else {
    payload = { id, category: v('sec-key')||id, sort_order: parseInt(v('sec-order'))||0 };
    url = '/api/wines/sections';
  }
  try {
    await apiFetch(url, { method: 'POST', body: payload });
    closeSectionModal();
    toast('Kategorie erstellt!', 'ok');
    if (type === 'menu') loadMenu();
    else if (type === 'drinks') loadDrinks();
    else loadWines();
  } catch (e) { toast('Fehler: ' + e.message, 'err'); }
}

// ── Helpers ──────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = opts.auth || session.token || sessionStorage.getItem('campedel_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method: opts.method || 'GET', headers };
  if (opts.body) options.body = JSON.stringify(opts.body);
  const r = await fetch(`${API}${path}`, options);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || r.statusText);
  }
  return r.json();
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Settings & Tunnel Wizard ────────────────────────────────
let _wizLoginPoll = null;

function loadSettings() {
  document.getElementById('settings-api-url').textContent = window.location.origin + '/api';
  document.getElementById('settings-admin-url').textContent = window.location.origin + '/admin';
  refreshTunnelStatus();
}

async function refreshTunnelStatus() {
  try {
    const r = await apiFetch('/api/tunnel/status');
    _applyWizardState(r);
  } catch (e) {
    _wizSetStep(1, 'err', 'API nicht erreichbar');
    _wizSetStep(2, 'locked', '');
    _wizSetStep(3, 'locked', '');
  }
}

const _WIZ_ICONS = {
  done:    `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.12)" stroke="var(--green)"/><polyline points="7 12 10.5 15.5 17 9" stroke="var(--green)"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke="var(--accent-dark)"/></svg>`,
  waiting: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke="#f59e0b"/><polyline points="12 7 12 12 15.5 14" stroke="#f59e0b"/></svg>`,
  locked:  `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke="var(--text3)"/></svg>`,
  err:     `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke="var(--red)"/><line x1="8" y1="8" x2="16" y2="16" stroke="var(--red)"/><line x1="16" y1="8" x2="8" y2="16" stroke="var(--red)"/></svg>`,
};

function _wizSetStep(num, state, desc) {
  const icon  = document.getElementById(`wiz-icon-${num}`);
  const descEl = document.getElementById(`wiz-desc-${num}`);
  if (icon)   icon.innerHTML = _WIZ_ICONS[state] || _WIZ_ICONS.locked;
  if (descEl) descEl.textContent = desc;
}

function _wizShowBtn(num, visible) {
  const btn = document.getElementById(`wiz-btn-${num}`);
  if (btn) btn.style.display = visible ? '' : 'none';
}

function _wizShow(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

function _applyWizardState(r) {
  // Step 1: installed?
  if (r.installed) {
    _wizSetStep(1, 'done', 'cloudflared ist installiert und bereit.');
    _wizShowBtn(1, false);
  } else {
    _wizSetStep(1, 'pending', 'cloudflared ist nicht installiert.');
    _wizShowBtn(1, true);
  }

  // Step 2: authenticated?
  if (r.authenticated) {
    _wizSetStep(2, 'done', 'Bereits mit deinem Cloudflare-Account verbunden.');
    _wizShowBtn(2, false);
    _wizShow('wiz-auth-box', false);
    _wizStopLoginPoll();
  } else if (r.loginUrl) {
    _wizSetStep(2, 'waiting', 'Warte auf Browser-Bestätigung...');
    _wizShowBtn(2, false);
    const el = document.getElementById('wiz-auth-url');
    el.textContent = r.loginUrl;
    el.href = r.loginUrl;
    _wizShow('wiz-auth-box', true);
    _wizStartLoginPoll();
  } else if (r.installed) {
    _wizSetStep(2, 'pending', 'Noch nicht mit Cloudflare verbunden.');
    _wizShowBtn(2, true);
    _wizShow('wiz-auth-box', false);
  } else {
    _wizSetStep(2, 'locked', '');
    _wizShowBtn(2, false);
    _wizShow('wiz-auth-box', false);
  }

  // Step 3: configured & running?
  const tunnelUrl = r.url || (r.hostname ? `https://${r.hostname}` : null);
  if (r.configured && r.running) {
    _wizSetStep(3, 'done', 'Tunnel ist aktiv' + (tunnelUrl ? ':' : '.'));
    const linkEl = document.getElementById('wiz-tunnel-url');
    if (tunnelUrl && linkEl) {
      linkEl.textContent = tunnelUrl;
      linkEl.href = tunnelUrl;
      linkEl.style.display = '';
    }
    _wizShow('wiz-configure-row', false);
    _wizShow('wiz-reconfigure-row', true);
    if (r.hostname) document.getElementById('wiz-reconfigure-hostname').value = r.hostname;
  } else if (r.configured) {
    _wizSetStep(3, 'waiting', 'Tunnel startet...' + (r.hostname ? ` (${r.hostname})` : ''));
    _wizShow('wiz-configure-row', false);
    _wizShow('wiz-reconfigure-row', true);
    const linkEl = document.getElementById('wiz-tunnel-url');
    if (linkEl) linkEl.style.display = 'none';
    if (r.hostname) document.getElementById('wiz-reconfigure-hostname').value = r.hostname;
  } else if (r.authenticated) {
    _wizSetStep(3, 'pending', 'Hostname eingeben um Tunnel einzurichten.');
    _wizShow('wiz-configure-row', true);
    _wizShow('wiz-reconfigure-row', false);
    const linkEl = document.getElementById('wiz-tunnel-url');
    if (linkEl) linkEl.style.display = 'none';
  } else {
    _wizSetStep(3, 'locked', '');
    _wizShow('wiz-configure-row', false);
    _wizShow('wiz-reconfigure-row', false);
    const linkEl = document.getElementById('wiz-tunnel-url');
    if (linkEl) linkEl.style.display = 'none';
  }

  // Quick tunnel info (no account needed, URL shown as bonus)
  if (r.mode === 'quick' && r.url && !r.configured) {
    _wizSetStep(3, 'waiting', `Quick Tunnel aktiv: ${r.url}`);
  }
}

function _wizStartLoginPoll() {
  if (_wizLoginPoll) return;
  _wizLoginPoll = setInterval(async () => {
    try {
      const r = await apiFetch('/api/tunnel/login-check');
      if (r.done) {
        _wizStopLoginPoll();
        refreshTunnelStatus();
      } else if (r.loginUrl) {
        const el = document.getElementById('wiz-auth-url');
        el.textContent = r.loginUrl;
        el.href = r.loginUrl;
        _wizShow('wiz-auth-box', true);
      }
    } catch {}
  }, 3000);
}

function _wizStopLoginPoll() {
  if (_wizLoginPoll) { clearInterval(_wizLoginPoll); _wizLoginPoll = null; }
}

async function wizInstall() {
  _wizSetStep(1, 'waiting', 'Installiere cloudflared...');
  _wizShowBtn(1, false);
  try {
    await apiFetch('/api/tunnel/install', { method: 'POST', body: {} });
    toast('cloudflared installiert!', 'ok');
    refreshTunnelStatus();
  } catch (e) {
    toast('Fehler: ' + e.message, 'err');
    _wizSetStep(1, 'err', e.message);
    _wizShowBtn(1, true);
  }
}

async function wizLogin() {
  _wizSetStep(2, 'waiting', 'Starte Login-Prozess...');
  _wizShowBtn(2, false);
  try {
    const r = await apiFetch('/api/tunnel/login', { method: 'POST', body: {} });
    if (r.already) { refreshTunnelStatus(); return; }
    if (r.loginUrl) {
      const el = document.getElementById('wiz-auth-url');
      el.textContent = r.loginUrl;
      el.href = r.loginUrl;
      _wizShow('wiz-auth-box', true);
      _wizSetStep(2, 'waiting', 'Warte auf Browser-Bestätigung...');
    } else {
      _wizSetStep(2, 'waiting', 'Login gestartet — URL erscheint gleich...');
    }
    _wizStartLoginPoll();
  } catch (e) {
    toast('Fehler: ' + e.message, 'err');
    _wizSetStep(2, 'err', e.message);
    _wizShowBtn(2, true);
  }
}

async function wizConfigure() {
  const hostname = document.getElementById('wiz-hostname').value.trim();
  if (!hostname) { toast('Bitte Hostname eingeben', 'err'); return; }
  _wizSetStep(3, 'waiting', 'Konfiguriere Tunnel...');
  _wizShow('wiz-configure-row', false);
  try {
    const r = await apiFetch('/api/tunnel/configure', { method: 'POST', body: { hostname } });
    toast(r.dnsOk ? 'Tunnel konfiguriert!' : 'Tunnel konfiguriert (DNS bitte manuell prüfen)', 'ok');
    refreshTunnelStatus();
  } catch (e) {
    toast('Fehler: ' + e.message, 'err');
    _wizSetStep(3, 'err', e.message);
    _wizShow('wiz-configure-row', true);
  }
}

async function wizReconfigure() {
  const hostname = document.getElementById('wiz-reconfigure-hostname').value.trim();
  if (!hostname) { toast('Bitte Hostname eingeben', 'err'); return; }
  try {
    const r = await apiFetch('/api/tunnel/reconfigure', { method: 'POST', body: { hostname } });
    toast(r.dnsOk ? 'Tunnel neu konfiguriert!' : 'Konfiguriert (DNS bitte prüfen)', 'ok');
    refreshTunnelStatus();
  } catch (e) {
    toast('Fehler: ' + e.message, 'err');
  }
}

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 3200);
}
