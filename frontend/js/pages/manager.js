/**
 * Page module: Manager Team Management, Plan Approval, and Skill Promotion.
 */
import { API } from '../modules/api.js';
import { Auth } from '../modules/auth.js';
import { $, $$, escapeHtml, matchesQuery, getBadgeClass, getStatusArabic, icon, signedGain, showToast, withBusy, renderStars, bindStars, levelLabel, progressBarColor, progressRow, exportProgressCsv, exportProgressPdf, reportOverviewHtml, initPage, empty } from '../modules/ui.js';

export async function initManagerPage() {
  if (!await initPage()) return;
  if (Auth.getUser()?.role !== 'manager') {
    showToast('صفحة تقييم الفريق متاحة للمدير المباشر فقط', 'error');
    Auth.redirectToDashboard();
    return;
  }
  let team; let ov;
  try {
    [team, ov] = await Promise.all([API.teamMembers(), API.teamOverview()]);
  } catch (error) {
    $('#manager-body').innerHTML = empty(`تعذر تحميل بيانات الفريق: ${error.message}`);
    return;
  }
  const [pendingPlans, pendingUpgrades, reportOverview] = await Promise.all([
    API.trainingPlans().catch(() => []),
    API.pendingSkillUpgrades().catch(() => []),
    API.reportOverview().catch(() => null),
  ]);
  if ($('#manager-report-overview')) $('#manager-report-overview').innerHTML = reportOverviewHtml(reportOverview);
  $('#export-csv')?.addEventListener('click', exportProgressCsv);
  $('#export-pdf')?.addEventListener('click', exportProgressPdf);
  let overview = ov;
  const select = $('#team-select');
  if (!team.length) {
    const managerBody = $('#manager-body');
    if (managerBody) managerBody.innerHTML = empty('لا يوجد أعضاء في فريقك بعد.');
    return;
  }

  const renderManagerApprovals = () => {
    const plansBox = $('#manager-plans-box');
    if (plansBox) {
      const teamMemberIds = new Set(team.map((member) => String(member.id)));
      const waiting = pendingPlans.filter((plan) => teamMemberIds.has(String(plan.employee_id)) && plan.status === 'pending_manager' && !plan.manager_approved);
      plansBox.innerHTML = waiting.length ? waiting.map((p) => `
        <div class="plan-card mb-md">
          <div class="plan-card-header">
            <strong>${escapeHtml(p.employee_name)} · ${escapeHtml(p.department_name || '')}</strong>
            <span class="badge badge-warning">بانتظار موافقتك</span>
          </div>
          <p class="text-body-sm text-secondary mb-sm">${escapeHtml(p.ai_reason || 'طلب خطة تدريب')}</p>
          <div class="plan-courses mb-md">
            ${(p.enrollments || []).map((e) => `<span class="course-chip">${escapeHtml(e.course_title)}</span>`).join('')}
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
            <strong>${escapeHtml(u.employee_name)}</strong>
            <div class="text-body-sm text-muted">أكمل دورة مرتبطة بمهارة: <strong>${escapeHtml(u.skill_name || 'مهارة')}</strong> (الحالي: ${u.previous_level}/5 ← المقترح: ${u.new_level}/5) · درجة الدورة: ${u.course_score ?? '—'}%</div>
            <div class="text-body-sm text-secondary mt-sm">قيّم أداء الموظف في المهارة أولاً؛ إكمال الدورة وحده لا يؤكد اكتسابها. الاعتماد فقط هو الذي يحدّث مستوى المهارة.</div>
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
        <td>${escapeHtml(m.user_name)}</td>
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
    if (!select) return;
    const id = Number(select.value);
    const member = team.find((m) => m.id === id);
    if (!member) return;
    const memberCard = $('#member-card');
    if (memberCard) {
      memberCard.innerHTML = `
        <div class="user-chip">
          <div class="avatar">${escapeHtml(member.user_name.charAt(0))}</div>
          <div class="user-meta">
            <strong>${escapeHtml(member.user_name)}</strong>
            <small>${escapeHtml(member.position || '')} · ${escapeHtml(member.department_name || '')}</small>
          </div>
        </div>`;
    }
    let skills, gaps, comparison;
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
    let usesCatalogSkills = false;
    if (!skills.length) {
      try {
        const catalog = await API.skills();
        skills = catalog.map((skill) => ({
          skill_id: skill.id,
          skill_name: skill.name,
          skill_category: skill.category,
          current_level: 0,
          target_level: skill.max_level || 5,
        }));
        usesCatalogSkills = true;
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    const gapList = $('#gap-list');
    if (gapList) {
      gapList.innerHTML = gaps.length
        ? gaps.map((g) => progressRow(g.skill_name, g.gap_percentage, `${g.current_level}/${g.target_level}`)).join('')
        : empty(usesCatalogSkills ? 'لم تُحدد فجوات بعد. سيُنشئ أول تقييم ملف مهارات الموظف.' : 'لا توجد فجوات واضحة');
    }
    const assessForm = $('#assess-form');
    if (assessForm) {
      assessForm.innerHTML = `${usesCatalogSkills ? '<div class="ai-banner mb-lg">هذا أول تقييم للموظف. اختر المستوى لكل مهارة؛ سيُنشئ النظام ملف المهارات تلقائيًا عند الحفظ.</div>' : ''}${skills.length ? skills.map((s) => `
        <div class="skill-card" data-skill="${s.skill_id}">
          <div class="skill-card-header">
            <div class="skill-card-title">${escapeHtml(s.skill_name)}</div>
            <span class="badge badge-muted">المطلوب ${s.target_level}/5</span>
          </div>
          <p class="skill-card-desc">التقييم الذاتي الحالي: ${s.current_level}/5</p>
          ${renderStars(s.current_level, 5, true)}
          <div class="level-hint">${levelLabel(s.current_level)}</div>
          <input class="form-input mt-md" placeholder="ملاحظات المدير">
        </div>`).join('') : empty('لا توجد مهارات في كتالوج النظام بعد. أضف مهارة من صفحة الإدارة أولًا.')}`;
      bindStars(assessForm);
    }
    if ($('#submit-assess')) $('#submit-assess').disabled = !skills.length;

    const box = $('#compare-box');
    if (box) {
      if (!comparison || (!comparison.self && !comparison.manager)) {
        box.innerHTML = empty('لا توجد تقييمات للمقارنة بعد لهذا الموظف');
      } else {
        const rows = (comparison.comparison || []).map((c) => {
          const deltaClass = c.delta == null ? 'badge-muted' : c.delta === 0 ? 'badge-info' : (c.delta > 0 ? 'badge-success' : 'badge-danger');
          return `<tr>
            <td>${escapeHtml(c.skill_name || '—')}</td>
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
    if (!select) return false;
    const q = $('#team-search')?.value || '';
    const list = team.filter((m) => matchesQuery(`${m.user_name} ${m.position} ${m.department_name}`, q));
    select.innerHTML = list.map((m) => `<option value="${m.id}">${escapeHtml(m.user_name)} — ${escapeHtml(m.position || '')}</option>`).join('');
    if (!list.length) {
      const memberCard = $('#member-card');
      if (memberCard) memberCard.innerHTML = empty('لا يوجد عضو مطابق');
      const gapList = $('#gap-list');
      if (gapList) gapList.innerHTML = '';
      const assessForm = $('#assess-form');
      if (assessForm) assessForm.innerHTML = '';
      return false;
    }
    return true;
  };

  $('#team-search')?.addEventListener('input', async () => {
    if (renderTeam()) await loadMember();
  });

  if (renderTeam()) {
    select?.addEventListener('change', loadMember);
    await loadMember();
  }

  $('#submit-assess')?.addEventListener('click', async () => {
    const id = Number(select?.value);
    const items = [...$$('#assess-form .skill-card')].map((card) => ({
      skill_id: Number(card.dataset.skill),
      score: Number(card.querySelector('.star-rating').dataset.value || 0),
      notes: card.querySelector('input').value || null,
    }));
    if (!items.length) {
      showToast('لا توجد مهارات لتقييمها لهذا الموظف', 'error');
      return;
    }
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
}

