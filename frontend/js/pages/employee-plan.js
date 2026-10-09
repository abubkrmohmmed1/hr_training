/**
 * Page module: Employee Training Plan & Impact Predictions.
 */
import { API } from '../modules/api.js';
import { $, escapeHtml, getBadgeClass, getStatusArabic, icon, showToast, withBusy, progressRow, initPage, empty } from '../modules/ui.js';

function normalizePlans(response) {
  if (Array.isArray(response)) return response;
  if (response?.id) return [response];
  if (response?.plan?.id) return [response.plan];
  return [];
}

function courseActions(enrollment, planApproved) {
  if (!planApproved) {
    return `<button class="btn btn-muted btn-sm" disabled>بانتظار اعتماد الخطة</button>`;
  }
  if (enrollment.status === 'completed') {
    return `<button class="btn btn-success btn-sm" disabled>مكتملة</button>`;
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

export async function initEmployeePlanPage() {
  if (!await initPage()) return;
  const [plans, impact] = await Promise.all([
    API.myTrainingPlans(),
    API.myImpact().catch(() => null),
  ]);

  if (impact) {
    const banner = $('#impact-banner');
    if (banner) {
      banner.innerHTML = `
        <div class="ai-banner-header">${icon('spark')} تقدير أثر التدريب</div>
        <div class="ai-banner-body">
          <p>${escapeHtml(impact.summary)}</p>
          <p class="mt-sm text-body-sm">تنبيه: التوقع تقدير تجريبي مبني على بيانات صناعية، وليس قياسًا فعليًا لأداء الموظف.</p>
          <p class="mt-sm text-body-sm">النموذج: ${escapeHtml(impact.model.algorithm)} · جودة الملاءمة R² = ${impact.model.r2}</p>
        </div>`;
    }
    const impactCourses = $('#impact-courses');
    if (impactCourses) {
      impactCourses.innerHTML = (impact.courses || []).map((c) => `
        <div class="impact-card">
          <h4>${escapeHtml(c.course_title)}</h4>
          <div class="impact-meta">${escapeHtml(c.skill_name)} · ${c.duration_hours} ساعة</div>
          <div class="mt-sm">تحسن متوقع: <strong>${c.predicted_gain}</strong> درجة</div>
          <div class="impact-meta">من ${c.expected_level - c.predicted_gain} إلى نحو ${c.expected_level}/5</div>
        </div>`).join('') || empty('لا توجد دورات مقترحة');
    }
  }

  const planList = normalizePlans(plans);
  const plansWrap = $('#plans-wrap');
  if (plansWrap) {
    plansWrap.innerHTML = planList.length ? planList.map((p) => `
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
          <button class="btn btn-primary btn-sm mb-md" data-resubmit="${p.id}">إعادة تقديم الخطة</button>
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
        <p class="text-body-sm text-secondary mb-lg">${escapeHtml(p.ai_reason || '')}</p>
        ${(p.enrollments || []).map((e) => {
          const percent = e.status === 'completed' ? 100 : e.status === 'in_progress' ? 50 : 15;
          return `<div class="course-row">${progressRow(e.course_title, percent, getStatusArabic(e.status))}${courseActions(e, p.is_approved)}</div>`;
        }).join('')}
      </div>`).join('') : empty('لا توجد خطة بعد. أكمل التقييم الذاتي أولاً.', '<a class="btn btn-primary btn-sm" href="/employee-assess.html">التقييم الذاتي</a>');

    plansWrap.onclick = async (ev) => {
      const startBtn = ev.target.closest('[data-start]');
      const doneBtn = ev.target.closest('[data-complete]');
      const resubmitBtn = ev.target.closest('[data-resubmit]');
      try {
        if (startBtn) {
          await withBusy(startBtn, () => API.startEnrollment(startBtn.dataset.start));
          showToast('تم بدء الدورة');
          initEmployeePlanPage();
        }
        if (doneBtn) {
          const raw = document.querySelector(`[data-score="${doneBtn.dataset.complete}"]`)?.value;
          const score = raw === '' || raw == null ? null : Number(raw);
          await withBusy(doneBtn, () => API.completeEnrollment(doneBtn.dataset.complete, score));
          showToast('تم إكمال الدورة');
          initEmployeePlanPage();
        }
        if (resubmitBtn) {
          await withBusy(resubmitBtn, () => API.resubmitPlan(resubmitBtn.dataset.resubmit));
          showToast('تمت إعادة تقديم الخطة للمراجعة');
          initEmployeePlanPage();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
}
