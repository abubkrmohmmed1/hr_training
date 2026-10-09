/**
 * Page module: Employee Dashboard, progress KPIs, and plan roadmap.
 */
import { API } from '../modules/api.js';
import { $, escapeHtml, getBadgeClass, getStatusArabic, icon, signedGain, showToast, withBusy, progressRow, initPage, empty } from '../modules/ui.js';

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

export async function initEmployeePage() {
  if (!await initPage()) return;
  const [stats, profile, plans, impact, actual] = await Promise.all([
    API.employeeStats(),
    API.myProfile(),
    API.myTrainingPlans(),
    API.myImpact().catch(() => null),
    API.myActualImpact().catch(() => null),
  ]);
  
  const kpiProgress = $('#kpi-progress');
  if (kpiProgress) kpiProgress.textContent = `${stats.overall_progress}%`;
  const kpiAssess = $('#kpi-assess');
  if (kpiAssess) kpiAssess.textContent = stats.completed_assessments;
  const kpiCourses = $('#kpi-courses');
  if (kpiCourses) kpiCourses.textContent = stats.courses_in_plan;

  const employeePlans = normalizePlans(plans);
  const enrollments = employeePlans.flatMap((p) => (p.enrollments || []).map((e) => ({ ...e, approved: p.is_approved, planStatus: p.status })));
  
  const planList = $('#plan-list');
  if (planList) {
    planList.innerHTML = enrollments.length
      ? enrollments.map((e) => {
        const percent = e.status === 'completed' ? 100 : e.status === 'in_progress' ? 50 : 15;
        return `<div class="course-row">${progressRow(e.course_title, percent, getStatusArabic(e.status))}${courseActions(e, e.approved)}</div>`;
      }).join('')
      : empty('لا توجد دورات في خطتك بعد', '<a class="btn btn-primary btn-sm" href="/employee-assess.html">ابدأ التقييم الذاتي</a>');

    planList.onclick = async (ev) => {
      const startBtn = ev.target.closest('[data-start]');
      const doneBtn = ev.target.closest('[data-complete]');
      try {
        if (startBtn) {
          await withBusy(startBtn, () => API.startEnrollment(startBtn.dataset.start));
          showToast('تم بدء الدورة');
          initEmployeePage();
        }
        if (doneBtn) {
          const raw = document.querySelector(`[data-score="${doneBtn.dataset.complete}"]`)?.value;
          const score = raw === '' || raw == null ? null : Number(raw);
          await withBusy(doneBtn, () => API.completeEnrollment(doneBtn.dataset.complete, score));
          showToast('تم إكمال الدورة');
          initEmployeePage();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  const gaps = impact?.skill_gaps || [];
  const gapList = $('#gap-list');
  if (gapList) {
    gapList.innerHTML = gaps.length
      ? gaps.map((g) => progressRow(g.skill_name, Math.max(0, 100 - g.gap_percentage), `${g.current_level}/${g.target_level}`)).join('')
      : empty('أكمل التقييم الذاتي لعرض الفجوات');
  }

  const actualBox = $('#actual-impact');
  if (actualBox) {
    if (!actual) {
      actualBox.innerHTML = empty('لا يتوفر أثر فعلي حتى الآن');
    } else {
      const impactStatus = (status) => ({
        approved: '<span class="badge badge-success">معتمد بعد تقييم المدير</span>',
        pending_approval: '<span class="badge badge-warning">بانتظار تقييم واعتماد المدير</span>',
        rejected: '<span class="badge badge-danger">لم يعتمد المدير التحسن</span>',
      }[status] || '<span class="badge badge-muted">غير محدد</span>');
      const records = (actual.records || []).map((r) => `
        <tr>
          <td>${escapeHtml(r.skill_name || '—')}</td>
          <td>${r.previous_level}/5</td>
          <td>${r.new_level}/5</td>
          <td><span class="badge badge-success">${signedGain(r.gain)}</span></td>
          <td>${impactStatus(r.status)}</td>
          <td>${escapeHtml(r.recorded_date || '—')}</td>
        </tr>`).join('');
      actualBox.innerHTML = `
        <div class="ai-banner mb-xl"><div class="ai-banner-header">${icon('assess')} تقييم المدير مطلوب</div><div class="ai-banner-body">إكمال الدورة يسجل أثراً تقديرياً فقط. لا يُحدّث مستوى المهارة ولا يُحسب التحسن كأثر فعلي إلا بعد أن يقيّمه المدير المباشر ويعتمده.</div></div>
        <div class="grid-2 mb-xl">
          <div class="notification-item">${icon('course')} دورات مكتملة: <strong>${actual.completed_courses}</strong></div>
          <div class="notification-item">${icon('spark')} الأثر الفعلي: <strong>${signedGain(actual.actual_gain)}</strong> درجة</div>
          <div class="notification-item">${icon('chart')} الأثر المتوقع: <strong>${signedGain(actual.predicted_gain)}</strong> درجة</div>
          <div class="notification-item">${icon('assess')} ${escapeHtml(actual.summary)}</div>
        </div>
        ${records ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>المهارة</th><th>قبل</th><th>بعد</th><th>التحسن المقترح</th><th>حالة التقييم</th><th>التاريخ</th></tr></thead>
          <tbody>${records}</tbody></table></div>` : empty('أكمل دورة لتسجيل الأثر الفعلي')}`;
    }
  }

  const notifList = $('#notif-list');
  if (notifList) {
    notifList.innerHTML = `
      <div class="notification-item">${icon('spark')} ${escapeHtml(impact?.summary || 'لا يوجد تقدير أثر بعد')}</div>
      <div class="notification-item">${icon('plan')} عدد الدورات في خطتك: ${enrollments.length}</div>
      <div class="notification-item">${icon('assess')} مرحباً ${escapeHtml(profile.user_name)} — ${escapeHtml(profile.position || '')}</div>`;
  }
}

