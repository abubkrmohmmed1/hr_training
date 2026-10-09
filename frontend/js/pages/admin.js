import { API } from '../modules/api.js';
import { $, $$, escapeHtml, matchesQuery, getRoleArabic, getBadgeClass, getStatusArabic, getActionLabel, formatDateTime, exportProgressCsv, exportProgressPdf, reportOverviewHtml, showEmployeeModal, showCourseModal, showSkillModal, showDepartmentModal, showCourseDetails, initPage, empty } from '../modules/ui.js';

export async function initAdminPage() {
  if (!await initPage()) return;
  const stats = await API.adminStats();
  $('#kpi-employees').textContent = stats.total_employees;
  $('#kpi-departments').textContent = stats.total_departments;
  $('#kpi-courses').textContent = stats.total_courses;
  $('#kpi-users').textContent = stats.total_users;

  const [dist, users, courses, assessments, auditLogs, overview] = await Promise.all([
    API.deptDistribution(),
    API.users(),
    API.courses(),
    API.assessments(),
    API.auditLogs().catch(() => []),
    API.reportOverview(),
  ]);

  if ($('#admin-report-overview')) $('#admin-report-overview').innerHTML = reportOverviewHtml(overview);
  $('#export-csv')?.addEventListener('click', exportProgressCsv);
  $('#export-pdf')?.addEventListener('click', exportProgressPdf);

  const ctx = document.getElementById('deptChart');
  if (ctx && window.Chart) {
    window.Chart.getChart(ctx)?.destroy();
    new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: dist.map((d) => d.department),
        datasets: [{
          data: dist.map((d) => d.count),
          backgroundColor: ['#1E4FCD', '#059669', '#6366F1', '#D97706', '#0EA5E9'],
          borderWidth: 0,
        }],
      },
      options: {
        plugins: { legend: { position: 'left', labels: { font: { family: 'IBM Plex Sans Arabic' } } } },
        cutout: '62%',
      },
    });
  }

  const renderUsers = () => {
    const q = $('#user-search')?.value || '';
    const role = $('#user-role-filter')?.value || '';
    const rows = users.filter((u) => matchesQuery(`${u.name} ${u.email}`, q) && (!role || u.role === role));
    $('#users-table').innerHTML = rows.length ? rows.map((u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge badge-info">${getRoleArabic(u.role)}</span></td>
        <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'نشط' : 'معطّل'}</span></td>
      </tr>`).join('') : `<tr><td colspan="4">${empty('لا يوجد مستخدمون مطابقون')}</td></td>`;
  };
  $('#add-employee-btn')?.addEventListener('click', () => showEmployeeModal(() => window.location.reload()));
  $('#add-course-btn')?.addEventListener('click', () => showCourseModal(() => window.location.reload()));
  $('#add-skill-btn')?.addEventListener('click', () => showSkillModal(() => window.location.reload()));
  $('#add-dept-btn')?.addEventListener('click', () => showDepartmentModal(() => window.location.reload()));
  const renderCourses = () => {
    const q = $('#course-search')?.value || '';
    const rows = courses.filter((c) => matchesQuery(`${c.title} ${c.skill_name} ${c.provider}`, q));
    $('#courses-table').innerHTML = rows.length ? rows.map((c) => `
      <tr>
        <td>${c.title}</td>
        <td>${c.skill_name || '—'}</td>
        <td>${c.level}/5</td>
        <td>${c.duration_hours} ساعة</td>
        <td>${c.provider || '—'}</td>
        <td><button class="btn btn-secondary btn-sm" data-course-details="${c.id}">تفاصيل</button></td>
      </tr>`).join('') : `<tr><td colspan="6">${empty('لا توجد دورات مطابقة')}</td></tr>`;
  };
  $('#user-search')?.addEventListener('input', renderUsers);
  $('#user-role-filter')?.addEventListener('change', renderUsers);
  $('#course-search')?.addEventListener('input', renderCourses);
  $('#courses-table')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-course-details]');
    if (btn) showCourseDetails(btn.dataset.courseDetails, renderCourses);
  });
  renderUsers();
  renderCourses();

  const actBody = $('#activity-table');
  actBody.innerHTML = assessments.slice(0, 8).map((a) => `
    <tr>
      <td>${a.employee_name || '—'}</td>
      <td>${a.type === 'self' ? 'تقييم ذاتي' : 'تقييم مدير'}</td>
      <td>${a.assessment_date || '—'}</td>
      <td><span class="badge ${getBadgeClass(a.status)}">${getStatusArabic(a.status)}</span></td>
    </tr>`).join('') || empty('لا توجد أنشطة بعد');

  const auditBody = $('#audit-table');
  if (auditBody) {
    auditBody.innerHTML = auditLogs.length ? auditLogs.map((log) => `
      <tr>
        <td>${log.user_name || '—'}</td>
        <td><span class="badge badge-info">${getActionLabel(log.action)}</span></td>
        <td>${log.details || '—'}</td>
        <td>${formatDateTime(log.created_at)}</td>
      </tr>`).join('') : `<tr><td colspan="4">${empty('لا يوجد نشاط مسجّل بعد')}</td></tr>`;
  }
}
