import { API } from './api.js';
import { Auth } from './auth.js';

/**
 * UI Utilities, Icons, Toasts, Modals, and Renderers.
 */
export const ICONS = {
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
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

export function $(sel) { return document.querySelector(sel); }
export function $$(sel) { return document.querySelectorAll(sel); }
export function matchesQuery(text, query) {
  return String(text || '').toLowerCase().includes(String(query || '').trim().toLowerCase());
}

export function showToast(message, type = 'success') {
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

export function icon(name) {
  return `<span class="icon">${ICONS[name] || ''}</span>`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export function renderStars(score, maxScore = 5, interactive = false) {
  let html = `<div class="star-rating" data-value="${score || 0}">`;
  for (let i = 1; i <= maxScore; i++) {
    const filled = i <= score ? 'filled' : '';
    const clickAttr = interactive ? `data-star="${i}"` : '';
    html += `<span class="star ${filled}" ${clickAttr}>★</span>`;
  }
  html += '</div>';
  return html;
}

export function bindStars(root) {
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

export function levelLabel(score) {
  const map = { 1: 'مبتدئ', 2: 'أساسي', 3: 'متوسط', 4: 'متقدم', 5: 'خبير' };
  return map[score] || 'غير محدد';
}

export function getBadgeClass(status) {
  const map = {
    'مكتمل': 'badge-success', completed: 'badge-success', approved: 'badge-success', جيد: 'badge-success',
    'قيد التنفيذ': 'badge-warning', in_progress: 'badge-warning', enrolled: 'badge-info', 'يحتاج متابعة': 'badge-warning',
    draft: 'badge-muted', pending: 'badge-warning', pending_manager: 'badge-warning', pending_hr: 'badge-warning',
    rejected: 'badge-danger', 'مرفوض': 'badge-danger', 'معلق': 'badge-danger', 'متأخر': 'badge-danger', failed: 'badge-danger',
  };
  return map[status] || 'badge-info';
}

export function getStatusArabic(status) {
  const map = {
    completed: 'مكتمل', in_progress: 'قيد التنفيذ', enrolled: 'مسجّل',
    approved: 'معتمدة', draft: 'مسودة', pending_manager: 'بانتظار موافقة المدير',
    pending_hr: 'بانتظار اعتماد HR', rejected: 'مرفوض للتعديل',
    active: 'جارية', pending: 'قيد الانتظار', failed: 'فشل',
  };
  return map[status] || status;
}

export function progressBarColor(percentage) {
  if (percentage >= 70) return 'green';
  if (percentage >= 40) return 'blue';
  if (percentage >= 20) return 'orange';
  return 'red';
}

export function progressRow(label, percent, extra = '') {
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

export function getRoleArabic(role) {
  const map = { admin: 'مدير النظام', hr: 'مدير الموارد البشرية', manager: 'المدير المباشر', employee: 'موظف' };
  return map[role] || role;
}

export function getActionLabel(action) {
  const labels = { login: 'تسجيل دخول', create_employee: 'إضافة موظف', update_employee: 'تعديل موظف', create_skill: 'إضافة مهارة', create_assessment: 'تقييم مهارات', create_course: 'إضافة دورة', create_plan: 'إنشاء خطة', complete_course: 'إكمال دورة', generate_recommendation: 'توليد توصية' };
  return labels[action] || action || '—';
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? String(value) : `${date.toLocaleDateString('ar-EG')} · ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
}

export function signedGain(value) { const number = Number(value || 0); return number > 0 ? `+${number}` : String(number); }
export function reportOverviewHtml(overview) {
  if (!overview) return empty('تعذر تحميل ملخص التقارير');
  const statuses = overview.plan_statuses || {};
  const gaps = overview.top_skill_gaps || [];
  return `<div class="grid-2 mb-xl"><div class="notification-item">النطاق: <strong>${escapeHtml(overview.scope || '—')}</strong> · الموظفون: <strong>${overview.employee_count ?? 0}</strong></div><div class="notification-item">متوسط التقييم: <strong>${overview.average_assessment ?? 0}/5</strong> · التقييمات: <strong>${overview.assessment_count ?? 0}</strong></div><div class="notification-item">إكمال الدورات: <strong>${overview.course_completion_rate ?? 0}%</strong></div><div class="notification-item">بانتظار المدير: <strong>${statuses.pending_manager ?? 0}</strong> · بانتظار HR: <strong>${statuses.pending_hr ?? 0}</strong></div></div><h4 class="text-title mb-sm">أكبر فجوات المهارات</h4><div class="notification-list">${gaps.length ? gaps.map((gap) => `<div class="notification-item"><strong>${escapeHtml(gap.skill_name)}</strong><span class="text-body-sm text-muted"> ${gap.affected_employees} موظف · إجمالي فجوة ${gap.total_gap}</span></div>`).join('') : empty('لا توجد فجوات مهارية معلقة')}</div>`;
}
export function empty(message, actionHtml = '') { return `<div class="empty-state"><div class="empty-mark">—</div><p>${escapeHtml(message)}</p>${actionHtml}</div>`; }
export async function withBusy(button, operation) {
  if (!button) return operation();
  const previous = button.disabled;
  button.disabled = true; button.classList.add('is-busy');
  try { return await operation(); } finally { button.disabled = previous; button.classList.remove('is-busy'); }
}
export function optionList(items, valueKey, labelKey, placeholder) {
  return `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}</option>`).join('')}`;
}

function navItem(href, iconName, label) {
  const current = window.location.pathname.split('/').pop();
  const active = current === href.replace('/', '').split('#')[0] ? 'active' : '';
  return `<a class="nav-item ${active}" href="${href}">${icon(iconName)} ${label}</a>`;
}
function sidebarFor(role) {
  const pages = {
    admin: [['/admin.html', 'home', 'لوحة التحكم'], ['/admin.html#users', 'users', 'المستخدمون'], ['/admin.html#courses', 'course', 'الدورات'], ['/admin.html#reports', 'chart', 'التقارير'], ['/admin.html#audit', 'assess', 'سجل النشاط']],
    hr: [['/hr.html', 'home', 'لوحة التحكم'], ['/hr.html#employees', 'users', 'الموظفون'], ['/hr-plans.html', 'plan', 'الخطط التدريبية'], ['/hr.html#reports', 'chart', 'التقارير']],
    manager: [['/manager.html', 'home', 'لوحة التحكم'], ['/manager.html#assess', 'assess', 'التقييمات'], ['/manager.html#team', 'users', 'الفريق']],
    employee: [['/employee.html', 'home', 'لوحتي'], ['/employee-assess.html', 'assess', 'التقييم الذاتي'], ['/employee-plan.html', 'plan', 'خطتي التدريبية'], ['/employee-courses.html', 'course', 'الدورات']],
  };
  return (pages[role] || pages.employee).map(([href, iconName, label]) => navItem(href, iconName, label)).join('');
}

// The HttpOnly session cookie is the source of truth.  localStorage is only a UI cache.
export async function initPage() {
  const user = await API.me();
  if (!user) return false;
  Auth.setSession(user);
  if ($('#user-name')) $('#user-name').textContent = user.name;
  if ($('#user-role')) $('#user-role').textContent = getRoleArabic(user.role);
  if ($('#user-avatar')) $('#user-avatar').textContent = (user.name || '?').charAt(0);
  if ($('#sidebar-nav')) $('#sidebar-nav').innerHTML = sidebarFor(user.role);
  $('#mobile-menu-btn')?.addEventListener('click', () => $('.sidebar')?.classList.toggle('open'));
  $('#logout-btn')?.addEventListener('click', () => Auth.logout());
  return true;
}

export function exportProgressCsv() {
  fetch('/api/reports/export/csv', { credentials: 'same-origin' }).then((response) => {
    if (!response.ok) throw new Error('تعذر تصدير التقرير');
    return response.blob();
  }).then((blob) => {
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'training-progress.csv'; link.click(); URL.revokeObjectURL(url);
    showToast('تم تصدير تقرير التقدم');
  }).catch((error) => showToast(error.message, 'error'));
}

export function exportProgressPdf() {
  const reportWindow = window.open('/api/reports/export/pdf', '_blank');
  if (!reportWindow) showToast('اسمح للنوافذ المنبثقة لتصدير تقرير PDF', 'error');
  else reportWindow.opener = null;
}

export function showRecommendationDetails(recommendation, employeeName = '') {
  const overlay = ensureOverlay();
  const gaps = recommendation?.skill_gaps || [];
  const courses = recommendation?.recommended_courses || [];
  $('#modal-title').textContent = employeeName ? `توصية تدريبية: ${employeeName}` : 'التوصية التدريبية';
  $('#modal-body').innerHTML = `<div class="ai-banner mb-xl"><div class="ai-banner-header">${icon('spark')} توصية تجريبية استرشادية</div><div class="ai-banner-body">درجة الثقة: ${Math.round((recommendation?.confidence_score || 0) * 100)}%. لا تُحدّث مستويات المهارات تلقائيًا؛ يلزم تقييم المدير واعتماده.</div></div>
    <h4 class="text-title mb-sm">الفجوات ذات الأولوية</h4><div class="notification-list mb-xl">${gaps.length ? gaps.map((gap) => `<div class="notification-item"><strong>${escapeHtml(gap.skill_name || 'مهارة')}</strong><span class="text-body-sm text-muted"> الحالي ${gap.current_level ?? '—'}/5 · المستهدف ${gap.target_level ?? '—'}/5 · الفجوة ${gap.gap_percentage ?? 0}%</span></div>`).join('') : empty('لا توجد فجوات كافية لتوليد توصية')}</div>
    <h4 class="text-title mb-sm">الدورات المقترحة</h4><div class="notification-list">${courses.length ? courses.slice(0, 6).map((course) => `<div class="notification-item"><strong>${escapeHtml(course.course_title || 'دورة')}</strong><div class="text-body-sm text-muted">${escapeHtml(course.skill_name || '')} · تحسن متوقع +${course.predicted_gain ?? 0} · ${escapeHtml(course.reason || 'مطابقة لفجوة المهارة')}</div></div>`).join('') : empty('لا توجد دورات مطابقة حاليًا')}</div>`;
  $('#modal-footer').innerHTML = '<button class="btn btn-primary" type="button" id="modal-cancel">إغلاق</button>';
  $('#modal-cancel').onclick = () => closeModal(overlay);
  openModal(overlay);
}

function closeModal(overlay) { overlay?.classList.remove('open'); }
function openModal(overlay) {
  overlay.classList.add('open');
  overlay.querySelector('input, select, textarea')?.focus();
}
function ensureOverlay() {
  let overlay = $('#app-modal');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'app-modal'; overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-header"><h3 id="modal-title"></h3><button class="modal-close" type="button" aria-label="إغلاق">×</button></div>
    <div class="modal-body" id="modal-body"></div><div class="modal-footer" id="modal-footer"></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(overlay); });
  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.classList.contains('open')) closeModal(overlay); });
  return overlay;
}
function field(id, label, control, required = false, span = '') {
  return `<div class="form-group ${span}"><label class="form-label" for="${id}">${label}${required ? ' <span class="required-mark">*</span>' : ''}</label>${control}</div>`;
}
function modalActions(overlay, label, save) {
  $('#modal-footer').innerHTML = `<button class="btn btn-secondary" type="button" id="modal-cancel">إلغاء</button><button class="btn btn-primary" type="button" id="modal-save">${label}</button>`;
  $('#modal-cancel').onclick = () => closeModal(overlay);
  $('#modal-save').onclick = save;
}

export async function showEmployeeModal(onSaved, employee = null) {
  const overlay = ensureOverlay();
  let departments; let employees;
  try { [departments, employees] = await Promise.all([API.departments(), API.employees()]); }
  catch (error) { showToast(error.message, 'error'); return; }
  const managers = employees.filter((item) => ['manager', 'hr', 'admin'].includes(item.user_role || item.role));
  $('#modal-title').textContent = employee ? 'تعديل موظف' : 'إضافة موظف';
  $('#modal-body').innerHTML = `<form id="entity-form" class="form-grid">
    ${field('emp-name', 'الاسم الكامل', `<input class="form-input" id="emp-name" required value="${escapeHtml(employee?.user_name || employee?.name || '')}">`, true)}
    ${field('emp-email', 'البريد الإلكتروني', `<input class="form-input" id="emp-email" type="email" required value="${escapeHtml(employee?.user_email || employee?.email || '')}">`, true)}
    ${field('emp-password', employee ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور', `<input class="form-input" id="emp-password" type="password" ${employee ? '' : 'required'}>`, !employee)}
    ${field('emp-role', 'الدور', '<select class="form-select" id="emp-role"><option value="employee">موظف</option><option value="manager">مدير مباشر</option><option value="hr">الموارد البشرية</option><option value="admin">مدير النظام</option></select>', true)}
    ${field('emp-position', 'المسمى الوظيفي', `<input class="form-input" id="emp-position" value="${escapeHtml(employee?.position || '')}">`)}
    ${field('emp-dept', 'القسم', `<select class="form-select" id="emp-dept">${optionList(departments, 'id', 'name', 'بدون قسم')}</select>`)}
    ${field('emp-manager', 'المدير المباشر', `<select class="form-select" id="emp-manager">${optionList(managers, 'id', 'user_name', 'بدون مدير')}</select>`)}
    ${field('emp-phone', 'الهاتف', `<input class="form-input" id="emp-phone" type="tel" value="${escapeHtml(employee?.phone || '')}">`)}
    ${field('emp-hire', 'تاريخ التعيين', `<input class="form-input" id="emp-hire" type="date" value="${escapeHtml(employee?.hire_date || '')}">`)}
  </form>`;
  $('#emp-role').value = employee?.user_role || employee?.role || 'employee';
  if (employee?.department_id) $('#emp-dept').value = employee.department_id;
  if (employee?.manager_id) $('#emp-manager').value = employee.manager_id;
  modalActions(overlay, 'حفظ', async () => {
    const payload = { name: $('#emp-name').value.trim(), email: $('#emp-email').value.trim(), role: $('#emp-role').value, position: $('#emp-position').value.trim() || null, department_id: Number($('#emp-dept').value) || null, manager_id: Number($('#emp-manager').value) || null, phone: $('#emp-phone').value.trim() || null, hire_date: $('#emp-hire').value || null };
    const password = $('#emp-password').value;
    if (!payload.name || !payload.email || (!employee && !password)) return showToast('الاسم والبريد وكلمة المرور مطلوبة', 'error');
    if (password) payload.password = password;
    try { await withBusy($('#modal-save'), () => employee ? API.updateEmployee(employee.id, payload) : API.createEmployee(payload)); closeModal(overlay); showToast('تم حفظ الموظف'); await onSaved?.(); }
    catch (error) { showToast(error.message, 'error'); }
  });
  openModal(overlay);
}

export async function showCourseModal(onSaved) {
  const overlay = ensureOverlay(); let skills;
  try { skills = await API.skills(); } catch (error) { showToast(error.message, 'error'); return; }
  $('#modal-title').textContent = 'إضافة دورة';
  $('#modal-body').innerHTML = `<form class="form-grid">
    ${field('course-title', 'عنوان الدورة', '<input class="form-input" id="course-title" required>', true, 'span-2')}
    ${field('course-desc', 'الوصف', '<textarea class="form-textarea" id="course-desc"></textarea>', false, 'span-2')}
    ${field('course-skill', 'المهارة المرتبطة', `<select class="form-select" id="course-skill">${optionList(skills, 'id', 'name', 'بدون مهارة')}</select>`)}
    ${field('course-level', 'المستوى', '<select class="form-select" id="course-level"><option value="1">1 مبتدئ</option><option value="2">2 أساسي</option><option value="3" selected>3 متوسط</option><option value="4">4 متقدم</option><option value="5">5 خبير</option></select>')}
    ${field('course-hours', 'المدة بالساعات', '<input class="form-input" id="course-hours" type="number" min="1" value="10">')}
    ${field('course-type', 'نوع الدورة', '<select class="form-select" id="course-type"><option value="online">إلكترونية</option><option value="classroom">حضورية</option><option value="workshop">ورشة عمل</option></select>')}
    ${field('course-provider', 'الجهة المقدمة', '<input class="form-input" id="course-provider">')}
    ${field('course-cost', 'التكلفة', '<input class="form-input" id="course-cost" type="number" min="0" value="0">')}
  </form>`;
  modalActions(overlay, 'حفظ الدورة', async () => {
    const title = $('#course-title').value.trim(); if (!title) return showToast('عنوان الدورة مطلوب', 'error');
    const payload = { title, description: $('#course-desc').value.trim() || null, skill_id: Number($('#course-skill').value) || null, level: Number($('#course-level').value), duration_hours: Number($('#course-hours').value), type: $('#course-type').value, provider: $('#course-provider').value.trim() || null, cost: Number($('#course-cost').value) || 0 };
    try { await withBusy($('#modal-save'), () => API.createCourse(payload)); closeModal(overlay); showToast('تمت إضافة الدورة'); await onSaved?.(); } catch (error) { showToast(error.message, 'error'); }
  });
  openModal(overlay);
}

export async function showSkillModal(onSaved) {
  const overlay = ensureOverlay(); $('#modal-title').textContent = 'إضافة مهارة';
  $('#modal-body').innerHTML = `<form>${field('skill-name', 'اسم المهارة', '<input class="form-input" id="skill-name" required>', true)}${field('skill-cat', 'التصنيف', '<select class="form-select" id="skill-cat"><option value="تقنية">تقنية</option><option value="مهارات ناعمة">مهارات ناعمة</option><option value="لغات">لغات</option></select>')}${field('skill-desc', 'الوصف', '<textarea class="form-textarea" id="skill-desc"></textarea>')}</form>`;
  modalActions(overlay, 'حفظ', async () => { const name = $('#skill-name').value.trim(); if (!name) return showToast('اسم المهارة مطلوب', 'error'); try { await withBusy($('#modal-save'), () => API.createSkill({ name, category: $('#skill-cat').value, description: $('#skill-desc').value.trim() || null })); closeModal(overlay); showToast('تمت إضافة المهارة'); await onSaved?.(); } catch (error) { showToast(error.message, 'error'); } }); openModal(overlay);
}

export async function showDepartmentModal(onSaved) {
  const overlay = ensureOverlay(); $('#modal-title').textContent = 'إضافة قسم';
  $('#modal-body').innerHTML = `<form>${field('dept-name', 'اسم القسم', '<input class="form-input" id="dept-name" required>', true)}${field('dept-desc', 'الوصف', '<textarea class="form-textarea" id="dept-desc"></textarea>')}</form>`;
  modalActions(overlay, 'حفظ', async () => { const name = $('#dept-name').value.trim(); if (!name) return showToast('اسم القسم مطلوب', 'error'); try { await withBusy($('#modal-save'), () => API.createDepartment({ name, description: $('#dept-desc').value.trim() || null })); closeModal(overlay); showToast('تمت إضافة القسم'); await onSaved?.(); } catch (error) { showToast(error.message, 'error'); } }); openModal(overlay);
}

export async function showPlanModal(onSaved) {
  const overlay = ensureOverlay(); let employees; let courses;
  try { [employees, courses] = await Promise.all([API.employees(), API.courses()]); } catch (error) { showToast(error.message, 'error'); return; }
  $('#modal-title').textContent = 'إنشاء خطة تدريبية';
  $('#modal-body').innerHTML = `<form>${field('plan-emp', 'الموظف', `<select class="form-select" id="plan-emp">${optionList(employees, 'id', 'user_name', 'اختر الموظف')}</select>`, true)}${field('plan-start', 'تاريخ البداية', `<input class="form-input" id="plan-start" type="date" value="${new Date().toISOString().slice(0, 10)}">`)}${field('plan-end', 'تاريخ النهاية', '<input class="form-input" id="plan-end" type="date">')}<div class="form-group"><label class="form-label">الدورات *</label><div class="checkbox-list" id="plan-courses">${courses.map((course) => `<label class="checkbox-item"><input type="checkbox" value="${course.id}"> ${escapeHtml(course.title)}</label>`).join('') || empty('أضف دورة أولًا')}</div></div><label class="checkbox-item"><input type="checkbox" id="plan-approve"> اعتماد الخطة مباشرة</label></form>`;
  modalActions(overlay, 'إنشاء الخطة', async () => { const employeeId = Number($('#plan-emp').value); const courseIds = [...$$('#plan-courses input:checked')].map((item) => Number(item.value)); if (!employeeId || !courseIds.length) return showToast('اختر الموظف ودورة واحدة على الأقل', 'error'); try { await withBusy($('#modal-save'), () => API.createTrainingPlan({ employee_id: employeeId, start_date: $('#plan-start').value || null, end_date: $('#plan-end').value || null, course_ids: courseIds, auto_approve: $('#plan-approve').checked })); closeModal(overlay); showToast('تم إنشاء الخطة'); await onSaved?.(); } catch (error) { showToast(error.message, 'error'); } }); openModal(overlay);
}
export async function showCourseDetails(courseId, onChanged) {
  const overlay = ensureOverlay();
  $('#modal-title').textContent = 'تفاصيل الدورة';
  $('#modal-body').innerHTML = '<div class="loading-overlay"><div class="spinner"></div> جارٍ التحميل...</div>';
  $('#modal-footer').innerHTML = '';
  openModal(overlay);

  let course; let reviews;
  try {
    [course, reviews] = await Promise.all([API.course(courseId), API.courseReviews(courseId).catch(() => [])]);
  } catch (error) {
    closeModal(overlay); showToast(error.message, 'error'); return;
  }

  const courseTypes = { online: 'إلكترونية', classroom: 'حضورية', workshop: 'ورشة عمل', conference: 'مؤتمر' };
  const enrollment = course.enrollment;
  const isEmployee = Auth.getUser()?.role === 'employee';
  const meta = [
    ['المهارة', course.skill_name || '—'], ['المستوى', `${course.level || '—'}/5`],
    ['المدة', course.duration_hours ? `${course.duration_hours} ساعة` : '—'], ['النوع', courseTypes[course.type] || course.type || '—'],
    ['الجهة المقدمة', course.provider || '—'], ['التكلفة', course.cost ? `${course.cost} دولار` : 'مجانية'],
    ['المسجلون', course.enrolled_count ?? 0], ['التقييم', course.reviews_count ? `${course.avg_rating}/5 (${course.reviews_count})` : 'لا توجد تقييمات'],
  ];
  const reviewsHtml = reviews.length ? reviews.map((review) => `<div class="notification-item"><div class="avatar">${escapeHtml((review.employee_name || '?').charAt(0))}</div><div><strong>${escapeHtml(review.employee_name || 'مستخدم')}</strong>${renderStars(review.rating, 5)}<div class="text-body-sm text-muted">${escapeHtml(review.comment || '')}</div></div></div>`).join('') : empty('لا توجد تقييمات بعد');
  $('#modal-body').innerHTML = `<p class="text-body-lg mb-xl">${escapeHtml(course.description || 'لا يوجد وصف لهذه الدورة.')}</p>
    <div class="impact-grid mb-xl">${meta.map(([label, value]) => `<div class="impact-card"><div class="impact-meta">${escapeHtml(label)}</div><div class="text-title">${escapeHtml(value)}</div></div>`).join('')}</div>
    ${enrollment ? `<div class="ai-banner mb-xl">حالة تسجيلك: <span class="badge ${getBadgeClass(enrollment.status)}">${escapeHtml(getStatusArabic(enrollment.status))}</span></div>` : ''}
    <h4 class="text-title mb-sm">تقييمات الموظفين</h4><div class="notification-list">${reviewsHtml}</div>`;

  const actions = ['<button class="btn btn-ghost" type="button" id="modal-cancel">إغلاق</button>'];
  if (isEmployee) {
    actions.unshift(`<button class="btn ${course.is_favorite ? 'btn-secondary' : 'btn-ghost'}" type="button" id="fav-btn">${course.is_favorite ? '★ في المفضلة' : '☆ أضف للمفضلة'}</button>`);
    if (!enrollment || enrollment.status === 'failed') actions.unshift('<button class="btn btn-primary" type="button" id="enroll-btn">التسجيل في الدورة</button>');
  }
  $('#modal-footer').innerHTML = actions.join('');
  $('#modal-cancel').onclick = () => closeModal(overlay);
  $('#fav-btn')?.addEventListener('click', async (event) => {
    try { const result = await withBusy(event.currentTarget, () => API.toggleFavorite(courseId)); showToast(result.message); await onChanged?.(); await showCourseDetails(courseId, onChanged); }
    catch (error) { showToast(error.message, 'error'); }
  });
  $('#enroll-btn')?.addEventListener('click', async (event) => {
    try { const result = await withBusy(event.currentTarget, () => API.enrollCourse(courseId)); showToast(result.message); closeModal(overlay); await onChanged?.(); }
    catch (error) { showToast(error.message, 'error'); }
  });
}
