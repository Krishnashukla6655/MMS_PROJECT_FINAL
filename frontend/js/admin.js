/* ── admin.js — Admin Dashboard Logic ────────────────────────── */

requireAdmin();
const user = getUser();
if (user) {
  const el = document.getElementById('adminName');
  if (el) el.textContent = `${user.name} (${user.role})`;
}

function showPanel(name, linkEl) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  if (linkEl) linkEl.classList.add('active');

  if (name === 'overview')   loadOverview();
  if (name === 'products')   loadProducts();
  if (name === 'orders')     loadOrders();
  if (name === 'users')      loadUsers();
  if (name === 'employees')  { loadDepartments(); loadEmployees(); loadAttStats(); }
}

/* ── OVERVIEW ── */
async function loadOverview() {
  try {
    const [prods, orders, users, contacts] = await Promise.all([
      fetch('/api/products', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/orders',   { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/users',    { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/admin/contact-stats', { headers: authHeaders() }).then(r => r.json()),
    ]);
    document.getElementById('stat-products').textContent = prods.length;
    document.getElementById('stat-orders').textContent   = orders.length;
    document.getElementById('stat-users').textContent    = users.length;
    document.getElementById('stat-contacts').textContent = contacts.total || 0;
    const rev = orders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
    document.getElementById('stat-revenue').textContent  = '₹' + rev.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const tbody = document.getElementById('recentOrders');
    const recent = orders.slice(0, 6);
    if (!recent.length) { tbody.innerHTML = '<p style="color:var(--muted);font-size:.88rem">No orders yet.</p>'; return; }
    tbody.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Conf #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${recent.map(o => `
          <tr>
            <td style="font-family:monospace;font-size:.8rem">${o.confirmation_number}</td>
            <td>${o.user_name}<br/><span style="color:var(--muted);font-size:.75rem">${o.email}</span></td>
            <td style="color:var(--secondary);font-weight:600">₹${parseFloat(o.total_amount).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
            <td><span class="status-badge status-${o.status}">${o.status}</span></td>
            <td style="font-size:.8rem;color:var(--muted2)">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch(e) { showToast('Failed to load overview', 'error'); }
}

/* ── PRODUCTS ── */
async function loadProducts() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = '<tr><td colspan="6"><div class="spinner"></div></td></tr>';
  try {
    const res   = await fetch('/api/products', { headers: authHeaders() });
    const prods = await res.json();
    if (!prods.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No products found</td></tr>';
      return;
    }
    tbody.innerHTML = prods.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.category || '—'}</td>
        <td style="color:var(--secondary);font-weight:600">₹${parseFloat(p.price).toLocaleString('en-IN')}</td>
        <td>${p.min_bulk_qty} ${p.unit}</td>
        <td>
          <span class="stock-badge ${p.stock_quantity===0?'stock-out':p.stock_quantity<100?'stock-low':'stock-ok'}">
            ${p.stock_quantity.toLocaleString()}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openEdit(${p.id})">✏️ Edit</button>
        </td>
      </tr>`).join('');
  } catch(e) { showToast('Failed to load products', 'error'); }
}

/* ── ADD PRODUCT ── */
async function submitProduct(e) {
  e.preventDefault();
  const btn = document.getElementById('addProductBtn');
  const msg = document.getElementById('addProductMsg');
  msg.innerHTML = '';
  btn.disabled = true; btn.textContent = 'Adding…';

  const form = document.getElementById('addProductForm');
  const fd   = new FormData(form);

  try {
    const res  = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    msg.innerHTML = '<p class="form-success">✅ Product added successfully!</p>';
    form.reset();
    showToast('Product added!', 'success');
  } catch(err) {
    msg.innerHTML = `<p class="form-error">⚠ ${err.message}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Add Product';
  }
}

/* ── EDIT PRODUCT ── */
let editingId = null;

async function openEdit(id) {
  editingId = id;
  document.getElementById('editMsg').innerHTML = '';
  try {
    const res = await fetch(`/api/products/${id}`, { headers: authHeaders() });
    const p   = await res.json();
    document.getElementById('editId').value      = p.id;
    document.getElementById('editName').value    = p.name;
    document.getElementById('editCat').value     = p.category  || '';
    document.getElementById('editDesc').value    = p.description || '';
    document.getElementById('editPrice').value   = p.price;
    document.getElementById('editUnit').value    = p.unit;
    document.getElementById('editMinBulk').value = p.min_bulk_qty;
    document.getElementById('editStock').value   = p.stock_quantity;
    document.getElementById('editModal').classList.add('show');
  } catch { showToast('Failed to load product', 'error'); }
}

function closeEdit() {
  document.getElementById('editModal').classList.remove('show');
  editingId = null;
}

async function saveEdit(e) {
  e.preventDefault();
  const id  = editingId;
  const msg = document.getElementById('editMsg');
  msg.innerHTML = '';
  const fd  = new FormData(document.getElementById('editForm'));
  try {
    const res  = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast('Product updated!', 'success');
    closeEdit();
    loadProducts();
  } catch(err) {
    msg.innerHTML = `<p class="form-error">⚠ ${err.message}</p>`;
  }
}

async function addStock() {
  const qty = parseInt(document.getElementById('addStockQty').value);
  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
  try {
    const res  = await fetch(`/api/products/${editingId}/add-stock`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ quantity: qty })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    document.getElementById('editStock').value = data.newStock;
    document.getElementById('addStockQty').value = '';
    showToast(`Stock updated! New total: ${data.newStock}`, 'success');
  } catch(err) { showToast(err.message, 'error'); }
}

async function deleteProduct() {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/products/${editingId}`, {
      method: 'DELETE', headers: authHeaders()
    });
    if (!res.ok) throw new Error((await res.json()).message);
    showToast('Product deleted', 'info');
    closeEdit();
    loadProducts();
  } catch(err) { showToast(err.message, 'error'); }
}

/* ── ORDERS ── */
const ORDER_STATUSES = ['confirmed','processing','shipped','delivered','cancelled'];

async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = '<tr><td colspan="7"><div class="spinner"></div></td></tr>';
  try {
    const res    = await fetch('/api/orders', { headers: authHeaders() });
    const orders = await res.json();
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No orders yet</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr id="order-row-${o.id}">
        <td style="font-family:monospace;font-size:.78rem">${o.confirmation_number}</td>
        <td>
          ${o.user_name} <span style="font-size:.75rem; color:var(--muted)">(${o.phone_number || 'N/A'})</span><br/>
          <span style="color:var(--muted);font-size:.75rem">${o.email}</span><br/>
          <span style="color:var(--muted2);font-size:.7rem;display:inline-block;max-width:200px;line-height:1.2;margin-top:4px;">📍 ${o.shipping_address || 'No address provided'}</span>
        </td>
        <td>${o.item_count}</td>
        <td style="color:var(--secondary);font-weight:600">
          ₹${parseFloat(o.total_amount).toLocaleString('en-IN',{minimumFractionDigits:2})}<br/>
          <span style="font-size:.65rem; padding: 2px 5px; background: rgba(139,92,246,.2); color: #a78bfa; border-radius: 4px; text-transform: uppercase; margin-top: 4px; display: inline-block;">💳 ${o.payment_method || 'COD'}</span>
        </td>
        <td><span class="status-badge status-${o.status}" id="admin-status-${o.id}">${o.status}</span></td>
        <td style="font-size:.8rem;color:var(--muted2)">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
        <td style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
          <select class="form-control" style="padding:.3rem .5rem;font-size:.78rem;width:auto" id="sel-${o.id}">
            ${ORDER_STATUSES.map(s => `<option value="${s}" ${s===o.status?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${o.id})">Update</button>
          ${o.status !== 'cancelled' ? `<button class="btn btn-danger btn-sm" onclick="adminCancelOrder(${o.id})">✕ Cancel</button>` : ''}
        </td>
      </tr>`).join('');
  } catch { showToast('Failed to load orders', 'error'); }
}

async function updateOrderStatus(id) {
  const sel    = document.getElementById(`sel-${id}`);
  const status = sel.value;
  try {
    const res  = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(`Status updated to "${status}"`, 'success');
    const badge = document.getElementById(`admin-status-${id}`);
    if (badge) { badge.className = `status-badge status-${status}`; badge.textContent = status; }
    if (status === 'cancelled') {
      const row = document.getElementById(`order-row-${id}`);
      if (row) { const cancelBtn = row.querySelector('.btn-danger'); if(cancelBtn) cancelBtn.remove(); }
    }
    
    // Dynamically update profit metrics if we are on the dashboard
    if (typeof loadProfitData === 'function') {
      loadProfitData();
    }
  } catch(err) { showToast(err.message, 'error'); }
}

async function adminCancelOrder(id) {
  if (!confirm('Cancel this order? Stock will be restored.')) return;
  await updateOrderStatus_direct(id, 'cancelled');
}

async function updateOrderStatus_direct(id, status) {
  try {
    const res  = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(`Order cancelled. Stock restored.`, 'success');
    loadOrders();
    if (typeof loadProfitData === 'function') {
      loadProfitData();
    }
  } catch(err) { showToast(err.message, 'error'); }
}

/* ── USERS ── */
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="5"><div class="spinner"></div></td></tr>';
  try {
    const res   = await fetch('/api/users', { headers: authHeaders() });
    const users = await res.json();
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No users found</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="color:var(--muted)">#${u.id}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>
          <span class="status-badge ${u.role==='admin'?'status-processing':'status-confirmed'}">
            ${u.role}
          </span>
        </td>
        <td style="font-size:.8rem;color:var(--muted2)">${new Date(u.created_at).toLocaleDateString('en-IN')}</td>
      </tr>`).join('');
  } catch { showToast('Failed to load users', 'error'); }
}

// Load overview on start
loadOverview();
// Poll notifications every 30s
loadNotifCount();
setInterval(loadNotifCount, 30000);

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEES & ATTENDANCE
═══════════════════════════════════════════════════════════════ */
let empCurrentPage = 1;
let empDebounceTimer = null;

async function loadDepartments() {
  try {
    const depts = await fetch('/api/attendance/departments', { headers: authHeaders() }).then(r => r.json());
    const sel   = document.getElementById('deptFilter');
    sel.innerHTML = '<option value="all">All Departments</option>';
    depts.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
  } catch {}
}

async function loadAttStats() {
  try {
    const s = await fetch('/api/attendance/stats', { headers: authHeaders() }).then(r => r.json());
    document.getElementById('att-total').textContent    = s.total;
    document.getElementById('att-present').textContent  = s.present;
    document.getElementById('att-absent').textContent   = s.absent;
    document.getElementById('att-unmarked').textContent = s.unmarked;
  } catch {}
}

function debounceEmpLoad() {
  clearTimeout(empDebounceTimer);
  empDebounceTimer = setTimeout(() => { empCurrentPage = 1; loadEmployees(); }, 400);
}

async function loadEmployees(page = empCurrentPage) {
  empCurrentPage = page;
  const tbody  = document.getElementById('empTableBody');
  tbody.innerHTML = '<tr><td colspan="9"><div class="spinner"></div></td></tr>';
  const search = document.getElementById('empSearch').value.trim();
  const dept   = document.getElementById('deptFilter').value;
  const limit  = 50;
  const params = new URLSearchParams({ page, limit, search, department: dept });

  try {
    const data = await fetch(`/api/attendance/employees?${params}`, { headers: authHeaders() }).then(r => r.json());
    const { employees, total } = data;

    if (!employees.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted)">No employees found</td></tr>';
      return;
    }

    tbody.innerHTML = employees.map(e => {
      const statusClass = e.today_status === 'present' ? 'stock-ok' : e.today_status === 'absent' ? 'stock-out' : '';
      const statusLabel = e.today_status ? e.today_status.charAt(0).toUpperCase() + e.today_status.slice(1) : '—';
      return `
        <tr id="emp-row-${e.id}">
          <td style="font-family:monospace;font-size:.8rem">${e.emp_code}</td>
          <td><strong>${e.name}</strong></td>
          <td><span style="font-size:.78rem;background:rgba(99,102,241,.1);padding:.2rem .5rem;border-radius:6px;color:#a5b4fc">${e.department}</span></td>
          <td style="font-size:.82rem;color:var(--muted2)">${e.designation}</td>
          <td>₹${parseFloat(e.base_salary).toLocaleString('en-IN')}</td>
          <td style="color:var(--secondary);font-weight:700">+₹${parseFloat(e.daily_bonus).toFixed(2)}</td>
          <td style="color:#10b981;font-weight:700">₹${parseFloat(e.effective_salary).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td><span class="stock-badge ${statusClass}">${statusLabel}</span></td>
          <td style="display:flex;gap:.4rem">
            <button class="btn btn-primary btn-sm" onclick="markEmp(${e.id},'present')">✅</button>
            <button class="btn btn-danger  btn-sm" onclick="markEmp(${e.id},'absent')">❌</button>
          </td>
        </tr>`;
    }).join('');

    // Pagination
    const totalPages = Math.ceil(total / limit);
    const pagDiv = document.getElementById('empPagination');
    pagDiv.innerHTML = '';
    for (let p = 1; p <= totalPages; p++) {
      const btn = document.createElement('button');
      btn.textContent = p;
      btn.className   = `btn btn-sm ${p === empCurrentPage ? 'btn-primary' : 'btn-secondary'}`;
      btn.onclick     = () => loadEmployees(p);
      pagDiv.appendChild(btn);
    }
  } catch(e) { showToast('Failed to load employees', 'error'); }
}

async function markEmp(id, status) {
  try {
    const res  = await fetch('/api/attendance/mark', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ employee_id: id, status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(`${data.employee} → ${status}`, status === 'present' ? 'success' : 'error');
    loadEmployees();
    loadAttStats();
    loadNotifCount();
  } catch(err) { showToast(err.message, 'error'); }
}

async function markAllDept(status) {
  const dept   = document.getElementById('deptFilter').value;
  const search = document.getElementById('empSearch').value.trim();
  const label  = dept === 'all' ? 'ALL employees' : `${dept} department`;
  if (!confirm(`Mark ${label} as ${status.toUpperCase()}?`)) return;

  // Fetch all IDs for current filter (no pagination limit)
  const params = new URLSearchParams({ page: 1, limit: 999, search, department: dept });
  try {
    const data    = await fetch(`/api/attendance/employees?${params}`, { headers: authHeaders() }).then(r => r.json());
    const records = data.employees.map(e => ({ employee_id: e.id, status }));
    const res     = await fetch('/api/attendance/mark-bulk', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ records })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message);
    showToast(`Bulk marked: ${result.present} present, ${result.absent} absent`, 'success');
    loadEmployees();
    loadAttStats();
    loadNotifCount();
  } catch(err) { showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════════════ */
async function loadNotifCount() {
  try {
    const data  = await fetch('/api/attendance/notifications', { headers: authHeaders() }).then(r => r.json());
    const badge = document.getElementById('notifBadge');
    if (data.unread_count > 0) {
      badge.style.display = 'inline-block';
      badge.textContent   = data.unread_count > 99 ? '99+' : data.unread_count;
    } else {
      badge.style.display = 'none';
    }
  } catch {}
}

async function toggleNotifPanel() {
  const panel   = document.getElementById('notifPanel');
  const overlay = document.getElementById('notifOverlay');
  if (panel.style.display === 'none') {
    panel.style.display   = 'block';
    overlay.style.display = 'block';
    setTimeout(() => { panel.style.transform = 'translateX(0)'; }, 10);
    await loadNotifs();
  } else {
    closeNotifPanel();
  }
}

function closeNotifPanel() {
  const panel   = document.getElementById('notifPanel');
  const overlay = document.getElementById('notifOverlay');
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => { panel.style.display = 'none'; overlay.style.display = 'none'; }, 300);
}

async function loadNotifs() {
  try {
    const data = await fetch('/api/attendance/notifications', { headers: authHeaders() }).then(r => r.json());
    const list = document.getElementById('notifList');
    if (!data.notifications.length) {
      list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem 0">No notifications yet</p>';
      return;
    }
    list.innerHTML = data.notifications.map((n, i) => `
      <div class="notif-item" style="background:${n.is_read ? 'rgba(255,255,255,0.02)' : 'rgba(139,92,246,.15)'};backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid ${n.is_read ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,.3)'};border-radius:12px;padding:1rem;margin-bottom:.75rem;box-shadow:0 4px 15px rgba(0,0,0,0.2);animation:fadeSlideIn 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards;opacity:0;transform:translateX(20px);animation-delay:${i * 0.08}s;transition:transform 0.2s, background 0.2s;cursor:default;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem">
          <span style="font-weight:700;font-size:.88rem;color:${n.is_read ? 'var(--muted2)' : '#c4b5fd'}">${n.title}</span>
          ${!n.is_read ? '<span style="width:7px;height:7px;background:#8b5cf6;border-radius:50%;display:inline-block;flex-shrink:0;margin-top:4px;box-shadow:0 0 8px #8b5cf6"></span>' : ''}
        </div>
        <p style="font-size:.82rem;color:var(--muted2);margin-bottom:.4rem;line-height:1.5">${n.message}</p>
        <span style="font-size:.72rem;color:var(--muted)">${new Date(n.created_at).toLocaleString('en-IN')}</span>
      </div>`).join('');
  } catch {}
}

async function markNotifsRead() {
  try {
    await fetch('/api/attendance/notifications/read', { method: 'PATCH', headers: authHeaders() });
    document.getElementById('notifBadge').style.display = 'none';
    loadNotifs();
    showToast('All notifications marked as read', 'success');
  } catch {}
}
