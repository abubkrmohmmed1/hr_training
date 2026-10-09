/**
 * Notifications component: dropdown menu, count badge, and read handlers.
 */
import { API } from './api.js';
import { $, escapeHtml, icon } from './ui.js';

export async function initNotifications() {
  const container = $('.header-left');
  if (!container || $('#notif-dropdown-wrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'notif-dropdown-wrap';
  wrap.className = 'notif-wrap';
  wrap.innerHTML = `
    <button class="btn btn-ghost notif-bell-btn" id="notif-bell" type="button" aria-label="الإشعارات">
      ${icon('bell')}
      <span class="notif-badge" id="notif-badge" style="display:none">0</span>
    </button>
    <div class="notif-dropdown" id="notif-dropdown">
      <div class="notif-dropdown-header">
        <strong>الإشعارات</strong>
        <button class="btn btn-ghost btn-sm" id="notif-read-all" type="button">تحديد الكل كمقروء</button>
      </div>
      <div class="notif-dropdown-body" id="notif-list">
        <div class="empty-state"><p>جارٍ التحميل...</p></div>
      </div>
    </div>
  `;

  container.prepend(wrap);

  const bell = $('#notif-bell');
  const dropdown = $('#notif-dropdown');
  const badge = $('#notif-badge');
  const list = $('#notif-list');

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
      loadNotifications();
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  $('#notif-read-all')?.addEventListener('click', async () => {
    await API.markAllNotificationsRead();
    await loadNotifications();
  });

  async function loadNotifications() {
    try {
      const items = await API.notifications();
      const unreadCount = items.filter((n) => !n.is_read).length;
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }

      if (!items.length) {
        list.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>لا توجد إشعارات حالياً</p></div>';
        return;
      }

      list.innerHTML = items.map((n) => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
          <div class="notif-title">${escapeHtml(n.title)}</div>
          <div class="notif-message">${escapeHtml(n.message)}</div>
          <div class="notif-time">${n.created_at ? new Date(n.created_at).toLocaleString('ar-SA') : ''}</div>
        </div>
      `).join('');

      list.querySelectorAll('.notif-item').forEach((el) => {
        el.addEventListener('click', async () => {
          const id = el.dataset.id;
          const link = el.dataset.link;
          await API.markNotificationRead(id).catch(() => null);
          if (link) window.location.href = link;
          else loadNotifications();
        });
      });
    } catch {
      list.innerHTML = '<div class="empty-state"><p>تعذر تحميل الإشعارات</p></div>';
    }
  }

  // Initial count load
  loadNotifications();
}
