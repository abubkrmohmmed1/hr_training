const API_BASE = '/api';

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 4.13a4 4 0 0 1 0 7.75"/></svg>',
  skills: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  course: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19h16M7 16V9M12 16V5M17 16v-7"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l2 2 4-4"/><path d="M5 4h14a1 1 0 0 1 1 1v16l-4-2-4 2-4-2-4 2V5a1 1 0 0 1 1-1z"/></svg>',
  assess: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 4v16"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
};

const Auth = {
  getUser() { return JSON.parse(localStorage.getItem('user') || 'null'); },
  setSession(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('user');
  },
  isLoggedIn() { return !!this.getUser(); },
  logout() {
    api('/auth/logout', { method: 'POST' }).catch(() => null);
    this.clear();
    window.location.href = '/index.html';
  },
  requireAuth() {
    if (!this.isLoggedIn()) window.location.href = '/index.html';
  },
  redirectToDashboard() {
    const user = this.getUser();
    if (!user) return;
    const routes = { admin: '/admin.html', hr: '/hr.html', manager: '/manager.html', employee: '/employee.html' };
    window.location.href = routes[user.role] || '/employee.html';
  }
};

async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = document.cookie.split('; ').find((value) => value.startsWith('csrf_token='))?.split('=')[1];
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'same-origin' });
  if (res.status === 401) {
    Auth.clear();
    window.location.href = '/index.html';
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'خطأ في الاتصال' }));
    const detail = Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail;
    throw new Error(detail || 'خطأ في الخادم');
  }
  return res.json();
}

const API = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => api('/auth/me'),
  adminStats: () => api('/dashboard/admin'),
  hrStats: () => api('/dashboard/hr'),
  employeeStats: () => api('/dashboard/employee'),
  employees: () => api('/employees'),
  employee: (id) => api(`/employees/${id}`),
  createEmployee: (data) => api('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => api(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  myProfile: () => api('/employees/me/profile'),
  teamMembers: () => api('/employees/team/members'),
  users: () => api('/users'),
  departments: () => api('/departments'),
  createDepartment: (data) => api('/departments', { method: 'POST', body: JSON.stringify(data) }),
  skills: () => api('/skills'),
  createSkill: (data) => api('/skills', { method: 'POST', body: JSON.stringify(data) }),
  employeeSkills: (empId) => api(`/employees/${empId}/skills`),
  assessments: (empId) => api(`/assessments${empId ? '?employee_id=' + empId : ''}`),
  createAssessment: (data) => api('/assessments', { method: 'POST', body: JSON.stringify(data) }),
  courses: () => api('/courses'),
  createCourse: (data) => api('/courses', { method: 'POST', body: JSON.stringify(data) }),
  course: (id) => api(`/courses/${id}`),
  favorites: () => api('/courses/favorites/me'),
  toggleFavorite: (id) => api(`/courses/${id}/favorite`, { method: 'POST' }),
  courseReviews: (id) => api(`/courses/${id}/reviews`),
  createCourseReview: (id, data) => api(`/courses/${id}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  enrollCourse: (id) => api(`/courses/${id}/enroll`, { method: 'POST' }),
  trainingPlans: (status) => api(`/training-plans${status ? '?status=' + status : ''}`),
  createTrainingPlan: (data) => api('/training-plans', { method: 'POST', body: JSON.stringify(data) }),
  myTrainingPlans: () => api('/training-plans/my'),
  managerApprovePlan: (id, notes) => api(`/training-plans/${id}/manager-approve`, { method: 'PUT', body: JSON.stringify({ notes: notes || null }) }),
  approvePlan: (id) => api(`/training-plans/${id}/approve`, { method: 'PUT' }),
  rejectPlan: (id, reason) => api(`/training-plans/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason: reason || 'مرفوض للتعديل' }) }),
  startEnrollment: (id) => api(`/enrollments/${id}/start`, { method: 'PUT' }),
  completeEnrollment: (id, score) => api(`/enrollments/${id}/complete`, { method: 'PUT', body: JSON.stringify({ score: score ?? null }) }),
  pendingSkillUpgrades: () => api('/skill-upgrades/pending'),
  decideSkillUpgrade: (impactId, approved, notes) => api(`/skill-upgrades/${impactId}/decision`, { method: 'PUT', body: JSON.stringify({ approved, notes: notes || null }) }),
  notifications: () => api('/notifications'),
  markNotificationRead: (id) => api(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => api('/notifications/read-all', { method: 'PUT' }),
  modelMetrics: () => api('/ai/model-metrics'),
  recommend: (empId) => api(`/ai/recommend/${empId}`, { method: 'POST' }),
  skillGaps: (empId) => api(`/ai/skill-gaps/${empId}`),
  recommendations: () => api('/ai/recommendations'),
  impact: (empId) => api(`/ai/impact/${empId}`),
  myImpact: () => api('/ai/impact/me'),
  actualImpact: (empId) => api(`/ai/actual-impact/${empId}`),
  myActualImpact: () => api('/ai/actual-impact/me'),
  compareAssessments: (empId) => api(`/assessments/compare/${empId}`),
  teamOverview: () => api('/employees/team/overview'),
  auditLogs: () => api('/audit-logs'),
  deptSkills: () => api('/reports/department-skills'),
  trainingNeeds: () => api('/reports/training-needs'),
  performance: () => api('/reports/performance-tracking'),
  deptDistribution: () => api('/reports/department-distribution'),
  trainingImpact: () => api('/reports/training-impact'),
  trainingProgress: () => api('/reports/training-progress'),
  decisionSummary: () => api('/reports/decision-summary'),
};

function exportProgressCsv() {
  fetch(`${API_BASE}/reports/export/csv`, { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error('تعذر تصدير التقرير');
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'training-progress.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('تم تصدير تقرير التقدم');
    })
    .catch((err) => showToast(err.message, 'error'));
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(message, type = 'success') {
  let container = $('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function icon(name) {
  return `<span class="icon">${ICONS[name] || ''}</span>`;
}

function renderStars(score, maxScore = 5, interactive = false) {
  let html = `<div class="star-rating" data-value="${score || 0}">`;
  for (let i = 1; i <= maxScore; i++) {
    const filled = i <= score ? 'filled' : '';
    const clickAttr = interactive ? `data-star="${i}"` : '';
    html += `<span class="star ${filled}" ${clickAttr}>★</span>`;
  }
  html += '</div>';
  return html;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function bindStars(root) {
  root.querySelectorAll('.star-rating').forEach((rating) => {
    rating.querySelectorAll('.star').forEach((star) => {
      star.addEventListener('click', () => {
        const value = Number(star.dataset.star);
        rating.dataset.value = value;
        rating.querySelectorAll('.star').forEach((s, i) => {
          s.classList.toggle('filled', i < value);
        });
        const hint = rating.parentElement.querySelector('.level-hint');
        if (hint) hint.textContent = levelLabel(value);
      });
    });
  });
}

function levelLabel(score) {
  const map = { 1: 'مبتدئ', 2: 'أساسي', 3: 'متوسط', 4: 'متقدم', 5: 'خبير' };
  return map[score] || 'غير محدد';
}

function getBadgeClass(status) {
  const map = {
    'مكتمل': 'badge-success', completed: 'badge-success', approved: 'badge-success', جيد: 'badge-success',
    'قيد التنفيذ': 'badge-warning', in_progress: 'badge-warning', enrolled: 'badge-info', 'يحتاج متابعة': 'badge-warning', draft: 'badge-warning', pending: 'badge-warning',
    'معلق': 'badge-danger', 'متأخر': 'badge-danger', failed: 'badge-danger', 'عالي المخاطر': 'badge-danger', 'بدون خطة': 'badge-muted',
  };
  return map[status] || 'badge-info';
}

function getStatusArabic(status) {
  const map = {
    completed: 'مكتمل', in_progress: 'قيد التنفيذ', enrolled: 'مسجّل',
    approved: 'معتمدة', draft: 'تنتظر الاعتماد', active: 'جارية',
    pending: 'قيد الانتظار', failed: 'فشل',
  };
  return map[status] || status;
}

function progressBarColor(percentage) {
  if (percentage >= 70) return 'green';
  if (percentage >= 40) return 'blue';
  if (percentage >= 20) return 'orange';
  return 'red';
}

function progressRow(label, percent, extra = '') {
  const color = progressBarColor(percent);
  return `
    <div class="mb-lg">
      <div class="flex items-center justify-between">
        <strong>${label}</strong>
        <span class="text-label-sm text-muted">${extra}</span>
      </div>
      <div class="progress-bar-container mt-sm">
        <div class="progress-bar-track"><div class="progress-bar-fill ${color}" style="width:${percent}%"></div></div>
        <span class="progress-label">${percent}%</span>
      </div>
    </div>`;
}

function getRoleArabic(role) {
  const map = { admin: 'مدير النظام', hr: 'مدير الموارد البشرية', manager: 'المدير المباشر', employee: 'موظف' };
  return map[role] || role;
}

function getActionLabel(action) {
  const map = {
    login: 'تسجيل دخول', create_employee: 'إضافة موظف', update_employee: 'تعديل موظف',
    create_skill: 'إضافة مهارة', create_assessment: 'تقييم مهارات', create_course: 'إضافة دورة',
    create_plan: 'إنشاء خطة', complete_course: 'إكمال دورة', generate_recommendation: 'توليد توصية',
  };
  return map[action] || action;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return `${d.toLocaleDateString('ar-EG')} · ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
}

function signedGain(value) {
  const n = Number(value || 0);
  return n > 0 ? `+${n}` : String(n);
}

function navItem(href, name, label) {
  const current = window.location.pathname.split('/').pop();
  const active = current === href.replace('/', '') ? 'active' : '';
  return `<a class="nav-item ${active}" href="${href}">${icon(name)} ${label}</a>`;
}

function sidebarFor(role) {
  const items = {
    admin: [
      navItem('/admin.html', 'home', 'لوحة التحكم'),
      navItem('/admin.html#users', 'users', 'المستخدمون'),
      navItem('/admin.html#courses', 'course', 'الدورات'),
      navItem('/admin.html#reports', 'chart', 'التقارير'),
      navItem('/admin.html#audit', 'assess', 'سجل النشاط'),
    ],
    hr: [
      navItem('/hr.html', 'home', 'لوحة التحكم'),
      navItem('/hr.html#employees', 'users', 'الموظفون'),
      navItem('/hr-plans.html', 'plan', 'الخطط التدريبية'),
      navItem('/hr.html#reports', 'chart', 'التقارير'),
      navItem('/hr.html#decision', 'spark', 'دعم القرار'),
    ],
    manager: [
      navItem('/manager.html', 'home', 'لوحة التحكم'),
      navItem('/manager.html#assess', 'assess', 'التقييمات'),
      navItem('/manager.html#team', 'users', 'الفريق'),
    ],
    employee: [
      navItem('/employee.html', 'home', 'لوحتي'),
      navItem('/employee-assess.html', 'assess', 'التقييم الذاتي'),
      navItem('/employee-plan.html', 'plan', 'خطتي التدريبية'),
      navItem('/employee-courses.html', 'course', 'الدورات'),
    ],
  };
  return (items[role] || items.employee).join('');
}

function initPage() {
  Auth.requireAuth();
  const user = Auth.getUser();
  const nameEl = $('#user-name');
  const roleEl = $('#user-role');
  const avatarEl = $('#user-avatar');
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = getRoleArabic(user.role);
  if (avatarEl) avatarEl.textContent = user.name.charAt(0);
  const nav = $('#sidebar-nav');
  if (nav) nav.innerHTML = sidebarFor(user.role);
  const menuBtn = $('#mobile-menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => $('.sidebar').classList.toggle('open'));
  }
  const logoutBtn = $('#logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());
  initNotifications();
}

async function initNotifications() {
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
        <div class="empty-state" style="padding:1rem"><p>جارٍ التحميل...</p></div>
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
    if (dropdown.classList.contains('open')) loadNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.remove('open');
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
          await API.markNotificationRead(el.dataset.id).catch(() => null);
          if (el.dataset.link) window.location.href = el.dataset.link;
          else loadNotifications();
        });
      });
    } catch {
      list.innerHTML = '<div class="empty-state"><p>تعذر تحميل الإشعارات</p></div>';
    }
  }

  loadNotifications();
}

function loading(el) {
  if (!el) return;
  el.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> جارٍ التحميل...</div>';
}

function empty(text, actionHtml = '') {
  return `<div class="empty-state"><div class="empty-mark">—</div><p>${text}</p>${actionHtml}</div>`;
}

async function withBusy(btn, fn) {
  if (!btn) return fn();
  const prev = btn.disabled;
  btn.disabled = true;
  btn.classList.add('is-busy');
  try {
    return await fn();
  } finally {
    btn.disabled = prev;
    btn.classList.remove('is-busy');
  }
}

function matchesQuery(text, q) {
  return String(text || '').toLowerCase().includes(String(q || '').trim().toLowerCase());
}

function normalizePlans(response) {
  if (Array.isArray(response)) return response;
  if (response?.id) return [response];
  if (response?.plan?.id) return [response.plan];
  return [];
}

function optionList(items, valueKey, labelKey, placeholder) {
  return `<option value="">${placeholder}</option>` + items.map((item) => `<option value="${item[valueKey]}">${item[labelKey]}</option>`).join('');
}

function closeModal(overlay) {
  if (overlay) overlay.classList.remove('open');
}

function openModal(overlay) {
  if (!overlay) return;
  overlay.classList.add('open');
  const first = overlay.querySelector('input, select, textarea');
  if (first) first.focus();
}

function ensureOverlay() {
  let overlay = $('#app-modal');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'app-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><h3 id="modal-title"></h3><button class="modal-close" type="button" aria-label="إغلاق">×</button></div><div class="modal-body" id="modal-body"></div><div class="modal-footer" id="modal-footer"></div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeModal(overlay);
  });
  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeModal(overlay);
  });
  return overlay;
}

function field(id, label, control, required = false, span = '') {
  return `<div class="form-group ${span}">
    <label class="form-label" for="${id}">${label}${required ? ' <span class="required-mark">*</span>' : ''}</label>
    ${control}
    <div class="field-error" id="${id}-error"></div>
  </div>`;
}

async function showEmployeeModal(onSaved, employee = null) {
  const overlay = ensureOverlay();
  const [departments, employees] = await Promise.all([API.departments(), API.employees()]);
  const managers = employees.filter((e) => e.user_role === 'manager' || e.user_role === 'hr' || e.user_role === 'admin');
  $('#modal-title').textContent = employee ? 'تعديل موظف' : 'إضافة موظف';
  $('#modal-body').innerHTML = `<form id="entity-form" class="form-grid">
    ${field('emp-name', 'الاسم الكامل', `<input class="form-input" id="emp-name" required value="${employee?.user_name || ''}">`, true)}
    ${field('emp-email', 'البريد الإلكتروني', `<input class="form-input" id="emp-email" type="email" required value="${employee?.user_email || ''}">`, true)}
    ${field('emp-password', employee ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور', `<input class="form-input" id="emp-password" type="password" ${employee ? '' : 'required'} placeholder="${employee ? 'اتركه فارغاً للإبقاء' : '123456'}">`, !employee)}
    ${field('emp-role', 'الدور', `<select class="form-select" id="emp-role">
      <option value="employee">موظف</option>
      <option value="manager">المدير المباشر</option>
      <option value="hr">الموارد البشرية</option>
      <option value="admin">مدير النظام</option>
    </select>`, true)}
    ${field('emp-position', 'المسمى الوظيفي', `<input class="form-input" id="emp-position" value="${employee?.position || ''}">`)}
    ${field('emp-dept', 'القسم', `<select class="form-select" id="emp-dept">${optionList(departments, 'id', 'name', 'بدون قسم')}</select>`)}
    ${field('emp-manager', 'المدير المباشر', `<select class="form-select" id="emp-manager">${optionList(managers, 'id', 'user_name', 'بدون مدير')}</select>`)}
    ${field('emp-phone', 'الهاتف', `<input class="form-input" id="emp-phone" type="tel" value="${employee?.phone || ''}">`)}
    ${field('emp-hire', 'تاريخ التعيين', `<input class="form-input" id="emp-hire" type="date" value="${employee?.hire_date || ''}">`)}
  </form>`;
  $('#emp-role').value = employee?.user_role || 'employee';
  if (employee?.department_id) $('#emp-dept').value = employee.department_id;
  if (employee?.manager_id) $('#emp-manager').value = employee.manager_id;
  $('#modal-footer').innerHTML = '<button class="btn btn-secondary" type="button" id="modal-cancel">إلغاء</button><button class="btn btn-primary" type="button" id="modal-save">حفظ</button>';
  $('#modal-cancel').onclick = () => closeModal(overlay);
  $('#modal-save').onclick = async () => {
    const payload = {
      name: $('#emp-name').value.trim(),
      email: $('#emp-email').value.trim(),
      role: $('#emp-role').value,
      position: $('#emp-position').value.trim() || null,
      department_id: $('#emp-dept').value ? Number($('#emp-dept').value) : null,
      manager_id: $('#emp-manager').value ? Number($('#emp-manager').value) : null,
      phone: $('#emp-phone').value.trim() || null,
      hire_date: $('#emp-hire').value || null,
    };
    if (!payload.name || !payload.email) {
      showToast('الاسم والبريد مطلوبان', 'error');
      return;
    }
    const password = $('#emp-password').value;
    if (!employee) payload.password = password || '123456';
    else if (password) payload.password = password;
    try {
      await withBusy($('#modal-save'), () => employee ? API.updateEmployee(employee.id, payload) : API.createEmployee(payload));
      showToast(employee ? 'تم تحديث الموظف' : 'تم إضافة الموظف');
      closeModal(overlay);
      await onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  openModal(overlay);
}

async function showCourseModal(onSaved) {
  const overlay = ensureOverlay();
  const skills = await API.skills();
  $('#modal-title').textContent = 'إضافة دورة';
  $('#modal-body').innerHTML = `<form id="entity-form" class="form-grid">
    ${field('course-title', 'عنوان الدورة', '<input class="form-input" id="course-title" required>', true, 'span-2')}
    ${field('course-desc', 'الوصف', '<textarea class="form-textarea" id="course-desc"></textarea>', false, 'span-2')}
    ${field('course-skill', 'المهارة المرتبطة', `<select class="form-select" id="course-skill">${optionList(skills, 'id', 'name', 'بدون مهارة')}</select>`)}
    ${field('course-level', 'المستوى', '<select class="form-select" id="course-level"><option value="1">1 مبتدئ</option><option value="2">2 أساسي</option><option value="3" selected>3 متوسط</option><option value="4">4 متقدم</option><option value="5">5 خبير</option></select>')}
    ${field('course-hours', 'المدة بالساعات', '<input class="form-input" id="course-hours" type="number" min="1" value="10">')}
    ${field('course-type', 'نوع الدورة', '<select class="form-select" id="course-type"><option value="online">إلكترونية</option><option value="classroom">حضورية</option><option value="workshop">ورشة عمل</option></select>')}
    ${field('course-provider', 'الجهة المقدمة', '<input class="form-input" id="course-provider">')}
    ${field('course-cost', 'التكلفة', '<input class="form-input" id="course-cost" type="number" min="0" value="0">')}
  </form>`;
  $('#modal-footer').innerHTML = '<button class="btn btn-secondary" type="button" id="modal-cancel">إلغاء</button><button class="btn btn-primary" type="button" id="modal-save">حفظ الدورة</button>';
  $('#modal-cancel').onclick = () => closeModal(overlay);
  $('#modal-save').onclick = async () => {
    const title = $('#course-title').value.trim();
    if (!title) {
      showToast('عنوان الدورة مطلوب', 'error');
      return;
    }
    const payload = {
      title,
      description: $('#course-desc').value.trim() || null,
      skill_id: $('#course-skill').value ? Number($('#course-skill').value) : null,
      level: Number($('#course-level').value),
      duration_hours: Number($('#course-hours').value || 10),
      type: $('#course-type').value,
      provider: $('#course-provider').value.trim() || null,
      cost: Number($('#course-cost').value || 0),
    };
    try {
      await withBusy($('#modal-save'), () => API.createCourse(payload));
      showToast('تم إضافة الدورة');
      closeModal(overlay);
      await onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  openModal(overlay);
}

function courseTypeLabel(type) {
  return { online: 'إلكترونية', classroom: 'حضورية', workshop: 'ورشة عمل' }[type] || type || '—';
}

async function showCourseDetails(courseId, onChanged) {
  const overlay = ensureOverlay();
  const user = Auth.getUser();
  $('#modal-title').textContent = 'تفاصيل الدورة';
  $('#modal-body').innerHTML = '<div class="loading-overlay"><div class="spinner"></div> جارٍ التحميل...</div>';
  $('#modal-footer').innerHTML = '';
  openModal(overlay);
  let course;
  try {
    course = await API.course(courseId);
  } catch (err) {
    showToast(err.message, 'error');
    closeModal(overlay);
    return;
  }
  const reviews = await API.courseReviews(courseId).catch(() => []);
  const isEmployee = user.role === 'employee';
  const enrollment = course.enrollment;
  const canReview = isEmployee && enrollment && enrollment.status === 'completed';

  const meta = [
    ['المهارة', course.skill_name || '—'],
    ['المستوى', `${course.level}/5`],
    ['المدة', `${course.duration_hours} ساعة`],
    ['النوع', courseTypeLabel(course.type)],
    ['الجهة', course.provider || '—'],
    ['التكلفة', course.cost ? `${course.cost} دولار` : 'مجانية'],
    ['المسجّلون', course.enrolled_count ?? 0],
    ['التقييم', course.reviews_count ? `${course.avg_rating}/5 (${course.reviews_count})` : 'لا توجد تقييمات'],
  ];

  const empPanel = isEmployee ? `
    <div class="ai-banner mb-xl">
      <div class="ai-banner-header">${icon('spark')} ملاءمتها لك</div>
      <div class="ai-banner-body">
        ${course.current_level != null
          ? `مستواك الحالي ${course.current_level}/5 والمستهدف ${course.target_level}/5${course.predicted_gain != null ? ` — تحسن متوقع حتى ${course.predicted_gain} درجة` : ''}.`
          : 'أكمل التقييم الذاتي لقياس مدى ملاءمة هذه الدورة لاحتياجاتك.'}
        ${enrollment ? `<div class="mt-sm">حالة تسجيلك: <span class="badge ${getBadgeClass(enrollment.status)}">${getStatusArabic(enrollment.status)}</span>${enrollment.plan_approved ? '' : ' · بانتظار اعتماد الموارد البشرية'}</div>` : ''}
      </div>
    </div>` : '';

  const reviewForm = canReview ? `
    <div class="card mb-xl">
      <div class="card-header"><h4>${course.my_review ? 'تعديل تقييمك' : 'قيّم هذه الدورة'}</h4></div>
      <div class="card-body">
        <div id="review-stars" class="mb-sm">${renderStars(course.my_review?.rating || 5, 5, true)}</div>
        <textarea class="form-textarea" id="review-comment" placeholder="رأيك في الدورة (اختياري)">${escapeHtml(course.my_review?.comment || '')}</textarea>
      </div>
    </div>` : '';

  const reviewsList = reviews.length ? reviews.map((r) => `
    <div class="notification-item">
      <div class="avatar">${(r.employee_name || '؟').charAt(0)}</div>
      <div style="flex:1">
        <div class="flex items-center justify-between">
          <strong>${escapeHtml(r.employee_name || '—')}</strong>
          ${renderStars(r.rating, 5, false)}
        </div>
        <div class="text-body-sm text-muted">${escapeHtml(r.comment || '')}</div>
      </div>
    </div>`).join('') : empty('لا توجد تقييمات بعد');

  $('#modal-body').innerHTML = `
    <p class="text-body-lg mb-xl">${escapeHtml(course.description || 'لا يوجد وصف لهذه الدورة.')}</p>
    <div class="impact-grid mb-xl">
      ${meta.map(([k, v]) => `<div class="impact-card"><div class="impact-meta">${escapeHtml(k)}</div><div class="text-title">${escapeHtml(v)}</div></div>`).join('')}
    </div>
    ${empPanel}
    ${reviewForm}
    <h4 class="text-title mb-sm">تقييمات الموظفين</h4>
    <div class="notification-list">${reviewsList}</div>`;
  if (reviewForm) bindStars($('#modal-body'));

  const actions = [];
  if (isEmployee) {
    actions.push(`<button class="btn ${course.is_favorite ? 'btn-secondary' : 'btn-ghost'}" type="button" id="fav-btn">${course.is_favorite ? '★ في المفضلة' : '☆ أضف للمفضلة'}</button>`);
    if (!enrollment || enrollment.status === 'failed') {
      actions.push('<button class="btn btn-primary" type="button" id="enroll-btn">التسجيل في الدورة</button>');
    }
    if (canReview) actions.push('<button class="btn btn-success" type="button" id="review-save">حفظ التقييم</button>');
  }
  actions.push('<button class="btn btn-ghost" type="button" id="modal-cancel">إغلاق</button>');
  $('#modal-footer').innerHTML = actions.join('');
  $('#modal-cancel').onclick = () => closeModal(overlay);

  $('#fav-btn')?.addEventListener('click', async (ev) => {
    try {
      const res = await withBusy(ev.currentTarget, () => API.toggleFavorite(courseId));
      showToast(res.message);
      await showCourseDetails(courseId, onChanged);
      if (onChanged) onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  $('#enroll-btn')?.addEventListener('click', async (ev) => {
    try {
      const res = await withBusy(ev.currentTarget, () => API.enrollCourse(courseId));
      showToast(res.message);
      closeModal(overlay);
      if (onChanged) onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  $('#review-save')?.addEventListener('click', async (ev) => {
    const rating = Number($('#review-stars .star-rating')?.dataset.value || 0);
    if (!rating) {
      showToast('اختر تقييماً من 1 إلى 5', 'error');
      return;
    }
    try {
      const res = await withBusy(ev.currentTarget, () => API.createCourseReview(courseId, {
        rating,
        comment: $('#review-comment').value.trim() || null,
      }));
      showToast(res.message);
      await showCourseDetails(courseId, onChanged);
      if (onChanged) onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function showPlanModal(onSaved) {
  const overlay = ensureOverlay();
  const [employees, courses] = await Promise.all([API.employees(), API.courses()]);
  $('#modal-title').textContent = 'إنشاء خطة تدريبية';
  $('#modal-body').innerHTML = `<form id="entity-form">
    ${field('plan-emp', 'الموظف', `<select class="form-select" id="plan-emp">${optionList(employees, 'id', 'user_name', 'اختر الموظف')}</select>`, true)}
    ${field('plan-start', 'تاريخ البداية', `<input class="form-input" id="plan-start" type="date" value="${new Date().toISOString().slice(0, 10)}">`)}
    ${field('plan-end', 'تاريخ النهاية', '<input class="form-input" id="plan-end" type="date">')}
    ${field('plan-reason', 'سبب الخطة', '<textarea class="form-textarea" id="plan-reason" placeholder="اختياري — يُستخدم إن لم تُولَّد الخطة آلياً"></textarea>')}
    <div class="form-group">
      <label class="form-label">الدورات <span class="required-mark">*</span></label>
      <div class="checkbox-list" id="plan-courses">
        ${courses.map((c) => `<label class="checkbox-item"><input type="checkbox" value="${c.id}"> ${c.title} · ${c.skill_name || '—'}</label>`).join('') || empty('أضف دورة أولاً')}
      </div>
    </div>
    <label class="checkbox-item"><input type="checkbox" id="plan-approve"> اعتماد الخطة مباشرة</label>
  </form>`;
  $('#modal-footer').innerHTML = '<button class="btn btn-secondary" type="button" id="modal-cancel">إلغاء</button><button class="btn btn-primary" type="button" id="modal-save">إنشاء الخطة</button>';
  $('#modal-cancel').onclick = () => closeModal(overlay);
  $('#modal-save').onclick = async () => {
    const employeeId = Number($('#plan-emp').value);
    const courseIds = [...$$('#plan-courses input:checked')].map((el) => Number(el.value));
    if (!employeeId) {
      showToast('اختر الموظف', 'error');
      return;
    }
    if (!courseIds.length) {
      showToast('اختر دورة واحدة على الأقل', 'error');
      return;
    }
    try {
      await withBusy($('#modal-save'), () => API.createTrainingPlan({
        employee_id: employeeId,
        start_date: $('#plan-start').value || null,
        end_date: $('#plan-end').value || null,
        course_ids: courseIds,
        ai_reason: $('#plan-reason').value.trim() || null,
        auto_approve: $('#plan-approve').checked,
      }));
      showToast('تم إنشاء الخطة');
      closeModal(overlay);
      await onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  openModal(overlay);
}

async function showDepartmentModal(onSaved) {
  const overlay = ensureOverlay();
  $('#modal-title').textContent = 'إضافة قسم';
  $('#modal-body').innerHTML = `${field('dept-name', 'اسم القسم', '<input class="form-input" id="dept-name" required>', true)}${field('dept-desc', 'الوصف', '<textarea class="form-textarea" id="dept-desc"></textarea>')}`;
  $('#modal-footer').innerHTML = '<button class="btn btn-secondary" type="button" id="modal-cancel">إلغاء</button><button class="btn btn-primary" type="button" id="modal-save">حفظ</button>';
  $('#modal-cancel').onclick = () => closeModal(overlay);
  $('#modal-save').onclick = async () => {
    const name = $('#dept-name').value.trim();
    if (!name) {
      showToast('اسم القسم مطلوب', 'error');
      return;
    }
    try {
      await withBusy($('#modal-save'), () => API.createDepartment({ name, description: $('#dept-desc').value.trim() || null }));
      showToast('تم إضافة القسم');
      closeModal(overlay);
      await onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  openModal(overlay);
}

async function showSkillModal(onSaved) {
  const overlay = ensureOverlay();
  $('#modal-title').textContent = 'إضافة مهارة';
  $('#modal-body').innerHTML = `${field('skill-name', 'اسم المهارة', '<input class="form-input" id="skill-name" required>', true)}
    ${field('skill-cat', 'التصنيف', '<select class="form-select" id="skill-cat"><option value="تقنية">تقنية</option><option value="المهارات الناعمة">المهارات الناعمة</option><option value="لغات">لغات</option></select>')}
    ${field('skill-desc', 'الوصف', '<textarea class="form-textarea" id="skill-desc"></textarea>')}`;
  $('#modal-footer').innerHTML = '<button class="btn btn-secondary" type="button" id="modal-cancel">إلغاء</button><button class="btn btn-primary" type="button" id="modal-save">حفظ</button>';
  $('#modal-cancel').onclick = () => closeModal(overlay);
  $('#modal-save').onclick = async () => {
    const name = $('#skill-name').value.trim();
    if (!name) {
      showToast('اسم المهارة مطلوب', 'error');
      return;
    }
    try {
      await withBusy($('#modal-save'), () => API.createSkill({ name, category: $('#skill-cat').value, description: $('#skill-desc').value.trim() || null }));
      showToast('تم إضافة المهارة');
      closeModal(overlay);
      await onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  openModal(overlay);
}

function courseActions(enrollment, canAct) {
  if (!canAct) return `<span class="text-body-sm text-muted">بانتظار اعتماد الخطة</span>`;
  if (enrollment.status === 'completed') {
    return `<span class="badge badge-success">مكتمل${enrollment.score != null ? ' · ' + enrollment.score : ''}</span>`;
  }
  if (enrollment.status === 'in_progress') {
    return `
      <div class="inline-actions">
        <input class="form-input score-input" type="number" min="0" max="100" placeholder="درجة" data-score="${enrollment.id}">
        <button class="btn btn-success btn-sm" data-complete="${enrollment.id}">إكمال</button>
      </div>`;
  }
  return `<button class="btn btn-primary btn-sm" data-start="${enrollment.id}">بدء الدورة</button>`;
}

const Pages = {


  async hr() {
    initPage();
    const stats = await API.hrStats();
    $('#kpi-employees').textContent = stats.total_employees;
    $('#kpi-pending').textContent = stats.pending_assessments;
    $('#kpi-training').textContent = stats.in_training;
    $('#kpi-plans').textContent = stats.pending_plans;

    const [needs, performance, recs, employees, impact, progress, decision] = await Promise.all([
      API.trainingNeeds(),
      API.performance(),
      API.recommendations(),
      API.employees(),
      API.trainingImpact().catch(() => []),
      API.trainingProgress().catch(() => []),
      API.decisionSummary().catch(() => null),
    ]);

    const recBox = $('#ai-recs');
    recBox.innerHTML = recs.length
      ? `<ul>${recs.slice(0, 5).map((r) => `<li>${r.employee_name}: ${(r.skill_gaps || []).slice(0, 2).map((g) => g.skill_name).join('، ') || 'توصية جديدة'}</li>`).join('')}</ul>`
      : empty('لا توجد توصيات بعد. ولّد توصية من قائمة الموظفين.');

    const ctx = document.getElementById('needsChart');
    if (ctx && window.Chart) {
      Chart.getChart(ctx)?.destroy();
      const top = needs.slice(0, 6);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map((n) => n.skill_name),
          datasets: [{ data: top.map((n) => n.gap_percentage), backgroundColor: '#1E4FCD', borderRadius: 6 }],
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { max: 100, ticks: { callback: (v) => v + '%' } } },
        },
      });
    }

    $('#perf-table').innerHTML = performance.map((p) => `
      <tr>
        <td>${p.employee_name}</td>
        <td>${p.score}%</td>
        <td><span class="badge ${getBadgeClass(p.risk)}">${p.risk}</span></td>
        <td><span class="badge ${getBadgeClass(p.training_status)}">${p.training_status}</span></td>
      </tr>`).join('');

    const decisionBox = $('#decision-box');
    if (decisionBox) {
      if (!decision) {
        decisionBox.innerHTML = empty('لا تتوفر بيانات كافية لدعم القرار');
      } else {
        const topNeeds = (decision.top_training_needs || []).map((n) => `
          <div class="notification-item">
            ${icon('chart')}
            <span>${n.skill_name}</span>
            <span class="badge badge-warning">${n.gap_percentage}% فجوة · ${n.gap_count} موظف</span>
          </div>`).join('');
        decisionBox.innerHTML = `
          <div class="grid-2 mb-xl">
            <div class="notification-item">${icon('plan')} خطط تنتظر الاعتماد: <strong>${decision.pending_plans}</strong></div>
            <div class="notification-item">${icon('course')} دورات مكتملة: <strong>${decision.completed_courses}</strong></div>
            <div class="notification-item">${icon('spark')} أثر المهارات الكلي: <strong>${signedGain(decision.total_skill_gain)}</strong></div>
            <div class="notification-item">${icon('assess')} ${decision.decision_note || ''}</div>
          </div>
          <h4 class="text-title mb-sm">أهم احتياجات التدريب</h4>
          <div class="notification-list">${topNeeds || empty('لا توجد فجوات مسجّلة')}</div>`;
      }
    }

    $('#impact-table').innerHTML = impact.length ? impact.map((row) => `
      <tr>
        <td>${row.employee_name}</td>
        <td>${row.department_name}</td>
        <td>${row.completed_courses}</td>
        <td><span class="badge ${row.actual_gain > 0 ? 'badge-success' : 'badge-muted'}">${signedGain(row.actual_gain)}</span></td>
        <td>${signedGain(row.predicted_gain)}</td>
      </tr>`).join('') : `<tr><td colspan="5">${empty('لا يوجد أثر تدريب مسجّل بعد')}</td></tr>`;

    $('#progress-table').innerHTML = progress.length ? progress.map((p) => `
      <tr>
        <td>${p.employee_name}</td>
        <td><span class="badge ${getBadgeClass(p.status)}">${getStatusArabic(p.status)}</span></td>
        <td>${p.completed_courses}/${p.total_courses}</td>
        <td>
          <div class="progress-bar-container">
            <div class="progress-bar-track"><div class="progress-bar-fill ${progressBarColor(p.progress_percent)}" style="width:${p.progress_percent}%"></div></div>
            <span class="progress-label">${p.progress_percent}%</span>
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="4">${empty('لا توجد خطط تدريبية')}</td></tr>`;

    $('#export-csv')?.addEventListener('click', exportProgressCsv);

    const renderEmployees = () => {
      const q = $('#emp-search')?.value || '';
      const dept = $('#emp-dept')?.value || '';
      const rows = employees.filter((e) => matchesQuery(`${e.user_name} ${e.position} ${e.department_name}`, q) && (!dept || String(e.department_id) === dept));
      $('#employees-table').innerHTML = rows.length ? rows.map((e) => `
        <tr>
          <td>${e.user_name}</td>
          <td>${e.position || '—'}</td>
          <td>${e.department_name || '—'}</td>
          <td class="table-actions">
            <button class="btn btn-secondary btn-sm" data-edit="${e.id}">تعديل</button>
            <button class="btn btn-ai btn-sm" data-rec="${e.id}">توليد توصية</button>
          </td>
        </tr>`).join('') : `<tr><td colspan="4">${empty('لا يوجد موظفون مطابقون')}</td></tr>`;
    };
    $('#add-employee-btn')?.addEventListener('click', () => showEmployeeModal(() => window.location.reload()));
    $('#add-dept-btn')?.addEventListener('click', () => showDepartmentModal(() => window.location.reload()));
    const depts = [...new Set(employees.map((e) => JSON.stringify({ id: e.department_id, name: e.department_name })))];
    if ($('#emp-dept')) {
      $('#emp-dept').innerHTML = '<option value="">كل الأقسام</option>' + depts.map((d) => {
        const item = JSON.parse(d);
        return item.id ? `<option value="${item.id}">${item.name || ''}</option>` : '';
      }).join('');
    }
    $('#emp-search')?.addEventListener('input', renderEmployees);
    $('#emp-dept')?.addEventListener('change', renderEmployees);
    renderEmployees();

    $('#employees-table').addEventListener('click', async (ev) => {
      const recBtn = ev.target.closest('[data-rec]');
      const editBtn = ev.target.closest('[data-edit]');
      if (editBtn) {
        const emp = employees.find((e) => String(e.id) === String(editBtn.dataset.edit));
        if (emp) await showEmployeeModal(() => window.location.reload(), emp);
        return;
      }
      if (!recBtn) return;
      recBtn.disabled = true;
      try {
        await withBusy(recBtn, () => API.recommend(recBtn.dataset.rec));
        showToast('تم توليد التوصية والخطة');
        window.location.reload();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        recBtn.disabled = false;
      }
    });
  },

  async hrPlans() {
    initPage();
    const plans = await API.trainingPlans();
    const counts = {
      draft: plans.filter((p) => p.status === 'draft' || p.status === 'pending_hr').length,
      approved: plans.filter((p) => p.status === 'approved').length,
      active: plans.filter((p) => p.status === 'active').length,
      completed: plans.filter((p) => p.status === 'completed').length,
      rejected: plans.filter((p) => p.status === 'rejected').length,
    };
    $('#tab-draft').textContent = `تنتظر الاعتماد (${counts.draft})`;
    $('#tab-approved').textContent = `معتمدة (${counts.approved})`;
    $('#tab-active').textContent = `جارية (${counts.active})`;
    $('#tab-completed').textContent = `مكتملة (${counts.completed})`;

    let current = 'draft';
    const search = $('#plan-search');
    const render = () => {
      const q = (search.value || '').trim();
      const dept = $('#plan-dept')?.value || '';
      const list = plans.filter((p) => {
        const matchesStatus = current === 'draft' ? (p.status === 'draft' || p.status === 'pending_hr') : p.status === current;
        return matchesStatus && matchesQuery(`${p.employee_name} ${p.department_name}`, q) && (!dept || p.department_name === dept);
      });
      $('#plans-list').innerHTML = list.length ? list.map((p) => `
        <div class="plan-card">
          <div class="plan-card-header">
            <div class="plan-employee-info">
              <div class="avatar">${(p.employee_name || 'م').charAt(0)}</div>
              <div>
                <div class="text-title">${p.employee_name || '—'}</div>
                <div class="text-body-sm text-muted">${p.department_name || ''}</div>
              </div>
            </div>
            <div class="flex items-center gap-sm">
              ${p.manager_approved ? '<span class="badge badge-success">✓ موافقة المدير</span>' : '<span class="badge badge-warning">بانتظار المدير</span>'}
              <span class="badge ${getBadgeClass(p.status)}">${getStatusArabic(p.status)}</span>
            </div>
          </div>
          ${p.rejection_reason ? `<div class="badge badge-danger mb-sm">سبب الرفض السابق: ${escapeHtml(p.rejection_reason)}</div>` : ''}
          ${p.budget_estimated ? `<div class="text-body-sm text-muted mb-sm">الميزانية التقديرية: <strong>${p.budget_estimated}$</strong></div>` : ''}
          <div class="ai-banner">
            <div class="ai-banner-header">${icon('spark')} سبب التوصية</div>
            <div class="ai-banner-body">${p.ai_reason || 'لا يوجد شرح بعد.'}</div>
          </div>
          <div class="plan-courses">
            ${(p.enrollments || []).map((e) => `<span class="course-chip">${e.course_title || 'دورة'} · ${getStatusArabic(e.status)}</span>`).join('') || 'لا توجد دورات'}
          </div>
          ${(p.status === 'draft' || p.status === 'pending_hr') ? `
          <div class="plan-actions">
            <button class="btn btn-success btn-sm" data-approve="${p.id}">اعتماد نهائي (HR)</button>
            <button class="btn btn-danger btn-sm" data-reject="${p.id}">رفض وإعادة للمسودة</button>
          </div>` : ''}
        </div>`).join('') : empty('لا توجد خطط في هذا التبويب');
    };

    $$('.tab-item').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.tab-item').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        current = tab.dataset.status;
        render();
      });
    });
    const depts = [...new Set(plans.map((p) => p.department_name).filter(Boolean))];
    if ($('#plan-dept')) {
      $('#plan-dept').innerHTML = '<option value="">كل الأقسام</option>' + depts.map((d) => `<option value="${d}">${d}</option>`).join('');
      $('#plan-dept').addEventListener('change', render);
    }
    search.addEventListener('input', render);
    $('#add-plan-btn')?.addEventListener('click', () => showPlanModal(() => window.location.reload()));
    $('#add-course-btn')?.addEventListener('click', () => showCourseModal(() => window.location.reload()));
    $('#plans-list').addEventListener('click', async (ev) => {
      const approve = ev.target.closest('[data-approve]');
      const reject = ev.target.closest('[data-reject]');
      try {
        if (approve) {
          await withBusy(approve, () => API.approvePlan(approve.dataset.approve));
          showToast('تم اعتماد الخطة رسميًا');
          window.location.reload();
        }
        if (reject) {
          const reason = prompt('يرجى تحديد سبب الرفض والتعديلات المطلوبة من الموظف:');
          if (!reason) return;
          await withBusy(reject, () => API.rejectPlan(reject.dataset.reject, reason));
          showToast('تم رفض الخطة وتوثيق السبب وإعادتها للموظف');
          window.location.reload();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    render();
  },

  async manager() {
    initPage();
    const [team, ov, pendingPlans, pendingUpgrades] = await Promise.all([
      API.teamMembers(),
      API.teamOverview(),
      API.trainingPlans(),
      API.pendingSkillUpgrades(),
    ]);
    let overview = ov;
    const select = $('#team-select');
    if (!team.length) {
      $('#manager-body').innerHTML = empty('لا يوجد أعضاء في فريقك بعد.');
      return;
    }

    const renderManagerApprovals = () => {
      const plansBox = $('#manager-plans-box');
      if (plansBox) {
        const teamMemberIds = new Set(team.map((member) => String(member.id)));
        const waiting = pendingPlans.filter((plan) => teamMemberIds.has(String(plan.employee_id)) && !plan.manager_approved && plan.status !== 'rejected');
        plansBox.innerHTML = waiting.length ? waiting.map((p) => `
          <div class="plan-card mb-md">
            <div class="plan-card-header">
              <strong>${p.employee_name} · ${p.department_name || ''}</strong>
              <span class="badge badge-warning">بانتظار موافقتك</span>
            </div>
            <p class="text-body-sm text-secondary mb-sm">${p.ai_reason || 'طلب خطة تدريب'}</p>
            <div class="plan-courses mb-md">
              ${(p.enrollments || []).map((e) => `<span class="course-chip">${e.course_title}</span>`).join('')}
            </div>
            <div class="plan-actions">
              <button class="btn btn-success btn-sm" data-mgr-approve="${p.id}">موافقة المدير وإحالة لـ HR</button>
              <button class="btn btn-danger btn-sm" data-mgr-reject="${p.id}">رفض الخطة</button>
            </div>
          </div>
        `).join('') : '<p class="text-body-sm text-muted">لا توجد خطط تنتظر موافقتك حالياً.</p>';
      }

      const upgradesBox = $('#manager-upgrades-box');
      if (upgradesBox) {
        upgradesBox.innerHTML = pendingUpgrades.length ? pendingUpgrades.map((u) => `
          <div class="notification-item mb-md flex items-center justify-between">
            <div>
              <strong>${u.employee_name}</strong>
              <div class="text-body-sm text-muted">إكمال دورة مهارة: <strong>${u.skill_name || 'مهارة'}</strong> (المستوى الحالي: ${u.previous_level}/5 ← الترقية المقترحة: ${u.new_level}/5) · درجة الدورة: ${u.course_score ?? '—'}%</div>
            </div>
            <div class="table-actions">
              <button class="btn btn-success btn-sm" data-upg-approve="${u.id}">اعتماد ترقية المهارة</button>
              <button class="btn btn-danger btn-sm" data-upg-reject="${u.id}">رفض الترقية</button>
            </div>
          </div>
        `).join('') : '<p class="text-body-sm text-muted">لا توجد طلبات ترقية مهارات معلقة حالياً.</p>';
      }
    };
    renderManagerApprovals();

    // Event delegation for manager actions
    $('#team-plans-approval')?.addEventListener('click', async (ev) => {
      const appBtn = ev.target.closest('[data-mgr-approve]');
      const rejBtn = ev.target.closest('[data-mgr-reject]');
      try {
        if (appBtn) {
          const notes = prompt('ملاحظات إضافية لـ HR (اختياري):');
          await withBusy(appBtn, () => API.managerApprovePlan(appBtn.dataset.mgrApprove, notes));
          showToast('تمت موافقة المدير وأُحيلت الخطة إلى HR');
          window.location.reload();
        }
        if (rejBtn) {
          const reason = prompt('يرجى تحديد سبب الرفض والتعديل للموظف:');
          if (!reason) return;
          await withBusy(rejBtn, () => API.rejectPlan(rejBtn.dataset.mgrReject, reason));
          showToast('تم رفض الخطة وتوثيق السبب');
          window.location.reload();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    $('#team-skill-upgrades')?.addEventListener('click', async (ev) => {
      const appBtn = ev.target.closest('[data-upg-approve]');
      const rejBtn = ev.target.closest('[data-upg-reject]');
      try {
        if (appBtn) {
          const notes = prompt('ملاحظات اعتماد المهارة (اختياري):');
          await withBusy(appBtn, () => API.decideSkillUpgrade(appBtn.dataset.upgApprove, true, notes));
          showToast('تم اعتماد ترقية المهارة بنجاح وتحديث مستوى الموظف');
          window.location.reload();
        }
        if (rejBtn) {
          const notes = prompt('سبب عدم اعتماد الترقية (اختياري):');
          await withBusy(rejBtn, () => API.decideSkillUpgrade(rejBtn.dataset.upgReject, false, notes));
          showToast('تم تسجيل رفض الترقية والاحتفاظ بمستوى المهارة السابق');
          window.location.reload();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    const renderOverview = () => {
      const body = $('#team-table');
      if (!body) return;
      body.innerHTML = overview.length ? overview.map((m) => `
        <tr>
          <td>${m.user_name}</td>
          <td>${m.latest_score ? Math.round(m.latest_score * 20) + '%' : '—'}</td>
          <td>
            <div class="progress-bar-container">
              <div class="progress-bar-track"><div class="progress-bar-fill ${progressBarColor(m.progress_percent)}" style="width:${m.progress_percent}%"></div></div>
              <span class="progress-label">${m.courses_completed}/${m.courses_total}</span>
            </div>
          </td>
          <td><span class="badge ${m.actual_gain > 0 ? 'badge-success' : 'badge-muted'}">${signedGain(m.actual_gain)}</span></td>
        </tr>`).join('') : `<tr><td colspan="4">${empty('لا توجد بيانات فريق')}</td></tr>`;
    };
    renderOverview();

    const loadMember = async () => {
      const id = Number(select.value);
      const member = team.find((m) => m.id === id);
      if (!member) return;
      $('#member-card').innerHTML = `
        <div class="user-chip">
          <div class="avatar">${member.user_name.charAt(0)}</div>
          <div class="user-meta">
            <strong>${member.user_name}</strong>
            <small>${member.position || ''} · ${member.department_name || ''}</small>
          </div>
        </div>`;
      let skills;
      let gaps;
      let comparison;
      try {
        [skills, gaps, comparison] = await Promise.all([
          API.employeeSkills(id),
          API.skillGaps(id),
          API.compareAssessments(id).catch(() => null),
        ]);
      } catch (err) {
        showToast(err.message, 'error');
        return;
      }
      $('#gap-list').innerHTML = gaps.length
        ? gaps.map((g) => progressRow(g.skill_name, g.gap_percentage, `${g.current_level}/${g.target_level}`)).join('')
        : empty('لا توجد فجوات واضحة');
      $('#assess-form').innerHTML = skills.map((s) => `
        <div class="skill-card" data-skill="${s.skill_id}">
          <div class="skill-card-header">
            <div class="skill-card-title">${s.skill_name}</div>
            <span class="badge badge-muted">المطلوب ${s.target_level}/5</span>
          </div>
          <p class="skill-card-desc">التقييم الذاتي الحالي: ${s.current_level}/5</p>
          ${renderStars(s.current_level, 5, true)}
          <div class="level-hint">${levelLabel(s.current_level)}</div>
          <input class="form-input mt-md" placeholder="ملاحظات المدير">
        </div>`).join('');
      bindStars($('#assess-form'));

      const box = $('#compare-box');
      if (box) {
        if (!comparison || (!comparison.self && !comparison.manager)) {
          box.innerHTML = empty('لا توجد تقييمات للمقارنة بعد لهذا الموظف');
        } else {
          const rows = (comparison.comparison || []).map((c) => {
            const deltaClass = c.delta == null ? 'badge-muted' : c.delta === 0 ? 'badge-info' : (c.delta > 0 ? 'badge-success' : 'badge-danger');
            return `<tr>
              <td>${c.skill_name || '—'}</td>
              <td>${c.self_score == null ? '—' : c.self_score + '/5'}</td>
              <td>${c.manager_score == null ? '—' : c.manager_score + '/5'}</td>
              <td><span class="badge ${deltaClass}">${c.delta == null ? '—' : signedGain(c.delta)}</span></td>
            </tr>`;
          }).join('');
          box.innerHTML = `
            <div class="grid-2 mb-xl">
              <div class="notification-item">${icon('assess')} التقييم الذاتي: <strong>${comparison.self ? comparison.self.total_score + '/5' : 'غير متوفر'}</strong></div>
              <div class="notification-item">${icon('users')} تقييم المدير: <strong>${comparison.manager ? comparison.manager.total_score + '/5' : 'غير متوفر'}</strong></div>
            </div>
            ${rows ? `<div class="table-wrap"><table class="data-table">
              <thead><tr><th>المهارة</th><th>التقييم الذاتي</th><th>تقييم المدير</th><th>الفرق</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>` : empty('تشابهت التقييمات أو لا توجد تفاصيل مهارية')}`;
        }
      }
    };

    const renderTeam = () => {
      const q = $('#team-search')?.value || '';
      const list = team.filter((m) => matchesQuery(`${m.user_name} ${m.position} ${m.department_name}`, q));
      select.innerHTML = list.map((m) => `<option value="${m.id}">${m.user_name} — ${m.position || ''}</option>`).join('');
      if (!list.length) {
        $('#member-card').innerHTML = empty('لا يوجد عضو مطابق');
        $('#gap-list').innerHTML = '';
        $('#assess-form').innerHTML = '';
        return false;
      }
      return true;
    };
    $('#team-search')?.addEventListener('input', async () => {
      if (renderTeam()) await loadMember();
    });
    if (!renderTeam()) return;

    select.addEventListener('change', loadMember);
    await loadMember();

    $('#submit-assess').addEventListener('click', async () => {
      const id = Number(select.value);
      const items = [...$$('#assess-form .skill-card')].map((card) => ({
        skill_id: Number(card.dataset.skill),
        score: Number(card.querySelector('.star-rating').dataset.value || 0),
        notes: card.querySelector('input').value || null,
      }));
      if (items.some((i) => !i.score)) {
        showToast('قيّم كل مهارة قبل الإرسال', 'error');
        return;
      }
      try {
        await withBusy($('#submit-assess'), () => API.createAssessment({ employee_id: id, type: 'manager', items }));
        showToast('تم حفظ تقييم المدير وتوليد توصية');
        overview = await API.teamOverview().catch(() => overview);
        renderOverview();
        loadMember();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  },

  async employee() {
    initPage();
    const [stats, profile, plans, impact, actual] = await Promise.all([
      API.employeeStats(),
      API.myProfile(),
      API.myTrainingPlans(),
      API.myImpact().catch(() => null),
      API.myActualImpact().catch(() => null),
    ]);
    $('#kpi-progress').textContent = `${stats.overall_progress}%`;
    $('#kpi-assess').textContent = stats.completed_assessments;
    $('#kpi-courses').textContent = stats.courses_in_plan;

    const employeePlans = normalizePlans(plans);
    const enrollments = employeePlans.flatMap((p) => (p.enrollments || []).map((e) => ({ ...e, approved: p.is_approved, planStatus: p.status })));
    $('#plan-list').innerHTML = enrollments.length
      ? enrollments.map((e) => {
        const percent = e.status === 'completed' ? 100 : e.status === 'in_progress' ? 50 : 15;
        return `<div class="course-row">${progressRow(e.course_title, percent, getStatusArabic(e.status))}${courseActions(e, e.approved)}</div>`;
      }).join('')
      : empty('لا توجد دورات في خطتك بعد', '<a class="btn btn-primary btn-sm" href="/employee-assess.html">ابدأ التقييم الذاتي</a>');

    $('#plan-list').onclick = async (ev) => {
      const startBtn = ev.target.closest('[data-start]');
      const doneBtn = ev.target.closest('[data-complete]');
      try {
        if (startBtn) {
          await withBusy(startBtn, () => API.startEnrollment(startBtn.dataset.start));
          showToast('تم بدء الدورة');
          Pages.employee();
        }
        if (doneBtn) {
          const raw = document.querySelector(`[data-score="${doneBtn.dataset.complete}"]`)?.value;
          const score = raw === '' || raw == null ? null : Number(raw);
          await withBusy(doneBtn, () => API.completeEnrollment(doneBtn.dataset.complete, score));
          showToast('تم إكمال الدورة');
          Pages.employee();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    const gaps = impact?.skill_gaps || [];
    $('#gap-list').innerHTML = gaps.length
      ? gaps.map((g) => progressRow(g.skill_name, Math.max(0, 100 - g.gap_percentage), `${g.current_level}/${g.target_level}`)).join('')
      : empty('أكمل التقييم الذاتي لعرض الفجوات');

    const actualBox = $('#actual-impact');
    if (actualBox) {
      if (!actual) {
        actualBox.innerHTML = empty('لا يتوفر أثر فعلي حتى الآن');
      } else {
        const records = (actual.records || []).map((r) => `
          <tr>
            <td>${r.skill_name || '—'}</td>
            <td>${r.previous_level}/5</td>
            <td>${r.new_level}/5</td>
            <td><span class="badge badge-success">${signedGain(r.gain)}</span></td>
            <td>${r.recorded_date || '—'}</td>
          </tr>`).join('');
        actualBox.innerHTML = `
          <div class="grid-2 mb-xl">
            <div class="notification-item">${icon('course')} دورات مكتملة: <strong>${actual.completed_courses}</strong></div>
            <div class="notification-item">${icon('spark')} الأثر الفعلي: <strong>${signedGain(actual.actual_gain)}</strong> درجة</div>
            <div class="notification-item">${icon('chart')} الأثر المتوقع: <strong>${signedGain(actual.predicted_gain)}</strong> درجة</div>
            <div class="notification-item">${icon('assess')} ${actual.summary}</div>
          </div>
          ${records ? `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>المهارة</th><th>قبل</th><th>بعد</th><th>التحسن</th><th>التاريخ</th></tr></thead>
            <tbody>${records}</tbody></table></div>` : empty('أكمل دورة لتسجيل الأثر الفعلي')}`;
      }
    }

    $('#notif-list').innerHTML = `
      <div class="notification-item">${icon('spark')} ${impact?.summary || 'لا يوجد تقدير أثر بعد'}</div>
      <div class="notification-item">${icon('plan')} عدد الدورات في خطتك: ${enrollments.length}</div>
      <div class="notification-item">${icon('assess')} مرحباً ${profile.user_name} — ${profile.position || ''}</div>`;
  },

  async employeeAssess() {
    initPage();
    const profile = await API.myProfile();
    let skills = await API.employeeSkills(profile.id);
    if (!skills.length) skills = (await API.skills()).map((s) => ({ skill_id: s.id, skill_name: s.name, skill_category: s.category, current_level: 0, target_level: 5 }));

    const groups = {};
    skills.forEach((s) => {
      const key = s.skill_category || 'مهارات عامة';
      (groups[key] ||= []).push(s);
    });

    const updateProgress = () => {
      const cards = [...$$('#assess-grid .skill-card')];
      const filled = cards.filter((c) => Number(c.querySelector('.star-rating').dataset.value) > 0).length;
      const percent = cards.length ? Math.round((filled / cards.length) * 100) : 0;
      $('#assess-progress-label').textContent = `تقدمك في التقييم ${filled} / ${cards.length} مهارة`;
      $('#assess-progress-fill').style.width = percent + '%';
    };

    $('#assess-grid').innerHTML = Object.entries(groups).map(([cat, list]) => `
      <h3 class="text-headline-sm mb-lg">${cat}</h3>
      <div class="skills-grid mb-xl">
        ${list.map((s) => `
          <div class="skill-card" data-skill="${s.skill_id}">
            <div class="skill-card-title">${s.skill_name}</div>
            <p class="skill-card-desc">المستوى المستهدف ${s.target_level}/5</p>
            ${renderStars(s.current_level || 0, 5, true)}
            <div class="level-hint">${levelLabel(s.current_level || 0)}</div>
          </div>`).join('')}
      </div>`).join('');
    bindStars($('#assess-grid'));
    $('#assess-grid').addEventListener('click', updateProgress);
    updateProgress();

    $('#submit-self').addEventListener('click', async () => {
      const items = [...$$('#assess-grid .skill-card')].map((card) => ({
        skill_id: Number(card.dataset.skill),
        score: Number(card.querySelector('.star-rating').dataset.value || 0),
      })).filter((i) => i.score > 0);
      if (!items.length) {
        showToast('قيّم مهارة واحدة على الأقل', 'error');
        return;
      }
      try {
        await withBusy($('#submit-self'), () => API.createAssessment({ employee_id: profile.id, type: 'self', items }));
        showToast('تم حفظ التقييم وتوليد خطة مقترحة');
        window.location.href = '/employee-plan.html';
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  },

  async employeePlan() {
    initPage();
    const [plans, impact] = await Promise.all([
      API.myTrainingPlans(),
      API.myImpact().catch(() => null),
    ]);
    if (impact) {
      $('#impact-banner').innerHTML = `
        <div class="ai-banner-header">${icon('spark')} تقدير أثر التدريب</div>
        <div class="ai-banner-body">
          <p>${impact.summary}</p>
          <p class="mt-sm text-body-sm">تنبيه: التوقع تقدير تجريبي مبني على بيانات صناعية، وليس قياسًا فعليًا لأداء الموظف.</p>
          <p class="mt-sm text-body-sm">النموذج: ${impact.model.algorithm} · جودة الملاءمة R² = ${impact.model.r2}</p>
        </div>`;
      $('#impact-courses').innerHTML = (impact.courses || []).map((c) => `
        <div class="impact-card">
          <h4>${c.course_title}</h4>
          <div class="impact-meta">${c.skill_name} · ${c.duration_hours} ساعة</div>
          <div class="mt-sm">تحسن متوقع: <strong>${c.predicted_gain}</strong> درجة</div>
          <div class="impact-meta">من ${c.expected_level - c.predicted_gain} إلى نحو ${c.expected_level}/5</div>
        </div>`).join('') || empty('لا توجد دورات مقترحة');
    }

    const planList = normalizePlans(plans);
    $('#plans-wrap').innerHTML = planList.length ? planList.map((p) => `
      <div class="plan-card">
        <div class="plan-card-header">
          <strong>خطة ${getStatusArabic(p.status)}</strong>
          <div class="flex items-center gap-sm">
            ${p.manager_approved ? '<span class="badge badge-success">✓ موافقة المدير</span>' : '<span class="badge badge-warning">بانتظار المدير</span>'}
            <span class="badge ${getBadgeClass(p.status)}">${p.is_approved ? 'معتمدة رسميًا' : getStatusArabic(p.status)}</span>
          </div>
        </div>
        ${p.status === 'rejected' ? `
          <div class="alert alert-danger mb-md" style="padding:10px 14px;border-radius:8px;background:var(--danger-bg);color:var(--danger);border:1px solid #FECDD3">
            <strong>تم رفض الخطة للمراجعة والتعديل:</strong> ${escapeHtml(p.rejection_reason || 'يرجى مراجعة الدورات المقترحة مع مديرك.')}
          </div>
        ` : ''}
        ${p.status === 'pending_manager' ? `
          <div class="alert alert-warning mb-md" style="padding:8px 12px;border-radius:8px;background:var(--warning-bg);color:var(--warning);border:1px solid #FDE68A">
            الخطة بانتظار مراجعة واعتماد المدير المباشر أولاً.
          </div>
        ` : ''}
        ${p.status === 'pending_hr' ? `
          <div class="alert alert-info mb-md" style="padding:8px 12px;border-radius:8px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary-border)">
            وافق المدير المباشر، والخطة بانتظار الاعتماد النهائي من الموارد البشرية.
          </div>
        ` : ''}
        <p class="text-body-sm text-secondary mb-lg">${p.ai_reason || ''}</p>
        ${(p.enrollments || []).map((e) => {
          const percent = e.status === 'completed' ? 100 : e.status === 'in_progress' ? 50 : 15;
          return `<div class="course-row">${progressRow(e.course_title, percent, getStatusArabic(e.status))}${courseActions(e, p.is_approved)}</div>`;
        }).join('')}
      </div>`).join('') : empty('لا توجد خطة بعد. أكمل التقييم الذاتي أولاً.', '<a class="btn btn-primary btn-sm" href="/employee-assess.html">التقييم الذاتي</a>');

    $('#plans-wrap').onclick = async (ev) => {
      const startBtn = ev.target.closest('[data-start]');
      const doneBtn = ev.target.closest('[data-complete]');
      try {
        if (startBtn) {
          await withBusy(startBtn, () => API.startEnrollment(startBtn.dataset.start));
          showToast('تم بدء الدورة');
          Pages.employeePlan();
        }
        if (doneBtn) {
          const raw = document.querySelector(`[data-score="${doneBtn.dataset.complete}"]`)?.value;
          const score = raw === '' || raw == null ? null : Number(raw);
          await withBusy(doneBtn, () => API.completeEnrollment(doneBtn.dataset.complete, score));
          showToast('تم إكمال الدورة');
          Pages.employeePlan();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  },

  guide() {
    initPage();
    const tabs = $$('[data-guide-tab]');
    const panels = $$('[data-guide-panel]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const selected = tab.dataset.guideTab;
        tabs.forEach((item) => {
          const active = item === tab;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', String(active));
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.guidePanel !== selected;
        });
      });
    });
  },

  async employeeCourses() {
    initPage();
    const [courses, skills] = await Promise.all([API.courses(), API.skills()]);
    let onlyFavorites = false;

    if ($('#course-skill')) {
      $('#course-skill').innerHTML = optionList(skills, 'id', 'name', 'كل المهارات');
    }

    const render = () => {
      const q = $('#course-search')?.value || '';
      const skill = $('#course-skill')?.value || '';
      const level = $('#course-level')?.value || '';
      const type = $('#course-type')?.value || '';
      const list = courses.filter((c) => {
        if (onlyFavorites && !c.is_favorite) return false;
        if (skill && String(c.skill_id) !== skill) return false;
        if (level && String(c.level) !== level) return false;
        if (type && c.type !== type) return false;
        return matchesQuery(`${c.title} ${c.skill_name} ${c.provider}`, q);
      });
      if ($('#course-count')) $('#course-count').textContent = list.length;
      $('#course-grid').innerHTML = list.length ? list.map((c) => `
        <article class="impact-card">
          <div class="flex items-center justify-between">
            <h4>${escapeHtml(c.title)}</h4>
            ${c.is_favorite ? '<span class="badge badge-ai">★ مفضلة</span>' : ''}
          </div>
          <div class="impact-meta mb-sm">${escapeHtml(c.skill_name || '—')} · ${escapeHtml(courseTypeLabel(c.type))}</div>
          <div class="flex items-center justify-between mb-sm">
            <span class="badge badge-info">المستوى ${c.level}/5</span>
            <span class="text-body-sm text-muted">${c.duration_hours} ساعة${c.cost ? ` · ${escapeHtml(c.cost)} دولار` : ' · مجانية'}</span>
          </div>
          <div class="mb-md">${c.reviews_count
            ? `${renderStars(Math.round(c.avg_rating), 5, false)} <span class="text-body-sm text-muted">${c.avg_rating}/5 (${c.reviews_count})</span>`
            : '<span class="text-body-sm text-muted">لا توجد تقييمات بعد</span>'}</div>
          <p class="text-body-sm text-secondary mb-lg">${escapeHtml((c.description || '').slice(0, 90))}${(c.description || '').length > 90 ? '…' : ''}</p>
          <div class="plan-actions">
            <button class="btn btn-secondary btn-sm" data-details="${c.id}">التفاصيل</button>
            <button class="btn btn-ghost btn-sm" data-fav="${c.id}" aria-label="${c.is_favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}">${c.is_favorite ? '★' : '☆'}</button>
            <button class="btn btn-primary btn-sm" data-enroll="${c.id}" ${['enrolled', 'in_progress', 'completed'].includes(c.enrollment?.status) ? 'disabled' : ''}>${c.enrollment?.status === 'completed' ? 'مكتملة' : ['enrolled', 'in_progress'].includes(c.enrollment?.status) ? 'مسجل' : c.enrollment?.status === 'failed' ? 'إعادة التسجيل' : 'تسجيل'}</button>
          </div>
        </article>`).join('') : empty('لا توجد دورات مطابقة', '<a class="btn btn-primary btn-sm" href="/employee.html">العودة لوحتي</a>');
    };

    const refresh = async () => {
      const fresh = await API.courses();
      courses.length = 0;
      courses.push(...fresh);
      render();
    };

    $('#course-search')?.addEventListener('input', render);
    $('#course-skill')?.addEventListener('change', render);
    $('#course-level')?.addEventListener('change', render);
    $('#course-type')?.addEventListener('change', render);
    $('#show-favorites')?.addEventListener('click', (ev) => {
      onlyFavorites = !onlyFavorites;
      ev.currentTarget.classList.toggle('btn-primary', onlyFavorites);
      ev.currentTarget.classList.toggle('btn-secondary', !onlyFavorites);
      render();
    });

    $('#course-grid').addEventListener('click', async (ev) => {
      const detailBtn = ev.target.closest('[data-details]');
      const favBtn = ev.target.closest('[data-fav]');
      const enrollBtn = ev.target.closest('[data-enroll]');
      try {
        if (detailBtn) {
          await showCourseDetails(detailBtn.dataset.details, refresh);
          return;
        }
        if (favBtn) {
          const res = await withBusy(favBtn, () => API.toggleFavorite(favBtn.dataset.fav));
          showToast(res.message);
          await refresh();
          return;
        }
        if (enrollBtn) {
          const res = await withBusy(enrollBtn, () => API.enrollCourse(enrollBtn.dataset.enroll));
          showToast(res.message);
          await refresh();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    render();
  },
};
