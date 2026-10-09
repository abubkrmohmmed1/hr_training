/**
 * Page module: Employee Courses Catalog, Favorites & Reviews.
 */
import { API } from '../modules/api.js';
import { $, optionList, matchesQuery, escapeHtml, renderStars, showCourseDetails, showToast, withBusy, initPage, empty } from '../modules/ui.js';

function courseTypeLabel(type) {
  const map = { online: 'عبر الإنترنت', workshop: 'ورشة عمل', conference: 'مؤتمر' };
  return map[type] || 'أخرى';
}

export async function initEmployeeCoursesPage() {
  if (!await initPage()) return;
  const [courses, skills] = await Promise.all([API.courses(), API.skills()]);
  let onlyFavorites = false;

  const courseSkillSelect = $('#course-skill');
  if (courseSkillSelect) {
    courseSkillSelect.innerHTML = optionList(skills, 'id', 'name', 'كل المهارات');
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

    const courseCount = $('#course-count');
    if (courseCount) courseCount.textContent = list.length;

    const courseGrid = $('#course-grid');
    if (courseGrid) {
      courseGrid.innerHTML = list.length ? list.map((c) => `
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
    }
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

  $('#course-grid')?.addEventListener('click', async (ev) => {
    const detailBtn = ev.target.closest('[data-details]');
    const favBtn = ev.target.closest('[data-fav]');
    const enrollBtn = ev.target.closest('[data-enroll]');

    try {
      if (detailBtn) {
        showCourseDetails(detailBtn.dataset.details, refresh);
      } else if (favBtn) {
        await withBusy(favBtn, () => API.toggleFavorite(favBtn.dataset.fav));
        showToast(favBtn.textContent === '★' ? 'تمت إزالة الدورة من المفضلة' : 'تمت إضافة الدورة إلى المفضلة');
        refresh();
      } else if (enrollBtn) {
        await withBusy(enrollBtn, () => API.enrollCourse(enrollBtn.dataset.enroll));
        showToast('تم تسجيلك في الدورة');
        refresh();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  render();
}
