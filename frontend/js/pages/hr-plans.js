/**
 * Page module: HR Training Plans Review and Approvals.
 */
import { API } from '../modules/api.js';
import { $, $$, escapeHtml, matchesQuery, getBadgeClass, getStatusArabic, icon, showToast, withBusy, showPlanModal, showCourseModal, initPage, empty } from '../modules/ui.js';

export async function initHrPlansPage() {
  if (!await initPage()) return;
  const plans = await API.trainingPlans();
  const counts = {
    draft: plans.filter((p) => p.status === 'pending_hr').length,
    approved: plans.filter((p) => p.status === 'approved').length,
    active: plans.filter((p) => p.status === 'active').length,
    completed: plans.filter((p) => p.status === 'completed').length,
    rejected: plans.filter((p) => p.status === 'rejected').length,
  };
  if ($('#tab-draft')) $('#tab-draft').textContent = `تنتظر الاعتماد (${counts.draft})`;
  if ($('#tab-approved')) $('#tab-approved').textContent = `معتمدة (${counts.approved})`;
  if ($('#tab-active')) $('#tab-active').textContent = `جارية (${counts.active})`;
  if ($('#tab-completed')) $('#tab-completed').textContent = `مكتملة (${counts.completed})`;
  if ($('#tab-rejected')) $('#tab-rejected').textContent = `مرفوضة (${counts.rejected})`;

  let current = 'draft';
  const search = $('#plan-search');
  const render = () => {
    const q = (search?.value || '').trim();
    const dept = $('#plan-dept')?.value || '';
    const list = plans.filter((p) => {
      const matchesStatus = current === 'draft' ? p.status === 'pending_hr' : p.status === current;
      return matchesStatus && matchesQuery(`${p.employee_name} ${p.department_name}`, q) && (!dept || p.department_name === dept);
    });
    const plansListEl = $('#plans-list');
    if (plansListEl) {
      plansListEl.innerHTML = list.length ? list.map((p) => `
        <div class="plan-card">
          <div class="plan-card-header">
            <div class="plan-employee-info">
              <div class="avatar">${(p.employee_name || 'م').charAt(0)}</div>
              <div>
                <div class="text-title">${escapeHtml(p.employee_name || '—')}</div>
                <div class="text-body-sm text-muted">${escapeHtml(p.department_name || '')}</div>
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
            <div class="ai-banner-body">${escapeHtml(p.ai_reason || 'لا يوجد شرح بعد.')}</div>
          </div>
          <div class="plan-courses">
            ${(p.enrollments || []).map((e) => `<span class="course-chip">${escapeHtml(e.course_title || 'دورة')} · ${getStatusArabic(e.status)}</span>`).join('') || 'لا توجد دورات'}
          </div>
          ${p.manager_notes ? `<div class="text-body-sm text-secondary mb-sm">ملاحظات المدير: ${escapeHtml(p.manager_notes)}</div>` : ''}
          ${p.status === 'pending_hr' ? `
          <div class="plan-actions">
            <button class="btn btn-success btn-sm" data-approve="${p.id}">اعتماد نهائي (HR)</button>
            <button class="btn btn-danger btn-sm" data-reject="${p.id}">رفض وإعادة للمسودة</button>
          </div>` : ''}
        </div>`).join('') : empty('لا توجد خطط في هذا التبويب');
    }
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
    $('#plan-dept').innerHTML = '<option value="">كل الأقسام</option>' + depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    $('#plan-dept').addEventListener('change', render);
  }
  search?.addEventListener('input', render);
  $('#add-plan-btn')?.addEventListener('click', () => showPlanModal(() => window.location.reload()));
  $('#add-course-btn')?.addEventListener('click', () => showCourseModal(() => window.location.reload()));

  $('#plans-list')?.addEventListener('click', async (ev) => {
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
}

