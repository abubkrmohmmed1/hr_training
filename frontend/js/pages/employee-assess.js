/**
 * Page module: Employee Self-Assessment.
 */
import { API } from '../modules/api.js';
import { $, $$, renderStars, bindStars, levelLabel, showToast, withBusy, initPage } from '../modules/ui.js';

export async function initEmployeeAssessPage() {
  if (!await initPage()) return;
  const profile = await API.myProfile();
  let skills = await API.employeeSkills(profile.id);
  if (!skills.length) {
    skills = (await API.skills()).map((s) => ({
      skill_id: s.id,
      skill_name: s.name,
      skill_category: s.category,
      current_level: 0,
      target_level: 5
    }));
  }

  const groups = {};
  skills.forEach((s) => {
    const key = s.skill_category || 'مهارات عامة';
    (groups[key] ||= []).push(s);
  });

  const updateProgress = () => {
    const cards = [...$$('#assess-grid .skill-card')];
    const filled = cards.filter((c) => Number(c.querySelector('.star-rating').dataset.value) > 0).length;
    const percent = cards.length ? Math.round((filled / cards.length) * 100) : 0;
    const labelEl = $('#assess-progress-label');
    if (labelEl) labelEl.textContent = `تقدمك في التقييم ${filled} / ${cards.length} مهارة`;
    const fillEl = $('#assess-progress-fill');
    if (fillEl) fillEl.style.width = percent + '%';
  };

  const assessGrid = $('#assess-grid');
  if (assessGrid) {
    assessGrid.innerHTML = Object.entries(groups).map(([cat, list]) => `
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
    bindStars(assessGrid);
    assessGrid.addEventListener('click', updateProgress);
    updateProgress();
  }

  $('#submit-self')?.addEventListener('click', async () => {
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
}
