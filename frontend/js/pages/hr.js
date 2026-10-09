/**
 * Page module: HR Dashboard, skill matrix, and employee directory.
 */
/**
 * Page module: HR Dashboard, skill matrix, and employee directory.
 */
import { API } from '../modules/api.js';
import { $, $$, escapeHtml, matchesQuery, getBadgeClass, getStatusArabic, icon, signedGain, showToast, withBusy, exportProgressCsv, exportProgressPdf, reportOverviewHtml, showRecommendationDetails, showEmployeeModal, showDepartmentModal, initPage, empty } from '../modules/ui.js';

export async function initHrPage() {
  if (!await initPage()) return;
  const stats = await API.hrStats();
  if ($('#kpi-employees')) $('#kpi-employees').textContent = stats.total_employees;
  if ($('#kpi-pending')) $('#kpi-pending').textContent = stats.pending_assessments;
  if ($('#kpi-training')) $('#kpi-training').textContent = stats.in_training;
  if ($('#kpi-plans')) $('#kpi-plans').textContent = stats.pending_plans;

  const [needs, performance, recs, employees, impact, progress, decision, overview] = await Promise.all([
    API.trainingNeeds(),
    API.performance(),
    API.recommendations(),
    API.employees(),
    API.trainingImpact(),
    API.trainingProgress(),
    API.decisionSummary(),
    API.reportOverview(),
  ]);

  if ($('#role-report-overview')) $('#role-report-overview').innerHTML = reportOverviewHtml(overview);

  const ctx = document.getElementById('needsChart');
  if (ctx && window.Chart) {
    window.Chart.getChart(ctx)?.destroy();
    new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: needs.map((n) => n.skill_name),
        datasets: [{
          data: needs.map((n) => n.gap_count),
          backgroundColor: ['#1E4FCD', '#059669', '#6366F1', '#D97706', '#0EA5E9'],
          borderWidth: 0,
        }],
      },
      options: { plugins: { legend: { position: 'left', labels: { font: { family: 'IBM Plex Sans Arabic' } } } }, cutout: '62%' },
    });
  }

  const aiRecsBox = $('#ai-recs');
  if (aiRecsBox) {
    const recommendationRows = recs.flatMap((recommendation) => (recommendation.skill_gaps || []).slice(0, 2).map((gap) => ({ ...gap, employee_name: recommendation.employee_name })));
    aiRecsBox.innerHTML = recommendationRows.length ? recommendationRows.slice(0, 8).map((r) => `
      <div class="notification-item">
        ${icon('spark')} يوصى بالتدريب للموظف <strong>${escapeHtml(r.employee_name)}</strong> على مهارة <strong>${escapeHtml(r.skill_name)}</strong>.
        <span class="text-body-sm text-muted">
          المستوى الحالي: ${r.current_level}/5، المستهدف: ${r.target_level}/5، الفجوة: ${r.gap_percentage}%
        </span>
      </div>`).join('') : empty('لا توجد توصيات حالياً');
  }

  const topNeeds = needs.slice(0, 5).map((n) => `
    <div class="notification-item">
      ${icon('skills')} <strong>${escapeHtml(n.skill_name)}</strong> - ${n.gap_count} موظف بحاجة للتدريب.
    </div>`).join('');

  if ($('#decision-box')) {
    if (!decision) {
      $('#decision-box').innerHTML = empty('لا يوجد ملخص دعم قرار بعد');
    } else {
      $('#decision-box').innerHTML = `
        <div class="grid-2 mb-xl">
          <div class="notification-item">${icon('plan')} خطط تنتظر الاعتماد: <strong>${decision.pending_plans}</strong></div>
          <div class="notification-item">${icon('course')} دورات مكتملة: <strong>${decision.completed_courses}</strong></div>
          <div class="notification-item">${icon('spark')} أثر المهارات الكلي: <strong>${signedGain(decision.total_skill_gain)}</strong></div>
          <div class="notification-item">${icon('assess')} ${escapeHtml(decision.decision_note || '')}</div>
        </div>
        <h4 class="text-title mb-sm">أهم احتياجات التدريب</h4>
        <div class="notification-list">${topNeeds || empty('لا توجد فجوات مسجّلة')}</div>`;
    }
  }

  const impactTable = $('#impact-table');
  if (impactTable) {
    impactTable.innerHTML = impact.length ? impact.map((row) => `
      <tr>
        <td>${escapeHtml(row.employee_name)}</td>
        <td>${escapeHtml(row.department_name)}</td>
        <td>${row.completed_courses}</td>
        <td><span class="badge ${row.actual_gain > 0 ? 'badge-success' : 'badge-muted'}">${signedGain(row.actual_gain)}</span></td>
        <td>${signedGain(row.predicted_gain)}</td>
      </tr>`).join('') : `<tr><td colspan="5">${empty('لا يوجد أثر تدريب مسجّل بعد')}</td></tr>`;
  }

  const progressTable = $('#progress-table');
  if (progressTable) {
    progressTable.innerHTML = progress.length ? progress.map((p) => `
      <tr>
        <td>${escapeHtml(p.employee_name)}</td>
        <td><span class="badge ${getBadgeClass(p.status)}">${getStatusArabic(p.status)}</span></td>
        <td>${p.completed_courses}/${p.total_courses}</td>
        <td>
          <div class="progress-bar-container">
            <div class="progress-bar-track"><div class="progress-bar-fill ${p.progress_percent >= 70 ? 'green' : p.progress_percent >= 40 ? 'blue' : 'orange'}" style="width:${p.progress_percent}%"></div></div>
            <span class="progress-label">${p.progress_percent}%</span>
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="4">${empty('لا توجد خطط تدريبية')}</td></tr>`;
  }

  $('#export-csv')?.addEventListener('click', exportProgressCsv);
  $('#export-pdf')?.addEventListener('click', exportProgressPdf);

  const renderEmployees = () => {
    const q = $('#emp-search')?.value || '';
    const dept = $('#emp-dept')?.value || '';
    const rows = employees.filter((e) => matchesQuery(`${e.user_name} ${e.position} ${e.department_name}`, q) && (!dept || String(e.department_id) === dept));
    const empTable = $('#employees-table');
    if (empTable) {
      empTable.innerHTML = rows.length ? rows.map((e) => `
        <tr>
          <td>${escapeHtml(e.user_name)}</td>
          <td>${escapeHtml(e.position || '—')}</td>
          <td>${escapeHtml(e.department_name || '—')}</td>
          <td class="table-actions">
            <button class="btn btn-secondary btn-sm" data-edit="${e.id}">تعديل</button>
            <button class="btn btn-ai btn-sm" data-rec="${e.id}">توليد توصية</button>
          </td>
        </tr>`).join('') : `<tr><td colspan="4">${empty('لا يوجد موظفون مطابقون')}</td></tr>`;
    }
  };

  $('#add-employee-btn')?.addEventListener('click', () => showEmployeeModal(() => window.location.reload()));
  $('#add-dept-btn')?.addEventListener('click', () => showDepartmentModal(() => window.location.reload()));
  const depts = [...new Set(employees.map((e) => JSON.stringify({ id: e.department_id, name: e.department_name })))];
  if ($('#emp-dept')) {
    $('#emp-dept').innerHTML = '<option value="">كل الأقسام</option>' + depts.map((d) => {
      const item = JSON.parse(d);
      return item.id ? `<option value="${item.id}">${escapeHtml(item.name || '')}</option>` : '';
    }).join('');
  }
  $('#emp-search')?.addEventListener('input', renderEmployees);
  $('#emp-dept')?.addEventListener('change', renderEmployees);
  renderEmployees();

  $('#employees-table')?.addEventListener('click', async (ev) => {
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
      const recommendation = await withBusy(recBtn, () => API.recommend(recBtn.dataset.rec));
      const employee = employees.find((item) => String(item.id) === String(recBtn.dataset.rec));
      showRecommendationDetails(recommendation, employee?.user_name || 'الموظف');
      showToast('تم توليد التوصية والخطة');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      recBtn.disabled = false;
    }
  });
}

