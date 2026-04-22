/* ── User Notifications Engine ── */

document.addEventListener('DOMContentLoaded', () => {
  // Only inject if user is logged in
  if (!getToken()) return;

  // Inject the notification panel HTML
  const panelHtml = `
    <!-- Notifications Slide Panel -->
    <div id="userNotifPanel" style="display:none;position:fixed;top:0;right:0;width:380px;max-width:100%;height:100vh;background:rgba(15, 17, 26, 0.5);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);border-left:1px solid rgba(255,255,255,0.08);z-index:9999;overflow-y:auto;box-shadow:-10px 0 40px rgba(0,0,0,.6), inset 1px 0 0 rgba(255,255,255,0.05);transform:translateX(100%);transition:transform 0.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.5s ease">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:1.2rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.05);position:sticky;top:0;background:rgba(15, 17, 26, 0.3);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:1">
        <h3 style="font-size:1rem;font-weight:700">🔔 Alerts</h3>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-secondary btn-sm" onclick="markUserNotifsRead()">Mark all read</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleUserNotifPanel()">✕</button>
        </div>
      </div>
      <div id="userNotifList" style="padding:1rem"></div>
    </div>
    <div id="userNotifOverlay" onclick="toggleUserNotifPanel()" style="display:none;position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.4)"></div>
  `;
  document.body.insertAdjacentHTML('beforeend', panelHtml);

  // Initialize notifications
  loadUserNotifs();
  
  // Show bell if it exists
  const bell = document.getElementById('userNotifBell');
  if (bell) bell.style.display = 'flex';
});

window.toggleUserNotifPanel = async function() {
  const panel = document.getElementById('userNotifPanel');
  const overlay = document.getElementById('userNotifOverlay');
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    overlay.style.display = 'block';
    setTimeout(() => { panel.style.transform = 'translateX(0)'; }, 10);
    await loadUserNotifs();
  } else {
    panel.style.transform = 'translateX(100%)';
    setTimeout(() => { panel.style.display = 'none'; overlay.style.display = 'none'; }, 300);
  }
};

async function loadUserNotifs() {
  try {
    const data = await fetch('/api/notifications', { headers: authHeaders() }).then(r => r.json());
    const list = document.getElementById('userNotifList');
    const badge = document.getElementById('userNotifBadge');
    
    if (!data.notifications || !data.notifications.length) {
      if (list) list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem 0">No new alerts.</p>';
      if (badge) badge.style.display = 'none';
      return;
    }
    
    const unreadCount = data.notifications.filter(n => !n.is_read).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (list) {
      list.innerHTML = data.notifications.map((n, i) => `
        <div class="notif-item" style="background:${n.is_read ? 'rgba(255,255,255,0.02)' : 'rgba(139,92,246,.15)'};backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid ${n.is_read ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,.3)'};border-radius:12px;padding:1rem;margin-bottom:.75rem;box-shadow:0 4px 15px rgba(0,0,0,0.2);animation:fadeSlideIn 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards;opacity:0;transform:translateX(20px);animation-delay:${i * 0.08}s;transition:transform 0.2s, background 0.2s;cursor:default;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem">
            <span style="font-weight:700;font-size:.88rem;color:${n.is_read ? 'var(--muted2)' : '#c4b5fd'}">${n.title}</span>
            ${!n.is_read ? '<span style="width:7px;height:7px;background:#8b5cf6;border-radius:50%;display:inline-block;flex-shrink:0;margin-top:4px;box-shadow:0 0 8px #8b5cf6"></span>' : ''}
          </div>
          <p style="font-size:.82rem;color:var(--muted2);margin-bottom:.4rem;line-height:1.5">${n.message}</p>
          <span style="font-size:.72rem;color:var(--muted)">${new Date(n.created_at).toLocaleString('en-IN')}</span>
        </div>`).join('');
    }
  } catch (err) {
    console.error('Error loading user notifications:', err);
  }
}

window.markUserNotifsRead = async function() {
  try {
    await fetch('/api/notifications/read', { method: 'PATCH', headers: authHeaders() });
    const badge = document.getElementById('userNotifBadge');
    if (badge) badge.style.display = 'none';
    loadUserNotifs();
  } catch (err) {
    console.error('Error marking as read:', err);
  }
};
