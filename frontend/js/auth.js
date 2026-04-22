/* ── auth.js — shared across all pages ─────────────────────── */

const BASE_URL = (window.location.hostname === 'localhost' && window.location.port !== '5000' && window.location.port !== '') 
  ? 'http://localhost:5000' 
  : '';

function getToken() { return localStorage.getItem('mms_token'); }
function getUser()  { try { return JSON.parse(localStorage.getItem('mms_user')); } catch { return null; } }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function logout() {
  localStorage.removeItem('mms_token');
  localStorage.removeItem('mms_user');
  location.href = '/login.html';
}

function requireAuth() {
  if (!getToken()) { location.href = '/login.html'; }
}

function requireAdmin() {
  const u = getUser();
  if (!getToken() || !u || u.role !== 'admin') { location.href = '/login.html'; }
}

function updateNav() {
  const token = getToken();
  const user  = getUser();
  const login    = document.getElementById('nav-login');
  const register = document.getElementById('nav-register');
  const logout_  = document.getElementById('nav-logout');
  const navUser  = document.getElementById('nav-user');
  const navOrders = document.getElementById('nav-orders');
  const navAdmin  = document.getElementById('nav-admin');
  const navProfile = document.getElementById('nav-profile');

  if (token && user) {
    if (login)    login.style.display    = 'none';
    if (register) register.style.display = 'none';
    if (logout_)  logout_.style.display  = 'inline-flex';
    if (navUser)  { navUser.style.display = 'inline'; navUser.textContent = `Hi, ${user.name.split(' ')[0]}`; }
    if (navOrders && user.role === 'user')  navOrders.style.display = 'inline-flex';
    if (navAdmin  && user.role === 'admin') navAdmin.style.display  = 'inline-flex';
    if (navProfile) navProfile.style.display = 'inline-flex';
  }
}

/* ── Toast notifications ──────────────────────────────────── */
function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}
